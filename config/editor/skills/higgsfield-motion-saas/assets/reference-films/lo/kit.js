/* LO. — launch film kit. One passport (tokens) + pure draw functions: printed paper, halftone dot-glyphs with riso
   misregistration, OS windows, pixel cursors, a dot-matrix globe with nodes/arcs, a phosphor CRT terminal, halftone
   photo prints with a printed glow, quad warp for the CRT screen and a WebGL lens pass (barrel, chroma, vignette,
   scanlines, grain). Every draw is a pure function of its params, so stills and film share one code path. */
(function () {
  const K = window.K = {};

  /* ---------------- passport ---------------- */
  K.T = {
    // palette taken from the references (Windows 98 vibe): paper white, ink, electric blue, lavender, system grey; red only for errors
    paper: '#F1F0EB', paper2: '#E4E3DC', cream: '#FAFAFC', ink: '#0F0F12', inkSoft: '#3A3A44',
    signal: '#2230F5', blush: '#A89BF7', lav2: '#D9D3FF', amber: '#C9D6FF', amberHot: '#F2F5FF', glass: '#04061C',
    night: '#070B2E', nightDot: '#1A237E', nightLand: '#E8ECFF', red: '#E3241D',
    w98: '#C0C0C0', w98l: '#DFDFDF', w98d: '#808080', t98a: '#0B1ACF', t98b: '#5A6CFF',
    display: '"Gloock", "Noto Serif", serif', pixel: '"Silkscreen", monospace', mono: '"Martian Mono", monospace', ui: '"Pixelify Sans", sans-serif',
    cjk: '"Noto Serif JP", "Noto Serif SC", "Noto Serif KR", serif', arab: '"Noto Naskh Arabic", serif', deva: '"Noto Serif Devanagari", serif',
  };
  const T = K.T;
  K.loadFonts = async () => {
    const f = ['400 100px "Gloock"', '400 100px "Silkscreen"', '700 100px "Silkscreen"', '500 40px "Pixelify Sans"', '700 40px "Pixelify Sans"', '500 40px "Martian Mono"', '700 40px "Martian Mono"', '400 40px "Noto Serif"',
      '600 60px "Noto Serif JP"', '600 60px "Noto Serif SC"', '600 60px "Noto Serif KR"', '600 60px "Noto Naskh Arabic"', '600 60px "Noto Serif Devanagari"'];
    try { await Promise.all(f.map((x) => document.fonts.load(x, 'LOGIN hello привет cześć 1969 2026 こんにちは 你好 안녕 مرحبا नमस्ते'))); } catch (e) {}
    await document.fonts.ready;
  };

  /* ---------------- math + easing ---------------- */
  const clamp = K.clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = K.lerp = (a, b, p) => a + (b - a) * p;
  K.sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  K.rand = (seed) => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const hex = K.hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); };
  K.mix = (a, b, p) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p))).toString(16).padStart(2, '0')).join(''); };
  K.rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
  const E = K.E = {
    lin: (x) => x,
    inC: (x) => x * x * x, outC: (x) => 1 - Math.pow(1 - x, 3), ioC: (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inQ: (x) => x * x * x * x * x, outQ: (x) => 1 - Math.pow(1 - x, 5), ioQ: (x) => (x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
    outX: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)), inX: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    ioS: (x) => (x < .5 ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2 : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2),
    // back-out with a controlled overshoot (elements only, never headlines / logo)
    back: (o = .08) => { const s = 1.70158 * (o / .1) ** .55 * 1.0; return (x) => { const u = x - 1; return 1 + u * u * ((s + 1) * u + s); }; },
    // damped spring settle (UI-object entrance, higgsfield-motion-saas SM.entrance: amp .0375, freq 1.8, decay 3.2 per second)
    spring: (x, amp = .06, freq = 2.2, decay = 5) => 1 - Math.cos(x * freq * 6.2832) * Math.exp(-x * decay) * (1 - x * 0) * (amp > 0 ? 1 : 0),
  };
  const ef = (e) => (typeof e === 'function' ? e : E[e] || E.outC);
  const p = K.p = (t, t0, t1, e = 'outC') => ef(e)(clamp((t - t0) / Math.max(1e-6, t1 - t0)));
  K.tw = (t, t0, t1, a, b, e) => lerp(a, b, p(t, t0, t1, e));
  // keyframes [[t, v, easeInto], …]
  K.kf = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) { const [t1, v1, e] = keys[i], [t0, v0] = keys[i - 1]; if (t <= t1) return lerp(v0, v1, p(t, t0, t1, e || 'ioC')); }
    return keys[keys.length - 1][1];
  };
  // settle: inertial bounce after an arrival at t0 (y offset multiplier, decays to 0)
  K.settle = (t, t0, amp = 1, freq = 2.4, decay = 6.5) => { const x = t - t0; if (x < 0) return 0; return amp * Math.sin(x * freq * 6.2832) * Math.exp(-x * decay); };
  // hash noise for deterministic jitter
  K.hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  K.noise1 = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(K.hash(i + seed * 57), K.hash(i + 1 + seed * 57), u) * 2 - 1; };

  /* ---------------- offscreen pool ---------------- */
  const pool = {};
  const off = K.off = (key, w, h, keep) => {
    let c = pool[key]; if (!c) { c = pool[key] = document.createElement('canvas'); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d', { willReadFrequently: false });
    if (!keep) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.shadowBlur = 0; x.clearRect(0, 0, w, h); }
    return [c, x];
  };
  K.roundRect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
  K.img = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  const tint = K.tint = (src, key, color) => { const [c, x] = off(key, src.width, src.height); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; };

  /* ---------------- printed paper ---------------- */
  let paperTile = null;
  const makePaper = () => {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const im = x.createImageData(S, S), r = K.rand(7);
    // low-frequency mottling (value noise) + fine tooth
    const g = 32, gr = []; for (let i = 0; i < (g + 1) * (g + 1); i++) gr.push(r());
    const vn = (u, v) => { const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, a = gr[(j % g) * (g + 1) + (i % g)], b = gr[(j % g) * (g + 1) + ((i + 1) % g)], cc = gr[((j + 1) % g) * (g + 1) + (i % g)], d = gr[((j + 1) % g) * (g + 1) + ((i + 1) % g)]; const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv); return lerp(lerp(a, b, su), lerp(cc, d, su), sv); };
    for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
      const m = vn(X / S * 8, y / S * 8) * .6 + vn(X / S * 24, y / S * 24) * .4, tooth = r();
      const v = 128 + (m - .5) * 34 + (tooth - .5) * 26; const k = (y * S + X) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    // fibres
    x.lineCap = 'round';
    for (let i = 0; i < 520; i++) { const px = r() * S, py = r() * S, a = r() * 6.28, l = 6 + r() * 26; x.strokeStyle = r() < .5 ? 'rgba(90,80,60,.22)' : 'rgba(255,255,250,.35)'; x.lineWidth = .6 + r() * .8; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + .6) * l * .5, py + Math.sin(a + .6) * l * .5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    // ink specks
    for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(30,25,20,${.15 + r() * .3})`; x.beginPath(); x.arc(r() * S, r() * S, .4 + r() * 1.2, 0, 6.28); x.fill(); }
    return c;
  };
  K.paper = (ctx, o = {}) => {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save(); ctx.fillStyle = o.color || T.paper; ctx.fillRect(0, 0, W, H);
    if (!paperTile) paperTile = makePaper();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = o.tex == null ? .55 : o.tex;
    const s = o.scale || 1, ox = (o.ox || 0) % (1024 * s), oy = (o.oy || 0) % (1024 * s);
    for (let y = -1024 * s + oy; y < H; y += 1024 * s) for (let x = -1024 * s + ox; x < W; x += 1024 * s) ctx.drawImage(paperTile, x, y, 1024 * s, 1024 * s);
    if (o.screen !== false) {
      if (!K._scr) { const c = document.createElement('canvas'); c.width = c.height = 240; const x = c.getContext('2d'); x.fillStyle = 'rgba(20,20,40,.11)'; for (let y = 0; y < 240; y += 6) for (let X = (y / 6) % 2 ? 3 : 0; X < 240; X += 6) { x.beginPath(); x.arc(X, y, 1.15, 0, 6.2832); x.fill(); } K._scr = c; }
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = o.screenA == null ? .55 : o.screenA; ctx.fillStyle = ctx.createPattern(K._scr, 'repeat'); ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };
  // fine dot screen over a flat colour field (night / signal grounds)
  K.dotField = (ctx, o) => {
    const W = ctx.canvas.width, H = ctx.canvas.height, P = o.pitch || 24, r = o.r || 1.6;
    ctx.save(); ctx.fillStyle = o.color; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.beginPath();
    const ox = ((o.ox || 0) % P + P) % P, oy = ((o.oy || 0) % P + P) % P;
    for (let y = oy - P; y < H + P; y += P) for (let x = ox - P; x < W + P; x += P) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
    ctx.fill(); ctx.restore();
  };

  /* ---------------- halftone dot glyphs (the film's signature) ----------------
     text → coverage grid at `pitch` px; drawn as round "printed pixels" with an ink plate misregistered under the colour plate */
  const glyphCache = {};
  K.dotText = (text, font, pitch) => {
    const key = text + '|' + font + '|' + pitch; if (glyphCache[key]) return glyphCache[key];
    const [mc, m] = off('dtMeasure', 8, 8); m.font = font; const mt = m.measureText(text);
    const asc = Math.ceil(mt.actualBoundingBoxAscent), dsc = Math.ceil(mt.actualBoundingBoxDescent), w = Math.ceil(mt.width), l = Math.ceil(mt.actualBoundingBoxLeft);
    const pad = pitch * 2, W = w + l + pad * 2, H = asc + dsc + pad * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
    x.font = font; x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.fillText(text, pad + l, pad + asc);
    const d = x.getImageData(0, 0, W, H).data, dots = [];
    for (let gy = pitch / 2; gy < H; gy += pitch) for (let gx = pitch / 2; gx < W; gx += pitch) {
      let s = 0, n = 0; const r = pitch * .5;
      for (let yy = Math.floor(gy - r); yy < gy + r; yy += 2) for (let xx = Math.floor(gx - r); xx < gx + r; xx += 2) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; s += d[(yy * W + xx) * 4 + 3]; n++; }
      const cov = n ? s / n / 255 : 0; if (cov > .06) dots.push(gx - pad - l, gy - pad - asc, cov);
    }
    // per-character x ranges (for splitting L / O)
    const chars = []; let cx = 0; for (const ch of text) { const cw = m.measureText(ch).width; chars.push({ ch, x0: cx, x1: cx + cw }); cx += cw; }
    return (glyphCache[key] = { dots, w, asc, dsc, pitch, chars });
  };
  // draw dot-glyph with baseline-left at (x, y). o: {color, ink, mis:[dx,dy], r, alpha, filter(dx,dy,cov,i)->{k, dx, dy} }
  K.drawDotText = (ctx, g, x, y, o = {}) => {
    const P = g.pitch, R = (o.r || .48) * P, sc = o.scale || 1;
    const plates = [];
    if (o.ink !== false) plates.push({ col: o.ink || T.ink, dx: (o.mis || [5, 4])[0], dy: (o.mis || [5, 4])[1], a: o.inkA == null ? 1 : o.inkA });
    plates.push({ col: o.color || T.signal, dx: 0, dy: 0, a: 1 });
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    for (const pl of plates) {
      ctx.fillStyle = pl.col; ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * pl.a; ctx.beginPath();
      for (let i = 0; i < g.dots.length; i += 3) {
        let dx = g.dots[i], dy = g.dots[i + 1], cov = g.dots[i + 2], k = 1;
        if (o.filter) { const f = o.filter(dx, dy, cov, i / 3); if (!f) continue; k = f.k == null ? 1 : f.k; if (f.dx != null) dx = f.dx; if (f.dy != null) dy = f.dy; }
        const rr = R * Math.sqrt(cov) * k * sc; if (rr < .3) continue;
        const px = x + dx * sc + pl.dx, py = y + dy * sc + pl.dy; ctx.moveTo(px + rr, py); ctx.arc(px, py, rr, 0, 6.2832);
      }
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------------- "inside the system": glyph atlas, code rain, decode, code streams ---------------- */
  const CH = K.CH = '0123456789ABCDEF<>/{}[]=+*#$%&@?!:;LOGINXYZ█░▒|_~^';
  const atlases = {};
  K.atlas = (fam, size, color, weight = 500) => {
    const key = fam + size + color + weight; if (atlases[key]) return atlases[key];
    const cell = Math.ceil(size * 1.3), c = document.createElement('canvas'); c.width = cell * CH.length; c.height = cell; const x = c.getContext('2d');
    x.font = `${weight} ${size}px ${fam}`; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < CH.length; i++) x.fillText(CH[i], i * cell + cell / 2, cell / 2 + size * .04);
    return (atlases[key] = { c, cell, n: CH.length });
  };
  K.glyph = (ctx, A, gi, x, y, s = 1) => { const i = ((gi % A.n) + A.n) % A.n, d = A.cell * s; ctx.drawImage(A.c, i * A.cell, 0, A.cell, A.cell, x - d / 2, y - d / 2, d, d); };
  const gidx = K.gidx = (a, b) => Math.floor(K.hash(a * 12.9898 + b * 78.233) * 997);
  // falling columns of glyphs. o: {x,y,w,h,pitch,size,fam,color,head,alpha,seed,t,vmin,vmax,lmin,lmax,density,blur}
  K.rain = (ctx, o) => {
    const Ab = K.atlas(o.fam || T.mono, o.size, o.color, o.weight), Ah = K.atlas(o.fam || T.mono, o.size, o.head || o.color, o.weight);
    const cell = o.size * (o.lh || 1.12), cols = Math.ceil(o.w / o.pitch) + 1, X0 = o.x == null ? 0 : o.x, Y0 = o.y == null ? 0 : o.y, Hh = o.h;
    let dst = ctx;
    if (o.blur) { const [, bx] = K.off('rainB', ctx.canvas.width, ctx.canvas.height); bx.setTransform(ctx.getTransform()); dst = bx; }
    dst.save();
    for (let i = 0; i < cols; i++) {
      const r = K.rand((o.seed || 1) * 977 + i * 131 + 7); r(); const v = lerp(o.vmin || 120, o.vmax || 380, r()), L = Math.floor(lerp(o.lmin || 6, o.lmax || 24, r())), off = r() * 4000;
      if (r() > (o.density == null ? .8 : o.density)) continue;
      const span = Hh + L * cell * 2, yh = ((o.t * v + off) % span) - L * cell + Y0, hc = Math.floor(yh / cell), cx = X0 + i * o.pitch + o.pitch / 2;
      for (let j = 0; j < L; j++) {
        const cy = (hc - j) * cell; if (cy < Y0 - cell || cy > Y0 + Hh + cell) continue;
        const a = j === 0 ? 1 : Math.pow(1 - j / L, 1.5) * .8;
        const gi = gidx(i + (o.seed || 0) * 3.3, (hc - j) * 1.37 + Math.floor(o.t * (j === 0 ? 16 : 2.5) + K.hash(i * 3.1 + j) * 9));
        dst.globalAlpha = (o.alpha == null ? 1 : o.alpha) * a; K.glyph(dst, j === 0 ? Ah : Ab, gi, cx, cy);
      }
    }
    dst.restore();
    if (o.blur) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = `blur(${o.blur}px)`; ctx.drawImage(dst.canvas, 0, 0); ctx.restore(); }
  };
  // decode a string: final chars resolve left → right through random glyphs (layout stays stable in monospace)
  const SCR = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=<>/|';
  K.scramble = (s, k, t, seed = 0) => {
    const a = [...s]; if (k >= 1) return s; if (k <= 0) return '';
    let out = '';
    for (let i = 0; i < a.length; i++) {
      const th = i / a.length * .55 + K.hash(i * 1.7 + seed) * .25;
      if (a[i] === ' ') out += ' '; else if (k >= th + .2) out += a[i]; else if (k >= th) out += SCR[Math.floor(K.hash(i * 9.1 + Math.floor(t * 28) + seed) * SCR.length)]; else out += ' ';
    }
    return out;
  };
  // a stream of glyphs flowing along a bent path from → to; k = 0..1 progress
  K.stream = (ctx, A, from, to, k, n, seed, o = {}) => {
    const spread = o.spread == null ? 260 : o.spread, lift = o.lift == null ? 160 : o.lift;
    for (let i = 0; i < n; i++) {
      const s = clamp((k - i / n * .55) / .45); if (s <= 0 || s >= 1) continue; const e = E.inC(s);
      const cx = (from.x + to.x) / 2 + (K.hash(seed + i * .37) - .5) * spread, cy = (from.y + to.y) / 2 - lift * (K.hash(seed * 3 + i) - .3);
      const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cx + e * e * to.x, y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cy + e * e * to.y;
      ctx.globalAlpha = Math.sin(Math.PI * s) * (o.alpha == null ? 1 : o.alpha); K.glyph(ctx, A, gidx(seed + i, Math.floor(s * 14)), x, y, lerp(o.s0 || 1, o.s1 || .45, e));
    }
    ctx.globalAlpha = 1;
  };
  // point on a lifted great-circle arc (for packets riding the links)
  K.arcPoint = (o, a, b, s, lift = .18) => {
    const A2 = K.ll(a.lat, a.lon), B2 = K.ll(b.lat, b.lon), om = Math.acos(clamp(A2[0] * B2[0] + A2[1] * B2[1] + A2[2] * B2[2], -1, 1)); if (om < 1e-3) return null;
    const w1 = Math.sin((1 - s) * om) / Math.sin(om), w2 = Math.sin(s * om) / Math.sin(om), h = lift * Math.min(1, om / 1.2) + .03, e = 1 + h * Math.sin(Math.PI * s);
    return K.globeProject(o, [(A2[0] * w1 + B2[0] * w2) * e, (A2[1] * w1 + B2[1] * w2) * e, (A2[2] * w1 + B2[2] * w2) * e]);
  };

  /* ---------------- square-pixel bitmap font (5×7 terminal) ---------------- */
  const BM = {
    L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
    O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXXX'],
    I: ['XXX', '.X.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
    N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
  };
  K.bitmapLayout = (s, px) => { let x = 0; const chars = []; for (const ch of s) { const w = BM[ch][0].length * px; chars.push({ ch, x0: x, x1: x + w }); x += w + px; } return { chars, w: x - px }; };
  // o: {color, alpha, from, to (char range), sq (square fill 0..1), filter(ci, col, row) -> {dx, dy, a} | null}
  K.bitmap = (ctx, s, x, base, px, o = {}) => {
    const lay = K.bitmapLayout(s, px), sq = (o.sq == null ? .86 : o.sq) * px, pad = (px - sq) / 2, top = base - 7 * px;
    ctx.save(); ctx.fillStyle = o.color || T.ink; const A0 = o.alpha == null ? 1 : o.alpha;
    lay.chars.forEach((c, ci) => {
      if (ci < (o.from || 0) || ci >= (o.to == null ? 99 : o.to)) return; const g = BM[c.ch];
      for (let r = 0; r < 7; r++) for (let q = 0; q < g[r].length; q++) {
        if (g[r][q] !== 'X') continue; let dx = 0, dy = 0, a = 1;
        if (o.filter) { const f = o.filter(ci, q, r); if (!f) continue; dx = f.dx || 0; dy = f.dy || 0; a = f.a == null ? 1 : f.a; }
        ctx.globalAlpha = A0 * a; ctx.fillRect(x + c.x0 + q * px + pad + dx, top + r * px + pad + dy, sq, sq);
      }
    });
    ctx.restore(); return lay;
  };

  /* ---------------- Windows 98 chrome ---------------- */
  K.bevel = (ctx, x, y, w, h, b, inset) => {
    const tl = inset ? T.w98d : '#FFFFFF', br = inset ? '#FFFFFF' : '#000000', tl2 = inset ? '#000000' : T.w98l, br2 = inset ? T.w98l : T.w98d;
    ctx.fillStyle = tl; ctx.fillRect(x, y, w, b); ctx.fillRect(x, y, b, h);
    ctx.fillStyle = br; ctx.fillRect(x, y + h - b, w, b); ctx.fillRect(x + w - b, y, b, h);
    ctx.fillStyle = tl2; ctx.fillRect(x + b, y + b, w - 2 * b, b); ctx.fillRect(x + b, y + b, b, h - 2 * b);
    ctx.fillStyle = br2; ctx.fillRect(x + b, y + h - 2 * b, w - 2 * b, b); ctx.fillRect(x + w - 2 * b, y + b, b, h - 2 * b);
  };
  K.button98 = (ctx, x, y, w, h, label, s = 1, pressed) => {
    ctx.fillStyle = T.w98; ctx.fillRect(x, y, w, h); K.bevel(ctx, x, y, w, h, Math.max(1, 2 * s), pressed);
    if (label) { ctx.fillStyle = '#000'; ctx.font = `600 ${Math.round(h * .5)}px ${T.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2 + (pressed ? s : 0), y + h / 2 + (pressed ? s : 0)); }
  };
  // o: {s (scale), title, alpha, blur, active, flash, tb, body(ctx,bx,by,bw,bh), ok}
  K.win98 = (ctx, x, y, w, h, o = {}) => {
    const s = o.s || 1, b = Math.max(1, 2 * s), tb = o.tb || 34 * s;
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; if (o.blur > .3) ctx.filter = `blur(${o.blur}px)`;
    ctx.fillStyle = 'rgba(10,12,40,.22)'; ctx.fillRect(x + 9 * s, y + 11 * s, w, h);
    ctx.fillStyle = T.w98; ctx.fillRect(x, y, w, h); K.bevel(ctx, x, y, w, h, b);
    const tx = x + 3 * b, ty = y + 3 * b, tw = w - 6 * b;
    const g = ctx.createLinearGradient(tx, 0, tx + tw, 0);
    if (o.flash) { g.addColorStop(0, T.blush); g.addColorStop(1, T.lav2); }
    else if (o.active === false) { g.addColorStop(0, T.w98d); g.addColorStop(1, '#B5B5B5'); }
    else { g.addColorStop(0, T.t98a); g.addColorStop(1, T.t98b); }
    ctx.fillStyle = g; ctx.fillRect(tx, ty, tw, tb);
    if (o.title) { ctx.fillStyle = o.active === false ? '#D4D4D4' : '#FFFFFF'; ctx.font = `700 ${Math.round(tb * .56)}px ${T.ui}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(o.title, tx + tb * .32, ty + tb / 2 + s); }
    const bs = tb * .74, by0 = ty + (tb - bs) / 2;
    ['x', 'm', '_'].forEach((gl, i) => {
      const bx = tx + tw - (i + 1) * (bs + 2 * s) - (i === 0 ? 0 : 2 * s); K.button98(ctx, bx, by0, bs, bs * .88, '', s * .7);
      ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, 1.8 * s); ctx.beginPath(); const cx = bx + bs / 2, cy = by0 + bs * .44, q = bs * .2;
      if (gl === 'x') { ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx + q, cy - q); ctx.lineTo(cx - q, cy + q); }
      else if (gl === 'm') { ctx.rect(cx - q, cy - q, 2 * q, 2 * q); ctx.moveTo(cx - q, cy - q + s); ctx.lineTo(cx + q, cy - q + s); }
      else { ctx.moveTo(cx - q, cy + q); ctx.lineTo(cx + q * .3, cy + q); }
      ctx.stroke();
    });
    ctx.filter = 'none';
    const bx = x + 3 * b, by = ty + tb + 2 * b, bw = w - 6 * b, bh = h - (by - y) - 3 * b;
    if (o.body) { ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip(); o.body(ctx, bx, by, bw, bh); ctx.restore(); }
    ctx.restore();
  };

  /* ---------------- text helpers ---------------- */
  K.text = (ctx, s, x, y, o = {}) => {
    ctx.save(); ctx.font = o.font; ctx.fillStyle = o.color || T.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha; if (o.ls) ctx.letterSpacing = o.ls + 'px';
    ctx.fillText(s, x, y); ctx.restore();
  };
  // line revealed by a rising mask (headline entrance, never overshoots)
  K.maskLine = (ctx, s, x, y, o, k) => {
    if (k <= 0) return; const fs = parseFloat(o.font.match(/(\d+(\.\d+)?)px/)[1]);
    ctx.save(); ctx.beginPath(); ctx.rect(x - (o.align === 'center' ? 2000 : o.align === 'right' ? 4000 : 20), y - fs * 1.05, 4200, fs * 1.38); ctx.clip();
    K.text(ctx, s, x, y + (1 - k) * fs * 1.1, o); ctx.restore();
  };

  /* ---------------- OS window (own design: cream sheet, ink keyline, hard offset shadow, pinstripe title bar) ---------------- */
  K.win = (ctx, x, y, w, h, o = {}) => {
    const tb = o.tb || Math.max(30, Math.min(54, h * .2)), lw = o.lw || 3, sh = o.shadow == null ? 10 : o.shadow, bar = o.bar || T.signal;
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.blur) ctx.filter = `blur(${o.blur}px)`;
    ctx.fillStyle = o.shadowCol || T.ink; ctx.fillRect(x + sh, y + sh, w, h);
    ctx.fillStyle = o.fill || T.cream; ctx.fillRect(x, y, w, h);
    // title bar: pinstripes
    ctx.fillStyle = bar; ctx.fillRect(x, y, w, tb);
    ctx.fillStyle = K.mix(bar, '#000000', .28); for (let yy = y + 7; yy < y + tb - 5; yy += 6) ctx.fillRect(x + 8, yy, w - 16, 2);
    // title label + close box
    const cb = tb * .52; ctx.fillStyle = bar; ctx.fillRect(x + 14, y + (tb - cb) / 2 - 3, cb + 8, cb + 6);
    ctx.fillStyle = o.fill || T.cream; ctx.fillRect(x + 18, y + (tb - cb) / 2, cb, cb); ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.strokeRect(x + 18, y + (tb - cb) / 2, cb, cb);
    if (o.title) {
      const fsz = Math.round(tb * .4); ctx.font = `600 ${fsz}px ${T.mono}`; const tw = ctx.measureText(o.title).width + fsz * 1.4;
      ctx.fillStyle = bar; ctx.fillRect(x + w / 2 - tw / 2, y + 4, tw, tb - 8);
      ctx.fillStyle = T.cream; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.title, x + w / 2, y + tb / 2 + 1);
    }
    ctx.fillStyle = T.ink; ctx.fillRect(x, y + tb - lw / 2, w, lw);
    ctx.strokeStyle = T.ink; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h);
    ctx.filter = 'none';
    if (o.body) { ctx.save(); ctx.beginPath(); ctx.rect(x + lw, y + tb, w - lw * 2, h - tb - lw); ctx.clip(); o.body(ctx, x, y + tb, w, h - tb); ctx.restore(); }
    ctx.restore();
  };

  /* ---------------- pixel cursors (own bitmaps) ---------------- */
  const ARROW = ['X', 'XX', 'XoX', 'XooX', 'XoooX', 'XooooX', 'XoooooX', 'XooooooX', 'XoooooooX', 'XooooooooX', 'XoooooXXXXX', 'XooXooX', 'XoX XooX', 'XX  XooX', 'X    XooX', '     XooX', '      XX'];
  const HAND = ['     XX', '    XooX', '    XooX', '    XooX', '    XooXXX', '    XooXooXXX', '    XooXooXooXX', ' XX XooXooXooXoX', 'XooXXooooooooXoX', 'XoooXoooooooooooX', ' XooXoooooooooooX', '  XoXoooooooooooX', '  XoooooooooooooX', '   XooooooooooooX', '   XoooooooooooX', '    XooooooooooX', '    XoooooooooX', '     XoooooooX', '     XXXXXXXXX'];
  K.cursor = (ctx, x, y, o = {}) => {
    const bm = o.hand ? HAND : ARROW, px = o.px || 5, fill = o.fill || T.cream, ink = o.ink || T.ink;
    const ox = o.hand ? -6 * px : 0, oy = 0;
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.shadow !== false) { ctx.fillStyle = K.rgba(T.ink, .25); for (let j = 0; j < bm.length; j++) for (let i = 0; i < bm[j].length; i++) if (bm[j][i] !== ' ') ctx.fillRect(ox + i * px + px * 1.4, oy + j * px + px * 1.8, px, px); }
    for (let j = 0; j < bm.length; j++) for (let i = 0; i < bm[j].length; i++) { const c = bm[j][i]; if (c === ' ') continue; ctx.fillStyle = c === 'X' ? ink : fill; ctx.fillRect(ox + i * px, oy + j * px, px + .5, px + .5); }
    ctx.restore();
  };

  /* ---------------- dot-matrix globe ---------------- */
  let GP = null; // [x,y,z,land] unit sphere
  K.initGlobe = (landImg, N = 9000) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(landImg, 0, 0, 1024, 512);
    const d = x.getImageData(0, 0, 1024, 512).data; GP = new Float32Array(N * 4); const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const yy = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - yy * yy), th = ga * i, X = Math.cos(th) * r, Z = Math.sin(th) * r;
      const lat = Math.asin(yy), lon = Math.atan2(X, Z); const L0 = -4 * Math.PI / 180, u = Math.floor(((((lon - L0) / (2 * Math.PI)) % 1 + 1) % 1) * 1023), v = Math.floor((.5 - lat / Math.PI) * 511);
      GP[i * 4] = X; GP[i * 4 + 1] = yy; GP[i * 4 + 2] = Z; GP[i * 4 + 3] = d[(v * 1024 + u) * 4] > 127 ? 1 : 0;
    }
  };
  // lat/lon (deg) → unit vector in the same frame as GP (lon measured with atan2(X,Z))
  const ll = K.ll = (lat, lon) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; };
  const rot = (v, ry, rx) => { const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx); let x = v[0] * cy - v[2] * sy, z = v[0] * sy + v[2] * cy, y = v[1]; const y2 = y * cx - z * sx, z2 = y * sx + z * cx; return [x, y2, z2]; };
  K.globeProject = (o, v) => { const r = rot(v, o.lon * Math.PI / 180, (o.tilt || 0) * Math.PI / 180); return [o.cx + r[0] * o.R, o.cy - r[1] * o.R, r[2]]; };
  // o: {cx, cy, R, lon, tilt, flat (0..1: 1 = uniform disc of dots), land, sea, dot, alpha, landK, nodes:[{lat,lon,k}], arcs:[{a,b,k,h}]}
  K.globe = (ctx, o) => {
    if (!GP) return; const R = o.R, flat = o.flat || 0, dot = o.dot || R / 62, N = GP.length / 4;
    const ry = o.lon * Math.PI / 180, rx = (o.tilt || 0) * Math.PI / 180, cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    // atmosphere
    if (o.atmo) { const g = ctx.createRadialGradient(o.cx, o.cy, R * .92, o.cx, o.cy, R * 1.28); g.addColorStop(0, K.rgba(o.atmo, .0)); g.addColorStop(.12, K.rgba(o.atmo, .22 * (1 - flat))); g.addColorStop(1, K.rgba(o.atmo, 0)); ctx.fillStyle = g; ctx.fillRect(o.cx - R * 1.4, o.cy - R * 1.4, R * 2.8, R * 2.8); }
    const land = [], sea = [];
    for (let i = 0; i < N; i++) {
      const X = GP[i * 4], Y = GP[i * 4 + 1], Z = GP[i * 4 + 2];
      let x = X * cy - Z * sy, z = X * sy + Z * cy; const y2 = Y * cx - z * sx, z2 = Y * sx + z * cx;
      if (z2 < -0.02) continue;
      const depth = Math.sqrt(Math.max(0, z2)), rr = dot * lerp(.35 + .65 * depth, 1, flat);
      const px = o.cx + x * R, py = o.cy - y2 * R;
      (GP[i * 4 + 3] ? land : sea).push(px, py, rr, depth);
    }
    const lk = o.landK == null ? 1 : o.landK;
    ctx.fillStyle = o.sea; ctx.beginPath(); for (let i = 0; i < sea.length; i += 4) { const r = sea[i + 2] * lerp(1, .55, lk); ctx.moveTo(sea[i] + r, sea[i + 1]); ctx.arc(sea[i], sea[i + 1], r, 0, 6.2832); } ctx.fill();
    ctx.fillStyle = K.mix(o.sea, o.land, lk); ctx.beginPath(); for (let i = 0; i < land.length; i += 4) { const r = land[i + 2] * lerp(1, 1.05, lk); ctx.moveTo(land[i] + r, land[i + 1]); ctx.arc(land[i], land[i + 1], r, 0, 6.2832); } ctx.fill();
    ctx.restore();
  };
  // glowing node + ignition ring
  let glowSpr = null;
  const glow = () => { if (glowSpr) return glowSpr; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return (glowSpr = c); };
  K.glowDot = (ctx, x, y, r, color, a = 1) => { const s = tint(glow(), 'glow_' + color, color); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.drawImage(s, x - r, y - r, r * 2, r * 2); ctx.restore(); };
  K.node = (ctx, o, n, k, t) => {
    const P = K.globeProject(o, ll(n.lat, n.lon)); if (P[2] < .05 || k <= 0) return;
    const f = clamp(P[2] * 1.6), r = (n.big ? 7 : 4.5) * (.6 + .4 * f) * (o.R / 420);
    // ignition ring
    const age = n.age == null ? 1 : n.age; if (age < .9) { ctx.save(); ctx.strokeStyle = K.rgba(o.nodeCol || T.signal, (1 - age / .9) * .9 * f); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P[0], P[1], r + age * 46 * (o.R / 420), 0, 6.2832); ctx.stroke(); ctx.restore(); }
    K.glowDot(ctx, P[0], P[1], r * 7 * k, o.nodeCol || T.signal, .55 * f);
    ctx.save(); ctx.globalAlpha = f * k; ctx.fillStyle = T.amberHot; ctx.beginPath(); ctx.arc(P[0], P[1], r * .55, 0, 6.2832); ctx.fill(); ctx.fillStyle = o.nodeCol || T.signal; ctx.beginPath(); ctx.arc(P[0], P[1], r, 0, 6.2832); ctx.globalAlpha = f * k * .6; ctx.fill(); ctx.restore();
  };
  // great-circle arc lifted above the surface; k = draw progress 0..1, fade = tail fade
  K.arc = (ctx, o, a, b, k, lift = .18, width = 2.2) => {
    if (k <= 0) return; const A = ll(a.lat, a.lon), B = ll(b.lat, b.lon); const dot = clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1), om = Math.acos(dot); if (om < 1e-3) return;
    const n = 40, pts = []; const h = lift * Math.min(1, om / 1.2) + .03;
    for (let i = 0; i <= n; i++) { const s = i / n; const w1 = Math.sin((1 - s) * om) / Math.sin(om), w2 = Math.sin(s * om) / Math.sin(om); const v = [A[0] * w1 + B[0] * w2, A[1] * w1 + B[1] * w2, A[2] * w1 + B[2] * w2]; const e = 1 + h * Math.sin(Math.PI * s); pts.push(K.globeProject(o, [v[0] * e, v[1] * e, v[2] * e]), s); }
    const head = k, tail = Math.max(0, k - .55);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = width * (o.R / 420);
    for (let i = 0; i < pts.length - 2; i += 2) {
      const P0 = pts[i], s0 = pts[i + 1], P1 = pts[i + 2], s1 = pts[i + 3]; if (s1 > head || s0 < tail) continue;
      // hide segments behind the globe disc
      const vis = (P0[2] > -.15 || Math.hypot(P0[0] - o.cx, P0[1] - o.cy) > o.R) ? 1 : 0; if (!vis) continue;
      const a2 = clamp((s0 - tail) / .25) * (o.arcA == null ? 1 : o.arcA);
      ctx.strokeStyle = K.rgba(o.arcCol || T.signal, .9 * a2); ctx.beginPath(); ctx.moveTo(P0[0], P0[1]); ctx.lineTo(P1[0], P1[1]); ctx.stroke();
    }
    // spark at the head
    if (k < 1) { const i = Math.min(n, Math.floor(head * n)) * 2; const P = pts[i]; if (P) K.glowDot(ctx, P[0], P[1], 26 * (o.R / 420), o.sparkCol || T.amber, .9); }
    ctx.restore();
  };

  /* ---------------- odometer (Gloock digits rolling inside a clip) ---------------- */
  K.odometer = (ctx, from, to, k, x, y, o) => {
    const fs = o.size, font = `400 ${fs}px ${T.display}`; ctx.save(); ctx.font = font; ctx.fillStyle = o.color; ctx.textBaseline = 'alphabetic';
    let cx = x; const lh = fs * 1.02;
    for (let i = 0; i < to.length; i++) {
      const a = +from[i], b = +to[i], ch = to[i], w = ctx.measureText(ch).width * 1.0;
      const steps = a === b ? 0 : ((b - a + 10) % 10) + (o.extra || 0) * 10; const kk = clamp((k - i * .06) / (1 - .06 * (to.length - 1)));
      const pos = steps * ef('ioQ')(kk);
      ctx.save(); ctx.beginPath(); ctx.rect(cx - 10, y - fs * .82, w + 20, fs * 1.0); ctx.clip();
      for (let j = Math.floor(pos) - 1; j <= Math.ceil(pos) + 1; j++) { const dg = ((a + j) % 10 + 10) % 10, yy = y + (j - pos) * -lh; if (Math.abs(yy - y) > lh * 1.2) continue; ctx.fillText(String(dg), cx, yy); }
      ctx.restore(); cx += w + (o.track || 0);
    }
    ctx.restore();
  };

  /* ---------------- photo prints: halftone overlay + printed glow ---------------- */
  // returns {base (graded photo), dots (ink halftone layer), halo (printed glow dots)}; cached per key
  const prints = {};
  K.makePrint = (key, img, o = {}) => {
    if (prints[key]) return prints[key];
    const W = img.width, H = img.height, pitch = o.pitch || 12, ang = (o.angle == null ? 45 : o.angle) * Math.PI / 180;
    const [sc, s] = off('prSample_' + key, W, H); s.drawImage(img, 0, 0); const d = s.getImageData(0, 0, W, H).data;
    const dots = document.createElement('canvas'); dots.width = W; dots.height = H; const dx = dots.getContext('2d'); dx.fillStyle = o.ink || T.ink; dx.beginPath();
    const ca = Math.cos(ang), sa = Math.sin(ang), ext = Math.hypot(W, H);
    for (let v = -ext; v < ext; v += pitch) for (let u = -ext; u < ext; u += pitch) {
      const x = W / 2 + u * ca - v * sa, y = H / 2 + u * sa + v * ca; if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = (Math.floor(y) * W + Math.floor(x)) * 4; if (d[k + 3] < 128) continue;
      const lum = (d[k] * .3 + d[k + 1] * .59 + d[k + 2] * .11) / 255, dark = Math.pow(clamp((1 - lum - (o.floor || .12)) / (1 - (o.floor || .12))), o.gamma || .9);
      const r = pitch * .56 * Math.sqrt(dark); if (r < .35) continue; dx.moveTo(x + r, y); dx.arc(x, y, r, 0, 6.2832);
    }
    dx.fill();
    // printed glow: dots outside the silhouette, size ∝ blurred alpha
    const hp = o.haloPitch || pitch * 1.4, hb = o.haloBlur || 60, pad = hb * 2;
    const halo = document.createElement('canvas'); halo.width = W + pad * 2; halo.height = H + pad * 2; const hx = halo.getContext('2d', { willReadFrequently: true });
    hx.filter = `blur(${hb}px)`; hx.drawImage(img, pad, pad); hx.filter = 'none';
    const hd = hx.getImageData(0, 0, halo.width, halo.height).data; hx.clearRect(0, 0, halo.width, halo.height);
    const [ac, ax] = off('prAlpha_' + key, halo.width, halo.height); ax.drawImage(img, pad, pad); const ad = ax.getImageData(0, 0, halo.width, halo.height).data;
    hx.fillStyle = o.haloCol || T.signal; hx.beginPath(); const r0 = K.rand(5);
    for (let y = hp / 2; y < halo.height; y += hp) for (let x = hp / 2 + ((Math.round(y / hp) % 2) * hp / 2); x < halo.width; x += hp) {
      const k = (Math.floor(y) * halo.width + Math.floor(x)) * 4; if (ad[k + 3] > 40) continue; const a = hd[k + 3] / 255; const r = hp * .5 * Math.pow(a, .8) * (.85 + r0() * .3); if (r < .5) continue; hx.moveTo(x + r, y); hx.arc(x, y, r, 0, 6.2832);
    }
    hx.fill();
    return (prints[key] = { img, dots, halo, pad, W, H });
  };
  // draw a print at (x, y) top-left with scale s. o: {dotsA, haloA, grade, photoA}
  K.drawPrint = (ctx, pr, x, y, s, o = {}) => {
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.haloA && o.halo !== false) { ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * o.haloA; ctx.drawImage(pr.halo, x - pr.pad * s, y - pr.pad * s, pr.halo.width * s, pr.halo.height * s); }
    if (o.haloOnly) { ctx.restore(); return; }
    ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (o.photoA == null ? 1 : o.photoA);
    if (o.filter) ctx.filter = o.filter; ctx.drawImage(pr.img, x, y, pr.W * s, pr.H * s); ctx.filter = 'none';
    if (o.dotsA) { ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * o.dotsA; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(pr.dots, x, y, pr.W * s, pr.H * s); }
    ctx.restore();
  };

  /* ---------------- quad warp (render a canvas into a 4-corner screen) ---------------- */
  K.warp = (ctx, src, q, n = 10) => {
    const W = src.width, H = src.height, bil = (u, v) => { const tx = lerp(q.tl[0], q.tr[0], u), ty = lerp(q.tl[1], q.tr[1], u), bx = lerp(q.bl[0], q.br[0], u), by = lerp(q.bl[1], q.br[1], u); return [lerp(tx, bx, v), lerp(ty, by, v)]; };
    const tri = (s0, s1, s2, d0, d1, d2) => {
      ctx.save(); ctx.beginPath(); const cxm = (d0[0] + d1[0] + d2[0]) / 3, cym = (d0[1] + d1[1] + d2[1]) / 3, ex = (p) => [p[0] + (p[0] - cxm) * .02 + Math.sign(p[0] - cxm) * .6, p[1] + (p[1] - cym) * .02 + Math.sign(p[1] - cym) * .6];
      const e0 = ex(d0), e1 = ex(d1), e2 = ex(d2); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath(); ctx.clip();
      const den = s0[0] * (s2[1] - s1[1]) - s1[0] * s2[1] + s2[0] * s1[1] + (s1[0] - s2[0]) * s0[1]; if (Math.abs(den) < 1e-9) { ctx.restore(); return; }
      const a = -(s0[1] * (d2[0] - d1[0]) - s1[1] * d2[0] + s2[1] * d1[0] + (s1[1] - s2[1]) * d0[0]) / den, b = (s1[1] * d2[1] + s0[1] * (d1[1] - d2[1]) - s2[1] * d1[1] + (s2[1] - s1[1]) * d0[1]) / den;
      const c = (s0[0] * (d2[0] - d1[0]) - s1[0] * d2[0] + s2[0] * d1[0] + (s1[0] - s2[0]) * d0[0]) / den, d = -(s1[0] * d2[1] + s0[0] * (d1[1] - d2[1]) - s2[0] * d1[1] + (s2[0] - s1[0]) * d0[1]) / den;
      const e = (s0[0] * (s2[1] * d1[0] - s1[1] * d2[0]) + s0[1] * (s1[0] * d2[0] - s2[0] * d1[0]) + (s2[0] * s1[1] - s1[0] * s2[1]) * d0[0]) / den, f = (s0[0] * (s2[1] * d1[1] - s1[1] * d2[1]) + s0[1] * (s1[0] * d2[1] - s2[0] * d1[1]) + (s2[0] * s1[1] - s1[0] * s2[1]) * d0[1]) / den;
      ctx.transform(a, b, c, d, e, f); ctx.drawImage(src, 0, 0); ctx.restore();
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n;
      const s00 = [u0 * W, v0 * H], s10 = [u1 * W, v0 * H], s01 = [u0 * W, v1 * H], s11 = [u1 * W, v1 * H];
      const d00 = bil(u0, v0), d10 = bil(u1, v0), d01 = bil(u0, v1), d11 = bil(u1, v1);
      tri(s00, s10, s11, d00, d10, d11); tri(s00, s11, s01, d00, d11, d01);
    }
  };

  /* ---------------- phosphor glow (2D bloom of a layer) ---------------- */
  K.bloomLayer = (ctx, layer, o = {}) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const b = o.blur || 18; ctx.globalAlpha = o.a1 == null ? .8 : o.a1; ctx.filter = `blur(${b * .35}px)`; ctx.drawImage(layer, 0, 0);
    ctx.globalAlpha = o.a2 == null ? .7 : o.a2; ctx.filter = `blur(${b}px)`; ctx.drawImage(layer, 0, 0);
    ctx.globalAlpha = o.a3 == null ? .45 : o.a3; ctx.filter = `blur(${b * 3}px)`; ctx.drawImage(layer, 0, 0);
    ctx.restore();
  };
  K.post = (ctx, o = {}) => {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    if (o.bloom) { const [bc, b] = off('postB', W, H); b.filter = `blur(${o.bloomR || 26}px) brightness(1.1) contrast(1.4)`; b.drawImage(ctx.canvas, 0, 0); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = o.bloom; ctx.drawImage(bc, 0, 0); ctx.restore(); }
  };
  // whole-frame defocus (for DOF on full layers)
  K.blurLayer = (ctx, px, draw) => { if (px < .3) { draw(ctx); return; } const W = ctx.canvas.width, H = ctx.canvas.height; const [c, x] = off('blurL' + Math.round(px * 4), W, H); draw(x); ctx.save(); ctx.filter = `blur(${px}px)`; ctx.drawImage(c, 0, 0); ctx.restore(); };

  /* ---------------- WebGL lens pass ---------------- */
  let GL = null;
  K.lensInit = (glCanvas) => {
    const gl = glCanvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false }); if (!gl) return null;
    const vs = 'attribute vec2 p;varying vec2 uv0;void main(){uv0=p*.5+.5;uv0.y=1.-uv0.y;gl_Position=vec4(p,0,1);}';
    const fs = `precision highp float;varying vec2 uv0;uniform sampler2D tx;uniform vec2 res;uniform float k,ca0,vig,grain,seed,scan,zoom,round,flick,glitch;
      vec2 D(vec2 q,float kk){vec2 c=q-.5;c.x*=res.x/res.y;float r2=dot(c,c);c*=(1.+kk*r2)/zoom;c.x/=res.x/res.y;return c+.5;}
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
      void main(){vec2 uv=uv0;float bnd=floor(uv.y*34.);float gh=fract(sin(bnd*91.7+seed*3.1)*43758.5);
        if(glitch>0.&&gh>1.-glitch*.55){uv.x=fract(uv.x+(fract(sin(bnd*17.3+seed)*9631.1)-.5)*glitch*.07);}
        float ca=ca0*(1.+glitch*5.);vec2 c0=uv-.5;float r=length(c0*vec2(res.x/res.y,1.));
        vec2 ur=D(uv,k*(1.+ca)),ug=D(uv,k),ub=D(uv,k*(1.-ca));
        vec2 cr=(uv-.5)*(1.+ca*.0032*r)+.5, cb=(uv-.5)*(1.-ca*.0032*r)+.5;
        ur=D(cr,k);ub=D(cb,k);
        vec3 col=vec3(texture2D(tx,ur).r,texture2D(tx,ug).g,texture2D(tx,ub).b);
        vec2 e=abs(ug-.5)*2.;float m=1.;if(round>0.){vec2 q=max(e-(1.-round),0.)/round;m=1.-smoothstep(.85,1.,length(q));m*=step(e.x,1.)*step(e.y,1.);}
        else{m=step(e.x,1.0)*step(e.y,1.0);}
        col*=m;
        if(scan>0.){float s=.5+.5*cos(ug.y*res.y*3.14159/2.);col*=1.-scan*(1.-s);}
        col*=1.-flick;
        col*=1.-vig*smoothstep(.35,1.25,r);
        float g=h(uv*res+seed)-.5;col+=g*grain;
        gl_FragColor=vec4(col,1.);}`;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const U = {}; ['tx', 'res', 'k', 'ca0', 'vig', 'grain', 'seed', 'scan', 'zoom', 'round', 'flick', 'glitch'].forEach((n) => (U[n] = gl.getUniformLocation(pr, n)));
    GL = { gl, U, W: glCanvas.width, H: glCanvas.height }; return GL;
  };
  K.lens = (src, o = {}) => {
    if (!GL) return; const { gl, U } = GL; gl.viewport(0, 0, GL.W, GL.H);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const k = o.k || 0; gl.uniform1i(U.tx, 0); gl.uniform2f(U.res, GL.W, GL.H); gl.uniform1f(U.k, k); gl.uniform1f(U.ca0, o.ca || 0); gl.uniform1f(U.glitch, o.glitch || 0); gl.uniform1f(U.vig, o.vig == null ? .35 : o.vig);
    gl.uniform1f(U.grain, o.grain == null ? .05 : o.grain); gl.uniform1f(U.seed, (o.seed || 0) % 97); gl.uniform1f(U.scan, o.scan || 0); gl.uniform1f(U.round, o.round || 0); gl.uniform1f(U.flick, o.flick || 0);
    gl.uniform1f(U.zoom, o.zoom || (o.round ? 1 : 1 + k * 1.05));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
})();
