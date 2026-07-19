// Fixtures (with FDR — fixture difficulty rating) for one gameweek.
module.exports = async function(req, res) {
  const gw = parseInt(req.query.gw, 10);
  if (!gw || isNaN(gw)) return res.status(400).json({ error: 'gw required' });
  const url = `https://fantasy.premierleague.com/api/fixtures/?event=${gw}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: 'FPL upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store, s-maxage=120, stale-while-revalidate=60');
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
