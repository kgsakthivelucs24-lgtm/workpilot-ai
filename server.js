const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const apiKey = process.env.OPENAI_API_KEY || "";
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const toolSpecs = {
  resume: "Create an ATS-friendly, truthful, PDF-ready resume and cover letter opening. Never invent degrees, companies, dates, certifications, or metrics.",
  study: "Create a realistic study plan with timetable, syllabus breakdown, weak-area strategy, revision system, and progress tracker.",
  meeting: "Create a meeting pack with executive summary, decisions, action table, open questions, and follow-up email. Do not invent decisions.",
  content: "Create a content campaign calendar with positioning, publishing table, hooks, CTAs, and metrics. Avoid deceptive claims.",
  document: "Create a plain-English document analysis with extracted points, checklist, questions, and disclaimer. Do not provide legal advice."
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function parseAiJson(text) {
  const trimmed = String(text || "").trim();
  const cleaned = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

async function callOpenAi(tool, data) {
  const input = [
    {
      role: "system",
      content:
        "You are WorkPilot AI, a professional productivity assistant. Return ONLY valid JSON with keys title and html. The html must use safe semantic tags only: article, header, h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td, strong. No scripts, links, styles, images, markdown, or code fences."
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          tool,
          instruction: toolSpecs[tool] || "Create a useful professional output.",
          data
        },
        null,
        2
      )
    }
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input,
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${detail}`);
  }

  const payload = await response.json();
  const parsed = parseAiJson(extractOutputText(payload));
  if (!parsed.title || !parsed.html) throw new Error("AI response missing title or html");
  return parsed;
}

async function callOpenAiAssistant(tool, question, data) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are WorkPilot's in-app helper. Give short, practical guidance for the current tool. Help the user decide what to fill, improve weak sections, and avoid unsafe claims. Do not produce long essays. Do not provide legal, medical, or financial advice."
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              currentTool: tool,
              toolPurpose: toolSpecs[tool] || "General productivity help",
              userQuestion: question,
              currentFormData: data
            },
            null,
            2
          )
        }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI assistant error ${response.status}: ${detail}`);
  }

  return extractOutputText(await response.json()).trim();
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      sendJson(res, 200, { ok: true, ai: apiKey ? "live" : "local", model: apiKey ? model : null });
      return;
    }

    if (req.method === "POST" && req.url === "/api/generate") {
      if (!apiKey) {
        sendJson(res, 503, { error: "OPENAI_API_KEY is not configured" });
        return;
      }

      const body = JSON.parse(await readBody(req));
      if (!body.tool || !body.data || !toolSpecs[body.tool]) {
        sendJson(res, 400, { error: "Invalid tool or data" });
        return;
      }

      const result = await callOpenAi(body.tool, body.data);
      sendJson(res, 200, { ...result, mode: "live" });
      return;
    }

    if (req.method === "POST" && req.url === "/api/assist") {
      if (!apiKey) {
        sendJson(res, 503, { error: "OPENAI_API_KEY is not configured" });
        return;
      }

      const body = JSON.parse(await readBody(req));
      if (!body.tool || !body.question) {
        sendJson(res, 400, { error: "Invalid helper request" });
        return;
      }

      const answer = await callOpenAiAssistant(body.tool, body.question, body.data || {});
      sendJson(res, 200, { answer, mode: "live" });
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, host, () => {
  console.log(`WorkPilot AI running at http://${host}:${port}`);
  console.log(apiKey ? `Live AI enabled with model ${model}` : "OPENAI_API_KEY missing. Frontend will use local fallback.");
});
