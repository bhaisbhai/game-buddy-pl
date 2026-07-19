// A manager's active squad for a given gameweek: the 15 picks, captain/
// vice-captain, bench order, and any chip played. Read-only — this app
// never writes transfers back to FPL (that needs an authenticated session,
// which the credential-free Team ID approach deliberately avoids).
module.exports = async function(req, res) {
  const teamId = parseInt(req.query.teamId, 10);
  const gw = parseInt(req.query.gw, 10);
  if (!teamId || isNaN(teamId)) return res.status(400).json({ error: 'teamId required' });
  if (!gw || isNaN(gw)) return res.status(400).json({ error: 'gw required' });
  const url = `https://fantasy.premierleague.com/api/entry/${teamId}/event/${gw}/picks/`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: 'FPL upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store, s-maxage=60, stale-while-revalidate=60');
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
