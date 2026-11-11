// Unit tests for online_client.js helpers and VirtualRoomHost (the serverless room
// authority used by the Multi-Tab and P2P online modes).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadOnlineClient } from './harness.mjs';

const T = loadOnlineClient();
const plain = (v) => JSON.parse(JSON.stringify(v)); // vm objects -> local realm for deepEqual

describe('helpers', () => {
  test('fmtTime formats m:ss.mmm and handles bad input', () => {
    assert.equal(T.fmtTime(0), '0:00.000');
    assert.equal(T.fmtTime(9.5), '0:09.500');
    assert.equal(T.fmtTime(65.4321), '1:05.432');
    assert.equal(T.fmtTime(600), '10:00.000');
    assert.equal(T.fmtTime(Infinity), '--:--.---');
    assert.equal(T.fmtTime(NaN), '--:--.---');
  });

  test('fmtTime never shows 60 seconds when rounding up', () => {
    assert.equal(T.fmtTime(59.9996), '1:00.000');
  });

  test('normCC accepts known classes in any case and falls back otherwise', () => {
    for (const cc of ['50cc', '100cc', '150cc', '200cc', 'mirror']) assert.equal(T.normCC(cc), cc);
    assert.equal(T.normCC(' 200CC '), '200cc');
    assert.equal(T.normCC('bogus'), '150cc');
    assert.equal(T.normCC(undefined, '50cc'), '50cc');
  });

  test('randomCode makes 6-char codes without ambiguous characters', () => {
    for (let i = 0; i < 500; i++) {
      const c = T.randomCode();
      assert.match(c, /^[A-HJ-NP-Z]{4}[A-HJ-NP-Z2-9]{2}$/);
    }
  });

  test('adiff returns the shortest signed angle', () => {
    const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
    near(T.adiff(0, 1), 1);
    near(T.adiff(0, -1), -1);
    near(T.adiff(3, -3), 2 * Math.PI - 6);       // wraps the short way across ±π
    near(T.adiff(0, 10 * Math.PI + 0.5), 0.5);
  });

  test('clamp, lerp and hexCss', () => {
    assert.equal(T.clamp(5, 0, 3), 3);
    assert.equal(T.clamp(-1, 0, 3), 0);
    assert.equal(T.lerp(10, 20, 0.25), 12.5);
    assert.equal(T.hexCss(0xff8a1f), '#ff8a1f');
    assert.equal(T.hexCss(0x00000f), '#00000f');
    assert.equal(T.hexCss('#abc'), '#abc');
  });

  test('escapeHtml / escapeAttr neutralise markup in player names', () => {
    assert.equal(T.escapeHtml('<img src=x onerror=alert(1)>&'), '&lt;img src=x onerror=alert(1)&gt;&amp;');
    assert.equal(T.escapeAttr('" onmouseover="x'), '&quot; onmouseover=&quot;x');
    assert.equal(T.escapeHtml(null), '');
  });

  test('getTrackIdxForCup maps cup + race to the track list (fallback data)', () => {
    T.setApi(null);
    assert.equal(T.getTrackIdxForCup(0, 0), T.FALLBACK_TRACK_IDS.indexOf('lava'));
    assert.equal(T.getTrackIdxForCup(10, 3), T.FALLBACK_TRACK_IDS.indexOf('rainbow'));
    assert.equal(T.getTrackIdxForCup(99, 99), T.FALLBACK_TRACK_IDS.indexOf('rainbow'), 'out-of-range is clamped');
  });

  test('fallback cups cover all 44 fallback tracks exactly once', () => {
    const ids = T.FALLBACK_CUPS.flatMap((c) => c.ids);
    assert.equal(T.FALLBACK_TRACK_IDS.length, 44);
    assert.deepEqual([...ids].sort(), [...T.FALLBACK_TRACK_IDS].sort());
  });
});

describe('applyDeadReckon (smoothing remote karts)', () => {
  const kart = () => ({ x: 0, y: 0, z: 0, heading: 0, moveAng: 0, speed: 0 });

  test('small corrections blend toward the predicted position', () => {
    const rk = kart();
    T.applyDeadReckon(rk, { x: 10, z: 0, vx: 0, vz: 0, _recvAt: 1000 }, 1000, 0.5);
    assert.equal(rk.x, 5);
  });

  test('extrapolates with velocity, capped at 0.18 s of lag', () => {
    const rk = kart();
    T.applyDeadReckon(rk, { x: 0, z: 0, vx: 10, vz: 0, _recvAt: 1000 }, 6000, 1);
    assert.ok(Math.abs(rk.x - 1.8) < 1e-9, `x=${rk.x}`);
  });

  test('large errors snap instead of sliding across the map', () => {
    const rk = kart();
    T.applyDeadReckon(rk, { x: 100, y: 7, z: 0, _recvAt: 0 }, 0, 0.1);
    assert.deepEqual([rk.x, rk.y], [100, 7]);
  });

  test('heading blends the short way round', () => {
    const rk = kart();
    rk.heading = 3.0;
    T.applyDeadReckon(rk, { x: 0, z: 0, heading: -3.0, _recvAt: 0 }, 0, 1);
    assert.ok(Math.abs(rk.heading - (2 * Math.PI - 3.0)) < 1e-9);
  });

  test('ignores incomplete state', () => {
    const rk = kart();
    T.applyDeadReckon(rk, { y: 3 }, 0, 1);
    assert.deepEqual(rk, kart());
  });
});

// ---------------------------------------------------------------------------
// VirtualRoomHost
// ---------------------------------------------------------------------------
function makeHost() {
  const outbox = [];
  const chars = T.FALLBACK_CHARS;
  const host = new T.VirtualRoomHost('ROOM42', (clientId, msg) => outbox.push({ to: clientId, msg: plain(msg) }),
    (cup, race) => T.getTrackIdxForCup(cup, race), () => chars);
  const sent = (to, t) => outbox.filter((o) => o.to === to && o.msg.t === t).map((o) => o.msg);
  const last = (to, t) => { const a = sent(to, t); assert.ok(a.length, `no ${t} sent to ${to}`); return a[a.length - 1]; };
  return { host, outbox, sent, last };
}

function lobby(n = 2) {
  const h = makeHost();
  h.host.handleMessage('c1', { t: 'create_room', name: 'Host', ch: 0 });
  for (let i = 2; i <= n; i++) h.host.handleMessage('c' + i, { t: 'join_room', name: 'P' + i, ch: i - 1 });
  return h;
}

describe('VirtualRoomHost lobby', () => {
  test('create_room makes p1 the host', () => {
    const { host, last } = lobby(1);
    const st = last('c1', 'room_state');
    assert.equal(st.you, 'p1');
    assert.equal(st.hostId, 'p1');
    assert.equal(host.trackIdx, T.getTrackIdxForCup(0, 0));
  });

  test('players get sequential ids and everyone sees the roster', () => {
    const { last } = lobby(3);
    assert.equal(last('c3', 'room_state').you, 'p3');
    assert.equal(last('c1', 'room_state').players.length, 3);
  });

  test('ninth player is refused', () => {
    const { host, last } = lobby(8);
    host.handleMessage('c9', { t: 'join_room' });
    assert.match(last('c9', 'error').msg, /full/);
  });

  test('guests cannot change settings or start', () => {
    const { host, last } = lobby(2);
    host.handleMessage('c2', { t: 'update_lobby', cc: '50cc', cupIdx: 4 });
    assert.equal(host.cc, '150cc');
    assert.equal(host.cupIdx, 0);
    host.handleMessage('c2', { t: 'start_cup' });
    assert.match(last('c2', 'error').msg, /Only the host/);
  });

  test('host leaving hands host to the next player', () => {
    const { host, last } = lobby(3);
    host.handleMessage('c1', { t: 'leave_room' });
    assert.equal(last('c2', 'room_state').hostId, 'p2');
  });

  test('messages from unknown clients are ignored', () => {
    const { host, outbox } = lobby(1);
    const before = outbox.length;
    host.handleMessage('stranger', { t: 'start_cup' });
    host.handleMessage('c1', null);
    host.handleMessage('c1', 'text');
    assert.equal(outbox.length, before);
  });
});

describe('VirtualRoomHost racing and scoring', () => {
  const finishAll = (h, times, ai) => {
    for (const [cid, t] of Object.entries(times)) {
      h.host.handleMessage(cid, { t: 'race_finish', finishTime: t, bestLap: t / 3, ...(cid === 'c1' && ai ? { ai } : {}) });
    }
  };

  test('start fills the grid with AI up to six racers', () => {
    const h = lobby(2);
    h.host.handleMessage('c1', { t: 'start_cup' });
    const rs = h.last('c2', 'race_start');
    assert.equal(rs.aiChars.length, 4);
    assert.ok(!rs.aiChars.includes(0) && !rs.aiChars.includes(1), 'AI must not copy human characters');
  });

  test('points follow finishing order', () => {
    const h = lobby(2);
    h.host.handleMessage('c1', { t: 'start_cup' });
    const ai = h.host.aiChars.map((ch, i) => ({ ch, time: 100 + 5 * i }));
    finishAll(h, { c1: 101, c2: 99 }, ai);
    const res = h.last('c1', 'race_results');
    assert.deepEqual(res.order.map((o) => o.id).slice(0, 3), ['p2', 'ai_' + h.host.aiChars[0], 'p1']);
    assert.deepEqual(res.order.map((o) => o.gained), plain(T.CUP_POINTS).slice(0, 6));
    assert.equal(res.isCupDone, false);
  });

  test('four races then cup_complete with the right winner', () => {
    const h = lobby(2);
    h.host.handleMessage('c1', { t: 'start_cup' });
    for (let race = 0; race < 4; race++) {
      const rs = h.last('c1', 'race_start');
      assert.equal(rs.raceIdx, race);
      assert.equal(rs.trackIdx, T.getTrackIdxForCup(0, race));
      finishAll(h, { c1: 80, c2: 85 }, rs.aiChars.map((ch) => ({ ch, time: 120 })));
      assert.equal(h.last('c1', 'race_results').isCupDone, race === 3);
      h.host.handleMessage('c1', { t: 'update_lobby', ready: true });
      h.host.handleMessage('c2', { t: 'update_lobby', ready: true });
    }
    const done = h.last('c2', 'cup_complete');
    assert.equal(done.winner.id, 'p1');
    assert.equal(done.winner.pts, 4 * T.CUP_POINTS[0]);
  });

  test('standings rank by points with humans ahead on ties', () => {
    const { host } = lobby(2);
    host.players[0].pts = 10;
    host.players[1].pts = 25;
    host.aiChars = [2, 3];
    host.aiPts = { 2: 25, 3: 3 };
    const st = plain(host.buildStandings({}));
    assert.deepEqual(st.map((e) => e.id), ['p2', 'ai_2', 'p1', 'ai_3']);
    assert.deepEqual(st.map((e) => e.rank), [1, 2, 3, 4]);
  });
});

describe('VirtualRoomHost robustness (bad or hostile input)', () => {
  test('non-numeric cup index in lobby update does not corrupt the room', () => {
    const { host } = lobby(1);
    host.handleMessage('c1', { t: 'update_lobby', cupIdx: 'abc' });
    assert.ok(Number.isInteger(host.cupIdx), `cupIdx became ${host.cupIdx}`);
  });

  test('fractional cup index is rounded to a real cup', () => {
    const { host } = lobby(1);
    host.handleMessage('c1', { t: 'update_lobby', cupIdx: 2.5 });
    assert.ok(Number.isInteger(host.cupIdx), `cupIdx became ${host.cupIdx}`);
  });

  test('non-numeric character choice does not corrupt the player', () => {
    const { host } = lobby(1);
    host.handleMessage('c1', { t: 'update_lobby', ch: 'blue' });
    assert.ok(Number.isInteger(host.players[0].ch), `ch became ${host.players[0].ch}`);
  });

  test('a missing or negative finish time cannot win', () => {
    const h = lobby(3);
    h.host.handleMessage('c1', { t: 'start_cup' });
    h.host.handleMessage('c1', { t: 'race_finish', finishTime: 95, ai: [] });
    h.host.handleMessage('c2', { t: 'race_finish' });
    h.host.handleMessage('c3', { t: 'race_finish', finishTime: -50 });
    const res = h.last('c1', 'race_results');
    assert.equal(res.order[0].id, 'p1', `winner was ${res.order[0].id} with ${res.order[0].time}`);
  });

  test('room advances when the last un-ready player leaves the results screen', () => {
    const h = lobby(3);
    h.host.handleMessage('c1', { t: 'start_cup' });
    for (const c of ['c1', 'c2', 'c3']) h.host.handleMessage(c, { t: 'race_finish', finishTime: 80, ai: [] });
    h.host.handleMessage('c1', { t: 'update_lobby', ready: true });
    h.host.handleMessage('c2', { t: 'update_lobby', ready: true });
    h.host.handleMessage('c3', { t: 'leave_room' });
    assert.equal(h.host.state, 'racing', 'stuck on results even though everyone remaining is ready');
  });
});
