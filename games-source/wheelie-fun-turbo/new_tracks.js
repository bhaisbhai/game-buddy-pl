// ============================================================================
// Wheelie Fun — 10 New Showcase Tracks & Track Organization System
// Registered via window.registerWheelieNewTracks(WF_API)
// ============================================================================
window.registerWheelieNewTracks = function (api) {
  const {
    LEVELS, CUPS, FEAT, MUSIC, STRIKE_KINDS, THREE,
    R, rr, rng, clamp, lerp, toward, adiff, wrapI,
    N, ROAD, CURB, WALL, LIM,
    TA, H, GAP, SURF, WIND, LW, TUN,
    G, FX, SMOKE, burst,
    M, V3, C, HDR, SPH, rbox, build, jitterGeo, lathe, ltex,
    addL, addSway, glowMat, addGlow,
    vcPhong, vcLambert, vcLambertDS, paintMat, glossy, chrome,
    fgap, bestStraight, trackCentre, edge, ribbon, wallRibbon,
    placeOK, placeNear, groundPlane, scatter, roadRow, sideProp, meshOf,
    signTex, neonTex, boardAt, acrossStrings,
    makeClouds, driftClouds, makeWeather, strataGeo, peakGeo,
    crossers, roadBumps, thrower, chaser, mergeLR,
    splat, hit, stink, shieldPop, giveCoins, spk
  } = api;

  // Dynamic getters for per-level reassigned arrays/state in main engine
  const getTP = () => api.TP || (typeof TP !== 'undefined' ? TP : []);
  const getTT = () => api.TT || (typeof TT !== 'undefined' ? TT : []);
  const getTR = () => api.TR || (typeof TR !== 'undefined' ? TR : []);
  const getGAPS = () => api.GAPS || (typeof GAPS !== 'undefined' ? GAPS : []);
  const getLR = () => api.LR || (typeof LR !== 'undefined' ? LR : {});
  const getSP = () => {
    if (api.SP) return api.SP;
    const tp = getTP();
    return tp.length > 1 ? tp[0].distanceTo(tp[1]) : 1.1;
  };

  // Helper: check whether sample index i falls inside L.unfenced ranges
  function inUnfenced(L, i) {
    if (!L || !L.unfenced) return false;
    const f = wrapI(i) / N;
    for (const [a, b] of L.unfenced) {
      if (f >= a && f <= b) return true;
    }
    return false;
  }

  // Fallback boat physics/visuals for SURF===3 tracks if boatTick/boatVisual aren't exposed on api
  const sampanHullG = build([
    [rbox(5.0, 1.45, 7.4, 0.55), 0xd89a52, M(0, 0.45, -0.2)],
    [SPH(2.35, 12, 8), 0xc4823c, M(0, 0.48, 3.35, 0, 0, 0, 1, 0.52, 1.15)],
    [new THREE.BoxGeometry(5.15, 0.3, 7.5), 0xd82828, M(0, 1.18, -0.2)],
    [new THREE.CylinderGeometry(0.34, 0.34, 1.4, 8), 0x8a909a, M(0, 0.58, -4.1, Math.PI / 2)]
  ], 0, true);
  const sampanPropG = build([
    [new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10), 0xffc23a, M(0, 0, 0, Math.PI / 2)],
    ...[0, 1, 2].map(n => [
      new THREE.BoxGeometry(0.34, 1.65, 0.12), 0xffc23a,
      M(Math.sin(n * 2.094) * 0.78, Math.cos(n * 2.094) * 0.78, 0, 0, 0, -n * 2.094)
    ])
  ], 0, true);

  function runBoatTick(k, dt, gas, brake) {
    if (api.boatTick) { api.boatTick(k, dt, gas, brake); return; }
    const TR = getTR();
    const on = k.onGround && SURF[k.idx] === 3;
    if (on && !k.boat) {
      k.boat = true;
      k.boats = (k.boats || 0) + 1;
      burst(FX, k.x, k.y + 0.5, k.z, 28, 14, 0.45, 0.85, 1, 0.88, 0.55, 10, 5);
    } else if (!on && k.boat && k.onGround) {
      k.boat = false;
    }
    if (k.boat && k.spinT <= 0 && k.respawnT <= 0) {
      const want = k.maxS * (brake ? 0.45 : 0.85);
      if (k.speed < want) k.speed = toward(k.speed, want, (gas ? 34 : 26) * dt);
      if (G.fin && k.onGround) {
        const i = k.idx, w = Math.sin(G.time * 1.6 + i * 0.02) * 6.5 * dt;
        k.x += TR[i].x * w; k.z += TR[i].z * w;
      }
    }
  }

  function runBoatVisual(dt, t) {
    if (api.boatVisual) { api.boatVisual(dt, t); return; }
    for (const k of G.karts) {
      const v = k.v; if (!v) continue;
      k.boatS = toward(k.boatS || 0, k.boat ? 1 : 0, dt * 5);
      const s = k.boatS;
      if (s > 0.01 || v._sampanHull) {
        if (!v._sampanHull) {
          v._sampanHull = new THREE.Mesh(sampanHullG, vcPhong);
          v.body.add(v._sampanHull);
          v._sampanProp = new THREE.Mesh(sampanPropG, vcPhong);
          v._sampanProp.position.set(0, 0.6, -4.9);
          v.body.add(v._sampanProp);
        }
        v._sampanHull.visible = s > 0.01;
        v._sampanHull.scale.setScalar(Math.max(0.01, s));
        v._sampanHull.position.y = Math.sin(t * 2.6 + k.seed * 3) * 0.12 * s;
        v._sampanProp.visible = s > 0.5;
        v._sampanProp.rotation.z += dt * (8 + Math.abs(k.speed) * 0.9);
      }
      for (const w of v.wheels) w.w.visible = s < 0.5;
      if (k.boat && Math.abs(k.speed) > 12 && R() < 0.8) {
        const sx = Math.sin(k.heading), cx = Math.cos(k.heading);
        for (const sd of [-1, 1]) {
          FX.emit(
            k.x - sx * 4 + cx * 2.4 * sd, k.y + 0.3, k.z - cx * 4 - sx * 2.4 * sd,
            -sx * 4 + cx * 5 * sd + rr(-1, 1), rr(2, 5), -cx * 4 - sx * 5 * sd + rr(-1, 1),
            0.45, rr(0.6, 1.1), 1, 0.88, 0.55, 0.9, 9
          );
        }
      }
    }
  }

  // Reusable unfenced edge beacons so players always read cosmic/chasm drop-offs clearly
  function buildUnfencedBeacons(L, colHexA, colHexB) {
    if (!L.unfenced || !L.unfenced.length) return;
    const SP = getSP();
    const step = Math.max(2, Math.round(9 / SP));
    const pts = [];
    for (const [f0, f1] of L.unfenced) {
      const i0 = Math.floor(f0 * N), i1 = Math.floor(f1 * N);
      for (let i = i0; i <= i1; i += step) {
        const ii = wrapI(i);
        if (GAP[ii]) continue;
        for (const s of [-1, 1]) pts.push([ii, s]);
      }
    }
    if (!pts.length) return;
    const postG = build([
      [new THREE.CylinderGeometry(0.32, 0.42, 1.1, 8), 0x222230, M(0, 0.55, 0)],
      [new THREE.OctahedronGeometry(0.55, 0), 0xffffff, M(0, 1.35, 0)]
    ]);
    const mat = glowMat(1.8, 1.5, 2.2).clone();
    const im = addL(new THREE.InstancedMesh(postG, mat, pts.length));
    pts.forEach(([i, s], idx) => {
      const p = edge(i, s * (WALL - 0.8), 0);
      im.setMatrixAt(idx, M(p[0], p[1], p[2], 0, TA[i], 0));
      im.setColorAt(idx, C(idx % 2 ? colHexA : colHexB));
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ==========================================================================
  // NEW MUSIC GROOVES (64-step melodies, 4-bar progressions, 8-step basslines)
  // ==========================================================================
  Object.assign(MUSIC, {
    rainbow: {
      tempo: 148, lead: 'sawtooth',
      prog: [[60, 64, 67, 71], [65, 69, 72, 76], [67, 71, 74, 79], [57, 60, 64, 69]],
      bass: [0, 12, 7, 12, 0, 12, 7, 14], perc: 'garage',
      mel: [
        84, 0, 79, 0, 76, 79, 84, 0, 88, 0, 86, 84, 0, 79, 76, 0,
        81, 0, 77, 0, 72, 77, 81, 0, 84, 0, 86, 88, 0, 84, 81, 0,
        86, 0, 83, 0, 79, 83, 86, 0, 91, 0, 89, 86, 0, 83, 79, 0,
        81, 0, 84, 83, 81, 0, 79, 76, 81, 0, 84, 0, 88, 0, 0, 0
      ]
    },
    clockwork: {
      tempo: 140, lead: 'square',
      prog: [[57, 60, 64], [62, 65, 69], [52, 56, 59], [57, 60, 64]],
      bass: [0, 7, 12, 7, 0, 7, 12, 7], perc: 'bell',
      mel: [
        76, 0, 77, 76, 0, 72, 69, 0, 76, 0, 81, 0, 79, 77, 76, 0,
        74, 0, 76, 74, 0, 69, 65, 0, 74, 0, 77, 0, 76, 74, 72, 0,
        71, 0, 74, 0, 76, 0, 80, 0, 83, 81, 80, 76, 74, 0, 71, 0,
        69, 72, 76, 0, 81, 0, 76, 0, 81, 0, 0, 0, 69, 0, 0, 0
      ]
    },
    ramen: {
      tempo: 138, lead: 'square',
      prog: [[57, 62, 64], [55, 59, 62], [53, 57, 60], [55, 60, 62]],
      bass: [0, 0, 12, 7, 0, 12, 7, 10], perc: 'dhol',
      mel: [
        76, 0, 79, 81, 0, 79, 76, 74, 72, 0, 74, 76, 0, 72, 69, 0,
        74, 0, 76, 79, 0, 81, 79, 76, 74, 0, 0, 72, 74, 0, 0, 0,
        81, 0, 84, 81, 0, 79, 76, 0, 74, 76, 79, 0, 76, 74, 72, 0,
        69, 0, 72, 74, 76, 0, 79, 81, 76, 0, 0, 0, 0, 0, 0, 0
      ]
    },
    tokyo: {
      tempo: 146, lead: 'sawtooth',
      prog: [[58, 61, 65], [54, 58, 61], [56, 60, 63], [53, 57, 60]],
      bass: [0, 12, 0, 12, 7, 12, 10, 12], perc: 'garage',
      mel: [
        77, 0, 77, 80, 0, 77, 75, 73, 0, 75, 77, 0, 73, 0, 70, 0,
        73, 0, 73, 77, 0, 80, 78, 77, 0, 75, 73, 0, 72, 0, 0, 0,
        75, 0, 77, 80, 0, 82, 80, 77, 75, 0, 77, 80, 84, 0, 82, 0,
        80, 0, 77, 75, 77, 0, 80, 0, 77, 0, 0, 0, 0, 0, 0, 0
      ]
    },
    funk: {
      tempo: 134, lead: 'sawtooth',
      prog: [[55, 58, 62, 65], [60, 63, 67, 70], [53, 57, 60, 63], [55, 58, 62, 65]],
      bass: [0, 12, 10, 0, 7, 10, 12, 7], perc: 'garage',
      mel: [
        79, 0, 79, 82, 0, 79, 77, 0, 74, 0, 77, 79, 0, 0, 0, 0,
        84, 0, 82, 79, 0, 77, 74, 0, 77, 79, 0, 74, 0, 0, 0, 0,
        77, 0, 79, 81, 0, 79, 77, 74, 72, 0, 74, 77, 0, 0, 0, 0,
        79, 82, 84, 0, 86, 0, 84, 82, 79, 0, 0, 0, 0, 0, 0, 0
      ]
    },
    origami: {
      tempo: 128, lead: 'triangle',
      prog: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 64]],
      bass: [0, 7, 12, 7, 0, 7, 14, 7], perc: 'soft',
      mel: [
        81, 0, 79, 76, 0, 72, 76, 0, 79, 0, 81, 84, 0, 81, 79, 0,
        76, 0, 72, 69, 0, 72, 76, 0, 74, 0, 76, 79, 0, 0, 0, 0,
        84, 0, 81, 79, 0, 76, 79, 81, 84, 0, 88, 0, 84, 81, 79, 0,
        76, 0, 79, 81, 0, 79, 76, 72, 76, 0, 0, 0, 0, 0, 0, 0
      ]
    },
    pizza: {
      tempo: 144, lead: 'square',
      prog: [[57, 60, 64], [62, 65, 69], [55, 59, 62], [60, 64, 67]],
      bass: [0, 7, 12, 7, 0, 7, 12, 7], perc: 'surf',
      mel: [
        81, 80, 81, 84, 0, 81, 76, 0, 81, 80, 81, 86, 0, 84, 81, 0,
        77, 76, 77, 81, 0, 77, 74, 0, 76, 0, 79, 76, 72, 0, 0, 0,
        79, 78, 79, 83, 0, 79, 74, 0, 79, 78, 79, 84, 0, 83, 79, 0,
        76, 79, 84, 0, 83, 79, 74, 0, 72, 0, 84, 0, 72, 0, 0, 0
      ]
    }
  });

  // ==========================================================================
  // NEW STRIKE_KINDS (Aerial / Environmental Projectiles)
  // ==========================================================================
  STRIKE_KINDS.starfall = {
    geo: build([
      [new THREE.OctahedronGeometry(1.9, 0), 0xfff08a],
      [new THREE.OctahedronGeometry(1.3, 0), 0xff6ad8, M(0, 0, 0, 0.6, 0.6, 0)]
    ], 0, true),
    mat: glowMat(2.4, 1.9, 1.1),
    r: 5.4, arc: 48, spin: 7, pop: 7,
    burst: [1, 0.85, 0.45], trail: [1, 0.7, 0.95], warn: 0xffd23f
  };
  STRIKE_KINDS.cog = {
    geo: build([
      [new THREE.CylinderGeometry(2.1, 2.1, 0.6, 12), 0xd4a244, M(0, 0, 0, Math.PI / 2)],
      ...[0, 1, 2, 3, 4, 5].map(q => [
        new THREE.BoxGeometry(0.65, 5.0, 0.62), 0xb8842c,
        M(0, 0, 0, 0, 0, q * Math.PI / 6)
      ])
    ], 0, true),
    r: 5.2, arc: 34, spin: 9, pop: 6.5,
    burst: [0.85, 0.68, 0.3], warn: 0xd4a244
  };
  STRIKE_KINDS.broth = {
    geo: build([
      [SPH(1.4, 12, 8), 0xff8a2a, M(0, 0, 0, 0, 0, 0, 1.2, 0.7, 1.2)],
      [SPH(0.7, 8, 6), 0xff3b1f, M(0.5, 0.4, 0.2)]
    ], 0, true),
    r: 5.2, arc: 26, spin: 3,
    splat: ['#ff9a3a', '#ff5b1f', '#ffd89a'], slow: 0.75, warn: 0xff6a1f
  };
  STRIKE_KINDS.cyber = {
    geo: build([
      [new THREE.OctahedronGeometry(1.5, 0), 0x26f0ff],
      [new THREE.TorusGeometry(1.8, 0.22, 6, 16), 0xff3bd8, M(0, 0, 0, Math.PI / 2)]
    ], 0, true),
    mat: glowMat(1.2, 2.2, 2.6),
    r: 5.0, arc: 30, spin: 8, pop: 6,
    burst: [0.3, 0.9, 1.0], warn: 0xff3bd8
  };
  STRIKE_KINDS.disco = {
    geo: build([
      [SPH(1.7, 12, 10), 0xe8ecf8],
      [new THREE.TorusGeometry(2.1, 0.2, 6, 18), 0xffd23f]
    ], 0),
    r: 5.2, arc: 32, spin: 7, pop: 6.5,
    burst: [1, 0.6, 1], warn: 0xff4fd8
  };
  STRIKE_KINDS.ink = {
    geo: build([
      [SPH(1.45, 10, 8), 0x161424, M(0, 0, 0, 0, 0, 0, 1, 1.3, 1)],
      [SPH(0.75, 8, 6), 0x2e2a4a, M(0.4, 0.6, 0.2)]
    ], 0, true),
    r: 5.4, arc: 28, spin: 3,
    splat: ['#141222', '#26223e', '#3a2c54'], splatT: 2.8, slow: 0.78, warn: 0x3a2c54
  };
  STRIKE_KINDS.shard = {
    geo: build([
      [new THREE.ConeGeometry(1.2, 3.8, 6), 0xc45aff, M(0, 0.5, 0)],
      [new THREE.ConeGeometry(0.8, 2.4, 6), 0x4af0ff, M(0.7, 0, 0.4, 0, 0, -0.4)]
    ], 0),
    mat: glowMat(1.8, 0.9, 2.4),
    r: 5.2, arc: 26, spin: 6, pop: 6.5,
    burst: [0.75, 0.4, 1.0], warn: 0xc45aff
  };
  STRIKE_KINDS.candy = {
    geo: build([
      [SPH(1.65, 12, 10), 0xff8ad8, M(0, 0.3, 0, 0, 0, 0, 1.15, 0.9, 1.15)],
      [new THREE.ConeGeometry(0.45, 2.2, 8), 0xfff4e0, M(0, -1.1, 0, Math.PI)]
    ], 0, true),
    r: 5.2, arc: 30, spin: 4,
    splat: ['#ff8ad8', '#ffb8e8', '#7ad8ff'], slow: 0.76, warn: 0xff8ad8
  };
  STRIKE_KINDS.marinara = {
    geo: build([
      [SPH(1.5, 12, 8), 0xd82818, M(0, 0, 0, 0, 0, 0, 1.2, 0.65, 1.2)],
      [SPH(0.65, 8, 6), 0xffd24a, M(-0.4, 0.35, 0.3)]
    ], 0, true),
    r: 5.4, arc: 26, spin: 3,
    splat: ['#d82818', '#ff4a2a', '#ffd24a'], slow: 0.74, warn: 0xd82818
  };

  // ==========================================================================
  // TRACK 1: RAINBOW OVERDRIVE (rainbow)
  // High-orbit stained-glass prism highway with unfenced space drops & star rings
  // ==========================================================================
  function buildRainbow(L) {
    const TP = getTP(), TR = getTR(), GAPS = getGAPS(), LR = getLR(), SP = getSP();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 560; LR.titleH = 200;
    LR.look = new THREE.Vector3(ctr.x, 45, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 45, ctr.y);
    LR.dust = i => {
      const c = new THREE.Color().setHSL((i / N * 3) % 1, 0.9, 0.7);
      return [c.r, c.g, c.b];
    };

    // Stained-glass rainbow prism overlay down the centre of the highway
    addL(new THREE.Mesh(
      ribbon(-ROAD * 0.85, ROAD * 0.85, 0.09, i => new THREE.Color().setHSL((i / N * 4) % 1, 0.95, 0.62), 18),
      new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.12, metalness: 0.45,
        transparent: true, opacity: 0.52, depthWrite: false
      })
    ));

    // Unfenced edge starlight beacons
    buildUnfencedBeacons(L, 0x26f0ff, 0xff4fd8);

    // Colossal ringed gas giant + twin crystalline moons + nebula curtains
    const planetTex = ltex(256, 128, (x, w, h) => {
      for (let y = 0; y < h; y++) {
        const u = y / h;
        const r = Math.round(90 + 110 * Math.sin(u * 14));
        const g = Math.round(60 + 90 * Math.sin(u * 10 + 1.4));
        const b = Math.round(180 + 65 * Math.cos(u * 8));
        x.fillStyle = `rgb(${r},${g},${b})`;
        x.fillRect(0, y, w, 1);
      }
    });
    const planet = addL(new THREE.Mesh(SPH(250, 40, 28), new THREE.MeshLambertMaterial({ map: planetTex, fog: false })));
    planet.position.set(ctr.x + 880, 220, ctr.y - 1050);
    const ringGeo = new THREE.RingGeometry(310, 520, 80);
    const ringMesh = addL(new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: HDR(1.4, 0.9, 2.2), transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, fog: false })
    ));
    ringMesh.position.copy(planet.position);
    ringMesh.rotation.set(-Math.PI / 2 + 0.42, 0.2, 0.35);

    // Floating stained-glass crystal spires & cosmic star-arches around the circuit
    const spireG = build([
      [new THREE.OctahedronGeometry(8, 0), 0xffffff, M(0, 0, 0, 0, 0, 0, 1, 2.8, 1)],
      [new THREE.TorusGeometry(11, 0.7, 8, 24), 0xffd23f, M(0, 0, 0, Math.PI / 2)]
    ]);
    const spires = [];
    for (let n = 0; n < 34; n++) {
      const a = (n / 34) * Math.PI * 2, r = rr(220, 920);
      const x = ctr.x + Math.cos(a) * r, z = ctr.y + Math.sin(a) * r;
      if (nearSpire(TP, x, z, 58)) continue;
      const col = new THREE.Color().setHSL((n / 12) % 1, 0.9, 0.65);
      const m = addL(new THREE.Mesh(spireG, glowMat(col.r * 2.0, col.g * 2.0, col.b * 2.0)));
      const y = rr(10, 120);
      m.position.set(x, y, z);
      m.scale.setScalar(rr(0.8, 2.1));
      spires.push({ m, y, ph: R() * 6.28 });
    }
    function nearSpire(tp, x, z, rad) {
      for (let i = 0; i < N; i += 4) {
        if ((tp[i].x - x) ** 2 + (tp[i].z - z) ** 2 < rad * rad) return true;
      }
      return false;
    }

    // Overhead rainbow prism arches framing sightlines before corners
    for (const f of [0.04, 0.24, 0.44, 0.70, 0.89]) {
      const i = wrapI(Math.floor(f * N));
      if (GAP[i]) continue;
      const arch = addL(new THREE.Group());
      const col = new THREE.Color().setHSL(f, 1, 0.6);
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(WALL + 2, 1.1, 10, 40, Math.PI),
        glowMat(col.r * 2.4, col.g * 2.4, col.b * 2.4)
      );
      arch.add(torus);
      arch.position.set(TP[i].x, H[i], TP[i].z);
      arch.rotation.y = TA[i];
    }

    // Starlight boost rings over the glider gap + along unfenced crests
    const starRings = [];
    const g0 = GAPS[0];
    if (g0) {
      for (const u of [0.22, 0.52, 0.82]) {
        const i = wrapI(Math.round(lerp(g0.s, g0.e, u)));
        const hy = lerp(H[wrapI(g0.s - 1)], H[wrapI(g0.e)], u) + 10;
        const m = addL(new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.65, 10, 28), glowMat(2.6, 2.1, 0.6)));
        m.position.set(TP[i].x, hy, TP[i].z);
        m.rotation.y = TA[i];
        starRings.push({ m, p: m.position });
      }
    }
    for (const [f, lat] of [[0.14, -5], [0.19, 5], [0.59, 6], [0.64, -6]]) {
      const i = wrapI(Math.floor(f * N));
      const p = edge(i, lat, 3.6);
      const m = addL(new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.55, 10, 24), glowMat(0.8, 2.4, 2.6)));
      m.position.set(p[0], p[1], p[2]);
      m.rotation.y = TA[i];
      starRings.push({ m, p: m.position });
    }

    // Cosmic star-mines on non-unfenced sections (bounce + sparkle)
    const starMineG = build([
      [new THREE.OctahedronGeometry(2.0, 0), 0xff4fd8, M(0, 1.8, 0)],
      [new THREE.TorusGeometry(2.4, 0.3, 8, 20), 0x26f0ff, M(0, 1.8, 0, Math.PI / 2)]
    ]);
    const mines = roadBumps(L, [[0.34, -6], [0.50, 5], [0.87, -5], [0.95, 6]], {
      geo: starMineG, mat: glowMat(2.0, 0.9, 2.2), key: 'pulsed', r: 3.0, cd: 1.1, mapCol: '#ff4fd8',
      effect: k => {
        if (k.shieldT > 0) { shieldPop(k); return; }
        k.vy = 9; k.onGround = false; k.speed *= 0.72;
        burst(FX, k.x, k.y + 1.5, k.z, 26, 15, 0.5, 1.0, 1, 0.5, 1);
      }
    });

    const starfalls = thrower({
      kind: 'starfall', every: [3.2, 5.0], finEvery: [1.3, 2.2], delay: 1.65,
      from: k => ({ x: k.x + rr(-60, 60), y: k.y + 115, z: k.z + rr(-60, 60) })
    });

    const cosmic = {
      update(dt, t) {
        planet.rotation.y += dt * 0.03;
        ringMesh.rotation.z += dt * 0.04;
        for (const s of spires) {
          s.m.position.y = s.y + Math.sin(t * 1.4 + s.ph) * 4;
          s.m.rotation.y += dt * 0.6;
        }
        for (const r of starRings) r.m.rotation.z += dt * 1.5;
        if (R() < 0.55) {
          const i = (R() * N) | 0;
          const c = new THREE.Color().setHSL(R(), 1, 0.7);
          FX.emit(TP[i].x + rr(-40, 40), H[i] + rr(8, 45), TP[i].z + rr(-40, 40), 0, rr(1, 4), 0, 1.2, rr(0.8, 1.6), c.r, c.g, c.b, 0.9);
        }
      },
      hazard(dt) {
        for (const k of G.karts) {
          if (k.respawnT > 0) continue;
          if (k.ringCD > 0) k.ringCD -= dt;
          for (const r of starRings) {
            if (Math.hypot(k.x - r.p.x, k.y + 1.6 - r.p.y, k.z - r.p.z) < 6.2 && !(k.ringCD > 0)) {
              k.ringCD = 0.65;
              k.boostT = Math.max(k.boostT, 1.35);
              giveCoins(k, 1);
              burst(FX, r.p.x, r.p.y, r.p.z, 28, 18, 0.5, 1.1, 1, 0.9, 0.35);
            }
          }
        }
      }
    };

    LR.fin = {
      msg: 'SUPERNOVA! FINAL LAP',
      atmo: { sky: [0x180028, 0x6a0a5a, 0xff8a2a], bg: 0x120020, fog: [0x240638, 450, 2200], hc: 0xffb0ff, hemi: 0.9, light: 1.1 }
    };
    mergeLR([mines, starfalls, cosmic]);
  }

  // ==========================================================================
  // TRACK 2: CLOCKWORK CITADEL (clockwork)
  // Colossal brass clocktower with rotating cogs & timed swinging pendulums
  // ==========================================================================
  function makeGearGeo(rad, thick, teeth, colBody, colRim) {
    const parts = [
      [new THREE.CylinderGeometry(rad, rad, thick, 24), colBody],
      [new THREE.CylinderGeometry(rad * 0.35, rad * 0.35, thick * 1.3, 16), colRim],
      [new THREE.TorusGeometry(rad * 0.72, thick * 0.38, 8, 24), colRim, M(0, 0, 0, Math.PI / 2)]
    ];
    for (let k = 0; k < 4; k++) {
      parts.push([new THREE.BoxGeometry(rad * 1.85, thick * 0.7, rad * 0.14), colRim, M(0, 0, 0, 0, (k * Math.PI) / 4, 0)]);
    }
    for (let t = 0; t < teeth; t++) {
      const a = (t / teeth) * Math.PI * 2;
      parts.push([
        new THREE.BoxGeometry(rad * 0.22, thick * 0.92, rad * 0.26),
        colBody,
        M(Math.cos(a) * (rad + rad * 0.08), 0, Math.sin(a) * (rad + rad * 0.08), 0, -a, 0)
      ]);
    }
    return build(parts, 0.04);
  }

  function buildClockwork(L) {
    const TP = getTP(), LR = getLR();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 510; LR.titleH = 175;
    LR.look = new THREE.Vector3(ctr.x, 28, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 20, ctr.y);
    LR.dust = () => [0.85, 0.72, 0.42];

    groundPlane(ctr, '#241a12', ['rgba(90,65,35,.55)', 'rgba(55,38,20,.6)', 'rgba(140,100,45,.4)'], 55, 5200);

    const brassMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.78, roughness: 0.28 });
    const gearBrass = makeGearGeo(28, 3.2, 16, 0xd4a244, 0x8a5e20);
    const gearCopper = makeGearGeo(20, 2.8, 12, 0xc87442, 0x6e3a1e);
    const gearSteel = makeGearGeo(15, 2.4, 10, 0x9aa4b2, 0x565e6a);

    // Giant interlocking horizontal & vertical gears beneath and around the road
    const gears = [];
    for (let n = 0; n < 28; n++) {
      const a = (n / 28) * Math.PI * 2 + rr(-0.08, 0.08);
      const r = rr(90, 560);
      const x = ctr.x + Math.cos(a) * r, z = ctr.y + Math.sin(a) * r;
      const gPick = [gearBrass, gearCopper, gearSteel][n % 3];
      const vert = n % 4 === 0 && placeOK(x, z, 46);
      const m = addL(new THREE.Mesh(gPick, brassMat));
      const sc = rr(0.9, 2.1);
      m.scale.setScalar(sc);
      if (vert) {
        m.position.set(x, rr(22, 58), z);
        m.rotation.x = Math.PI / 2;
        m.rotation.z = R() * 6.28;
      } else {
        m.position.set(x, rr(1.5, 11), z);
      }
      m.castShadow = n < 12;
      gears.push({ m, vert, spd: (n % 2 ? 1 : -1) * rr(0.25, 0.65) });
    }

    // Central Grand Grandfather Clockwork Tower with luminous Roman numeral face & hands
    const faceTex = ltex(512, 512, (x, w, h) => {
      x.fillStyle = '#fff6dc'; x.beginPath(); x.arc(256, 256, 246, 0, 7); x.fill();
      x.lineWidth = 16; x.strokeStyle = '#8a5a1e'; x.stroke();
      x.lineWidth = 5; x.strokeStyle = '#24180c'; x.beginPath(); x.arc(256, 256, 205, 0, 7); x.stroke();
      x.fillStyle = '#1e140a'; x.font = 'bold 46px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      nums.forEach((nm, k) => {
        const ang = (k / 12) * Math.PI * 2 - Math.PI / 2;
        x.fillText(nm, 256 + Math.cos(ang) * 168, 256 + Math.sin(ang) * 168);
      });
    });
    let towerPos = placeNear(ctr, 20, 140, 52) || [ctr.x, ctr.y];
    const tower = addL(new THREE.Group());
    tower.add(meshOf([
      [new THREE.BoxGeometry(58, 145, 58), 0x5a3a22, M(0, 72, 0)],
      [new THREE.BoxGeometry(64, 8, 64), 0xd4a244, M(0, 110, 0)],
      [new THREE.BoxGeometry(64, 8, 64), 0xd4a244, M(0, 144, 0)],
      [new THREE.ConeGeometry(46, 42, 4), 0x3a2416, M(0, 168, 0, 0, Math.PI / 4, 0)],
      [new THREE.CylinderGeometry(2.2, 3, 24, 10), 0xffc84a, M(0, 196, 0)]
    ]));
    const hands = [];
    for (let q = 0; q < 4; q++) {
      const side = new THREE.Group();
      side.rotation.y = (q * Math.PI) / 2;
      const dial = new THREE.Mesh(new THREE.CircleGeometry(22, 36), new THREE.MeshBasicMaterial({ map: faceTex }));
      dial.position.set(0, 127, 29.4);
      side.add(dial);
      const minH = meshOf([[new THREE.BoxGeometry(1.6, 17, 0.8), 0x1a120a, M(0, 7.5, 0)]]);
      minH.position.set(0, 127, 29.9);
      const hrH = meshOf([[new THREE.BoxGeometry(2.2, 11, 0.8), 0x8a1c14, M(0, 4.5, 0)]]);
      hrH.position.set(0, 127, 30.2);
      side.add(minH, hrH);
      hands.push({ minH, hrH });
      tower.add(side);
    }
    tower.position.set(towerPos[0], -1.2, towerPos[1]);

    // Brass steam pipes & coiled mainspring pillars beside the road
    const pillarG = build([
      [new THREE.CylinderGeometry(1.4, 1.7, 13, 10), 0xb8842c, M(0, 6.5, 0)],
      [new THREE.TorusGeometry(2.2, 0.45, 8, 16), 0xe8bc5a, M(0, 11.5, 0, Math.PI / 2)],
      [SPH(1.3, 10, 8), 0xffe48a, M(0, 13.5, 0)]
    ]);
    roadRow(pillarG, 62, WALL + 4.5, { mat: brassMat, shadow: true });

    // Swinging brass pendulum blades across the track (deterministic timed crossers!)
    const pendGeo = build([
      [new THREE.CylinderGeometry(4.6, 4.6, 1.6, 20), 0xe0ae48, M(0, 3.8, 0, 0, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(2.4, 2.4, 1.9, 16), 0x8a5218, M(0, 3.8, 0, 0, 0, Math.PI / 2)],
      [new THREE.BoxGeometry(0.9, 26, 1.2), 0x6a4420, M(0, 17, 0)]
    ]);
    const pend1 = crossers(L, {
      at: 0.18, n: 1, geo: pendGeo, mat: brassMat,
      cyc: 9.5, on0: 3.5, on1: 7.0, span: 36, key: 'pendulum',
      hitA: 4.5, hitL: 5.0, bob: 0, bobH: 0, mapCol: '#e0ae48'
    });
    const pend2 = crossers(L, {
      at: 0.74, n: 1, geo: pendGeo, mat: brassMat,
      cyc: 10.5, on0: 4.0, on1: 7.6, span: 36, dir: -1, key: 'pendulum2',
      hitA: 4.5, hitL: 5.0, bob: 0, bobH: 0, mapCol: '#e0ae48'
    });

    const fallingCogs = thrower({
      kind: 'cog', every: [3.4, 5.2], finEvery: [1.4, 2.3], delay: 1.6,
      from: () => ({ x: towerPos[0], y: 155, z: towerPos[1] })
    });

    const mech = {
      update(dt, t) {
        const mult = G.fin ? 2.8 : 1.0;
        for (const g of gears) {
          if (g.vert) g.m.rotation.z += g.spd * mult * dt;
          else g.m.rotation.y += g.spd * mult * dt;
        }
        for (const h of hands) {
          h.minH.rotation.z = -t * 0.45 * mult;
          h.hrH.rotation.z = -t * 0.08 * mult;
        }
        if (R() < 0.35) {
          const i = (R() * N) | 0;
          SMOKE.emit(TP[i].x + rr(-35, 35), H[i] + rr(0, 6), TP[i].z + rr(-35, 35), 0, rr(4, 9), 0, 1.4, rr(2, 4.5), 0.92, 0.9, 0.85, 0.4, -1, 0.3, 1.2);
        }
      }
    };

    LR.fin = {
      msg: 'MIDNIGHT STRIKE! FINAL LAP',
      atmo: { sky: [0x1a0804, 0x6e2410, 0xffaa32], bg: 0x2a1008, fog: [0x3e1a0c, 220, 1250], hc: 0xffc878, hemi: 0.82, light: 0.95 }
    };
    mergeLR([pend1, pend2, fallingCogs, mech]);
  }

  // ==========================================================================
  // TRACK 3: RAMEN RAPIDS (ramen)
  // Toy-scale race around a steaming giant ramen bowl with SURF=3 broth boat pools
  // ==========================================================================
  function buildRamen(L) {
    const TP = getTP(), LR = getLR();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 490; LR.titleH = 165;
    LR.look = new THREE.Vector3(ctr.x, 16, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 12, ctr.y);
    LR.dust = i => SURF[i] === 3 ? [1.0, 0.85, 0.5] : [0.98, 0.92, 0.72];

    // Bamboo counter mat far below + steaming golden tonkotsu broth sea inside the bowl
    const bambooTex = ltex(256, 256, (x, w, h) => {
      for (let y = 0; y < h; y += 16) {
        x.fillStyle = (y / 16) % 2 ? '#c99b5e' : '#bc8e50';
        x.fillRect(0, y, w, 15);
        x.fillStyle = '#7a5428'; x.fillRect(0, y + 15, w, 1);
      }
    }, true);
    bambooTex.repeat.set(45, 45);
    const counter = addL(new THREE.Mesh(new THREE.PlaneGeometry(5400, 5400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: bambooTex })));
    counter.position.set(ctr.x, -6, ctr.y);
    counter.receiveShadow = true;

    const brothTex = ltex(256, 256, (x, w, h) => {
      x.fillStyle = '#d98c2b'; x.fillRect(0, 0, w, h);
      const r2 = rng(55);
      for (let k = 0; k < 95; k++) {
        x.fillStyle = k % 3 === 0 ? 'rgba(255,220,120,.45)' : 'rgba(215,65,20,.32)';
        x.beginPath(); x.arc(r2() * w, r2() * h, 4 + r2() * 16, 0, 7); x.fill();
      }
    }, true);
    brothTex.repeat.set(18, 18);
    const brothSea = addL(new THREE.Mesh(
      new THREE.CircleGeometry(660, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: brothTex, roughness: 0.14, metalness: 0.15, transparent: true, opacity: 0.93 })
    ));
    brothSea.position.set(ctr.x, 8.8, ctr.y);

    // Broth ribbon over the SURF===3 boat sections
    addL(new THREE.Mesh(
      ribbon(-(ROAD + CURB + 3), ROAD + CURB + 3, 0.14, () => C(0xffbe55), 12, i => SURF[i] === 3),
      new THREE.MeshStandardMaterial({ map: brothTex, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.88 })
    ));

    // Colossal blue-and-white Japanese ceramic ramen bowl rim encircling the track
    const bowlTex = ltex(512, 128, (x, w, h) => {
      x.fillStyle = '#f6f2e8'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1e4a8a'; x.fillRect(0, 10, w, 14); x.fillRect(0, h - 22, w, 12);
      x.strokeStyle = '#c82828'; x.lineWidth = 6;
      for (let sx = 16; sx < w; sx += 64) {
        x.strokeRect(sx, 36, 40, 48);
        x.strokeRect(sx + 10, 46, 20, 28);
      }
    }, true);
    bowlTex.repeat.set(18, 1);
    const bowlWall = addL(new THREE.Mesh(
      new THREE.CylinderGeometry(710, 610, 120, 64, 1, true),
      new THREE.MeshLambertMaterial({ map: bowlTex, side: THREE.DoubleSide })
    ));
    bowlWall.position.set(ctr.x, 48, ctr.y);

    // Floating Narutomaki (pink spiral fishcakes) — scenic + soft bumpers in broth pools!
    const naruTex = ltex(128, 128, (x, w, h) => {
      x.fillStyle = '#fffaf4'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill();
      x.strokeStyle = '#ff5fa2'; x.lineWidth = 8; x.beginPath();
      for (let t = 0; t < 42; t++) {
        const r = t * 1.1, a = t * 0.42;
        x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      x.stroke();
    });
    const naruMat = new THREE.MeshLambertMaterial({ map: naruTex });
    const naruSide = new THREE.MeshLambertMaterial({ color: 0xfff4ea });
    const naruGeo = new THREE.CylinderGeometry(3.2, 3.2, 1.1, 20);
    const naruPool = [];
    for (const [f0, f1] of L.surf) {
      for (let n = 0; n < 4; n++) {
        const i = wrapI(Math.floor(lerp(f0, f1, (n + 0.6) / 4.6) * N));
        const l = [-7, 6, -3, 7][n];
        const p = edge(i, l, 0.45);
        const m = addL(new THREE.Mesh(naruGeo, [naruSide, naruMat, naruMat]));
        m.position.set(p[0], p[1], p[2]);
        naruPool.push({ m, x: p[0], y: p[1], z: p[2], ph: R() * 6.28 });
      }
    }

    // Giant halved soft-boiled Ajitama eggs, green-onion rings, chashu slices & nori sheets
    const eggG = build([
      [SPH(12, 18, 12), 0xfffaf0, M(0, 0, 0, 0, 0, 0, 1.25, 0.55, 1.0)],
      [SPH(6.8, 16, 10), 0xff8a18, M(0, 2.2, 0, 0, 0, 0, 1.0, 0.55, 0.9)]
    ], 0, true);
    const scallionG = new THREE.TorusGeometry(6.5, 1.5, 10, 20);
    scallionG.rotateX(Math.PI / 2);
    for (let n = 0; n < 16; n++) {
      const p = placeNear(ctr, 50, 560, 44);
      if (!p) continue;
      if (n % 2 === 0) {
        const e = addL(new THREE.Mesh(eggG, glossy(0xffffff)));
        e.material = paintMat;
        e.position.set(p[0], 9.2, p[1]);
        e.rotation.y = R() * 6.28;
        e.scale.setScalar(rr(1.0, 1.6));
      } else {
        const sc = addL(new THREE.Mesh(scallionG, new THREE.MeshLambertMaterial({ color: n % 4 === 1 ? 0x48b83c : 0x6cd858 })));
        sc.position.set(p[0], 9.4, p[1]);
        sc.scale.setScalar(rr(0.9, 1.5));
      }
    }
    // Giant crispy Nori seaweed slabs standing around the rim
    for (let k = 0; k < 5; k++) {
      const a = -0.6 + k * 0.28;
      const nx = ctr.x + Math.cos(a) * 560, nz = ctr.y + Math.sin(a) * 560;
      const nori = addL(new THREE.Mesh(new THREE.BoxGeometry(58, 95, 2.5), new THREE.MeshLambertMaterial({ color: 0x162416 })));
      nori.position.set(nx, 44, nz);
      nori.rotation.set(-0.18, -a + Math.PI / 2, (k - 2) * 0.06);
    }

    // Giant wooden chopsticks sweeping noodles across the road
    const chopG = build([
      [new THREE.CylinderGeometry(0.7, 1.3, 46, 10), 0xc88a48, M(0, 2.2, -1.6, 0, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(0.7, 1.3, 46, 10), 0xc88a48, M(0, 3.8, 1.6, 0, 0, Math.PI / 2)],
      [new THREE.TorusGeometry(2.2, 0.55, 8, 16), 0xffe49c, M(-10, 2.6, 0)]
    ], 0, true);
    const chop1 = crossers(L, {
      at: 0.19, n: 1, geo: chopG, cyc: 11, on0: 4.5, on1: 8.2, span: 42,
      key: 'chopped', hitA: 5, hitL: 16, bob: 3, bobH: 0.6, mapCol: '#c88a48'
    });
    const chop2 = crossers(L, {
      at: 0.90, n: 1, geo: chopG, cyc: 12.5, on0: 5.0, on1: 8.8, span: 42, dir: -1,
      key: 'chopped2', hitA: 5, hitL: 16, bob: 3, bobH: 0.6, mapCol: '#c88a48'
    });

    const brothDrops = thrower({
      kind: 'broth', every: [3.2, 4.8], finEvery: [1.3, 2.1], delay: 1.5,
      from: k => ({ x: ctr.x + rr(-80, 80), y: 95, z: ctr.y + rr(-80, 80) })
    });

    const simmer = {
      update(dt, t) {
        brothTex.offset.x += dt * 0.025;
        brothTex.offset.y -= dt * 0.035;
        runBoatVisual(dt, t);
        for (const r of naruPool) {
          r.m.position.y = r.y + Math.sin(t * 2.2 + r.ph) * 0.32;
          r.m.rotation.y += dt * 0.7;
        }
        if (R() < (G.fin ? 0.9 : 0.55)) {
          const i = (R() * N) | 0;
          SMOKE.emit(TP[i].x + rr(-45, 45), 10, TP[i].z + rr(-45, 45), rr(-2, 2), rr(6, 13), rr(-2, 2), 2.2, rr(4, 9), 1, 0.97, 0.92, 0.35, -1.5, 0.25, 1.6);
        }
      },
      hazard() {
        for (const k of G.karts) {
          if (!k.boat) continue;
          for (const r of naruPool) {
            const dx = k.x - r.x, dz = k.z - r.z, d = Math.hypot(dx, dz);
            if (d < 5.0 && d > 0.01) {
              const push = 5.0 - d;
              k.x += (dx / d) * push; k.z += (dz / d) * push;
              k.speed *= 0.96;
            }
          }
        }
      }
    };

    LR.fin = {
      msg: 'EXTRA SPICY BOIL! FINAL LAP',
      atmo: { sky: [0x3a0804, 0xa82814, 0xff8a3a], bg: 0x4a1208, fog: [0x681c0e, 240, 1400], hc: 0xffb080, hemi: 0.85, light: 0.9 }
    };
    mergeLR([chop1, chop2, brothDrops, simmer]);
    LR.kartTick = (k, dt, gas, brake) => runBoatTick(k, dt, gas, brake);
  }

  // ==========================================================================
  // TRACK 4: TOKYO NEON DRIFTWAY (tokyo)
  // Midnight Shuto expressway cyberpunk touge with holographic koi & Shinkansen
  // ==========================================================================
  function buildTokyo(L) {
    const TP = getTP(), TR = getTR(), LR = getLR();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 520; LR.titleH = 165;
    LR.look = new THREE.Vector3(ctr.x, 22, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 10, ctr.y);
    LR.dust = () => [0.45, 0.8, 1.0];

    // Rain-slicked dark midnight metropolis floor
    const wetGround = addL(new THREE.Mesh(
      new THREE.PlaneGeometry(4800, 4800).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0c0a1a, roughness: 0.18, metalness: 0.55 })
    ));
    wetGround.position.set(ctr.x, -1.2, ctr.y);
    wetGround.receiveShadow = true;

    // Cyberpunk skyscrapers with glowing cyan/magenta window grids
    const winTex = ltex(256, 256, (x, w, h) => {
      x.fillStyle = '#121024'; x.fillRect(0, 0, w, h);
      const r2 = rng(88);
      const cols = ['#26f0ff', '#ff3bd8', '#ffd23f', '#8a6aff'];
      for (let r = 0; r < 16; r++) {
        for (let c = 0; c < 8; c++) {
          if (r2() < 0.52) {
            x.fillStyle = cols[(r + c + ((r2() * 4) | 0)) % 4];
            x.fillRect(c * 32 + 6, r * 16 + 3, 20, 9);
          }
        }
      }
    }, true);
    const bldMat = new THREE.MeshLambertMaterial({ map: winTex, emissiveMap: winTex, emissive: HDR(1.5, 1.4, 1.7) });
    for (const [bw, bh, bd, cnt] of [[28, 85, 28, 45], [36, 135, 32, 40], [22, 175, 22, 32]]) {
      const geo = new THREE.BoxGeometry(bw, bh, bd);
      geo.translate(0, bh / 2, 0);
      const im = addL(new THREE.InstancedMesh(geo, bldMat, cnt));
      let c = 0;
      for (let t = 0; t < 2400 && c < cnt; t++) {
        const a = R() * 6.28, r = rr(70, 980);
        const x = ctr.x + Math.cos(a) * r, z = ctr.y + Math.sin(a) * r;
        if (!placeOK(x, z, WALL + 28)) continue;
        const s = rr(0.85, 1.35);
        im.setMatrixAt(c++, M(x, -1.2, z, 0, ((R() * 4) | 0) * (Math.PI / 2), 0, s, rr(0.75, 1.45), s));
      }
      im.count = c;
    }

    // Vertical & overhead neon billboards beside the expressway
    const neonWords = [
      ['TOKYO 99', '#ff3bd8', '#26f0ff'], ['SHIBUYA', '#26f0ff', '#ffd23f'],
      ['TOUGE DRIFT', '#ffd23f', '#ff3bd8'], ['RAMEN BAR', '#ff6a2a', '#26f0ff'],
      ['AKIBA ARCADE', '#7dffb0', '#ff3bd8'], ['CYBER KOI', '#26f0ff', '#b05aff'],
      ['NITRO WANGAN', '#ff3bd8', '#ffd23f'], ['MIDNIGHT', '#b05aff', '#26f0ff']
    ];
    [0.05, 0.14, 0.28, 0.40, 0.52, 0.69, 0.84, 0.95].forEach((f, idx) => {
      const i = wrapI(Math.floor(f * N));
      if (GAP[i]) return;
      const w = neonWords[idx % neonWords.length];
      const s = idx % 2 ? 1 : -1;
      boardAt(i, s, WALL + 5, H[i] + 11, 20, 6.5, new THREE.MeshBasicMaterial({ map: neonTex(w[0], w[1], w[2]), color: HDR(1.7, 1.7, 1.7), side: THREE.DoubleSide }), 0x221c38);
    });

    // Giant glowing Holographic Koi fish swimming through the skyline
    const koiG = build([
      [SPH(1, 14, 10), 0xff4fd8, M(0, 0, 0, 0, 0, 0, 3.2, 4.2, 11)],
      [new THREE.ConeGeometry(4.5, 9, 4), 0x26f0ff, M(0, 0.5, -13, -Math.PI / 2, Math.PI / 4, 0, 0.4, 1, 1)],
      [new THREE.BoxGeometry(10, 0.3, 4.5), 0x26f0ff, M(0, -1, 2, 0, 0, 0.15)]
    ], 0, true);
    const koiMat = addGlow(1.5, 0.55, 1.4, { opacity: 0.68, side: THREE.DoubleSide });
    const kois = Array.from({ length: 6 }, (_, n) => {
      const m = addL(new THREE.Mesh(koiG, n % 2 ? koiMat : addGlow(0.35, 1.4, 1.8, { opacity: 0.68, side: THREE.DoubleSide })));
      m.scale.setScalar(rr(1.6, 2.4));
      return { m, a: (n / 6) * 6.28, r: rr(190, 440), h: rr(52, 96), spd: rr(0.18, 0.3) * (n % 2 ? 1 : -1) };
    });

    // Elevated Shinkansen bullet-train sky-viaduct + speeding bullet train
    const viaduct = addL(new THREE.Mesh(new THREE.BoxGeometry(12, 3, 2200), new THREE.MeshLambertMaterial({ color: 0x2c2844 })));
    viaduct.position.set(ctr.x, 48, ctr.y - 60);
    viaduct.rotation.y = Math.PI / 3;
    const shinkansen = addL(new THREE.Group());
    const carG = build([
      [rbox(4.6, 3.4, 22, 0.7), 0xf4f8ff, M(0, 2, 0)],
      [new THREE.BoxGeometry(4.7, 0.65, 22.1), 0x26d8ff, M(0, 1.6, 0)],
      [SPH(2.2, 12, 10), 0xf4f8ff, M(0, 1.8, 12.5, 0, 0, 0, 1, 0.72, 2.2)]
    ], 0, true);
    for (let c = 0; c < 6; c++) {
      const cm = new THREE.Mesh(carG, paintMat);
      cm.position.z = -c * 23;
      shinkansen.add(cm);
    }
    shinkansen.rotation.y = Math.PI / 3;

    // Street-level neon tuner drift cars crossing an intersection
    const tunerG = build([
      [rbox(3.8, 1.5, 7.2, 0.4), 0xff2ec4, M(0, 1.1, 0)],
      [rbox(3.1, 1.1, 3.8, 0.3), 0x1a182c, M(0, 2.1, -0.3)],
      [new THREE.BoxGeometry(3.9, 0.18, 7.4), 0x26f0ff, M(0, 0.35, 0)]
    ], 0, true);
    const crossCars = crossers(L, {
      at: 0.12, n: 3, geo: tunerG, mat: paintMat, cyc: 13, on0: 6.0, on1: 10.2,
      span: 58, spread: 11, key: 'bosozoku', hitA: 4.2, hitL: 4.8, bob: 0, bobH: 0, mapCol: '#26f0ff'
    });

    const rain = makeWeather('rain', 4800, 145);
    const drones = thrower({
      kind: 'cyber', every: [3.3, 5.0], finEvery: [1.4, 2.3], delay: 1.55,
      from: k => ({ x: k.x + rr(-35, 35), y: k.y + 75, z: k.z + rr(-35, 35) })
    });

    const cityLife = {
      update(dt, t) {
        rain.t.value = t;
        for (const k of kois) {
          k.a += k.spd * dt;
          k.m.position.set(ctr.x + Math.cos(k.a) * k.r, k.h + Math.sin(t * 2 + k.a * 3) * 5, ctr.y + Math.sin(k.a) * k.r);
          k.m.rotation.y = -k.a + (k.spd > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI / 2;
        }
        const st = ((t * (G.fin ? 260 : 170)) % 2200) - 1100;
        const ang = Math.PI / 3;
        shinkansen.position.set(ctr.x + Math.sin(ang) * st, 49.6, ctr.y - 60 + Math.cos(ang) * st);
      }
    };

    LR.fin = {
      msg: 'CYBER TYPHOON! FINAL LAP',
      atmo: { sky: [0x060016, 0x3a0858, 0xff2eb8], bg: 0x0e0424, fog: [0x1c0838, 150, 980], hc: 0x8ae8ff, hemi: 0.92, light: 0.7 }
    };
    mergeLR([crossCars, drones, cityLife]);
    LR.gust = t => (0.35 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.15), 2)) * (G.fin ? 1.55 : 1);
  }

  // ==========================================================================
  // TRACK 5: MOUNT MAYHEM (mtmayhem) — 1-Lap, 3-Section Point-to-Point Epic!
  // Sec 1: Glacial Dam Spillway -> Sec 2: Sawmill Logs -> Sec 3: Ski Festival
  // ==========================================================================
  function buildMtMayhem(L) {
    const TP = getTP(), TR = getTR(), GAPS = getGAPS(), LR = getLR();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 720; LR.titleH = 230;
    LR.look = new THREE.Vector3(ctr.x, 55, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 45, ctr.y);
    LR.dust = i => (i < N * 0.33 || i > N * 0.67) ? [0.95, 0.97, 1.0] : [0.55, 0.42, 0.26];

    groundPlane(ctr, '#dce8f6', ['rgba(205,222,242,.6)', 'rgba(255,255,255,.7)', 'rgba(130,165,120,.35)'], 65, 7600);
    const snow = makeWeather('snow', 2200, 185);

    // Majestic snow-capped alpine mountain ring around the entire expedition
    const pkG = peakGeo(42, 0.52, 0x6a6e7c, 0x565a68, 0xf2f7ff);
    scatter(pkG, 55, ctr, 680, 2100, 120, 290, { mat: vcPhong, clear: 95, sy: 1.35 });

    // SECTION 1 (0.00 - 0.33): Colossal Concrete Hydroelectric Dam & Spillway
    const damI = wrapI(Math.floor(0.29 * N));
    const damPos = edge(damI, -(WALL + 65), 0);
    const dam = addL(meshOf([
      [new THREE.BoxGeometry(240, 130, 32), 0x8a929e, M(0, 50, 0)],
      [new THREE.BoxGeometry(248, 8, 38), 0x6e7682, M(0, 114, 0)],
      ...[-70, -24, 24, 70].map(xo => [new THREE.BoxGeometry(14, 128, 38), 0x767e8a, M(xo, 50, 0)]),
      ...[-47, 0, 47].map(xo => [new THREE.PlaneGeometry(28, 110), 0x8ae0ff, M(xo, 52, 16.5)])
    ]));
    dam.position.set(damPos[0], -10, damPos[1]);
    dam.rotation.y = TA[damI] + Math.PI / 2;

    // SECTION 2 (0.33 - 0.67): Timber Logging Forest, Lumber Stacks & Spinning Buzzsaws
    const pineG = build([
      [new THREE.CylinderGeometry(1.1, 1.6, 11, 7), 0x5a3a22, M(0, 5.5, 0)],
      [new THREE.ConeGeometry(8, 16, 8), 0x245c34, M(0, 16, 0)],
      [new THREE.ConeGeometry(6, 13, 8), 0x2d6e3e, M(0, 24, 0)],
      [new THREE.ConeGeometry(4, 9, 8), 0xeaf2fa, M(0, 30, 0)]
    ], 0.08);
    scatter(pineG, 420, ctr, 80, 1550, 0.9, 1.8, { mat: vcLambert, clear: 38, shadow: true });

    const sawBladeG = makeGearGeo(11, 0.9, 18, 0xd8dce6, 0x8a2020);
    const sawBlades = [];
    for (const [f, sd] of [[0.36, 1], [0.44, -1], [0.52, 1], [0.61, -1]]) {
      const m = sideProp(new THREE.Mesh(sawBladeG, chrome()), f, sd * (WALL + 6), { y: 7 });
      m.rotation.z = Math.PI / 2;
      sawBlades.push(m);
    }

    // Rolling timber logs across the Section 2 logging chutes
    const logGeo = build([
      [new THREE.CylinderGeometry(2.6, 2.6, 16, 12), 0x7a4a24, M(0, 2.6, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(2.2, 2.2, 16.2, 12), 0xd8b078, M(0, 2.6, 0, Math.PI / 2)]
    ]);
    const logs1 = crossers(L, {
      at: 0.39, n: 2, geo: logGeo, cyc: 11, on0: 4.5, on1: 8.5, span: 55, spread: 14,
      spin: 6, key: 'logged', hitA: 8, hitL: 3.5, bob: 0, bobH: 0, mapCol: '#7a4a24'
    });
    const logs2 = crossers(L, {
      at: 0.54, n: 2, geo: logGeo, cyc: 12, on0: 5.0, on1: 9.0, span: 55, spread: 14, dir: -1,
      spin: 6, key: 'logged2', hitA: 8, hitL: 3.5, bob: 0, bobH: 0, mapCol: '#7a4a24'
    });

    // SECTION 3 (0.67 - 1.00): Alpine Festival Slalom Flags, Snow Boulder Chaser & Ski-Jump Rings
    const slalomPoleG = build([
      [new THREE.CylinderGeometry(0.28, 0.28, 8, 6), 0xffffff, M(0, 4, 0)],
      [new THREE.BoxGeometry(3.2, 2.0, 0.2), 0xffffff, M(1.6, 6.6, 0)]
    ]);
    roadRow(slalomPoleG, 42, WALL + 2.5, { f0: 0.67, f1: 0.85, cols: [0xe8302a, 0x2a6fdb] });
    const flagCols = [HDR(2.4, 0.4, 0.3), HDR(0.3, 1.4, 2.5), HDR(2.4, 2.0, 0.3)];
    acrossStrings([0.69, 0.75, 0.82, 0.94, 0.98], {
      colors: flagCols, geo: new THREE.ConeGeometry(0.6, 1.4, 4),
      mat: gi => new THREE.MeshBasicMaterial({ color: flagCols[gi] }), h: 10.5, sag: 2.6, per: 24, poleCol: 0x6a4424
    });

    // Golden Olympic boost rings along the final 0.86 ski-jump glider gap!
    const skiRings = [];
    const skiGap = GAPS[1] || GAPS[0];
    if (skiGap) {
      for (const u of [0.22, 0.5, 0.78]) {
        const i = wrapI(Math.round(lerp(skiGap.s, skiGap.e, u)));
        const hy = lerp(H[wrapI(skiGap.s - 1)], H[wrapI(skiGap.e)], u) + 11;
        const m = addL(new THREE.Mesh(new THREE.TorusGeometry(6.0, 0.7, 10, 28), glowMat(2.5, 2.0, 0.4)));
        m.position.set(TP[i].x, hy, TP[i].z);
        m.rotation.y = TA[i];
        skiRings.push({ m, p: m.position });
      }
    }

    const avalancheBall = chaser(L, {
      from: 0.69, to: 0.84, key: 'avalanche2', y: 8.5, v0: 44, vmax: 70, depth: 18,
      mapCol: '#e8f4ff', dust: [0.92, 0.96, 1.0],
      make: () => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(jitterGeo(new THREE.IcosahedronGeometry(8.5, 2), 1.3), new THREE.MeshLambertMaterial({ color: 0xeaf4ff, flatShading: true }));
        g.add(b); g.userData.b = b; return g;
      },
      anim: (g, dt) => { g.userData.b.rotation.x += dt * 5.5; }
    });

    const snowThrows = thrower({
      kind: 'snowb', every: [3.2, 5.0], finEvery: [1.5, 2.5], delay: 1.55,
      from: k => ({ x: k.x + rr(-45, 45), y: k.y + 65, z: k.z + rr(-45, 45) })
    });

    const alpineLife = {
      update(dt, t) {
        snow.t.value = t;
        for (const s of sawBlades) s.rotation.x += dt * 9;
        for (const r of skiRings) r.m.rotation.z += dt * 1.4;
      },
      hazard(dt) {
        for (const k of G.karts) {
          if (k.respawnT > 0) continue;
          if (k.skiRingCD > 0) k.skiRingCD -= dt;
          for (const r of skiRings) {
            if (Math.hypot(k.x - r.p.x, k.y + 1.5 - r.p.y, k.z - r.p.z) < 6.6 && !(k.skiRingCD > 0)) {
              k.skiRingCD = 0.65;
              k.boostT = Math.max(k.boostT, 1.45);
              k.vy = Math.max(k.vy, 3.5);
              giveCoins(k, 1);
              burst(FX, r.p.x, r.p.y, r.p.z, 30, 18, 0.5, 1.2, 1, 0.85, 0.3);
            }
          }
        }
      }
    };

    LR.fin = {
      msg: 'SKI JUMP FINALE! GO FOR GOLD!',
      atmo: { sky: [0x1c3a8a, 0xff8858, 0xffe4a8], bg: 0xd8a898, fog: [0xe8c4b0, 320, 1800], hc: 0xffe8d0, hemi: 0.86, light: 1.0 }
    };
    mergeLR([logs1, logs2, avalancheBall, snowThrows, alpineLife]);
    LR.gust = t => (0.35 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.95), 2)) * (G.fin ? 1.4 : 1);
  }

  // ==========================================================================
  // TRACK 6: DISCO FUNKOPOLIS (vinyl)
  // Spinning 70s vinyl turntables, sweeping tonearms, EQ towers & bass drops
  // ==========================================================================
  function buildVinyl(L) {
    const LR = getLR();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 510; LR.titleH = 175;
    LR.look = new THREE.Vector3(ctr.x, 18, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 15, ctr.y);
    LR.dust = () => [1.0, 0.45, 0.9];

    // Glowing 70s lit disco dancefloor tiles underneath
    const danceTex = ltex(256, 256, (x, w, h) => {
      const cols = ['#ff3bd8', '#26f0ff', '#ffd23f', '#9f3dff', '#48f08a', '#ff6a2a'];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          x.fillStyle = '#120824'; x.fillRect(c * 64, r * 64, 64, 64);
          x.fillStyle = cols[(r * 3 + c) % cols.length];
          x.fillRect(c * 64 + 5, r * 64 + 5, 54, 54);
        }
      }
    }, true);
    danceTex.repeat.set(26, 26);
    const floor = addL(new THREE.Mesh(
      new THREE.PlaneGeometry(4600, 4600).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: danceTex, emissiveMap: danceTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.2 })
    ));
    floor.position.set(ctr.x, -1.2, ctr.y);
    floor.receiveShadow = true;

    // Two colossal spinning 70s Vinyl LP Turntables beneath the two loops!
    function makeVinylPlatter(title, colA, colB, px, pz, rad) {
      const recTex = ltex(512, 512, (x, w, h) => {
        x.fillStyle = '#111015'; x.beginPath(); x.arc(256, 256, 252, 0, 7); x.fill();
        for (let r = 95; r < 246; r += 6) {
          x.strokeStyle = r % 18 === 0 ? 'rgba(255,255,255,.16)' : 'rgba(90,85,110,.22)';
          x.lineWidth = 2; x.beginPath(); x.arc(256, 256, r, 0, 7); x.stroke();
        }
        x.fillStyle = colA; x.beginPath(); x.arc(256, 256, 88, 0, 7); x.fill();
        x.fillStyle = colB; x.beginPath(); x.arc(256, 256, 62, 0, Math.PI); x.fill();
        x.fillStyle = '#140c1c'; x.font = 'bold 22px Bungee, Impact, sans-serif'; x.textAlign = 'center';
        x.fillText(title, 256, 232);
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(256, 256, 10, 0, 7); x.fill();
      });
      const grp = addL(new THREE.Group());
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(rad, rad, 3.2, 56),
        [new THREE.MeshLambertMaterial({ color: 0x181620 }), new THREE.MeshStandardMaterial({ map: recTex, roughness: 0.22, metalness: 0.35 }), new THREE.MeshLambertMaterial({ color: 0x111015 })]
      );
      const spindle = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 18, 16), chrome());
      spindle.position.y = 9;
      grp.add(disc, spindle);
      grp.position.set(px, 8.2, pz);
      return grp;
    }
    const lpA = makeVinylPlatter('WHEELIE FUNK', '#ffd23f', '#ff3bd8', ctr.x + 175, ctr.y + 85, 195);
    const lpB = makeVinylPlatter('BOOGIE 45', '#26f0ff', '#9f3dff', ctr.x - 105, ctr.y - 165, 185);

    // Overhead Giant Mirrored Disco Ball + rotating laser cones
    const discoBall = addL(new THREE.Group());
    discoBall.add(new THREE.Mesh(SPH(34, 24, 18), chrome()));
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * 6.28;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(28, 220, 16, 1, true),
        addGlow(b % 2 ? 1.6 : 0.3, b % 3 ? 0.3 : 1.5, 1.6, { opacity: 0.2, side: THREE.DoubleSide })
      );
      cone.position.set(Math.cos(ang) * 75, -95, Math.sin(ang) * 75);
      cone.rotation.z = Math.cos(ang) * 0.55;
      cone.rotation.x = -Math.sin(ang) * 0.55;
      discoBall.add(cone);
    }
    discoBall.position.set(ctr.x, 195, ctr.y);

    // Animated 28-bar LED Graphic Equalizer Towers around the perimeter
    const eqBars = [];
    const barGeo = new THREE.BoxGeometry(14, 1, 10);
    barGeo.translate(0, 0.5, 0);
    for (let q = 0; q < 28; q++) {
      const a = (q / 28) * Math.PI * 2;
      const rx = ctr.x + Math.cos(a) * 560, rz = ctr.y + Math.sin(a) * 560;
      const col = new THREE.Color().setHSL((q / 28), 1.0, 0.58);
      const m = addL(new THREE.Mesh(barGeo, glowMat(col.r * 2.2, col.g * 2.2, col.b * 2.2)));
      m.position.set(rx, -1.2, rz);
      m.lookAt(ctr.x, -1.2, ctr.y);
      eqBars.push({ m, ph: q * 0.55 });
    }

    // Sweeping chrome tonearm hazards across the vinyl tracks
    const armGeo = build([
      [new THREE.CylinderGeometry(0.85, 0.85, 42, 12), 0xd8dce8, M(0, 3.0, 0, 0, 0, Math.PI / 2)],
      [new THREE.BoxGeometry(6, 3.4, 4.4), 0xff3bd8, M(21, 2.2, 0)],
      [new THREE.ConeGeometry(0.9, 2.4, 8), 0xffd23f, M(21, 0.8, 0, Math.PI)]
    ], 0, true);
    const arm1 = crossers(L, {
      at: 0.14, n: 1, geo: armGeo, mat: paintMat, cyc: 10.5, on0: 4.0, on1: 7.8,
      span: 38, key: 'scratched', hitA: 4.5, hitL: 18, bob: 0, bobH: 0, mapCol: '#ff3bd8'
    });
    const arm2 = crossers(L, {
      at: 0.88, n: 1, geo: armGeo, mat: paintMat, cyc: 11.5, on0: 4.5, on1: 8.4,
      span: 38, dir: -1, key: 'scratched2', hitA: 4.5, hitL: 18, bob: 0, bobH: 0, mapCol: '#26f0ff'
    });

    // Pulsing Subwoofer Bass Pads on the road (bounce + micro-turbo!)
    const wooferG = build([
      [new THREE.CylinderGeometry(3.2, 3.5, 0.9, 20), 0x221c34, M(0, 0.45, 0)],
      [new THREE.TorusGeometry(2.6, 0.4, 8, 20), 0x26f0ff, M(0, 0.95, 0, Math.PI / 2)],
      [SPH(1.3, 12, 8), 0xff3bd8, M(0, 0.85, 0, 0, 0, 0, 1, 0.45, 1)]
    ], 0, true);
    const woofers = roadBumps(L, [[0.20, -5], [0.43, 5], [0.67, -5], [0.73, 5]], {
      geo: wooferG, key: 'bassed', r: 3.4, cd: 1.0, ground: true, mapCol: '#26f0ff',
      effect: k => {
        k.vy = 10.5; k.onGround = false;
        k.boostT = Math.max(k.boostT, 0.65);
        burst(FX, k.x, k.y + 0.8, k.z, 22, 14, 0.45, 1.0, 0.3, 0.95, 1.0);
      }
    });

    const discoDrops = thrower({
      kind: 'disco', every: [3.4, 5.2], finEvery: [1.4, 2.3], delay: 1.6,
      from: () => ({ x: ctr.x, y: 188, z: ctr.y })
    });

    const groove = {
      update(dt, t) {
        const mult = G.fin ? 2.4 : 1.0;
        lpA.rotation.y += dt * 0.55 * mult;
        lpB.rotation.y -= dt * 0.62 * mult;
        discoBall.rotation.y += dt * 0.45 * mult;
        for (const b of eqBars) {
          const h = 24 + 95 * Math.pow(0.5 + 0.5 * Math.sin(t * 7.5 + b.ph), 1.6) * (G.fin ? 1.35 : 1);
          b.m.scale.y = h;
        }
      }
    };

    LR.fin = {
      msg: 'BASS DROP! FINAL LAP',
      atmo: { sky: [0x14002a, 0x5c0a7a, 0xff4fd8], bg: 0x1a0432, fog: [0x2a0848, 300, 1650], hc: 0xffb8ff, hemi: 0.92, light: 0.85 }
    };
    mergeLR([arm1, arm2, woofers, discoDrops, groove]);
  }

  // ==========================================================================
  // TRACK 7: ORIGAMI KINGDOM (origami)
  // Handcrafted folded-paper world with swooping cranes, fans & sumi-e ink
  // ==========================================================================
  function buildOrigami(L) {
    const LR = getLR();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 510; LR.titleH = 165;
    LR.look = new THREE.Vector3(ctr.x, 22, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 12, ctr.y);
    LR.dust = () => [1.0, 0.82, 0.88];

    // Textured cream washi-paper floor with subtle grid creases
    const washiTex = ltex(256, 256, (x, w, h) => {
      x.fillStyle = '#d8ccb6'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(180,155,125,.35)'; x.lineWidth = 2;
      for (let k = 0; k <= 256; k += 64) {
        x.beginPath(); x.moveTo(k, 0); x.lineTo(k, h); x.stroke();
        x.beginPath(); x.moveTo(0, k); x.lineTo(w, k); x.stroke();
      }
      x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.stroke();
    }, true);
    washiTex.repeat.set(48, 48);
    const ground = addL(new THREE.Mesh(new THREE.PlaneGeometry(5600, 5600).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: washiTex })));
    ground.position.set(ctr.x, -1.2, ctr.y);
    ground.receiveShadow = true;

    // Swirling pink cherry-blossom petals in the breeze
    const petals = makeWeather('snow', 1800, 175);
    petals.col.value.setRGB(1.0, 0.68, 0.82);

    // Faceted low-poly folded origami mountains & paper cherry-blossom trees
    const foldMtG = jitterGeo(new THREE.ConeGeometry(1, 1, 5, 2), 0.14, false);
    foldMtG.translate(0, 0.5, 0);
    scatter(foldMtG, 48, ctr, 220, 1450, 45, 135, {
      mat: vcPhong, clear: 75, sy: 1.15,
      cols: [0xe86a7a, 0x4a7ab8, 0x7ac8a0, 0xf2c265, 0xc89be0]
    });

    const sakuraTreeG = build([
      [new THREE.ConeGeometry(1.4, 14, 4), 0x6e4832, M(0, 7, 0)],
      [new THREE.OctahedronGeometry(7.5, 0), 0xff9ec4, M(0, 16, 0, 0.2, 0.4, 0, 1.1, 0.75, 1.1)],
      [new THREE.OctahedronGeometry(5.5, 0), 0xffbfd8, M(3.5, 19, 2, 0, 0.8, 0.2, 1, 0.75, 1)]
    ], 0.04);
    scatter(sakuraTreeG, 240, ctr, 60, 1050, 0.9, 1.65, { mat: vcPhong, clear: 34, shadow: true });

    // Folded crimson Origami Torii Gates framing key sightlines
    const toriiG = build([
      [new THREE.BoxGeometry(2.2, 22, 2.2), 0xd8322c, M(-(ROAD + 4), 11, 0)],
      [new THREE.BoxGeometry(2.2, 22, 2.2), 0xd8322c, M(ROAD + 4, 11, 0)],
      [new THREE.BoxGeometry((ROAD + 8) * 2, 2.6, 3.2), 0xd8322c, M(0, 21.5, 0)],
      [new THREE.BoxGeometry((ROAD + 6) * 2, 1.6, 2.2), 0x221c24, M(0, 17.5, 0)]
    ]);
    for (const f of [0.05, 0.36, 0.51, 0.75, 0.94]) {
      const i = wrapI(Math.floor(f * N));
      if (GAP[i]) continue;
      const g = addL(new THREE.Mesh(toriiG, vcPhong));
      g.position.set(getTP()[i].x, H[i], getTP()[i].z);
      g.rotation.y = TA[i];
      g.castShadow = true;
    }

    // Flock of giant folded Paper Cranes swooping gracefully overhead
    const craneBodyG = build([
      [new THREE.ConeGeometry(2.2, 9, 4), 0xfff8ee, M(0, 0, 0, Math.PI / 2)],
      [new THREE.ConeGeometry(0.9, 6, 4), 0xff5a78, M(0, 2.4, 4.2, 0.5)],
      [new THREE.ConeGeometry(0.8, 5.5, 4), 0xfff8ee, M(0, 1.8, -4.5, -0.5)]
    ]);
    const wingL = new THREE.BoxGeometry(9, 0.25, 4.2); wingL.translate(-4.5, 0, 0);
    const wingR = new THREE.BoxGeometry(9, 0.25, 4.2); wingR.translate(4.5, 0, 0);
    const craneCols = [0xff6a88, 0x4aa8ff, 0xffc84a, 0x6ad89a, 0xc47aff];
    const cranes = Array.from({ length: 12 }, (_, n) => {
      const grp = addL(new THREE.Group());
      const mat = new THREE.MeshLambertMaterial({ color: craneCols[n % 5] });
      grp.add(new THREE.Mesh(craneBodyG, vcPhong));
      const wl = new THREE.Mesh(wingL, mat), wr = new THREE.Mesh(wingR, mat);
      grp.add(wl, wr);
      grp.scale.setScalar(rr(1.6, 2.6));
      return { grp, wl, wr, a: (n / 12) * 6.28, r: rr(140, 480), h: rr(46, 95), v: rr(0.18, 0.32) * (n % 2 ? 1 : -1) };
    });

    // Giant pleated Japanese Folding Fans sweeping across the paper road
    const fanParts = [];
    for (let b = -4; b <= 4; b++) {
      fanParts.push([
        new THREE.BoxGeometry(1.8, 12, 0.45),
        b % 2 === 0 ? 0xd8322c : 0xffeed2,
        M(Math.sin(b * 0.16) * 6, Math.cos(b * 0.16) * 6, 0, 0, 0, -b * 0.16)
      ]);
    }
    const fanGeo = build(fanParts);
    const fan1 = crossers(L, {
      at: 0.11, n: 2, geo: fanGeo, scale: 1.25, cyc: 12, on0: 5.0, on1: 9.0,
      span: 48, spread: 12, key: 'fanned', slow: 0.62, hitA: 4, hitL: 7, mapCol: '#d8322c'
    });
    const fan2 = crossers(L, {
      at: 0.47, n: 2, geo: fanGeo, scale: 1.25, cyc: 13, on0: 5.5, on1: 9.5,
      span: 48, spread: 12, dir: -1, key: 'fanned2', slow: 0.62, hitA: 4, hitL: 7, mapCol: '#d8322c'
    });

    // Giant calligraphy brush dropping Sumi-e ink splatters
    const inkBrush = thrower({
      kind: 'ink', every: [3.2, 5.0], finEvery: [1.4, 2.3], delay: 1.5,
      from: k => ({ x: k.x + rr(-30, 30), y: k.y + 85, z: k.z + rr(-30, 30) })
    });

    const paperLife = {
      update(dt, t) {
        petals.t.value = t;
        for (const c of cranes) {
          c.a += c.v * dt;
          c.grp.position.set(ctr.x + Math.cos(c.a) * c.r, c.h + Math.sin(t * 2 + c.a) * 4, ctr.y + Math.sin(c.a) * c.r);
          c.grp.rotation.y = -c.a + (c.v > 0 ? Math.PI : 0);
          const flap = Math.sin(t * 6.5 + c.a * 4) * 0.48;
          c.wl.rotation.z = flap;
          c.wr.rotation.z = -flap;
        }
      }
    };

    LR.fin = {
      msg: 'THOUSAND CRANES! FINAL LAP',
      atmo: { sky: [0x4a2468, 0xe86a5a, 0xffd890], bg: 0xd88878, fog: [0xe8a890, 280, 1650], hc: 0xffe4c8, hemi: 0.85, light: 0.95 }
    };
    mergeLR([fan1, fan2, inkBrush, paperLife]);
    LR.gust = t => (0.35 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.1), 2)) * (G.fin ? 1.5 : 1);
  }

  // ==========================================================================
  // TRACK 8: CRYSTAL CAVERNS (crystal)
  // Bioluminescent subterranean gem mines, unfenced chasm, ore carts & waterfall cannon
  // ==========================================================================
  function buildCrystal(L) {
    const TP = getTP(), TR = getTR(), LR = getLR();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 500; LR.titleH = 155;
    LR.look = new THREE.Vector3(ctr.x, 18, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 14, ctr.y);
    LR.dust = () => [0.65, 0.45, 0.95];

    // Deep glowing subterranean turquoise-violet cavern lake & dark stone floor
    groundPlane(ctr, '#181228', ['rgba(55,35,90,.6)', 'rgba(25,70,85,.5)', 'rgba(15,10,25,.7)'], 50, 5400);
    const lake = addL(new THREE.Mesh(
      new THREE.CircleGeometry(420, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x16a8c8, emissive: 0x083848, roughness: 0.1, metalness: 0.35, transparent: true, opacity: 0.86 })
    ));
    lake.position.set(ctr.x - 40, -0.6, ctr.y - 30);

    // Unfenced crystal chasm edge beacons (0.56 .. 0.68)
    buildUnfencedBeacons(L, 0xc45aff, 0x26f0ff);

    // Towering bioluminescent amethyst, cyan & emerald crystal clusters
    const clusterG = build([
      [new THREE.ConeGeometry(3.2, 22, 6), 0xffffff, M(0, 11, 0)],
      [new THREE.ConeGeometry(2.4, 16, 6), 0xffffff, M(3.2, 7.5, 1.5, 0.15, 0, -0.32)],
      [new THREE.ConeGeometry(2.1, 14, 6), 0xffffff, M(-2.8, 6.5, -1.2, -0.18, 0, 0.35)],
      [new THREE.ConeGeometry(1.7, 10, 6), 0xffffff, M(0.8, 4.8, -2.8, -0.3, 0, -0.12)]
    ]);
    const crysMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0x582488, emissiveIntensity: 0.85, roughness: 0.18, metalness: 0.25
    });
    scatter(clusterG, 190, ctr, 45, 980, 0.9, 2.8, {
      mat: crysMat, clear: 34, cols: [0xc45aff, 0x26f0ff, 0xff4fd8, 0x4af0a8]
    });
    roadRow(clusterG, 54, WALL + 5.5, {
      mat: crysMat, scale: 0.72, ground: false, y: -1.0,
      cols: [0xc45aff, 0x26f0ff, 0xff4fd8]
    });

    // Cavern ceiling dome & hanging stalactites high overhead
    const stalG = jitterGeo(new THREE.ConeGeometry(5, 34, 6), 0.8, false);
    stalG.rotateX(Math.PI);
    const stalIm = addL(new THREE.InstancedMesh(stalG, new THREE.MeshLambertMaterial({ color: 0x2c2240, flatShading: true }), 140));
    for (let q = 0; q < 140; q++) {
      const a = R() * 6.28, r = Math.sqrt(R()) * 850;
      stalIm.setMatrixAt(q, M(ctr.x + Math.cos(a) * r, rr(135, 185), ctr.y + Math.sin(a) * r, 0, R() * 6, 0, rr(0.8, 2.2)));
    }

    // Shimmering Underground Waterfall right across the 0.72->0.81 Cannon flight path!
    const ci0 = wrapI(Math.floor(0.72 * N)), ci1 = wrapI(Math.floor(0.81 * N));
    const wfMidX = (TP[ci0].x + TP[ci1].x) * 0.5, wfMidZ = (TP[ci0].z + TP[ci1].z) * 0.5;
    const wfTex = ltex(128, 256, (x, w, h) => {
      x.fillStyle = '#3af0ff'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 65; k++) {
        x.fillStyle = `rgba(255,255,255,${0.25 + (k % 5) * 0.12})`;
        x.fillRect(((k * 37) % w), ((k * 53) % h), 4, 34);
      }
    }, true);
    wfTex.repeat.set(2, 3);
    const waterfall = addL(new THREE.Mesh(
      new THREE.PlaneGeometry(68, 135),
      addGlow(0.35, 1.2, 1.5, { map: wfTex, opacity: 0.62, side: THREE.DoubleSide })
    ));
    waterfall.position.set(wfMidX, 55, wfMidZ);
    waterfall.rotation.y = Math.atan2(TP[ci1].x - TP[ci0].x, TP[ci1].z - TP[ci0].z) + Math.PI / 2;

    // Runaway gem-ore mine carts thundering across iron rails
    const cartG = build([
      [new THREE.BoxGeometry(4.4, 3.0, 6.2), 0x4a4e5c, M(0, 2.1, 0)],
      [SPH(1.3, 8, 6), 0xff2e88, M(-0.8, 3.8, 0.8)],
      [SPH(1.2, 8, 6), 0x26f0ff, M(0.9, 3.9, -0.7)],
      [SPH(1.1, 8, 6), 0x4af088, M(0, 4.1, 0)],
      ...[-1.8, 1.8].flatMap(xo => [-2, 2].map(zo => [
        new THREE.CylinderGeometry(0.75, 0.75, 0.4, 10), 0x22242c, M(xo, 0.75, zo, 0, 0, Math.PI / 2)
      ]))
    ]);
    const carts1 = crossers(L, {
      at: 0.19, n: 3, geo: cartG, cyc: 12, on0: 5.0, on1: 9.2,
      span: 56, spread: 10, key: 'mined', hitA: 3.8, hitL: 4.5, bob: 0, bobH: 0, mapCol: '#26f0ff'
    });
    const carts2 = crossers(L, {
      at: 0.36, n: 2, geo: cartG, cyc: 13.5, on0: 5.5, on1: 9.6,
      span: 56, spread: 11, dir: -1, key: 'mined2', hitA: 3.8, hitL: 4.5, bob: 0, bobH: 0, mapCol: '#c45aff'
    });

    const shards = thrower({
      kind: 'shard', every: [3.3, 5.0], finEvery: [1.3, 2.2], delay: 1.6,
      from: k => ({ x: k.x + rr(-25, 25), y: k.y + 95, z: k.z + rr(-25, 25) })
    });

    const cavernAnim = {
      update(dt) {
        wfTex.offset.y += dt * 1.4;
        if (R() < 0.65) {
          SMOKE.emit(wfMidX + rr(-26, 26), 2, wfMidZ + rr(-12, 12), rr(-3, 3), rr(4, 9), rr(-3, 3), 1.6, rr(4, 8), 0.6, 0.95, 1.0, 0.4, -1, 0.3, 1.4);
        }
      }
    };

    LR.fin = {
      msg: 'CRYSTAL OVERLOAD! FINAL LAP',
      atmo: { sky: [0x0c0220, 0x3c0a68, 0x16c8d8], bg: 0x12042a, fog: [0x1e083c, 180, 1150], hc: 0xd89aff, hemi: 0.92, light: 0.8 }
    };
    mergeLR([carts1, carts2, shards, cavernAnim]);
  }

  // ==========================================================================
  // TRACK 9: COASTER BOARDWALK (coaster)
  // Seaside wooden roller-coaster trestle, camelbacks, Ferris wheel & bumper cars
  // ==========================================================================
  function buildCoaster(L) {
    const TP = getTP(), LR = getLR(), SP = getSP();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 520; LR.titleH = 165;
    LR.look = new THREE.Vector3(ctr.x, 20, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 12, ctr.y);
    LR.dust = () => [0.95, 0.88, 0.72];

    // Golden beach sand + sparkling seaside ocean along the outer boardwalk
    groundPlane(ctr, '#dec288', ['rgba(225,198,145,.6)', 'rgba(250,235,195,.5)', 'rgba(190,165,115,.45)'], 55, 5600);
    let minZ = 1e9;
    for (let i = 0; i < N; i += 6) minZ = Math.min(minZ, TP[i].z);
    const seaZ = minZ - 75;
    const seaTex = ltex(128, 128, (x, w, h) => {
      x.fillStyle = '#1e8ec8'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(225,250,255,.55)'; x.lineWidth = 2;
      for (let k = 0; k < 12; k++) {
        x.beginPath();
        for (let s = 0; s <= w; s += 8) x.lineTo(s, k * 11 + 4 + Math.sin(s * 0.16 + k) * 2.2);
        x.stroke();
      }
    }, true);
    seaTex.repeat.set(28, 14);
    const ocean = addL(new THREE.Mesh(
      new THREE.PlaneGeometry(5600, 2600).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.12, metalness: 0.3 })
    ));
    ocean.position.set(ctr.x, -0.5, seaZ - 1300);

    // Unfenced wooden coaster crest LEDs (0.12 .. 0.22)
    buildUnfencedBeacons(L, 0xffd23f, 0xff3b5a);

    // Classic Wooden Roller-Coaster Trestle Lattice under all elevated road sections!
    const bents = [];
    const bentStep = Math.max(3, Math.round(18 / SP));
    for (let i = 0; i < N; i += bentStep) {
      if (GAP[i] || H[i] < 4) continue;
      for (const s of [-1, 1]) {
        const p = edge(i, s * (WALL - 1.5), 0);
        bents.push([p[0], H[i], p[2], TA[i]]);
      }
    }
    const postGeo = new THREE.BoxGeometry(1.2, 1, 1.2);
    const trestleMat = new THREE.MeshLambertMaterial({ color: 0xf0ece4 });
    const postIm = addL(new THREE.InstancedMesh(postGeo, trestleMat, bents.length));
    bents.forEach(([x, h, z, a], idx) => {
      const len = h + 1.4;
      postIm.setMatrixAt(idx, M(x, (h - 1.4) * 0.5, z, 0, a, 0, 1, len, 1));
    });

    // Colossal Neon-Lit Ferris Wheel with 12 swinging passenger gondolas!
    const fwSpot = placeNear(ctr, 60, 280, 65) || [ctr.x, ctr.y - 40];
    const ferrisRoot = addL(new THREE.Group());
    ferrisRoot.position.set(fwSpot[0], -1.2, fwSpot[1]);
    // A-frame support legs
    ferrisRoot.add(meshOf([
      [new THREE.CylinderGeometry(1.8, 2.6, 98, 10), 0xe8e4dc, M(-18, 46, -12, 0.14, 0, -0.18)],
      [new THREE.CylinderGeometry(1.8, 2.6, 98, 10), 0xe8e4dc, M(18, 46, -12, 0.14, 0, 0.18)],
      [new THREE.CylinderGeometry(1.8, 2.6, 98, 10), 0xe8e4dc, M(-18, 46, 12, -0.14, 0, -0.18)],
      [new THREE.CylinderGeometry(1.8, 2.6, 98, 10), 0xe8e4dc, M(18, 46, 12, -0.14, 0, 0.18)]
    ]));
    const wheelHub = new THREE.Group();
    wheelHub.position.y = 92;
    ferrisRoot.add(wheelHub);
    wheelHub.add(new THREE.Mesh(new THREE.TorusGeometry(68, 1.8, 10, 48), glowMat(2.4, 0.6, 1.8)));
    wheelHub.add(new THREE.Mesh(new THREE.TorusGeometry(46, 1.1, 8, 40), glowMat(0.4, 1.9, 2.4)));
    for (let s = 0; s < 12; s++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 136, 6), trestleMat);
      sp.rotation.z = (s * Math.PI) / 12;
      wheelHub.add(sp);
    }
    const gondolas = [];
    const gonColors = [0xff4f6a, 0xffd23f, 0x26d3d0, 0x7bd531, 0xb05aff, 0xff8a2a];
    for (let g = 0; g < 12; g++) {
      const ang = (g / 12) * Math.PI * 2;
      const piv = new THREE.Group();
      piv.position.set(Math.cos(ang) * 68, Math.sin(ang) * 68, 0);
      const car = meshOf([
        [rbox(6.5, 5.2, 5.5, 0.8), gonColors[g % 6], M(0, -4.5, 0)],
        [new THREE.ConeGeometry(4.8, 2.5, 8), 0xffffff, M(0, -1.0, 0)]
      ]);
      piv.add(car);
      wheelHub.add(piv);
      gondolas.push(piv);
    }

    // Striped carnival tents & festival bulb strings across the boardwalk
    const tentG = build([
      [new THREE.CylinderGeometry(14, 14, 14, 12), 0xfff4e4, M(0, 7, 0)],
      [new THREE.ConeGeometry(16, 12, 12), 0xe83038, M(0, 20, 0)],
      [new THREE.SphereGeometry(1.8, 8, 6), 0xffd23f, M(0, 26.5, 0)]
    ]);
    scatter(tentG, 22, ctr, 90, 680, 0.9, 1.5, { mat: vcPhong, clear: 44, shadow: true });

    const bulbCols = [HDR(2.8, 0.6, 1.2), HDR(2.8, 2.2, 0.5), HDR(0.4, 2.2, 2.6)];
    acrossStrings([0.03, 0.34, 0.52, 0.74, 0.96], {
      colors: bulbCols, geo: SPH(0.36, 8, 6),
      mat: gi => new THREE.MeshBasicMaterial({ color: bulbCols[gi] }), h: 9.8, sag: 2.8, per: 26, poleCol: 0xd83038
    });

    // Chaotic Bumper Cars crisscrossing the midway plaza!
    const bumperCarG = build([
      [new THREE.CylinderGeometry(3.2, 3.4, 1.1, 16), 0x22222a, M(0, 0.6, 0)],
      [SPH(2.6, 14, 10), 0xff3b6a, M(0, 1.4, 0, 0, 0, 0, 1, 0.65, 1.25)],
      [new THREE.CylinderGeometry(0.12, 0.12, 7.5, 6), 0xc8ccd8, M(0, 4.8, -1.8)]
    ], 0, true);
    const bump1 = crossers(L, {
      at: 0.51, n: 4, geo: bumperCarG, mat: paintMat, cyc: 12, on0: 5.0, on1: 9.2,
      span: 52, spread: 9, key: 'bumped', hitA: 3.8, hitL: 4.0, bob: 8, bobH: 0.15, mapCol: '#ff3b6a'
    });
    const bump2 = crossers(L, {
      at: 0.96, n: 3, geo: bumperCarG, mat: paintMat, cyc: 13.5, on0: 5.5, on1: 9.8,
      span: 52, spread: 10, dir: -1, key: 'bumped2', hitA: 3.8, hitL: 4.0, bob: 8, bobH: 0.15, mapCol: '#ffd23f'
    });

    const candyDrops = thrower({
      kind: 'candy', every: [3.4, 5.2], finEvery: [1.4, 2.3], delay: 1.55,
      from: () => ({ x: fwSpot[0], y: 110, z: fwSpot[1] })
    });

    const pierLife = {
      update(dt) {
        seaTex.offset.y -= dt * 0.03;
        const rot = dt * (G.fin ? 0.55 : 0.25);
        wheelHub.rotation.z += rot;
        for (const g of gondolas) g.rotation.z = -wheelHub.rotation.z;
        if (G.fin && R() < 0.08) {
          const fxX = ctr.x + rr(-260, 260), fxZ = ctr.y + rr(-260, 260);
          const col = new THREE.Color().setHSL(R(), 1, 0.6);
          burst(FX, fxX, rr(75, 130), fxZ, 45, 28, 0.9, 1.4, col.r, col.g, col.b, 8, 4);
        }
      }
    };

    LR.fin = {
      msg: 'HURRICANE COASTER! FINAL LAP',
      atmo: { sky: [0x120838, 0x8a2878, 0xff8a3c], bg: 0x2c1448, fog: [0x462060, 280, 1600], hc: 0xffc8e8, hemi: 0.85, light: 0.85 }
    };
    mergeLR([bump1, bump2, candyDrops, pierLife]);
  }

  // ==========================================================================
  // TRACK 10: CHEF'S PIZZA INFERNO (pizza)
  // Wood-fired pizzeria counter, bubbling mozzarella sea, pizza cutters & meatballs
  // ==========================================================================
  function buildPizza(L) {
    const TP = getTP(), LR = getLR();
    const ctr = trackCentre();
    LR.center = ctr; LR.orbitR = 500; LR.titleH = 165;
    LR.look = new THREE.Vector3(ctr.x, 18, ctr.y);
    LR.sunAt = new THREE.Vector3(ctr.x, 14, ctr.y);
    LR.dust = () => [0.98, 0.95, 0.88]; // white pizza flour dust!

    // Classic red-and-white checkered Italian tablecloth floor + bubbling mozzarella sea
    const clothTex = ltex(256, 256, (x, w, h) => {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          x.fillStyle = (r + c) % 2 === 0 ? '#fffaf2' : ((r % 2 && c % 2) ? '#c82020' : '#ef6868');
          x.fillRect(c * 64, r * 64, 64, 64);
        }
      }
    }, true);
    clothTex.repeat.set(36, 36);
    const cloth = addL(new THREE.Mesh(new THREE.PlaneGeometry(5400, 5400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: clothTex })));
    cloth.position.set(ctr.x, -2.5, ctr.y);
    cloth.receiveShadow = true;

    const cheeseTex = ltex(256, 256, (x, w, h) => {
      x.fillStyle = '#f8b830'; x.fillRect(0, 0, w, h);
      const r2 = rng(39);
      for (let k = 0; k < 80; k++) {
        x.fillStyle = k % 3 === 0 ? '#d82818' : (k % 2 ? '#ffe27a' : '#b84810');
        x.beginPath(); x.arc(r2() * w, r2() * h, 6 + r2() * 20, 0, 7); x.fill();
      }
    }, true);
    cheeseTex.repeat.set(16, 16);
    const cheesePool = addL(new THREE.Mesh(
      new THREE.CircleGeometry(470, 56).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: cheeseTex, color: HDR(1.35, 1.2, 0.95) })
    ));
    cheesePool.position.set(ctr.x, -0.6, ctr.y);

    // Colossal Roaring Wood-Fired Brick Pizza Oven Landmark
    const ovenPos = placeNear(ctr, 30, 180, 62) || [ctr.x, ctr.y];
    const oven = addL(new THREE.Group());
    oven.add(meshOf([
      [new THREE.CylinderGeometry(65, 72, 36, 24), 0x8a3a28, M(0, 18, 0)],
      [new THREE.SphereGeometry(64, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0xa2442e, M(0, 36, 0)],
      [new THREE.CylinderGeometry(12, 14, 52, 14), 0x6e2c1e, M(0, 96, -15)],
      [new THREE.BoxGeometry(52, 34, 24), 0x5a2418, M(0, 17, 62)]
    ]));
    const mouthGlow = new THREE.Mesh(new THREE.CircleGeometry(21, 20, 0, Math.PI), glowMat(3.4, 1.3, 0.25));
    mouthGlow.position.set(0, 8, 74.5);
    oven.add(mouthGlow);
    oven.position.set(ovenPos[0], -1.2, ovenPos[1]);

    // Giant pepperoni discs, black olive rings, basil leaves & leaning pizza-box stacks!
    const pepG = new THREE.CylinderGeometry(9, 9, 1.4, 20);
    const oliveG = new THREE.TorusGeometry(5.5, 2.2, 10, 20); oliveG.rotateX(Math.PI / 2);
    scatter(pepG, 65, ctr, 40, 440, 0.8, 1.6, { mat: new THREE.MeshLambertMaterial({ color: 0xc4281c }), clear: 32, y: -0.2 });
    scatter(oliveG, 40, ctr, 40, 440, 0.8, 1.4, { mat: new THREE.MeshLambertMaterial({ color: 0x1e1c24 }), clear: 32, y: 0.4 });

    const boxStackG = build(Array.from({ length: 7 }, (_, q) => [
      new THREE.BoxGeometry(26, 3.4, 26),
      q % 2 ? 0xf6f0e4 : 0xe8dcc8,
      M((q % 3 - 1) * 1.2, 1.7 + q * 3.45, 0, 0, q * 0.12, 0)
    ]));
    scatter(boxStackG, 24, ctr, 180, 780, 1.0, 1.8, { mat: vcPhong, clear: 44, shadow: true });

    // Spinning Chrome Pizza-Cutter Wheels slicing back & forth across the dough!
    const cutterGeo = build([
      [new THREE.CylinderGeometry(6.5, 6.5, 0.65, 28), 0xe4e8f2, M(0, 6.5, 0, 0, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(2.0, 2.0, 1.2, 16), 0xd82820, M(0, 6.5, 0, 0, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(1.1, 1.3, 18, 10), 0xd82820, M(0, 15, 0, 0, 0, -0.35)]
    ]);
    const cutWheel1 = crossers(L, {
      at: 0.17, n: 2, geo: cutterGeo, mat: chrome(), cyc: 10.5, on0: 4.0, on1: 8.0,
      span: 48, spread: 13, spin: 9, key: 'sliced', hitA: 5.5, hitL: 3.5, bob: 0, bobH: 0, mapCol: '#e4e8f2'
    });
    const cutWheel2 = crossers(L, {
      at: 0.93, n: 2, geo: cutterGeo, mat: chrome(), cyc: 11.5, on0: 4.5, on1: 8.5,
      span: 48, spread: 13, dir: -1, spin: 9, key: 'sliced2', hitA: 5.5, hitL: 3.5, bob: 0, bobH: 0, mapCol: '#e4e8f2'
    });

    // Giant Rolling Spicy Meatball rumbling down the crust slope!
    const meatball = chaser(L, {
      from: 0.31, to: 0.44, key: 'meatballed', y: 8.0, v0: 42, vmax: 68, depth: 18,
      mapCol: '#7a2e18', dust: [0.85, 0.35, 0.18],
      make: () => {
        const g = new THREE.Group();
        const b = new THREE.Mesh(jitterGeo(new THREE.IcosahedronGeometry(8.2, 2), 1.4), new THREE.MeshLambertMaterial({ color: 0x722a16, flatShading: true }));
        g.add(b); g.userData.b = b; return g;
      },
      anim: (g, dt) => { g.userData.b.rotation.x += dt * 5.2; }
    });

    const sauceDrops = thrower({
      kind: 'marinara', every: [3.2, 4.8], finEvery: [1.3, 2.1], delay: 1.55,
      from: () => ({ x: ovenPos[0], y: 118, z: ovenPos[1] })
    });

    const ovenLife = {
      update(dt) {
        cheeseTex.offset.x += dt * 0.02;
        cheeseTex.offset.y -= dt * 0.025;
        if (R() < 0.7) {
          SMOKE.emit(ovenPos[0] + rr(-8, 8), 125, ovenPos[1] - 15 + rr(-8, 8), rr(-3, 3), rr(10, 20), rr(-3, 3), 2.4, rr(8, 16), 0.32, 0.28, 0.26, 0.55, -1, 0.15, 1.8);
          FX.emit(ovenPos[0] + rr(-14, 14), 16, ovenPos[1] + 74, rr(-6, 6), rr(6, 16), rr(4, 12), 0.9, rr(1.2, 2.4), 1, rr(0.4, 0.75), 0.1, 1, 10);
        }
        if (G.fin && R() < 0.45) {
          const i = (R() * N) | 0;
          FX.emit(TP[i].x + rr(-35, 35), H[i] + rr(12, 42), TP[i].z + rr(-35, 35), rr(-4, 4), -rr(6, 14), rr(-4, 4), 1.1, rr(1.0, 2.0), 1, 0.45, 0.1, 1, 5);
        }
      }
    };

    LR.fin = {
      msg: 'EXTRA SPICY OVEN BLAST!',
      atmo: { sky: [0x2c0602, 0xb82c0e, 0xffa834], bg: 0x481206, fog: [0x6a1e0c, 220, 1250], hc: 0xffb878, hemi: 0.85, light: 0.95 }
    };
    mergeLR([cutWheel1, cutWheel2, meatball, sauceDrops, ovenLife]);
  }

  // ==========================================================================
  // 10 NEW TRACK DEFINITIONS
  // ==========================================================================
  const newTracks = [
    {
      id: 'rainbow', name: 'Rainbow Overdrive',
      tag: 'Stained-glass prism highway in deep space. Unfenced cosmic drop-offs, starlight boost rings, split sky-lanes and shooting stars.',
      mech: 'Unfenced space drops + starlight glider rings + split lanes',
      champ: 'Cosmic Prism Champion!', fallMsg: 'INTO DEEP SPACE!', fall: 'cloud',
      S: 1.5, grav: 0.78,
      unfenced: [[0.08, 0.22], [0.54, 0.68]],
      RAW: [
        [0, 0, 40], [100, 4, 43], [195, -20, 48], [250, -85, 53],
        [230, -165, 56], [160, -210, 52], [140, -285, 47], [95, -355, 44],
        [5, -370, 48], [-80, -335, 52], [-165, -325, 47], [-235, -265, 42],
        [-235, -180, 44], [-195, -110, 47], [-205, -35, 44], [-150, 12, 41],
        [-75, 12, 39]
      ],
      gaps() { return [fgap(0.38, 62, { glide: true, rampH: 4.8, padD: 90 })]; },
      boxF: [0.06, 0.28, 0.50, 0.71, 0.92],
      pads: [[0.12, 0], [0.49, -5], [0.61, 0], [0.94, 5]],
      build: buildRainbow, music: 'rainbow', ui: ['#ff4fd8', '#26f0ff', '#ffd23f'],
      atmo: {
        bg: 0x040214, fog: [0x0a0628, 550, 2600], sky: [0x010008, 0x160a42, 0x4a1678],
        sunCol: [1, 0.95, 1], sun: [0.45, 0.75, -0.4], stars: 1,
        hemi: [0xc8b8ff, 0x24144a, 0.85], light: [0xffffff, 1.05], fill: [0x26f0ff, 0.45],
        env: { top: '#050218', mid: '#241058', hor: '#ff4fd8', ground: '#0c0624', spots: ['#ff4fd8', '#26f0ff', '#ffd23f', '#7dffb0'] }
      },
      theme: {
        roadBase: '#261e48', speck: spk(90, 150, [20, 10, 40]), edgeLine: '#ffffff', centre: '#ffd23f',
        roadAlt: 0xe8e0ff, roadRough: 0.22, roadMetal: 0.48, roadEnv: 1.45,
        curb: [0xff4fd8, 0x26f0ff],
        shoulder: i => new THREE.Color().setHSL(((i / N) * 4 + 0.15) % 1, 0.82, 0.52),
        skirt: { bottom: i => H[i] - 8, color: i => new THREE.Color().setHSL(((i / N) * 4) % 1, 0.7, 0.36) },
        fence: { h: 1.25, color: i => new THREE.Color().setHSL(((i / N) * 6) % 1, 0.9, 0.62), skip: i => inUnfenced(newTracks[0], i) },
        gapFace: 0x241648,
        arch: { bg: '#120634', fg: '#ffd23f', edge: '#26f0ff', text: 'RAINBOW OVERDRIVE', post: 0x3a2068, stripe: 0xff4fd8, cap: 0x26f0ff, glow: true }
      }
    },

    {
      id: 'clockwork', name: 'Clockwork Citadel',
      tag: 'Inside a colossal brass grandfather clocktower. Time the swinging pendulums, ride the gear rims, and survive Midnight Strike!',
      mech: 'Swinging pendulums + rotating brass gears + spring cannon',
      champ: 'Master Horologist!', fallMsg: 'INTO THE COGS!', fall: 'cloud',
      S: 1.5,
      RAW: [
        [0, 0, 16], [100, 0, 16], [195, -10, 19], [250, -65, 24],
        [240, -135, 29], [185, -180, 32], [175, -245, 35], [120, -300, 33],
        [35, -308, 29], [-45, -295, 25], [-115, -260, 21], [-140, -190, 18],
        [-200, -150, 16], [-245, -90, 15], [-220, -25, 15], [-145, 8, 16],
        [-70, 6, 16]
      ],
      gaps() { return [fgap(0.54, 38, { rampH: 4.2 })]; },
      boxF: [0.06, 0.31, 0.60, 0.88],
      pads: [[0.14, 5], [0.69, 0], [0.85, -5]],
      build: buildClockwork, music: 'clockwork', ui: ['#e0ae48', '#c87442', '#fff4d2'],
      atmo: {
        bg: 0x261a12, fog: [0x38261a, 260, 1500], sky: [0x120a06, 0x3e2818, 0xc88a3e],
        sunCol: [1, 0.88, 0.62], sun: [0.4, 0.78, 0.35], stars: 0.2,
        hemi: [0xffe8c0, 0x4a321e, 0.82], light: [0xffe4b4, 0.95], fill: [0xffa848, 0.35],
        env: { top: '#180e08', mid: '#5a3a1e', hor: '#ffbe58', ground: '#2a1c12', spots: ['#ffd268', '#ff9a3c', '#ffffff'] }
      },
      theme: {
        roadBase: '#4c3e32', speck: spk(85, 135, [14, 6, -6]), edgeLine: '#ffe6a8', centre: '#e0ae48',
        roadAlt: 0xeae0cf, roadRough: 0.42, roadMetal: 0.35, roadEnv: 1.0,
        curb: [0xd4a244, 0x3a2618],
        shoulder: i => Math.floor(i / 6) % 2 ? C(0xb8842c) : C(0x9a6c22),
        skirt: { bottom: () => -1.2, color: i => Math.floor(i / 5) % 2 ? C(0x5a3e24) : C(0x4a321c) },
        fence: { h: 1.35, color: i => Math.floor(i / 4) % 2 ? C(0xe0ae48) : C(0x6e4826) },
        gapFace: 0x4a321c,
        arch: { bg: '#2a180c', fg: '#ffe49c', edge: '#e0ae48', text: 'CLOCKWORK GP', post: 0xb8842c, stripe: 0x5a381e, cap: 0xffe49c, glow: true }
      }
    },

    {
      id: 'ramen', name: 'Ramen Rapids',
      tag: 'Toy-scale dash round a steaming giant ramen bowl! Drift curly noodle causeways, splash into tonkotsu boat pools, and dodge chopsticks.',
      mech: 'Broth boat pools + sweeping chopsticks + narutomaki bumpers',
      champ: 'Grandmaster of the Bowl!', fallMsg: 'INTO THE BROTH!', fall: 'cloud',
      S: 1.5,
      surf: [[0.30, 0.41, 3], [0.74, 0.85, 3]],
      RAW: [
        [0, 0, 22], [90, 5, 20], [175, -20, 15], [220, -85, 10],
        [195, -155, 10], [140, -200, 14], [125, -270, 16], [65, -320, 12],
        [-20, -325, 10], [-95, -285, 10], [-120, -215, 14], [-135, -145, 17],
        [-200, -105, 13], [-225, -35, 16], [-170, 12, 20], [-85, 8, 22]
      ],
      gaps() { return [fgap(0.57, 36, { rampH: 4.2 })]; },
      boxF: [0.07, 0.27, 0.52, 0.71, 0.94],
      pads: [[0.15, -5], [0.43, 0], [0.68, 5], [0.87, 0]],
      build: buildRamen, music: 'ramen', ui: ['#ffd24a', '#d82828', '#ff6fa8'],
      atmo: {
        bg: 0xf4dcc0, fog: [0xf6e2c8, 340, 1850], sky: [0x3a6cb8, 0xf2cfa8, 0xfff2dc],
        sunCol: [1, 0.94, 0.8], sun: [0.35, 0.82, 0.35], stars: 0,
        hemi: [0xfff6e6, 0x8a5e32, 0.74], light: [0xfff2da, 0.86], fill: [0xffb868, 0.32],
        env: { top: '#4a7ac8', mid: '#f6dcb8', hor: '#fff8ec', ground: '#d98c2b' }
      },
      theme: {
        roadBase: '#c4a258', speck: spk(140, 185, [15, 5, -25]), edgeLine: '#fffaf0', centre: '#ff7a28',
        roadAlt: 0xf6e49c, roadRough: 0.55,
        curb: [0xd82828, 0xfffaf0],
        shoulder: i => SURF[i] === 3 ? C(0xd98c2b) : (Math.floor(i / 6) % 2 ? C(0xf2dca0) : C(0xe4ca88)),
        skirt: { bottom: () => 6.0, color: i => Math.floor(i / 5) % 2 ? C(0x1e4a8a) : C(0xf4efe4) },
        fence: { h: 1.3, color: i => Math.floor(i / 4) % 2 ? C(0xc88a48) : C(0xd82828) },
        gapFace: 0xc88a48,
        arch: { bg: '#d82828', fg: '#fffaf0', edge: '#ffd24a', text: 'RAMEN RAPIDS', post: 0xc88a48, stripe: 0xfffaf0, cap: 0xffd24a }
      }
    },

    {
      id: 'tokyo', name: 'Tokyo Neon Driftway',
      tag: 'Midnight Shuto expressway touge. Chain wet neon S-bends, cut the cyberpunk back-alley, and race beneath holographic koi and bullet trains.',
      mech: 'Wet neon drift S-bends + alley shortcut + Shinkansen & tuners',
      champ: 'King of the Midnight Wangan!', fallMsg: 'OFF THE EXPRESSWAY!', fall: 'street',
      S: 1.48,
      surf: [[0.06, 0.14, 1], [0.48, 0.58, 1], [0.82, 0.90, 1]],
      wind: [[0.38, 0.43, 1]],
      RAW: [
        [0, 0, 18], [115, 0, 18], [225, -2, 20], [295, -40, 24],
        [300, -110, 26], [240, -155, 23], [165, -165, 19], [125, -225, 15],
        [95, -290, 12], [20, -315, 10], [-60, -290, 11], [-130, -265, 14],
        [-205, -225, 16], [-230, -150, 18], [-200, -75, 19], [-180, -15, 17],
        [-100, 6, 18]
      ],
      gaps() { return [fgap(0.64, 42, { rampH: 4.4 })]; },
      boxF: [0.08, 0.21, 0.42, 0.70, 0.92],
      pads: [[0.18, 5], [0.39, -5], [0.89, 5]],
      build: buildTokyo, music: 'tokyo', ui: ['#26f0ff', '#ff3bd8', '#ffd23f'],
      atmo: {
        bg: 0x08061a, fog: [0x140c2e, 180, 1250], sky: [0x03020c, 0x160c38, 0x8a1e68],
        sunCol: [0.6, 0.8, 1.0], sun: [-0.4, 0.65, -0.55], stars: 0.85,
        hemi: [0x8ab8ff, 0x1e1432, 0.88], light: [0xc8e0ff, 0.65], fill: [0xff3bd8, 0.48],
        env: { top: '#050314', mid: '#1c1044', hor: '#ff3bd8', ground: '#0c0a1a', spots: ['#26f0ff', '#ff3bd8', '#ffd23f', '#ffffff'] }
      },
      theme: {
        roadBase: '#242236', speck: spk(45, 85, [0, 4, 18]), edgeLine: '#26f0ff', centre: '#ff3bd8',
        roadAlt: 0xdce4f8, roadRough: 0.26, roadMetal: 0.22, roadEnv: 1.35,
        curb: [0x26f0ff, 0xff3bd8],
        shoulder: i => Math.floor(i / 6) % 2 ? C(0x34304c) : C(0x2c2842),
        skirt: { bottom: () => -1.2, color: i => Math.floor(i / 6) % 2 ? C(0x28243e) : C(0x201c34) },
        fence: { h: 1.35, color: i => Math.floor(i / 4) % 2 ? C(0x26f0ff) : C(0x28243e) },
        gapFace: 0x28243e,
        arch: { bg: '#0c0822', fg: '#26f0ff', edge: '#ff3bd8', text: 'TOKYO DRIFTWAY', post: 0x28243e, stripe: 0xff3bd8, cap: 0x26f0ff, glow: true }
      }
    },

    {
      id: 'mtmayhem', name: 'Mount Mayhem', laps: 1,
      tag: 'One-lap, three-section downhill epic! Plunge down the icy hydroelectric dam, dodge rolling sawmill logs, and soar off the Olympic ski jump.',
      mech: '3-section downhill epic + dam jump + sawmill logs + ski glide',
      champ: 'King of Mount Mayhem!', fallMsg: 'OFF THE MOUNTAIN!', fall: 'snow',
      S: 4.3, HS: 1.9,
      surf: [[0.06, 0.20, 2]],
      wind: [[0.24, 0.29, -1], [0.82, 0.85, 1]],
      RAW: [
        [0, 0, 58], [80, 4, 56], [160, -15, 53], [225, -62, 49],
        [240, -130, 44], [195, -190, 39], [125, -205, 35], [65, -170, 31],
        [15, -195, 27], [-25, -255, 23], [-105, -275, 20], [-185, -245, 18],
        [-235, -180, 20], [-255, -100, 25], [-235, -25, 33], [-175, 18, 42],
        [-95, 15, 51]
      ],
      gaps() { return [fgap(0.31, 46, { rampH: 4.4 }), fgap(0.86, 95, { glide: true, rampH: 5.5, padD: 100 })]; },
      boxF: [0.05, 0.13, 0.24, 0.35, 0.46, 0.56, 0.66, 0.76, 0.84, 0.94],
      pads: [[0.11, -5], [0.26, 5], [0.39, 0], [0.53, -5], [0.70, 5], [0.79, 0], [0.93, 0]],
      build: buildMtMayhem, music: 'himalaya', ui: ['#3ab0ff', '#ff5b1f', '#ffffff'],
      atmo: {
        bg: 0xaad0f4, fog: [0xc4dcf6, 320, 1950], sky: [0x1854c8, 0x88c4f8, 0xe8f4ff],
        sunCol: [1, 0.95, 0.86], sun: [0.42, 0.78, 0.45], stars: 0,
        hemi: [0xeaf4ff, 0x5e7890, 0.74], light: [0xfff6e8, 0.88], fill: [0xa8d0ff, 0.32],
        env: { top: '#2864d8', mid: '#a8d8ff', hor: '#ffffff', ground: '#dce8f6' }
      },
      theme: {
        roadBase: '#6e7684', speck: spk(105, 160, [2, 4, 10]), edgeLine: '#ffffff', centre: '#ffb22e',
        roadAlt: 0xecf2fa,
        curb: [0xe8302a, 0xffffff],
        shoulder: i => (i > N * 0.33 && i < N * 0.67) ? (Math.floor(i / 7) % 2 ? C(0x6e8a48) : C(0x5e7a3e)) : (Math.floor(i / 7) % 2 ? C(0xdce6f4) : C(0xcbd8ea)),
        skirt: { bottom: () => -1.2, color: i => Math.floor(i / 5) % 2 ? C(0x66606c) : C(0x56505c) },
        fence: { h: 1.4, color: i => Math.floor(i / 5) % 2 ? C(0xe8302a) : C(0xf2f6fc) },
        gapFace: 0x72a8d8,
        arch: { bg: '#1a3c7a', fg: '#ffffff', edge: '#ff5b1f', text: 'MOUNT MAYHEM', post: 0xe8302a, stripe: 0xffffff, cap: 0xffd23f }
      }
    },

    {
      id: 'vinyl', name: 'Disco Funkopolis',
      tag: 'Boogie across two giant spinning 70s vinyl turntables! Leap tonearm sweepers, ride subwoofer half-pipes, and hit the Bass Drop.',
      mech: 'Spinning turntables + sweeping tonearms + subwoofer bounce pads',
      champ: 'Grandmaster of Funk!', fallMsg: 'OFF THE RECORD!', fall: 'cloud',
      S: 1.48,
      RAW: [
        [0, 0, 12], [105, 0, 12], [205, -10, 14], [265, -65, 17],
        [255, -140, 19], [190, -185, 17], [115, -170, 14], [55, -200, 12],
        [45, -275, 14], [-15, -325, 17], [-100, -320, 18], [-165, -265, 16],
        [-175, -185, 13], [-230, -125, 15], [-235, -50, 14], [-170, 2, 12],
        [-85, 5, 12]
      ],
      gaps() { return [fgap(0.48, 40, { rampH: 4.5 })]; },
      boxF: [0.06, 0.22, 0.44, 0.66, 0.90],
      pads: [[0.11, 0], [0.38, 5], [0.79, -5], [0.95, 0]],
      build: buildVinyl, music: 'funk', ui: ['#ff3bd8', '#ffd23f', '#26f0ff'],
      atmo: {
        bg: 0x120624, fog: [0x1c0a36, 360, 1900], sky: [0x060212, 0x280c4a, 0x8a1e78],
        sunCol: [1, 0.85, 1], sun: [0.3, 0.85, 0.3], stars: 0.55,
        hemi: [0xf0c8ff, 0x2e144a, 0.86], light: [0xfff0ff, 0.85], fill: [0xff3bd8, 0.42],
        env: { top: '#080316', mid: '#381264', hor: '#ff4fd8', ground: '#140828', spots: ['#ff3bd8', '#ffd23f', '#26f0ff', '#48f08a'] }
      },
      theme: {
        roadBase: '#181424', speck: spk(35, 75, [12, 4, 22]), edgeLine: '#ffd23f', centre: '#ff3bd8',
        roadAlt: 0xd8d0ec, roadRough: 0.2, roadMetal: 0.42, roadEnv: 1.4,
        curb: [0xffd23f, 0xff3bd8],
        shoulder: i => Math.floor(i / 5) % 2 ? C(0x2c2240) : C(0x221a34),
        skirt: { bottom: () => -1.2, color: i => Math.floor(i / 5) % 2 ? C(0x9f3dff) : C(0x3a1a5e) },
        fence: { h: 1.3, color: i => Math.floor(i / 3) % 2 ? C(0x26f0ff) : C(0xff3bd8) },
        gapFace: 0x2c1a48,
        arch: { bg: '#1e0838', fg: '#ffd23f', edge: '#ff3bd8', text: 'DISCO FUNKOPOLIS', post: 0xd8dce8, stripe: 0xff3bd8, cap: 0xffd23f, glow: true }
      }
    },

    {
      id: 'origami', name: 'Origami Kingdom',
      tag: 'A handcrafted paper-craft valley of folded mountains, swooping paper cranes, snapping folding fans, and sumi-e ink splatters.',
      mech: 'Paper glider jump + folding fans + sumi-e ink + blossom wind',
      champ: 'Shogun of the Fold!', fallMsg: 'CRUMPLED!', fall: 'cloud',
      S: 1.48, grav: 0.88,
      wind: [[0.24, 0.30, 1], [0.71, 0.76, -1]],
      RAW: [
        [0, 0, 14], [90, -10, 16], [185, -45, 20], [265, -30, 25],
        [305, -85, 27], [265, -155, 24], [180, -175, 19], [110, -215, 15],
        [65, -285, 12], [-15, -305, 12], [-80, -255, 15], [-135, -190, 19],
        [-220, -170, 22], [-265, -105, 20], [-230, -35, 16], [-145, 5, 14],
        [-70, 8, 14]
      ],
      gaps() { return [fgap(0.78, 74, { glide: true, rampH: 5.0, padD: 92 })]; },
      boxF: [0.06, 0.22, 0.42, 0.60, 0.90],
      pads: [[0.18, -5], [0.55, 0], [0.66, 5], [0.93, 0]],
      build: buildOrigami, music: 'origami', ui: ['#ff6a88', '#f4ead8', '#3a6ab8'],
      atmo: {
        bg: 0xf4dce0, fog: [0xf6e2e4, 340, 1900], sky: [0x3a6eb8, 0xf2cad4, 0xfff4e6],
        sunCol: [1, 0.92, 0.82], sun: [0.45, 0.74, 0.4], stars: 0,
        hemi: [0xfff6f2, 0x8a6e64, 0.74], light: [0xfff2e4, 0.86], fill: [0xff9ec4, 0.32],
        env: { top: '#4a7ec8', mid: '#f6d4dc', hor: '#fff8f0', ground: '#f4ead8' }
      },
      theme: {
        roadBase: '#c6b9a4', speck: spk(145, 185, [10, 4, -8]), tiles: 'rgba(140,110,85,.28)',
        edgeLine: '#d8322c', centre: '#3a6ab8', roadAlt: 0xf6eee0,
        curb: [0xd8322c, 0xfff8ee],
        shoulder: i => Math.floor(i / 6) % 2 ? C(0x7ac8a0) : C(0x6ab890),
        skirt: { bottom: () => -1.2, color: i => Math.floor(i / 5) % 2 ? C(0xd8b894) : C(0xc8a884) },
        fence: { h: 1.25, color: i => Math.floor(i / 4) % 2 ? C(0xd8322c) : C(0xfff8ee) },
        gapFace: 0xc8a884,
        arch: { bg: '#d8322c', fg: '#fff8ee', edge: '#ffd24a', text: 'ORIGAMI KINGDOM', post: 0xd8322c, stripe: 0xfff8ee, cap: 0x221c24 }
      }
    },

    {
      id: 'crystal', name: 'Crystal Caverns',
      tag: 'Bioluminescent amethyst mines deep underground. Brave the unfenced crystal chasm, dodge gem-ore carts, and blast through the waterfall cannon!',
      mech: 'Unfenced crystal chasm + ore carts + waterfall cannon',
      champ: 'Sovereign of the Deep Geode!', fallMsg: 'INTO THE CRYSTAL ABYSS!', fall: 'cloud',
      S: 1.5,
      unfenced: [[0.56, 0.68]],
      RAW: [
        [0, 0, 10], [95, 0, 11], [185, -20, 14], [245, -75, 19],
        [240, -155, 24], [175, -215, 26], [95, -210, 22], [50, -150, 17],
        [-15, -135, 14], [-65, -185, 11], [-120, -250, 9], [-200, -245, 11],
        [-255, -180, 15], [-255, -95, 16], [-200, -25, 13], [-110, 6, 10]
      ],
      gaps() { return [fgap(0.88, 42, { rampH: 4.5 })]; },
      boxF: [0.05, 0.22, 0.42, 0.69, 0.95],
      pads: [[0.17, 5], [0.59, 0], [0.65, -4], [0.83, 0]],
      build: buildCrystal, music: 'space', ui: ['#c45aff', '#26f0ff', '#4af0a8'],
      atmo: {
        bg: 0x0c081c, fog: [0x160e30, 200, 1300], sky: [0x060310, 0x180e38, 0x2a1858],
        sunCol: [0.75, 0.9, 1.0], sun: [0.25, 0.88, 0.25], stars: 0.35,
        hemi: [0xb8d8ff, 0x2a1448, 0.88], light: [0xd8f0ff, 0.78], fill: [0xc45aff, 0.48],
        env: { top: '#080416', mid: '#261250', hor: '#26f0ff', ground: '#181228', spots: ['#c45aff', '#26f0ff', '#4af0a8'] }
      },
      theme: {
        roadBase: '#342c4c', speck: spk(65, 115, [15, 8, 28]), edgeLine: '#26f0ff', centre: '#c45aff',
        roadAlt: 0xe0d8f6, roadRough: 0.32, roadMetal: 0.28, roadEnv: 1.25,
        curb: [0xc45aff, 0x26f0ff],
        shoulder: i => Math.floor(i / 6) % 2 ? C(0x463868) : C(0x3a2e58),
        skirt: { bottom: () => -1.2, color: i => Math.floor(i / 5) % 2 ? C(0x2c2244) : C(0x221a36) },
        fence: { h: 1.35, color: i => Math.floor(i / 4) % 2 ? C(0xc45aff) : C(0x26f0ff), skip: i => inUnfenced(newTracks[7], i) },
        gapFace: 0x2c2244,
        arch: { bg: '#160a30', fg: '#26f0ff', edge: '#c45aff', text: 'CRYSTAL CAVERNS', post: 0x463868, stripe: 0xc45aff, cap: 0x26f0ff, glow: true }
      }
    },

    {
      id: 'coaster', name: 'Coaster Boardwalk',
      tag: 'Seaside wooden roller-coaster trestle! Catch airtime over camelback hills, brave the unfenced crest, and fire the Cotton-Candy Cannon.',
      mech: 'Camelback coaster kickers + unfenced crest + bumper cars + cannon',
      champ: 'King of the Boardwalk!', fallMsg: 'OFF THE PIER!', fall: 'street',
      S: 1.48,
      unfenced: [[0.12, 0.22]],
      RAW: [
        [0, 0, 8], [110, 0, 13], [220, -2, 20], [315, -25, 25],
        [345, -90, 22], [295, -150, 16], [195, -155, 11], [95, -155, 9],
        [15, -190, 10], [-15, -265, 14], [-90, -300, 18], [-175, -270, 20],
        [-215, -195, 16], [-215, -105, 12], [-185, -30, 9], [-100, 4, 8]
      ],
      gaps() { return [fgap(0.45, 44, { rampH: 4.8 })]; },
      boxF: [0.05, 0.28, 0.52, 0.74, 0.92],
      pads: [[0.16, 0], [0.41, 0], [0.68, -5], [0.88, 5]],
      build: buildCoaster, music: 'pinball', ui: ['#ff3b5a', '#ffd23f', '#26d3d0'],
      atmo: {
        bg: 0x88ccf6, fog: [0xb4dff8, 360, 2050], sky: [0x2468d8, 0x82caf8, 0xffdfa8],
        sunCol: [1, 0.9, 0.72], sun: [0.52, 0.65, 0.42], stars: 0,
        hemi: [0xfff2dc, 0x9a7e52, 0.74], light: [0xfff0d4, 0.88], fill: [0x78c8ff, 0.32],
        env: { top: '#2468d8', mid: '#88ccf6', hor: '#ffe4b4', ground: '#dec288' }
      },
      theme: {
        roadBase: '#8c6240', speck: spk(115, 165, [14, 4, -10]), tiles: 'rgba(65,38,18,.32)',
        edgeLine: '#fff8ec', centre: '#ffd23f', roadAlt: 0xeedcc4,
        curb: [0xff3b5a, 0xffffff],
        shoulder: i => Math.floor(i / 6) % 2 ? C(0xc9c2b6) : C(0xb8b1a5),
        skirt: { bottom: i => H[i] - 3.2, color: i => Math.floor(i / 4) % 2 ? C(0xf0ece4) : C(0xe83038) },
        fence: { h: 1.35, color: i => Math.floor(i / 4) % 2 ? C(0xffffff) : C(0xff3b5a), skip: i => inUnfenced(newTracks[8], i) },
        gapFace: 0x7a5030,
        arch: { bg: '#e83038', fg: '#ffd23f', edge: '#ffffff', text: 'COASTER PIER', post: 0xf0ece4, stripe: 0x26d3d0, cap: 0xffd23f, glow: true }
      }
    },

    {
      id: 'pizza', name: "Chef's Pizza Inferno",
      tag: 'Wood-fired brick-oven pizzeria madness! Drift golden stuffed-crust bends, dodge spinning pizza cutters, and outrun the giant meatball.',
      mech: 'Brick-oven tunnel + spinning pizza cutters + rolling meatball',
      champ: 'Supreme Pizzaiolo!', fallMsg: 'EXTRA CRISPY!', fall: 'lava',
      S: 1.5,
      RAW: [
        [0, 0, 10], [105, -5, 10], [205, -25, 13], [275, -75, 17],
        [270, -150, 20], [205, -205, 18], [135, -245, 15], [65, -295, 12],
        [-15, -305, 11], [-85, -260, 14], [-105, -185, 16], [-165, -140, 15],
        [-225, -95, 13], [-215, -25, 11], [-135, 8, 10], [-65, 6, 10]
      ],
      gaps() { return [fgap(0.48, 40, { rampH: 4.4 })]; },
      boxF: [0.06, 0.29, 0.54, 0.78, 0.95],
      pads: [[0.14, -5], [0.43, 0], [0.62, 5], [0.90, 0]],
      build: buildPizza, music: 'pizza', ui: ['#d82818', '#ffd24a', '#3ea844'],
      atmo: {
        bg: 0xf0b878, fog: [0xf2c288, 300, 1650], sky: [0x6e2416, 0xd86832, 0xffe098],
        sunCol: [1, 0.85, 0.58], sun: [0.42, 0.74, 0.38], stars: 0,
        hemi: [0xffeac4, 0x7a381e, 0.76], light: [0xffeaaf, 0.88], fill: [0xff7a32, 0.36],
        env: { top: '#7a2818', mid: '#e07838', hor: '#ffe8a8', ground: '#f8b830' }
      },
      theme: {
        roadBase: '#d89e52', speck: spk(160, 210, [20, 6, -20]), edgeLine: '#fff6dc', centre: '#d82818',
        roadAlt: 0xf4cf86,
        curb: [0xd82818, 0x3ea844],
        shoulder: i => Math.floor(i / 6) % 2 ? C(0xc88438) : C(0xb8762e),
        skirt: { bottom: () => -1.2, color: i => Math.floor(i / 5) % 2 ? C(0x8a3a28) : C(0x763020) },
        fence: { h: 1.3, color: i => Math.floor(i / 4) % 2 ? C(0xd82818) : C(0xfff6dc) },
        gapFace: 0x8a3a28,
        arch: { bg: '#3ea844', fg: '#fff6dc', edge: '#d82818', text: 'PIZZA INFERNO', post: 0xd82818, stripe: 0xfff6dc, cap: 0xffd24a }
      }
    }
  ];

  // Register FEAT entries for all 10 new tracks (zero overlapping spans!)
  Object.assign(FEAT, {
    rainbow:   { pipe: [[0.25, 0.32, 'out', 10]], kick: [[0.47, 2.8], [0.91, 2.6]], split: [[0.73, 0.85, 1]] },
    clockwork: { pipe: [[0.07, 0.16, 'out', 9]], tun: [[0.22, 0.30, 'metal']], cannon: [[0.36, -7, 0.46]], narrow: [[0.62, 0.68, 0.62]], kick: [[0.82, 2.8]] },
    ramen:     { pipe: [[0.08, 0.16, 'out', 9]], kick: [[0.22, 2.6], [0.66, 2.8]], narrow: [[0.45, 0.51, 0.65]] },
    tokyo:     { cut: [0.25], split: [[0.44, 0.55, -1]], tun: [[0.73, 0.81, 'neon']], pipe: [[0.86, 0.94, 'out', 9]] },
    mtmayhem:  { sections: 3, tun: [[0.14, 0.19, 'ice'], [0.58, 0.63, 'wood']], split: [[0.42, 0.50, 1]], pipe: [[0.22, 0.28, 'out', 10], [0.72, 0.78, 'out', 10]], kick: [[0.09, 2.8], [0.37, 2.8], [0.68, 3.0], [0.80, 3.2]] },
    vinyl:     { pipe: [[0.08, 0.18, 0, 11], [0.76, 0.85, 'out', 10]], cut: [0.25], tun: [[0.56, 0.64, 'neon']], kick: [[0.40, 2.6], [0.69, 2.8], [0.92, 2.6]] },
    origami:   { kick: [[0.08, 2.6], [0.44, 2.8]], cut: [0.15], narrow: [[0.52, 0.58, 0.62]], pipe: [[0.62, 0.70, 'out', 9]] },
    crystal:   { tun: [[0.07, 0.15, 'rock']], cut: [0.25], split: [[0.44, 0.53, 1]], cannon: [[0.72, 7, 0.81]] },
    coaster:   { kick: [[0.04, 2.8], [0.09, 3.0], [0.25, 2.8], [0.78, 2.8]], cannon: [[0.30, -7, 0.39]], cut: [0.55], pipe: [[0.84, 0.93, 'out', 10]] },
    pizza:     { pipe: [[0.07, 0.16, 'out', 9]], tun: [[0.20, 0.28, 'brick']], kick: [[0.36, 2.8], [0.58, 2.6]], cut: [0.65] }
  });

  // Push new tracks to LEVELS idempotently
  for (const t of newTracks) {
    if (!LEVELS.some(x => x.id === t.id)) LEVELS.push(t);
  }

  // ==========================================================================
  // TRACK ORGANIZATION METADATA (All 44 Tracks: 34 Existing + 10 New)
  // ==========================================================================
  const categories = [
    { id: 'all',      name: 'All Tracks',       icon: '🏁', desc: 'All 44 tracks across 11 Grand Prix Cups' },
    { id: 'new',      name: '★ New 10',         icon: '✨', desc: '10 brand-new handcrafted showcase tracks' },
    { id: 'tropical', name: 'Nature & Wild',    icon: '🌴', desc: 'Volcanoes, jungles, canyons, reefs & caverns' },
    { id: 'urban',    name: 'Cities & Everyday',icon: '🏙️', desc: 'Neon highways, boardwalks, toy-scale rooms & towns' },
    { id: 'cosmic',   name: 'Sci-Fi & Sky',     icon: '🚀', desc: 'Prism highways, sky temples, starships & colliders' },
    { id: 'fantasy',  name: 'Spooky & Bonkers', icon: '🎪', desc: 'Clockwork, funk, pizza ovens, circus & haunted woods' },
    { id: 'epic',     name: 'Special Rules',    icon: '⚡', desc: '1-lap epics, boat pools, aerial dogfights & 4-season' }
  ];

  const trackMeta = {
    // 34 Existing Tracks
    lava:        { cat: 'tropical', diff: 1, tags: ['Half-Pipe'],                              isNew: false },
    mumbai:      { cat: 'urban',    diff: 2, tags: [],                                         isNew: false },
    himalaya:    { cat: 'epic',     diff: 3, tags: ['Point-to-Point'],                         isNew: false },
    sky:         { cat: 'cosmic',   diff: 2, tags: ['Glider', 'Cannon'],                       isNew: false },
    manteca:     { cat: 'urban',    diff: 2, tags: ['Shortcut', 'Multi-Lap'],                  isNew: false },
    streatham:   { cat: 'urban',    diff: 2, tags: [],                                         isNew: false },
    dino:        { cat: 'tropical', diff: 2, tags: ['Half-Pipe', 'Shortcut'],                  isNew: false },
    jungle:      { cat: 'tropical', diff: 2, tags: ['Shortcut'],                               isNew: false },
    space:       { cat: 'cosmic',   diff: 3, tags: ['Half-Pipe', 'Multi-Lap'],                 isNew: false },
    kitchen:     { cat: 'urban',    diff: 1, tags: ['Toy-Scale', 'Half-Pipe'],                 isNew: false },
    bathroom:    { cat: 'urban',    diff: 2, tags: ['Toy-Scale', 'Half-Pipe', 'Shortcut'],     isNew: false },
    aztec:       { cat: 'tropical', diff: 2, tags: [],                                         isNew: false },
    beach:       { cat: 'tropical', diff: 1, tags: ['Shortcut'],                               isNew: false },
    winter:      { cat: 'fantasy',  diff: 1, tags: [],                                         isNew: false },
    pinball:     { cat: 'fantasy',  diff: 2, tags: ['Half-Pipe', 'Cannon', 'Toy-Scale'],       isNew: false },
    reef:        { cat: 'tropical', diff: 1, tags: ['Half-Pipe'],                              isNew: false },
    forest:      { cat: 'tropical', diff: 1, tags: ['Shortcut'],                               isNew: false },
    starship:    { cat: 'cosmic',   diff: 3, tags: ['Cannon'],                                 isNew: false },
    glider:      { cat: 'cosmic',   diff: 2, tags: ['Glider'],                                 isNew: false },
    random:      { cat: 'epic',     diff: 2, tags: ['Multi-Lap'],                              isNew: false },
    cookie:      { cat: 'fantasy',  diff: 2, tags: ['Cannon', 'Half-Pipe'],                    isNew: false },
    seasons:     { cat: 'epic',     diff: 2, tags: ['Multi-Lap'],                              isNew: false },
    circus:      { cat: 'fantasy',  diff: 2, tags: ['Cannon', 'Half-Pipe'],                    isNew: false },
    cats:        { cat: 'fantasy',  diff: 1, tags: ['Toy-Scale'],                              isNew: false },
    scary:       { cat: 'fantasy',  diff: 3, tags: [],                                         isNew: false },
    supermarket: { cat: 'urban',    diff: 1, tags: ['Toy-Scale'],                              isNew: false },
    pumpkins:    { cat: 'fantasy',  diff: 2, tags: ['Shortcut'],                               isNew: false },
    connecticut: { cat: 'urban',    diff: 1, tags: ['Shortcut'],                               isNew: false },
    farm:        { cat: 'tropical', diff: 1, tags: ['Half-Pipe'],                              isNew: false },
    gut:         { cat: 'fantasy',  diff: 2, tags: ['Toy-Scale', 'Half-Pipe'],                 isNew: false },
    collider:    { cat: 'cosmic',   diff: 3, tags: ['Half-Pipe', 'Cannon'],                    isNew: false },
    doomtemple:  { cat: 'fantasy',  diff: 3, tags: ['Shortcut'],                               isNew: false },
    splash:      { cat: 'epic',     diff: 1, tags: ['Boat', 'Half-Pipe'],                      isNew: false },
    dogfight:    { cat: 'epic',     diff: 2, tags: ['Glider'],                                 isNew: false },

    // 10 Brand-New Showcase Tracks
    rainbow:     { cat: 'cosmic',   diff: 3, tags: ['Glider', 'Unfenced', 'Half-Pipe'],        isNew: true },
    clockwork:   { cat: 'fantasy',  diff: 2, tags: ['Cannon', 'Half-Pipe'],                    isNew: true },
    ramen:       { cat: 'epic',     diff: 2, tags: ['Boat', 'Toy-Scale', 'Half-Pipe'],         isNew: true },
    tokyo:       { cat: 'urban',    diff: 3, tags: ['Shortcut', 'Half-Pipe'],                  isNew: true },
    mtmayhem:    { cat: 'epic',     diff: 3, tags: ['Point-to-Point', 'Glider', 'Half-Pipe'],  isNew: true },
    vinyl:       { cat: 'fantasy',  diff: 2, tags: ['Shortcut', 'Half-Pipe', 'Toy-Scale'],     isNew: true },
    origami:     { cat: 'tropical', diff: 2, tags: ['Glider', 'Shortcut', 'Half-Pipe'],        isNew: true },
    crystal:     { cat: 'tropical', diff: 3, tags: ['Unfenced', 'Cannon', 'Shortcut'],         isNew: true },
    coaster:     { cat: 'urban',    diff: 2, tags: ['Unfenced', 'Cannon', 'Shortcut', 'Half-Pipe'], isNew: true },
    pizza:       { cat: 'fantasy',  diff: 2, tags: ['Shortcut', 'Half-Pipe', 'Toy-Scale'],     isNew: true }
  };

  // 11 Clean 4-Race Cups (8 Classic Cups + 3 Brand-New Cups = 44 Tracks Total!)
  const extraCups = [
    { id: 'feast',  name: 'Turbo Feast Cup',      ids: ['splash', 'ramen', 'coaster', 'pizza'],       col: '#4a1814' },
    { id: 'neon',   name: 'Neon Groove Cup',      ids: ['vinyl', 'origami', 'clockwork', 'tokyo'],    col: '#1e1042' },
    { id: 'summit', name: 'Starlight Summit Cup', ids: ['dogfight', 'crystal', 'mtmayhem', 'rainbow'], col: '#0c2444' }
  ];
  for (const c of extraCups) {
    if (!CUPS.some(x => x.id === c.id)) CUPS.push(c);
  }

  return { newTracks, trackMeta, cups: CUPS, categories };
};
