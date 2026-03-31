// index.js — Pipeline: fetch → history filter → score → cluster → email → record
require("dotenv").config();

const { fetchAllNews }              = require("./src/fetchNews");
const { filterByHistory,
        recordSentArticles }        = require("./src/history");
const { scoreAllArticles }          = require("./src/scoreArticles");
const { clusterAllNews }            = require("./src/clusterNews");
const { buildEmailHTML }            = require("./src/template");
const { sendDailyBrief }            = require("./src/mailer");

async function runDailyBrief() {
  console.log("🚀 Daily Intelligence Brief pipeline starting...\n");
  const t0 = Date.now();

  // 1. Fetch — date filters applied inside each API call
  const { newsByCategory, totalFetched } = await fetchAllNews();

  // 2. History dedup — remove articles seen in last 4 days (Supabase)
  const freshNews = await filterByHistory(newsByCategory);
  const totalAfterFilter = Object.values(freshNews).reduce((s, { articles }) => s + articles.length, 0);

  // 3. Score + cross-category dedup + hide below 3.5
  const { scoredByCategory, scoreStats } = await scoreAllArticles(freshNews);

  // 4. Cluster same-story articles
  const clusteredNews = await clusterAllNews(scoredByCategory);

  const totalShared = Object.values(clusteredNews).reduce((s, { clusters }) => s + (clusters?.length || 0), 0);

  const pipelineStats = {
    totalFetched,
    totalAfterFilter,
    totalEvaluated: scoreStats.evaluated,
    totalHidden:    scoreStats.hidden,
    totalShared,
  };

  console.log(`\n📊 Pipeline stats:
     Fetched:   ${totalFetched} (via Guardian + NewsData + Reddit, date-filtered at API)
     History:   ${totalAfterFilter} remaining after 4-day dedup
     Evaluated: ${scoreStats.evaluated}
     Hidden:    ${scoreStats.hidden} (score < 3.5)
     Shared:    ${totalShared} story clusters`);

  // 5. Build + send
  console.log("\n🎨 Building email...");
  const html   = buildEmailHTML(clusteredNews, pipelineStats);
  const result = await sendDailyBrief(html);

  // 6. Record to Supabase
  await recordSentArticles(clusteredNews);

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
