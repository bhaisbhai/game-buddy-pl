// Scrapes premierleague.com news for "fixture changes announced" articles
// once a TV-pick batch's release window is open, and writes data/tv-picks.json.
// Run via `npm run scrape` or the tv-picks-refresh GitHub Action.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DATA_DIR = path.join(__dirname, '../data');
const BATCHES_FILE = path.join(DATA_DIR, 'tv-announcement-batches.json');
const PICKS_FILE = path.join(DATA_DIR, 'tv-picks.json');

const NEWS_LIST_URL = 'https://www.premierleague.com/news';
const RELEASE_WINDOW_DAYS = 14;

const BROADCASTER_PATTERNS = [
  { name: 'Sky Sports', pattern: /sky sports/i },
  { name: 'TNT Sports', pattern: /tnt sports/i },
  { name: 'Amazon Prime Video', pattern: /amazon prime( video)?/i },
];

function daysBetween(a, b) {
  return Math.abs((a.getTime() - b.getTime()) / 86400000);
}

function batchesInWindow(batches, now) {
  return batches.filter((batch) => {
    const releaseDate = new Date(batch.expected_release_date);
    return daysBetween(now, releaseDate) <= RELEASE_WINDOW_DAYS;
  });
}

function detectBroadcaster(text) {
  for (const b of BROADCASTER_PATTERNS) {
    if (b.pattern.test(text)) return b.name;
  }
  return null;
}

function normalizeTeamName(name) {
  return name.replace(/\s+/g, ' ').trim();
}

function makePickKey(pick) {
  return `${pick.date}|${normalizeTeamName(pick.home).toLowerCase()}|${normalizeTeamName(pick.away).toLowerCase()}`;
}

async function findFixtureChangeArticles(page) {
  await page.goto(NEWS_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors
      .map((a) => ({ href: a.href, text: (a.textContent || '').trim() }))
      .filter((a) => /fixture changes announced/i.test(a.text));
  });

  const seen = new Set();
  const unique = [];
  for (const link of links) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    unique.push(link);
  }
  return unique;
}

async function extractPicksFromArticle(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const rows = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const out = [];
    for (const table of tables) {
      const trs = Array.from(table.querySelectorAll('tr'));
      for (const tr of trs) {
        const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
        if (cells.length >= 3) out.push(cells);
      }
    }
    return out;
  });

  const picks = [];
  for (const cells of rows) {
    const rowText = cells.join(' | ');

    const teamsMatch = rowText.match(/([A-Za-z .&'-]+?)\s+v(?:s)?\.?\s+([A-Za-z .&'-]+)/i);
    if (!teamsMatch) continue;

    const dateMatch = rowText.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    const kickoffMatch = rowText.match(/(\d{1,2}:\d{2})/);
    const broadcaster = detectBroadcaster(rowText);

    if (!broadcaster) continue;

    picks.push({
      home: normalizeTeamName(teamsMatch[1]),
      away: normalizeTeamName(teamsMatch[2]),
      date: dateMatch ? dateMatch[1] : null,
      kickoff: kickoffMatch ? kickoffMatch[1] : null,
      broadcaster,
    });
  }
  return picks;
}

function dedupePicks(existing, incoming) {
  const map = new Map();
  for (const pick of existing) map.set(makePickKey(pick), pick);
  for (const pick of incoming) map.set(makePickKey(pick), pick);
  return Array.from(map.values());
}

async function main() {
  if (!fs.existsSync(BATCHES_FILE)) {
    console.log('No tv-announcement-batches.json found — nothing to do.');
    return;
  }

  const batches = JSON.parse(fs.readFileSync(BATCHES_FILE, 'utf8'));
  const now = new Date();
  const due = batchesInWindow(batches, now);

  const existingData = fs.existsSync(PICKS_FILE)
    ? JSON.parse(fs.readFileSync(PICKS_FILE, 'utf8'))
    : { season: '2026/27', last_updated: null, last_checked: null, picks: [] };

  existingData.last_checked = now.toISOString();

  if (due.length === 0) {
    console.log('No batches within the release window — skipping scrape.');
    fs.writeFileSync(PICKS_FILE, JSON.stringify(existingData, null, 2) + '\n');
    return;
  }

  console.log(`Batches in window: ${due.map((b) => b.batch_number).join(', ')}`);

  const browser = await chromium.launch();
  let newPicks = [];

  try {
    const page = await browser.newPage();
    const articles = await findFixtureChangeArticles(page);
    console.log(`Found ${articles.length} candidate article(s).`);

    for (const article of articles) {
      const picks = await extractPicksFromArticle(page, article.href);
      newPicks = newPicks.concat(picks);
    }
  } finally {
    await browser.close();
  }

  const merged = dedupePicks(existingData.picks || [], newPicks);

  const output = {
    season: existingData.season || '2026/27',
    last_updated: newPicks.length > 0 ? now.toISOString() : existingData.last_updated,
    last_checked: now.toISOString(),
    picks: merged,
  };

  fs.writeFileSync(PICKS_FILE, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote ${merged.length} total picks (${newPicks.length} new/updated this run).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
