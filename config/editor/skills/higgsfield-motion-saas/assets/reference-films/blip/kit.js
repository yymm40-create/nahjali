/* BLIP. — launch film kit v2. One passport (tokens), SDF eye/mouth glyphs, a "photographed" LED dot-matrix
   (barrel bulge, depth of field, chromatic fringes, multi-scale bloom, glass sheen), aura pets with their own
   characters, the day dial, stage panels and a lens post-pass. Every draw is a pure function of its params,
   so the same calls build the key frames and every frame of the film. */
(function () {
  const BL = window.BL = {};

  /* ---------------- passport ---------------- */
  BL.T = {
    bone: '#EEEAE3', ink: '#121016', violet: '#5B3DF5', lilac: '#E6E0FF', tangerine: '#FF6B2C', pink: '#FF5FB8',
    mint: '#33E0A1', night: '#14111F', fog: '#DCD7D0',
    display: '"Unbounded", sans-serif', pixel: '"Bitcount Prop Single", monospace', ui: '"Geist", system-ui, sans-serif', mono: '"Geist Mono", monospace',
  };
  const T = BL.T;
  BL.loadFonts = async () => {
    const f = ['900 100px "Unbounded"', '800 100px "Unbounded"', '600 100px "Unbounded"', '700 60px "Bitcount Prop Single"', '500 60px "Bitcount Prop Single"',
      '500 40px "Geist"', '600 40px "Geist"', '500 20px "Geist Mono"'];
    try { await Promise.all(f.map((x) => document.fonts.load(x, 'BLIP. 0123456789 EGG BABY TEEN BESTIE GRUMP MOCHI DOZE ZIP aAz:'))); } catch (e) {}
    await document.fonts.ready;
  };

  /* ---------------- math ---------------- */
  const clamp = BL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = BL.lerp = (a, b, p) => a + (b - a) * p;
  const sstep = BL.sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const len = Math.hypot;
  BL.rand = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const hex = BL.hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); };
  BL.mix = (a, b, p) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p, 0, 1))).toString(16).padStart(2, '0')).join(''); };
  BL.rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;

  /* ---------------- SDF primitives (y down) ---------------- */
  const sd = BL.sd = {
    circle: (x, y, r) => len(x, y) - r,
    box: (x, y, w, h, r = 0) => { const qx = Math.abs(x) - w + r, qy = Math.abs(y) - h + r; return len(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; },
    ell: (x, y, a, b) => (len(x / a, y / b) - 1) * Math.min(a, b),
    star: (x, y, R, k = .5) => Math.pow(Math.pow(Math.abs(x), k) + Math.pow(Math.abs(y), k), 1 / k) - R,
    seg: (x, y, ax, ay, bx, by, r) => { const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay; const h = clamp((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1); return len(px - dx * h, py - dy * h) - r; },
    // tapered capsule a→b with radii ra→rb (flame tufts, ears)
    taper: (x, y, ax, ay, bx, by, ra, rb) => { const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay; const h = clamp((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1); return len(px - dx * h, py - dy * h) - lerp(ra, rb, h); },
    heart: (x, y, s) => {
      x = Math.abs(x) / s; y = (-y / s) + .55;
      let d;
      if (y + x > 1) d = Math.sqrt((x - .25) ** 2 + (y - .75) ** 2) - Math.SQRT2 / 4;
      else d = Math.sqrt(Math.min(x * x + (y - 1) ** 2, (x - .5 * Math.max(x + y, 0)) ** 2 + (y - .5 * Math.max(x + y, 0)) ** 2)) * Math.sign(x - y);
      return d * s;
    },
    smin: (a, b, k) => { const h = clamp(.5 + .5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); },
  };
  const S = sd;

  /* ---------------- glyphs: eye-local units (1 = eye radius), +u points to the face centre ---------------- */
  const smileAt = (u, v, ox, r, th) => Math.max(Math.abs(len(u - ox, v + r * .75) - r) - th, -.02 - v);
  BL.G = {
    none: () => 99,
    // eyes
    dash: (u, v) => S.box(u, v, 1.0, .2, .16),
    sleepy: (u, v) => Math.max(Math.abs(len(u, v + .45) - .8) - .17, -.08 - v),
    roundHi: (u, v) => Math.max(S.circle(u, v, .92), -S.circle(u - .3, v + .34, .26)),
    lidded: (u, v) => Math.max(S.ell(u, v + .02, 1.0, .9), (-.08 + .28 * u) - v),
    sparkle: (u, v) => Math.min(S.star(u, v, 1.2, .48), S.circle(u + .8, v + .78, .14)),
    ringHeart: (u, v) => Math.max(S.circle(u, v, 1.04), -S.heart(u, v + .04, .8)),
    heart: (u, v) => S.heart(u, v - .05, .95),
    angry: (u, v) => Math.max(S.ell(u, v + .05, 1.05, .82), (-.2 + .55 * u - v) / 1.14),
    happy: (u, v) => Math.max(Math.abs(len(u, v - .55) - .8) - .2, v - .38),
    wideHi: (u, v) => Math.max(S.ell(u, v, .82, 1.02), -S.circle(u - .28, v + .38, .24)),
    star: (u, v) => S.star(u, v, 1.15, .5),
    side: (u, v) => Math.min(Math.abs(S.ell(u, v, .9, 1.0)) - .15, S.circle(u - .38, v - .12, .38)),   // side-eye (use noMirror)
    // mouths (centre mark)
    mid: (u, v) => S.box(u, v, .5, .15, .12),
    midS: (u, v) => S.box(u, v, .3, .13, .1),
    o: (u, v) => Math.abs(S.ell(u, v, .32, .36)) - .11,
    smile: (u, v) => smileAt(u, v, 0, .55, .12),
    w: (u, v) => Math.min(smileAt(u, v, -.27, .3, .1), smileAt(u, v, .27, .3, .1)),
    frown: (u, v) => Math.max(Math.abs(len(u, v - .45) - .5) - .11, v - .08),
    grr: (u, v) => Math.max(S.box(u, v, .55, .17, .06), -Math.abs(((u + 10) % .28) - .14) + .045),
  };
  // a face = two mirrored eyes + a centre mark. Returns sdf(x,y) in px.
  BL.face = (f) => {
    const gL = BL.G[f.L || 'dash'], gR = BL.G[f.R || f.L || 'dash'], gM = BL.G[f.M || 'none'];
    const s = f.size, sep = f.sep, by = Math.max(.05, 1 - (f.blink || 0)), ms = f.msize || s * .9, es = f.eyeScale || 1;
    const lx = f.cx - sep / 2 + (f.lookX || 0), rx = f.cx + sep / 2 + (f.lookX || 0), ey = f.cy + (f.dy || 0) + (f.lookY || 0);
    const mx = f.cx + (f.lookX || 0) * .5, my = f.cy + (f.mdy == null ? s * .1 : f.mdy);
    const se = s * es;
    return (x, y) => {
      const v = (y - ey) / (se * by);
      const bk = Math.max(by, .3), dl = gL((x - lx) / se, v) * se * bk, dr = gR((f.noMirror ? 1 : -1) * (x - rx) / se, v) * se * bk;
      const dm = gM((x - mx) / ms, (y - my) / ms) * ms;
      return Math.min(dl, dr, dm);
    };
  };
  BL.morph = (a, b, k) => (k <= 0 ? a : k >= 1 ? b : (x, y) => lerp(a(x, y), b(x, y), k));

  /* ---------------- offscreen canvas pool ---------------- */
  const pool = {};
  const off = BL.off = (key, w, h) => {
    let c = pool[key]; if (!c) { c = pool[key] = document.createElement('canvas'); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.shadowBlur = 0; x.clearRect(0, 0, w, h);
    return [c, x];
  };
  const rrect = BL.rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
  const tintTo = (src, key, color) => { const [c, x] = off(key, src.width, src.height); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; };
  BL.tint = tintTo;

  /* ---------------- LED dot-matrix, "photographed" ----------------
     o: { x,y,w,h, r, pitch, mode:'glow'|'ink', base:[c0,(c1),c2], halo, haloA, haloBlur, edge, on, core, off, bloom, bloomA,
          sdf, power, mask(x,y), scan, dot, bulge (barrel k, ~.1–.2), dof (px blur away from focus), fx,fy,fr (focus), ca (px),
          spill, sheen (0..1), shadow (0..1 bottom falloff), alpha, focus (global blur px), comp } */
  BL.led = (ctx, o) => {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const [fc, f] = off('ledF', W, H), [lc, l] = off('ledL', W, H), [mc, m] = off('ledM', W, H);
    const P = o.pitch, glow = o.mode !== 'ink', pw = o.power == null ? 1 : o.power, R = o.r == null ? o.h * .36 : o.r;
    // soft pillow mask
    m.filter = `blur(${o.edge || 0}px)`; m.fillStyle = '#fff'; rrect(m, o.x, o.y, o.w, o.h, R); m.fill(); m.filter = 'none';
    // base: radial body
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (o.base) {
      const g = f.createRadialGradient(cx, o.y + o.h * .42, 0, cx, o.y + o.h * .45, Math.max(o.w, o.h) * .64);
      const b = o.base; g.addColorStop(0, b[0]); if (b.length > 2) g.addColorStop(.55, b[1]); g.addColorStop(1, b[b.length - 1]);
      f.fillStyle = g; f.fillRect(o.x - 60, o.y - 60, o.w + 120, o.h + 120);
    }
    // dot lattice with barrel bulge (rows bow, dots shrink + dim toward the rim)
    const k = -(o.bulge || 0), Sc = Math.max(o.w, o.h) / 2, dr = P * (o.dot || .36), scan = o.scan, sdf = o.sdf, mask = o.mask, aa = P * .8;
    const ext = 1 / Math.max(.55, 1 + k * 2.2), hw = o.w / 2 * ext + P, hh = o.h / 2 * ext + P;
    const ox = ((o.ox || 0) % P), oy = ((o.oy || 0) % P);
    const nI = Math.ceil(hw / P), nJ = Math.ceil(hh / P);
    const X0 = Math.max(o.x - P, -P), X1 = Math.min(o.x + o.w + P, W + P), Y0 = Math.max(o.y - P, -P), Y1 = Math.min(o.y + o.h + P, H + P);
    const core = o.core, lit = [];
    f.fillStyle = o.off; f.beginPath();
    for (let j = -nJ; j <= nJ; j++) {
      const sy = j * P + oy;
      for (let i = -nI; i <= nI; i++) {
        const sx = i * P + ox, r2 = (sx * sx + sy * sy) / (Sc * Sc), fac = 1 + k * r2;
        const x = cx + sx * fac, y = cy + sy * fac;
        if (x < X0 || x > X1 || y < Y0 || y > Y1) continue;
        const ds = dr * Math.max(.35, 1 + 1.6 * k * r2);
        if (scan) f.rect(x - ds * 1.15, y - ds * .45, ds * 2.3, ds * .9); else { f.moveTo(x + ds, y); f.arc(x, y, ds, 0, 6.2832); }
        if (sdf && pw > 0) {
          let a = clamp(.5 - sdf(cx + sx, cy + sy) / aa, 0, 1); if (a <= 0) continue;
          if (mask) a *= mask(x, y); a *= pw * clamp(1 + 1.4 * k * r2, .35, 1); if (a > .01) lit.push(x, y, ds, a);
        }
      }
    }
    f.fill();
    // lit dots (+ hot core in glow mode)
    if (lit.length) {
      l.fillStyle = o.on;
      for (let n = 0; n < lit.length; n += 4) {
        const x = lit[n], y = lit[n + 1], ds = lit[n + 2] * 1.1; l.globalAlpha = lit[n + 3]; l.beginPath();
        if (scan) l.rect(x - ds * 1.2, y - ds * .5, ds * 2.4, ds); else l.arc(x, y, ds, 0, 6.2832);
        l.fill();
      }
      if (core && glow) {
        l.fillStyle = core;
        for (let n = 0; n < lit.length; n += 4) { const x = lit[n], y = lit[n + 1], ds = lit[n + 2] * .55; l.globalAlpha = lit[n + 3] * .9; l.beginPath(); if (scan) l.rect(x - ds * 2, y - ds * .5, ds * 4, ds); else l.arc(x, y, ds, 0, 6.2832); l.fill(); }
      }
      l.globalAlpha = 1;
      // light spill onto the surface around lit dots
      if (o.spill) { f.save(); f.globalCompositeOperation = glow ? 'lighter' : 'multiply'; f.globalAlpha = o.spill; f.filter = `blur(${P * 1.6}px)`; f.drawImage(lc, 0, 0); f.restore(); }
      f.drawImage(lc, 0, 0);
      if (o.ca && glow) {
        f.save(); f.globalCompositeOperation = 'lighter'; f.globalAlpha = .55;
        f.drawImage(tintTo(lc, 'caR', '#FF2A3C'), o.ca, 0); f.drawImage(tintTo(lc, 'caB', '#2A6BFF'), -o.ca, o.ca * .3); f.restore();
      }
    }
    // pillow shading: glass sheen up top, falloff at the bottom
    if (o.sheen) {
      const s = f.createRadialGradient(o.x + o.w * .3, o.y + o.h * .12, 0, o.x + o.w * .3, o.y + o.h * .12, o.w * .55);
      s.addColorStop(0, `rgba(255,255,255,${o.sheen})`); s.addColorStop(1, 'rgba(255,255,255,0)'); f.fillStyle = s; f.fillRect(o.x, o.y, o.w, o.h);
    }
    if (o.shadow) {
      const s = f.createLinearGradient(0, o.y + o.h * .45, 0, o.y + o.h); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(1, `rgba(0,0,0,${o.shadow})`);
      f.fillStyle = s; f.fillRect(o.x, o.y, o.w, o.h);
    }
    // depth of field: blurred copy everywhere except the focus disc
    if (o.dof) {
      const [bc, b] = off('ledB', W, H); b.filter = `blur(${o.dof}px)`; b.drawImage(fc, 0, 0); b.filter = 'none';
      const fx = o.fx == null ? cx : o.fx, fy = o.fy == null ? cy : o.fy, fr = o.fr || Math.min(o.w, o.h) * .4;
      const g = b.createRadialGradient(fx, fy, fr * .55, fx, fy, fr * 1.5); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000');
      b.globalCompositeOperation = 'destination-in'; b.fillStyle = g; b.fillRect(0, 0, W, H);
      f.drawImage(bc, 0, 0);
    }
    f.globalCompositeOperation = 'destination-in'; f.drawImage(mc, 0, 0); f.globalCompositeOperation = 'source-over';
    // composite: halo → face → bloom
    const A = o.alpha == null ? 1 : o.alpha;
    ctx.save();
    if (o.halo) {
      const [hc, h] = off('ledH', W, H);
      h.filter = `blur(${o.haloBlur || 60}px)`; h.fillStyle = o.halo; rrect(h, o.x, o.y, o.w, o.h, R); h.fill(); h.filter = 'none';
      ctx.globalAlpha = (o.haloA || .9) * A; ctx.drawImage(hc, 0, 0);
    }
    ctx.globalAlpha = A; ctx.globalCompositeOperation = o.comp || 'source-over';
    ctx.filter = o.focus ? `blur(${o.focus}px)` : 'none'; ctx.drawImage(fc, 0, 0); ctx.filter = 'none';
    if (o.bloom && lit.length) {
      const bA = (o.bloomA || .8) * A;
      ctx.globalCompositeOperation = glow ? 'lighter' : 'multiply';
      ctx.globalAlpha = bA * .7; ctx.filter = `blur(${o.bloom * .3}px)`; ctx.drawImage(lc, 0, 0);
      ctx.globalAlpha = bA; ctx.filter = `blur(${o.bloom}px)`; ctx.drawImage(lc, 0, 0);
      if (glow) { ctx.globalAlpha = bA * .45; ctx.filter = `blur(${o.bloom * 3}px)`; ctx.drawImage(lc, 0, 0); }
    }
    ctx.restore();
  };

  /* ---------------- type helpers ---------------- */
  BL.ledText = (ctx, text, x, y, o = {}) => {   // dot-matrix type (Bitcount) with LED glow
    ctx.save(); ctx.font = `${o.weight || 700} ${o.size || 40}px ${T.pixel}`; ctx.letterSpacing = `${o.track == null ? 2 : o.track}px`;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'alphabetic'; ctx.fillStyle = o.color || '#fff'; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color; ctx.shadowBlur = o.glow; ctx.fillText(text, x, y); ctx.shadowBlur = o.glow * .35; }
    ctx.fillText(text, x, y); const w = ctx.measureText(text).width; ctx.restore(); return w;
  };
  BL.text = (ctx, text, x, y, o = {}) => {
    ctx.save(); ctx.font = `${o.weight || 900} ${o.size || 100}px ${o.family || T.display}`; ctx.letterSpacing = `${o.track == null ? -(o.size || 100) * .035 : o.track}px`;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'alphabetic'; ctx.fillStyle = o.color || T.ink; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.fillText(text, x, y); const w = ctx.measureText(text).width; ctx.restore(); return w;
  };

  /* ---------------- life stages (one pet growing up) ---------------- */
  BL.STAGES = [
    { n: '0', label: 'EGG', note: 'zzz… warming up', bg: T.bone, num: T.violet, eyes: { L: 'sleepy', M: 'none', size: 1.0, sep: 1.0 },
      led: { mode: 'glow', base: ['#221E2A', '#110F16', '#060509'], halo: '#000', haloA: .5, haloBlur: 70, on: '#FFE9D6', core: '#FFFFFF', off: 'rgba(255,240,225,.075)', bloom: 16, bloomA: .9, ca: 1.4, spill: .35, sheen: .07, shadow: .45 } },
    { n: '1', label: 'BABY', note: 'says hi. a lot.', bg: '#141118', num: T.tangerine, eyes: { L: 'roundHi', M: 'o', size: .95, sep: 1.0 },
      led: { mode: 'ink', base: ['#FFF0E4', '#FFC29E', '#FF5A1F'], halo: '#FF5A1F', haloA: .95, haloBlur: 90, on: '#3B1206', off: 'rgba(120,30,0,.13)', bloom: 7, bloomA: .5, spill: .25, sheen: .25, shadow: .25 } },
    { n: '2', label: 'TEEN', note: 'has opinions', bg: T.mint, num: T.ink, eyes: { L: 'side', M: 'midS', size: 1.1, sep: 1.08, noMirror: true },
      led: { mode: 'ink', base: ['#FFFFFF', '#F1F4F2', '#B9D8CB'], halo: '#FFFFFF', haloA: .6, haloBlur: 70, on: '#0F0E14', off: 'rgba(0,0,0,.085)', bloom: 6, bloomA: .45, spill: .2, sheen: .2, shadow: .3 } },
    { n: '3', label: 'BESTIE', note: 'knows you best', bg: T.violet, num: T.lilac, eyes: { L: 'ringHeart', M: 'smile', size: 1.38, sep: 1.18 },
      led: { mode: 'glow', base: ['#1B1430', '#100B20', '#2A1670'], halo: '#C77DFF', haloA: .75, haloBlur: 80, on: '#FFB8EA', core: '#FFF2FB', off: 'rgba(255,190,240,.075)', bloom: 18, bloomA: .95, ca: 1.6, spill: .4, sheen: .08, shadow: .4 } },
  ];

  /* stage panel: big numeral + label left, macro LED face bleeding off right/bottom */
  BL.stagePanel = (ctx, k, x, y, w, h, p = {}) => {
    const st = BL.STAGES[k], u = h / 1080;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = p.bg || st.bg; ctx.fillRect(x, y, w, h);
    // numeral (odometer when p.roll is set)
    const fs = 690 * u, nx = x + 70 * u, ny = y + 705 * u;
    ctx.font = `900 ${fs}px ${T.display}`; ctx.letterSpacing = `${-fs * .04}px`; ctx.textBaseline = 'alphabetic';
    if (p.roll != null && p.next != null) {
      const q = p.roll, nh = 620 * u;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y + 40 * u, w * .4, 700 * u); ctx.clip();
      ctx.fillStyle = st.num; ctx.fillText(st.n, nx, ny - q * nh * 1.18);
      ctx.fillStyle = BL.STAGES[p.next].num; ctx.fillText(BL.STAGES[p.next].n, nx, ny + (1 - q) * nh * 1.18);
      ctx.restore();
    } else { ctx.fillStyle = p.num || st.num; ctx.fillText(st.n, nx, ny + (p.numDy || 0) * u); }
    ctx.letterSpacing = '0px';
    const lc = p.num || st.num;
    BL.text(ctx, p.label || st.label, x + 84 * u, y + 868 * u, { size: 92 * u, color: lc, track: -1 * u });
    if (p.note !== false) BL.ledText(ctx, st.note, x + 88 * u, y + 950 * u, { size: 36 * u, color: lc, weight: 600, track: 1.5 * u, alpha: .9 });
    BL.stageFace(ctx, k, x, y, w, h, p);
    ctx.restore();
  };
  BL.stageFace = (ctx, k, x, y, w, h, p = {}) => {
    const st = BL.STAGES[k], u = h / 1080, L = st.led;
    const fx = x + 740 * u, fy = y + 140 * u, fw = 1420 * u, fh = 1080 * u;
    const ecx = x + 1340 * u + (p.lookX || 0) * u, ecy = y + 560 * u + (p.lookY || 0) * u;
    const mk = (s) => BL.face({ L: s.eyes.L, M: s.eyes.M, noMirror: s.eyes.noMirror, cx: ecx, cy: ecy, size: 118 * u * s.eyes.size, sep: 520 * u * s.eyes.sep, msize: 130 * u, mdy: 10 * u, blink: p.blink || 0 });
    let sdf = mk(st);
    if (p.faceTo != null) sdf = BL.morph(sdf, mk(BL.STAGES[p.faceTo]), p.faceK || 0);
    BL.led(ctx, Object.assign({}, L, { x: fx, y: fy, w: fw, h: fh, r: 430 * u, pitch: 19 * u, edge: 30 * u, haloBlur: L.haloBlur * u, bloom: L.bloom * u,
      ca: (L.ca || 0) * u, bulge: .13, dof: 7 * u, fx: ecx, fy: ecy, fr: 520 * u, sdf, power: p.power == null ? 1 : p.power, focus: p.focus || 0 }, p.led || {}));
  };

  /* ---------------- aura pets — four characters ----------------
     shapes in units (body ≈ 600 tall, centred at 0,0); p = { t } drives each character's own idle */
  const U = (a, b, k = 40) => sd.smin(a, b, k);
  BL.PETS = {
    grump: { name: 'GRUMP', trait: 'hot-headed', bg: '#F1E8DF', col: { edge: '#FFD47E', mid: '#FF6B2C', core: '#8E1E06', eyes: '#FFE9CC' },
      eyes: { L: 'angry', M: 'grr', size: 70, sep: 270, dy: 0, msize: 62, mdy: 92 }, plate: { y: 20, w: 200, h: 125, r: 110 },
      sdf: (x, y, p = {}) => {
        const t = p.t || 0, ax = Math.abs(x), huff = Math.pow(Math.max(0, Math.sin(t * 5)), 5);
        let d = sd.ell(x, y - 40, 322, 228);
        [[-115, -1], [0, 0], [115, 1]].forEach(([bx, k], i) => {
          const sw = Math.sin(t * 13 + i * 2.1) * 22 + k * (26 + huff * 20), hh = 175 + (i === 1 ? 50 : 0) + Math.sin(t * 9 + i * 1.7) * 26 + huff * 80;
          d = U(d, sd.taper(x, y, bx, -150, bx + sw, -150 - hh, 66, 12), 46);
        });
        d = U(d, sd.ell(ax - 335, y - 70, 62, 52), 50);
        d = U(d, sd.ell(ax - 128, y - 268, 92, 50), 45);
        return d;
      } },
    mochi: { name: 'MOCHI', trait: 'clingy', bg: '#F4E4EA', col: { edge: '#FFD6EE', mid: '#FF5FB8', core: '#7A0A40', eyes: '#FFE4F3' },
      eyes: { L: 'heart', M: 'w', size: 64, sep: 250, dy: 10, msize: 70, mdy: 96 }, plate: { y: 30, w: 200, h: 135, r: 115 },
      sdf: (x, y, p = {}) => {
        const t = p.t || 0, ax = Math.abs(x), vy = Math.cos(((t * 1.9) % 1) * Math.PI), fl = vy * 48 + Math.sin(t * 7) * 8;
        let d = sd.ell(x, y - 50, 300, 262);
        d = U(d, sd.ell(x, y - 245, 250, 70), 60);
        d = U(d, sd.taper(x, y, -120, -170, -165 - vy * 18, -420 + vy * 26, 84, 64), 55);
        d = U(d, sd.taper(x, y, 125, -180, 245, -340 + fl, 82, 62), 55);
        d = U(d, sd.taper(x, y, 245, -340 + fl, 318, -250 + fl * 1.5, 62, 50), 30);
        d = U(d, sd.ell(ax - 112, y - 286, 80, 52), 40);
        return d;
      } },
    doze: { name: 'DOZE', trait: 'sleepyhead', bg: '#17132B', dark: true, col: { edge: '#EEEBFF', mid: '#8F7BFF', core: '#160F3E', eyes: '#F1EEFF' },
      eyes: { L: 'sleepy', M: 'o', size: 70, sep: 270, dy: 10, msize: 44, mdy: 90 }, plate: { y: 20, w: 240, h: 140, r: 120 },
      sdf: (x, y, p = {}) => {
        const b = 1 + Math.sin((p.t || 0) * 2.4) * .025; x /= b; y /= b;
        let d = sd.ell(x, y - 70, 345, 185);
        d = U(d, sd.circle(x + 175, y + 70, 150), 60);
        d = U(d, sd.circle(x - 35, y + 140, 182), 60);
        d = U(d, sd.circle(x - 235, y + 40, 128), 60);
        [-215, -75, 70, 210].forEach((bx) => { d = U(d, sd.circle(x - bx, y - 225, 72), 45); });
        return d * b;
      } },
    zip: { name: 'ZIP', trait: 'zero chill', bg: '#E3EEE8', col: { edge: '#E4FFB8', mid: '#33E0A1', core: '#06382F', eyes: '#E6FFF4' },
      eyes: { L: 'wideHi', M: 'smile', size: 74, sep: 250, dy: -10, msize: 60, mdy: 96 }, plate: { y: 0, w: 205, h: 170, r: 120 },
      sdf: (x, y, p = {}) => {
        const t = p.t || 0, ax = Math.abs(x), sw = Math.sin(t * 15) * 36 + Math.cos(((t * 2.6) % 1) * Math.PI) * 26;
        let d = sd.ell(x, y - 30, 250, 300);
        d = U(d, sd.ell(x, y - 230, 180, 90), 70);
        d = U(d, sd.seg(x, y, 0, -310, sw * .55, -420, 13), 30);
        d = U(d, sd.circle(x - sw, y + 455, 44), 22);
        d = U(d, sd.ell(ax - 268, y - 20, 70, 38), 45);
        d = U(d, sd.ell(ax - 100, y - 318, 70, 46), 40);
        return d;
      } },
  };
  BL.PET_ORDER = ['grump', 'mochi', 'doze', 'zip'];

  /* aura renderer — o: { cx, cy, s, sx, sy, sdf(x,y) units, col{edge,mid,core}, plate{y,w,h,r}, alpha, blur, rim, spec, box, res } */
  BL.aura = (ctx, o) => {
    const W = ctx.canvas.width, H = ctx.canvas.height, R = o.res || 3, w = Math.ceil(W / R), h = Math.ceil(H / R);
    const [sc, s] = off('auraS', w, h); const img = s.createImageData(w, h), D = img.data;
    const E = hex(o.col.edge), M = hex(o.col.mid), C = hex(o.col.core), pl = o.plate || { y: 0, w: 220, h: 150, r: 110 }, A = o.alpha == null ? 1 : o.alpha;
    const rim = o.rim == null ? .42 : o.rim, spec = o.spec == null ? .3 : o.spec, cK = o.coreK == null ? 1 : o.coreK;
    const sx = o.sx || 1, sy = o.sy || 1, bx = o.box || [-620, -580, 620, 560];
    const i0 = clamp(Math.floor((o.cx + bx[0] * o.s * sx) / R), 0, w), i1 = clamp(Math.ceil((o.cx + bx[2] * o.s * sx) / R), 0, w);
    const j0 = clamp(Math.floor((o.cy + bx[1] * o.s * sy) / R), 0, h), j1 = clamp(Math.ceil((o.cy + bx[3] * o.s * sy) / R), 0, h);
    for (let j = j0; j < j1; j++) {
      const Y = (j * R - o.cy) / (o.s * sy);
      for (let i = i0; i < i1; i++) {
        const X = (i * R - o.cx) / (o.s * sx);
        const d = o.sdf(X, Y);
        if (d > 150) continue;
        const body = sstep(9, -12, d), glow = Math.exp(-Math.max(d, 0) / 30) * .45 * sstep(150, 40, d);
        const a = Math.max(body, glow) * A; if (a < .01) continue;
        const t1 = sstep(-2, -70, d);
        let r = lerp(E[0], M[0], t1), g = lerp(E[1], M[1], t1), b = lerp(E[2], M[2], t1);
        const dc = sd.box(X, Y - pl.y, pl.w, pl.h, pl.r), cf = sstep(75, -70, dc) * cK;
        r = lerp(r, C[0], cf); g = lerp(g, C[1], cf); b = lerp(b, C[2], cf);
        const rm = Math.exp(-(((d + 16) / 13) ** 2)) * rim * (1 - cf);
        const sp = Math.exp(-(((X + 130) ** 2) / 15000 + ((Y + 190) ** 2) / 9000)) * spec * body * (1 - cf);
        const lift = clamp(rm + sp, 0, 1);
        r = lerp(r, 255, lift); g = lerp(g, 255, lift); b = lerp(b, 255, lift);
        const kk = (j * w + i) * 4; D[kk] = r; D[kk + 1] = g; D[kk + 2] = b; D[kk + 3] = a * 255;
      }
    }
    s.putImageData(img, 0, 0);
    ctx.save(); ctx.imageSmoothingQuality = 'high'; ctx.filter = `blur(${o.blur == null ? 5 : o.blur}px)`; ctx.drawImage(sc, 0, 0, w * R, h * R); ctx.restore();
  };
  // each character's own body language (units / factors)
  BL.PHASE = { grump: .25, mochi: .1, doze: .9, zip: .5 };
  BL.petMotion = (id, t) => {
    t += BL.PHASE[id] || 0;
    const m = { x: 0, y: 0, sx: 1, sy: 1, look: 0, blink: 0, eye: 1, huff: 0 };
    const blinkAt = (period, o) => { const ph = ((t + o) % period) / period; return ph > .94 ? Math.sin((ph - .94) / .06 * Math.PI) : 0; };
    if (id === 'grump') { // fuming: shakes harder on every huff, stomps in between, flames flare (see sdf)
      const huff = Math.pow(Math.max(0, Math.sin(t * 5)), 5), shake = .4 + .6 * huff, st = (t * 2.5) % 1;
      m.x = (Math.sin(t * 83) * 8 + Math.sin(t * 61) * 5) * shake;
      m.y = Math.sin(t * 71) * 4 * shake - huff * 16 - Math.pow(Math.sin(st * Math.PI), 2) * 20 * (1 - huff);
      m.sx = 1 + huff * .13; m.sy = 1 - huff * .1; m.eye = 1 - huff * .2; m.huff = huff; m.blink = blinkAt(2.3, .4);
    } else if (id === 'mochi') { // big squishy hops, sways, hearts pulse
      const ph = (t * 1.9) % 1, air = Math.sin(ph * Math.PI), land = Math.exp(-Math.pow((ph < .5 ? ph : 1 - ph) * 7, 2));
      m.y = -Math.pow(air, .8) * 104; m.x = Math.sin(t * 1.9 * Math.PI) * 16;
      m.sx = 1 + land * .19 - air * .06; m.sy = 1 - land * .17 + air * .1;
      m.eye = 1 + .22 * Math.pow(Math.sin(t * 10), 2); m.blink = blinkAt(2.1, 1.1);
    } else if (id === 'doze') { // floats, breathes deep
      const b = Math.sin(t * 2.4); m.y = b * 32; m.x = Math.sin(t * 1.3) * 18; m.sx = 1 + b * .04; m.sy = 1 - b * .035; m.eye = 1 + .05 * b;
    } else if (id === 'zip') { // can't sit still: high hops, darting eyes
      const ph = (t * 2.6) % 1, air = Math.sin(ph * Math.PI), land = Math.exp(-Math.pow(Math.min(ph, 1 - ph) * 8, 2));
      m.y = -air * 110; m.x = Math.sin(t * 2.6 * Math.PI) * 12;
      m.sx = 1 + land * .16 - air * .05; m.sy = 1 - land * .15 + air * .1;
      const lk = Math.sin(t * 5.2); m.look = Math.sign(lk) * Math.pow(Math.abs(lk), .2) * 26; m.blink = blinkAt(1.7, .3);
    }
    return m;
  };
  // a pet at time t. o: { cx, cy, s, t, alpha, eyesAlpha, to, k (morph toward another pet), shadow, dark, res, blur }
  BL.pet = (ctx, id, o) => {
    const P = BL.PETS[id], t = o.t || 0, Q = o.to ? BL.PETS[o.to] : null, k = Q ? clamp(o.k || 0, 0, 1) : 0, ke = sstep(.25, .75, k);
    const mot = BL.petMotion(id, t), motQ = Q ? BL.petMotion(o.to, t) : null;
    const M = (key) => (Q ? lerp(mot[key], motQ[key], k) : mot[key]);
    const sq = o.sq || 0, cx = o.cx + M('x') * o.s, cy = o.cy + M('y') * o.s, sx = M('sx') * (1 + sq), sy = M('sy') * (1 - sq), A = o.alpha == null ? 1 : o.alpha;
    const tP = t + (BL.PHASE[id] || 0), tQ = Q ? t + (BL.PHASE[o.to] || 0) : 0;
    const sdf = Q ? (x, y) => lerp(P.sdf(x, y, { t: tP }), Q.sdf(x, y, { t: tQ }), k) : (x, y) => P.sdf(x, y, { t: tP });
    const col = Q ? { edge: BL.mix(P.col.edge, Q.col.edge, k), mid: BL.mix(P.col.mid, Q.col.mid, k), core: BL.mix(P.col.core, Q.col.core, k), eyes: BL.mix(P.col.eyes, Q.col.eyes, k) } : P.col;
    const pl = Q ? { y: lerp(P.plate.y, Q.plate.y, k), w: lerp(P.plate.w, Q.plate.w, k), h: lerp(P.plate.h, Q.plate.h, k), r: 120 } : P.plate;
    if (o.shadow !== false) { // soft contact shadow
      ctx.save(); ctx.filter = `blur(${36 * o.s}px)`; ctx.fillStyle = o.dark ? 'rgba(0,0,0,.5)' : 'rgba(40,20,30,.17)';
      ctx.globalAlpha = A * clamp(1 - Math.abs(M('y')) / 160, .35, 1);
      ctx.beginPath(); ctx.ellipse(o.cx, o.cy + 360 * o.s, 300 * o.s * sx, 34 * o.s, 0, 0, 6.2832); ctx.fill(); ctx.restore();
    }
    BL.aura(ctx, { cx, cy, s: o.s, sx, sy, sdf, col, plate: pl, alpha: A, res: o.res, blur: o.blur });
    const E = P.eyes, EQ = Q ? Q.eyes : E;
    const face = (e) => BL.face({ L: e.L, M: e.M, cx: cx + (M('look') + (o.look || 0)) * o.s, cy: cy + e.dy * o.s * sy, size: e.size * o.s, sep: e.sep * o.s * sx, msize: e.msize * o.s, mdy: e.mdy * o.s * sy, blink: M('blink'), eyeScale: M('eye') });
    let esdf = face(E); if (Q) esdf = BL.morph(esdf, face(EQ), ke);
    const ea = A * (o.eyesAlpha == null ? 1 : o.eyesAlpha);
    BL.led(ctx, { x: cx - 330 * o.s, y: cy - 230 * o.s, w: 660 * o.s, h: 460 * o.s, r: 10, pitch: Math.max(5, 11 * o.s), mode: 'glow',
      off: 'rgba(0,0,0,0)', on: col.eyes, core: '#FFFFFF', sdf: esdf, scan: true, bloom: 12 * o.s, bloomA: .75, edge: 0, alpha: ea });
    if ((id === 'doze' || o.to === 'doze') && ea > 0) { // DOZE: z's drifting up (LED type)
      const za = (id === 'doze' ? 1 - k : k) * ea;
      for (let i = 0; i < 3; i++) {
        const ph = ((t * .55 + i / 3) % 1), zx = cx + (250 + ph * 90 + i * 10) * o.s, zy = cy - (230 + ph * 240) * o.s;
        BL.ledText(ctx, 'z', zx, zy, { size: (34 + i * 12) * o.s, color: col.eyes, glow: 14 * o.s, alpha: za * Math.sin(ph * Math.PI), weight: 700 });
      }
    }
  };

  /* ---------------- character FX (each pet's little theatre) ---------------- */
  const heartPath = BL.heartPath = (c, x, y, s) => { c.beginPath(); c.moveTo(x, y + s * .42); c.bezierCurveTo(x - s * 1.05, y - s * .2, x - s * .55, y - s * 1.0, x, y - s * .42); c.bezierCurveTo(x + s * .55, y - s * 1.0, x + s * 1.05, y - s * .2, x, y + s * .42); c.closePath(); };
  const starPath = BL.starPath = (c, x, y, r) => { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath(); };
  // o: { cx, cy, s, t, alpha }  (cx/cy = the pet's rest centre; motion offsets are applied here like in BL.pet)
  BL.petFX = (ctx, id, o) => {
    const A = o.alpha == null ? 1 : o.alpha; if (A <= .01) return;
    const m = BL.petMotion(id, o.t), s = o.s, t = o.t + (BL.PHASE[id] || 0), cx = o.cx + m.x * s, cy = o.cy + m.y * s;
    ctx.save();
    if (id === 'grump') {
      const tips = [[-141, -320], [0, -372], [141, -320]];
      for (let i = 0; i < 9; i++) {   // steam off the flames
        const ph = (t * 1.5 + i / 9) % 1, tp = tips[i % 3];
        const x = cx + (tp[0] + Math.sin(i * 2.3 + ph * 3) * 34) * s, y = cy + (tp[1] - ph * 240) * s, r = (16 + ph * 50) * s, a = Math.sin(ph * Math.PI) * .45 * A;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,232,205,${a})`); g.addColorStop(1, 'rgba(255,232,205,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const hf = m.huff, sc = (.5 + .7 * hf) * s, ax = cx + 262 * s, ay = cy - 236 * s;   // anger mark pops on every huff
      ctx.strokeStyle = '#FF3B1F'; ctx.lineWidth = 12 * sc; ctx.lineCap = 'round'; ctx.shadowColor = '#FF6B2C'; ctx.shadowBlur = 16 * s; ctx.globalAlpha = A * (.25 + .75 * hf);
      for (let q = 0; q < 4; q++) { const a0 = q * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(ax + Math.cos(a0) * 46 * sc, ay + Math.sin(a0) * 46 * sc, 28 * sc, a0 + Math.PI * .72, a0 + Math.PI * 1.28); ctx.stroke(); }
    } else if (id === 'mochi') {
      for (let i = 0; i < 5; i++) {   // little hearts float off her
        const ph = (t * .85 + i / 5) % 1, side = i % 2 ? 1 : -1;
        const x = cx + side * (255 + Math.sin(ph * 7 + i) * 34 + i * 6) * s, y = cy + (-40 - ph * 400) * s, hs = (24 + 9 * Math.sin(i * 1.7)) * s * (.55 + .45 * Math.sin(ph * Math.PI));
        ctx.globalAlpha = Math.sin(ph * Math.PI) * A; ctx.fillStyle = '#FF6FC0'; ctx.shadowColor = '#FF5FB8'; ctx.shadowBlur = 18 * s; heartPath(ctx, x, y, hs); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x - hs * .38, y - hs * .45, hs * .16, 0, 6.2832); ctx.fill();
      }
    } else if (id === 'doze' && !o.noBubble) {
      const br = .5 + .5 * Math.sin(t * 2.4), r = (12 + 30 * br) * s, x = cx + (58 + r / s * .7) * s, y = cy + (96 - r / s * .25) * s;   // the sleep bubble
      ctx.globalAlpha = A; ctx.fillStyle = 'rgba(235,230,255,.16)'; ctx.strokeStyle = 'rgba(244,240,255,.85)'; ctx.lineWidth = 3.5 * s; ctx.shadowColor = '#B9A9FF'; ctx.shadowBlur = 14 * s;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.arc(x, y, r * .62, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    } else if (id === 'zip') {
      for (let i = 0; i < 7; i++) {   // twinkles around him
        const a = i * .9 + .4, tw = Math.pow(Math.max(0, Math.sin((t * 2.2 + i * .29) * Math.PI * 2)), 4), r = (12 + 24 * tw) * s;
        const x = cx + Math.cos(a) * 380 * s, y = cy + (Math.sin(a) * 330 - 40) * s;
        ctx.globalAlpha = tw * A; ctx.fillStyle = '#E2FFF2'; ctx.shadowColor = '#33E0A1'; ctx.shadowBlur = 18 * s; starPath(ctx, x, y, r); ctx.fill();
      }
      const ph = ((t * 2.6) % 1), air = Math.sin(ph * Math.PI) * (o.noTicks ? 0 : 1);   // speed ticks under the hop
      ctx.globalAlpha = A * air * .7; ctx.strokeStyle = '#B8FFE0'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round'; ctx.shadowBlur = 0;
      [-60, 0, 60].forEach((dx) => { ctx.beginPath(); ctx.moveTo(o.cx + dx * s, o.cy + (330 + 20) * s); ctx.lineTo(o.cx + dx * s, o.cy + (330 + 20 + 50 * air) * s); ctx.stroke(); });
    }
    ctx.restore();
  };

  /* ---------------- day dial (detailed) ---------------- */
  BL.dial = (ctx, o) => {
    const { cx, cy, R } = o, A0 = -Math.PI / 2, hr = (h) => A0 + h / 24 * 6.2832, now = o.now;
    ctx.save();
    const halo = ctx.createRadialGradient(cx, cy, R * .9, cx, cy, R * 1.5); halo.addColorStop(0, 'rgba(120,90,255,.22)'); halo.addColorStop(1, 'rgba(120,90,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
    const g = ctx.createRadialGradient(cx - R * .25, cy - R * .3, R * .05, cx, cy, R);
    g.addColorStop(0, '#FBF8F3'); g.addColorStop(.65, '#E6E0D7'); g.addColorStop(1, '#CFC7BB');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
    // shadow swirls that trail the hand
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();
    const a = hr(now);
    const cg = ctx.createConicGradient(a - 1.6, cx, cy);
    cg.addColorStop(0, 'rgba(20,14,40,0)'); cg.addColorStop(.18, 'rgba(20,14,40,.55)'); cg.addColorStop(.25, 'rgba(20,14,40,.92)'); cg.addColorStop(.262, 'rgba(20,14,40,0)');
    cg.addColorStop(.62, 'rgba(20,14,40,0)'); cg.addColorStop(.74, 'rgba(20,14,40,.6)'); cg.addColorStop(.8, 'rgba(20,14,40,0)'); cg.addColorStop(1, 'rgba(20,14,40,0)');
    ctx.filter = `blur(${R * .07}px)`; ctx.fillStyle = cg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.filter = 'none';
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .78); rg.addColorStop(0, 'rgba(20,14,40,.5)'); rg.addColorStop(1, 'rgba(20,14,40,0)');
    ctx.fillStyle = rg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    // glass dome: inner rim shadow + soft specular arc
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();
    const rs = ctx.createRadialGradient(cx, cy, R * .82, cx, cy, R); rs.addColorStop(0, 'rgba(20,14,40,0)'); rs.addColorStop(1, 'rgba(20,14,40,.28)'); ctx.fillStyle = rs; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.filter = `blur(${R * .03}px)`; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = R * .035; ctx.beginPath(); ctx.arc(cx, cy, R * .9, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke(); ctx.filter = 'none';
    ctx.restore();
    // hairline rings
    ctx.strokeStyle = 'rgba(18,16,22,.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
    ctx.beginPath(); ctx.arc(cx, cy, R * .64, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx, cy, R * .86, 0, 6.2832); ctx.stroke();
    // ticks: 96 quarter hours, hours longer
    for (let i = 0; i < 96; i++) {
      const t = A0 + i / 96 * 6.2832, big = i % 4 === 0, six = i % 24 === 0, r0 = R * (six ? .875 : big ? .9 : .925), r1 = R * .96;
      ctx.strokeStyle = 'rgba(18,16,22,.9)'; ctx.lineWidth = six ? 4 : big ? 2.6 : 1.4;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * r0, cy + Math.sin(t) * r0); ctx.lineTo(cx + Math.cos(t) * r1, cy + Math.sin(t) * r1); ctx.stroke();
    }
    ctx.font = `500 ${R * .045}px ${T.mono}`; ctx.fillStyle = 'rgba(18,16,22,.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [0, 6, 12, 18].forEach((hh) => { const t = hr(hh); ctx.fillText(String(hh).padStart(2, '0'), cx + Math.cos(t) * R * .8, cy + Math.sin(t) * R * .8); });
    // day progress arc (wake-up → now), now-wedge, hand
    const ac = o.accent || T.tangerine;
    ctx.strokeStyle = ac; ctx.lineWidth = R * .022; ctx.lineCap = 'round';
    if (now > o.from) { ctx.beginPath(); ctx.arc(cx, cy, R * 1.035, hr(o.from), a); ctx.stroke(); }
    ctx.lineWidth = 3.2;
    const L1 = R * 1.16, w = .055;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - w) * L1, cy + Math.sin(a - w) * L1); ctx.arc(cx, cy, L1, a - w, a + w); ctx.closePath(); ctx.stroke();
    ctx.save(); ctx.strokeStyle = 'rgba(20,14,40,.35)'; ctx.filter = 'blur(6px)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx + 8, cy + 14); ctx.lineTo(cx + 8 + Math.cos(a) * R * .95, cy + 14 + Math.sin(a) * R * .95); ctx.stroke(); ctx.restore();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * .98, cy + Math.sin(a) * R * .98); ctx.stroke();
    ctx.restore();
    return { angle: a, hr };
  };
  // mood pill: dark glass capsule, accent outline, tiny LED face inside
  BL.pill = (ctx, x, y, w, face, o = {}) => {
    const h = w * .46, sc = o.scale == null ? 1 : o.scale; if (sc <= .01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.fillStyle = 'rgba(16,12,28,.88)'; rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = o.accent || T.tangerine; ctx.lineWidth = 2.5; rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.stroke();
    ctx.restore();
    // LED face drawn unscaled into a scaled rect (keeps dots crisp)
    const W2 = w * sc, H2 = h * sc;
    BL.led(ctx, { x: x - W2 / 2 + 8 * sc, y: y - H2 / 2 + 6 * sc, w: W2 - 16 * sc, h: H2 - 12 * sc, r: H2 / 2, pitch: Math.max(4, W2 / 34), mode: 'glow', off: 'rgba(255,200,170,.07)',
      on: o.accent || T.tangerine, core: '#FFF4EC', bloom: 6, bloomA: .8, edge: 0, sdf: BL.face(Object.assign({ cx: x, cy: y, size: H2 * .2, sep: W2 * .44, msize: H2 * .2, mdy: H2 * .02 }, face)) });
    if (o.label) BL.ledText(ctx, o.label, x, y - H2 / 2 - 14, { size: w * .1, color: o.labelColor || '#F4F0EA', align: 'center', weight: 600, track: 1, alpha: sc });
  };

  /* ---------------- wordmark ---------------- */
  BL.miniFace = (ctx, x0, y0, w, o = {}) => {
    const h = w * .8;
    BL.led(ctx, { x: x0, y: y0, w, h, r: h * .42, pitch: w / 14, mode: 'glow', base: o.base || ['#2A2433', '#100D16'], off: 'rgba(255,240,225,.09)',
      on: o.on || '#FFE9D6', core: '#FFFFFF', edge: 1.2, bloom: w * .07, bloomA: .9, bulge: .12, sheen: .12, shadow: .4,
      sdf: BL.face({ L: o.L || 'dash', M: o.M || 'none', cx: x0 + w / 2, cy: y0 + h * .48, size: w * .12, sep: w * .44, blink: o.blink || 0 }) });
  };
  BL.wordmark = (ctx, cx, base, fs, color, o = {}) => {
    ctx.save(); ctx.font = `900 ${fs}px ${T.display}`; ctx.letterSpacing = `${-fs * .045}px`;
    const tw = ctx.measureText('BLIP').width, fw = fs * .36, gap = fs * .05, total = tw + gap + fw;
    const x0 = o.left ? cx : cx - total / 2; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.fillText('BLIP', x0, base); ctx.restore();
    BL.miniFace(ctx, x0 + tw + gap, base - fw * .8, fw, o);
    return { x0, x1: x0 + total, tw };
  };

  /* ---------------- lens post-pass: bloom, radial chromatic fringe, vignette, grain ---------------- */
  BL.post = (ctx, o = {}) => {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    if (o.bloom) {
      const [bc, b] = off('postB', W, H); b.filter = 'blur(26px) brightness(1.15) contrast(1.5)'; b.drawImage(ctx.canvas, 0, 0);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = o.bloom; ctx.drawImage(bc, 0, 0); ctx.restore();
    }
    if (o.ca) {
      const [ac, a] = off('postA', W, H); a.drawImage(ctx.canvas, 0, 0);
      const ch = (key, col) => { const [c, x] = off(key, W, H); x.drawImage(ac, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H); return c; };
      const cR = ch('postR', '#FF0000'), cG = ch('postG', '#00FF00'), cB = ch('postBl', '#0000FF');
      const s = o.ca / (W / 2);
      ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
      ctx.setTransform(1 + s, 0, 0, 1 + s, -W / 2 * s, -H / 2 * s); ctx.drawImage(cR, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cG, 0, 0);
      ctx.setTransform(1 - s, 0, 0, 1 - s, W / 2 * s, H / 2 * s); ctx.drawImage(cB, 0, 0);
      ctx.restore();
    }
    if (o.vig) {
      const v = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.15); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${o.vig})`);
      ctx.save(); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    BL.grain(ctx, o.seed || 0, o.grain == null ? .07 : o.grain);
  };
  BL.grain = (ctx, seed, a = .06) => {
    const [gc, g] = off('grain', 512, 512);
    if (!gc._made) { const im = g.createImageData(512, 512), r = BL.rand(91); for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); gc._made = 1; }
    const r = BL.rand(seed * 7919 + 3); ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay';
    const ox = -Math.floor(r() * 512), oy = -Math.floor(r() * 512);
    for (let y = oy; y < ctx.canvas.height; y += 512) for (let x = ox; x < ctx.canvas.width; x += 512) ctx.drawImage(gc, x, y);
    ctx.restore();
  };

  BL.img = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
})();
