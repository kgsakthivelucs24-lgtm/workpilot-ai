# WorkPilot AI Prompt Blueprints

These blueprints describe the production behavior for each AI tool. Use them when connecting a real AI API.

## Resume Builder

Input: name, contact, links, target role, experience level, education, skills, work experience, projects, achievements, certifications, job description.

Output:
- ATS-friendly resume header
- Professional summary tailored to role
- Core skills grouped by relevance
- Work experience bullets with action, tool, result, metric
- Project bullets with problem, stack, contribution, outcome
- Education and certifications
- Job-match keywords
- Cover letter opening
- Quality checklist warning against fake claims

Rules:
- Never invent degrees, companies, dates, certifications, or metrics.
- If information is missing, suggest what the user should add.
- Keep wording professional, clear, and truthful.

## Study Planner

Input: exam goal, subjects, syllabus, deadline, current level, hours per day, study days per week, preferred time, weak areas, target score.

Output:
- Study strategy
- Weekly timetable
- Syllabus priority breakdown
- Weak-area recovery plan
- Revision system
- Mock test plan
- Deadline and progress tracker

Rules:
- Plans must be realistic for the available time.
- Weak areas must be scheduled early and repeatedly.
- Include review and active recall, not only reading.

## Meeting Notes

Input: title, date, transcript/notes, attendees, objective, decisions, open questions, owners, tone.

Output:
- Executive summary
- Confirmed decisions
- Action items table with owner/status/next step
- Open questions
- Follow-up email

Rules:
- Do not invent final decisions when notes are unclear.
- Mark uncertain items as open questions.
- Every action item needs one owner and one next step.

## Content Calendar

Input: brand, platform, audience, goal, offer/topic, tone, frequency, important dates.

Output:
- Audience positioning
- Publishing calendar
- Content pillars
- Hooks/caption templates
- CTA ideas
- Metrics to track

Rules:
- Avoid spammy or deceptive claims.
- Include clear CTA and trackable outcomes.
- Match content to platform and audience.

## Document Analyzer

Input: document type, title, full text, focus, user role, known dates/amounts.

Output:
- Plain-English summary
- Important extracted points
- Checklist of risks/obligations/dates
- Questions to ask
- Clear disclaimer

Rules:
- Do not provide legal advice.
- Do not tell the user to sign or not sign.
- Flag ambiguity and recommend professional review for high-risk documents.
