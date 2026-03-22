// src/clusterNews.js — Clusters same-event articles, 30-word summary cap
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
      highlighted = highlighted.replace(regex,
        `<span style="color:#2563eb;font-weight:bold;">$&</span>`);
    }
  }
  return highlighted;
}

// Hard truncate to 30 words as a safety net
function enforce30Words(text) {
  if (!text) return text;
  const words = text.trim().split(/\s+/);
  if (words.length <= 30) return text;
  return words.slice(0, 30).join(" ") + "…";
}

function guessBiasLabel(sources) {
  const text = sources.join(" ").toLowerCase();
  if (/xinhua|global times|cgtn|china daily/.test(text)) return "[State-Affiliated / China]";
  if (/channelnewsasia|cna|straits times|todayonline/.test(text)) return "[Singapore-Centric]";
  if (/reuters|associated press|\bap\b|bbc/.test(text)) return "[Western Wire / Neutral]";
  if (/bloomberg|financial times|\bft\b|wall street journal|\bwsj\b/.test(text)) return "[Financial / Markets]";
  if (/guardian|new york times|\bnyt\b|washington post/.test(text)) return "[Western Media]";
  return sources.length > 1 ? "[Multi-Source]" : "[General]";
}

async function buildSingleCluster(article) {
  const sourceText = (article.content || article.description || article.title).slice(0, 2500);

  const prompt = `Summarize this news article in ONE sentence. Hard limit: 30 words maximum. Be specific — include the key actor, action, and consequence. No filler words.

Title: ${article.title}
Content: ${sourceText}

Respond ONLY with valid JSON (no markdown):
{
  "summary": "Your 30-word-max sentence here.",
  "bias_label": "One of: [Singapore-Centric],[US-Centric],[Western Media],[State-Affiliated],[China-Centric],[Financial/Markets],[Neutral/Analytical],[Right-Leaning],[Left-Leaning],[Multi-Source],[General]",
  "bias_note": "One sentence on framing.",
  "is_polarized": false,
  "counter_headline": null
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(raw);
    const summary = enforce30Words(parsed.summary);
    return {
      type: "single",
      headline: article.title,
      summary: applyBlueHighlights(summary, [sourceText]),
      bias_label: parsed.bias_label || guessBiasLabel([article.source]),
      bias_note: parsed.bias_note || "",
      is_polarized: !!parsed.is_polarized,
      counter_headline: parsed.counter_headline || null,
      score_average:   article.score_average   || 0,
      score_impact:    article.score_impact    || 0,
      score_novelty:   article.score_novelty   || 0,
      score_relevance: article.score_relevance || 0,
      score_reason:    article.score_reason    || "",
      sources: [{ title: article.title, url: article.url, source: article.source }],
    };
  } catch (err) {
    console.error(`  ✗ Single cluster error: ${err.message}`);
    return {
      type: "single",
      headline: article.title,
      summary: enforce30Words(article.description || article.title),
      bias_label: guessBiasLabel([article.source]),
      bias_note: "", is_polarized: false, counter_headline: null,
      score_average: article.score_average || 0,
      score_impact: article.score_impact || 0,
      score_novelty: article.score_novelty || 0,
      score_relevance: article.score_relevance || 0,
      score_reason: article.score_reason || "",
      sources: [{ title: article.title, url: article.url, source: article.source }],
    };
  }
}

async function buildMultiCluster(articles, eventTitle) {
  const allTexts = articles.map((a) => (a.content || a.description || a.title).slice(0, 1200));
  const combinedContext = articles.map((a, i) => `[${a.source}]\n${allTexts[i]}`).join("\n---\n");
  const avgScore = (articles.reduce((s, a) => s + (a.score_average || 0), 0) / articles.length).toFixed(1);

  const prompt = `Multiple sources cover the same event. Write ONE unified sentence (max 30 words) that synthesises the key fact, actor, and implication.

Event: ${eventTitle}
${combinedContext.slice(0, 3000)}

Respond ONLY with valid JSON (no markdown):
{
  "headline": "Single definitive headline, max 15 words.",
  "summary": "One sentence, max 30 words, synthesising all sources.",
  "bias_label": "One of: [Singapore-Centric],[US-Centric],[Western Media],[State-Affiliated],[China-Centric],[Financial/Markets],[Neutral/Analytical],[Multi-Source]",
  "bias_note": "Note any framing differences between sources.",
  "is_polarized": false,
  "counter_headline": null
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(raw);
    const summary = enforce30Words(parsed.summary);
    return {
      type: "cluster",
      headline: parsed.headline || eventTitle,
      summary: applyBlueHighlights(summary, allTexts),
      bias_label: parsed.bias_label || guessBiasLabel(articles.map((a) => a.source)),
      bias_note: parsed.bias_note || "",
      is_polarized: !!parsed.is_polarized,
      counter_headline: parsed.counter_headline || null,
      score_average:   parseFloat(avgScore),
      score_impact:    Math.max(...articles.map((a) => a.score_impact    || 0)),
      score_novelty:   Math.max(...articles.map((a) => a.score_novelty   || 0)),
      score_relevance: Math.max(...articles.map((a) => a.score_relevance || 0)),
      score_reason:    `Clustered from ${articles.length} sources`,
      sources: articles.map((a) => ({ title: a.title, url: a.url, source: a.source })),
    };
  } catch (err) {
    console.error(`  ✗ Multi-cluster error: ${err.message}`);
    return buildSingleCluster(articles[0]);
  }
}

async function clusterCategory(articles, categoryLabel) {
  if (articles.length === 0) return [];
  if (articles.length === 1) return [await buildSingleCluster(articles[0])];

  const articleList = articles.map((a, i) => ({ index: i, title: a.title, source: a.source }));
  const prompt = `Group these articles by the specific EVENT they cover. Only group articles reporting on the SAME specific event — not just the same broad topic.

${JSON.stringify(articleList, null, 2)}

Return ONLY valid JSON (no markdown):
[{ "group_id": 0, "indices": [0, 2], "event_title": "Short event label" }]`;

  let groups;
  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    groups = JSON.parse(raw);
    await new Promise((r) => setTimeout(r, 6000));
  } catch (err) {
    groups = articles.map((_, i) => ({ group_id: i, indices: [i], event_title: articles[i].title }));
  }

  const clusters = [];
  for (const group of groups) {
    const groupArticles = (group.indices || []).filter((i) => i < articles.length).map((i) => articles[i]);
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

async function clusterAllNews(scoredByCategory) {
  console.log("\n🔗 Clustering same-event articles...");
  const clustered = {};
  for (const [label, { emoji, articles }] of Object.entries(scoredByCategory)) {
    process.stdout.write(`  → [${label}] ${articles.length} articles → `);
    const clusters = await clusterCategory(articles, label);
    clusters.sort((a, b) => b.score_average - a.score_average);
    console.log(`${clusters.length} clusters`);
    clustered[label] = { emoji, clusters };
    await new Promise((r) => setTimeout(r, 3000));
  }
  return clustered;
}

module.exports = { clusterAllNews };
