# Game Buddy PL

A Premier League fan web app — a single-page HTML app backed by Vercel
serverless functions, styled with a near-black background, neon-green
accent, and monospace tabular numbers on scores/stats/standings, with
semantic win/draw/loss colour coding throughout.

## Features

- **Today** — match cards for any day, with live scores, goal scorers,
  kickoff countdowns, and TV broadcaster pills (Sky Sports / TNT Sports /
  Amazon Prime Video).
- **Table** — full league standings with zone colour-coding (Champions
  League, Europa/Conference League, relegation).
- **Teams** — a grid of all 20 club crests. Tapping a club opens its page
  with **News** and **Squad** sub-tabs: News combines categorised Google
  News articles and hot posts from the club's subreddit (plus a
  transfer-heat view during transfer windows); Squad lists the full
  current roster grouped by position, fetched live from ESPN so
  transfers/injuries show up without any scheduled refresh.
- **Fantasy** — a read-only FPL companion. Enter your public FPL Team ID
  (no login) to see your live gameweek score, squad, and overall rank.
  See "Fantasy tab" below for the full feature set and what it deliberately
  doesn't do.
- **Favs** — favourite any team from its page (☆ button next to the
  team name) and it shows up here as a shortcut grid. Favourites persist
  in `localStorage`, no account/backend needed. Favourited teams' matches
  are pinned above the rest on the Today tab, and favouriting a team
  prompts for browser notification permission — goal notifications name
  the scorer and only fire for favourited teams in live matches, while
  the app is open (see "In-app goal notifications" below for why this
  isn't full background push).
- Team names are clickable everywhere they appear (match cards, standings
  rows, squad cards) and jump straight to that team's page. Player names
  are clickable everywhere they appear (goal scorers, starting lineups,
  squad list) and open a player modal with position, age, nationality,
  and injury status.
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
│   ├── team-news.js                    # /api/team-news  -> ESPN team news
│   ├── roster.js                       # /api/roster     -> ESPN team roster
│   ├── player.js                       # /api/player     -> ESPN athlete detail
│   ├── fpl-bootstrap.js                # /api/fpl-bootstrap -> FPL bootstrap-static
│   ├── fpl-entry.js                    # /api/fpl-entry     -> FPL manager summary
│   ├── fpl-picks.js                    # /api/fpl-picks     -> FPL gameweek squad
│   ├── fpl-live.js                     # /api/fpl-live      -> FPL live points
│   ├── fpl-fixtures.js                 # /api/fpl-fixtures  -> FPL fixtures
│   └── fpl-league.js                   # /api/fpl-league    -> FPL mini-league standings
├── data/
│   ├── pl-teams.json                   # 20 PL teams: slug, name, ESPN id, subreddit, Google News query
│   ├── tv-picks.json                   # TV broadcaster picks, refreshed by tv-picks-refresh.yml
│   ├── tv-announcement-batches.json    # Expected release dates for each TV-picks batch
│   ├── transfer-heat.json              # Transfer-window heat map, refreshed by team-news.yml
│   ├── fpl-price-watch.json            # Confirmed FPL price changes, refreshed by fpl-prices.yml
│   └── team-news/
│       └── {slug}.json × 20            # Per-club Google News + Reddit feed
├── scripts/
│   ├── fetch-team-news.js              # Google News RSS + Reddit scraper -> data/team-news/, data/transfer-heat.json
│   ├── scrape-tv-picks.js              # Playwright TV-picks scraper -> data/tv-picks.json
│   ├── init-team-news.js               # One-off: creates empty team-news files for all clubs
│   └── fetch-fpl-prices.js             # Diffs FPL prices day over day -> data/fpl-price-watch.json
└── .github/
    └── workflows/
        ├── team-news.yml               # Runs fetch-team-news.js at 06:00 + 18:00 UTC daily
        ├── tv-picks-refresh.yml        # Runs scrape-tv-picks.js at 08:00 + 15:00 UTC daily
        └── fpl-prices.yml              # Runs fetch-fpl-prices.js at 03:00 UTC daily
```

## How the pieces fit together

### ESPN proxy (`api/`)

The frontend never calls `site.api.espn.com` directly. Each `api/*.js`
file proxies one ESPN endpoint through `api/_proxy.js`, which forwards
query params, sets a short `Cache-Control`, and returns a `502`/upstream
status on failure instead of throwing. `roster.js` and `player.js` don't
use the shared `_proxy.js` factory since the team/player id is part of
the ESPN URL path rather than a query string, but follow the same
pattern — including reading live from ESPN on every cache miss rather
than from a scheduled scrape, so squad changes/transfers/injuries show
up automatically as soon as ESPN's own data updates.

| Route | ESPN endpoint | Cache-Control | Used for |
|---|---|---|---|
| `/api/scoreboard?dates=YYYYMMDD` | `.../eng.1/scoreboard` | `s-maxage=10, swr=10` | Today tab match cards (live scores) |
| `/api/standings` | `.../eng.1/standings` | `s-maxage=120, swr=60` | Table tab (changes far less often than live scores) |
| `/api/summary?event={id}` | `.../eng.1/summary` | `s-maxage=10, swr=10` | Match modal (stats/lineups) |
| `/api/highlights?event={id}` | `.../eng.1/news` | `s-maxage=300, swr=150` | Match highlight thumbnail |
| `/api/team-news?espnId={id}` | `.../eng.1/news?team={id}` | `s-maxage=600, swr=600` | (supplementary; primary team news comes from `data/team-news/`) |
| `/api/roster?teamId={espn_id}` | `.../eng.1/teams/{id}/roster` | `s-maxage=10800, swr=3600` | Team page Squad tab |
| `/api/player?playerId={id}` | `.../eng.1/athletes/{id}` | `s-maxage=10800, swr=3600` | Player modal |

### Fantasy tab

A set of `api/fpl-*.js` proxies hit FPL's public (unauthenticated,
undocumented but stable) API directly — same live-proxy pattern as
`roster.js`/`player.js`, no scheduled scrape:

| Route | FPL endpoint | Cache-Control | Used for |
|---|---|---|---|
| `/api/fpl-bootstrap` | `bootstrap-static/` | `s-maxage=3600, swr=1800` | Master data: every player, team, and gameweek |
| `/api/fpl-entry?teamId={id}` | `entry/{id}/` | `s-maxage=300, swr=150` | Manager summary (name, overall points/rank) |
| `/api/fpl-picks?teamId={id}&gw={gw}` | `entry/{id}/event/{gw}/picks/` | `s-maxage=60, swr=60` | Active squad for a gameweek |
| `/api/fpl-live?gw={gw}` | `event/{gw}/live/` | `s-maxage=10, swr=10` | Live per-player points ("second screen") |
| `/api/fpl-fixtures?gw={gw}` | `fixtures/?event={gw}` | `s-maxage=120, swr=60` | Fixture difficulty for a gameweek |
| `/api/fpl-league?leagueId={id}` | `leagues-classic/{id}/standings/` | `s-maxage=60, swr=60` | Mini-league standings |

**This is a read-only planning/analysis companion, not a remote control
for your real FPL team.** Connecting is just entering your public numeric
Team ID (found in the URL when you open your team on the official
site/app) — stored in `localStorage`, exactly like Favs. FPL's *write*
endpoints (making transfers, setting your captain, playing a chip) all
require an authenticated session with FPL's login cookies, which this
app deliberately never touches — so every feature here is view/simulate
only; actually making changes still happens in the official app.

Three PRD requirements were deliberately scoped down rather than built
as originally specified, because the literal spec didn't fit a
zero-database, static-JSON-and-serverless-functions project:

- **Live Effective Ownership (EO)** wanted true EO broken down by rank
  tier, which real EO tools compute by sampling picks across thousands
  of managers — a heavy scraping/compute problem on its own. Built
  instead: `bootstrap-static`'s `selected_by_percent` per player, which
  is real overall-ownership data with zero extra scraping, just not
  broken down by rank band.
- **Aggregated pre-deadline lineup leaks** wanted scraping many
  journalists'/fan accounts' social posts — a much bigger and flakier
  scraping surface than anything else in this repo. Built instead: a
  squad-news digest reusing the existing team-news pipeline's `fitness`/
  `manager`-categorised articles, filtered to the clubs in your squad.
- **Multi-gameweek auto-optimizing transfer solver** wanted a
  combinatorial search across future fixtures and hundreds of players —
  a serious standalone project. Built instead: manual scenario
  comparison — build 1–2 hypothetical squads and see the point/price/-4
  hit math side by side, no auto-optimizer.

### In-app goal notifications

`notifyFavoriteGoals()` runs on every scoreboard fetch (every 15s while a
match is live). For each goal in a **live** match belonging to a
favourited team, it fires a browser `Notification` naming the scorer and
minute, deduped by `eventId|teamId|athleteId|clockValue` so the same goal
never notifies twice across polls.

This is deliberately **not** background push — there's no server-side
subscription store, no VAPID keys, and no scheduled poller independent of
an open tab. It only fires while the app is open (foreground or recently
backgrounded), the same way the existing 15s live-refresh already only
runs then. True background push (notifications arriving with the app
fully closed) would need a persistent store for subscriptions
(e.g. Vercel KV or Upstash Redis) plus a standalone poller — a real
infrastructure step up from the static-JSON-and-serverless-functions
architecture everything else here uses, so it was deferred rather than
built speculatively.

The very first scoreboard load of a session seeds the "already seen"
goal set silently (no notifications), so pre-existing goals in an
already-live match don't all fire at once when the app is opened
mid-match — only goals discovered on the second poll onward are treated
as new.

### TV picks matching

`index.html` loads `/data/tv-picks.json` once at startup and matches
picks to matches primarily by **ESPN team id** (`home_espn_id`/
`away_espn_id`, resolved during scraping via `pl-teams.json`), falling
back to normalised home/away team name matching if a scraped team name
couldn't be resolved to an id. Anchoring on id avoids the false
negatives that plain name matching is prone to across data providers
(e.g. "Spurs" vs "Tottenham Hotspur"). A matched pick renders as a
coloured pill on the match card: blue for Sky Sports, pink for TNT
Sports, gold for Amazon Prime Video.

### Team news pipeline

`scripts/fetch-team-news.js` runs twice daily via GitHub Actions:

1. For each of the 20 clubs in `data/pl-teams.json`, fetches the club's
   Google News RSS feed and the top 5 "hot" posts from its subreddit.
2. Categorises each article by regex on its headline: `transfer`,
   `rumour`, `fitness`, `manager`, `match`, or `general`.
3. Writes the result to `data/team-news/{slug}.json`. Only the RSS feed's
   own title/source/link/date are used — no per-article thumbnail or
   snippet. An earlier version tried enriching each article with its
   publisher page's `og:description`/`og:image` meta tags, but Google
   News RSS links route through a client-side redirect that a plain
   server-side `fetch()` can't follow, so every article ended up with
   Google's own generic aggregator boilerplate instead of real
   per-article content — worse than showing nothing, so it was removed.
4. If a transfer window is open (summer: 10 Jun – 2 Sep, or all of
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
   (Sky Sports / TNT Sports / Amazon Prime Video).
4. Resolves each scraped team name to its `pl-teams.json` entry (with a
   small alias table for common short forms like "Spurs"/"Man Utd") and
   stores `home_espn_id`/`away_espn_id` alongside the raw names, then
   merges the result into `data/tv-picks.json` (deduped by id when
   resolved, otherwise by date + normalised name as a fallback).
5. If candidate "fixture changes announced" articles were found but
   zero picks could be parsed out of them, the run **fails loudly**
   (non-zero exit) instead of silently doing nothing — this surfaces a
   broken selector as a red X in the Actions tab rather than a quiet
   no-op. A run with genuinely no candidate articles (nothing announced
   yet within the window) is not treated as a failure. Either way, a
   failed run never overwrites existing `tv-picks.json` data — the
   merge is additive, so an empty scrape just leaves prior picks as-is.

**Batch 1 (Matchweeks 2–5) is expected to drop Monday 13 July 2026** —
the scraper will pick it up automatically that week.

### FPL price watch pipeline

`scripts/fetch-fpl-prices.js` runs once daily (03:00 UTC, safely after
FPL's usual overnight price-update window):

1. Fetches `bootstrap-static` and reads every player's `now_cost`.
2. Diffs it against yesterday's stored snapshot in
   `data/fpl-price-watch.json`. Any player whose price differs is a
   **confirmed** change (rise or fall) — this deliberately doesn't try to
   *predict* tonight's changes in advance the way some hobby trackers
   heuristically do from transfer volume, since FPL's real prediction
   algorithm isn't public and a wrong guess is worse than no guess.
3. Writes the new snapshot (for tomorrow's diff) plus the list of
   changes found this run.

The Fantasy tab's Price Watch view reads this file directly, and if a
connected Team ID's squad contains a player who moved, highlights that
card and fires an in-app notification (same mechanism as goal
notifications) — deduped against the data's own `updated` timestamp in
`localStorage` so reopening the tab doesn't re-notify for the same
update.

### Fantasy squad news digest

The Squad News sub-tab resolves each player in your connected squad to
their real-world club, then filters that club's existing
`data/team-news/{slug}.json` articles down to the `fitness`/`manager`
categories — no new scraper needed, this reuses the team-news pipeline
that already exists for the Teams tab.

The one non-obvious part is matching FPL's own team ids to this repo's
`pl-teams.json` slugs — they're two unrelated numbering schemes (FPL's
`bootstrap-static` teams and ESPN's `espn_id` don't correspond at all).
Both sources use the same standard 3-letter PL club codes though, so
`fplTeamToSlug()` anchors on FPL's `short_name` against `pl-teams.json`'s
`short` field — the same "match on a stable code, not a fuzzy name"
lesson learned from ID-anchoring the TV-picks scraper.

### Fantasy transfer planner

The Planner sub-tab is a manual scenario comparator, not an
auto-optimizer — it doesn't search transfer combinations for you. You
pick up to 2 swaps (a player out from your real squad, a player in from
all ~600+ FPL players via a `<datalist>` search, no framework needed),
enter how many free transfers you have (FPL's public API has no way to
read this without an authenticated session, so it's a manual input),
and it shows:

- **Projected points**: the sum of FPL's own `ep_next` field (their
  official "expected points, next fixture" figure) for the current
  squad vs. the scenario squad. This is FPL's number, not an
  independently modelled prediction — worth knowing since it's a
  simpler metric than true multi-gameweek xPts.
- **Squad value** before/after.
- **The -4 hit**: `max(0, transfers - free transfers) × 4`.
- **Net**: the scenario's point gain minus the hit.

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
node scripts/fetch-fpl-prices.js     # diff FPL prices against yesterday's snapshot
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
- **`SEASON_START_DATE`** in `index.html` is the 2026/27 opening weekend
  (`2026-08-21`), used only to pick the Today tab's default date
  *before* the real season starts — while
  today's real date is earlier than this, the app shows this date's
  fixtures instead of an empty "no matches" screen, purely so there's
  real data to look at while developing in the off-season. Once the
  real date passes, the app reverts to genuinely using today's date.
  Update the constant if the actual opening weekend turns out to be
  different.
