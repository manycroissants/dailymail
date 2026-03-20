// index.js — Orchestrator: fetch → summarize → build email → send
require("dotenv").config();

const { fetchAllNews } = require("./src/fetchNews");
const { summarizeAll } = require("./src/summarize");
const { buildEmailHTML } = require("./src/template");
const { sendDailyBrief } = require("./src/mailer");

async function runDailyBrief() {
  console.log("🚀 Daily Intelligence Brief pipeline starting...\n");
  const startTime = Date.now();

  // 1. Fetch from NewsData.io
  const rawNews = await fetchAllNews();

  // 2. Summarize + bias-tag via Gemini
  const enrichedNews = await summarizeAll(rawNews);

  // 3. Build HTML
  console.log("\n🎨 Building email template...");
  const html = buildEmailHTML(enrichedNews);

  // 4. Send via Resend
  const result = await sendDailyBrief(html);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Pipeline complete in ${elapsed}s`);
  return result;
}

if (require.main === module) {
  runDailyBrief().catch((err) => {
    console.error("\n❌ Pipeline failed:", err.message);
    process.exit(1);
  });
}

module.exports = { runDailyBrief };
