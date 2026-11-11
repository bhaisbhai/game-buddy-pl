/*
 * Wheelie Fun — Online Multiplayer & Cup Tournament Client (window.WFOnline)
 *
 * Supports 3 Transport Modes with full 4-Race Cup Tournament parity:
 *   1. 'ws'  — Server Relay WebSocket (/ws-online on server.py or custom tunnel)
 *   2. 'tab' — Same-Device Multi-Tab serverless relay (BroadcastChannel('wheelie_online'))
 *   3. 'p2p' — Internet P2P WebRTC via dynamically loaded PeerJS (wf-room-<CODE>)
 */
(function () {
  'use strict';

  const CUP_POINTS = [15, 12, 10, 8, 7, 6, 5, 4, 3, 2];
  const GRACE_MS = 15000;
  const STATE_SEND_INTERVAL = 0.05; // 20 Hz kart state sync
  const AI_SYNC_INTERVAL = 0.10; // 10 Hz host AI bot sync

  const CC_LABELS = {
    '50cc': '50cc · Chill',
    '100cc': '100cc · Standard',
    '150cc': '150cc · Grand Prix',
    '200cc': '200cc · Brake-Drift!',
    'mirror': 'Mirror 150cc · Flipped!',
  };

  const EMOTE_PRESETS = {
    '1': '🔥 Nice Shot!',
    '2': '😱 Nooo!',
    '3': '⚡ Catch Me!',
    '4': '🏆 GG!',
  };

  const FALLBACK_CHARS = [
    { name: 'Blaze', kart: 0xff8a1f, blurb: 'All-rounder' },
    { name: 'Jet', kart: 0x2a7bff, blurb: 'Top-speed specialist' },
    { name: 'Spark', kart: 0xff5fa2, blurb: 'Drift specialist' },
    { name: 'Rumble', kart: 0xe8443a, blurb: 'Heavy hitter' },
    { name: 'Goldie', kart: 0x3ccf4e, blurb: 'Baby driver · rocket start' },
    { name: 'Buzzy', kart: 0xb98bff, blurb: 'Baby driver · fearless' },
    { name: 'Volt', kart: 0x00d2d3, blurb: 'Cyber-drift technician' },
    { name: 'Brick', kart: 0xd4a017, blurb: 'Turbo heavyweight brawler' },
    { name: 'Pixie', kart: 0xff6b81, blurb: 'Featherweight trickster' },
    { name: 'Zephyr', kart: 0xf4f1ea, fly: true, blurb: 'Flying ace' },
  ];

  const FALLBACK_TRACK_IDS = [
    'lava', 'mumbai', 'himalaya', 'sky', 'manteca', 'streatham',
    'dino', 'jungle', 'space', 'kitchen', 'bathroom', 'aztec',
    'beach', 'winter', 'pinball', 'reef', 'forest', 'starship',
    'glider', 'random', 'cookie', 'seasons', 'circus', 'cats',
    'scary', 'supermarket', 'pumpkins', 'connecticut', 'farm',
    'gut', 'collider', 'doomtemple', 'splash', 'dogfight',
    'rainbow', 'clockwork', 'ramen', 'tokyo', 'mtmayhem',
    'vinyl', 'origami', 'crystal', 'coaster', 'pizza',
  ];

  const FALLBACK_CUPS = [
    { id: 'wheeldeal', name: 'Wheel Deal Cup', ids: ['lava', 'mumbai', 'himalaya', 'sky'], col: '#2c1846' },
    { id: 'home', name: 'Hometown Cup', ids: ['manteca', 'streatham', 'kitchen', 'bathroom'], col: '#3a2a10' },
    { id: 'wild', name: 'Wild Cup', ids: ['dino', 'jungle', 'space', 'aztec'], col: '#10301a' },
    { id: 'holiday', name: 'Holiday Cup', ids: ['beach', 'winter', 'pinball', 'reef'], col: '#102a3a' },
    { id: 'adventure', name: 'Adventure Cup', ids: ['forest', 'starship', 'glider', 'random'], col: '#2a1a3a' },
    { id: 'spooky', name: 'Spooky Cup', ids: ['pumpkins', 'scary', 'doomtemple', 'cookie'], col: '#1a0a1a' },
    { id: 'everyday', name: 'Everyday Cup', ids: ['supermarket', 'farm', 'connecticut', 'seasons'], col: '#1a3a2a' },
    { id: 'bonkers', name: 'Bonkers Cup', ids: ['cats', 'circus', 'gut', 'collider'], col: '#3a1a2a' },
    { id: 'feast', name: 'Turbo Feast Cup', ids: ['splash', 'ramen', 'coaster', 'pizza'], col: '#4a1814' },
    { id: 'neon', name: 'Neon Groove Cup', ids: ['vinyl', 'origami', 'clockwork', 'tokyo'], col: '#1e1042' },
    { id: 'summit', name: 'Starlight Summit Cup', ids: ['dogfight', 'crystal', 'mtmayhem', 'rainbow'], col: '#0c2444' },
  ];

  const hexCss = (h) => (typeof h === 'string' ? h : '#' + (h >>> 0).toString(16).padStart(6, '0'));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function adiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function fmtTime(t) {
    if (t == null || !isFinite(t)) return '--:--.---';
    // Round to whole milliseconds first so 59.9996 becomes 1:00.000, not 0:60.000.
    const ms = Math.round(t * 1000);
    const m = Math.floor(ms / 60000);
    const s = (ms - m * 60000) / 1000;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
  }
  // Client-supplied index -> integer in [lo, hi]; non-numeric input gives `fallback`.
  function toIdx(v, lo, hi, fallback) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && v !== null && v !== '' && typeof v !== 'boolean' ? clamp(n, lo, hi) : fallback;
  }
  // Client-supplied race time -> positive finite seconds, or null if missing/invalid.
  function toTime(v) {
    const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
    return Number.isFinite(n) && n > 0 && n < 1e8 ? n : null;
  }
  function randomCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const alnum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 4; i++) out += letters[Math.floor(Math.random() * letters.length)];
    for (let i = 0; i < 2; i++) out += alnum[Math.floor(Math.random() * alnum.length)];
    return out;
  }
  function defaultWsUrl() {
    try {
      const saved = localStorage.getItem('wheeliefun.wsUrl');
      if (saved) return saved;
    } catch (e) {}
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return proto + '//' + location.host + '/ws-online';
    }
    return 'ws://localhost:8780/ws-online';
  }

  function normCC(val, fallback) {
    const k = String(val || '').trim().toLowerCase();
    return CC_LABELS[k] ? k : (fallback || '150cc');
  }

  // ==========================================================================
  // VirtualRoomHost — Serverless Room Authority for BroadcastChannel & PeerJS
  // Mirrors server.py's OnlineCupHub 1:1 so Multi-Tab & P2P work identically!
  // ==========================================================================
  class VirtualRoomHost {
    constructor(roomCode, sendToClientFn, getTrackIdxForCupFn, getCharsFn) {
      this.code = roomCode;
      this.sendToClient = sendToClientFn; // (clientId, msgObj) => void
      this.getTrackIdxForCup = getTrackIdxForCupFn;
      this.getChars = getCharsFn;
      this.hostId = 'p1';
      this.cupIdx = 0;
      this.mode = 'cup';
      this.cc = '150cc';
      this.raceIdx = 0;
      this.trackIdx = 0;
      this.state = 'lobby';
      this.seed = 0;
      this.players = []; // {id, clientId, name, ch, ready, pts, connected, inRace, finished, finishTime, bestLap, lastState}
      this.aiChars = [];
      this.aiPts = {};
      this.aiResults = null;
      this.resultsSent = false;
      this.graceTimer = null;
      this.aiWaitTimer = null;
    }

    connectedPlayers() {
      return this.players.filter((p) => p.connected);
    }

    byClient(clientId) {
      return this.players.find((p) => p.clientId === clientId) || null;
    }

    nextPlayerId() {
      if (this.players.length >= 8) {
        this.players = this.players.filter((p) => p.connected || p.pts > 0);
      }
      const used = new Set(this.players.map((p) => p.id));
      for (let i = 1; i <= 8; i++) {
        const pid = 'p' + i;
        if (!used.has(pid)) return pid;
      }
      return null;
    }

    serializePlayer(p) {
      return {
        id: p.id,
        name: p.name,
        ch: p.ch,
        ready: p.ready,
        pts: p.pts,
        connected: p.connected,
      };
    }

    roomStateFor(youId) {
      return {
        t: 'room_state',
        roomCode: this.code,
        you: youId,
        hostId: this.hostId,
        players: this.players.map((p) => this.serializePlayer(p)),
        cupIdx: this.cupIdx,
        raceIdx: this.raceIdx,
        mode: this.mode,
        cc: this.cc,
        trackIdx: this.trackIdx,
        state: this.state,
      };
    }

    broadcastRoomState() {
      for (const p of this.connectedPlayers()) {
        this.sendToClient(p.clientId, this.roomStateFor(p.id));
      }
    }

    broadcast(msg, excludePlayerId) {
      for (const p of this.connectedPlayers()) {
        if (p.id !== excludePlayerId) {
          this.sendToClient(p.clientId, msg);
        }
      }
    }

    clearTimers() {
      if (this.graceTimer) { clearTimeout(this.graceTimer); this.graceTimer = null; }
      if (this.aiWaitTimer) { clearTimeout(this.aiWaitTimer); this.aiWaitTimer = null; }
    }

    chooseAiChars(humanChars, count) {
      const target = Math.max(6, count);
      const needed = Math.max(0, target - count);
      const used = new Set(humanChars);
      const pool = [];
      for (let c = 0; c < 6; c++) if (!used.has(c)) pool.push(c);
      for (let c = 0; c < 6; c++) if (!pool.includes(c)) pool.push(c);
      return pool.slice(0, needed);
    }

    startRaceNow(resetCup) {
      const active = this.connectedPlayers();
      if (resetCup) {
        this.raceIdx = 0;
        for (const p of this.players) p.pts = 0;
        this.aiChars = this.chooseAiChars(active.map((p) => p.ch), active.length);
        this.aiPts = {};
        for (const ch of this.aiChars) this.aiPts[ch] = 0;
      } else if (!this.aiChars.length && active.length < 6) {
        this.aiChars = this.chooseAiChars(active.map((p) => p.ch), active.length);
        for (const ch of this.aiChars) if (this.aiPts[ch] == null) this.aiPts[ch] = 0;
      }

      if (this.mode === 'cup') {
        this.trackIdx = this.getTrackIdxForCup(this.cupIdx, this.raceIdx);
      }

      this.clearTimers();
      this.aiResults = null;
      this.resultsSent = false;
      this.seed = Math.floor(100000 + Math.random() * 899999999);
      for (const p of this.players) {
        p.inRace = p.connected;
        p.finished = false;
        p.finishTime = null;
        p.bestLap = null;
        p.ready = false;
      }
      this.state = 'racing';

      this.broadcast({
        t: 'race_start',
        roomCode: this.code,
        seed: this.seed,
        cupIdx: this.cupIdx,
        raceIdx: this.raceIdx,
        trackIdx: this.trackIdx,
        mode: this.mode,
        cc: this.cc,
        players: active.map((p) => this.serializePlayer(p)),
        aiChars: this.aiChars.slice(),
      });
    }

    buildStandings(lastGains) {
      const gains = lastGains || {};
      const chars = this.getChars();
      const list = [];
      for (const p of this.players) {
        if (p.connected || p.pts > 0 || p.inRace) {
          list.push({
            id: p.id,
            kind: 'human',
            name: p.name,
            ch: p.ch,
            pts: p.pts,
            lastGain: gains[p.id] || 0,
            connected: p.connected,
          });
        }
      }
      for (const ch of this.aiChars) {
        const id = 'ai_' + ch;
        list.push({
          id,
          kind: 'ai',
          name: (chars[ch] && chars[ch].name) || ('Bot ' + (ch + 1)),
          ch,
          pts: this.aiPts[ch] || 0,
          lastGain: gains[id] || 0,
          connected: true,
        });
      }
      list.sort((a, b) => (b.pts - a.pts) || (a.kind === b.kind ? 0 : a.kind === 'human' ? -1 : 1));
      list.forEach((e, i) => { e.rank = i + 1; });
      return list;
    }

    finalizeRace() {
      if (this.resultsSent || this.state !== 'racing') return;
      this.resultsSent = true;
      this.clearTimers();

      const chars = this.getChars();
      const finishedTimes = this.players
        .filter((p) => p.inRace && p.finished && p.finishTime != null)
        .map((p) => p.finishTime);
      const baseTime = finishedTimes.length ? Math.max(...finishedTimes) : 95;

      const racers = [];
      this.players.forEach((p, idx) => {
        if (!p.inRace && !p.connected) return;
        let ftime;
        let dnf = false;
        if (p.finished && p.finishTime != null) {
          ftime = +p.finishTime;
        } else {
          const prog = +(p.lastState && p.lastState.progress) || 0;
          ftime = +(baseTime + Math.max(2, 25 - Math.min(20, prog / 300)) + idx * 0.25).toFixed(3);
          dnf = true;
        }
        racers.push({
          id: p.id,
          kind: 'human',
          name: p.name,
          ch: p.ch,
          time: ftime,
          bestLap: p.bestLap,
          dnf,
          _p: p,
        });
      });

      const aiMap = {};
      if (Array.isArray(this.aiResults)) {
        for (const a of this.aiResults) {
          if (a && a.ch != null && toTime(a.time) != null) aiMap[+a.ch] = toTime(a.time);
        }
      }
      this.aiChars.forEach((ch, idx) => {
        const t = aiMap[ch] != null ? aiMap[ch] : +(baseTime + 1.9 + idx * 2.2).toFixed(3);
        racers.push({
          id: 'ai_' + ch,
          kind: 'ai',
          name: (chars[ch] && chars[ch].name) || ('Bot ' + (ch + 1)),
          ch,
          time: t,
          bestLap: null,
          dnf: false,
        });
      });

      racers.sort((a, b) => (a.time - b.time) || (a.kind === 'human' ? -1 : 1));

      const gains = {};
      const order = racers.map((r, i) => {
        const gained = i < CUP_POINTS.length ? CUP_POINTS[i] : 0;
        gains[r.id] = gained;
        let pts;
        if (r.kind === 'human') {
          r._p.pts += gained;
          pts = r._p.pts;
        } else {
          this.aiPts[r.ch] = (this.aiPts[r.ch] || 0) + gained;
          pts = this.aiPts[r.ch];
        }
        return {
          place: i + 1,
          id: r.id,
          kind: r.kind,
          name: r.name,
          ch: r.ch,
          time: +r.time.toFixed(3),
          bestLap: r.bestLap,
          dnf: r.dnf,
          gained,
          pts,
        };
      });

      for (const p of this.players) p.ready = false;
      const isCupDone = this.mode !== 'cup' || this.raceIdx >= 3;
      const standings = this.buildStandings(gains);
      this.state = 'results';

      this.broadcast({
        t: 'race_results',
        roomCode: this.code,
        cupIdx: this.cupIdx,
        raceIdx: this.raceIdx,
        trackIdx: this.trackIdx,
        isCupDone,
        order,
        standings,
      });
    }

    checkCompletion() {
      if (this.state !== 'racing' || this.resultsSent) return;
      const active = this.players.filter((p) => p.connected && p.inRace);
      if (!active.length) return;
      const anyFin = active.some((p) => p.finished);
      const allFin = active.every((p) => p.finished);
      if (allFin) {
        if (this.aiChars.length && !this.aiResults) {
          if (!this.aiWaitTimer) {
            this.aiWaitTimer = setTimeout(() => this.finalizeRace(), 60);
          }
        } else {
          this.finalizeRace();
        }
      } else if (anyFin && !this.graceTimer) {
        this.graceTimer = setTimeout(() => this.finalizeRace(), GRACE_MS);
      }
    }

    advanceNextRace() {
      if (this.mode === 'cup' && this.raceIdx + 1 < 4) {
        this.raceIdx += 1;
        this.startRaceNow(false);
      } else {
        this.clearTimers();
        this.state = 'cup_complete';
        const standings = this.buildStandings();
        this.broadcast({
          t: 'cup_complete',
          roomCode: this.code,
          cupIdx: this.cupIdx,
          standings,
          winner: standings[0] || null,
        });
      }
    }

    handleDisconnect(clientId) {
      const p = this.byClient(clientId);
      if (!p) return;
      p.connected = false;
      p.ready = false;
      const rem = this.connectedPlayers();
      if (!rem.length) {
        this.clearTimers();
        return;
      }
      if (this.hostId === p.id) {
        this.hostId = rem[0].id;
      }
      this.broadcastRoomState();
      if (this.state === 'racing') this.checkCompletion();
      else if (this.state === 'results' && rem.every((q) => q.ready)) this.advanceNextRace();
    }

    handleMessage(clientId, msg) {
      if (!msg || typeof msg !== 'object') return;
      const mt = msg.t;
      const chars = this.getChars();

      if (mt === 'create_room') {
        this.cupIdx = toIdx(msg.cupIdx, 0, FALLBACK_CUPS.length - 1, 0);
        this.mode = msg.mode === 'single' ? 'single' : 'cup';
        this.cc = normCC(msg.cc, '150cc');
        this.trackIdx = this.mode === 'cup'
          ? this.getTrackIdxForCup(this.cupIdx, 0)
          : toIdx(msg.trackIdx, 0, FALLBACK_TRACK_IDS.length - 1, 0);
        const p = {
          id: 'p1',
          clientId,
          name: String(msg.name || 'Player 1').trim().slice(0, 18) || 'Player 1',
          ch: toIdx(msg.ch, 0, chars.length - 1, 0),
          ready: false,
          pts: 0,
          connected: true,
          inRace: false,
          finished: false,
          finishTime: null,
          bestLap: null,
          lastState: {},
        };
        this.players = [p];
        this.hostId = 'p1';
        this.sendToClient(clientId, this.roomStateFor('p1'));
        return;
      }

      if (mt === 'join_room') {
        if (this.state !== 'lobby') {
          this.sendToClient(clientId, { t: 'error', msg: 'Room is currently mid-cup (' + this.state + ').' });
          return;
        }
        if (this.connectedPlayers().length >= 8) {
          this.sendToClient(clientId, { t: 'error', msg: 'Room is full (max 8 players).' });
          return;
        }
        let p = this.byClient(clientId);
        if (!p) {
          const pid = this.nextPlayerId();
          if (!pid) {
            this.sendToClient(clientId, { t: 'error', msg: 'No available player slots.' });
            return;
          }
          p = {
            id: pid,
            clientId,
            name: String(msg.name || ('Player ' + pid.slice(1))).trim().slice(0, 18),
            ch: toIdx(msg.ch, 0, chars.length - 1, this.players.length % Math.min(6, chars.length)),
            ready: false,
            pts: 0,
            connected: true,
            inRace: false,
            finished: false,
            finishTime: null,
            bestLap: null,
            lastState: {},
          };
          this.players.push(p);
        } else {
          p.connected = true;
        }
        this.broadcastRoomState();
        return;
      }

      const sender = this.byClient(clientId);
      if (!sender) return;

      if (mt === 'leave_room') {
        this.handleDisconnect(clientId);
        return;
      }

      if (mt === 'update_lobby') {
        if (msg.name != null) sender.name = String(msg.name).trim().slice(0, 18) || sender.name;
        if (msg.ch != null) sender.ch = toIdx(msg.ch, 0, chars.length - 1, sender.ch);
        if (msg.ready != null) sender.ready = !!msg.ready;
        if (sender.id === this.hostId) {
          if (msg.mode === 'cup' || msg.mode === 'single') this.mode = msg.mode;
          if (msg.cc != null) this.cc = normCC(msg.cc, this.cc);
          if (msg.cupIdx != null) {
            this.cupIdx = toIdx(msg.cupIdx, 0, FALLBACK_CUPS.length - 1, this.cupIdx);
            if (this.mode === 'cup') this.trackIdx = this.getTrackIdxForCup(this.cupIdx, 0);
          }
          if (msg.trackIdx != null) this.trackIdx = toIdx(msg.trackIdx, 0, FALLBACK_TRACK_IDS.length - 1, this.trackIdx);
          if (msg.backToLobby && this.state === 'cup_complete') {
            this.state = 'lobby';
            this.raceIdx = 0;
          }
        }
        this.broadcastRoomState();
        if (this.state === 'results') {
          const conn = this.connectedPlayers();
          if (conn.length && conn.every((q) => q.ready)) this.advanceNextRace();
        }
        return;
      }

      if (mt === 'start_cup' || mt === 'start_race') {
        if (sender.id !== this.hostId) {
          this.sendToClient(clientId, { t: 'error', msg: 'Only the host can start the Cup.' });
          return;
        }
        if (msg.mode === 'cup' || msg.mode === 'single') this.mode = msg.mode;
        if (msg.cc != null) this.cc = normCC(msg.cc, this.cc);
        if (msg.cupIdx != null) this.cupIdx = toIdx(msg.cupIdx, 0, FALLBACK_CUPS.length - 1, this.cupIdx);
        if (msg.trackIdx != null) this.trackIdx = toIdx(msg.trackIdx, 0, FALLBACK_TRACK_IDS.length - 1, this.trackIdx);
        this.startRaceNow(mt === 'start_cup' || this.state === 'lobby' || this.state === 'cup_complete');
        return;
      }

      if (mt === 'kart_state') {
        sender.lastState = msg;
        this.broadcast(Object.assign({}, msg, { t: 'kart_state', id: sender.id, ts: msg.ts || Date.now() }), sender.id);
        return;
      }

      if (mt === 'item_event') {
        this.broadcast({
          t: 'item_event',
          id: sender.id,
          ts: msg.ts || Date.now(),
          kind: msg.kind,
          data: msg.data || {},
        }, sender.id);
        return;
      }

      if (mt === 'ai_sync') {
        if (sender.id === this.hostId) {
          this.broadcast({
            t: 'ai_sync',
            id: sender.id,
            ts: msg.ts || Date.now(),
            bots: Array.isArray(msg.bots) ? msg.bots : [],
          }, sender.id);
        }
        return;
      }

      if (mt === 'ai_hit') {
        this.broadcast({
          t: 'ai_hit',
          id: sender.id,
          aiIdx: msg.aiIdx,
          ch: msg.ch,
          ts: msg.ts || Date.now(),
        }, sender.id);
        return;
      }

      if (mt === 'emote') {
        const code = String(msg.code || '1').trim().slice(0, 4);
        const text = EMOTE_PRESETS[code] || String(msg.text || '🔥 Nice Shot!').trim().slice(0, 32);
        this.broadcast({
          t: 'emote',
          id: sender.id,
          name: sender.name,
          code,
          text,
          ts: msg.ts || Date.now(),
        }, null);
        return;
      }

      if (mt === 'ai_results') {
        if (sender.id === this.hostId || !this.aiResults) {
          if (Array.isArray(msg.ai)) this.aiResults = msg.ai;
        }
        this.checkCompletion();
        return;
      }

      if (mt === 'race_finish') {
        if (this.state !== 'racing' || this.resultsSent) return;
        sender.inRace = true;
        sender.finished = true;
        // A missing/invalid time is scored as DNF, so it can never beat a real time.
        sender.finishTime = toTime(msg.finishTime);
        sender.bestLap = toTime(msg.bestLap);
        if (Array.isArray(msg.ai) && (sender.id === this.hostId || !this.aiResults)) {
          this.aiResults = msg.ai;
        }
        this.checkCompletion();
        return;
      }

      if (mt === 'next_race') {
        if (sender.id !== this.hostId) return;
        if (this.state === 'results') this.advanceNextRace();
      }
    }
  }

  // ==========================================================================
  // Main Client State
  // ==========================================================================
  let API = null;
  const clientId = 'c_' + Math.random().toString(36).slice(2, 10);

  const S = {
    initialized: false,
    transport: 'ws', // 'ws' | 'tab' | 'p2p'
    wsUrl: defaultWsUrl(),
    ws: null,
    bc: null,
    peer: null,
    peerConn: null,
    peerConns: new Map(), // clientId -> DataConnection (host)
    virtualHost: null,
    playerName: (function () {
      try { return localStorage.getItem('wheeliefun.onlineName') || 'Racer ' + Math.floor(10 + Math.random() * 89); }
      catch (e) { return 'Racer'; }
    })(),
    myChar: 0,
    cupIdx: 0,
    mode: 'cup',
    cc: '150cc',
    trackIdx: 0,
    room: null, // latest room_state
    raceInfo: null, // latest race_start
    remoteStates: new Map(), // pid -> latest kart_state + recvTs
    remoteKarts: new Map(), // pid -> Kart instance
    aiBots: [], // Kart instances for online AI bots in deterministic grid order
    aiStates: new Map(), // aiIdx -> latest bot state + _recvAt
    aiSyncAccum: 0,
    sendAccum: 0,
    sentFinish: false,
    lastItemHeld: null,
    lastItemSentAt: 0,
    spectateId: null, // pid or 'self'
    emoteHistory: [],
    statusMsg: '',
    errorMsg: '',
    autoJoinCode: null,
    serverDetected: false,
  };

  function getApi() {
    if (API) return API;
    if (window.__tiki) return window.__tiki;
    return null;
  }

  function getChars() {
    const a = getApi();
    return (a && a.CHARS) || FALLBACK_CHARS;
  }

  function getLevels() {
    const a = getApi();
    return (a && a.LEVELS) || FALLBACK_TRACK_IDS.map((id) => ({ id, name: id.toUpperCase() }));
  }

  function getCups() {
    const a = getApi();
    return (a && a.CUPS) || FALLBACK_CUPS;
  }

  function getTrackIdxForCup(cupIdx, raceIdx) {
    const cups = getCups();
    const levels = getLevels();
    const cup = cups[clamp(cupIdx, 0, cups.length - 1)] || cups[0];
    const tid = cup.ids[clamp(raceIdx, 0, cup.ids.length - 1)];
    const idx = levels.findIndex((L) => L.id === tid);
    return idx >= 0 ? idx : 0;
  }

  // ==========================================================================
  // CSS & DOM Injection — Volcanic-Purple & Lava-Amber Tiki Arcade Theme
  // ==========================================================================
  function injectUI() {
    if (!document.getElementById('wf-online-style')) {
      const st = document.createElement('style');
      st.id = 'wf-online-style';
      st.textContent = `
#online { z-index: 30; overflow-y: auto; }
.wfoCard {
  background: rgba(26,15,43,.92);
  border: 3px solid rgba(255,178,46,.32);
  border-radius: 24px;
  padding: clamp(16px,2.4vw,28px);
  max-width: 920px;
  width: 100%;
  box-sizing: border-box;
  max-height: 94vh;
  overflow-y: auto;
  box-shadow: 0 18px 50px rgba(0,0,0,.6), inset 0 0 0 2px rgba(255,255,255,.05);
}
.wfoHead { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
.wfoHead h2 { font-family:var(--display,'Bungee',sans-serif); font-size:clamp(22px,3vw,34px); color:var(--ember,#ffb22e); margin:0; text-shadow:0 4px 0 #1a0f2b; }
.wfoBadge { font-family:var(--display,'Bungee',sans-serif); font-size:12px; letter-spacing:.08em; padding:5px 11px; border-radius:999px; background:rgba(38,211,208,.18); border:2px solid var(--lagoon,#26d3d0); color:var(--lagoon,#26d3d0); }
.wfoTabs { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
.wfoTab {
  background: rgba(255,255,255,.06);
  border: 2px solid rgba(255,255,255,.14);
  border-radius: 14px;
  padding: 10px 10px;
  color: var(--cream,#fff4df);
  cursor: pointer;
  text-align: left;
  font-family: var(--body,'Fredoka',sans-serif);
  transition: transform .1s, border-color .15s, background .15s;
}
.wfoTab b { display:block; font-family:var(--display,'Bungee',sans-serif); font-size:13px; color:var(--ember,#ffb22e); margin-bottom:2px; font-weight:400; }
.wfoTab small { display:block; font-size:12px; color:var(--muted,#c9b6e4); line-height:1.25; }
.wfoTab.active { border-color:var(--lagoon,#26d3d0); background:rgba(38,211,208,.15); box-shadow:0 0 18px rgba(38,211,208,.2); }
.wfoTab.active b { color:var(--lagoon,#26d3d0); }
.wfoRow { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.wfoField { display:flex; flex-direction:column; gap:4px; flex:1; min-width:170px; }
.wfoField label { font-family:var(--display,'Bungee',sans-serif); font-size:11px; letter-spacing:.08em; color:var(--muted,#c9b6e4); }
.wfoInput, .wfoSelect {
  background: rgba(12,6,22,.78);
  border: 2px solid rgba(255,255,255,.2);
  border-radius: 12px;
  padding: 10px 12px;
  color: var(--cream,#fff4df);
  font-family: var(--body,'Fredoka',sans-serif);
  font-size: 15px;
  font-weight: 600;
  outline: none;
}
.wfoInput:focus, .wfoSelect:focus { border-color: var(--ember,#ffb22e); }
.wfoCodeIn { font-family:var(--display,'Bungee',sans-serif); letter-spacing:.14em; text-transform:uppercase; text-align:center; font-size:18px; max-width:170px; }
.wfoChars { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:7px; margin:8px 0 14px; }
.wfoCh {
  border:2px solid rgba(255,255,255,.14); border-radius:12px; background:rgba(255,255,255,.05);
  padding:7px 4px; color:var(--cream,#fff4df); cursor:pointer; font-family:var(--body,'Fredoka',sans-serif);
  font-weight:600; font-size:12px; display:flex; flex-direction:column; align-items:center; gap:5px;
}
.wfoCh i { width:26px; height:26px; border-radius:50%; display:block; box-shadow:inset 0 -4px 0 rgba(0,0,0,.3); }
.wfoCh.sel { border-color:var(--ember,#ffb22e); background:rgba(255,178,46,.18); transform:translateY(-2px); }
.wfoSplit { display:grid; grid-template-columns:1.1fr .9fr; gap:14px; margin-top:8px; }
.wfoBox { background:rgba(255,255,255,.04); border:2px solid rgba(255,255,255,.1); border-radius:16px; padding:14px; }
.wfoBox h3 { font-family:var(--display,'Bungee',sans-serif); font-weight:400; font-size:15px; color:var(--lagoon,#26d3d0); margin:0 0 8px; }
.wfoRoomBar {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;
  background:linear-gradient(90deg,rgba(255,91,31,.22),rgba(38,211,208,.16));
  border:2px solid rgba(255,178,46,.45); border-radius:16px; padding:10px 14px; margin-bottom:12px;
}
.wfoCodeBig { font-family:var(--display,'Bungee',sans-serif); font-size:clamp(22px,3.2vw,32px); letter-spacing:.14em; color:var(--ember,#ffb22e); text-shadow:0 3px 0 #1a0f2b; }
.wfoPlayers { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-bottom:12px; }
.wfoPl {
  display:flex; align-items:center; gap:9px; padding:8px 11px; border-radius:12px;
  background:rgba(255,255,255,.07); border:2px solid rgba(255,255,255,.12);
}
.wfoPl.me { border-color:var(--ember,#ffb22e); background:rgba(255,91,31,.16); }
.wfoPl .sw { width:18px; height:18px; border-radius:50%; flex-shrink:0; }
.wfoPl .nm { font-weight:700; font-size:14px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.wfoPl .tg { font-family:var(--display,'Bungee',sans-serif); font-size:10px; padding:2px 7px; border-radius:6px; background:rgba(255,255,255,.12); }
.wfoPl .tg.rdy { background:#2f9e44; color:#fff; }
.wfoPl .tg.host { background:var(--ember,#ffb22e); color:#1a0f2b; }
.wfoAlert { padding:8px 12px; border-radius:10px; font-size:13px; font-weight:600; margin-bottom:10px; }
.wfoAlert.err { background:rgba(200,32,42,.32); border:2px solid #ff5b5b; color:#ffd6d6; }
.wfoAlert.info { background:rgba(38,211,208,.16); border:2px solid var(--lagoon,#26d3d0); color:var(--cream,#fff4df); }
#wfoHudPill {
  position:fixed; top:calc(12px + env(safe-area-inset-top,0px)); right:calc(16px + env(safe-area-inset-right,0px));
  z-index:22; pointer-events:none; font-family:var(--display,'Bungee',sans-serif); font-size:12px;
  background:rgba(26,15,43,.82); border:2px solid var(--lagoon,#26d3d0); color:var(--cream,#fff4df);
  padding:6px 12px; border-radius:999px; letter-spacing:.06em; box-shadow:0 4px 12px rgba(0,0,0,.4);
}
#wfoHudPill[hidden], #wfoEmoteBar[hidden], #wfoSpecBtn[hidden] { display:none!important; }
#wfoEmoteFeed {
  position:fixed; top:calc(48px + env(safe-area-inset-top,0px)); right:calc(16px + env(safe-area-inset-right,0px));
  z-index:22; pointer-events:none; display:flex; flex-direction:column; gap:6px; align-items:flex-end;
}
.wfoEmotePop {
  background:rgba(26,15,43,.9); border:2px solid var(--ember,#ffb22e); color:var(--cream,#fff4df);
  padding:5px 12px; border-radius:999px; font-family:var(--body,'Fredoka',sans-serif); font-size:13px; font-weight:700;
  box-shadow:0 6px 16px rgba(0,0,0,.45);
}
.wfoEmotePop b { color:var(--lagoon,#26d3d0); font-family:var(--display,'Bungee',sans-serif); font-weight:400; font-size:11px; margin-right:5px; }
#wfoEmoteBar {
  position:fixed; bottom:calc(14px + env(safe-area-inset-bottom,0px)); left:50%; transform:translateX(-50%);
  z-index:22; display:flex; gap:6px; background:rgba(26,15,43,.82); border:2px solid rgba(255,255,255,.16);
  padding:4px 8px; border-radius:999px;
}
#wfoEmoteBar button {
  border:0; background:rgba(255,255,255,.08); color:var(--cream,#fff4df); border-radius:999px;
  padding:4px 9px; font-family:var(--body,'Fredoka',sans-serif); font-size:12px; font-weight:700; cursor:pointer;
}
#wfoEmoteBar button:hover { background:var(--ember,#ffb22e); color:#1a0f2b; }
#wfoSpecBtn {
  position:fixed; top:calc(52px + env(safe-area-inset-top,0px)); left:50%; transform:translateX(-50%);
  z-index:23; border:2px solid var(--ember,#ffb22e); background:rgba(26,15,43,.9); color:var(--cream,#fff4df);
  font-family:var(--display,'Bungee',sans-serif); font-size:12px; padding:7px 16px; border-radius:999px; cursor:pointer;
  box-shadow:0 6px 18px rgba(0,0,0,.5);
}
#wfoModal { z-index:35; }
@media (max-width:740px) {
  .wfoTabs, .wfoSplit, .wfoPlayers { grid-template-columns:1fr; }
  .wfoChars { grid-template-columns:repeat(4,1fr); }
}
`;
      document.head.appendChild(st);
    }

    if (!document.getElementById('online')) {
      const el = document.createElement('div');
      el.className = 'screen shade';
      el.id = 'online';
      el.hidden = true;
      document.body.appendChild(el);
    }

    if (!document.getElementById('wfoHudPill')) {
      const pill = document.createElement('div');
      pill.id = 'wfoHudPill';
      pill.hidden = true;
      document.body.appendChild(pill);
    }

    if (!document.getElementById('wfoEmoteFeed')) {
      const feed = document.createElement('div');
      feed.id = 'wfoEmoteFeed';
      document.body.appendChild(feed);
    }

    if (!document.getElementById('wfoEmoteBar')) {
      const bar = document.createElement('div');
      bar.id = 'wfoEmoteBar';
      bar.hidden = true;
      bar.innerHTML = Object.keys(EMOTE_PRESETS)
        .map((k) => `<button type="button" data-wfo-emote="${k}">[${k}] ${EMOTE_PRESETS[k]}</button>`)
        .join('');
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('[data-wfo-emote]');
        if (b) sendEmote(b.dataset.wfoEmote);
      });
      document.body.appendChild(bar);
    }

    if (!document.getElementById('wfoSpecBtn')) {
      const sb = document.createElement('button');
      sb.type = 'button';
      sb.id = 'wfoSpecBtn';
      sb.hidden = true;
      sb.addEventListener('click', () => cycleSpectator());
      document.body.appendChild(sb);
    }

    if (!document.getElementById('wfoModal')) {
      const m = document.createElement('div');
      m.className = 'screen shade';
      m.id = 'wfoModal';
      m.hidden = true;
      document.body.appendChild(m);
    }
  }

  function hideNativeScreens() {
    document.querySelectorAll('.screen').forEach((el) => {
      if (el.id !== 'online' && el.id !== 'wfoModal') el.hidden = true;
    });
  }

  function renderLobby() {
    const root = document.getElementById('online');
    if (!root) return;
    const chars = getChars();
    const cups = getCups();
    const levels = getLevels();
    const inRoom = !!S.room;

    const alertHtml = S.errorMsg
      ? `<div class="wfoAlert err">${escapeHtml(S.errorMsg)}</div>`
      : S.statusMsg
      ? `<div class="wfoAlert info">${escapeHtml(S.statusMsg)}</div>`
      : '';

    const charPickerHtml = chars.map((c, idx) => {
      const curCh = inRoom ? ((mySlot() && mySlot().ch) || 0) : S.myChar;
      return `<button type="button" class="wfoCh${curCh === idx ? ' sel' : ''}" data-wfo-ch="${idx}">
        <i style="background:${hexCss(c.kart)}"></i><span>${escapeHtml(c.name)}</span>
      </button>`;
    }).join('');

    const ccOptsHtml = (cur) => Object.keys(CC_LABELS)
      .map((k) => `<option value="${k}"${cur === k ? ' selected' : ''}>${escapeHtml(CC_LABELS[k])}</option>`)
      .join('');

    if (!inRoom) {
      root.innerHTML = `
      <div class="wfoCard">
        <div class="wfoHead">
          <h2>ONLINE CUP &amp; MULTIPLAYER</h2>
          <span class="wfoBadge">${S.serverDetected ? 'SERVER ONLINE' : 'READY TO RACE'}</span>
        </div>
        ${alertHtml}
        <div class="wfoTabs">
          <button type="button" class="wfoTab${S.transport === 'ws' ? ' active' : ''}" data-wfo-tr="ws">
            <b>1 · SERVER RELAY (WS)</b>
            <small>Fastest LAN / localhost / tunnel Cup server (/ws-online)</small>
          </button>
          <button type="button" class="wfoTab${S.transport === 'tab' ? ' active' : ''}" data-wfo-tr="tab">
            <b>2 · MULTI-TAB INSTANT</b>
            <small>Zero-setup! Open 2 tabs on this device &amp; race now</small>
          </button>
          <button type="button" class="wfoTab${S.transport === 'p2p' ? ' active' : ''}" data-wfo-tr="p2p">
            <b>3 · INTERNET P2P</b>
            <small>Serverless WebRTC via PeerJS — play anywhere online</small>
          </button>
        </div>

        <div class="wfoRow">
          <div class="wfoField">
            <label>YOUR RACER NAME</label>
            <input class="wfoInput" id="wfoNameIn" maxlength="16" value="${escapeAttr(S.playerName)}" placeholder="Your Name">
          </div>
          ${S.transport === 'ws' ? `
          <div class="wfoField" style="flex:2">
            <label>SERVER WEBSOCKET URL (LAN / NGROK / CLOUDFLARE)</label>
            <input class="wfoInput" id="wfoWsIn" value="${escapeAttr(S.wsUrl)}" placeholder="ws://localhost:8780/ws-online">
          </div>` : ''}
        </div>

        <div class="wfoField">
          <label>PICK YOUR DRIVER</label>
          <div class="wfoChars">${charPickerHtml}</div>
        </div>

        <div class="wfoSplit">
          <div class="wfoBox">
            <h3>HOST A NEW TOURNAMENT</h3>
            <div class="wfoRow">
              <div class="wfoField">
                <label>FORMAT</label>
                <select class="wfoSelect" id="wfoModeSel">
                  <option value="cup"${S.mode === 'cup' ? ' selected' : ''}>4-Race Cup Tournament</option>
                  <option value="single"${S.mode === 'single' ? ' selected' : ''}>Single Track Race</option>
                </select>
              </div>
              <div class="wfoField">
                <label>SPEED CLASS</label>
                <select class="wfoSelect" id="wfoCcSel">${ccOptsHtml(S.cc)}</select>
              </div>
            </div>
            <div class="wfoRow">
              <div class="wfoField">
                <label>${S.mode === 'cup' ? 'SELECT CUP (4 RACES)' : 'SELECT TRACK'}</label>
                ${S.mode === 'cup' ? `
                  <select class="wfoSelect" id="wfoCupSel">
                    ${cups.map((c, i) => `<option value="${i}"${S.cupIdx === i ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>` : `
                  <select class="wfoSelect" id="wfoTrackSel">
                    ${levels.map((l, i) => `<option value="${i}"${S.trackIdx === i ? ' selected' : ''}>${escapeHtml(l.name || l.id)}</option>`).join('')}
                  </select>`}
              </div>
            </div>
            <div class="btns" style="justify-content:flex-start;margin-top:8px">
              <button type="button" class="btn" id="wfoCreateBtn">Create Cup Lobby</button>
            </div>
          </div>

          <div class="wfoBox">
            <h3>JOIN WITH ROOM CODE</h3>
            <p style="font-size:13px;margin:0 0 10px;color:var(--muted)">Enter your friend's 6-letter code or open their Invite Link.</p>
            <div class="wfoRow">
              <input class="wfoInput wfoCodeIn" id="wfoJoinCodeIn" maxlength="6" placeholder="KART42" value="${escapeAttr(S.autoJoinCode || '')}">
              <button type="button" class="btn alt" id="wfoJoinBtn">Join Cup</button>
            </div>
          </div>
        </div>

        <div class="btns" style="margin-top:16px">
          <button type="button" class="btn ghost" id="wfoBackBtn">Back to Title</button>
        </div>
      </div>`;
    } else {
      const R = S.room;
      const isHost = R.you === R.hostId;
      const me = mySlot();
      const cup = cups[clamp(R.cupIdx, 0, cups.length - 1)] || cups[0];
      const curCC = normCC(R.cc, '150cc');
      const trackNames = cup.ids.map((id) => {
        const lv = levels.find((x) => x.id === id);
        return lv ? lv.name : id;
      }).join(' → ');

      const playersHtml = R.players.map((p) => {
        const ch = chars[clamp(p.ch, 0, chars.length - 1)] || chars[0];
        const badges = [];
        if (p.id === R.hostId) badges.push('<span class="tg host">HOST</span>');
        if (!p.connected) badges.push('<span class="tg">OFFLINE</span>');
        else if (p.ready) badges.push('<span class="tg rdy">READY ✓</span>');
        else badges.push('<span class="tg">LOBBY</span>');
        if (p.pts > 0) badges.push(`<span class="tg">${p.pts} PTS</span>`);
        return `<div class="wfoPl${p.id === R.you ? ' me' : ''}" style="${p.connected ? '' : 'opacity:.5'}">
          <span class="sw" style="background:${hexCss(ch.kart)}"></span>
          <span class="nm">${escapeHtml(p.name)}${p.id === R.you ? ' (You)' : ''} · <small style="opacity:.8">${escapeHtml(ch.name)}</small></span>
          ${badges.join('')}
        </div>`;
      }).join('');

      root.innerHTML = `
      <div class="wfoCard">
        <div class="wfoRoomBar">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--muted)">ROOM CODE · ${S.transport.toUpperCase()} · ${escapeHtml(CC_LABELS[curCC])}</div>
            <div class="wfoCodeBig">${escapeHtml(R.roomCode)}</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn alt" id="wfoCopyBtn" style="padding:10px 18px;font-size:14px">Copy Invite Link</button>
            <button type="button" class="btn ghost" id="wfoLeaveBtn" style="padding:10px 18px;font-size:14px">Leave Room</button>
          </div>
        </div>
        ${alertHtml}

        <div class="wfoField">
          <label>YOUR DRIVER (${escapeHtml(me ? me.name : S.playerName)})</label>
          <div class="wfoChars">${charPickerHtml}</div>
        </div>

        <div class="wfoBox" style="margin-bottom:12px">
          <h3>RACERS IN LOBBY (${R.players.filter((p) => p.connected).length}/8 HUMANS + HOST-SYNCED AI GRID)</h3>
          <div class="wfoPlayers">${playersHtml}</div>
          <div class="wfoRow" style="margin-bottom:0">
            ${isHost ? `
              <div class="wfoField">
                <label>TOURNAMENT MODE</label>
                <select class="wfoSelect" id="wfoLobbyMode">
                  <option value="cup"${R.mode === 'cup' ? ' selected' : ''}>4-Race Cup Tournament</option>
                  <option value="single"${R.mode === 'single' ? ' selected' : ''}>Single Race</option>
                </select>
              </div>
              <div class="wfoField">
                <label>SPEED CLASS</label>
                <select class="wfoSelect" id="wfoLobbyCc">${ccOptsHtml(curCC)}</select>
              </div>
              <div class="wfoField" style="flex:2">
                <label>${R.mode === 'cup' ? 'SELECTED CUP' : 'SELECTED TRACK'}</label>
                ${R.mode === 'cup' ? `
                  <select class="wfoSelect" id="wfoLobbyCup">
                    ${cups.map((c, i) => `<option value="${i}"${R.cupIdx === i ? ' selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.ids.join(', '))})</option>`).join('')}
                  </select>` : `
                  <select class="wfoSelect" id="wfoLobbyTrack">
                    ${levels.map((l, i) => `<option value="${i}"${R.trackIdx === i ? ' selected' : ''}>${escapeHtml(l.name || l.id)}</option>`).join('')}
                  </select>`}
              </div>
            ` : `
              <div style="font-size:14px;color:var(--cream)">
                <b style="color:var(--ember);font-family:var(--display)">${R.mode === 'cup' ? escapeHtml(cup.name) : escapeHtml((levels[R.trackIdx] && levels[R.trackIdx].name) || 'Track')} · ${escapeHtml(CC_LABELS[curCC])}</b>
                <div style="font-size:12px;color:var(--muted);margin-top:2px">${R.mode === 'cup' ? escapeHtml(trackNames) : 'Single Track Showdown'}</div>
              </div>
            `}
          </div>
        </div>

        <div class="btns">
          <button type="button" class="btn alt" id="wfoReadyBtn">${me && me.ready ? 'Ready! ✓ (Click to Unready)' : 'Ready Up!'}</button>
          ${isHost ? `<button type="button" class="btn" id="wfoStartBtn">${R.mode === 'cup' ? 'Start 4-Race Cup ▶' : 'Start Online Race ▶'}</button>` : ''}
        </div>
      </div>`;
    }

    bindLobbyEvents(root);
  }

  function bindLobbyEvents(root) {
    const saveIdentity = () => {
      const nmEl = root.querySelector('#wfoNameIn');
      if (nmEl) {
        S.playerName = nmEl.value.trim() || 'Racer';
        try { localStorage.setItem('wheeliefun.onlineName', S.playerName); } catch (e) {}
      }
      const wsEl = root.querySelector('#wfoWsIn');
      if (wsEl) {
        S.wsUrl = wsEl.value.trim() || defaultWsUrl();
        try { localStorage.setItem('wheeliefun.wsUrl', S.wsUrl); } catch (e) {}
      }
    };

    root.querySelectorAll('[data-wfo-tr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        saveIdentity();
        S.transport = btn.dataset.wfoTr;
        S.errorMsg = '';
        S.statusMsg = '';
        renderLobby();
      });
    });

    root.querySelectorAll('[data-wfo-ch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        saveIdentity();
        const ch = +btn.dataset.wfoCh;
        S.myChar = ch;
        if (S.room) {
          sendProtocol({ t: 'update_lobby', ch });
        } else {
          renderLobby();
        }
      });
    });

    const modeSel = root.querySelector('#wfoModeSel');
    if (modeSel) {
      modeSel.addEventListener('change', () => {
        saveIdentity();
        S.mode = modeSel.value;
        renderLobby();
      });
    }
    const ccSel = root.querySelector('#wfoCcSel');
    if (ccSel) ccSel.addEventListener('change', () => { S.cc = normCC(ccSel.value, '150cc'); });
    const cupSel = root.querySelector('#wfoCupSel');
    if (cupSel) cupSel.addEventListener('change', () => { S.cupIdx = +cupSel.value; });
    const trkSel = root.querySelector('#wfoTrackSel');
    if (trkSel) trkSel.addEventListener('change', () => { S.trackIdx = +trkSel.value; });

    const createBtn = root.querySelector('#wfoCreateBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        saveIdentity();
        createRoom({
          name: S.playerName,
          ch: S.myChar,
          cupIdx: S.cupIdx,
          mode: S.mode,
          cc: S.cc,
          trackIdx: S.trackIdx,
        });
      });
    }

    const joinBtn = root.querySelector('#wfoJoinBtn');
    const codeIn = root.querySelector('#wfoJoinCodeIn');
    if (joinBtn && codeIn) {
      const doJoin = () => {
        saveIdentity();
        const code = codeIn.value.trim().toUpperCase();
        if (!code) {
          S.errorMsg = 'Enter a 6-character Room Code first.';
          renderLobby();
          return;
        }
        joinRoom(code, { name: S.playerName, ch: S.myChar });
      };
      joinBtn.addEventListener('click', doJoin);
      codeIn.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') doJoin();
      });
    }

    root.querySelectorAll('input, select').forEach((inp) => {
      inp.addEventListener('keydown', (e) => e.stopPropagation());
    });

    const backBtn = root.querySelector('#wfoBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => closeMenu());

    const copyBtn = root.querySelector('#wfoCopyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const link = await copyInviteLink();
        copyBtn.textContent = link ? 'Copied Invite Link! ✓' : 'Link Ready in URL';
        setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = 'Copy Invite Link'; }, 1800);
      });
    }

    const leaveBtn = root.querySelector('#wfoLeaveBtn');
    if (leaveBtn) leaveBtn.addEventListener('click', () => leaveRoom());

    const lobbyMode = root.querySelector('#wfoLobbyMode');
    if (lobbyMode) {
      lobbyMode.addEventListener('change', () => {
        sendProtocol({ t: 'update_lobby', mode: lobbyMode.value });
      });
    }
    const lobbyCc = root.querySelector('#wfoLobbyCc');
    if (lobbyCc) {
      lobbyCc.addEventListener('change', () => {
        S.cc = normCC(lobbyCc.value, '150cc');
        sendProtocol({ t: 'update_lobby', cc: S.cc });
      });
    }
    const lobbyCup = root.querySelector('#wfoLobbyCup');
    if (lobbyCup) {
      lobbyCup.addEventListener('change', () => {
        sendProtocol({ t: 'update_lobby', cupIdx: +lobbyCup.value });
      });
    }
    const lobbyTrack = root.querySelector('#wfoLobbyTrack');
    if (lobbyTrack) {
      lobbyTrack.addEventListener('change', () => {
        sendProtocol({ t: 'update_lobby', trackIdx: +lobbyTrack.value });
      });
    }

    const readyBtn = root.querySelector('#wfoReadyBtn');
    if (readyBtn) {
      readyBtn.addEventListener('click', () => {
        const me = mySlot();
        sendProtocol({ t: 'update_lobby', ready: !(me && me.ready) });
      });
    }

    const startBtn = root.querySelector('#wfoStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        sendProtocol({ t: S.room && S.room.mode === 'single' ? 'start_race' : 'start_cup' });
      });
    }
  }

  function mySlot() {
    if (!S.room || !Array.isArray(S.room.players)) return null;
    return S.room.players.find((p) => p.id === S.room.you) || null;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  // ==========================================================================
  // Transport Connectors (WebSocket, BroadcastChannel, PeerJS WebRTC)
  // ==========================================================================
  function teardownTransport() {
    if (S.ws) {
      try { S.ws.onclose = null; S.ws.close(); } catch (e) {}
      S.ws = null;
    }
    if (S.bc) {
      try {
        S.bc.postMessage({ _wfo: 'disconnect', roomCode: S.room && S.room.roomCode, clientId });
        S.bc.close();
      } catch (e) {}
      S.bc = null;
    }
    if (S.peerConn) {
      try { S.peerConn.close(); } catch (e) {}
      S.peerConn = null;
    }
    for (const c of S.peerConns.values()) {
      try { c.close(); } catch (e) {}
    }
    S.peerConns.clear();
    if (S.peer) {
      try { S.peer.destroy(); } catch (e) {}
      S.peer = null;
    }
    if (S.virtualHost) {
      S.virtualHost.clearTimers();
      S.virtualHost = null;
    }
  }

  function sendProtocol(msg) {
    if (S.transport === 'ws') {
      if (S.ws && S.ws.readyState === 1) {
        S.ws.send(JSON.stringify(msg));
      }
      return;
    }
    if (S.transport === 'tab') {
      if (S.virtualHost) {
        S.virtualHost.handleMessage(clientId, msg);
      } else if (S.bc && (S.room || S.pendingRoomCode)) {
        S.bc.postMessage({
          _wfo: 'to_host',
          roomCode: (S.room && S.room.roomCode) || S.pendingRoomCode,
          clientId,
          msg,
        });
      }
      return;
    }
    if (S.transport === 'p2p') {
      if (S.virtualHost) {
        S.virtualHost.handleMessage(clientId, msg);
      } else if (S.peerConn && S.peerConn.open) {
        S.peerConn.send(msg);
      }
    }
  }

  function connectWsAndSend(initialMsg) {
    teardownTransport();
    S.statusMsg = 'Connecting to ' + S.wsUrl + '…';
    S.errorMsg = '';
    renderLobby();

    let ws;
    try {
      ws = new WebSocket(S.wsUrl);
    } catch (err) {
      S.statusMsg = '';
      S.errorMsg = 'Invalid WebSocket URL: ' + err.message;
      renderLobby();
      return;
    }
    S.ws = ws;
    ws.onopen = () => {
      S.statusMsg = '';
      ws.send(JSON.stringify(initialMsg));
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      onProtocolMessage(m);
    };
    ws.onerror = () => {
      if (!S.room) {
        S.statusMsg = '';
        S.errorMsg = 'Could not reach server at ' + S.wsUrl + '. Try Multi-Tab or Internet P2P mode!';
        renderLobby();
      }
    };
    ws.onclose = () => {
      if (S.ws === ws) {
        S.ws = null;
        if (S.room) {
          S.room = null;
          S.errorMsg = 'Disconnected from Online Server.';
          updateHudPill();
          if (!document.getElementById('online').hidden) renderLobby();
        }
      }
    };
  }

  function setupBroadcastChannel(isHost, code, initialMsg) {
    teardownTransport();
    if (typeof BroadcastChannel === 'undefined') {
      S.errorMsg = 'BroadcastChannel is not supported in this browser.';
      renderLobby();
      return;
    }
    const bc = new BroadcastChannel('wheelie_online');
    S.bc = bc;
    S.pendingRoomCode = code;

    if (isHost) {
      const host = new VirtualRoomHost(
        code,
        (targetClientId, outMsg) => {
          if (targetClientId === clientId) {
            queueMicrotask(() => onProtocolMessage(outMsg));
          } else if (S.bc) {
            S.bc.postMessage({ _wfo: 'to_client', roomCode: code, targetClientId, msg: outMsg });
          }
        },
        getTrackIdxForCup,
        getChars
      );
      S.virtualHost = host;
      bc.onmessage = (ev) => {
        const d = ev.data;
        if (!d || d.roomCode !== code) return;
        if (d._wfo === 'to_host') {
          host.handleMessage(d.clientId, d.msg);
        } else if (d._wfo === 'disconnect') {
          host.handleDisconnect(d.clientId);
        }
      };
      host.handleMessage(clientId, initialMsg);
    } else {
      S.statusMsg = 'Searching open tabs for room ' + code + '…';
      S.errorMsg = '';
      renderLobby();
      const timeout = setTimeout(() => {
        if (!S.room && S.transport === 'tab') {
          S.statusMsg = '';
          S.errorMsg = 'No host tab found for room ' + code + '. Open another tab on this browser and Create Cup first!';
          renderLobby();
        }
      }, 2200);
      bc.onmessage = (ev) => {
        const d = ev.data;
        if (!d || d.roomCode !== code) return;
        if (d._wfo === 'to_client' && d.targetClientId === clientId) {
          clearTimeout(timeout);
          S.statusMsg = '';
          onProtocolMessage(d.msg);
        }
      };
      bc.postMessage({ _wfo: 'to_host', roomCode: code, clientId, msg: initialMsg });
    }
  }

  function loadPeerJs() {
    if (window.Peer) return Promise.resolve(window.Peer);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      s.onload = () => resolve(window.Peer);
      s.onerror = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
        s2.onload = () => resolve(window.Peer);
        s2.onerror = () => reject(new Error('Could not load PeerJS from CDN.'));
        document.head.appendChild(s2);
      };
      document.head.appendChild(s);
    });
  }

  async function setupPeerJs(isHost, code, initialMsg) {
    teardownTransport();
    S.statusMsg = 'Initializing PeerJS WebRTC…';
    S.errorMsg = '';
    renderLobby();

    let PeerCtor;
    try {
      PeerCtor = await loadPeerJs();
    } catch (err) {
      S.statusMsg = '';
      S.errorMsg = err.message;
      renderLobby();
      return;
    }

    if (isHost) {
      const peerId = 'wf-room-' + code;
      const peer = new PeerCtor(peerId);
      S.peer = peer;
      const host = new VirtualRoomHost(
        code,
        (targetClientId, outMsg) => {
          if (targetClientId === clientId) {
            queueMicrotask(() => onProtocolMessage(outMsg));
          } else {
            const conn = S.peerConns.get(targetClientId);
            if (conn && conn.open) conn.send(outMsg);
          }
        },
        getTrackIdxForCup,
        getChars
      );
      S.virtualHost = host;

      peer.on('open', () => {
        S.statusMsg = '';
        host.handleMessage(clientId, initialMsg);
      });
      peer.on('connection', (conn) => {
        const cid = conn.peer;
        S.peerConns.set(cid, conn);
        conn.on('data', (data) => host.handleMessage(cid, data));
        conn.on('close', () => {
          S.peerConns.delete(cid);
          host.handleDisconnect(cid);
        });
      });
      peer.on('error', (err) => {
        S.statusMsg = '';
        S.errorMsg = 'P2P Error: ' + (err && err.message ? err.message : String(err));
        renderLobby();
      });
    } else {
      const peer = new PeerCtor();
      S.peer = peer;
      peer.on('open', () => {
        S.statusMsg = 'Connecting P2P to room ' + code + '…';
        renderLobby();
        const conn = peer.connect('wf-room-' + code, { reliable: true });
        S.peerConn = conn;
        conn.on('open', () => {
          S.statusMsg = '';
          conn.send(initialMsg);
        });
        conn.on('data', (data) => onProtocolMessage(data));
        conn.on('close', () => {
          if (S.peerConn === conn) {
            S.room = null;
            S.errorMsg = 'Host closed the P2P room.';
            updateHudPill();
            renderLobby();
          }
        });
        conn.on('error', (err) => {
          S.errorMsg = 'P2P connection error: ' + err;
          renderLobby();
        });
      });
      peer.on('error', (err) => {
        S.statusMsg = '';
        S.errorMsg = 'Could not connect to P2P room ' + code + ' (' + (err.type || err.message) + ').';
        renderLobby();
      });
    }
  }

  // ==========================================================================
  // Protocol Message Handling & Game Engine Integration
  // ==========================================================================
  function onProtocolMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'error') {
      S.statusMsg = '';
      S.errorMsg = msg.msg || 'Online error';
      renderLobby();
      return;
    }

    if (msg.t === 'room_state') {
      S.room = msg;
      if (msg.cc) S.cc = normCC(msg.cc, S.cc);
      // If host migrated to us mid-race, immediately promote synced AI bots to local host AI!
      if (msg.you === msg.hostId && S.aiBots.length) {
        for (const bot of S.aiBots) bot.isSyncedAi = false;
      }
      S.errorMsg = '';
      S.statusMsg = '';
      updateHudPill();
      const onlineEl = document.getElementById('online');
      if (msg.state === 'lobby' && onlineEl && !onlineEl.hidden) {
        renderLobby();
      }
      return;
    }

    if (msg.t === 'race_start') {
      S.raceInfo = msg;
      S.remoteStates.clear();
      S.remoteKarts.clear();
      S.aiStates.clear();
      S.aiBots = [];
      S.aiSyncAccum = 0;
      S.spectateId = null;
      S.sentFinish = false;
      S.lastItemHeld = null;
      if (msg.cc) S.cc = normCC(msg.cc, S.cc);
      if (S.room) {
        S.room.state = 'racing';
        S.room.cupIdx = msg.cupIdx;
        S.room.raceIdx = msg.raceIdx;
        S.room.trackIdx = msg.trackIdx;
        if (msg.mode) S.room.mode = msg.mode;
        if (msg.cc) S.room.cc = normCC(msg.cc, S.cc);
        if (Array.isArray(msg.players)) S.room.players = msg.players;
      }
      hideModal();
      const onlineEl = document.getElementById('online');
      if (onlineEl) onlineEl.hidden = true;
      launchSynchronizedRace(msg);
      updateHudPill();
      return;
    }

    if (msg.t === 'kart_state') {
      if (S.room && msg.id && msg.id !== S.room.you) {
        msg._recvAt = performance.now();
        S.remoteStates.set(msg.id, msg);
        const rk = S.remoteKarts.get(msg.id);
        if (rk && msg.finished) rk.finished = true;
      }
      return;
    }

    if (msg.t === 'ai_sync') {
      if (S.room && msg.id !== S.room.you && Array.isArray(msg.bots)) {
        const now = performance.now();
        for (const b of msg.bots) {
          if (b && b.i != null) {
            b._recvAt = now;
            S.aiStates.set(+b.i, b);
            const bot = S.aiBots[+b.i];
            if (bot) bot.isSyncedAi = true;
          }
        }
      }
      return;
    }

    if (msg.t === 'ai_hit') {
      if (S.room && S.room.you === S.room.hostId) {
        const api = getApi();
        const bot = (msg.aiIdx != null && S.aiBots[+msg.aiIdx]) || S.aiBots.find((b) => b.aiCharIdx === msg.ch);
        const attacker = S.remoteKarts.get(msg.id) || null;
        if (bot && api && typeof api.hit === 'function') {
          api.hit(bot, attacker);
        }
      }
      return;
    }

    if (msg.t === 'emote') {
      showEmoteBubble(msg);
      return;
    }

    if (msg.t === 'item_event') {
      if (S.room && msg.id !== S.room.you) {
        applyRemoteItemEvent(msg);
      }
      return;
    }

    if (msg.t === 'race_results') {
      if (S.room) S.room.state = 'results';
      S.spectateId = null;
      updateHudPill();
      showOnlineResultsModal(msg);
      return;
    }

    if (msg.t === 'cup_complete') {
      if (S.room) S.room.state = 'cup_complete';
      S.spectateId = null;
      updateHudPill();
      showOnlineCupCompleteModal(msg);
    }
  }

  function showEmoteBubble(msg) {
    const entry = {
      id: msg.id || '',
      name: String(msg.name || 'Racer').slice(0, 18),
      code: String(msg.code || '1'),
      text: String(msg.text || EMOTE_PRESETS['1']),
      ts: msg.ts || Date.now(),
    };
    S.emoteHistory.push(entry);
    if (S.emoteHistory.length > 30) S.emoteHistory.shift();

    const feed = document.getElementById('wfoEmoteFeed');
    if (feed) {
      const pop = document.createElement('div');
      pop.className = 'wfoEmotePop';
      pop.innerHTML = `<b>${escapeHtml(entry.name)}</b>${escapeHtml(entry.text)}`;
      feed.appendChild(pop);
      setTimeout(() => {
        pop.style.opacity = '0';
        pop.style.transition = 'opacity .3s';
        setTimeout(() => pop.remove(), 320);
      }, 2900);
    }

    const api = getApi();
    if (api && typeof api.say === 'function' && api.G && api.G.state === 'race') {
      api.say(0, entry.name.toUpperCase() + ': ' + entry.text, 1.3);
    }
    if (api && typeof api.tone === 'function') {
      try { api.tone(740, 0.06, 'triangle', 0.06, 1.2); } catch (e) {}
    }
  }

  function sendEmote(code) {
    if (!isOnline()) return false;
    const key = String(code || '1').trim();
    const text = EMOTE_PRESETS[key] || String(code).slice(0, 28);
    sendProtocol({ t: 'emote', code: key, text, ts: Date.now() });
    return true;
  }

  function onAiHit(aiKart) {
    if (!isOnline() || !aiKart) return;
    if (S.room && S.room.you === S.room.hostId) return;
    const idx = aiKart.aiBotIdx != null ? aiKart.aiBotIdx : S.aiBots.indexOf(aiKart);
    sendProtocol({ t: 'ai_hit', aiIdx: idx >= 0 ? idx : 0, ch: aiKart.aiCharIdx, ts: Date.now() });
  }

  function makeRemoteNameSprite(text, accentHex) {
    if (!window.THREE) return null;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(26,15,43,0.88)';
    ctx.strokeStyle = hexCss(accentHex || 0x26d3d0);
    ctx.lineWidth = 5;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 48, 20);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(8, 8, 240, 48);
      ctx.strokeRect(8, 8, 240, 48);
    }
    ctx.fillStyle = '#fff4df';
    ctx.font = 'bold 26px Bungee, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text || 'PLAYER').toUpperCase().slice(0, 12), 128, 34);

    const tex = new window.THREE.CanvasTexture(c);
    const mat = new window.THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new window.THREE.Sprite(mat);
    sp.scale.set(5.4, 1.35, 1);
    sp.position.set(0, 5.2, 0);
    sp.renderOrder = 12;
    return sp;
  }

  function launchSynchronizedRace(msg) {
    const api = getApi();
    if (!api || !api.G) return;
    const G = api.G;
    const chars = getChars();
    const myId = S.room ? S.room.you : 'p1';
    const hostId = S.room ? S.room.hostId : 'p1';
    const amHost = myId === hostId;
    const me = (msg.players || []).find((p) => p.id === myId) || msg.players[0] || { id: myId, ch: S.myChar, name: S.playerName };

    // Apply synchronized Speed Class / Mirror Mode BEFORE building level geometry!
    const ccMode = normCC(msg.cc || (S.room && S.room.cc), '150cc');
    if (typeof api.setCC === 'function') {
      api.setCC(ccMode);
    } else if (window.WFV2 && typeof window.WFV2.setCC === 'function') {
      window.WFV2.setCC(ccMode);
    }

    G.timeTrial = false;
    G.battle = false;
    G.death = false;
    G.deathNext = false;
    G.battleNext = false;
    G.bind = null;
    G.mode = 1;
    G.sel = [clamp(me.ch, 0, chars.length - 1)];
    G.humans = [clamp(me.ch, 0, chars.length - 1)];
    G.cup = null; // Online server owns Cup progression & scoring
    // Force rebuild if Mirror Mode changed
    G.level = -1;

    if (typeof api.startLevel === 'function') {
      api.startLevel(msg.trackIdx, true);
    }

    // Rebuild exact deterministic starting grid: AI bots ahead + Human slots in room order
    try {
      const KartCtor = api.Kart || (G.karts && G.karts[0] && G.karts[0].constructor);
      const sceneObj = api.scene || (G.karts && G.karts[0] && G.karts[0].v && G.karts[0].v.root && G.karts[0].v.root.parent);
      const spVal = api.SP || 1.7;
      const nVal = api.N || 1800;
      const wrapIdx = (i) => (((i % nVal) + nVal) % nVal);

      if (KartCtor && sceneObj) {
        for (const k of G.karts) {
          if (k.v && k.v.root && k.v.root.parent) k.v.root.parent.remove(k.v.root);
        }
        G.karts.length = 0;
        S.remoteKarts.clear();
        S.aiBots = [];

        const gridSlots = [];
        for (const aiCh of (msg.aiChars || [])) {
          gridSlots.push({ kind: 'ai', ch: clamp(aiCh, 0, chars.length - 1) });
        }
        for (const pl of (msg.players || [])) {
          gridSlots.push({
            kind: pl.id === myId ? 'local' : 'remote',
            id: pl.id,
            name: pl.name,
            ch: clamp(pl.ch, 0, chars.length - 1),
          });
        }

        gridSlots.forEach((slot, sIdx) => {
          const chObj = chars[slot.ch] || chars[0];
          const isLocal = slot.kind === 'local';
          const k = new KartCtor(chObj, isLocal, isLocal ? 0 : -1);
          if (window.WFV2 && typeof window.WFV2.applyGaragePhysics === 'function') {
            window.WFV2.applyGaragePhysics(k, window.WFV2.getPartsForKart(isLocal, 0, sIdx));
          }
          const startIdx = wrapIdx(-Math.round((10 + sIdx * 7.5) / spVal));
          k.reset(startIdx, sIdx % 2 ? -5.5 : 5.5);

          if (slot.kind === 'remote') {
            k.isRemoteHuman = true;
            k.remoteId = slot.id;
            k.remoteName = slot.name;
            k.netName = slot.name;
            const badge = makeRemoteNameSprite(slot.name, chObj.kart);
            if (badge && k.v && k.v.root) k.v.root.add(badge);
            S.remoteKarts.set(slot.id, k);
          } else if (slot.kind === 'ai') {
            k.isOnlineAi = true;
            k.aiCharIdx = slot.ch;
            k.aiBotIdx = S.aiBots.length;
            k.isSyncedAi = !amHost;
            S.aiBots.push(k);
          }
          G.karts.push(k);
        });

        G.humans_k = G.karts.filter((k) => k.human);
        const myK = G.humans_k[0];
        if (myK && api.cams && api.cams[0]) {
          const cam = api.cams[0];
          cam.yaw = myK.heading;
          cam.c.position.set(myK.x - Math.sin(myK.heading) * -40, myK.y + 40, myK.z - Math.cos(myK.heading) * -40);
        }
      }
    } catch (e) {
      // Fallback: keep native setupRace grid if custom constructor is unavailable
    }
  }

  function applyRemoteItemEvent(msg) {
    const api = getApi();
    if (!api || !api.G || !Array.isArray(api.G.karts)) return;
    const G = api.G;
    const senderKart = S.remoteKarts.get(msg.id);
    const kind = msg.kind;
    const data = msg.data || {};

    if (kind === 'hit' && data.targetId) {
      const myId = S.room && S.room.you;
      if (data.targetId === myId && G.humans_k && G.humans_k[0] && typeof api.hit === 'function') {
        api.hit(G.humans_k[0], senderKart || null);
      }
      return;
    }

    if (!senderKart || typeof api.useItem !== 'function') return;

    if (data.x != null && data.z != null) {
      senderKart.x = +data.x;
      senderKart.z = +data.z;
      if (data.y != null) senderKart.y = +data.y;
      if (data.heading != null) senderKart.heading = +data.heading;
    }

    const supportedItems = new Set([
      'goo', 'bee', 'bubble', 'ball', 'chappal', 'cloud', 'star', 'ducks',
      'tiffin', 'comet', 'bomb', 'shrink', 'paint', 'ghost', 'chomp', 'fire',
      'spring', 'sun', 'jumbo', 'slap', 'slowmo', 'flop', 'prank', 'tyres',
      'chili', 'triple', 'gold', 'rocket',
    ]);
    if (supportedItems.has(kind)) {
      const prev = senderKart.item;
      senderKart.item = kind;
      senderKart.itemN = 1;
      try {
        api.useItem(senderKart);
      } catch (e) {}
      senderKart.item = prev;
    }
  }

  function computeAiEstimates() {
    const api = getApi();
    if (!api || !api.G || !Array.isArray(api.G.karts)) return [];
    const G = api.G;
    const nVal = api.N || 1800;
    const spVal = api.SP || 1.7;
    const out = [];
    const chars = getChars();
    for (const k of G.karts) {
      if (k.human || k.isRemoteHuman) continue;
      const chIdx = k.aiCharIdx != null ? k.aiCharIdx : chars.indexOf(k.ch);
      if (chIdx < 0) continue;
      const est = k.finished
        ? k.finishTime
        : G.raceT + Math.max(0.5, ((G.laps + 1) * nVal - k.progress) * spVal / ((k.maxS || 58) * 0.92));
      out.push({ ch: chIdx, time: +est.toFixed(3) });
    }
    return out;
  }

  // ==========================================================================
  // Post-Finish Live Spectator Camera
  // ==========================================================================
  function spectateCandidates() {
    const list = [];
    for (const [pid, rk] of S.remoteKarts.entries()) {
      if (!rk.finished) list.push({ id: pid, name: rk.remoteName || pid.toUpperCase(), kart: rk });
    }
    return list;
  }

  function cycleSpectator() {
    const cands = spectateCandidates();
    if (!cands.length) {
      S.spectateId = null;
      updateHudPill();
      return null;
    }
    const ids = cands.map((c) => c.id).concat(['self']);
    const curIdx = ids.indexOf(S.spectateId);
    S.spectateId = ids[(curIdx + 1) % ids.length];
    updateHudPill();
    return S.spectateId;
  }

  function updateSpectatorCam(myKart, cam, c, dt) {
    if (!isOnline() || !S.room || S.room.state !== 'racing') return false;
    const cands = spectateCandidates();
    if (!cands.length) {
      const sb = document.getElementById('wfoSpecBtn');
      if (sb) sb.hidden = true;
      return false;
    }
    if (!S.spectateId || (S.spectateId !== 'self' && !cands.some((x) => x.id === S.spectateId))) {
      S.spectateId = cands[0].id;
    }
    const sb = document.getElementById('wfoSpecBtn');
    if (sb) {
      const target = cands.find((x) => x.id === S.spectateId);
      sb.textContent = S.spectateId === 'self' || !target
        ? '🎥 TV REPLAY · [TAB] SPECTATE RIVAL'
        : `👁 SPECTATING: ${target.name} · [TAB] SWITCH`;
      sb.hidden = false;
    }
    if (S.spectateId === 'self') return false;
    const target = cands.find((x) => x.id === S.spectateId);
    if (!target || !target.kart) return false;
    const tk = target.kart;
    const hx = Math.sin(tk.heading), hz = Math.cos(tk.heading);
    const dist = 10.2 + Math.abs(tk.speed || 0) * 0.03;
    const wantX = tk.x - hx * dist, wantY = tk.y + 4.9, wantZ = tk.z - hz * dist;
    c.position.x = lerp(c.position.x, wantX, Math.min(1, dt * 8));
    c.position.y = lerp(c.position.y, wantY, Math.min(1, dt * 8));
    c.position.z = lerp(c.position.z, wantZ, Math.min(1, dt * 8));
    c.fov = 68;
    c.lookAt(tk.x + hx * 6.5, tk.y + 2.1, tk.z + hz * 6.5);
    c.updateProjectionMatrix();
    return true;
  }

  // ==========================================================================
  // Results & Cup Complete Overlays
  // ==========================================================================
  function hideModal() {
    const m = document.getElementById('wfoModal');
    if (m) m.hidden = true;
  }

  function showOnlineResultsModal(msg) {
    const m = document.getElementById('wfoModal');
    if (!m) return;
    const nativeRes = document.getElementById('results');
    if (nativeRes) nativeRes.hidden = true;

    const chars = getChars();
    const cups = getCups();
    const levels = getLevels();
    const myId = S.room ? S.room.you : 'p1';
    const isHost = S.room && S.room.you === S.room.hostId;
    const isCup = !S.room || S.room.mode === 'cup';
    const cup = cups[clamp(msg.cupIdx || 0, 0, cups.length - 1)] || cups[0];
    const trk = levels[msg.trackIdx || 0];

    const orderRows = (msg.order || []).map((r) => {
      const ch = chars[clamp(r.ch, 0, chars.length - 1)] || chars[0];
      const tag = r.id === myId ? ' (YOU)' : r.kind === 'human' ? ' [ONLINE]' : ' [BOT]';
      return `<tr class="${r.id === myId ? 'me' : ''}">
        <td>${r.place}</td>
        <td><i style="background:${hexCss(ch.kart)}"></i>${escapeHtml(r.name)}${tag}</td>
        <td>${r.dnf ? 'DNF ' : ''}${fmtTime(r.time)}</td>
        <td class="plus">+${r.gained}</td>
      </tr>`;
    }).join('');

    const standRows = (msg.standings || []).map((s) => {
      const ch = chars[clamp(s.ch, 0, chars.length - 1)] || chars[0];
      return `<tr class="${s.id === myId ? 'me' : ''}">
        <td>${s.rank}</td>
        <td><i style="background:${hexCss(ch.kart)}"></i>${escapeHtml(s.name)}${s.id === myId ? ' (YOU)' : ''}</td>
        <td class="pts">${s.pts} pts</td>
      </tr>`;
    }).join('');

    m.innerHTML = `
      <div class="wfoCard" style="max-width:640px">
        <div class="wfoHead">
          <h2>${escapeHtml((trk && trk.name) || 'RACE')} RESULTS</h2>
          <span class="wfoBadge">${isCup ? `RACE ${(msg.raceIdx || 0) + 1} OF 4 · ${escapeHtml(cup.name)}` : 'SINGLE RACE'}</span>
        </div>
        <table class="res">${orderRows}</table>
        ${isCup ? `
          <div class="standings" style="margin:10px 0 16px">
            <h3>CUMULATIVE CUP STANDINGS</h3>
            <table class="res">${standRows}</table>
          </div>
        ` : ''}
        <div class="btns">
          ${isHost
            ? `<button type="button" class="btn" id="wfoNextRaceBtn">${msg.isCupDone ? (isCup ? 'Crown Cup Champion! 🏆' : 'Finish Showdown') : 'Next Cup Race ▶'}</button>`
            : `<button type="button" class="btn alt" id="wfoResReadyBtn">Ready for Next Race ✓</button>`}
          <button type="button" class="btn ghost" id="wfoQuitCupBtn">Leave Online</button>
        </div>
      </div>`;
    m.hidden = false;

    const nextBtn = m.querySelector('#wfoNextRaceBtn');
    if (nextBtn) nextBtn.addEventListener('click', () => nextRace());
    const rdyBtn = m.querySelector('#wfoResReadyBtn');
    if (rdyBtn) {
      rdyBtn.addEventListener('click', () => {
        rdyBtn.textContent = 'Waiting for Host / Peers… ✓';
        sendProtocol({ t: 'update_lobby', ready: true });
      });
    }
    const quitBtn = m.querySelector('#wfoQuitCupBtn');
    if (quitBtn) quitBtn.addEventListener('click', () => { leaveRoom(); closeMenu(); });
  }

  function showOnlineCupCompleteModal(msg) {
    const m = document.getElementById('wfoModal');
    if (!m) return;
    const chars = getChars();
    const cups = getCups();
    const myId = S.room ? S.room.you : 'p1';
    const isHost = S.room && S.room.you === S.room.hostId;
    const cup = cups[clamp(msg.cupIdx || 0, 0, cups.length - 1)] || cups[0];
    const winner = msg.winner || (msg.standings && msg.standings[0]);

    const rows = (msg.standings || []).map((s) => {
      const ch = chars[clamp(s.ch, 0, chars.length - 1)] || chars[0];
      const medal = s.rank === 1 ? '🥇 ' : s.rank === 2 ? '🥈 ' : s.rank === 3 ? '🥉 ' : '';
      return `<tr class="${s.id === myId ? 'me' : ''}">
        <td>${s.rank}</td>
        <td><i style="background:${hexCss(ch.kart)}"></i>${medal}${escapeHtml(s.name)}${s.id === myId ? ' (YOU)' : ''}</td>
        <td class="pts">${s.pts} pts</td>
      </tr>`;
    }).join('');

    m.innerHTML = `
      <div class="wfoCard" style="max-width:600px;text-align:center">
        <div class="wfoBadge" style="display:inline-block;margin-bottom:8px">${escapeHtml(cup.name.toUpperCase())} COMPLETE</div>
        <h2 style="font-family:var(--display);font-size:clamp(26px,3.6vw,40px);color:#ffe14a;margin:4px 0 6px;text-shadow:0 4px 0 #1a0f2b">
          🏆 ${escapeHtml(winner ? winner.name : 'CHAMPION')} WINS!
        </h2>
        <p style="color:var(--muted);margin:0 auto 14px">
          ${winner && winner.id === myId ? 'Golden Trophy claimed! You conquered all 4 races!' : 'Final tournament standings across all 4 tracks:'}
        </p>
        <table class="res" style="text-align:left">${rows}</table>
        <div class="btns" style="margin-top:16px">
          ${isHost ? `<button type="button" class="btn" id="wfoReplayCupBtn">Race Another Cup</button>` : ''}
          <button type="button" class="btn alt" id="wfoBackLobbyBtn">Return to Room Lobby</button>
          <button type="button" class="btn ghost" id="wfoExitTitleBtn">Quit to Title</button>
        </div>
      </div>`;
    m.hidden = false;

    const replayBtn = m.querySelector('#wfoReplayCupBtn');
    if (replayBtn) replayBtn.addEventListener('click', () => sendProtocol({ t: 'start_cup' }));
    const lobbyBtn = m.querySelector('#wfoBackLobbyBtn');
    if (lobbyBtn) {
      lobbyBtn.addEventListener('click', () => {
        hideModal();
        if (isHost) sendProtocol({ t: 'update_lobby', backToLobby: true });
        openMenu();
      });
    }
    const exitBtn = m.querySelector('#wfoExitTitleBtn');
    if (exitBtn) exitBtn.addEventListener('click', () => { leaveRoom(); closeMenu(); });
  }

  function updateHudPill() {
    const pill = document.getElementById('wfoHudPill');
    const emoteBar = document.getElementById('wfoEmoteBar');
    const specBtn = document.getElementById('wfoSpecBtn');
    if (!S.room || S.room.state === 'lobby') {
      if (pill) pill.hidden = true;
      if (emoteBar) emoteBar.hidden = true;
      if (specBtn) specBtn.hidden = true;
      return;
    }
    const onlineCount = (S.room.players || []).filter((p) => p.connected).length;
    const ccTag = (S.room.cc || '150cc').toUpperCase();
    const racePart = S.room.mode === 'cup' ? ` · RACE ${(S.room.raceIdx || 0) + 1}/4` : '';
    if (pill) {
      pill.textContent = `ONLINE ${S.room.roomCode} · ${ccTag} · ${onlineCount}P${racePart}`;
      pill.hidden = false;
    }
    if (emoteBar) {
      emoteBar.hidden = S.room.state !== 'racing' && S.room.state !== 'results';
    }
    if (specBtn && S.room.state !== 'racing') {
      specBtn.hidden = true;
    }
  }

  // ==========================================================================
  // Public API Actions
  // ==========================================================================
  function createRoom(opts) {
    const o = opts || {};
    const ccVal = normCC(o.cc || S.cc, '150cc');
    S.cc = ccVal;
    const msg = {
      t: 'create_room',
      name: o.name || S.playerName,
      ch: o.ch != null ? o.ch : S.myChar,
      cupIdx: o.cupIdx != null ? o.cupIdx : S.cupIdx,
      mode: o.mode || S.mode,
      cc: ccVal,
      trackIdx: o.trackIdx != null ? o.trackIdx : S.trackIdx,
    };
    if (S.transport === 'ws') {
      connectWsAndSend(msg);
    } else if (S.transport === 'tab') {
      setupBroadcastChannel(true, randomCode(), msg);
    } else {
      setupPeerJs(true, randomCode(), msg);
    }
  }

  function joinRoom(roomCode, opts) {
    const code = String(roomCode || '').trim().toUpperCase();
    const o = opts || {};
    const msg = {
      t: 'join_room',
      roomCode: code,
      name: o.name || S.playerName,
      ch: o.ch != null ? o.ch : S.myChar,
    };
    if (S.transport === 'ws') {
      connectWsAndSend(msg);
    } else if (S.transport === 'tab') {
      setupBroadcastChannel(false, code, msg);
    } else {
      setupPeerJs(false, code, msg);
    }
  }

  function leaveRoom() {
    if (S.room) {
      sendProtocol({ t: 'leave_room' });
    }
    teardownTransport();
    S.room = null;
    S.raceInfo = null;
    S.remoteStates.clear();
    S.remoteKarts.clear();
    S.aiStates.clear();
    S.aiBots = [];
    S.spectateId = null;
    hideModal();
    updateHudPill();
    const onlineEl = document.getElementById('online');
    if (onlineEl && !onlineEl.hidden) renderLobby();
  }

  async function copyInviteLink() {
    if (!S.room) return '';
    const u = new URL(location.href);
    u.searchParams.set('room', S.room.roomCode);
    u.searchParams.set('transport', S.transport);
    if (S.transport === 'ws' && S.wsUrl) {
      u.searchParams.set('ws', S.wsUrl);
    } else {
      u.searchParams.delete('ws');
    }
    const link = u.toString();
    try {
      window.history.replaceState(null, '', link);
    } catch (e) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        return link;
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return link;
    } catch (e) {
      return '';
    }
  }

  function applyDeadReckon(rk, st, now, blend) {
    if (!rk || !st || st.x == null || st.z == null) return;
    const age = clamp((now - (st._recvAt || now)) / 1000, 0, 0.18);
    const targetX = st.x + (st.vx || 0) * age;
    const targetZ = st.z + (st.vz || 0) * age;
    const dist = Math.hypot(targetX - rk.x, targetZ - rk.z);

    if (dist > 35) {
      rk.x = targetX;
      rk.y = st.y != null ? st.y : rk.y;
      rk.z = targetZ;
    } else {
      rk.x = lerp(rk.x, targetX, blend);
      if (st.y != null) rk.y = lerp(rk.y, st.y, blend);
      rk.z = lerp(rk.z, targetZ, blend);
    }
    if (st.heading != null) rk.heading += adiff(rk.heading, st.heading) * blend;
    if (st.moveAng != null) rk.moveAng += adiff(rk.moveAng, st.moveAng) * blend;
    if (st.speed != null) rk.speed = lerp(rk.speed, st.speed, blend);
    if (st.steerVis != null) rk.steerVis = st.steerVis;
    if (st.driftDir != null) rk.driftDir = st.driftDir;
    if (st.driftCharge != null) rk.driftCharge = st.driftCharge;
    if (st.boostT != null) rk.boostT = st.boostT;
    if (st.hyperT != null) rk.hyperT = st.hyperT;
    if (st.spinT != null) rk.spinT = st.spinT;
    if (st.onGround != null) rk.onGround = st.onGround;
    if (st.lap != null) rk.lap = st.lap;
    if (st.progress != null) rk.progress = st.progress;
    if (st.coins != null) rk.coins = st.coins;
    if (st.finished != null) rk.finished = !!st.finished;
    if (st.finishTime != null) rk.finishTime = st.finishTime;
    if ('item' in st) rk.item = st.item;

    if (rk.v && rk.v.root) {
      rk.v.root.position.set(rk.x, rk.y, rk.z);
    }
  }

  function tick(dt) {
    if (!isOnline()) return;
    const api = getApi();
    if (!api || !api.G) return;
    const G = api.G;

    if (G.state !== 'race' && G.state !== 'countdown' && G.state !== 'results') return;

    const myKart = G.humans_k && G.humans_k[0];
    const amHost = !!(S.room && S.room.you === S.room.hostId);

    if (myKart) {
      // Auto-detect local item usage if host game didn't explicitly invoke onLocalItem
      if (S.lastItemHeld && !myKart.item && performance.now() - S.lastItemSentAt > 90) {
        onLocalItem(S.lastItemHeld, {
          x: +myKart.x.toFixed(2),
          y: +myKart.y.toFixed(2),
          z: +myKart.z.toFixed(2),
          heading: +myKart.heading.toFixed(3),
        });
      }
      S.lastItemHeld = myKart.item || null;

      // Broadcast local kart_state at 20Hz
      S.sendAccum += dt;
      if (S.sendAccum >= STATE_SEND_INTERVAL) {
        S.sendAccum = 0;
        const vx = Math.sin(myKart.moveAng) * myKart.speed;
        const vz = Math.cos(myKart.moveAng) * myKart.speed;
        sendProtocol({
          t: 'kart_state',
          ts: Date.now(),
          x: +myKart.x.toFixed(3),
          y: +myKart.y.toFixed(3),
          z: +myKart.z.toFixed(3),
          vx: +vx.toFixed(3),
          vz: +vz.toFixed(3),
          heading: +myKart.heading.toFixed(4),
          moveAng: +myKart.moveAng.toFixed(4),
          speed: +myKart.speed.toFixed(2),
          steerVis: +(myKart.steerVis || 0).toFixed(3),
          driftDir: myKart.driftDir || 0,
          driftCharge: +(myKart.driftCharge || 0).toFixed(2),
          boostT: +(myKart.boostT || 0).toFixed(2),
          hyperT: +(myKart.hyperT || 0).toFixed(2),
          spinT: +(myKart.spinT || 0).toFixed(2),
          onGround: !!myKart.onGround,
          lap: myKart.lap || 0,
          progress: +(myKart.progress || 0).toFixed(1),
          coins: myKart.coins || 0,
          item: myKart.item || null,
          finished: !!myKart.finished,
          trail: !!(myKart.boostT > 0 || myKart.hyperT > 0),
        });
      }

      // Auto-trigger finish reporting & live spectator lock when local kart crosses finish line
      if (myKart.finished && !S.sentFinish) {
        onLocalFinish(myKart.finishTime || G.raceT, myKart.bestLap, computeAiEstimates());
      }
      if (myKart.finished && S.room && S.room.state === 'racing' && api.cams && api.cams[0]) {
        updateSpectatorCam(myKart, api.cams[0], api.cams[0].c, dt);
      }
    }

    // Host broadcasts authoritative AI bot states at 10Hz!
    if (amHost && S.aiBots.length && (G.state === 'race' || G.state === 'countdown')) {
      S.aiSyncAccum += dt;
      if (S.aiSyncAccum >= AI_SYNC_INTERVAL) {
        S.aiSyncAccum = 0;
        const bots = S.aiBots.map((bk, idx) => ({
          i: idx,
          ch: bk.aiCharIdx,
          x: +bk.x.toFixed(2),
          y: +bk.y.toFixed(2),
          z: +bk.z.toFixed(2),
          vx: +(Math.sin(bk.moveAng) * bk.speed).toFixed(2),
          vz: +(Math.cos(bk.moveAng) * bk.speed).toFixed(2),
          heading: +bk.heading.toFixed(3),
          moveAng: +bk.moveAng.toFixed(3),
          speed: +bk.speed.toFixed(2),
          steerVis: +(bk.steerVis || 0).toFixed(2),
          driftDir: bk.driftDir || 0,
          driftCharge: +(bk.driftCharge || 0).toFixed(2),
          boostT: +(bk.boostT || 0).toFixed(2),
          spinT: +(bk.spinT || 0).toFixed(2),
          onGround: !!bk.onGround,
          lap: bk.lap || 0,
          progress: +(bk.progress || 0).toFixed(1),
          finished: !!bk.finished,
          finishTime: bk.finished ? +(bk.finishTime || 0).toFixed(3) : null,
        }));
        sendProtocol({ t: 'ai_sync', ts: Date.now(), bots });
      }
    }

    // Smooth 60fps dead-reckoning & interpolation for remote human karts & host-synced AI bots
    const now = performance.now();
    const blend = Math.min(1, dt * 14);
    for (const [pid, st] of S.remoteStates.entries()) {
      applyDeadReckon(S.remoteKarts.get(pid), st, now, blend);
    }
    if (!amHost && S.aiStates.size) {
      for (const [idx, bst] of S.aiStates.entries()) {
        applyDeadReckon(S.aiBots[idx], bst, now, blend);
      }
    }
  }

  function onLocalItem(kind, data) {
    if (!isOnline() || !kind) return;
    S.lastItemSentAt = performance.now();
    const api = getApi();
    const myK = api && api.G && api.G.humans_k && api.G.humans_k[0];
    const payload = Object.assign(
      myK
        ? {
            x: +myK.x.toFixed(2),
            y: +myK.y.toFixed(2),
            z: +myK.z.toFixed(2),
            heading: +myK.heading.toFixed(3),
          }
        : {},
      data || {}
    );
    sendProtocol({ t: 'item_event', kind, data: payload, ts: Date.now() });
  }

  function onLocalFinish(time, bestLap, aiEstimates) {
    if (!isOnline() || S.sentFinish) return;
    S.sentFinish = true;
    const ai = Array.isArray(aiEstimates) ? aiEstimates : computeAiEstimates();
    if (S.room && S.room.you === S.room.hostId && ai.length) {
      sendProtocol({ t: 'ai_results', ai });
    }
    sendProtocol({
      t: 'race_finish',
      finishTime: +time || 0,
      bestLap: isFinite(bestLap) && bestLap < 1e8 ? +bestLap : null,
      ai,
    });
  }

  function isOnline() {
    return !!(S.room && S.room.roomCode);
  }

  function getRemoteInputs() {
    const out = {};
    for (const [pid, st] of S.remoteStates.entries()) {
      out[pid] = {
        steer: clamp(-(st.steerVis || 0), -1, 1),
        gas: (st.speed || 0) > 1 ? 1 : 0,
        brake: (st.speed || 0) < -0.5 ? 1 : 0,
        drift: st.driftDir ? 1 : 0,
        item: 0,
        hype: (st.hyperT || 0) > 0 ? 1 : 0,
        state: st,
      };
    }
    return out;
  }

  function openMenu(api) {
    if (api) API = api;
    init(API);
    hideModal();
    hideNativeScreens();
    const a = getApi();
    if (a && a.G) a.G.state = 'online';
    const el = document.getElementById('online');
    if (el) {
      el.hidden = false;
      renderLobby();
    }
  }

  function closeMenu() {
    hideModal();
    const el = document.getElementById('online');
    if (el) el.hidden = true;
    const a = getApi();
    if (a && typeof a.quit === 'function' && a.G && a.G.state !== 'title' && a.G.state !== 'online') {
      a.quit();
    } else {
      const titleEl = document.getElementById('title');
      if (titleEl) titleEl.hidden = false;
      if (a && a.G) a.G.state = 'title';
    }
  }

  function startCup() {
    sendProtocol({ t: 'start_cup' });
  }

  function nextRace() {
    sendProtocol({ t: 'next_race' });
  }

  async function detectBestTransport() {
    const params = new URLSearchParams(location.search);
    const urlTr = params.get('transport');
    const urlWs = params.get('ws');
    const urlRoom = params.get('room');

    if (urlWs) S.wsUrl = urlWs;
    if (urlTr && ['ws', 'tab', 'p2p'].includes(urlTr)) {
      S.transport = urlTr;
    } else if (location.protocol === 'http:' || location.protocol === 'https:') {
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        if (res.ok) {
          S.serverDetected = true;
          S.transport = 'ws';
        } else {
          S.transport = 'tab';
        }
      } catch (e) {
        S.transport = 'tab';
      }
    } else {
      S.transport = 'tab';
    }

    if (urlRoom && /^[A-Z0-9]{4,8}$/i.test(urlRoom.trim())) {
      S.autoJoinCode = urlRoom.trim().toUpperCase();
      setTimeout(() => {
        openMenu();
        joinRoom(S.autoJoinCode, { name: S.playerName, ch: S.myChar });
      }, 350);
    }
  }

  function init(api) {
    if (api) API = api;
    if (S.initialized) return;
    S.initialized = true;
    injectUI();
    window.addEventListener('keydown', (e) => {
      if (!isOnline() || !S.room || S.room.state === 'lobby') return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
        sendEmote(e.code.slice(-1));
      } else if (e.code === 'Tab' && S.room.state === 'racing') {
        const a = getApi();
        const mk = a && a.G && a.G.humans_k && a.G.humans_k[0];
        if (mk && mk.finished) {
          e.preventDefault();
          cycleSpectator();
        }
      }
    });
    window.addEventListener('beforeunload', () => teardownTransport());
    detectBestTransport();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  window.WFOnline = {
    init,
    openMenu,
    closeMenu,
    tick,
    onLocalItem,
    onLocalFinish,
    onAiHit,
    sendEmote,
    cycleSpectator,
    updateSpectatorCam,
    getSpectatedId: () => S.spectateId,
    getEmoteHistory: () => S.emoteHistory.slice(),
    getAiBots: () => S.aiBots.slice(),
    isOnline,
    getRemoteInputs,
    getRoomState: () => S.room,
    isHost: () => !!(S.room && S.room.you === S.room.hostId),
    setTransport: (mode, wsUrl) => {
      if (['ws', 'tab', 'p2p'].includes(mode)) S.transport = mode;
      if (wsUrl) S.wsUrl = wsUrl;
    },
    createRoom,
    joinRoom,
    leaveRoom,
    startCup,
    nextRace,
    copyInviteLink,
  };
})();
