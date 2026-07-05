const fs = require('fs');
const path = require('path');

const teams = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pl-teams.json'), 'utf8'));
const outDir = path.join(__dirname, '../data/team-news');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const team of teams) {
  const file = path.join(outDir, `${team.slug}.json`);
  if (fs.existsSync(file)) continue;
  const empty = { slug: team.slug, updated: null, articles: [], reddit: [] };
  fs.writeFileSync(file, JSON.stringify(empty) + '\n');
  console.log(`Created ${team.slug}.json`);
}

console.log('Done.');
