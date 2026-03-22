// src/scoreArticles.js — Scores all articles, passes all through, sorts by score
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function scoreBatch(articles, categoryLabel) {
  const articleList = articles.map((a, i) => ({
    index: i,
    title: a.title,
    description: (a.description || "").slice(0, 300),
    source: a.source,
  }));

  const prompt = `You are a Senior Editor at The Economist. Score each article on three dimensions.

CATEGORY CONTEXT: ${categoryLabel}

SCORING RUBRIC — use the FULL 1-10 range, do NOT cluster around 5:

IMPACT (how many people / how much money / how much policy is affected):
  10 = global crisis, market-moving event, major war/conflict escalation
  8-9 = national policy change, central bank decision, major company collapse, geopolitical flashpoint
  6-7 = regional policy, significant earnings, notable diplomatic development
  4-5 = local news, minor corporate update, incremental policy
  1-3 = press release, opinion piece, lifestyle fluff, product review

NOVELTY (how new and surprising is the information):
  10 = complete surprise, no one saw this coming
  8-9 = significant new development, changes prior understanding
  6-7 = meaningful update to ongoing story
  4-5 = expected development, routine update
  1-3 = recycled story, no new facts, pure commentary

RELEVANCE (fit to: Technology, AI, Southeast Asia, Singapore, US-China, Macroeconomics):
  10 = directly about one of the core topics with major implications
  8-9 = closely related, clear connection to a core topic
  6-7 = tangentially related
  1-5 = weak or no connection

CRITICAL RULES:
- Sponsored content, press releases, product reviews: ALL THREE scores must be 1-2
- Opinion/commentary pieces with no hard news: Impact 1-3, Novelty 1-3
- Do NOT give 5/5/5 as a default — differentiate meaningfully
- Expect your scores to span from 2 to 9 across this batch

Articles:
${JSON.stringify(articleList, null, 2)}

Return ONLY a valid JSON array — no markdown, no explanation:
[
  { "index": 0, "impact": 8, "novelty": 6, "relevance": 9, "average": 7.67, "reason": "one specific sentence explaining the scores" }
]
average = mean of impact + novelty + relevance, rounded to 2 decimal places.`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const scores = JSON.parse(raw);

    return articles.map((a, i) => {
      const s = scores.find((x) => x.index === i) || {};
      const impact    = s.impact    || 5;
      const novelty   = s.novelty   || 5;
      const relevance = s.relevance || 5;
      const average   = s.average   || parseFloat(((impact + novelty + relevance) / 3).toFixed(2));
      return {
        ...a,
        score_impact:    impact,
        score_novelty:   novelty,
        score_relevance: relevance,
        score_average:   average,
        score_reason:    s.reason || "",
      };
    });
  } catch (err) {
    console.error(`  ✗ Scoring error [${categoryLabel}]: ${err.message}`);
    return articles.map((a) => ({
      ...a,
      score_impact: 5, score_novelty: 5, score_relevance: 5,
      score_average: 5.0, score_reason: "Scoring unavailable",
    }));
  }
}

async function scoreAllArticles(newsByCategory) {
  console.log("\n🎯 Scoring articles...");
  const scored = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    if (!articles || articles.length === 0) {
      scored[label] = { emoji, articles: [] };
      continue;
    }
    console.log(`  → [${label}] scoring ${articles.length} articles...`);
    const result = await scoreBatch(articles, label);

    // Sort by score descending so best articles appear first
    result.sort((a, b) => b.score_average - a.score_average);

    // Log score distribution for debugging
    const scores = result.map((a) => a.score_average.toFixed(1));
    console.log(`     Scores: [${scores.join(", ")}]`);

    scored[label] = { emoji, articles: result };
    await new Promise((r) => setTimeout(r, 6000));
  }

  return scored;
}

module.exports = { scoreAllArticles };
