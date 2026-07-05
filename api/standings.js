const proxy = require('./_proxy');
// Standings only change once matches settle, not live minute-to-minute.
module.exports = proxy('https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings', 'no-store, s-maxage=120, stale-while-revalidate=60');
