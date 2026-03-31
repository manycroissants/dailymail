// src/fetchNews.js
// Guardian API  — PRIMARY for Tech, AI, US-China, Macro (full body text)
// NewsData.io   — SECONDARY for SEA/Singapore
// Reddit JSON   — TERTIARY for all categories (no auth needed, public .json endpoint)
const axios = require("axios");

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY;

const GUARDIAN_BASE = "https://content.guardianapis.com/search";
const NEWSDATA_BASE  = "https://newsdata.io/api/1/latest";

// ── Guardian categories ───────────────────────────────────────────────────────
const GUARDIAN_CATEGORIES = [
  {
    label: "Technology & Consumer Technology",
    emoji: "💻",
    section: "technology",
    q: "technology OR semiconductor OR software OR cybersecurity OR hardware",
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
    section: "business",
    q: "Federal Reserve OR interest rates OR inflation OR GDP OR recession OR central bank OR global economy OR bond market",
    tag: "",
  },
];

// ── NewsData categories (SEA only) ───────────────────────────────────────────
const NEWSDATA_CATEGORIES = [
  {
    label: "South-East Asia & Singapore",
    emoji: "🌏",
    query: "Singapore Southeast Asia",
    domainurl: "channelnewsasia.com,straitstimes.com,reuters.com,bbc.com,theguardian.com",
  },
];

// ── Reddit subreddits → category mapping ─────────────────────────────────────
// Using public .json endpoint — no OAuth, no API key, completely free.
// Reddit allows this for personal/non-commercial use with a descriptive User-Agent.
// We fetch 'hot' posts (top 25) and map them to the relevant category.
// upvote_ratio and score are used as additional quality signals by the scorer.
const REDDIT_SOURCES = [
  { subreddit: "worldnews",  label: "US-China Relations",               emoji: "🌐", limit: 25 },
  { subreddit: "technology", label: "Technology & Consumer Technology",  emoji: "💻", limit: 25 },
  { subreddit: "singapore",  label: "South-East Asia & Singapore",       emoji: "🌏", limit: 25 },
];

// ── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchFromGuardian(cat) {
  const params = {
    "api-key":     GUARDIAN_API_KEY,
    q:             cat.q,
    section:       cat.section,
    "order-by":    "newest",
    "page-size":   10,
    "show-fields": "bodyText,trailText,headline,shortUrl,wordcount",
  };
  if (cat.tag) params.tag = cat.tag;

  try {
    const res = await axios.get(GUARDIAN_BASE, { params, timeout: 20000 });
    const status = res.data?.response?.status;
    console.log(`     Guardian: ${status} | total: ${res.data?.response?.total || 0}`);
    if (status !== "ok") { console.error("     Guardian error:", JSON.stringify(res.data)); return []; }

    return (res.data?.response?.results || []).map((a) => {
      const f = a.fields || {};
      return {
        title:       f.headline  || a.webTitle || "No title",
        description: f.trailText || "",
        content:     (f.bodyText || f.trailText || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        url:         f.shortUrl  || a.webUrl || "#",
        source:      "theguardian",
        pubDate:     a.webPublicationDate || "",
        wordcount:   parseInt(f.wordcount) || 0,
        category:    cat.label,
        emoji:       cat.emoji,
      };
    });
  } catch (err) {
    console.error(`     Guardian FETCH ERROR: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
    return [];
  }
}

async function fetchFromNewsData(cat) {
  const params = {
    apikey: NEWSDATA_API_KEY, q: cat.query, language: "en",
    size: 10, removeduplicate: 1, domainurl: cat.domainurl,
  };
  try {
    const res = await axios.get(NEWSDATA_BASE, { params, timeout: 20000 });
    console.log(`     NewsData: ${res.data.status} | total: ${res.data.totalResults}`);
    if (res.data.status !== "success") { console.error("     NewsData error:", JSON.stringify(res.data)); return []; }

    return (res.data.results || []).map((a) => ({
      title: a.title || "No title", description: a.description || "",
      content: a.content || a.description || a.title || "",
      url: a.link || "#", source: a.source_id || "Unknown",
      pubDate: a.pubDate || "", wordcount: 0,
      category: cat.label, emoji: cat.emoji,
    }));
  } catch (err) {
    console.error(`     NewsData FETCH ERROR: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
    return [];
  }
}

async function fetchFromReddit(src) {
  // Public .json endpoint — no auth needed for read-only public subreddit data
  const url = `https://www.reddit.com/r/${src.subreddit}/hot.json?limit=${src.limit}`;
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        // Reddit requires a descriptive User-Agent for public JSON access
        "User-Agent": "DailyBriefEmailer/1.0 (personal news digest; non-commercial)",
      },
    });

    const posts = res.data?.data?.children || [];
    console.log(`     Reddit r/${src.subreddit}: ${posts.length} posts`);

    return posts
      .map((p) => p.data)
      // Filter: skip self-posts with no external URL, pinned mod posts, NSFW
      .filter((p) => !p.is_self && !p.stickied && !p.over_18 && p.url && p.score > 50)
      .map((p) => ({
        title:        p.title || "No title",
        description:  p.selftext?.slice(0, 300) || "",
        content:      p.selftext?.slice(0, 1000) || p.title || "",
        url:          p.url || `https://reddit.com${p.permalink}`,
        source:       `reddit/r/${src.subreddit}`,
        pubDate:      new Date(p.created_utc * 1000).toISOString(),
        wordcount:    0,
        reddit_score: p.score,          // upvotes — used as quality signal in scorer
        reddit_ratio: p.upvote_ratio,   // 0–1 — filters out controversial/downvoted posts
        category:     src.label,
        emoji:        src.emoji,
      }));
  } catch (err) {
    console.error(`     Reddit r/${src.subreddit} FETCH ERROR: ${err.message}`);
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Returns { newsByCategory, stats }
// stats = { fetched: { [category]: count }, total: N }
async function fetchAllNews() {
  console.log("📡 Fetching (Guardian + NewsData + Reddit)...");
  const results = {};
  const fetchStats = {};

  // 1. Guardian
  for (const cat of GUARDIAN_CATEGORIES) {
    console.log(`  → [Guardian] ${cat.label}`);
    const articles = await fetchFromGuardian(cat);
    results[cat.label] = { emoji: cat.emoji, articles: articles };
    fetchStats[cat.label] = (fetchStats[cat.label] || 0) + articles.length;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 2. NewsData (SEA)
  for (const cat of NEWSDATA_CATEGORIES) {
    console.log(`  → [NewsData] ${cat.label}`);
    const articles = await fetchFromNewsData(cat);
    if (!results[cat.label]) results[cat.label] = { emoji: cat.emoji, articles: [] };
    results[cat.label].articles.push(...articles);
    fetchStats[cat.label] = (fetchStats[cat.label] || 0) + articles.length;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 3. Reddit (merges into existing categories)
  for (const src of REDDIT_SOURCES) {
    console.log(`  → [Reddit] r/${src.subreddit} → ${src.label}`);
    const articles = await fetchFromReddit(src);
    if (!results[src.label]) results[src.label] = { emoji: src.emoji, articles: [] };
    results[src.label].articles.push(...articles);
    fetchStats[src.label] = (fetchStats[src.label] || 0) + articles.length;
    await new Promise((r) => setTimeout(r, 1500)); // be polite to Reddit
  }

  const totalFetched = Object.values(fetchStats).reduce((s, n) => s + n, 0);
  console.log(`\n  Total fetched: ${totalFetched} articles across ${Object.keys(results).length} categories`);

  return { newsByCategory: results, fetchStats, totalFetched };
}

module.exports = { fetchAllNews };
