# Briefing for an AI coding assistant

Paste everything below the line into your AI assistant (Claude Code, Codex, Cursor, ChatGPT…) together with this
folder, then add what you want changed at the end.

---

You are working on **Wheelie Fun Turbo**, a single-page Three.js (r128) kart racer for desktop browsers, with
optional Python server for online play and phone controllers. Read `README.md` first.

## How the project is built
- The game ships as one file, `wheelie-fun-standalone.html`. It is **generated** — never edit it, or `index.html`,
  by hand.
- `python build_standalone.py` does the whole build:
  1. `build_game.py` reads `original_index.html` and applies a list of exact text replacements
     (`must_replace(html, old, new, name)`) to produce `index.html`. Each replacement must match exactly once or
     the build stops with an error naming it.
  2. It then inlines `new_tracks.js`, `upgrades_v2.js`, `online_client.js` and everything in `vendor/`
     (three.js, add-ons, QR library, fonts) to make the standalone file, so the game runs offline.
- Some game code exists **only inside `build_game.py` replacement strings** (for example the full racer list with
  Signature Hype abilities, `say()` toasts, the rigged kart model, parts of the AI driving). Search both
  `original_index.html` and `build_game.py` before changing anything. If you edit text in `original_index.html` that
  a `must_replace` anchor depends on, update the anchor too.

## Where things are
- Racers: `CHARS` in `build_game.py` (name, id, stats `st:[speed, accel, handling, weight]`, colours, `sig` ability).
  Ability effects: `fireSignatureHype` in `build_game.py`, keyed by racer `id`. The online lobby has a short copy of
  the list in `online_client.js` and `server.py` — keep all three in sync.
- Tracks: `LEVELS` in `original_index.html` (first 34) and `new_tracks.js` (newest 10). Each track has a `RAW`
  centre-line, `build` function for scenery and hazards, `atmo` lighting and a `theme`. Cups are in `CUPS`.
- Hazards use shared helpers in `original_index.html`: `crossers` (things that cross the road on a timer),
  `thrower`/`strikeAt` (things that land where a kart is heading), `roadBumps`, `mergeLR`. AI reaction to hazards goes
  through `LR.aiBrake(k)` (0 = ignore, 1 = lift off, 2 = stop) and `LR.aiAvoid`.
- Items and specials: `useItem`, `useNewItem`, `activeSpecial` in `original_index.html` (Mario Kart-style rules:
  one special at a time).
- Garage, speed classes, ghosts, anti-gravity, replay camera: `upgrades_v2.js` (exposed as `window.WFV2`).
- Per-track colour grading for TVs: `TRACK_TONE` in `original_index.html`.
- Toast messages are switched off with `const SHOW_TOASTS=false` in `build_game.py`.

## Rules for making changes
1. Make the change in the source files, then run `python build_standalone.py`.
2. Run `python tests/unit/run_unit_tests.py` — all four suites must say PASS. If you change behaviour on purpose,
   update or add a test in `tests/unit/` (Python) or `tests/unit/js/` (Node `node:test`).
3. For gameplay changes, run `node tests/playtest/playtest.mjs wheelie-fun-standalone.html out.json <trackIds>` and
   compare finishes, falls and `maxStuck` before and after. Watch for new errors.
4. Keep the game working offline: don't add new CDN `<script>` or `<link>` tags; put libraries in `vendor/` and add
   them to `build_standalone.py`.
5. The game runs on a TV at 1080p with a controller as well as on a laptop with a keyboard: new menus must be
   reachable with a gamepad (see `moveFocus`/`activate` in `original_index.html`) and text must be readable from a
   sofa.
6. Write a short note of what you changed and why in `PLAYTEST.md`.

## What I want changed
(Describe your change here.)
