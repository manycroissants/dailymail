// src/fetchNews.js — NewsData.io fetcher with verified API parameters
// All params validated against official documentation at newsdata.io/blog/latest-news-endpoint
const axios = require("axios");

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = "https://newsdata.io/api/1/latest";

// ── Valid excludecategory values (from newsdata.io docs, 17 total categories):
// business, crime, domestic, education, entertainment, environment, food,
// health, lifestyle, other, politics, science, sports, technology, top, tourism, world
// Free plan: max 5 excludecategory values per query
const EXCLUDE_CATEGORIES = "sports,entertainment,lifestyle,food,tourism";

// ── Post-fetch keyword filter (titles/descriptions containing these are dropped)
const NEGATIVE_KEYWORDS = [
  "cricket", "football", "nba", "nfl", "rugby", "tennis", "golf",
  "celebrity", "gossip", "hollywood", "bollywood",
  "horoscope", "astrology", "zodiac",
  "travel deals", "sponsored", "advertorial",
  "gadget review", "unboxing", "movie review",
  "box office", "album review", "red carpet",
];

const INTERESTS = [
  {
    label: "Technology & Consumer Technology",
    emoji: "💻",
    query: "technology semiconductor software cybersecurity",
    category: "technology",       // pin to technology category
  },
  {
    label: "Artificial Intelligence",
    emoji: "🤖",
    query: "artificial intelligence machine learning LLM",
    category: "technology",
  },
  {
    label: "South-East Asia & Singapore",
    emoji: "🌏",
    query: "Singapore Southeast Asia ASEAN",
    country: "sg,my,id,th,vn",   // SG + nearby SEA countries
    category: null,
  },
  {
    label: "US-China Relations",
    emoji: "🌐",
    query: "US China trade tariff Taiwan geopolitics sanctions",
    category: null,
  },
  {
    label: "Macroeconomics",
    emoji: "📈",
    query: "Federal Reserve inflation GDP recession central bank economy",
    category: "business",
  },
];

function containsNegativeKeyword(text) {
  const lower = (text || "").toLowerCase();
  return NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

async function fetchArticlesForCategory(cat) {
  // Build params using only documented, verified fields
  const params = {
    apikey:          NEWSDATA_API_KEY,
    q:               cat.query,
    language:        "en",
    size:            10,               // free tier max
    prioritydomain:  "top",            // top 10% of domains by authority
    timeframe:       48,               // last 48h (free tier; paid plans support shorter windows)
    removeduplicate: 1,                // deduplicate at source level
    excludecategory: EXCLUDE_CATEGORIES, // drop sports/entertainment/lifestyle/food/tourism
  };

  // Optional per-category overrides
  if (cat.country)  params.country  = cat.country;
  if (cat.category) params.category = cat.category;

  // NOTE: `datatype` does NOT exist on /latest — removed.
  // NOTE: free tier timeframe minimum is 1h, maximum is 48h.

  try {
    const res = await axios.get(BASE_URL, { params, timeout: 15000 });

    if (res.data.status !== "success") {
      console.error(`  ✗ API error [${cat.label}]:`, res.data);
      return [];
    }

    const raw = res.data.results || [];

    // Post-fetch keyword hard filter
    const filtered = raw.filter((a) => {
      const text = `${a.title || ""} ${a.description || ""}`;
      return !containsNegativeKeyword(text);
    });

    return filtered.slice(0, 10).map((a) => ({
      title:       a.title        || "No title",
      description: a.description  || "",
      content:     a.content || a.description || a.title || "",
      url:         a.link         || "#",
      source:      a.source_id    || "Unknown",
      pubDate:     a.pubDate      || "",
      category:    cat.label,
      emoji:       cat.emoji,
    }));

  } catch (err) {
    // Log the full Axios error so we can see exactly what the API rejected
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`  ✗ [${cat.label}]: ${detail}`);
    return [];
  }
}

async function fetchAllNews() {
  console.log("📡 Fetching news (last 48h, prioritydomain=top, excludecategory=sports/entertainment/lifestyle/food/tourism)...");
  const results = {};

  for (const cat of INTERESTS) {
    process.stdout.write(`  → ${cat.label}... `);
    const articles = await fetchArticlesForCategory(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    console.log(`${articles.length} articles`);
    // NewsData.io free tier: 30 req/15min → ~3s between calls is safe
    await new Promise((r) => setTimeout(r, 3000));
  }

  return results;
}

module.exports = { fetchAllNews };
