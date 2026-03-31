// src/history.js — Article deduplication across days using Supabase + pubDate filter
//
// Two-layer approach:
//   Layer 1 (fast, free): Drop articles older than 20 hours by pubDate
//   Layer 2 (persistent): Check Supabase for articles sent in the last 4 days
//
// Supabase table required (run once in Supabase SQL editor):
//
//   create table if not exists sent_articles (
//     id          bigserial primary key,
//     title_hash  text not null unique,
//     title       text,
//     sent_at     timestamptz not null default now()
//   );
//   create index on sent_articles (sent_at);

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("  ⚠️  SUPABASE_URL or SUPABASE_KEY not set — history dedup disabled");
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Stable hash: normalise title to lowercase alphanum words, join, first 80 chars
function titleHash(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

// ── Layer 1: pubDate filter ───────────────────────────────────────────────────
// Drop anything published more than 20 hours ago.
// Guardian returns ISO 8601 (e.g. "2026-03-31T14:00:00Z")
// NewsData returns "2026-03-31 14:00:00" — we handle both.
function isArticleFresh(pubDate) {
  if (!pubDate) return true; // no date → keep (can't judge)
  const parsed = new Date(pubDate.replace(" ", "T"));
  if (isNaN(parsed.getTime())) return true; // unparseable → keep
  return (Date.now() - parsed.getTime()) < TWENTY_HOURS_MS;
}

function filterByPubDate(newsByCategory) {
  console.log("\n📅 Layer 1: filtering articles older than 20 hours...");
  const filtered = {};
  let totalDropped = 0;

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    const fresh = articles.filter((a) => {
      const ok = isArticleFresh(a.pubDate);
      if (!ok) console.log(`     Stale (>20h): "${a.title.slice(0, 60)}"`);
      return ok;
    });
    totalDropped += articles.length - fresh.length;
    filtered[label] = { emoji, articles: fresh };
  }

  console.log(`     → ${totalDropped} stale article(s) dropped`);
  return filtered;
}

// ── Layer 2: Supabase history filter ─────────────────────────────────────────
async function filterByHistory(newsByCategory) {
  console.log("\n🗃️  Layer 2: checking Supabase history (last 4 days)...");
  const supabase = getSupabase();

  if (!supabase) {
    console.log("     Supabase unavailable — skipping history filter");
    return newsByCategory;
  }

  // Fetch all hashes sent in last 4 days
  const since = new Date(Date.now() - FOUR_DAYS_MS).toISOString();
  const { data, error } = await supabase
    .from("sent_articles")
    .select("title_hash")
    .gte("sent_at", since);

  if (error) {
    console.error("     Supabase read error:", error.message);
    return newsByCategory; // fail open — don't drop articles on DB error
  }

  const seenHashes = new Set((data || []).map((r) => r.title_hash));
  console.log(`     ${seenHashes.size} hashes found in last 4 days`);

  const filtered = {};
  let totalDropped = 0;

  for (const [label, { emoji, articles }] of Object.entries(newsByCategory)) {
    const fresh = articles.filter((a) => {
      const hash = titleHash(a.title);
      if (seenHashes.has(hash)) {
        console.log(`     Already sent (4d): "${a.title.slice(0, 60)}"`);
        return false;
      }
      return true;
    });
    totalDropped += articles.length - fresh.length;
    filtered[label] = { emoji, articles: fresh };
  }

  console.log(`     → ${totalDropped} previously-sent article(s) removed`);
  return filtered;
}

// ── Write sent articles to Supabase ──────────────────────────────────────────
// Called after the email is successfully sent.
// clusteredByCategory: the final clustered structure, each cluster has .sources[]
async function recordSentArticles(clusteredByCategory) {
  const supabase = getSupabase();
  if (!supabase) return;

  // Collect all article titles from all clusters
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

  // upsert — ignore conflicts on title_hash (already recorded)
  const { error } = await supabase
    .from("sent_articles")
    .upsert(rows, { onConflict: "title_hash", ignoreDuplicates: true });

  if (error) {
    console.error("  ⚠️  Supabase write error:", error.message);
  } else {
    console.log(`  ✓ Recorded ${rows.length} article(s) to Supabase history`);
  }
}

module.exports = { filterByPubDate, filterByHistory, recordSentArticles };
