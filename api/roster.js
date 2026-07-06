// Team squad, proxied live from ESPN. Not a scheduled scrape — since this
// reads ESPN's live roster endpoint on every cache miss, transfers and
// injuries show up as soon as ESPN's own data updates, no daily pipeline
// needed. Cached for a few hours since squads don't change minute to minute.
module.exports = async function(req, res) {
  const teamId = parseInt(req.query.teamId, 10);
  if (!teamId || isNaN(teamId)) return res.status(400).json({ error: 'teamId required' });
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/${teamId}/roster`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: 'ESPN upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store, s-maxage=10800, stale-while-revalidate=3600');
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
