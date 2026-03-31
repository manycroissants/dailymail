// src/fetchNews.js
// Guardian API  — PRIMARY for Tech, AI, US-China, Macro (full body text)
// NewsData.io   — for ALL categories (date filter applied at API level via `from_date`)
// Reddit JSON   — supplementary signal (public .json, no auth)
//
// Date filtering happens HERE at the API level — no post-fetch date filter needed.
const axios = require("axios");

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY;

const GUARDIAN_BASE = "https://content.guardianapis.com/search";
const NEWSDATA_BASE  = "https://newsdata.io/api/1/latest";

// ── Guardian: fetch articles from the last 24 hours ──────────────────────────
// `from-date` param accepts ISO date — Guardian returns newest first by default.
function guardianFromDate() {
  // 24 hours ago, formatted as YYYY-MM-DD
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

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

// ── NewsData: now covers ALL 5 categories, not just SEA ──────────────────────
// `from_date` filters at API level — returns only articles from last 24 hours.
// Each category gets its own domain allowlist for quality control.
function newsdataFromDate() {
  // NewsData from_date format: YYYY-MM-DD
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

const NEWSDATA_CATEGORIES = [
  {
    label: "Technology & Consumer Technology",
    emoji: "💻",
    query: "technology semiconductor cybersecurity software",
    domainurl: "techcrunch.com,theverge.com,wired.com,arstechnica.com,technologyreview.com",
  },
  {
    label: "Artificial Intelligence",
    emoji: "🤖",
    query: "artificial intelligence machine learning OpenAI",
    domainurl: "techcrunch.com,wired.com,technologyreview.com,theverge.com,reuters.com",
  },
  {
    label: "South-East Asia & Singapore",
    emoji: "🌏",
    query: "Singapore Southeast Asia ASEAN",
    domainurl: "channelnewsasia.com,straitstimes.com,reuters.com,bbc.com,theguardian.com",
  },
  {
    label: "US-China Relations",
    emoji: "🌐",
    query: "US China trade tariff Taiwan geopolitics",
    domainurl: "reuters.com,bbc.com,ft.com,bloomberg.com,theguardian.com",
  },
  {
    label: "Macroeconomics",
    emoji: "📈",
    query: "Federal Reserve interest rates inflation GDP recession",
    domainurl: "reuters.com,ft.com,bloomberg.com,bbc.com,theguardian.com",
  },
];

// ── Reddit subreddits ─────────────────────────────────────────────────────────
// Reddit "hot" reflects recent popularity — no date param available.
// We keep posts from the last 48h by checking created_utc ourselves.
const REDDIT_SOURCES = [
  { subreddit: "worldnews",  label: "US-China Relations",              emoji: "🌐", limit: 25 },
  { subreddit: "technology", label: "Technology & Consumer Technology", emoji: "💻", limit: 25 },
  { subreddit: "singapore",  label: "South-East Asia & Singapore",      emoji: "🌏", limit: 25 },
];
const REDDIT_MAX_AGE_MS = 48 * 60 * 60 * 1000; // keep posts up to 48h old

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function fetchFromGuardian(cat) {
  const params = {
    "api-key":     GUARDIAN_API_KEY,
    q:             cat.q,
    section:       cat.section,
    "order-by":    "newest",
    "page-size":   10,
    "from-date":   guardianFromDate(),   // API-side date filter: last 24h
    "show-fields": "bodyText,trailText,headline,shortUrl,wordcount",
  };
  if (cat.tag) params.tag = cat.tag;

  try {
    const res = await axios.get(GUARDIAN_BASE, { params, timeout: 20000 });
    const status = res.data?.response?.status;
    const total  = res.data?.response?.total || 0;
    console.log(`     Guardian [${cat.label}]: ${status} | ${total} total | from: ${params["from-date"]}`);
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
    console.error(`     Guardian FETCH ERROR [${cat.label}]: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
    return [];
  }
}

async function fetchFromNewsData(cat) {
  const params = {
    apikey:          NEWSDATA_API_KEY,
    q:               cat.query,
    language:        "en",
    size:            10,
    removeduplicate: 1,
    domainurl:       cat.domainurl,
    from_date:       newsdataFromDate(), // API-side date filter: last 24h
  };

  try {
    const res = await axios.get(NEWSDATA_BASE, { params, timeout: 20000 });
    const status = res.data.status;
    const total  = res.data.totalResults || 0;
    console.log(`     NewsData [${cat.label}]: ${status} | ${total} results | from: ${params.from_date}`);
    if (status !== "success") {
      console.error("     NewsData error:", JSON.stringify(res.data));
      return [];
    }

    return (res.data.results || []).map((a) => ({
      title:       a.title       || "No title",
      description: a.description || "",
      content:     a.content     || a.description || a.title || "",
      url:         a.link        || "#",
      source:      a.source_id   || "Unknown",
      pubDate:     a.pubDate     || "",
      wordcount:   0,
      category:    cat.label,
      emoji:       cat.emoji,
    }));
  } catch (err) {
    console.error(`     NewsData FETCH ERROR [${cat.label}]: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
    return [];
  }
}

async function fetchFromReddit(src) {
  const url = `https://www.reddit.com/r/${src.subreddit}/hot.json?limit=${src.limit}`;
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: { "User-Agent": "DailyBriefEmailer/1.0 (personal news digest; non-commercial)" },
    });

    const posts = res.data?.data?.children || [];
    const cutoff = Date.now() - REDDIT_MAX_AGE_MS;
    console.log(`     Reddit r/${src.subreddit}: ${posts.length} raw posts`);

    const kept = posts
      .map((p) => p.data)
      .filter((p) => {
        if (p.stickied || p.over_18) return false;
        // Age filter — keep posts from last 48h
        if (p.created_utc * 1000 < cutoff) return false;
        // Need a meaningful external URL or substantial self-text
        if (p.is_self && (!p.selftext || p.selftext.length < 100)) return false;
        if (p.score < 50) return false;
        return true;
      })
      .map((p) => ({
        title:        p.title || "No title",
        description:  (p.selftext || "").slice(0, 300),
        content:      (p.selftext || p.title || "").slice(0, 1000),
        url:          p.is_self
                        ? `https://reddit.com${p.permalink}`  // self-post: link to discussion
                        : (p.url || `https://reddit.com${p.permalink}`),
        source:       `reddit/r/${src.subreddit}`,
        pubDate:      new Date(p.created_utc * 1000).toISOString(),
        wordcount:    0,
        reddit_score: p.score,
        reddit_ratio: p.upvote_ratio,
        category:     src.label,
        emoji:        src.emoji,
      }));

    console.log(`     Reddit r/${src.subreddit}: ${kept.length} kept (48h, score>50)`);
    return kept;
  } catch (err) {
    console.error(`     Reddit r/${src.subreddit} FETCH ERROR: ${err.message}`);
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchAllNews() {
  console.log("📡 Fetching news (date filters applied at API level)...");
  const results    = {};
  const fetchStats = {};

  // 1. Guardian (from_date in request)
  console.log("\n  [Guardian — last 24h]");
  for (const cat of GUARDIAN_CATEGORIES) {
    const articles = await fetchFromGuardian(cat);
    results[cat.label] = { emoji: cat.emoji, articles };
    fetchStats[cat.label] = articles.length;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 2. NewsData — all 5 categories (from_date in request)
  console.log("\n  [NewsData — last 24h]");
  for (const cat of NEWSDATA_CATEGORIES) {
    const articles = await fetchFromNewsData(cat);
    if (!results[cat.label]) results[cat.label] = { emoji: cat.emoji, articles: [] };
    results[cat.label].articles.push(...articles);
    fetchStats[cat.label] = (fetchStats[cat.label] || 0) + articles.length;
    await new Promise((r) => setTimeout(r, 1200));
  }

  // 3. Reddit (post age checked client-side, no API date param available)
  console.log("\n  [Reddit — last 48h hot posts]");
  for (const src of REDDIT_SOURCES) {
    const articles = await fetchFromReddit(src);
    if (!results[src.label]) results[src.label] = { emoji: src.emoji, articles: [] };
    results[src.label].articles.push(...articles);
    fetchStats[src.label] = (fetchStats[src.label] || 0) + articles.length;
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Summary
  console.log("\n  📊 Fetch summary:");
  for (const [label, count] of Object.entries(fetchStats)) {
    console.log(`     ${label}: ${count} articles`);
  }
  const totalFetched = Object.values(fetchStats).reduce((s, n) => s + n, 0);
  console.log(`     TOTAL: ${totalFetched}`);

  return { newsByCategory: results, fetchStats, totalFetched };
}

module.exports = { fetchAllNews };
