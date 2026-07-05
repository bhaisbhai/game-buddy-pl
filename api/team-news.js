module.exports = async function(req, res) {
  const espnId = parseInt(req.query.espnId, 10);
  const limit  = Math.min(parseInt(req.query.limit, 10) || 8, 20);
  if (!espnId || isNaN(espnId)) return res.status(400).json({ error: 'espnId required' });
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?team=${espnId}&limit=${limit}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: 'ESPN upstream error' });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=600');
    res.json(data);
  } catch(e) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
