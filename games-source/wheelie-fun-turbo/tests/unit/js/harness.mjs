// Test harness: loads Wheelie Fun browser scripts into an isolated Node `vm` sandbox
// with minimal browser stubs, so their pure logic can be unit tested without a browser.
// Game source files are never modified; internals are exposed by appending a test-only
// export line to the in-memory copy of the source.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** A tiny in-memory key/value store matching the game's `store` helper (get/set). */
export function memoryStore(initial = {}) {
  const data = { ...initial };
  return { data, get: (k) => (k in data ? data[k] : null), set: (k, v) => { data[k] = String(v); } };
}

/** Very small DOM stand-in: every element accepts any property/method call. */
function fakeElement() {
  const el = {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [], innerHTML: '', textContent: '', hidden: false,
    appendChild(c) { this.children.push(c); return c; }, append() {}, prepend() {}, remove() {},
    insertAdjacentHTML() {}, insertAdjacentElement() {}, setAttribute() {}, getAttribute: () => null,
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    dispatch(type, ev) { for (const fn of this.listeners[type] || []) fn(ev); },
    removeEventListener() {}, querySelector: () => fakeElement(),
    querySelectorAll: () => [], closest: () => null, focus() {}, click() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  return el;
}

export function makeSandbox({ readyState = 'loading', localStorage = {}, ids = [] } = {}) {
  const elements = new Map(ids.map((id) => [id, Object.assign(fakeElement(), { id })]));
  const created = [];
  const document = {
    readyState,
    body: fakeElement(), head: fakeElement(), documentElement: fakeElement(),
    createElement: () => { const el = fakeElement(); created.push(el); return el; },
    getElementById: (id) => elements.get(id) || created.find((e) => e.id === id) || null,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  const ls = memoryStore(localStorage);
  const sandbox = {
    console, Math, JSON, Date, Promise, Array, Object, String, Number, Boolean, Set, Map, RegExp, Error,
    isFinite, isNaN, parseInt, parseFloat, escape, unescape, encodeURIComponent, decodeURIComponent,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => { if (!/^[A-Za-z0-9+/=\s]*$/.test(s)) throw new Error('InvalidCharacterError'); return Buffer.from(s, 'base64').toString('binary'); },
    setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => 0,
    document,
    location: { protocol: 'file:', host: '', href: 'file:///game.html', search: '', hash: '' },
    localStorage: { getItem: ls.get, setItem: ls.set, removeItem: (k) => { delete ls.data[k]; } },
    navigator: { userAgent: 'node-test', clipboard: { writeText: async () => {} } },
    addEventListener() {}, removeEventListener() {},
    __elements: elements,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

/** Run `src` in the sandbox, appending `exportLine` just before the last `})();` (end of the IIFE). */
export function runWithExport(ctx, src, exportLine, filename) {
  const marker = src.lastIndexOf('})();');
  if (marker < 0) throw new Error(`No IIFE terminator in ${filename}`);
  const patched = src.slice(0, marker) + '\n' + exportLine + '\n' + src.slice(marker);
  vm.runInContext(patched, ctx, { filename });
  return ctx;
}

/** Load online_client.js and expose its internal helpers + VirtualRoomHost. */
export function loadOnlineClient() {
  const ctx = makeSandbox();
  runWithExport(ctx, read('online_client.js'), `window.__T = { VirtualRoomHost, fmtTime, normCC, randomCode,
    adiff, clamp, lerp, hexCss, escapeHtml, escapeAttr, getTrackIdxForCup, applyDeadReckon,
    CUP_POINTS, CC_LABELS, EMOTE_PRESETS, FALLBACK_CHARS, FALLBACK_TRACK_IDS, FALLBACK_CUPS,
    GRACE_MS, S, setApi: (a) => { API = a; } };`, 'online_client.js');
  return ctx.__T;
}

/**
 * A do-anything stand-in for three.js objects and engine helpers: every property read returns
 * another stub, and it can be called or constructed. Lets 3D setup code run harmlessly.
 */
export function anything() {
  const target = function () {};
  const cache = new Map();
  const handler = {
    get(t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'then') return undefined; // not a Promise
      if (prop === Symbol.iterator) return function* () {};
      if (!cache.has(prop)) cache.set(prop, anything());
      return cache.get(prop);
    },
    set(t, prop, v) { cache.set(prop, v); return true; },
    apply: () => anything(),
    construct: () => anything(),
  };
  return new Proxy(target, handler);
}

/** Load upgrades_v2.js and call registerWheelieV2 with a stub engine API. */
export function loadUpgradesV2({ store = memoryStore(), G = {}, extraApi = {} } = {}) {
  // 'grid' is where the garage bar gets injected; seeding it lets tests click garage buttons.
  const ctx = makeSandbox({ readyState: 'complete', ids: ['grid'] });
  vm.runInContext(read('upgrades_v2.js'), ctx, { filename: 'upgrades_v2.js' });
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const base = {
    THREE: anything(), G: { mirror: false, ...G }, scene: { add() {}, remove() {} }, cams: [], CHARS: [], LEVELS: [], CUPS: [], FEAT: {},
    clamp, lerp: (a, b, t) => a + (b - a) * t, toward: (a, b, s) => a, adiff: (a, b) => b - a,
    wrapI: (i) => i, R: Math.random, rr: (a, b) => a + Math.random() * (b - a), rng: () => Math.random,
    fmt: (t) => String(t), store,
    N: 100, SURF: [], CURV: [], TA: [], H: [], LW: [], DIST: [], ...extraApi,
  };
  // Any engine helper we did not define explicitly becomes a harmless stub.
  const api = new Proxy(base, { get: (t, p) => (p in t ? t[p] : (t[p] = anything())) });
  const v2 = ctx.registerWheelieV2(api);
  return { v2, api, store, ctx };
}
