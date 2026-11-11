# Wheelie Fun Turbo

A Three.js browser kart racer: 44 tracks in 11 Grand Prix Cups, 10 racers with Signature Hype abilities, a Kart
Garage, speed classes (50cc–200cc + Mirror), Time Trials with shareable ghosts, anti-gravity sections, 1–4 player
split-screen, phone controllers and online cups.

## Play it
Double-click **`wheelie-fun-standalone.html`** (Chrome or Edge recommended). Everything is inside that one file,
including three.js and the fonts, so it works offline. Only online play needs the internet.

For online rooms and phone controllers, run the server (plain Python 3, no packages needed):

```bash
python server.py --port 8788
```

Then open `http://localhost:8788`. Phones on the same Wi-Fi open `http://<this-computer's-ip>:8788/pad`.

## Controls (keyboard)
- **Drive / steer:** `W A S D` or arrow keys
- **Hop / drift:** `Space` or `Shift`
- **Use item:** `E` or `Enter` (hold to trail it behind you; hold up/down while using to throw forward/back)
- **Signature Hype:** `Q` when the Hype meter is full
- **Look back:** `C` or `V`
- Game controllers work too (Xbox/PlayStation layout).

## Making changes
Edit the **source** files, then rebuild. Don't edit `index.html` or `wheelie-fun-standalone.html` by hand:
they are generated and will be overwritten.

| File | What's in it |
|---|---|
| `original_index.html` | The core game: physics, karts, items, the first 34 tracks, menus, HUD |
| `build_game.py` | Patches `original_index.html` into `index.html` (racer list with abilities, AI tweaks, extra CSS, etc.) |
| `new_tracks.js` | The 10 newest tracks |
| `upgrades_v2.js` | Speed classes, Kart Garage, Time Trials and ghosts, anti-gravity, replay camera |
| `online_client.js` | Online lobby and the serverless (multi-tab / peer-to-peer) host |
| `server.py` | Online relay server + phone controller page |
| `vendor/` | three.js r128, its post-processing add-ons, the QR-code library and the fonts (inlined into the standalone) |

Rebuild everything (needs Python 3):

```bash
python build_standalone.py
```

## Tests
Needs Python 3 and Node.js 20+; the runtime and play tests also need Google Chrome.

```bash
python tests/unit/run_unit_tests.py
```

Runs about 75 Python tests, the JavaScript unit tests, track geometry checks and the online server tests.
To race every track automatically (autopilot, fast-forwarded) and report finishes, falls, stuck karts and errors:

```bash
node tests/playtest/playtest.mjs wheelie-fun-standalone.html results.json
```

Add track ids to test only those, e.g. `... results.json cats tokyo`; add `--players=4` for split-screen.
`tests/run_all_tests.py` is an older all-in-one runner written for macOS.

## Notes
- `PLAYTEST.md` and `TEST_REPORT.md` describe recent fixes and why they were made.
- `docs/track_design_research.md` has the design notes behind the tracks.
- `PROMPT.md` is a ready-made briefing to paste into an AI coding assistant before asking it for changes.
