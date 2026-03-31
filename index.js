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

  // 1. Fetch
  const rawNews = await fetchAllNews();

  // 2a. Layer 1 dedup: drop articles older than 20h by pubDate (free, fast)
  const freshByDate = filterByPubDate(rawNews);

  // 2b. Layer 2 dedup: drop articles seen in last 4 days via Supabase
  const freshNews = await filterByHistory(freshByDate);

  // 3. Score (rule-based) — also deduplicates within-run cross-category, hides <4.0
  const scoredNews = await scoreAllArticles(freshNews);

  // 4. Cluster same-story articles using Jaccard title similarity
  const clusteredNews = await clusterAllNews(scoredNews);

  // 5. Build HTML
  console.log("\n🎨 Building email...");
  const html = buildEmailHTML(clusteredNews);

  // 6. Send
  const result = await sendDailyBrief(html);

  // 7. Record sent articles to Supabase (so they're filtered out for next 4 days)
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
