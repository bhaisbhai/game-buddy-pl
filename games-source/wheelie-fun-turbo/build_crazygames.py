#!/usr/bin/env python3
"""Builds wheelie-fun-crazygames.html: wheelie-fun-standalone.html plus the CrazyGames SDK script
tag and a save-data bridge. The game's own code (original_index.html) already calls the SDK's
init/gameplayStart/gameplayStop methods, but only when window.CrazyGames exists -- so the regular
standalone build stays dependency-free, and this is the one file that actually loads their SDK.
Run build_standalone.py first. Usage: python build_crazygames.py"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "wheelie-fun-standalone.html"
SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'
ANCHOR = '<meta charset="utf-8">'

# The game's progression/settings keys. Everything the game persists goes through
# localStorage one way or another (either the main script's store.get/set wrapper, or a
# couple of call sites -- the online display name -- that hit localStorage directly), so the
# save-data bridge below patches Storage.prototype itself rather than needing every call site
# updated. CUP_IDS/TRACK_IDS generate the per-cup trophy and per-track best-lap keys; update
# these two lists if cups or tracks are ever added, renamed, or removed.
CUP_IDS = [
    "wheeldeal", "home", "wild", "holiday", "adventure", "spooky", "everyday", "bonkers",
    "feast", "neon", "summit",
]
TRACK_IDS = [
    "lava", "mumbai", "himalaya", "sky", "manteca", "streatham", "dino", "jungle", "space",
    "kitchen", "bathroom", "aztec", "beach", "winter", "pinball", "reef", "forest", "starship",
    "glider", "random", "cookie", "seasons", "circus", "cats", "scary", "supermarket",
    "pumpkins", "connecticut", "farm", "gut", "collider", "doomtemple", "splash", "dogfight",
    "rainbow", "clockwork", "ramen", "tokyo", "mtmayhem", "vinyl", "origami", "crystal",
    "coaster", "pizza",
]
FIXED_KEYS = [
    "wheeliefun.unlockedCups", "wheeliefun.diff", "wheeliefun.cc", "wheeliefun.items",
    "tikiturbo.gfx", "wheeliefun.frame", "wheeliefun.tire", "wheeliefun.glider",
    "wheeliefun.goldSkin", "wheeliefun.garageSeen", "wheeliefun.seenCtrlTut", "wheeliefun.vault",
    "wheeliefun.unlockAll", "wheeliefun.onlineName", "tikiturbo.bestlap",
]

SAVE_BRIDGE_TAG = """<script>
// CrazyGames save-data bridge: makes the game's persisted keys (unlocked cups/racers, trophies,
// best times, garage parts, vault coins, settings) round-trip through CrazyGames' cross-device
// cloud save (CrazyGames.SDK.data), so progress survives a cleared cache or a different device
// or browser -- without touching any of the game's own store.get/set calls. It works by patching
// Storage.prototype itself (installed before any other script on the page runs), which also
// catches the couple of call sites that read/write localStorage directly (the online display
// name). A player's existing local-only progress is left alone the first time this runs (the
// cloud has nothing to overwrite it with yet) and starts mirroring to the cloud from their next
// write onward. No-op entirely off CrazyGames (window.CrazyGames undefined), so the regular
// build this is based on is untouched.
(function(){
if(!window.CrazyGames)return;
var PREFIXES=['wheeliefun.','tikiturbo.'];
function relevant(k){return typeof k==='string'&&PREFIXES.some(function(p){return k.indexOf(p)===0;});}
var cache=Object.create(null),ready=false;
var nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem;
Storage.prototype.getItem=function(key){
  if(this===window.localStorage&&ready&&relevant(key)&&Object.prototype.hasOwnProperty.call(cache,key))return cache[key];
  return nativeGet.call(this,key);
};
Storage.prototype.setItem=function(key,value){
  nativeSet.call(this,key,value);
  if(this===window.localStorage&&relevant(key)){
    cache[key]=value;
    if(ready){try{CrazyGames.SDK.data.setItem(key,value);}catch(e){}}
  }
};
var KEYS=__KEYS__;
CrazyGames.SDK.init().then(function(){
  KEYS.forEach(function(k){
    if(Object.prototype.hasOwnProperty.call(cache,k))return; // a local write already landed for this key during the wait above -- it wins over a stale cloud read
    try{var v=CrazyGames.SDK.data.getItem(k);if(v!=null)cache[k]=v;}catch(e){}
  });
  ready=true;
  // the title screen's trophy shelf may have already rendered from local-only data before the
  // cloud pull above landed -- refresh it now. Garage part choices and graphics quality are
  // cached once at boot and aren't worth a full reflow for what's a cosmetic mismatch at worst.
  try{if(window.__tiki)window.__tiki.ev('if(typeof updateShelf==="function")updateShelf();');}catch(e){}
}).catch(function(){});
})();
</script>"""


def main() -> None:
    html = SRC.read_text(encoding="utf-8")
    assert html.count(ANCHOR) == 1, "charset meta tag not found"
    assert SDK_TAG not in html, "SDK tag already present"
    keys = FIXED_KEYS + ["wheeliefun.trophy." + c for c in CUP_IDS] + ["wheeliefun.best." + t for t in TRACK_IDS]
    # repr() of a list of plain strings (none contain a quote) is also valid JS array syntax.
    bridge = SAVE_BRIDGE_TAG.replace("__KEYS__", repr(keys))
    html = html.replace(
        ANCHOR,
        ANCHOR + "\n<!-- Load the SDK before the game code -->\n" + SDK_TAG
        + "\n<!-- Cross-device cloud save, also before the game code -->\n" + bridge,
        1,
    )
    out = ROOT / "wheelie-fun-crazygames.html"
    out.write_text(html, encoding="utf-8", newline="")
    print(f"Built {out.name} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
