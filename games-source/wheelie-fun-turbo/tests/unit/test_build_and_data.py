"""Build reproducibility, JavaScript syntax, and cross-file data consistency.

The game ships as several copies of the same logic (server.py, online_client.js's serverless
host, and the main game). These tests make sure they agree, and that the shipped files are
exactly what the build scripts produce from source.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from fakes import ROOT, wf

NODE = shutil.which("node")
JS_FILES = ["new_tracks.js", "upgrades_v2.js", "online_client.js"]
BUNDLE_TAGS = ('<script src="new_tracks.js"></script>\n'
               '<script src="upgrades_v2.js"></script>\n'
               '<script src="online_client.js"></script>')


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def inline_scripts(html: str) -> list[str]:
    return re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, flags=re.S)


def js_array_of_strings(src: str, name: str) -> list[str]:
    m = re.search(rf"const {name} = \[(.*?)\];", src, flags=re.S)
    assert m, f"{name} not found"
    return re.findall(r"'([^']*)'", m.group(1))


class TestBuild(unittest.TestCase):
    def test_index_html_is_reproducible_from_original(self):
        import build_game

        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "index.html"
            old = (build_game.SRC, build_game.OUT)
            build_game.SRC, build_game.OUT = str(ROOT / "original_index.html"), str(out)
            try:
                build_game.build()
            finally:
                build_game.SRC, build_game.OUT = old
            self.assertTrue(out.read_text(encoding="utf-8") == read("index.html"),
                            "index.html differs from what build_game.py produces - an edit was made by hand "
                            "or the build script is out of date")

    def test_standalone_is_index_plus_inlined_scripts(self):
        html = read("index.html")
        self.assertIn(BUNDLE_TAGS, html)
        inlined = "".join(f"<script>\n{read(n)}\n</script>\n" for n in JS_FILES).rstrip("\n")
        import build_standalone as bs

        for url, name in bs.VENDOR.items():
            extra = "\n" + bs.vendor_js(bs.QR_LIB) if name == "RenderPass.js" else ""
            html = html.replace(f'<script src="{url}"></script>', bs.vendor_js(name) + extra)
        html = html.replace(bs.FONT_LINKS, "<style>\n" + (ROOT / "vendor" / bs.FONTS_CSS).read_text(encoding="utf-8") + "</style>")
        expected = html.replace(BUNDLE_TAGS, inlined, 1)
        self.assertTrue(expected == read("wheelie-fun-standalone.html"),
                        "wheelie-fun-standalone.html is stale: rebuild it from index.html + the .js files")

    def test_standalone_runs_offline(self):
        html = read("wheelie-fun-standalone.html")
        self.assertNotRegex(html, r'<script src="https?://[^"]*three', "three.js must be inlined, not loaded from a CDN")
        self.assertIn("window.qrcode", html)
        self.assertIn("var qrcode", html)
        self.assertNotIn("fonts.googleapis.com", html)
        self.assertIn("font-family: 'Bungee'", html)

    def test_standalone_has_no_local_script_references(self):
        html = read("wheelie-fun-standalone.html")
        for n in JS_FILES:
            self.assertNotIn(f'src="{n}"', html)


@unittest.skipUnless(NODE, "node is not installed")
class TestJavaScriptSyntax(unittest.TestCase):
    def check(self, label: str, code: str) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "chunk.js"
            p.write_text(code, encoding="utf-8")
            r = subprocess.run([NODE, "--check", str(p)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, f"{label}: {r.stderr}")

    def test_external_scripts_parse(self):
        for n in JS_FILES:
            with self.subTest(n):
                self.check(n, read(n))

    def test_inline_scripts_parse(self):
        for page in ("index.html", "wheelie-fun-standalone.html"):
            for i, code in enumerate(inline_scripts(read(page))):
                with self.subTest(page=page, script=i):
                    self.check(f"{page} script #{i}", code)


class TestServerVsClientData(unittest.TestCase):
    """online_client.js falls back to its own copies of these tables; they must match server.py."""

    @classmethod
    def setUpClass(cls):
        cls.oc = read("online_client.js")

    def test_track_ids_and_order(self):
        self.assertEqual(js_array_of_strings(self.oc, "FALLBACK_TRACK_IDS"), wf.TRACK_IDS)

    def test_cups(self):
        js_cups = re.findall(r"\{ id: '(\w+)', name: '([^']+)', ids: \[([^\]]+)\]", self.oc)
        js = [{"id": i, "name": n, "ids": re.findall(r"'(\w+)'", ids)} for i, n, ids in js_cups]
        py = [{"id": c["id"], "name": c["name"], "ids": c["ids"]} for c in wf.CUPS]
        self.assertEqual(js, py)

    def test_points(self):
        m = re.search(r"const CUP_POINTS = (\[[^\]]*\]);", self.oc)
        self.assertEqual(json.loads(m.group(1)), wf.CUP_POINTS)

    def test_character_names(self):
        names = re.findall(r"\{ name: '(\w+)', kart: 0x", self.oc)
        self.assertEqual(names, wf.CHAR_NAMES)

    def test_speed_classes(self):
        labels = re.search(r"const CC_LABELS = \{(.*?)\};", self.oc, flags=re.S).group(1)
        self.assertEqual(tuple(re.findall(r"'(\w+)':", labels)), wf.VALID_CC)
        v2 = read("upgrades_v2.js")
        self.assertEqual(tuple(js_array_of_strings(v2, "CC_ORDER")), wf.VALID_CC)

    def test_emotes(self):
        block = re.search(r"const EMOTE_PRESETS = \{(.*?)\};", self.oc, flags=re.S).group(1)
        self.assertEqual(dict(re.findall(r"'(\d)': '([^']+)'", block)), wf.EMOTE_PRESETS)

    def test_grace_period(self):
        self.assertEqual(int(re.search(r"GRACE_MS = (\d+)", self.oc).group(1)), int(wf.OnlineCupHub().grace_seconds * 1000))


class TestCrazyGamesSaveBridge(unittest.TestCase):
    """build_crazygames.py injects a save-data bridge keyed off a hardcoded list of cup/track
    ids (CrazyGames.SDK.data has no way to enumerate keys, so the build can't discover them at
    build time). These tests make sure that list hasn't drifted from the game's real cups and
    tracks, and that the generated bridge is well-formed."""

    @classmethod
    def setUpClass(cls):
        import build_crazygames as bc
        cls.bc = bc

    def test_cup_ids_match_server(self):
        self.assertEqual(self.bc.CUP_IDS, [c["id"] for c in wf.CUPS])

    def test_track_ids_match_server(self):
        self.assertEqual(sorted(self.bc.TRACK_IDS), sorted(wf.TRACK_IDS))
        self.assertEqual(len(self.bc.TRACK_IDS), len(set(self.bc.TRACK_IDS)), "duplicate track id")

    def test_fixed_keys_all_use_a_recognized_prefix(self):
        for k in self.bc.FIXED_KEYS:
            with self.subTest(k):
                self.assertTrue(k.startswith("wheeliefun.") or k.startswith("tikiturbo."))

    def _build_fresh(self) -> str:
        """Runs build_crazygames.main() against the current wheelie-fun-standalone.html, into a
        throwaway temp dir, and returns the resulting html (both files are gitignored build
        artifacts, so this never depends on -- or pollutes -- anything already on disk)."""
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "wheelie-fun-standalone.html").write_text(read("wheelie-fun-standalone.html"), encoding="utf-8")
            old = (self.bc.SRC, self.bc.ROOT)
            self.bc.SRC, self.bc.ROOT = Path(tmp) / "wheelie-fun-standalone.html", Path(tmp)
            try:
                self.bc.main()
            finally:
                self.bc.SRC, self.bc.ROOT = old
            return (Path(tmp) / "wheelie-fun-crazygames.html").read_text(encoding="utf-8")

    def test_build_produces_bridge_before_the_sdk_script_runs(self):
        html = self._build_fresh()
        self.assertEqual(html.count("__KEYS__"), 0, "the __KEYS__ placeholder was left unsubstituted")
        sdk_at = html.index(self.bc.SDK_TAG)
        bridge_at = html.index("CrazyGames save-data bridge")
        self.assertLess(sdk_at, bridge_at, "the bridge must come after the SDK tag (it calls CrazyGames.SDK.*)")
        # both must still be ahead of every other script on the page (three.js, the game itself)
        first_other_script = html.index("<script", html.index("</script>", bridge_at) + len("</script>"))
        self.assertGreater(first_other_script, bridge_at)
        keys = json.loads(re.search(r"var KEYS=(\[.*?\]);", html).group(1).replace("'", '"'))
        self.assertEqual(len(keys), len(set(keys)), "duplicate key in the generated KEYS list")
        self.assertEqual(
            set(keys),
            set(self.bc.FIXED_KEYS)
            | {"wheeliefun.trophy." + c for c in self.bc.CUP_IDS}
            | {"wheeliefun.best." + t for t in self.bc.TRACK_IDS},
        )

    @unittest.skipUnless(NODE, "node is not installed")
    def test_bridge_script_is_valid_javascript(self):
        code = next(c for c in inline_scripts(self._build_fresh()) if "CrazyGames save-data bridge" in c)
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "bridge.js"
            p.write_text(code, encoding="utf-8")
            r = subprocess.run([NODE, "--check", str(p)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)

    def test_standalone_build_itself_has_no_bridge(self):
        """The save-data bridge and SDK script tag must only ever appear in the crazygames-
        specific output -- the regular site build (wheelie-fun-standalone.html, and
        games/wheelie-fun-turbo/index.html copied from it) must stay untouched by this feature.
        (The game's own guarded `if(window.CrazyGames)` calls already exist in every build and
        are a no-op there; this checks for the bridge itself, not those.)"""
        html = read("wheelie-fun-standalone.html")
        self.assertNotIn("CrazyGames save-data bridge", html)
        self.assertNotIn(self.bc.SDK_TAG, html)


if __name__ == "__main__":
    unittest.main(verbosity=2)
