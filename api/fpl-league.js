// Classic mini-league standings by league ID — public, no login needed.
module.exports = async function(req, res) {
  const leagueId = parseInt(req.query.leagueId, 10);
  const page = parseInt(req.query.page, 10) || 1;
  if (!leagueId || isNaN(leagueId)) return res.status(400).json({ error: 'leagueId required' });
  const url = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/?page_standings=${page}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: 'FPL upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store, s-maxage=60, stale-while-revalidate=60');
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
