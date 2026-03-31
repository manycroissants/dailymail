// index.js — Pipeline: fetch → history filter → score → cluster → email → record
require("dotenv").config();

const { fetchAllNews }                              = require("./src/fetchNews");
const { filterByPubDate, filterByHistory,
        recordSentArticles }                        = require("./src/history");
const { scoreAllArticles }                          = require("./src/scoreArticles");
const { clusterAllNews }                            = require("./src/clusterNews");
const { buildEmailHTML }                            = require("./src/template");
const { sendDailyBrief }                            = require("./src/mailer");

async function runDailyBrief() {
  console.log("🚀 Daily Intelligence Brief pipeline starting...\n");
  const t0 = Date.now();

  // 1. Fetch (Guardian + NewsData + Reddit)
  const { newsByCategory, fetchStats, totalFetched } = await fetchAllNews();

  // 2a. Layer 1 dedup: drop stale articles by pubDate (>20h old)
  const freshByDate = filterByPubDate(newsByCategory);

  // 2b. Layer 2 dedup: drop articles seen in last 4 days (Supabase)
  const freshNews = await filterByHistory(freshByDate);

  // Count articles entering scoring
  const totalAfterFilter = Object.values(freshNews).reduce((s, { articles }) => s + articles.length, 0);

  // 3. Score (rule-based) + cross-category dedup + hide < 3.5
  const { scoredByCategory, scoreStats } = await scoreAllArticles(freshNews);

  // 4. Cluster same-story articles using Jaccard title similarity
  const clusteredNews = await clusterAllNews(scoredByCategory);

  // Count final articles in digest
  const totalShared = Object.values(clusteredNews).reduce((s, { clusters }) => s + (clusters?.length || 0), 0);

  // Pipeline summary stats for email header
  const pipelineStats = {
    totalFetched,         // raw articles ingested from all APIs
    totalAfterFilter,     // after pubDate + Supabase history filter
    totalEvaluated: scoreStats.evaluated,  // articles scored
    totalHidden:    scoreStats.hidden,     // dropped for score < 3.5 or dedup
    totalShared,          // story clusters in the final email
  };

  console.log(`\n📊 Pipeline stats:
     Fetched:    ${pipelineStats.totalFetched}
     Filtered:   ${pipelineStats.totalAfterFilter} (after history/date filter)
     Evaluated:  ${pipelineStats.totalEvaluated} (after cross-category dedup)
     Hidden:     ${pipelineStats.totalHidden} (score < 3.5)
     Shared:     ${pipelineStats.totalShared} story clusters`);

  // 5. Build HTML
  console.log("\n🎨 Building email...");
  const html = buildEmailHTML(clusteredNews, pipelineStats);

  // 6. Send
  const result = await sendDailyBrief(html);

  // 7. Record to Supabase history
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
