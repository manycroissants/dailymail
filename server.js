// server.js — Dev server with manual trigger + HTML preview
require("dotenv").config();

const express = require("express");
const { runDailyBrief } = require("./index");
const { fetchAllNews } = require("./src/fetchNews");
const { summarizeAll } = require("./src/summarize");
const { buildEmailHTML } = require("./src/template");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    service: "Daily Intelligence Brief",
    status: "running",
    endpoints: {
      "GET /api/send-test": "Run full pipeline and send email now",
      "GET /api/preview":   "Run pipeline, return HTML (no email sent)",
      "GET /health":        "Health check",
    },
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Manual send trigger ────────────────────────────────────────────────────
app.get("/api/send-test", async (_req, res) => {
  console.log("\n▶ Manual trigger: /api/send-test");
  try {
    const result = await runDailyBrief();
    res.json({ success: true, message: "Email sent!", result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── HTML preview (no email) ────────────────────────────────────────────────
app.get("/api/preview", async (_req, res) => {
  console.log("\n▶ Preview: building email HTML...");
  try {
    const rawNews = await fetchAllNews();
    const enrichedNews = await summarizeAll(rawNews);
    const html = buildEmailHTML(enrichedNews);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🌐 Dev server: http://localhost:${PORT}`);
  console.log(`   Send now:    http://localhost:${PORT}/api/send-test`);
  console.log(`   Preview:     http://localhost:${PORT}/api/preview\n`);
});
