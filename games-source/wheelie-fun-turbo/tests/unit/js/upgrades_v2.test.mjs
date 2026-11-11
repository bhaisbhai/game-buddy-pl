// Unit tests for upgrades_v2.js: speed classes, garage parts & physics, coin vault,
// time-trial personal bests, ghost share codes and anti-gravity zones.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadUpgradesV2, memoryStore, anything } from './harness.mjs';

const plain = (v) => JSON.parse(JSON.stringify(v));
const N = 100;

/** Minimal straight-line track so the Dev Staff ghost generator can run. */
function trackApi() {
  return {
    N, SP: 1,
    TP: Array.from({ length: N }, (_, i) => ({ x: i, z: 0 })),
    TR: Array.from({ length: N }, () => ({ x: 0, z: 1 })),
    CURV: new Array(N).fill(0), LW: new Array(N).fill(1), TA: new Array(N).fill(0),
    GAP: new Array(N).fill(0), BANK: new Array(N).fill(0.2),
    wrapI: (i) => ((i % N) + N) % N,
    groundAt: () => 0,
    CHARS: Array.from({ length: 10 }, (_, i) => ({ name: 'C' + i })),
    makeKart: () => ({ root: anything(), wheels: [] }),
    CUPS: Array.from({ length: 11 }, (_, i) => ({ id: 'cup' + i })),
    nameTag: () => anything(),
  };
}

/** Store with trophies in the first n cups (the garage unlocks at 4). */
const trophies = (n, extra = {}) => memoryStore({ ...Object.fromEntries(Array.from({ length: n }, (_, i) => ['wheeliefun.trophy.cup' + i, '2'])), ...extra });

function load(opts = {}) {
  const G = { mirror: false, timeTrial: true, battle: false, state: 'race', raceT: 0,
    humans_k: [{ x: 1, y: 0, z: 2, heading: 0, driftDir: 0, finished: false }], karts: [], ...opts.G };
  return loadUpgradesV2({ store: opts.store || memoryStore(), G, extraApi: { ...trackApi(), ...opts.api } });
}

describe('speed classes', () => {
  test('five classes in menu order, each getting faster', () => {
    const { v2 } = load();
    assert.deepEqual(plain(v2.CC_ORDER), ['50cc', '100cc', '150cc', '200cc', 'mirror']);
    const spd = ['50cc', '100cc', '150cc', '200cc'].map((c) => v2.CC_CONFIG[c].spd);
    for (let i = 1; i < spd.length; i++) assert.ok(spd[i] > spd[i - 1]);
  });

  test('mirror is 150cc flipped', () => {
    const { v2 } = load();
    const m = v2.CC_CONFIG.mirror, s = v2.CC_CONFIG['150cc'];
    assert.equal(m.mirror, true);
    assert.deepEqual([m.spd, m.acc, m.off], [s.spd, s.acc, s.off]);
  });

  test('defaults to 150cc and restores a saved class', () => {
    assert.equal(load().v2.getCC().id, '150cc');
    assert.equal(load({ store: memoryStore({ 'wheeliefun.cc': '200cc' }) }).v2.getCC().id, '200cc');
    assert.equal(load({ store: memoryStore({ 'wheeliefun.cc': 'warp9' }) }).v2.getCC().id, '150cc');
  });

  test('setCC updates game state and saves; unknown classes ignored', () => {
    const { v2, api, store } = load();
    v2.setCC('mirror');
    assert.equal(api.G.cc, 'mirror');
    assert.equal(api.G.mirror, true);
    assert.equal(store.data['wheeliefun.cc'], 'mirror');
    v2.setCC('nope');
    assert.equal(v2.getCC().id, 'mirror');
  });

  test('cycleCC walks the list and wraps', () => {
    const { v2 } = load();
    const seen = [];
    for (let i = 0; i < 5; i++) { v2.cycleCC(); seen.push(v2.getCC().id); }
    assert.deepEqual(seen, ['200cc', 'mirror', '50cc', '100cc', '150cc']);
  });
});

describe('garage', () => {
  test('saved loadout is restored', () => {
    const store = trophies(4, { 'wheeliefun.frame': '2', 'wheeliefun.tire': '1', 'wheeliefun.glider': '3' });
    const p = load({ store }).v2.getPartsForKart(true, 0);
    assert.deepEqual([p.frame.id, p.tire.id, p.glider.id], ['coupe', 'slick', 'jet']);
  });

  test('corrupt saved loadout does not break the game', () => {
    for (const bad of ['abc', '-1', '1e9', '']) {
      const store = memoryStore({ 'wheeliefun.frame': bad, 'wheeliefun.tire': bad, 'wheeliefun.glider': bad });
      let v2;
      assert.doesNotThrow(() => { ({ v2 } = load({ store })); }, `saved value "${bad}" crashed startup`);
      for (const k of ['frame', 'tire', 'glider']) {
        assert.ok(Number.isInteger(v2.loadout[k]) && v2.loadout[k] >= 0 && v2.loadout[k] < 4,
          `loadout.${k} = ${v2.loadout[k]} for saved "${bad}"`);
      }
    }
  });

  test('garage is locked until a trophy is won in 4 cups', () => {
    for (const [n, open] of [[0, false], [3, false], [4, true], [11, true]]) {
      const { v2 } = load({ store: trophies(n, { 'wheeliefun.frame': '2' }) });
      assert.equal(v2.garageCupsDone(), n);
      assert.equal(v2.garageUnlocked(), open, `${n} cups`);
      assert.equal(v2.getPartsForKart(true, 0).frame.id, open ? 'coupe' : 'buggy', 'locked garage uses default parts');
    }
  });

  test('a cup finished outside the top 3 does not count', () => {
    const { v2 } = load({ store: trophies(3, { 'wheeliefun.trophy.cup9': '0' }) });
    assert.equal(v2.garageCupsDone(), 3);
  });

  test('locked garage shows the unlock message, unlocked shows the parts', () => {
    const locked = load({ store: trophies(2) });
    assert.match(locked.ctx.document.getElementById('garageBar').innerHTML, /win a trophy in 4 cups[\s\S]*2\/4/);
    const open = load({ store: trophies(4) });
    assert.match(open.ctx.document.getElementById('garageBar').innerHTML, /CHASSIS FRAME/);
  });

  test('setLoadout wraps negative and large indices', () => {
    const { v2 } = load();
    v2.setLoadout(-1, 5, -6, true);
    assert.deepEqual([v2.loadout.frame, v2.loadout.tire, v2.loadout.glider, v2.loadout.goldSkin], [3, 1, 2, true]);
  });

  test('garage buttons cycle parts and save them', () => {
    const { v2, ctx, store } = load();
    const bar = ctx.document.getElementById('garageBar');
    const click = (gpart, gdir) => bar.dispatch('click', { target: { closest: () => ({ dataset: { gpart, gdir } }) } });
    click('frame', '-1');
    assert.equal(v2.loadout.frame, 3);
    assert.equal(store.data['wheeliefun.frame'], '3');
    click('tire', '1');
    click('tire', '1');
    assert.equal(v2.loadout.tire, 2);
  });

  test('gold paint only shows once it is unlocked', () => {
    const { v2 } = load({ store: trophies(4) });
    v2.setLoadout(null, null, null, true);
    assert.equal(v2.getPartsForKart(true, 0).gold, false);
    v2.VAULT.coins = 50;
    assert.equal(v2.getPartsForKart(true, 0).gold, true);
  });

  test('the gold slot cannot unlock gold for free; it toggles once earned', () => {
    const { v2, ctx } = load({ store: trophies(4) });
    const bar = ctx.document.getElementById('garageBar');
    const click = () => bar.dispatch('click', { target: { closest: () => ({ dataset: { gpart: 'gold', gdir: '1' } }) } });
    v2.VAULT.coins = 20;
    click();
    assert.equal(v2.VAULT.hasGoldKart(), false);
    assert.equal(v2.VAULT.coins, 20);
    assert.equal(v2.loadout.goldSkin, false);
    assert.match(bar.innerHTML, /Gold at 50 coins · 20\/50/);
    v2.VAULT.coins = 50;
    click();
    assert.equal(v2.loadout.goldSkin, true);
  });

  test('AI karts get valid, repeatable parts for any index', () => {
    const { v2 } = load();
    for (const i of [0, 1, 7, -3, 1000]) {
      const a = v2.getPartsForKart(false, 0, i), b = v2.getPartsForKart(false, 0, i);
      assert.ok(a.frame && a.tire && a.glider, `index ${i}`);
      assert.equal(a.frame.id, b.frame.id);
      assert.equal(a.gold, false);
    }
  });

  test('physics: every part combination gives sane numbers', () => {
    const { v2 } = load();
    for (const frame of v2.GARAGE_FRAMES) for (const tire of v2.GARAGE_TIRES) for (const glider of v2.GARAGE_GLIDERS) {
      const k = { ch: { st: [3, 3, 3, 3] }, v: null };
      v2.applyGaragePhysics(k, { frame, tire, glider });
      for (const f of ['maxS', 'acc', 'hand', 'weight', 'offroadMult', 'sparkRate', 'mtMult', 'airTurnMult']) {
        assert.ok(Number.isFinite(k[f]) && k[f] > 0, `${frame.id}/${tire.id}/${glider.id}: ${f}=${k[f]}`);
      }
      assert.ok(k.offroadMult >= 0.42 && k.offroadMult <= 0.88);
      assert.equal(k.insideDrift, frame.id === 'moto');
    }
  });

  test('physics: 200cc is faster than 50cc with the same kart', () => {
    const { v2 } = load();
    const parts = { frame: v2.GARAGE_FRAMES[0], tire: v2.GARAGE_TIRES[0], glider: v2.GARAGE_GLIDERS[0] };
    const speed = (cc) => { v2.setCC(cc); const k = { ch: { st: [3, 3, 3, 3] } }; v2.applyGaragePhysics(k, parts); return k.maxS; };
    assert.ok(speed('200cc') > speed('150cc') && speed('150cc') > speed('50cc'));
    const k = { ch: { st: [3, 3, 3, 3] } };
    v2.setCC('150cc');
    v2.applyGaragePhysics(k, parts);
    assert.ok(Math.abs(k.maxS - 58 * (0.94 + 3 * 0.028) * 1.05) < 1e-9);
  });
});

describe('coin vault', () => {
  test('rewards unlock at 50 / 100 / 150 coins', () => {
    const { v2 } = load();
    const V = v2.VAULT;
    const state = () => [V.hasGoldKart(), V.hasPlasmaTrails(), V.hasMasterBadge()];
    V.coins = 49; assert.deepEqual(state(), [false, false, false]);
    V.coins = 50; assert.deepEqual(state(), [true, false, false]);
    V.coins = 100; assert.deepEqual(state(), [true, true, false]);
    V.coins = 150; assert.deepEqual(state(), [true, true, true]);
  });

  test('coins are whole, never negative, and persisted', () => {
    const { v2, store } = load();
    v2.VAULT.add(7.9);
    assert.equal(v2.VAULT.coins, 7);
    v2.VAULT.coins = -20;
    assert.equal(v2.VAULT.coins, 0);
    assert.equal(store.data['wheeliefun.vault'], '0');
  });

  test('unlockAll unlocks everything and tops coins up to 200', () => {
    const { v2 } = load();
    v2.VAULT.coins = 20;
    v2.VAULT.unlockAll();
    assert.equal(v2.VAULT.coins, 200);
    assert.ok(v2.VAULT.hasMasterBadge());
  });
});

describe('ghost share codes', () => {
  const frames = Array.from({ length: 40 }, (_, i) => [i * 0.1, i * 1.234567, 0.5, -i, 0.01 * i, i % 3 - 1]);

  test('encode -> decode round trip keeps track, time and every other frame', () => {
    const { v2 } = load();
    const code = v2.encodeGhostCode('rainbow', 83.4567, frames);
    assert.match(code, /^WFG1:[A-Za-z0-9+/=]+$/);
    const g = v2.decodeGhostCode(code);
    assert.equal(g.trk, 'rainbow');
    assert.equal(g.t, 83.457);
    assert.equal(g.m, 0);
    assert.equal(g.f.length, 20);
    assert.deepEqual(plain(g.f[1]), [0.2, 2.5, 0.5, -2, 0.02, 1]);
  });

  test('mirror mode is recorded in the code', () => {
    const { v2, api } = load();
    api.G.mirror = true;
    assert.equal(v2.decodeGhostCode(v2.encodeGhostCode('lava', 60, frames)).m, 1);
  });

  test('pasted codes with spaces or without the prefix still decode', () => {
    const { v2 } = load();
    const code = v2.encodeGhostCode('lava', 60, frames);
    assert.ok(v2.decodeGhostCode('  ' + code + '\n'));
    assert.ok(v2.decodeGhostCode(code.slice(5)));
  });

  test('garbage codes are rejected, not thrown', () => {
    const { v2 } = load();
    for (const bad of [null, undefined, '', 'hello', 'WFG1:!!!!', 'WFG1:' + Buffer.from('{"v":1}').toString('base64'),
      'WFG1:' + Buffer.from('{"trk":"lava","f":"no"}').toString('base64')]) {
      assert.equal(v2.decodeGhostCode(bad), null, String(bad));
    }
  });

  test('codes with malformed frames are rejected', () => {
    const { v2 } = load();
    const payload = { v: 1, trk: 'lava', m: 0, t: 60, f: [[0, 'x', null], 5, 'frame'] };
    const code = 'WFG1:' + Buffer.from(JSON.stringify(payload)).toString('base64');
    assert.equal(v2.decodeGhostCode(code), null, 'a ghost with nonsense frames was accepted');
  });
});

describe('time trials', () => {
  const L = { id: 'rainbow', laps: 3 };

  test('first finish is a personal best and is saved', () => {
    const { v2, store } = load();
    const r = v2.saveTimeTrialFinish(L, 90.12345, 2);
    assert.equal(r.beatPB, true);
    const saved = JSON.parse(store.data['wheeliefun.ghost.rainbow']);
    assert.equal(saved.t, 90.123);
    assert.equal(saved.ch, 2);
    assert.ok(saved.f.length >= 2);
    assert.equal(v2.decodeGhostCode(r.code).trk, 'rainbow');
  });

  test('a slower time does not overwrite the PB; a faster one does', () => {
    const { v2, store } = load();
    v2.saveTimeTrialFinish(L, 90, 0);
    assert.equal(v2.saveTimeTrialFinish(L, 95, 0).beatPB, false);
    assert.equal(JSON.parse(store.data['wheeliefun.ghost.rainbow']).t, 90);
    assert.equal(v2.saveTimeTrialFinish(L, 85, 0).beatPB, true);
    assert.equal(JSON.parse(store.data['wheeliefun.ghost.rainbow']).t, 85);
  });

  test('mirror mode keeps its own PB', () => {
    const { v2, store, api } = load();
    v2.saveTimeTrialFinish(L, 90, 0);
    api.G.mirror = true;
    assert.equal(v2.saveTimeTrialFinish(L, 120, 0).beatPB, true);
    assert.ok(store.data['wheeliefun.ghost.rainbow.m']);
  });

  test('nothing is saved outside time trials, on no-best tracks, or for invalid times', () => {
    const { v2, store, api } = load();
    assert.equal(v2.saveTimeTrialFinish({ id: 'x', noBest: true }, 50, 0).beatPB, false);
    assert.equal(v2.saveTimeTrialFinish(L, NaN, 0).beatPB, false);
    api.G.timeTrial = false;
    assert.equal(v2.saveTimeTrialFinish(L, 50, 0).beatPB, false);
    assert.deepEqual(Object.keys(store.data).filter((k) => k.includes('ghost')), []);
  });

  test('corrupt saved PB is treated as no PB', () => {
    const store = memoryStore({ 'wheeliefun.ghost.rainbow': '{broken' });
    const { v2 } = load({ store });
    assert.equal(v2.saveTimeTrialFinish(L, 99, 0).beatPB, true);
  });

  test('ghost records at about 10 Hz while racing', () => {
    const { v2, api } = load();
    for (let i = 0; i < 100; i++) { api.G.raceT += 1 / 60; v2.tickTimeTrial(1 / 60); }
    const n = v2.GHOSTS.recording.length;
    assert.ok(n >= 15 && n <= 18, `recorded ${n} frames in ~1.67 s`);
  });

  test('a long race keeps a ghost for the whole race', () => {
    const { v2, api, store } = load();
    for (let t = 0; t < 200; t += 0.1) { api.G.raceT = t; v2.GHOSTS.recAccum = 1; v2.tickTimeTrial(0); }
    v2.saveTimeTrialFinish(L, 200, 0);
    const saved = JSON.parse(store.data['wheeliefun.ghost.rainbow']);
    const lastFrameT = saved.f[saved.f.length - 1][0];
    assert.ok(lastFrameT >= 199, `saved ghost stops at ${lastFrameT}s of a ${saved.t}s run (it will freeze there)`);
  });

  test('staff ghost is faster at higher speed classes', () => {
    const { v2, api } = load();
    const staffTime = (cc) => { v2.setCC(cc); v2.setupTimeTrialGhosts(L); return v2.GHOSTS.activeGhosts.find((g) => g.isStaff).totalTime; };
    assert.ok(staffTime('200cc') < staffTime('150cc'));
    assert.ok(staffTime('150cc') < staffTime('50cc'));
    assert.equal(api.G.timeTrial, true);
  });

  test('saved PB ghost is loaded next time', () => {
    const { v2 } = load();
    for (let t = 0; t < 3; t += 0.1) { v2.GHOSTS.recording.push([t, t, 0, 0, 0, 0]); }
    v2.saveTimeTrialFinish(L, 3, 1);
    v2.setupTimeTrialGhosts(L);
    assert.ok(v2.GHOSTS.activeGhosts.some((g) => /YOUR PB/.test(g.label)));
  });

  test('an imported rival ghost replaces the PB ghost on its own track only', () => {
    const { v2 } = load();
    const code = v2.encodeGhostCode('rainbow', 50, [[0, 0, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0], [2, 2, 0, 0, 0, 0], [3, 3, 0, 0, 0, 0]]);
    assert.ok(v2.importGhostCode(code));
    v2.setupTimeTrialGhosts(L);
    assert.ok(v2.GHOSTS.activeGhosts.some((g) => g.label === 'RIVAL GHOST'));
    v2.setupTimeTrialGhosts({ id: 'lava', laps: 3 });
    assert.ok(!v2.GHOSTS.activeGhosts.some((g) => g.label === 'RIVAL GHOST'));
  });

  test('a mirror-mode rival ghost is raced in mirror mode', () => {
    const { v2, api } = load();
    api.G.mirror = true;
    v2.importGhostCode(v2.encodeGhostCode('rainbow', 50, [[0, 0, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0], [2, 2, 0, 0, 0, 0]]));
    v2.setupTimeTrialGhosts(L);
    assert.ok(v2.GHOSTS.activeGhosts.some((g) => g.label === 'RIVAL GHOST'));
  });

  test('a very short run still produces a code that imports', () => {
    const { v2 } = load();
    const r = v2.saveTimeTrialFinish(L, 1.5, 0);
    assert.ok(v2.importGhostCode(r.code));
  });

  test('importing a ghost switches to the mode it was recorded in', () => {
    const { v2, api } = load();
    api.G.mirror = true;
    const mirrorCode = v2.encodeGhostCode('rainbow', 50, [[0, 0, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0]]);
    api.G.mirror = false;
    const normalCode = v2.encodeGhostCode('rainbow', 50, [[0, 0, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0]]);
    v2.importGhostCode(mirrorCode);
    assert.equal(api.G.mirror, true);
    v2.setupTimeTrialGhosts(L);
    assert.ok(v2.GHOSTS.activeGhosts.some((g) => g.label === 'RIVAL GHOST'));
    v2.importGhostCode(normalCode);
    assert.equal(api.G.mirror, false);
  });

  test('a mirror-mode rival ghost is not raced on the normal track', () => {
    const { v2, api } = load();
    api.G.mirror = true;
    const code = v2.encodeGhostCode('rainbow', 50, [[0, 0, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0], [2, 2, 0, 0, 0, 0]]);
    v2.importGhostCode(code);
    v2.setCC('150cc');                 // player switches back to the normal track afterwards
    v2.setupTimeTrialGhosts(L);
    assert.ok(!v2.GHOSTS.activeGhosts.some((g) => g.label === 'RIVAL GHOST'),
      'mirrored ghost would drive a flipped line through walls on the normal track');
  });
});

describe('anti-gravity zones', () => {
  test('default spans mark the right share of the track', () => {
    const { v2 } = load();
    v2.computeAntiGrav({ id: 'rainbow' });   // [[0.06,0.32],[0.52,0.74]] of N=100
    const on = [...v2.ANTIGRAV].reduce((a, b) => a + b, 0);
    assert.equal(on, 26 + 22);
    assert.equal(v2.ANTIGRAV[5], 0);
    assert.equal(v2.ANTIGRAV[6], 1);
    assert.equal(v2.ANTIGRAV[32], 0);
  });

  test('tracks without zones are cleared, and gaps are never anti-grav', () => {
    const gaps = new Array(N).fill(0);
    gaps[10] = 1;
    const { v2 } = load({ api: { GAP: gaps } });
    v2.computeAntiGrav({ id: 'rainbow' });
    assert.equal(v2.ANTIGRAV[10], 0);
    v2.computeAntiGrav({ id: 'lava' });
    assert.equal([...v2.ANTIGRAV].reduce((a, b) => a + b, 0), 0);
  });

  test('banking is amplified but capped', () => {
    const bank = new Array(N).fill(0.25);
    const { v2 } = load({ api: { BANK: bank } });
    v2.computeAntiGrav({ id: 'space' });
    assert.equal(bank[50], 0.32);
    assert.equal(bank[1], 0.25);
  });

  test('a track-defined span overrides the default', () => {
    const { v2 } = load();
    v2.computeAntiGrav({ id: 'rainbow', antigrav: [[0.5, 0.6]] });
    assert.equal([...v2.ANTIGRAV].reduce((a, b) => a + b, 0), 10);
  });

  test('spin boost has a cooldown', () => {
    const { v2 } = load();
    const k = { boostT: 0, x: 0, y: 0, z: 0 };
    assert.equal(v2.triggerSpinBoost(k), true);
    assert.equal(v2.triggerSpinBoost(k), false);
    assert.ok(k.boostT >= 0.95);
    assert.equal(k.spinBoosts, 1);
  });

  test('hype from spin boosts never exceeds 100%', () => {
    const { v2 } = load();
    const k = { boostT: 0, hype: 0.97 };
    v2.triggerSpinBoost(k);
    assert.equal(k.hype, 1);
  });
});

describe('frontrunning music layer', () => {
  test('only when a human leads a normal race', () => {
    const { v2, api } = load({ G: { timeTrial: false } });
    api.G.humans_k = [{ rank: 0, finished: false }];
    assert.equal(v2.isFrontrunning(), true);
    api.G.humans_k[0].rank = 1;
    assert.equal(v2.isFrontrunning(), false);
    api.G.humans_k[0].rank = 0;
    api.G.timeTrial = true;
    assert.equal(v2.isFrontrunning(), false);
  });
});
