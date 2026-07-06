// Fetches Google News RSS + Reddit hot posts for every PL club and writes
// data/team-news/{slug}.json. Also refreshes data/transfer-heat.json while a
// transfer window is open. Node 22, no external deps (native fetch, regex XML parsing).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const NEWS_DIR = path.join(DATA_DIR, 'team-news');
const TEAMS_FILE = path.join(DATA_DIR, 'pl-teams.json');
const HEAT_FILE = path.join(DATA_DIR, 'transfer-heat.json');

const ARTICLE_LIMIT = 15;
const REDDIT_LIMIT = 5;

const CATEGORY_RULES = [
  { category: 'transfer', pattern: /\b(transfer|sign(ing|s)?|move to|deal agreed|medical|£\d+m|bid for|swoop)\b/i },
  { category: 'rumour', pattern: /\b(linked|rumou?r|reportedly|target|eyeing|interest(ed)? in|monitoring)\b/i },
  { category: 'fitness', pattern: /\b(injur(y|ed|ies)|fitness|surgery|scan|sidelined|return date|out for|doubt)\b/i },
  { category: 'manager', pattern: /\b(manager|head coach|sack(ed)?|appoint(ed|ment)?|press conference|tactics)\b/i },
  { category: 'match', pattern: /\b(vs\.?|match|fixture|kick[- ]?off|preview|report|goal|win|defeat|draw)\b/i },
];

function categorize(title) {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) return rule.category;
  }
  return 'general';
}

function stripCdata(str) {
  if (!str) return '';
  return str.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeEntities(stripCdata(match[1])) : '';
}

function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const rawTitle = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const source = sourceMatch ? decodeEntities(stripCdata(sourceMatch[1])) : '';
    const title = rawTitle.replace(/\s*-\s*[^-]+$/, '').trim() || rawTitle;
    if (!title || !link) continue;
    items.push({
      title,
      source,
      link,
      pubDate,
      category: categorize(rawTitle),
    });
  }
  return items;
}

async function fetchGoogleNews(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseRssItems(xml).slice(0, ARTICLE_LIMIT);
  } catch (e) {
    console.error(`Google News fetch failed for "${query}": ${e.message}`);
    return [];
  }
}

async function fetchReddit(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${REDDIT_LIMIT}&t=day`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'game-buddy-pl/1.0' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const json = await r.json();
    const posts = (json.data && json.data.children) || [];
    return posts
      .map((p) => p.data)
      .filter((d) => d && !d.stickied)
      .map((d) => ({
        title: d.title,
        permalink: `https://www.reddit.com${d.permalink}`,
        score: d.score,
        num_comments: d.num_comments,
        created_utc: d.created_utc,
      }));
  } catch (e) {
    console.error(`Reddit fetch failed for r/${subreddit}: ${e.message}`);
    return [];
  }
}

function isTransferWindowOpen(date) {
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const inSummerWindow = md >= '06-10' && md <= '09-02';
  const inJanuaryWindow = date.getMonth() === 0;
  return inSummerWindow || inJanuaryWindow;
}

function computeHeatScore(articles) {
  const transferCount = articles.filter((a) => a.category === 'transfer').length;
  const rumourCount = articles.filter((a) => a.category === 'rumour').length;
  return transferCount * 2 + rumourCount;
}

async function main() {
  const teams = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
  if (!fs.existsSync(NEWS_DIR)) fs.mkdirSync(NEWS_DIR, { recursive: true });

  const now = new Date();
  const heatClubs = [];

  for (const team of teams) {
    console.log(`Fetching news for ${team.name}...`);
    const [articles, reddit] = await Promise.all([
      fetchGoogleNews(team.google_query),
      fetchReddit(team.reddit),
    ]);

    const payload = {
      slug: team.slug,
      updated: now.toISOString(),
      articles,
      reddit,
    };
    fs.writeFileSync(path.join(NEWS_DIR, `${team.slug}.json`), JSON.stringify(payload, null, 2) + '\n');

    heatClubs.push({
      slug: team.slug,
      name: team.name,
      heat: computeHeatScore(articles),
    });
  }

  if (isTransferWindowOpen(now)) {
    const window = now.getMonth() === 0 ? 'winter' : 'summer';
    const heatData = {
      window,
      updated: now.toISOString(),
      clubs: heatClubs.sort((a, b) => b.heat - a.heat),
    };
    fs.writeFileSync(HEAT_FILE, JSON.stringify(heatData, null, 2) + '\n');
    console.log('Transfer heat map updated.');
  } else {
    console.log('Transfer window closed — skipping heat map update.');
  }

  console.log('All team news fetched.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
