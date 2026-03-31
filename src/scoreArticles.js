// src/scoreArticles.js — Rule-based deterministic scorer (no LLM)

// ── Rule 1: Geopolitical Weight ──────────────────────────────────────────────
const GEO_TIER1 = ["usa", "united states", "china", "beijing", "washington"];
const GEO_TIER2 = ["singapore", " sg "];
const GEO_TIER3 = ["vietnam", "indonesia", "malaysia", "thailand", "philippines"];
const GEO_UK    = ["uk", "british", "england", "starmer", "britain", "london"];
const GEO_TIER4 = [
  "belgium", "peru", "argentina", "brazil", "nigeria", "kenya", "egypt",
  "pakistan", "bangladesh", "ukraine", "russia", "france", "germany",
  "italy", "spain", "netherlands", "sweden", "norway", "denmark",
  "australia", "new zealand", "canada", "mexico", "colombia", "chile",
  "saudi arabia", "iran", "iraq", "turkey", "israel", "south africa",
  "portugal", "poland", "czech", "hungary", "romania", "greece",
  "switzerland", "austria", "finland", "ireland", "scotland", "wales",
];

// ── Rule 2: Protagonist Filter ───────────────────────────────────────────────
const WORLD_LEADERS = [
  "biden", "trump", "xi jinping", "xi ", "lawrence wong", "putin",
  "zelensky", "modi", "macron", "scholz", "sunak",
  "netanyahu", "erdogan", "marcos", "prabowo", "anwar ibrahim",
  "fumio kishida", "yoon suk", "janet yellen", "jerome powell",
];
const TECH_TITANS = [
  "sam altman", "elon musk", "jensen huang", "sundar pichai",
  "satya nadella", "mark zuckerberg", "tim cook", "jeff bezos",
  "andy jassy", "lisa su", "pat gelsinger", "dario amodei",
];
const CELEBRITY_MARKERS = [
  "actor", "actress", "singer", "influencer", "athlete", "footballer",
  "celebrity", "kardashian", "taylor swift", "beyoncé", "beyonce",
  "drake", "rihanna", "ariana", "justin bieber", "selena gomez",
];

// ── Rule 3: Hard-Floor Penalties ─────────────────────────────────────────────
const LIFESTYLE_PENALTIES = [
  "red carpet", "box office", "tournament", " match ", "season finale",
  "collection", "runway", "dating", "rumor", "rumour", "breakup",
  "wedding", "divorce", "pregnant", "baby shower", "fashion week",
];
const MARKET_NOISE = [
  "stock to watch", "price target", "should you buy", "best deals",
  "buy the dip", "hot stock", "top picks", "analyst upgrades",
];

// ── Rule 4: Innovation Significance ──────────────────────────────────────────
const SIGNIFICANCE_WORDS = [
  "groundbreaking", "breakthrough", "unprecedented", "sovereign", "sanctions",
  "escalation", "paradigm", "fundamental", "bilateral", "multilateral",
  "strategic", "legislative", "regulatory", "landmark", "inaugural",
  "disruptive", "quantum", "semiconductor", "foundational", "framework",
  "ratified", "tension", "accord", "treaty", "provision",
  "infrastructure", "nationalized", "standardization", "recession", "inflationary",
  "surge", "collapse", "acquisition", "merger", "monopoly",
  "antitrust", "embargo", "deployment", "integration", "automation",
  "proprietary", "open-source", "benchmark", "clinical", "validation",
  "consensus", "coalition", "aggression", "deficit",
];
const GENERIC_PRODUCT_NOISE = [
  "leak", "rumor", "rumour", "unveils new color", "pre-order", "preorder",
  " review", "hands-on", "first look", "unboxing", "specs revealed",
  "release date", "price revealed",
];

// ── Rule 5: Macro vs Micro ────────────────────────────────────────────────────
const MACRO_KEYWORDS = [
  "interest rate", "interest rates", "tariff", "tariffs", "gdp",
  "sanctions", "trade war", "policy", "regulation", "federal reserve",
  "central bank", "inflation", "recession", "fiscal", "monetary",
  "geopolit", "diplomatic", "treaty", "legislation", "congress", "parliament",
];
const MICRO_KEYWORDS = [
  "new app feature", "office move", "quarterly earnings",
  "rebrands", "launches podcast", "hires cmo", "appoints new",
  "redesigns logo", "opens new store", "new headquarters",
];

// ── Rule 6 (NEW): Major Event Trigger Words — +5 ─────────────────────────────
const MAJOR_EVENT_WORDS = [
  "war", "federal reserve", "gdp", "imf", "recession", "world", "economy",
];

// ── Rule 7 (NEW): Key Organisation Mentions — +3 ─────────────────────────────
const KEY_ORGS = [
  "google", "meta", "microsoft", "nvidia", "openai", "anthropic",
  "tsmc", "alibaba", "amd", "nintendo", "xiaomi", "byd", "netflix",
];

// ── Scoring engine ────────────────────────────────────────────────────────────
function scoreArticle(article) {
  const raw  = `${article.title || ""} ${article.description || ""} ${article.content?.slice(0, 500) || ""}`;
  const text = raw.toLowerCase();

  let score = 50;
  const reasons = [];

  // ── Rule 1: Geopolitical Weight ──────────────────────────────────────────
  let geoHit = false;
  if (GEO_TIER1.some((kw) => text.includes(kw))) {
    score += 15; reasons.push("Tier1-geo(+15)"); geoHit = true;
  }
  if (GEO_TIER2.some((kw) => text.includes(kw))) {
    score += 18; reasons.push("Singapore(+18)"); geoHit = true;
  }
  if (GEO_TIER3.some((kw) => text.includes(kw))) {
    score += 8; reasons.push("Tier3-geo(+8)"); geoHit = true;
  }
  if (GEO_UK.some((kw) => text.includes(kw))) {
    score -= 8; reasons.push("UK(-8)");         // changed: -12 → -8
    geoHit = true;
  }
  if (!geoHit && GEO_TIER4.some((kw) => text.includes(kw))) {
    score -= 5; reasons.push("Tier4-geo(-5)");  // changed: -10 → -5
  }

  // ── Rule 2: Protagonist Filter ───────────────────────────────────────────
  if (WORLD_LEADERS.some((name) => text.includes(name.toLowerCase()))) {
    score += 10; reasons.push("world-leader(+10)");
  } else if (TECH_TITANS.some((name) => text.includes(name.toLowerCase()))) {
    score += 8; reasons.push("tech-titan(+8)");
  }
  if (CELEBRITY_MARKERS.some((kw) => text.includes(kw))) {
    score -= 15; reasons.push("celebrity(-15)");
  }
  // NOTE: "no-entity" rule removed

  // ── Rule 3: Hard-Floor Penalties ─────────────────────────────────────────
  if (LIFESTYLE_PENALTIES.some((kw) => text.includes(kw))) {
    score -= 30; reasons.push("lifestyle(-30)");
  }
  if (MARKET_NOISE.some((kw) => text.includes(kw))) {
    score -= 10; reasons.push("market-noise(-10)");
  }

  // ── Rule 4: Innovation Significance ──────────────────────────────────────
  const sigMatches = SIGNIFICANCE_WORDS.filter((kw) => text.includes(kw));
  if (sigMatches.length > 0) {
    score += 15; reasons.push(`significance(+15)[${sigMatches.slice(0, 3).join(",")}]`);
  }
  if (GENERIC_PRODUCT_NOISE.some((kw) => text.includes(kw))) {
    score -= 10; reasons.push("product-noise(-10)");
  }

  // ── Rule 5: Macro vs Micro ────────────────────────────────────────────────
  if (MACRO_KEYWORDS.some((kw) => text.includes(kw))) {
    score += 12; reasons.push("macro(+12)");
  }
  if (MICRO_KEYWORDS.some((kw) => text.includes(kw))) {
    score -= 10; reasons.push("micro(-10)");
  }

  // ── Rule 6 (NEW): Major Event Trigger Words — +5 ─────────────────────────
  const majorMatch = MAJOR_EVENT_WORDS.find((kw) => text.includes(kw));
  if (majorMatch) {
    score += 5; reasons.push(`major-event(+5)[${majorMatch}]`);
  }

  // ── Rule 7 (NEW): Key Organisation Mentions — +3 ─────────────────────────
  const orgMatch = KEY_ORGS.find((org) => text.includes(org));
  if (orgMatch) {
    score += 3; reasons.push(`key-org(+3)[${orgMatch}]`);
  }

  // ── Signal 2: Guardian wordcount bonus (adjusted) ────────────────────────
  const wc = parseInt(article.wordcount) || 0;
  if (wc >= 2000) {
    score += 2; reasons.push(`wordcount(+2)[${wc}w]`);    // changed: +15 → +2
  } else if (wc >= 1000) {
    score += 1; reasons.push(`wordcount(+1)[${wc}w]`);    // changed: +8 → +1
  } else if (wc > 0 && wc < 300) {
    score -= 1; reasons.push(`wordcount(-1)[${wc}w]`);    // changed: -5 → -1
  }

  // ── Signal 3: Reddit upvote score ────────────────────────────────────────
  const rs = parseInt(article.reddit_score) || 0;
  const rr = parseFloat(article.reddit_ratio) || 0;
  if (rs >= 10000 && rr >= 0.8) {
    score += 20; reasons.push(`reddit-viral(+20)[${rs}↑]`);
  } else if (rs >= 3000 && rr >= 0.75) {
    score += 12; reasons.push(`reddit-hot(+12)[${rs}↑]`);
  } else if (rs >= 500 && rr >= 0.7) {
    score += 6; reasons.push(`reddit-notable(+6)[${rs}↑]`);
  }

  // ── Normalise to 1.0–10.0 ────────────────────────────────────────────────
  const clamped    = Math.max(0, Math.min(120, score));
  const normalised = parseFloat(((clamped / 120) * 9 + 1).toFixed(1));

  return {
    ...article,
    score_raw:       score,
    score_average:   normalised,
    score_impact:    normalised,
    score_novelty:   normalised,
    score_relevance: normalised,
    score_reason:    reasons.join(" | ") || "baseline",
  };
}

// ── Deduplication across categories ──────────────────────────────────────────
function deduplicateAcrossCategories(newsByCategory) {
  console.log("\n🔄 Deduplicating articles across categories...");
  const seenTitles = new Set();
  const deduped = {};
  let removedCount = 0;

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    const unique = [];
    for (const article of articles) {
      const normTitle = article.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
      const titleKey  = normTitle.slice(0, 60);
      if (!seenTitles.has(titleKey)) {
        seenTitles.add(titleKey);
        unique.push(article);
      } else {
        removedCount++;
        console.log(`     Duplicate removed from [${label}]: "${article.title.slice(0, 60)}"`);
      }
    }
    deduped[label] = { emoji, articles: unique };
  }

  console.log(`     → ${removedCount} duplicate(s) removed`);
  return deduped;
}

async function scoreAllArticles(newsByCategory) {
  console.log("\n🎯 Scoring articles (rule-based engine)...");
  const scored = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    if (!articles || articles.length === 0) {
      scored[label] = { emoji, articles: [] };
      continue;
    }

    console.log(`  → [${label}]`);
    const results = articles.map((a) => scoreArticle(a));

    results.sort((a, b) => b.score_average - a.score_average);

    const MIN_SCORE = 3.5;
    const filtered  = results.filter((a) => a.score_average >= MIN_SCORE);
    const dropped   = results.length - filtered.length;

    results.forEach((a) => {
      const flag = a.score_average < MIN_SCORE ? " [HIDDEN]" : "";
      console.log(`     ${a.score_average}/10 (raw:${a.score_raw})${flag} — "${a.title.slice(0, 55)}" [${a.score_reason}]`);
    });

    if (dropped > 0) console.log(`     → ${dropped} hidden (score < ${MIN_SCORE})`);
    scored[label] = { emoji, articles: filtered };
  }

  const deduped = deduplicateAcrossCategories(scored);

  const scoreStats = { evaluated: 0, passed: 0, hidden: 0 };
  for (const { articles } of Object.values(deduped))  scoreStats.passed    += articles.length;
  for (const { articles } of Object.values(scored))   scoreStats.evaluated += articles.length;
  scoreStats.hidden = scoreStats.evaluated - scoreStats.passed;

  return { scoredByCategory: deduped, scoreStats };
}

module.exports = { scoreAllArticles };
