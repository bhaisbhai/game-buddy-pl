#!/usr/bin/env python3
"""
Wheelie Fun — Zero-Dependency HTTP + Online Cup + Phone Controller Server.

Runs with standard library Python 3 only (`/usr/bin/python3 server.py`):
  - Static HTTP server on `/` (serves Wheelie Fun game files)
  - Mobile gamepad web app on `/pad`
  - Phone controller WebSocket relay on `/ws?role=game|phone`
  - Online Multiplayer & 4-Race Cup Tournament WebSocket server on `/ws-online`
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import math
import mimetypes
import os
import pathlib
import random
import socket
import struct
import time
import urllib.parse
from typing import Any, Dict, List, Optional

ROOT_DIR = pathlib.Path(__file__).resolve().parent
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_FRAME_BYTES = 16 * 1024 * 1024

CUP_POINTS = [15, 12, 10, 8, 7, 6, 5, 4, 3, 2]

VALID_CC = ("50cc", "100cc", "150cc", "200cc", "mirror")

EMOTE_PRESETS: Dict[str, str] = {
    "1": "🔥 Nice Shot!",
    "2": "😱 Nooo!",
    "3": "⚡ Catch Me!",
    "4": "🏆 GG!",
}


def normalize_cc(val: Any, default: str = "150cc") -> str:
    if isinstance(val, str):
        cleaned = val.strip().lower()
        if cleaned in VALID_CC:
            return cleaned
    return default


def to_int(val: Any, default: int = 0) -> int:
    """Client-supplied index -> int. Anything non-numeric (or NaN/inf) gives `default`."""
    if isinstance(val, bool):
        return default
    try:
        num = float(val)
    except (TypeError, ValueError):
        return default
    return int(num) if math.isfinite(num) else default


def to_float(val: Any, default: float = 0.0) -> float:
    """Client-supplied number -> finite float, else `default`."""
    if isinstance(val, bool):
        return default
    try:
        num = float(val)
    except (TypeError, ValueError):
        return default
    return num if math.isfinite(num) else default


def to_time(val: Any) -> Optional[float]:
    """Client-supplied race time in seconds -> float, or None if missing/invalid/non-positive."""
    if isinstance(val, bool):
        return None
    try:
        num = float(val)
    except (TypeError, ValueError):
        return None
    return num if math.isfinite(num) and 0 < num < 1e8 else None


CHAR_NAMES = [
    "Blaze",
    "Jet",
    "Spark",
    "Rumble",
    "Goldie",
    "Buzzy",
    "Volt",
    "Brick",
    "Pixie",
    "Zephyr",
]

TRACK_IDS = [
    "lava", "mumbai", "himalaya", "sky", "manteca", "streatham",
    "dino", "jungle", "space", "kitchen", "bathroom", "aztec",
    "beach", "winter", "pinball", "reef", "forest", "starship",
    "glider", "random", "cookie", "seasons", "circus", "cats",
    "scary", "supermarket", "pumpkins", "connecticut", "farm",
    "gut", "collider", "doomtemple", "splash", "dogfight",
    "rainbow", "clockwork", "ramen", "tokyo", "mtmayhem",
    "vinyl", "origami", "crystal", "coaster", "pizza",
]

CUPS = [
    {"id": "wheeldeal", "name": "Wheel Deal Cup", "ids": ["lava", "mumbai", "himalaya", "sky"]},
    {"id": "home", "name": "Hometown Cup", "ids": ["manteca", "streatham", "kitchen", "bathroom"]},
    {"id": "wild", "name": "Wild Cup", "ids": ["dino", "jungle", "space", "aztec"]},
    {"id": "holiday", "name": "Holiday Cup", "ids": ["beach", "winter", "pinball", "reef"]},
    {"id": "adventure", "name": "Adventure Cup", "ids": ["forest", "starship", "glider", "random"]},
    {"id": "spooky", "name": "Spooky Cup", "ids": ["pumpkins", "scary", "doomtemple", "cookie"]},
    {"id": "everyday", "name": "Everyday Cup", "ids": ["supermarket", "farm", "connecticut", "seasons"]},
    {"id": "bonkers", "name": "Bonkers Cup", "ids": ["cats", "circus", "gut", "collider"]},
    {"id": "feast", "name": "Turbo Feast Cup", "ids": ["splash", "ramen", "coaster", "pizza"]},
    {"id": "neon", "name": "Neon Groove Cup", "ids": ["vinyl", "origami", "clockwork", "tokyo"]},
    {"id": "summit", "name": "Starlight Summit Cup", "ids": ["dogfight", "crystal", "mtmayhem", "rainbow"]},
]
for _cup in CUPS:
    _cup["tracks"] = [TRACK_IDS.index(_tid) for _tid in _cup["ids"]]


def get_lan_ip() -> str:
    """Best-effort LAN IPv4 address discovery for phone controller QR codes."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("10.255.255.255", 1))
        ip = sock.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    finally:
        sock.close()
    return ip


# ============================================================================
# Mobile Controller HTML (/pad) — Compatible with original_index.html PHONES
# ============================================================================
PAD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Wheelie Fun · Phone Pad</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Fredoka:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --night:#1a0f2b;--night2:#2c1846;--lava:#ff5b1f;--ember:#ffb22e;--lagoon:#26d3d0;--cream:#fff4df;--muted:#c9b6e4;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
html,body{margin:0;height:100%;overflow:hidden;background:radial-gradient(circle at 50% 20%,var(--night2),var(--night));color:var(--cream);font-family:'Fredoka',system-ui,sans-serif;touch-action:none}
.wrap{display:flex;flex-direction:column;height:100%;padding:calc(10px + env(safe-area-inset-top,0px)) calc(14px + env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) calc(14px + env(safe-area-inset-left,0px));gap:10px}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(26,15,43,.85);border:2px solid rgba(255,255,255,.15);border-radius:14px;padding:8px 12px}
.badge{font-family:'Bungee',sans-serif;font-size:16px;padding:4px 10px;border-radius:9px;background:var(--ember);color:var(--night)}
.stat{font-size:14px;color:var(--muted);font-weight:600;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.stat b{font-family:'Bungee',sans-serif;color:var(--cream);font-weight:400}
.cfg{display:flex;gap:8px;align-items:center}
.cfg input{background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.2);border-radius:8px;color:var(--cream);padding:5px 8px;font-family:inherit;font-weight:600;width:105px;font-size:13px}
.tog{background:rgba(38,211,208,.18);border:2px solid var(--lagoon);color:var(--cream);border-radius:8px;padding:5px 9px;font-size:12px;font-weight:700;cursor:pointer}
.tog.off{opacity:.5;border-color:rgba(255,255,255,.2);background:transparent}
.pad{flex:1;display:grid;grid-template-columns:1.1fr .8fr 1.1fr;gap:12px;align-items:center}
.steerBox{height:100%;max-height:240px;background:rgba(255,255,255,.05);border:3px solid rgba(255,255,255,.16);border-radius:24px;position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 18px}
.steerBox span{font-family:'Bungee',sans-serif;font-size:28px;opacity:.45;pointer-events:none}
.knob{position:absolute;top:50%;left:50%;width:68px;height:68px;margin:-34px 0 0 -34px;border-radius:50%;background:radial-gradient(circle at 35% 35%,var(--ember),var(--lava));box-shadow:0 5px 0 #7c1d0b,0 0 20px rgba(255,91,31,.5);pointer-events:none;transition:transform .04s linear}
.midCol{display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center}
.dpad{display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,42px);gap:5px}
.actGrid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:10px;height:100%;max-height:240px}
.b{font-family:'Bungee',sans-serif;border:0;border-radius:18px;color:var(--night);background:var(--ember);box-shadow:0 5px 0 #9a3c0a;font-size:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;touch-action:none}
.b small{font-family:'Fredoka',sans-serif;font-size:11px;font-weight:700;opacity:.82}
.b.drift{background:var(--lagoon);box-shadow:0 5px 0 #0c6c70}
.b.item{background:#ff4fd8;color:#fff;box-shadow:0 5px 0 #7a1868}
.b.hype{background:#ffe14a;box-shadow:0 5px 0 #9e7f08}
.b.brake{background:#ff5b1f;color:#fff;box-shadow:0 5px 0 #7c1d0b}
.b.mini{background:rgba(255,255,255,.14);color:var(--cream);box-shadow:0 3px 0 rgba(0,0,0,.4);font-size:12px;border-radius:10px;padding:8px 12px}
.b.down{transform:translateY(4px);filter:brightness(1.15)}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="badge" id="slotBadge">PAD</span>
      <div class="stat" id="statTxt"><span>Connecting…</span></div>
    </div>
    <div class="cfg">
      <input id="nameIn" maxlength="14" placeholder="Your name" value="Racer">
      <button class="tog" id="autoBtn">AUTO-GAS: ON</button>
      <button class="tog off" id="tiltBtn">TILT: OFF</button>
      <button class="b mini" data-bit="9">PAUSE</button>
    </div>
  </div>
  <div class="pad">
    <div class="steerBox" id="steerZone">
      <span>◀</span><span>▶</span>
      <div class="knob" id="knob"></div>
    </div>
    <div class="midCol">
      <div class="dpad">
        <div></div><button class="b mini" data-bit="12">▲</button><div></div>
        <button class="b mini" data-bit="14">◀</button><button class="b mini" data-bit="13">▼</button><button class="b mini" data-bit="15">▶</button>
      </div>
      <div style="display:flex;gap:6px">
        <button class="b mini" data-bit="0">✕ OK</button>
        <button class="b mini" data-bit="1">○ BACK</button>
      </div>
    </div>
    <div class="actGrid">
      <button class="b drift" data-bit="5">DRIFT<small>HOP / R1</small></button>
      <button class="b item" data-bit="4">ITEM<small>FIRE / L1</small></button>
      <button class="b hype" data-bit="3">HYPE<small>TURBO / △</small></button>
      <button class="b brake" data-bit="2" id="gasBrakeBtn">BRAKE<small>REVERSE</small></button>
    </div>
  </div>
</div>
<script>
(function(){
  const slotBadge=document.getElementById('slotBadge'),statTxt=document.getElementById('statTxt');
  const nameIn=document.getElementById('nameIn'),autoBtn=document.getElementById('autoBtn'),tiltBtn=document.getElementById('tiltBtn');
  const steerZone=document.getElementById('steerZone'),knob=document.getElementById('knob'),gasBrakeBtn=document.getElementById('gasBrakeBtn');
  try{const saved=localStorage.getItem('wf.padName');if(saved)nameIn.value=saved;}catch(e){}
  let ws=null,bits=0,steer=0,touchSteer=0,tiltSteer=0,autoGas=1,useTilt=false;

  function send(){
    if(ws&&ws.readyState===1){
      const x=Math.max(-1,Math.min(1,useTilt&&!steerTouchId?tiltSteer:touchSteer));
      steer=x;
      ws.send(JSON.stringify({t:'in',b:bits,x:+x.toFixed(3),auto:autoGas}));
    }
  }
  function connect(){
    const proto=location.protocol==='https:'?'wss:':'ws:';
    const nm=encodeURIComponent(nameIn.value.trim()||'Phone');
    ws=new WebSocket(proto+'//'+location.host+'/ws?role=phone&name='+nm);
    ws.onopen=()=>{statTxt.innerHTML='<span>Connected! Press <b>✕ OK</b> in Party Lobby</span>';send();};
    ws.onclose=()=>{statTxt.innerHTML='<span>Disconnected — retrying…</span>';setTimeout(connect,2000);};
    ws.onmessage=ev=>{
      let m;try{m=JSON.parse(ev.data);}catch(e){return;}
      if(m.t==='you'||m.t==='stat'){
        if(m.slot){slotBadge.textContent='P'+m.slot;slotBadge.style.background=m.col||'#ffb22e';}
        const parts=[];
        if(m.racer)parts.push('<b>'+m.racer+'</b>');
        if(m.pos)parts.push('Pos <b>'+m.pos+'</b>');
        if(m.lap)parts.push('Lap <b>'+m.lap+'</b>');
        if(m.item)parts.push('Item: <b>'+m.item+'</b>');
        statTxt.innerHTML=parts.length?parts.map(p=>'<span>'+p+'</span>').join(' · '):'<span>'+(m.mode==='race'?'RACING!':'MENU MODE')+'</span>';
      }else if(m.t==='buzz'&&navigator.vibrate){
        navigator.vibrate(m.ms||120);
      }
    };
  }
  nameIn.addEventListener('change',()=>{
    try{localStorage.setItem('wf.padName',nameIn.value.trim());}catch(e){}
    if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'name',name:nameIn.value.trim()||'Phone'}));
  });
  autoBtn.addEventListener('click',()=>{
    autoGas=autoGas?0:1;
    autoBtn.textContent='AUTO-GAS: '+(autoGas?'ON':'OFF');
    autoBtn.classList.toggle('off',!autoGas);
    gasBrakeBtn.dataset.bit=autoGas?'2':'0';
    gasBrakeBtn.innerHTML=autoGas?'BRAKE<small>REVERSE</small>':'GAS<small>ACCELERATE</small>';
    send();
  });
  tiltBtn.addEventListener('click',async()=>{
    if(!useTilt&&typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      try{const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted')return;}catch(e){}
    }
    useTilt=!useTilt;
    tiltBtn.textContent='TILT: '+(useTilt?'ON':'OFF');
    tiltBtn.classList.toggle('off',!useTilt);
  });
  window.addEventListener('deviceorientation',e=>{
    if(!useTilt)return;
    const g=(orientation===90?e.beta:orientation===-90?-e.beta:e.gamma)||0;
    tiltSteer=Math.max(-1,Math.min(1,g/28));
    if(!steerTouchId){knob.style.transform='translateX('+(tiltSteer*70)+'px)';send();}
  });

  let steerTouchId=null;
  function updateSteer(clientX){
    const r=steerZone.getBoundingClientRect();
    const rel=(clientX-(r.left+r.width/2))/(r.width*0.42);
    touchSteer=Math.max(-1,Math.min(1,rel));
    knob.style.transform='translateX('+(touchSteer*(r.width*0.34))+'px)';
    send();
  }
  steerZone.addEventListener('pointerdown',e=>{e.preventDefault();steerZone.setPointerCapture(e.pointerId);steerTouchId=e.pointerId;updateSteer(e.clientX);});
  steerZone.addEventListener('pointermove',e=>{if(e.pointerId===steerTouchId)updateSteer(e.clientX);});
  const endSteer=e=>{if(e.pointerId===steerTouchId){steerTouchId=null;touchSteer=0;knob.style.transform='translateX(0px)';send();}};
  steerZone.addEventListener('pointerup',endSteer);steerZone.addEventListener('pointercancel',endSteer);

  document.querySelectorAll('[data-bit]').forEach(btn=>{
    const down=e=>{e.preventDefault();const b=+btn.dataset.bit;bits|=(1<<b);btn.classList.add('down');send();};
    const up=e=>{e.preventDefault();const b=+btn.dataset.bit;bits&=~(1<<b);btn.classList.remove('down');send();};
    btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);
    btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);
  });
  setInterval(send,120);
  connect();
})();
</script>
</body>
</html>
"""


# ============================================================================
# RFC 6455 WebSocket Connection
# ============================================================================
class WebSocketConnection:
    """Async RFC 6455 WebSocket framing handler supporting masked & large frames."""

    def __init__(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
        path: str,
        query: Dict[str, List[str]],
    ) -> None:
        self.reader = reader
        self.writer = writer
        self.path = path
        self.query = query
        self.closed = False
        self._write_lock = asyncio.Lock()
        self._frag_opcode: Optional[int] = None
        self._frag_chunks: List[bytes] = []

    @staticmethod
    def _unmask(payload: bytes, mask: bytes) -> bytes:
        n = len(payload)
        if n == 0:
            return b""
        mask_rep = (mask * ((n // 4) + 1))[:n]
        unmasked_int = int.from_bytes(payload, "big") ^ int.from_bytes(mask_rep, "big")
        return unmasked_int.to_bytes(n, "big")

    async def send_frame(self, opcode: int, payload: bytes = b"") -> None:
        if self.closed:
            return
        n = len(payload)
        b0 = 0x80 | (opcode & 0x0F)
        if n < 126:
            header = struct.pack("!BB", b0, n)
        elif n <= 65535:
            header = struct.pack("!BBH", b0, 126, n)
        else:
            header = struct.pack("!BBQ", b0, 127, n)

        async with self._write_lock:
            if self.closed:
                return
            try:
                self.writer.write(header + payload)
                await self.writer.drain()
            except (ConnectionError, OSError, RuntimeError):
                self.closed = True

    async def send_text(self, text: str) -> None:
        await self.send_frame(0x1, text.encode("utf-8"))

    async def send_json(self, data: Dict[str, Any]) -> None:
        await self.send_text(json.dumps(data, separators=(",", ":")))

    async def close(self, code: int = 1000, reason: str = "") -> None:
        if not self.closed:
            payload = struct.pack("!H", code) + reason.encode("utf-8")[:123]
            await self.send_frame(0x8, payload)
            self.closed = True
        try:
            self.writer.close()
            await self.writer.wait_closed()
        except (ConnectionError, OSError, RuntimeError):
            pass

    async def recv_message(self) -> Optional[str]:
        """Reads full RFC 6455 text/binary messages, handling ping/pong/close & fragmentation."""
        while not self.closed:
            try:
                hdr = await self.reader.readexactly(2)
            except (asyncio.IncompleteReadError, ConnectionError, OSError):
                self.closed = True
                return None

            b0, b1 = hdr[0], hdr[1]
            fin = bool(b0 & 0x80)
            opcode = b0 & 0x0F
            masked = bool(b1 & 0x80)
            length = b1 & 0x7F

            try:
                if length == 126:
                    (length,) = struct.unpack("!H", await self.reader.readexactly(2))
                elif length == 127:
                    (length,) = struct.unpack("!Q", await self.reader.readexactly(8))

                if length > MAX_FRAME_BYTES:
                    await self.close(1009, "Message too big")
                    return None

                mask_key = await self.reader.readexactly(4) if masked else b""
                raw = await self.reader.readexactly(length) if length > 0 else b""
            except (asyncio.IncompleteReadError, ConnectionError, OSError):
                self.closed = True
                return None

            payload = self._unmask(raw, mask_key) if masked else raw

            if opcode == 0x8:  # Close
                if not self.closed:
                    reply = payload[:2] if len(payload) >= 2 else struct.pack("!H", 1000)
                    await self.send_frame(0x8, reply)
                    self.closed = True
                return None
            if opcode == 0x9:  # Ping -> Pong
                await self.send_frame(0xA, payload[:125])
                continue
            if opcode == 0xA:  # Pong
                continue

            if opcode in (0x1, 0x2):
                if fin and self._frag_opcode is None:
                    return payload.decode("utf-8", errors="replace")
                self._frag_opcode = opcode
                self._frag_chunks = [payload]
            elif opcode == 0x0:
                if self._frag_opcode is None:
                    continue
                self._frag_chunks.append(payload)
                if fin:
                    full = b"".join(self._frag_chunks)
                    self._frag_opcode = None
                    self._frag_chunks = []
                    return full.decode("utf-8", errors="replace")

        return None


# ============================================================================
# Phone Controller Hub (/ws?role=game|phone)
# ============================================================================
class PhoneHub:
    """Relays mobile phone controller inputs to local Wheelie Fun game instances."""

    def __init__(self, host_ip: str, port: int) -> None:
        self.host_ip = host_ip
        self.port = port
        self.games: List[WebSocketConnection] = []
        self.phones: Dict[str, Dict[str, Any]] = {}
        self._next_phone_id = 1

    @property
    def pad_url(self) -> str:
        return f"http://{self.host_ip}:{self.port}/pad"

    async def broadcast_to_games(self, msg: Dict[str, Any]) -> None:
        dead: List[WebSocketConnection] = []
        for g in list(self.games):
            if g.closed:
                dead.append(g)
            else:
                await g.send_json(msg)
        for d in dead:
            if d in self.games:
                self.games.remove(d)

    async def handle(self, ws: WebSocketConnection) -> None:
        role = (ws.query.get("role") or ["phone"])[0]
        if role == "game":
            self.games.append(ws)
            await ws.send_json({"t": "hello", "url": self.pad_url})
            for pid, pinfo in list(self.phones.items()):
                await ws.send_json({"t": "join", "id": pid, "name": pinfo["name"]})
            try:
                while True:
                    raw = await ws.recv_message()
                    if raw is None:
                        break
                    try:
                        msg = json.loads(raw)
                    except ValueError:
                        continue
                    if msg.get("t") == "to":
                        tid = str(msg.get("id", "")).lstrip("ph")
                        target = self.phones.get(tid)
                        payload = msg.get("m")
                        if target and isinstance(payload, dict):
                            await target["ws"].send_json(payload)
            finally:
                if ws in self.games:
                    self.games.remove(ws)
        else:
            pid = str(self._next_phone_id)
            self._next_phone_id += 1
            init_name = ((ws.query.get("name") or [f"Phone {pid}"])[0] or f"Phone {pid}")[:18]
            self.phones[pid] = {"id": pid, "name": init_name, "ws": ws}
            await ws.send_json({"t": "welcome", "id": pid, "name": init_name})
            await self.broadcast_to_games({"t": "join", "id": pid, "name": init_name})
            try:
                while True:
                    raw = await ws.recv_message()
                    if raw is None:
                        break
                    try:
                        msg = json.loads(raw)
                    except ValueError:
                        continue
                    mt = msg.get("t")
                    if mt in ("name", "join"):
                        new_name = str(msg.get("name") or init_name).strip()[:18] or init_name
                        self.phones[pid]["name"] = new_name
                        await self.broadcast_to_games({"t": "join", "id": pid, "name": new_name})
                    elif mt == "in":
                        await self.broadcast_to_games({
                            "t": "in",
                            "id": pid,
                            "b": to_int(msg.get("b"), 0),
                            "x": to_float(msg.get("x")),
                            "auto": 0 if msg.get("auto") == 0 else 1,
                        })
            finally:
                self.phones.pop(pid, None)
                await self.broadcast_to_games({"t": "leave", "id": pid})


# ============================================================================
# Online Cup Tournament & Multiplayer Hub (/ws-online)
# ============================================================================
class PlayerSlot:
    def __init__(self, pid: str, name: str, ch: int, ws: WebSocketConnection) -> None:
        self.id = pid
        self.name = (name or "Racer").strip()[:18] or "Racer"
        self.ch = max(0, min(len(CHAR_NAMES) - 1, to_int(ch, 0)))
        self.ws: Optional[WebSocketConnection] = ws
        self.ready = False
        self.pts = 0
        self.connected = True
        self.in_current_race = False
        self.finished = False
        self.finish_time: Optional[float] = None
        self.best_lap: Optional[float] = None
        self.last_state: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "ch": self.ch,
            "ready": self.ready,
            "pts": self.pts,
            "connected": self.connected,
        }


class OnlineRoom:
    def __init__(
        self,
        code: str,
        host_id: str,
        cup_idx: int = 0,
        mode: str = "cup",
        track_idx: int = 0,
        cc: str = "150cc",
        grace_seconds: float = 15.0,
    ) -> None:
        self.code = code
        self.host_id = host_id
        self.cup_idx = max(0, min(len(CUPS) - 1, to_int(cup_idx, 0)))
        self.mode = "single" if mode == "single" else "cup"
        self.cc = normalize_cc(cc, "150cc")
        self.race_idx = 0
        self.track_idx = (
            CUPS[self.cup_idx]["tracks"][0]
            if self.mode == "cup"
            else max(0, min(len(TRACK_IDS) - 1, to_int(track_idx, 0)))
        )
        self.state = "lobby"
        self.seed = 0
        self.players: List[PlayerSlot] = []
        self.ai_chars: List[int] = []
        self.ai_pts: Dict[int, int] = {}
        self.ai_results: Optional[List[Dict[str, Any]]] = None
        self.results_sent = False
        self.grace_seconds = grace_seconds
        self.grace_task: Optional[asyncio.Task[None]] = None
        self.ai_wait_task: Optional[asyncio.Task[None]] = None

    def connected_players(self) -> List[PlayerSlot]:
        return [p for p in self.players if p.connected and p.ws and not p.ws.closed]

    def get_player(self, pid: str) -> Optional[PlayerSlot]:
        for p in self.players:
            if p.id == pid:
                return p
        return None

    def next_player_id(self) -> Optional[str]:
        # Prune stale disconnected lobby entries with 0 pts if needed to free slots
        if len(self.players) >= 8:
            self.players = [p for p in self.players if p.connected or p.pts > 0]
        used = {p.id for p in self.players}
        for i in range(1, 9):
            cand = f"p{i}"
            if cand not in used:
                return cand
        return None

    def cancel_timers(self) -> None:
        if self.grace_task and not self.grace_task.done():
            self.grace_task.cancel()
        self.grace_task = None
        if self.ai_wait_task and not self.ai_wait_task.done():
            self.ai_wait_task.cancel()
        self.ai_wait_task = None

    def room_state_for(self, you_id: str) -> Dict[str, Any]:
        return {
            "t": "room_state",
            "roomCode": self.code,
            "you": you_id,
            "hostId": self.host_id,
            "players": [p.to_dict() for p in self.players],
            "cupIdx": self.cup_idx,
            "raceIdx": self.race_idx,
            "mode": self.mode,
            "cc": self.cc,
            "trackIdx": self.track_idx,
            "state": self.state,
        }


class OnlineCupHub:
    """Manages Online Multiplayer lobbies, race relays, and 4-race Cup Tournaments."""

    def __init__(self, grace_seconds: float = 15.0) -> None:
        self.rooms: Dict[str, OnlineRoom] = {}
        self.grace_seconds = grace_seconds
        self._rng = random.SystemRandom()

    def _generate_room_code(self) -> str:
        letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
        alnum = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        while True:
            # 4 uppercase letters + 2 alphanumeric chars -> always 6 uppercase chars (e.g. KART42)
            code = "".join(self._rng.choice(letters) for _ in range(4)) + "".join(
                self._rng.choice(alnum) for _ in range(2)
            )
            if code not in self.rooms:
                return code

    async def broadcast_room_state(self, room: OnlineRoom) -> None:
        for p in room.connected_players():
            if p.ws:
                await p.ws.send_json(room.room_state_for(p.id))

    async def broadcast_room(
        self, room: OnlineRoom, msg: Dict[str, Any], exclude_id: Optional[str] = None
    ) -> None:
        for p in room.connected_players():
            if p.id != exclude_id and p.ws:
                await p.ws.send_json(msg)

    def _choose_ai_chars(self, human_chars: List[int], num_humans: int) -> List[int]:
        target_total = max(6, num_humans)
        needed = max(0, target_total - num_humans)
        used = set(human_chars)
        pool = [c for c in range(6) if c not in used]
        for c in range(6):
            if c not in pool:
                pool.append(c)
        return pool[:needed]

    def _reset_race_slots(self, room: OnlineRoom) -> None:
        room.cancel_timers()
        room.ai_results = None
        room.results_sent = False
        room.seed = self._rng.randint(100_000, 999_999_999)
        for p in room.players:
            p.in_current_race = p.connected
            p.finished = False
            p.finish_time = None
            p.best_lap = None
            p.ready = False

    async def _start_race_now(self, room: OnlineRoom, reset_cup: bool) -> None:
        active = room.connected_players()
        if reset_cup:
            room.race_idx = 0
            for p in room.players:
                p.pts = 0
            room.ai_chars = self._choose_ai_chars([p.ch for p in active], len(active))
            room.ai_pts = {ch: 0 for ch in room.ai_chars}
        elif not room.ai_chars and len(active) < 6:
            room.ai_chars = self._choose_ai_chars([p.ch for p in active], len(active))
            for ch in room.ai_chars:
                room.ai_pts.setdefault(ch, 0)

        if room.mode == "cup":
            cup_tracks = CUPS[room.cup_idx]["tracks"]
            room.race_idx = max(0, min(len(cup_tracks) - 1, room.race_idx))
            room.track_idx = cup_tracks[room.race_idx]

        self._reset_race_slots(room)
        room.state = "racing"

        await self.broadcast_room(
            room,
            {
                "t": "race_start",
                "roomCode": room.code,
                "seed": room.seed,
                "cupIdx": room.cup_idx,
                "raceIdx": room.race_idx,
                "trackIdx": room.track_idx,
                "mode": room.mode,
                "cc": room.cc,
                "players": [p.to_dict() for p in active],
                "aiChars": list(room.ai_chars),
            },
        )

    def _build_standings(
        self, room: OnlineRoom, last_gains: Optional[Dict[str, int]] = None
    ) -> List[Dict[str, Any]]:
        gains = last_gains or {}
        entries: List[Dict[str, Any]] = []
        for p in room.players:
            if p.connected or p.pts > 0 or p.in_current_race:
                entries.append(
                    {
                        "id": p.id,
                        "kind": "human",
                        "name": p.name,
                        "ch": p.ch,
                        "pts": p.pts,
                        "lastGain": gains.get(p.id, 0),
                        "connected": p.connected,
                    }
                )
        for ch in room.ai_chars:
            ai_id = f"ai_{ch}"
            entries.append(
                {
                    "id": ai_id,
                    "kind": "ai",
                    "name": CHAR_NAMES[ch],
                    "ch": ch,
                    "pts": room.ai_pts.get(ch, 0),
                    "lastGain": gains.get(ai_id, 0),
                    "connected": True,
                }
            )
        entries.sort(key=lambda e: (-e["pts"], 0 if e["kind"] == "human" else 1, e["id"]))
        for idx, entry in enumerate(entries):
            entry["rank"] = idx + 1
        return entries

    async def finalize_race(self, room: OnlineRoom) -> None:
        if room.results_sent or room.state != "racing":
            return
        room.results_sent = True
        room.cancel_timers()

        racers: List[Dict[str, Any]] = []
        finished_times = [
            p.finish_time
            for p in room.players
            if p.in_current_race and p.finished and p.finish_time is not None
        ]
        base_time = max(finished_times) if finished_times else 95.0

        for idx, p in enumerate(room.players):
            if not (p.in_current_race or p.connected):
                continue
            if p.finished and p.finish_time is not None:
                ftime = float(p.finish_time)
                dnf = False
            else:
                progress = to_float(p.last_state.get("progress"))
                est_extra = max(2.0, 25.0 - min(20.0, progress / 300.0)) + idx * 0.25
                ftime = round(base_time + est_extra, 3)
                dnf = True
            racers.append(
                {
                    "id": p.id,
                    "kind": "human",
                    "name": p.name,
                    "ch": p.ch,
                    "time": ftime,
                    "bestLap": p.best_lap,
                    "dnf": dnf,
                    "_player": p,
                }
            )

        ai_map: Dict[int, float] = {}
        if isinstance(room.ai_results, list):
            for item in room.ai_results:
                if isinstance(item, dict) and "ch" in item and "time" in item:
                    ai_time = to_time(item["time"])
                    ch = to_int(item["ch"], -1)
                    if ai_time is not None and ch >= 0:
                        ai_map[ch] = ai_time

        det_rng = random.Random(room.seed ^ 0x5A5A)
        for idx, ch in enumerate(room.ai_chars):
            if ch in ai_map:
                ai_time = ai_map[ch]
            else:
                ai_time = round(base_time + 1.8 + idx * 2.1 + det_rng.uniform(0.1, 1.4), 3)
            racers.append(
                {
                    "id": f"ai_{ch}",
                    "kind": "ai",
                    "name": CHAR_NAMES[ch],
                    "ch": ch,
                    "time": ai_time,
                    "bestLap": None,
                    "dnf": False,
                }
            )

        racers.sort(key=lambda r: (r["time"], 0 if r["kind"] == "human" else 1, r["id"]))

        last_gains: Dict[str, int] = {}
        order_out: List[Dict[str, Any]] = []
        for idx, r in enumerate(racers):
            gained = CUP_POINTS[idx] if idx < len(CUP_POINTS) else 0
            rid = r["id"]
            last_gains[rid] = gained
            if r["kind"] == "human":
                pl: PlayerSlot = r["_player"]
                pl.pts += gained
                total_pts = pl.pts
            else:
                ch = r["ch"]
                room.ai_pts[ch] = room.ai_pts.get(ch, 0) + gained
                total_pts = room.ai_pts[ch]

            order_out.append(
                {
                    "place": idx + 1,
                    "id": rid,
                    "kind": r["kind"],
                    "name": r["name"],
                    "ch": r["ch"],
                    "time": round(float(r["time"]), 3),
                    "bestLap": r["bestLap"],
                    "dnf": r["dnf"],
                    "gained": gained,
                    "pts": total_pts,
                }
            )

        for p in room.players:
            p.ready = False

        total_races = len(CUPS[room.cup_idx]["tracks"]) if room.mode == "cup" else 1
        is_cup_done = (room.mode != "cup") or (room.race_idx >= total_races - 1)
        standings = self._build_standings(room, last_gains)
        room.state = "results"

        await self.broadcast_room(
            room,
            {
                "t": "race_results",
                "roomCode": room.code,
                "cupIdx": room.cup_idx,
                "raceIdx": room.race_idx,
                "trackIdx": room.track_idx,
                "isCupDone": is_cup_done,
                "order": order_out,
                "standings": standings,
            },
        )

    async def _check_race_completion(self, room: OnlineRoom) -> None:
        if room.state != "racing" or room.results_sent:
            return
        active_racers = [
            p for p in room.players if p.connected and p.in_current_race
        ]
        if not active_racers:
            return

        any_finished = any(p.finished for p in active_racers)
        all_finished = all(p.finished for p in active_racers)

        if all_finished:
            if room.ai_chars and room.ai_results is None:
                if room.ai_wait_task is None or room.ai_wait_task.done():
                    async def _wait_briefly_for_ai() -> None:
                        await asyncio.sleep(0.06)
                        await self.finalize_race(room)
                    room.ai_wait_task = asyncio.create_task(_wait_briefly_for_ai())
            else:
                await self.finalize_race(room)
        elif any_finished and (room.grace_task is None or room.grace_task.done()):
            async def _grace_countdown() -> None:
                await asyncio.sleep(room.grace_seconds)
                await self.finalize_race(room)
            room.grace_task = asyncio.create_task(_grace_countdown())

    async def _advance_next_race(self, room: OnlineRoom) -> None:
        total_races = len(CUPS[room.cup_idx]["tracks"]) if room.mode == "cup" else 1
        if room.mode == "cup" and room.race_idx + 1 < total_races:
            room.race_idx += 1
            await self._start_race_now(room, reset_cup=False)
        else:
            room.cancel_timers()
            room.state = "cup_complete"
            standings = self._build_standings(room)
            winner = standings[0] if standings else None
            await self.broadcast_room(
                room,
                {
                    "t": "cup_complete",
                    "roomCode": room.code,
                    "cupIdx": room.cup_idx,
                    "standings": standings,
                    "winner": winner,
                },
            )

    async def _remove_or_disconnect(
        self, room: Optional[OnlineRoom], player: Optional[PlayerSlot]
    ) -> None:
        if not room or not player:
            return
        player.connected = False
        player.ws = None
        player.ready = False

        remaining = room.connected_players()
        if not remaining:
            room.cancel_timers()
            self.rooms.pop(room.code, None)
            return

        if room.host_id == player.id:
            room.host_id = remaining[0].id

        await self.broadcast_room_state(room)
        if room.state == "racing":
            await self._check_race_completion(room)
        elif room.state == "results" and all(p.ready for p in remaining):
            # The player who left was the only one not ready: move on instead of stalling.
            await self._advance_next_race(room)

    async def handle(self, ws: WebSocketConnection) -> None:
        current_room: Optional[OnlineRoom] = None
        current_player: Optional[PlayerSlot] = None

        try:
            while True:
                raw = await ws.recv_message()
                if raw is None:
                    break
                try:
                    msg = json.loads(raw)
                except ValueError:
                    await ws.send_json({"t": "error", "msg": "Invalid JSON message"})
                    continue
                if not isinstance(msg, dict):
                    continue

                mt = msg.get("t")

                if mt == "ping":
                    await ws.send_json({"t": "pong", "ts": msg.get("ts")})
                    continue

                if mt == "create_room":
                    if current_room and current_player:
                        await self._remove_or_disconnect(current_room, current_player)
                    code = self._generate_room_code()
                    cup_idx = to_int(msg.get("cupIdx"), 0)
                    mode = str(msg.get("mode") or "cup")
                    track_idx = to_int(msg.get("trackIdx"), 0)
                    cc_val = normalize_cc(msg.get("cc"), "150cc")
                    room = OnlineRoom(
                        code=code,
                        host_id="p1",
                        cup_idx=cup_idx,
                        mode=mode,
                        track_idx=track_idx,
                        cc=cc_val,
                        grace_seconds=self.grace_seconds,
                    )
                    player = PlayerSlot(
                        pid="p1",
                        name=str(msg.get("name") or "Player 1"),
                        ch=to_int(msg.get("ch"), 0),
                        ws=ws,
                    )
                    room.players.append(player)
                    self.rooms[code] = room
                    current_room = room
                    current_player = player
                    await ws.send_json(room.room_state_for(player.id))

                elif mt == "join_room":
                    code = str(msg.get("roomCode") or "").strip().upper()
                    room = self.rooms.get(code)
                    if not room:
                        await ws.send_json({"t": "error", "msg": f"Room '{code}' not found."})
                        continue
                    if room.state != "lobby":
                        await ws.send_json(
                            {"t": "error", "msg": f"Room '{code}' is currently mid-cup ({room.state})."}
                        )
                        continue
                    if len(room.connected_players()) >= 8:
                        await ws.send_json({"t": "error", "msg": "Room is full (max 8 players)."})
                        continue
                    pid = room.next_player_id()
                    if not pid:
                        await ws.send_json({"t": "error", "msg": "Room has no available slots."})
                        continue

                    if current_room and current_player:
                        await self._remove_or_disconnect(current_room, current_player)

                    player = PlayerSlot(
                        pid=pid,
                        name=str(msg.get("name") or f"Player {pid[1:]}"),
                        ch=to_int(msg.get("ch"), len(room.players) % 6),
                        ws=ws,
                    )
                    room.players.append(player)
                    current_room = room
                    current_player = player
                    await self.broadcast_room_state(room)

                elif mt == "leave_room":
                    await self._remove_or_disconnect(current_room, current_player)
                    current_room = None
                    current_player = None

                elif mt == "update_lobby":
                    if not current_room or not current_player:
                        await ws.send_json({"t": "error", "msg": "Not in a room."})
                        continue
                    if "name" in msg and msg["name"] is not None:
                        current_player.name = str(msg["name"]).strip()[:18] or current_player.name
                    if "ch" in msg and msg["ch"] is not None:
                        current_player.ch = max(0, min(len(CHAR_NAMES) - 1, to_int(msg["ch"], current_player.ch)))
                    if "ready" in msg and msg["ready"] is not None:
                        current_player.ready = bool(msg["ready"])

                    if current_player.id == current_room.host_id:
                        if "mode" in msg and msg["mode"] in ("cup", "single"):
                            current_room.mode = msg["mode"]
                        if "cc" in msg and msg["cc"] is not None:
                            current_room.cc = normalize_cc(msg["cc"], current_room.cc)
                        if "cupIdx" in msg and msg["cupIdx"] is not None:
                            current_room.cup_idx = max(0, min(len(CUPS) - 1, to_int(msg["cupIdx"], current_room.cup_idx)))
                            if current_room.mode == "cup":
                                current_room.track_idx = CUPS[current_room.cup_idx]["tracks"][0]
                        if "trackIdx" in msg and msg["trackIdx"] is not None:
                            current_room.track_idx = max(
                                0, min(len(TRACK_IDS) - 1, to_int(msg["trackIdx"], current_room.track_idx))
                            )
                        if msg.get("backToLobby") and current_room.state == "cup_complete":
                            current_room.state = "lobby"
                            current_room.race_idx = 0

                    await self.broadcast_room_state(current_room)

                    # Auto-advance from results screen when every connected player marks ready
                    if current_room.state == "results":
                        conn = current_room.connected_players()
                        if conn and all(p.ready for p in conn):
                            await self._advance_next_race(current_room)

                elif mt in ("start_cup", "start_race"):
                    if not current_room or not current_player:
                        await ws.send_json({"t": "error", "msg": "Not in a room."})
                        continue
                    if current_player.id != current_room.host_id:
                        await ws.send_json({"t": "error", "msg": "Only the host can start the race."})
                        continue
                    if "mode" in msg and msg["mode"] in ("cup", "single"):
                        current_room.mode = msg["mode"]
                    if "cc" in msg and msg["cc"] is not None:
                        current_room.cc = normalize_cc(msg["cc"], current_room.cc)
                    if "cupIdx" in msg and msg["cupIdx"] is not None:
                        current_room.cup_idx = max(0, min(len(CUPS) - 1, to_int(msg["cupIdx"], current_room.cup_idx)))
                    if "trackIdx" in msg and msg["trackIdx"] is not None:
                        current_room.track_idx = max(
                            0, min(len(TRACK_IDS) - 1, to_int(msg["trackIdx"], current_room.track_idx))
                        )
                    reset_cup = (mt == "start_cup") or (
                        current_room.state in ("lobby", "cup_complete")
                    )
                    await self._start_race_now(current_room, reset_cup=reset_cup)

                elif mt == "kart_state":
                    if not current_room or not current_player:
                        continue
                    current_player.last_state = msg
                    relay = {
                        "t": "kart_state",
                        "id": current_player.id,
                        "ts": msg.get("ts") or int(time.time() * 1000),
                    }
                    for field in (
                        "x", "y", "z", "vx", "vz", "heading", "moveAng", "speed",
                        "steerVis", "driftDir", "driftCharge", "boostT", "hyperT",
                        "spinT", "onGround", "lap", "progress", "coins", "item", "trail",
                    ):
                        if field in msg:
                            relay[field] = msg[field]
                    await self.broadcast_room(current_room, relay, exclude_id=current_player.id)

                elif mt == "item_event":
                    if not current_room or not current_player:
                        continue
                    await self.broadcast_room(
                        current_room,
                        {
                            "t": "item_event",
                            "id": current_player.id,
                            "ts": msg.get("ts") or int(time.time() * 1000),
                            "kind": msg.get("kind"),
                            "data": msg.get("data") or {},
                        },
                        exclude_id=current_player.id,
                    )

                elif mt == "ai_sync":
                    if not current_room or not current_player:
                        continue
                    if current_player.id == current_room.host_id:
                        bots = msg.get("bots")
                        await self.broadcast_room(
                            current_room,
                            {
                                "t": "ai_sync",
                                "id": current_player.id,
                                "ts": msg.get("ts") or int(time.time() * 1000),
                                "bots": bots if isinstance(bots, list) else [],
                            },
                            exclude_id=current_player.id,
                        )

                elif mt == "ai_hit":
                    if not current_room or not current_player:
                        continue
                    await self.broadcast_room(
                        current_room,
                        {
                            "t": "ai_hit",
                            "id": current_player.id,
                            "aiIdx": msg.get("aiIdx"),
                            "ch": msg.get("ch"),
                            "ts": msg.get("ts") or int(time.time() * 1000),
                        },
                        exclude_id=current_player.id,
                    )

                elif mt == "emote":
                    if not current_room or not current_player:
                        continue
                    code = str(msg.get("code") or "1").strip()[:4]
                    text = EMOTE_PRESETS.get(code) or str(msg.get("text") or "🔥 Nice Shot!").strip()[:32]
                    await self.broadcast_room(
                        current_room,
                        {
                            "t": "emote",
                            "id": current_player.id,
                            "name": current_player.name,
                            "code": code,
                            "text": text,
                            "ts": msg.get("ts") or int(time.time() * 1000),
                        },
                        exclude_id=None,
                    )

                elif mt == "ai_results":
                    if not current_room or not current_player:
                        continue
                    if current_player.id == current_room.host_id or current_room.ai_results is None:
                        ai_list = msg.get("ai")
                        if isinstance(ai_list, list):
                            current_room.ai_results = ai_list
                    await self._check_race_completion(current_room)

                elif mt == "race_finish":
                    if not current_room or not current_player:
                        continue
                    if current_room.state != "racing" or current_room.results_sent:
                        continue
                    current_player.in_current_race = True
                    current_player.finished = True
                    # A missing/invalid time counts as finished-without-time (scored as DNF),
                    # so it can never beat a real time and the race doesn't stall waiting.
                    current_player.finish_time = to_time(msg.get("finishTime"))
                    current_player.best_lap = to_time(msg.get("bestLap"))
                    if isinstance(msg.get("ai"), list) and (
                        current_player.id == current_room.host_id or current_room.ai_results is None
                    ):
                        current_room.ai_results = msg["ai"]
                    await self._check_race_completion(current_room)

                elif mt == "next_race":
                    if not current_room or not current_player:
                        await ws.send_json({"t": "error", "msg": "Not in a room."})
                        continue
                    if current_player.id != current_room.host_id:
                        await ws.send_json({"t": "error", "msg": "Only the host can advance the Cup."})
                        continue
                    if current_room.state == "results":
                        await self._advance_next_race(current_room)
                    elif current_room.state == "cup_complete":
                        standings = self._build_standings(current_room)
                        await ws.send_json(
                            {
                                "t": "cup_complete",
                                "roomCode": current_room.code,
                                "cupIdx": current_room.cup_idx,
                                "standings": standings,
                                "winner": standings[0] if standings else None,
                            }
                        )
        finally:
            await self._remove_or_disconnect(current_room, current_player)


# ============================================================================
# Single-Port HTTP + WebSocket Server
# ============================================================================
class WheelieServer:
    def __init__(self, host: str = "0.0.0.0", port: int = 8780, grace_seconds: float = 15.0) -> None:
        self.host = host
        self.port = port
        self.lan_ip = get_lan_ip()
        self.phone_hub = PhoneHub(self.lan_ip, port)
        self.online_hub = OnlineCupHub(grace_seconds=grace_seconds)

    async def handle_client(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        try:
            raw_head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=10.0)
        except (
            asyncio.TimeoutError,
            asyncio.IncompleteReadError,
            asyncio.LimitOverrunError,
            ConnectionError,
            OSError,
        ):
            writer.close()
            return

        lines = raw_head.decode("iso-8859-1", errors="replace").split("\r\n")
        if not lines or not lines[0]:
            writer.close()
            return

        parts = lines[0].split(" ")
        if len(parts) < 2:
            writer.close()
            return
        method, raw_target = parts[0].upper(), parts[1]
        parsed = urllib.parse.urlsplit(raw_target)
        path = urllib.parse.unquote(parsed.path or "/")
        query = urllib.parse.parse_qs(parsed.query)

        headers: Dict[str, str] = {}
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()

        # Check RFC 6455 WebSocket upgrade
        if headers.get("upgrade", "").lower() == "websocket":
            ws_key = headers.get("sec-websocket-key", "")
            if not ws_key or path not in ("/ws", "/ws-online"):
                await self._send_http(
                    writer, 400, "Bad Request", b"Invalid WebSocket request", "text/plain"
                )
                return

            accept = base64.b64encode(
                hashlib.sha1((ws_key + WS_GUID).encode("ascii")).digest()
            ).decode("ascii")
            handshake = (
                "HTTP/1.1 101 Switching Protocols\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Accept: {accept}\r\n"
                "\r\n"
            )
            writer.write(handshake.encode("ascii"))
            await writer.drain()

            ws = WebSocketConnection(reader, writer, path, query)
            if path == "/ws":
                await self.phone_hub.handle(ws)
            else:
                await self.online_hub.handle(ws)
            await ws.close()
            return

        # Standard HTTP routes
        await self._handle_http(writer, method, path)

    async def _send_http(
        self,
        writer: asyncio.StreamWriter,
        status: int,
        reason: str,
        body: bytes,
        content_type: str,
        head_only: bool = False,
    ) -> None:
        hdr = (
            f"HTTP/1.1 {status} {reason}\r\n"
            f"Content-Type: {content_type}\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Cache-Control: no-cache\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Connection: close\r\n"
            "\r\n"
        )
        try:
            writer.write(hdr.encode("ascii"))
            if not head_only and body:
                writer.write(body)
            await writer.drain()
        except (ConnectionError, OSError):
            pass
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except (ConnectionError, OSError, RuntimeError):
                pass

    async def _handle_http(
        self, writer: asyncio.StreamWriter, method: str, path: str
    ) -> None:
        if method == "OPTIONS":
            await self._send_http(writer, 204, "No Content", b"", "text/plain", head_only=True)
            return
        if method not in ("GET", "HEAD"):
            await self._send_http(writer, 405, "Method Not Allowed", b"Method Not Allowed", "text/plain")
            return

        head_only = method == "HEAD"

        if path in ("/pad", "/pad/"):
            await self._send_http(
                writer, 200, "OK", PAD_HTML.encode("utf-8"), "text/html; charset=utf-8", head_only
            )
            return

        if path == "/api/status":
            payload = json.dumps(
                {
                    "ok": True,
                    "rooms": len(self.online_hub.rooms),
                    "phones": len(self.phone_hub.phones),
                    "padUrl": self.phone_hub.pad_url,
                }
            ).encode("utf-8")
            await self._send_http(
                writer, 200, "OK", payload, "application/json; charset=utf-8", head_only
            )
            return

        rel = "index.html" if path == "/" else path.lstrip("/")
        try:
            target = (ROOT_DIR / rel).resolve()
        except OSError:
            await self._send_http(writer, 400, "Bad Request", b"Bad path", "text/plain", head_only)
            return

        if target != ROOT_DIR and ROOT_DIR not in target.parents:
            await self._send_http(writer, 403, "Forbidden", b"Forbidden", "text/plain", head_only)
            return

        if target.is_dir():
            target = target / "index.html"

        if not target.is_file():
            await self._send_http(writer, 404, "Not Found", b"Not Found", "text/plain", head_only)
            return

        ctype, _ = mimetypes.guess_type(str(target))
        if not ctype:
            ctype = "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype = f"{ctype}; charset=utf-8"

        data = b"" if head_only else target.read_bytes()
        if head_only:
            size = target.stat().st_size
            hdr = (
                "HTTP/1.1 200 OK\r\n"
                f"Content-Type: {ctype}\r\n"
                f"Content-Length: {size}\r\n"
                "Cache-Control: no-cache\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Connection: close\r\n\r\n"
            )
            writer.write(hdr.encode("ascii"))
            await writer.drain()
            writer.close()
            return

        await self._send_http(writer, 200, "OK", data, ctype, head_only=False)


async def run_server(host: str, port: int, grace_seconds: float) -> None:
    app = WheelieServer(host=host, port=port, grace_seconds=grace_seconds)
    server = await asyncio.start_server(app.handle_client, host, port)
    addrs = [sock.getsockname() for sock in (server.sockets or [])]
    actual_port = addrs[0][1] if addrs else port
    app.port = actual_port
    app.phone_hub.port = actual_port
    print(
        f"Wheelie Fun Server listening on http://localhost:{actual_port} "
        f"(LAN: http://{app.lan_ip}:{actual_port} | Pad: http://{app.lan_ip}:{actual_port}/pad "
        f"| Online WS: ws://localhost:{actual_port}/ws-online)",
        flush=True,
    )
    async with server:
        await server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Wheelie Fun HTTP + Online Cup + Phone Server")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("PORT", "8780"))
    )
    parser.add_argument(
        "--grace-seconds",
        type=float,
        default=float(os.environ.get("WF_GRACE_SECONDS", "15.0")),
    )
    args = parser.parse_args()
    try:
        asyncio.run(run_server(args.host, args.port, args.grace_seconds))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
