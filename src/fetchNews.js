// src/fetchNews.js
// Strategy: filter by datatype=news,analysis at API level (excludes press releases,
// blogs, sponsored content, reviews). Source blocklist applied client-side as backup
// since excludedomain is capped at 5 and we have more than 5 bad sources.
const axios = require("axios");

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = "https://newsdata.io/api/1/latest";

// Client-side source blocklist — catches anything that slips through
// (excludedomain at API level is capped at 5, so we use this as a safety net)
const BLOCKED_SOURCES = new Set([
  "variety", "onefootball", "benzinga", "si", "yahoo",
  "hindustantimes", "bangkokpost", "thesun", "toi", "timesofindia",
  "dailymail", "nypost", "tmz", "buzzfeed", "globenewswire",
  "prnewswire", "businesswire", "accesswire",
]);

const INTERESTS = [
  { label: "Technology & Consumer Technology", emoji: "💻", query: "technology" },
  { label: "Artificial Intelligence",          emoji: "🤖", query: "artificial intelligence" },
  { label: "South-East Asia & Singapore",      emoji: "🌏", query: "Singapore" },
  { label: "US-China Relations",               emoji: "🌐", query: "US China" },
  { label: "Macroeconomics",                   emoji: "📈", query: "economy inflation" },
];

async function fetchArticlesForCategory(cat) {
  const params = {
    apikey:          NEWSDATA_API_KEY,
    q:               cat.query,
    language:        "en",
    size:            10,
    prioritydomain:  "top",
    removeduplicate: 1,
    // Filter content type at API level — excludes press releases, blogs,
    // sponsored content, reviews, podcasts before they consume our 10-article quota
    datatype:        "news,analysis",
  };

  try {
    const res = await axios.get(BASE_URL, { params, timeout: 20000 });
    console.log(`     API status: ${res.data.status} | totalResults: ${res.data.totalResults}`);

    if (res.data.status !== "success") {
      console.error(`     API error:`, JSON.stringify(res.data));
      return [];
    }

    const raw = res.data.results || [];

    // Client-side backup filter for any remaining bad sources
    const filtered = raw.filter((a) => {
      const src = (a.source_id || "").toLowerCase();
      return !BLOCKED_SOURCES.has(src);
    });

    const blocked = raw.length - filtered.length;
    console.log(`     → ${filtered.length} articles (${blocked} blocked by source filter)`);

    return filtered.map((a) => ({
      title:       a.title       || "No title",
      description: a.description || "",
      content:     a.content     || a.description || a.title || "",
      url:         a.link        || "#",
      source:      a.source_id   || "Unknown",
      pubDate:     a.pubDate     || "",
      category:    cat.label,
      emoji:       cat.emoji,
    }));

  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`     FETCH ERROR: ${detail}`);
    return [];
  }
}

async function fetchAllNews() {
  console.log("📡 Fetching news (datatype=news,analysis — press releases/blogs/sponsored excluded at API level)...");
  const results = {};
  for (const cat of INTERESTS) {
    console.log(`  → ${cat.label} [query="${cat.query}"]`);
    const articles = await fetchArticlesForCategory(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return results;
}

module.exports = { fetchAllNews };
