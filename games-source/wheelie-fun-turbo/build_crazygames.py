#!/usr/bin/env python3
"""Builds wheelie-fun-crazygames.html: wheelie-fun-standalone.html plus the CrazyGames SDK script
tag. The game's own code (original_index.html) already calls the SDK's init/gameplayStart/
gameplayStop methods, but only when window.CrazyGames exists -- so the regular standalone build
stays dependency-free, and this is the one file that actually loads their SDK.
Run build_standalone.py first. Usage: python build_crazygames.py"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "wheelie-fun-standalone.html"
SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'
ANCHOR = '<meta charset="utf-8">'


def main() -> None:
    html = SRC.read_text(encoding="utf-8")
    assert html.count(ANCHOR) == 1, "charset meta tag not found"
    assert SDK_TAG not in html, "SDK tag already present"
    html = html.replace(ANCHOR, ANCHOR + "\n<!-- Load the SDK before the game code -->\n" + SDK_TAG, 1)
    out = ROOT / "wheelie-fun-crazygames.html"
    out.write_text(html, encoding="utf-8", newline="")
    print(f"Built {out.name} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
