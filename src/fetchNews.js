// src/fetchNews.js — NewsData.io fetcher with strict hard filters
const axios = require("axios");

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = "https://newsdata.io/api/1/latest";

// Negative keywords — articles containing any of these are discarded
const NEGATIVE_KEYWORDS = [
  "sports", "cricket", "football", "nba", "nfl", "rugby", "tennis", "golf",
  "fashion", "runway", "celebrity", "gossip", "hollywood", "bollywood",
  "horoscope", "astrology", "zodiac",
  "wellness", "travel deals", "sponsored", "advertorial",
  "lifestyle", "gadget review", "deals", "unboxing", "movie review",
  "box office", "album review", "concert", "red carpet",
];

const INTERESTS = [
  {
    label: "Technology & Consumer Technology",
    emoji: "💻",
    query: "technology semiconductor chips software hardware cybersecurity",
  },
  {
    label: "Artificial Intelligence",
    emoji: "🤖",
    query: "artificial intelligence machine learning LLM model training",
  },
  {
    label: "South-East Asia & Singapore",
    emoji: "🌏",
    query: "Singapore Southeast Asia ASEAN Indonesia Malaysia Thailand Vietnam",
  },
  {
    label: "US-China Relations",
    emoji: "🌐",
    query: "US China trade tariff Taiwan geopolitics sanctions diplomacy",
  },
  {
    label: "Macroeconomics",
    emoji: "📈",
    query: "Federal Reserve interest rates inflation GDP recession central bank markets",
  },
];

function containsNegativeKeyword(text) {
  const lower = text.toLowerCase();
  return NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

async function fetchArticlesForCategory(category) {
  const params = {
    apikey: NEWSDATA_API_KEY,
    q: category.query,
    language: "en",
    size: 10,
    prioritydomain: "top",        // top-tier sources only
    datatype: "news,opinion",     // exclude blogs and press releases
    // timeframe param: NewsData uses timeframe in hours as integer
    timeframe: 24,
  };

  try {
    const res = await axios.get(BASE_URL, { params, timeout: 15000 });
    const raw = res.data.results || [];

    // Hard filter: discard anything matching negative keywords in title or description
    const filtered = raw.filter((a) => {
      const text = `${a.title || ""} ${a.description || ""}`;
      return !containsNegativeKeyword(text);
    });

    return filtered.slice(0, 10).map((a) => ({
      title: a.title || "No title",
      description: a.description || "",
      content: a.content || a.description || a.title || "",
      url: a.link || "#",
      source: a.source_id || "Unknown",
      pubDate: a.pubDate || "",
      category: category.label,
      emoji: category.emoji,
    }));
  } catch (err) {
    console.error(`  ✗ [${category.label}]: ${err.message}`);
    return [];
  }
}

async function fetchAllNews() {
  console.log("📡 Fetching news (last 24h, top domains only)...");
  const results = {};
  for (const cat of INTERESTS) {
    process.stdout.write(`  → ${cat.label}... `);
    const articles = await fetchArticlesForCategory(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    console.log(`${articles.length} articles after hard filter`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  return results;
}

module.exports = { fetchAllNews };
