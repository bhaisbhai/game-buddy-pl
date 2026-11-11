// Automated play-test: every track, full race, the "human" kart on autopilot, simulation fast-forwarded.
// node playtest.mjs <game.html> <out.json> [trackIds...] [--players=N] [--cc=150cc] [--mode=race|battle|death]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { pathToFileURL } from 'node:url';

const [game, outFile, ...rest] = process.argv.slice(2);
const only = rest.filter((a) => !a.startsWith('--'));
const players = +(rest.find((a) => a.startsWith('--players='))?.slice(10) || 1);
const cc = rest.find((a) => a.startsWith('--cc='))?.slice(5) || '150cc';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-pt-'));
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--window-size=1280,720', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--mute-audio', '--enable-gpu', '--use-angle=d3d11', 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 1; const pend = new Map(); const errors = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n').slice(0, 3).join(' | ') || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) errors.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)); });
const send = (method, params = {}) => new Promise((res) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout: 120000 }); if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description); return m.result?.result?.value; };
const tiki = (c) => ev(`__tiki.ev(${JSON.stringify(c)})`);

await send('Runtime.enable');
await send('Page.navigate', { url: pathToFileURL(game).href });
for (let i = 0; i < 100; i++) { if (await ev('!!(window.__tiki && window.WFV2)').catch(() => false)) break; await sleep(200); }
await sleep(1500);
// Instrumentation: count specials fired while one is active, and anti-grav bump boosts.
await tiki(`(() => { window.__pt = { stackedSpecials: 0, specials: 0, bumpBoosts: 0 };
  const f0 = fireSignatureHype; fireSignatureHype = function (k) { __pt.specials++; if (k.hyperT > 0) __pt.stackedSpecials++; return f0(k); };
  const t0 = WFV2.triggerSpinBoost; WFV2.triggerSpinBoost = function (k, l) { const r = t0(k, l); if (r && /BUMP/.test(l || '')) __pt.bumpBoosts++; return r; }; })()`);
await tiki(`WFV2.setCC('${cc}')`);
const tracks = await tiki('LEVELS.map((l, i) => ({ i, id: l.id, name: l.name, laps: l.laps || 3, random: !!l.random }))');
const results = [];
for (const t of tracks) {
  if (only.length && !only.includes(t.id)) continue;
  const errBefore = errors.length;
  const t0 = Date.now();
  try {
    await tiki(`__pt.specials=0;__pt.stackedSpecials=0;__pt.bumpBoosts=0;G.mode=${players};G.bind=null;G.humans=[${[0, 1, 2, 3].slice(0, players)}];G.cup=null;G.timeTrial=false;G.battle=false;G.deathNext=false;startLevel(${t.i})`);
    for (let w = 0; w < 50; w++) { await sleep(200); if (await tiki(`G.level === ${t.i} && (G.state === 'countdown' || G.state === 'race')`)) break; }
    const r = await tiki(`(() => { const R0 = render; render = function () {}; G.auto = true;
      const st = G.karts.map(k => ({ name: k.ch.name, human: !!k.human, falls: 0, wasResp: false, lastProg: -1e9, stuckFor: 0, maxStuck: 0, nan: false, below: 0, hype: 0, specials: 0 }));
      const DT = 1 / 60; let t = 0; let lapsOK = true;
      while (t < 420) {
        __tiki.sim(30, DT); t += 30 * DT;
        G.karts.forEach((k, i) => { const s = st[i];
          if (!isFinite(k.x) || !isFinite(k.z) || !isFinite(k.y) || !isFinite(k.speed)) s.nan = true;
          if (k.respawnT > 0 && !s.wasResp) s.falls++; s.wasResp = k.respawnT > 0;
          if (!k.finished && k.respawnT <= 0 && G.state === 'race') { if (k.progress - s.lastProg < 4) { s.stuckFor += 30 * DT; s.maxStuck = Math.max(s.maxStuck, s.stuckFor); } else { s.stuckFor = 0; s.lastProg = k.progress; } }
          if (k.lap > (LV.laps || 3) + 1) lapsOK = false; });
        if (G.state !== 'race' && G.state !== 'countdown') break;
        if (G.karts.every(k => k.finished)) break;
      }
      G.auto = false; render = R0;
      return { simT: +t.toFixed(1), state: G.state, lapsOK,
        karts: G.karts.map((k, i) => ({ name: st[i].name, human: st[i].human, finished: !!k.finished, time: k.finished ? +k.finishTime.toFixed(2) : null, rank: k.rank + 1,
          falls: st[i].falls, maxStuck: +st[i].maxStuck.toFixed(1), nan: st[i].nan, bestLap: isFinite(k.bestLap) ? +k.bestLap.toFixed(2) : null, coins: k.coins })),
        specials: __pt.specials, stackedSpecials: __pt.stackedSpecials, bumpBoosts: __pt.bumpBoosts, antigrav: WFV2.ANTIGRAV.some(v => v === 1) }; })()`);
    r.track = t.id; r.name = t.name; r.wallSec = +((Date.now() - t0) / 1000).toFixed(1); r.errors = errors.slice(errBefore);
    results.push(r);
    const fin = r.karts.filter((k) => k.finished).length;
    const falls = r.karts.reduce((a, k) => a + k.falls, 0);
    const stuck = Math.max(...r.karts.map((k) => k.maxStuck));
    const times = r.karts.filter((k) => k.finished).map((k) => k.time);
    console.log(`${t.id.padEnd(12)} finished ${fin}/${r.karts.length}  win ${times.length ? Math.min(...times) : '-'}s last ${times.length ? Math.max(...times) : '-'}s  falls ${falls}  maxStuck ${stuck}s  specials ${r.specials}/${r.stackedSpecials} stacked  bump ${r.bumpBoosts}  errs ${r.errors.length}${r.karts.some((k) => k.nan) ? '  NaN!' : ''}${r.lapsOK ? '' : '  LAPS!'}  (${r.wallSec}s)`);
  } catch (e) {
    console.log(`${t.id.padEnd(12)} CRASH ${e.message.split('\n')[0]}`);
    results.push({ track: t.id, crash: e.message, errors: errors.slice(errBefore) });
    await tiki('G.auto=false').catch(() => {});
  }
  fs.writeFileSync(outFile, JSON.stringify({ players, cc, results, allErrors: errors }, null, 1));
}
ws.close(); proc.kill(); await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
