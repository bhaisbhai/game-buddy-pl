// One serverless function for every FPL endpoint, dispatched by the request
// path itself (vercel.json rewrites /api/fpl-<name> here; req.url still
// carries the original path+query, so this just reads the <name> back out
// of it -- no reliance on Vercel merging a dest query string into the
// request). Consolidated from 6 separate functions down to 1 so the project
// stays under the Hobby plan's 12-serverless-functions-per-deployment limit:
// the previous per-endpoint layout matched 14 functions via api/**/*.js
// (13 real endpoints plus api/_proxy.js, which isn't even a route), 2 over
// the limit -- every single deploy had been failing because of it.
//
// Behaviour (upstream URLs, validation, cache headers) is unchanged from
// the 6 files this replaces -- same responses, same external URLs
// (/api/fpl-bootstrap, /api/fpl-entry, etc.), just one function instead of six.

async function fetchJson(url, timeoutMs) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) { const err = new Error('FPL upstream error'); err.status = r.status; throw err; }
  return r.json();
}

const RESOURCES = {
  bootstrap: {
    cacheControl: 'no-store, s-maxage=3600, stale-while-revalidate=1800',
    timeoutMs: 10000,
    url: () => 'https://fantasy.premierleague.com/api/bootstrap-static/',
  },
  entry: {
    cacheControl: 'no-store, s-maxage=300, stale-while-revalidate=150',
    timeoutMs: 8000,
    validate: (q) => {
      if (!parseInt(q.teamId, 10)) return 'teamId required';
    },
    url: (q) => `https://fantasy.premierleague.com/api/entry/${parseInt(q.teamId, 10)}/`,
  },
  picks: {
    cacheControl: 'no-store, s-maxage=60, stale-while-revalidate=60',
    timeoutMs: 8000,
    validate: (q) => {
      if (!parseInt(q.teamId, 10)) return 'teamId required';
      if (!parseInt(q.gw, 10)) return 'gw required';
    },
    url: (q) => `https://fantasy.premierleague.com/api/entry/${parseInt(q.teamId, 10)}/event/${parseInt(q.gw, 10)}/picks/`,
  },
  live: {
    cacheControl: 'no-store, s-maxage=10, stale-while-revalidate=10',
    timeoutMs: 8000,
    validate: (q) => {
      if (!parseInt(q.gw, 10)) return 'gw required';
    },
    url: (q) => `https://fantasy.premierleague.com/api/event/${parseInt(q.gw, 10)}/live/`,
  },
  fixtures: {
    cacheControl: 'no-store, s-maxage=120, stale-while-revalidate=60',
    timeoutMs: 8000,
    validate: (q) => {
      if (!parseInt(q.gw, 10)) return 'gw required';
    },
    url: (q) => `https://fantasy.premierleague.com/api/fixtures/?event=${parseInt(q.gw, 10)}`,
  },
  league: {
    cacheControl: 'no-store, s-maxage=60, stale-while-revalidate=60',
    timeoutMs: 8000,
    validate: (q) => {
      if (!parseInt(q.leagueId, 10)) return 'leagueId required';
    },
    url: (q) => {
      const page = parseInt(q.page, 10) || 1;
      return `https://fantasy.premierleague.com/api/leagues-classic/${parseInt(q.leagueId, 10)}/standings/?page_standings=${page}`;
    },
  },
};

function resourceNameFromPath(url) {
  // url is e.g. "/api/fpl-entry?teamId=123" -- the path Vercel's rewrite
  // preserves on req.url regardless of which file actually serves it.
  const path = (url || '').split('?')[0];
  const match = path.match(/^\/api\/fpl-([a-z]+)$/);
  return match ? match[1] : null;
}

module.exports = async function (req, res) {
  const resource = RESOURCES[resourceNameFromPath(req.url)];
  if (!resource) return res.status(404).json({ error: 'unknown FPL resource' });

  if (resource.validate) {
    const validationError = resource.validate(req.query);
    if (validationError) return res.status(400).json({ error: validationError });
  }

  try {
    const data = await fetchJson(resource.url(req.query), resource.timeoutMs);
    res.setHeader('Cache-Control', resource.cacheControl);
    res.json(data);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: 'FPL upstream error' });
    res.status(502).json({ error: 'Upstream fetch failed' });
  }
};
