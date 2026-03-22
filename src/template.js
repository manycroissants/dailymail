// src/template.js — Email template with clusters, impact scores, multi-source links

function getBiasColor(label) {
  if (!label) return "#6b7280";
  const l = label.toLowerCase();
  if (l.includes("state") || l.includes("china")) return "#dc2626";
  if (l.includes("singapore")) return "#059669";
  if (l.includes("western wire") || l.includes("neutral")) return "#6b7280";
  if (l.includes("western media")) return "#0891b2";
  if (l.includes("us-centric")) return "#2563eb";
  if (l.includes("financial") || l.includes("markets")) return "#7c3aed";
  if (l.includes("multi-source")) return "#0369a1";
  if (l.includes("right")) return "#b45309";
  return "#374151";
}

function getScoreColor(score) {
  if (score >= 9) return "#059669";   // green — exceptional
  if (score >= 8) return "#0369a1";   // blue — strong
  if (score >= 7) return "#d97706";   // amber — solid
  return "#6b7280";                   // grey — borderline
}

function formatDate() {
  return new Date().toLocaleDateString("en-SG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Singapore",
  });
}

function buildScoreBadge(cluster) {
  const score = cluster.score_average || 0;
  const color = getScoreColor(score);
  const label = score >= 9 ? "🔥 Must-Read" : score >= 8 ? "⭐ Top Story" : "📌 Notable";
  return `<span style="font-size:10px;font-weight:700;color:${color};background:${color}15;padding:2px 8px;border-radius:20px;border:1px solid ${color}40;display:inline-block;margin-right:6px;">${label} ${score.toFixed(1)}/10</span>`;
}

function buildSubScores(cluster) {
  const items = [
    { label: "Impact", val: cluster.score_impact },
    { label: "Novelty", val: cluster.score_novelty },
    { label: "Relevance", val: cluster.score_relevance },
  ].filter(i => i.val > 0);
  if (items.length === 0) return "";
  return items.map(i =>
    `<span style="font-size:10px;color:#6b7280;margin-right:8px;">${i.label}: <strong style="color:#374151;">${i.val}/10</strong></span>`
  ).join("");
}

function buildSourceLinks(sources, isCluster) {
  if (!sources || sources.length === 0) return "";

  if (!isCluster) {
    // Single source — just a link
    const s = sources[0];
    return `<a href="${s.url}" target="_blank" style="font-size:11px;font-weight:600;color:#2563eb;text-decoration:none;">Read full article → (${s.source})</a>`;
  }

  // Multiple sources — list each headline + outlet
  const heading = `<p style="margin:8px 0 4px;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;">📰 ${sources.length} sources reporting this story:</p>`;
  const links = sources.map((s) =>
    `<p style="margin:2px 0;font-size:11px;color:#4b5563;line-height:1.4;">
      <span style="color:#9ca3af;">[${s.source}]</span>
      <a href="${s.url}" target="_blank" style="color:#2563eb;text-decoration:none;margin-left:4px;">${s.title}</a>
    </p>`
  ).join("");
  return heading + links;
}

function buildClusterCard(cluster, index) {
  const biasColor = getBiasColor(cluster.bias_label);
  const isCluster = cluster.type === "cluster" || (cluster.sources && cluster.sources.length > 1);

  const clusterBadge = isCluster
    ? `<span style="font-size:10px;font-weight:700;color:#0369a1;background:#dbeafe;padding:2px 7px;border-radius:20px;border:1px solid #93c5fd;margin-right:4px;">🔗 ${cluster.sources.length} Sources</span>`
    : "";

  const counterBlock = cluster.is_polarized && cluster.counter_headline
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:3px;">
        <tr><td style="padding:7px 10px;">
          <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.4px;">⚖️ Counter-Perspective</p>
          <p style="margin:0;font-size:12px;color:#78350f;font-style:italic;">"${cluster.counter_headline}"</p>
        </td></tr>
      </table>`
    : "";

  const editorNote = cluster.score_reason
    ? `<p style="margin:5px 0 0;font-size:10px;color:#9ca3af;font-style:italic;">Editor: ${cluster.score_reason}</p>`
    : "";

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:1px;background:#ffffff;">
  <tr><td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;">

    <!-- Badge row -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
      <tr>
        <td>
          ${buildScoreBadge(cluster)}
          ${clusterBadge}
          <span style="font-size:10px;font-weight:700;color:${biasColor};background:${biasColor}15;padding:2px 7px;border-radius:20px;border:1px solid ${biasColor}30;display:inline-block;">${cluster.bias_label || "[Unclassified]"}</span>
        </td>
      </tr>
    </table>

    <!-- Sub-scores -->
    <p style="margin:0 0 6px;">${buildSubScores(cluster)}</p>

    <!-- Headline -->
    <p style="margin:0 0 5px;font-size:14px;font-weight:800;color:#0f172a;line-height:1.35;">${cluster.headline}</p>

    <!-- Summary -->
    <p style="margin:0 0 6px;font-size:13px;color:#374151;line-height:1.6;">${cluster.summary}</p>

    <!-- Bias note -->
    ${cluster.bias_note
      ? `<p style="margin:0 0 6px;font-size:11px;color:#6b7280;font-style:italic;padding:5px 9px;background:#f8fafc;border-radius:3px;border-left:2px solid #e2e8f0;">📌 ${cluster.bias_note}</p>`
      : ""}

    <!-- Counter perspective -->
    ${counterBlock}

    <!-- Source links -->
    <div style="margin-top:8px;">${buildSourceLinks(cluster.sources, isCluster)}</div>

    <!-- Editor note -->
    ${editorNote}

  </td></tr>
</table>`;
}

function buildCategorySection(label, emoji, clusters) {
  if (!clusters || clusters.length === 0) return "";
  const cards = clusters.map((c, i) => buildClusterCard(c, i)).join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
  <tr>
    <td style="background:#f8fafc;padding:10px 14px;border-bottom:2px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:18px;padding-right:8px;vertical-align:middle;">${emoji}</td>
        <td style="font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:.8px;vertical-align:middle;">${label}</td>
        <td align="right" style="vertical-align:middle;">
          <span style="font-size:10px;color:#94a3b8;font-weight:600;">${clusters.length} stories</span>
        </td>
      </tr></table>
    </td>
  </tr>
  <tr><td>${cards}</td></tr>
</table>`;
}

function buildEmailHTML(clusteredByCategory) {
  const dateStr = formatDate();
  const totalClusters = Object.values(clusteredByCategory)
    .reduce((sum, { clusters }) => sum + (clusters?.length || 0), 0);
  const totalSources = Object.values(clusteredByCategory)
    .reduce((sum, { clusters }) =>
      sum + (clusters || []).reduce((s, c) => s + (c.sources?.length || 1), 0), 0);

  const categorySections = Object.entries(clusteredByCategory)
    .map(([label, { emoji, clusters }]) => buildCategorySection(label, emoji, clusters))
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Daily Intelligence Brief — ${dateStr}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px 0;">
<tr><td align="center">
<table width="100%" style="max-width:640px;margin:0 auto;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);border-radius:10px 10px 0 0;padding:24px 24px 20px;">
    <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:2.5px;">Personalized Intelligence Brief</p>
    <h1 style="margin:0 0 5px;font-size:24px;font-weight:900;color:#ffffff;line-height:1.2;">Your Daily Brief ☕</h1>
    <p style="margin:0 0 4px;font-size:12px;color:#bfdbfe;">${dateStr} · Singapore Time</p>
    <p style="margin:0 0 16px;font-size:11px;color:#93c5fd;">${totalClusters} story clusters · ${totalSources} sources analysed · Senior Editor curated</p>
    <table cellpadding="0" cellspacing="3"><tr>
      <td style="background:rgba(255,255,255,0.12);border-radius:20px;padding:3px 9px;font-size:10px;color:#dbeafe;">💻 Tech</td>
      <td width="3"></td>
      <td style="background:rgba(255,255,255,0.12);border-radius:20px;padding:3px 9px;font-size:10px;color:#dbeafe;">🤖 AI</td>
      <td width="3"></td>
      <td style="background:rgba(255,255,255,0.12);border-radius:20px;padding:3px 9px;font-size:10px;color:#dbeafe;">🌏 SEA</td>
      <td width="3"></td>
      <td style="background:rgba(255,255,255,0.12);border-radius:20px;padding:3px 9px;font-size:10px;color:#dbeafe;">🌐 US-China</td>
      <td width="3"></td>
      <td style="background:rgba(255,255,255,0.12);border-radius:20px;padding:3px 9px;font-size:10px;color:#dbeafe;">📈 Macro</td>
    </tr></table>
  </td></tr>

  <!-- LEGEND -->
  <tr><td style="background:#eff6ff;padding:9px 20px;border-left:1px solid #dbeafe;border-right:1px solid #dbeafe;">
    <p style="margin:0;font-size:11px;color:#1e40af;line-height:1.6;">
      <strong>Reading guide:</strong>
      🔥 Must-Read ≥9 · ⭐ Top Story ≥8 · 📌 Notable ≥7 &nbsp;·&nbsp;
      <span style="color:#2563eb;font-weight:bold;">Blue bold</span> = verbatim phrase from source &nbsp;·&nbsp;
      🔗 = multiple outlets reporting same event &nbsp;·&nbsp;
      🟡 = polarized coverage
    </p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#f1f5f9;padding:16px 12px;border:1px solid #e2e8f0;border-top:none;">
    ${categorySections}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0f172a;border-radius:0 0 10px 10px;padding:16px 24px;text-align:center;">
    <p style="margin:0 0 3px;font-size:12px;color:#94a3b8;">AI-curated · Senior Editor scored · Topic-clustered</p>
    <p style="margin:0 0 8px;font-size:11px;color:#475569;">NewsData.io · Gemini 2.5 Flash · Resend</p>
    <p style="margin:0;font-size:10px;color:#334155;">chanzeming@hotmail.com · 7:00 PM SGT</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

module.exports = { buildEmailHTML };
