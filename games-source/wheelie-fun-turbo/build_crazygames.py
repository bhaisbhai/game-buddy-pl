#!/usr/bin/env python3
"""Builds wheelie-fun.html, the single file that ships everywhere: our own site, any other host, and
the CrazyGames portal. It is wheelie-fun-standalone.html plus a save-data adapter that checks where
it is running and loads the CrazyGames SDK only on CrazyGames -- everywhere else it never touches
their servers and saves stay in the browser, exactly like the plain standalone build.
Run build_standalone.py first. Usage: python build_crazygames.py"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "wheelie-fun-standalone.html"
OUT_NAME = "wheelie-fun.html"
SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js"
SDK_TAG = f'<script src="{SDK_URL}"></script>'
ANCHOR = '<meta charset="utf-8">'

# The game's progression/settings keys. Everything the game persists routes through
# window.WFSave.storage (original_index.html and online_client.js both call it instead of
# localStorage directly), so the save-data bridge below only needs to know which keys exist --
# it never has to patch Storage.prototype. CUP_IDS/TRACK_IDS generate the per-cup trophy and
# per-track best-lap keys; update these two lists if cups or tracks are ever added, renamed, or
# removed.
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
    "wheeliefun.garageSeen", "wheeliefun.seenCtrlTut", "wheeliefun.onlineName", "tikiturbo.bestlap",
]

SAVE_BRIDGE_TAG = r"""<script>// Game-owned adapter: never patch Storage.prototype (the SDK may use it internally).
// Exposes window.WFSave = {storage, ready, sdkReady, flush, message} -- original_index.html's
// boot sequence awaits WFSave.ready (bounded by its own 8s timeout, independent of this file) and
// routes every persisted key through WFSave.storage instead of localStorage directly. Off
// CrazyGames (window.CrazyGames undefined) storage is just localStorage and ready resolves at
// once, so the regular build this is based on behaves exactly as before. On CrazyGames, keys are
// mirrored through CrazyGames.SDK.data (a cross-device cloud store that can't enumerate its own
// keys), tracked via a small index key of its own (INDEX) so they can be found again later; writes
// queue in `pending` and are merged against the last-known cloud value with per-key semantics
// (merge()) rather than blindly overwritten, and a failed flush retries every 2s with a status
// message rather than silently dropping the write. A one-time migration folds any pre-existing
// local-only progress into the cloud the first time a player is seen there. Ghost-replay keys
// (wheeliefun.ghost.*) are deliberately left local-only -- they're sizeable and the cloud store
// has a ~1MB cap, and the game's manual Ghost Code export/import already covers sharing one.
(function(){
'use strict';
// One file runs everywhere, so only a page actually on CrazyGames loads their SDK. They serve the
// game inside an iframe on a crazygames.com host; the parent-origin and referrer checks cover any
// other domain they serve it from. A downloaded file is never a CrazyGames environment.
const SDK_URL='__SDK_URL__';
const ON_CG=(function(){try{
 if(location.protocol==='file:')return false;
 const cg=/^([^.]+\.)*crazygames\.(com|io)$/i;
 if(cg.test(location.hostname))return true;
 const ao=location.ancestorOrigins;
 if(ao)for(let i=0;i<ao.length;i++){try{if(cg.test(new URL(ao[i]).hostname))return true}catch(e){}}
 return !!document.referrer&&cg.test(new URL(document.referrer).hostname);
}catch(e){return false}})();
let sdk=null;
// Resolves null if the SDK can't load (an ad blocker, no connection): the game then just plays
// with browser saves instead of retrying forever.
function loadSdk(){
 if(window.CrazyGames&&window.CrazyGames.SDK)return Promise.resolve(window.CrazyGames.SDK);
 return new Promise(res=>{const s=document.createElement('script');s.src=SDK_URL;
  s.onload=()=>res(window.CrazyGames&&window.CrazyGames.SDK||null);s.onerror=()=>res(null);
  (document.head||document.documentElement).appendChild(s);});
}
const INDEX='__wheeliefun_keys_v1', MIGRATED='__wheeliefun_migrated_v1';
const KNOWN=__KEYS__;
const pending=new Map();let active=false,timer=null,resolveReady;
const boot=new Promise(r=>resolveReady=r);
function relevant(k){return /^(wheeliefun\.|tikiturbo\.)/.test(k)}
function local(){return window.localStorage}
function status(message){
 window.WFSave.message=message;
 if(!window.document)return;
 let el=document.getElementById('wfSaveStatus');
 if(!el&&document.body){el=document.createElement('div');el.id='wfSaveStatus';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;background:#241737;color:white;padding:8px;border-radius:8px;font:14px sans-serif;max-width:90vw';document.body.appendChild(el)}
 if(el){el.textContent=message;el.hidden=!message}
}
function merge(k,a,b){
 if(a==null)return b;if(b==null)return a;
 if(k==='wheeliefun.unlockedCups')return String(Math.max(+a||1,+b||1));
 if(/^wheeliefun\.trophy\./.test(k)){const v=[+a,+b].filter(n=>Number.isFinite(n)&&n>0);return v.length?String(Math.min(...v)):b}
 if(/^wheeliefun\.best\./.test(k)||k==='tikiturbo.bestlap'){const v=[+a,+b].filter(n=>Number.isFinite(n)&&n>0);return v.length?String(Math.min(...v)):b}
 if(/^wheeliefun\.ghost\./.test(k)){try{const x=JSON.parse(a),y=JSON.parse(b);if(Number.isFinite(x.t)&&x.t>0&&(!Number.isFinite(y.t)||y.t<=0||x.t<=y.t))return a}catch(e){}return b}
 if(/\.(seenCtrlTut|garageSeen|moved)$/.test(k))return a==='1'||b==='1'?'1':b;
 return b;
}
function index(){const raw=sdk.data.getItem(INDEX);if(raw==null)return [...KNOWN];const a=JSON.parse(raw);if(!Array.isArray(a))throw Error('Invalid save index');return [...new Set([...KNOWN,...a.filter(k=>typeof k==='string'&&relevant(k))])]}
function retry(){if(!timer)timer=setTimeout(()=>{timer=null;flush()},2000)}
function flush(){
 if(!active)return;
 for(const [k,v] of pending){try{
  const keys=new Set(index());keys.add(k);
  // Register first: if a later write fails, the retry can still discover this key.
  sdk.data.setItem(INDEX,JSON.stringify([...keys]));
  if(v===null)sdk.data.removeItem(k);else sdk.data.setItem(k,merge(k,sdk.data.getItem(k),v));
  pending.delete(k);
 }catch(e){status('Save pending — retrying. Keep this game open.');retry();return}}
 status('');
}
const storage={
 getItem(key){const k=String(key);if(!sdk||!relevant(k))return local().getItem(k);
  if(!active)return pending.has(k)?pending.get(k):null;
  const value=sdk.data.getItem(k);return pending.has(k)?(pending.get(k)===null?null:merge(k,value,pending.get(k))):value;
 },
 setItem(key,value){const k=String(key),v=String(value);if(!sdk||!relevant(k)){local().setItem(k,v);return}pending.set(k,pending.has(k)&&pending.get(k)!==null?merge(k,pending.get(k),v):v);flush()},
 removeItem(key){const k=String(key);if(!sdk||!relevant(k)){local().removeItem(k);return}pending.set(k,null);flush()},
 clear(){if(!sdk){local().clear();return}const keys=new Set([...index(),...pending.keys()]);for(const k of keys)pending.set(k,null);flush()},
 key(n){return storage.keys()[n]??null},
 keys(){const keys=new Set();try{for(let n=0;n<local().length;n++){const k=local().key(n);if(!sdk||!relevant(k))keys.add(k)}}catch(e){}if(active)for(const k of index())if(storage.getItem(k)!==null)keys.add(k);for(const [k,v] of pending)if(v!==null)keys.add(k);return [...keys]},
 get length(){return storage.keys().length}
};
window.WFSave={storage,ready:boot,sdkReady:false,flush,message:'',onCrazyGames:ON_CG};
async function initialize(){
 try{
  if(ON_CG&&!sdk)sdk=await loadSdk();
  if(sdk){
   if(sdk.environment==='disabled'){sdk=null;resolveReady();return}
   await sdk.init();
   if(sdk.environment==='disabled'){sdk=null;resolveReady();return}
   // Verify Data access before allowing the game to create defaults.
   sdk.data.getItem(INDEX);active=true;
   let migrated=false;try{migrated=local().getItem(MIGRATED)==='1'}catch(e){}
   if(!migrated){
    const legacy=[];try{for(let n=0;n<local().length;n++){const k=local().key(n);if(relevant(k))legacy.push([k,local().getItem(k)])}}catch(e){}
    for(const [k,v] of legacy){const remote=sdk.data.getItem(k);const merged=merge(k,v,remote);if(!pending.has(k))pending.set(k,merged);else pending.set(k,merge(k,merged,pending.get(k)))}
    flush();if(pending.size)throw Error('Migration pending');
    try{local().setItem(MIGRATED,'1')}catch(e){}
   }
   flush();
   if(sdk.user&&typeof sdk.user.addAuthListener==='function')sdk.user.addAuthListener(()=>{active=false;pending.clear();status('Account changed — loading your progress…');window.location.reload()});
   window.WFSave.sdkReady=true;
  }
  resolveReady();
 }catch(e){active=false;status('Could not load your saved progress — retrying…');setTimeout(initialize,2000)}
}
initialize();
})();
</script>"""


def main() -> None:
    html = SRC.read_text(encoding="utf-8")
    assert html.count(ANCHOR) == 1, "charset meta tag not found"
    assert SDK_URL not in html, "SDK already referenced"
    keys = FIXED_KEYS + ["wheeliefun.trophy." + c for c in CUP_IDS] + ["wheeliefun.best." + t for t in TRACK_IDS]
    # repr() of a list of plain strings (none contain a quote) is also valid JS array syntax.
    bridge = SAVE_BRIDGE_TAG.replace("__KEYS__", repr(keys)).replace("__SDK_URL__", SDK_URL)
    html = html.replace(
        ANCHOR,
        ANCHOR + "\n<!-- Save adapter: loads the CrazyGames SDK only when running on CrazyGames; game startup awaits it. -->\n" + bridge,
        1,
    )
    out = ROOT / OUT_NAME
    out.write_text(html, encoding="utf-8", newline="")
    print(f"Built {out.name} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
