# Game Buddy PL

A Premier League fan web app — a single-page HTML app backed by Vercel
serverless functions, styled with a dark purple theme.

## Features

- **Today** — match cards for any day, with live scores, goal scorers,
  kickoff countdowns, and TV broadcaster pills (Sky Sports / TNT Sports /
  Amazon Prime Video).
- **Table** — full league standings with zone colour-coding (Champions
  League, Europa/Conference League, relegation).
- **Teams** — a grid of all 20 club crests. Tapping a club opens a news
  feed combining categorised Google News articles and hot posts from the
  club's subreddit, plus a transfer-heat view during transfer windows.
- **Stats** / **Favs** — placeholders for future features.
- Tapping a match opens a modal with an Overview (stat bars) and Lineups
  tab, plus a highlights thumbnail when available.

## Tech stack

- **Frontend:** a single `index.html` file — vanilla JS, no build step,
  no frameworks. Registers `sw.js` as a service worker for push
  notifications.
- **Backend:** Vercel serverless functions under `api/` that proxy ESPN's
  public soccer endpoints (adds CORS-free same-origin access and light
  caching; the frontend never calls ESPN directly).
- **Data pipelines:** scheduled GitHub Actions that scrape team news and
  TV picks into static JSON files under `data/`, served directly by
  Vercel — no database.

## File structure

```
game-buddy-pl/
├── index.html                          # Full SPA
├── package.json
├── vercel.json                         # Vercel build/route config
├── sw.js                               # Service worker (push notifications)
├── api/
│   ├── _proxy.js                       # Shared ESPN proxy factory
│   ├── scoreboard.js                   # /api/scoreboard -> ESPN scoreboard
│   ├── standings.js                    # /api/standings  -> ESPN standings
│   ├── summary.js                      # /api/summary    -> ESPN match summary
│   ├── highlights.js                   # /api/highlights -> ESPN news/highlights
│   └── team-news.js                    # /api/team-news  -> ESPN team news
├── data/
│   ├── pl-teams.json                   # 20 PL teams: slug, name, ESPN id, subreddit, Google News query
│   ├── tv-picks.json                   # TV broadcaster picks, refreshed by tv-picks-refresh.yml
│   ├── tv-announcement-batches.json    # Expected release dates for each TV-picks batch
│   ├── transfer-heat.json              # Transfer-window heat map, refreshed by team-news.yml
│   └── team-news/
│       └── {slug}.json × 20            # Per-club Google News + Reddit feed
├── scripts/
│   ├── fetch-team-news.js              # Google News RSS + Reddit scraper -> data/team-news/, data/transfer-heat.json
│   ├── scrape-tv-picks.js              # Playwright TV-picks scraper -> data/tv-picks.json
│   └── init-team-news.js               # One-off: creates empty team-news files for all clubs
└── .github/
    └── workflows/
        ├── team-news.yml               # Runs fetch-team-news.js at 06:00 + 18:00 UTC daily
        └── tv-picks-refresh.yml        # Runs scrape-tv-picks.js at 08:00 + 15:00 UTC daily
```

## How the pieces fit together

### ESPN proxy (`api/`)

The frontend never calls `site.api.espn.com` directly. Each `api/*.js`
file proxies one ESPN endpoint through `api/_proxy.js`, which forwards
query params, sets a short `Cache-Control`, and returns a `502`/upstream
status on failure instead of throwing.

| Route | ESPN endpoint | Used for |
|---|---|---|
| `/api/scoreboard?dates=YYYYMMDD` | `.../eng.1/scoreboard` | Today tab match cards |
| `/api/standings` | `.../eng.1/standings` | Table tab |
| `/api/summary?event={id}` | `.../eng.1/summary` | Match modal (stats/lineups) |
| `/api/highlights?event={id}` | `.../eng.1/news` | Match highlight thumbnail |
| `/api/team-news?espnId={id}` | `.../eng.1/news?team={id}` | (supplementary; primary team news comes from `data/team-news/`) |

### TV picks matching

`index.html` loads `/data/tv-picks.json` once at startup and matches
picks to matches by **date + normalised home/away team name**. A
matched pick renders as a coloured pill on the match card: blue for Sky
Sports, pink for TNT Sports, gold for Amazon Prime Video.

### Team news pipeline

`scripts/fetch-team-news.js` runs twice daily via GitHub Actions:

1. For each of the 20 clubs in `data/pl-teams.json`, fetches the club's
   Google News RSS feed and the top 5 "hot" posts from its subreddit.
2. Categorises each article by regex on its headline: `transfer`,
   `rumour`, `fitness`, `manager`, `match`, or `general`.
3. For each article, best-effort fetches the publisher page and pulls its
   `og:description`/`og:image` link-preview meta tags (the same technique
   used for chat-app link unfurling) so the Teams tab can show a snippet
   and thumbnail in-app, while the tap-through still opens the original
   publisher's site — no full article text is scraped or republished.
   This step degrades silently: if a publisher blocks the request or a
   Google News redirect can't be followed, `description`/`image` are
   just `null` and the frontend renders the card without them.
4. Writes the combined result to `data/team-news/{slug}.json`.
5. If a transfer window is open (summer: 10 Jun – 2 Sep, or all of
   January), also recomputes `data/transfer-heat.json` — clubs ranked by
   a heat score weighted toward `transfer`/`rumour` article volume.

### TV picks pipeline

`scripts/scrape-tv-picks.js` runs four times daily via GitHub Actions,
using Playwright/Chromium:

1. Checks `data/tv-announcement-batches.json` for any batch whose
   `expected_release_date` is within a 14-day window of "now".
2. If none are due, it just updates `last_checked` and exits — no
   scrape.
3. Otherwise it navigates the Premier League news list, finds "fixture
   changes announced" articles, parses the fixtures table on each
   article for home/away team, date, kickoff time, and broadcaster
   (Sky Sports / TNT Sports / Amazon Prime Video), and merges the result
   into `data/tv-picks.json` (deduped by date + home + away).

**Batch 1 (Matchweeks 2–5) is expected to drop Monday 13 July 2026** —
the scraper will pick it up automatically that week.

## Local development

This is a static site + serverless functions with no build step. To run
it locally with the Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

To run the data pipelines manually:

```bash
node scripts/init-team-news.js       # one-off: seed empty team-news files
node scripts/fetch-team-news.js      # fetch Google News + Reddit for all clubs
npm run scrape                       # scrape-tv-picks.js (requires Playwright browsers)
```

## Deployment

1. Import this repo into Vercel — framework preset **Other**, root
   directory `/`. Vercel redeploys automatically on every push to the
   default branch.
2. The two GitHub Actions workflows run on their own schedules once the
   repo is on GitHub — no additional setup needed beyond the default
   `GITHUB_TOKEN` permissions already declared in each workflow
   (`contents: write`, so they can commit refreshed data back to the
   repo).

## Maintenance notes

- **ESPN team IDs** in `data/pl-teams.json` are best-knowledge mappings
  for `eng.1`. If one is wrong, `/api/team-news?espnId=X` just returns
  an ESPN error, which the frontend handles silently — the Google
  News/Reddit pipeline (the primary source for the Teams tab) doesn't
  depend on these IDs at all.
- **Promoted/relegated clubs**: `data/pl-teams.json` should be updated
  each close season if the promoted clubs differ from the current
  20-team list.
