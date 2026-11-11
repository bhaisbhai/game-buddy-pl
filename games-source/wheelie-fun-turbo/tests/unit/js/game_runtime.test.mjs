// Boots the real standalone game in headless Chrome/Edge (over the DevTools protocol) and checks
// its live data against server.py. Needs a Chromium browser and internet (three.js loads from a CDN);
// skips itself if either is missing. Set CHROME_PATH to pick a browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));

function serverData() {
  const py = process.platform === 'win32' ? 'py' : 'python3';
  const code = `import sys,json;sys.path.insert(0,${JSON.stringify(ROOT)});import server as s;` +
    `print(json.dumps({"tracks":s.TRACK_IDS,"cups":[{"id":c["id"],"ids":c["ids"]} for c in s.CUPS],"chars":s.CHAR_NAMES}))`;
  return JSON.parse(execFileSync(py, ['-I', '-c', code], { encoding: 'utf8' }));
}

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let proc, ws, profile, skipReason = null;
let nextId = 1;
const pending = new Map();
const consoleErrors = [];
const exceptions = [];

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

before(async () => {
  if (!BROWSER) { skipReason = 'no Chrome/Edge found'; return; }
  const port = await freePort();
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-test-'));
  proc = spawn(BROWSER, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
  }
  assert.ok(target, 'browser did not start');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(path.join(ROOT, 'wheelie-fun-standalone.html')).href });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('!!(window.__tiki && window.WFOnline && window.WFV2)').catch(() => false)) return;
    await sleep(200);
  }
  if (!(await evaluate('typeof THREE !== "undefined"').catch(() => false))) skipReason = 'three.js did not load (offline?)';
  else throw new Error('game did not finish booting: ' + exceptions.join(' | '));
});

after(async () => {
  try { ws?.close(); } catch {}
  proc?.kill();
  await sleep(300);
  try { if (profile) fs.rmSync(profile, { recursive: true, force: true }); } catch {}
});

const live = (name, fn) => test(name, async (t) => { if (skipReason) return t.skip(skipReason); await fn(); });

live('boots without uncaught errors', async () => {
  assert.deepEqual(exceptions, []);
  assert.deepEqual(consoleErrors.filter((e) => !/favicon|net::ERR/.test(e)), []);
});

live('track order matches the online server (otherwise players load different tracks)', async () => {
  const ids = await evaluate('__tiki.ev("LEVELS.map(l => l.id)")');
  assert.deepEqual(ids, serverData().tracks);
});

live('cups match the online server', async () => {
  const cups = await evaluate('__tiki.CUPS.map(c => ({ id: c.id, ids: c.ids || c.tracks }))');
  assert.deepEqual(cups, serverData().cups);
});

live('characters match the online server', async () => {
  const names = await evaluate('__tiki.ev("CHARS.map(c => c.name)")');
  assert.deepEqual(names, serverData().chars);
});

live('every track has a name and a valid lap count (missing = default 3)', async () => {
  const bad = await evaluate(`__tiki.ev("LEVELS.filter(l => !l.name || (l.laps != null && !(l.laps >= 1))).map(l => l.id)")`);
  assert.deepEqual(bad, []);
});

live('online client sees the game data, not its fallbacks', async () => {
  const n = await evaluate('__tiki.ev("LEVELS.length")');
  assert.equal(n, 44);
});
