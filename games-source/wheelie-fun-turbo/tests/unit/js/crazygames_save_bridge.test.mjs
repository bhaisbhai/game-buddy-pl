// Boots the real CrazyGames build (wheelie-fun-crazygames.html) in headless Chrome with
// window.CrazyGames mocked -- the real SDK needs their CDN and a live portal session, so it's
// faithfully stubbed instead -- and checks the save-data bridge build_crazygames.py injects
// actually round-trips progress through it. Builds a fresh copy from current source first (both
// wheelie-fun-standalone.html and wheelie-fun-crazygames.html are gitignored artifacts, so this
// never depends on a stale leftover from a previous manual build).
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
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';

// Playwright lives in a shared tools location, not this project's own node_modules.
const PLAYWRIGHT_PATHS = ['playwright', pathToFileURL('/opt/node-tools/node_modules/playwright/index.js').href];
const PW_CHROMIUM = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const GAME_URL = `file://${path.join(ROOT, 'wheelie-fun-crazygames.html')}`;

let chromium, browser, skipReason = null;

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
  }
});

after(async () => { await browser?.close(); });

const live = (name, fn) => test(name, async (t) => { if (skipReason) return t.skip(skipReason); await fn(); });

/** Opens the game with a mocked CrazyGames SDK seeded with `cloudSeed` as its starting cloud data. */
async function openWithMockSdk(cloudSeed = {}) {
  const context = await browser.newContext();
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
  await page.goto(GAME_URL, { waitUntil: 'load' });
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

live('the online display name (set via raw localStorage, not store.set) also mirrors to the cloud', async () => {
  const { context, page } = await openWithMockSdk();
  await page.waitForTimeout(200);
  await page.evaluate(() => localStorage.setItem('wheeliefun.onlineName', 'TestRacer42'));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__cloud['wheeliefun.onlineName']), 'TestRacer42');
  await context.close();
});

live('the game boots and the racer-select/confirm flow works with no CrazyGames SDK at all', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://sdk.crazygames.com/**', (route) => route.abort());
  await page.goto(GAME_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__tiki, null, { timeout: 15000 });
  await page.evaluate(() => window.__tiki.ev('document.querySelector(\'[data-act="p1"]\').click();'));
  await page.evaluate(() => document.querySelectorAll('#grid .ch')[0].click());
  assert.equal(await page.evaluate(() => window.__tiki.ev('G.state')), 'tracks');
  assert.deepEqual(errors, []);
  await context.close();
});
