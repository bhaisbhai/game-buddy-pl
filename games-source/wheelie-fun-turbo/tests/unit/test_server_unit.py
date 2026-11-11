"""Unit tests for server.py: constants, room/player model, Cup scoring, WebSocket framing
and the online protocol, driven through fake connections (no real sockets or timers > 0.3 s)."""
from __future__ import annotations

import asyncio
import json
import re
import struct
import unittest

from fakes import FakeWS, HubDriver, wf


# ----------------------------------------------------------------------------
# Static data and small helpers
# ----------------------------------------------------------------------------
class TestConstants(unittest.TestCase):
    def test_44_unique_tracks(self):
        self.assertEqual(len(wf.TRACK_IDS), 44)
        self.assertEqual(len(set(wf.TRACK_IDS)), 44)

    def test_11_cups_of_4_cover_every_track_exactly_once(self):
        self.assertEqual(len(wf.CUPS), 11)
        seen = [tid for cup in wf.CUPS for tid in cup["ids"]]
        self.assertTrue(all(len(c["ids"]) == 4 for c in wf.CUPS))
        self.assertEqual(sorted(seen), sorted(wf.TRACK_IDS))

    def test_cup_track_indices_point_at_their_ids(self):
        for cup in wf.CUPS:
            self.assertEqual([wf.TRACK_IDS[i] for i in cup["tracks"]], cup["ids"], cup["id"])

    def test_cup_ids_unique(self):
        self.assertEqual(len({c["id"] for c in wf.CUPS}), len(wf.CUPS))

    def test_points_strictly_decreasing_and_cover_a_full_field(self):
        pts = wf.CUP_POINTS
        self.assertTrue(all(a > b for a, b in zip(pts, pts[1:])))
        self.assertGreaterEqual(len(pts), 8, "a full 8-player room must all score")

    def test_ten_unique_characters(self):
        self.assertEqual(len(wf.CHAR_NAMES), 10)
        self.assertEqual(len(set(wf.CHAR_NAMES)), 10)


class TestNormalizeCC(unittest.TestCase):
    def test_valid_values_pass_through(self):
        for cc in wf.VALID_CC:
            self.assertEqual(wf.normalize_cc(cc), cc)

    def test_case_and_whitespace_are_cleaned(self):
        self.assertEqual(wf.normalize_cc("  200CC "), "200cc")
        self.assertEqual(wf.normalize_cc("Mirror"), "mirror")

    def test_invalid_values_fall_back(self):
        for bad in (None, "", "300cc", 150, [], {"cc": "50cc"}):
            self.assertEqual(wf.normalize_cc(bad), "150cc")
        self.assertEqual(wf.normalize_cc("nope", "50cc"), "50cc")


class TestInputParsing(unittest.TestCase):
    def test_to_int(self):
        self.assertEqual(wf.to_int("3"), 3)
        self.assertEqual(wf.to_int(2.9), 2)
        self.assertEqual(wf.to_int("2.5"), 2)
        for bad in ("x", None, [], {}, float("nan"), float("inf"), True):
            self.assertEqual(wf.to_int(bad, 7), 7, repr(bad))

    def test_to_time(self):
        self.assertEqual(wf.to_time(91.5), 91.5)
        self.assertEqual(wf.to_time("91.5"), 91.5)
        for bad in (None, "", "fast", 0, -5, float("nan"), float("inf"), 1e9, False):
            self.assertIsNone(wf.to_time(bad), repr(bad))

    def test_to_float(self):
        self.assertEqual(wf.to_float("1.5"), 1.5)
        self.assertEqual(wf.to_float("nope", 4.0), 4.0)
        self.assertEqual(wf.to_float(float("nan")), 0.0)


class TestPlayerSlot(unittest.TestCase):
    def test_name_trimmed_and_capped_at_18(self):
        p = wf.PlayerSlot("p1", "   " + "x" * 40 + "  ", 0, None)
        self.assertEqual(p.name, "x" * 18)

    def test_blank_name_becomes_racer(self):
        self.assertEqual(wf.PlayerSlot("p1", "   ", 0, None).name, "Racer")
        self.assertEqual(wf.PlayerSlot("p1", "", 0, None).name, "Racer")

    def test_character_index_is_clamped(self):
        self.assertEqual(wf.PlayerSlot("p1", "a", -5, None).ch, 0)
        self.assertEqual(wf.PlayerSlot("p1", "a", 99, None).ch, len(wf.CHAR_NAMES) - 1)

    def test_to_dict_has_public_fields_only(self):
        d = wf.PlayerSlot("p3", "Ann", 2, None).to_dict()
        self.assertEqual(set(d), {"id", "name", "ch", "ready", "pts", "connected"})


class TestOnlineRoom(unittest.TestCase):
    def test_cup_mode_starts_on_first_track_of_cup(self):
        r = wf.OnlineRoom("ABCD12", "p1", cup_idx=3, mode="cup")
        self.assertEqual(r.track_idx, wf.CUPS[3]["tracks"][0])

    def test_single_mode_keeps_and_clamps_track(self):
        self.assertEqual(wf.OnlineRoom("A", "p1", mode="single", track_idx=7).track_idx, 7)
        self.assertEqual(wf.OnlineRoom("A", "p1", mode="single", track_idx=999).track_idx, 43)

    def test_unknown_mode_means_cup_and_cup_index_clamped(self):
        r = wf.OnlineRoom("A", "p1", cup_idx=50, mode="weird")
        self.assertEqual(r.mode, "cup")
        self.assertEqual(r.cup_idx, len(wf.CUPS) - 1)

    def test_bad_cc_falls_back(self):
        self.assertEqual(wf.OnlineRoom("A", "p1", cc="999cc").cc, "150cc")

    def test_player_ids_fill_lowest_free_slot(self):
        r = wf.OnlineRoom("A", "p1")
        for i in range(1, 9):
            pid = r.next_player_id()
            self.assertEqual(pid, f"p{i}")
            r.players.append(wf.PlayerSlot(pid, "x", 0, FakeWS()))
        self.assertIsNone(r.next_player_id())

    def test_full_room_prunes_disconnected_pointless_players(self):
        r = wf.OnlineRoom("A", "p1")
        for i in range(1, 9):
            r.players.append(wf.PlayerSlot(f"p{i}", "x", 0, FakeWS()))
        r.players[2].connected = False          # p3 left with 0 points -> slot can be reused
        r.players[4].connected = False          # p5 left but has points -> keeps slot for standings
        r.players[4].pts = 12
        self.assertEqual(r.next_player_id(), "p3")
        self.assertIsNotNone(r.get_player("p5"))


class TestHubHelpers(unittest.TestCase):
    def setUp(self):
        self.hub = wf.OnlineCupHub()

    def test_room_codes_are_six_unambiguous_chars(self):
        for _ in range(300):
            code = self.hub._generate_room_code()
            self.assertRegex(code, r"^[A-HJ-NP-Z]{4}[A-HJ-NP-Z2-9]{2}$")
            self.assertNotRegex(code, r"[IO01]")

    def test_room_codes_avoid_existing_rooms(self):
        class Seq:
            def __init__(self, values):
                self.values = iter(values)

            def choice(self, _):
                return next(self.values)
        self.hub.rooms["AAAAAA"] = object()
        self.hub._rng = Seq("AAAAAA" + "BBBBBB")
        self.assertEqual(self.hub._generate_room_code(), "BBBBBB")

    def test_ai_fills_field_to_six_without_copying_human_characters(self):
        for humans in ([0], [0, 1], [2, 4, 5], [9], [6, 7, 8]):
            ai = self.hub._choose_ai_chars(humans, len(humans))
            self.assertEqual(len(ai) + len(humans), 6, humans)
            self.assertEqual(len(set(ai)), len(ai))
            self.assertFalse(set(ai) & set(humans), f"AI duplicates a human character: {humans} -> {ai}")

    def test_no_ai_once_six_or_more_humans(self):
        self.assertEqual(self.hub._choose_ai_chars(list(range(6)), 6), [])
        self.assertEqual(self.hub._choose_ai_chars([0] * 8, 8), [])

    def test_standings_sorted_by_points_then_humans_first(self):
        r = wf.OnlineRoom("A", "p1")
        a, b = wf.PlayerSlot("p1", "A", 0, FakeWS()), wf.PlayerSlot("p2", "B", 1, FakeWS())
        a.pts, b.pts = 10, 25
        r.players = [a, b]
        r.ai_chars, r.ai_pts = [2, 3], {2: 25, 3: 3}
        st = self.hub._build_standings(r, {"p2": 15})
        self.assertEqual([e["id"] for e in st], ["p2", "ai_2", "p1", "ai_3"])
        self.assertEqual([e["rank"] for e in st], [1, 2, 3, 4])
        self.assertEqual(st[0]["lastGain"], 15)
        self.assertEqual(st[1]["name"], wf.CHAR_NAMES[2])


# ----------------------------------------------------------------------------
# RFC 6455 framing
# ----------------------------------------------------------------------------
class FakeWriter:
    def __init__(self):
        self.data = bytearray()
        self.closed = False

    def write(self, b):
        self.data += b

    async def drain(self):
        pass

    def close(self):
        self.closed = True

    async def wait_closed(self):
        pass


def frame(opcode: int, payload: bytes, fin: bool = True, mask: bytes = b"\x01\x02\x03\x04") -> bytes:
    b0 = (0x80 if fin else 0) | opcode
    n = len(payload)
    if n < 126:
        hdr = struct.pack("!BB", b0, 0x80 | n)
    elif n <= 0xFFFF:
        hdr = struct.pack("!BBH", b0, 0x80 | 126, n)
    else:
        hdr = struct.pack("!BBQ", b0, 0x80 | 127, n)
    masked = bytes(c ^ mask[i % 4] for i, c in enumerate(payload))
    return hdr + mask + masked


class TestWebSocketFraming(unittest.IsolatedAsyncioTestCase):
    def make(self, *frames: bytes):
        reader = asyncio.StreamReader()
        for f in frames:
            reader.feed_data(f)
        reader.feed_eof()
        writer = FakeWriter()
        return wf.WebSocketConnection(reader, writer, "/ws", {}), writer

    def test_unmask_roundtrip(self):
        mask = b"\x9a\x01\xff\x10"
        data = bytes(range(256)) * 3
        masked = bytes(c ^ mask[i % 4] for i, c in enumerate(data))
        self.assertEqual(wf.WebSocketConnection._unmask(masked, mask), data)
        self.assertEqual(wf.WebSocketConnection._unmask(b"", mask), b"")

    async def test_short_medium_and_long_text_frames(self):
        for size in (0, 5, 125, 126, 65535, 65536, 200_000):
            text = ("é" * size)[:size] if size < 1000 else "a" * size
            ws, _ = self.make(frame(0x1, text.encode()))
            self.assertEqual(await ws.recv_message(), text, size)

    async def test_fragmented_message_with_ping_in_between(self):
        ws, w = self.make(
            frame(0x1, b"Hel", fin=False),
            frame(0x9, b"hi"),             # control frame between fragments must be answered
            frame(0x0, b"lo ", fin=False),
            frame(0x0, b"kart", fin=True),
        )
        self.assertEqual(await ws.recv_message(), "Hello kart")
        self.assertEqual(bytes(w.data), b"\x8a\x02hi", "ping must be answered with a pong")

    async def test_close_frame_echoes_code_and_ends(self):
        ws, w = self.make(frame(0x8, struct.pack("!H", 1001) + b"bye"))
        self.assertIsNone(await ws.recv_message())
        self.assertTrue(ws.closed)
        self.assertEqual(bytes(w.data), b"\x88\x02" + struct.pack("!H", 1001))

    async def test_oversized_frame_closes_with_1009(self):
        hdr = struct.pack("!BBQ", 0x81, 0x80 | 127, wf.MAX_FRAME_BYTES + 1)
        ws, w = self.make(hdr)
        self.assertIsNone(await ws.recv_message())
        self.assertEqual(w.data[0], 0x88, "server should send a close frame")
        self.assertEqual(struct.unpack("!H", bytes(w.data[2:4]))[0], 1009)

    async def test_truncated_stream_returns_none(self):
        ws, _ = self.make(frame(0x1, b"hello")[:-2])
        self.assertIsNone(await ws.recv_message())
        self.assertTrue(ws.closed)

    async def test_send_frame_length_encodings(self):
        for n, hdr_len in ((0, 2), (125, 2), (126, 4), (65535, 4), (65536, 10)):
            ws, w = self.make()
            await ws.send_frame(0x2, b"x" * n)
            self.assertEqual(len(w.data), hdr_len + n, n)
            self.assertEqual(w.data[0], 0x82)

    async def test_send_after_close_is_ignored(self):
        ws, w = self.make()
        await ws.close(1000, "done")
        before = len(w.data)
        await ws.send_text("late")
        self.assertEqual(len(w.data), before)


# ----------------------------------------------------------------------------
# Online protocol through OnlineCupHub.handle()
# ----------------------------------------------------------------------------
class ProtocolTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.d = HubDriver(grace_seconds=0.2)

    async def asyncTearDown(self):
        await self.d.close_all()

    async def lobby(self, n: int = 2, **create):
        names = ["host"] + [f"g{i}" for i in range(1, n)]
        for nm in names:
            self.d.connect(nm)
        await self.d.send("host", {"t": "create_room", "name": "Host", "ch": 0, **create})
        code = self.d.clients["host"].last("room_state")["roomCode"]
        for i, nm in enumerate(names[1:], start=1):
            await self.d.send(nm, {"t": "join_room", "roomCode": code, "name": nm, "ch": i})
        return code, names

    async def finish_all(self, times: dict, ai=None):
        """times: client name -> finish time. Host also reports AI results if given."""
        for nm, t in times.items():
            msg = {"t": "race_finish", "finishTime": t, "bestLap": t / 3}
            if ai is not None and nm == "host":
                msg["ai"] = ai
            await self.d.send(nm, msg)
        await self.d.settle(0.1)


class TestLobby(ProtocolTest):
    async def test_create_room_returns_state_with_host(self):
        code, _ = await self.lobby(1, cc="200cc", cupIdx=2)
        st = self.d.clients["host"].last("room_state")
        self.assertEqual((st["you"], st["hostId"], st["cc"], st["cupIdx"]), ("p1", "p1", "200cc", 2))
        self.assertEqual(st["trackIdx"], wf.CUPS[2]["tracks"][0])
        self.assertIn(code, self.d.hub.rooms)

    async def test_join_is_case_insensitive_and_broadcast_to_all(self):
        code, _ = await self.lobby(1)
        self.d.connect("g")
        await self.d.send("g", {"t": "join_room", "roomCode": "  " + code.lower() + " ", "name": "G"})
        self.assertEqual(self.d.clients["g"].last("room_state")["you"], "p2")
        self.assertEqual(len(self.d.clients["host"].last("room_state")["players"]), 2)

    async def test_join_unknown_room_errors(self):
        self.d.connect("g")
        await self.d.send("g", {"t": "join_room", "roomCode": "NOPE99"})
        self.assertIn("not found", self.d.clients["g"].last("error")["msg"])

    async def test_room_holds_max_eight(self):
        code, _ = await self.lobby(8)
        self.d.connect("late")
        await self.d.send("late", {"t": "join_room", "roomCode": code})
        self.assertIn("full", self.d.clients["late"].last("error")["msg"])

    async def test_cannot_join_mid_cup(self):
        code, _ = await self.lobby(2)
        await self.d.send("host", {"t": "start_cup"})
        self.d.connect("late")
        await self.d.send("late", {"t": "join_room", "roomCode": code})
        self.assertIn("mid-cup", self.d.clients["late"].last("error")["msg"])

    async def test_only_host_changes_room_settings(self):
        await self.lobby(2)
        await self.d.send("g1", {"t": "update_lobby", "cc": "50cc", "cupIdx": 5, "ready": True})
        room = self.d.room()
        self.assertEqual((room.cc, room.cup_idx), ("150cc", 0))
        self.assertTrue(room.get_player("p2").ready, "guests can still set their own ready flag")
        await self.d.send("host", {"t": "update_lobby", "cc": "50cc", "cupIdx": 5})
        self.assertEqual((room.cc, room.cup_idx), ("50cc", 5))
        self.assertEqual(room.track_idx, wf.CUPS[5]["tracks"][0])

    async def test_guest_cannot_start(self):
        await self.lobby(2)
        await self.d.send("g1", {"t": "start_cup"})
        self.assertIn("Only the host", self.d.clients["g1"].last("error")["msg"])
        self.assertEqual(self.d.room().state, "lobby")

    async def test_invalid_json_gets_error_and_connection_survives(self):
        await self.lobby(1)
        await self.d.send("host", "{not json")
        self.assertEqual(self.d.clients["host"].last("error")["msg"], "Invalid JSON message")
        await self.d.send("host", {"t": "ping", "ts": 7})
        self.assertEqual(self.d.clients["host"].last("pong")["ts"], 7)

    async def test_host_leaving_migrates_host(self):
        await self.lobby(3)
        await self.d.disconnect("host")
        st = self.d.clients["g1"].last("room_state")
        self.assertEqual(st["hostId"], "p2")

    async def test_room_removed_when_everyone_leaves(self):
        await self.lobby(2)
        await self.d.disconnect("host")
        await self.d.disconnect("g1")
        self.assertEqual(self.d.hub.rooms, {})


class TestRelays(ProtocolTest):
    async def test_kart_state_relays_whitelisted_fields_to_others_only(self):
        await self.lobby(2)
        await self.d.send("host", {"t": "start_cup"})
        await self.d.send("host", {"t": "kart_state", "x": 1, "z": 2, "speed": 30, "evil": "<script>"})
        relay = self.d.clients["g1"].last("kart_state")
        self.assertEqual((relay["id"], relay["x"], relay["speed"]), ("p1", 1, 30))
        self.assertNotIn("evil", relay)
        self.assertEqual(self.d.clients["host"].of_type("kart_state"), [])

    async def test_ai_sync_only_from_host(self):
        await self.lobby(2)
        await self.d.send("g1", {"t": "ai_sync", "bots": [{"x": 1}]})
        self.assertEqual(self.d.clients["host"].of_type("ai_sync"), [])
        await self.d.send("host", {"t": "ai_sync", "bots": "not a list"})
        self.assertEqual(self.d.clients["g1"].last("ai_sync")["bots"], [])

    async def test_emotes_use_presets_and_cap_custom_text(self):
        await self.lobby(2)
        await self.d.send("g1", {"t": "emote", "code": "4"})
        self.assertEqual(self.d.clients["host"].last("emote")["text"], wf.EMOTE_PRESETS["4"])
        self.assertEqual(self.d.clients["g1"].last("emote")["text"], wf.EMOTE_PRESETS["4"], "sender sees own emote")
        await self.d.send("g1", {"t": "emote", "code": "zz", "text": "y" * 100})
        self.assertEqual(self.d.clients["host"].last("emote")["text"], "y" * 32)


class TestCupScoring(ProtocolTest):
    async def test_race_start_brings_ai_up_to_six(self):
        await self.lobby(2)
        await self.d.send("host", {"t": "start_cup"})
        rs = self.d.clients["g1"].last("race_start")
        self.assertEqual(len(rs["aiChars"]), 4)
        self.assertEqual(rs["trackIdx"], wf.CUPS[0]["tracks"][0])

    async def test_points_follow_finishing_order(self):
        await self.lobby(2)
        await self.d.send("host", {"t": "start_cup"})
        ai = [{"ch": ch, "time": 100 + 5 * i} for i, ch in enumerate(self.d.room().ai_chars)]
        await self.finish_all({"host": 101.5, "g1": 99.0}, ai=ai)
        res = self.d.clients["host"].last("race_results")
        self.assertEqual(res["order"][0]["id"], "p2")
        self.assertEqual([o["gained"] for o in res["order"]], wf.CUP_POINTS[:6])
        self.assertEqual([o["place"] for o in res["order"]], [1, 2, 3, 4, 5, 6])
        host_row = next(o for o in res["order"] if o["id"] == "p1")
        self.assertEqual(host_row["place"], 3)   # 99.0, ai 100.0, host 101.5
        self.assertFalse(res["isCupDone"])

    async def test_dnf_after_grace_period(self):
        await self.lobby(2)
        await self.d.send("host", {"t": "start_cup"})
        await self.d.send("host", {"t": "race_finish", "finishTime": 90.0})
        self.assertEqual(self.d.clients["host"].of_type("race_results"), [])
        await self.d.settle(0.35)  # grace is 0.2 s in this test
        res = self.d.clients["host"].last("race_results")
        g = next(o for o in res["order"] if o["id"] == "p2")
        self.assertTrue(g["dnf"])
        self.assertEqual(res["order"][0]["id"], "p1")

    async def test_full_cup_runs_four_races_then_completes(self):
        await self.lobby(2)
        await self.d.send("host", {"t": "start_cup"})
        for race in range(4):
            rs = self.d.clients["host"].last("race_start")
            self.assertEqual(rs["raceIdx"], race)
            self.assertEqual(rs["trackIdx"], wf.CUPS[0]["tracks"][race])
            await self.finish_all({"host": 80.0, "g1": 85.0}, ai=[{"ch": c, "time": 120} for c in rs["aiChars"]])
            res = self.d.clients["host"].last("race_results")
            self.assertEqual(res["isCupDone"], race == 3)
            await self.d.send("host", {"t": "update_lobby", "ready": True})
            await self.d.send("g1", {"t": "update_lobby", "ready": True})
        done = self.d.clients["g1"].last("cup_complete")
        self.assertEqual(done["winner"]["id"], "p1")
        self.assertEqual(done["winner"]["pts"], 4 * wf.CUP_POINTS[0])

    async def test_single_race_mode_completes_after_one(self):
        await self.lobby(1, mode="single", trackIdx=40)
        await self.d.send("host", {"t": "start_race"})
        self.assertEqual(self.d.clients["host"].last("race_start")["trackIdx"], 40)
        await self.finish_all({"host": 70.0}, ai=[])
        await self.d.settle(0.1)
        self.assertTrue(self.d.clients["host"].last("race_results")["isCupDone"])

    async def test_finish_after_results_is_ignored(self):
        await self.lobby(1)
        await self.d.send("host", {"t": "start_cup"})
        await self.finish_all({"host": 70.0}, ai=[])
        n = len(self.d.clients["host"].of_type("race_results"))
        await self.d.send("host", {"t": "race_finish", "finishTime": 1.0})
        self.assertEqual(len(self.d.clients["host"].of_type("race_results")), n)


# ----------------------------------------------------------------------------
# Robustness: bad or hostile client input. A malformed message should get an
# error reply (or be ignored) without killing the player's connection.
# ----------------------------------------------------------------------------
class TestRobustness(ProtocolTest):
    async def assert_survives(self, name: str):
        self.assertNotIn(name, self.d.errors, f"handler crashed: {self.d.errors.get(name)!r}")
        await self.d.send(name, {"t": "ping", "ts": 1})
        self.assertTrue(self.d.clients[name].of_type("pong"), "connection should still be alive")

    async def test_non_numeric_cup_index_on_create(self):
        self.d.connect("host")
        await self.d.send("host", {"t": "create_room", "cupIdx": "abc"})
        await self.assert_survives("host")

    async def test_non_numeric_character_on_join(self):
        code, _ = await self.lobby(1)
        self.d.connect("g")
        await self.d.send("g", {"t": "join_room", "roomCode": code, "ch": "x"})
        await self.assert_survives("g")

    async def test_non_numeric_character_in_lobby_update(self):
        await self.lobby(1)
        await self.d.send("host", {"t": "update_lobby", "ch": "blue"})
        await self.assert_survives("host")

    async def test_non_numeric_finish_time(self):
        await self.lobby(1)
        await self.d.send("host", {"t": "start_cup"})
        await self.d.send("host", {"t": "race_finish", "finishTime": "fast"})
        await self.assert_survives("host")

    async def test_missing_or_negative_finish_time_cannot_win(self):
        await self.lobby(3)
        await self.d.send("host", {"t": "start_cup"})
        await self.d.send("host", {"t": "race_finish", "finishTime": 95.0, "ai": []})
        await self.d.send("g1", {"t": "race_finish"})                       # no time at all
        await self.d.send("g2", {"t": "race_finish", "finishTime": -50})    # impossible time
        await self.d.settle(0.1)
        res = self.d.clients["host"].last("race_results")
        self.assertEqual(res["order"][0]["id"], "p1",
                         f"a missing/negative finish time won the race: {[(o['id'], o['time']) for o in res['order'][:3]]}")

    async def test_nan_ai_time_does_not_scramble_order(self):
        await self.lobby(1)
        await self.d.send("host", {"t": "start_cup"})
        chars = self.d.room().ai_chars
        ai = [{"ch": chars[0], "time": float("nan")}] + [{"ch": c, "time": 200 + i} for i, c in enumerate(chars[1:])]
        await self.d.send("host", json.dumps({"t": "race_finish", "finishTime": 100.0, "ai": ai}))
        await self.d.settle(0.1)
        times = [o["time"] for o in self.d.clients["host"].last("race_results")["order"]]
        finite = [t for t in times if t == t]
        self.assertEqual(len(finite), len(times), f"NaN time leaked into results: {times}")

    async def test_bad_progress_value_does_not_break_results(self):
        await self.lobby(2)
        await self.d.send("host", {"t": "start_cup"})
        await self.d.send("g1", {"t": "kart_state", "progress": "lots"})
        await self.d.send("host", {"t": "race_finish", "finishTime": 90.0, "ai": []})
        await self.d.settle(0.35)
        self.assertEqual(self.d.errors, {})
        self.assertTrue(self.d.clients["host"].of_type("race_results"))

    async def test_valid_but_slow_dnf_finisher_still_scores(self):
        await self.lobby(2)
        await self.d.send("host", {"t": "start_cup"})
        await self.d.send("host", {"t": "race_finish", "finishTime": 90.0, "ai": []})
        await self.d.send("g1", {"t": "race_finish"})
        await self.d.settle(0.1)
        res = self.d.clients["host"].last("race_results")
        g = next(o for o in res["order"] if o["id"] == "p2")
        self.assertTrue(g["dnf"])
        self.assertGreater(g["gained"], 0)

    async def test_results_advance_when_last_unready_player_leaves(self):
        await self.lobby(3)
        await self.d.send("host", {"t": "start_cup"})
        await self.finish_all({"host": 80.0, "g1": 81.0, "g2": 82.0}, ai=[])
        await self.d.send("host", {"t": "update_lobby", "ready": True})
        await self.d.send("g1", {"t": "update_lobby", "ready": True})
        await self.d.disconnect("g2")  # the only player who had not pressed ready
        self.assertEqual(self.d.room().state, "racing",
                         "everyone left is ready, but the room is stuck on the results screen")


if __name__ == "__main__":
    unittest.main(verbosity=2)
