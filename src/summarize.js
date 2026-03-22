// src/summarize.js — Gemini-powered summarizer with newsworthiness filtering,
// <25 word summaries, opinion filtering, and blue-highlight detection.

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ─── Blue Highlight: detect 5+ word verbatim phrases ───────────────────────
function applyBlueHighlights(summary, sourceText) {
  if (!sourceText || !summary) return summary;
  const sourceWords = sourceText.replace(/\s+/g, " ").trim().split(" ");
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

// ─── Heuristic bias fallback ────────────────────────────────────────────────
function guessBiasLabel(source, title, content) {
  const text = `${source} ${title} ${content}`.toLowerCase();
  if (/xinhua|global times|cgtn|china daily|people's daily/.test(text)) return "[State-Affiliated / China]";
  if (/channelnewsasia|cna|straits times|todayonline/.test(text)) return "[Singapore-Centric]";
  if (/reuters|associated press|\bap\b|bbc/.test(text)) return "[Western Wire / Neutral]";
  if (/fox news|breitbart|daily mail|new york post/.test(text)) return "[Right-Leaning Western]";
  if (/guardian|new york times|\bnyt\b|washington post/.test(text)) return "[Western Media / Liberal]";
  if (/bloomberg|financial times|\bft\b|wall street journal|\bwsj\b/.test(text)) return "[Financial / Markets Focus]";
  if (/white house|pentagon|state department/.test(text)) return "[US-Centric]";
  return "[General / Unclassified]";
}

// ─── Gemini: score + summarize a single article ──────────────────────────────
async function summarizeArticle(article) {
  const { title, content, description, source } = article;
  const sourceText = (content || description || title).slice(0, 3000);

  const prompt = `You are a senior news editor at a world-class publication. Analyze this article and respond ONLY with a valid JSON object — no markdown, no backticks, no explanation.

Article Title: ${title}
Source: ${source}
Content: ${sourceText}

Evaluation criteria:
- INCLUDE: Hard news with real-world impact (policy decisions, breakthroughs, economic data, geopolitical events, significant corporate/government actions)
- EXCLUDE: Opinion pieces, listicles, sponsored content, PR fluff, product reviews, "top 10" articles, celebrity tech gossip, lifestyle content
- EXCLUDE: Anything that is primarily someone's opinion or prediction without hard news backing it

Return exactly this JSON:
{
  "newsworthiness_score": <integer 1-10, where 10 = major breaking news with global impact, 1 = trivial or opinion>,
  "is_opinion": <true if this is primarily opinion, commentary, or promotional — false if it is hard news>,
  "summary": "<STRICT MAXIMUM 24 WORDS. A single punchy sentence stating the key fact or development. No fluff. Start with the subject.>",
  "bias_label": "One of: [Singapore-Centric], [US-Centric], [Western Media], [State-Affiliated], [China-Centric], [Financial/Markets Focus], [Neutral/Analytical], [Right-Leaning], [Left-Leaning]",
  "bias_note": "One sentence on the framing or perspective.",
  "is_polarized": <true or false>,
  "counter_headline": "<If is_polarized is true: a short opposing-viewpoint headline. Otherwise null.>"
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    const highlightedSummary = applyBlueHighlights(parsed.summary, sourceText);

    return {
      summary: highlightedSummary,
      bias_label: parsed.bias_label || guessBiasLabel(source, title, sourceText),
      bias_note: parsed.bias_note || "",
      is_polarized: !!parsed.is_polarized,
      counter_headline: parsed.counter_headline || null,
      newsworthiness_score: parsed.newsworthiness_score || 5,
      is_opinion: !!parsed.is_opinion,
    };
  } catch (err) {
    console.error(`  ✗ Summarization error for "${title}": ${err.message}`);
    return {
      summary: (description || title).slice(0, 120),
      bias_label: guessBiasLabel(source, title, sourceText),
      bias_note: "",
      is_polarized: false,
      counter_headline: null,
      newsworthiness_score: 4,
      is_opinion: false,
    };
  }
}

// ─── Summarize all, then filter + rank ──────────────────────────────────────
async function summarizeAll(newsByCategory) {
  console.log("\n🤖 Summarizing + scoring with Gemini 2.5 Flash...");
  const enriched = {};

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    console.log(`  → [${label}] — scoring ${articles.length} articles`);
    const scored = [];

    for (const article of articles) {
      const analysis = await summarizeArticle(article);
      scored.push({ ...article, ...analysis });
      // Gemini free tier: 10 RPM → ~6s between calls
      await new Promise((r) => setTimeout(r, 6500));
    }

    // Filter out opinion pieces, then sort by newsworthiness descending, take top 10
    const filtered = scored
      .filter((a) => !a.is_opinion)
      .sort((a, b) => b.newsworthiness_score - a.newsworthiness_score)
      .slice(0, 10);

    // If we somehow don't have 10 after filtering opinions, pad with remaining scored articles
    const final = filtered.length >= 5
      ? filtered
      : scored.sort((a, b) => b.newsworthiness_score - a.newsworthiness_score).slice(0, 10);

    console.log(`     ✓ ${final.length} articles selected after filtering`);
    enriched[label] = { emoji, articles: final };
  }

  return enriched;
}

module.exports = { summarizeAll };
