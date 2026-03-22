// index.js — Full pipeline: fetch → score → cluster → email
require("dotenv").config();

const { fetchAllNews }     = require("./src/fetchNews");
const { scoreAllArticles } = require("./src/scoreArticles");
const { clusterAllNews }   = require("./src/clusterNews");
const { buildEmailHTML }   = require("./src/template");
const { sendDailyBrief }   = require("./src/mailer");

async function runDailyBrief() {
  console.log("🚀 Daily Intelligence Brief pipeline starting...\n");
  const t0 = Date.now();

  // 1. Fetch — NewsData.io with hard filters (last 24h, top domains, no blogs/PR)
  const rawNews = await fetchAllNews();

  // 2. Score — Senior Editor gatekeeper (discard score ≤ 7)
  const scoredNews = await scoreAllArticles(rawNews);

  // 3. Cluster — group same-event coverage, unified summaries
  const clusteredNews = await clusterAllNews(scoredNews);

  // 4. Build HTML
  console.log("\n🎨 Building email...");
  const html = buildEmailHTML(clusteredNews);

  // 5. Send
  const result = await sendDailyBrief(html);

  console.log(`\n✅ Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return result;
}

if (require.main === module) {
  runDailyBrief().catch((err) => {
    console.error("\n❌ Pipeline failed:", err.message);
    process.exit(1);
  });
}

module.exports = { runDailyBrief };
