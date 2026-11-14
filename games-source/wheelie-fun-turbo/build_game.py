#!/usr/bin/env python3
"""
Upgrades Wheelie Fun (original_index.html -> index.html) with:
1. Mario Kart Drift Counter-Steering + Real AI Hop-Drifting + Road Banking (BANK[N])
2. 1D Spring-Damper Suspension, Hop/Landing Squash & Stretch, Boost Wheelies
3. Articulated Driver Rigging (leaning torso, steering arms, cheering fist-pump, wishbone struts)
4. Persistent Tire Skidmarks & Rainbow Drift Ribbons (SkidSystem)
5. Expanded 10-Character Roster + 8-Racer Pack + Character Signature Hype Abilities
6. Item Trailing Shields, Forward Trap Lobbing, Backward Projectile Aiming, Orbiting 3D Triples,
   Distance-Based Item Balancing, and Classic (17) vs Chaos (37) Item Pool Toggle
7. Incoming Threat Warning Radar + Look-Back Rear-View Mirror + Un-silenced Arcade Toast Pill Feed
8. Unfenced Drop-Off Sections (UNFENCED[N]), Animated Neon Corner Chevrons, Wrong-Way Detection,
   and Visible Tiki Rescue Drone with Timed Drop-Boost
9. 5-Gear Simulated Engine Audio + Exhaust Crackle + Stereo Reverb/Compressor + Final-Lap +2 Semitone Key Shift
10. Track & Cup Atlas Organization UI (Tabs, Category Filters, Difficulty Stars, Feature Tags, Search, Random)
11. Modular hooks for 10 New Tracks (new_tracks.js) and Online Cup Tournament Mode (online_client.js)
"""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))  # was a hard-coded macOS path
SRC = os.path.join(ROOT, "original_index.html")
OUT = os.path.join(ROOT, "index.html")


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Anchor missing for [{label}]:\n{old[:200]}")
    return text.replace(old, new, 1)


def build():
    with open(SRC, "r", encoding="utf-8") as f:
        html = f.read()

    if not html.lstrip().lower().startswith("<!doctype"):
        html = (
            "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
            "<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover\">\n"
            + html
            + "\n</body>\n</html>\n"
        )

    extra_css = """
/* ===== Mario Kart Upgrade Styles: Toast Ticker, Wrong-Way, Track Atlas & Online Button ===== */
.btn.online{background:linear-gradient(180deg,#26d3d0,#2a6fdb);color:#fff;box-shadow:0 6px 0 #143a78,0 10px 18px rgba(0,0,0,.35)}
.toastFeed{position:absolute;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(118px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none;z-index:4}
.view.small .toastFeed{bottom:calc(82px + env(safe-area-inset-bottom,0px));transform:scale(.82);transform-origin:bottom right}
.view.small:first-child .toastFeed{bottom:auto;top:calc(96px + env(safe-area-inset-top,0px));transform-origin:top right}
.toastPill{font-family:var(--display);font-size:clamp(11px,1.25vw,15px);letter-spacing:.05em;color:var(--cream);background:rgba(26,15,43,.88);border:2px solid var(--ember);border-radius:999px;padding:5px 14px 4px;box-shadow:0 4px 0 rgba(0,0,0,.4),0 0 14px rgba(255,178,46,.35);animation:pillIn .18s cubic-bezier(.2,1.5,.5,1) both;white-space:nowrap}
.toastPill.good{border-color:var(--lagoon);color:#b8fffc;box-shadow:0 4px 0 rgba(0,0,0,.4),0 0 14px rgba(38,211,208,.4)}
.toastPill.warn{border-color:#ff4f6a;color:#ffd2da;box-shadow:0 4px 0 rgba(0,0,0,.4),0 0 16px rgba(255,79,106,.5)}
@keyframes pillIn{from{opacity:0;transform:translateX(18px) scale(.82)}to{opacity:1;transform:translateX(0) scale(1)}}
.wrongWay{position:absolute;top:calc(104px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);font-family:var(--display);font-size:clamp(18px,2.8vw,34px);color:#ffe14a;background:rgba(180,20,30,.9);border:3px solid #ffe14a;border-radius:14px;padding:6px 18px 4px;box-shadow:0 5px 0 var(--night),0 0 26px rgba(255,59,31,.8);letter-spacing:.08em;animation:wwPulse .38s infinite alternate;z-index:5}
.wrongWay[hidden]{display:none!important}
@keyframes wwPulse{to{transform:translateX(-50%) scale(1.08);background:rgba(230,40,30,.96)}}
.trailBadge{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));left:calc(50% - clamp(46px,5.2vw,66px));transform:translateX(-100%);font-family:var(--display);font-size:11px;color:var(--lagoon);background:var(--panel);border:2px solid var(--lagoon);border-radius:10px;padding:4px 8px;letter-spacing:.06em;box-shadow:0 3px 0 rgba(0,0,0,.35)}
.trailBadge[hidden]{display:none!important}
.grid{grid-template-columns:repeat(5,minmax(0,1fr))}
@media (max-width:720px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.who .sig{font-size:12px;color:var(--ember);font-weight:700;margin:0 0 6px;letter-spacing:.02em}
/* Track & Cup Atlas */
.atlasBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;width:100%;background:var(--panel);border:2px solid rgba(255,255,255,.14);border-radius:16px;padding:10px 14px;box-sizing:border-box}
.atlasTabs,.atlasCats{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.chipBtn{font-family:var(--display);font-size:12px;letter-spacing:.04em;color:var(--cream);background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.16);border-radius:999px;padding:6px 13px 5px;cursor:pointer;transition:transform .1s,background .12s,border-color .12s}
.chipBtn:hover,.chipBtn.on{background:var(--ember);color:var(--night);border-color:var(--cream);transform:translateY(-1px)}
.chipBtn.alt.on{background:var(--lagoon);color:var(--night)}
.atlasSearch{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.atlasSearch input,.atlasSearch select{font-family:var(--body);font-weight:600;font-size:13px;color:var(--cream);background:rgba(15,8,28,.85);border:2px solid rgba(255,255,255,.2);border-radius:10px;padding:6px 10px;outline:none}
.atlasSearch input:focus,.atlasSearch select:focus{border-color:var(--lagoon)}
#tracks .trkGrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;padding-bottom:24px}
#tracks .trkGrid.cupsView{grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}
@media (max-width:980px){#tracks .trkGrid,#tracks .trkGrid.cupsView{grid-template-columns:repeat(2,minmax(0,1fr))}}
#tracks .trk{padding:9px 10px 10px;gap:5px;position:relative}
#tracks .trk span.desc{display:block;font-size:11.5px;color:var(--muted);line-height:1.28;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.trkMeta{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:2px}
.tTag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.1);color:var(--cream);letter-spacing:.03em}
.tTag.new{background:var(--lava);color:#fff;font-family:var(--display)}
.tTag.stars{background:rgba(255,178,46,.18);color:var(--ember);margin-left:auto}
/* Track & Cup Atlas: readable from the sofa on big screens (TV mirrored at 1080p) */
@media (min-width:1280px){
#tracks .trkWrap{max-width:min(1640px,92vw)}
#tracks .trkHead small{font-size:clamp(15px,1vw,20px)}
#tracks .chipBtn{font-size:clamp(12px,.82vw,16px);padding:7px 15px 6px}
#tracks .atlasSearch input,#tracks .atlasSearch select{font-size:clamp(13px,.85vw,17px)}
#tracks .trk b{font-size:clamp(15px,1.1vw,22px)}
#tracks .trk span.desc,#tracks .trk.cup span{font-size:clamp(12px,.82vw,16px);line-height:1.3}
#tracks .trk em{font-size:clamp(12px,.78vw,15px)}
#tracks .tTag{font-size:clamp(10px,.68vw,13px);padding:2px 7px}
}
/* Title screen redesign: one clear primary action; every other mode shares one calm outline
   style instead of a different bright color each; utility actions move to a de-emphasized,
   labeled icon row in the corner instead of competing as full-size buttons. */
.btn.primary{width:100%;max-width:420px;font-size:clamp(22px,2.6vw,32px);padding:20px 0 18px;background:linear-gradient(180deg,#ffd166,var(--ember));box-shadow:0 8px 0 #a3420c,0 18px 30px rgba(255,120,40,.45)}
.btn.chip{background:var(--panel);color:var(--cream);border:2px solid rgba(255,244,223,.55);box-shadow:0 5px 0 rgba(0,0,0,.45),0 8px 16px rgba(0,0,0,.3);font-size:clamp(13px,1.3vw,16px);font-weight:700;padding:12px 22px 10px}
.btn.chip:hover,.btn.chip.focus{background:rgba(58,33,86,.95);border-color:var(--ember)}
.utilityIcons{position:absolute;left:calc(24px + env(safe-area-inset-left,0px));top:calc(24px + env(safe-area-inset-top,0px));display:flex;gap:14px;z-index:2}
.iconBtn{display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:0;box-shadow:none;color:var(--cream);cursor:pointer;padding:0;font-family:var(--body)}
.iconCircle{width:42px;height:42px;border-radius:50%;background:rgba(26,15,43,.55);border:1.5px solid rgba(255,244,223,.22);display:flex;align-items:center;justify-content:center;transition:border-color .12s}
.iconBtn:hover .iconCircle,.iconBtn.focus .iconCircle{border-color:var(--ember)}
.iconLabel{font-size:11px;font-weight:600;letter-spacing:.02em;color:rgba(255,244,223,.78);white-space:nowrap}
#loading[hidden]{display:none}
"""
    html = must_replace(html, "#loading[hidden]{display:none}\n</style>", extra_css + "</style>", "extra_css")

    old_title_btns = """    <div class="btns">
      <button class="btn" data-act="p1">1 Player</button>
      <button class="btn alt" data-act="party">Multiplayer (2–4)</button>
      <button class="btn battle" data-act="battle">Battle</button>
      <button class="btn battle" data-act="death">Death Race</button>
      <button class="btn ghost" data-act="diff" id="diffBtn">Difficulty: Normal</button>
      <button class="btn ghost" data-act="how">How to Play</button>
      <button class="btn ghost" data-act="gfx" id="gfxBtn">Graphics: Ultra</button>
    </div>"""
    new_title_btns = """    <div class="btns primaryRow">
      <button class="btn primary" data-act="p1">1 Player</button>
    </div>
    <div class="btns">
      <button class="btn chip online" data-act="online" id="onlineBtn">Online Cup</button>
      <button class="btn chip alt" data-act="party">Multiplayer</button>
      <button class="btn chip battle" data-act="battle">Battle</button>
      <button class="btn chip battle" data-act="death">Death Race</button>
    </div>
    <div class="utilityIcons" id="utilityIcons">
      <button class="btn iconBtn" data-act="how">
        <span class="iconCircle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c2-1 5-1 8 0v14c-3-1-6-1-8 0V5z"/><path d="M20 5c-2-1-5-1-8 0v14c3-1 6-1 8 0V5z"/></svg></span>
        <span class="iconLabel">How to Play</span>
      </button>
      <button class="btn iconBtn" data-act="settings" id="settingsBtn">
        <span class="iconCircle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1.5 12h3M19.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg></span>
        <span class="iconLabel">Settings</span>
      </button>
      <button class="btn iconBtn" data-act="lb" id="lbBtn">
        <span class="iconCircle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M8 5H5a2 2 0 0 0 2 4M16 5h3a2 2 0 0 1-2 4"/><path d="M12 12v4M9 20h6M10 16h4l1 4H9l1-4z"/></svg></span>
        <span class="iconLabel">Leaderboards</span>
      </button>
    </div>"""
    html = must_replace(html, old_title_btns, new_title_btns, "title_btns")

    old_settings_btns = """      <button class="btn ghost" data-act="diff" id="diffBtn">Difficulty: Normal</button>
      <button class="btn ghost" data-act="gfx" id="gfxBtn">Graphics: Ultra</button>"""
    new_settings_btns = """      <button class="btn ghost" data-act="diff" id="diffBtn">Difficulty: Normal</button>
      <button class="btn ghost" data-act="items" id="itemsBtn">Items: All (37)</button>
      <button class="btn ghost" data-act="gfx" id="gfxBtn">Graphics: Ultra</button>"""
    html = must_replace(html, old_settings_btns, new_settings_btns, "settings_btns")

    old_how_controls_p1 = """<dt>W A S D</dt><dd>Drive and steer</dd><dt>Space</dt><dd>Hop &amp; drift</dd>
        <dt>E</dt><dd>Use item</dd><dt>R</dt><dd>Swap items</dd><dt>Q</dt><dd>Hyper mode</dd><dt>Esc</dt><dd>Pause</dd>"""
    new_how_controls_p1 = """<dt>WASD or Arrows</dt><dd>Drive, steer &amp; accelerate</dd><dt>V</dt><dd>Hop &amp; drift</dd>
        <dt>B or S</dt><dd>Brake / reverse</dd><dt>Space or E</dt><dd>Hold: trail shield &middot; release: fire item</dd>
        <dt>Shift+F / X</dt><dd>Lob ahead / shoot back</dd><dt>N or Q</dt><dd>Hyper mode</dd>
        <dt>Z</dt><dd>Look back</dd><dt>R</dt><dd>Swap items</dd><dt>Esc</dt><dd>Pause</dd>"""
    html = must_replace(html, old_how_controls_p1, new_how_controls_p1, "how_controls")

    old_tracks_div = """<div class="screen shade" id="tracks" hidden>
  <div class="trkWrap">
    <h2 class="trkHead">Where to?<small>Five cups of four races, points for every finish. Or pick a single track.</small></h2>
    <div class="trkGrid" id="trkGrid"></div>
  </div>
</div>"""
    new_tracks_div = """<div class="screen shade" id="tracks" hidden>
  <div class="trkWrap">
    <div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:12px;flex-wrap:wrap">
      <h2 class="trkHead" style="text-align:left">Track &amp; Cup Atlas<small id="atlasSub">11 Grand Prix Cups · 43 Tracks · Filter by world, style or difficulty</small></h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn alt" style="padding:10px 18px;font-size:14px" data-act="randTrk">🎲 Surprise Track</button>
        <button class="btn ghost" style="padding:10px 18px;font-size:14px" data-act="trkBack">Back</button>
      </div>
    </div>
    <div class="atlasBar" id="atlasBar">
      <div class="atlasTabs" id="atlasTabs">
        <button class="chipBtn on" data-av="all">🏆 Cups + Tracks</button>
        <button class="chipBtn" data-av="cups">🏆 Cups Only</button>
        <button class="chipBtn" data-av="tracks">🏁 Tracks Only</button>
      </div>
      <div class="atlasCats" id="atlasCats"></div>
      <div class="atlasSearch">
        <select id="atlasDiff" aria-label="Difficulty filter">
          <option value="0">All Difficulties</option>
          <option value="1">★☆☆ Casual</option>
          <option value="2">★★☆ Technical</option>
          <option value="3">★★★ Extreme</option>
        </select>
        <input id="atlasQ" type="search" placeholder="Search tracks or mechanics…" autocomplete="off">
      </div>
    </div>
    <div class="trkGrid" id="trkGrid"></div>
  </div>
</div>"""
    html = must_replace(html, old_tracks_div, new_tracks_div, "tracks_div")

    html = must_replace(
        html,
        '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js"></script>\n<script>',
        '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js"></script>\n<script src="new_tracks.js"></script>\n<script src="upgrades_v2.js"></script>\n<script src="online_client.js"></script>\n<script>',
        "module_scripts",
    )

    old_chars_kart = """const CHARS=[
  {name:'Blaze',baby:false,blurb:'All-rounder',kart:0xff8a1f,accent:0xffd23f,suit:0x2a6fdb,helmet:0x2a6fdb,skin:0xb5774f,st:[3,3,3,3]},
  {name:'Jet',baby:false,blurb:'Top-speed specialist',kart:0x2a7bff,accent:0xffffff,suit:0x1c1f2b,helmet:0xffffff,skin:0x9a6142,st:[5,2,2,4]},
  {name:'Spark',baby:false,blurb:'Drift specialist',kart:0xff5fa2,accent:0x26d3d0,suit:0xffffff,helmet:0x26d3d0,skin:0xc48a63,st:[3,4,4,2]},
  {name:'Rumble',baby:false,blurb:'Heavy hitter',kart:0xe8443a,accent:0x2c2c34,suit:0x2c2c34,helmet:0xffb22e,skin:0xa66b47,st:[4,3,2,4]},
  {name:'Goldie',baby:true,blurb:'Baby driver · rocket off the line',kart:0x3ccf4e,accent:0xffe14a,suit:0xffe14a,helmet:0xff8fb8,skin:0xc28860,st:[2,5,5,1]},
  {name:'Buzzy',baby:true,blurb:'Baby driver · tiny but fearless',kart:0xb98bff,accent:0x8fe9ff,suit:0x8fe9ff,helmet:0xffffff,skin:0xb07a55,st:[3,5,4,1]},
  {name:'Zephyr',fly:true,baby:false,blurb:'Flying ace · best at everything, but one hit knocks it out of the sky',kart:0xf4f1ea,accent:0x3ec6ff,suit:0xffc83d,helmet:0x3ec6ff,skin:0xb5774f,st:[6,6,6,1]},
];"""
    new_chars_kart = """const CHARS=[
  {name:'Blaze',id:'blaze',baby:false,blurb:'All-rounder',sig:'Twin Blaze · 3 spread fireballs',kart:0xff8a1f,accent:0xffd23f,suit:0x2a6fdb,helmet:0x2a6fdb,skin:0xb5774f,st:[3,3,3,3]},
  {name:'Jet',id:'jet',baby:false,blurb:'Top-speed specialist',sig:'Mach Overdrive · extended jet boost',kart:0x2a7bff,accent:0xffffff,suit:0x1c1f2b,helmet:0xffffff,skin:0x9a6142,st:[5,2,2,4]},
  {name:'Spark',id:'spark',baby:false,blurb:'Drift specialist',sig:'Ultra Spark · instant purple turbo',kart:0xff5fa2,accent:0x26d3d0,suit:0xffffff,helmet:0x26d3d0,skin:0xc48a63,st:[3,4,4,2]},
  {name:'Rumble',id:'rumble',baby:false,blurb:'Heavy hitter',sig:'Quake Slam · shockwave blasts nearby karts',kart:0xe8443a,accent:0x2c2c34,suit:0x2c2c34,helmet:0xffb22e,skin:0xa66b47,st:[4,3,2,4]},
  {name:'Goldie',id:'goldie',baby:true,blurb:'Baby driver · rocket off the line',sig:'Gold Rush · +5 coins & shield bubble',kart:0x3ccf4e,accent:0xffe14a,suit:0xffe14a,helmet:0xff8fb8,skin:0xc28860,st:[2,5,5,1]},
  {name:'Buzzy',id:'buzzy',baby:true,blurb:'Baby driver · tiny but fearless',sig:'Bee Escort · launches 2 homing bees',kart:0xb98bff,accent:0x8fe9ff,suit:0x8fe9ff,helmet:0xffffff,skin:0xb07a55,st:[3,5,4,1]},
  {name:'Volt',id:'volt',baby:false,blurb:'Cyber-drift technician',sig:'EMP Pulse · zaps rivals & spare tyres',kart:0x00d2d3,accent:0x9f3dff,suit:0x182238,helmet:0x00d2d3,skin:0xa86e4c,st:[4,4,4,2]},
  {name:'Brick',id:'brick',baby:false,blurb:'Turbo heavyweight brawler',sig:'Mini-Jumbo · brief giant crush surge',kart:0xd4a017,accent:0xb81d24,suit:0x5a1218,helmet:0xffd23f,skin:0x8d5534,st:[5,2,3,5]},
  {name:'Pixie',id:'pixie',baby:true,blurb:'Featherweight trickster',sig:'Mirage Dash · ghost phase + prank box',kart:0xff6b81,accent:0x7bed9f,suit:0x7bed9f,helmet:0xff6b81,skin:0xc88e68,st:[3,5,5,1]},
  {name:'Zephyr',id:'zephyr',fly:true,baby:false,blurb:'Flying ace · glass cannon speedster',sig:'Tailwind Ace · sky ring boost + shield',kart:0xf4f1ea,accent:0x3ec6ff,suit:0xffc83d,helmet:0x3ec6ff,skin:0xb5774f,st:[6,6,6,1]},
];"""
    html = must_replace(html, old_chars_kart, new_chars_kart, "chars_list")

    old_make_kart = """  const bs=ch.baby?.8:1;
  const driver=[[SPH(.62,22,16),ch.suit,M(0,1.85-(1-bs)*.4,-.4,0,0,0,bs,1.15*bs,.9*bs)],[new THREE.CylinderGeometry(.14,.14,.9*bs,12),ch.suit,M(-.45*bs,1.9-(1-bs)*.3,.1,.5)],[new THREE.CylinderGeometry(.14,.14,.9*bs,12),ch.suit,M(.45*bs,1.9-(1-bs)*.3,.1,.5)],
    [SPH(.17,14,10),0xffffff,M(-.36,1.78,.5)],[SPH(.17,14,10),0xffffff,M(.36,1.78,.5)]];
  if(ch.baby)driver.push([rbox(.62,.5,.08,.06),0xffffff,M(0,1.72,.08)],[SPH(.3,16,12),0xffe14a,M(0,2.62,-2.12)],[new THREE.CylinderGeometry(.06,.06,.5,8),0xff8fb8,M(0,2.62,-1.82,Math.PI/2)]);
  const drv=new THREE.Mesh(build(driver,0,true),skinMat);drv.castShadow=true;body.add(drv);
  const hp=headParts(ch);const head=new THREE.Group();const hs=new THREE.Mesh(build(hp.sk,0,true),skinMat),hh=new THREE.Mesh(build(hp.hm,0,true),paintMat);hs.castShadow=hh.castShadow=true;head.add(hs,hh);
  head.position.set(0,ch.baby?2.85:2.98,-.32);body.add(head);
  for(const x of[-.75,.75]){const l=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.08),lightMatR);l.position.set(x,.95,-2.66);body.add(l);const h=new THREE.Mesh(SPH(.13,12,8),lightMatW);h.position.set(x*.75,.86,3.05);body.add(h);}
  const wheels=[];for(const[x,z,f,s]of[[-1.55,1.45,1,1],[1.55,1.45,1,1],[-1.62,-1.5,0,1.12],[1.62,-1.5,0,1.12]]){const piv=new THREE.Group();piv.position.set(x,.74*s,z);const w=new THREE.Mesh(tyreGeo,tyreMat);w.scale.setScalar(s);w.castShadow=true;piv.add(w);body.add(piv);wheels.push({piv,w,f});}
  const shield=new THREE.Mesh(new THREE.IcosahedronGeometry(3.3,3),new THREE.MeshPhongMaterial({color:0x8fe9ff,transparent:true,opacity:.28,shininess:120,emissive:0x2a8fb0,depthWrite:false}));shield.position.y=1.7;shield.visible=false;body.add(shield);
  const glider=new THREE.Group();{const parts=[[WING,a,M(0,0,0)],[WING2,c,M(0,.07,-.1,0,0,0,.62,1,.62)],[new THREE.CylinderGeometry(.07,.07,2.6,8),dk,M(-1.15,-1.15,-.2,0,0,.42)],[new THREE.CylinderGeometry(.07,.07,2.6,8),dk,M(1.15,-1.15,-.2,0,0,-.42)],[new THREE.CylinderGeometry(.06,.06,2.4,8),dk,M(0,-1.05,.6,.35)]];
    const gm=new THREE.Mesh(build(parts,0,true),paintMat);gm.castShadow=true;glider.add(gm);glider.position.set(0,4.5,-.2);glider.visible=false;body.add(glider);}
  let rotor=null;if(ch.fly){const wp=[[rbox(3.4,.14,1.3,.07),a,M(-2.9,.95,.1,0,.12,.1)],[rbox(3.4,.14,1.3,.07),a,M(2.9,.95,.1,0,-.12,-.1)],[rbox(.5,.16,.9,.07),c,M(-4.5,1.12,.2)],[rbox(.5,.16,.9,.07),c,M(4.5,1.12,.2)],[rbox(.14,1.1,.9,.06),a,M(0,1.9,-2.6,-.2)],[new THREE.CylinderGeometry(.09,.09,1.3,8),dk,M(0,3.55,-1.1)]];
    const wm=new THREE.Mesh(build(wp,0,true),paintMat);wm.castShadow=true;body.add(wm);
    rotor=new THREE.Mesh(build([[rbox(5.4,.08,.38,.04),dk],[rbox(.38,.08,5.4,.04),dk],[SPH(.3,12,8),a]],0,true),paintMat);rotor.position.set(0,4.25,-1.1);body.add(rotor);}
  const blob=new THREE.Mesh(blobGeo,blobMat);blob.position.y=.06;root.add(blob);
  return{root,body,wheels,head,shield,blob,glider,rotor};"""

    new_make_kart = """  const bs=ch.baby?.8:1;
  const drvGroup=new THREE.Group();drvGroup.position.set(0,1.25,-.38);body.add(drvGroup);
  const torsoParts=[[SPH(.62,22,16),ch.suit,M(0,.6-(1-bs)*.35,0,0,0,0,bs,1.15*bs,.9*bs)]];
  if(ch.baby){torsoParts.push([rbox(.62,.5,.08,.06),0xffffff,M(0,.47,.46)]);
    const keyM=new THREE.Mesh(build([[SPH(.3,16,12),0xffe14a,M(0,2.62,-2.12)],[new THREE.CylinderGeometry(.06,.06,.5,8),0xff8fb8,M(0,2.62,-1.82,Math.PI/2)]],0,true),paintMat);body.add(keyM);}
  const drv=new THREE.Mesh(build(torsoParts,0,true),skinMat);drv.castShadow=true;drvGroup.add(drv);
  const mkArm=side=>{const ag=new THREE.Group();ag.position.set(side*.46*bs,.78*bs,.06);
    const am=new THREE.Mesh(build([[new THREE.CylinderGeometry(.13,.13,.88*bs,12),ch.suit,M(0,-.1,.38,1.12,0,side*-.14)],[SPH(.17,14,10),0xffffff,M(-side*.08,-.22,.82)]],0,true),skinMat);
    am.castShadow=true;ag.add(am);drvGroup.add(ag);return ag;};
  const armL=mkArm(-1),armR=mkArm(1);
  const steerWheel=new THREE.Mesh(build([[new THREE.TorusGeometry(.37,.075,10,28),a,M(0,0,0)],[new THREE.BoxGeometry(.66,.07,.07),dk,M(0,0,0)]],0,true),paintMat);
  steerWheel.position.set(0,1.79,.53);steerWheel.rotation.x=-.7;body.add(steerWheel);
  // Small parts skipped for distant karts by kartLOD() (see render loop).
  const detail=[pipes,steerWheel,armL,armR];
  const hp=headParts(ch);const head=new THREE.Group();const hs=new THREE.Mesh(build(hp.sk,0,true),skinMat),hh=new THREE.Mesh(build(hp.hm,0,true),paintMat);hs.castShadow=hh.castShadow=true;head.add(hs,hh);
  head.position.set(0,(ch.baby?2.85:2.98)-1.25,.06);drvGroup.add(head);
  for(const x of[-.75,.75]){const l=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.08),lightMatR);l.position.set(x,.95,-2.66);body.add(l);const h=new THREE.Mesh(SPH(.13,12,8),lightMatW);h.position.set(x*.75,.86,3.05);body.add(h);detail.push(l,h);}
  const wheels=[],struts=[];
  for(const[x,z,f,s]of[[-1.55,1.45,1,1],[1.55,1.45,1,1],[-1.62,-1.5,0,1.12],[1.62,-1.5,0,1.12]]){
    const st=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x)-.55,.11,.22),tyreMat);st.position.set(x*.58,.68,z);body.add(st);struts.push({st,x,y0:.68});
    const piv=new THREE.Group();piv.position.set(x,.74*s,z);const w=new THREE.Mesh(tyreGeo,tyreMat);w.scale.setScalar(s);w.castShadow=true;piv.add(w);body.add(piv);wheels.push({piv,w,f,y0:.74*s,x,z});}
  const shield=new THREE.Mesh(new THREE.IcosahedronGeometry(3.3,3),new THREE.MeshPhongMaterial({color:0x8fe9ff,transparent:true,opacity:.28,shininess:120,emissive:0x2a8fb0,depthWrite:false}));shield.position.y=1.7;shield.visible=false;body.add(shield);
  const glider=new THREE.Group();{const parts=[[WING,a,M(0,0,0)],[WING2,c,M(0,.07,-.1,0,0,0,.62,1,.62)],[new THREE.CylinderGeometry(.07,.07,2.6,8),dk,M(-1.15,-1.15,-.2,0,0,.42)],[new THREE.CylinderGeometry(.07,.07,2.6,8),dk,M(1.15,-1.15,-.2,0,0,-.42)],[new THREE.CylinderGeometry(.06,.06,2.4,8),dk,M(0,-1.05,.6,.35)]];
    const gm=new THREE.Mesh(build(parts,0,true),paintMat);gm.castShadow=true;glider.add(gm);glider.position.set(0,4.5,-.2);glider.visible=false;body.add(glider);}
  let rotor=null;if(ch.fly){const wp=[[rbox(3.4,.14,1.3,.07),a,M(-2.9,.95,.1,0,.12,.1)],[rbox(3.4,.14,1.3,.07),a,M(2.9,.95,.1,0,-.12,-.1)],[rbox(.5,.16,.9,.07),c,M(-4.5,1.12,.2)],[rbox(.5,.16,.9,.07),c,M(4.5,1.12,.2)],[rbox(.14,1.1,.9,.06),a,M(0,1.9,-2.6,-.2)],[new THREE.CylinderGeometry(.09,.09,1.3,8),dk,M(0,3.55,-1.1)]];
    const wm=new THREE.Mesh(build(wp,0,true),paintMat);wm.castShadow=true;body.add(wm);
    rotor=new THREE.Mesh(build([[rbox(5.4,.08,.38,.04),dk],[rbox(.38,.08,5.4,.04),dk],[SPH(.3,12,8),a]],0,true),paintMat);rotor.position.set(0,4.25,-1.1);body.add(rotor);}
  const blob=new THREE.Mesh(blobGeo,blobMat);blob.position.y=.06;root.add(blob);
  return{root,body,wheels,struts,drvGroup,armL,armR,steerWheel,head,shield,blob,glider,rotor,detail};"""
    html = must_replace(html, old_make_kart, new_make_kart, "make_kart_rigged")

    old_audio = """function audioInit(){if(AU.ctx)return;try{const A=window.AudioContext||window.webkitAudioContext;AU.ctx=new A();}catch(e){return;}
  const c=AU.ctx;AU.master=c.createGain();AU.master.gain.value=.8;AU.master.connect(c.destination);
  AU.music=c.createGain();AU.music.gain.value=.22;AU.music.connect(AU.master);AU.sfx=c.createGain();AU.sfx.gain.value=.55;AU.sfx.connect(AU.master);
  const nb=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;AU.noise=nb;AU.next=c.currentTime+.1;AU.playing=true;}"""
    new_audio = """function audioInit(){if(AU.ctx)return;try{const A=window.AudioContext||window.webkitAudioContext;AU.ctx=new A();}catch(e){return;}
  const c=AU.ctx;const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;comp.connect(c.destination);
  AU.master=c.createGain();AU.master.gain.value=.82;AU.master.connect(comp);
  AU.music=c.createGain();AU.music.gain.value=.22;AU.music.connect(AU.master);
  try{const len=Math.floor(c.sampleRate*.85),ir=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8);}
    const conv=c.createConvolver();conv.buffer=ir;const wet=c.createGain();wet.gain.value=.2;AU.music.connect(conv);conv.connect(wet);wet.connect(AU.master);AU.reverb=conv;}catch(e){}
  AU.sfx=c.createGain();AU.sfx.gain.value=.55;AU.sfx.connect(AU.master);
  const nb=c.createBuffer(1,c.sampleRate,c.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;AU.noise=nb;AU.next=c.currentTime+.1;AU.playing=true;}"""
    html = must_replace(html, old_audio, new_audio, "audio_reverb")

    old_engine = """function engineStart(n){const c=AU.ctx;if(!c)return;engineStop();for(let i=0;i<n;i++){const o=c.createOscillator(),o2=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();o.type='sawtooth';o2.type='square';o2.detune.value=-1200;f.type='lowpass';f.frequency.value=700;g.gain.value=0;
  o.connect(f);o2.connect(f);f.connect(g);g.connect(AU.sfx);o.start();o2.start();AU.engines.push({o,o2,f,g});}}
function engineStop(){for(const e of AU.engines){try{e.o.stop();e.o2.stop();}catch(x){}}AU.engines=[];}
function engineSet(i,spd,boost,on){const e=AU.engines[i];if(!e)return;const c=AU.ctx,t=c.currentTime;const f=55+Math.abs(spd)*2.1+(boost?40:0);e.o.frequency.setTargetAtTime(f,t,.05);e.o2.frequency.setTargetAtTime(f,t,.05);e.f.frequency.setTargetAtTime(500+Math.abs(spd)*22,t,.08);e.g.gain.setTargetAtTime(on?.05+Math.min(.05,Math.abs(spd)/1400):0,t,.1);}"""
    new_engine = """function engineStart(n){const c=AU.ctx;if(!c)return;engineStop();for(let i=0;i<n;i++){const o=c.createOscillator(),o2=c.createOscillator(),lfo=c.createOscillator(),lfoGain=c.createGain(),f=c.createBiquadFilter(),g=c.createGain(),nz=c.createBufferSource(),nzF=c.createBiquadFilter(),nzG=c.createGain(),pan=c.createStereoPanner?c.createStereoPanner():null;
  o.type='sawtooth';o2.type='triangle';o2.detune.value=-1200;f.type='lowpass';f.frequency.value=650;f.Q.value=.6;g.gain.value=0;
  lfo.type='sine';lfo.frequency.value=5.6+Math.random()*1.4;lfoGain.gain.value=1.1;lfo.connect(lfoGain);lfoGain.connect(o.frequency);lfoGain.connect(o2.frequency);
  nz.buffer=AU.noise;nz.loop=true;nzF.type='bandpass';nzF.frequency.value=720;nzF.Q.value=.9;nzG.gain.value=0;nz.connect(nzF);nzF.connect(nzG);nzG.connect(g);
  o.connect(f);o2.connect(f);f.connect(g);if(pan){g.connect(pan);pan.connect(AU.sfx);pan.pan.value=n>1?(i-(n-1)/2)*.3:0;}else g.connect(AU.sfx);
  o.start();o2.start();lfo.start();nz.start();AU.engines.push({o,o2,lfo,nz,f,g,nzF,nzG,gear:0,prevSpd:0,popCD:0});}}
function engineStop(){for(const e of AU.engines){try{e.o.stop();e.o2.stop();e.lfo.stop();e.nz.stop();}catch(x){}}AU.engines=[];}
function engineSet(i,spd,boost,on,drift){const e=AU.engines[i];if(!e)return;const c=AU.ctx,t=c.currentTime,as=Math.abs(spd);
  const gear=clamp(Math.floor(as/15.5),0,4),inGear=(as-gear*15.5)/15.5;
  if(gear>e.gear&&on){tone(220+gear*40,.1,'triangle',.032,.68);}
  if(on&&e.prevSpd-as>4.5&&as>24&&t>(e.popCD||0)){e.popCD=t+.4;noise(.07,300,.05,0,null,2.2,.6);}
  e.gear=gear;e.prevSpd=as;
  const rpm=52+gear*17+inGear*54+(boost?36:0)+(drift?14:0);
  e.o.frequency.setTargetAtTime(rpm,t,.06);e.o2.frequency.setTargetAtTime(rpm*.5,t,.06);
  e.f.frequency.setTargetAtTime(420+rpm*5.5+(boost?260:0),t,.08);
  e.nzF.frequency.setTargetAtTime(650+as*7,t,.08);e.nzG.gain.setTargetAtTime(on?Math.min(.1,.025+as/900+(boost?.03:0)):0,t,.1);
  e.g.gain.setTargetAtTime(on?.042+Math.min(.052,as/1300)+(boost?.015:0):0,t,.08);}"""
    html = must_replace(html, old_engine, new_engine, "engine_gearbox")

    old_music_tick = """function musicTick(){const c=AU.ctx;if(!c||!AU.playing)return;const M2=SONG;const stepDur=60/(AU.tempo*(M2.tempo/132))/4;
  while(AU.next<c.currentTime+.12){const s=AU.step%64,bar=Math.floor(s/16),ch=M2.prog[bar],w=AU.next-c.currentTime;
    if(M2.perc==='dhol'){if([0,3,6,10,12].includes(s%16))kick(AU.next,s%16===0?160:110,s%16===0?.75:.45);if([4,12].includes(s%16))noise(.12,2200,.3,w,AU.music,.9);if(s%2===1)noise(.03,8000,.08,w,AU.music,1);if(s%4===2)tone(NOTE(74+(s%8===2?0:3)),.07,'triangle',.12,1.6,w,AU.music);}
    else if(M2.perc==='bell'){if(s%4===0)kick(AU.next,130,.55);if(s%8===4)noise(.1,1500,.2,w,AU.music,.7);if(s%2===1)noise(.03,9000,.07,w,AU.music,1);if(s%16===0)tone(NOTE(91),.9,'sine',.07,0,w,AU.music);}
    else if(M2.perc==='garage'){if([0,10].includes(s%16))kick(AU.next,140,.8);if(s%8===4)noise(.12,2400,.32,w,AU.music,.9);if([2,6,7,11,14].includes(s%16))noise(.03,9000,.1,w,AU.music,1);if(s%16===13)noise(.05,3000,.15,w,AU.music,1.2);}
    else if(M2.perc==='soft'){if(s%8===0||s%16===10)kick(AU.next,120,.55);if(s%8===4)noise(.16,1300,.18,w,AU.music,.6);if(s%2===1)noise(.03,7000,.06,w,AU.music,1);if(s%4===0)tone(NOTE(ch[(s/4)%ch.length|0]+24),.5,'sine',.05,0,w,AU.music);}
    else{if(s%4===0)kick(AU.next);if(s%2===1)noise(.04,7000,.12,w,AU.music,1);if(s%8===4)noise(.14,1800,.3,w,AU.music,.7);}
    const bp=M2.bass[s%8];if(s%2===0)tone(NOTE(ch[0]-24+bp),stepDur*1.8,'triangle',.4,0,w,AU.music);
    tone(NOTE(ch[s%ch.length]+12),stepDur*.9,M2.perc==='soft'?'triangle':'square',.06,0,w,AU.music);
    const m=M2.mel[s];if(m)tone(NOTE(m),stepDur*1.7,M2.lead,M2.lead==='sawtooth'?.07:.09,0,w,AU.music);
    AU.next+=stepDur;AU.step++;}}"""
    new_music_tick = """function musicTick(){const c=AU.ctx;if(!c||!AU.playing)return;const M2=SONG||MUSIC.lava;const finSpd=G.fin?1.12:1,semi=G.fin?2:0;const stepDur=60/(AU.tempo*finSpd*(M2.tempo/132))/4;
  while(AU.next<c.currentTime+.12){const s=AU.step%64,bar=Math.floor(s/16),ch=M2.prog[bar%M2.prog.length],w=AU.next-c.currentTime;
    if(M2.perc==='dhol'){if([0,3,6,10,12].includes(s%16))kick(AU.next,s%16===0?160:110,s%16===0?.75:.45);if([4,12].includes(s%16))noise(.12,2200,.3,w,AU.music,.9);if(s%2===1)noise(.03,8000,.08,w,AU.music,1);if(s%4===2)tone(NOTE(74+semi+(s%8===2?0:3)),.07,'triangle',.12,1.6,w,AU.music);}
    else if(M2.perc==='bell'){if(s%4===0)kick(AU.next,130,.55);if(s%8===4)noise(.1,1500,.2,w,AU.music,.7);if(s%2===1)noise(.03,9000,.07,w,AU.music,1);if(s%16===0)tone(NOTE(91+semi),.9,'sine',.07,0,w,AU.music);}
    else if(M2.perc==='garage'){if([0,10].includes(s%16))kick(AU.next,140,.8);if(s%8===4)noise(.12,2400,.32,w,AU.music,.9);if([2,6,7,11,14].includes(s%16))noise(.03,9000,.1,w,AU.music,1);if(s%16===13)noise(.05,3000,.15,w,AU.music,1.2);}
    else if(M2.perc==='soft'){if(s%8===0||s%16===10)kick(AU.next,120,.55);if(s%8===4)noise(.16,1300,.18,w,AU.music,.6);if(s%2===1)noise(.03,7000,.06,w,AU.music,1);if(s%4===0)tone(NOTE(ch[(s/4)%ch.length|0]+24+semi),.5,'sine',.05,0,w,AU.music);}
    else{if(s%4===0)kick(AU.next);if(s%2===1)noise(.04,7000,.12,w,AU.music,1);if(s%8===4)noise(.14,1800,.3,w,AU.music,.7);}
    const bp=M2.bass[s%8];if(s%2===0)tone(NOTE(ch[0]-24+bp+semi),stepDur*1.8,'triangle',.4,0,w,AU.music);
    tone(NOTE(ch[s%ch.length]+12+semi),stepDur*.9,M2.perc==='soft'?'triangle':'square',.06,0,w,AU.music);
    const m=M2.mel[s];if(m)tone(NOTE(m+semi),stepDur*1.7,M2.lead,M2.lead==='sawtooth'?.07:.09,0,w,AU.music);
    if(window.WFV2)WFV2.playFrontrunLayer(s,NOTE,ch,stepDur,w,AU.music);
    AU.next+=stepDur;AU.step++;}}"""
    html = must_replace(html, old_music_tick, new_music_tick, "music_keyshift")

    old_input = """const KA={l:['KeyA'],r:['KeyD'],gas:['KeyW'],brake:['KeyS'],drift:['Space'],item:['KeyE'],hype:['KeyQ'],swap:['KeyR']};
const KB={l:['ArrowLeft'],r:['ArrowRight'],gas:['ArrowUp'],brake:['ArrowDown'],drift:['Slash','ShiftRight'],item:['Period'],hype:['Comma'],swap:['Semicolon']};
const anyK=a=>a.some(k=>keys.has(k));
addEventListener('keydown',e=>{audioInit();if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Slash'].includes(e.code))e.preventDefault();if(!keys.has(e.code))menuKey(e.code);keys.add(e.code);if(e.code==='KeyM'){AU.muted=!AU.muted;if(AU.master)AU.master.gain.value=AU.muted?0:.8;}});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>keys.clear());
const touch={l:0,r:0,drift:0,item:0,brake:0,hype:0,on:false};
for(const[id,k]of[['tL','l'],['tR','r'],['tD','drift'],['tI','item'],['tB','brake'],['tH','hype']]){const el=document.getElementById(id);if(!el)continue;"""
    new_input = """const KA={l:['KeyA'],r:['KeyD'],gas:['KeyW'],brake:['KeyS','KeyB'],drift:['KeyV'],item:['KeyE','Space'],hype:['KeyQ','KeyN'],swap:['KeyR'],look:['KeyZ'],aimF:['ShiftLeft','KeyF'],aimB:['KeyX']};
const KB={l:['ArrowLeft'],r:['ArrowRight'],gas:['ArrowUp'],brake:['ArrowDown'],drift:['Slash','ShiftRight'],item:['Period'],hype:['Comma'],swap:['Semicolon'],look:['Quote'],aimF:['BracketRight'],aimB:['BracketLeft']};
const anyK=a=>a&&a.some(k=>keys.has(k));
addEventListener('keydown',e=>{if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA'))return;audioInit();if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Slash'].includes(e.code))e.preventDefault();if(!keys.has(e.code))menuKey(e.code);keys.add(e.code);if(e.code==='KeyM'){AU.muted=!AU.muted;if(AU.master)AU.master.gain.value=AU.muted?0:.82;}if(e.code==='KeyL'&&e.shiftKey)cheatToPodium();});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>keys.clear());
const touch={steer:0,l:0,r:0,drift:0,item:0,brake:0,hype:0,look:0,aimF:0,on:false};
for(const[id,k]of[['tL','l'],['tR','r'],['tD','drift'],['tI','item'],['tB','brake'],['tH','hype']]){const el=document.getElementById(id);if(!el)continue;"""
    html = must_replace(html, old_input, new_input, "input_defs")

    old_read_input = """function readPad(p,o){if(!p)return;let sx=p.axes[0]||0;if(Math.abs(sx)>.16)o.steer+=Math.sign(sx)*(Math.abs(sx)-.16)/.84;if(btn(p,14))o.steer-=1;if(btn(p,15))o.steer+=1;
  if(btn(p,7)||btn(p,0))o.gas=1;if(btn(p,6)||btn(p,2))o.brake=1;if(btn(p,5))o.drift=1;if(btn(p,4)||btn(p,1))o.item=1;if(btn(p,3))o.hype=1;if(btn(p,9))o.pause=1;if(btn(p,12))o.swap=1;}
function readInput(pi){const o={steer:0,gas:0,brake:0,drift:0,item:0,hype:0,pause:0,swap:0};const two=G.humans.length>1;
  // multiplayer lobby: each player reads only their own controller / phone / keyboard half
  const B=G.bind&&G.bind[pi];
  if(B){if(B.kind==='keys'){const s=B.scheme?KB:KA;if(anyK(s.l))o.steer-=1;if(anyK(s.r))o.steer+=1;if(anyK(s.gas))o.gas=1;if(anyK(s.brake))o.brake=1;if(anyK(s.drift))o.drift=1;if(anyK(s.item))o.item=1;if(anyK(s.hype))o.hype=1;if(anyK(s.swap))o.swap=1;if(keys.has('Escape')||keys.has('KeyP'))o.pause=1;}
    else{const p=pads().find(q=>padKey(q)===B.id);readPad(p,o);if(p&&p.phone&&p.auto&&!o.brake)o.gas=G.state==='race'?1:0;}
    o.steer=clamp(o.steer,-1,1);return o;}
  const schemes=two?[pi===0?KA:KB]:[KA,KB];
  for(const s of schemes){if(anyK(s.l))o.steer-=1;if(anyK(s.r))o.steer+=1;if(anyK(s.gas))o.gas=1;if(anyK(s.brake))o.brake=1;if(anyK(s.drift))o.drift=1;if(anyK(s.item))o.item=1;if(anyK(s.hype))o.hype=1;if(anyK(s.swap))o.swap=1;}
  if(keys.has('Escape')||keys.has('KeyP'))o.pause=1;
  const ps=pads();if(two)readPad(ps[pi],o);else ps.forEach(p=>readPad(p,o));
  if(pi===0&&touch.on){o.gas=(touch.brake||G.state!=='race')?0:1;o.brake=touch.brake;if(touch.l)o.steer-=1;if(touch.r)o.steer+=1;if(touch.drift)o.drift=1;if(touch.item)o.item=1;if(touch.hype)o.hype=1;}
  o.steer=clamp(o.steer,-1,1);return o;}"""
    new_read_input = """function readPad(p,o){if(!p)return;let sx=p.axes[0]||0,sy=p.axes[1]||0;if(Math.abs(sx)>.16)o.steer+=Math.sign(sx)*(Math.abs(sx)-.16)/.84;if(btn(p,14))o.steer-=1;if(btn(p,15))o.steer+=1;
  if(sy<-.55)o.aimF=1;if(sy>.55)o.aimB=1;
  if(btn(p,7)||btn(p,0))o.gas=1;if(btn(p,6)||btn(p,2))o.brake=1;if(btn(p,5))o.drift=1;if(btn(p,4)||btn(p,1))o.item=1;if(btn(p,3))o.hype=1;if(btn(p,9))o.pause=1;if(btn(p,12))o.swap=1;if(btn(p,10)||btn(p,8))o.look=1;}
function readInput(pi){const o={steer:0,gas:0,brake:0,drift:0,item:0,hype:0,pause:0,swap:0,look:0,aimF:0,aimB:0};const two=G.humans.length>1;
  const B=G.bind&&G.bind[pi];
  if(B){if(B.kind==='keys'){const s=B.scheme?KB:KA;if(anyK(s.l))o.steer-=1;if(anyK(s.r))o.steer+=1;if(anyK(s.gas))o.gas=1;if(anyK(s.brake))o.brake=1;if(anyK(s.drift))o.drift=1;if(anyK(s.item))o.item=1;if(anyK(s.hype))o.hype=1;if(anyK(s.swap))o.swap=1;if(anyK(s.look))o.look=1;if(anyK(s.aimF))o.aimF=1;if(anyK(s.aimB))o.aimB=1;if(keys.has('Escape')||keys.has('KeyP'))o.pause=1;}
    else{const p=pads().find(q=>padKey(q)===B.id);readPad(p,o);if(p&&p.phone&&p.auto&&!o.brake)o.gas=G.state==='race'?1:0;}
    o.steer=clamp(o.steer,-1,1);return o;}
  const schemes=two?[pi===0?KA:KB]:[KA,KB];
  for(const s of schemes){if(anyK(s.l))o.steer-=1;if(anyK(s.r))o.steer+=1;if(anyK(s.gas))o.gas=1;if(anyK(s.brake))o.brake=1;if(anyK(s.drift))o.drift=1;if(anyK(s.item))o.item=1;if(anyK(s.hype))o.hype=1;if(anyK(s.swap))o.swap=1;if(anyK(s.look))o.look=1;if(anyK(s.aimF))o.aimF=1;if(anyK(s.aimB))o.aimB=1;}
  if(keys.has('Escape')||keys.has('KeyP'))o.pause=1;
  const ps=pads();if(two)readPad(ps[pi],o);else ps.forEach(p=>readPad(p,o));
  if(pi===0&&touch.on){o.gas=(touch.brake||G.state!=='race')?0:1;o.brake=touch.brake;o.steer+=touch.steer||0;if(touch.drift)o.drift=1;if(touch.item)o.item=1;if(touch.hype)o.hype=1;if(touch.look)o.look=1;if(touch.aimF)o.aimF=1;}
  o.steer=clamp(o.steer,-1,1);return o;}"""
    html = must_replace(html, old_read_input, new_read_input, "read_input")

    old_hud_kart = """function makeHUD(n){views.innerHTML='';VIEWS=[];
  for(let p=0;p<n;p++){const v=document.createElement('div');v.className='view'+(n>1?' small':'')+(n>2?' quad':'');const r=viewRect(p,n);v.style.left=r.x*100+'%';v.style.right='auto';v.style.width=r.w*100+'%';v.style.top=r.y*100+'%';v.style.height=r.h*100+'%';
    v.innerHTML=`<div class="hud"><div class="tl"><div class="lap"><small>${n>1?'P'+(p+1)+' · ':''}LAP</small><span class="lv">1/3</span></div><div class="clock">0:00.000</div><div class="coins"><i></i><span class="cn">0</span></div></div>
      <div class="item"><span class="ic"></span><span class="tag"></span></div><div class="item2"><span class="ic2"></span><small>NEXT</small></div><div class="board"></div>
      <div class="bl"><div class="hypeLbl"><span>HYPE</span><span class="hk">fill me up</span></div><div class="hypeBar"><i></i></div></div>
      <div class="br"><div class="pos"><span class="pn">1</span><sup class="ps">st</sup></div><div class="spd"><b class="sv">0</b> km/h</div></div><div class="msg"></div></div>`;
    views.appendChild(v);const q=s=>v.querySelector(s);
    VIEWS.push({el:v,lv:q('.lv'),clock:q('.clock'),cn:q('.cn'),item:q('.item'),item2:q('.item2'),ic2:q('.ic2'),lastIcon2:'',ic:q('.ic'),tag:q('.tag'),board:q('.board'),bl:q('.bl'),hk:q('.hk'),hb:q('.hypeBar i'),pos:q('.pos'),pn:q('.pn'),ps:q('.ps'),sv:q('.sv'),msg:q('.msg'),msgT:0,lastIcon:''});}}
function say(p,text,dur=1.2,cls=''){const v=VIEWS[p];if(!v)return;if(cls!=='cd')return; // only the 3-2-1-GO countdown is shown over the screen (on-screen announcements were distracting)
  v.msg.textContent=text;v.msg.className='msg show '+cls;v.msgT=dur;}

// cameras
const cams=[0,1,2,3].map(()=>{const c=new THREE.PerspectiveCamera(70,1,.5,5000);return{c,shake:0,yaw:0,fov:70};});cams.forEach((cm,p)=>{for(let q=0;q<4;q++)if(q!==p)cm.c.layers.enable(10+q);});

class Kart{
  constructor(ch,human,pi){this.ch=ch;this.human=human;this.pi=pi;this.v=makeKart(ch);scene.add(this.v.root);this.tag=nameTag(ch);this.v.root.add(this.tag);if(human)this.tag.layers.set(10+pi);
    const st=ch.st;this.maxS=58*(.94+st[0]*.028);this.acc=24*(.78+st[1]*.09);this.hand=.86+st[2]*.06;this.weight=.7+st[3]*.15;
    this.seed=R()*100;const sk=DIFF.skill[diffLvl()];this.skill=rr(sk[0],sk[1]);this.laneBase=rr(-6,6);}
  reset(i,l){Object.assign(this,{slide:null,slideL:null,slPrev:null,cut:null,cannon:null,cannonCD:0,dside:0,idx:i,x:TP[i].x+TR[i].x*l,z:TP[i].z+TR[i].z*l,y:H[i],vy:0,heading:TA[i],moveAng:TA[i],speed:0,onGround:true,lap:0,cp:true,progress:0,
      boostT:0,spinT:0,stallT:0,shieldT:0,hyperT:0,hype:0,graceT:0,ramCD:0,hypeMode:false,lastStrikeT:-99,tyresN:0,tyresT:0,boat:false,boatS:0,dartCD:0,dartHitCD:0,wobT:0,coins:0,item:null,itemN:0,rollT:0,driftDir:0,driftCharge:0,hopping:false,rampAir:false,trickDone:false,trickT:0,
      item2:null,item2N:0,rollSlot:1,downAt:null,respawnT:0,finished:false,finishTime:0,lapStart:0,bestLap:Infinity,slip:0,padCD:0,offroad:false,prev:{},aiItemT:rr(1,4),corner:false,cornerT:0,lastLevel:0,gasT:-1,bumpCD:0,rank:0,steerVis:0,airT:0,lavaT:0,glide:false,aiCut:false,trainCD:0,avCD:0,windMsg:0,surfMsg:0});
    this.v.glider.visible=false;
    this.v.root.visible=true;this.v.shield.visible=false;}
}
function itemRoll(k){const it=itemRoll0(k);if(it==='ducks')G.ducksOut=true;if(it==='swap')G.swapOut=true;if(it==='slowmo')G.slowOut=true;return it;}
function itemPick(t){t=t.filter(([n])=>!(n==='ducks'&&G.ducksOut)&&!(n==='swap'&&G.swapOut)&&!(n==='slowmo'&&(G.slowOut||!G.slowOK)));let tot=0;for(const[,w]of t)tot+=w;let x=R()*tot;for(const[n2,w]of t){if((x-=w)<=0)return n2;}return t[0][0];}
function itemRoll0(k){if(G.battle){const t=[['goo',6],['bee',5],['chili',5],['triple',3],['bubble',8],['ball',9],['chappal',8],['star',4],['ducks',5],['cloud',3],['tiffin',5],['gold',3],['goo3',4],['ball3',6],['bee3',4],['comet',4],['bomb',7],['rocket',3],['shrink',2],['paint',4],['ghost',4],['chomp',6],['fire',6],['bag',3],['spring',8],['sun',5],['truck',5],['pump',k.balloons<3?7:0],['mine',7],['freeze',6],['jumbo',4],['slap',8],['slowmo',5],['flop',4],['prank',5],['tyres',6]];return itemPick(t);}
  const n=G.karts.length;const r=k.rank/(n-1);const t=[['goo',r<.3?24:6],['chili',r<.3?5:10],['bubble',r<.3?12:6],['bee',r<.15?0:r>.6?9:5],['triple',r<.3?0:r<.7?7:10],['ball',r<.5?12:8],['chappal',8],['cloud',r<.4?0:r<.7?4:8],['tiffin',r<.5?12:5],['star',r<.3?0:r<.6?3:7],['ducks',r<.3?3:6],['gold',r<.4?0:r<.7?5:8],['goo3',r<.3?10:3],['ball3',r<.3?4:7],['bee3',r<.3?0:r<.6?4:7],['comet',r<.5?0:r<.8?3:6],['bomb',r<.3?4:7],['rocket',r<.6?0:r<.85?4:9],['shrink',r<.5?0:r<.8?2:5],['paint',r<.2?0:5],['ghost',4],['chomp',r<.3?2:6],['fire',r<.3?4:6],['bag',r<.4?1:4],['coinbag',r<.3?6:3],['sun',r<.3?2:r<.6?6:9],['jumbo',r<.4?0:r<.7?3:7],['slap',r<.2?3:6],['slowmo',r<.2?1:r<.6?3:4],['flop',r<.3?0:r<.6?3:5],['prank',r<.3?8:4],['tyres',r<.3?3:r<.6?6:8]]; // (Teleport retired)
  return itemPick(t);}"""

    new_hud_kart = """function makeHUD(n){views.innerHTML='';VIEWS=[];
  for(let p=0;p<n;p++){const v=document.createElement('div');v.className='view'+(n>1?' small':'')+(n>2?' quad':'');const r=viewRect(p,n);v.style.left=r.x*100+'%';v.style.right='auto';v.style.width=r.w*100+'%';v.style.top=r.y*100+'%';v.style.height=r.h*100+'%';
    v.innerHTML=`<div class="hud"><div class="tl"><div class="lap"><small>${n>1?'P'+(p+1)+' · ':''}${G.mirror?'🪞 MIRROR · ':''}${G.timeTrial?'TIME TRIAL · ':''}LAP</small><span class="lv">1/3</span></div><div class="clock">0:00.000</div><div class="coins"><i></i><span class="cn">0</span></div></div>
      <div class="trailBadge" hidden>SHIELDING</div>
      <div class="item"><span class="ic"></span><span class="tag"></span></div><div class="item2"><span class="ic2"></span><small>NEXT</small></div><div class="board"></div>
      <div class="wrongWay" hidden>↺ WRONG WAY!</div>
      <div class="toastFeed"></div>
      <div class="bl"><div class="hypeLbl"><span>HYPE</span><span class="hk">fill me up</span></div><div class="hypeBar"><i></i></div></div>
      <div class="br"><div class="pos"><span class="pn">1</span><sup class="ps">st</sup></div><div class="spd"><b class="sv">0</b> km/h</div></div><div class="msg"></div></div>`;
    views.appendChild(v);const q=s=>v.querySelector(s);
    VIEWS.push({el:v,lv:q('.lv'),clock:q('.clock'),cn:q('.cn'),trailB:q('.trailBadge'),item:q('.item'),item2:q('.item2'),ic2:q('.ic2'),lastIcon2:'',ic:q('.ic'),tag:q('.tag'),board:q('.board'),ww:q('.wrongWay'),toasts:q('.toastFeed'),pillList:[],bl:q('.bl'),hk:q('.hk'),hb:q('.hypeBar i'),pos:q('.pos'),pn:q('.pn'),ps:q('.ps'),sv:q('.sv'),msg:q('.msg'),msgT:0,lastIcon:''});
    if(p===0)q('.bl').addEventListener('pointerdown',hypeTap);}}
const SHOW_TOASTS=false;
function say(p,text,dur=1.2,cls=''){const v=VIEWS[p];if(!v||!text)return;
  if(cls==='cd'||cls==='fin'){v.msg.textContent=text;v.msg.className='msg show '+cls;v.msgT=dur;return;}
  if(!SHOW_TOASTS)return; // side toasts ("LAP 2", "SLIPSTREAM!", ...) are off: the only race announcement is the final-lap ribbon
  if(v.pillList.some(x=>x.text===text&&x.t>.35))return;
  const el=document.createElement('div');
  const warn=/OUCH|SPLAT|INCOMING|TRAIN|AVALANCHE|STALLED|BURIED|TRAMPLED|BUSTED|ZAPPED|WRONG|HIT|CHOMPED|FROZEN/.test(text);
  const good=/BOOST|TURBO|SLIPSTREAM|RING|START|BLOCKED|HYPE|STOLE|COIN|NICE|GRAVITY/.test(text);
  el.className='toastPill'+(warn?' warn':good?' good':'');el.textContent=text;
  v.toasts.appendChild(el);v.pillList.push({el,t:Math.max(.9,dur),text});
  while(v.pillList.length>3){const old=v.pillList.shift();old.el.remove();}}

// cameras
const cams=[0,1,2,3].map(()=>{const c=new THREE.PerspectiveCamera(70,1,.5,5000);return{c,shake:0,yaw:0,fov:70};});cams.forEach((cm,p)=>{for(let q=0;q<4;q++)if(q!==p)cm.c.layers.enable(10+q);});

const CLASSIC_POOL=new Set(['chili','triple','gold','goo','goo3','ball','ball3','bee','bee3','chappal','bomb','comet','star','shrink','ghost','bubble','coinbag']);
function itemPoolMode(){return store.get('wheeliefun.items')==='classic'?'classic':'all';}
function updateItemsBtn(){const b=$('#itemsBtn');if(b)b.textContent='Items: '+(itemPoolMode()==='classic'?'Classic (17)':'All (37)');}
function cycleItemsMode(){store.set('wheeliefun.items',itemPoolMode()==='classic'?'all':'classic');updateItemsBtn();}

class Kart{
  constructor(ch,human,pi){this.ch=ch;this.human=human;this.pi=pi;this.v=makeKart(ch);scene.add(this.v.root);this.tag=nameTag(ch);this.v.root.add(this.tag);if(human)this.tag.layers.set(10+pi);
    const st=ch.st;this.maxS=58*(.94+st[0]*.028);this.acc=24*(.78+st[1]*.09);this.hand=.86+st[2]*.06;this.weight=.7+st[3]*.15;
    this.seed=R()*100;const sk=DIFF.skill[diffLvl()];this.skill=rr(sk[0],sk[1]);this.laneBase=rr(-6,6);}
  reset(i,l){if(this.trailMesh){scene.remove(this.trailMesh);this.trailMesh=null;}
    if(this.droneM){this.v.root.remove(this.droneM);this.droneM=null;}
    Object.assign(this,{slide:null,slideL:null,slPrev:null,cut:null,cannon:null,cannonCD:0,dside:0,idx:i,x:TP[i].x+TR[i].x*l,z:TP[i].z+TR[i].z*l,y:groundAt(i,0,l),vy:0,heading:TA[i],moveAng:TA[i],speed:0,onGround:true,lap:0,cp:true,progress:0,
      boostT:0,spinT:0,stallT:0,shieldT:0,hyperT:0,hype:0,graceT:0,ramCD:0,hypeMode:false,lastStrikeT:-99,tyresN:0,tyresT:0,boat:false,boatS:0,dartCD:0,dartHitCD:0,wobT:0,coins:0,item:null,itemN:0,rollT:0,driftDir:0,driftCharge:0,driftSlip:0,hopping:false,rampAir:false,trickDone:false,trickT:0,
      suspY:0,suspV:0,squash:1,wheelie:0,cheerT:0,wrongT:0,lookBack:false,trailItem:null,rescueFrom:null,rescueTo:null,rescueDur:1.5,skidL:null,skidR:null,radarBeepCD:0,antiGrav:false,agBlend:0,spinBoostT:0,spinBoostCD:0,brakeDrifting:false,
      item2:null,item2N:0,rollSlot:1,downAt:null,respawnT:0,finished:false,finishTime:0,lapStart:0,bestLap:Infinity,slip:0,padCD:0,offroad:false,prev:{},aiItemT:rr(1,4),corner:false,cornerT:0,lastLevel:0,gasT:-1,bumpCD:0,rank:0,steerVis:0,airT:0,lavaT:0,glide:false,aiCut:false,trainCD:0,avCD:0,windMsg:0,surfMsg:0});
    this.v.glider.visible=false;
    this.v.root.visible=true;this.v.shield.visible=false;}
}
function itemRoll(k){const it=itemRoll0(k);if(it==='ducks')G.ducksOut=true;if(it==='swap')G.swapOut=true;if(it==='slowmo')G.slowOut=true;return it;}
function itemPick(t){const classic=!G.battle&&itemPoolMode()==='classic';
  t=t.filter(([n,w])=>w>0&&(!classic||CLASSIC_POOL.has(n))&&!(n==='ducks'&&G.ducksOut)&&!(n==='swap'&&G.swapOut)&&!(n==='slowmo'&&(G.slowOut||!G.slowOK)));
  if(!t.length)return'chili';let tot=0;for(const[,w]of t)tot+=w;let x=R()*tot;for(const[n2,w]of t){if((x-=w)<=0)return n2;}return t[0][0];}
function itemRoll0(k){if(G.battle){const t=[['goo',6],['bee',5],['chili',5],['triple',3],['bubble',8],['ball',9],['chappal',8],['star',4],['ducks',5],['cloud',3],['tiffin',5],['gold',3],['goo3',4],['ball3',6],['bee3',4],['comet',4],['bomb',7],['rocket',3],['shrink',2],['paint',4],['ghost',4],['chomp',6],['fire',6],['bag',3],['spring',8],['sun',5],['truck',5],['pump',k.balloons<3?7:0],['mine',7],['freeze',6],['jumbo',4],['slap',8],['slowmo',5],['flop',4],['prank',5],['tyres',6]];return itemPick(t);}
  const n=Math.max(2,G.karts.length);const rankR=k.rank/(n-1);
  let leadProg=k.progress;for(const q of G.karts)if(!q.out&&q.progress>leadProg)leadProg=q.progress;
  const distM=Math.max(0,(leadProg-k.progress)*SP);
  const r=clamp(rankR*.45+clamp(distM/260,0,1)*.55,0,1);
  const t=[['goo',r<.22?24:r<.5?10:3],['chili',r<.2?4:r<.6?12:8],['bubble',r<.3?12:5],['bee',r<.12?0:r>.55?11:7],['triple',r<.25?0:r<.7?9:12],['ball',r<.45?13:7],['chappal',r<.7?8:4],['cloud',r<.4?0:r<.75?4:7],['tiffin',r<.45?10:4],['star',r<.35?0:r<.65?4:9],['ducks',r<.3?2:5],['gold',r<.45?0:r<.75?5:10],['goo3',r<.3?9:3],['ball3',r<.3?4:7],['bee3',r<.35?0:r<.65?4:7],['comet',r<.5?0:r<.8?3:7],['bomb',r<.25?3:8],['rocket',r<.62?0:r<.85?5:11],['shrink',r<.55?0:r<.8?2:6],['paint',r<.25?0:5],['ghost',4],['chomp',r<.3?2:6],['fire',r<.3?4:6],['bag',r<.45?1:5],['coinbag',r<.35?8:2],['sun',r<.3?2:r<.65?6:8],['jumbo',r<.45?0:r<.75?4:7],['slap',r<.25?3:6],['slowmo',r<.25?0:r<.65?3:4],['flop',r<.35?0:r<.65?3:5],['prank',r<.35?8:3],['tyres',r<.3?4:7]];
  return itemPick(t);}"""
    html = must_replace(html, old_hud_kart, new_hud_kart, "hud_kart_items")

    old_track_arrays = """const TA=new Float32Array(N),H=new Float32Array(N),GAP=new Uint8Array(N),CURV=new Float32Array(N),SURF=new Uint8Array(N),WIND=new Int8Array(N),LIPG=new Int8Array(N),DIST=new Float32Array(N);"""
    new_track_arrays = """const TA=new Float32Array(N),H=new Float32Array(N),GAP=new Uint8Array(N),CURV=new Float32Array(N),SURF=new Uint8Array(N),WIND=new Int8Array(N),LIPG=new Int8Array(N),DIST=new Float32Array(N),BANK=new Float32Array(N),UNFENCED=new Uint8Array(N);"""
    html = must_replace(html, old_track_arrays, new_track_arrays, "track_arrays")

    html = must_replace(
        html,
        "S=L.S;RAW=L.RAW;curve=new THREE.CatmullRomCurve3(RAW.map(p=>new THREE.Vector3(p[0]*S,p[2]*(L.HS||1),p[1]*S)),true,'centripetal');",
        "S=L.S;const mSign=(G.mirror&&!L.portals)?-1:1;if(L.id==='lava'){VOLC.x=mSign*-95*1.7;const cr=new THREE.Vector2((LAVA_RAW[12][0]+LAVA_RAW[13][0])/2*1.7*mSign,(LAVA_RAW[12][1]+LAVA_RAW[13][1])/2*1.7);RIV.dir.copy(cr).sub(VOLC).normalize();RIV.a.copy(VOLC).addScaledVector(RIV.dir,VR-10);RIV.b.copy(VOLC).addScaledVector(RIV.dir,760);}RAW=mSign<0?L.RAW.map(p=>[-p[0],p[1],p[2]]):L.RAW;curve=new THREE.CatmullRomCurve3(RAW.map(p=>new THREE.Vector3(p[0]*S,p[2]*(L.HS||1),p[1]*S)),true,'centripetal');",
        "mirror_raw_spline",
    )
    html = must_replace(
        html,
        "const ISLAND=new THREE.Vector2(-20,-130);",
        "const ISLAND=new THREE.Vector2(G.mirror?20:-20,-130);",
        "mirror_lava_island",
    )

    old_compute_end = """  for(const[f0,f1,t]of(L.surf||[]))for(let i=Math.floor(f0*N);i<Math.floor(f1*N);i++)SURF[wrapI(i)]=t;
  for(const[f0,f1,d]of(L.wind||[]))for(let i=Math.floor(f0*N);i<Math.floor(f1*N);i++)WIND[wrapI(i)]=d;
  featCompute(L);
}
function gapOf(i){for(let g=0;g<GAPS.length;g++){const G2=GAPS[g];if(wrapI(i-G2.s)<=wrapI(G2.e-G2.s))return g;}return -1;}
function groundAt(i,along){const j=wrapI(i+(along>=0?1:-1));const t=Math.min(1,Math.abs(along)/SP);return lerp(H[i],H[j],t);}
function edge(i,l,y){return[TP[i].x+TR[i].x*l,H[i]+y,TP[i].z+TR[i].z*l];}"""
    new_compute_end = """  for(const[f0,f1,t]of(L.surf||[]))for(let i=Math.floor(f0*N);i<Math.floor(f1*N);i++)SURF[wrapI(i)]=t;
  for(const[f0,f1,d]of(L.wind||[]))for(let i=Math.floor(f0*N);i<Math.floor(f1*N);i++)WIND[wrapI(i)]=d*(G.mirror?-1:1);
  UNFENCED.fill(0);
  const ufList=L.unfenced||(L.id==='sky'?[[.21,.30]]:L.id==='glider'?[[.71,.77]]:L.id==='starship'?[[.45,.52]]:[]);
  for(const[f0,f1]of ufList)for(let i=Math.floor(f0*N);i<Math.floor(f1*N);i++)if(!GAP[wrapI(i)])UNFENCED[wrapI(i)]=1;
  featCompute(L);
  BANK.fill(0);
  if(!L.portals&&L.id!=='kitchen'&&L.id!=='bathroom'&&L.id!=='supermarket'){
    for(let i=0;i<N;i++){
      if(i<28||i>N-28||GAP[i]||DIV[i]||TUN[i]>.05||HPL[i]>0||HPR[i]>0){BANK[i]=0;continue;}
      let nearGap=false;for(const g of GAPS)if(wrapI(i-(g.s-45))<wrapI(g.e+25-(g.s-45))){nearGap=true;break;}
      if(nearGap){BANK[i]=0;continue;}
      let acc=0;for(let d=-12;d<=12;d+=3)acc+=adiff(TA[wrapI(i+d-8)],TA[wrapI(i+d+8)]);
      BANK[i]=clamp((acc/9)*.22,-.14,.14);
    }
    const sm=new Float32Array(N);for(let i=0;i<N;i++){let s=0;for(let d=-6;d<=6;d++)s+=BANK[wrapI(i+d)];sm[i]=s/13;}BANK.set(sm);
  }
  if(window.WFV2)WFV2.computeAntiGrav(L);
}
function gapOf(i){for(let g=0;g<GAPS.length;g++){const G2=GAPS[g];if(wrapI(i-G2.s)<=wrapI(G2.e-G2.s))return g;}return -1;}
function groundAt(i,along,lat=0){const j=wrapI(i+(along>=0?1:-1));const t=Math.min(1,Math.abs(along)/SP);return lerp(H[i],H[j],t)-lat*Math.sin(lerp(BANK[i],BANK[j],t));}
function edge(i,l,y){return[TP[i].x+TR[i].x*l,H[i]-l*Math.sin(BANK[i])+y,TP[i].z+TR[i].z*l];}"""
    html = must_replace(html, old_compute_end, new_compute_end, "compute_banking_unfenced")

    html = must_replace(
        html,
        "const road=addL(new THREE.Mesh(ribbon(-ROAD,ROAD,.05,i=>(Math.floor(i/10)%2?C(0xffffff):C(th.roadAlt||0xf1eef5)),20),new THREE.MeshStandardMaterial({map:roadTex,vertexColors:true,roughness:th.roadRough||.82,metalness:th.roadMetal||0,envMap,envMapIntensity:th.roadEnv||.35})));road.receiveShadow=true;",
        "const roadNorm=window.WFV2?WFV2.makeRoadNormalTex(th):null;const road=addL(new THREE.Mesh(ribbon(-ROAD,ROAD,.05,i=>(Math.floor(i/10)%2?C(0xffffff):C(th.roadAlt||0xf1eef5)),20),new THREE.MeshStandardMaterial({map:roadTex,normalMap:roadNorm,normalScale:new THREE.Vector2(.42,.42),vertexColors:true,roughness:th.roadRough||.82,metalness:th.roadMetal||0,envMap,envMapIntensity:th.roadEnv||.35})));road.receiveShadow=true;LR.roadMesh=road;",
        "road_normal_map",
    )

    old_fence_build = """  const fe=th.fence;
  for(const s of[-1,1]){const f=addL(new THREE.Mesh(wallRibbon(s*WALL,i=>H[i],i=>H[i]+fe.h,fe.color,i=>(fe.skip&&fe.skip(i))||featSkip(i,s)),fe.mat||vcLambertDS));f.castShadow=true;}"""
    new_fence_build = """  const fe=th.fence;
  for(const s of[-1,1]){const f=addL(new THREE.Mesh(wallRibbon(s*WALL,i=>H[i]-s*WALL*LW[i]*Math.sin(BANK[i]),i=>H[i]-s*WALL*LW[i]*Math.sin(BANK[i])+fe.h,fe.color,i=>UNFENCED[i]===1||(fe.skip&&fe.skip(i))||featSkip(i,s)),fe.mat||vcLambertDS));f.castShadow=true;}
  if(UNFENCED.some(v=>v===1)){const ufCol=i=>Math.floor(i/3)%2?C(0xffb22e):C(0x26d3d0);
    for(const s of[-1,1])addL(new THREE.Mesh(ribbon(s*(WALL-1.4),s*WALL,.14,ufCol,8,i=>UNFENCED[i]===1),new THREE.MeshBasicMaterial({vertexColors:true})));}
  buildCornerChevrons(L);
  if(window.WFV2)WFV2.buildAntiGravProps(L);"""
    html = must_replace(html, old_fence_build, new_fence_build, "fence_unfenced_chevrons")

    old_setup = """  const used=new Set(G.humans.map(h=>h));const others=CHARS.map((c,i)=>i).filter(i=>!used.has(i)&&!CHARS[i].fly);
  const order=[...others];// AI fill grid ahead
  const grid=[];const hs=G.humans.slice();
  // humans start mid-pack
  const slots=CHARS.filter(c=>!c.fly).length;let hi=0,ai=0;const layout=[];for(let s=0;s<slots;s++){if(s>=slots-Math.max(3,hs.length)&&hi<hs.length&&!(s===slots-1&&hs.length===1)){layout.push({ch:hs[hi],human:true,pi:hi});hi++;}else layout.push({ch:order[ai++],human:false});}
  layout.forEach((L,s)=>{const k=new Kart(CHARS[L.ch],L.human,L.human?L.pi:-1);const i=wrapI(-Math.round((10+s*7.5)/SP));k.reset(i,s%2?-5.5:5.5);G.karts.push(k);});"""
    new_setup = """  if(typeof SKIDS!=='undefined')SKIDS.clear();
  if(window.WFV2){WFV2.RIBBONS.clear();WFV2.clearGhosts();}
  let layout=[];
  if(G.timeTrial&&!G.battle){layout=[{ch:G.humans[0]||0,human:true,pi:0}];}
  else if(G.onlineGrid){layout=G.onlineGrid.slice();}
  else{
    const used=new Set(G.humans.map(h=>h));const others=CHARS.map((c,i)=>i).filter(i=>!used.has(i)&&!CHARS[i].fly);
    const hs=G.humans.slice();const slots=Math.min(8,hs.length+others.length);let hi=0,ai=0;
    for(let s=0;s<slots;s++){if(s>=slots-Math.max(3,hs.length)&&hi<hs.length&&!(s===slots-1&&hs.length===1)){layout.push({ch:hs[hi],human:true,pi:hi});hi++;}else layout.push({ch:others[ai++%others.length],human:false});}
  }
  layout.forEach((L,s)=>{const k=new Kart(CHARS[L.ch%CHARS.length],!!L.human,L.human?L.pi:-1);if(window.WFV2)WFV2.applyGaragePhysics(k,WFV2.getPartsForKart(!!L.human,L.pi||0,s));k.netId=L.netId||null;k.isRemote=!!L.remote;if(L.displayName){k.netName=L.displayName;if(k.tag)k.v.root.remove(k.tag);k.tag=nameTag({name:L.displayName,kart:k.ch.kart});k.v.root.add(k.tag);}const i=wrapI(-Math.round((10+s*7.2)/SP));k.reset(i,G.timeTrial?0:(s%2?-5.5:5.5));G.karts.push(k);});"""
    html = must_replace(html, old_setup, new_setup, "setup_race_8karts")

    html = must_replace(
        html,
        "for(const b of boxes){b.t=0;b.m.visible=true;}for(const c of coins){c.t=0;c.m.visible=true;}",
        "for(const b of boxes){b.t=G.timeTrial?1e9:0;b.m.visible=!G.timeTrial;}for(const c of coins){c.t=0;c.m.visible=true;}if(G.timeTrial&&G.humans_k[0]&&!G.battle){G.humans_k[0].item='triple';G.humans_k[0].itemN=3;if(window.WFV2)WFV2.setupTimeTrialGhosts(LV);}",
        "timetrial_boxes_ghosts",
    )

    html = must_replace(
        html,
        "if(k.lap>G.laps&&!k.finished){k.finished=true;k.finishTime=G.raceT;if(k.human){say(k.pi,ord(k.rank+1)+'!',3);SFX.finish();for(let i=0;i<60;i++)burst(FX,k.x,k.y+3,k.z,1,30,1.2,1.4,R(),R(),R(),12,10);}}",
        "if(k.human&&window.WFV2)WFV2.crowdRoar();if(k.lap>G.laps&&!k.finished){k.finished=true;k.finishTime=G.raceT;if(k.human){if(window.WFV2)WFV2.voiceBark(k.ch,'cheer');say(k.pi,G.timeTrial?'FINISH! '+fmt(G.raceT):ord(k.rank+1)+'!',3);SFX.finish();for(let i=0;i<60;i++)burst(FX,k.x,k.y+3,k.z,1,30,1.2,1.4,R(),R(),R(),12,10);}}",
        "onlap_crowd_bark",
    )

    html = must_replace(
        html,
        "function releaseDrift(k){const c=k.driftCharge,lv=c>3?3:c>1.9?2:c>.9?1:0;\n  if(lv&&k.spinT<=0){k.boostT=Math.max(k.boostT,[0,.55,1,1.5][lv]);k.hype=Math.min(1,k.hype+[0,.05,.1,.17][lv]);if(k.human){SFX.boost();if(lv===3)say(k.pi,'ULTRA TURBO!',.9);}}",
        "function releaseDrift(k){const c=k.driftCharge,lv=c>3?3:c>1.9?2:c>.9?1:0;\n  if(lv&&k.spinT<=0){k.boostT=Math.max(k.boostT,[0,.55,1,1.5][lv]*(k.mtMult||1));k.hype=Math.min(1,k.hype+[0,.05,.1,.17][lv]);if(k.human){SFX.boost();if(lv===3){say(k.pi,'ULTRA TURBO!',.9);if(window.WFV2)WFV2.voiceBark(k.ch,'pass');}}}",
        "release_drift_mtmult",
    )

    old_hit_block = """  if(tyreBlock(k))return true;
  if((k.item==='ball3'||k.item==='bee3')&&k.itemN>0){k.itemN--;if(!k.itemN)k.item=null;burst(FX,k.x,k.y+2,k.z,24,14,.4,.7,1,.85,.3);if(k.human){SFX.pop();say(k.pi,'BLOCKED!',.7);}return true;}"""
    new_hit_block = """  if(tyreBlock(k))return true;
  if(k.trailItem){clearTrailMesh(k);burst(FX,k.x,k.y+2,k.z,24,14,.4,.7,.5,1,.8);if(k.human){SFX.pop();say(k.pi,'SHIELD BLOCKED!',.8);}return true;}
  if((k.item==='ball3'||k.item==='bee3'||k.item==='goo3')&&k.itemN>0){k.itemN--;if(!k.itemN)k.item=null;burst(FX,k.x,k.y+2,k.z,24,14,.4,.7,1,.85,.3);if(k.human){SFX.pop();say(k.pi,'BLOCKED!',.7);}return true;}"""
    html = must_replace(html, old_hit_block, new_hit_block, "hit_orbit_trail_block")

    html = must_replace(
        html,
        "if(by&&by!==k&&!(by.hyperT>0))by.hype=Math.min(1,by.hype+.14);",
        "if(k.human&&window.WFV2)WFV2.voiceBark(k.ch,'ouch');if(k.isOnlineAi&&k.isSyncedAi&&by&&by.human&&window.WFOnline&&WFOnline.onAiHit)WFOnline.onAiHit(k);if(by&&by!==k){by.cheerT=.95;if(!(by.hyperT>0))by.hype=Math.min(1,by.hype+.14);if(by.human){say(by.pi,'GOT '+k.ch.name.toUpperCase()+'!',.85);if(window.WFV2)WFV2.voiceBark(by.ch,'cheer');}}",
        "hit_cheer",
    )

    old_lava_respawn = """function doLava(k){if(k.respawnT>0)return;k.falls=(k.falls||0)+1;k.respawnT=1.6;k.v.root.visible=false;k.driftDir=0;k.driftCharge=0;k.glide=false;k.v.glider.visible=false;const f=LV.fall;
  if(f==='lava'){burst(SMOKE,k.x,-.5,k.z,30,12,1.4,5,.3,.3,.3,-4,6);burst(FX,k.x,-.5,k.z,60,22,.9,1.4,1,.5,.1,25,10);}
  else if(f==='snow'){burst(SMOKE,k.x,k.y,k.z,30,12,1.2,4,.9,.95,1,-2,6);}
  else if(f==='cloud'){burst(SMOKE,k.x,k.y,k.z,36,14,1.5,6,1,.85,.85,-3,4);}
  else{burst(SMOKE,k.x,k.y,k.z,24,10,1,3,.6,.6,.7,-2,5);burst(FX,k.x,k.y,k.z,30,18,.6,1,.6,.8,1,20,6);}
  k.fallIdx=k.idx;if(k.human){SFX.splash();say(k.pi,LV.fallMsg,1.2);cams[k.pi].shake=.5;}if(G.death&&!k.out){k.invT=0;popBalloon(k,null);}}
function respawnIdx(k){let i=k.fallIdx!=null?k.fallIdx:k.idx;let n=0;while(GAP[i]&&n<N){i=wrapI(i+1);n++;}if(n)return wrapI(i+Math.round(12/SP));return i;}
function respawn(k){k.slide=null;k.slideL=null;k.boat=false;const i=respawnIdx(k);k.fallIdx=null;k.idx=i;k.x=TP[i].x;k.z=TP[i].z;k.y=H[i]+6;k.vy=0;k.onGround=false;k.heading=k.moveAng=TA[i];k.speed=20;k.v.root.visible=true;k.spinT=0;k.rampAir=false;k.trickDone=false;k.hopping=false;k.cut=null;k.cannon=null;featRespawn(k,i);}"""

    new_lava_respawn = """function doLava(k){if(k.respawnT>0)return;clearTrailMesh(k);k.falls=(k.falls||0)+1;k.rescueDur=1.45;k.respawnT=k.rescueDur;k.driftDir=0;k.driftCharge=0;k.driftSlip=0;k.glide=false;k.v.glider.visible=false;const f=LV.fall;
  if(f==='lava'){burst(SMOKE,k.x,-.5,k.z,30,12,1.4,5,.3,.3,.3,-4,6);burst(FX,k.x,-.5,k.z,60,22,.9,1.4,1,.5,.1,25,10);}
  else if(f==='snow'){burst(SMOKE,k.x,k.y,k.z,30,12,1.2,4,.9,.95,1,-2,6);}
  else if(f==='cloud'){burst(SMOKE,k.x,k.y,k.z,36,14,1.5,6,1,.85,.85,-3,4);}
  else{burst(SMOKE,k.x,k.y,k.z,24,10,1,3,.6,.6,.7,-2,5);burst(FX,k.x,k.y,k.z,30,18,.6,1,.6,.8,1,20,6);}
  k.fallIdx=k.idx;const ri=respawnIdx(k);k.rescueFrom={x:k.x,y:Math.max(k.y,H[ri]-8),z:k.z};k.rescueTo=ri;k.rescueTap=false;
  k.v.root.visible=true;attachRescueDrone(k);
  if(k.human){SFX.splash();say(k.pi,LV.fallMsg,1.2);cams[k.pi].shake=.5;}if(G.death&&!k.out){k.invT=0;popBalloon(k,null);}}
function respawnIdx(k){let i=k.fallIdx!=null?k.fallIdx:k.idx;let n=0;while(GAP[i]&&n<N){i=wrapI(i+1);n++;}if(n)return wrapI(i+Math.round(12/SP));return i;}
function respawn(k){k.slide=null;k.slideL=null;k.boat=false;const i=k.rescueTo!=null?k.rescueTo:respawnIdx(k);k.fallIdx=null;k.rescueFrom=null;k.rescueTo=null;if(k.droneM)k.droneM.visible=false;
  k.idx=i;k.x=TP[i].x;k.z=TP[i].z;k.y=groundAt(i,0,0)+1.2;k.vy=0;k.onGround=false;k.heading=k.moveAng=TA[i];k.speed=k.rescueTap?36:22;
  if(k.rescueTap){k.boostT=Math.max(k.boostT,.85);if(k.human){SFX.boost();say(k.pi,'RESCUE BOOST!',.9);}}
  k.v.root.visible=true;k.spinT=0;k.rampAir=false;k.trickDone=false;k.hopping=false;k.cut=null;k.cannon=null;k.skidL=k.skidR=null;featRespawn(k,i);}"""
    html = must_replace(html, old_lava_respawn, new_lava_respawn, "rescue_drone_respawn")

    old_update_kart_top = """  if(k.respawnT>0){k.respawnT-=dt;if(k.respawnT<=0)respawn(k);k.prev=inp;return;}"""
    new_update_kart_top = """  if(k.respawnT>0){if(!k.out&&k.rescueFrom&&k.rescueTo!=null){if(pressed('gas')&&k.respawnT<.32)k.rescueTap=true;updateRescueArc(k,dt);}k.respawnT-=dt;if(k.respawnT<=0&&!k.out)respawn(k);k.prev=inp;return;}
  if(k.isRemote||k.isRemoteHuman||k.isSyncedAi){k.prev=inp;return;}"""
    html = must_replace(html, old_update_kart_top, new_update_kart_top, "update_kart_rescue_remote")

    old_phone_connect = """const PHONE_PORT=8777;const PL={ws:null,url:'',up:false,retry:0,lastStat:0};
function phoneMsg(m){if(PL.ws&&PL.ws.readyState===1)PL.ws.send(JSON.stringify(m));}
function phoneTo(id,m){phoneMsg({t:'to',id:id.replace(/^ph/,''),m});}
function phoneConnect(){if(PL.ws||location.protocol==='https:')return;let ws;try{ws=new WebSocket('ws://127.0.0.1:'+PHONE_PORT+'/ws?role=game');}catch(e){return;}PL.ws=ws;
  ws.onopen=()=>{PL.up=true;partyRefresh();};
  ws.onclose=()=>{PL.ws=null;PL.up=false;for(const ph of PHONES.values())ph.on=false;partyRefresh();setTimeout(phoneConnect,4000);};
  ws.onerror=()=>{};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(x){return;}
    if(m.t==='hello'){PL.url=m.url;partyRefresh();}
    else if(m.t==='join'){const id='ph'+m.id;let ph=PHONES.get(id);if(!ph){ph={id,name:m.name||'Phone',on:true,pad:{phone:true,id,index:-1,connected:true,auto:true,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]}};PHONES.set(id,ph);}
      ph.on=true;ph.name=m.name||ph.name;if(G.state==='party')partyJoin({kind:'pad',id,label:'Phone: '+ph.name});partyRefresh();phoneSync(id);updatePadInfo&&updatePadInfo();}
    else if(m.t==='leave'){const ph=PHONES.get('ph'+m.id);if(ph){ph.on=false;for(const b of ph.pad.buttons){b.pressed=false;b.value=0;}ph.pad.axes[0]=0;}if(G.state==='party')partyLeave('ph'+m.id);partyRefresh();}
    else if(m.t==='in'){const ph=PHONES.get('ph'+m.id);if(!ph)return;const P=ph.pad;for(let i=0;i<17;i++){const on=!!(m.b&(1<<i));P.buttons[i].pressed=on;P.buttons[i].value=on?1:0;}P.axes[0]=clamp(+m.x||0,-1,1);P.auto=m.auto!==0;}};}"""
    new_phone_connect = """const PHONE_PORT=8777;const PAD_VERSION=2;/* bump when pad.html changes, so cached copies on phones/CDNs don't linger */
const PL={ws:null,peer:null,url:'',up:false,mode:'lan',retry:0,lastStat:0};
function phoneMsg(m){if(PL.ws&&PL.ws.readyState===1)PL.ws.send(JSON.stringify(m));}
function phoneTo(id,m){const ph=PHONES.get(id);if(ph&&ph.conn&&ph.conn.open){ph.conn.send(m);return;}phoneMsg({t:'to',id:id.replace(/^ph/,''),m});}
function phonePadJoin(id,name,conn){let ph=PHONES.get(id);if(!ph){ph={id,name:name||'Phone',on:true,conn:conn||null,pad:{phone:true,id,index:-1,connected:true,auto:true,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]}};PHONES.set(id,ph);}
  ph.on=true;ph.name=name||ph.name;if(conn)ph.conn=conn;if(G.state==='party')partyJoin({kind:'pad',id,label:'Phone: '+ph.name});partyRefresh();phoneSync(id);updatePadInfo&&updatePadInfo();}
function phonePadLeave(id){const ph=PHONES.get(id);if(ph){ph.on=false;ph.conn=null;for(const b of ph.pad.buttons){b.pressed=false;b.value=0;}ph.pad.axes[0]=0;}if(G.state==='party')partyLeave(id);partyRefresh();}
function phonePadInput(id,m){const ph=PHONES.get(id);if(!ph)return;const P=ph.pad;for(let i=0;i<17;i++){const on=!!(m.b&(1<<i));P.buttons[i].pressed=on;P.buttons[i].value=on?1:0;}P.axes[0]=clamp(+m.x||0,-1,1);P.auto=m.auto!==0;}
function loadPhonePeerJs(){if(window.Peer)return Promise.resolve(window.Peer);return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';s.onload=()=>resolve(window.Peer);s.onerror=()=>{const s2=document.createElement('script');s2.src='https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';s2.onload=()=>resolve(window.Peer);s2.onerror=()=>reject(new Error('offline'));document.head.appendChild(s2);};document.head.appendChild(s);});}
function phonePadCode(){const L='ABCDEFGHJKLMNPQRSTUVWXYZ',A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let o='';for(let i=0;i<4;i++)o+=L[Math.floor(Math.random()*L.length)];for(let i=0;i<2;i++)o+=A[Math.floor(Math.random()*A.length)];return o;}
async function startPhonePadHost(){PL.mode='p2p';PL.up=false;
  let PeerCtor;try{PeerCtor=await loadPhonePeerJs();}catch(e){setTimeout(startPhonePadHost,8000);return;}
  const code=phonePadCode();let peer;try{peer=new PeerCtor('wfpad-'+code);}catch(e){setTimeout(startPhonePadHost,8000);return;}
  PL.peer=peer;let nextId=1;
  peer.on('open',()=>{PL.up=true;const base=location.pathname.endsWith('/')?location.pathname:location.pathname+'/';PL.url=location.origin+base+'pad.html?v='+PAD_VERSION+'&room='+code;partyRefresh();});
  peer.on('connection',(conn)=>{const id='ph'+(nextId++);
    conn.on('data',(m)=>{if(!m||typeof m!=='object')return;
      if(m.t==='join'){phonePadJoin(id,m.name,conn);}
      else if(m.t==='name'){const ph=PHONES.get(id);if(ph)ph.name=m.name||ph.name;}
      else if(m.t==='in')phonePadInput(id,m);});
    conn.on('close',()=>phonePadLeave(id));
    conn.on('error',()=>phonePadLeave(id));});
  peer.on('error',()=>{PL.up=false;PL.peer=null;partyRefresh();setTimeout(startPhonePadHost,6000);});
  peer.on('disconnected',()=>{PL.up=false;partyRefresh();});}
function phoneConnect(){if(PL.ws||PL.peer)return;
  if(location.protocol==='https:'){startPhonePadHost();return;}
  let ws;try{const phUrl=location.protocol==='http:'&&location.host?'ws://'+location.host+'/ws?role=game':'ws://127.0.0.1:'+PHONE_PORT+'/ws?role=game';ws=new WebSocket(phUrl);}catch(e){return;}PL.ws=ws;PL.mode='lan';
  ws.onopen=()=>{PL.up=true;partyRefresh();};
  ws.onclose=()=>{PL.ws=null;PL.up=false;for(const ph of PHONES.values())ph.on=false;partyRefresh();setTimeout(phoneConnect,4000);};
  ws.onerror=()=>{};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(x){return;}
    if(m.t==='hello'){PL.url=m.url;partyRefresh();}
    else if(m.t==='join'){phonePadJoin('ph'+m.id,m.name);}
    else if(m.t==='leave'){phonePadLeave('ph'+m.id);}
    else if(m.t==='in'){phonePadInput('ph'+m.id,m);}};}"""
    html = must_replace(html, old_phone_connect, new_phone_connect, "phone_ws_host")

    old_party_hint = """  if(PL.up&&PL.url){$('#joinUrl').textContent=PL.url.replace(/^http:\\/\\//,'');$('#joinHint').textContent='Same Wi-Fi as this laptop. Point the phone camera at the code.';if($('#qr').dataset.u!==PL.url){$('#qr').dataset.u=PL.url;$('#qr').textContent='…';qrSVG(PL.url,svg=>{$('#qr').innerHTML=svg;});}}"""
    new_party_hint = """  if(PL.up&&PL.url){$('#joinUrl').textContent=PL.url.replace(/^https?:\\/\\//,'');$('#joinHint').textContent=PL.mode==='p2p'?'Scan from anywhere \\u2014 the phone just needs internet.':'Same Wi-Fi as this laptop. Point the phone camera at the code.';if($('#qr').dataset.u!==PL.url){$('#qr').dataset.u=PL.url;$('#qr').textContent='…';qrSVG(PL.url,svg=>{$('#qr').innerHTML=svg;});}}"""
    html = must_replace(html, old_party_hint, new_party_hint, "party_hint_p2p")

    old_items_hype = """  let steer=inp.steer,gas=inp.gas,brake=inp.brake;
  if(k.sunT>0){k.stinkT=0;k.paintT=0;k.rainT=0;if(!G.battle&&k.onGround&&k.speed>5){const edge=Math.abs(k.lat||0)-(ROAD-4);if(edge>0){const li=wrapI(k.idx+15),want=Math.atan2(TP[li].x-k.x,TP[li].z-k.z),d=adiff(k.heading,want),w=Math.min(.85,edge*.3);steer=clamp(steer*(1-w)+clamp(-d*2.4,-1,1)*w,-1,1);}}}
  if(k.stinkT>0){k.stinkT-=dt;steer=clamp(steer+Math.sin(G.time*6.5+k.seed)*.6,-1,1);}
  if(!k.human&&k.paintT>0)steer=clamp(steer+Math.sin(G.time*5+k.seed)*.35,-1,1);
  if(k.rainT>0)k.rainT-=dt;
  if(k.spinT>0){k.spinT-=dt;steer=0;gas=0;brake=0;}
  if(k.stallT>0){k.stallT-=dt;gas=0;}
  let dive=0;if(k.glide&&!k.onGround){dive=brake;brake=0;}
  if(k.finished&&k.human){} // autopilot supplies inputs
  // items / hype
  if(pressed('item')&&LR.fire&&LR.fire(k)){}
  else if(pressed('item')&&k.spinT<=0&&(k.goldT>0||k.fireT>0))powerPress(k);
  else if(pressed('item')&&k.item&&k.spinT<=0&&(k.rollT<=0||k.rollSlot===2))useItem(k);
  if(!k.item&&k.item2){k.item=k.item2;k.itemN=k.item2N;k.item2=null;k.item2N=0;}
  if(pressed('swap')&&k.item&&k.item2&&k.rollT<=0){[k.item,k.item2]=[k.item2,k.item];[k.itemN,k.item2N]=[k.item2N,k.itemN];if(k.human){SFX.menu();say(k.pi,'SWAPPED: '+ITEMS[k.item].name.toUpperCase(),.7);}}
  if(pressed('hype')&&k.hype>=1&&k.spinT<=0){k.hyperT=5.5;k.hypeMode=true;k.hype=0;if(k.human){SFX.hype();say(k.pi,'HYPER MODE!',1.2);cams[k.pi].shake=.4;}}"""

    new_items_hype = """  k.lookBack=!!inp.look;
  let steer=inp.steer,gas=inp.gas,brake=inp.brake;
  if(k.sunT>0){k.stinkT=0;k.paintT=0;k.rainT=0;if(!G.battle&&k.onGround&&k.speed>5){const edge=Math.abs(k.lat||0)-(ROAD-4);if(edge>0){const li=wrapI(k.idx+15),want=Math.atan2(TP[li].x-k.x,TP[li].z-k.z),d=adiff(k.heading,want),w=Math.min(.85,edge*.3);steer=clamp(steer*(1-w)+clamp(-d*2.4,-1,1)*w,-1,1);}}}
  // mobile-only steering assist: touch steering has no fine control, so nudge the kart back toward the
  // centreline once it's within 5 units of the edge (vs. the sunshine power-up's 4, since this runs always
  // rather than for a few seconds), topping out at a 50% blend rather than the sunshine item's 85% so it's
  // a safety net, not an autopilot -- the player's own steering still dominates.
  else if(touch.on&&k.human&&!G.battle&&k.onGround&&k.speed>5){const edge=Math.abs(k.lat||0)-(ROAD-5);if(edge>0){const li=wrapI(k.idx+15),want=Math.atan2(TP[li].x-k.x,TP[li].z-k.z),d=adiff(k.heading,want),w=Math.min(.5,edge*.18);steer=clamp(steer*(1-w)+clamp(-d*2.4,-1,1)*w,-1,1);}}
  if(k.stinkT>0){k.stinkT-=dt;steer=clamp(steer+Math.sin(G.time*6.5+k.seed)*.6,-1,1);}
  if(!k.human&&k.paintT>0)steer=clamp(steer+Math.sin(G.time*5+k.seed)*.35,-1,1);
  if(k.rainT>0)k.rainT-=dt;
  if(k.spinT>0){k.spinT-=dt;steer=0;gas=0;brake=0;if(k.trailItem)clearTrailMesh(k);}
  if(k.stallT>0){k.stallT-=dt;gas=0;}
  let dive=0;if(k.glide&&!k.onGround){dive=brake;brake=0;}
  const aimDir=inp.aimF?1:(inp.aimB||inp.look)?-1:0;
  if(k.trailItem&&!inp.item&&k.spinT<=0)releaseTrailItem(k,aimDir);
  else if(pressed('item')&&LR.fire&&LR.fire(k)){}
  else if(pressed('item')&&k.spinT<=0&&(k.goldT>0||k.fireT>0))powerPress(k,aimDir);
  else if(pressed('item')&&k.item&&k.spinT<=0&&(k.rollT<=0||k.rollSlot===2)){
    if(k.human)localBuzz(14);
    if(k.human&&!G.auto&&TRAILABLE.has(k.item)&&aimDir===0)startTrailItem(k);
    else useItemDir(k,aimDir);
  }
  if(!k.item&&k.item2){k.item=k.item2;k.itemN=k.item2N;k.item2=null;k.item2N=0;}
  if(pressed('swap')&&k.item&&k.item2&&k.rollT<=0){[k.item,k.item2]=[k.item2,k.item];[k.itemN,k.item2N]=[k.item2N,k.itemN];if(k.human){SFX.menu();say(k.pi,'SWAPPED: '+ITEMS[k.item].name.toUpperCase(),.7);}}
  if(pressed('hype')&&k.hype>=1&&k.spinT<=0&&!specialActive(k)){fireSignatureHype(k);}"""
    html = must_replace(html, old_items_hype, new_items_hype, "items_trailing_hype")

    html = must_replace(
        html,
        """  if(k.offroad&&!fast&&k.onGround&&!k.ch.fly)maxS*=.52;
  if(k.boostT>0)maxS*=1.34;if(k.hyperT>0)maxS*=1.2;
  if(k.spinT>0)k.speed=toward(k.speed,0,50*dt);
  else if(fast&&(gas||k.boostT>0))k.speed=toward(k.speed,maxS,95*dt);
  else if(gas&&!brake){if(k.speed<maxS)k.speed+=(SURF[k.idx]===2&&k.onGround&&!(k.sunT>0)?.65:1)*(k.sunT>0?1.3:1)*k.acc*(1-.55*clamp(k.speed/maxS,0,1))*dt*(k.speed<0?2.5:1);else k.speed=toward(k.speed,maxS,45*dt);}
  else if(brake){k.speed=k.speed>0?k.speed-58*dt:Math.max(-15,k.speed-20*dt);}""",
        """  if(k.offroad&&!fast&&k.onGround&&!k.ch.fly)maxS*=(k.offroadMult||.52);
  if(k.boostT>0)maxS*=1.34;if(k.hyperT>0)maxS*=1.2;
  k.brakeDrifting=false;
  if(k.spinT>0)k.speed=toward(k.speed,0,50*dt);
  else if(k.driftDir!==0&&brake&&k.speed>15){k.brakeDrifting=true;k.speed=toward(k.speed,maxS*.72,38*dt);if(R()<.75)FX.emit(k.x,k.y+.35,k.z,rr(-4,4),rr(2,6),rr(-4,4),.22,.55,.25,.88,1,1,18,1);}
  else if(fast&&(gas||k.boostT>0))k.speed=toward(k.speed,maxS,95*dt);
  else if(gas&&!brake){if(k.speed<maxS)k.speed+=(SURF[k.idx]===2&&k.onGround&&!(k.sunT>0)?.65:1)*(k.sunT>0?1.3:1)*k.acc*(1-.55*clamp(k.speed/maxS,0,1))*dt*(k.speed<0?2.5:1);else k.speed=toward(k.speed,maxS,45*dt);}
  else if(brake){k.speed=k.speed>0?k.speed-58*dt:Math.max(-15,k.speed-20*dt);}""",
        "offroad_and_brakedrift",
    )

    old_drift_and_walls = """  // hop / drift / trick
  if(pressed('drift')){
    if(k.rampAir&&!k.trickDone&&k.spinT<=0){k.trickDone=true;k.trickT=.55;if(k.human)SFX.hop();}
    else if(k.onGround&&k.speed>12&&k.spinT<=0){k.vy=k.truckT>0?13:8.5;k.onGround=false;k.hopping=true;if(k.human)SFX.hop();if(Math.abs(steer)>.12)k.driftDir=Math.sign(steer);}
  }
  if(inp.drift&&k.hopping&&k.driftDir===0&&Math.abs(steer)>.12)k.driftDir=Math.sign(steer);
  if(k.driftDir!==0){if(!inp.drift||k.speed<11||k.spinT>0)releaseDrift(k);
    else{const s=clamp(steer*k.driftDir,-1,1);if(k.onGround)k.driftCharge+=dt*(.75+.75*Math.max(0,s))*(SURF[k.idx]===1?1.4:SURF[k.idx]===2?1.2:1);
      const lv=k.driftCharge>3?3:k.driftCharge>1.9?2:k.driftCharge>.9?1:0;if(lv>k.lastLevel){k.lastLevel=lv;if(k.human)SFX.spark(lv);}}}
  // steering
  const sp=Math.abs(k.speed),grip0=clamp(sp/16,0,1);let yaw;
  if(k.driftDir!==0){const s=clamp(steer*k.driftDir,-1,1);yaw=-k.driftDir*(.78+.55*s)*k.hand*grip0;}
  else yaw=-steer*2.1*k.hand*grip0*(1.12-.32*clamp(sp/k.maxS,0,1.3))*(k.speed<0?-1:1);
  if(!k.onGround&&!k.hopping)yaw*=k.glide?.8:.35;
  const surf=k.sunT>0||k.ch.fly?0:k.onGround?(k.rainT>0&&SURF[k.idx]===0?1:SURF[k.idx]===3?1:SURF[k.idx]):0;if(surf===2)yaw*=.82;
  if(k.spinT>0)yaw=0;
  k.heading+=yaw*dt;
  const grip=k.driftDir?(surf===2?1.3:surf===1?1.6:2.4):(k.onGround?(surf===2?2.1:surf===1?5.5:9):(k.glide?3.5:1.2));
  k.moveAng+=adiff(k.moveAng,k.heading)*Math.min(1,grip*dt);
  if(k.speed<0)k.moveAng=k.heading;
  k.x+=Math.sin(k.moveAng)*k.speed*dt;k.z+=Math.cos(k.moveAng)*k.speed*dt;
  if(WIND[k.idx]&&LR.gust){const w=WIND[k.idx]*LR.gust(G.time)*(k.onGround?10:17)*dt;k.x+=TR[k.idx].x*w;k.z+=TR[k.idx].z*w;if(k.human&&k.windMsg<=0&&k.onGround){k.windMsg=6;say(k.pi,WIND[k.idx]>0?'CROSSWIND →':'← CROSSWIND',1);SFX.wind();}}
  k.windMsg-=dt;
  if(G.battle)arenaPhys(k,dt);else if(k.cut&&featCutPhys(k,dt,dive)){}else{
  updateIdx(k);
  const i=k.idx,P=TP[i],Rv=TR[i],T=TT[i];
  const dx=k.x-P.x,dz=k.z-P.z,along=dx*T.x+dz*T.z;let lat=dx*Rv.x+dz*Rv.z;
  k.lat=lat;const lw=LW[i],lim=LIM*lw;k.offroad=Math.abs(lat)>(ROAD+CURB)*lw&&!featHPH(i,lat);
  // walls
  const flying=k.glide&&!k.onGround;
  const gate=FT.cuts.length>0&&Math.abs(lat)>WALL-3.5&&featGate(k,i,lat);
  if(Math.abs(lat)>lim&&!flying&&!gate){const s=Math.sign(lat),push=(Math.abs(lat)-lim)*s;k.x-=Rv.x*push;k.z-=Rv.z*push;
    let vx=Math.sin(k.moveAng)*k.speed,vz=Math.cos(k.moveAng)*k.speed;const vl=vx*Rv.x+vz*Rv.z;
    if(vl*s>0){vx-=Rv.x*vl*1.5;vz-=Rv.z*vl*1.5;const ns=Math.hypot(vx,vz)*.9;k.moveAng=k.heading+adiff(k.heading,Math.atan2(vx,vz));if(k.speed>0)k.speed=ns;k.heading+=adiff(k.heading,k.moveAng)*.5;
      const pipe=k.onGround&&(s<0?HPL[i]:HPR[i])>2;if(pipe&&Math.abs(vl)>7)featPipeAir(k,Math.abs(vl));
      else if(Math.abs(vl)>10){if(k.driftDir)releaseDrift(k);if(k.human&&k.bumpCD<=0){SFX.bump();cams[k.pi].shake=Math.min(.35,Math.abs(vl)/60);k.bumpCD=.3;}
        for(let n=0;n<6;n++)FX.emit(k.x+Rv.x*s*1.5,k.y+1,k.z+Rv.z*s*1.5,rr(-5,5),rr(3,9),rr(-5,5),.4,.7,1,.85,.4,1,20);}}
    lat=lim*s;}
  lat=featDivider(k,i,lat);k.lat=lat;
  // vertical
  const gH=groundAt(i,along)+featHPH(i,lat);const offC=Math.abs(lat)>WALL+1;const inGap=(GAP[i]===1&&!k.ch.fly)||offC;const ground=inGap?-200:gH;
  if(inGap&&k.y<gH-(offC?6:2.8))doLava(k);
  if(!inGap&&k.y<gH-1.4&&!k.onGround&&!featHPH(i,lat))doLava(k);
  if(k.respawnT>0){k.prev=inp;return;}
  if(k.onGround&&LIPG[i]>=0&&k.speed>6){const g=GAPS[LIPG[i]];k.onGround=false;k.rampAir=true;k.trickDone=false;k.hopping=false;if(k.driftDir)releaseDrift(k);
    if(g.glide){k.glide=true;k.vy=k.speed*.2+6;k.v.glider.visible=true;k.v.glider.scale.setScalar(.05);k.aiCut=!k.human&&k.speed>55&&R()<.35*k.skill+(k.boostT>0?.25:0);if(k.human){SFX.glide();say(k.pi,'GLIDER!',.9);}}
    else k.vy=k.speed*.36+2.5;}
  if(k.onGround&&KICKG[i]>=0&&k.speed>6)featKick(k,i);
  if(k.onGround){if(gH<k.y-.9){k.onGround=false;k.vy=0;}else{k.y=gH;k.vy=0;}}
  if(!k.onGround){if(k.glide){k.vy-=GRAV*(LR.gravAt?LR.gravAt(k.idx):(LV.grav||1))*(dive?1:.3)*dt;const sink=dive?24:7.5+Math.max(0,64-k.speed)*.32;if(k.vy<-sink)k.vy=toward(k.vy,-sink,40*dt);}else k.vy-=GRAV*(LR.gravAt?LR.gravAt(k.idx):(LV.grav||1))*dt;k.y+=k.vy*dt;k.airT+=dt;
    if(k.y<=ground){const impact=-k.vy;k.y=ground;k.vy=0;k.onGround=true;
      if(k.rampAir){k.rampAir=false;if(k.trickDone){k.boostT=Math.max(k.boostT,1.15);k.hype=Math.min(1,k.hype+.2);if(k.human){SFX.boost();say(k.pi,'TRICK BOOST!',.9);}}k.trickDone=false;}
      if(impact>18){burst(SMOKE,k.x,k.y+.3,k.z,10,8,.6,2.4,.85,.8,.7,0,1);if(k.human){cams[k.pi].shake=Math.min(.4,impact/70);SFX.bump();}}
      k.hopping=false;k.airT=0;if(k.glide){k.glide=false;k.aiCut=false;}}}"""

    new_drift_and_walls = """  // hop / drift / trick (Mario Kart slip-angle + Inside-Drift + 200cc Brake-Drift!)
  if(pressed('drift')){
    if(k.rampAir&&!k.trickDone&&k.spinT<=0){k.trickDone=true;k.trickT=.55;k.cheerT=.85;if(k.human){SFX.hop();if(window.WFV2)WFV2.voiceBark(k.ch,'cheer');}}
    else if(k.onGround&&k.speed>12&&k.spinT<=0){k.vy=k.truckT>0?13:8.2;k.suspV=7.5;k.squash=.82;k.onGround=false;k.hopping=true;if(k.human)SFX.hop();if(Math.abs(steer)>.12)k.driftDir=Math.sign(steer);}
  }
  if(inp.drift&&k.hopping&&k.driftDir===0&&Math.abs(steer)>.12)k.driftDir=Math.sign(steer);
  let driftS=0;
  if(k.driftDir!==0){if(!inp.drift||k.speed<11||k.spinT>0)releaseDrift(k);
    else{driftS=clamp(steer*k.driftDir,-1,1);
      const surfMult=(SURF[k.idx]===1?1.4:SURF[k.idx]===2?1.2:1)*(k.sparkRate||1);
      if(k.onGround)k.driftCharge+=dt*(.55+1.15*Math.max(0,driftS+.35))*surfMult;
      const lv=k.driftCharge>3?3:k.driftCharge>1.9?2:k.driftCharge>.9?1:0;if(lv>k.lastLevel){k.lastLevel=lv;if(k.human){SFX.spark(lv);if(lv===1)say(k.pi,'MINI-TURBO READY',.6);else if(lv===2)say(k.pi,'SUPER TURBO READY',.65);else say(k.pi,'ULTRA PURPLE READY!',.75);}}}}
  const wantSlip=k.driftDir?k.driftDir*(k.insideDrift?.12:(.28+.15*Math.max(0,driftS))):0;
  k.driftSlip=lerp(k.driftSlip||0,wantSlip,Math.min(1,dt*10));
  const sp=Math.abs(k.speed),grip0=clamp(sp/16,0,1);let yaw;
  if(k.driftDir!==0){yaw=-k.driftDir*(.68+.62*driftS)*(k.brakeDrifting?1.38:1)*(k.insideDrift?1.14:1)*k.hand*grip0;}
  else yaw=-steer*2.1*k.hand*grip0*(1.12-.32*clamp(sp/k.maxS,0,1.3))*(k.speed<0?-1:1);
  if(!k.onGround&&!k.hopping)yaw*=k.glide?.8*(k.airTurnMult||1):.38;
  const surf=k.sunT>0||k.ch.fly?0:k.onGround?(k.rainT>0&&SURF[k.idx]===0?1:SURF[k.idx]===3?1:SURF[k.idx]):0;if(surf===2)yaw*=.82;
  if(k.spinT>0)yaw=0;
  k.heading+=yaw*dt;
  const grip=(k.driftDir?(surf===2?1.6:surf===1?2.0:3.2)*(k.insideDrift?1.45:1)*(k.antiGrav?1.25:1):(k.onGround?(surf===2?2.1:surf===1?5.5:9.5)*(k.antiGrav?1.2:1):(k.glide?3.5:1.2)));
  k.moveAng+=adiff(k.moveAng,k.heading)*Math.min(1,grip*dt);
  if(k.speed<0)k.moveAng=k.heading;
  k.x+=Math.sin(k.moveAng)*k.speed*dt;k.z+=Math.cos(k.moveAng)*k.speed*dt;
  if(WIND[k.idx]&&LR.gust){const w=WIND[k.idx]*LR.gust(G.time)*(k.onGround?10:17)*dt;k.x+=TR[k.idx].x*w;k.z+=TR[k.idx].z*w;if(k.human&&k.windMsg<=0&&k.onGround){k.windMsg=6;say(k.pi,WIND[k.idx]>0?'CROSSWIND →':'← CROSSWIND',1);SFX.wind();}}
  k.windMsg-=dt;
  if(G.battle)arenaPhys(k,dt);else if(k.cut&&featCutPhys(k,dt,dive)){}else{
  updateIdx(k);
  const i=k.idx,P=TP[i],Rv=TR[i],T=TT[i];
  const dx=k.x-P.x,dz=k.z-P.z,along=dx*T.x+dz*T.z;let lat=dx*Rv.x+dz*Rv.z;
  k.lat=lat;const lw=LW[i],lim=LIM*lw,unF=UNFENCED[i]===1;k.offroad=Math.abs(lat)>(ROAD+CURB)*lw&&!featHPH(i,lat);
  const flying=k.glide&&!k.onGround;
  const gate=FT.cuts.length>0&&Math.abs(lat)>WALL-3.5&&featGate(k,i,lat);
  if(!unF&&Math.abs(lat)>lim&&!flying&&!gate){const s=Math.sign(lat),push=(Math.abs(lat)-lim)*s;k.x-=Rv.x*push;k.z-=Rv.z*push;
    let vx=Math.sin(k.moveAng)*k.speed,vz=Math.cos(k.moveAng)*k.speed;const vl=vx*Rv.x+vz*Rv.z;
    if(vl*s>0){vx-=Rv.x*vl*1.5;vz-=Rv.z*vl*1.5;const ns=Math.hypot(vx,vz)*.9;k.moveAng=k.heading+adiff(k.heading,Math.atan2(vx,vz));if(k.speed>0)k.speed=ns;k.heading+=adiff(k.heading,k.moveAng)*.5;
      const pipe=k.onGround&&(s<0?HPL[i]:HPR[i])>2;if(pipe&&Math.abs(vl)>7)featPipeAir(k,Math.abs(vl));
      else if(Math.abs(vl)>10){if(k.driftDir)releaseDrift(k);if(k.human&&k.bumpCD<=0){SFX.bump();cams[k.pi].shake=Math.min(.35,Math.abs(vl)/60);k.bumpCD=.3;}
        for(let n=0;n<6;n++)FX.emit(k.x+Rv.x*s*1.5,k.y+1,k.z+Rv.z*s*1.5,rr(-5,5),rr(3,9),rr(-5,5),.4,.7,1,.85,.4,1,20);}}
    lat=lim*s;}
  lat=featDivider(k,i,lat);k.lat=lat;
  if(G.state==='race'&&!k.finished&&k.speed>6&&Math.cos(adiff(k.heading,TA[i]))<-.45){k.wrongT=(k.wrongT||0)+dt;}else k.wrongT=Math.max(0,(k.wrongT||0)-dt*3);
  const gH=groundAt(i,along,lat)+featHPH(i,lat);const offC=Math.abs(lat)>(unF?WALL*lw+.8:WALL+1);const inGap=(GAP[i]===1&&!k.ch.fly)||offC;const ground=inGap?-200:gH;
  if(inGap&&k.y<gH-(offC?1.8:2.8))doLava(k);
  if(!inGap&&k.y<gH-1.4&&!k.onGround&&!featHPH(i,lat))doLava(k);
  if(k.respawnT>0){k.prev=inp;return;}
  if(k.onGround&&LIPG[i]>=0&&k.speed>6){const g=GAPS[LIPG[i]];k.onGround=false;k.rampAir=true;k.trickDone=false;k.hopping=false;if(k.driftDir)releaseDrift(k);
    if(g.glide){k.glide=true;k.vy=k.speed*.2+6;k.v.glider.visible=true;k.v.glider.scale.setScalar(.05);k.aiCut=!k.human&&k.speed>55&&R()<.35*k.skill+(k.boostT>0?.25:0);if(k.human){SFX.glide();say(k.pi,'GLIDER!',.9);}}
    else k.vy=k.speed*.36+2.5;}
  /* Auto-glider: a kart that reaches a glide gap already airborne (crested the edge, hopped or drift-jumped off the lip) still gets its glider instead of dropping into the canyon. */
  if(!k.onGround&&!k.glide&&GAP[i]===1&&k.respawnT<=0&&!k.ch.fly){const g=GAPS.find(q=>q.glide&&wrapI(i-q.s)<=wrapI(q.e-q.s));if(g){k.glide=true;k.rampAir=true;k.vy=Math.max(k.vy,k.speed*.12+3);k.v.glider.visible=true;k.v.glider.scale.setScalar(.05);if(k.human){SFX.glide();say(k.pi,'GLIDER!',.9);}}}
  if(k.onGround&&KICKG[i]>=0&&k.speed>6)featKick(k,i);
  if(k.onGround){if(gH<k.y-.9){k.onGround=false;k.vy=0;}else{k.y=gH;k.vy=0;}}
  if(!k.onGround){if(k.glide){k.vy-=GRAV*(LR.gravAt?LR.gravAt(k.idx):(LV.grav||1))*(dive?1:.3*(k.glideSinkMult||1))*dt;const sink=(dive?24:7.5+Math.max(0,64-k.speed)*.32)*(k.glideSinkMult||1);if(k.vy<-sink)k.vy=toward(k.vy,-sink,40*dt);}else k.vy-=GRAV*(LR.gravAt?LR.gravAt(k.idx):(LV.grav||1))*(k.antiGrav?1.12:1)*dt;k.y+=k.vy*dt;k.airT+=dt;
    if(k.y<=ground){const impact=-k.vy;k.y=ground;k.vy=0;k.onGround=true;
      if(impact>4){k.suspV=-Math.min(13,impact*.45);k.squash=clamp(1-impact*.011,.75,1);}
      if(k.rampAir){k.rampAir=false;if(k.trickDone){k.boostT=Math.max(k.boostT,1.15*(k.trickBoostMult||1));k.hype=Math.min(1,k.hype+.2);k.cheerT=.9;if(k.human){SFX.boost();say(k.pi,'TRICK BOOST!',.9);}}k.trickDone=false;}
      if(impact>18){burst(SMOKE,k.x,k.y+.3,k.z,10,8,.6,2.4,.85,.8,.7,0,1);if(k.human){cams[k.pi].shake=Math.min(.4,impact/70);SFX.bump();}}
      k.hopping=false;k.airT=0;if(k.glide){k.glide=false;k.aiCut=false;}}}"""
    html = must_replace(html, old_drift_and_walls, new_drift_and_walls, "drift_and_walls")

    old_uk_end = """  if(k.trickT>0)k.trickT-=dt;
  k.steerVis=lerp(k.steerVis,steer,Math.min(1,dt*10));
  k.prev=inp;
}"""
    new_uk_end = """  if(k.trickT>0)k.trickT-=dt;
  if(k.cheerT>0)k.cheerT-=dt;
  k.suspV+=((-155*k.suspY)-(15*k.suspV))*dt;
  k.suspY=clamp(k.suspY+k.suspV*dt,-.5,.5);
  k.squash=lerp(k.squash||1,1,Math.min(1,dt*10));
  const wantWheelie=(k.boostT>0&&k.onGround&&!k.driftDir&&!k.boat&&!(k.flatT>0))?-.13:0;
  k.wheelie=lerp(k.wheelie||0,wantWheelie,Math.min(1,dt*10));
  k.steerVis=lerp(k.steerVis,steer,Math.min(1,dt*10));
  k.prev=inp;
}"""
    html = must_replace(html, old_uk_end, new_uk_end, "uk_suspension_wheelie")

    html = must_replace(
        html,
        "function featRoll(k){if(k.slide)return k.slide.roll;if(k.boat)return Math.sin(G.time*2.6+k.seed*3)*.07;if(!k.onGround||G.battle||k.cut)return 0;const sl=featHPslope(k.idx,k.lat||0);return sl?-Math.atan(sl)*.92:0;}",
        "function featRoll(k){if(k.slide)return k.slide.roll;if(k.boat)return Math.sin(G.time*2.6+k.seed*3)*.07;if(!k.onGround||G.battle||k.cut)return 0;const sl=featHPslope(k.idx,k.lat||0);return(sl?-Math.atan(sl)*.92:0)+(BANK[k.idx]||0);}",
        "feat_roll_bank",
    )

    old_ai_corner = """  lane=featAiLane(k,lane);{const lm=(k.inSplit?12:10)*LW[k.idx];lane=clamp(lane,-lm,lm);}
  if(k.inSplit)look=wrapI(k.idx+6+Math.floor(k.speed*.14)); // hold the lane through split-lane bends (pits!)
  let tx=TP[look].x+TR[look].x*lane,tz=TP[look].z+TR[look].z*lane;
  {const ft=featAiTarget(k);if(ft){tx=ft[0];tz=ft[1];}}
  let aiDive=0;if(k.glide&&!k.onGround&&k.aiCut&&LR.cutTo!=null){const c=LR.cutTo;tx=TP[c].x;tz=TP[c].z;const dh=Math.hypot(tx-k.x,tz-k.z),hy=k.y-H[c];if(dh<hy/14*Math.max(k.speed,30)+8)aiDive=1;}
  const want=Math.atan2(tx-k.x,tz-k.z);const d=adiff(k.heading,want);
  o.steer=clamp(-d*2.4,-1,1);
  if(k.inSplit&&Math.abs((k.lat||0)-lane)>2&&k.speed>k.maxS*.55){o.gas=0;if(Math.abs((k.lat||0)-lane)>3.5)o.brake=1;} // off its line next to the pits: ease off
  if(Math.abs(d)>.75&&k.speed>k.maxS*.7)o.gas=0;
  if(k.glide&&!k.onGround){o.gas=1;o.brake=aiDive;}
  if(LR.aiBrake){const b=LR.aiBrake(k);if(b){o.gas=0;if(b>1)o.brake=1;}}
  // corner boosts (AI equivalent of drifting)
  const cv=Math.abs(CURV[k.idx]);
  if(cv>.5&&!k.corner&&k.speed>30){k.corner=true;k.cornerT=0;}
  if(k.corner){k.cornerT+=dt;if(cv<.22){if(k.cornerT>.7&&R()<k.skill*.85){k.boostT=Math.max(k.boostT,k.cornerT>1.6?1:.6);}k.corner=false;}}"""

    new_ai_corner = """  lane=featAiLane(k,lane);{const uf=UNFENCED[k.idx]||UNFENCED[wrapI(k.idx+18)];const lm=(uf?7.5:k.inSplit?12:10)*LW[k.idx];lane=clamp(lane,-lm,lm);}
  if(k.inSplit)look=wrapI(k.idx+6+Math.floor(k.speed*.14));
  let tx=TP[look].x+TR[look].x*lane,tz=TP[look].z+TR[look].z*lane;
  {const ft=featAiTarget(k);if(ft){tx=ft[0];tz=ft[1];}}
  let aiDive=0;if(k.glide&&!k.onGround&&k.aiCut&&LR.cutTo!=null){const c=LR.cutTo;tx=TP[c].x;tz=TP[c].z;const dh=Math.hypot(tx-k.x,tz-k.z),hy=k.y-H[c];if(dh<hy/14*Math.max(k.speed,30)+8)aiDive=1;}
  const want=Math.atan2(tx-k.x,tz-k.z);const d=adiff(k.heading,want);
  o.steer=clamp(-d*2.4,-1,1);
  if(k.inSplit){const off=Math.abs((k.lat||0)-lane);const pitNear=FT.pits.some(p=>{const d=wrapI(p.a-k.idx);return d<Math.round(70/SP)||wrapI(k.idx-p.a)<=wrapI(p.b-p.a);});/* pits ahead: ease off and brake much earlier so boosted karts don't slide into them */if(pitNear)o.steer=clamp(o.steer+(lane-(k.lat||0))*.35,-1,1);/* steer back to the safe line harder; on boost pads braking alone can't stop the slide */if(pitNear?(off>1&&k.speed>k.maxS*.5):(off>2&&k.speed>k.maxS*.55)){o.gas=0;if(off>(pitNear?1.8:3.5))o.brake=1;}}
  if(Math.abs(d)>.75&&k.speed>k.maxS*.7)o.gas=0;
  if(k.glide&&!k.onGround){o.gas=1;o.brake=aiDive;}
  if(LR.aiBrake){const b=LR.aiBrake(k);if(b){k.hazWait=(k.hazWait||0)+(k.speed<3?dt:0);if(k.hazWait<2.5&&(b>1||k.speed>8)){o.gas=0;if(b>1&&k.speed>2)o.brake=1;}}else k.hazWait=0;}/* stop for hazards, never reverse (reversing AI got stuck behind the Aztec fire jets); after 2.5 s stopped, go anyway so it can't wait forever */
  const cvSigned=CURV[wrapI(k.idx+10)],cv=Math.abs(cvSigned);
  const safeDrift=!k.inSplit&&!UNFENCED[k.idx]&&!GAP[wrapI(k.idx+20)]&&Math.abs(k.lat||0)<ROAD*LW[k.idx]-2;
  if(k.driftDir===0){
    if(safeDrift&&cv>.44&&k.speed>30&&k.skill>.88&&Math.abs(o.steer)>.22){o.drift=1;}
  }else{
    if(!safeDrift||cv<.16||k.driftCharge>(k.skill>.98?3.05:2.05))o.drift=0;
    else o.drift=1;
  }"""
    html = must_replace(html, old_ai_corner, new_ai_corner, "ai_real_drifting")

    html = must_replace(
        html,
        "else{const s=A.weight>B.weight?B:A;",
        "else if((A.antiGrav||B.antiGrav)&&window.WFV2){WFV2.triggerSpinBoost(A);WFV2.triggerSpinBoost(B);}else{const s=A.weight>B.weight?B:A;",
        "antigrav_kart_spinboost",
    )
    html = must_replace(
        html,
        "c.t=12;c.m.visible=false;k.coins=Math.min(10,k.coins+1);if(k.human)SFX.coin();",
        "c.t=12;c.m.visible=false;k.coins=Math.min(10,k.coins+1);if(k.human){SFX.coin();if(window.WFV2)WFV2.VAULT.add(1);}",
        "coin_vault_pickup",
    )
    html = must_replace(
        html,
        "function giveCoins(k,n){k.coins=Math.min(10,k.coins+n);}",
        "function giveCoins(k,n){k.coins=Math.min(10,k.coins+n);if(k.human&&window.WFV2&&n>0)WFV2.VAULT.add(n);}",
        "give_coins_vault",
    )
    html = must_replace(
        html,
        "if(LR.hazard)LR.hazard(dt);if(!G.battle)featTick(dt);strikeTick(dt);projTick(dt);duckTick(dt);extraTick(dt);battleItemTick(dt);sunTick(dt);jumboTick(dt);",
        "if(LR.hazard)LR.hazard(dt);if(!G.battle)featTick(dt);strikeTick(dt);projTick(dt);duckTick(dt);extraTick(dt);battleItemTick(dt);sunTick(dt);jumboTick(dt);trailAndOrbitTick(dt);if(window.WFV2){WFV2.tickAntiGrav(dt);WFV2.tickTimeTrial(dt);}if(window.WFOnline&&WFOnline.isOnline())WFOnline.tick(dt);",
        "after_karts_trail_online",
    )

    old_kart_vis = """function updateKartVisual(k,dt){const v=k.v;v.root.position.set(k.x,k.y,k.z);
  const drift=k.driftDir?k.driftDir*.32:0;let yawExtra=drift;if(k.spinT>0)yawExtra+=((k.ch.fly?2.6:1.25)-k.spinT)*Math.PI*2.4;
  v.root.rotation.y=k.heading+yawExtra*-1;
  const i=k.idx;let pitch;if(G.battle){const hx=Math.sin(k.heading)*3,hz=Math.cos(k.heading)*3;pitch=-Math.atan2(AR.ground(k.x+hx,k.z+hz,k.y+1)-AR.ground(k.x-hx,k.z-hz,k.y+1),6);}else{const a=H[wrapI(i+3)],b=H[wrapI(i-3)];pitch=-Math.atan2(a-b,6*SP);}if(!k.onGround)pitch=k.glide?clamp(-k.vy*.02,-.15,.2)+.06:clamp(-k.vy*.012,-.35,.35);
  if(k.slide)pitch=k.slide.pitch;
  v.body.rotation.x=pitch;v.body.rotation.z=(k.driftDir?k.driftDir*.12:k.steerVis*.06)*Math.min(1,Math.abs(k.speed)/30)+featRoll(k);
  if(k.trickT>0)v.body.rotation.z+=(1-k.trickT/.55)*Math.PI*2;
  v.body.position.y=(k.hyperT>0?Math.sin(G.time*30)*.08:0)+(k.ch.fly?1.4+Math.sin(G.time*3+k.seed)*.25:0);if(v.rotor)v.rotor.rotation.y+=dt*(14+Math.abs(k.speed)*.4);if(k.ch.fly)for(const w of v.wheels)w.piv.rotation.z=w.piv.position.x>0?-1.2:1.2;
  for(const w of v.wheels){w.w.rotation.x+=k.speed*dt/.72;if(w.f)w.piv.rotation.y=-k.steerVis*.45;}
  v.shield.visible=k.shieldT>0;if(v.glider.visible){if(!k.glide)v.glider.visible=false;else{const s=Math.min(1,v.glider.scale.x+dt*5);v.glider.scale.setScalar(s);v.glider.rotation.z=-k.steerVis*.3;}}if(v.blob){v.blob.visible=!k.slide&&!k.slideL;const gyB=G.battle?AR.ground(k.x,k.z,k.y):H[k.idx];v.blob.position.y=(k.respawnT>0?-99:gyB+.08-k.y);const air=clamp((k.y-gyB)/12,0,1);v.blob.material.opacity=1;v.blob.scale.setScalar(1-air*.4);}v.head.rotation.y=-k.steerVis*.3;v.head.rotation.z=-k.steerVis*.08;if(k.shieldT>0)v.shield.rotation.y+=dt*1.5;"""

    new_kart_vis = """function updateKartVisual(k,dt){const v=k.v;v.root.position.set(k.x,k.y,k.z);
  const drift=k.driftSlip||0;let yawExtra=drift;if(k.spinT>0)yawExtra+=((k.ch.fly?2.6:1.25)-k.spinT)*Math.PI*2.4;
  v.root.rotation.y=k.heading+yawExtra*-1+(k.spinBoostT>0?(1-k.spinBoostT/.52)*Math.PI*2:0);
  const i=k.idx;let pitch;if(G.battle){const hx=Math.sin(k.heading)*3,hz=Math.cos(k.heading)*3;pitch=-Math.atan2(AR.ground(k.x+hx,k.z+hz,k.y+1)-AR.ground(k.x-hx,k.z-hz,k.y+1),6);}else{const a=H[wrapI(i+3)],b=H[wrapI(i-3)];pitch=-Math.atan2(a-b,6*SP);}if(!k.onGround)pitch=k.glide?clamp(-k.vy*.02,-.15,.2)+.06:clamp(-k.vy*.012,-.35,.35);
  if(k.slide)pitch=k.slide.pitch;
  v.body.rotation.x=pitch+(k.wheelie||0);
  const bodyRoll=(k.driftDir?k.driftDir*.18:k.steerVis*.09)*Math.min(1,Math.abs(k.speed)/26)+featRoll(k);
  v.body.rotation.z=bodyRoll;
  if(k.trickT>0)v.body.rotation.z+=(1-k.trickT/.55)*Math.PI*2;
  const sq=k.squash||1;if(!LV||LV.id!=='cookie'||!k.morph)v.body.scale.set(1/Math.sqrt(sq),sq,1/Math.sqrt(sq));
  v.body.position.y=(k.suspY||0)+(k.hyperT>0?Math.sin(G.time*30)*.08:0)+(k.ch.fly?1.4+Math.sin(G.time*3+k.seed)*.25:0);
  if(v.rotor)v.rotor.rotation.y+=dt*(14+Math.abs(k.speed)*.4);
  if(v.steerWheel)v.steerWheel.rotation.z=k.steerVis*.95;
  if(v.drvGroup){
    const lean=k.driftDir?k.driftDir*.32:k.steerVis*.2;
    v.drvGroup.rotation.z=lean;
    v.drvGroup.rotation.x=(k.boostT>0?-.14:0)+(k.spinT>0?Math.sin(G.time*26)*.22:0);
    v.drvGroup.position.y=1.25+(k.cheerT>0?Math.sin(Math.min(1,k.cheerT)*Math.PI)*.32:0);
    if(v.armL)v.armL.rotation.set(k.steerVis*.35,0,lean*.3);
    if(v.armR){if(k.cheerT>0)v.armR.rotation.set(-2.25,0,-.25+Math.sin(G.time*22)*.25);else v.armR.rotation.set(-k.steerVis*.35,0,lean*.3);}
  }
  if(k.ch.fly)for(const w of v.wheels)w.piv.rotation.z=w.piv.position.x>0?-1.2:1.2;
  for(const w of v.wheels){w.w.rotation.x+=k.speed*dt/.72;if(w.f)w.piv.rotation.y=-k.steerVis*.45;w.piv.position.y=w.y0-(k.suspY||0)*.55;}
  if(v.struts)for(const st of v.struts)st.st.rotation.z=(st.x>0?1:-1)*(k.suspY||0)*.22;
  v.shield.visible=k.shieldT>0;if(v.glider.visible){if(!k.glide)v.glider.visible=false;else{const s=Math.min(1,v.glider.scale.x+dt*5);v.glider.scale.setScalar(s);v.glider.rotation.z=-k.steerVis*.3;}}if(v.blob){v.blob.visible=!k.slide&&!k.slideL;const gyB=G.battle?AR.ground(k.x,k.z,k.y):groundAt(k.idx,0,k.lat||0);v.blob.position.y=(k.respawnT>0?-99:gyB+.08-k.y);const air=clamp((k.y-gyB)/12,0,1);v.blob.material.opacity=1;v.blob.scale.setScalar(1-air*.4);}
  let glance=0;if(k.spinT>0)glance=Math.sin(G.time*30)*.6;else if(k.lookBack)glance=Math.PI*.65;
  v.head.rotation.y=-k.steerVis*.32+glance;v.head.rotation.z=-k.steerVis*.08;if(k.shieldT>0)v.shield.rotation.y+=dt*1.5;
  if(typeof SKIDS!=='undefined')SKIDS.emitKart(k);
  if(window.WFV2)WFV2.RIBBONS.emitKart(k);"""
    html = must_replace(html, old_kart_vis, new_kart_vis, "kart_vis_rigged")

    html = must_replace(
        html,
        "const lvC=k.driftDir?(k.driftCharge>3?3:k.driftCharge>1.9?2:k.driftCharge>.9?1:0):(!k.human&&k.corner&&k.cornerT>.5?(k.cornerT>1.4?2:1):-1);",
        "const lvC=k.driftDir?(k.driftCharge>3?3:k.driftCharge>1.9?2:k.driftCharge>.9?1:0):-1;",
        "spark_lvc",
    )

    html = must_replace(
        html,
        "FX.update(dt);SMOKE.update(dt);",
        "FX.update(dt);SMOKE.update(dt);if(typeof SKIDS!=='undefined')SKIDS.update(dt);if(window.WFV2)WFV2.RIBBONS.update(dt);",
        "skids_world_update",
    )

    html = must_replace(
        html,
        "function setPreview(ci){if(ci===previewIdx)return;if(preview)podium.remove(preview.root);preview=makeKart(CHARS[ci]);preview.root.position.y=1.9;podium.add(preview.root);previewIdx=ci;}",
        "function setPreview(ci){if(ci===previewIdx)return;if(preview)podium.remove(preview.root);preview=makeKart(CHARS[ci]);if(window.WFV2)WFV2.applyGarageVisuals(preview,WFV2.getPartsForKart(true,0,0));preview.root.position.y=1.9;podium.add(preview.root);previewIdx=ci;}\nfunction refreshPreviewGarage(){previewIdx=-1;if(G.state==='select')updateWho();}",
        "preview_garage_visuals",
    )

    html = must_replace(
        html,
        "if(k.finished){cam.yaw+=dt*.5;c.position.lerp(tmpV.set(k.x+Math.sin(cam.yaw)*14,k.y+6,k.z+Math.cos(cam.yaw)*14),Math.min(1,dt*3));c.lookAt(k.x,k.y+1.5,k.z);continue;}",
        "if(k.finished){if(window.WFOnline&&WFOnline.isOnline()&&WFOnline.updateSpectatorCam&&WFOnline.updateSpectatorCam(k,cam,c,dt))continue;if(window.WFV2&&WFV2.updateTvReplayCam(k,cam,c,dt))continue;cam.yaw+=dt*.5;c.position.lerp(tmpV.set(k.x+Math.sin(cam.yaw)*14,k.y+6,k.z+Math.cos(cam.yaw)*14),Math.min(1,dt*3));c.lookAt(k.x,k.y+1.5,k.z);continue;}",
        "finished_tv_and_spectator_cam",
    )

    old_cam_follow = """    const targetYaw=k.spinT>0?cam.yaw:k.heading+adiff(k.heading,k.moveAng)*.35;cam.yaw+=adiff(cam.yaw,targetYaw)*Math.min(1,dt*(k.driftDir?3.5:6));
    const sp=Math.abs(k.speed),dist=9.5+sp*.035+(G.battle?3:0),hgt=4.3+sp*.012+(G.battle?3:0);
    const hx=Math.sin(cam.yaw),hz=Math.cos(cam.yaw);
    const want=tmpV.set(k.x-hx*dist,k.y+hgt,k.z-hz*dist);
    if(G.battle&&AR.ceil){const cl=Math.min(AR.ceil(k.x,k.z,k.y),AR.ceil(want.x,want.z,k.y));if(want.y>cl-1.3)want.y=Math.max(k.y+2.2,cl-1.3);}
    c.position.lerp(want,Math.min(1,dt*9));if(G.battle&&AR.ceil){const cl=AR.ceil(c.position.x,c.position.z,k.y);if(c.position.y>cl-1.3)c.position.y=cl-1.3;}c.position.y=Math.max(c.position.y,k.y+2.2);featCam(k,c);
    if(k.respawnT>0){c.position.y+=dt*4;}
    cam.shake=Math.max(0,cam.shake-dt*1.6);const sh=cam.shake*cam.shake;
    c.lookAt(k.x+hx*6,k.y+1.8,k.z+hz*6);if(sh>0){c.rotation.z+=rr(-1,1)*sh*.15;c.position.x+=rr(-1,1)*sh*1.2;c.position.y+=rr(-1,1)*sh*1.2;}"""

    new_cam_follow = """    const targetYaw=k.spinT>0?cam.yaw:k.heading+adiff(k.heading,k.moveAng)*.32;cam.yaw+=adiff(cam.yaw,targetYaw)*Math.min(1,dt*(k.driftDir?4.2:6.5));
    const viewYaw=k.lookBack?k.heading+Math.PI:cam.yaw;
    const sp=Math.abs(k.speed),dist=9.6+sp*.034+(G.battle?3:0),hgt=4.65+sp*.014+(G.battle?3:0);
    const hx=Math.sin(viewYaw),hz=Math.cos(viewYaw);
    const want=tmpV.set(k.x-hx*dist,k.y+hgt,k.z-hz*dist);
    if(G.battle&&AR.ceil){const cl=Math.min(AR.ceil(k.x,k.z,k.y),AR.ceil(want.x,want.z,k.y));if(want.y>cl-1.3)want.y=Math.max(k.y+2.2,cl-1.3);}
    if(k.lookBack)c.position.copy(want);else c.position.lerp(want,Math.min(1,dt*9.5));
    if(G.battle&&AR.ceil){const cl=AR.ceil(c.position.x,c.position.z,k.y);if(c.position.y>cl-1.3)c.position.y=cl-1.3;}c.position.y=Math.max(c.position.y,k.y+2.2);featCam(k,c);
    cam.shake=Math.max(0,cam.shake-dt*1.6);const sh=cam.shake*cam.shake;
    c.lookAt(k.x+hx*8.2,k.y+(k.lookBack?1.9:2.85),k.z+hz*8.2);if(sh>0){c.rotation.z+=rr(-1,1)*sh*.15;c.position.x+=rr(-1,1)*sh*1.2;c.position.y+=rr(-1,1)*sh*1.2;}"""
    html = must_replace(html, old_cam_follow, new_cam_follow, "camera_lower_third_lookback")

    html = must_replace(
        html,
        "if(G.state==='title'||G.state==='how'||G.state==='bmode'){",
        "if(G.state==='title'||G.state==='how'||G.state==='bmode'||G.state==='dmode'||G.state==='party'||G.state==='online'){",
        "cam_menu_states",
    )
    html = must_replace(
        html,
        "const racing=!['title','how','select','tracks','cup','bmode','arenas','loading'].includes(G.state);",
        "const racing=!['title','how','select','tracks','cup','bmode','dmode','party','online','arenas','loading'].includes(G.state);",
        "render_racing_states",
    )

    html = must_replace(
        html,
        "  drawSplats(fctx,FW,FH);",
        "  drawSplats(fctx,FW,FH);\n  drawThreatRadar(fctx,FW,FH);",
        "overlay_threat_radar",
    )

    old_hud_end = """    v.hb.style.width=(k.hype*100)+'%';const ready=k.hype>=1;v.bl.classList.toggle('ready',ready);v.hk.textContent=k.hyperT>0?'HYPER!':ready?(pads().length?'press △':'press Q'):Math.round(k.hype*100)+'%';
    if(G.humans.length===1){let html='';for(const o of order)html+=`<div class="${o.human?'me':''}"><b>${o.rank+1}</b><i style="background:${hexCss(o.ch.kart)}"></i>${o.ch.name}${G.battle||G.death?' <em class="bb">'+(o.out?'✖':'●'.repeat(o.balloons))+'</em>':''}</div>`;if(v.boardHTML!==html){v.board.innerHTML=html;v.boardHTML=html;}}
    if(v.msgT>0){v.msgT-=dt;if(v.msgT<=0)v.msg.classList.remove('show');}}
}"""
    new_hud_end = """    v.hb.style.width=(k.hype*100)+'%';const ready=k.hype>=1;v.bl.classList.toggle('ready',ready);v.hk.textContent=k.hyperT>0?(k.ch.name.toUpperCase()+' HYPE!'):ready?(touch.on?'TAP TO HYPE':pads().length?'△ SIGNATURE HYPE':'Q SIGNATURE HYPE'):Math.round(k.hype*100)+'%';
    if(v.ww)v.ww.hidden=!((k.wrongT||0)>1.0&&!G.battle&&!k.finished);
    if(v.trailB){v.trailB.hidden=!k.trailItem;if(k.trailItem)v.trailB.textContent='🛡 '+ITEMS[k.trailItem].name.toUpperCase();}
    for(let pi=v.pillList.length-1;pi>=0;pi--){const pl=v.pillList[pi];pl.t-=dt;if(pl.t<.25)pl.el.style.opacity=String(Math.max(0,pl.t/.25));if(pl.t<=0){pl.el.remove();v.pillList.splice(pi,1);}}
    if(G.humans.length===1){let html='';for(const o of order)html+=`<div class="${o.human?'me':''}"><b>${o.rank+1}</b><i style="background:${hexCss(o.ch.kart)}"></i>${o.netName||o.ch.name}${G.battle||G.death?' <em class="bb">'+(o.out?'✖':'●'.repeat(o.balloons))+'</em>':''}</div>`;if(v.boardHTML!==html){v.board.innerHTML=html;v.boardHTML=html;}}
    if(v.msgT>0){v.msgT-=dt;if(v.msgT<=0)v.msg.classList.remove('show');}}
}"""
    html = must_replace(html, old_hud_end, new_hud_end, "hud_end_pills_ww")

    old_launch = """function launch(k,kind){const fx=Math.sin(k.heading),fz=Math.cos(k.heading);
  if(kind==='ball'||kind==='chappal'||kind==='fire'){const sp=kind==='ball'?105:kind==='fire'?95:88;const m=kind==='fire'?new THREE.Mesh(fireGeo,fireMat):new THREE.Mesh(kind==='ball'?ballGeo:chapGeo,vcPhong);m.castShadow=kind!=='fire';m.scale.setScalar(kind==='ball'?1.5:kind==='fire'?1:1.6);scene.add(m);
    PROJS.push({kind,m,owner:k,x:k.x+fx*3.2,z:k.z+fz*3.2,y:k.y+1.2,vx:fx*sp,vz:fz*sp,life:kind==='ball'?4.2:kind==='fire'?2.2:3.4,t:0,b:0,idx:k.idx,hits:new Set()});}"""
    new_launch = """function launch(k,kind,dirSign=1){const ang=dirSign<0?k.heading+Math.PI:k.heading;const fx=Math.sin(ang),fz=Math.cos(ang);
  if(kind==='ball'||kind==='chappal'||kind==='fire'){const sp=kind==='ball'?105:kind==='fire'?95:88;const m=kind==='fire'?new THREE.Mesh(fireGeo,fireMat):new THREE.Mesh(kind==='ball'?ballGeo:chapGeo,vcPhong);m.castShadow=kind!=='fire';m.scale.setScalar(kind==='ball'?1.5:kind==='fire'?1:1.6);scene.add(m);
    PROJS.push({kind,m,owner:k,x:k.x+fx*3.4,z:k.z+fz*3.4,y:k.y+1.2,vx:fx*sp,vz:fz*sp,life:kind==='ball'?4.2:kind==='fire'?2.2:3.4,t:0,b:0,idx:k.idx,hits:new Set()});}"""
    html = must_replace(html, old_launch, new_launch, "launch_dir")

    old_bomb_throw = """function bombThrow(k){const fx=Math.sin(k.heading),fz=Math.cos(k.heading),from={x:k.x,y:k.y+2,z:k.z};let s;
  if(G.battle){let x=k.x+fx*38,z=k.z+fz*38;if(AR.shape==='circle'){const r=Math.hypot(x,z),m=AR.wall-6;if(r>m){x*=m/r;z*=m/r;}}else{x=clamp(x,-AR.W+5,AR.W-5);z=clamp(z,-AR.D+5,AR.D-5);}s=strike(x,AR.ground(x,z,k.y),z,1.5,'bomb',null,null,from);}
  else{let i=wrapI(k.idx+Math.round(38/SP));let n=0;while(GAP[i]&&n<400){i=wrapI(i+3);n+=3;}s=strikeAt(i,clamp(k.lat||0,-ROAD+2,ROAD-2),1.5,'bomb',from);}
  if(s)s.owner=k;k.bombs=(k.bombs||0)+1;}"""
    new_bomb_throw = """function bombThrow(k,dirSign=1){const dist=dirSign<0?-16:38;const fx=Math.sin(k.heading),fz=Math.cos(k.heading),from={x:k.x,y:k.y+2,z:k.z};let s;
  if(G.battle){let x=k.x+fx*dist,z=k.z+fz*dist;if(AR.shape==='circle'){const r=Math.hypot(x,z),m=AR.wall-6;if(r>m){x*=m/r;z*=m/r;}}else{x=clamp(x,-AR.W+5,AR.W-5);z=clamp(z,-AR.D+5,AR.D-5);}s=strike(x,AR.ground(x,z,k.y),z,1.5,'bomb',null,null,from);}
  else{let i=wrapI(k.idx+Math.round(dist/SP));let n=0;while(GAP[i]&&n<400){i=wrapI(i+(dirSign<0?-3:3));n+=3;}s=strikeAt(i,clamp(k.lat||0,-ROAD+2,ROAD-2),dirSign<0?1.1:1.5,'bomb',from);}
  if(s)s.owner=k;k.bombs=(k.bombs||0)+1;}"""
    html = must_replace(html, old_bomb_throw, new_bomb_throw, "bomb_throw_dir")

    old_power_press = """function powerPress(k){if(k.goldT>0){k.boostT=Math.max(k.boostT,1.05);if(k.human)SFX.boost();return true;}if(k.fireT>0){launch(k,'fire');if(k.human)SFX.throw();return true;}return false;}"""
    new_power_press = """function powerPress(k,aimDir=0){if(k.goldT>0){k.boostT=Math.max(k.boostT,1.05);if(k.human)SFX.boost();return true;}if(k.fireT>0){launch(k,'fire',aimDir<0?-1:1);if(k.human)SFX.throw();return true;}return false;}"""
    html = must_replace(html, old_power_press, new_power_press, "power_press_dir")

    old_menus_block = """const screens=['title','how','select','tracks','pause','results','cup','bmode','arenas','party','dmode'];
function show(id){for(const s of screens)$('#'+s).hidden=s!==id;G.focus=0;refreshFocus();}"""
    new_menus_block = """const screens=['title','how','select','tracks','pause','results','cup','bmode','arenas','party','dmode','online','settings','ctrlTut','lb'];
function show(id){for(const s of screens){const el=$('#'+s);if(el)el.hidden=s!==id;}G.focus=0;refreshFocus();}"""
    html = must_replace(html, old_menus_block, new_menus_block, "screens_online")

    html = must_replace(
        html,
        "const id=screens.find(s=>!$('#'+s).hidden);",
        "const id=screens.find(s=>{const el=$('#'+s);return el&&!el.hidden;});",
        "focusables_nullsafe",
    )

    html = must_replace(
        html,
        "for(const s of screens)$('#'+s).hidden=true;",
        "for(const s of screens){const el=$('#'+s);if(el)el.hidden=true;}",
        "hide_screens_1",
    )
    html = html.replace(
        "for(const s of screens)$('#'+s).hidden=true;",
        "for(const s of screens){const el=$('#'+s);if(el)el.hidden=true;}",
    )

    html = must_replace(
        html,
        "const cols=G.state==='tracks'?(innerWidth<=900?2:5):G.state!=='select'?(innerWidth<=900?2:4):(innerWidth<=720?3:7);",
        "const cols=G.state==='tracks'?(innerWidth<=980?2:4):G.state!=='select'?(innerWidth<=900?2:4):(innerWidth<=720?3:5);",
        "grid_cols_5",
    )

    old_update_who = """function updateWho(){const c=CHARS[G.focus];if(!c)return;setPreview(G.focus);const lab=['Speed','Accel','Handling','Weight'];
  $('#who').innerHTML=`<div class="nm" style="color:${hexCss(c.kart)}">${c.name}</div><div class="sp">${c.blurb}</div>`+c.st.map((v,i)=>`<div class="stat">${lab[i]}<i><u style="width:${Math.min(100,v*20)}%${v>5?';background:linear-gradient(90deg,#ffd23f,#fff4a8)':''}"></u></i></div>`).join('');}"""
    new_update_who = """function updateWho(){const c=CHARS[G.focus];if(!c)return;setPreview(G.focus);
  let vals=c.st.slice(),lab=['Speed','Accel','Handling','Weight'];
  if(window.WFV2){const P=WFV2.getPartsForKart(true,0,0),fr=P.frame,tr=P.tire;vals=[c.st[0]*fr.spd*tr.spd,c.st[1]*fr.acc*tr.acc,c.st[2]*fr.hand*tr.hand,c.st[3]*fr.wt,tr.off*6.0,fr.mt*tr.chg*3.8];lab=['Speed','Accel','Handling','Weight','Off-Road','Mini-Turbo'];}
  $('#who').innerHTML=`<div class="nm" style="color:${hexCss(c.kart)}">${c.name}</div><div class="sp">${c.blurb}</div>${c.sig?`<div class="sig">⚡ ${c.sig}</div>`:''}`+vals.map((v,i)=>`<div class="stat">${lab[i]}<i><u style="width:${Math.min(100,v*20)}%${v>5?';background:linear-gradient(90deg,#ffd23f,#fff4a8)':''}"></u></i></div>`).join('');}"""
    html = must_replace(html, old_update_who, new_update_who, "update_who_sig")

    old_go_tracks = """function goTracks(){G.state='tracks';const g=$('#trkGrid');
  let html='';if(!G.deathNext)CUPS.forEach((c,ci)=>{const t=trophyOf(c.id);const names=cupOrder(c).map(i=>LEVELS[i].name).join(', ');html+=`<button class="trk cup" data-trk="${-1-ci}"><svg viewBox="0 0 200 94"><rect width="200" height="94" fill="${c.col}"/><g transform="translate(68 14) scale(1)">${TROPHY(t?TCOL[t-1]:'#ffb22e')}</g></svg><b>${c.name}</b><span>${names}</span><em>${t?['Gold','Silver','Bronze'][t-1]+' trophy won':'No trophy yet'}</em></button>`;});
  LEVELS.forEach((L,i)=>{const b=getBest(L);html+=`<button class="trk" data-trk="${i}">${L.random?'<svg viewBox="0 0 200 94"><defs><linearGradient id="grnd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fd8"/><stop offset=".5" stop-color="#9f3dff"/><stop offset="1" stop-color="#26d3d0"/></linearGradient></defs><rect width="200" height="94" fill="url(#grnd)"/><text x="100" y="74" text-anchor="middle" font-family="Bungee,Impact" font-size="72" fill="#fff" opacity=".92">?</text></svg>':trackSVG(L)}<b>${L.random?'Mystery Track':L.name}</b><span>${L.tag}</span><em>${isFinite(b)?'Best lap '+fmt(b):L.mech}</em></button>`;});
  g.innerHTML=html;show('tracks');}"""
    new_go_tracks = """function goTracks(){G.state='tracks';renderTrackAtlas();show('tracks');}"""
    html = must_replace(html, old_go_tracks, new_go_tracks, "go_tracks_atlas")

    html = must_replace(
        html,
        "function showCup(){engineStop();G.lastCup=G.cup&&G.cup.ci||0;const rows=standingsRows();G.state='cup';",
        "function showCup(){engineStop();G.lastCup=G.cup&&G.cup.ci||0;const rows=standingsRows();const newlyUnlocked=!!(G.cup&&cupLocked((G.cup.ci||0)+1)&&(G.cup.ci||0)+1<CUPS.length);if(G.cup)unlockCupsUpTo((G.cup.ci||0)+2);if(G.humans.length===1&&G.cup)submitCupPoints(G.cup.pts[G.humans[0]]||0);G.state='cup';",
        "cup_leaderboard_submit",
    )

    html = must_replace(
        html,
        "$('#cupSub').textContent=hb===1?(G.humans.length>1?'A player takes the gold trophy!':'Gold trophy! Saved to your shelf.'):hb<=3?(['','','Silver','Bronze'][hb]+' trophy. Saved to your shelf.'):'Off the podium this time. Have another go!';",
        "$('#cupSub').textContent=(hb===1?(G.humans.length>1?'A player takes the gold trophy!':'Gold trophy! Saved to your shelf.'):hb<=3?(['','','Silver','Bronze'][hb]+' trophy. Saved to your shelf.'):'Off the podium this time. Have another go!')+(newlyUnlocked?' 🔓 New cup unlocked!':'');",
        "cup_unlock_announce",
    )

    html = must_replace(
        html,
        "function quit(){engineStop();finReset();G.battle=false;for(const k of G.karts)scene.remove(k.v.root);G.karts=[];G.humans_k=[];views.innerHTML='';clearCeremony();podium.visible=true;G.cup=null;G.state='title';show('title');$('#touch').classList.remove('on');touch.on=false;updateShelf();}",
        "function quit(){engineStop();finReset();G.battle=false;G.timeTrial=false;if(window.WFV2)WFV2.clearGhosts();for(const k of G.karts)scene.remove(k.v.root);G.karts=[];G.humans_k=[];views.innerHTML='';clearCeremony();podium.visible=true;G.cup=null;G.state='title';show('title');$('#touch').classList.remove('on');touch.on=false;updateShelf();}",
        "quit_reset_timetrial",
    )

    html = must_replace(
        html,
        '''else{$('#standings').innerHTML='';$('#resBtns').innerHTML=`<button class="btn" data-act="restart">Race again</button><button class="btn alt" data-act="tracks">Change track</button><button class="btn ghost" data-act="reselect">Change racers</button><button class="btn ghost" data-act="quit">Title</button>`;}''',
        '''else if(G.timeTrial){if(G.humans.length===1)submitLapTime(LV.id,me.finishTime);const tt=window.WFV2?WFV2.saveTimeTrialFinish(LV,me.finishTime,G.humans[0]):null;const stT=window.WFV2&&WFV2.GHOSTS.lastStaffTime;$('#resTitle').textContent=tt&&tt.beatStaff?'★ BEAT THE DEV STAFF GHOST!':'⏱ '+LV.name+' Time Trial';$('#standings').innerHTML=`<div style="margin:8px 0;font-size:14px;color:var(--cream)">Total Time: <b style="color:var(--ember)">${fmt(me.finishTime)}</b>${stT?` · Dev Staff Ghost: <b style="color:var(--lagoon)">${fmt(stT)}</b>`:''}${tt&&tt.beatPB?' · <span class="qual ok">NEW PERSONAL BEST!</span>':''}</div>`;$('#resBtns').innerHTML=`<button class="btn" data-act="restart">Retry Time Trial</button><button class="btn alt" data-act="copyGhost" id="copyGhostBtn">Copy Ghost Code</button><button class="btn alt" data-act="importGhost">Import Rival Ghost</button><button class="btn ghost" data-act="tracks">Change track</button><button class="btn ghost" data-act="quit">Title</button>`;}else{$('#standings').innerHTML='';$('#resBtns').innerHTML=`<button class="btn" data-act="restart">Race again</button><button class="btn alt" data-act="tracks">Change track</button><button class="btn ghost" data-act="reselect">Change racers</button><button class="btn ghost" data-act="quit">Title</button>`;}''',
        "timetrial_results_ui",
    )

    html = must_replace(
        html,
        "const PTS=[10,8,6,4,2,1];",
        "const PTS=[15,12,10,8,6,4,2,1,1,1];",
        "pts_8karts",
    )

    html = must_replace(
        html,
        "else if(G.humans_k.every(k=>k.finished)){if(!G.finishedAt)G.finishedAt=G.raceT;if(G.raceT-G.finishedAt>4.2)showResults();}",
        "else if(G.humans_k.length&&G.humans_k.every(k=>k.finished)){if(!G.finishedAt){G.finishedAt=G.raceT;if(window.WFOnline&&WFOnline.isOnline())WFOnline.tick(0);}if(window.WFOnline&&WFOnline.isOnline()){if(G.raceT-G.finishedAt>1.6)engineStop();}else if(G.raceT-G.finishedAt>4.2)showResults();}",
        "online_finish_hook",
    )

    html = must_replace(
        html,
        "for(const k of(G.humans_k||[])){engineSet(k.pi,k.speed,k.boostT>0||k.hyperT>0,k.respawnT<=0&&G.state!=='results');}",
        "if(G.state==='results'&&window.WFOnline&&WFOnline.isOnline())WFOnline.tick(dt);\n  for(const k of(G.humans_k||[])){engineSet(k.pi,k.speed,k.boostT>0||k.hyperT>0,k.respawnT<=0&&G.state!=='results',k.driftDir!==0);}",
        "engine_set_drift_arg",
    )

    old_start_race = """function startRace(){show(null);for(const s of screens){const el=$('#'+s);if(el)el.hidden=true;}clearCeremony();podium.visible=!G.battle;setupRace();touch.on=isTouch&&G.humans.length===1;$('#touch').classList.toggle('on',touch.on);
  if(G.battle)for(const k of G.humans_k)say(k.pi,AR.name.toUpperCase()+' · POP THEIR BALLOONS!',2.4);
  if(G.cup)for(const k of G.humans_k)say(k.pi,'RACE '+(G.cup.race+1)+' OF '+G.cup.order.length+' · '+LV.name.toUpperCase(),2.4);}"""
    new_start_race = """function startRace(){if(!store.get('wheeliefun.seenCtrlTut')){for(const s of screens){const el=$('#'+s);if(el)el.hidden=true;}G.state='ctrlTut';show('ctrlTut');return;}
  show(null);for(const s of screens){const el=$('#'+s);if(el)el.hidden=true;}clearCeremony();podium.visible=!G.battle;setupRace();touch.on=isTouch&&G.humans.length===1;$('#touch').classList.toggle('on',touch.on);
  if(G.battle)for(const k of G.humans_k)say(k.pi,AR.name.toUpperCase()+' · POP THEIR BALLOONS!',2.4);
  if(G.cup)for(const k of G.humans_k)say(k.pi,'RACE '+(G.cup.race+1)+' OF '+G.cup.order.length+' · '+LV.name.toUpperCase(),2.4);}
function dismissCtrlTut(){store.set('wheeliefun.seenCtrlTut','1');startRace();}"""
    html = must_replace(html, old_start_race, new_start_race, "ctrl_tutorial_gate")

    old_click_acts = """if(a==='p1'){G.battleNext=false;G.deathNext=false;G.bind=null;goSelect(1);}else if(a==='death'){G.state='dmode';show('dmode');}else if(a==='d1'){G.battleNext=false;G.deathNext=true;G.bind=null;goSelect(1);}else if(a==='dparty'){G.deathNext=true;goParty(false);G.deathNext=true;}else if(a==='diff'){cycleDiff();}else if(a==='party'){G.deathNext=false;goParty(false);}else if(a==='bparty'){goParty(true);}else if(a==='partyGo'){partyGo();}else if(a==='battle'){G.state='bmode';show('bmode');}"""
    new_click_acts = """if(a==='online'){G.timeTrial=false;if(window.WFOnline)WFOnline.openMenu(WF_API_BRIDGE);return;}else if(a==='tt'){G.onlineGrid=null;G.battleNext=false;G.deathNext=false;G.timeTrial=true;G.bind=null;goSelect(1);return;}else if(a==='cc'){if(window.WFV2)WFV2.cycleCC();return;}else if(a==='copyGhost'){if(window.WFV2&&WFV2.GHOSTS.lastCode){try{navigator.clipboard.writeText(WFV2.GHOSTS.lastCode);}catch(e){}const gb=$('#copyGhostBtn');if(gb)gb.textContent='Copied Ghost Code! ✓';}return;}else if(a==='importGhost'){const code=typeof prompt==='function'?prompt('Paste a Friend Ghost Code (WFG1:...):'):'';if(code&&window.WFV2){const imp=WFV2.importGhostCode(code);if(imp){const tIdx=LEVELS.findIndex(L=>L.id===imp.trk);if(tIdx>=0){G.timeTrial=true;startLevel(tIdx);}else startRace();}}return;}else if(a==='items'){cycleItemsMode();return;}else if(a==='settings'){G.state='settings';show('settings');return;}else if(a==='lb'){openLeaderboards();return;}else if(a==='lbNameSave'){const el=$('#lbNameIn');if(el){el.value=renameLbName(el.value);b.textContent='Saved ✓';setTimeout(()=>{b.textContent='Update Name';},1200);}return;}else if(a==='cupNameSave'){const el=$('#cupNameIn');if(el){el.value=renameLbName(el.value);b.textContent='Saved ✓';setTimeout(()=>{b.textContent='Update Name';},1200);}return;}else if(a==='ctrlTutGo'){dismissCtrlTut();return;}else if(a==='randTrk'){G.cup=null;const avail=LEVELS.map((L,i)=>i).filter(i=>!trackLocked(LEVELS[i]));const ri=avail[Math.floor(Math.random()*avail.length)];if(LEVELS[ri].random)G.level=-1;startLevel(ri);return;}else if(a==='trkBack'){back();return;}else if(a==='p1'){G.timeTrial=false;G.onlineGrid=null;G.battleNext=false;G.deathNext=false;G.bind=null;goSelect(1);}else if(a==='death'){G.timeTrial=false;G.state='dmode';show('dmode');}else if(a==='d1'){G.timeTrial=false;G.battleNext=false;G.deathNext=true;G.bind=null;goSelect(1);}else if(a==='dparty'){G.timeTrial=false;G.deathNext=true;goParty(false);G.deathNext=true;}else if(a==='diff'){cycleDiff();}else if(a==='party'){G.timeTrial=false;G.deathNext=false;goParty(false);}else if(a==='bparty'){G.timeTrial=false;goParty(true);}else if(a==='partyGo'){partyGo();}else if(a==='battle'){G.timeTrial=false;G.state='bmode';show('bmode');}"""
    html = must_replace(html, old_click_acts, new_click_acts, "click_actions")

    new_subsystems = """
// ================= MARIO KART UPGRADE SUBSYSTEMS =================
const SKIDS=(()=>{
  const MAXQ=1600,pos=new Float32Array(MAXQ*18),col=new Float32Array(MAXQ*24),birth=new Float32Array(MAXQ).fill(-999);
  const g=new THREE.BufferGeometry();
  const pa=new THREE.BufferAttribute(pos,3),ca=new THREE.BufferAttribute(col,4);
  pa.setUsage(THREE.DynamicDrawUsage);ca.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position',pa);g.setAttribute('rgba',ca);
  const mat=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,
    uniforms:{uNow:{value:0}},
    vertexShader:'attribute vec4 rgba;varying vec4 vC;void main(){vC=rgba;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec4 vC;void main(){if(vC.a<=.005)discard;gl_FragColor=vC;}'
  });
  const mesh=new THREE.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=1;scene.add(mesh);
  let head=0,dirty=false,segCount=0;
  function addSeg(x0,y0,z0,x1,y1,z1,rx,rz,w,r,gg,b,a){
    const idx=head;head=(head+1)%MAXQ;birth[idx]=G.time;segCount++;
    const hw=w*.5;
    const ax=x0-rx*hw,az=z0-rz*hw,bx=x0+rx*hw,bz=z0+rz*hw;
    const cx=x1-rx*hw,cz=z1-rz*hw,dx=x1+rx*hw,dz=z1+rz*hw;
    const o=idx*18,co=idx*24;
    const V=[ax,y0,az, bx,y0,bz, cx,y1,cz, cx,y1,cz, bx,y0,bz, dx,y1,dz];
    for(let i=0;i<18;i++)pos[o+i]=V[i];
    for(let v=0;v<6;v++){col[co+v*4]=r;col[co+v*4+1]=gg;col[co+v*4+2]=b;col[co+v*4+3]=a;}
    dirty=true;
  }
  return{
    mesh,
    get count(){return segCount;},
    clear(){pos.fill(0);col.fill(0);birth.fill(-999);segCount=0;pa.needsUpdate=ca.needsUpdate=true;for(const k of G.karts)k.skidL=k.skidR=null;},
    emitKart(k){
      if(!k.onGround||k.respawnT>0||k.boat||k.slide||k.slideL||Math.abs(k.speed)<14){k.skidL=k.skidR=null;return;}
      const lv=k.driftDir?(k.driftCharge>3?3:k.driftCharge>1.9?2:k.driftCharge>.9?1:0):-1;
      const sliding=lv>=0||k.hyperT>0||k.offroad||SURF[k.idx]===2||(Math.abs(k.steerVis)>.78&&Math.abs(k.speed)>38);
      if(!sliding){k.skidL=k.skidR=null;return;}
      const ang=k.heading-(k.driftSlip||0),sx=Math.sin(ang),cx=Math.cos(ang),rx=-cx,rz=sx;
      const bx=k.x-sx*1.55,bz=k.z-cx*1.55,by=k.y+.08;
      const lx=bx-rx*1.52,lz=bz-rz*1.52,rxp=bx+rx*1.52,rzp=bz+rz*1.52;
      let r=.09,gg=.08,b=.12,a=.38;
      if(k.hyperT>0){const hc=new THREE.Color().setHSL((G.time*1.8)%1,1,.58);r=hc.r;gg=hc.g;b=hc.b;a=.62;}
      else if(lv>=1){const dc=DRIFTC[lv];r=dc[0]*.75;gg=dc[1]*.75;b=dc[2]*.75;a=.48+lv*.07;}
      else if(k.offroad){const dc=LR.dust?LR.dust(k.idx):[.42,.32,.2];r=dc[0]*.65;gg=dc[1]*.65;b=dc[2]*.65;a=.44;}
      else if(SURF[k.idx]===2){r=.75;gg=.9;b=1;a=.32;}
      if(k.skidL){const d=Math.hypot(lx-k.skidL[0],lz-k.skidL[2]);if(d>.45&&d<7){addSeg(k.skidL[0],k.skidL[1],k.skidL[2],lx,by,lz,rx,rz,.42,r,gg,b,a);addSeg(k.skidR[0],k.skidR[1],k.skidR[2],rxp,by,rzp,rx,rz,.42,r,gg,b,a);k.skidL=[lx,by,lz];k.skidR=[rxp,by,rzp];}else if(d>=7){k.skidL=[lx,by,lz];k.skidR=[rxp,by,rzp];}}
      else{k.skidL=[lx,by,lz];k.skidR=[rxp,by,rzp];}
    },
    update(dt){
      let faded=false;
      for(let i=0;i<MAXQ;i++){if(birth[i]<0)continue;const age=G.time-birth[i];if(age>9){const co=i*24;if(col[co+3]>0){const na=Math.max(0,col[co+3]-dt*.18);for(let v=0;v<6;v++)col[co+v*4+3]=na;faded=true;if(na<=0)birth[i]=-999;}}}
      if(dirty||faded){pa.needsUpdate=true;ca.needsUpdate=true;dirty=false;}
    }
  };
})();

const chevTex=canvasTex(192,96,(x,w,h)=>{
  x.fillStyle='#140a24';x.fillRect(0,0,w,h);x.strokeStyle='#ffb22e';x.lineWidth=6;x.strokeRect(3,3,w-6,h-6);
  for(let k=0;k<3;k++){const ox=18+k*54;x.fillStyle=k===1?'#26d3d0':'#ff5b1f';x.beginPath();x.moveTo(ox,16);x.lineTo(ox+30,16);x.lineTo(ox+50,h/2);x.lineTo(ox+30,h-16);x.lineTo(ox,h-16);x.lineTo(ox+20,h/2);x.closePath();x.fill();}
});
const chevBoardGeo=build([[new THREE.BoxGeometry(.4,5.5,.4),0x2a2136,M(-2.2,2.75,-.2)],[new THREE.BoxGeometry(.4,5.5,.4),0x2a2136,M(2.2,2.75,-.2)]]);
function buildCornerChevrons(L){
  if(L.portals)return;
  const spots=[],minGap=Math.max(8,Math.round(30/SP));let last=-999;
  for(let i=25;i<N-25;i++){
    if(i-last<minGap||GAP[i]||TUN[i]>.2)continue;
    const cv=CURV[i];if(Math.abs(cv)<.46)continue;
    const outSide=cv>0?1:-1;
    spots.push([i,outSide,cv]);last=i;
  }
  if(!spots.length)return;
  const postIM=addL(new THREE.InstancedMesh(chevBoardGeo,vcPhong,spots.length));
  const signGeo=new THREE.PlaneGeometry(6.8,3.4);
  const signMatL=new THREE.MeshBasicMaterial({map:chevTex,color:HDR(1.7,1.7,1.7),side:THREE.DoubleSide});
  const signIM=addL(new THREE.InstancedMesh(signGeo,signMatL,spots.length));
  spots.forEach(([i,side,cv],n)=>{
    const lat=side*(WALL*LW[i]+1.8),p=edge(i,lat,0);
    const faceYaw=TA[i]+Math.PI+(side>0?-.35:.35);
    postIM.setMatrixAt(n,M(p[0],p[1],p[2],0,faceYaw,0));
    signIM.setMatrixAt(n,M(p[0],p[1]+4.8,p[2],0,faceYaw,cv>0?0:Math.PI));
  });
}

const droneGeo=build([
  [rbox(2.4,.9,2.4,.35),0xffb22e,M(0,0,0)],
  [SPH(.7,12,8),0x26d3d0,M(0,-.25,0)],
  [new THREE.BoxGeometry(3.8,.12,.35),0x1a0f2b,M(0,.62,0)],
  [new THREE.BoxGeometry(.35,.12,3.8),0x1a0f2b,M(0,.62,0)],
  [new THREE.ConeGeometry(1.8,4.2,16,1,true),0x26d3d0,M(0,-2.3,0)]
],0,true);
const droneMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.82,side:THREE.DoubleSide});
function attachRescueDrone(k){
  if(!k.droneM){k.droneM=new THREE.Mesh(droneGeo,droneMat);k.v.root.add(k.droneM);}
  k.droneM.position.set(0,5.2,0);k.droneM.visible=true;
}
function updateRescueArc(k,dt){
  const dur=k.rescueDur||1.45,u=clamp(1-k.respawnT/dur,0,1),e=u*u*(3-2*u);
  const i=k.rescueTo,tx=TP[i].x,tz=TP[i].z,ty=groundAt(i,0,0)+1.2;
  k.x=lerp(k.rescueFrom.x,tx,e);
  k.z=lerp(k.rescueFrom.z,tz,e);
  k.y=lerp(k.rescueFrom.y,ty,e)+Math.sin(u*Math.PI)*11;
  k.heading=k.moveAng=TA[i];k.speed=0;
  if(k.droneM){k.droneM.visible=true;k.droneM.rotation.y+=dt*14;}
}

const TRAILABLE=new Set(['goo','tiffin','prank','mine','ball','bomb']);
function trailMeshFor(it){
  if(it==='goo')return new THREE.Mesh(gooGeo,vcPhong);
  if(it==='tiffin')return new THREE.Mesh(tiffGeo,vcPhong);
  if(it==='prank'){const m=new THREE.Mesh(boxGeo,prankMat);m.scale.setScalar(.72);m.rotation.z=Math.PI;return m;}
  if(it==='mine')return new THREE.Mesh(mineGeo,vcPhong);
  if(it==='ball'){const m=new THREE.Mesh(ballGeo,vcPhong);m.scale.setScalar(1.2);return m;}
  if(it==='bomb')return new THREE.Mesh(cherryGeo,vcPhong);
  return new THREE.Mesh(gooGeo,vcPhong);
}
function clearTrailMesh(k){if(k.trailMesh){scene.remove(k.trailMesh);k.trailMesh=null;}k.trailItem=null;}
function startTrailItem(k){
  if(!k.item||!TRAILABLE.has(k.item))return false;
  clearTrailMesh(k);
  k.trailItem=k.item;k.item=null;k.itemN=0;
  k.trailMesh=trailMeshFor(k.trailItem);scene.add(k.trailMesh);
  const bx=k.x-Math.sin(k.heading)*3.9,bz=k.z-Math.cos(k.heading)*3.9;
  k.trailMesh.position.set(bx,k.y+1.1,bz);
  if(k.human)SFX.item();
  return true;
}
function lobTrapForward(k,it){
  const dist=44,fx=Math.sin(k.heading),fz=Math.cos(k.heading);
  let tx=k.x+fx*dist,tz=k.z+fz*dist,ty=groundY(k);
  if(!G.battle){let i=wrapI(k.idx+Math.round(dist/SP)),n=0;while(GAP[i]&&n<300){i=wrapI(i+3);n+=3;}const l=clamp(k.lat||0,-ROAD+2,ROAD-2);tx=TP[i].x+TR[i].x*l;tz=TP[i].z+TR[i].z*l;ty=groundAt(i,0,l);}
  else{if(AR.shape==='circle'){const r=Math.hypot(tx,tz),m=AR.wall-5;if(r>m){tx*=m/r;tz*=m/r;}}else{tx=clamp(tx,-AR.W+4,AR.W-4);tz=clamp(tz,-AR.D+4,AR.D-4);}ty=AR.ground(tx,tz,k.y);}
  if(it==='prank'){const m=new THREE.Mesh(boxGeo,prankMat);m.castShadow=true;m.position.set(tx,ty+2.2,tz);m.rotation.z=Math.PI;scene.add(m);PRANKS.push({m,owner:k,x:tx,y:ty,z:tz,t:0});}
  else if(it==='mine'){const m=new THREE.Mesh(mineGeo,vcPhong);m.castShadow=true;m.position.set(tx,ty+1.1,tz);const l=new THREE.Mesh(SPH(.35,8,6),mineLight);l.position.y=1.2;m.add(l);m.userData.l=l;scene.add(m);goos.push({m,x:tx,z:tz,y:ty,owner:k,t:0,kind:'mine'});}
  else{const m=new THREE.Mesh(it==='tiffin'?tiffGeo:gooGeo,vcPhong);if(it==='goo')m.scale.set(1.75,1,1.75);m.position.set(tx,ty+.05,tz);scene.add(m);goos.push({m,x:tx,z:tz,y:ty,owner:k,t:0,kind:it==='tiffin'?'tiffin':undefined});}
  burst(FX,tx,ty+1.5,tz,14,10,.4,.7,.6,1,.4);
  if(k.human){SFX.throw();say(k.pi,'LOBBED '+ITEMS[it].name.toUpperCase()+'!',.8);}
}
function useItemDir(k,aimDir=0){
  const it=k.item;if(!it)return;
  if(window.WFOnline&&WFOnline.isOnline()&&k.human)WFOnline.onLocalItem(it,{aimDir});
  if(aimDir>0&&(it==='goo'||it==='tiffin'||it==='prank'||it==='mine')){k.item=null;k.itemN=0;lobTrapForward(k,it);return;}
  if(aimDir<0&&(it==='ball'||it==='ball3')){launch(k,'ball',-1);if(it==='ball3'){k.itemN--;if(k.itemN<=0)k.item=null;}else k.item=null;if(k.human){SFX.throw();say(k.pi,'BACK SHOT!',.75);}return;}
  if(aimDir<0&&it==='bomb'){bombThrow(k,-1);k.item=null;if(k.human){SFX.throw();say(k.pi,'BACK BOMB!',.75);}return;}
  useItem(k);
}
function releaseTrailItem(k,aimDir=0){
  const it=k.trailItem;if(!it)return;
  clearTrailMesh(k);
  const prevItem=k.item,prevN=k.itemN;
  k.item=it;k.itemN=1;
  useItemDir(k,aimDir);
  k.item=prevItem;k.itemN=prevN;
}
function trailAndOrbitTick(dt){
  for(const k of G.karts){
    if(k.trailItem&&k.trailMesh){
      if(k.out||k.respawnT>0){clearTrailMesh(k);continue;}
      const bx=k.x-Math.sin(k.heading)*3.9,bz=k.z-Math.cos(k.heading)*3.9,by=k.y+.95;
      k.trailMesh.position.set(bx,by,bz);k.trailMesh.rotation.y+=dt*2.4;
      let consumed=false;
      for(let bi=bees.length-1;bi>=0;bi--){const b=bees[bi];if(b.owner===k)continue;if(Math.hypot(b.x-bx,b.z-bz)<4.2){scene.remove(b.m);bees.splice(bi,1);consumed=true;if(k.human){SFX.pop();say(k.pi,'BEE BLOCKED!',.9);}break;}}
      if(!consumed)for(let pi=PROJS.length-1;pi>=0;pi--){const p=PROJS[pi];if(p.owner===k||p.kind==='cloud')continue;if(Math.hypot(p.x-bx,p.z-bz)<3.8){scene.remove(p.m);PROJS.splice(pi,1);consumed=true;if(k.human){SFX.pop();say(k.pi,'SHOT BLOCKED!',.9);}break;}}
      if(!consumed)for(const q of G.karts){if(q===k||q.out||q.respawnT>0)continue;if(Math.hypot(q.x-bx,q.z-bz)<3.1&&Math.abs(q.y-k.y)<3){hit(q,k);consumed=true;break;}}
      if(consumed){burst(FX,bx,by+.6,bz,24,14,.4,.8,1,.85,.3);clearTrailMesh(k);}
    }
    const orbKind=(k.item==='goo3'||k.item==='ball3'||k.item==='bee3')?k.item:null;
    for(let j=0;j<3;j++){
      const key='orb'+j;
      if(orbKind&&j<(k.itemN||0)&&k.respawnT<=0&&!k.out){
        const geo=orbKind==='goo3'?gooGeo:orbKind==='ball3'?ballGeo:beeGeo;
        const m=attach(k,key,geo,vcPhong);
        if(m.userData.kind!==orbKind){m.geometry=geo;m.userData.kind=orbKind;}
        const a=G.time*3.4+j*(Math.PI*2/3);
        m.position.set(Math.cos(a)*3.1,1.35,Math.sin(a)*3.1);m.rotation.y=-a;m.scale.setScalar(orbKind==='goo3'?.65:.85);m.visible=true;
      }else detach(k,key);
    }
  }
}

function fireSignatureHype(k){
  k.hyperT=5.5;k.hypeMode=true;k.hype=0;k.sigUses=(k.sigUses||0)+1;k.cheerT=.9;
  const id=k.ch.id||'';
  if(id==='blaze'){for(const off of[-.16,0,.16]){const save=k.heading;k.heading+=off;launch(k,'fire',1);k.heading=save;}}
  else if(id==='jet'){k.hyperT=7.0;k.boostT=Math.max(k.boostT,2.4);}
  else if(id==='spark'){k.boostT=Math.max(k.boostT,2.0);if(k.driftDir)k.driftCharge=3.2;}
  else if(id==='rumble'){dholBlast(k);}
  else if(id==='goldie'){giveCoins(k,5);k.shieldT=Math.max(k.shieldT,8);}
  else if(id==='buzzy'){for(let b=0;b<2;b++){const tgt=G.battle?nearestFoe(k):(G.karts.find(o=>o.rank===Math.max(0,k.rank-1-b)&&o!==k&&!o.finished)||null);const m=new THREE.Mesh(beeGeo,vcPhong);scene.add(m);bees.push({m,owner:k,target:tgt,t:k.idx+3+b*2,lat:b?2:-2,x:k.x,y:k.y+2,z:k.z,life:9});}}
  else if(id==='volt'){k.tyresN=2;k.tyresT=15;for(const q of G.karts)if(q!==k&&!q.out&&Math.hypot(q.x-k.x,q.z-k.z)<18)q.stinkT=Math.max(q.stinkT||0,2.2);}
  else if(id==='brick'){k.jumboT=Math.max(k.jumboT||0,3.6);}
  else if(id==='pixie'){k.ghostT=Math.max(k.ghostT||0,3.2);const save=k.item;k.item='prank';useExtraItem(k,'prank');k.item=save;}
  else if(id==='zephyr'){k.boostT=Math.max(k.boostT,2.2);k.shieldT=Math.max(k.shieldT,10);}
  if(k.human){SFX.hype();say(k.pi,'⚡ '+k.ch.name.toUpperCase()+' SIGNATURE HYPE!',1.4);cams[k.pi].shake=.45;}
}

function drawThreatRadar(ctx,FW,FH){
  if(G.state!=='race')return;
  for(const k of G.humans_k){
    if(k.out||k.finished||k.respawnT>0)continue;
    const V=vpx(k.pi),threats=[];
    for(const b of bees){if(b.owner===k)continue;const d=Math.hypot(b.x-k.x,b.z-k.z);if(b.target===k||d<42)threats.push({x:b.x,z:b.z,d,lbl:'BEE!',col:'#ffd21f'});}
    for(const c of COMETS){if(c.tgt===k){const d=Math.hypot(c.x-k.x,c.z-k.z);threats.push({x:c.x,z:c.z,d,lbl:'COMET!',col:'#3ab0ff'});}}
    for(const s of STRIKES){if(s.bolt||s.x==null)continue;const d=Math.hypot(s.x-k.x,s.z-k.z);if(d<36)threats.push({x:s.x,z:s.z,d,lbl:'STRIKE!',col:'#ff4f6a'});}
    for(const q of G.karts){if(q===k||q.out||q.respawnT>0)continue;if(q.hyperT>0||q.jumboT>0||q.rocketT>0){const d=Math.hypot(q.x-k.x,q.z-k.z);if(d<44)threats.push({x:q.x,z:q.z,d,lbl:'RIVAL!',col:'#ff6ad8'});}}
    if(!threats.length)continue;
    threats.sort((a,b)=>a.d-b.d);
    if(threats[0].d<34){k.radarBeepCD=(k.radarBeepCD||0)-.016;if(k.radarBeepCD<=0){k.radarBeepCD=clamp(threats[0].d/95,.14,.42);tone(1180,.045,'square',.055);}}
    for(const th of threats.slice(0,2)){
      const ang=adiff(k.heading,Math.atan2(th.x-k.x,th.z-k.z));
      const behind=Math.abs(ang)>1.2;
      const sx=clamp(V.x+V.w*.5+Math.sin(ang)*V.w*.36,V.x+48,V.x+V.w-48);
      const sy=behind?V.y+V.h-28:V.y+34;
      const pulse=.65+.35*Math.sin(G.time*22);
      ctx.save();
      ctx.translate(sx,sy);
      ctx.fillStyle='rgba(26,15,43,.9)';ctx.strokeStyle=th.col;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,18*pulse+4,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle=th.col;ctx.font='bold 11px Bungee, Impact, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(th.lbl,0,-2);
      ctx.fillStyle='#fff4df';ctx.font='bold 9px Fredoka, sans-serif';
      ctx.fillText(Math.round(th.d)+'m',0,10);
      ctx.restore();
    }
  }
}

let TRACK_META={},TRACK_CATS=[
  {id:'all',name:'All'},
  {id:'new',name:'★ New 10'},
  {id:'tropical',name:'Nature & Wild'},
  {id:'urban',name:'Cities & Everyday'},
  {id:'cosmic',name:'Cosmic & Sky'},
  {id:'fantasy',name:'Spooky & Bonkers'},
  {id:'epic',name:'Special Epics'}
];
const ATLAS={view:'all',cat:'all',diff:0,q:''};

const WF_API_BRIDGE={
  get G(){return G;},get LV(){return LV;},get LR(){return LR;},get FT(){return FT;},get WFV2(){return window.WFV2;},
  Kart,makeKart,nameTag,refreshPreviewGarage,fmt,store,setCC:id=>window.WFV2&&WFV2.setCC(id),
  scene,cams,LEVELS,CUPS,ARENAS,CHARS,ITEMS,ICON,FEAT,TSTYLE,MUSIC,STRIKE_KINDS,
  THREE,R,rr,rng,clamp,lerp,toward,adiff,wrapI,N,ROAD,CURB,WALL,LIM,
  get SP(){return SP;},get TP(){return TP;},get TT(){return TT;},get TR(){return TR;},
  TA,H,GAP,CURV,SURF,WIND,LIPG,DIST,LW,HPL,HPR,TUN,BANK,UNFENCED,
  get GAPS(){return GAPS;},get levelRoot(){return levelRoot;},
  FX,SMOKE,burst,M,V3,V2,C,HDR,SPH,rbox,build,jitterGeo,lathe,ltex,canvasTex,
  addL,addSway,glowMat,addGlow,vcPhong,vcLambert,vcLambertDS,paintMat,skinMat,tyreMat,glossy,chrome,
  fgap,bestStraight,trackCentre,edge,groundAt,ribbon,wallRibbon,ngon,
  placeOK,placeNear,nearTrack,shadowSplit,groundPlane,scatter,roadRow,sideProp,meshOf,
  signTex,neonTex,boardAt,acrossStrings,bulbString,catenary,makeClouds,driftClouds,makeWeather,
  strataGeo,peakGeo,islandGeo,leafGeo,pedestal,roomBox,tileTex,trackTube,
  crossers,roadBumps,thrower,chaser,mergeLR,splat,brownSplat,
  hit,stink,shieldPop,giveCoins,strike,strikeAt,checkRAW,spk,boatTick,boatVisual,
  startLevel,buildLevel,setupRace,startRace,show,quit,newCup,cupOrder,showResults,showCup,say,
  useItem,useItemDir,launch,bombThrow,SFX,tone,noise,audioInit,
  get goos(){return goos;},get bees(){return bees;},get PROJS(){return PROJS;},get COMETS(){return COMETS;},
  gooGeo,tiffGeo,prankMat,boxGeo,beeGeo,shrinkRay,paintSplat,slowMotion,useExtraItem
};

if(typeof window.registerWheelieNewTracks==='function'){
  const reg=window.registerWheelieNewTracks(WF_API_BRIDGE)||{};
  if(reg.trackMeta)Object.assign(TRACK_META,reg.trackMeta);
  if(reg.categories)TRACK_CATS=reg.categories;
  if(reg.cups&&reg.cups.length&&reg.cups!==CUPS){const cp=reg.cups.slice();CUPS.length=0;cp.forEach(c=>CUPS.push(c));}
}
if(typeof window.registerWheelieV2==='function'){
  window.WFV2=window.registerWheelieV2(WF_API_BRIDGE);
}

function inferMeta(L){
  if(TRACK_META[L.id])return TRACK_META[L.id];
  const F=FEAT[L.id]||{},tags=[];
  if(L.laps===1)tags.push('1-Lap Epic');
  if(L.laps===4)tags.push('4 Seasons');
  if(L.random)tags.push('Procedural');
  if((L.surf||[]).some(s=>s[2]===3))tags.push('Boat');
  if(L.id==='sky'||L.id==='glider'||L.id==='dogfight')tags.push('Glider');
  if(L.unfenced)tags.push('Unfenced');
  if(F.cut)tags.push('Shortcut');
  if(F.cannon)tags.push('Cannon');
  if(F.pipe)tags.push('Half-Pipe');
  const cat=['lava','dino','jungle','aztec','beach','reef','forest','farm','connecticut','splash','dogfight'].includes(L.id)?'tropical':
    ['mumbai','manteca','streatham','kitchen','bathroom','supermarket'].includes(L.id)?'urban':
    ['sky','space','starship','glider','collider'].includes(L.id)?'cosmic':
    ['himalaya','seasons','random'].includes(L.id)?'epic':'fantasy';
  const diff=['space','scary','doomtemple','collider','dogfight','glider','starship'].includes(L.id)?3:['lava','beach','farm','kitchen','winter','connecticut'].includes(L.id)?1:2;
  return{cat,diff,tags:tags.slice(0,3),isNew:!!L.isNew};
}

function renderTrackAtlas(){
  const catsEl=$('#atlasCats');
  if(catsEl){
    catsEl.innerHTML=TRACK_CATS.map(c=>`<button class="chipBtn alt${ATLAS.cat===c.id?' on':''}" data-acat="${c.id}">${c.name}</button>`).join('');
  }
  document.querySelectorAll('#atlasTabs [data-av]').forEach(b=>b.classList.toggle('on',b.dataset.av===ATLAS.view));
  const sub=$('#atlasSub');if(sub)sub.textContent=`${CUPS.length} Grand Prix Cups · ${LEVELS.length} Tracks · ${G.timeTrial?'⏱ Time Trials (Solo + Staff Ghost)':G.deathNext?'Death Race (3 Balloons)':'Pick a 4-Race Cup or Single Track'}`;
  const g=$('#trkGrid');if(!g)return;
  const q=ATLAS.q.trim().toLowerCase();
  let html='';
  const showCups=!G.deathNext&&!G.timeTrial&&(ATLAS.view==='all'||ATLAS.view==='cups')&&ATLAS.cat==='all'&&!ATLAS.diff&&!q;
  g.classList.toggle('cupsView',ATLAS.view==='cups');
  if(showCups){
    CUPS.map((c,ci)=>ci).sort((a,b)=>(cupLocked(a)?1:0)-(cupLocked(b)?1:0)).forEach(ci=>{
      const c=CUPS[ci];
      const locked=cupLocked(ci);
      const t=trophyOf(c.id);const ordIdx=cupOrder(c);if(!ordIdx.length)return;
      const names=ordIdx.map(i=>LEVELS[i].name).join(' · ');
      if(locked){
        const prevName=ci>0?CUPS[ci-1].name:'the previous cup';
        html+=`<button class="trk cup locked" data-trk="${-1-ci}" disabled><svg viewBox="0 0 200 94"><rect width="200" height="94" fill="${c.col}" opacity=".5"/></svg><i class="lockBadge">🔒</i><b>${c.name}</b><span class="desc">${names}</span><em>Complete ${prevName} to unlock</em></button>`;
        return;
      }
      html+=`<button class="trk cup" data-trk="${-1-ci}"><svg viewBox="0 0 200 94"><rect width="200" height="94" fill="${c.col}"/><g transform="translate(68 14) scale(1)">${TROPHY(t?TCOL[t-1]:'#ffb22e')}</g></svg><b>🏆 ${c.name}</b><span class="desc">${names}</span><em>${t?['Gold','Silver','Bronze'][t-1]+' trophy won':'4-Race Cup · No trophy yet'}</em></button>`;
    });
  }
  if(ATLAS.view==='all'||ATLAS.view==='tracks'||G.timeTrial||q||ATLAS.cat!=='all'||ATLAS.diff){
    LEVELS.map((L,i)=>i).sort((a,b)=>(trackLocked(LEVELS[a])?1:0)-(trackLocked(LEVELS[b])?1:0)).forEach(i=>{
      const L=LEVELS[i];
      const m=inferMeta(L);
      if(ATLAS.cat==='new'&&!m.isNew)return;
      if(ATLAS.cat!=='all'&&ATLAS.cat!=='new'&&m.cat!==ATLAS.cat)return;
      if(ATLAS.diff&&m.diff!==ATLAS.diff)return;
      if(q&&!(L.name.toLowerCase().includes(q)||L.tag.toLowerCase().includes(q)||L.mech.toLowerCase().includes(q)||(m.tags||[]).some(t=>t.toLowerCase().includes(q))))return;
      const locked=trackLocked(L);
      if(locked){
        const ci=trackCupIndex(L.id);const cupName=ci>=0?CUPS[ci].name:'its cup';
        html+=`<button class="trk locked" data-trk="${i}" disabled><svg viewBox="0 0 200 94"><rect width="200" height="94" fill="#15101c" opacity=".6"/></svg><i class="lockBadge">🔒</i><b>${L.name}</b><span class="desc">${L.tag}</span><em>Unlock via ${cupName}</em></button>`;
        return;
      }
      const b=getBest(L);
      const stars='★'.repeat(m.diff||2)+'☆'.repeat(3-(m.diff||2));
      const chips=(m.isNew?'<i class="tTag new">NEW</i>':'')+(m.tags||[]).slice(0,3).map(t=>`<i class="tTag">${t}</i>`).join('')+`<i class="tTag stars">${stars}</i>`;
      html+=`<button class="trk" data-trk="${i}">${L.random?'<svg viewBox="0 0 200 94"><defs><linearGradient id="grnd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fd8"/><stop offset=".5" stop-color="#9f3dff"/><stop offset="1" stop-color="#26d3d0"/></linearGradient></defs><rect width="200" height="94" fill="url(#grnd)"/><text x="100" y="74" text-anchor="middle" font-family="Bungee,Impact" font-size="72" fill="#fff" opacity=".92">?</text></svg>':trackSVG(L)}<b>${L.random?'Mystery Track':L.name}</b><span class="desc">${L.tag}</span><div class="trkMeta">${chips}</div><em>${isFinite(b)?'⏱ Best '+fmt(b):L.mech}</em></button>`;
    });
  }
  if(!html)html='<div class="card" style="grid-column:1/-1;text-align:center"><p style="margin:0 auto">No tracks match that filter. Try clearing the search or category!</p></div>';
  g.innerHTML=html;
  G.focus=0;refreshFocus();
}
const _ab=$('#atlasBar');if(_ab)_ab.addEventListener('click',e=>{
  const av=e.target.closest('[data-av]');if(av){ATLAS.view=av.dataset.av;renderTrackAtlas();return;}
  const ac=e.target.closest('[data-acat]');if(ac){ATLAS.cat=ac.dataset.acat;if(ATLAS.cat!=='all'&&ATLAS.view==='cups')ATLAS.view='tracks';renderTrackAtlas();return;}
});
const _ad=$('#atlasDiff');if(_ad)_ad.addEventListener('change',e=>{ATLAS.diff=+e.target.value||0;if(ATLAS.diff&&ATLAS.view==='cups')ATLAS.view='tracks';renderTrackAtlas();});
const _aq=$('#atlasQ');if(_aq)_aq.addEventListener('input',e=>{ATLAS.q=e.target.value||'';if(ATLAS.q&&ATLAS.view==='cups')ATLAS.view='tracks';renderTrackAtlas();});
"""
    html = must_replace(html, "HDR_BASE.n=HDRS.length;", new_subsystems + "\nHDR_BASE.n=HDRS.length;", "inject_subsystems")

    html = must_replace(
        html,
        "show('title');updatePadInfo();applyQuality();updateShelf();phoneConnect();diffLabel();",
        "show('title');updatePadInfo();applyQuality();updateShelf();phoneConnect();diffLabel();updateItemsBtn();if(window.WFOnline)WFOnline.init(WF_API_BRIDGE);",
        "boot_init_hooks",
    )

    old_tiki_export = "window.__tiki={ev:s=>eval(s),hit,"
    new_tiki_export = "window.__tiki={ev:s=>eval(s),WF_API_BRIDGE,get WFV2(){return window.WFV2;},CUPS,say,SKIDS,BANK,UNFENCED,ATLAS,TRACK_META,renderTrackAtlas,startTrailItem,releaseTrailItem,useItemDir,fireSignatureHype,cycleItemsMode,hit,"
    html = must_replace(html, old_tiki_export, new_tiki_export, "tiki_exports")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Built upgraded {OUT}: {len(html)} bytes ({html.count(chr(10))} lines)")


if __name__ == "__main__":
    build()
