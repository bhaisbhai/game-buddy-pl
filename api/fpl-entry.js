// A manager's season summary (overall rank, total points, team name) by
// their public FPL Team ID — no login needed, this endpoint is public.
module.exports = async function(req, res) {
  const teamId = parseInt(req.query.teamId, 10);
  if (!teamId || isNaN(teamId)) return res.status(400).json({ error: 'teamId required' });
  const url = `https://fantasy.premierleague.com/api/entry/${teamId}/`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: 'FPL upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store, s-maxage=300, stale-while-revalidate=150');
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
