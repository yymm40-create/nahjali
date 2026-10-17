/* Strata launch film — deterministic timeline engine.
   Contract (higgsfield-motion capture): window.__comp + window.__seek(t), pure function of t (no rAF, no CSS transitions).
   Motion grammar (higgsfield-motion-saas, ported): speed peaks ON cuts (ease-in into the cut, ease-out out of it, matched speed),
   overlap = next move starts before the current ends (~0.45), extra motion on a parent wrapper ("null"), inertial bounce
   only on entrances, never overshoot on a move that hides a cut. */
(function () {
  const FILM = window.FILM = { W: 1920, H: 1080, fps: 30, dur: 15, scenes: [], errors: [] };

  /* ---------------- easing ---------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const bez = (x1, y1, x2, y2) => (x) => {             // CSS-like cubic-bezier(x1,y1,x2,y2)
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t - x;
      const d = 3 * x1 * (1 - t) * (1 - 4 * t + 3 * t * t) + 3 * x2 * t * (2 - 3 * t) + 3 * t * t; // derivative approx
      if (Math.abs(cx) < 1e-6) break;
      t -= cx / (Math.abs(d) < 1e-6 ? 1e-6 : d); t = clamp(t, 0, 1);
    }
    return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  };
  const E = FILM.E = {
    lin: (p) => p,
    in: (k = 3) => (p) => Math.pow(p, k),                       // accelerate INTO a cut (speed max at p=1)
    out: (k = 3) => (p) => 1 - Math.pow(1 - p, k),              // decelerate OUT of a cut (speed max at p=0)
    inOut: (k = 3) => (p) => p < .5 ? Math.pow(2 * p, k) / 2 : 1 - Math.pow(2 - 2 * p, k) / 2,
    expoOut: (p) => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p),
    expoIn: (p) => p <= 0 ? 0 : Math.pow(2, 10 * p - 10),
    // SaaS "productive" curves (AE influence ~ 66–90%)
    move: bez(0.65, 0, 0.1, 1),          // strong in-out for moves between poses
    ui: bez(0.2, 0, 0, 1),               // UI settle (fast start, long tail)
    camera: bez(0.6, 0, 0.2, 1),         // camera moves
    settle: bez(0.05, 0.7, 0.1, 1),      // mockup settle after a cut: ≈ .35/.66/.80/.88 at +0.1…0.4 s on a 1.2 s move
    soft: bez(0.16, 1, 0.3, 1),          // v2: long, soft settle (expo-out-like) — default for entrances
    glide: bez(0.45, 0, 0.55, 1),        // v2: gentle in-out (sine-like) — drifts, holds, camera
    smooth: bez(0.5, 0, 0.1, 1),         // v2: in-out with a long settle — moves between poses
    back: (s = 1.4) => (p) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2), // small overshoot (chips/pills only)
    bez,
  };

  /* ---------------- tweening helpers (all pure) ---------------- */
  FILM.p = (t, t0, t1) => clamp((t - t0) / (t1 - t0), 0, 1);
  FILM.tw = (t, t0, t1, a, b, ease) => a + (b - a) * (ease || E.lin)(FILM.p(t, t0, t1));
  // keyframes: [[t, v], [t, v, easeIntoThisKey], ...]; numbers or arrays
  FILM.kf = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i], [t0, v0] = keys[i - 1];
      if (t <= t1) {
        const q = (e || E.move)(FILM.p(t, t0, t1));
        return Array.isArray(v0) ? v0.map((a, j) => a + (v1[j] - a) * q) : v0 + (v1 - v0) * q;
      }
    }
    return keys[keys.length - 1][1];
  };
  // inertial bounce after an entrance (higgsfield-motion-saas SM.entrance: amp .0375, freq 1.8, decay 3.2 → scaled by velocity)
  FILM.bounce = (dt, v, amp = 0.0375, freq = 1.8, decay = 3.2) => dt <= 0 ? 0 : v * amp * Math.sin(freq * dt * 2 * Math.PI) / Math.exp(decay * dt);
  // spring-ish settle 0→1 with small overshoot, for entrances only
  FILM.pop = (t, t0, d = 0.5) => {          // damped spring 0→1, ≈6–7 % overshoot, settles by t0+d
    const x = t - t0; if (x <= 0) return 0; if (x >= d) return 1;
    return 1 - Math.exp(-12 * x) * Math.cos(14 * x);
  };
  // v2: critically damped approach 0→1 (no overshoot), settles by t0+d — use instead of pop for a calmer feel
  FILM.soft = (t, t0, d = 0.6) => { const x = t - t0; if (x <= 0) return 0; if (x >= d) return 1; const k = 7 / d; return 1 - (1 + k * x) * Math.exp(-k * x); };
  // typing: characters visible at time t (cps chars/sec)
  FILM.type = (text, t, t0, cps = 26) => text.slice(0, clamp(Math.floor((t - t0) * cps), 0, text.length));
  FILM.caretOn = (t, tEnd) => t < tEnd ? 1 : (Math.floor((t - tEnd) * 2 * 2) % 2 === 0 ? 1 : 0); // solid while typing, 2 Hz blink after
  // deterministic noise
  FILM.rand = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  // draw-on helper for SVG paths: set stroke-dasharray/offset by progress (call after the path is in the DOM)
  FILM.drawOn = (path, p) => {
    if (!path.__len) { path.__len = path.getTotalLength(); path.style.strokeDasharray = path.__len + ' ' + path.__len; }
    path.style.strokeDashoffset = path.__len * (1 - clamp(p, 0, 1));
  };
  // transform string helper
  FILM.tf = (o) => `translate(${o.x || 0}px,${o.y || 0}px) rotate(${o.r || 0}deg) scale(${o.s == null ? 1 : o.s})`;
  FILM.set = (el, css) => { for (const k in css) el.style[k] = css[k]; };

  /* ---------------- scenes ---------------- */
  // def: { id, t0, t1, world:'light'|'dark', build(root) , update(lt, t, root) }  lt = t - t0 (scene-local seconds)
  FILM.scene = (def) => { FILM.scenes.push(def); };

  // force every face the film uses to load BEFORE any scene measures text (document.fonts.ready alone fires too early)
  FILM.loadFonts = async () => {
    const faces = [];
    ['500', '600', '700', '800', '900'].forEach((w) => faces.push(w + ' 100px "Inter Tight"'));
    ['400', '500', '600', '700'].forEach((w) => faces.push(w + ' 100px "Inter"'));
    ['400', '500', '600'].forEach((w) => faces.push(w + ' 100px "Geist Mono"'));
    try { await Promise.all(faces.map((f) => document.fonts.load(f, 'strata Aa 0123 ×→✦'))); } catch (e) {}
    await document.fonts.ready;
  };
  /* ---------------- v2: one canvas, one camera ----------------
     Every scene is a 1920×1080 plane placed on ONE infinite Strata canvas (world). Light scenes ARE the canvas; dark scenes
     are artboards lying on it (with a frame label). A single 3D camera (perspective) moves over the world: it settles,
     drifts during holds, and flies between neighbouring artboards (pull back → pan → push in). Match cuts inside scenes
     (s5→s6→s7→s8→s9) stay scene-owned. Scenes get optional pre/post visibility (seconds) so both are on screen in a flight. */
  const PLACE = FILM.place = { s12: [0, 0], s3: [0, 0], s4: [0, 0], s5: [0, 0], s6: [0, 0], s7: [0, 0], s8: [0, 0], s9: [0, 0] };   // v4: all scenes overlap in one frame
  const CS = (id, o) => Object.assign({ cx: PLACE[id][0] + 960, cy: PLACE[id][1] + 540, s: 1, rx: 0, ry: 0, rz: 0 }, o || {});
  // v3: camera moves live INSIDE scenes only (depth during holds). Transitions are the scenes' own v1 cuts — the camera
  // never flies between scenes; it is near-neutral at every cut so the v1 transitions read exactly as before.
  // v4: in-scene camera only (depth during holds); rotation is back to 0 at every transition window so contracts are in plain screen space
  const CAM = FILM.CAM = [
    { t0: 0.00, t1: 1.40, a: CS('s12', { cx: 1030, cy: 610, s: 1.12, rx: 14, ry: -11, rz: -1.5 }), b: CS('s12'), ease: E.bez(0.3, 0.3, 0.15, 1) },
    { t0: 1.40, t1: 2.20, a: CS('s12'), b: CS('s12', { s: 1.02, ry: 1.4, rx: -0.6 }), ease: E.glide },
    { t0: 2.20, t1: 2.70, a: CS('s12', { s: 1.02, ry: 1.4, rx: -0.6 }), b: CS('s12', { s: 1.03 }), ease: E.glide },
    { t0: 2.70, t1: 3.20, a: CS('s12', { s: 1.03 }), b: CS('s3', { s: 1.03 }) },                                          // C1 window: neutral
    { t0: 3.20, t1: 3.90, a: CS('s3', { s: 1.03 }), b: CS('s3', { s: 1.06, ry: -2.2, rx: 1.0 }), ease: E.glide },         // orbit across the type
    { t0: 3.90, t1: 4.50, a: CS('s3', { s: 1.06, ry: -2.2, rx: 1.0 }), b: CS('s3', { s: 1.04 }), ease: E.glide },
    { t0: 4.50, t1: 5.20, a: CS('s3', { s: 1.04 }), b: CS('s4', { s: 1.04 }) },                                           // C2 window: neutral ×1.04
    { t0: 5.20, t1: 5.70, a: CS('s4', { s: 1.04 }), b: CS('s4', { s: 1.06, rx: 1.6, ry: -0.8 }), ease: E.glide },         // slow crane over the bar
    { t0: 5.70, t1: 6.05, a: CS('s4', { s: 1.06, rx: 1.6, ry: -0.8 }), b: CS('s4'), ease: E.glide },
    { t0: 6.05, t1: 6.90, a: CS('s4'), b: CS('s5') },                                                                      // C3 window: neutral ×1
    { t0: 6.90, t1: 7.60, a: CS('s5'), b: CS('s5', { s: 1.02 }), ease: E.glide },
    { t0: 7.60, t1: 8.00, a: CS('s5', { s: 1.02 }), b: CS('s5', { s: 1.02 }) },                                           // (s5 owns its push-in)
    { t0: 8.00, t1: 9.25, a: CS('s6'), b: CS('s6', { ry: -2.5, rx: 1.5, s: 1.04 }), ease: E.glide },                      // orbit around the stack
    { t0: 9.25, t1: 9.70, a: CS('s6', { ry: -2.5, rx: 1.5, s: 1.04 }), b: CS('s6'), ease: E.inOut(2) },
    { t0: 9.70, t1: 10.30, a: CS('s6'), b: CS('s7') },                                                                     // C5 window
    { t0: 10.30, t1: 11.30, a: CS('s7'), b: CS('s7', { s: 1.025 }), ease: E.glide },
    { t0: 11.30, t1: 12.30, a: CS('s7', { s: 1.025 }), b: CS('s8', { s: 1.025 }) },                                      // C6 window: constant ×1.025
    { t0: 12.30, t1: 12.90, a: CS('s8', { s: 1.025 }), b: CS('s8', { s: 1.05, ry: -2, rx: 1 }), ease: E.glide },          // orbit around the pill
    { t0: 12.90, t1: 13.15, a: CS('s8', { s: 1.05, ry: -2, rx: 1 }), b: CS('s8'), ease: E.inOut(2) },
    { t0: 13.15, t1: 13.50, a: CS('s8'), b: CS('s8') },                                                                    // C7 window: neutral ×1
    { t0: 13.50, t1: 15.00, a: CS('s9'), b: CS('s9', { s: 1.035 }), ease: E.glide },
  ];
  const lerp = (a, b, p) => a + (b - a) * p;
  FILM.camAt = (t) => {
    let seg = CAM[CAM.length - 1];
    for (const c of CAM) { if (t >= c.t0 && t < c.t1) { seg = c; break; } }
    const u = FILM.p(t, seg.t0, seg.t1), a = seg.a, b = seg.b;
    if (seg.fly) {                                     // smooth zoom-pan: pan mostly while zoomed out, scale dips to minS
      const pc = u * u * u * (u * (6 * u - 15) + 10), pz = E.glide(u), f = seg.fly;   // smootherstep pan: no whip, no hard brake
      const la = Math.log(a.s), lb = Math.log(b.s), lm = Math.log(f.minS), bump = Math.sin(Math.PI * pz);
      return { cx: lerp(a.cx, b.cx, pc), cy: lerp(a.cy, b.cy, pc), s: Math.exp(lerp(la, lb, pz) - ((la + lb) / 2 - lm) * bump),
        rx: lerp(a.rx, b.rx, pz) + (f.rx || 0) * bump, ry: lerp(a.ry, b.ry, pz) + (f.ry || 0) * bump, rz: lerp(a.rz, b.rz, pz) + (f.rz || 0) * bump, fly: true };
    }
    const q = (seg.ease || E.lin)(u);
    return { cx: lerp(a.cx, b.cx, q), cy: lerp(a.cy, b.cy, q), s: lerp(a.s, b.s, q), rx: lerp(a.rx, b.rx, q), ry: lerp(a.ry, b.ry, q), rz: lerp(a.rz, b.rz, q), fly: false };
  };
  /* v4: FLOWING BACKGROUND ("переливание"). A living mesh gradient in screen space behind all scenes. Each scene has a
     palette state; between states the new palette spreads from the point of action as a soft organic wave whose front
     carries an iridescent AI-colour fringe. Scenes are transparent and draw only their content. */
  const PAL = FILM.PAL = {
    L0: { base: '#F3F3F7', dots: 'rgba(19,20,21,.10)', blobs: [['#E2DCFF', .95], ['#F4E7FF', .8], ['#E0EBFF', .85], ['#FFFFFF', .75]] },
    D1: { base: '#0B0B10', dots: 'rgba(240,240,242,.07)', blobs: [['#2C1F7C', .9], ['#101A46', .85], ['#3B1658', .6], ['#1C1548', .7]] },
    D2: { base: '#0A0B11', dots: 'rgba(240,240,242,.07)', blobs: [['#1E2C7C', .9], ['#2C1F7C', .7], ['#0C3A58', .55], ['#151C4C', .7]] },
    AI: { base: '#5B6CFF', dots: 'rgba(255,255,255,.10)', blobs: [['#8A5CFF', 1], ['#3EB6FF', 1], ['#B49BFF', .9], ['#6E7BFF', .9]] },
    L1: { base: '#F2F4FA', dots: 'rgba(19,20,21,.10)', blobs: [['#DDE6FF', .95], ['#EDE4FF', .8], ['#DDF0FF', .85], ['#FFFFFF', .75]] },
    D3: { base: '#09090F', dots: 'rgba(240,240,242,.06)', blobs: [['#3A2AA6', .8], ['#111A42', .85], ['#25145E', .6], ['#17123C', .7]] },
    D4: { base: '#0A0A11', dots: 'rgba(240,240,242,.06)', blobs: [['#3C2AB4', .85], ['#1A2164', .8], ['#2B1464', .55], ['#141A46', .7]] },
    L3: { base: '#FAFAFC', dots: 'rgba(19,20,21,0)', blobs: [['#ECE9FF', .55], ['#F6F0FF', .45], ['#EDF3FF', .45], ['#FFFFFF', .6]] },
  };
  // [t0, t1, from, to, origin(screen px)]
  const BGK = FILM.BGK = [
    [2.75, 3.20, 'L0', 'D1', [960, 500]],      // C1 title → together: dark blooms from the centre as the title flies through the camera
    [4.55, 5.10, 'D1', 'D2', [1920, 560]],     // C2 together → prompt: new hue rolls in from the right with the bar
    [6.15, 6.45, 'D2', 'AI', [1485, 535]],     // C3a Generate: AI colour floods out of the button
    [6.40, 6.85, 'AI', 'L1', [1485, 535]],     // C3b … and settles into the light canvas the variants land on
    [7.65, 8.10, 'L1', 'D3', [960, 540]],      // C4 push into the phone: its dark UI spreads to the edges
    [9.80, 10.30, 'D3', 'L0', [1264, 620]],    // C5 pull back: the canvas light comes out of the phone
    [11.65, 12.15, 'L0', 'D4', [1645, 508]],   // C6 the Follow button lifts off: dark spreads from it (screen pos under ×1.025)
    [13.20, 13.50, 'D4', 'L3', [960, 540]],    // C7 the pill becomes the end frame
  ];
  const START = 'L0';
  const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const c = hexRGB(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  let bgc, bgx, offA, offAx, maskC, maskX, dotsPat = {};
  function blobPos(i, t) {                    // slow Lissajous drift — the background is always alive
    const B = [[0.24, 0.30, 0.31, 0.43, 980], [0.78, 0.30, 0.27, 0.37, 900], [0.62, 0.82, 0.23, 0.33, 1050], [0.18, 0.78, 0.35, 0.29, 820]];
    const b = B[i];
    return [1920 * b[0] + 140 * Math.sin(t * b[2] + i * 1.7), 1080 * b[1] + 90 * Math.cos(t * b[3] + i * 2.3), b[4] * (1 + 0.06 * Math.sin(t * 0.5 + i))];
  }
  function dots(color) {
    if (dotsPat[color]) return dotsPat[color];
    const c = document.createElement('canvas'); c.width = c.height = 36; const x = c.getContext('2d');
    x.fillStyle = color; x.beginPath(); x.arc(18, 18, 1.6, 0, Math.PI * 2); x.fill();
    return (dotsPat[color] = bgx.createPattern(c, 'repeat'));
  }
  function drawState(ctx, key, t) {
    const st = PAL[key];
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = st.base; ctx.fillRect(0, 0, 1920, 1080);
    st.blobs.forEach(([col, a], i) => {
      const [x, y, r] = blobPos(i, t);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, a)); g.addColorStop(0.55, rgba(col, a * 0.45)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
    });
    ctx.fillStyle = dots(st.dots); ctx.fillRect(0, 0, 1920, 1080);
  }
  function drawBG(t) {
    let cur = START, tr = null;
    for (const k of BGK) { if (t >= k[1]) cur = k[3]; else if (t >= k[0]) { tr = k; cur = k[2]; break; } else break; }
    // overlapping windows (C3a/C3b): if a later window has started, it wins
    for (const k of BGK) if (t >= k[0] && t < k[1]) { tr = k; cur = k[2]; }
    drawState(bgx, cur, t);
    if (!tr) return;
    const [t0, t1, , to, o] = tr;
    const p = E.smooth(FILM.p(t, t0, t1));
    const far = Math.max(Math.hypot(o[0], o[1]), Math.hypot(1920 - o[0], o[1]), Math.hypot(o[0], 1080 - o[1]), Math.hypot(1920 - o[0], 1080 - o[1]));
    const w = 420, R = p * (far + w * 1.2);
    drawState(offAx, to, t);
    // organic mask: three soft circles with drifting origins → a liquid, non-circular front
    maskX.globalCompositeOperation = 'source-over'; maskX.clearRect(0, 0, 1920, 1080);
    for (let k = 0; k < 3; k++) {
      const ox = o[0] + 70 * Math.sin(k * 2.1 + t * 3), oy = o[1] + 55 * Math.cos(k * 1.7 + t * 2.4), rr = R * (1 - 0.06 * k);
      const g = maskX.createRadialGradient(ox, oy, Math.max(0, rr - w), ox, oy, Math.max(1, rr));
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      maskX.fillStyle = g; maskX.beginPath(); maskX.arc(ox, oy, Math.max(1, rr), 0, Math.PI * 2); maskX.fill();
      if (rr - w > 0) { maskX.fillStyle = '#000'; maskX.beginPath(); maskX.arc(ox, oy, rr - w, 0, Math.PI * 2); maskX.fill(); }
    }
    offAx.globalCompositeOperation = 'destination-in'; offAx.drawImage(maskC, 0, 0); offAx.globalCompositeOperation = 'source-over';
    bgx.drawImage(offA, 0, 0);
    // iridescent fringe riding the wave front (AI violet → blue → sky)
    if (p > 0 && p < 1) {
      const fr = bgx.createRadialGradient(o[0], o[1], Math.max(0, R - w * 1.05), o[0], o[1], Math.max(1, R + 40));
      const a = 0.55 * Math.sin(Math.PI * p);
      fr.addColorStop(0, 'rgba(138,92,255,0)'); fr.addColorStop(0.35, `rgba(138,92,255,${a * 0.55})`);
      fr.addColorStop(0.62, `rgba(91,108,255,${a * 0.7})`); fr.addColorStop(0.85, `rgba(62,182,255,${a * 0.5})`); fr.addColorStop(1, 'rgba(62,182,255,0)');
      bgx.globalCompositeOperation = PAL[to].base > '#8' ? 'source-over' : 'screen';
      bgx.fillStyle = fr; bgx.fillRect(0, 0, 1920, 1080); bgx.globalCompositeOperation = 'source-over';
    }
  }
  FILM.bgDarkAt = (t) => { let cur = START; for (const k of BGK) if (t >= (k[0] + k[1]) / 2) cur = k[3]; return cur[0] === 'D'; };

  let built = false, placed = false;
  function buildAll() {
    const film = document.getElementById('film');
    film.style.perspective = '2200px'; film.style.perspectiveOrigin = '50% 50%';
    const world = document.createElement('div'); world.id = 'world';
    world.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;transform-style:preserve-3d;transform-origin:0 0';
    bgc = document.createElement('canvas'); bgc.id = 'flowbg'; bgc.width = 1920; bgc.height = 1080;
    bgc.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px';
    bgx = bgc.getContext('2d');
    offA = document.createElement('canvas'); offA.width = 1920; offA.height = 1080; offAx = offA.getContext('2d');
    maskC = document.createElement('canvas'); maskC.width = 1920; maskC.height = 1080; maskX = maskC.getContext('2d');
    film.appendChild(bgc); film.appendChild(world);
    const grain = document.createElement('div'); grain.className = 'grain'; grain.style.zIndex = '5'; film.appendChild(grain);
    FILM.worldEl = world;
    FILM.scenes.sort((a, b) => a.t0 - b.t0);
    for (const s of FILM.scenes) {
      const root = document.createElement('div');
      root.className = 'scene ' + (s.world || 'dark');
      root.id = 'scene-' + s.id;
      root.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;display:none;background:transparent';   // v4: scenes are transparent
      world.appendChild(root);
      s.root = root;
      root.style.display = 'block';            // measurable during build: root at (0,0), world untransformed
      try { s.build(root); } catch (e) { FILM.errors.push(s.id + ' build: ' + e.message); console.error(s.id, e); }
      root.style.display = 'none';
    }
    built = true;
  }
  function placeAll() {                         // after build + ready (all measuring done): move scenes to their world spots
    for (const s of FILM.scenes) {
      const id = PLACE[s.id] ? s.id : (s.id === 's1' || s.id === 's2' ? 's12' : (s.id === 's89' ? 's8' : s.id));
      const p = PLACE[id] || [0, 0];
      s.root.style.left = p[0] + 'px'; s.root.style.top = p[1] + 'px';
      if (s.artboard) {                       // dark artboard on the light canvas: soft shadow + frame label above
        s.root.style.boxShadow = '0 50px 120px -40px rgba(19,20,40,.45)';
        const lab = document.createElement('div');
        lab.className = 'artboard-label';
        lab.style.cssText = `position:absolute;left:${p[0]}px;top:${p[1] - 52}px;font:500 30px/1 var(--f-mono);color:#737376;white-space:nowrap;display:none;align-items:center;gap:12px`;
        lab.innerHTML = (window.K && K.glyph ? K.glyph('frame', 30, '#737376') : '#') + s.artboard + '<span style="color:#A3A3A7;margin-left:14px">1920 × 1080</span>';
        FILM.worldEl.appendChild(lab); s.labelEl = lab;
      }
    }
    placed = true;
  }

  const only = new URLSearchParams(location.search).get('only');
  const noCam = new URLSearchParams(location.search).get('nocam');   // ?nocam=1 → scene-local framing (checks against key frames)
  window.__comp = { width: FILM.W, height: FILM.H, fps: FILM.fps, duration: FILM.dur };
  window.__seek = async (t) => {
    if (!built) { await FILM.loadFonts(); buildAll(); for (const s of FILM.scenes) if (s.ready) { try { await s.ready; } catch (e) {} } }
    if (!placed) placeAll();
    const cam = FILM.camNow = FILM.camAt(t);
    // which scene owns the frame when the camera is not used (nocam): the one whose [t0,t1) contains t
    let owner = null;
    for (const s of FILM.scenes) if (t >= s.t0 && t < s.t1) owner = s;
    if (noCam && owner) {
      const p = owner.root;
      FILM.worldEl.style.transform = `translate(${-parseFloat(p.style.left)}px,${-parseFloat(p.style.top)}px)`;
    } else {
      FILM.worldEl.style.transform = `translate(960px,540px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) rotateZ(${cam.rz}deg) scale(${cam.s}) translate(${-cam.cx}px,${-cam.cy}px)`;
    }
    drawBG(t);
    for (const s of FILM.scenes) {
      const a = s.t0 - (noCam ? 0 : (s.pre || 0)), b = s.t1 + (noCam ? 0 : (s.post || 0));
      const vis = (only ? only.split(',').indexOf(s.id) >= 0 : true) && t >= a && t < b;
      s.root.style.display = vis ? 'block' : 'none';
      if (s.labelEl) s.labelEl.style.display = vis && !noCam ? 'flex' : 'none';
      if (vis) { try { s.update(t - s.t0, t, s.root); } catch (e) { FILM.errors.push(s.id + ' update@' + t.toFixed(3) + ': ' + e.message); console.error(s.id, e); } }
    }
    if (FILM.overlay) FILM.overlay(t, document.getElementById('overlay'));
  };
  window.__errors = () => FILM.errors.slice(0, 20);
})();
