// server.js — Dev server with manual trigger and preview
require("dotenv").config();

const express = require("express");
const { runDailyBrief }    = require("./index");
const { fetchAllNews }     = require("./src/fetchNews");
const { scoreAllArticles } = require("./src/scoreArticles");
const { clusterAllNews }   = require("./src/clusterNews");
const { buildEmailHTML }   = require("./src/template");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_req, res) => res.json({
  service: "Daily Intelligence Brief",
  pipeline: "fetch → score → cluster → email",
  endpoints: {
    "GET /api/send-test": "Run full pipeline and send email",
    "GET /api/preview":   "Run pipeline, return HTML preview (no email sent)",
    "GET /health":        "Health check",
  },
}));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/send-test", async (_req, res) => {
  console.log("\n▶ Manual trigger: /api/send-test");
  try {
    const result = await runDailyBrief();
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/preview", async (_req, res) => {
  console.log("\n▶ Preview mode");
  try {
    const raw       = await fetchAllNews();
    const scored    = await scoreAllArticles(raw);
    const clustered = await clusterAllNews(scored);
    const html      = buildEmailHTML(clustered);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🌐 Dev server: http://localhost:${PORT}`);
  console.log(`   Send:    http://localhost:${PORT}/api/send-test`);
  console.log(`   Preview: http://localhost:${PORT}/api/preview\n`);
});
