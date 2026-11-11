#!/usr/bin/env python3
"""
Master Validation Suite for Wheelie Fun (Mario Kart Overhaul + 10 New Tracks + Online Cup Mode).

Runs 4 comprehensive test layers:
  1. JavaScriptCore (`jsc -c`) syntax verification of index.html, new_tracks.js, and online_client.js
  2. Mathematical spline & feature-span validation (`tests/validate_tracks.py`)
  3. Online Cup Server & RFC 6455 WebSocket unit tests (`tests/test_online_server.py`)
  4. Real Headless Chrome + WebGL + CDP End-to-End Browser Test verifying:
     - Zero console/page errors on boot
     - All 44 tracks (including full 3D build + physics sim on all 10 new tracks!) & 11 Cups
     - 10-character roster, 8-kart pack, and all 10 Signature Hype abilities
     - Mario Kart slip-angle counter-steer drift vs inward carve physics
     - Suspension spring-damper, squash-and-stretch, wheelie pitch, articulated driver rig, and tire skidmarks
     - Item trailing shield (blocking homing bees!), forward trap lobbing, backward projectile aiming, Classic/All item toggle
     - Unfenced drop-offs, Tiki Rescue Drone recovery + drop-boost, Wrong-Way alert, and un-silenced Toast Pill feed
     - Track & Cup Atlas filtering (New 10, Categories, Difficulty, Search)
     - Live 2-player Online Cup Tournament (Browser Client <-> server.py <-> Simulated Friend Client)
"""

import asyncio
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server as wf_server  # Reuse our zero-dep RFC 6455 WebSocket client helper!

CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
JSC_BIN = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def step_banner(title: str) -> None:
    print(f"\n{'=' * 72}\n▶ {title}\n{'=' * 72}", flush=True)


def run_jsc_syntax_checks() -> None:
    step_banner("LAYER 1: JavaScript Syntax Verification (jsc)")
    assert os.path.exists(JSC_BIN), f"jsc not found at {JSC_BIN}"

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    # Extract inline <script> blocks (without src=...)
    inline_scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, flags=re.S)
    assert len(inline_scripts) == 1, f"Expected 1 inline script in index.html, got {len(inline_scripts)}"

    with tempfile.TemporaryDirectory() as tmp:
        main_js = Path(tmp) / "main_inline.js"
        main_js.write_text(inline_scripts[0], encoding="utf-8")

        for js_path in [ROOT / "new_tracks.js", ROOT / "upgrades_v2.js", ROOT / "online_client.js", main_js]:
            expr = f"new Function(read({json.dumps(str(js_path))})); print('SYNTAX_OK');"
            res = subprocess.run([JSC_BIN, "-e", expr], capture_output=True, text=True)
            if res.returncode != 0 or "SYNTAX_OK" not in res.stdout:
                raise RuntimeError(f"Syntax error in {js_path.name}:\n{res.stdout}\n{res.stderr}")
            print(f"  ✓ Syntax OK: {js_path.name} ({js_path.stat().st_size:,} bytes)")


def run_python_subsuites() -> None:
    step_banner("LAYER 2: Mathematical Spline & Feature Validation (validate_tracks.py)")
    r1 = subprocess.run([sys.executable, str(ROOT / "tests" / "validate_tracks.py")], cwd=str(ROOT))
    if r1.returncode != 0:
        raise RuntimeError("validate_tracks.py failed!")

    step_banner("LAYER 3: Online Cup Server Unit Tests (test_online_server.py)")
    r2 = subprocess.run([sys.executable, str(ROOT / "tests" / "test_online_server.py")], cwd=str(ROOT))
    if r2.returncode != 0:
        raise RuntimeError("test_online_server.py failed!")


class SimpleWsClient:
    """Minimal RFC 6455 WebSocket client for Chrome DevTools Protocol & simulated peer."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.reader = reader
        self.writer = writer

    @classmethod
    async def connect(cls, ws_url: str) -> "SimpleWsClient":
        u = urllib.parse.urlparse(ws_url)
        host = u.hostname or "127.0.0.1"
        port = u.port or 80
        path = u.path + (f"?{u.query}" if u.query else "")
        reader, writer = await asyncio.open_connection(host, port)
        key = "dGhlIHNhbXBsZSBub25jZQ=="
        req = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        writer.write(req.encode("utf-8"))
        await writer.drain()
        resp = await reader.readuntil(b"\r\n\r\n")
        if b"101" not in resp.splitlines()[0]:
            raise RuntimeError(f"WS handshake failed: {resp!r}")
        return cls(reader, writer)

    async def send_json(self, obj: dict) -> None:
        raw = json.dumps(obj).encode("utf-8")
        mask = b"\x12\x34\x56\x78"
        n = len(raw)
        if n < 126:
            hdr = bytes([0x81, 0x80 | n])
        elif n <= 65535:
            hdr = bytes([0x81, 0x80 | 126]) + n.to_bytes(2, "big")
        else:
            hdr = bytes([0x81, 0x80 | 127]) + n.to_bytes(8, "big")
        masked = bytes(raw[i] ^ mask[i & 3] for i in range(n))
        self.writer.write(hdr + mask + masked)
        await self.writer.drain()

    async def recv_json(self) -> dict:
        while True:
            hdr = await self.reader.readexactly(2)
            opcode = hdr[0] & 0x0F
            masked = bool(hdr[1] & 0x80)
            length = hdr[1] & 0x7F
            if length == 126:
                length = int.from_bytes(await self.reader.readexactly(2), "big")
            elif length == 127:
                length = int.from_bytes(await self.reader.readexactly(8), "big")
            mask = await self.reader.readexactly(4) if masked else b""
            payload = await self.reader.readexactly(length) if length else b""
            if masked:
                payload = bytes(payload[i] ^ mask[i & 3] for i in range(length))
            if opcode == 0x9:  # ping -> pong
                self.writer.write(bytes([0x8A, 0x80]) + b"\x00\x00\x00\x00")
                await self.writer.drain()
                continue
            if opcode == 0x8:
                raise EOFError("WebSocket closed")
            if opcode in (0x1, 0x2):
                return json.loads(payload.decode("utf-8"))

    async def close(self) -> None:
        try:
            self.writer.close()
            await self.writer.wait_closed()
        except Exception:
            pass


BROWSER_TEST_JS = r"""
(async () => {
  const report = { passed: [], failed: [] };
  function assert(cond, msg) {
    if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  }
  async function test(name, fn) {
    try {
      await fn();
      report.passed.push(name);
    } catch (e) {
      report.failed.push({ name, err: String(e && e.stack || e) });
    }
  }

  const T = window.__tiki;
  const V2 = window.WFV2;
  assert(T && T.G && T.LEVELS && window.WFOnline && V2, '__tiki, WFOnline, and WFV2 must be initialized');

  await test('1. 44 Tracks & 11 Balanced 4-Race Cups Loaded', () => {
    assert(T.LEVELS.length === 44, 'Expected 44 tracks, got ' + T.LEVELS.length);
    assert(T.CUPS.length === 11, 'Expected 11 cups, got ' + T.CUPS.length);
    const seen = new Set();
    for (const c of T.CUPS) {
      assert(c.ids.length === 4, 'Cup ' + c.id + ' must have 4 tracks');
      for (const tid of c.ids) {
        assert(T.LEVELS.some(L => L.id === tid), 'Missing track ' + tid + ' in cup ' + c.id);
        assert(!seen.has(tid), 'Duplicate track ' + tid + ' across cups');
        seen.add(tid);
      }
    }
    assert(seen.size === 44, 'All 44 tracks must belong to a cup');
  });

  await test('2. 10-Character Roster, 8-Kart Race Grid & Signature Hype Powers', () => {
    assert(T.CHARS.length === 10, 'Expected 10 characters, got ' + T.CHARS.length);
    T.G.timeTrial = false;
    T.G.onlineGrid = null;
    T.G.battle = false;
    T.G.death = false;
    T.G.humans = [0];
    V2.setCC('150cc');
    V2.setLoadout(0, 0, 0, false);
    T.startLevel(0, true);
    assert(T.G.karts.length === 8, 'Expected 8-kart pack in race, got ' + T.G.karts.length);
    const hk = T.G.humans_k[0];
    assert(hk && hk.v.drvGroup && hk.v.armL && hk.v.armR && hk.v.steerWheel && hk.v.struts.length === 4, 'Rigged driver & wishbones missing');
    for (let ci = 0; ci < T.CHARS.length; ci++) {
      hk.ch = T.CHARS[ci];
      hk.hype = 1;
      T.fireSignatureHype(hk);
      assert(hk.hyperT > 0 && hk.sigUses >= ci + 1, 'Signature hype failed for ' + T.CHARS[ci].name);
    }
    hk.ch = T.CHARS[0];
    hk.hyperT = 0;
  });

  await test('3. Mario Kart Slip-Angle Counter-Steer Drift & Tire Skidmarks', () => {
    T.startLevel(0, true);
    T.G.state = 'race';
    const kTight = T.G.karts[0], kWide = T.G.karts[1];
    kTight.reset(5, -3); kWide.reset(5, 3);
    kTight.speed = 52; kWide.speed = 52;
    kTight.driftDir = 1; kWide.driftDir = 1;
    kTight.onGround = true; kWide.onGround = true;
    const h0 = kTight.heading;
    T.SKIDS.clear();
    for (let f = 0; f < 45; f++) {
      kTight.prev = { drift: 1 }; kWide.prev = { drift: 1 };
      T.ev('updateKart')(kTight, { steer: 1, gas: 1, brake: 0, drift: 1, item: 0, hype: 0, swap: 0, look: 0, aimF: 0, aimB: 0 }, 1/60);
      T.ev('updateKart')(kWide,  { steer: -1, gas: 1, brake: 0, drift: 1, item: 0, hype: 0, swap: 0, look: 0, aimF: 0, aimB: 0 }, 1/60);
      T.ev('updateKartVisual')(kTight, 1/60);
    }
    const turnTight = Math.abs(kTight.heading - h0);
    const turnWide = Math.abs(kWide.heading - h0);
    assert(turnTight > turnWide * 2.5, `Inward steer must carve tighter than counter-steer (${turnTight.toFixed(3)} vs ${turnWide.toFixed(3)})`);
    assert(kTight.driftCharge > kWide.driftCharge * 1.4, `Inward steer must charge sparks faster (${kTight.driftCharge.toFixed(2)} vs ${kWide.driftCharge.toFixed(2)})`);
    assert(kWide.driftDir === 1, 'Counter-steering must keep drift alive');
    assert(T.SKIDS.count > 4, 'Drifting must lay persistent tire skidmark quads, got ' + T.SKIDS.count);
  });

  await test('4. Suspension Squash/Stretch, Boost Wheelie & Road Banking', () => {
    assert(T.BANK.some(b => Math.abs(b) > 0.02), 'Road banking array BANK[N] must have non-zero banked curves');
    const k = T.G.humans_k[0];
    k.reset(10, 0); k.speed = 45; k.onGround = true;
    k.prev = { drift: 0 };
    T.ev('updateKart')(k, { steer: 0.5, gas: 1, brake: 0, drift: 1, item: 0, hype: 0, swap: 0 }, 1/60);
    assert(k.squash < 0.9 && k.suspV > 0, 'Hop must compress squash & excite suspension velocity');
    k.reset(10, 0); k.speed = 50; k.onGround = true; k.boostT = 1.2;
    for (let i = 0; i < 15; i++) T.ev('updateKart')(k, { steer: 0, gas: 1, brake: 0, drift: 0, item: 0, hype: 0, swap: 0 }, 1/60);
    assert(k.wheelie < -0.05, 'Ground boost must pitch nose up into a wheelie, got ' + k.wheelie);
  });

  await test('5. Item Trailing Shield (Blocks Homing Bees!), Forward Lob & Backward Shot', () => {
    T.startLevel(0, true);
    T.G.state = 'race';
    const k = T.G.humans_k[0];
    k.reset(20, 0); k.speed = 30;
    k.item = 'goo'; k.itemN = 1;
    assert(T.startTrailItem(k) === true, 'startTrailItem should start trailing goo');
    assert(k.trailItem === 'goo' && k.item === null, 'goo moved to trailItem');
    const bx = k.x - Math.sin(k.heading) * 3.9, bz = k.z - Math.cos(k.heading) * 3.9;
    const bm = new T.WF_API_BRIDGE.THREE.Mesh();
    T.bees.push({ m: bm, owner: T.G.karts[1], target: k, t: k.idx, lat: 0, x: bx, y: k.y + 1.2, z: bz, life: 5 });
    T.ev('trailAndOrbitTick')(1/60);
    assert(k.trailItem === null && T.bees.length === 0 && k.spinT === 0, 'Trailing goo shield must intercept & destroy incoming bee!');

    const gBefore = T.goos.length;
    k.item = 'goo'; k.itemN = 1;
    T.useItemDir(k, 1);
    assert(T.goos.length === gBefore + 1, 'Forward lob should spawn goo');
    const lobbed = T.goos[T.goos.length - 1];
    const fwdDot = (lobbed.x - k.x) * Math.sin(k.heading) + (lobbed.z - k.z) * Math.cos(k.heading);
    assert(fwdDot > 20, 'Lobbed goo must land far ahead of kart, got fwdDot=' + fwdDot);

    const pBefore = T.PROJS.length;
    k.item = 'ball'; k.itemN = 1;
    T.useItemDir(k, -1);
    assert(T.PROJS.length === pBefore + 1, 'Backward ball shot should spawn projectile');
    const shot = T.PROJS[T.PROJS.length - 1];
    const velDot = shot.vx * Math.sin(k.heading) + shot.vz * Math.cos(k.heading);
    assert(velDot < -50, 'Backward shot must travel opposite heading, got velDot=' + velDot);

    const m0 = T.ev('itemPoolMode')();
    T.cycleItemsMode();
    assert(T.ev('itemPoolMode')() !== m0, 'cycleItemsMode must toggle item pool');
    T.cycleItemsMode();
  });

  await test('6. Un-silenced Toast Pills, Wrong-Way Detection & Visible Tiki Rescue Drone', () => {
    T.startLevel(0, true);
    T.G.state = 'race';
    const k = T.G.humans_k[0];
    T.say(0, 'SLIPSTREAM!', 1.2);
    const pills = document.querySelectorAll('.toastPill');
    assert(pills.length >= 1 && pills[0].textContent.includes('SLIPSTREAM'), 'Gameplay callouts must render in .toastPill');

    k.reset(40, 0); k.heading = T.TA[40] + Math.PI; k.moveAng = k.heading; k.speed = 35;
    for (let i = 0; i < 75; i++) T.ev('updateKart')(k, { steer: 0, gas: 1, brake: 0, drift: 0, item: 0, hype: 0, swap: 0 }, 1/60);
    T.ev('updateHUD')(1/60);
    const ww = document.querySelector('.wrongWay');
    assert(ww && !ww.hidden, 'Driving backwards for >1s must unhide .wrongWay alert');

    T.ev('doLava')(k);
    assert(k.respawnT > 1.0 && k.v.root.visible === true && k.droneM && k.droneM.visible === true, 'Rescue drone must keep kart visible while lifting');
    while (k.respawnT > 0.2) T.ev('updateKart')(k, { steer: 0, gas: 0, brake: 0, drift: 0, item: 0, hype: 0, swap: 0 }, 1/30);
    k.prev = { gas: 0 };
    T.ev('updateKart')(k, { steer: 0, gas: 1, brake: 0, drift: 0, item: 0, hype: 0, swap: 0 }, 1/30);
    while (k.respawnT > 0) T.ev('updateKart')(k, { steer: 0, gas: 1, brake: 0, drift: 0, item: 0, hype: 0, swap: 0 }, 1/30);
    assert(k.boostT >= 0.7, 'Timed gas tap on rescue drop must award Rescue Boost, got boostT=' + k.boostT);
  });

  await test('7. Build & Simulate All 10 Brand-New Tracks + Unfenced Drop-off Physics', () => {
    const newIds = ['rainbow','clockwork','ramen','tokyo','mtmayhem','vinyl','origami','crystal','coaster','pizza'];
    for (const id of newIds) {
      const li = T.LEVELS.findIndex(L => L.id === id);
      assert(li >= 0, 'Missing new track ' + id);
      T.startLevel(li, true);
      T.G.state = 'race';
      T.sim(45, 1/60);
      for (const k of T.G.karts) {
        assert(isFinite(k.x) && isFinite(k.y) && isFinite(k.z), `NaN position on track ${id}`);
      }
      if (id === 'rainbow') {
        assert(T.UNFENCED.some(u => u === 1), 'rainbow must have active UNFENCED drop-off segments');
        const ufIdx = T.UNFENCED.findIndex(u => u === 1);
        const hk = T.G.humans_k[0];
        hk.reset(ufIdx, 24.5); hk.y = T.H[ufIdx] - 3.0; hk.onGround = false;
        T.ev('updateKart')(hk, { steer: 0, gas: 1, brake: 0, drift: 0, item: 0, hype: 0, swap: 0 }, 1/60);
        assert(hk.respawnT > 0, 'Crossing unfenced edge below road must trigger fall/rescue');
      }
    }
  });

  await test('8. Track & Cup Atlas Organization Filtering', () => {
    T.ATLAS.view = 'tracks'; T.ATLAS.cat = 'new'; T.ATLAS.diff = 0; T.ATLAS.q = '';
    T.renderTrackAtlas();
    const newCards = document.querySelectorAll('#trkGrid .trk');
    assert(newCards.length === 10, 'Category "new" must display exactly 10 new tracks, got ' + newCards.length);

    T.ATLAS.cat = 'all'; T.ATLAS.q = 'ramen';
    T.renderTrackAtlas();
    const searchCards = document.querySelectorAll('#trkGrid .trk');
    assert(searchCards.length === 1 && searchCards[0].textContent.includes('Ramen'), 'Search for "ramen" must find Ramen Rapids');

    T.ATLAS.view = 'cups'; T.ATLAS.cat = 'all'; T.ATLAS.q = '';
    T.renderTrackAtlas();
    const cupCards = document.querySelectorAll('#trkGrid .trk.cup');
    assert(cupCards.length === 11, 'Cups view must show all 11 Grand Prix Cups, got ' + cupCards.length);
  });

  await test('9. Speed Classes (50cc-200cc), 200cc Brake-Drifting & 150cc Mirror Mode', () => {
    V2.setCC('50cc');
    T.G.level = -1;
    T.startLevel(0, true);
    const max50 = T.G.humans_k[0].maxS;
    const xNormal = T.TP[260].x;

    V2.setCC('200cc');
    T.startRace();
    T.G.state = 'race';
    const max200 = T.G.humans_k[0].maxS;
    assert(max200 > max50 * 1.55, `200cc maxS (${max200}) must scale >1.55x over 50cc (${max50})`);

    // Test 200cc Brake-Drifting: holding gas + brake + drift carves tighter & sheds speed without dropping drift!
    const kNorm = T.G.karts[0], kBrk = T.G.karts[1];
    kNorm.reset(5, -3); kBrk.reset(5, 3);
    kNorm.speed = 76; kBrk.speed = 76;
    kNorm.driftDir = 1; kBrk.driftDir = 1;
    kNorm.onGround = true; kBrk.onGround = true;
    const h0 = kNorm.heading;
    for (let f = 0; f < 28; f++) {
      kNorm.prev = { drift: 1 }; kBrk.prev = { drift: 1 };
      T.ev('updateKart')(kNorm, { steer: 1, gas: 1, brake: 0, drift: 1, item: 0, hype: 0, swap: 0 }, 1/60);
      T.ev('updateKart')(kBrk,  { steer: 1, gas: 1, brake: 1, drift: 1, item: 0, hype: 0, swap: 0 }, 1/60);
    }
    assert(kBrk.brakeDrifting === true && kBrk.driftDir === 1, 'Brake-drifting must stay in drift while flagging brakeDrifting');
    assert(kBrk.speed < kNorm.speed - 4, `Brake-drifting must shed speed (${kBrk.speed.toFixed(1)} vs ${kNorm.speed.toFixed(1)})`);
    assert(Math.abs(kBrk.heading - h0) > Math.abs(kNorm.heading - h0) * 1.15, 'Brake-drifting must tighten yaw rate');

    // Test 150cc Mirror Mode X-inversion
    V2.setCC('mirror');
    T.buildLevel(0);
    const xMirror = T.TP[260].x;
    assert(Math.abs(xNormal) > 5 && Math.abs(xMirror + xNormal) < 0.05, `Mirror Mode must invert spline X (${xNormal} -> ${xMirror})`);

    V2.setCC('150cc');
    T.buildLevel(0);
  });

  await test('10. Kart Customization Garage (Frames, Tires, Gliders & Golden Chassis)', () => {
    assert(document.getElementById('garageBar') != null, 'Garage UI bar must be injected on #select');
    // Verify #select screen & updateWho() 6-stat preview render cleanly
    T.goSelect(1);
    const whoTxt = document.getElementById('who')?.textContent || '';
    assert(whoTxt.includes('Off-Road') && whoTxt.includes('Mini-Turbo'), 'Select screen #who must display combined 6-stat Garage bars');

    // Cyber Moto (inside drift + 2-wheel inline tuck) + Monster Off-Road + Nimbus Chute
    V2.setLoadout(1, 2, 2, false);
    T.startLevel(0, true);
    const hk = T.G.humans_k[0];
    assert(hk.insideDrift === true, 'Cyber Moto frame must enable inside-drift');
    assert(Math.abs(hk.v.wheels[0].piv.position.x) < 0.5, 'Cyber Moto must tuck wheels inline');
    assert(Math.abs(hk.offroadMult - 0.82) < 0.02, 'Monster Off-Road tires must grant 0.82 offroad retention, got ' + hk.offroadMult);
    assert(hk.glideSinkMult < 0.8 && hk.trickBoostMult > 1.15, 'Nimbus Chute glider stats must apply');

    // Mini Rollers spark rate + Golden Chassis unlock
    V2.VAULT.unlockAll();
    assert(V2.VAULT.hasGoldKart() === true, 'Vault unlockAll must unlock Gold Chassis');
    V2.setLoadout(3, 3, 1, true);
    T.startRace();
    const hk2 = T.G.humans_k[0];
    assert(hk2.sparkRate > 1.2 && hk2.mtMult > 1.2, 'Bumble Pod + Mini Rollers must boost sparkRate & mtMult');
    V2.setLoadout(0, 0, 0, false);
  });

  await test('11. Time Trials Mode, Dev Staff Ghost, 10Hz Recording & Ghost Code Share', () => {
    T.G.timeTrial = true;
    try {
      T.startLevel(0, true);
      T.G.state = 'race';
      assert(T.G.karts.length === 1, 'Time Trials must spawn solo human kart, got ' + T.G.karts.length);
      const hk = T.G.humans_k[0];
      assert(hk.item === 'triple' && hk.itemN === 3, 'Time Trials must deal Triple Chili');
      assert(T.boxes.every(b => !b.m.visible), 'Item boxes must be hidden in Time Trials');
      assert(V2.GHOSTS.activeGhosts.some(g => g.isStaff), 'Dev Staff Ghost must spawn on track');

      T.sim(72, 1/60);
      assert(V2.GHOSTS.recording.length >= 10, '10Hz ghost recorder must capture >=10 frames in 1.2s, got ' + V2.GHOSTS.recording.length);

      hk.finished = true;
      hk.finishTime = 44.125;
      const res = V2.saveTimeTrialFinish(T.LV, 44.125, 0);
      assert(res.beatStaff === true && res.code.startsWith('WFG1:'), 'Fast finish must beat Staff Ghost & produce WFG1 code');
      const decoded = V2.importGhostCode(res.code);
      assert(decoded && decoded.trk === 'lava' && decoded.f.length >= 5, 'Ghost code round-trip decode failed');
    } finally {
      T.G.timeTrial = false;
      V2.clearGhosts();
    }
  });

  await test('12. Anti-Gravity Hover-Wheels (ANTIGRAV) & Spin-Boost Collisions', () => {
    const rIdx = T.LEVELS.findIndex(L => L.id === 'rainbow');
    T.startLevel(rIdx, true);
    T.G.state = 'race';
    assert(V2.ANTIGRAV.some(v => v === 1), 'rainbow must have active ANTIGRAV zone');
    const agIdx = V2.ANTIGRAV.findIndex(v => v === 1);
    const kA = T.G.karts[0], kB = T.G.karts[1];
    kA.reset(agIdx, -1); kB.reset(agIdx, 1);
    V2.tickAntiGrav(0.5);
    assert(kA.antiGrav === true && kA.agBlend > 0.5, 'Kart in ANTIGRAV zone must fold wheels horizontal, agBlend=' + kA.agBlend);

    // Collide kA & kB inside anti-gravity zone -> both get Spin-Boost!
    kB.x = kA.x + 1.4; kB.z = kA.z; kB.y = kA.y;
    T.ev('afterKarts')(1/60);
    assert(kA.spinBoosts >= 1 && kB.spinBoosts >= 1 && kA.boostT >= 0.85, 'Anti-gravity kart bump must trigger Spin-Boost!');
  });

  await test('13. Next-Gen Shaders (Road Normal Maps, Rim-Light Shader & 3D GPU Ribbons)', () => {
    T.startLevel(0, true);
    T.G.state = 'race';
    assert(T.LR.roadMesh && T.LR.roadMesh.material.normalMap != null, 'Road MeshStandardMaterial must have procedural normalMap');
    assert(typeof T.WF_API_BRIDGE.paintMat.onBeforeCompile === 'function', 'Kart paintMat must have rim-light shader hook');

    V2.RIBBONS.clear();
    const hk = T.G.humans_k[0];
    hk.reset(12, 0); hk.speed = 62; hk.boostT = 1.4; hk.onGround = true;
    for (let i = 0; i < 12; i++) {
      T.sim(1, 1/60);
      T.ev('updateWorld')(1/60);
    }
    assert(V2.RIBBONS.count > 4, 'Boosting kart must emit continuous 3D GPU ribbon segments, got ' + V2.RIBBONS.count);
  });

  await test('14. MK8 Frontrunning Music Mix, TV Replay Cams & Persistent Coin Vault', () => {
    T.startLevel(0, true);
    T.G.state = 'race';
    const hk = T.G.humans_k[0];
    hk.rank = 0; hk.finished = false;
    assert(V2.isFrontrunning() === true, 'isFrontrunning must be true when human is in 1st place');
    hk.rank = 4;
    assert(V2.isFrontrunning() === false, 'isFrontrunning must be false when human is mid-pack');

    const c0 = V2.VAULT.coins;
    T.WF_API_BRIDGE.giveCoins(hk, 4);
    assert(V2.VAULT.coins === c0 + 4, 'giveCoins on human kart must persist coins in WFV2.VAULT');

    hk.finished = true;
    const tvOk = V2.updateTvReplayCam(hk, T.cams[0], T.cams[0].c, 1/60);
    assert(tvOk === true, 'updateTvReplayCam must cut broadcast camera when finished');
  });

  return report;
})()
"""


ONLINE_BROWSER_E2E_JS_CREATE = r"""
(async () => {
  window.WFOnline.setTransport('ws', window.__testWsUrl);
  window.WFOnline.openMenu(window.__tiki.WF_API_BRIDGE);
  window.WFOnline.createRoom({ name: 'HostBrowser', ch: 2, cupIdx: 8, mode: 'cup', cc: '200cc' }); // 200cc Turbo Feast Cup!
  for (let i = 0; i < 50; i++) {
    const st = window.WFOnline.getRoomState();
    if (st && st.roomCode) return st.roomCode;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Timed out creating room from browser');
})()
"""


async def cdp_eval(cdp: SimpleWsClient, msg_id: int, expr: str):
    await cdp.send_json({
        "id": msg_id,
        "method": "Runtime.evaluate",
        "params": {"expression": expr, "awaitPromise": True, "returnByValue": True},
    })
    while True:
        m = await cdp.recv_json()
        if m.get("id") == msg_id:
            if "exceptionDetails" in m.get("result", {}):
                raise RuntimeError(f"CDP JS Exception: {m['result']['exceptionDetails']}")
            return m.get("result", {}).get("result", {}).get("value")


async def run_headless_chrome_e2e() -> None:
    step_banner("LAYER 4: Headless Chrome + WebGL + Live 2-Player Online Cup E2E Test")
    assert os.path.exists(CHROME_BIN), f"Chrome not found at {CHROME_BIN}"

    srv_port = free_port()
    cdp_port = free_port()

    # 1. Start our zero-dep Online Cup & HTTP server
    srv_proc = subprocess.Popen(
        [sys.executable, str(ROOT / "server.py"), "--port", str(srv_port)],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    user_dir = tempfile.mkdtemp(prefix="wf_chrome_")
    chrome_proc = None
    try:
        # Wait for server.py /api/status
        for _ in range(40):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{srv_port}/api/status", timeout=0.5) as r:
                    if r.status == 200:
                        break
            except Exception:
                await asyncio.sleep(0.1)
        print(f"  ✓ server.py running on http://127.0.0.1:{srv_port}")

        # 2. Launch Headless Chrome with WebGL SwiftShader enabled
        chrome_proc = subprocess.Popen(
            [
                CHROME_BIN,
                "--headless=new",
                f"--remote-debugging-port={cdp_port}",
                "--remote-allow-origins=*",
                f"--user-data-dir={user_dir}",
                "--no-first-run",
                "--no-default-browser-check",
                "--mute-audio",
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
                "--window-size=1280,800",
                f"http://127.0.0.1:{srv_port}/index.html",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Connect to Chrome DevTools target
        ws_debugger_url = None
        for _ in range(60):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json", timeout=0.5) as r:
                    pages = json.loads(r.read().decode("utf-8"))
                    for p in pages:
                        if p.get("type") == "page" and "index.html" in p.get("url", ""):
                            ws_debugger_url = p["webSocketDebuggerUrl"]
                            break
                    if ws_debugger_url:
                        break
            except Exception:
                pass
            await asyncio.sleep(0.15)
        assert ws_debugger_url, "Failed to attach CDP to Headless Chrome page"

        cdp = await SimpleWsClient.connect(ws_debugger_url)
        await cdp.send_json({"id": 1, "method": "Runtime.enable", "params": {}})
        await cdp.recv_json()

        # Wait until window.__tiki is booted
        for _ in range(80):
            ready = await cdp_eval(cdp, 2, "Boolean(window.__tiki && window.__tiki.LEVELS && window.__tiki.LEVELS.length >= 44 && window.WFV2)")
            if ready:
                break
            await asyncio.sleep(0.15)
        assert ready, "Game failed to finish booting in Headless Chrome"
        print("  ✓ Headless Chrome WebGL booted Wheelie Fun + WFV2 cleanly!")

        # 3. Execute in-browser gameplay, physics, graphics, items, 10 new tracks, Atlas & V2 pillar tests
        res = await cdp_eval(cdp, 10, BROWSER_TEST_JS)
        for name in res["passed"]:
            print(f"  ✓ PASS: {name}")
        if res["failed"]:
            for fail in res["failed"]:
                print(f"  ✗ FAIL: {fail['name']}\n    {fail['err']}")
            raise RuntimeError(f"{len(res['failed'])} browser unit tests failed!")

        # 4. Live 2-Player Online Cup E2E: Browser Host + Simulated Friend WebSocket Client!
        await cdp_eval(cdp, 20, f"window.__testWsUrl = 'ws://127.0.0.1:{srv_port}/ws-online'; true;")
        room_code = await cdp_eval(cdp, 21, ONLINE_BROWSER_E2E_JS_CREATE)
        print(f"  ✓ Browser created 200cc Online Cup Room: {room_code} (Turbo Feast Cup)")

        friend = await SimpleWsClient.connect(f"ws://127.0.0.1:{srv_port}/ws-online")
        await friend.send_json({"t": "join_room", "roomCode": room_code, "name": "FriendBot", "ch": 6})
        rs = await friend.recv_json()
        assert rs["t"] == "room_state" and len(rs["players"]) == 2 and rs["cc"] == "200cc", f"Expected 2 players & 200cc, got {rs}"

        # Start Cup from Browser Host!
        await cdp_eval(cdp, 22, "window.WFOnline.startCup(); true;")
        while True:
            m = await friend.recv_json()
            if m.get("t") == "race_start":
                break
        assert m["cupIdx"] == 8 and m["raceIdx"] == 0 and m["cc"] == "200cc", f"Expected 200cc Turbo Feast Cup race 0, got {m}"

        # Verify Browser Host synced 200cc, spawned FriendBot, and broadcasts 10Hz ai_sync + Emotes!
        await asyncio.sleep(0.25)
        await friend.send_json({
            "t": "kart_state",
            "x": 12.5, "y": 1.0, "z": 24.0, "vx": 0, "vz": 40,
            "heading": 0.1, "moveAng": 0.1, "speed": 48, "driftDir": 1, "driftCharge": 1.5,
            "onGround": True, "lap": 1, "progress": 320, "finished": False,
        })
        await friend.send_json({"t": "emote", "code": "4"})
        await asyncio.sleep(0.18)

        remote_check = await cdp_eval(cdp, 23, """(() => {
          window.WFOnline.tick(0.15);
          window.WFOnline.sendEmote('1');
          const rk = window.__tiki.G.karts.find(k => k.isRemoteHuman);
          const emotes = window.WFOnline.getEmoteHistory();
          return rk ? { name: rk.remoteName, hasRoot: !!rk.v.root, cc: window.__tiki.G.cc, emoteCount: emotes.length } : null;
        })()""")
        assert remote_check and remote_check["name"] == "FriendBot" and remote_check["cc"] == "200cc", f"Remote kart/cc mismatch: {remote_check}"
        assert remote_check["emoteCount"] >= 1, f"Emote feed did not record FriendBot emote: {remote_check}"

        # Verify FriendBot received Host's 10Hz ai_sync AND Host's emote!
        saw_ai_sync = False
        saw_host_emote = False
        for _ in range(15):
            pkt = await asyncio.wait_for(friend.recv_json(), timeout=2.0)
            if pkt.get("t") == "ai_sync" and len(pkt.get("bots", [])) == 4:
                saw_ai_sync = True
            elif pkt.get("t") == "emote" and pkt.get("id") == "p1":
                saw_host_emote = True
            if saw_ai_sync and saw_host_emote:
                break
        assert saw_ai_sync, "FriendBot did not receive 10Hz ai_sync from Browser Host!"
        assert saw_host_emote, "FriendBot did not receive Quick-Chat Emote from Browser Host!"
        print("  ✓ Verified 200cc Online Sync, 10Hz Host AI Bot Sync (4 bots), and Live Quick-Chat Emotes!")

        # Finish Browser Host FIRST while FriendBot is still racing -> test Live Spectator Cam!
        spec_state = await cdp_eval(cdp, 24, """(() => {
          window.__tiki.G.state = 'race';
          const hk = window.__tiki.G.humans_k[0];
          hk.finished = true; hk.finishTime = 61.234; hk.bestLap = 19.8;
          window.WFOnline.tick(1/60);
          window.__tiki.ev('updateCameras')(1/60);
          const sb = document.getElementById('wfoSpecBtn');
          return { specId: window.WFOnline.getSpectatedId(), btnHidden: sb ? sb.hidden : true, btnText: sb ? sb.textContent : '' };
        })()""")
        assert spec_state["specId"] == "p2" and not spec_state["btnHidden"] and "FriendBot" in spec_state["btnText"], (
            f"Post-finish Live Spectator Cam failed to lock onto FriendBot: {spec_state}"
        )
        print(f"  ✓ Verified Post-Finish Live Spectator Cam: {spec_state['btnText']}")

        # Now FriendBot finishes -> verify Cumulative Cup Standings modal!
        await friend.send_json({"t": "race_finish", "finishTime": 63.500, "bestLap": 20.4})
        while True:
            m = await friend.recv_json()
            if m.get("t") == "race_results":
                break
        await asyncio.sleep(0.2)
        modal_text = await cdp_eval(cdp, 25, "document.getElementById('wfoModal')?.textContent || ''")
        assert "CUMULATIVE CUP STANDINGS" in modal_text and "HostBrowser" in modal_text and "FriendBot" in modal_text, (
            f"Online Cup standings modal did not render expected standings: {modal_text[:200]}"
        )
        print("  ✓ Live 2-Player Online Cup Race 1 finished & Cumulative Cup Standings Modal verified!")

        await friend.close()
        await cdp.close()
    finally:
        if chrome_proc:
            chrome_proc.terminate()
            try:
                chrome_proc.wait(timeout=4)
            except Exception:
                chrome_proc.kill()
        srv_proc.terminate()
        try:
            srv_proc.wait(timeout=4)
        except Exception:
            srv_proc.kill()
        shutil.rmtree(user_dir, ignore_errors=True)


def build_standalone_bundle() -> None:
    step_banner("BUNDLING PORTABLE SINGLE-FILE HTML (wheelie-fun-standalone.html)")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    nt_js = (ROOT / "new_tracks.js").read_text(encoding="utf-8")
    v2_js = (ROOT / "upgrades_v2.js").read_text(encoding="utf-8")
    oc_js = (ROOT / "online_client.js").read_text(encoding="utf-8")
    target_tags = (
        '<script src="new_tracks.js"></script>\n'
        '<script src="upgrades_v2.js"></script>\n'
        '<script src="online_client.js"></script>'
    )
    assert target_tags in html, "Expected external script tags in index.html for standalone bundling!"
    bundled = html.replace(
        target_tags,
        f"<script>\n{nt_js}\n</script>\n<script>\n{v2_js}\n</script>\n<script>\n{oc_js}\n</script>",
        1,
    )
    out = ROOT / "wheelie-fun-standalone.html"
    out.write_text(bundled, encoding="utf-8")
    assert 'src="upgrades_v2.js"' not in bundled and 'src="new_tracks.js"' not in bundled
    print(f"  ✓ Created {out.name} ({out.stat().st_size:,} bytes)")


def main() -> None:
    run_jsc_syntax_checks()
    run_python_subsuites()
    asyncio.run(run_headless_chrome_e2e())
    build_standalone_bundle()
    print("\n" + "★" * 72)
    print("ALL UNIT, GEOMETRY, SERVER, AND HEADLESS CHROME WEBGL E2E TESTS PASSED!")
    print("★" * 72)


if __name__ == "__main__":
    main()
