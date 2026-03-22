// src/scoreArticles.js — Scores each article individually (one Gemini call per article)
// This prevents a single JSON parse failure from wiping scores for an entire category.

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function scoreOne(article, categoryLabel) {
  const text = `${article.title}\n\n${(article.description || "").slice(0, 400)}`;

  const prompt = `You are a Senior Editor at The Economist. Score this single news article on three dimensions. Think carefully before scoring — most articles should NOT be a 5.

CATEGORY CONTEXT: ${categoryLabel}

ARTICLE:
Title: ${article.title}
Source: ${article.source}
Description: ${(article.description || "").slice(0, 400)}

---

IMPACT — how many people or how much capital/policy is affected:
  9-10 = market-moving event, major geopolitical flashpoint, central bank decision, national emergency
  7-8  = significant national policy, major corporate action, notable diplomatic development
  5-6  = regional story, moderate policy update, significant but not major corporate news
  3-4  = local or niche story, minor update, limited real-world consequence
  1-2  = press release, product announcement, opinion with no news, lifestyle content

NOVELTY — how new and surprising is the information:
  9-10 = complete surprise, no prior signals, changes the landscape
  7-8  = important new development, meaningfully advances an ongoing story
  5-6  = expected development, confirms what was anticipated
  3-4  = routine update, minor incremental news
  1-2  = recycled story, no new facts, pure commentary or analysis of old news

RELEVANCE — fit to this specific category: ${categoryLabel}
  9-10 = directly and centrally about this category's core topic
  7-8  = closely related, clear and direct connection
  5-6  = tangentially related, connection requires a stretch
  3-4  = weakly related, mostly about something else
  1-2  = essentially unrelated to this category

SCORING EXAMPLES to calibrate you:
- "Fed raises rates by 50bps in surprise move" → Impact:9, Novelty:9, Relevance:9 (for Macro)
- "Apple reports quarterly earnings, beats estimates" → Impact:7, Novelty:6, Relevance:8 (for Tech)
- "Opinion: Why AI will change everything" → Impact:3, Novelty:2, Relevance:7 (for AI)
- "New smartwatch has better battery life" → Impact:3, Novelty:4, Relevance:6 (for Tech)
- "Singapore PM meets Chinese ambassador" → Impact:6, Novelty:5, Relevance:9 (for SEA)

Return ONLY a valid JSON object — no markdown, no explanation, nothing else:
{
  "impact": <integer 1-10>,
  "novelty": <integer 1-10>,
  "relevance": <integer 1-10>,
  "average": <float, mean of the three scores rounded to 2 decimal places>,
  "reason": "<one specific sentence explaining why you gave these scores>"
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

    // Extra safety: extract JSON object even if there's surrounding text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");

    const s = JSON.parse(jsonMatch[0]);

    const impact    = Math.min(10, Math.max(1, parseInt(s.impact)    || 5));
    const novelty   = Math.min(10, Math.max(1, parseInt(s.novelty)   || 5));
    const relevance = Math.min(10, Math.max(1, parseInt(s.relevance) || 5));
    const average   = parseFloat(((impact + novelty + relevance) / 3).toFixed(2));

    return { ...article, score_impact: impact, score_novelty: novelty, score_relevance: relevance, score_average: average, score_reason: s.reason || "" };

  } catch (err) {
    // On failure, log the raw response so we can debug, and give a neutral-low score
    // (not 5/5/5 which looks like "scored successfully")
    console.error(`  ✗ Score parse error for "${article.title}": ${err.message}`);
    return { ...article, score_impact: 4, score_novelty: 4, score_relevance: 4, score_average: 4.0, score_reason: "Scoring failed — defaulting to 4" };
  }
}

async function scoreAllArticles(newsByCategory) {
  console.log("\n🎯 Scoring articles (one call per article for accuracy)...");
  const scored = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    if (!articles || articles.length === 0) {
      console.log(`  → [${label}] 0 articles, skipping`);
      scored[label] = { emoji, articles: [] };
      continue;
    }

    console.log(`  → [${label}] scoring ${articles.length} articles individually...`);
    const results = [];

    for (const article of articles) {
      const scoredArticle = await scoreOne(article, label);
      results.push(scoredArticle);
      process.stdout.write(`     "${article.title.slice(0, 50)}..." → ${scoredArticle.score_average}/10\n`);
      // Gemini free tier: 10 RPM → 6s between calls
      await new Promise((r) => setTimeout(r, 6200));
    }

    // Sort best-first
    results.sort((a, b) => b.score_average - a.score_average);

    const distribution = results.map((a) => a.score_average.toFixed(1));
    console.log(`     Final order: [${distribution.join(", ")}]`);

    scored[label] = { emoji, articles: results };
  }

  return scored;
}

module.exports = { scoreAllArticles };
