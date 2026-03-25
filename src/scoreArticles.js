// src/scoreArticles.js — One Gemini call per article, uses full body text from Guardian
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function scoreOne(article, categoryLabel) {
  // Guardian gives full body text — use up to 800 chars for much richer context
  const bodyContext = (article.content || article.description || "").slice(0, 800);

  const prompt = `You are a Senior Editor at The Economist. Score this news article on three dimensions. Be precise — do NOT default to 5.

Category: ${categoryLabel}
Title: ${article.title}
Source: ${article.source}
Body: ${bodyContext}

IMPACT (real-world consequence — people, capital, policy affected):
  9-10 = market-moving, central bank decision, major geopolitical event, national emergency
  7-8  = significant national/corporate policy, major earnings miss, notable diplomatic shift
  5-6  = regional story, moderate update, meaningful but limited consequence
  3-4  = niche or local story, minor incremental update
  1-2  = opinion, lifestyle, product review, press release, no real-world consequence

NOVELTY (how new is the information — not a repeat or commentary on old news):
  9-10 = breaking, no prior signals, genuinely changes the picture
  7-8  = important new development, meaningfully advances an ongoing story
  5-6  = anticipated update, confirms what markets/analysts expected
  3-4  = routine, minor new detail on stale story
  1-2  = pure commentary, analysis of old news, no new facts

RELEVANCE (fit to "${categoryLabel}" — be strict):
  9-10 = this IS the core topic, directly and specifically about it
  7-8  = closely related with clear direct connection
  5-6  = tangential, requires a stretch to connect
  3-4  = weakly related, mostly about something else
  1-2  = unrelated to this category

CALIBRATION — before scoring, ask yourself:
- Is this just an opinion piece? → Impact ≤ 3, Novelty ≤ 3
- Is this a product review or gadget roundup? → All scores ≤ 4
- Is this breaking news with market/policy consequences? → Impact ≥ 8
- Does the title use "here's why" / "top 10" / "you need to know"? → Novelty ≤ 3

Return ONLY this exact JSON, absolutely nothing else before or after it:
{"impact":7,"novelty":6,"relevance":8,"average":7.0,"reason":"One specific sentence explaining the scores"}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    console.log(`     RAW: ${raw.slice(0, 120)}`);

    // Strip markdown fences, then extract JSON object
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error(`No JSON object in: ${raw.slice(0, 100)}`);

    const s = JSON.parse(jsonMatch[0]);
    const impact    = Math.min(10, Math.max(1, Math.round(Number(s.impact))    || 5));
    const novelty   = Math.min(10, Math.max(1, Math.round(Number(s.novelty))   || 5));
    const relevance = Math.min(10, Math.max(1, Math.round(Number(s.relevance)) || 5));
    const average   = parseFloat(((impact + novelty + relevance) / 3).toFixed(2));

    return { ...article, score_impact: impact, score_novelty: novelty, score_relevance: relevance, score_average: average, score_reason: s.reason || "" };

  } catch (err) {
    console.error(`     ✗ FAILED "${article.title.slice(0, 50)}": ${err.message}`);
    return { ...article, score_impact: 4, score_novelty: 4, score_relevance: 4, score_average: 4.0, score_reason: `Scoring failed: ${err.message}` };
  }
}

async function scoreAllArticles(newsByCategory) {
  console.log("\n🎯 Scoring articles (one call per article)...");
  const scored = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    if (!articles || articles.length === 0) {
      scored[label] = { emoji, articles: [] };
      continue;
    }

    console.log(`  → [${label}] ${articles.length} articles`);
    const results = [];

    for (const article of articles) {
      const s = await scoreOne(article, label);
      console.log(`     ${s.score_average}/10 (I:${s.score_impact} N:${s.score_novelty} R:${s.score_relevance}) — "${article.title.slice(0, 55)}"`);
      results.push(s);
      await new Promise((r) => setTimeout(r, 6200));
    }

    results.sort((a, b) => b.score_average - a.score_average);
    console.log(`     Ranked: [${results.map((a) => a.score_average.toFixed(1)).join(", ")}]`);
    scored[label] = { emoji, articles: results };
  }

  return scored;
}

module.exports = { scoreAllArticles };
