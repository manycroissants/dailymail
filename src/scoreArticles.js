// src/scoreArticles.js — Scores articles but passes ALL through (no filtering)
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function scoreBatch(articles, categoryLabel) {
  const articleList = articles.map((a, i) => ({
    index: i,
    title: a.title,
    description: (a.description || "").slice(0, 300),
  }));

  const prompt = `You are a Senior Editor. Rate each news item below from 1-10 across three criteria:
1. IMPACT: Does this affect millions of people, national policy, or global markets?
2. NOVELTY: Is this a genuinely new development?
3. RELEVANCE: Does it align with: Technology, AI, Southeast Asia, Singapore, US-China Relations, Macroeconomics?

Category context: ${categoryLabel}

Articles:
${JSON.stringify(articleList, null, 2)}

Return ONLY a valid JSON array — no markdown, no explanation:
[
  { "index": 0, "impact": 8, "novelty": 7, "relevance": 9, "average": 8.0, "reason": "one sentence why" }
]`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const scores = JSON.parse(raw);

    // Attach scores to articles — pass ALL through regardless of score
    return articles.map((a, i) => {
      const s = scores.find((x) => x.index === i) || {};
      return {
        ...a,
        score_impact:    s.impact    || 5,
        score_novelty:   s.novelty   || 5,
        score_relevance: s.relevance || 5,
        score_average:   s.average   || 5.0,
        score_reason:    s.reason    || "",
      };
    });
  } catch (err) {
    console.error(`  ✗ Scoring error [${categoryLabel}]: ${err.message}`);
    // On error, attach neutral scores and still pass all through
    return articles.map((a) => ({
      ...a,
      score_impact: 5, score_novelty: 5, score_relevance: 5,
      score_average: 5.0, score_reason: "Scoring unavailable",
    }));
  }
}

async function scoreAllArticles(newsByCategory) {
  console.log("\n🎯 Scoring articles (all pass through — scores shown inline)...");
  const scored = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    if (!articles || articles.length === 0) {
      console.log(`  → [${label}] 0 articles, skipping`);
      scored[label] = { emoji, articles: [] };
      continue;
    }
    console.log(`  → [${label}] scoring ${articles.length} articles...`);
    const result = await scoreBatch(articles, label);
    scored[label] = { emoji, articles: result };
    await new Promise((r) => setTimeout(r, 6000));
  }

  return scored;
}

module.exports = { scoreAllArticles };
