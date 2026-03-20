// src/fetchNews.js — Fetches articles from NewsData.io by interest category
const axios = require("axios");

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = "https://newsdata.io/api/1/news";

const INTERESTS = [
  {
    label: "Technology & Consumer Technology",
    emoji: "💻",
    query: "consumer technology gadgets",
    country: null,
  },
  {
    label: "Artificial Intelligence",
    emoji: "🤖",
    query: "artificial intelligence",
    country: null,
  },
  {
    label: "South-East Asia & Singapore",
    emoji: "🌏",
    query: "Singapore Southeast Asia",
    country: "sg",
  },
  {
    label: "US-China Relations",
    emoji: "🌐",
    query: "US China relations trade",
    country: null,
  },
  {
    label: "Macroeconomics",
    emoji: "📈",
    query: "global economy inflation",
    country: null,
  },
];

async function fetchArticlesForCategory(category) {
  const params = {
    apikey: NEWSDATA_API_KEY,
    q: category.query,
    language: "en",
    size: 5,
  };
  if (category.country) params.country = category.country;

  try {
    const res = await axios.get(BASE_URL, { params, timeout: 15000 });
    const raw = res.data.results || [];
    return raw.slice(0, 5).map((a) => ({
      title: a.title || "No title",
      description: a.description || "",
      content: a.content || a.description || a.title || "",
      url: a.link || "#",
      source: a.source_id || "Unknown",
      pubDate: a.pubDate || "",
      image: a.image_url || null,
      category: category.label,
      emoji: category.emoji,
    }));
  } catch (err) {
    console.error(`  ✗ Error fetching [${category.label}]: ${err.message}`);
    return [];
  }
}

async function fetchAllNews() {
  console.log("📡 Fetching news from NewsData.io...");
  const results = {};
  for (const cat of INTERESTS) {
    process.stdout.write(`  → ${cat.label}... `);
    const articles = await fetchArticlesForCategory(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    console.log(`${articles.length} articles`);
    // Respect NewsData.io free tier rate limits (1 req/sec)
    await new Promise((r) => setTimeout(r, 1200));
  }
  return results;
}

module.exports = { fetchAllNews };
