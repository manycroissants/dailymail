// src/scoreArticles.js — Senior Editor scoring layer (The Gatekeeper)
// Passes batches of article titles+descriptions to Gemini and discards score <= 7

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const SCORE_THRESHOLD = 7;

// Score a batch of articles for a single category in one Gemini call
async function scoreBatch(articles, categoryLabel) {
  const articleList = articles.map((a, i) => ({
    index: i,
    title: a.title,
    description: (a.description || "").slice(0, 300),
    source: a.source,
  }));

  const prompt = `You are a Senior Editor at a world-class publication. Rate each news item below.

Scoring criteria (each out of 10, return the average):
1. IMPACT: Does this affect millions of people, national policy, or global markets?
2. NOVELTY: Is this a genuinely new development, or just a repetitive update / recycled story?
3. RELEVANCE: Does it align with these core interest areas: Technology, AI, Southeast Asia, Singapore, US-China Relations, Macroeconomics?

Category context for this batch: ${categoryLabel}

Hard rules:
- Score any opinion piece, listicle, PR fluff, product review, or sponsored content: 1-3
- Score breaking news with major consequences: 8-10
- Score routine updates with limited new information: 4-6

Articles to score:
${JSON.stringify(articleList, null, 2)}

Return ONLY a valid JSON array — no markdown, no explanation:
[
  { "index": 0, "impact": 8, "novelty": 7, "relevance": 9, "average": 8.0, "reason": "one sentence why" },
  ...
]
Each item must have: index, impact (1-10), novelty (1-10), relevance (1-10), average (calculated mean), reason.`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const scores = JSON.parse(cleaned);

    // Map scores back to articles, attach scores, filter by threshold
    const winners = [];
    for (const score of scores) {
      if (score.average > SCORE_THRESHOLD && score.index < articles.length) {
        winners.push({
          ...articles[score.index],
          score_impact: score.impact,
          score_novelty: score.novelty,
          score_relevance: score.relevance,
          score_average: score.average,
          score_reason: score.reason,
        });
      }
    }
    return winners;
  } catch (err) {
    console.error(`  ✗ Scoring error for [${categoryLabel}]: ${err.message}`);
    // On error, return all articles with a neutral score so pipeline doesn't break
    return articles.map((a) => ({
      ...a,
      score_impact: 6,
      score_novelty: 6,
      score_relevance: 6,
      score_average: 6.0,
      score_reason: "Scoring unavailable",
    }));
  }
}

// Score all categories — one batch call per category
async function scoreAllArticles(newsByCategory) {
  console.log("\n🎯 Senior Editor scoring layer...");
  const scored = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    if (!articles || articles.length === 0) {
      scored[label] = { emoji, articles: [] };
      continue;
    }
    process.stdout.write(`  → [${label}] scoring ${articles.length} articles... `);
    const winners = await scoreBatch(articles, label);
    console.log(`${winners.length} passed (score > ${SCORE_THRESHOLD})`);
    scored[label] = { emoji, articles: winners };
    // Rate limit buffer between category calls
    await new Promise((r) => setTimeout(r, 6000));
  }

  return scored;
}

module.exports = { scoreAllArticles };
