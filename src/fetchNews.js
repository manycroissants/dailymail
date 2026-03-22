// src/fetchNews.js — Quality-first: per-category domainurl allowlists (max 5 per API call)
const axios = require("axios");

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const BASE_URL = "https://newsdata.io/api/1/latest";

// ── Per-category allowlists (domainurl, max 5 per call) ──────────────────────
//
// GENERAL / MACRO / US-CHINA:
//   reuters.com       — world's largest wire service, gold standard for factual news
//   bbc.com           — global reach, strong editorial standards
//   ft.com            — Financial Times, best for macro/markets (WSJ is heavily paywalled)
//   theguardian.com   — strong international coverage, independent
//   bloomberg.com     — authoritative on markets, finance, geopolitics
//
// SINGAPORE / SEA:
//   channelnewsasia.com — primary English broadcaster in SEA
//   straitstimes.com    — Singapore's newspaper of record
//   reuters.com         — wire service covers SEA extensively
//   bbc.com             — BBC SEA desk
//   theguardian.com     — SEA/Asia Pacific coverage
//
// TECHNOLOGY:
//   techcrunch.com       — startup/VC/product launches
//   theverge.com         — consumer tech, Big Tech policy
//   wired.com            — tech culture, policy, science
//   arstechnica.com      — deep technical reporting
//   technologyreview.com — MIT Tech Review, research-grade AI/tech analysis

const INTERESTS = [
  {
    label: "Technology & Consumer Technology",
    emoji: "💻",
    query: "technology",
    domainurl: "techcrunch.com,theverge.com,wired.com,arstechnica.com,technologyreview.com",
  },
  {
    label: "Artificial Intelligence",
    emoji: "🤖",
    query: "artificial intelligence",
    domainurl: "techcrunch.com,wired.com,technologyreview.com,theverge.com,reuters.com",
  },
  {
    label: "South-East Asia & Singapore",
    emoji: "🌏",
    query: "Singapore Southeast Asia",
    domainurl: "channelnewsasia.com,straitstimes.com,reuters.com,bbc.com,theguardian.com",
  },
  {
    label: "US-China Relations",
    emoji: "🌐",
    query: "US China",
    domainurl: "reuters.com,bbc.com,ft.com,bloomberg.com,theguardian.com",
  },
  {
    label: "Macroeconomics",
    emoji: "📈",
    query: "economy inflation",
    domainurl: "reuters.com,ft.com,bloomberg.com,bbc.com,theguardian.com",
  },
];

async function fetchArticlesForCategory(cat) {
  const params = {
    apikey:          NEWSDATA_API_KEY,
    q:               cat.query,
    language:        "en",
    size:            10,
    removeduplicate: 1,
    domainurl:       cat.domainurl,
    // NOTE: prioritydomain removed — unnecessary when we specify exact domains
    // NOTE: timeframe removed — paid feature only
  };

  try {
    const res = await axios.get(BASE_URL, { params, timeout: 20000 });
    console.log(`     API status: ${res.data.status} | totalResults: ${res.data.totalResults}`);

    if (res.data.status !== "success") {
      console.error(`     API error:`, JSON.stringify(res.data));
      return [];
    }

    const raw = res.data.results || [];
    console.log(`     → ${raw.length} articles from [${cat.domainurl}]`);

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
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`     FETCH ERROR: ${detail}`);
    return [];
  }
}

async function fetchAllNews() {
  console.log("📡 Fetching news (domainurl allowlist — quality sources only)...");
  const results = {};
  for (const cat of INTERESTS) {
    console.log(`  → ${cat.label}`);
    console.log(`     domains: ${cat.domainurl}`);
    const articles = await fetchArticlesForCategory(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return results;
}

module.exports = { fetchAllNews };
