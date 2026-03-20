# 📰 Daily Intelligence Brief

A self-hosted personalized news emailer. Fetches articles across 5 interest categories, summarizes them with **Google Gemini 2.5 Flash** (free), tags bias/perspective, and sends a polished HTML digest to your inbox every morning at **8:00 AM SGT**.

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **News Fetching** | NewsData.io API — 5 interest categories |
| **AI Summaries** | Gemini 2.5 Flash (free tier, no credit card needed) |
| **🔵 Blue Highlights** | 5+ word verbatim phrases from source highlighted in blue |
| **Bias Tagging** | `[Singapore-Centric]`, `[Western Media]`, `[State-Affiliated]`, etc. |
| **Counter-Perspectives** | Polarized articles get a suggested opposing headline |
| **HTML Email** | Mobile-responsive, grouped by category, direct article links |
| **Manual Trigger** | `GET /api/send-test` or `GET /api/preview` |
| **Daily Cron** | GitHub Actions at 00:00 UTC = 8:00 AM SGT |

---

## 🗂 Structure

```
daily-news-emailer/
├── index.js                      # Orchestrator
├── server.js                     # Dev server with /api/send-test
├── src/
│   ├── fetchNews.js              # NewsData.io fetcher
│   ├── summarize.js              # Gemini summarizer + bias tagger
│   ├── template.js               # HTML email builder
│   └── mailer.js                 # Resend sender
├── .github/workflows/
│   └── daily-brief.yml           # GitHub Actions cron
├── .env                          # Your keys (do NOT commit)
├── .env.example                  # Safe template
└── package.json
```

---

## 🚀 Setup (3 steps)

### Step 1 — Get your free Gemini API key

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with any Google account
3. Click **"Create API key"** — no credit card, completely free
4. Copy the key

### Step 2 — Add it to `.env`

Open `.env` and replace `your_gemini_api_key_here` with your actual key:

```
GEMINI_API_KEY=AIzaSy...your_key_here
```

Your Resend and NewsData keys are already pre-filled.

### Step 3 — Install & test locally

```bash
npm install

# Start dev server
npm start

# Preview email in browser (no email sent):
open http://localhost:3000/api/preview

# Send a real test email now:
open http://localhost:3000/api/send-test
```

---

## ⚙️ GitHub Actions Automation

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial setup"
git remote add origin https://github.com/YOUR_USERNAME/daily-news-emailer.git
git push -u origin main
```

> ⚠️ `.env` is in `.gitignore` — it will NOT be pushed. Good.

### Step 2 — Add secrets in GitHub

Go to **Settings → Secrets and variables → Actions → New repository secret**

Add these 3 secrets (copy from your `.env`):
- `NEWSDATA_API_KEY`
- `GEMINI_API_KEY`
- `RESEND_API_KEY`

### Step 3 — Done ✓

The workflow at `.github/workflows/daily-brief.yml` runs at **00:00 UTC = 8:00 AM SGT** every day.

To trigger manually: **Actions → Daily Intelligence Brief → Run workflow**

---

## 🎨 Reading Your Email

### 🔵 Blue Bold Text
Any phrase of **5+ consecutive words** copied verbatim from the original article appears in blue bold. This is the accuracy transparency layer — it shows where the AI echoed the source vs. paraphrased.

### Bias Labels
| Label | Source Signal |
|-------|--------------|
| `[Singapore-Centric]` | CNA, Straits Times, Today |
| `[Western Wire / Neutral]` | Reuters, AP, BBC |
| `[Western Media / Liberal]` | NYT, Guardian, WaPo |
| `[State-Affiliated / China]` | Xinhua, Global Times, CGTN |
| `[Financial / Markets Focus]` | Bloomberg, FT, WSJ |
| `[US-Centric]` | White House, Pentagon coverage |

### 🟡 Counter-Perspectives
When Gemini detects polarized framing, it generates a suggested opposing headline in a yellow callout. This is illustrative — not a real article.

---

## 🛠 Customization

**Add a category** — edit `src/fetchNews.js`:
```js
{ label: "Climate & Energy", emoji: "🌱", query: "climate change energy", country: null }
```

**Change send time** — edit `.github/workflows/daily-brief.yml`:
```yaml
- cron: "30 22 * * *"  # 22:30 UTC = 06:30 SGT
```

**Add more recipients** — edit `src/mailer.js`:
```js
to: ["chanzeming@hotmail.com", "another@email.com"],
```

---

## 💡 Troubleshooting

| Problem | Fix |
|---------|-----|
| `GEMINI_API_KEY invalid` | Regenerate at aistudio.google.com/app/apikey |
| `429 quota exceeded` on Gemini | Free tier: 10 RPM / 250 RPD. The 6.5s delay between calls handles this — if still hitting limits, increase the delay in `summarize.js` |
| Email not arriving | Check Resend dashboard at resend.com/emails |
| No articles returned | Check NewsData.io dashboard for quota status |
| GitHub Action not running | Check secrets are set correctly (no extra spaces) |

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `@google/generative-ai` | Gemini API (free tier) |
| `axios` | HTTP requests to NewsData.io |
| `resend` | Email delivery |
| `express` | Dev server |
| `dotenv` | Environment variable loading |
