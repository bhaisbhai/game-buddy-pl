// Boots the single shipped build (wheelie-fun.html) in headless Chrome. On a CrazyGames address
// (a stand-in https://games.crazygames.com/ URL, served from this folder) it runs with
// window.CrazyGames mocked -- the real SDK needs their CDN and a live portal session, so it's
// faithfully stubbed instead -- and checks the save-data bridge build_crazygames.py injects
// actually round-trips progress through it. On any other address it must never load the SDK.
// Builds a fresh copy from current source first (wheelie-fun-standalone.html and wheelie-fun.html
// are gitignored artifacts, so this never depends on a stale leftover from a previous manual build).
//
// Uses Playwright (pre-installed in this environment) rather than this project's usual raw
// DevTools-protocol driver (see game_runtime.test.mjs), because it needs to inject the SDK mock
// before navigation and intercept the real SDK's network request -- both are a few lines with
// Playwright's page.addInitScript/page.route. Skips itself, same as that test, if no browser is
// available.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';

// Playwright lives in a shared tools location, not this project's own node_modules.
const PLAYWRIGHT_PATHS = ['playwright', pathToFileURL('/opt/node-tools/node_modules/playwright/index.js').href];
const PW_CHROMIUM = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';

let chromium, browser, server, SITE_URL, skipReason = null;
// The adapter only switches CrazyGames on when the page is on a CrazyGames host, so the tests load
// it from one; newGameContext() answers that host from this folder (nothing goes over the network).
const CG_URL = 'https://games.crazygames.com/wheelie-fun/wheelie-fun.html';
const SDK_HOST = 'https://sdk.crazygames.com/**';

async function newGameContext() {
  const context = await browser.newContext();
  await context.route('https://games.crazygames.com/**', (route) => {
    const file = path.join(ROOT, path.basename(new URL(route.request().url()).pathname));
    route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(file) });
  });
  return context;
}

// Served over http://, not file:// -- the real CrazyGames portal always serves the game over
// https, and the save bridge itself treats location.protocol === 'file:' as "not a real CrazyGames
// environment" (so a player's locally-downloaded copy never blocks on a fake cloud session). A
// file:// test URL would silently hit that same guard and disable the mocked SDK entirely.
function serveRoot() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const filePath = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath);
        const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      });
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

before(async () => {
  for (const p of PLAYWRIGHT_PATHS) {
    try { const mod = await import(p); chromium = mod.chromium || mod.default?.chromium; if (chromium) break; } catch { /* try the next location */ }
  }
  if (!chromium) {
    skipReason = 'playwright is not installed';
    return;
  }
  const py = process.platform === 'win32' ? 'py' : 'python3';
  try {
    execFileSync(py, ['build_standalone.py'], { cwd: ROOT, stdio: 'ignore' });
    execFileSync(py, ['build_crazygames.py'], { cwd: ROOT, stdio: 'ignore' });
  } catch (e) {
    skipReason = 'could not build the crazygames bundle: ' + e.message;
    return;
  }
  try {
    browser = await chromium.launch({ executablePath: fs.existsSync(PW_CHROMIUM) ? PW_CHROMIUM : undefined });
  } catch (e) {
    skipReason = 'no Chromium available: ' + e.message;
    return;
  }
  server = await serveRoot();
  SITE_URL = `http://127.0.0.1:${server.address().port}/wheelie-fun.html`;
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
});

const live = (name, fn) => test(name, async (t) => { if (skipReason) return t.skip(skipReason); await fn(); });

/** Opens the game with a mocked CrazyGames SDK seeded with `cloudSeed` as its starting cloud data. */
async function openWithMockSdk(cloudSeed = {}) {
  const context = await newGameContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((seed) => {
    const cloud = { ...seed };
    window.__cloud = cloud;
    window.__cloudSetCalls = [];
    window.CrazyGames = {
      SDK: {
        init: () => Promise.resolve(),
        data: {
          getItem: (k) => (k in cloud ? cloud[k] : null),
          setItem: (k, v) => { cloud[k] = v; window.__cloudSetCalls.push([k, v]); },
        },
        game: { gameplayStart() {}, gameplayStop() {} },
      },
    };
  }, cloudSeed);
  // The real SDK script would 404/hang with no network; fulfilling it as an empty (valid) script
  // is enough, since the mock above already defines everything the game actually calls.
  await page.route('https://sdk.crazygames.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.goto(CG_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__tiki, null, { timeout: 15000 });
  return { context, page, errors };
}

live('pulls existing cloud progress into the game on load', async () => {
  const { context, page, errors } = await openWithMockSdk({
    'wheeliefun.unlockedCups': '5',
    'wheeliefun.trophy.wheeldeal': '1',
  });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__tiki.ev('unlockedCupCount()')), 5);
  assert.equal(await page.evaluate(() => window.__tiki.ev("trophyOf('wheeldeal')")), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

live('a fresh save (nothing in the cloud yet) still boots with the normal defaults', async () => {
  const { context, page } = await openWithMockSdk();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__tiki.ev('unlockedCupCount()')), 1);
  await context.close();
});

live('new progress mirrors to the cloud as it happens', async () => {
  const { context, page } = await openWithMockSdk();
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__tiki.ev("store.set('wheeliefun.unlockedCups','6');"));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__cloud['wheeliefun.unlockedCups']), '6');
  assert.equal(
    await page.evaluate(() => window.__cloudSetCalls.some((c) => c[0] === 'wheeliefun.unlockedCups' && c[1] === '6')),
    true,
  );
  await context.close();
});

live('keys outside the game\'s own prefixes are never sent to the cloud', async () => {
  const { context, page } = await openWithMockSdk();
  await page.waitForTimeout(200);
  await page.evaluate(() => localStorage.setItem('someUnrelatedKey', 'x'));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => localStorage.getItem('someUnrelatedKey')), 'x', 'the write itself must still work');
  assert.equal(await page.evaluate(() => window.__cloudSetCalls.some((c) => c[0] === 'someUnrelatedKey')), false);
  await context.close();
});

live('a local write during the startup wait beats a stale cloud read for the same key', async () => {
  const { context, page } = await openWithMockSdk({ 'wheeliefun.unlockedCups': '2' });
  // fires as soon as possible, racing the mocked SDK.init() -> cloud pull that's already in flight
  await page.evaluate(() => window.__tiki.ev("store.set('wheeliefun.unlockedCups','9');"));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__tiki.ev('unlockedCupCount()')), 9);
  await context.close();
});

live('the online display name (set via window.WFSave.storage, not store.set) also mirrors to the cloud', async () => {
  const { context, page } = await openWithMockSdk();
  await page.waitForTimeout(200);
  await page.evaluate(() => window.WFSave.storage.setItem('wheeliefun.onlineName', 'TestRacer42'));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__cloud['wheeliefun.onlineName']), 'TestRacer42');
  await context.close();
});

live('a lower (better) best lap time wins the merge instead of the last write', async () => {
  const { context, page } = await openWithMockSdk({ 'wheeliefun.best.lava': '50' });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__tiki.ev("store.set('wheeliefun.best.lava','75');"));
  await page.waitForTimeout(100);
  // 50 (cloud) is better than 75 (the new write), so the merge must keep 50.
  assert.equal(await page.evaluate(() => window.__cloud['wheeliefun.best.lava']), '50');
  await context.close();
});

live('pre-existing local-only progress is migrated into the cloud on first SDK-active load', async () => {
  const context = await newGameContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('wheeliefun.trophy.wheeldeal', '2');
    window.__cloud = {};
    window.__cloudSetCalls = [];
    window.CrazyGames = {
      SDK: {
        init: () => Promise.resolve(),
        data: {
          getItem: (k) => (k in window.__cloud ? window.__cloud[k] : null),
          setItem: (k, v) => { window.__cloud[k] = v; window.__cloudSetCalls.push([k, v]); },
        },
        game: { gameplayStart() {}, gameplayStop() {} },
      },
    };
  });
  await page.route('https://sdk.crazygames.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.goto(CG_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__tiki, null, { timeout: 15000 });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__cloud['wheeliefun.trophy.wheeldeal']), '2');
  assert.deepEqual(errors, []);
  await context.close();
});

live('a save that keeps failing shows a retry status message, then clears it once it succeeds', async () => {
  const context = await newGameContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const cloud = {};
    window.__cloud = cloud;
    window.__failWrites = true;
    window.CrazyGames = {
      SDK: {
        init: () => Promise.resolve(),
        data: {
          getItem: (k) => (k in cloud ? cloud[k] : null),
          setItem: (k, v) => { if (window.__failWrites) throw new Error('simulated write failure'); cloud[k] = v; },
        },
        game: { gameplayStart() {}, gameplayStop() {} },
      },
    };
  });
  await page.route('https://sdk.crazygames.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.goto(CG_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__tiki, null, { timeout: 15000 });
  await page.evaluate(() => window.__tiki.ev("store.set('wheeliefun.unlockedCups','6');"));
  await page.waitForFunction(() => !!(window.WFSave && window.WFSave.message), null, { timeout: 5000 });
  assert.match(await page.evaluate(() => window.WFSave.message), /retrying/i);
  await page.evaluate(() => { window.__failWrites = false; });
  await page.waitForFunction(() => window.WFSave && window.WFSave.message === '', null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__cloud['wheeliefun.unlockedCups']), '6');
  await context.close();
});

live('a CrazyGames SDK that never resolves init() still lets the game boot (bounded by the game\'s own timeout)', async () => {
  const context = await newGameContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.CrazyGames = {
      SDK: {
        init: () => new Promise(() => {}), // never resolves or rejects
        data: { getItem: () => null, setItem() {} },
        game: { gameplayStart() {}, gameplayStop() {} },
      },
    };
  });
  await page.route('https://sdk.crazygames.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.goto(CG_URL, { waitUntil: 'load', timeout: 60000 });
  // The game's boot sequence races window.WFSave.ready against its own 8s timeout.
  await page.waitForFunction(() => !!window.__tiki, null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  await context.close();
});

live('on CrazyGames with the SDK blocked (ad blocker), the game still boots and plays on browser saves', async () => {
  const context = await newGameContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(SDK_HOST, (route) => route.abort());
  await page.goto(CG_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__tiki, null, { timeout: 15000 });
  // a brand-new player has one racer, so 1 Player goes straight into the first cup
  await page.evaluate(() => window.__tiki.ev('document.querySelector(\'[data-act="p1"]\').click();'));
  // the first track may still be loading for a moment
  await page.waitForFunction(() => window.__tiki.ev('G.state') === 'countdown', null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.__tiki.ev('G.cup.ci')), 0);
  assert.equal(await page.evaluate(() => window.WFSave.onCrazyGames), true);
  assert.equal(await page.evaluate(() => window.WFSave.sdkReady), false);
  assert.equal(await page.evaluate(() => window.WFSave.message), '', 'no stuck "retrying" banner');
  assert.deepEqual(errors, []);
  await context.close();
});

live('on CrazyGames, the SDK is loaded by the page itself and gameplay start is reported', async () => {
  const context = await newGameContext();
  const page = await context.newPage();
  // No window.CrazyGames mock up front: the page must fetch the SDK script on its own, which
  // here is a stub that defines the SDK and records gameplayStart.
  await page.route(SDK_HOST, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: `
    window.__gameplay = [];
    const cloud = {};
    window.CrazyGames = { SDK: {
      init: () => Promise.resolve(),
      data: { getItem: (k) => (k in cloud ? cloud[k] : null), setItem: (k, v) => { cloud[k] = v; }, removeItem: (k) => { delete cloud[k]; } },
      game: { gameplayStart() { window.__gameplay.push('start'); }, gameplayStop() { window.__gameplay.push('stop'); } },
    } };` }));
  await page.goto(CG_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__tiki && window.WFSave.sdkReady, null, { timeout: 20000 });
  await page.evaluate(() => window.__tiki.ev("G.state='race';"));
  await page.waitForFunction(() => window.__gameplay.includes('start'), null, { timeout: 10000 });
  await context.close();
});

live('on our own site (any non-CrazyGames address) the CrazyGames SDK is never requested', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const sdkRequests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (r.url().includes('crazygames')) sdkRequests.push(r.url()); });
  await page.goto(SITE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__tiki, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  assert.deepEqual(sdkRequests, []);
  assert.equal(await page.evaluate(() => window.WFSave.onCrazyGames), false);
  assert.equal(await page.evaluate(() => window.WFSave.sdkReady), false);
  await page.evaluate(() => window.WFSave.storage.setItem('wheeliefun.unlockedCups', '3'));
  assert.equal(await page.evaluate(() => localStorage.getItem('wheeliefun.unlockedCups')), '3', 'saves stay in the browser');
  assert.deepEqual(errors, []);
  await context.close();
});
