const titles = {
  dashboard: "Dashboard",
  resume: "Resume Builder",
  study: "Study Planner",
  meeting: "Meeting Notes",
  content: "Content Calendar",
  document: "Document Summary",
  pricing: "Pricing",
  legal: "Legal"
};

const planCredits = {
  Free: 5,
  Starter: 100,
  Pro: 999
};

const helperSuggestions = {
  dashboard: ["Which tool should I start with?", "How does this app make money?", "What should I build next?"],
  resume: ["What should I write in achievements?", "Improve my experience bullets", "What skills are missing?"],
  study: ["Make my timetable realistic", "How do I handle weak topics?", "What should I fill in syllabus?"],
  meeting: ["Summarize my rough notes", "Create action items", "Write a follow-up email"],
  content: ["Give me post ideas", "Improve my content hooks", "Create CTAs for this audience"],
  document: ["Explain this in simple words", "What risks should I check?", "What questions should I ask?"],
  pricing: ["Which plan should I choose?", "How should pricing work?", "What payment rules are needed?"],
  legal: ["What disclaimers are needed?", "What data policy is needed?", "What should users avoid?"]
};

const state = {
  account: JSON.parse(localStorage.getItem("wp_account") || "{}"),
  plan: localStorage.getItem("wp_plan") || "Free",
  credits: Number(localStorage.getItem("wp_credits") || 5),
  projects: JSON.parse(localStorage.getItem("wp_projects") || "[]"),
  checkoutPlan: "Starter",
  aiMode: "checking",
  activeView: "dashboard",
  authMode: "signin"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function saveState() {
  localStorage.setItem("wp_account", JSON.stringify(state.account));
  localStorage.setItem("wp_plan", state.plan);
  localStorage.setItem("wp_credits", String(state.credits));
  localStorage.setItem("wp_projects", JSON.stringify(state.projects));
  renderState();
}

function renderState() {
  const signedIn = Boolean(state.account.name || state.account.email || state.account.phone);
  const displayName = state.account.name || state.account.email || state.account.phone || "User";
  document.body.classList.toggle("auth-locked", !signedIn);
  $("#authScreen").hidden = signedIn;
  const limit = planCredits[state.plan] || 5;
  $("#credits").textContent = state.credits;
  $("#creditLimit").textContent = state.plan === "Pro" ? " unlimited" : `/${limit} left`;
  $("#creditMeter").style.width = `${Math.min(100, Math.max(0, state.credits / limit) * 100)}%`;
  $("#savedCount").textContent = state.projects.length;
  $("#planName").textContent = state.plan;
  $("#planLabel").textContent = state.plan === "Free" ? "Free credits" : `${state.plan} credits`;
  $("#planBadge").textContent = state.plan === "Free" ? "Trial" : "Active";
  $("#accountBtn").textContent = displayName;
  $("#sidebarUserName").textContent = displayName;
  $("#welcomeLine").textContent = signedIn ? `Welcome, ${displayName}` : "Welcome back";
  $("#aiStatus").textContent = state.aiMode === "live" ? "AI: live" : state.aiMode === "local" ? "AI: local" : "AI: checking";
  $("#aiStatus").classList.toggle("live", state.aiMode === "live");
  $("#emptyState").textContent = state.projects.length ? "Saved in this browser" : "Nothing saved yet";

  const list = $("#savedProjects");
  list.innerHTML = "";
  state.projects.slice(0, 8).forEach((project) => {
    const item = document.createElement("div");
    item.className = "saved-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(project.title)}</strong>
        <span>${escapeHtml(project.tool)} • ${new Date(project.createdAt).toLocaleString()}</span>
      </div>
      <div class="saved-actions">
        <button class="secondary preview-project" type="button">Preview</button>
        <button class="secondary delete-project" type="button">Delete</button>
      </div>
    `;
    $(".preview-project", item).addEventListener("click", () => showSaved(project));
    $(".delete-project", item).addEventListener("click", () => deleteProject(project.id));
    list.appendChild(item);
  });
}

function signIn(account) {
  state.account = {
    name: account.name || account.email || account.phone || "WorkPilot User",
    email: account.email || "",
    phone: account.phone || "",
    method: account.method || "email"
  };
  saveState();
  showToast(`Signed in with ${state.account.method}.`);
}

function signOut() {
  state.account = {};
  saveState();
  $("#accountModal").close();
  $("#aiPanel").hidden = true;
  $("#aiFab").hidden = false;
  showToast("Signed out.");
}

function renderAuthMode() {
  const isSignup = state.authMode === "signup";
  $("#authHeading").textContent = isSignup ? "Create account" : "Welcome back";
  $("#emailAuthSubmit").textContent = isSignup ? "Sign up" : "Sign in";
  $("#authSwitchText").textContent = isSignup ? "Already have an account?" : "Don't have an account?";
  $("#authModeBtn").textContent = isSignup ? "Sign in" : "Sign up";
  $("#googleAuthText").textContent = isSignup ? "Sign up with Google" : "Sign in with Google";
  $("#facebookAuthText").textContent = isSignup ? "Sign up with Facebook" : "Sign in with Facebook";
  $("#phoneAuthSubmit").textContent = isSignup ? "Sign up with Phone" : "Sign in with Phone";
  $("#authSignInTab").classList.toggle("active", !isSignup);
  $("#authSignUpTab").classList.toggle("active", isSignup);
  $("#authName").classList.toggle("show", isSignup);
  $("#authName").required = isSignup;
}

function setAuthMode(mode) {
  state.authMode = mode;
  renderAuthMode();
}

function setView(id) {
  state.activeView = id;
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === id));
  $("#viewTitle").textContent = titles[id] || "Dashboard";
  renderHelperSuggestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function consumeCredit() {
  if (state.plan !== "Pro" && state.credits <= 0) {
    setView("pricing");
    showToast("You used all credits. Upgrade to unlock more generations.");
    return false;
  }
  if (state.plan !== "Pro") state.credits -= 1;
  saveState();
  return true;
}

function renderResult(tool, title, html) {
  const panel = $(`[data-result="${tool}"]`);
  const fragment = $("#resultTemplate").content.cloneNode(true);
  $(".result-content", fragment).innerHTML = html;
  $(".copy-btn", fragment).addEventListener("click", () => copyText(panel));
  $(".save-btn", fragment).addEventListener("click", () => {
    state.projects.unshift({ id: crypto.randomUUID(), title, tool: titles[tool], html, createdAt: Date.now() });
    saveState();
    showToast("Saved to Recent Projects.");
  });
  $(".download-btn", fragment).addEventListener("click", () => downloadText(title, panel.innerText.trim()));
  $(".print-btn", fragment).addEventListener("click", () => {
    showToast("Choose Save as PDF in the print dialog.");
    window.setTimeout(() => window.print(), 250);
  });
  panel.innerHTML = "";
  panel.appendChild(fragment);
}

function renderLoading(tool) {
  const panel = $(`[data-result="${tool}"]`);
  panel.innerHTML = `
    <div class="loading-state">
      <strong>Generating with WorkPilot AI...</strong>
      <span>This can take a few seconds.</span>
    </div>
  `;
}

function copyText(panel) {
  navigator.clipboard.writeText(panel.innerText.trim());
  showToast("Copied to clipboard.");
}

function showSaved(project) {
  setView("dashboard");
  const list = $("#savedProjects");
  const preview = document.createElement("section");
  preview.className = "panel";
  preview.innerHTML = `<h2>${escapeHtml(project.title)}</h2>${project.html}`;
  list.prepend(preview);
}

function deleteProject(id) {
  state.projects = state.projects.filter((project) => project.id !== id);
  saveState();
  showToast("Project deleted.");
}

function downloadText(title, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workpilot-draft"}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Text file downloaded.");
}

function openCheckout(plan) {
  state.checkoutPlan = plan;
  $("#checkoutTitle").textContent = `Upgrade to ${plan}`;
  $("#checkoutPlan").textContent = plan;
  $("#checkoutCopy").textContent =
    plan === "Starter"
      ? "100 generations, PDF exports, premium templates, and saved history."
      : "Unlimited standard tools, long documents, brand profiles, and priority features.";
  $("#checkoutModal").showModal();
}

function activatePlan(plan) {
  state.plan = plan;
  state.credits = planCredits[plan] || 5;
  saveState();
  showToast(`${plan} demo plan activated.`);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  doc.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
  doc.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || "").toLowerCase();
      if (name.startsWith("on") || value.includes("javascript:")) node.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
}

async function checkAiStatus() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("AI health unavailable");
    const data = await response.json();
    state.aiMode = data.ai === "live" ? "live" : "local";
  } catch {
    state.aiMode = "local";
  }
  renderState();
}

async function generateWithAi(tool, data) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, data })
  });
  if (!response.ok) throw new Error("AI generation failed");
  const payload = await response.json();
  if (!payload?.title || !payload?.html) throw new Error("Invalid AI response");
  state.aiMode = payload.mode === "live" ? "live" : "local";
  renderState();
  return { title: payload.title, html: sanitizeHtml(payload.html) };
}

function activeFormData() {
  const form = $(`#${state.activeView} form[data-tool]`);
  return form ? formData(form) : {};
}

function renderHelperSuggestions() {
  const suggestions = helperSuggestions[state.activeView] || helperSuggestions.dashboard;
  $("#aiHelperTitle").textContent = `${titles[state.activeView] || "WorkPilot"} Assistant`;
  $("#aiSuggestions").innerHTML = suggestions
    .map((text) => `<button class="ai-chip" type="button">${escapeHtml(text)}</button>`)
    .join("");
  $$(".ai-chip", $("#aiSuggestions")).forEach((button) => {
    button.addEventListener("click", () => {
      $("#aiQuestion").value = button.textContent;
      askHelper(button.textContent);
    });
  });
}

function localHelpAnswer(tool, question, data) {
  const filled = Object.entries(data)
    .filter(([, value]) => String(value || "").trim())
    .map(([key]) => key);
  const missing = Object.entries(data)
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);
  const context = titles[tool] || "this tool";
  const q = String(question || "").toLowerCase();

  if (tool === "resume") {
    if (q.includes("achievement")) return "For achievements, write proof of impact: completed internship, built projects, improved speed, won awards, led a team, increased sales, reduced errors, or helped users. Use numbers wherever true.";
    if (q.includes("skill")) return "Add role-specific skills first, then tools and soft skills. For frontend: HTML, CSS, JavaScript, React, Git, APIs, responsive design, debugging, communication.";
    return "For the resume, fill truthful details only. Strong sections are projects, measurable achievements, internships, certifications, and job description keywords. Missing fields to improve: " + (missing.join(", ") || "none");
  }

  if (tool === "study") {
    return "For a strong study plan, list exact subjects, chapters, weak topics, deadline, daily hours, and target score. Put weak topics early in the week and revise with mock tests. Filled fields: " + (filled.join(", ") || "none yet");
  }

  if (tool === "meeting") {
    return "Paste rough notes, then add objective, decisions, action owners, and open questions. Good meeting output needs one owner and one next step for every action item.";
  }

  if (tool === "content") {
    return "Good content needs audience, platform, goal, offer, tone, and frequency. Use a mix of problem, education, proof, behind-the-scenes, offer, FAQ, and CTA posts.";
  }

  if (tool === "document") {
    return "Paste the full document text, choose your role, and focus on risks, dates, payments, obligations, ownership, cancellation, renewal, and penalties. This should stay as reading help, not legal advice.";
  }

  return `Ask about ${context}. I can help decide what to fill, what is missing, or how to improve the output.`;
}

async function askHelper(question) {
  const tool = state.activeView;
  const data = activeFormData();
  $("#aiAnswer").textContent = "Thinking...";
  try {
    const response = await fetch("/api/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, question, data })
    });
    if (!response.ok) throw new Error("Assistant unavailable");
    const payload = await response.json();
    $("#aiAnswer").textContent = payload.answer || localHelpAnswer(tool, question, data);
    state.aiMode = payload.mode === "live" ? "live" : state.aiMode;
    renderState();
  } catch {
    $("#aiAnswer").textContent = localHelpAnswer(tool, question, data);
  }
}

function splitItems(value, fallback) {
  const items = String(value || "")
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paragraphFrom(value, fallback) {
  return escapeHtml(value || fallback);
}

function bullets(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function section(title, content) {
  if (!content) return "";
  return `<h3>${title}</h3>${content}`;
}

function improveAchievement(item, role) {
  const clean = escapeHtml(item);
  const hasMetric = /\d|%|reduced|increased|improved|optimized|saved|launched|built|created/i.test(item);
  if (hasMetric) return clean;
  return `${clean}, showing ownership, execution, and practical impact for a ${escapeHtml(role)} role`;
}

function studyDayRows(subjects, days, hours, time) {
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return dayNames
    .slice(0, days)
    .map((day, index) => {
      const subject = subjects[index % subjects.length];
      return `
        <tr>
          <td>${day}</td>
          <td>${escapeHtml(time)}</td>
          <td>${escapeHtml(subject)}</td>
          <td>${escapeHtml(hours)} hour${Number(hours) > 1 ? "s" : ""}</td>
          <td>Concept review, practice questions, error log, 10-minute recall</td>
        </tr>
      `;
    })
    .join("");
}

function contentCalendarRows(platform, topics, frequency) {
  const days = frequency.startsWith("3") ? ["Monday", "Wednesday", "Friday"] : frequency.startsWith("5") ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const pillars = ["Problem", "Education", "Proof", "Behind the scenes", "Offer", "FAQ", "Community"];
  return days
    .map((day, index) => {
      const topic = topics[index % topics.length];
      const pillar = pillars[index % pillars.length];
      return `
        <tr>
          <td>${day}</td>
          <td>${pillar}</td>
          <td>${escapeHtml(topic)}</td>
          <td>${escapeHtml(platform)}</td>
          <td>Hook, useful body, clear CTA</td>
        </tr>
      `;
    })
    .join("");
}

function extractImportantLines(text) {
  return String(text || "")
    .split(/\n|\.|;|:/)
    .map((line) => line.trim())
    .filter((line) => line.length > 18)
    .slice(0, 8);
}

const generators = {
  resume(data) {
    const role = data.role || "Target Role";
    const name = data.name || "Candidate Name";
    const skills = splitItems(data.skills, ["communication", "problem solving", "ownership"]);
    const achievements = splitItems(data.achievements, ["delivered measurable project outcomes", "collaborated with cross-functional teams"]);
    const work = splitItems(data.work, []);
    const projects = splitItems(data.projects, []);
    const education = splitItems(data.education, []);
    const certifications = splitItems(data.certifications, []);
    const jobKeywords = splitItems(data.job, []).slice(0, 8);
    const experienceLabel = data.experience || "career-focused candidate";
    const topSkills = skills.slice(0, 5).map(escapeHtml).join(", ");
    return {
      title: `${name} ${role} Resume`,
      html: `
        <article class="resume-document">
          <header class="resume-header">
            <h2>${escapeHtml(name)}</h2>
            <p>${paragraphFrom(data.contact, "email@example.com | phone number")} ${data.links ? `| ${escapeHtml(data.links)}` : ""}</p>
            <strong>${escapeHtml(role)}</strong>
          </header>
          <h3>Professional Summary</h3>
          <p>${escapeHtml(experienceLabel)} targeting a ${escapeHtml(role)} role, with strengths in ${topSkills}. Brings practical execution, clear communication, and the ability to turn learning, projects, and achievements into measurable work outcomes.</p>
          <h3>Core Skills</h3>
          <p>${skills.map(escapeHtml).join(" • ")}</p>
          ${section(
            "Professional Experience",
            work.length
              ? `<ul>${work.map((item) => `<li>${improveAchievement(item, role)}</li>`).join("")}</ul>`
              : `<ul><li>Add internship, freelance, part-time, college, volunteer, or business experience here. Focus on actions, tools used, and results.</li></ul>`
          )}
          ${section(
            "Projects",
            projects.length
              ? `<ul>${projects.map((item) => `<li>${improveAchievement(item, role)}</li>`).join("")}</ul>`
              : `<ul><li>Add 2-3 strong projects with tech stack, your responsibility, features built, and final result.</li></ul>`
          )}
          <h3>Achievements</h3>
          <ul>${achievements.map((item) => `<li>${improveAchievement(item, role)}</li>`).join("")}</ul>
          ${section("Education", education.length ? `<ul>${bullets(education)}</ul>` : "")}
          ${section("Certifications", certifications.length ? `<ul>${bullets(certifications)}</ul>` : "")}
          ${section("Job Match Keywords", jobKeywords.length ? `<p>${jobKeywords.map(escapeHtml).join(" • ")}</p>` : "")}
        </article>
        <h3>Cover Letter Opening</h3>
        <p>I am excited to apply for the ${escapeHtml(role)} position. My background in ${skills.slice(0, 2).map(escapeHtml).join(" and ")} matches the needs of this role, and I would welcome the opportunity to contribute with reliable execution and strong learning ability.</p>
        <h3>Quality Check</h3>
        <ul>
          <li>Add numbers where possible, such as revenue, time saved, accuracy, users served, or project size.</li>
          <li>Keep only true qualifications and remove anything that cannot be verified.</li>
          <li>Match keywords from the job description naturally, not by stuffing terms.</li>
        </ul>
      `
    };
  },
  study(data) {
    const subjects = splitItems(data.subjects, ["core concepts", "practice questions", "revision"]);
    const syllabus = splitItems(data.syllabus, subjects);
    const weakAreas = splitItems(data.weakness, ["the most difficult topic"]);
    const hours = data.hours || 2;
    const days = Math.min(7, Math.max(1, Number(data.days || 6)));
    const weeklyHours = Number(hours) * days;
    const time = data.time || "Evening";
    return {
      title: `${data.goal || "Study"} Complete Study Plan`,
      html: `
        <article class="plan-document">
          <header class="resume-header">
            <h2>${escapeHtml(data.goal || "Study Plan")}</h2>
            <p>${escapeHtml(data.level || "Current level")} level • ${escapeHtml(hours)} hours/day • ${days} study days/week • ${weeklyHours} hours/week</p>
            <strong>${paragraphFrom(data.target, "Target: complete the syllabus with confident revision")}</strong>
          </header>
          <h3>Plan Strategy</h3>
          <p>Use a ${days}-day weekly cycle: learn concepts first, solve questions immediately, track mistakes, revise weak topics, and test under time pressure before the deadline.</p>
          <h3>Weekly Timetable</h3>
          <table class="plan-table">
            <thead><tr><th>Day</th><th>Time</th><th>Main Focus</th><th>Duration</th><th>Method</th></tr></thead>
            <tbody>${studyDayRows(subjects, days, hours, time)}</tbody>
          </table>
          <h3>Syllabus Breakdown</h3>
          <ul>${syllabus.map((topic, index) => `<li>Priority ${index + 1}: ${escapeHtml(topic)}. Study concept, solve examples, then create one-page notes.</li>`).join("")}</ul>
          <h3>Weak-Area Recovery Plan</h3>
          <ul>${weakAreas.map((topic) => `<li>${escapeHtml(topic)}: spend the first 25 minutes of every session on basics, then solve 5 targeted questions and record mistakes.</li>`).join("")}</ul>
          <h3>Revision System</h3>
          <ol>
            <li>Same day: 10-minute active recall without notes.</li>
            <li>Next day: redo mistakes before learning a new topic.</li>
            <li>Weekly: one timed mock test or mixed practice set.</li>
            <li>Final week: revise short notes, formulas, definitions, and past mistakes only.</li>
          </ol>
          <h3>Deadline</h3>
          <p>${data.deadline ? `Plan target date: ${escapeHtml(data.deadline)}.` : "Add a deadline to make the plan more exact."}</p>
          <h3>Progress Tracker</h3>
          <ul>
            <li>Syllabus completed: ___%</li>
            <li>Mock test score: ___</li>
            <li>Weak topics remaining: ___</li>
            <li>Next review date: ___</li>
          </ul>
        </article>
      `
    };
  },
  meeting(data) {
    const notes = paragraphFrom(data.notes, "No raw notes were provided, so this is a structure-only draft.");
    const decisions = splitItems(data.decisions, ["Confirm final decision owners after reviewing the notes"]);
    const questions = splitItems(data.questions, ["Clarify unresolved blockers before the next meeting"]);
    const owners = splitItems(data.owners, ["Assign every action item to one owner with one due date"]);
    return {
      title: `${data.title || "Meeting"} Meeting Pack`,
      html: `
        <article class="plan-document">
          <header class="resume-header">
            <h2>${escapeHtml(data.title || "Meeting Pack")}</h2>
            <p>${data.date ? escapeHtml(data.date) : "Date not provided"} • ${paragraphFrom(data.attendees, "Attendees not listed")}</p>
            <strong>${paragraphFrom(data.objective, "Objective: align on decisions, owners, and next steps")}</strong>
          </header>
          <h3>Executive Summary</h3>
          <p>${notes}</p>
          <h3>Confirmed Decisions</h3>
          <ul>${bullets(decisions)}</ul>
          <h3>Action Items</h3>
          <table class="plan-table">
            <thead><tr><th>Owner / Task</th><th>Status</th><th>Next Step</th></tr></thead>
            <tbody>${owners.map((owner) => `<tr><td>${escapeHtml(owner)}</td><td>Open</td><td>Confirm deadline and report progress before next check-in</td></tr>`).join("")}</tbody>
          </table>
          <h3>Open Questions</h3>
          <ul>${bullets(questions)}</ul>
          <h3>${escapeHtml(data.tone || "Professional")} Follow-Up Email</h3>
          <p>Hi everyone, thanks for joining. I have summarized the objective, key decisions, action items, and open questions above. Please reply with corrections or missing items today so we can keep ownership and deadlines clear.</p>
        </article>
      `
    };
  },
  content(data) {
    const platform = data.platform || "Instagram";
    const topics = splitItems(data.topic, ["main offer", "customer problem", "useful tip", "proof story"]);
    const dates = splitItems(data.dates, []);
    const frequency = data.frequency || "7 posts/week";
    return {
      title: `${data.brand || "Brand"} Content Campaign`,
      html: `
        <article class="plan-document">
          <header class="resume-header">
            <h2>${escapeHtml(data.brand || "Brand")} Content Calendar</h2>
            <p>${escapeHtml(platform)} • ${escapeHtml(frequency)} • ${paragraphFrom(data.tone, "Helpful")} tone</p>
            <strong>${paragraphFrom(data.goal, "Goal: grow audience and convert interested users")}</strong>
          </header>
          <h3>Audience Positioning</h3>
          <p>Create content for ${paragraphFrom(data.audience, "the target audience")} by mixing education, trust, proof, and direct calls to action.</p>
          <h3>Publishing Calendar</h3>
          <table class="plan-table">
            <thead><tr><th>Day</th><th>Pillar</th><th>Topic</th><th>Platform</th><th>Structure</th></tr></thead>
            <tbody>${contentCalendarRows(platform, topics, frequency)}</tbody>
          </table>
          <h3>Caption Templates</h3>
          <ul>
            <li>Problem hook: Most people struggle with ${escapeHtml(topics[0])} because they do not have a simple system.</li>
            <li>Education hook: Here is one practical way to improve ${escapeHtml(topics[0])} today.</li>
            <li>Offer hook: If you want help with ${escapeHtml(topics[0])}, here is the easiest next step.</li>
          </ul>
          ${dates.length ? `<h3>Important Dates</h3><ul>${bullets(dates)}</ul>` : ""}
          <h3>Metrics To Track</h3>
          <ul>
            <li>Reach and saves for educational posts.</li>
            <li>Replies, leads, bookings, and clicks for offer posts.</li>
            <li>Best-performing hook style and topic category.</li>
          </ul>
        </article>
      `
    };
  },
  document(data) {
    const text = String(data.text || "");
    const sentences = text.split(/[.!?]/).map((item) => item.trim()).filter(Boolean);
    const summary = sentences.slice(0, 3).join(". ") || "Paste document text to generate a stronger summary";
    const importantLines = extractImportantLines(text);
    return {
      title: `${data.title || data.type || "Document"} Analysis`,
      html: `
        <article class="plan-document">
          <header class="resume-header">
            <h2>${escapeHtml(data.title || data.type || "Document Analysis")}</h2>
            <p>${escapeHtml(data.type || "Document")} • Role: ${escapeHtml(data.role || "Reader")}</p>
            <strong>${paragraphFrom(data.focus, "Focus: risks, deadlines, obligations, and next steps")}</strong>
          </header>
          <h3>Plain-English Summary</h3>
          <p>${escapeHtml(summary)}.</p>
          <h3>Important Extracted Points</h3>
          <ul>${importantLines.length ? bullets(importantLines) : "<li>Paste more document text to extract stronger points.</li>"}</ul>
          <h3>Checklist</h3>
          <ul>
            <li>Parties, dates, renewal terms, and cancellation rules.</li>
            <li>Payment obligations, penalties, refund conditions, and hidden fees.</li>
            <li>Ownership, confidentiality, data handling, and intellectual property language.</li>
            <li>Any clause that limits rights, creates long-term commitments, or adds liability.</li>
          </ul>
          ${data.known ? `<h3>Known Dates Or Amounts</h3><p>${escapeHtml(data.known)}</p>` : ""}
          <h3>Questions To Ask Before Agreeing</h3>
          <ul>
            <li>What happens if either party wants to cancel early?</li>
            <li>Are there any automatic renewals, penalties, or non-refundable fees?</li>
            <li>Who owns the final work, data, files, or intellectual property?</li>
            <li>Which responsibilities must be completed by each side and by what date?</li>
          </ul>
          <h3>Disclaimer</h3>
          <p>This is an AI-style reading aid, not legal advice. Ask a qualified professional before signing or relying on a contract.</p>
        </article>
      `
    };
  }
};

$$("[data-view], [data-view-jump]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view || button.dataset.viewJump));
});

$$("[data-plan]").forEach((button) => {
  button.addEventListener("click", () => {
    const plan = button.dataset.plan;
    if (plan === "Free") {
      activatePlan("Free");
      return;
    }
    openCheckout(plan);
  });
});

$$("form[data-tool]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!consumeCredit()) return;
    const tool = form.dataset.tool;
    const data = formData(form);
    renderLoading(tool);
    let result;
    try {
      result = await generateWithAi(tool, data);
      showToast("Generated with live AI.");
    } catch {
      result = generators[tool](data);
      state.aiMode = "local";
      renderState();
      showToast("Using local generator. Start the AI server with an API key for live AI.");
    }
    renderResult(tool, result.title, result.html);
  });
});

$("#clearDataBtn").addEventListener("click", () => {
  if (!confirm("Clear saved projects and reset free credits?")) return;
  state.account = {};
  state.plan = "Free";
  state.credits = 5;
  state.projects = [];
  saveState();
});

$("#accountBtn").addEventListener("click", () => {
  $("#accountName").value = state.account.name || "";
  $("#accountEmail").value = state.account.email || "";
  $("#accountModal").showModal();
});

$("#accountForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  state.account = {
    name: $("#accountName").value.trim(),
    email: $("#accountEmail").value.trim(),
    phone: state.account.phone || "",
    method: state.account.method || "email"
  };
  saveState();
  $("#accountModal").close();
  showToast("Account profile saved.");
});

$("#googleSignIn").addEventListener("click", () => {
  signIn({ name: "Google User", email: "google-user@example.com", method: "Google" });
});

$("#facebookSignIn").addEventListener("click", () => {
  signIn({ name: "Facebook User", email: "facebook-user@example.com", method: "Facebook" });
});

$("#emailAuthForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = $("#authEmail").value.trim();
  const name = $("#authName").value.trim();
  signIn({
    name: name || email.split("@")[0],
    email,
    method: "email"
  });
});

$("#authModeBtn").addEventListener("click", () => {
  setAuthMode(state.authMode === "signin" ? "signup" : "signin");
});

$("#authSignInTab").addEventListener("click", () => setAuthMode("signin"));

$("#authSignUpTab").addEventListener("click", () => setAuthMode("signup"));

$("#forgotPasswordBtn").addEventListener("click", () => {
  showToast("Password reset will be available after real auth is connected.");
});

$("#phoneAuthForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = $("#authPhone").value.trim();
  if (!phone) {
    showToast("Enter a phone number.");
    return;
  }
  signIn({ name: phone, phone, method: "phone" });
});

$("#signOutBtn").addEventListener("click", signOut);

$("#checkoutForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  activatePlan(state.checkoutPlan);
  $("#checkoutModal").close();
});

$("#aiFab").addEventListener("click", () => {
  $("#aiPanel").hidden = false;
  $("#aiFab").hidden = true;
  renderHelperSuggestions();
});

$("#aiCloseBtn").addEventListener("click", () => {
  $("#aiPanel").hidden = true;
  $("#aiFab").hidden = false;
});

$("#aiHelpForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const question = $("#aiQuestion").value.trim();
  if (!question) return;
  askHelper(question);
});

renderState();
renderHelperSuggestions();
renderAuthMode();
checkAiStatus();
