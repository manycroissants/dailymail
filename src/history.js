// src/history.js — Cross-day deduplication via Supabase (4-day window)
// Date filtering is now handled at API level in fetchNews.js — not here.
//
// Supabase table (run once):
//   create table if not exists sent_articles (
//     id         bigserial primary key,
//     title_hash text not null unique,
//     title      text,
//     sent_at    timestamptz not null default now()
//   );
//   create index on sent_articles (sent_at);

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_KEY;
const FOUR_DAYS_MS  = 4 * 24 * 60 * 60 * 1000;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("  ⚠️  SUPABASE_URL/KEY not set — history dedup disabled");
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

function titleHash(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// ── Filter out articles already sent in the last 4 days ───────────────────────
async function filterByHistory(newsByCategory) {
  console.log("\n🗃️  Supabase history check (last 4 days)...");
  const supabase = getSupabase();

  if (!supabase) {
    console.log("     Skipping — Supabase not configured");
    return newsByCategory;
  }

  const since = new Date(Date.now() - FOUR_DAYS_MS).toISOString();
  const { data, error } = await supabase
    .from("sent_articles")
    .select("title_hash")
    .gte("sent_at", since);

  if (error) {
    console.error("     Supabase read error:", error.message);
    return newsByCategory; // fail open
  }

  const seenHashes = new Set((data || []).map((r) => r.title_hash));
  console.log(`     ${seenHashes.size} hashes in last 4 days`);

  const filtered  = {};
  let   dropped   = 0;

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    const fresh = articles.filter((a) => {
      const hash = titleHash(a.title);
      if (seenHashes.has(hash)) {
        console.log(`     Already sent: "${a.title.slice(0, 60)}"`);
        dropped++;
        return false;
      }
      return true;
    });
    filtered[label] = { emoji, articles: fresh };
  }

  console.log(`     → ${dropped} repeat(s) removed`);
  return filtered;
}

// ── Record sent articles to Supabase after email is dispatched ────────────────
async function recordSentArticles(clusteredByCategory) {
  const supabase = getSupabase();
  if (!supabase) return;

  const rows = [];
  for (const { clusters } of Object.values(clusteredByCategory)) {
    for (const cluster of (clusters || [])) {
      for (const src of (cluster.sources || [])) {
        if (src.title) {
          rows.push({ title_hash: titleHash(src.title), title: src.title.slice(0, 200) });
        }
      }
    }
  }

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("sent_articles")
    .upsert(rows, { onConflict: "title_hash", ignoreDuplicates: true });

  if (error) {
    console.error("  ⚠️  Supabase write error:", error.message);
  } else {
    console.log(`  ✓ Recorded ${rows.length} article(s) to history`);
  }
}

module.exports = { filterByHistory, recordSentArticles };
