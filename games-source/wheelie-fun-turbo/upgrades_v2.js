/*
 * Wheelie Fun — Next-Gen Mario Kart Expansion (upgrades_v2.js)
 *
 * Implements:
 *   1. Speed Classes (50cc / 100cc / 150cc / 200cc + Brake-Drifting) & 150cc Mirror Mode
 *   2. Kart Customization Garage (4 Frames × 4 Tire Sets × 4 Gliders + Golden Chassis Skin)
 *   3. Time Trials Mode + 10Hz Playable Ghost Replays + Dev Staff Ghosts + Shareable Ghost Codes
 *   4. True Anti-Gravity Zones (Hover-Wheel Transformation + Spin-Boost Bumpers & Kart Spin-Boosts)
 *   5. Next-Gen Shaders: Procedural Road Normal Maps, Stylized Rim-Light Kart Shader & 3D GPU Ribbon Trails
 *   6. MK8 "Frontrunning" Dynamic Music Layer, Character Voice Barks, Crowd Roars, TV Replay Cams & Coin Vault Unlocks
 */
(function () {
  'use strict';

  // ==========================================================================
  // 1. SPEED CLASSES & MIRROR MODE
  // ==========================================================================
  const CC_ORDER = ['50cc', '100cc', '150cc', '200cc', 'mirror'];
  const CC_CONFIG = {
    '50cc':   { id: '50cc',   label: '50cc',         spd: 0.84, acc: 0.92, off: 1.22, mirror: false, brakeDrift: false },
    '100cc':  { id: '100cc',  label: '100cc',        spd: 0.95, acc: 0.98, off: 1.06, mirror: false, brakeDrift: false },
    '150cc':  { id: '150cc',  label: '150cc',        spd: 1.05, acc: 1.04, off: 1.00, mirror: false, brakeDrift: true  },
    '200cc':  { id: '200cc',  label: '200cc',        spd: 1.36, acc: 1.24, off: 1.00, mirror: false, brakeDrift: true  },
    'mirror': { id: 'mirror', label: 'Mirror 150cc', spd: 1.05, acc: 1.04, off: 1.00, mirror: true,  brakeDrift: true  },
  };

  // ==========================================================================
  // 2. KART CUSTOMIZATION GARAGE (FRAMES, TIRES, GLIDERS)
  // ==========================================================================
  const GARAGE_FRAMES = [
    { id: 'buggy',  name: 'Tiki Buggy',  blurb: 'Balanced classic pipe-frame', spd: 1.00, acc: 1.00, hand: 1.00, wt: 1.00, mt: 1.00, inside: false },
    { id: 'moto',   name: 'Cyber Moto',  blurb: 'Inside-drift sportbike · razor apexes', spd: 1.03, acc: 1.05, hand: 1.18, wt: 0.82, mt: 1.10, inside: true },
    { id: 'coupe',  name: 'Mach GT',     blurb: 'Aero supercar · blistering top speed', spd: 1.08, acc: 0.90, hand: 0.94, wt: 1.18, mt: 0.95, inside: false },
    { id: 'bumble', name: 'Bumble Pod',  blurb: 'Turbo pod · snappy accel & mini-turbo', spd: 0.96, acc: 1.14, hand: 1.08, wt: 0.90, mt: 1.22, inside: false },
  ];

  const GARAGE_TIRES = [
    { id: 'standard', name: 'Standard',    blurb: 'All-round street grip', spd: 1.00, acc: 1.00, hand: 1.00, off: 0.52, chg: 1.00, sc: 1.00, wide: 1.00, rim: 0xd8dbe3 },
    { id: 'slick',    name: 'Neon Slicks', blurb: 'High-speed asphalt slicks', spd: 1.06, acc: 0.95, hand: 1.04, off: 0.44, chg: 1.00, sc: 1.04, wide: 1.28, rim: 0x26d3d0 },
    { id: 'monster',  name: 'Monster Off-Road', blurb: 'Shrugs off grass, mud & sand!', spd: 0.97, acc: 0.94, hand: 0.94, off: 0.82, chg: 0.95, sc: 1.38, wide: 1.35, rim: 0xffb22e },
    { id: 'roller',   name: 'Mini Rollers', blurb: '+20% faster drift spark charge!', spd: 0.94, acc: 1.14, hand: 1.14, off: 0.58, chg: 1.22, sc: 0.72, wide: 0.92, rim: 0xff5b1f },
  ];

  const GARAGE_GLIDERS = [
    { id: 'delta', name: 'Delta Wing',    blurb: 'Balanced hang-glider', airTurn: 1.00, sink: 1.00, trickB: 1.00, col: null },
    { id: 'crane', name: 'Origami Crane', blurb: 'Floats longer + nimble air turns', airTurn: 1.28, sink: 0.80, trickB: 1.08, col: 0xfff4df },
    { id: 'cloud', name: 'Nimbus Chute',  blurb: 'Puffy cloud canopy · +18% trick boost', airTurn: 1.15, sink: 0.76, trickB: 1.18, col: 0x8fe9ff },
    { id: 'jet',   name: 'Plasma Wing',   blurb: 'Fastest air dive & sky-ring surge', airTurn: 0.96, sink: 1.10, trickB: 1.12, col: 0xff4fd8 },
  ];

  // Default anti-gravity spans for futuristic / vertical / rollercoaster tracks
  const DEFAULT_ANTIGRAV = {
    rainbow:   [[0.06, 0.32], [0.52, 0.74]],
    space:     [[0.04, 0.96]],
    starship:  [[0.12, 0.30], [0.58, 0.80]],
    collider:  [[0.08, 0.42], [0.58, 0.90]],
    pinball:   [[0.14, 0.42]],
    clockwork: [[0.20, 0.46]],
    tokyo:     [[0.36, 0.60]],
    crystal:   [[0.48, 0.72]],
    coaster:   [[0.10, 0.32]],
    vinyl:     [[0.28, 0.54]],
  };

  window.registerWheelieV2 = function (api) {
    const {
      THREE, G, scene, cams, CHARS, LEVELS, CUPS, FEAT,
      clamp, lerp, toward, adiff, wrapI, R, rr, rng, fmt, store,
      N, ROAD, CURB, WALL, LIM, TA, H, GAP, CURV, SURF, DIST, LW, TUN, BANK, UNFENCED,
      M, V3, C, HDR, SPH, rbox, build, canvasTex, ltex, addL,
      paintMat, skinMat, tyreMat, vcPhong, vcLambert, FX, SMOKE, burst,
      tone, noise, SFX, say,
    } = api;

    // ------------------------------------------------------------------------
    // Persistent State: Speed Class, Garage Loadout & Coin Vault Unlocks
    // ------------------------------------------------------------------------
    let curCC = store.get('wheeliefun.cc') || '150cc';
    if (!CC_CONFIG[curCC]) curCC = '150cc';

    // Saved part index -> valid index; corrupt or missing values fall back to the first part.
    const savedIdx = (key, len) => {
      const n = parseInt(store.get(key) || '0', 10);
      return Number.isFinite(n) ? ((n % len) + len) % len : 0;
    };
    const loadout = {
      frame: savedIdx('wheeliefun.frame', GARAGE_FRAMES.length),
      tire: savedIdx('wheeliefun.tire', GARAGE_TIRES.length),
      glider: savedIdx('wheeliefun.glider', GARAGE_GLIDERS.length),
      goldSkin: store.get('wheeliefun.goldSkin') === '1',
    };

    const GOLD_COINS = 50;
    const VAULT = {
      get coins() { return parseInt(store.get('wheeliefun.vault') || '0', 10) || 0; },
      set coins(v) { store.set('wheeliefun.vault', String(Math.max(0, Math.floor(v)))); },
      get unlockedAll() { return store.get('wheeliefun.unlockAll') === '1'; },
      set unlockedAll(v) { store.set('wheeliefun.unlockAll', v ? '1' : '0'); },
      add(n) { this.coins = this.coins + n; updateVaultUI(); },
      hasGoldKart() { return this.unlockedAll || this.coins >= GOLD_COINS; },
      hasPlasmaTrails() { return this.unlockedAll || this.coins >= 100; },
      hasMasterBadge() { return this.unlockedAll || this.coins >= 150; },
      unlockAll() { this.unlockedAll = true; this.coins = Math.max(this.coins, 200); updateVaultUI(); },
    };

    function getCC() { return CC_CONFIG[curCC] || CC_CONFIG['150cc']; }
    function setCC(id) {
      if (!CC_CONFIG[id]) return;
      curCC = id;
      G.cc = id;
      G.mirror = !!CC_CONFIG[id].mirror;
      store.set('wheeliefun.cc', id);
      updateCCButtons();
    }
    function cycleCC() {
      const idx = (CC_ORDER.indexOf(curCC) + 1) % CC_ORDER.length;
      setCC(CC_ORDER[idx]);
    }
    function updateCCButtons() {
      const cfg = getCC();
      const b = document.getElementById('ccBtn');
      if (b) b.textContent = 'Class: ' + cfg.label;
      const ab = document.getElementById('atlasCcBtn');
      if (ab) ab.textContent = (cfg.mirror ? '🪞 ' : '⚡ ') + cfg.label;
    }
    function updateVaultUI() {
      const el = document.getElementById('vaultBadge');
      if (!el) return;
      const c = VAULT.coins;
      const perks = [];
      if (VAULT.hasGoldKart()) perks.push('✨ Gold Chassis');
      if (VAULT.hasPlasmaTrails()) perks.push('⚡ Plasma Trails');
      if (VAULT.hasMasterBadge()) perks.push('👑 200cc Ace');
      el.innerHTML = `🪙 Vault: <b>${c}</b> coins` + (perks.length ? ` · Unlocked: <b>${perks.join(' · ')}</b>` : ' · <i>50🪙 unlocks Gold Chassis!</i>');
    }

    G.cc = curCC;
    G.mirror = !!CC_CONFIG[curCC].mirror;

    // ------------------------------------------------------------------------
    // 6A. Stylized Rim-Light Pop Shader on Karts & Drivers
    // ------------------------------------------------------------------------
    const goldPaintMat = new THREE.MeshStandardMaterial({
      color: 0xffd24a, roughness: 0.16, metalness: 0.88,
      envMap: paintMat.envMap, envMapIntensity: 1.75,
    });

    function enhanceKartShader(mat, rimStrength) {
      mat.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <dithering_fragment>',
          `vec3 vDirRim = normalize(vViewPosition);
           float rimF = pow(1.0 - clamp(abs(dot(normalize(normal), vDirRim)), 0.0, 1.0), 2.8);
           gl_FragColor.rgb += vec3(0.95, 0.92, 1.0) * (rimF * ${rimStrength.toFixed(3)});
           #include <dithering_fragment>`
        );
      };
      mat.needsUpdate = true;
    }
    enhanceKartShader(paintMat, 0.28);
    enhanceKartShader(skinMat, 0.20);
    enhanceKartShader(goldPaintMat, 0.34);

    // ------------------------------------------------------------------------
    // 6B. Procedural Tangent-Space Road Normal Map Generator
    // ------------------------------------------------------------------------
    function makeRoadNormalTex(th) {
      return ltex(128, 128, (ctx, w, h) => {
        const img = ctx.createImageData(w, h);
        const d = img.data;
        const r2 = rng(19);
        const hmap = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) hmap[i] = (r2() - 0.5) * 0.55;
        if (th && th.tiles) {
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (y % 32 < 2 || ((x + ((y >> 5) % 2) * 21) % 42) < 2) {
                hmap[y * w + x] -= 0.85;
              }
            }
          }
        }
        for (let y = 0; y < h; y++) {
          const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, yc = y * w;
          for (let x = 0; x < w; x++) {
            const xm = (x - 1 + w) % w, xp = (x + 1) % w;
            const nx = (hmap[yc + xm] - hmap[yc + xp]) * 0.65;
            const ny = (hmap[ym + x] - hmap[yp + x]) * 0.65;
            const o = (yc + x) * 4;
            d[o]     = clamp(Math.round(128 + nx * 127), 0, 255);
            d[o + 1] = clamp(Math.round(128 + ny * 127), 0, 255);
            d[o + 2] = 245;
            d[o + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      }, true);
    }

    // ------------------------------------------------------------------------
    // 6C. Continuous 3D GPU Ribbon Trails (Boost Exhaust + Glider Contrails)
    // ------------------------------------------------------------------------
    const RIBBONS = (() => {
      const MAXQ = 1400;
      const pos = new Float32Array(MAXQ * 18);
      const col = new Float32Array(MAXQ * 24);
      const life = new Float32Array(MAXQ).fill(0);
      const ttl = new Float32Array(MAXQ).fill(1);
      const a0 = new Float32Array(MAXQ).fill(0);
      const g = new THREE.BufferGeometry();
      const pa = new THREE.BufferAttribute(pos, 3);
      const ca = new THREE.BufferAttribute(col, 4);
      pa.setUsage(THREE.DynamicDrawUsage);
      ca.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', pa);
      g.setAttribute('rgba', ca);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: 'attribute vec4 rgba;varying vec4 vC;void main(){vC=rgba;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'varying vec4 vC;void main(){if(vC.a<=.005)discard;gl_FragColor=vC;}',
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      let head = 0, segCount = 0;

      function addQuad(p0, p1, rx, ry, rz, w, r, gg, b, alpha, dur) {
        const idx = head;
        head = (head + 1) % MAXQ;
        segCount++;
        life[idx] = dur;
        ttl[idx] = dur;
        a0[idx] = alpha;
        const hw = w * 0.5;
        const ax = p0[0] - rx * hw, ay = p0[1] - ry * hw, az = p0[2] - rz * hw;
        const bx = p0[0] + rx * hw, by = p0[1] + ry * hw, bz = p0[2] + rz * hw;
        const cx = p1[0] - rx * hw, cy = p1[1] - ry * hw, cz = p1[2] - rz * hw;
        const dx = p1[0] + rx * hw, dy = p1[1] + ry * hw, dz = p1[2] + rz * hw;
        const V = [ax, ay, az, bx, by, bz, cx, cy, cz, cx, cy, cz, bx, by, bz, dx, dy, dz];
        pos.set(V, idx * 18);
        const co = idx * 24;
        for (let v = 0; v < 6; v++) {
          col[co + v * 4] = r;
          col[co + v * 4 + 1] = gg;
          col[co + v * 4 + 2] = b;
          col[co + v * 4 + 3] = alpha;
        }
      }

      return {
        mesh,
        get count() { return segCount; },
        clear() {
          pos.fill(0); col.fill(0); life.fill(0); segCount = 0;
          pa.needsUpdate = ca.needsUpdate = true;
          for (const k of G.karts) { k._ribL = k._ribR = k._wingL = k._wingR = null; }
        },
        emitKart(k) {
          if (k.respawnT > 0 || k.out || !k.v || !k.v.root.visible) {
            k._ribL = k._ribR = k._wingL = k._wingR = null;
            return;
          }
          const sx = Math.sin(k.heading), cx = Math.cos(k.heading), rx = -cx, rz = sx;
          const boosting = k.boostT > 0 || k.hyperT > 0 || (k.spinBoostT || 0) > 0;
          if (boosting && Math.abs(k.speed) > 12) {
            const plasma = VAULT.hasPlasmaTrails() || (k.spinBoostT || 0) > 0 || k.antiGrav;
            const c = k.hyperT > 0
              ? new THREE.Color().setHSL((G.time * 2.2) % 1, 1, 0.6)
              : plasma ? new THREE.Color(0.2, 0.92, 1.0) : new THREE.Color(1.0, 0.52, 0.14);
            const ex = k.x - sx * 2.65, ez = k.z - cx * 2.65, ey = k.y + 1.28;
            const pL = [ex - rx * 0.55, ey, ez - rz * 0.55];
            const pR = [ex + rx * 0.55, ey, ez + rz * 0.55];
            if (k._ribL) {
              const d = Math.hypot(pL[0] - k._ribL[0], pL[2] - k._ribL[2]);
              if (d > 0.35 && d < 8) {
                addQuad(k._ribL, pL, rx, 0.25, rz, 0.38, c.r, c.g, c.b, 0.72, 0.42);
                addQuad(k._ribR, pR, rx, 0.25, rz, 0.38, c.r, c.g, c.b, 0.72, 0.42);
                k._ribL = pL; k._ribR = pR;
              } else if (d >= 8) { k._ribL = pL; k._ribR = pR; }
            } else { k._ribL = pL; k._ribR = pR; }
          } else {
            k._ribL = k._ribR = null;
          }

          // Glider wingtip vortex contrails
          if (k.glide && !k.onGround) {
            const wy = k.y + 4.45;
            const wL = [k.x - rx * 4.35 - sx * 1.1, wy, k.z - rz * 4.35 - cx * 1.1];
            const wR = [k.x + rx * 4.35 - sx * 1.1, wy, k.z + rz * 4.35 - cx * 1.1];
            if (k._wingL) {
              const d = Math.hypot(wL[0] - k._wingL[0], wL[2] - k._wingL[2]);
              if (d > 0.4 && d < 9) {
                addQuad(k._wingL, wL, 0, 1, 0, 0.24, 0.82, 0.96, 1.0, 0.52, 0.65);
                addQuad(k._wingR, wR, 0, 1, 0, 0.24, 0.82, 0.96, 1.0, 0.52, 0.65);
                k._wingL = wL; k._wingR = wR;
              } else if (d >= 9) { k._wingL = wL; k._wingR = wR; }
            } else { k._wingL = wL; k._wingR = wR; }
          } else {
            k._wingL = k._wingR = null;
          }
        },
        update(dt) {
          let any = false;
          for (let i = 0; i < MAXQ; i++) {
            if (life[i] <= 0) continue;
            life[i] -= dt;
            const a = life[i] > 0 ? a0[i] * (life[i] / ttl[i]) : 0;
            const co = i * 24;
            for (let v = 0; v < 6; v++) col[co + v * 4 + 3] = a;
            any = true;
          }
          if (any) { pa.needsUpdate = true; ca.needsUpdate = true; }
        },
      };
    })();

    // ------------------------------------------------------------------------
    // 2B. Applying Garage Parts Visually & Physically to Karts
    // ------------------------------------------------------------------------
    const coupeWingGeo = build([
      [rbox(3.6, 0.14, 1.0, 0.05), 0x26d3d0, M(0, 2.55, -2.25, -0.2)],
      [rbox(3.5, 0.22, 0.65, 0.08), 0x1a1626, M(0, 0.52, 3.18)],
    ], 0, true);
    const bumbleDomeGeo = build([
      [SPH(1.15, 20, 14), 0xffd23f, M(0, 1.05, 1.55, 0, 0, 0, 1.15, 0.68, 1.1)],
      [new THREE.CylinderGeometry(0.32, 0.42, 1.1, 14), 0xffb22e, M(-0.65, 1.38, -2.35, Math.PI / 2)],
      [new THREE.CylinderGeometry(0.32, 0.42, 1.1, 14), 0xffb22e, M(0.65, 1.38, -2.35, Math.PI / 2)],
    ], 0, true);
    const motoFairingGeo = build([
      [rbox(0.95, 0.95, 4.5, 0.35), 0x26d3d0, M(0, 1.02, 0.2)],
      [rbox(0.75, 0.65, 1.4, 0.22), 0x1a1428, M(0, 1.65, 1.55, -0.35)],
    ], 0, true);
    const agRingGeo = new THREE.TorusGeometry(0.62, 0.09, 8, 20);
    agRingGeo.rotateY(Math.PI / 2);
    const agRingMat = new THREE.MeshBasicMaterial({ color: HDR(0.35, 2.1, 3.2) });

    // The Kart Garage unlocks after winning a trophy (top 3) in 4 different Grand Prix cups.
    const GARAGE_UNLOCK_CUPS = 4;
    function garageCupsDone() {
      return (CUPS || []).filter((c) => +(store.get('wheeliefun.trophy.' + c.id) || 0) > 0).length;
    }
    function garageUnlocked() { return garageCupsDone() >= GARAGE_UNLOCK_CUPS; }

    function getPartsForKart(human, pi, aiIdx) {
      if (human && !garageUnlocked()) {
        return { frame: GARAGE_FRAMES[0], tire: GARAGE_TIRES[0], glider: GARAGE_GLIDERS[0], gold: false };
      }
      if (human) {
        return {
          frame: GARAGE_FRAMES[loadout.frame] || GARAGE_FRAMES[0],
          tire: GARAGE_TIRES[loadout.tire] || GARAGE_TIRES[0],
          glider: GARAGE_GLIDERS[loadout.glider] || GARAGE_GLIDERS[0],
          gold: loadout.goldSkin && VAULT.hasGoldKart(),
        };
      }
      const seed = Math.abs(aiIdx || 0);
      return {
        frame: GARAGE_FRAMES[seed % GARAGE_FRAMES.length],
        tire: GARAGE_TIRES[(seed * 3 + 1) % GARAGE_TIRES.length],
        glider: GARAGE_GLIDERS[(seed * 2) % GARAGE_GLIDERS.length],
        gold: false,
      };
    }

    function applyGarageVisuals(v, parts) {
      if (!v || !parts) return;
      const fr = parts.frame, tr = parts.tire, gl = parts.glider;
      // Optional Golden Chassis unlock skin
      const chassisMesh = v.body.children[0];
      if (chassisMesh && chassisMesh.isMesh) {
        chassisMesh.material = parts.gold ? goldPaintMat : paintMat;
        chassisMesh.scale.set(fr.id === 'moto' ? 0.54 : fr.id === 'coupe' ? 1.08 : 1, fr.id === 'coupe' ? 0.86 : 1, 1);
      }
      if (v.frameExtra) { v.body.remove(v.frameExtra); v.frameExtra = null; }
      if (fr.id === 'coupe') { v.frameExtra = new THREE.Mesh(coupeWingGeo, paintMat); v.body.add(v.frameExtra); }
      else if (fr.id === 'bumble') { v.frameExtra = new THREE.Mesh(bumbleDomeGeo, paintMat); v.body.add(v.frameExtra); }
      else if (fr.id === 'moto') { v.frameExtra = new THREE.Mesh(motoFairingGeo, paintMat); v.body.add(v.frameExtra); }

      // Customize wheels (Cyber Moto tucks wheels inline on X=0! Monster/Roller scale & width!)
      v.agRings = v.agRings || [];
      v.wheels.forEach((w, idx) => {
        const baseX = (idx % 2 === 0 ? -1 : 1) * (w.f ? 1.55 : 1.62);
        const s = (w.f ? 1 : 1.12) * tr.sc;
        w.piv.position.x = fr.id === 'moto' ? (idx % 2 === 0 ? -0.18 : 0.18) : baseX * (tr.sc > 1.2 ? 1.08 : 1);
        w.y0 = 0.74 * s;
        w.piv.position.y = w.y0;
        w.w.scale.set(s * tr.wide, s, s);
        if (!v.agRings[idx]) {
          const ring = new THREE.Mesh(agRingGeo, agRingMat);
          ring.visible = false;
          w.piv.add(ring);
          v.agRings[idx] = ring;
        }
      });
      if (v.struts) {
        v.struts.forEach((st) => { st.st.visible = fr.id !== 'moto'; });
      }
      // Tint glider canopy if custom glider chosen
      if (gl.col && v.glider && v.glider.children[0]) {
        v.glider.children[0].material = new THREE.MeshStandardMaterial({
          color: gl.col, roughness: 0.32, metalness: 0.15, envMap: paintMat.envMap,
        });
      }
    }

    function applyGaragePhysics(k, parts) {
      k.parts = parts;
      const st = k.ch.st;
      const fr = parts.frame, tr = parts.tire, gl = parts.glider;
      k.baseMaxS = 58 * (0.94 + st[0] * 0.028) * fr.spd * tr.spd;
      k.baseAcc  = 24 * (0.78 + st[1] * 0.09) * fr.acc * tr.acc;
      k.maxS = k.baseMaxS * getCC().spd;
      k.acc  = k.baseAcc  * getCC().acc;
      k.hand = (0.86 + st[2] * 0.06) * fr.hand * tr.hand;
      k.weight = (0.7 + st[3] * 0.15) * fr.wt;
      k.offroadMult = clamp(tr.off * getCC().off, 0.42, 0.88);
      k.sparkRate = tr.chg || 1.0;
      k.mtMult = fr.mt || 1.0;
      k.insideDrift = !!fr.inside;
      k.airTurnMult = gl.airTurn || 1.0;
      k.glideSinkMult = gl.sink || 1.0;
      k.trickBoostMult = gl.trickB || 1.0;
      applyGarageVisuals(k.v, parts);
    }

    // ------------------------------------------------------------------------
    // 4. TRUE ANTI-GRAVITY ZONES & SPIN-BOOST BUMPERS
    // ------------------------------------------------------------------------
    const ANTIGRAV = new Uint8Array(N);
    let agBumpers = [];
    const agGateGeo = build([
      [new THREE.TorusGeometry(ROAD + 3.8, 0.55, 8, 36, Math.PI), 0x26f0ff, M(0, 0, 0)],
      [new THREE.CylinderGeometry(0.55, 0.65, 3, 8), 0x1a1832, M(-(ROAD + 3.8), 1.5, 0)],
      [new THREE.CylinderGeometry(0.55, 0.65, 3, 8), 0x1a1832, M(ROAD + 3.8, 1.5, 0)],
    ], 0, true);
    const agPillarGeo = build([
      [new THREE.CylinderGeometry(1.4, 1.7, 3.6, 16), 0x1c1838, M(0, 1.8, 0)],
      [new THREE.TorusGeometry(2.05, 0.42, 10, 24), 0x26f0ff, M(0, 1.75, 0, Math.PI / 2, 0, 0)],
      [SPH(0.95, 12, 10), 0x7df9ff, M(0, 4.1, 0)],
    ], 0, true);
    const agGlowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: HDR(1.2, 2.2, 3.0) });

    function computeAntiGrav(L) {
      ANTIGRAV.fill(0);
      agBumpers = [];
      const spans = L.antigrav || DEFAULT_ANTIGRAV[L.id] || [];
      for (const [f0, f1] of spans) {
        for (let i = Math.floor(f0 * N); i < Math.floor(f1 * N); i++) {
          const wi = wrapI(i);
          if (!GAP[wi]) {
            ANTIGRAV[wi] = 1;
            // Amplify banking into swooping zero-G wall turns!
            BANK[wi] = clamp(BANK[wi] * 1.9, -0.32, 0.32);
          }
        }
      }
    }

    function buildAntiGravProps(L) {
      agBumpers = [];
      if (!ANTIGRAV.some((v) => v === 1)) return;
      const TP = api.TP, TR = api.TR, SP = api.SP;
      // Place glowing cyan arches at zone entries & Spin-Boost bumpers inside
      for (let i = 0; i < N; i++) {
        const prev = ANTIGRAV[wrapI(i - 1)];
        if (ANTIGRAV[i] && !prev && !GAP[i]) {
          const gate = addL(new THREE.Mesh(agGateGeo, agGlowMat));
          gate.position.set(TP[i].x, H[i], TP[i].z);
          gate.rotation.y = TA[i];
        }
      }
      const step = Math.max(20, Math.round(68 / SP));
      for (let i = 35; i < N - 35; i += step) {
        if (!ANTIGRAV[i] || GAP[i] || TUN[i] > 0.3) continue;
        const l = ((Math.floor(i / step) % 2) ? 5.2 : -5.2) * LW[i];
        const p = api.edge(i, l, 0);
        const m = addL(new THREE.Mesh(agPillarGeo, agGlowMat));
        m.position.set(p[0], p[1], p[2]);
        agBumpers.push({ x: p[0], y: p[1], z: p[2], i, l, m });
      }
    }

    function triggerSpinBoost(k, label) {
      if ((k.spinBoostCD || 0) > 0) return false;
      k.spinBoostCD = 0.65;
      k.spinBoostT = 0.52;
      k.boostT = Math.max(k.boostT, 0.95);
      k.hype = Math.min(1, (k.hype || 0) + 0.08);
      k.spinBoosts = (k.spinBoosts || 0) + 1;
      burst(FX, k.x, k.y + 1.5, k.z, 26, 16, 0.42, 0.95, 0.25, 0.92, 1.0, 4, 3);
      if (k.human) {
        tone(680, 0.14, 'triangle', 0.14, 1.8);
        tone(1020, 0.18, 'sine', 0.12, 1.5, 0.06);
        say(k.pi, label || '⚡ SPIN BOOST!', 0.85);
      }
      return true;
    }

    function tickAntiGrav(dt) {
      for (const b of agBumpers) b.m.rotation.y += dt * 3.2;
      for (const k of G.karts) {
        if ((k.spinBoostCD || 0) > 0) k.spinBoostCD -= dt;
        if ((k.spinBoostT || 0) > 0) k.spinBoostT -= dt;
        const inAG = !G.battle && ANTIGRAV[k.idx] === 1 && k.respawnT <= 0;
        if (inAG && !k.antiGrav && k.human && G.state === 'race') {
          say(k.pi, '🛸 ANTI-GRAVITY! BUMP KARTS TO BOOST', 1.4);
          tone(440, 0.22, 'sine', 0.1, 1.9);
        }
        k.antiGrav = inAG;
        k.agBlend = toward(k.agBlend || 0, inAG ? 1 : 0, dt * 6);
        if (k.v && k.v.wheels && !k.ch.fly) {
          k.v.wheels.forEach((w, idx) => {
            const side = idx % 2 === 0 ? -1 : 1;
            w.piv.rotation.z = side * (Math.PI * 0.48) * k.agBlend;
            if (k.v.agRings && k.v.agRings[idx]) {
              k.v.agRings[idx].visible = k.agBlend > 0.25;
            }
          });
        }
        if (inAG && k.onGround) {
          for (const b of agBumpers) {
            const dx = k.x - b.x, dz = k.z - b.z;
            if (dx * dx + dz * dz < 13.5) {
              const dist = Math.hypot(dx, dz) || 1;
              k.x = b.x + (dx / dist) * 3.8;
              k.z = b.z + (dz / dist) * 3.8;
              triggerSpinBoost(k, '⚡ PILLAR SPIN BOOST!');
            }
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // 3. TIME TRIALS MODE + PLAYABLE GHOST REPLAYS & DEV STAFF GHOSTS
    // ------------------------------------------------------------------------
    const GHOSTS = {
      recording: [],
      recAccum: 0,
      activeGhosts: [], // [{ label, frames, mesh, totalTime, isStaff }]
      importedFrames: null,
      importedTrackId: null,
    };

    function ghostKey(trackId) {
      return 'wheeliefun.ghost.' + trackId + (G.mirror ? '.m' : '');
    }

    function encodeGhostCode(trackId, totalTime, frames) {
      const compact = frames.filter((_, idx) => idx % 2 === 0).map((f) => [
        +f[0].toFixed(2), +f[1].toFixed(1), +f[2].toFixed(1), +f[3].toFixed(1), +f[4].toFixed(2), f[5] | 0,
      ]);
      const payload = JSON.stringify({ v: 1, trk: trackId, m: G.mirror ? 1 : 0, t: +totalTime.toFixed(3), f: compact });
      try { return 'WFG1:' + btoa(unescape(encodeURIComponent(payload))); } catch (e) { return ''; }
    }

    function decodeGhostCode(code) {
      try {
        const clean = String(code || '').trim().replace(/^WFG1:/, '');
        const obj = JSON.parse(decodeURIComponent(escape(atob(clean))));
        if (!obj || typeof obj.trk !== 'string' || !obj.trk || !Array.isArray(obj.f) || obj.f.length < 1) return null;
        if (!(isFinite(obj.t) && obj.t > 0)) return null;
        // Every frame must be [time, x, y, z, heading, driftDir?] with finite numbers.
        const okFrame = (fr) => Array.isArray(fr) && fr.length >= 5 &&
          fr.slice(0, 5).every((v) => typeof v === 'number' && isFinite(v));
        if (!obj.f.every(okFrame)) return null;
        return obj;
      } catch (e) { return null; }
    }

    function makeStaffGhostData(L) {
      const TP = api.TP, TR = api.TR, SP = api.SP;
      const laps = L.laps || 3;
      const ccSpd = getCC().spd;
      const avgSpd = 61.5 * ccSpd;
      const lapLen = N * SP;
      const totalTime = (lapLen * laps) / avgSpd;
      const frames = [];
      const dt = 0.2;
      for (let t = 0; t <= totalTime + dt; t += dt) {
        const dist = t * avgSpd;
        const fIdx = (dist / SP) % N;
        const i0 = wrapI(Math.floor(fIdx)), i1 = wrapI(i0 + 1), frac = fIdx - Math.floor(fIdx);
        // Apex-hugging line into curves
        const cv = CURV[i0];
        const apexLat = clamp(-cv * 9.5, -7.5, 7.5) * LW[i0];
        const x = lerp(TP[i0].x, TP[i1].x, frac) + TR[i0].x * apexLat;
        const z = lerp(TP[i0].z, TP[i1].z, frac) + TR[i0].z * apexLat;
        const y = api.groundAt(i0, frac * SP, apexLat);
        const dDir = Math.abs(cv) > 0.42 ? (cv > 0 ? -1 : 1) : 0;
        frames.push([+t.toFixed(2), +x.toFixed(2), +y.toFixed(2), +z.toFixed(2), +TA[i0].toFixed(3), dDir]);
      }
      return { label: 'DEV STAFF', totalTime, frames, chIdx: 2, isStaff: true };
    }

    function makeGhostMesh(ch, label, tintHex) {
      const v = api.makeKart(ch);
      const holoMat = new THREE.MeshStandardMaterial({
        color: tintHex, emissive: tintHex, emissiveIntensity: 0.35,
        transparent: true, opacity: 0.38, roughness: 0.2, depthWrite: false,
      });
      v.root.traverse((o) => {
        if (o.isMesh) { o.material = holoMat; o.castShadow = false; o.receiveShadow = false; }
      });
      if (v.blob) v.blob.visible = false;
      const tag = api.nameTag({ name: label, kart: tintHex });
      v.root.add(tag);
      scene.add(v.root);
      return v;
    }

    function clearGhosts() {
      for (const g of GHOSTS.activeGhosts) {
        if (g.v && g.v.root) scene.remove(g.v.root);
      }
      GHOSTS.activeGhosts = [];
      GHOSTS.recording = [];
      GHOSTS.recAccum = 0;
    }

    function setupTimeTrialGhosts(L) {
      clearGhosts();
      if (!G.timeTrial || G.battle) return;
      // 1. Always spawn Dev Staff Ghost
      const staff = makeStaffGhostData(L);
      staff.v = makeGhostMesh(CHARS[staff.chIdx], '★ STAFF ' + fmt(staff.totalTime), 0x26d3d0);
      GHOSTS.activeGhosts.push(staff);

      // 2. Spawn Saved PB Ghost (or Imported Rival Ghost)
      let pbObj = null;
      // A rival ghost only races on its own track AND in the same mode (mirror vs normal).
      if (GHOSTS.importedFrames && GHOSTS.importedTrackId === L.id && !!GHOSTS.importedFrames.m === !!G.mirror) {
        pbObj = { label: 'RIVAL GHOST', totalTime: GHOSTS.importedFrames.t, frames: GHOSTS.importedFrames.f, chIdx: 6 };
      } else {
        const raw = store.get(ghostKey(L.id));
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.f) && parsed.f.length > 2) {
              pbObj = { label: 'YOUR PB ' + fmt(parsed.t), totalTime: parsed.t, frames: parsed.f, chIdx: parsed.ch || 0 };
            }
          } catch (e) {}
        }
      }
      if (pbObj) {
        pbObj.v = makeGhostMesh(CHARS[pbObj.chIdx % CHARS.length], pbObj.label, 0xffb22e);
        GHOSTS.activeGhosts.push(pbObj);
      }
      sampleGhostsAt(0);
    }

    function sampleGhostsAt(raceT) {
      for (const g of GHOSTS.activeGhosts) {
        const F = g.frames;
        if (!F || !F.length || !g.v) continue;
        if (raceT >= g.totalTime) {
          const last = F[F.length - 1];
          g.v.root.position.set(last[1], last[2], last[3]);
          g.v.root.rotation.y = last[4];
          continue;
        }
        // Binary search frame interval
        let lo = 0, hi = F.length - 1;
        while (lo + 1 < hi) {
          const mid = (lo + hi) >> 1;
          if (F[mid][0] <= raceT) lo = mid; else hi = mid;
        }
        const a = F[lo], b = F[hi];
        const span = Math.max(0.001, b[0] - a[0]);
        const u = clamp((raceT - a[0]) / span, 0, 1);
        g.v.root.position.set(lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u));
        g.v.root.rotation.y = a[4] + adiff(a[4], b[4]) * u - (a[5] || 0) * 0.25;
        for (const w of g.v.wheels) w.w.rotation.x += 0.35;
      }
    }

    function tickTimeTrial(dt) {
      if (!G.timeTrial || G.battle) return;
      const hk = G.humans_k && G.humans_k[0];
      if (G.state === 'race' && hk && !hk.finished) {
        GHOSTS.recAccum += dt;
        if (GHOSTS.recAccum >= 0.1 || GHOSTS.recording.length === 0) {
          GHOSTS.recAccum = 0;
          GHOSTS.recording.push([
            +G.raceT.toFixed(2), +hk.x.toFixed(2), +hk.y.toFixed(2), +hk.z.toFixed(2),
            +hk.heading.toFixed(3), hk.driftDir | 0,
          ]);
        }
      }
      sampleGhostsAt(G.state === 'countdown' ? 0 : G.raceT);
    }

    // Keep at most `max` frames by sampling evenly across the WHOLE run (always keeping the
    // last frame), so long races still have a ghost that reaches the finish line.
    function thinFrames(frames, max) {
      if (frames.length <= max) return frames.slice();
      const step = (frames.length - 1) / (max - 1);
      const out = [];
      for (let i = 0; i < max; i++) out.push(frames[Math.round(i * step)]);
      return out;
    }

    function saveTimeTrialFinish(L, finishTime, chIdx) {
      if (!G.timeTrial || !L || L.noBest || !isFinite(finishTime)) return { beatPB: false, beatStaff: false, code: '' };
      if (GHOSTS.recording.length < 2 && G.humans_k[0]) {
        const hk = G.humans_k[0];
        GHOSTS.recording.push([0, +hk.x.toFixed(2), +hk.y.toFixed(2), +hk.z.toFixed(2), +hk.heading.toFixed(3), 0]);
        GHOSTS.recording.push([+finishTime.toFixed(2), +hk.x.toFixed(2), +hk.y.toFixed(2), +hk.z.toFixed(2), +hk.heading.toFixed(3), 0]);
      }
      const key = ghostKey(L.id);
      let prevT = Infinity;
      try { const old = JSON.parse(store.get(key) || 'null'); if (old && isFinite(old.t)) prevT = old.t; } catch (e) {}
      const beatPB = finishTime < prevT;
      if (beatPB) {
        store.set(key, JSON.stringify({ t: +finishTime.toFixed(3), ch: chIdx || 0, f: thinFrames(GHOSTS.recording, 1800) }));
      }
      const staff = GHOSTS.activeGhosts.find((g) => g.isStaff);
      const beatStaff = !!(staff && finishTime <= staff.totalTime);
      const code = encodeGhostCode(L.id, finishTime, GHOSTS.recording);
      GHOSTS.lastCode = code;
      GHOSTS.lastBeatStaff = beatStaff;
      GHOSTS.lastStaffTime = staff ? staff.totalTime : null;
      return { beatPB, beatStaff, code };
    }

    // ------------------------------------------------------------------------
    // 7. CHARACTER VOICE BARKS, CROWD ROAR, FRONTRUNNING MIX & TV REPLAY CAMS
    // ------------------------------------------------------------------------
    function voiceBark(ch, mood) {
      const basePitch = ch && ch.baby ? 640 : (ch && ch.st && ch.st[3] >= 4 ? 230 : 410);
      const idOff = ((CHARS.indexOf(ch) + 1) * 23) % 90;
      const f0 = basePitch + idOff;
      if (mood === 'cheer' || mood === 'start') {
        tone(f0, 0.09, 'triangle', 0.11, 1.35);
        tone(f0 * 1.28, 0.13, 'sine', 0.10, 1.25, 0.07);
      } else if (mood === 'ouch') {
        tone(f0 * 1.1, 0.16, 'sawtooth', 0.09, 0.55);
      } else if (mood === 'pass') {
        tone(f0 * 0.95, 0.07, 'triangle', 0.08, 1.25);
        tone(f0 * 1.2, 0.09, 'triangle', 0.08, 1.15, 0.06);
      }
    }

    function crowdRoar() {
      noise(1.1, 680, 0.18, 0, null, 0.7, 1.4);
      noise(1.3, 1350, 0.12, 0.08, null, 0.9, 1.2);
    }

    function isFrontrunning() {
      if (G.state !== 'race' || G.battle || G.timeTrial) return false;
      return !!(G.humans_k && G.humans_k.some((k) => k.rank === 0 && !k.finished));
    }

    function playFrontrunLayer(step, noteFn, chord, stepDur, when, musicNode) {
      if (!isFrontrunning()) return;
      // Extra crisp 16th-note ride shimmer + bright octave-up counter-arpeggio (MK8 Frontrunning Mix!)
      noise(0.028, 9800, 0.065, when, musicNode, 1.8);
      if (step % 2 === 0) {
        const note = chord[(step >> 1) % chord.length] + 24;
        tone(noteFn(note), stepDur * 0.85, 'sine', 0.048, 0, when, musicNode);
      }
    }

    // Trackside Broadcast TV Cameras when finished / on Results screen
    function updateTvReplayCam(k, cam, c, dt) {
      if (G.battle) return false;
      const TP = api.TP, TR = api.TR;
      const cutIdx = Math.floor(G.time / 3.4) % 3;
      if (cutIdx === 0) {
        // Low-angle Dramatic Curb Panning Cam ahead of the racer!
        const anchor = wrapI(Math.floor(k.idx / 45) * 45 + 22);
        const p = api.edge(anchor, (ROAD + 3.2), 1.6);
        c.position.set(p[0], p[1], p[2]);
        c.fov = 56;
        c.lookAt(k.x, k.y + 1.6, k.z);
        c.updateProjectionMatrix();
        return true;
      }
      if (cutIdx === 1) {
        // Sweeping Helicopter Tracking Cam
        const a = G.time * 0.45;
        // Locked to the kart (no lerp): a lerping camera trails a fast kart and drifts too close.
        c.position.set(k.x + Math.cos(a) * 24, k.y + 13.5, k.z + Math.sin(a) * 24);
        c.fov = 52;
        c.lookAt(k.x, k.y + 1.8, k.z);
        c.updateProjectionMatrix();
        return true;
      }
      // Nose-On Action Hood Cam looking back at driver cheering!
      // Locked in front of the kart. It used to lerp toward this spot, but the kart (still driving at
      // ~60 after the finish) outran it and the camera ended up inside the driver's head.
      // Only the angle is smoothed, so corners don't jerk the shot.
      cam.tvH = cam.tvH == null ? k.heading : cam.tvH + adiff(cam.tvH, k.heading) * Math.min(1, dt * 4);
      const hx = Math.sin(cam.tvH), hz = Math.cos(cam.tvH);
      c.position.set(k.x + hx * 9.5, k.y + 3, k.z + hz * 9.5);
      c.fov = 62;
      c.lookAt(k.x, k.y + 1.9, k.z);
      c.updateProjectionMatrix();
      return true;
    }

    // ------------------------------------------------------------------------
    // Garage DOM & Time Trial UI Injection
    // ------------------------------------------------------------------------
    function injectGarageAndTitleUI() {
      if (!document.getElementById('wf-v2-style')) {
        const st = document.createElement('style');
        st.id = 'wf-v2-style';
        st.textContent = `
.garageBar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;background:var(--panel);border:2px solid rgba(255,255,255,.14);border-radius:16px;padding:9px 12px;align-items:center}
.gSlot{display:flex;flex-direction:column;gap:3px;border-radius:12px;padding:2px 4px;border:2px solid transparent}.gSlot.gfocus{border-color:var(--ember);box-shadow:0 0 14px rgba(255,178,46,.45)}.gHint{grid-column:1/-1;font-size:11px;color:var(--muted);text-align:center}.gHint em{color:var(--ember);font-style:normal;font-weight:700}.garageBar.locked{display:block}.gLocked{font-size:13px;color:var(--muted);text-align:center;padding:6px}.gLocked b{color:var(--cream)}.gLocked span{color:var(--ember)}
.gSlot small{font-family:var(--display);font-size:10px;letter-spacing:.08em;color:var(--lagoon)}
.gSpin{display:flex;align-items:center;justify-content:space-between;gap:4px;background:rgba(255,255,255,.07);border-radius:10px;padding:4px 6px}
.gSpin button{border:0;background:rgba(255,178,46,.22);color:var(--cream);font-family:var(--display);font-size:12px;width:24px;height:24px;border-radius:6px;cursor:pointer}
.gSpin button:hover{background:var(--ember);color:var(--night)}
.gSpin b{font-size:12.5px;font-weight:700;text-align:center;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vaultLine{font-size:12.5px;color:var(--muted);background:var(--panel);padding:6px 14px;border-radius:999px;border:1px solid rgba(255,178,46,.28)}
.vaultLine b{color:var(--ember)}
.btn.tt{background:linear-gradient(180deg,#ffe14a,#ff9a1f);color:var(--night);box-shadow:0 6px 0 #9a5208,0 10px 18px rgba(0,0,0,.35)}
@media (max-width:760px){.garageBar{grid-template-columns:repeat(2,1fr)}}
`;
        document.head.appendChild(st);
      }

      // Inject Time Trials + Speed Class buttons onto #title
      const onlineBtn = document.getElementById('onlineBtn');
      if (onlineBtn && !document.getElementById('ttBtn')) {
        const tt = document.createElement('button');
        tt.className = 'btn tt';
        tt.id = 'ttBtn';
        tt.dataset.act = 'tt';
        tt.textContent = '⏱ Time Trials';
        onlineBtn.insertAdjacentElement('afterend', tt);
      }
      const diffBtn = document.getElementById('diffBtn');
      if (diffBtn && !document.getElementById('ccBtn')) {
        const cb = document.createElement('button');
        cb.className = 'btn ghost';
        cb.id = 'ccBtn';
        cb.dataset.act = 'cc';
        diffBtn.insertAdjacentElement('beforebegin', cb);
      }
      const shelf = document.getElementById('shelf');
      if (shelf && !document.getElementById('vaultBadge')) {
        const vb = document.createElement('div');
        vb.className = 'vaultLine';
        vb.id = 'vaultBadge';
        shelf.insertAdjacentElement('beforebegin', vb);
      }

      // Add Class badge button in Track Atlas bar
      const atlasTabs = document.getElementById('atlasTabs');
      if (atlasTabs && !document.getElementById('atlasCcBtn')) {
        const ac = document.createElement('button');
        ac.type = 'button';
        ac.className = 'chipBtn';
        ac.id = 'atlasCcBtn';
        ac.addEventListener('click', () => { cycleCC(); });
        atlasTabs.appendChild(ac);
      }

      // Inject 3-part Kart Customization Garage into #select!
      const grid = document.getElementById('grid');
      if (grid && !document.getElementById('garageBar')) {
        const bar = document.createElement('div');
        bar.className = 'garageBar';
        bar.id = 'garageBar';
        grid.insertAdjacentElement('beforebegin', bar);
        bar.addEventListener('click', (e) => {
          const b = e.target.closest('[data-gpart]');
          if (!b) return;
          api.audioInit();
          SFX.menu();
          const part = b.dataset.gpart, dir = +b.dataset.gdir || 1;
          store.set('wheeliefun.garageSeen', '1');
          if (part === 'frame') {
            loadout.frame = (loadout.frame + dir + GARAGE_FRAMES.length) % GARAGE_FRAMES.length;
            store.set('wheeliefun.frame', String(loadout.frame));
          } else if (part === 'tire') {
            loadout.tire = (loadout.tire + dir + GARAGE_TIRES.length) % GARAGE_TIRES.length;
            store.set('wheeliefun.tire', String(loadout.tire));
          } else if (part === 'glider') {
            loadout.glider = (loadout.glider + dir + GARAGE_GLIDERS.length) % GARAGE_GLIDERS.length;
            store.set('wheeliefun.glider', String(loadout.glider));
          } else if (part === 'gold') {
            if (VAULT.hasGoldKart()) { // earned at GOLD_COINS vault coins; no free unlock
              loadout.goldSkin = !loadout.goldSkin;
              store.set('wheeliefun.goldSkin', loadout.goldSkin ? '1' : '0');
            }
          }
          renderGarageBar();
          api.refreshPreviewGarage();
        });
      }
      updateCCButtons();
      updateVaultUI();
      renderGarageBar();
    }

    function renderGarageBar() {
      const bar = document.getElementById('garageBar');
      if (!bar) return;
      if (!garageUnlocked()) {
        bar.classList.add('locked');
        bar.innerHTML = `<div class="gLocked">🔒 <b>KART GARAGE</b> · win a trophy in ${GARAGE_UNLOCK_CUPS} cups to unlock custom frames, tires & gliders <span>(${garageCupsDone()}/${GARAGE_UNLOCK_CUPS})</span></div>`;
        return;
      }
      bar.classList.remove('locked');
      const isNew = store.get('wheeliefun.garageSeen') !== '1';
      const fr = GARAGE_FRAMES[loadout.frame], tr = GARAGE_TIRES[loadout.tire], gl = GARAGE_GLIDERS[loadout.glider];
      const goldTxt = loadout.goldSkin && VAULT.hasGoldKart() ? '✨ Gold Paint ON' : (VAULT.hasGoldKart() ? 'Paint: Standard' : `🔒 Gold at ${GOLD_COINS} coins · ${Math.min(VAULT.coins, GOLD_COINS)}/${GOLD_COINS}`);
      bar.innerHTML = `
        <div class="gSlot"><small>CHASSIS FRAME</small><div class="gSpin"><button type="button" data-gpart="frame" data-gdir="-1">◀</button><b>${fr.name}</b><button type="button" data-gpart="frame" data-gdir="1">▶</button></div></div>
        <div class="gSlot"><small>TIRES</small><div class="gSpin"><button type="button" data-gpart="tire" data-gdir="-1">◀</button><b>${tr.name}</b><button type="button" data-gpart="tire" data-gdir="1">▶</button></div></div>
        <div class="gSlot"><small>GLIDER</small><div class="gSpin"><button type="button" data-gpart="glider" data-gdir="-1">◀</button><b>${gl.name}</b><button type="button" data-gpart="glider" data-gdir="1">▶</button></div></div>
        <div class="gSlot"><small>VAULT CUSTOM</small><div class="gSpin"><button type="button" data-gpart="gold" data-gdir="1" style="width:100%">${goldTxt}</button></div></div>
        <div class="gHint">${isNew ? '<em>NEW! Garage unlocked</em> · ' : ''}Controller: ▲ from the racers, ◀ ▶ pick a part, Ⓐ change it, ▼ back</div>
      `;
    }

    injectGarageAndTitleUI();

    return {
      CC_ORDER,
      CC_CONFIG,
      GARAGE_FRAMES,
      GARAGE_TIRES,
      GARAGE_GLIDERS,
      ANTIGRAV,
      RIBBONS,
      GHOSTS,
      VAULT,
      loadout,
      getCC,
      setCC,
      cycleCC,
      setLoadout(f, t, g, gold) {
        if (f != null) loadout.frame = ((f % GARAGE_FRAMES.length) + GARAGE_FRAMES.length) % GARAGE_FRAMES.length;
        if (t != null) loadout.tire = ((t % GARAGE_TIRES.length) + GARAGE_TIRES.length) % GARAGE_TIRES.length;
        if (g != null) loadout.glider = ((g % GARAGE_GLIDERS.length) + GARAGE_GLIDERS.length) % GARAGE_GLIDERS.length;
        if (gold != null) loadout.goldSkin = !!gold;
        renderGarageBar();
      },
      getPartsForKart,
      applyGarageVisuals,
      applyGaragePhysics,
      makeRoadNormalTex,
      computeAntiGrav,
      buildAntiGravProps,
      triggerSpinBoost,
      tickAntiGrav,
      setupTimeTrialGhosts,
      clearGhosts,
      tickTimeTrial,
      saveTimeTrialFinish,
      encodeGhostCode,
      decodeGhostCode,
      garageUnlocked,
      garageCupsDone,
      importGhostCode(code) {
        const obj = decodeGhostCode(code);
        if (!obj) return null;
        // Race the ghost in the mode it was recorded in (mirror vs normal track).
        if (!!obj.m !== !!G.mirror) setCC(obj.m ? 'mirror' : '150cc');
        GHOSTS.importedFrames = obj;
        GHOSTS.importedTrackId = obj.trk;
        return obj;
      },
      voiceBark,
      crowdRoar,
      isFrontrunning,
      playFrontrunLayer,
      updateTvReplayCam,
      renderGarageBar,
      updateVaultUI,
    };
  };
})();
