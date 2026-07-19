// Live per-player points/bonus for a gameweek's matches — the "second
// screen" data source, refreshed on the same tight cadence as
// api/scoreboard.js since this is the genuinely live-updating FPL endpoint.
module.exports = async function(req, res) {
  const gw = parseInt(req.query.gw, 10);
  if (!gw || isNaN(gw)) return res.status(400).json({ error: 'gw required' });
  const url = `https://fantasy.premierleague.com/api/event/${gw}/live/`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: 'FPL upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store, s-maxage=10, stale-while-revalidate=10');
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
