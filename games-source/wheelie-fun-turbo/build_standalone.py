#!/usr/bin/env python3
"""Rebuilds index.html (from original_index.html) and wheelie-fun-standalone.html (index.html with
new_tracks.js, upgrades_v2.js and online_client.js inlined). Usage: python build_standalone.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_game

ROOT = Path(__file__).resolve().parent
TAGS = ('<script src="new_tracks.js"></script>\n'
        '<script src="upgrades_v2.js"></script>\n'
        '<script src="online_client.js"></script>')
# Libraries the game normally loads from CDNs. Inlined from vendor/ so the installed game works offline.
VENDOR = {
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js": "three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js": "CopyShader.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js": "EffectComposer.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js": "ShaderPass.js",
    "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js": "RenderPass.js",
}
FONT_LINKS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
              '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
              '<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">')
FONTS_CSS = "fonts-offline.css"  # the same two fonts, embedded
QR_LIB = "qrcode.min.js"  # the phone-join QR code; the game uses window.qrcode when it is already loaded


def vendor_js(name: str) -> str:
    js = (ROOT / "vendor" / name).read_text(encoding="utf-8")
    assert "</script" not in js.lower(), name
    return f"<script>\n{js}\n</script>"


def main() -> None:
    build_game.build()
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert TAGS in html, "script tags not found in index.html"
    inlined = "\n".join(f"<script>\n{(ROOT / n).read_text(encoding='utf-8')}\n</script>"
                        for n in ("new_tracks.js", "upgrades_v2.js", "online_client.js"))
    for url, name in VENDOR.items():
        tag = f'<script src="{url}"></script>'
        assert html.count(tag) == 1, f"CDN tag not found: {url}"
        extra = "\n" + vendor_js(QR_LIB) if name == "RenderPass.js" else ""
        html = html.replace(tag, vendor_js(name) + extra)
    assert html.count(FONT_LINKS) == 1, "Google Fonts links not found"
    html = html.replace(FONT_LINKS, "<style>\n" + (ROOT / "vendor" / FONTS_CSS).read_text(encoding="utf-8") + "</style>")
    out = ROOT / "wheelie-fun-standalone.html"
    out.write_text(html.replace(TAGS, inlined, 1), encoding="utf-8", newline="")
    print(f"Built {out.name} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
