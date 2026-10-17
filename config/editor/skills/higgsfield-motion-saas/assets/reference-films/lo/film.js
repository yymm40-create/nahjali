/* LO. — 15 s launch film, 1920×1080 @30. Pure function of t: window.__seek(t) draws the 2D frame, then the WebGL lens pass.
   v3: reference palette + Windows 98 chrome, square-pixel LOGIN, red crash modal, fly-through-the-O with paper pouring in
   as code rain, and an O → meridians → wireframe sphere → dotted Earth morph. Cuts sit on the 120 BPM grid / speed peaks. */
(function () {
  const W = 1920, H = 1080, T = K.T, E = K.E, p = K.p, kf = K.kf, lerp = K.lerp, clamp = K.clamp;
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const glc = document.getElementById('g');
  const A = {}; const errors = [];
  window.__errors = () => errors;
  const FPS = 30; window.__comp = { width: W, height: H, fps: FPS, duration: 15 };

  const cam = (c, s, px, py, r = 0, dx = 0, dy = 0) => { c.translate(px + dx, py + dy); if (r) c.rotate(r); c.scale(s, s); c.translate(-px, -py); };
  const font = (w, px, fam) => `${w} ${px}px ${fam}`;
  const bell = (t, t0, d) => { const x = (t - t0) / d; return x < 0 || x > 1 ? 0 : Math.sin(Math.PI * x); };
  const glassBg = (c) => { const g = c.createRadialGradient(960, 520, 60, 960, 540, 1180); g.addColorStop(0, '#0C1446'); g.addColorStop(.55, '#060A2C'); g.addColorStop(1, '#020310'); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  const RAIN_FAR = (tr, dim = 1) => ({ x: -300, y: -300, w: W + 600, h: H + 600, pitch: 40, size: 30, fam: T.pixel, weight: 700, color: '#2C3CCB', head: '#D9E0FF', alpha: .8 * dim, seed: 3, t: tr, vmin: 80, vmax: 260, lmin: 8, lmax: 28, density: .72 });
  const RAIN_NEAR = (tr, dim = 1) => ({ x: -300, y: -300, w: W + 600, h: H + 600, pitch: 150, size: 70, fam: T.pixel, weight: 700, color: '#2434B8', head: '#B9C5FF', alpha: .5 * dim, blur: 3, seed: 5, t: tr * 1.3, vmin: 200, vmax: 420, lmin: 4, lmax: 12, density: .35 });

  /* ======================= S1 · 0.0–2.5 · 1969 terminal: "LO", crash ======================= */
  const S1 = { PX: 58, BASE: 760 };
  const s1lay = () => { const L = K.bitmapLayout('LOGIN', S1.PX); return { ...L, X0: Math.round((W - L.w) / 2) }; };
  function s1(c, t) {
    glassBg(c);
    const lay = s1lay(), X0 = lay.X0, PX = S1.PX, O = lay.chars[1];
    const Ox = X0 + (O.x0 + O.x1) / 2, Oy = S1.BASE - 3.5 * PX;
    // camera: pull out of the rain, breathe, then the needle into the O (speed peak on the cut at 2.5)
    const nd = clamp((t - 2.05) / .45), zb = t < 2.05 ? kf(t, [[0, 2.4], [.85, 1.0, 'outQ'], [2.05, 1.04, 'ioS']]) : 1.04, zoom = zb * Math.exp(Math.log(12 / 1.04) * E.inQ(nd));
    const pk = p(t, 1.92, 2.22, 'ioC'), px = lerp(960, Ox, pk), py = lerp(540, Oy, pk);
    const [tc, tx] = K.off('term', W, H);
    // blue code rain behind the glass; it freezes and dims while the system is down
    const down = t >= 1.24 && t < 1.92, tr = t < 1.24 ? t : t < 1.92 ? 1.24 : 1.24 + (t - 1.92) * 1.3, dim = down ? .4 : 1;
    tx.save(); cam(tx, Math.pow(zoom, .6), px, py); K.rain(tx, RAIN_FAR(tr, dim)); tx.restore();
    tx.save(); cam(tx, Math.pow(zoom, 1.35), px, py); K.rain(tx, RAIN_NEAR(tr, dim)); tx.restore();
    tx.save(); cam(tx, zoom, px, py, -.004 * (1 - pk));
    const step = Math.floor(t * 20), gl = t > 1.2 && t < 1.42;
    // stamp, decoded
    tx.fillStyle = T.amber; tx.font = font(500, 34, T.mono); tx.globalAlpha = .75;
    tx.fillText(K.scramble('UCLA  →  SRI', clamp((t - .12) / .55), t, 1), X0, 250);
    tx.textAlign = 'right'; tx.fillText(K.scramble('29.10.1969  ·  22:30', clamp((t - .22) / .55), t, 2), X0 + lay.w, 250); tx.textAlign = 'left'; tx.globalAlpha = 1;
    // LOGIN in square pixels: L, O… then the G corrupts
    const n = t < .42 ? 0 : t < .78 ? 1 : t < 1.12 ? 2 : t < 1.5 ? 3 : 2;
    K.bitmap(tx, 'LOGIN', X0, S1.BASE, PX, {
      color: T.amber, to: n, filter: (ci, q, r) => {
        if (ci !== 2 || t < 1.2) return {};
        const h = K.hash(q * 7.1 + r * 3.3), k = clamp((t - 1.2) / .3); if (h < k) return null;
        const j = K.hash(q + r * 9 + step * .37);
        return { dx: gl ? (j - .5) * PX * 2.2 : 0, dy: (t - 1.2) * 260 * K.hash(q * 3 + r), a: 1 - k * .6 };
      },
    });
    // the word it meant to send stays burned into the phosphor
    if (t > 1.55) K.bitmap(tx, 'LOGIN', X0, S1.BASE, PX, { color: T.amber, from: 2, alpha: .085 * clamp((t - 1.55) / .3) * (.85 + .15 * Math.sin(t * 40)) });
    // block caret made of pixels
    const caretOn = t < 1.12 ? true : t < 1.95 ? false : ((t - 1.95) % .5) < .25;
    if (caretOn && n < 5) { const cx = X0 + (n < lay.chars.length ? lay.chars[n].x0 : lay.w + PX); tx.fillStyle = T.amber; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) tx.fillRect(cx + q * PX + PX * .07, S1.BASE - 7 * PX + r * PX + PX * .07, PX * .86, PX * .86); }
    // red crash modal, dead centre: pops, shakes, blinks once, then collapses like a tube switching off
    if (t >= 1.24 && t < 2.02 && !(t > 1.44 && t < 1.52)) {
      const k = p(t, 1.24, 1.5, E.back(.16)), cl = p(t, 1.88, 2.0, 'inC'), shx = K.settle(t, 1.24, 16, 5, 9);
      tx.save(); tx.translate(960 + shx, 540); tx.scale(k * (1 - cl * .4), Math.max(.015, k * (1 - cl)));
      tx.fillStyle = T.red; tx.fillRect(-520, -140, 1040, 280);
      tx.strokeStyle = '#FFE7E3'; tx.lineWidth = 6; tx.strokeRect(-502, -122, 1004, 244);
      tx.fillStyle = '#FFF4F2'; tx.textAlign = 'center'; tx.font = font(700, 80, T.pixel); const mw = tx.measureText('SYSTEM CRASHED').width; if (mw > 900) tx.font = font(700, Math.floor(80 * 900 / mw), T.pixel);
      tx.fillText('SYSTEM CRASHED', 0, 4); tx.font = font(500, 26, T.mono); tx.globalAlpha = .9; tx.fillText('CONNECTION LOST AFTER  “LO”', 0, 72);
      tx.restore();
    }
    tx.restore();
    if (gl) { const r = K.rand(step * 13 + 1), [bc, bx] = K.off('termTear', W, H); bx.drawImage(tc, 0, 0); tx.clearRect(0, 0, W, H); for (let y = 0; y < H; y += 36) { const o = r() < .35 ? (r() - .5) * 120 : 0; tx.drawImage(bc, 0, y, W, 36, o, y + (r() < .1 ? 8 : 0), W, 36); } }
    c.drawImage(tc, 0, 0); K.bloomLayer(c, tc, { blur: 26, a1: .3, a2: .34, a3: .3 });
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = .5; c.drawImage(shadowMask(), 0, 0); c.restore();
    c.save(); c.globalCompositeOperation = 'screen'; const rg = c.createLinearGradient(300, 0, 900, 700); rg.addColorStop(0, 'rgba(210,225,255,0)'); rg.addColorStop(.45, 'rgba(210,225,255,.07)'); rg.addColorStop(.55, 'rgba(210,225,255,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H); c.restore();
  }
  let SM_ = null;
  function shadowMask() { if (SM_) return SM_; const m = document.createElement('canvas'); m.width = W; m.height = H; const x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); const cols = ['#d6c8ff', '#e8f0ff', '#b8c6ff']; for (let X = 0; X < W; X += 3) { x.fillStyle = cols[(X / 3) % 3]; x.fillRect(X, 0, 2, H); } x.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < H; y += 6) x.fillRect(0, y + ((Math.floor(y / 6) % 2) * 3), W, 1); return (SM_ = m); }

  /* ======================= S2 · 2.5–5.0 · through the O → "It started with two letters." ======================= */
  const S2 = { X0: 92, BASE: 812, FS: 690, PITCH: 18 };
  const GLB = { cx: 1210, cy: 560, R: 400 };
  function s2geom() {
    const g = K.dotText('LO', font(400, S2.FS, T.display), S2.PITCH), O = g.chars[1];
    return { g, O, ocx: S2.X0 + (O.x0 + O.x1) / 2, ocy: S2.BASE - g.asc / 2, ru: (O.x1 - O.x0) / 2 * .97, rv: g.asc / 2 };
  }
  // camera keeps flying forward after the O and settles (no reverse scale): far → rest, then a slow drift
  const S2Z = (t) => (t < 3.4 ? lerp(.26, 1, E.outQ(clamp((t - 2.5) / .9))) : 1 + .04 * p(t, 3.4, 4.25, 'ioS'));
  // the dark tube interior gives way to paper that pours down the screen in code columns
  function pour(c, t) {
    if (t >= 3.15) { K.paper(c); return; }
    glassBg(c); c.save(); cam(c, 1 + (t - 2.5) * .6, 960, 540); K.rain(c, RAIN_FAR(t + 1.3)); c.restore();
    const P = 48, n = Math.ceil(W / P), heads = [];
    c.save(); c.beginPath();
    for (let i = 0; i < n; i++) { const d = .02 + K.hash(i * 3.7) * .24 + Math.abs(i - n / 2) / n * .14, k = clamp((t - 2.5 - d) / .34), hh = (H + 220) * E.ioC(k); if (hh > 0) c.rect(i * P, -10, P + 1, hh + 10); heads.push([i * P + P / 2, hh, k]); }
    c.clip(); K.paper(c); c.restore();
    const Ah = K.atlas(T.pixel, 30, T.signal, 700), Ab = K.atlas(T.pixel, 30, T.blush, 700);
    for (const [x, y, k] of heads) { if (k <= 0 || k >= 1) continue; for (let j = 0; j < 6; j++) { c.globalAlpha = (1 - j / 6); K.glyph(c, j ? Ab : Ah, K.gidx(x, Math.floor(t * 20) + j), x, y - 14 - j * 32); } }
    c.globalAlpha = 1;
  }
  const resO = (i, dx, g) => 2.62 + .55 * K.hash(i * 1.31 + .7) + .14 * (dx / g.w);
  function s2(c, t) {
    const { g, O, ocx, ocy } = s2geom();
    pour(c, t);
    const zs = S2Z(t);
    c.save(); cam(c, Math.pow(zs, .5), ocx, ocy); K.rain(c, PAPER_RAIN(t)); c.restore();
    c.save(); cam(c, zs, ocx, ocy);
    // every printed dot starts life as a glyph and decodes into a dot; from 4.28 the O belongs to the morph
    const Lx = (i) => -1150 * E.inC(clamp((t - 4.22 - K.hash(i * .9) * .12) / .38));
    K.drawDotText(c, g, S2.X0, S2.BASE, {
      mis: [6, 5], filter: (dx, dy, cov, i) => {
        const isO = dx > O.x0 + (O.x1 - O.x0) * .02;
        if (isO && t >= 4.28) return null;
        const r0 = resO(i, dx, g); if (t < r0 + .06) return null;
        const pop = clamp((t - r0 - .06) / .14);
        return { dx: isO ? dx : dx + Lx(i), k: pop < 1 ? E.outC(pop) * 1.08 : 1 };
      },
    });
    if (t < 3.45) {
      const Ag = K.atlas(T.pixel, Math.round(S2.PITCH * 1.3), T.signal, 700), Ah = K.atlas(T.pixel, Math.round(S2.PITCH * 1.3), T.ink, 700);
      for (let i = 0; i < g.dots.length / 3; i++) {
        const dx = g.dots[i * 3], dy = g.dots[i * 3 + 1], r0 = resO(i, dx, g); if (t >= r0 + .14) continue;
        c.globalAlpha = (t < r0 ? 1 : 1 - (t - r0) / .14) * (.55 + .45 * g.dots[i * 3 + 2]);
        K.glyph(c, K.hash(i * .7) < .82 ? Ag : Ah, K.gidx(i, Math.floor(t * 22 + K.hash(i) * 5)), S2.X0 + dx, S2.BASE + dy);
      }
      c.globalAlpha = 1;
    }
    c.restore();
    // headline column with a lavender marker behind the second line (from the refs)
    const colX = S2.X0 + O.x1 + 64;
    const hx = -300 * E.inC(clamp((t - 4.18) / .35)), ha = 1 - clamp((t - 4.18) / .3);
    c.save(); c.globalAlpha = ha; c.translate(hx, 0);
    K.maskLine(c, K.scramble('29.10.1969  —  THE FIRST MESSAGE ONLINE', p(t, 2.95, 3.65, 'lin'), t, 5), colX, 405, { font: font(500, 20, T.mono), color: T.inkSoft, ls: 3 }, p(t, 2.95, 3.4, 'outQ'));
    c.font = font(400, 100, T.display); const mw = Math.max(c.measureText('It started').width, c.measureText('with two letters.').width);
    const fs = Math.min(112, Math.floor(100 * (W - colX - 60) / mw));
    c.font = font(400, fs, T.display); const l2w = c.measureText('with two letters.').width, mk = E.outC(p(t, 3.28, 3.62, 'lin'));
    if (mk > 0) { c.fillStyle = T.lav2; c.fillRect(colX - 10, 540 + fs * 1.08 - fs * .62, (l2w + 22) * mk, fs * .5); }
    K.maskLine(c, 'It started', colX, 540, { font: font(400, fs, T.display) }, p(t, 3.0, 3.55, 'outQ'));
    K.maskLine(c, 'with two letters.', colX, 540 + fs * 1.08, { font: font(400, fs, T.display) }, p(t, 3.12, 3.67, 'outQ'));
    c.restore();
    // night iris opens inside the spinning O, then floods the frame
    if (t > 4.46) { c.save(); irisPath(c, t); c.clip(); nightBg(c, t); c.restore(); }
    globeLayer(c, t);
    morph(c, t);
  }

  /* ---- O → meridians → wireframe sphere → dotted Earth ---- */
  // night opens from the centre of the O, reaches its rim, then floods the frame (one continuous radius)
  function irisPath(c, t) {
    const M = morphGeom(t), k1 = E.outC(p(t, 4.46, 4.74, 'lin')), k2 = E.inC(p(t, 4.74, 5.0, 'lin'));
    const sx = lerp(M.Rx, 2400, k2) * 1.03 * k1, sy = lerp(M.Ry, 2400, k2) * 1.03 * k1;
    c.beginPath(); c.ellipse(M.cx, M.cy, Math.max(.1, sx), Math.max(.1, sy), 0, 0, 6.2832);
  }
  function morphGeom(t) {
    const { ocx, ocy, ru, rv } = s2geom(), zs = S2Z(Math.min(t, 4.28));
    const q = p(t, 4.28, 4.85, 'ioC');
    return { q, cx: lerp(ocx, GLB.cx, q), cy: lerp(ocy, GLB.cy, q), Rx: lerp(ru * zs, GLB.R, q), Ry: lerp(rv * zs, GLB.R, q), zs };
  }
  function morph(c, t) {
    if (t < 4.28 || t > 5.32) return;
    const { g, O, ocx, ocy, ru, rv } = s2geom(), M = morphGeom(t);
    const m = p(t, 4.4, 5.0, 'ioC'), spin = .85 * p(t, 4.4, 5.32, 'ioS'), fade = 1 - p(t, 4.98, 5.32, 'ioC'), tilt = .32 * m;
    const N = 6, front = [], back = [];
    for (let k = 0; k < N; k++) {
      const phi = (k / N) * Math.PI * m + spin, cp = Math.cos(phi), sp = Math.sin(phi), ak = (k === 0 ? 1 : clamp(m * 2.2) * .75) * fade;
      for (let i = 0; i < g.dots.length; i += 3) {
        const dx = g.dots[i]; if (dx <= O.x0 + (O.x1 - O.x0) * .02) continue;
        if (k > 0 && (g.dots[i + 2] < .55 || K.hash(i * .31 + k) < .35)) continue;
        const u = (S2.X0 + dx - ocx) / ru, v = (S2.BASE + g.dots[i + 1] - ocy) / rv, cov = g.dots[i + 2];
        const x3 = u * cp, z3 = u * sp, y3 = -v, y2 = y3 * Math.cos(tilt) - z3 * Math.sin(tilt), z2 = y3 * Math.sin(tilt) + z3 * Math.cos(tilt);
        const depth = (z2 + 1) / 2, r = lerp(S2.PITCH * .48 * M.zs, k ? 3.4 : 4.4, M.q) * Math.sqrt(cov) * lerp(1, .5 + .7 * depth, m);
        (z2 >= -.02 ? front : back).push(M.cx + x3 * M.Rx, M.cy - y2 * M.Ry, r, ak);
      }
    }
    const dots = (arr, color, a, ox = 0, oy = 0) => { c.fillStyle = color; for (let i = 0; i < arr.length; i += 4) { if (arr[i + 3] * a < .02) continue; c.globalAlpha = arr[i + 3] * a; c.beginPath(); c.arc(arr[i] + ox, arr[i + 1] + oy, arr[i + 2], 0, 6.2832); c.fill(); } };
    // blue while the dots sit on paper, light where the night has opened behind them
    const pass = (light) => { const cc = light ? '#E4E8FF' : T.signal; dots(back, cc, .3); if (!light && M.q < 1) dots(front, T.ink, 1 - M.q, 6 * (1 - M.q), 5 * (1 - M.q)); dots(front, cc, 1); };
    c.save();
    if (t >= 5.0) pass(true);
    else { pass(false); if (t > 4.46) { c.save(); irisPath(c, t); c.clip(); pass(true); c.restore(); } }
    c.restore();
  }

  /* ======================= S3 · 5.0–7.5 · the world logs on ======================= */
  const ARPA = [{ lat: 34.07, lon: -118.44 }, { lat: 37.43, lon: -122.17 }, { lat: 34.41, lon: -119.85 }, { lat: 40.76, lon: -111.89 }];
  const ARPA_LINKS = [[0, 1], [0, 2], [1, 2], [1, 3]];
  const CITIES91 = [[46.23, 6.05, 1], [42.36, -71.06], [40.71, -74.0], [41.88, -87.63], [51.5, -.12], [52.37, 4.9], [59.33, 18.06], [48.85, 2.35], [52.52, 13.4], [35.68, 139.69], [43.65, -79.38], [47.6, -122.33], [30.27, -97.74], [55.75, 37.62]];
  const CITIES26 = [[-23.55, -46.63], [6.52, 3.38], [30.04, 31.24], [19.07, 72.88], [28.61, 77.2], [39.9, 116.4], [31.23, 121.47], [37.57, 126.98], [-6.2, 106.85], [-33.87, 151.2], [19.43, -99.13], [41.0, 28.98], [-1.29, 36.82], [-34.6, -58.38], [-26.2, 28.04], [25.2, 55.27], [1.35, 103.82], [13.75, 100.5], [14.6, 120.98], [-12.05, -77.04], [4.71, -74.07], [33.69, 73.05], [23.81, 90.41], [35.7, 51.39], [24.71, 46.67], [9.03, 38.74], [-4.32, 15.31], [14.72, -17.47], [33.57, -7.59], [36.75, 3.06], [45.5, -73.57], [49.28, -123.12], [21.3, -157.86], [64.15, -21.94], [60.17, 24.94], [50.45, 30.52], [38.72, -9.14], [40.42, -3.7], [41.9, 12.5], [37.98, 23.73], [-37.81, 144.96], [-41.29, 174.78], [10.82, 106.63], [22.32, 114.17], [25.03, 121.56], [43.07, 141.35], [56.84, 60.6], [55.03, 82.92], [43.24, 76.89], [41.31, 69.24], [-8.84, 13.23], [-17.83, 31.05], [5.6, -0.19], [12.97, 77.59], [13.08, 80.27], [-22.9, -43.17], [-15.79, -47.88], [-33.45, -70.67], [10.49, -66.88], [18.47, -69.9], [23.13, -82.38], [29.76, -95.37], [33.75, -84.39], [25.76, -80.19], [39.74, -104.99], [32.72, -117.16], [45.52, -122.68], [61.22, -149.9], [53.35, -6.26], [55.95, -3.19], [50.08, 14.44], [47.5, 19.04], [44.43, 26.1], [59.94, 30.31], [31.77, 35.21], [33.89, 35.5], [15.5, 32.56], [-18.88, 47.51], [-20.16, 57.5], [27.72, 85.32], [16.87, 96.2], [3.14, 101.69], [-6.79, 39.21], [0.35, 32.58], [-29.86, 31.03], [-33.92, 18.42]];
  const NODES = [];
  ARPA.forEach((n, i) => NODES.push({ ...n, t: 5.18 + i * .09, big: 1 }));
  CITIES91.forEach((c, i) => NODES.push({ lat: c[0], lon: c[1], big: c[2] ? 1 : 0, t: 5.86 + (c[2] ? 0 : .08 + i * .028) }));
  { const r = K.rand(17); CITIES26.forEach((c) => NODES.push({ lat: c[0], lon: c[1], t: 6.38 + Math.pow(r(), .8) * .7 })); }
  const ARCS = [];
  ARPA_LINKS.forEach(([a, b], i) => ARCS.push({ a: ARPA[a], b: ARPA[b], t: 5.24 + i * .08, d: .3, lift: .05 }));
  ARCS.push({ a: ARPA[1], b: { lat: 46.23, lon: 6.05 }, t: 5.86, d: .45, lift: .22 });
  { const r = K.rand(23), all = NODES.slice(4); for (let i = 0; i < 46; i++) { const a = all[Math.floor(r() * all.length)], b = all[Math.floor(r() * all.length)]; if (a === b) continue; ARCS.push({ a, b, t: 6.0 + r() * 1.05, d: .38 + r() * .2, lift: .16 }); } }
  const ERA = [{ y: '1969', cap: '4 computers', t: 5.08 }, { y: '1991', cap: 'the web goes public', t: 5.78 }, { y: '2026', cap: 'billions online', t: 6.36 }];
  function nightBg(c, t, zs = 1, px = 960, py = 540) {
    c.fillStyle = T.night; c.fillRect(0, 0, W, H);
    c.save(); cam(c, Math.pow(zs, .35), px, py); K.rain(c, { x: -300, y: -300, w: W + 600, h: H + 600, pitch: 30, size: 22, fam: T.pixel, weight: 700, color: '#2A3596', head: '#C4CCFF', alpha: 1, seed: 11, t, vmin: 50, vmax: 170, lmin: 10, lmax: 30, density: .62 }); c.restore();
    c.save(); cam(c, Math.pow(zs, .7), px, py); K.rain(c, { x: -300, y: -300, w: W + 600, h: H + 600, pitch: 150, size: 44, fam: T.pixel, weight: 700, color: '#3442B0', head: T.blush, alpha: .75, blur: 2.5, seed: 12, t: t * 1.2, vmin: 140, vmax: 300, lmin: 5, lmax: 14, density: .3 }); c.restore();
  }
  const NODE_COL = '#6F7DFF';
  const globeAt = (t) => ({ ...GLB, lon: kf(t, [[4.8, -104], [5.7, -96, 'ioC'], [6.35, -12, 'ioC'], [7.1, 14, 'outC'], [7.5, 20, 'lin']]), tilt: 18, sea: T.nightDot, land: T.nightLand, atmo: T.signal, dot: GLB.R / 88, nodeCol: NODE_COL, arcCol: T.blush, sparkCol: '#FFFFFF' });
  function globeLayer(c, t) {
    const a = p(t, 4.82, 5.15); if (a <= 0) return;
    const o = globeAt(t); o.flat = 0; o.landK = p(t, 4.95, 5.4, 'ioC'); o.alpha = a; o.sea = K.mix(T.blush, T.nightDot, o.landK); o.land = K.mix(T.lav2, T.nightLand, o.landK);
    c.save(); c.globalAlpha = a; c.fillStyle = T.night; c.beginPath(); c.arc(GLB.cx, GLB.cy, GLB.R * 1.005, 0, 6.2832); c.fill(); c.restore();
    K.globe(c, o); return o;
  }
  function s3(c, t) {
    const o = globeAt(t);
    const P = K.globeProject(o, K.ll(48.85, 2.35));
    const dv = clamp((t - 7.08) / .42), zs = (1 + .05 * clamp((t - 5) / 2.1)) * Math.exp(Math.log(9) * E.inQ(dv));
    const pk = p(t, 6.9, 7.3, 'ioC'), cpx = lerp(GLB.cx, P[0], pk), cpy = lerp(GLB.cy, P[1], pk);
    nightBg(c, t, zs, cpx, cpy);
    c.save(); cam(c, zs, cpx, cpy);
    globeLayer(c, t);
    for (const a of ARCS) if (t > a.t) K.arc(c, o, a.a, a.b, clamp((t - a.t) / a.d), a.lift, a.lift < .1 ? 2.6 : 1.8);
    for (const n of NODES) if (t > n.t) { n.age = clamp((t - n.t) / .6); K.node(c, o, n, clamp((t - n.t) / .12), t); }
    const Ap = K.atlas(T.mono, 15, '#FFFFFF', 700);
    for (const a of ARCS) {
      const k = (t - a.t) / a.d; if (k <= 0 || k >= 1) continue;
      for (let j = 0; j < 5; j++) { const s = k - j * .03; if (s <= 0) continue; const P2 = K.arcPoint(o, a.a, a.b, s, a.lift); if (!P2) continue; if (P2[2] < 0 && Math.hypot(P2[0] - o.cx, P2[1] - o.cy) < o.R) continue; c.globalAlpha = (1 - j / 5) * .95; K.glyph(c, Ap, K.gidx(j + a.t * 100, Math.floor(t * 18)), P2[0], P2[1]); }
    }
    c.globalAlpha = 1;
    const lab = (n, text, t0, dx, dy) => {
      if (t < t0) return; const P2 = K.globeProject(o, K.ll(n.lat, n.lon)); if (P2[2] < .2) return; const k = clamp((t - t0) / .4), e = E.outC(k);
      c.save(); c.globalAlpha = clamp(P2[2] * 2) * (1 - p(t, 6.85, 7.05)); c.strokeStyle = K.rgba('#FFFFFF', .7); c.lineWidth = 1.5; c.beginPath(); c.moveTo(P2[0], P2[1]); c.lineTo(P2[0] + dx * e, P2[1] + dy * e); c.stroke();
      K.text(c, K.scramble(text, k * 1.3, t, 7), P2[0] + dx + (dx < 0 ? -10 : 10), P2[1] + dy + 6, { font: font(500, 18, T.mono), color: '#FFFFFF', align: dx < 0 ? 'right' : 'left', ls: 2 }); c.restore();
    };
    lab(ARPA[0], 'UCLA → SRI', 5.3, -96, 64); lab({ lat: 46.23, lon: 6.05 }, 'CERN', 5.95, 84, -64);
    morph(c, t);
    c.restore();
    const out = 1 - p(t, 6.95, 7.2, 'inC');
    c.save(); c.globalAlpha = out;
    const ei = t < ERA[1].t ? 0 : t < ERA[2].t ? 1 : 2, e = ERA[ei];
    if (ei === 0) K.maskLine(c, e.y, 140, 590, { font: font(400, 230, T.display), color: T.cream }, p(t, 5.08, 5.5, 'outQ'));
    else K.odometer(c, ERA[ei - 1].y, e.y, p(t, e.t, e.t + .42), 140, 590, { size: 230, color: T.cream });
    K.maskLine(c, K.scramble(e.cap, p(t, e.t + .05, e.t + .6, 'lin'), t, ei), 146, 668, { font: font(500, 30, T.mono), color: T.blush, ls: 2 }, p(t, e.t + .08, e.t + .45, 'outQ'));
    c.restore();
  }

  /* ======================= S4 · 7.5–10.0 · everyone said hello (Windows 98) ======================= */
  const WINS = [
    { w: 'hello', f: T.display, x: 330, y: 255, W: 400, H: 250, z: 1.0, title: 'New Message' },
    { w: 'привет', f: T.display, x: 1565, y: 230, W: 430, H: 250, z: 1.1, title: 'Inbox (1)' },
    { w: 'hola', f: T.display, x: 255, y: 770, W: 340, H: 230, z: .84, title: 'Chat' },
    { w: 'こんにちは', f: '"Noto Serif JP", serif', x: 1610, y: 770, W: 470, H: 240, z: .9, title: 'Message', fw: 600 },
    { w: '你好', f: '"Noto Serif SC", serif', x: 710, y: 935, W: 300, H: 200, z: 1.25, title: 'Ping', fw: 600 },
    { w: 'مرحبا', f: '"Noto Naskh Arabic", serif', x: 1235, y: 955, W: 330, H: 210, z: 1.15, title: 'New Message', fw: 600 },
    { w: 'salut', f: T.display, x: 820, y: 135, W: 300, H: 190, z: 1.45, title: 'Mail' },
    { w: 'ciao', f: T.display, x: 1175, y: 120, W: 280, H: 180, z: 1.55, title: 'hi.txt' },
    { w: 'olá', f: T.display, x: 1850, y: 470, W: 330, H: 220, z: .7, title: 'Chat' },
    { w: '안녕', f: '"Noto Serif KR", serif', x: 70, y: 500, W: 330, H: 220, z: .68, title: 'DM', fw: 600 },
  ].map((w, i) => ({ ...w, ti: 7.5 + i * .024 }));
  const CONV = { x: 1218, y: 359 };
  const CLICKS = [{ i: 3, t: 8.78 }, { i: 0, t: 9.02 }, { i: 1, t: 9.2 }, { i: 2, t: 9.46 }];
  function cursorPaths(t) {
    const ax = kf(t, [[8.2, 2060], [8.5, 1660, 'outC'], [8.95, 1640, 'lin'], [9.12, 1585, 'outC']]), ay = kf(t, [[8.2, 1150], [8.5, 820, 'outC'], [8.95, 812, 'lin'], [9.12, 300, 'outC']]);
    const jit = t > 8.5 && t < 8.95 ? 1 : 0;
    const bx = kf(t, [[8.15, -90], [9.4, 300, 'ioS']]) + Math.sin(t * 3.1) * 14, by = kf(t, [[8.15, 1010], [9.4, 830, 'ioS']]) + Math.sin(t * 2.3 + 1) * 10;
    const cx = kf(t, [[8.45, 990], [8.98, 352, 'ioQ']]), cy = kf(t, [[8.45, -70], [8.98, 298, 'ioQ']]);
    return [
      { x: ax + jit * K.noise1(t * 24, 3) * 6, y: ay + jit * K.noise1(t * 24, 9) * 6, hand: 0, show: t > 8.2 },
      { x: bx, y: by, hand: 1, show: t > 8.15 },
      { x: cx, y: cy, hand: 0, show: t > 8.45 },
    ];
  }
  const PAPER_RAIN = (t) => ({ x: 0, y: -40, w: W, h: H + 80, pitch: 48, size: 18, fam: T.pixel, weight: 700, color: T.signal, head: T.ink, alpha: .07, seed: 31, t, vmin: 60, vmax: 160, lmin: 6, lmax: 18, density: .45 });
  const riseAt = (t) => 760 * (1 - E.outQ(clamp((t - 9.72) / .62))) + K.settle(t, 10.34, 16, 2.2, 7);
  function drawStreams(c, t) {
    if (t < 9.45 || t > 10.35) return; const A1 = K.atlas(T.pixel, 32, T.signal, 700), A2 = K.atlas(T.pixel, 26, T.ink, 700);
    const to = { x: CONV.x, y: CONV.y + riseAt(t) };
    WINS.forEach((w, i) => { const k = clamp((t - 9.45 - i * .025) / .72); if (k <= 0 || k >= 1) return; K.stream(c, i % 2 ? A1 : A2, { x: w.x, y: w.y }, to, k, 38, i * 13.7 + 1, { spread: 340, lift: 150, s0: 1.3, s1: .35 }); });
  }
  function s4(c, t, under) {
    if (!under) { K.paper(c); K.rain(c, PAPER_RAIN(t)); }
    const cz = t < 8.4 ? -1.35 * (1 - E.outQ(clamp((t - 7.5) / .9))) : .08 * p(t, 8.4, 9.5, 'ioC');
    const ex = E.inC(clamp((t - 9.45) / .45));
    const items = WINS.map((w, i) => ({ ...w, i })).sort((a, b) => b.z - a.z);
    let headDone = false;
    const drawHead = () => {
      const hk = 1 - p(t, 9.38, 9.62, 'inC'); c.save(); c.globalAlpha = hk; const off = (1 - hk) * -40;
      K.maskLine(c, 'Everyone', 960, 520 + off, { font: font(400, 160, T.display), align: 'center' }, p(t, 8.12, 8.62, 'outQ'));
      K.maskLine(c, 'said hello.', 960, 690 + off, { font: font(400, 160, T.display), align: 'center' }, p(t, 8.24, 8.74, 'outQ'));
      c.restore();
    };
    const lastClick = CLICKS.filter((k) => t >= k.t).pop();
    for (const w of items) {
      if (!headDone && w.z < 1.02) { drawHead(); headDone = true; }
      if (t < w.ti) continue;
      const s = w.z / Math.max(.05, w.z - cz);
      let x = 960 + (w.x - 960) * s, y = 540 + (w.y - 540) * s, sc = s;
      const pop = lerp(.6, 1, p(t, w.ti, w.ti + .45, E.back(.07)));
      const click = CLICKS.find((k) => k.i === w.i), bump = click ? bell(t, click.t, .18) : 0;
      sc *= pop * (1 - .045 * bump);
      x = lerp(x, CONV.x, ex); y = lerp(y, CONV.y, ex); sc *= lerp(1, .04, ex);
      const a = clamp((t - w.ti) / .12) * (1 - clamp((ex - .3) / .4));
      const blur = Math.abs(w.z - 1) * 6 + ex * 6, ww = w.W * sc, hh = w.H * sc;
      const active = lastClick ? lastClick.i === w.i : w.z <= 1.3;
      K.win98(c, x - ww / 2, y - hh / 2, ww, hh, {
        s: sc, title: K.scramble(w.title, p(t, w.ti, w.ti + .4, 'lin'), t, w.i), alpha: a, blur, active, flash: click && t > click.t && t < click.t + .1,
        body: (cc, bx, by, bw, bh) => {
          const ok = w.H >= 220, wy = by + bh * (ok ? .4 : .5);
          let fs = bh * (ok ? .44 : .52); cc.font = font(w.fw || 400, fs, w.f); const mw = cc.measureText(w.w).width; if (mw > bw * .8) fs *= bw * .8 / mw; cc.font = font(w.fw || 400, fs, w.f);
          cc.fillStyle = T.ink; cc.textAlign = 'center'; cc.textBaseline = 'middle'; cc.fillText(K.scramble(w.w, p(t, w.ti + .06, w.ti + .55, 'lin'), t, w.i * 3), bx + bw / 2, wy + fs * .04);
          if (ok) { const bw2 = 96 * sc, bh2 = 32 * sc; K.button98(cc, bx + bw / 2 - bw2 / 2, by + bh - bh2 - 12 * sc, bw2, bh2, 'OK', sc, click && t > click.t && t < click.t + .12); }
        },
      });
    }
    if (!headDone) drawHead();
    if (!under) drawStreams(c, t);
    for (const k of cursorPaths(t)) { if (!k.show) continue; K.cursor(c, lerp(k.x, CONV.x, ex), lerp(k.y, CONV.y, ex), { hand: k.hand, px: 5, alpha: 1 - ex, fill: '#FFFFFF', ink: '#000000' }); }
  }

  /* ======================= S5 · 10.0–12.5 · introducing LO. ======================= */
  const CRT = { s: .56, x: 800, y: 118, q: { tl: [405, 115], tr: [1074, 136], br: [1089, 703], bl: [420, 739] } };
  const scrQ = () => { const m = (v) => [CRT.x + v[0] * CRT.s, CRT.y + v[1] * CRT.s]; return { tl: m(CRT.q.tl), tr: m(CRT.q.tr), br: m(CRT.q.br), bl: m(CRT.q.bl) }; };
  function appScreen(t) {
    const SW = 1000, SH = 900, [sc, x] = K.off('app', SW, SH);
    x.fillStyle = '#1E2BE0'; x.fillRect(0, 0, SW, SH);
    K.rain(x, { x: 0, y: 0, w: SW, h: SH, pitch: 34, size: 22, fam: T.pixel, weight: 700, color: '#4553F0', head: '#C9CFFF', alpha: .7, seed: 41, t, vmin: 60, vmax: 180, lmin: 6, lmax: 20, density: .5 });
    const press = bell(t, 10.98, .14) > .2 || bell(t, 12.3, .3) > .2;
    K.win98(x, 34, 30, SW - 68, SH - 70, {
      s: 1.5, title: 'LO. Messenger', active: true, body: (c, bx, by, bw, bh) => {
        c.fillStyle = '#FFFFFF'; c.fillRect(bx + 14, by + 14, bw - 28, bh - 170); K.bevel(c, bx + 14, by + 14, bw - 28, bh - 170, 3, true);
        const sk = p(t, 11.02, 11.4, E.back(.08));
        if (t > 11.02) { c.save(); c.translate(bx + bw - 50, by + 170); c.scale(sk, sk); c.fillStyle = T.signal; c.fillRect(-250, -110, 250, 150); c.fillStyle = '#FFFFFF'; c.font = font(700, 96, T.pixel); c.textAlign = 'right'; c.fillText('LO', -34, 6); c.restore(); }
        if (t > 11.42 && t < 11.86) { c.fillStyle = T.w98; c.fillRect(bx + 50, by + 250, 170, 76); for (let i = 0; i < 3; i++) { c.fillStyle = T.inkSoft; c.globalAlpha = .35 + .65 * Math.max(0, Math.sin((t - 11.42) * 12 - i * .9)); c.fillRect(bx + 86 + i * 38, by + 280, 18, 18); } c.globalAlpha = 1; }
        const rk = p(t, 11.86, 12.24, E.back(.08));
        if (t > 11.86) { c.save(); c.translate(bx + 50, by + 250); c.scale(rk, rk); c.fillStyle = T.lav2; c.fillRect(0, 0, 600, 130); c.fillStyle = T.ink; c.font = font(400, 70, T.display); c.textBaseline = 'middle'; c.fillText(K.scramble('hello, world.', p(t, 11.9, 12.25, 'lin'), t, 9), 34, 70); c.restore(); }
        const iy = by + bh - 130; c.fillStyle = '#FFFFFF'; c.fillRect(bx + 14, iy, bw - 260, 110); K.bevel(c, bx + 14, iy, bw - 260, 110, 3, true);
        const typed = t < 10.62 ? '' : t < 10.8 ? 'L' : t < 11.02 ? 'LO' : '';
        c.fillStyle = T.ink; c.font = font(700, 64, T.pixel); c.textBaseline = 'middle'; c.fillText(typed, bx + 44, iy + 58); const tw = c.measureText(typed).width;
        if (t < 10.62 || t > 11.02 ? ((t * 2) % 1) < .5 : true) c.fillRect(bx + 48 + tw, iy + 26, 6, 62);
        K.button98(c, bx + bw - 232, iy, 218, 110, 'Send ↵', 1.6, press);
      },
    });
    x.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < SH; y += 5) x.fillRect(0, y, SW, 2);
    return sc;
  }
  function s5(c, t) {
    K.paper(c); K.rain(c, PAPER_RAIN(t));
    const rise = riseAt(t), rot = .07 * (1 - E.outC(clamp((t - 9.72) / .8)));
    const scrC = { x: CRT.x + 747 * CRT.s, y: CRT.y + 427 * CRT.s };
    const send = { x: CRT.x + (405 + (1074 - 405) * .8) * CRT.s, y: CRT.y + (115 + (739 - 115) * .86) * CRT.s };
    const pin = clamp((t - 12.1) / .4), zs = (1 + .07 * p(t, 10.3, 12.1, 'ioS')) * Math.exp(Math.log(6) * E.inQ(pin));
    const pk = p(t, 11.9, 12.3, 'ioC');
    c.save(); cam(c, zs, lerp(scrC.x, send.x, pk), lerp(scrC.y, send.y, pk));
    c.save(); const hk = 1 - p(t, 12.05, 12.3, 'inC'); c.globalAlpha = hk;
    K.maskLine(c, K.scramble('INTRODUCING  LO.', p(t, 10.15, 10.7, 'lin'), t, 4), 124, 400, { font: font(500, 24, T.mono), color: T.inkSoft, ls: 4 }, p(t, 10.15, 10.6, 'outQ'));
    K.maskLine(c, 'Now it’s', 118, 545, { font: font(400, 128, T.display) }, p(t, 10.22, 10.72, 'outQ'));
    K.maskLine(c, 'your turn.', 118, 683, { font: font(400, 128, T.display) }, p(t, 10.34, 10.84, 'outQ'));
    c.restore();
    c.save(); c.translate(scrC.x, scrC.y + 500 + rise); c.rotate(rot); c.translate(-scrC.x, -scrC.y - 500);
    const q = scrQ(), scr = appScreen(t);
    K.drawPrint(c, A.crt, CRT.x, CRT.y, CRT.s, { haloA: 1, haloOnly: true });
    c.save(); c.beginPath(); c.moveTo(q.tl[0], q.tl[1]); c.lineTo(q.tr[0], q.tr[1]); c.lineTo(q.br[0], q.br[1]); c.lineTo(q.bl[0], q.bl[1]); c.closePath(); c.fillStyle = '#060818'; c.fill(); c.restore();
    K.warp(c, scr, q, 8);
    K.drawPrint(c, A.crt, CRT.x, CRT.y, CRT.s, { haloA: 0, dotsA: .4 });
    c.save(); c.beginPath(); c.moveTo(q.tl[0], q.tl[1]); c.lineTo(q.tr[0], q.tr[1]); c.lineTo(q.br[0], q.br[1]); c.lineTo(q.bl[0], q.bl[1]); c.closePath(); c.clip();
    const sh = c.createLinearGradient(q.tl[0], q.tl[1], q.br[0], q.br[1]); sh.addColorStop(0, 'rgba(235,240,255,.18)'); sh.addColorStop(.35, 'rgba(235,240,255,.02)'); sh.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = sh; c.fillRect(0, 0, W, H); c.restore();
    if (t > 11.95) { const hx = kf(t, [[11.95, send.x + 160], [12.28, send.x + 6, 'outC']]), hy = kf(t, [[11.95, send.y + 180], [12.28, send.y - 4, 'outC']]); K.cursor(c, hx, hy, { hand: 1, px: 3.2, fill: '#FFFFFF', ink: '#000000' }); }
    c.restore();
    c.restore();
    if (t < 10.0) s4(c, t, true);
    drawStreams(c, t);
  }

  /* ======================= S6 · 12.5–15.0 · Enter → LO. ======================= */
  function s6(c, t) {
    const whip = clamp((t - 13.28) / .22);
    if (t < 13.5) {
      K.paper(c, { color: T.signal, tex: .45, screenA: .5 });
      K.rain(c, { x: 0, y: -40, w: W, h: H + 80, pitch: 52, size: 20, fam: T.pixel, weight: 700, color: '#7E89FF', head: '#FFFFFF', alpha: .2, seed: 51, t: t * 1.4, vmin: 120, vmax: 300, lmin: 6, lmax: 16, density: .5 });
      c.save(); c.filter = 'blur(10px)'; const r = K.rand(4);
      for (let i = 0; i < 9; i++) { const bx = r() * W, by = r() * H, br = 60 + r() * 140; c.globalAlpha = .16 + r() * .14; c.fillStyle = i % 2 ? T.blush : '#FFFFFF'; c.beginPath(); c.arc(bx + Math.sin(t + i) * 20, by - (t - 12.5) * 30 * (1 + r()), br, 0, 6.2832); c.fill(); }
      c.restore();
      const zs = Math.exp(Math.log(2.8) * (1 - E.outQ(clamp((t - 12.5) / .5)))) * (1 + .03 * p(t, 13.0, 13.3));
      c.save(); cam(c, zs, 960, 520, 0, 0, -1400 * E.inQ(whip));
      const press = t < 12.98 ? 0 : t < 13.06 ? E.outC((t - 12.98) / .08) : 1 - p(t, 13.18, 13.36, E.back(.12));
      const s = .56, kw = A.key.W * s, kh = A.key.H * s, kx = 960 - kw / 2, ky = 545 - kh / 2 + press * 26;
      c.save(); c.filter = `blur(${lerp(34, 20, press)}px)`; c.fillStyle = K.rgba('#000033', lerp(.45, .6, press)); c.beginPath(); c.ellipse(980, 545 + kh / 2 - 30, kw * lerp(.56, .5, press), lerp(60, 40, press), 0, 0, 6.2832); c.fill(); c.restore();
      K.drawPrint(c, A.key, kx, ky, s, { haloA: 0, dotsA: .28 });
      [[13.04, 56, 34, 0], [13.13, 40, 24, .3]].forEach(([t0, n, sz, ph]) => { const rk = clamp((t - t0) / .5); if (rk <= 0 || rk >= 1) return; const Ar = K.atlas(T.pixel, sz, '#FFFFFF', 700), R0 = lerp(240, 1250, E.outC(rk));
        for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + ph + rk * .35; c.globalAlpha = 1 - rk; K.glyph(c, Ar, K.gidx(i * 3.3 + t0, Math.floor(t * 20)), 960 + Math.cos(a) * R0, 545 + Math.sin(a) * R0 * .82, lerp(1.2, .7, rk)); } c.globalAlpha = 1; });
      const hx = kf(t, [[12.62, 1600], [12.96, 1035, 'outC']]), hy = kf(t, [[12.62, 1220], [12.96, 628, 'outC']]) + press * 26;
      if (t > 12.62) K.cursor(c, hx, hy, { hand: 1, px: 10, fill: '#FFFFFF', ink: '#000000' });
      c.restore();
      return;
    }
    K.paper(c); K.rain(c, PAPER_RAIN(t));
    const up = 520 * (1 - E.outQ(clamp((t - 13.5) / .5))), zs = 1 + .025 * p(t, 13.9, 15, 'ioS');
    c.save(); cam(c, zs, 960, 540, 0, 0, up);
    const g = K.dotText('LO.', font(400, 440, T.display), 15), x0 = 960 - g.w / 2, base = 640;
    const r6 = (dx, i) => 13.45 + (dx / g.w) * .3 + K.hash(i * 1.9) * .3, FALL = .42;
    K.drawDotText(c, g, x0, base, { mis: [6, 5], filter: (dx, dy, cov, i) => { const k = clamp((t - r6(dx, i) - FALL) / .12); if (k <= 0) return null; return { k: E.outC(k) * (1 + .1 * Math.sin(Math.PI * k)) }; } });
    if (t < 14.4) {
      const Ag = K.atlas(T.pixel, 18, T.signal, 700);
      for (let i = 0; i < g.dots.length / 3; i++) {
        const dx = g.dots[i * 3], dy = g.dots[i * 3 + 1], s = (t - r6(dx, i)) / FALL; if (s <= 0 || s >= 1.12) continue;
        const fall = (1 - E.outQ(Math.min(1, s))) * 640, a = s > 1 ? 1 - (s - 1) / .12 : clamp(s * 4);
        for (let j = 0; j < 3; j++) { c.globalAlpha = a * (1 - j * .32); K.glyph(c, Ag, K.gidx(i + j, Math.floor(t * 20)), x0 + dx, base + dy - fall - j * 20 * (1 - Math.min(1, s))); }
      }
      c.globalAlpha = 1;
    }
    // lavender marker sweeps under the tagline (from the refs)
    c.font = font(400, 84, T.display); const tw = c.measureText('Say it first.').width, mk = E.outC(p(t, 13.95, 14.3, 'lin'));
    if (mk > 0) { c.fillStyle = T.lav2; c.fillRect(960 - tw / 2 - 16, 790 - 46, (tw + 32) * mk, 40); }
    K.maskLine(c, 'Say it first.', 960, 790, { font: font(400, 84, T.display), align: 'center' }, p(t, 14.0, 14.5, 'outQ'));
    K.maskLine(c, K.scramble('LAUNCHING  29.10', p(t, 14.2, 14.75, 'lin'), t, 6), 960, 872, { font: font(500, 24, T.mono), align: 'center', color: T.inkSoft, ls: 5 }, p(t, 14.2, 14.6, 'outQ'));
    const dotX = x0 + g.chars[2].x0 + (g.chars[2].x1 - g.chars[2].x0) / 2;
    if (t > 14.15) { const cx = kf(t, [[14.15, 1500], [14.55, dotX + 6, 'outQ']]), cy = kf(t, [[14.15, 1000], [14.55, base - 22, 'outQ']]); K.cursor(c, cx, cy, { px: 5, scale: 1 - .1 * bell(t, 14.6, .16), fill: '#FFFFFF', ink: '#000000' }); }
    c.restore();
  }

  /* ======================= frame ======================= */
  const CUTS = [[2.5, 1], [7.5, .9], [12.5, .8], [13.5, .7]];
  const glitchAt = (t) => CUTS.reduce((m, [c0, a]) => Math.max(m, a * Math.max(0, 1 - Math.abs(t - c0) / .07)), 0);
  const LENS = (t) => {
    if (t < 2.5) return { k: .2, round: .1, ca: 1.3, scan: .32, vig: .7, grain: .07, flick: (t > 1.22 && t < 1.42 && Math.floor(t * 30) % 3 === 0) ? .08 : 0 };
    if (t < 5.0) return { k: .035, ca: .8, vig: .3, grain: .05 };
    if (t < 7.5) return { k: .05, ca: 1.0, vig: .55, grain: .06 };
    return { k: .035, ca: .8, vig: .3, grain: .05 };
  };
  async function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    try {
      if (t < 2.5) s1(ctx, t);
      else if (t < 5.0) s2(ctx, t);
      else if (t < 7.5) s3(ctx, t);
      else if (t < 9.72) s4(ctx, t);
      else if (t < 12.5) s5(ctx, t);
      else s6(ctx, t);
      if (t >= 4.8 && t < 7.5) K.post(ctx, { bloom: .32 * p(t, 4.8, 5.1), bloomR: 22 });
      if (t >= 9.72 && t < 12.5) K.post(ctx, { bloom: .1, bloomR: 30 });
    } catch (e) { errors.push(t.toFixed(2) + ': ' + e.message); }
    K.lens(cv, { ...LENS(t), glitch: glitchAt(t), seed: Math.floor(t * FPS) * 7.13 });
  }
  window.__seek = async (t) => { await ready; await draw(t); };
  const ready = (async () => {
    await K.loadFonts();
    const base = '../assets/';
    const [crt, key, land] = await Promise.all([K.img(base + 'crt_cut.png'), K.img(base + 'enter_cut.png'), K.img(base + 'land.png')]);
    K.initGlobe(land, 9000);
    A.crt = K.makePrint('crt', crt, { pitch: 13, haloPitch: 20, haloBlur: 70, haloCol: T.signal, floor: .1 });
    A.key = K.makePrint('key', key, { pitch: 12, haloPitch: 18, haloBlur: 50, haloCol: '#FFFFFF', floor: .08 });
    K.lensInit(glc);
  })();
  window.__ready = ready;
})();
