// src/scoreArticles.js — Rule-based deterministic scorer (no LLM)
// Scoring is purely keyword/regex based — fast, consistent, no API calls needed.

// ── Rule 1: Geopolitical Weight ──────────────────────────────────────────────
const GEO_TIER1 = ["usa", "united states", "china", "beijing", "washington"];
const GEO_TIER2 = ["singapore", " sg "];
const GEO_TIER3 = ["vietnam", "indonesia", "malaysia", "thailand", "philippines"];
// All other country names that would trigger Tier 4 penalty
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
  "zelensky", "modi", "macron", "scholz", "sunak", "starmer",
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

// ── Rule 4: Innovation Significance ─────────────────────────────────────────
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

// ── Rule 5: Macro vs Micro ───────────────────────────────────────────────────
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

// ── Scoring engine ───────────────────────────────────────────────────────────
function scoreArticle(article) {
  // Combine title + description for matching; lowercase for case-insensitive
  const raw  = `${article.title || ""} ${article.description || ""} ${article.content?.slice(0, 500) || ""}`;
  const text = raw.toLowerCase();

  let score = 50; // baseline
  const reasons = [];

  // ── Rule 1: Geopolitical Weight ──────────────────────────────────────────
  let geoHit = false;
  if (GEO_TIER1.some((kw) => text.includes(kw))) {
    score += 15; reasons.push("Tier1-geo(+15)"); geoHit = true;
  }
  if (GEO_TIER2.some((kw) => text.includes(kw))) {
    score += 12; reasons.push("Tier2-geo(+12)"); geoHit = true;
  }
  if (GEO_TIER3.some((kw) => text.includes(kw))) {
    score += 8; reasons.push("Tier3-geo(+8)"); geoHit = true;
  }
  if (!geoHit && GEO_TIER4.some((kw) => text.includes(kw))) {
    score -= 10; reasons.push("Tier4-geo(-10)");
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
  // No recognizable org or leader mentioned
  const hasOrg = /\b(apple|google|microsoft|nvidia|meta|amazon|openai|anthropic|deepmind|tesla|samsung|tsmc|fed|imf|world bank|un |nato|asean|eu |sec |fbi|cia|pentagon|white house|congress|senate)\b/.test(text);
  if (!hasOrg && !WORLD_LEADERS.some((n) => text.includes(n.toLowerCase())) && !TECH_TITANS.some((n) => text.includes(n.toLowerCase()))) {
    score -= 5; reasons.push("no-entity(-5)");
  }

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
    // Cap at +15 regardless of how many significance words match
    score += 15; reasons.push(`significance(+15)[${sigMatches.slice(0,3).join(",")}]`);
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

  // ── Normalise to 0–10 scale ───────────────────────────────────────────────
  // Raw score range is roughly 0–120; clamp then map to 1–10
  const clamped   = Math.max(0, Math.min(120, score));
  const normalised = parseFloat(((clamped / 120) * 9 + 1).toFixed(1)); // maps 0→1.0, 120→10.0

  return {
    ...article,
    score_raw:      score,
    score_average:  normalised,
    score_impact:   normalised, // kept for template compatibility
    score_novelty:  normalised,
    score_relevance: normalised,
    score_reason:   reasons.join(" | ") || "baseline",
  };
}

async function scoreAllArticles(newsByCategory) {
  console.log("\n🎯 Scoring articles (deterministic rule-based engine)...");
  const scored = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    if (!articles || articles.length === 0) {
      scored[label] = { emoji, articles: [] };
      continue;
    }

    console.log(`  → [${label}]`);
    const results = articles.map((a) => scoreArticle(a));

    // Sort best-first
    results.sort((a, b) => b.score_average - a.score_average);

    results.forEach((a) => {
      console.log(`     ${a.score_average}/10 (raw:${a.score_raw}) — "${a.title.slice(0, 55)}" [${a.score_reason}]`);
    });

    scored[label] = { emoji, articles: results };
  }

  return scored;
}

module.exports = { scoreAllArticles };
