// src/template.js — Builds the mobile-responsive HTML email

function getBiasColor(label) {
  if (!label) return "#6b7280";
  const l = label.toLowerCase();
  if (l.includes("state") || l.includes("china")) return "#dc2626";
  if (l.includes("singapore")) return "#059669";
  if (l.includes("us-centric") || l.includes("western wire")) return "#2563eb";
  if (l.includes("western media") || l.includes("liberal")) return "#0891b2";
  if (l.includes("financial") || l.includes("markets")) return "#7c3aed";
  if (l.includes("right")) return "#b45309";
  if (l.includes("neutral")) return "#6b7280";
  return "#374151";
}

function formatDate() {
  return new Date().toLocaleDateString("en-SG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Singapore",
  });
}

function buildArticleCard(a) {
  const pubDate = a.pubDate
    ? new Date(a.pubDate).toLocaleDateString("en-SG", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Singapore",
      })
    : "";

  const imageBlock = a.image
    ? `<img src="${a.image}" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px 8px 0 0;display:block;" />`
    : "";

  const counterBlock =
    a.is_polarized && a.counter_headline
      ? `<div style="margin-top:12px;padding:10px 14px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;">
          <p style="margin:0 0 3px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.5px;">⚖️ Counter-Perspective</p>
          <p style="margin:0;font-size:13px;color:#78350f;font-style:italic;">"${a.counter_headline}"</p>
        </div>`
      : "";

  const biasColor = getBiasColor(a.bias_label);

  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;margin-bottom:14px;border:1px solid #e5e7eb;overflow:hidden;">
  <tr><td>
    ${imageBlock}
    <div style="padding:16px 18px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><span style="font-size:11px;font-weight:700;color:${biasColor};background:${biasColor}18;padding:3px 9px;border-radius:20px;border:1px solid ${biasColor}40;display:inline-block;">${a.bias_label || "[Unclassified]"}</span></td>
        <td align="right"><span style="font-size:11px;color:#9ca3af;">${a.source}${pubDate ? " &middot; " + pubDate : ""}</span></td>
      </tr></table>
      <h3 style="margin:10px 0 8px;font-size:15px;font-weight:700;color:#111827;line-height:1.4;">${a.title}</h3>
      <p style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.65;">${a.summary}</p>
      ${a.bias_note ? `<p style="margin:0 0 10px;font-size:12px;color:#6b7280;font-style:italic;padding:7px 11px;background:#f9fafb;border-radius:4px;border-left:2px solid #d1d5db;">📌 ${a.bias_note}</p>` : ""}
      ${counterBlock}
      <div style="margin-top:12px;">
        <a href="${a.url}" target="_blank" style="display:inline-block;font-size:12px;font-weight:600;color:#2563eb;text-decoration:none;padding:6px 14px;border:1.5px solid #2563eb;border-radius:6px;">Read Full Article →</a>
      </div>
    </div>
  </td></tr>
</table>`;
}

function buildCategorySection(label, emoji, articles) {
  if (!articles || articles.length === 0) return "";
  const cards = articles.map(buildArticleCard).join("");
  return `<!-- ${label} -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
  <tr><td style="padding-bottom:14px;border-bottom:2px solid #e5e7eb;margin-bottom:14px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:22px;padding-right:10px;">${emoji}</td>
      <td><h2 style="margin:0;font-size:16px;font-weight:800;color:#1f2937;text-transform:uppercase;letter-spacing:.6px;">${label}</h2></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding-top:14px;">${cards}</td></tr>
</table>`;
}

function buildEmailHTML(enrichedNews) {
  const dateStr = formatDate();

  const categorySections = Object.entries(enrichedNews)
    .map(([label, { emoji, articles }]) =>
      buildCategorySection(label, emoji, articles)
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Daily Intelligence Brief — ${dateStr}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
<tr><td align="center">
<table width="100%" style="max-width:620px;margin:0 auto;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e40af 100%);border-radius:12px 12px 0 0;padding:30px 28px 26px;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#a5b4fc;text-transform:uppercase;letter-spacing:2px;">Personalized Intelligence Brief</p>
    <h1 style="margin:0 0 6px;font-size:26px;font-weight:900;color:#ffffff;line-height:1.2;">Your Daily Brief ☕</h1>
    <p style="margin:0 0 18px;font-size:13px;color:#c7d2fe;">${dateStr} &nbsp;·&nbsp; Singapore Time</p>
    <table cellpadding="0" cellspacing="4"><tr>
      <td style="background:rgba(255,255,255,0.15);border-radius:20px;padding:3px 10px;font-size:11px;color:#e0e7ff;">💻 Tech</td>
      <td width="4"></td>
      <td style="background:rgba(255,255,255,0.15);border-radius:20px;padding:3px 10px;font-size:11px;color:#e0e7ff;">🤖 AI</td>
      <td width="4"></td>
      <td style="background:rgba(255,255,255,0.15);border-radius:20px;padding:3px 10px;font-size:11px;color:#e0e7ff;">🌏 SEA</td>
      <td width="4"></td>
      <td style="background:rgba(255,255,255,0.15);border-radius:20px;padding:3px 10px;font-size:11px;color:#e0e7ff;">🌐 US-China</td>
      <td width="4"></td>
      <td style="background:rgba(255,255,255,0.15);border-radius:20px;padding:3px 10px;font-size:11px;color:#e0e7ff;">📈 Macro</td>
    </tr></table>
  </td></tr>

  <!-- LEGEND -->
  <tr><td style="background:#eff6ff;padding:11px 28px;border-left:1px solid #dbeafe;border-right:1px solid #dbeafe;">
    <p style="margin:0;font-size:12px;color:#1e40af;line-height:1.5;">
      <strong>Reading guide:</strong>
      <span style="color:#2563eb;font-weight:bold;">Blue bold text</span> = phrase copied verbatim (&ge;5 words) from source article &nbsp;·&nbsp;
      🟡 Yellow box = polarized coverage with counter-perspective
    </p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#f9fafb;padding:24px 20px;border:1px solid #e5e7eb;border-top:none;">
    ${categorySections}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1f2937;border-radius:0 0 12px 12px;padding:20px 28px;text-align:center;">
    <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;">Your Personal AI News Intelligence</p>
    <p style="margin:0 0 10px;font-size:12px;color:#6b7280;">Powered by NewsData.io &nbsp;·&nbsp; Gemini 2.5 Flash &nbsp;·&nbsp; Resend</p>
    <p style="margin:0;font-size:11px;color:#4b5563;">Delivered to chanzeming@hotmail.com &nbsp;·&nbsp; 8:00 AM SGT daily</p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}

module.exports = { buildEmailHTML };
