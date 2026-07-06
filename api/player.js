// Individual player detail, proxied live from ESPN (same freshness rationale
// as api/roster.js — no scheduled scrape needed).
module.exports = async function(req, res) {
  const playerId = parseInt(req.query.playerId, 10);
  if (!playerId || isNaN(playerId)) return res.status(400).json({ error: 'playerId required' });
  const url = `https://site.api.espn.com/apis/common/v3/sports/soccer/eng.1/athletes/${playerId}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: 'ESPN upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store, s-maxage=10800, stale-while-revalidate=3600');
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
