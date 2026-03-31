// src/clusterNews.js — Cross-source clustering using Jaccard title similarity
// Signal 1: same story detected by word overlap → merged cluster, summary from highest scorer
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ── Jaccard similarity on title word sets ────────────────────────────────────
// Returns 0.0–1.0. Threshold of 0.25 catches same-story headlines phrased differently.
function titleWords(title) {
  const STOP = new Set(["the","a","an","of","in","on","at","to","for","and","or","but","is","are","was","were","as","by","with","its","it","he","she","they","that","this","from","says","said","after","over","new","how","why","what","who","has","have","will","not","be","been","about","more","than"]);
  return new Set(
    (title || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.25; // 25% word overlap = same story

// ── Helpers ──────────────────────────────────────────────────────────────────
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
      highlighted = highlighted.replace(regex, `<span style="color:#2563eb;font-weight:bold;">$&</span>`);
    }
  }
  return highlighted;
}

function enforce30Words(text) {
  if (!text) return text;
  const words = text.trim().split(/\s+/);
  return words.length <= 30 ? text : words.slice(0, 30).join(" ") + "…";
}

function guessBiasLabel(sources) {
  const text = sources.join(" ").toLowerCase();
  if (/xinhua|global times|cgtn|china daily/.test(text)) return "[State-Affiliated / China]";
  if (/channelnewsasia|cna|straits times|todayonline/.test(text)) return "[Singapore-Centric]";
  if (/reuters|associated press|\bap\b|bbc/.test(text)) return "[Western Wire / Neutral]";
  if (/bloomberg|financial times|\bft\b|wall street journal|\bwsj\b/.test(text)) return "[Financial / Markets]";
  if (/guardian/.test(text)) return "[Western Media]";
  return sources.length > 1 ? "[Multi-Source]" : "[General]";
}

// ── Step 1: Group articles into same-story clusters using Jaccard ─────────────
function groupBySimilarity(articles) {
  const groups = [];    // array of article arrays
  const assigned = new Set();

  for (let i = 0; i < articles.length; i++) {
    if (assigned.has(i)) continue;
    const group = [articles[i]];
    assigned.add(i);
    const wordsI = titleWords(articles[i].title);

    for (let j = i + 1; j < articles.length; j++) {
      if (assigned.has(j)) continue;
      const wordsJ = titleWords(articles[j].title);
      if (jaccardSimilarity(wordsI, wordsJ) >= SIMILARITY_THRESHOLD) {
        group.push(articles[j]);
        assigned.add(j);
      }
    }
    groups.push(group);
  }
  return groups;
}

// ── Step 2a: Summarise a single article ──────────────────────────────────────
async function summariseSingle(article) {
  const sourceText = (article.content || article.description || article.title).slice(0, 2500);
  const prompt = `Summarize this news article in ONE sentence. Hard limit: 30 words. Include key actor, action, consequence. No filler.

Title: ${article.title}
Content: ${sourceText}

Respond ONLY with valid JSON (no markdown):
{"summary":"...","bias_label":"One of: [Singapore-Centric],[US-Centric],[Western Media],[State-Affiliated],[China-Centric],[Financial/Markets],[Neutral/Analytical],[Multi-Source],[General]","bias_note":"One sentence on framing.","is_polarized":false,"counter_headline":null}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary:          enforce30Words(parsed.summary),
      bias_label:       parsed.bias_label || guessBiasLabel([article.source]),
      bias_note:        parsed.bias_note || "",
      is_polarized:     !!parsed.is_polarized,
      counter_headline: parsed.counter_headline || null,
    };
  } catch (err) {
    console.error(`  ✗ Summarise error: ${err.message}`);
    return {
      summary:          enforce30Words(article.description || article.title),
      bias_label:       guessBiasLabel([article.source]),
      bias_note:        "", is_polarized: false, counter_headline: null,
    };
  }
}

// ── Step 2b: Build a cluster from a group of articles ────────────────────────
// Signal 1: summary comes from the highest-scored article; all sources are listed
async function buildCluster(group) {
  // Sort group by score descending — best article provides the summary
  group.sort((a, b) => (b.score_average || 0) - (a.score_average || 0));
  const best = group[0];

  const summarised = await summariseSingle(best);
  await new Promise((r) => setTimeout(r, 6200)); // Gemini rate limit

  // Blue highlights checked against ALL sources in the cluster
  const allTexts = group.map((a) => (a.content || a.description || a.title).slice(0, 1500));
  const highlightedSummary = applyBlueHighlights(summarised.summary, allTexts);

  const isCluster = group.length > 1;
  const avgScore  = parseFloat((group.reduce((s, a) => s + (a.score_average || 0), 0) / group.length).toFixed(1));

  if (isCluster) {
    console.log(`     🔗 Merged ${group.length} sources: "${best.title.slice(0, 50)}"`);
  }

  return {
    type:             isCluster ? "cluster" : "single",
    headline:         best.title,
    summary:          highlightedSummary,
    bias_label:       summarised.bias_label,
    bias_note:        summarised.bias_note,
    is_polarized:     summarised.is_polarized,
    counter_headline: summarised.counter_headline,
    // Score from the best article in the cluster
    score_average:    best.score_average || 0,
    score_raw:        best.score_raw || 0,
    score_reason:     best.score_reason || "",
    // Signal 1 bonus: cluster size logged but not double-counted in score
    // (score_average already reflects the best article — cluster size is shown via sources)
    sources: group.map((a) => ({
      title:  a.title,
      url:    a.url,
      source: a.source,
      score:  a.score_average || 0,
    })),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────
async function clusterAllNews(scoredByCategory) {
  console.log("\n🔗 Clustering same-story articles (Jaccard similarity)...");
  const clustered = {};

  for (const [label, { emoji, articles }] of Object.entries(scoredByCategory)) {
    if (!articles || articles.length === 0) {
      clustered[label] = { emoji, clusters: [] };
      continue;
    }

    console.log(`  → [${label}] ${articles.length} articles`);
    const groups   = groupBySimilarity(articles);
    console.log(`     → ${groups.length} story group(s) after similarity clustering`);

    const clusters = [];
    for (const group of groups) {
      const cluster = await buildCluster(group);
      clusters.push(cluster);
    }

    // Sort clusters by best article score descending
    clusters.sort((a, b) => b.score_average - a.score_average);
    clustered[label] = { emoji, clusters };
  }

  return clustered;
}

module.exports = { clusterAllNews };
