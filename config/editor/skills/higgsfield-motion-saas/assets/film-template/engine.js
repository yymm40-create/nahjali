/* FILM — deterministic timeline engine for code-built launch films (DOM/CSS/SVG scenes; canvas allowed inside scenes).
   Distilled from the Strata / Reroll / Kadra / Halftone / BLIP. / LO. films (Oct 2026).

   Contract with scripts/code/capture.mjs:
     window.__comp = {width, height, fps, duration}; window.__seek(t) draws frame t — a PURE function of t
     (no rAF clocks, no CSS transitions/animations, no Date.now, no Math.random: use FILM.rand(seed)).
     window.__errors() → scene errors ("SCENE ERRORS" in capture logs); window.__qa() → cut checks; window.__cues → sound cues.
   Motion grammar (higgsfield-motion-saas): the speed peak sits ON the cut; zoom direction (sign of d ln s/dt) never flips across a
   cut; overlap the next move at ≈0.45 of the current; extra motion on a parent wrapper (the "null"); bounce only on object
   entrances; nothing important appears or vanishes by opacity alone — it is carried, grown, pushed, wiped or cut.
   Query: ?only=s1,s2 (subset; ?only=none = background only) · ?nocam=1 · ?t=3.2 (open at a time, for a browser preview). */
(function () {
  const Q = new URLSearchParams(location.search);
  const FILM = window.FILM = { W: 1920, H: 1080, fps: 30, dur: 15, scenes: [], errors: [], cuts: [], cues: [],
    fonts: [], CAM: [], BG: null, nocam: Q.has('nocam') };

  /* ---------------- math ---------------- */
  const clamp = FILM.clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = FILM.lerp = (a, b, p) => a + (b - a) * p;
  FILM.p = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
  FILM.rand = (seed) => { let s = (seed >>> 0) || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  FILM.hash = (x) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  FILM.TQ = (t) => Math.round(t * FILM.fps) / FILM.fps;   // quantise DISCRETE events (typed chars, swaps) so sub-frame blur never doubles them

  /* ---------------- easing ---------------- */
  const bez = (x1, y1, x2, y2) => (x) => {                 // CSS cubic-bezier(x1,y1,x2,y2)
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 28; i++) { const cx = 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3; if (cx < x) lo = u; else hi = u; u = (lo + hi) / 2; }
    return 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
  };
  const E = FILM.E = {
    lin: (p) => p,
    in: (k = 3) => (p) => p ** k,                   // accelerate INTO a cut — speed max at p=1 (end slope k·Δ/T)
    out: (k = 3) => (p) => 1 - (1 - p) ** k,        // decelerate OUT of a cut — speed max at p=0 (start slope k·Δ/T)
    inOut: (k = 3) => (p) => (p < .5 ? (2 * p) ** k / 2 : 1 - (2 - 2 * p) ** k / 2),
    // in-scene (smooth) curves — the client hated "резко": use these for everything that does not hide a cut
    soft: bez(.16, 1, .3, 1),        // entrances: long expo-like settle (= expoOut)
    smooth: bez(.5, 0, .1, 1),       // pose → pose with a long settle
    glide: bez(.45, 0, .55, 1),      // drifts, camera, cursors (sine-like)
    sine: bez(.37, 0, .63, 1),
    // transition curves (AE speed/influence recipes as beziers)
    expoIn: bez(.7, 0, .84, 0),      // swing / whip out of a scene
    needle: bez(.95, 0, .05, 1),     // SM.zoomAtCut (influence 95/95): put the midpoint on the cut
    into: bez(.5, 0, .85, .625),     // still accelerating on the cut frame (SM.scrollInto)
    settle: bez(.2, .7, .05, 1),     // after a cut (SM.settleAfterCut ≈ .35/.66/.80/.88 at +0.1…0.4 s on 1.2 s)
    morph1: bez(.66, 0, .9, .1),     // UI morph outgoing card (+18 % into the cut)
    morph2: bez(.07, .44, .16, 1),   // UI morph incoming card (from −18 %)
    width: bez(.75, 0, .25, 1),      // entrance width / button spin
    back: (s = 1.2) => (p) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2,   // ≤2–5 % overshoot, chips/pills only
    bez,
  };
  FILM.tw = (t, t0, t1, a, b, e) => a + (b - a) * (e || E.lin)(FILM.p(t, t0, t1));
  // keyframes [[t, v], [t, v, easeIntoThisKey], …]; numbers or arrays
  FILM.kf = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i], [t0, v0] = keys[i - 1];
      if (t <= t1) { const q = (e || E.smooth)(FILM.p(t, t0, t1)); return Array.isArray(v0) ? v0.map((a, j) => a + (v1[j] - a) * q) : v0 + (v1 - v0) * q; }
    }
    return keys[keys.length - 1][1];
  };
  // zoom in LOG space (equal ratios feel equal): scale a→b; with E.in(k) the speed peaks at the end, with E.out(k) at the start
  FILM.zoom = (t, t0, t1, a, b, e) => Math.exp(lerp(Math.log(a), Math.log(b), (e || E.smooth)(FILM.p(t, t0, t1))));
  // needle zoom around a cut (SM.zoomAtCut): keys at cut−h and cut+h−1f so the largest per-frame step lands on (cut−1f, cut)
  FILM.needle = (t, cut, a, b, h = .2) => FILM.zoom(t, cut - h, cut + h - 1 / FILM.fps, a, b, E.needle);
  // springs / settles (entrances only; never on a move that hides a cut)
  FILM.pop = (t, t0, d = .5) => { const x = (t - t0) / d; if (x <= 0) return 0; if (x >= 1) return 1; return 1 - Math.exp(-6.5 * x) * Math.cos(10.5 * x); };   // ≈6 % overshoot
  FILM.soft = (t, t0, d = .6) => { const x = t - t0; if (x <= 0) return 0; if (x >= d) return 1; const k = 7 / d; return 1 - (1 + k * x) * Math.exp(-k * x); }; // no overshoot
  FILM.bounce = (dt, v, amp = .0375, freq = 1.8, decay = 3.2) => (dt <= 0 ? 0 : v * amp * Math.sin(freq * dt * 2 * Math.PI) / Math.exp(decay * dt)); // AE inertial bounce
  // SM.entrance: linear rise at v px/s, then the inertial bounce; returns the Y offset (px) at dt seconds after start
  FILM.rise = (dt, dist, v = 1860) => { const T = dist / v; if (dt < 0) return dist; if (dt < T) return dist * (1 - dt / T); return -FILM.bounce(dt - T, v); };
  FILM.settleShake = (t, t0, amp = 16, hz = 5, decay = 9) => (t < t0 ? 0 : amp * Math.sin((t - t0) * hz * 2 * Math.PI) * Math.exp(-(t - t0) * decay));

  /* ---------------- type ---------------- */
  FILM.type = (s, t, t0, cps = 30) => s.slice(0, clamp(Math.floor((FILM.TQ(t) - t0) * cps + 1e-6), 0, s.length));
  // human cadence: per-character times between T0 and T1 (longer after spaces/commas), seeded
  FILM.cadence = (s, T0, T1, seed = 4242) => {
    const r = FILM.rand(seed), d = [];
    for (let i = 1; i < s.length; i++) { let v = .55 + .9 * r(); if (s[i] === ' ' || s[i - 1] === ',') v *= 1.3; d.push(v); }
    const sum = d.reduce((a, b) => a + b, 0) || 1, out = [T0]; d.forEach((v, i) => out.push(out[i] + v / sum * (T1 - T0))); return out;
  };
  FILM.typedN = (times, t) => { t = FILM.TQ(t); let n = 0; while (n < times.length && times[n] <= t + 1e-6) n++; return n; };
  FILM.caretOn = (t, tEnd, hz = 2) => (t < tEnd ? 1 : (Math.floor((t - tEnd) * hz * 2) % 2 === 0 ? 1 : 0));
  // decoding / scramble text (mono fonts keep the layout stable): k 0→1
  const SCR = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+<>/\\=';
  FILM.scramble = (s, k, t, seed = 0) => {
    if (k >= 1) return s; if (k <= 0) return ''; let out = '';
    for (let i = 0; i < s.length; i++) {
      const th = i / s.length * .55 + FILM.hash(i * 1.7 + seed) * .25;
      out += s[i] === ' ' ? ' ' : k >= th + .2 ? s[i] : k >= th ? SCR[Math.floor(FILM.hash(i * 9.1 + Math.floor(t * 28) + seed) * SCR.length)] : ' ';
    }
    return out;
  };

  /* ---------------- DOM helpers ---------------- */
  FILM.el = (tag, css, parent, html) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  // glyphs that rise out of their own baseline mask; negative insets so the clip never cuts ascenders/descenders
  FILM.glyphs = (parent, text) => [...text].map((ch) => {
    const w = FILM.el('span', 'display:inline-block;clip-path:inset(-60% -30% -0.14em -30%)', parent);
    return FILM.el('span', 'display:inline-block;will-change:transform', w, ch === ' ' ? '&nbsp;' : ch);
  });
  FILM.riseGlyphs = (els, t, t0, st = .035, d = .55, dist = 110) => els.forEach((e, i) => {
    const q = E.soft(FILM.p(t, t0 + i * st, t0 + i * st + d)); e.style.transform = `translateY(${(1 - q) * dist}%)`;
  });
  FILM.drawOn = (path, p) => { if (!path.__len) { path.__len = path.getTotalLength(); path.style.strokeDasharray = path.__len + ' ' + path.__len; } path.style.strokeDashoffset = path.__len * (1 - clamp(p)); };
  FILM.tf = (o) => `translate(${o.x || 0}px,${o.y || 0}px) rotate(${o.r || 0}deg) scale(${o.s == null ? 1 : o.s})`;
  // scale about a pivot (px,py) in 1920×1080 space: use as a parent wrapper's transform (the "null")
  FILM.about = (px, py, s, dx = 0, dy = 0, r = 0) => `translate(${px + dx}px,${py + dy}px) rotate(${r}deg) scale(${s}) translate(${-px}px,${-py}px)`;
  // directional motion blur for DOM layers (SVG feGaussianBlur x/y). Returns (el, bx, by) => void.
  let defs = null, nf = 0;
  FILM.dirBlur = () => {
    if (!defs) { const svg = FILM.el('div', 'position:absolute;width:0;height:0', document.body, '<svg width="0" height="0"><defs></defs></svg>'); defs = svg.querySelector('defs'); }
    const id = 'db' + (nf++), NS = 'http://www.w3.org/2000/svg', f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id); f.setAttribute('x', '-30%'); f.setAttribute('y', '-30%'); f.setAttribute('width', '160%'); f.setAttribute('height', '160%');
    const g = document.createElementNS(NS, 'feGaussianBlur'); f.appendChild(g); defs.appendChild(f);
    return (el, bx, by) => { if (bx < .3 && by < .3) { el.style.filter = 'none'; return; } g.setAttribute('stdDeviation', bx.toFixed(2) + ' ' + by.toFixed(2)); el.style.filter = `url(#${id})`; };
  };

  /* ---------------- scenes ---------------- */
  // def: { id, t0, t1, pre, post, build(root), update(lt, t, root), zoom?(lt) }   lt = t − t0 (may be <0 or >dur inside pre/post)
  // zoom(lt): the scene's dominant scale (camera-like) — __qa() checks its log-slope across every cut.
  FILM.scene = (def) => { FILM.scenes.push(def); FILM.cuts.push(def.t0); };
  FILM.cue = (name, t, kind = 'sfx') => FILM.cues.push({ name, t: +t.toFixed(4), kind });   // for the soundtrack (sound_kit reads __cues)

  /* ---------------- camera (in-scene depth only; neutral in transition windows) ---------------- */
  // FILM.CAM = [{t0,t1,a:{cx,cy,s,rx,ry,rz},b:{…},ease}]; world transform = translate(960,540) rot… scale translate(−cx,−cy)
  FILM.cs = (o) => Object.assign({ cx: 960, cy: 540, s: 1, rx: 0, ry: 0, rz: 0 }, o || {});
  FILM.camAt = (t) => {
    const C = FILM.CAM; if (!C.length || FILM.nocam) return FILM.cs();
    let g = C.find((c) => t >= c.t0 && t < c.t1); if (!g) g = t < C[0].t0 ? { a: C[0].a, b: C[0].a, t0: 0, t1: 1 } : { a: C[C.length - 1].b, b: C[C.length - 1].b, t0: 0, t1: 1 };
    const q = (g.ease || E.glide)(FILM.p(t, g.t0, g.t1)), a = FILM.cs(g.a), b = FILM.cs(g.b), o = {};
    for (const k in a) o[k] = a[k] + (b[k] - a[k]) * q; return o;
  };

  /* ---------------- living background (mesh gradient that floods from the point of action) ---------------- */
  // FILM.BG = { states: { L0: {base:'#F3F3F7', blobs:[['#E2DCFF',.9], …4], dots:'rgba(19,20,21,.10)'|null}, … },
  //             start: 'L0', flows: [[t0, t1, 'L0', 'D1', [ox, oy]], …], fringe: ['#8A5CFF','#5B6CFF','#3EB6FF'] }
  let bgc, bgx, offA, offAx, maskC, maskX;
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; };
  const blobPos = (i, t) => { const fx = [.18, .82, .3, .72][i % 4], fy = [.22, .3, .8, .76][i % 4]; return [FILM.W * fx + 140 * Math.sin(t * (.21 + i * .05) + i * 1.7), FILM.H * fy + 90 * Math.cos(t * (.17 + i * .04) + i * 2.3), 820 + 60 * i]; };
  function drawState(ctx, key, t) {
    const st = FILM.BG.states[key]; ctx.fillStyle = st.base; ctx.fillRect(0, 0, FILM.W, FILM.H);
    (st.blobs || []).forEach(([c, a], i) => { const [x, y, r] = blobPos(i, t), g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(c, a)); g.addColorStop(.55, rgba(c, a * .45)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, FILM.W, FILM.H); });
    if (st.dots) { ctx.fillStyle = st.dots; for (let y = 18; y < FILM.H; y += 36) for (let x = 18; x < FILM.W; x += 36) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 6.2832); ctx.fill(); } }
  }
  function drawBG(t) {
    const B = FILM.BG; if (!B) return;
    let cur = B.start, tr = null;
    for (const f of B.flows) { if (t >= f[1]) cur = f[3]; else if (t >= f[0]) { tr = f; cur = f[2]; } }
    drawState(bgx, cur, t); if (!tr) return;
    const [t0, t1, , to, o] = tr, p = E.smooth(FILM.p(t, t0, t1)), w = 420;
    const far = Math.max(...[[0, 0], [FILM.W, 0], [0, FILM.H], [FILM.W, FILM.H]].map(([x, y]) => Math.hypot(x - o[0], y - o[1])));
    const R = p * (far + w * 1.2);
    drawState(offAx, to, t); maskX.clearRect(0, 0, FILM.W, FILM.H);
    for (let k = 0; k < 3; k++) {                       // organic front: union of 3 wobbling soft circles
      const ox = o[0] + 70 * Math.sin(k * 2.1 + t * 3), oy = o[1] + 55 * Math.cos(k * 1.7 + t * 2.4), rr = R * (1 - .06 * k);
      const g = maskX.createRadialGradient(ox, oy, Math.max(0, rr - w), ox, oy, Math.max(1, rr));
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); maskX.fillStyle = g; maskX.beginPath(); maskX.arc(ox, oy, Math.max(1, rr), 0, 6.3); maskX.fill();
    }
    offAx.globalCompositeOperation = 'destination-in'; offAx.drawImage(maskC, 0, 0); offAx.globalCompositeOperation = 'source-over';
    bgx.drawImage(offA, 0, 0);
    if (B.fringe) {                                      // iridescent fringe riding the front
      const a = .55 * Math.sin(Math.PI * p), fr = bgx.createRadialGradient(o[0], o[1], Math.max(0, R - w * 1.05), o[0], o[1], R + 40), [c1, c2, c3] = B.fringe;
      fr.addColorStop(0, rgba(c1, 0)); fr.addColorStop(.35, rgba(c1, a * .55)); fr.addColorStop(.62, rgba(c2, a * .7)); fr.addColorStop(.85, rgba(c3, a * .5)); fr.addColorStop(1, rgba(c3, 0));
      bgx.globalCompositeOperation = lum(B.states[to].base) < .35 ? 'screen' : 'source-over'; bgx.fillStyle = fr; bgx.fillRect(0, 0, FILM.W, FILM.H); bgx.globalCompositeOperation = 'source-over';
    }
  }

  /* ---------------- fonts ---------------- */
  // FILM.fonts = ['800 100px "Inter Tight"', '500 100px "Inter"', …] — every face/weight the film uses.
  // document.fonts.ready alone resolves too early (before a face is used) → layouts measured with fallback metrics drift.
  FILM.loadFonts = async () => {
    try { await Promise.all(FILM.fonts.map((f) => document.fonts.load(f, 'Aa Яя 0123 ×→✦'))); } catch (e) { FILM.errors.push('fonts: ' + e.message); }
    await document.fonts.ready;
  };

  /* ---------------- QA: zoom direction + speed across cuts ---------------- */
  window.__qa = () => {
    const out = [], d = 1 / FILM.fps, sc = FILM.scenes.filter((s) => s.zoom);
    for (let i = 1; i < FILM.scenes.length; i++) {
      const A = FILM.scenes[i - 1], B = FILM.scenes[i], c = B.t0; if (!A.zoom || !B.zoom) continue;
      const va = (Math.log(A.zoom(c - A.t0 - d)) - Math.log(A.zoom(c - A.t0 - 2 * d))) / d;     // log-slope on the last frames of A
      const vb = (Math.log(B.zoom(d)) - Math.log(B.zoom(0))) / d;                                // and the first frames of B
      const flip = Math.abs(va) > .3 && Math.abs(vb) > .3 && Math.sign(va) !== Math.sign(vb);
      out.push(`cut ${c.toFixed(2)} ${A.id}→${B.id}: dlns/dt ${va.toFixed(2)} → ${vb.toFixed(2)}${flip ? '  ✗ ZOOM DIRECTION FLIPS' : ''}`);
    }
    return out.length ? out : [`no zoom() on adjacent scenes (${sc.length} scenes define zoom)`];
  };

  /* ---------------- start ---------------- */
  FILM.start = async (opts = {}) => {
    Object.assign(FILM, opts);
    await FILM.loadFonts();
    const film = document.getElementById('film'), world = document.getElementById('world');
    film.style.cssText += `;width:${FILM.W}px;height:${FILM.H}px`;
    if (FILM.BG) {
      bgc = document.getElementById('bg'); bgc.width = FILM.W; bgc.height = FILM.H; bgx = bgc.getContext('2d');
      const mk = () => { const c = document.createElement('canvas'); c.width = FILM.W; c.height = FILM.H; return [c, c.getContext('2d')]; };
      [offA, offAx] = mk(); [maskC, maskX] = mk();
    }
    const only = Q.get('only'), keep = only ? only.split(',') : null;
    FILM.scenes.sort((a, b) => a.t0 - b.t0); FILM.cuts = FILM.scenes.map((s) => s.t0).filter((t) => t > 0);
    for (const s of FILM.scenes) {
      s.skip = keep && !keep.includes(s.id);
      s.root = FILM.el('div', `position:absolute;left:0;top:0;width:${FILM.W}px;height:${FILM.H}px;transform-style:preserve-3d`, world);
      if (s.skip) { s.root.style.display = 'none'; continue; }
      try { s.build && s.build(s.root); } catch (e) { FILM.errors.push(s.id + ' build: ' + e.message); }   // root visible → layout is measurable
      s.root.style.display = 'none';
    }
    // hard cuts = boundaries where neither side overlaps (no post on the outgoing, no pre on the incoming scene)
    const hard = FILM.scenes.filter((s, i) => i > 0 && !s.pre && !FILM.scenes[i - 1].post && s.t0 > 0).map((s) => s.t0);
    window.__cues = { cuts: FILM.cuts, hard, cues: FILM.cues };
    window.__seek = async (t) => {
      t = clamp(t, 0, FILM.dur - 1e-4);
      const c = FILM.camAt(t);
      world.style.transform = `translate(${FILM.W / 2}px,${FILM.H / 2}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg) scale(${c.s}) translate(${-c.cx}px,${-c.cy}px)`;
      FILM.camNow = c;
      drawBG(t);
      for (const s of FILM.scenes) {
        if (s.skip) continue;
        const vis = t >= s.t0 - (s.pre || 0) && t < s.t1 + (s.post || 0);
        s.root.style.display = vis ? 'block' : 'none';
        if (vis) { try { s.update(t - s.t0, t, s.root); } catch (e) { const m = s.id + '@' + t.toFixed(2) + ': ' + e.message; if (FILM.errors.length < 30 && !FILM.errors.includes(m)) FILM.errors.push(m); } }
      }
      const g = document.getElementById('grain');               // grain seeded per FRAME: every sub-frame of a frame shares it
      if (g) { const r = FILM.rand(Math.round(t * FILM.fps) * 7919 + 13); g.style.transform = `translate(${Math.round(r() * 200 - 100)}px,${Math.round(r() * 200 - 100)}px)`; }
    };
    window.__errors = () => FILM.errors;
    window.__comp = { width: FILM.W, height: FILM.H, fps: FILM.fps, duration: FILM.dur };
    if (Q.has('t')) window.__seek(parseFloat(Q.get('t')));
  };
})();
