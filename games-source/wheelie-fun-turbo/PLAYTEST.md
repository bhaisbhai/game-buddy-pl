# Wheelie Fun Turbo — Play-test fixes (2026-11-11)

## Reported while playing
1. **Flickering on the kart (most visible on the wing).** On 1-player Ultra, shadows were only redrawn every
   other frame while the sun follows your kart every frame, so your kart's shadow on itself appeared and
   vanished each frame. Confirmed by capturing consecutive frames; shadows now update every frame
   (`original_index.html`, render loop). Costs about 2 fps on 1 player.
2. **Wheels folding outward did nothing.** That's the anti-gravity mode (it only added ~20% grip). Now, in an
   anti-gravity zone, **bumping another kart gives you both a Spin Boost** instead of slowing you down, at most
   once every 1.5 s per kart. The on-screen message says "ANTI-GRAVITY! BUMP KARTS TO BOOST".
3. **Specials stacking.** The Hype meter kept filling during a special, so you could fire another on top.
   Now the meter stays empty while your special runs, and a special can't start during another special or a
   Rainbow Rush (`build_game.py` fire check + `original_index.html` per-frame update).

## Found by automated play-testing
`tests/playtest/playtest.mjs` runs a full race on every track with your kart on autopilot (simulation
fast-forwarded, ~1 s per race) and records finishes, falls, stuck karts, errors, specials and bump boosts.

    node tests/playtest/playtest.mjs wheelie-fun-standalone.html results.json [trackIds...] [--players=4]

4. **Aztec Temple: karts stuck behind the fire jets on the final lap** (one stuck 56 s and never finished).
   The jets' next-burst timer counted down while they were firing, leaving only 0.8–2.3 s gaps on the
   final lap, and AI karts reversed away from active hazards so they could never get through. Gaps are now
   counted from when the jets stop, and AI karts stop for hazards instead of reversing. Max stuck: 20.5 s → 2 s.
5. **AI driving into the pits on split-lane sections** (Tokyo, Crystal Caverns, Rainbow Overdrive): boost
   pads push AI karts on the risky lane to ~85 speed and they slid into the pits. AI now eases off, brakes
   earlier and steers harder back to its line when pits are close. Falls roughly a third lower; the rest
   are the risky lane doing its job.

## Checked and fine
- All 44 tracks finish in 1- and 4-player races; no crashes, NaN positions or lap-count errors.
- No stacked specials in any race; specials fire again once the previous one ends.
- Only console output is two harmless three.js warnings (also present before).

## Worth knowing
- **Dogfight Canyon:** about two of every three glides end in the canyon (everyone, including you),
  because gliders get shot down by foam darts. That's the track's design but it may feel harsh.
- **Space Station** is almost all anti-gravity, so bump boosts are frequent there (~100 per race).

## Dogfight Canyon softened (later the same day)
- **Main cause wasn't the darts.** With darts switched off, about half of all glides still ended in the canyon.
  The glider only opened if your kart was touching the ground on the exact edge of the gap, and on the second
  glide the road drops ~4 units just before it, so fast karts were already airborne and simply fell.
  **Auto-glider:** any kart that reaches a glide gap in the air now gets its glider (all glide tracks).
- **Gentler darts:** a hit now drops you less (vy −3 instead of −6), slows you 7% instead of 14%, wobbles 0.7 s,
  gives 1.2 s protection from the next hit, and AI gliders fire half as often.
- Result: Dogfight falls per race 12–16 → 0 in every test run; darts still land ~100 hits per race.
- **Also fixed:** after the Aztec change, AI karts waited at hazards without reversing, but on Starship one
  hazard could make a kart wait forever (stalls of 43 s and 56 s). AI karts now go anyway after 2.5 s stopped.
  Worst stall over 10 runs: Starship 4.5 s, Aztec 4 s.

## Colours toned down on the 10 newer tracks (later the same day)
Measured on a race view: share of the screen that is both very saturated and very bright ("harsh").
Original tracks: 0.4–8%. New tracks were 4–32% (Pizza 32, Ramen 23, Crystal 17, Clockwork 16, Rainbow 15).
Each new track now gets a colour grade on the 3D view (`TRACK_TONE` in `original_index.html`: less saturation,
slightly softer highlights, strongest on Pizza/Ramen/Crystal/Rainbow). HUD, minimap and menus are untouched.
After: harsh 0–3.7% on every new track; frame rate unchanged. To adjust a track, edit its entry in `TRACK_TONE`.

## Specials follow Mario Kart rules (later the same day)
Five items also act as specials (Rainbow Rush ~ Star, Jumbo ~ Mega Mushroom, Ghost Sheet ~ Boo, Rocket ~ Bullet Bill,
Monster Truck). Now (`useItem`/`activeSpecial` in `original_index.html`):
- Rocket / Monster Truck (Bullet Bill-style): no items or Hype at all while active; you keep what you're holding.
- Rainbow Rush / Jumbo / Ghost Sheet / Signature Hype: ordinary items still work; the SAME special again refreshes
  its timer; a DIFFERENT special can't start on top — it's kept ("SPECIAL ACTIVE · SAVE IT!").
Verified with real key presses (10 scenarios).

## White glare toned down on pale new tracks
Measured "pale and bright" share of the race view (saturation < 25%, brightness > 82%):
Ramen 23% → 7.5%, Coaster 32% → 9%, Origami 30% → 21.5%, Mount Mayhem 39% → 20% (originals: Lava 16%, Beach 8%,
snowy Himalaya/Winter 37–48%). Changes in `new_tracks.js`: lighting on Ramen/Origami/Coaster/Mount Mayhem/Pizza brought
down to the original tracks' levels (sky light 0.74–0.76, sun 0.86–0.88); deeper road colour and speckles on Ramen and
Origami; darker Origami paper ground and Coaster boardwalk; plus a little more highlight dimming in `TRACK_TONE`.

## Kart Garage: controller support + unlock (later the same day)
- On the racer-select screen, ▲ from the top row of racers enters the garage row, ◀ ▶ picks a slot (frame, tires,
  glider, gold paint), Ⓐ/Enter changes it, ▼ or Ⓑ/Esc goes back to the racers. Works on keyboard too. A hint line shows
  the controls. (`garNav`/`markGarage` in `original_index.html`.)
- The garage unlocks after winning a trophy (top 3) in 4 different cups. Until then it shows
  "🔒 KART GARAGE · win a trophy in 4 cups to unlock … (n/4)" and karts use the default parts. First time unlocked,
  it shows "NEW! Garage unlocked". (`garageUnlocked` in `upgrades_v2.js`.)

## Final lap and on-screen messages
- All side toasts during races are off ("LAP 2", "SLIPSTREAM!", "SIGNATURE HYPE!", "SPECIAL ACTIVE", bump boosts, …).
  One switch brings them back: `const SHOW_TOASTS=false` in `build_game.py`. The 3-2-1-GO countdown, the wrong-way
  warning, the threat radar and Battle-mode banners are unchanged.
- Final lap: a dark glass ribbon with a chequered-flag edge slides in from the left reading just "FINAL LAP"
  (Mount Mayhem: "FINAL SECTION"), holds ~2 s, then zips up into the lap counter, which stays gold ("LAP · FINAL")
  with a chequered edge for the rest of the race. Works per player in split-screen. (`finalLapBanner` + `.finRib` CSS
  in `original_index.html`.)

## Camera zooming into the driver's head after the finish
After you finish, a TV-style camera cuts between three angles every 3.4 s (which one comes first depends on the
clock, so it didn't happen every race). The "nose-on" angle lerped toward a spot 8.5 units ahead of the kart, but the
kart keeps driving at ~60 after finishing and outran it, so the camera ended up 0.3 units from the driver — inside the
head. Both moving angles are now locked to the kart (only the turn is smoothed). Closest approach now 9.3 units.
(`updateTvReplayCam` in `upgrades_v2.js`.)

## Offline play, "pad" entry, Cat Town stalls
- **Works offline.** three.js r128 (plus its 4 post-processing add-ons) and the phone QR-code library used to load
  from CDNs each launch. They are now in `vendor/` and `build_standalone.py` inlines them, so the installed game needs
  no internet (checked with all network blocked: race starts, effects and QR code work). Only the web fonts and
  online play still use the internet; without them the menus fall back to a system font.
- **"pad" no longer listed in Retro Front.** The phone-controller page in `C:\Games\Wheelie Fun` was `pad.html`, so
  Retro Front showed it as a game. Renamed to `pad.page`; `wheelie_phones.py` serves either name (backup
  `wheelie_phones.py.bak`).
- **Cat Town stalls.** AI karts stopped dead for up to 2.5 s before the yarn balls, which only cost 45% speed
  if they hit, and sometimes got slammed by the paw while waiting (stalls 6–13 s). For "slow-only" crossers on every
  track (yarn, sheep, deer, trolleys, tractors…) the AI now just lifts off the gas instead of stopping, and doesn't
  coast to a halt for a lift-off warning. Spin-out crossers (e.g. the final-lap zoomies cats) still get a short stop.
  Cat Town worst AI stall over 12 races: 7.2 s → 4.5 s; all tracks: worst 5 s → 4 s, falls 92 → 85, no new errors.

## Garage gold, Track Atlas on TV, pit falls, fonts
- **Gold paint is earned, not free.** The garage's "🔓 Unlock Gold" button used to unlock everything and set the vault to
  200 coins. It now reads "🔒 Gold at 50 coins · n/50" and does nothing until you have 50 vault coins (as the title screen
  says). The garage bar is also redrawn each time you open racer select, so winning your 4th cup unlocks the garage
  without restarting the game.
- **Track & Cup Atlas readable on the TV.** On screens 1280 px and wider the atlas uses ~92% of the width and text is
  about 35% bigger (descriptions 11.5 → 15.6 px, tags 10 → 13 px, chips 12 → 15.6 px at 1080p). `build_game.py` extra CSS.
- **Fewer AI pit falls.** Nearly all AI falls on Tokyo / Crystal Caverns / Rainbow were on the risky lane beside the pits.
  On split lanes with pits the AI now takes the risky lane half as often (15–45% by skill, was 30–75%) and hugs the
  wall (12 instead of 11.5). AI falls per race over 4 races: Tokyo 7.3 → 4, Crystal 14.3 → 7.3, Rainbow 4 → 3.3; AI race
  times unchanged. All 44 tracks: falls 85 → 64.
- **Fonts offline.** Bungee and Fredoka (latin, SIL OFL) are embedded from `vendor/fonts-offline.css` (+60 KB), so the
  installed game makes no network requests outside online play.
