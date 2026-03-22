// src/clusterNews.js — Topic clustering to de-duplicate same-event coverage
// Groups articles about the same event, generates one unified summary per cluster

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ─── Blue highlight: find 5+ word verbatim phrases across all cluster articles
function applyBlueHighlights(summary, allSourceTexts) {
  const combined = allSourceTexts.join(" ");
  const sourceWords = combined.replace(/\s+/g, " ").trim().split(" ");
  const phrases = new Set();

  for (let i = 0; i <= sourceWords.length - 5; i++) {
    for (let len = 5; len <= Math.min(15, sourceWords.length - i); len++) {
      const phrase = sourceWords.slice(i, i + len).join(" ");
      if (phrase.length > 20) phrases.add(phrase);
    }
  }

  let highlighted = summary;
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<!<[^>]*)${escaped}(?![^<]*>)`, "gi");
    if (regex.test(highlighted)) {
      highlighted = highlighted.replace(
        regex,
        `<span style="color: #2563eb; font-weight: bold;">$&</span>`
      );
    }
  }
  return highlighted;
}

// ─── Heuristic bias label ────────────────────────────────────────────────────
function guessBiasLabel(sources) {
  const text = sources.join(" ").toLowerCase();
  if (/xinhua|global times|cgtn|china daily/.test(text)) return "[State-Affiliated / China]";
  if (/channelnewsasia|cna|straits times|todayonline/.test(text)) return "[Singapore-Centric]";
  if (/reuters|associated press|\bap\b|bbc/.test(text)) return "[Western Wire / Neutral]";
  if (/bloomberg|financial times|\bft\b|wall street journal|\bwsj\b/.test(text)) return "[Financial / Markets Focus]";
  if (/guardian|new york times|\bnyt\b|washington post/.test(text)) return "[Western Media]";
  if (/xinhua|global times/.test(text)) return "[State-Affiliated / China]";
  return "[Multi-Source]";
}

// ─── Cluster articles within a category into event groups ───────────────────
async function clusterCategory(articles, categoryLabel) {
  if (articles.length === 0) return [];
  if (articles.length === 1) {
    // Single article — wrap it as its own cluster
    return [await buildSingleCluster(articles[0])];
  }

  const articleList = articles.map((a, i) => ({
    index: i,
    title: a.title,
    description: (a.description || "").slice(0, 200),
    source: a.source,
  }));

  const clusterPrompt = `You are a news editor. Group these articles by the specific EVENT they cover. Articles about the same event should be in the same group even if framed differently.

Rules:
- Each group = one distinct event or story
- Do NOT group articles just because they share a broad topic (e.g. don't group all AI articles together — only group articles about the SAME specific AI development)
- An article with no match stays in its own group of 1

Articles:
${JSON.stringify(articleList, null, 2)}

Return ONLY valid JSON — no markdown, no explanation:
[
  { "group_id": 0, "indices": [0, 2], "event_title": "Short label for this event" },
  { "group_id": 1, "indices": [1], "event_title": "Short label for this event" }
]`;

  let groups;
  try {
    const result = await model.generateContent(clusterPrompt);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    groups = JSON.parse(cleaned);
    await new Promise((r) => setTimeout(r, 6000));
  } catch (err) {
    console.error(`  ✗ Clustering error [${categoryLabel}]: ${err.message}`);
    // Fallback: each article is its own cluster
    groups = articles.map((_, i) => ({ group_id: i, indices: [i], event_title: articles[i].title }));
  }

  // Build cluster objects
  const clusters = [];
  for (const group of groups) {
    const groupArticles = (group.indices || [])
      .filter((i) => i < articles.length)
      .map((i) => articles[i]);

    if (groupArticles.length === 0) continue;

    if (groupArticles.length === 1) {
      clusters.push(await buildSingleCluster(groupArticles[0]));
    } else {
      clusters.push(await buildMultiCluster(groupArticles, group.event_title));
      await new Promise((r) => setTimeout(r, 6000));
    }
  }

  return clusters;
}

// ─── Single article → cluster ────────────────────────────────────────────────
async function buildSingleCluster(article) {
  const sourceText = (article.content || article.description || article.title).slice(0, 2500);

  const prompt = `You are a senior news editor. Summarize this article in exactly 1-2 punchy sentences, maximum 40 words total. Be specific — name the key actors, numbers, and consequences. No fluff.

Title: ${article.title}
Content: ${sourceText}

Respond ONLY with valid JSON — no markdown:
{
  "summary": "...",
  "bias_label": "One of: [Singapore-Centric], [US-Centric], [Western Media], [State-Affiliated], [China-Centric], [Financial/Markets Focus], [Neutral/Analytical], [Right-Leaning], [Left-Leaning], [Multi-Source]",
  "bias_note": "One sentence on framing.",
  "is_polarized": false,
  "counter_headline": null
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(raw);
    const highlightedSummary = applyBlueHighlights(parsed.summary, [sourceText]);

    return {
      type: "single",
      headline: article.title,
      summary: highlightedSummary,
      bias_label: parsed.bias_label || guessBiasLabel([article.source]),
      bias_note: parsed.bias_note || "",
      is_polarized: !!parsed.is_polarized,
      counter_headline: parsed.counter_headline || null,
      score_average: article.score_average || 0,
      score_impact: article.score_impact || 0,
      score_novelty: article.score_novelty || 0,
      score_relevance: article.score_relevance || 0,
      score_reason: article.score_reason || "",
      sources: [{ title: article.title, url: article.url, source: article.source }],
    };
  } catch (err) {
    console.error(`  ✗ Single cluster error: ${err.message}`);
    return fallbackCluster(article);
  }
}

// ─── Multiple articles → unified cluster ────────────────────────────────────
async function buildMultiCluster(articles, eventTitle) {
  const allTexts = articles.map((a) =>
    (a.content || a.description || a.title).slice(0, 1500)
  );
  const combinedContext = articles
    .map((a, i) => `[Source ${i + 1}: ${a.source}]\n${allTexts[i]}`)
    .join("\n\n---\n\n");

  const avgScore = (
    articles.reduce((sum, a) => sum + (a.score_average || 0), 0) / articles.length
  ).toFixed(1);

  const prompt = `You are a senior news editor. Multiple sources are reporting on the same event. Write ONE unified 3-sentence summary that synthesizes all perspectives. Be specific — names, numbers, consequences. No fluff.

Event: ${eventTitle}
Sources (${articles.length}):
${combinedContext.slice(0, 4000)}

Respond ONLY with valid JSON — no markdown:
{
  "headline": "A single definitive headline for this clustered story (max 15 words)",
  "summary": "A cohesive 3-sentence synthesis. Sentence 1: what happened. Sentence 2: key details/numbers. Sentence 3: implications.",
  "bias_label": "One of: [Singapore-Centric], [US-Centric], [Western Media], [State-Affiliated], [China-Centric], [Financial/Markets Focus], [Neutral/Analytical], [Multi-Source]",
  "bias_note": "Note any notable differences in how each source frames the story.",
  "is_polarized": true or false,
  "counter_headline": "Opposing viewpoint headline if polarized, else null"
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(raw);
    const highlightedSummary = applyBlueHighlights(parsed.summary, allTexts);

    return {
      type: "cluster",
      headline: parsed.headline || eventTitle,
      summary: highlightedSummary,
      bias_label: parsed.bias_label || guessBiasLabel(articles.map((a) => a.source)),
      bias_note: parsed.bias_note || "",
      is_polarized: !!parsed.is_polarized,
      counter_headline: parsed.counter_headline || null,
      score_average: parseFloat(avgScore),
      score_impact: Math.max(...articles.map((a) => a.score_impact || 0)),
      score_novelty: Math.max(...articles.map((a) => a.score_novelty || 0)),
      score_relevance: Math.max(...articles.map((a) => a.score_relevance || 0)),
      score_reason: `Clustered from ${articles.length} sources`,
      sources: articles.map((a) => ({ title: a.title, url: a.url, source: a.source })),
    };
  } catch (err) {
    console.error(`  ✗ Multi-cluster error: ${err.message}`);
    return fallbackCluster(articles[0], articles);
  }
}

function fallbackCluster(article, allArticles) {
  return {
    type: "single",
    headline: article.title,
    summary: article.description || article.title,
    bias_label: "[General / Unclassified]",
    bias_note: "",
    is_polarized: false,
    counter_headline: null,
    score_average: article.score_average || 0,
    score_impact: article.score_impact || 0,
    score_novelty: article.score_novelty || 0,
    score_relevance: article.score_relevance || 0,
    score_reason: "",
    sources: (allArticles || [article]).map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source,
    })),
  };
}

// ─── Cluster all categories ──────────────────────────────────────────────────
async function clusterAllNews(scoredByCategory) {
  console.log("\n🔗 Topic clustering (de-duplicating same-event coverage)...");
  const clustered = {};

  for (const [label, { emoji, articles }] of Object.entries(scoredByCategory)) {
    process.stdout.write(`  → [${label}] ${articles.length} articles → `);
    const clusters = await clusterCategory(articles, label);
    // Sort clusters by score descending
    clusters.sort((a, b) => b.score_average - a.score_average);
    console.log(`${clusters.length} story clusters`);
    clustered[label] = { emoji, clusters };
    await new Promise((r) => setTimeout(r, 3000));
  }

  return clustered;
}

module.exports = { clusterAllNews };
