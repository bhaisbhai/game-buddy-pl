#!/usr/bin/env python3
"""
Automated Unit & Integration Tests for Wheelie Fun Online Cup & Phone Server.

Verifies:
  1. HTTP `/` (200 OK), `/pad` (200 OK), `/online_client.js` (200 OK), `/api/status`
  2. RFC 6455 WebSocket framing (<126B, >125B 16-bit, >65535B 64-bit, fragmented, ping/pong)
  3. Phone controller `/ws?role=game|phone` full relay lifecycle
  4. Online Cup Tournament `/ws-online` room creation, 6-char roomCode, join, invalid code error
  5. Lobby updates (character selection, ready state, Cup selection)
  6. Full 4-race Cup Tournament lifecycle (`start_cup` -> `kart_state` -> `item_event` ->
     `race_finish` + `ai_results` -> cumulative `standings` -> `cup_complete` trophy winner)
  7. Host disconnect & automatic host migration to Bob (`p2`), including Bob acting as new host
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import pathlib
import socket
import struct
import subprocess
import sys
import urllib.request
from typing import Any, Dict, List, Optional

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
SERVER_PY = ROOT_DIR / "server.py"
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


class SimWSClient:
    """Minimal RFC 6455 masked client for integration testing server.py."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        self.reader = reader
        self.writer = writer
        self.inbox: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
        self.pongs: asyncio.Queue[bytes] = asyncio.Queue()
        self.closed = False
        self._reader_task = asyncio.create_task(self._read_loop())

    @classmethod
    async def connect(cls, host: str, port: int, path: str) -> "SimWSClient":
        reader, writer = await asyncio.open_connection(host, port)
        raw_key = base64.b64encode(os.urandom(16)).decode("ascii")
        req = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {raw_key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        )
        writer.write(req.encode("ascii"))
        await writer.drain()

        resp_raw = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=5.0)
        resp_text = resp_raw.decode("iso-8859-1")
        assert resp_text.startswith("HTTP/1.1 101"), f"Handshake failed: {resp_text}"
        expected_accept = base64.b64encode(
            hashlib.sha1((raw_key + WS_GUID).encode("ascii")).digest()
        ).decode("ascii")
        assert expected_accept in resp_text, "Invalid Sec-WebSocket-Accept header"
        return cls(reader, writer)

    @staticmethod
    def _mask_bytes(data: bytes, mask: bytes) -> bytes:
        if not data:
            return b""
        rep = (mask * ((len(data) // 4) + 1))[: len(data)]
        return (int.from_bytes(data, "big") ^ int.from_bytes(rep, "big")).to_bytes(
            len(data), "big"
        )

    async def send_raw_frame(self, opcode: int, payload: bytes, fin: bool = True) -> None:
        b0 = (0x80 if fin else 0x00) | (opcode & 0x0F)
        n = len(payload)
        mask = os.urandom(4)
        if n < 126:
            hdr = struct.pack("!BB", b0, 0x80 | n)
        elif n <= 65535:
            hdr = struct.pack("!BBH", b0, 0x80 | 126, n)
        else:
            hdr = struct.pack("!BBQ", b0, 0x80 | 127, n)
        masked_payload = self._mask_bytes(payload, mask)
        self.writer.write(hdr + mask + masked_payload)
        await self.writer.drain()

    async def send_json(self, obj: Dict[str, Any]) -> None:
        raw = json.dumps(obj).encode("utf-8")
        await self.send_raw_frame(0x1, raw, fin=True)

    async def send_fragmented_json(self, obj: Dict[str, Any], split_at: int = 12) -> None:
        raw = json.dumps(obj).encode("utf-8")
        part1, part2 = raw[:split_at], raw[split_at:]
        await self.send_raw_frame(0x1, part1, fin=False)
        await self.send_raw_frame(0x0, part2, fin=True)

    async def recv_until(self, msg_type: str, timeout: float = 5.0) -> Dict[str, Any]:
        deadline = asyncio.get_event_loop().time() + timeout
        stashed: List[Dict[str, Any]] = []
        try:
            while True:
                rem = max(0.05, deadline - asyncio.get_event_loop().time())
                msg = await asyncio.wait_for(self.inbox.get(), timeout=rem)
                if msg.get("t") == msg_type:
                    for item in stashed:
                        await self.inbox.put(item)
                    return msg
                stashed.append(msg)
        except asyncio.TimeoutError as exc:
            raise AssertionError(
                f"Timed out waiting for message t='{msg_type}'; saw {[m.get('t') for m in stashed]}"
            ) from exc

    async def _read_loop(self) -> None:
        try:
            while not self.closed:
                hdr = await self.reader.readexactly(2)
                b0, b1 = hdr[0], hdr[1]
                opcode = b0 & 0x0F
                masked = bool(b1 & 0x80)
                length = b1 & 0x7F
                if length == 126:
                    (length,) = struct.unpack("!H", await self.reader.readexactly(2))
                elif length == 127:
                    (length,) = struct.unpack("!Q", await self.reader.readexactly(8))
                mask = await self.reader.readexactly(4) if masked else b""
                payload = await self.reader.readexactly(length) if length else b""
                if masked:
                    payload = self._mask_bytes(payload, mask)
                if opcode == 0x8:
                    self.closed = True
                    break
                if opcode == 0xA:
                    await self.pongs.put(payload)
                    continue
                if opcode == 0x1:
                    await self.inbox.put(json.loads(payload.decode("utf-8")))
        except (asyncio.IncompleteReadError, ConnectionError, OSError, asyncio.CancelledError):
            self.closed = True

    async def close(self) -> None:
        if not self.closed:
            try:
                await self.send_raw_frame(0x8, struct.pack("!H", 1000))
            except OSError:
                pass
            self.closed = True
        self._reader_task.cancel()
        try:
            self.writer.close()
            await self.writer.wait_closed()
        except OSError:
            pass


def http_get(url: str) -> tuple[int, str, bytes]:
    with urllib.request.urlopen(url, timeout=5.0) as resp:
        return resp.status, resp.headers.get("Content-Type", ""), resp.read()


async def wait_for_server(port: int) -> None:
    url = f"http://127.0.0.1:{port}/api/status"
    for _ in range(50):
        try:
            status, _, body = await asyncio.to_thread(http_get, url)
            if status == 200 and json.loads(body.decode("utf-8")).get("ok") is True:
                return
        except Exception:
            await asyncio.sleep(0.08)
    raise RuntimeError(f"Server did not start on port {port}")


async def test_http_endpoints(port: int) -> None:
    status_root, ctype_root, body_root = await asyncio.to_thread(
        http_get, f"http://127.0.0.1:{port}/"
    )
    assert status_root == 200, f"Expected 200 on /, got {status_root}"
    assert "text/html" in ctype_root
    assert b"Wheelie Fun" in body_root

    status_pad, ctype_pad, body_pad = await asyncio.to_thread(
        http_get, f"http://127.0.0.1:{port}/pad"
    )
    assert status_pad == 200, f"Expected 200 on /pad, got {status_pad}"
    assert "text/html" in ctype_pad
    assert b"Phone Pad" in body_pad and b"/ws?role=phone" in body_pad

    status_js, ctype_js, body_js = await asyncio.to_thread(
        http_get, f"http://127.0.0.1:{port}/online_client.js"
    )
    assert status_js == 200, f"Expected 200 on /online_client.js, got {status_js}"
    assert b"WFOnline" in body_js
    print("[PASS] HTTP /, /pad, and /online_client.js 200 OK")


async def test_phone_controller_protocol(port: int) -> None:
    game = await SimWSClient.connect("127.0.0.1", port, "/ws?role=game")
    hello = await game.recv_until("hello")
    assert "/pad" in hello["url"]

    phone = await SimWSClient.connect("127.0.0.1", port, "/ws?role=phone&name=TikiPhone")
    welcome = await phone.recv_until("welcome")
    pid = welcome["id"]

    join_ev = await game.recv_until("join")
    assert join_ev["id"] == pid and join_ev["name"] == "TikiPhone"

    await phone.send_json({"t": "in", "b": (1 << 5) | (1 << 4), "x": -0.75, "auto": 1})
    in_ev = await game.recv_until("in")
    assert in_ev["id"] == pid and in_ev["b"] == 48 and abs(in_ev["x"] + 0.75) < 1e-6

    await game.send_json({"t": "to", "id": f"ph{pid}", "m": {"t": "stat", "slot": 1, "pos": "1st"}})
    stat_ev = await phone.recv_until("stat")
    assert stat_ev["slot"] == 1 and stat_ev["pos"] == "1st"

    await phone.close()
    leave_ev = await game.recv_until("leave")
    assert leave_ev["id"] == pid
    await game.close()
    print("[PASS] Phone controller /ws relay (hello -> join -> in -> stat -> leave)")


async def test_online_cup_lifecycle_and_migration(port: int) -> None:
    alice = await SimWSClient.connect("127.0.0.1", port, "/ws-online")
    bob = await SimWSClient.connect("127.0.0.1", port, "/ws-online")

    # 1. RFC 6455 Ping/Pong check
    await alice.send_raw_frame(0x9, b"wheelie-ping")
    pong_payload = await asyncio.wait_for(alice.pongs.get(), timeout=3.0)
    assert pong_payload == b"wheelie-ping", f"Unexpected pong payload: {pong_payload!r}"

    # 2. Invalid room code error check
    await bob.send_json({"t": "join_room", "roomCode": "ZZZZ99", "name": "Bob", "ch": 2})
    err_msg = await bob.recv_until("error")
    assert "ZZZZ99" in err_msg["msg"]

    # 3. Create Room (Alice) + fragmented frame check
    await alice.send_fragmented_json(
        {"t": "create_room", "name": "Alice", "ch": 0, "cupIdx": 0, "mode": "cup", "trackIdx": 0}
    )
    st_alice = await alice.recv_until("room_state")
    room_code = st_alice["roomCode"]
    assert len(room_code) == 6 and room_code.isalnum() and room_code.isupper(), (
        f"Invalid 6-char roomCode: {room_code}"
    )
    assert st_alice["you"] == "p1" and st_alice["hostId"] == "p1"
    assert st_alice["state"] == "lobby"

    # 4. Bob joins room
    await bob.send_json({"t": "join_room", "roomCode": room_code, "name": "Bob", "ch": 1})
    st_alice_2 = await alice.recv_until("room_state")
    st_bob_2 = await bob.recv_until("room_state")
    assert st_alice_2["you"] == "p1" and st_bob_2["you"] == "p2"
    assert len(st_bob_2["players"]) == 2

    # 5. Lobby updates: Character selection + Ready state + Cup selection (Cup 2 = Wild Cup)
    await bob.send_json({"t": "update_lobby", "ch": 2, "ready": True})
    await alice.recv_until("room_state")
    await bob.recv_until("room_state")

    await alice.send_json({"t": "update_lobby", "ch": 4, "ready": True, "cupIdx": 2, "mode": "cup", "cc": "200cc"})
    st_a_lobby = await alice.recv_until("room_state")
    st_b_lobby = await bob.recv_until("room_state")
    assert st_b_lobby["cupIdx"] == 2 and st_b_lobby["cc"] == "200cc", f"Expected cc=200cc, got {st_b_lobby}"
    p_map = {p["id"]: p for p in st_a_lobby["players"]}
    assert p_map["p1"]["ch"] == 4 and p_map["p1"]["ready"] is True
    assert p_map["p2"]["ch"] == 2 and p_map["p2"]["ready"] is True
    print(f"[PASS] Lobby created ({room_code}), 200cc synced, invalid join rejected, players ready")

    # 6. Start 4-Race Cup Tournament (Wild Cup tracks: dino=6, jungle=7, space=8, aztec=11)
    expected_tracks = [6, 7, 8, 11]
    await alice.send_json({"t": "start_cup"})

    expected_alice_pts = 0
    expected_bob_pts = 0

    for r_idx in range(4):
        rs_a = await alice.recv_until("race_start")
        rs_b = await bob.recv_until("race_start")
        assert rs_a["seed"] == rs_b["seed"] and rs_a["seed"] > 0
        assert rs_a["cupIdx"] == 2 and rs_a["raceIdx"] == r_idx
        assert rs_a["cc"] == "200cc", f"Expected race_start cc=200cc, got {rs_a}"
        assert rs_a["trackIdx"] == expected_tracks[r_idx]
        assert len(rs_a["players"]) == 2
        assert len(rs_a["aiChars"]) == 4  # 2 humans + 4 AI = 6 racers on grid
        ai_chars: List[int] = rs_a["aiChars"]

        # Test Host 10Hz AI Bot Sync (`ai_sync`), Remote AI Hit (`ai_hit`), and Quick-Chat Emotes (`emote`) on race 0!
        if r_idx == 0:
            bots_payload = [
                {"i": idx, "ch": ch, "x": 15.0 + idx * 4, "y": 1.2, "z": 30.0, "vx": 0.0, "vz": 52.0, "heading": 0.05, "speed": 52.0, "lap": 1, "progress": 210.0}
                for idx, ch in enumerate(ai_chars)
            ]
            await alice.send_json({"t": "ai_sync", "bots": bots_payload})
            ais_b = await bob.recv_until("ai_sync")
            assert ais_b["id"] == "p1" and len(ais_b["bots"]) == 4 and ais_b["bots"][0]["x"] == 15.0

            await bob.send_json({"t": "ai_hit", "aiIdx": 1, "ch": ai_chars[1]})
            aih_a = await alice.recv_until("ai_hit")
            assert aih_a["id"] == "p2" and aih_a["aiIdx"] == 1 and aih_a["ch"] == ai_chars[1]

            await bob.send_json({"t": "emote", "code": "1"})
            em_a = await alice.recv_until("emote")
            em_b = await bob.recv_until("emote")
            assert em_a["id"] == "p2" and em_a["name"] == "Bob" and "Nice Shot" in em_a["text"]
            assert em_b["id"] == "p2" and "Nice Shot" in em_b["text"]
            print("[PASS] Host 10Hz AI Bot Sync (ai_sync), Remote AI Hit (ai_hit) & Emote Broadcast verified")

        # Test kart_state relay (>125 bytes medium frame)
        await alice.send_json(
            {
                "t": "kart_state",
                "x": 100.25 + r_idx,
                "y": 4.5,
                "z": -52.75,
                "vx": 12.0,
                "vz": 44.0,
                "heading": 1.23,
                "moveAng": 1.21,
                "speed": 58.4,
                "steerVis": -0.35,
                "driftDir": 1,
                "driftCharge": 2.1,
                "boostT": 0.9,
                "hyperT": 0.0,
                "spinT": 0.0,
                "onGround": True,
                "lap": 2,
                "progress": 2150.5,
                "coins": 7,
                "item": "comet",
                "trail": True,
            }
        )
        ks_b = await bob.recv_until("kart_state")
        assert ks_b["id"] == "p1" and abs(ks_b["x"] - (100.25 + r_idx)) < 1e-5
        assert ks_b["item"] == "comet" and ks_b["coins"] == 7

        # Test item_event relay (including >65535 bytes large RFC 6455 frame on race 0!)
        big_pad = "X" * 68000 if r_idx == 0 else "ok"
        await bob.send_json(
            {
                "t": "item_event",
                "kind": "shrink",
                "data": {"x": 20.0, "z": 30.0, "blob": big_pad},
            }
        )
        ie_a = await alice.recv_until("item_event")
        assert ie_a["id"] == "p2" and ie_a["kind"] == "shrink"
        assert len(ie_a["data"]["blob"]) == len(big_pad)

        # Finish times: Alice wins races 0, 1, 3; Bob wins race 2
        if r_idx != 2:
            alice_t, bob_t = 78.125 + r_idx, 80.450 + r_idx
            expected_alice_pts += 15
            expected_bob_pts += 12
        else:
            bob_t, alice_t = 76.500, 79.200
            expected_bob_pts += 15
            expected_alice_pts += 12

        ai_payload = [{"ch": ch, "time": 85.0 + idx * 2.5} for idx, ch in enumerate(ai_chars)]

        # Exercise both message orderings across races:
        #   even races -> ai_results before last race_finish
        #   odd races  -> both race_finish first, then ai_results immediately after
        if r_idx % 2 == 0:
            await alice.send_json({"t": "ai_results", "ai": ai_payload})
            await alice.send_json({"t": "race_finish", "finishTime": alice_t, "bestLap": 25.1})
            await bob.send_json({"t": "race_finish", "finishTime": bob_t, "bestLap": 25.8})
        else:
            await alice.send_json({"t": "race_finish", "finishTime": alice_t, "bestLap": 24.9})
            await bob.send_json({"t": "race_finish", "finishTime": bob_t, "bestLap": 25.4})
            await alice.send_json({"t": "ai_results", "ai": ai_payload})

        rr_a = await alice.recv_until("race_results")
        rr_b = await bob.recv_until("race_results")
        assert rr_a["raceIdx"] == r_idx and rr_b["raceIdx"] == r_idx
        assert rr_a["isCupDone"] is (r_idx == 3)
        assert [o["gained"] for o in rr_a["order"]] == [15, 12, 10, 8, 7, 6]

        st_by_id = {s["id"]: s for s in rr_a["standings"]}
        assert st_by_id["p1"]["pts"] == expected_alice_pts
        assert st_by_id["p2"]["pts"] == expected_bob_pts

        # Host advances tournament
        await alice.send_json({"t": "next_race"})

    # After 4th race's next_race -> cup_complete!
    cc_a = await alice.recv_until("cup_complete")
    cc_b = await bob.recv_until("cup_complete")
    assert cc_a["winner"]["id"] == "p1"
    assert cc_a["winner"]["name"] == "Alice"
    assert cc_a["winner"]["pts"] == 57
    assert cc_b["standings"][1]["id"] == "p2" and cc_b["standings"][1]["pts"] == 51
    print("[PASS] Full 4-race Cup Tournament lifecycle + cumulative standings + cup_complete winner")

    # 7. Host disconnect & automatic host migration to Bob
    await alice.close()
    mig_bob = await bob.recv_until("room_state")
    assert mig_bob["hostId"] == "p2", f"Expected hostId='p2' after migration, got {mig_bob['hostId']}"
    p_after = {p["id"]: p for p in mig_bob["players"]}
    assert p_after["p1"]["connected"] is False
    assert p_after["p2"]["connected"] is True

    # Verify Bob (new host) can start a fresh Cup
    await bob.send_json({"t": "start_cup", "cupIdx": 0})
    rs_new_host = await bob.recv_until("race_start")
    assert rs_new_host["cupIdx"] == 0 and rs_new_host["raceIdx"] == 0
    print("[PASS] Host disconnect & automatic host migration to Bob ('p2')")

    await bob.close()


async def main_async() -> None:
    port = find_free_port()
    proc = subprocess.Popen(
        [sys.executable, str(SERVER_PY), "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    try:
        await wait_for_server(port)
        await test_http_endpoints(port)
        await test_phone_controller_protocol(port)
        await test_online_cup_lifecycle_and_migration(port)
        print("ALL ONLINE SERVER & CUP TOURNAMENT TESTS PASSED 100%!")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3.0)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    asyncio.run(main_async())
