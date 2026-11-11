# Wheelie Fun Turbo — Unit Test Report (2026-11-11)

Run everything with:

```
python tests/unit/run_unit_tests.py
```

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| Python unit tests (`tests/unit/test_*.py`) | 75 | 75 | 0 |
| JavaScript unit tests (`tests/unit/js/*.test.mjs`) | 77 | 77 | 0 |
| Track geometry (existing) | 10 tracks | all | 0 |
| Online server integration (existing) | 6 checks | all | 0 |

The first run found 17 failures, all real bugs. All ten bugs below are now **fixed** (same day) in
`server.py`, `online_client.js` and `upgrades_v2.js`, and `wheelie-fun-standalone.html` was rebuilt.

## What is covered

- **Online server (`server.py`)**: data tables, player/room model, room codes, AI grid filling,
  points and standings, WebSocket framing (short/long/fragmented frames, ping, close, oversize),
  lobby rules, host-only actions, host migration, relays, full 4-race Cup, single race, DNF/grace.
- **Serverless online host (`online_client.js` `VirtualRoomHost`)**: the same scenarios as the server.
- **Online client helpers**: time formatting, speed-class names, room codes, angles, HTML escaping
  of player names, cup→track mapping, remote-kart smoothing.
- **Upgrades (`upgrades_v2.js`)**: speed classes, garage parts and physics for all 64 combinations,
  saved loadouts, coin vault unlocks, time-trial PBs (incl. mirror), ghost recording, share codes,
  staff ghost, rival ghost import, anti-gravity zones, spin boosts, frontrunning music.
- **Build & data**: `index.html` rebuilds identically from `original_index.html`; the standalone file
  is exactly `index.html` + the three scripts; all JavaScript parses; server and client tables agree.
- **Live game in headless Chrome**: boots with no errors; its track order, cups and characters match
  the server (needs internet for three.js; skips itself offline).

## Bugs found (all fixed)

How they were fixed:
- Server and serverless host now parse every client number safely (`to_int` / `to_time` / `to_float`
  in `server.py`, `toIdx` / `toTime` in `online_client.js`). Bad input is ignored or falls back.
- A missing, zero, negative or non-numeric finish time counts as finished-but-DNF.
- AI times that are not positive finite numbers are ignored (an estimate is used instead).
- When a player leaves the results screen and everyone left is ready, the next race starts.
- Saved garage choices are validated on load; bad values fall back to the first part.
- Imported ghost codes are validated frame by frame; importing switches to the ghost's mode
  (mirror/normal), and a rival ghost is only shown in the matching mode.
- PB ghosts longer than 1800 frames are thinned evenly across the whole run instead of cut off.
- `fmtTime` rounds to milliseconds before splitting minutes and seconds.
- Also fixed while there: phone controller input (`b`, `x`) and a bad `progress` value in kart
  state could crash the server the same way.


### Worth fixing
1. **Bad input kicks a player offline** (server). A non-numeric `cupIdx`, `ch` or `finishTime`
   raises an exception and drops the connection instead of replying with an error.
   Tests: `test_non_numeric_*`.
2. **A missing or negative finish time wins the race** (server and P2P/multi-tab host). A
   `race_finish` with no time counts as 0.0 s; `-50` beats everyone.
   Tests: `missing or negative finish time cannot win` (both).
3. **Results screen can get stuck** (server and P2P/multi-tab host). If everyone else has pressed
   Ready and the last player quits, nothing advances until someone presses Ready again.
   Tests: `results advance when last unready player leaves` (both).
4. **A corrupt saved garage choice crashes the game on startup, every time** — e.g. a saved frame of
   `abc` makes the garage bar read `undefined.name`. Unlikely, but it can only be fixed by clearing
   browser storage. Test: `corrupt saved loadout does not break the game`.

### Minor
5. A **mirror-mode rival ghost** imported from a code is raced on the normal track (drives a flipped line).
6. **PB ghosts are cut off at 180 s** (1800 frames at 10 Hz); slower runs replay a ghost that freezes.
7. **Ghost codes with nonsense frames are accepted** and produce NaN positions.
8. A **NaN AI time** from the host leaves `NaN` in the results table and scrambles the order (server).
9. P2P/multi-tab host: a non-numeric or fractional cup/character index stores `NaN`/`2.5` in room state.
10. `fmtTime(59.9996)` shows **`0:60.000`** instead of `1:00.000`.

### Not bugs, but worth knowing
- The game exposes `window.__tiki.ev`, which runs any code inside the game. Handy for testing, but it
  is a debug back door in the shipped build.
- Clicking **🔓 Unlock Gold** in the garage without enough coins calls `VAULT.unlockAll()`: it unlocks
  every reward and sets coins to 200 for free. Fine if intentional.
- The serverless host is described as mirroring `server.py` "1:1", but differs in small ways: AI
  finish-time estimates, tie-breaking in standings, and the default character for new joiners.
- The game needs internet: three.js is loaded from a CDN even in the "standalone" file.
- `tests/run_all_tests.py` and `build_game.py` hard-code macOS paths (`/Users/...`, Apple `jsc`,
  Mac Chrome) and do not run on Windows. `tests/test_online_server.py` was changed to use the
  current Python instead of `/usr/bin/python3`; no game code was changed.
