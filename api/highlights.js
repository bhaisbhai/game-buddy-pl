const proxy = require('./_proxy');
// News/highlights don't change on a live cadence.
module.exports = proxy('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news', 'no-store, s-maxage=300, stale-while-revalidate=150');
