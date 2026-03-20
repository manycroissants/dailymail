// src/summarize.js — Uses Google Gemini API (free tier) to summarize articles,
// tag bias/perspective, and detect verbatim phrases for blue highlighting.

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ─── Blue Highlight: detect 5+ word verbatim phrases ───────────────────────
function applyBlueHighlights(summary, sourceText) {
  if (!sourceText || !summary) return summary;

  const sourceWords = sourceText.replace(/\s+/g, " ").trim().split(" ");
  const phrases = new Set();

  // Build all ngrams of 5–15 words from source
  for (let i = 0; i <= sourceWords.length - 5; i++) {
    for (let len = 5; len <= Math.min(15, sourceWords.length - i); len++) {
      const phrase = sourceWords.slice(i, i + len).join(" ");
      if (phrase.length > 20) phrases.add(phrase);
    }
  }

  let highlighted = summary;
  // Sort longest first so longer overlapping matches take priority
  const sorted = [...phrases].sort((a, b) => b.length - a.length);

  for (const phrase of sorted) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Don't match inside existing HTML tags
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

// ─── Heuristic bias fallback ────────────────────────────────────────────────
function guessBiasLabel(source, title, content) {
  const text = `${source} ${title} ${content}`.toLowerCase();
  if (/xinhua|global times|cgtn|china daily|people's daily/.test(text))
    return "[State-Affiliated / China]";
  if (/channelnewsasia|cna|straits times|todayonline/.test(text))
    return "[Singapore-Centric]";
  if (/reuters|associated press|\bap\b|bbc/.test(text))
    return "[Western Wire / Neutral]";
  if (/fox news|breitbart|daily mail|new york post/.test(text))
    return "[Right-Leaning Western]";
  if (/guardian|new york times|\bnyt\b|washington post/.test(text))
    return "[Western Media / Liberal]";
  if (/bloomberg|financial times|\bft\b|wall street journal|\bwsj\b/.test(text))
    return "[Financial / Markets Focus]";
  if (/white house|pentagon|state department/.test(text))
    return "[US-Centric]";
  return "[General / Unclassified]";
}

// ─── Gemini summarizer ───────────────────────────────────────────────────────
async function summarizeArticle(article) {
  const { title, content, description, source } = article;
  const sourceText = (content || description || title).slice(0, 3000);

  const prompt = `You are an editorial analyst. Analyze the news article below and respond ONLY with a valid JSON object — no markdown, no backticks, no explanation.

Article Title: ${title}
Source: ${source}
Content: ${sourceText}

Return exactly this JSON structure:
{
  "summary": "A 2-3 sentence summary in your own words.",
  "bias_label": "One of: [Singapore-Centric], [US-Centric], [Western Media], [State-Affiliated], [China-Centric], [Financial/Markets Focus], [Neutral/Analytical], [Right-Leaning], [Left-Leaning]",
  "bias_note": "One sentence explaining the framing or perspective of this article.",
  "is_polarized": true or false,
  "counter_headline": "If is_polarized is true, a short headline from the opposing viewpoint. Otherwise null."
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);

    const highlightedSummary = applyBlueHighlights(parsed.summary, sourceText);

    return {
      summary: highlightedSummary,
      bias_label: parsed.bias_label || guessBiasLabel(source, title, sourceText),
      bias_note: parsed.bias_note || "",
      is_polarized: !!parsed.is_polarized,
      counter_headline: parsed.counter_headline || null,
    };
  } catch (err) {
    console.error(`  ✗ Summarization error for "${title}": ${err.message}`);
    return {
      summary: description || title,
      bias_label: guessBiasLabel(source, title, sourceText),
      bias_note: "",
      is_polarized: false,
      counter_headline: null,
    };
  }
}

// ─── Summarize all categories ────────────────────────────────────────────────
async function summarizeAll(newsByCategory) {
  console.log("\n🤖 Summarizing with Gemini 2.5 Flash (free tier)...");
  const enriched = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    console.log(`  → [${label}]`);
    const enrichedArticles = [];

    for (const article of articles) {
      const analysis = await summarizeArticle(article);
      enrichedArticles.push({ ...article, ...analysis });
      // Gemini free tier: 10 RPM → wait ~6s between calls to be safe
      await new Promise((r) => setTimeout(r, 6500));
    }

    enriched[label] = { emoji, articles: enrichedArticles };
  }

  return enriched;
}

module.exports = { summarizeAll };
