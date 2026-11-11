#!/usr/bin/env python3
"""
Geometry, Feature-Span, Music, and Organization Validator for Wheelie Fun (new_tracks.js).

Ports Three.js closed centripetal CatmullRomCurve3 (`checkRAW`) + `featCompute` (`featClear` /
`featFindCut`) and validates:
  1. Spline length: 1750..2500 for 3-lap tracks (4500..6200 for 1-lap 3-section epics).
  2. Minimum non-adjacent road separation >= 95 world units (no road/wall overlaps).
  3. Maximum turn angle <= 1.0 rad over 33m.
  4. Maximum elevation slope <= 0.072 (including vertical scale HS).
  5. Zero dropped FEAT items and strictly zero overlapping gaps, unfenced zones, and FEAT spans.
  6. Music groove integrity (4-bar progression, 8-step bass, 64-step melody).
  7. Complete trackMeta & 11-Cup organization across all 44 tracks (34 base + 10 new).
"""

import ast
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW_TRACKS_PATH = os.path.join(ROOT, "new_tracks.js")
ORIG_HTML_PATH = os.path.join(ROOT, "original_index.html")

N_SAMPLES = 1800
WALL = 25.0


def catmull_rom_centripetal_closed(pts_3d, divisions=200, n_spaced=900):
    """Exact port of THREE.CatmullRomCurve3(pts, true, 'centripetal').getSpacedPoints(n).slice(0, n)."""
    m = len(pts_3d)

    def dist(a, b):
        return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

    def eval_curve(t_global):
        t_global = t_global % 1.0
        p = m * t_global
        idx = int(math.floor(p))
        u = p - idx
        if idx >= m:
            idx = 0
            u = 0.0
        p0 = pts_3d[(idx - 1 + m) % m]
        p1 = pts_3d[idx % m]
        p2 = pts_3d[(idx + 1) % m]
        p3 = pts_3d[(idx + 2) % m]

        dt0 = math.pow(max(dist(p0, p1) ** 2, 1e-8), 0.25)
        dt1 = math.pow(max(dist(p1, p2) ** 2, 1e-8), 0.25)
        dt2 = math.pow(max(dist(p2, p3) ** 2, 1e-8), 0.25)

        u2 = u * u
        u3 = u2 * u
        h00 = 2 * u3 - 3 * u2 + 1
        h10 = u3 - 2 * u2 + u
        h01 = -2 * u3 + 3 * u2
        h11 = u3 - u2
        out = [0.0, 0.0, 0.0]
        for k in range(3):
            v0, v1, v2, v3 = p0[k], p1[k], p2[k], p3[k]
            t1 = ((v1 - v0) / dt0 - (v2 - v0) / (dt0 + dt1) + (v2 - v1) / dt1) * dt1
            t2 = ((v2 - v1) / dt1 - (v3 - v1) / (dt1 + dt2) + (v3 - v2) / dt2) * dt1
            out[k] = h00 * v1 + h10 * t1 + h01 * v2 + h11 * t2
        return tuple(out)

    arc_pts = [eval_curve(d / divisions) for d in range(divisions + 1)]
    cum = [0.0]
    for i in range(1, len(arc_pts)):
        cum.append(cum[-1] + dist(arc_pts[i], arc_pts[i - 1]))
    total_len = cum[-1]

    spaced = []
    j = 0
    for d in range(n_spaced):
        target = (d / n_spaced) * total_len
        while j < divisions - 1 and cum[j + 1] < target:
            j += 1
        seg_len = cum[j + 1] - cum[j]
        frac = (target - cum[j]) / seg_len if seg_len > 1e-9 else 0.0
        spaced.append(eval_curve((j + frac) / divisions))
    return spaced, total_len


def adiff(a, b):
    d = b - a
    while d > math.pi:
        d -= 2 * math.pi
    while d < -math.pi:
        d += 2 * math.pi
    return d


def wrap_i(i):
    return ((i % N_SAMPLES) + N_SAMPLES) % N_SAMPLES


def extract_balanced(src, start_idx, open_ch, close_ch):
    depth = 0
    in_str = None
    esc = False
    for idx in range(start_idx, len(src)):
        ch = src[idx]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == in_str:
                in_str = None
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return src[start_idx : idx + 1]
    raise ValueError(f"Unbalanced {open_ch}{close_ch} starting at {start_idx}")


def parse_new_tracks(js_src):
    arr_anchor = js_src.index("const newTracks = [")
    arr_str = extract_balanced(js_src, js_src.index("[", arr_anchor), "[", "]")

    # Split top-level objects in newTracks
    objs = []
    i = 1
    while i < len(arr_str) - 1:
        if arr_str[i] == "{":
            blk = extract_balanced(arr_str, i, "{", "}")
            objs.append(blk)
            i += len(blk)
        else:
            i += 1

    tracks = []
    for blk in objs:
        tid = re.search(r"\bid:\s*'([a-z0-9_]+)'", blk).group(1)
        name_m = re.search(r"\bname:\s*(?:'([^']+)'|\"([^\"]+)\")", blk)
        tname = name_m.group(1) or name_m.group(2)
        s_val = float(re.search(r"\bS:\s*([0-9.]+)", blk).group(1))
        hs_m = re.search(r"\bHS:\s*([0-9.]+)", blk)
        hs_val = float(hs_m.group(1)) if hs_m else 1.0
        laps_m = re.search(r"\blaps:\s*([0-9]+)", blk)
        laps_val = int(laps_m.group(1)) if laps_m else 3

        raw_pos = blk.index("RAW:")
        raw_str = extract_balanced(blk, blk.index("[", raw_pos), "[", "]")
        raw_pts = ast.literal_eval(raw_str)

        unfenced = []
        uf_m = re.search(r"\bunfenced:\s*\[", blk)
        if uf_m:
            uf_str = extract_balanced(blk, blk.index("[", uf_m.start()), "[", "]")
            unfenced = ast.literal_eval(uf_str)

        gaps = []
        for gm in re.finditer(r"fgap\(\s*([0-9.]+)\s*,\s*([0-9.]+)", blk):
            gaps.append((float(gm.group(1)), float(gm.group(2))))

        tracks.append({
            "id": tid,
            "name": tname,
            "S": s_val,
            "HS": hs_val,
            "laps": laps_val,
            "RAW": raw_pts,
            "unfenced": unfenced,
            "gaps": gaps,
        })
    return tracks


def parse_js_simple_dict(block_str):
    """Convert simple JS object literal (unquoted keys, true/false) to Python dict."""
    s = re.sub(r"//.*", "", block_str)
    s = re.sub(r"(?<=[{,\s])([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r"'\1':", s)
    s = re.sub(r"\btrue\b", "True", s)
    s = re.sub(r"\bfalse\b", "False", s)
    return ast.literal_eval(s)


def main():
    with open(NEW_TRACKS_PATH, "r", encoding="utf-8") as f:
        js_src = f.read()
    with open(ORIG_HTML_PATH, "r", encoding="utf-8") as f:
        html_src = f.read()

    tracks = parse_new_tracks(js_src)
    assert len(tracks) == 10, f"Expected 10 new tracks, found {len(tracks)}"

    feat_anchor = js_src.index("Object.assign(FEAT,")
    feat_dict = parse_js_simple_dict(extract_balanced(js_src, js_src.index("{", feat_anchor), "{", "}"))

    music_anchor = js_src.index("Object.assign(MUSIC,")
    music_dict = parse_js_simple_dict(extract_balanced(js_src, js_src.index("{", music_anchor), "{", "}"))

    meta_anchor = js_src.index("const trackMeta =")
    meta_dict = parse_js_simple_dict(extract_balanced(js_src, js_src.index("{", meta_anchor), "{", "}"))

    extra_cups_anchor = js_src.index("const extraCups =")
    extra_cups = parse_js_simple_dict(extract_balanced(js_src, js_src.index("[", extra_cups_anchor), "[", "]"))

    cats_anchor = js_src.index("const categories =")
    categories = parse_js_simple_dict(extract_balanced(js_src, js_src.index("[", cats_anchor), "[", "]"))

    print("=" * 78)
    print("WHEELIE FUN — 10 NEW TRACKS GEOMETRY & SPAN VALIDATION")
    print("=" * 78)

    failures = []

    for tr in tracks:
        tid = tr["id"]
        S, HS, raw = tr["S"], tr["HS"], tr["RAW"]
        pts_3d = [(p[0] * S, p[2] * HS, p[1] * S) for p in raw]

        # 1. checkRAW 900-point spline checks
        P, length = catmull_rom_centripetal_closed(pts_3d, divisions=200, n_spaced=900)
        n = 900
        sp900 = length / n
        min_sep = 1e9
        for i in range(0, n, 3):
            for j in range(i + 3, n, 3):
                di = min(j - i, n - (j - i))
                if di * sp900 < 220:
                    continue
                d = math.hypot(P[i][0] - P[j][0], P[i][2] - P[j][2])
                if d < min_sep:
                    min_sep = d

        ta900 = [
            math.atan2(P[(i + 1) % n][0] - P[(i - 1 + n) % n][0], P[(i + 1) % n][2] - P[(i - 1 + n) % n][2])
            for i in range(n)
        ]
        w = max(2, round(33.0 / sp900))
        max_turn = max(abs(adiff(ta900[i], ta900[(i + w) % n])) for i in range(n))
        max_slope = max(abs(P[(i + 3) % n][1] - P[i][1]) / (3.0 * sp900) for i in range(n))

        if tr["laps"] == 1:
            len_ok = 4500 <= length <= 6200
        else:
            len_ok = 1750 <= length <= 2500
        sep_ok = min_sep >= 95.0
        turn_ok = max_turn <= 1.0
        slope_ok = max_slope <= 0.072

        # 2. Exact 1800-sample featCompute & non-overlap validation
        TP, _ = catmull_rom_centripetal_closed(pts_3d, divisions=200, n_spaced=N_SAMPLES)
        SP = length / N_SAMPLES
        TR = []
        DIST = [0.0] * N_SAMPLES
        for i in range(N_SAMPLES):
            a, b = TP[(i - 1 + N_SAMPLES) % N_SAMPLES], TP[(i + 1) % N_SAMPLES]
            dx, dz = b[0] - a[0], b[2] - a[2]
            dl = math.hypot(dx, dz)
            TR.append((-dz / dl, dx / dl))
            if i > 0:
                DIST[i] = DIST[i - 1] + math.sqrt(sum((TP[i][k] - TP[i - 1][k]) ** 2 for k in range(3)))

        GAP = [0] * N_SAMPLES
        spans = []
        for at, gl in tr["gaps"]:
            gs = int(math.floor(at * N_SAMPLES))
            ge = gs + round(gl / SP)
            spans.append(("gap", gs / N_SAMPLES, ge / N_SAMPLES))
            for i in range(gs, ge + 1):
                GAP[wrap_i(i)] = 1

        def feat_clear(a_idx, b_idx, before=140, after=70):
            for idx in range(a_idx - round(before / SP), b_idx + round(after / SP) + 1):
                if GAP[wrap_i(idx)]:
                    return False
            return True

        def fi(frac):
            return wrap_i(int(math.floor(frac * N_SAMPLES)))

        F = feat_dict.get(tid, {})
        span_errs = []

        for u0, u1 in tr["unfenced"]:
            if not feat_clear(fi(u0), fi(u1), 30, 30):
                span_errs.append(f"unfenced[{u0},{u1}] too close to gap")
            spans.append(("unfenced", u0, u1))

        for f0, f1, _w in F.get("narrow", []):
            if not feat_clear(fi(f0), fi(f1), 40, 40):
                span_errs.append(f"narrow[{f0},{f1}] rejected by featClear")
            spans.append(("narrow", f0, f1))

        for f0, f1, _sd, _r in F.get("pipe", []):
            if not feat_clear(fi(f0), fi(f1), 30, 30):
                span_errs.append(f"pipe[{f0},{f1}] rejected by featClear")
            spans.append(("pipe", f0, f1))

        for kick_item in F.get("kick", []):
            fk = kick_item[0]
            ln = kick_item[2] if len(kick_item) > 2 else 22
            sk = fi(fk)
            if not feat_clear(sk - round(ln / SP), sk, 40, 60):
                span_errs.append(f"kick[{fk}] shifted/rejected by featClear")
            spans.append(("kick", (sk - round(ln / SP)) / N_SAMPLES, (sk + round(5 / SP)) / N_SAMPLES))

        for f0, f1, _st in F.get("tun", []):
            if not feat_clear(fi(f0), fi(f1), 30, 30):
                span_errs.append(f"tun[{f0},{f1}] rejected by featClear")
            spans.append(("tun", f0, f1))

        for f0, f1, _rk in F.get("split", []):
            if not feat_clear(fi(f0), fi(f1), 60, 40):
                span_errs.append(f"split[{f0},{f1}] rejected by featClear")
            spans.append(("split", f0, f1))

        for can_item in F.get("cannon", []):
            fc, _lat, land = can_item[0], can_item[1], can_item[2]
            if not feat_clear(fi(fc), fi(fc), 60, 40):
                span_errs.append(f"cannon[{fc}] rejected by featClear")
            if not feat_clear(fi(land), fi(land), 30, 30):
                span_errs.append(f"cannon landing[{land}] too close to gap")
            spans.append(("cannon", fc, land))

        for fc in F.get("cut", []):
            s0 = fi(fc)
            step = max(2, round(4 / SP))
            best = None
            for i0 in range(s0 - round(70 / SP), s0 + round(70 / SP) + 1, step):
                if i0 < round(60 / SP):
                    continue
                for lc in range(round(110 / SP), round(420 / SP) + 1, step):
                    i1 = i0 + lc
                    if i1 >= N_SAMPLES - round(60 / SP):
                        break
                    if not feat_clear(i0, i1, 90, 60):
                        continue
                    for side in (-1, 1):
                        ax = TP[i0][0] + TR[i0][0] * side * WALL
                        az = TP[i0][2] + TR[i0][1] * side * WALL
                        bx = TP[i1][0] + TR[i1][0] * side * WALL
                        bz = TP[i1][2] + TR[i1][1] * side * WALL
                        d = math.hypot(bx - ax, bz - az)
                        if d < 50 or d > 280:
                            continue
                        gain = DIST[i1] - DIST[i0] - d
                        if gain < d * 0.45 or (best and gain <= best[0]):
                            continue
                        ok_c = True
                        m_pad = round(45 / SP)
                        ux, uz = bx - ax, bz - az
                        l2 = ux * ux + uz * uz
                        for j in range(0, N_SAMPLES, 2):
                            near = i0 - m_pad <= j <= i1 + m_pad
                            inside = i0 + m_pad < j < i1 - m_pad
                            if near and not inside:
                                continue
                            t_proj = max(0.0, min(1.0, ((TP[j][0] - ax) * ux + (TP[j][2] - az) * uz) / l2))
                            dd = math.hypot(TP[j][0] - (ax + ux * t_proj), TP[j][2] - (az + uz * t_proj))
                            if dd < WALL + (8 if inside else 16):
                                ok_c = False
                                break
                        if ok_c:
                            best = (gain, i0 / N_SAMPLES, i1 / N_SAMPLES)
            if not best:
                span_errs.append(f"cut[{fc}] failed featFindCut")
            else:
                spans.append(("cut", best[1], best[2]))

        # Strict pairwise overlap check across ALL gaps, unfenced zones, and FEAT spans
        for idx1 in range(len(spans)):
            k1, a1, b1 = spans[idx1]
            for idx2 in range(idx1 + 1, len(spans)):
                k2, a2, b2 = spans[idx2]
                if max(a1, a2) < min(b1, b2):
                    span_errs.append(f"overlap {k1}[{a1:.3f},{b1:.3f}] vs {k2}[{a2:.3f},{b2:.3f}]")

        passed = len_ok and sep_ok and turn_ok and slope_ok and not span_errs
        badge = "PASS" if passed else "FAIL"
        print(
            f"[{badge}] {tid:10s} ({tr['name']:20s}) | "
            f"len={length:6.1f}  minSep={min_sep:5.1f}  maxTurn={max_turn:.3f}  maxSlope={max_slope:.4f}  spans={len(spans)}"
        )
        if not passed:
            failures.append((tid, len_ok, sep_ok, turn_ok, slope_ok, span_errs))
            for e in span_errs:
                print(f"       -> {e}")

    # 3. Validate custom MUSIC grooves
    for m_key, m_obj in music_dict.items():
        if len(m_obj["prog"]) != 4 or len(m_obj["bass"]) != 8 or len(m_obj["mel"]) != 64:
            failures.append((f"music:{m_key}", m_obj))

    # 4. Validate Track Organization Metadata & 11 Cups against original_index.html
    arenas_start = html_src.index("const ARENAS=[")
    levels_section = html_src[:arenas_start]
    orig_track_ids = re.findall(r"\{id:'([a-z0-9_]+)',(?:random:true,)?name:", levels_section)
    new_track_ids = [t["id"] for t in tracks]
    all_track_ids = orig_track_ids + new_track_ids

    cups_line = re.search(r"const CUPS=(\[.*?\]);", html_src).group(1)
    orig_cups = parse_js_simple_dict(cups_line)
    all_cups = orig_cups + extra_cups

    cup_flat_ids = [tid for c in all_cups for tid in c["ids"]]
    missing_in_meta = set(all_track_ids) - set(meta_dict.keys())
    extra_in_meta = set(meta_dict.keys()) - set(all_track_ids)
    missing_in_cups = set(all_track_ids) - set(cup_flat_ids)
    invalid_in_cups = set(cup_flat_ids) - set(all_track_ids)

    allowed_tags = {
        "Glider", "Boat", "Unfenced", "Shortcut", "Cannon",
        "Half-Pipe", "Point-to-Point", "Toy-Scale", "Multi-Lap",
    }
    valid_cats = {c["id"] for c in categories if c["id"] not in ("all", "new")}
    for tid, m in meta_dict.items():
        if m["cat"] not in valid_cats:
            failures.append((f"meta.cat:{tid}", m["cat"]))
        if m["diff"] not in (1, 2, 3):
            failures.append((f"meta.diff:{tid}", m["diff"]))
        bad_tags = set(m["tags"]) - allowed_tags
        if bad_tags:
            failures.append((f"meta.tags:{tid}", bad_tags))

    if missing_in_meta or extra_in_meta or missing_in_cups or invalid_in_cups or len(cup_flat_ids) != len(set(cup_flat_ids)):
        failures.append(("organization", missing_in_meta, extra_in_meta, missing_in_cups, invalid_in_cups))

    print("-" * 78)
    print(f"Music Grooves Verified : {len(music_dict)} custom 64-step tracks ({', '.join(music_dict.keys())})")
    print(f"Total Tracks Verified  : {len(all_track_ids)} ({len(orig_track_ids)} existing + {len(new_track_ids)} new)")
    print(f"Total Cups Verified    : {len(all_cups)} 4-race Cups ({len(cup_flat_ids)} unique track slots, 0 invalid/unassigned)")
    print(f"Categories Verified    : {len(categories)} ({', '.join(c['id'] for c in categories)})")
    print("=" * 78)

    if failures:
        print("VALIDATION FAILED:", failures)
        sys.exit(1)
    print("ALL CHECKS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    main()
