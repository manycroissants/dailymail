// src/template.js — Shows score inline next to every article

function getBiasColor(label) {
  if (!label) return "#6b7280";
  const l = label.toLowerCase();
  if (l.includes("state") || l.includes("china")) return "#dc2626";
  if (l.includes("singapore")) return "#059669";
  if (l.includes("western wire") || l.includes("neutral") || l.includes("analytical")) return "#6b7280";
  if (l.includes("western media")) return "#0891b2";
  if (l.includes("us-centric")) return "#2563eb";
  if (l.includes("financial") || l.includes("markets")) return "#7c3aed";
  if (l.includes("multi-source")) return "#0369a1";
  return "#374151";
}

function getScoreColor(score) {
  if (score >= 8.5) return { bg: "#dcfce7", border: "#16a34a", text: "#15803d" };
  if (score >= 7)   return { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" };
  if (score >= 5)   return { bg: "#fef9c3", border: "#ca8a04", text: "#a16207" };
  return             { bg: "#f3f4f6", border: "#9ca3af", text: "#6b7280" };
}

function formatDate() {
  return new Date().toLocaleDateString("en-SG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Asia/Singapore",
  });
}

function buildScoreBlock(cluster) {
  const avg = cluster.score_average || 0;
  const c = getScoreColor(avg);
  const label = avg >= 8.5 ? "🔥 Must-Read" : avg >= 7 ? "⭐ Top Story" : avg >= 5 ? "📌 Notable" : "📉 Low Signal";
  return `<table cellpadding="0" cellspacing="0" style="display:inline-table;margin-right:6px;">
    <tr>
      <td style="background:${c.bg};border:1px solid ${c.border};border-radius:5px;padding:3px 9px;">
        <span style="font-size:11px;font-weight:800;color:${c.text};"> ${label} ${avg.toFixed(1)}/10</span>
      </td>
    </tr>
  </table>`;
}

function buildSourceLinks(sources, isCluster) {
  if (!sources || sources.length === 0) return "";
  if (!isCluster) {
    const s = sources[0];
    return `<a href="${s.url}" target="_blank" style="font-size:11px;font-weight:600;color:#2563eb;text-decoration:none;">Read full article → (${s.source})</a>`;
  }
  const heading = `<p style="margin:8px 0 3px;font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;">🔗 ${sources.length} sources reporting this story:</p>`;
  const links = sources.map((s) =>
    `<p style="margin:2px 0;font-size:11px;line-height:1.4;">
      <span style="color:#9ca3af;">[${s.source}]</span>
      <a href="${s.url}" target="_blank" style="color:#2563eb;text-decoration:none;margin-left:4px;">${s.title}</a>
    </p>`
  ).join("");
  return heading + links;
}

function buildClusterCard(cluster) {
  const biasColor = getBiasColor(cluster.bias_label);
  const isCluster = cluster.type === "cluster" || (cluster.sources && cluster.sources.length > 1);

  const clusterBadge = isCluster
    ? `<span style="font-size:10px;font-weight:700;color:#0369a1;background:#dbeafe;padding:2px 7px;border-radius:20px;border:1px solid #93c5fd;margin-right:4px;">🔗 ${cluster.sources.length} Sources</span>`
    : "";

  const counterBlock = cluster.is_polarized && cluster.counter_headline
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <tr><td style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:3px;padding:7px 10px;">
          <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;">⚖️ Counter-Perspective</p>
          <p style="margin:0;font-size:12px;color:#78350f;font-style:italic;">"${cluster.counter_headline}"</p>
        </td></tr>
      </table>`
    : "";

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;margin-bottom:1px;">
  <tr><td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;">

    <!-- Score + badges row -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:7px;">
      <tr>
        <td>
          ${buildScoreBlock(cluster)}
          ${clusterBadge}
          <span style="font-size:10px;font-weight:700;color:${biasColor};background:${biasColor}15;padding:2px 7px;border-radius:20px;border:1px solid ${biasColor}30;display:inline-block;">${cluster.bias_label || "[Unclassified]"}</span>
        </td>
      </tr>
    </table>

    <!-- Headline -->
    <p style="margin:0 0 5px;font-size:14px;font-weight:800;color:#0f172a;line-height:1.35;">${cluster.headline}</p>

    <!-- Summary -->
    <p style="margin:0 0 6px;font-size:13px;color:#374151;line-height:1.6;">${cluster.summary}</p>

    <!-- Bias note -->
    ${cluster.bias_note
      ? `<p style="margin:0 0 6px;font-size:11px;color:#6b7280;font-style:italic;padding:5px 9px;background:#f8fafc;border-radius:3px;border-left:2px solid #e2e8f0;">📌 ${cluster.bias_note}</p>`
      : ""}

    <!-- Editor reason -->
    ${cluster.score_reason
      ? `<p style="margin:0 0 6px;font-size:10px;color:#9ca3af;">Editor: ${cluster.score_reason}</p>`
      : ""}

    ${counterBlock}

    <!-- Source links -->
    <div style="margin-top:8px;">${buildSourceLinks(cluster.sources, isCluster)}</div>

  </td></tr>
</table>`;
}

function buildCategorySection(label, emoji, clusters) {
  if (!clusters || clusters.length === 0) return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;">
  <tr><td style="background:#f8fafc;padding:10px 14px;border-bottom:2px solid #e2e8f0;">
    <span style="font-size:18px;padding-right:8px;">${emoji}</span>
    <span style="font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:.8px;">${label}</span>
  </td></tr>
  <tr><td style="padding:14px;font-size:13px;color:#9ca3af;font-style:italic;">No articles found for this category today.</td></tr>
</table>`;

  const cards = clusters.map((c) => buildClusterCard(c)).join("");
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
  <tr>
    <td style="background:#f8fafc;padding:10px 14px;border-bottom:2px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <span style="font-size:18px;padding-right:8px;">${emoji}</span>
          <span style="font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:.8px;">${label}</span>
        </td>
        <td align="right" style="vertical-align:middle;">
          <span style="font-size:10px;color:#94a3b8;font-weight:600;">${clusters.length} stories</span>
        </td>
      </tr></table>
    </td>
  </tr>
  <tr><td>${cards}</td></tr>
</table>`;
}

function buildEmailHTML(clusteredByCategory, pipelineStats = {}) {
  const dateStr = formatDate();
  const totalClusters = Object.values(clusteredByCategory).reduce((s, { clusters }) => s + (clusters?.length || 0), 0);
  const totalSources  = Object.values(clusteredByCategory).reduce((s, { clusters }) =>
    s + (clusters || []).reduce((x, c) => x + (c.sources?.length || 1), 0), 0);

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

  <!-- HEADER — solid dark navy, full contrast -->
  <tr><td style="background:#0f172a;border-radius:10px 10px 0 0;padding:28px 28px 22px;">
    <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#facc15;text-transform:uppercase;letter-spacing:3px;">Personalized Intelligence Brief</p>
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#f8fafc;line-height:1.2;">Your Daily Brief ☕</h1>
    <p style="margin:0 0 4px;font-size:13px;color:#e2e8f0;">${dateStr} &nbsp;·&nbsp; Singapore Time</p>
    <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;">${totalClusters} stories in today's digest &nbsp;·&nbsp; ${totalSources} sources</p>
    <p style="margin:0 0 20px;font-size:10px;color:#64748b;">
      ${pipelineStats.totalFetched || "?"} articles ingested
      &nbsp;→&nbsp; ${pipelineStats.totalAfterFilter || "?"} after date filter
      &nbsp;→&nbsp; ${pipelineStats.totalEvaluated || "?"} evaluated
      &nbsp;→&nbsp; ${pipelineStats.totalHidden || "?"} below threshold
      &nbsp;→&nbsp; <strong style="color:#facc15;">${pipelineStats.totalShared || totalClusters} shared</strong>
    </p>
    <table cellpadding="0" cellspacing="4"><tr>
      <td style="background:#1e293b;border:1px solid #334155;border-radius:20px;padding:4px 11px;font-size:11px;color:#e2e8f0;font-weight:600;">💻 Tech</td>
      <td width="4"></td>
      <td style="background:#1e293b;border:1px solid #334155;border-radius:20px;padding:4px 11px;font-size:11px;color:#e2e8f0;font-weight:600;">🤖 AI</td>
      <td width="4"></td>
      <td style="background:#1e293b;border:1px solid #334155;border-radius:20px;padding:4px 11px;font-size:11px;color:#e2e8f0;font-weight:600;">🌏 SEA</td>
      <td width="4"></td>
      <td style="background:#1e293b;border:1px solid #334155;border-radius:20px;padding:4px 11px;font-size:11px;color:#e2e8f0;font-weight:600;">🌐 US-China</td>
      <td width="4"></td>
      <td style="background:#1e293b;border:1px solid #334155;border-radius:20px;padding:4px 11px;font-size:11px;color:#e2e8f0;font-weight:600;">📈 Macro</td>
    </tr></table>
  </td></tr>

  <!-- LEGEND — dark charcoal, high contrast -->
  <tr><td style="background:#1e293b;padding:10px 28px;border-left:1px solid #334155;border-right:1px solid #334155;">
    <p style="margin:0;font-size:11px;color:#cbd5e1;line-height:1.7;">
      <strong style="color:#f8fafc;">Score key:</strong>
      🔥 Must-Read ≥8.5 &nbsp;·&nbsp; ⭐ Top Story ≥7 &nbsp;·&nbsp; 📌 Notable ≥5 &nbsp;·&nbsp; 📉 Low Signal &lt;5
      &nbsp;·&nbsp; <span style="color:#60a5fa;font-weight:700;">Blue bold</span> = verbatim phrase
      &nbsp;·&nbsp; 🔗 = multiple outlets, same event
    </p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#f1f5f9;padding:16px 12px;border:1px solid #334155;border-top:none;">
    ${categorySections}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0f172a;border-radius:0 0 10px 10px;padding:16px 28px;text-align:center;border-top:2px solid #facc15;">
    <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">NewsData.io &nbsp;·&nbsp; Gemini 2.5 Flash &nbsp;·&nbsp; Resend</p>
    <p style="margin:0;font-size:11px;color:#64748b;">chanzeming@hotmail.com &nbsp;·&nbsp; 7:00 PM SGT</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

module.exports = { buildEmailHTML };
