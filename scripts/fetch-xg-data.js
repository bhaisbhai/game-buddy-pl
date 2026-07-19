// Scrapes understat.com's league players page for season-aggregate xG/xA
// (expected goals/assists), matched to FPL element ids, and writes
// data/fpl-xg.json. Understat has no public API -- every hobby xG tool
// (including the Python `understat` package) gets data by fetching the page
// and parsing a JSON blob understat embeds in a <script> tag, so that's what
// this does. No API key, no account, no cost -- same "scheduled Action,
// static JSON" shape as fetch-team-news.js and scrape-tv-picks.js.
//
// Scope: season-aggregate xG/xA/npxG per player, not shot-by-shot maps.
// Shot maps would need a separate per-player scrape (600+ requests instead
// of one) and aren't needed for the Planner's use case.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const XG_FILE = path.join(DATA_DIR, 'fpl-xg.json');
const TEAMS_FILE = path.join(DATA_DIR, 'pl-teams.json');

// Minimum matched players below which the scrape is considered broken
// rather than just fuzzy-match misses -- see the fail-loud check in main().
const MIN_EXPECTED_MATCHES = 200;

// Understat's team_title strings vs pl-teams.json's `name` field.
// Keys must be the already-normalized form (normalizeName strips
// punctuation before this table is consulted, so "Nott'm Forest" arrives
// as "nottm forest", not "nott'm forest").
const UNDERSTAT_TEAM_ALIASES = {
  'tottenham': 'tottenham',
  'newcastle united': 'newcastle',
  'nottm forest': 'nottm-forest',
  'nottingham forest': 'nottm-forest',
  'leicester': 'leicester',
  'wolverhampton wanderers': 'wolves',
  'ipswich': 'ipswich',
  'west ham': 'west-ham',
  'west bromwich albion': null,
};

function currentUnderstatSeason(date) {
  const year = date.getFullYear();
  const augustFirst = new Date(Date.UTC(year, 7, 1));
  return String(date >= augustFirst ? year : year - 1);
}

function normalizeName(name) {
  return (name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Understat embeds page data as `var X = JSON.parse('...')`, with the
// string hex-escaped (\xHH) rather than using normal JSON string escapes.
function extractJsonVar(html, varName) {
  const regex = new RegExp("var\\s+" + varName + "\\s*=\\s*JSON\\.parse\\('(.+?)'\\);");
  const match = html.match(regex);
  if (!match) return null;
  const decoded = match[1].replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  try {
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

async function fetchUnderstatPlayers(season) {
  const url = `https://understat.com/league/EPL/${season}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Understat returned ${r.status}`);
  const html = await r.text();
  const players = extractJsonVar(html, 'playersData');
  if (!players) throw new Error('Could not find/parse playersData on the Understat league page -- page structure likely changed.');
  return players;
}

async function fetchFplElements() {
  const r = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
    headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`FPL bootstrap-static returned ${r.status}`);
  const data = await r.json();
  return { elements: data.elements || [], teams: data.teams || [] };
}

function understatTeamToSlug(teamTitle, plTeams) {
  const norm = normalizeName(teamTitle);
  const alias = UNDERSTAT_TEAM_ALIASES[norm];
  if (alias === null) return null; // known non-PL team (e.g. relegated club from a prior season's data)
  if (alias) return alias;
  const match = plTeams.find((t) => normalizeName(t.name) === norm);
  return match ? match.slug : null;
}

function buildFplNameIndex(elements, teams, plTeams) {
  // Keyed by "normalized full name|team slug" to disambiguate common surnames.
  const index = {};
  const fplTeamSlugById = {};
  teams.forEach((t) => {
    const norm = normalizeName(t.name);
    const match = plTeams.find((p) => normalizeName(p.name) === norm || normalizeName(p.short) === norm);
    if (match) fplTeamSlugById[t.id] = match.slug;
  });
  elements.forEach((el) => {
    const slug = fplTeamSlugById[el.team];
    if (!slug) return;
    const fullName = normalizeName(`${el.first_name} ${el.second_name}`);
    index[`${fullName}|${slug}`] = el.id;
    // Also index by web_name alone + team, since Understat's player_name is
    // sometimes just the commonly-used name rather than the full legal name.
    index[`${normalizeName(el.web_name)}|${slug}`] = el.id;
  });
  return index;
}

async function main() {
  const now = new Date();
  const season = currentUnderstatSeason(now);
  const plTeams = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));

  const [understatPlayers, fpl] = await Promise.all([
    fetchUnderstatPlayers(season),
    fetchFplElements(),
  ]);

  const nameIndex = buildFplNameIndex(fpl.elements, fpl.teams, plTeams);

  const players = {};
  let matched = 0;
  for (const up of understatPlayers) {
    const slug = understatTeamToSlug(up.team_title, plTeams);
    if (!slug) continue;
    const key = `${normalizeName(up.player_name)}|${slug}`;
    const elementId = nameIndex[key];
    if (!elementId) continue;

    players[elementId] = {
      games: parseInt(up.games, 10) || 0,
      goals: parseInt(up.goals, 10) || 0,
      xG: parseFloat(up.xG) || 0,
      assists: parseInt(up.assists, 10) || 0,
      xA: parseFloat(up.xA) || 0,
      shots: parseInt(up.shots, 10) || 0,
      key_passes: parseInt(up.key_passes, 10) || 0,
      npg: parseInt(up.npg, 10) || 0,
      npxG: parseFloat(up.npxG) || 0,
    };
    matched++;
  }

  if (matched < MIN_EXPECTED_MATCHES) {
    console.error(`Only matched ${matched} players (expected at least ${MIN_EXPECTED_MATCHES}) -- Understat's page structure or field names likely changed.`);
    process.exitCode = 1;
    // Still fall through and write nothing, so a broken scrape doesn't
    // overwrite a previously-good data/fpl-xg.json.
    return;
  }

  const output = {
    updated: now.toISOString(),
    season,
    players,
  };
  fs.writeFileSync(XG_FILE, JSON.stringify(output, null, 2) + '\n');
  console.log(`Matched ${matched}/${understatPlayers.length} Understat players to FPL ids for the ${season} season.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
