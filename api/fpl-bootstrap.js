// FPL's master data dump: every player ("element") with price/points/
// ownership/transfer deltas, every real team, and gameweek ("event") state
// including which one is currently active. This is the single biggest FPL
// payload (a few MB) but changes at most a few times a day, so it's cached
// for an hour — no scheduled scrape needed, same live-proxy rationale as
// api/roster.js.
module.exports = async function(req, res) {
  const url = 'https://fantasy.premierleague.com/api/bootstrap-static/';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return res.status(r.status).json({ error: 'FPL upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-store, s-maxage=3600, stale-while-revalidate=1800');
    res.json(data);
  } catch (e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
