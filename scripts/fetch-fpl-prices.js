// Tracks confirmed overnight FPL price changes by diffing each player's
// now_cost against yesterday's snapshot of the same field. This reports
// changes that already happened, rather than predicting tonight's changes
// in advance — FPL's own prediction algorithm isn't public, and the
// transfers-in/out heuristics hobby trackers use aren't reliable enough to
// present as fact. Runs once daily, well after FPL's usual update time.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PRICE_FILE = path.join(DATA_DIR, 'fpl-price-watch.json');

async function fetchBootstrap() {
  const url = 'https://fantasy.premierleague.com/api/bootstrap-static/';
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`FPL bootstrap-static returned ${r.status}`);
  return r.json();
}

async function main() {
  const bootstrap = await fetchBootstrap();
  const players = bootstrap.elements || [];
  const teams = bootstrap.teams || [];
  const teamNameById = {};
  teams.forEach((t) => { teamNameById[t.id] = t.name; });

  const previous = fs.existsSync(PRICE_FILE)
    ? JSON.parse(fs.readFileSync(PRICE_FILE, 'utf8'))
    : { updated: null, snapshot: {}, changes: [] };

  const prevSnapshot = previous.snapshot || {};
  const newSnapshot = {};
  const changes = [];

  for (const p of players) {
    newSnapshot[p.id] = p.now_cost;
    const prevCost = prevSnapshot[p.id];
    if (prevCost !== undefined && prevCost !== p.now_cost) {
      changes.push({
        id: p.id,
        web_name: p.web_name,
        team_name: teamNameById[p.team] || null,
        direction: p.now_cost > prevCost ? 'rise' : 'fall',
        old_price: prevCost,
        new_price: p.now_cost,
      });
    }
  }

  const now = new Date();
  const output = {
    updated: now.toISOString(),
    snapshot: newSnapshot,
    changes,
  };

  fs.writeFileSync(PRICE_FILE, JSON.stringify(output, null, 2) + '\n');

  if (previous.updated === null) {
    console.log(`First run — seeded price snapshot for ${players.length} players, no changes to report yet.`);
  } else {
    console.log(`${changes.length} price change(s) since last run (${previous.updated}).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
