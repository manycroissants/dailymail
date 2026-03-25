// src/fetchNews.js
// Guardian API is PRIMARY for Tech, AI, US-China, Macro (full article body available)
// NewsData.io is SECONDARY for SEA/Singapore only (Guardian SEA coverage is thin)
const axios = require("axios");

const NEWSDATA_API_KEY  = process.env.NEWSDATA_API_KEY;
const GUARDIAN_API_KEY  = process.env.GUARDIAN_API_KEY;

const GUARDIAN_BASE = "https://content.guardianapis.com/search";
const NEWSDATA_BASE  = "https://newsdata.io/api/1/latest";

// ── Guardian section + query config ─────────────────────────────────────────
// Sections: technology | business | world | science | environment
// show-fields=bodyText gives full article text — huge benefit for scoring quality
// order-by=newest ensures freshest articles
// page-size=10 = max per call on free tier

const GUARDIAN_CATEGORIES = [
  {
    label: "Technology & Consumer Technology",
    emoji: "💻",
    section: "technology",
    q: "technology OR semiconductor OR software OR cybersecurity OR hardware",
    // Exclude lifestyle/gadget fluff within the tech section
    tag: "-technology/games",
  },
  {
    label: "Artificial Intelligence",
    emoji: "🤖",
    section: "technology",
    q: "artificial intelligence OR machine learning OR large language model OR AI OR OpenAI OR Google DeepMind OR Anthropic",
    tag: "",
  },
  {
    label: "US-China Relations",
    emoji: "🌐",
    section: "world",
    q: "China US relations OR China trade OR Taiwan OR US tariff China OR US China sanctions OR US China diplomacy",
    tag: "",
  },
  {
    label: "Macroeconomics",
    emoji: "📈",
    // business section for markets/central bank; world for broader economic policy
    section: "business",
    q: "Federal Reserve OR interest rates OR inflation OR GDP OR recession OR central bank OR global economy OR bond market",
    tag: "",
  },
];

// SEA/Singapore stays on NewsData — Guardian coverage of the region is thin
const NEWSDATA_CATEGORIES = [
  {
    label: "South-East Asia & Singapore",
    emoji: "🌏",
    query: "Singapore Southeast Asia",
    domainurl: "channelnewsasia.com,straitstimes.com,reuters.com,bbc.com,theguardian.com",
  },
];

// ── Guardian fetcher ─────────────────────────────────────────────────────────
async function fetchFromGuardian(cat) {
  const params = {
    "api-key":     GUARDIAN_API_KEY,
    q:             cat.q,
    section:       cat.section,
    "order-by":    "newest",
    "page-size":   10,
    // Pull full body text — this is the key advantage over NewsData
    "show-fields": "bodyText,trailText,headline,shortUrl,wordcount",
  };
  if (cat.tag) params.tag = cat.tag;

  try {
    const res = await axios.get(GUARDIAN_BASE, { params, timeout: 20000 });
    const status = res.data?.response?.status;
    const total  = res.data?.response?.total || 0;
    console.log(`     Guardian status: ${status} | total: ${total}`);

    if (status !== "ok") {
      console.error(`     Guardian error:`, JSON.stringify(res.data));
      return [];
    }

    const results = res.data?.response?.results || [];
    return results.map((a) => {
      const fields = a.fields || {};
      return {
        title:       fields.headline  || a.webTitle || "No title",
        description: fields.trailText || "",
        // Full body text available — strip HTML tags for clean text
        content:     (fields.bodyText || fields.trailText || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        url:         fields.shortUrl  || a.webUrl || "#",
        source:      "theguardian",
        pubDate:     a.webPublicationDate || "",
        category:    cat.label,
        emoji:       cat.emoji,
      };
    });
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`     Guardian FETCH ERROR: ${detail}`);
    return [];
  }
}

// ── NewsData fetcher (SEA only) ──────────────────────────────────────────────
async function fetchFromNewsData(cat) {
  const params = {
    apikey:          NEWSDATA_API_KEY,
    q:               cat.query,
    language:        "en",
    size:            10,
    removeduplicate: 1,
    domainurl:       cat.domainurl,
  };

  try {
    const res = await axios.get(NEWSDATA_BASE, { params, timeout: 20000 });
    console.log(`     NewsData status: ${res.data.status} | totalResults: ${res.data.totalResults}`);

    if (res.data.status !== "success") {
      console.error(`     NewsData error:`, JSON.stringify(res.data));
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
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`     NewsData FETCH ERROR: ${detail}`);
    return [];
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function fetchAllNews() {
  console.log("📡 Fetching news (Guardian PRIMARY for Tech/AI/US-China/Macro | NewsData for SEA)...");
  const results = {};

  // Guardian categories
  for (const cat of GUARDIAN_CATEGORIES) {
    console.log(`  → [Guardian] ${cat.label}`);
    const articles = await fetchFromGuardian(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    console.log(`     → ${articles.length} articles`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // NewsData categories (SEA)
  for (const cat of NEWSDATA_CATEGORIES) {
    console.log(`  → [NewsData] ${cat.label}`);
    const articles = await fetchFromNewsData(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    console.log(`     → ${articles.length} articles`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}

module.exports = { fetchAllNews };
