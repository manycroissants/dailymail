// src/fetchNews.js — DIAGNOSTIC MODE: minimal filters, maximum articles
const axios = require("axios");

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = "https://newsdata.io/api/1/latest";

const INTERESTS = [
  { label: "Technology & Consumer Technology", emoji: "💻", query: "technology" },
  { label: "Artificial Intelligence",          emoji: "🤖", query: "artificial intelligence" },
  { label: "South-East Asia & Singapore",      emoji: "🌏", query: "Singapore" },
  { label: "US-China Relations",               emoji: "🌐", query: "US China" },
  { label: "Macroeconomics",                   emoji: "📈", query: "economy inflation" },
];

async function fetchArticlesForCategory(cat) {
  const params = {
    apikey:         NEWSDATA_API_KEY,
    q:              cat.query,
    language:       "en",
    size:           10,
    prioritydomain: "top",
    removeduplicate: 1,
  };

  try {
    const res = await axios.get(BASE_URL, { params, timeout: 20000 });
    console.log(`     API status: ${res.data.status} | totalResults: ${res.data.totalResults}`);

    if (res.data.status !== "success") {
      console.error(`     API error body:`, JSON.stringify(res.data));
      return [];
    }

    const raw = res.data.results || [];
    return raw.map((a) => ({
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
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`     FETCH ERROR: ${detail}`);
    return [];
  }
}

async function fetchAllNews() {
  console.log("📡 Fetching news (diagnostic mode — minimal filters)...");
  const results = {};

  for (const cat of INTERESTS) {
    console.log(`  → ${cat.label} [query="${cat.query}"]`);
    const articles = await fetchArticlesForCategory(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    console.log(`     → ${articles.length} articles returned`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}

module.exports = { fetchAllNews };
