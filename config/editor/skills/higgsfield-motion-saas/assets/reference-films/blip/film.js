/* BLIP. — 15 s launch film. Deterministic: window.__seek(t) draws frame t, a pure function of t.
   Motion grammar (higgsfield-motion-saas): speed peaks ON every cut (zoom needle in → settle out, same direction),
   overlap (letters / panels / pets stagger), bounce only on object entrances, a persistent object across cuts
   (the LED face: hook → title period → EGG → … → hub → device screen). 30 fps · 120 BPM (beat = 0.5 s). */
(function () {
  const W = 1920, H = 1080, FPS = 30, DUR = 15;
  const cv = document.getElementById('c'), X = cv.getContext('2d'), T = BL.T;
  const clamp = BL.clamp, lerp = BL.lerp, sstep = BL.sstep;
  const P = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const bez = (x1, y1, x2, y2) => (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 26; i++) { const cx = 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3; if (cx < x) lo = u; else hi = u; u = (lo + hi) / 2; }
    return 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
  };
  const E = {
    in: (k = 3) => (p) => Math.pow(p, k), out: (k = 3) => (p) => 1 - Math.pow(1 - p, k),
    inOut: (k = 3) => (p) => (p < .5 ? Math.pow(2 * p, k) / 2 : 1 - Math.pow(2 - 2 * p, k) / 2),
    soft: bez(.16, 1, .3, 1), smooth: bez(.5, 0, .1, 1), glide: bez(.45, 0, .55, 1),
  };
  const spring = (t, t0, d = .5) => { const x = (t - t0) / d; if (x <= 0) return 0; if (x >= 1) return 1; return 1 - Math.exp(-6.5 * x) * Math.cos(10.5 * x); };
  const pulse = (t, t0, w = .06) => Math.exp(-(((t - t0) / w) ** 2));
  const zIn = (t, a, b, Z) => Math.exp(Math.log(Z) * E.in(3)(P(t, a, b)));           // needle into a cut
  const zOut = (t, a, b, Z) => Math.exp(Math.log(Z) * (1 - E.out(3)(P(t, a, b))));    // settle after a cut
  const errs = [];

  /* ---------------- type ---------------- */
  const font = (o) => `${o.weight || 900} ${o.size}px ${o.family || T.display}`;
  // letters rising out of their own baseline mask (dir 1 = in, -1 = out upward)
  function letters(ctx, text, x, y, o, t, t0, st = .04, d = .5, dir = 1) {
    ctx.save(); ctx.font = font(o); ctx.letterSpacing = `${o.track == null ? -o.size * .035 : o.track}px`; ctx.textBaseline = 'alphabetic';
    const full = ctx.measureText(text).width, x0 = o.align === 'center' ? x - full / 2 : x;
    ctx.fillStyle = o.color; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.beginPath(); ctx.rect(-1e4, y - o.size * 1.05, 3e4, o.size * 1.34); ctx.clip();
    for (let i = 0; i < text.length; i++) {
      const px = x0 + (i ? ctx.measureText(text.slice(0, i)).width : 0), a = t0 + i * st;
      let dy;
      if (dir > 0) { const q = E.soft(P(t, a, a + d)); if (q <= 0) continue; dy = (1 - q) * o.size * 1.08; }
      else { const q = E.in(2)(P(t, a, a + d)); if (q >= 1) continue; dy = -q * o.size * 1.08; }
      ctx.fillText(text[i], px, y + dy);
    }
    ctx.restore(); return full;
  }
  // LED type that prints itself with a block cursor
  function typeLED(ctx, text, x, y, o, t, t0, cps = 42) {
    const n = Math.floor((t - t0) * cps); if (n <= 0) return;
    ctx.save(); ctx.font = `${o.weight || 700} ${o.size}px ${T.pixel}`; ctx.letterSpacing = `${o.track == null ? 2 : o.track}px`;
    const full = ctx.measureText(text).width, x0 = o.align === 'center' ? x - full / 2 : x, s = text.slice(0, Math.min(n, text.length));
    const w = ctx.measureText(s).width; ctx.restore();
    BL.ledText(ctx, s, x0, y, Object.assign({}, o, { align: 'left' }));
    const typing = n < text.length, blinkOn = Math.floor(t * 6) % 2 === 0;
    if (typing || (n < text.length + 10 && blinkOn)) {
      ctx.save(); ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * .9; ctx.fillStyle = o.color; if (o.glow) { ctx.shadowColor = o.color; ctx.shadowBlur = o.glow; }
      ctx.fillRect(x0 + w + o.size * .08, y - o.size * .72, o.size * .42, o.size * .78); ctx.restore();
    }
  }

  /* ---------------- shared drawing ---------------- */
  // a stage face with camera zoom about a pivot (crisp: geometry is scaled, not pixels)
  function stageFace(ctx, k, o = {}) {
    const pn = o.panel || [0, 0, W, H], x = pn[0], y = pn[1], h = pn[3], u = h / 1080, st = BL.STAGES[k], L = st.led;
    const Z = o.zoom || 1, px = o.px == null ? x + 1340 * u : o.px, py = o.py == null ? y + 560 * u : o.py;
    const mp = (a, b) => [px + (a - px) * Z, py + (b - py) * Z];
    const [fx, fy] = mp(x + 740 * u, y + 140 * u), fw = 1420 * u * Z, fh = 1080 * u * Z;
    const [ecx, ecy] = mp(x + 1340 * u, y + 560 * u + (o.dy || 0) * u);
    const mk = (eyes) => BL.face({ L: eyes.L, M: eyes.M, noMirror: eyes.noMirror, cx: ecx, cy: ecy, size: 118 * u * Z * (eyes.size || 1), sep: 520 * u * Z * (eyes.sep || 1),
      msize: 130 * u * Z, mdy: 10 * u * Z, blink: o.blink || 0, eyeScale: o.eyeScale || 1, lookX: (o.lookX || 0) * u * Z, lookY: (o.lookY || 0) * u * Z });
    let sdf = mk(o.eyesFrom != null ? BL.STAGES[o.eyesFrom].eyes : st.eyes);
    if (o.eyesFrom != null) sdf = BL.morph(sdf, mk(st.eyes), o.eyesK || 0);
    if (o.toFace) sdf = BL.morph(sdf, mk(o.toFace), o.toK || 0);
    BL.led(ctx, Object.assign({}, L, { x: fx, y: fy, w: fw, h: fh, r: 430 * u * Z, pitch: 19 * u * Z, edge: 30 * u * Z, haloBlur: L.haloBlur * u * Z, bloom: L.bloom * u * Math.sqrt(Z),
      ca: (L.ca || 0) * u, bulge: .13, dof: 7 * u * Math.sqrt(Z), fx: ecx, fy: ecy, fr: 520 * u * Z, sdf, power: o.power == null ? 1 : o.power, alpha: o.alpha }));
    return { ecx, ecy };
  }
  // static-ish panel for the grid (numeral + label + note + living face)
  function stagePanel(ctx, k, pn, t, live = {}) {
    const [x, y, w, h] = pn, u = h / 1080, st = BL.STAGES[k];
    if (x > W || y > H || x + w < 0 || y + h < 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = st.bg; ctx.fillRect(x, y, w, h);
    BL.text(ctx, st.n, x + 70 * u, y + 705 * u, { size: 690 * u, color: st.num, track: -690 * u * .04 });
    BL.text(ctx, st.label, x + 84 * u, y + 868 * u, { size: 92 * u, color: st.num, track: -1 * u });
    BL.ledText(ctx, st.note, x + 88 * u, y + 950 * u, { size: 36 * u, color: st.num, weight: 600, track: 1.5 * u, alpha: .9 });
    stageFace(ctx, k, Object.assign({ panel: pn }, live));
    ctx.restore();
  }
  // each stage's living behaviour (t local to the stage's arrival B)
  function stageLife(k, t, B) {
    const L = { blink: 0, lookX: 0, lookY: 0, eyeScale: 1, dy: 0 }, a = t - B;
    if (k === 0) { L.dy = Math.sin(t * 4.5) * 7; }
    if (k === 1) {
      L.eyeScale = 1 + .22 * Math.exp(-Math.max(0, a) * 7) * Math.sin(Math.max(0, a) * 22);
      const lk = sstep(0, 1, P(a, .3, .42)) * (1 - sstep(0, 1, P(a, .62, .74))); L.lookX = 46 * lk; L.lookY = -30 * lk;
      L.blink = Math.sin(Math.PI * P(a, .5, .62));
    }
    if (k === 2) { L.lookX = lerp(-40, 40, E.inOut(2)(P(a, .1, .55))); L.blink = .42 * sstep(0, 1, P(a, .5, .62)); }
    if (k === 3) { L.eyeScale = 1 + .14 * (pulse(a, .26) + pulse(a, .44)) + .14 * (pulse(a, 1.26) + pulse(a, 1.44)); L.blink = Math.sin(Math.PI * P(a, .62, .72)); }
    return L;
  }
  function zzz(ctx, x, y, s, t, color, A = 1) {
    for (let i = 0; i < 3; i++) {
      const ph = ((t * .7 + i / 3) % 1);
      BL.ledText(ctx, 'z', x + (ph * 80 + i * 14) * s, y - ph * 220 * s, { size: (40 + i * 14) * s, color, glow: 14 * s, alpha: A * Math.sin(ph * Math.PI), weight: 700 });
    }
  }
  function bgRadial(ctx, c0, c1, cx = 960, cy = 540, r0 = 100, r1 = 1400) {
    const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // evolution burst: a ring of LED sparks + a soft bloom when a pet turns into the next one
  function burst(ctx, cx, cy, t, t0, color, s = 1) {
    const a = t - t0; if (a < 0 || a > .5) return;
    const q = E.out(3)(a / .5), fade = 1 - a / .5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 520 * s); g.addColorStop(0, BL.rgba(color, .42 * Math.exp(-a * 9))); g.addColorStop(1, BL.rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(cx - 520 * s, cy - 520 * s, 1040 * s, 1040 * s);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16 * s;
    for (let i = 0; i < 22; i++) {
      const ang = i / 22 * 6.2832 + (i % 2) * .14, r = (260 + 380 * q * (.75 + .25 * ((i * 7) % 5) / 4)) * s, rr = (i % 3 ? 7 : 12) * s * fade;
      ctx.globalAlpha = fade; ctx.beginPath();
      if (i % 4 === 0) BL.starPath(ctx, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * .9, rr * 2.2); else ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * .9, rr, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ================= S1 · HOOK 0.0–1.6 ================= */
  function hook(ctx, t) {
    ctx.fillStyle = '#060509'; ctx.fillRect(0, 0, W, H);
    let k = 1 + .06 * E.inOut(2)(P(t, 0, 1.3));
    if (t > 1.3) k *= zIn(t, 1.3, 1.6, 2.9);
    const px = 960 + Math.sin(t * 1.3) * 6, py = 540 + Math.cos(t * 1.1) * 4, mp = (a, b) => [px + (a - px) * k, py + (b - py) * k];
    const shut = E.inOut(2)(P(t, .78, .86)), open = E.out(2)(P(t, .86, 1.0)), pop = 1 + .16 * Math.sin(Math.PI * P(t, .9, 1.18));
    const look = -54 * sstep(0, 1, P(t, 1.0, 1.08)) * (1 - sstep(0, 1, P(t, 1.2, 1.3)));
    const blink = Math.sin(Math.PI * P(t, 1.1, 1.22));
    const [ex, ey] = mp(960, 540);
    const closed = BL.face({ L: 'sleepy', cx: ex, cy: ey + Math.sin(t * 5) * 5 * k, size: 150 * k, sep: 640 * k });
    const awake = BL.face({ L: 'roundHi', cx: ex, cy: ey, size: 150 * k, sep: 640 * k, eyeScale: pop, lookX: look * k, blink: Math.max(blink, 1 - open) });
    const scanY = lerp(ey - 230 * k, ey + 230 * k, E.out(2)(P(t, .26, .5)));
    const flick = t < .26 ? 0 : t < .46 ? .72 + .28 * Math.abs(Math.sin(t * 70)) : 1;
    const [fx, fy] = mp(-160, 60);
    BL.led(ctx, { x: fx, y: fy, w: 2240 * k, h: 1240 * k, r: 600 * k, pitch: 23 * k, mode: 'glow', base: ['#2A2433', '#131018', '#060509'], edge: 80 * k,
      off: 'rgba(255,240,225,.085)', on: '#FFE6CF', core: '#FFFFFF', bloom: 24 * Math.sqrt(k), bloomA: 1, ca: 2.4, spill: .45, sheen: .07, shadow: .55,
      bulge: .17, dof: 9 * Math.sqrt(k), fx: ex, fy: ey, fr: 560 * k, alpha: E.out(2)(P(t, 0, .4)),
      sdf: BL.morph(closed, awake, shut), power: flick, mask: (x, y) => sstep(-14, 14, scanY - y) });
    return { vig: .5, ca: 3 };
  }

  /* ================= S2 · TITLE 1.6–3.0 ================= */
  function title(ctx, t) {
    const fs = 330, base = 610;
    ctx.save(); ctx.font = `900 ${fs}px ${T.display}`; ctx.letterSpacing = `${-fs * .045}px`; const tw = ctx.measureText('BLIP').width; ctx.restore();
    const mw = fs * .36, gap = fs * .05, total = tw + gap + mw, x0 = 960 - total / 2;
    const fx0 = x0 + tw + gap, fy0 = base - mw * .8, mh = mw * .8, fcx = fx0 + mw / 2, fcy = fy0 + mh * .48;
    const kin = zOut(t, 1.6, 2.05, 1.9), kout = zIn(t, 2.7, 3.0, 17);
    const m1 = (a, b) => [960 + (a - 960) * kin, 540 + (b - 540) * kin];
    const [pcx, pcy] = m1(fcx, fcy);
    const mp = (a, b) => { const [u, v] = m1(a, b); return [pcx + (u - pcx) * kout, pcy + (v - pcy) * kout]; }, K = kin * kout;
    bgRadial(ctx, '#F6F3EE', '#DAD4CA', 960, 480, 100, 1300);
    // switched-off LED field on the paper (continues the hook's dots)
    const pitch = 30 * K, [ox, oy] = mp(0, 0), r = 3.4 * K;
    ctx.fillStyle = 'rgba(18,16,22,.05)'; ctx.beginPath();
    for (let yy = ((oy % pitch) + pitch) % pitch; yy < H + pitch; yy += pitch) for (let xx = ((ox % pitch) + pitch) % pitch; xx < W + pitch; xx += pitch) { ctx.moveTo(xx + r, yy); ctx.arc(xx, yy, r, 0, 6.2832); }
    ctx.fill();
    // wordmark letters
    const [bx, by] = mp(x0, base);
    letters(ctx, 'BLIP', bx, by, { size: fs * K, color: T.ink, track: -fs * .045 * K }, t, 1.66, .06, .55);
    // the period: a living micro-face
    const sp = spring(t, 1.98, .55);
    if (sp > 0) {
      const lk = -mw * .09 * sstep(0, 1, P(t, 2.18, 2.3)) * (1 - sstep(0, 1, P(t, 2.42, 2.52)));
      const blink = Math.sin(Math.PI * P(t, 2.5, 2.6)), sleep = E.inOut(2)(P(t, 2.68, 2.86));
      const [qx, qy] = mp(fcx, fcy), sw = mw * K * sp, sh = mh * K * sp, gx = qx - sw / 2, gy = qy - sh * .48;
      const awake = BL.face({ L: 'roundHi', cx: qx, cy: qy, size: sw * .12, sep: sw * .44, lookX: lk * K * sp, blink });
      const asleep = BL.face({ L: 'sleepy', cx: qx, cy: qy, size: sw * .12, sep: sw * .44 });
      BL.led(ctx, { x: gx, y: gy, w: sw, h: sh, r: sh * .42, pitch: sw / 14, mode: 'glow', base: ['#2A2433', '#100D16'], off: 'rgba(255,240,225,.09)', on: '#FFE9D6', core: '#FFFFFF',
        edge: 1.2 * Math.max(1, K * .6), bloom: sw * .07, bloomA: .9, bulge: .12, sheen: .12, shadow: .4, sdf: BL.morph(awake, asleep, sleep), dof: K > 3 ? 4 : 0, fx: qx, fy: qy, fr: sw * .4 });
    }
    // subline
    const [sx, sy] = mp(960, 760);
    typeLED(ctx, 'a tiny pet that grows with you', sx, sy, { size: 44 * K, color: T.violet, weight: 600, track: 3 * K, align: 'center' }, t, 2.08, 58);
    return { vig: .16, ca: 1.6 };
  }

  /* ================= S3 · GROW 3.0–6.4 ================= */
  const BND = [3.0, 3.85, 4.7, 5.55, 6.4];
  function grow(ctx, t) {
    const k = t < BND[1] ? 0 : t < BND[2] ? 1 : t < BND[3] ? 2 : 3, B = BND[k], st = BL.STAGES[k];
    const zoom = k === 0 ? zOut(t, 3.0, 3.55, 2.4) : 1 + .055 * (1 - E.out(3)(P(t, B, B + .38)));
    const shake = k > 0 ? Math.exp(-(t - B) * 13) * Math.sin((t - B) * 64) * 12 : 0;
    ctx.fillStyle = st.bg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(shake, shake * .4);
    // numeral: rise-in (stage 0) or odometer roll around every boundary
    const nx = 70, ny = 705, nh = 620 * 1.18;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 40, 780, 700); ctx.clip();
    let from = null, to = k, q = 1;
    if (k < 3 && t > BND[k + 1] - .14) { from = k; to = k + 1; q = E.inOut(3)(P(t, BND[k + 1] - .14, BND[k + 1] + .22)); }
    else if (k > 0 && t < B + .22) { from = k - 1; to = k; q = E.inOut(3)(P(t, B - .14, B + .22)); }
    const num = (i, dy) => BL.text(ctx, BL.STAGES[i].n, nx, ny + dy, { size: 690, color: BL.STAGES[i].num, track: -690 * .04 });
    if (from != null) { num(from, -q * nh); num(to, (1 - q) * nh); }
    else if (k === 0) num(0, (1 - E.soft(P(t, 3.08, 3.62))) * nh);
    else num(k, 0);
    ctx.restore();
    // label (mask swap) + note (prints)
    const lab = (i, t0, dir) => letters(ctx, BL.STAGES[i].label, 84, 868, { size: 92, color: BL.STAGES[i].num, track: -1 }, t, t0, .03, dir > 0 ? .45 : .22, dir);
    if (k < 3 && t > BND[k + 1] - .12) lab(k, BND[k + 1] - .12, -1); else lab(k, k === 0 ? 3.14 : B - .02, 1);
    if (!(k < 3 && t > BND[k + 1] - .1)) typeLED(ctx, st.note, 88, 950, { size: 36, color: st.num, weight: 600, track: 1.5, alpha: .9 }, t, (k === 0 ? 3.3 : B + .1), 44);
    ctx.restore();
    // face
    const life = stageLife(k, t, B);
    const fo = Object.assign({ zoom, px: 1340, py: 560 }, life);
    if (k > 0) { fo.eyesFrom = k - 1; fo.eyesK = E.inOut(2)(P(t, B - .05, B + .22)); }
    if (k === 0) fo.power = .25 + .75 * sstep(0, 1, P(t, 3.0, 3.15));
    const fc = stageFace(ctx, k, fo);
    if (k === 0) zzz(ctx, fc.ecx + 360, fc.ecy - 120, 1, t, '#FFE9D6', P(t, 3.2, 3.4) * (1 - P(t, 3.75, 3.85)));
    return { vig: k === 1 ? .32 : .22, ca: 2.2 };
  }

  /* ================= S4 · GRID 6.4–7.3 ================= */
  function grid(ctx, t) {
    const q = E.smooth(P(t, 6.4, 6.92)), G = lerp(2, 1, q), ox = W - W * G, oy = H - H * G;
    // exit: needle into BESTIE's face, its eyes already turning into GRUMP's
    const Z = zIn(t, 7.0, 7.3, 3.4), pvx = ox + 960 * G + 1340 * (G / 2), pvy = oy + 540 * G + 560 * (G / 2);
    ctx.fillStyle = T.ink; ctx.fillRect(0, 0, W, H);
    const lives = [
      { dy: Math.sin(t * 4.5) * 7 },
      { blink: Math.sin(Math.PI * P(t, 6.72, 6.82)), lookX: 40 * Math.sin(t * 3), lookY: -20 },
      { lookX: 40 * Math.sin(t * 2.6), blink: .4 },
      { eyeScale: 1 + .14 * (pulse(t, 6.7) + pulse(t, 6.88)), toFace: { L: 'angry', M: 'grr', size: 1.3, sep: 1.15 }, toK: E.inOut(2)(P(t, 7.08, 7.28)) },
    ];
    [0, 1, 2, 3].forEach((i) => {
      let x = ox + (i % 2) * 960 * G, y = oy + Math.floor(i / 2) * 540 * G, w = 960 * G, h = 540 * G;
      x = pvx + (x - pvx) * Z; y = pvy + (y - pvy) * Z; w *= Z; h *= Z;
      const on = i === 3 ? 1 : sstep(0, 1, P(t, 6.5 + i * .07, 6.75 + i * .07));
      stagePanel(ctx, i, [x, y, w, h], t, Object.assign({ power: on }, lives[i]));
    });
    // thin gutters between panels
    ctx.fillStyle = T.ink; const gx = pvx + (ox + 960 * G - pvx) * Z, gy = pvy + (oy + 540 * G - pvy) * Z;
    ctx.fillRect(gx - 3, 0, 6, H); ctx.fillRect(0, gy - 3, W, 6);
    return { vig: .25, ca: 2.2 };
  }

  /* ================= S5 · PETS 7.3–9.9 ================= */
  const PB = [7.3, 7.95, 8.6, 9.25, 9.9], ORDER = ['grump', 'mochi', 'doze', 'zip'];
  const LINES = { grump: 'loves being right. hates mornings.', mochi: 'needs 300 hugs a day.', doze: 'naps between naps.', zip: 'already bored. again.' };
  const petState = (t) => {
    for (let i = 1; i < 4; i++) if (Math.abs(t - PB[i]) < .18) return { a: ORDER[i - 1], b: ORDER[i], k: E.inOut(3)(P(t, PB[i] - .18, PB[i] + .18)), i };
    const i = t < PB[1] ? 0 : t < PB[2] ? 1 : t < PB[3] ? 2 : 3; return { a: ORDER[i], b: null, k: 0, i };
  };
  function petBg(ctx, id, id2, k, cam) {
    const P1 = BL.PETS[id], P2 = id2 ? BL.PETS[id2] : P1, dk = lerp(P1.dark ? 1 : 0, P2.dark ? 1 : 0, k);
    k = sstep(.38, .62, k);
    const bg = BL.mix(P1.bg, P2.bg, k), c0 = BL.mix(BL.mix(bg, '#FFFFFF', .35), BL.mix(bg, '#2A2350', .35), dk), c1 = BL.mix(BL.mix(bg, '#000000', .08), BL.mix(bg, '#000000', .25), dk);
    bgRadial(ctx, c0, c1, 640 + (cam ? cam[0] : 0), 560, 80, 1500);
    return dk;
  }
  function pets(ctx, t) {
    const s = petState(t), cam = zOut(t, 7.3, 7.78, 1.75) * (1 + .025 * P(t, 7.3, 9.9));
    const dk = petBg(ctx, s.a, s.b, s.k);
    const cx = 640 + (640 - 640) * cam, cy = 560 + (575 - 560) * cam;
    // arrival: a springy squash as the new character lands in its body, then a glance at its own name
    const arr = s.i === 0 ? 7.32 : PB[s.i] + .1, aa = Math.max(0, t - arr), sq = .1 * Math.exp(-aa * 7) * Math.sin(aa * 19) * (t > arr ? 1 : 0);
    const cur = s.b || s.a, gl = (cur === 'grump' || cur === 'zip' || cur === 'mochi') ? 34 * sstep(0, 1, P(t, arr + .22, arr + .3)) * (1 - sstep(0, 1, P(t, arr + .46, arr + .54))) : 0;
    BL.pet(ctx, s.a, { cx, cy, s: cam, t, to: s.b, k: s.k, dark: dk > .5, sq, look: gl });
    BL.petFX(ctx, s.a, { cx, cy, s: cam, t, alpha: 1 - s.k });
    if (s.b) BL.petFX(ctx, s.b, { cx, cy, s: cam, t, alpha: s.k });
    for (let j = 1; j < 4; j++) burst(ctx, cx, cy, t, PB[j] - .04, BL.PETS[ORDER[j]].col.edge, cam);
    // name / trait / line
    const ink = BL.mix(T.ink, T.lilac, dk);
    const show = (id, tIn, tOut) => {
      const Pp = BL.PETS[id];
      if (tOut != null && t > tOut) letters(ctx, Pp.name, 1090, 520, { size: 150, color: ink }, t, tOut, .015, .14, -1);
      else letters(ctx, Pp.name, 1090, 520, { size: 150, color: ink }, t, tIn, .035, .45, 1);
      const fade = tOut != null ? 1 - P(t, tOut, tOut + .1) : 1;
      if (fade > 0) {
        typeLED(ctx, Pp.trait, 1096, 612, { size: 56, color: Pp.col.mid, weight: 700, glow: dk > .5 ? 18 : 0, alpha: fade }, t, tIn + .12, 40);
        const q = E.soft(P(t, tIn + .2, tIn + .6));
        BL.text(ctx, LINES[id], 1096, 680 + (1 - q) * 20, { size: 30, weight: 500, family: T.ui, color: ink, alpha: .62 * q * fade, track: 0 });
      }
    };
    const i = t < PB[1] ? 0 : t < PB[2] ? 1 : t < PB[3] ? 2 : 3;
    const tin = (j) => (j === 0 ? PB[0] + .12 : PB[j] + .06);
    if (i > 0 && t < PB[i] + .12) show(ORDER[i - 1], tin(i - 1), PB[i] - .12);
    if (i < 3 && t > PB[i + 1] - .12) show(ORDER[i], tin(i), PB[i + 1] - .12);
    else show(ORDER[i], tin(i), null);
    return { vig: lerp(.18, .38, dk), ca: 2.2 };
  }

  /* ================= S6 · CAST 9.9–10.9 ================= */
  const CAST = [['grump', 330, 10.0], ['mochi', 750, 10.07], ['doze', 1170, 10.14], ['zip', 1590, null]];
  function cast(ctx, t) {
    const q = E.smooth(P(t, 9.9, 10.36));
    petBg(ctx, 'zip', null, 0); ctx.save(); ctx.globalAlpha = E.inOut(2)(P(t, 9.92, 10.08)); bgRadial(ctx, '#251D44', '#0D0A17', 960, 640, 100, 1250); ctx.restore();
    // ZIP's name leaves
    if (t < 10.15) {
      letters(ctx, 'ZIP', 1090, 520, { size: 150, color: T.ink }, t, 9.9, .025, .2, -1);
      const f = 1 - P(t, 9.9, 10.05);
      BL.ledText(ctx, 'zero chill', 1096, 612, { size: 56, color: BL.PETS.zip.col.mid, weight: 700, alpha: f });
      BL.text(ctx, LINES.zip, 1096, 680, { size: 30, weight: 500, family: T.ui, color: T.ink, alpha: .62 * f, track: 0 });
    }
    letters(ctx, 'Raise it your way.', 960, 215, { size: 84, color: T.lilac, align: 'center' }, t, 10.05, .018, .45);
    CAST.forEach(([id, x, t0], i) => {
      let cx = x, cy = 610, s = .5, A = 1;
      if (id === 'zip') { cx = lerp(640, x, q); cy = lerp(575, 610, q); s = lerp(1, .5, q); }
      else { const sp = spring(t, t0, .55); if (sp <= 0) return; cy = 610 + (1 - sp) * 460; s = .5 * (.55 + .45 * Math.min(sp, 1.1)); A = P(t, t0, t0 + .1); }
      BL.pet(ctx, id, { cx, cy, s, t, dark: true, res: 2, blur: 3, alpha: A });
      BL.petFX(ctx, id, { cx, cy, s, t, alpha: A });
      const P1 = BL.PETS[id], tn = 10.28 + i * .05;
      letters(ctx, P1.name, x, 900, { size: 44, color: P1.col.edge, align: 'center' }, t, tn, .02, .4);
      typeLED(ctx, P1.trait, x, 952, { size: 28, color: P1.col.mid, align: 'center', weight: 600, glow: 10 }, t, tn + .12, 40);
    });
    return { vig: .36, ca: 2.5 };
  }

  /* ================= S7 · DAY 10.9–12.9 ================= */
  const nowAt = (t) => 7 + 10.3 * E.inOut(2.4)(P(t, 11.0, 12.55));
  const tAt = (h) => { let a = 11.0, b = 12.55; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (nowAt(m) < h) a = m; else b = m; } return b; };
  const PILLS = [[7, { L: 'roundHi', M: 'o' }, '07:00'], [12.5, { L: 'wideHi', M: 'o' }, '12:30'], [16, { L: 'star', M: 'smile' }, '16:00']].map((p) => p.concat([tAt(p[0] + .25)]));
  const MOODS = [{ L: 'roundHi', M: 'o', line: 'wakes up with you.' }, { L: 'wideHi', M: 'o', line: 'snack o’clock.' }, { L: 'star', M: 'smile', line: 'play time — it knows.' }];
  function day(ctx, t) {
    const now = nowAt(t), cx0 = 1330, cy0 = 540, R0 = 430;
    const sc = .84 + .16 * E.soft(P(t, 10.9, 11.55));
    const Z = zIn(t, 12.6, 12.9, 11), hubx = cx0, huby = cy0;
    const mp = (a, b) => [hubx + (a - hubx) * Z, huby + (b - huby) * Z];
    bgRadial(ctx, '#231B3F', '#0C0915', 1200, 540, 200, 1400);
    const R = R0 * sc * Z, [cx, cy] = mp(cx0, cy0);
    const d = BL.dial(ctx, { cx, cy, R, now, from: 7 });
    const at = (h, rr) => [cx + Math.cos(d.hr(h)) * R * rr, cy + Math.sin(d.hr(h)) * R * rr];
    PILLS.forEach(([h, f, lbl, tp]) => { const sp = spring(t, tp, .5); if (sp <= 0) return; const [px, py] = at(h, .56); BL.pill(ctx, px, py, 228 * sc * Z, f, { label: lbl, labelColor: '#2A2440', scale: sp }); });
    // hub face follows the moods
    const mi = now < 12.3 ? 0 : now < 15.8 ? 1 : 2, mk = (m) => BL.face({ L: m.L, M: m.M, cx, cy: cy - 2 * sc * Z, size: 13 * sc * Z, sep: 50 * sc * Z, msize: 12 * sc * Z, mdy: 12 * sc * Z, blink: Math.sin(Math.PI * P(t, 11.7, 11.8)) });
    let hs = mk(MOODS[mi]); const nb = [12.3, 15.8][mi]; if (mi < 2 && now > nb - .5) hs = BL.morph(hs, mk(MOODS[mi + 1]), sstep(nb - .5, nb, now));
    const hw = 128 * sc * Z, hh = 100 * sc * Z;
    BL.led(ctx, { x: cx - hw / 2, y: cy - hh / 2, w: hw, h: hh, r: hh * .44, pitch: 6.5 * sc * Z, mode: 'glow', base: ['#2A2433', '#100D16'], off: 'rgba(255,240,225,.08)', on: '#FFD9C4', core: '#fff',
      edge: Math.max(1, Z * .8), bloom: 8 * Math.sqrt(Z), bloomA: .9, bulge: Z > 2 ? .12 : 0, sheen: .1, sdf: hs });
    // notification ♥
    const nsp = spring(t, 12.3, .5);
    if (nsp > 0) {
      const [bx, by] = at(now, 1.3), s2 = nsp * sc * Z;
      ctx.save(); ctx.translate(bx, by); ctx.scale(s2, s2); ctx.fillStyle = T.tangerine; BL.rrect(ctx, -38, -34, 76, 68, 22); ctx.fill(); ctx.beginPath(); ctx.moveTo(-10, 30); ctx.lineTo(-22, 48); ctx.lineTo(6, 32); ctx.fill(); ctx.restore();
      BL.led(ctx, { x: bx - 30 * s2, y: by - 27 * s2, w: 60 * s2, h: 54 * s2, r: 16 * s2, pitch: 5 * s2, mode: 'ink', off: 'rgba(0,0,0,.07)', on: '#2B0D02', edge: 0, sdf: (px, py) => BL.sd.heart(px - bx, py - by + 2 * s2, 17 * s2) });
    }
    // left column
    const [lx, l1] = mp(110, 380), [, l2] = mp(110, 500), [, l3] = mp(112, 720), [, l4] = mp(116, 790);
    letters(ctx, 'Lives', lx, l1, { size: 104 * Z, color: T.lilac }, t, 10.98, .03, .45);
    letters(ctx, 'your day.', lx, l2, { size: 104 * Z, color: T.lilac }, t, 11.06, .03, .45);
    const hh2 = Math.floor(now), mm = Math.floor((now - hh2) * 60), clk = String(hh2).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    const ca = E.out(2)(P(t, 11.12, 11.3));
    if (ca > 0) BL.ledText(ctx, clk, lx + 2 * Z, l3, { size: 170 * Z, color: T.tangerine, weight: 700, glow: 16 * Z, track: 6 * Z, alpha: ca });
    const lineT = mi === 0 ? 11.2 : tAt([12.3, 15.8][mi - 1]);
    typeLED(ctx, MOODS[mi].line, lx + 6 * Z, l4, { size: 30 * Z, color: T.lilac, weight: 500, track: 1, alpha: .7 }, t, lineT, 46);
    return { vig: .36, ca: 2.5 };
  }

  /* ================= S8 · END 12.9–15.0 ================= */
  const DEV = { cx: 1380, cy: 772, scr: [958, 352, 844, 800], r: 235 };
  const SEQ = [['doze', 12.9], ['zip', 13.4], ['grump', 13.9], ['mochi', 14.4]];
  const DEVFACE = { doze: { L: 'sleepy', M: 'o', on: '#EEEBFF' }, zip: { L: 'wideHi', M: 'smile', on: '#A8FFDC' }, grump: { L: 'angry', M: 'grr', on: '#FFB27A' }, mochi: { L: 'heart', M: 'w', on: '#FFB8EA' } };
  function end(ctx, t) {
    let a = SEQ[0][0], b = null, k = 0;
    for (let i = 1; i < 4; i++) { if (t >= SEQ[i][1] - .14) { a = SEQ[i][0]; b = null; k = 0; if (t < SEQ[i][1] + .14) { a = SEQ[i - 1][0]; b = SEQ[i][0]; k = E.inOut(3)(P(t, SEQ[i][1] - .14, SEQ[i][1] + .14)); } } }
    const s = .6, px0 = 560, py0 = 560 + Math.sin(t * 2.2) * 6;
    const [sa, sb, sw, sh] = DEV.scr, scx = px0 + (sa + sw / 2 - DEV.cx) * s, scy = py0 + (sb + sh * .47 - DEV.cy) * s;
    const Z = zOut(t, 12.9, 13.48, 2.3), mp = (x, y) => [scx + (x - scx) * Z, scy + (y - scy) * Z];
    bgRadial(ctx, '#7A62FF', '#3A22B8', 640, 540, 50, 1500);
    // the pet's aura behind the device, cycling through the four characters
    const [ax, ay] = mp(560, 520);
    BL.pet(ctx, a, { cx: ax, cy: ay + Math.sin(t * 2.2) * 6 * Z, s: 1.22 * Z, t, to: b, k, eyesAlpha: 0, alpha: .95, shadow: false });
    // device photo + its code-lit face
    const [dx, dy] = mp(px0 + (0 - DEV.cx) * s, py0 + (0 - DEV.cy) * s), ds = s * Z;
    const [shx, shy] = mp(px0, py0 + (1330 - DEV.cy) * s);
    ctx.save(); ctx.filter = `blur(${38 * Z}px)`; ctx.globalAlpha = .5; ctx.fillStyle = '#1A0B5A'; ctx.beginPath(); ctx.ellipse(shx, shy, 290 * Z, 30 * Z, 0, 0, 6.2832); ctx.fill(); ctx.restore();
    ctx.drawImage(IMG.dev, dx, dy, 2752 * ds, 1536 * ds);
    const fx = dx + sa * ds, fy = dy + sb * ds, fw = sw * ds, fh = sh * ds, fcx = fx + fw / 2, fcy = fy + fh * .47;
    const ma = BL.petMotion(a, t), mb = b ? BL.petMotion(b, t) : ma, look = lerp(ma.look, mb.look, k) * .4 + 40 * ds * sstep(0, 1, P(t, 13.95, 14.1)) * (1 - sstep(0, 1, P(t, 14.3, 14.45)));
    const mkf = (id, m) => BL.face({ L: DEVFACE[id].L, M: DEVFACE[id].M, cx: fcx, cy: fcy, size: 62 * ds / s, sep: 240 * ds / s, msize: 60 * ds / s, mdy: 18 * ds / s, eyeScale: m.eye, blink: m.blink, lookX: look * ds / s });
    let fs = mkf(a, ma); if (b) fs = BL.morph(fs, mkf(b, mb), k);
    const on = b ? BL.mix(DEVFACE[a].on, DEVFACE[b].on, k) : DEVFACE[a].on;
    BL.led(ctx, { x: fx, y: fy, w: fw, h: fh, r: DEV.r * ds, pitch: 11.5 * ds / s, mode: 'glow', base: ['#0A0812', '#05040A'], off: 'rgba(255,220,245,.07)', on, core: '#FFFFFF',
      edge: 4 * Z, bloom: 14 * Math.sqrt(Z), bloomA: 1, ca: 1.2, spill: .4, bulge: .1, sheen: .1, sdf: fs });
    ctx.save(); BL.rrect(ctx, fx, fy, fw, fh, DEV.r * ds); ctx.clip();
    const gl = ctx.createLinearGradient(fx, fy, fx + fw * .6, fy + fh); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(.35, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fillRect(fx, fy, fw, fh); ctx.restore();
    // the character's little theatre around the device
    BL.petFX(ctx, a, { cx: ax, cy: ay, s: 1.0 * Z, t, alpha: (1 - k) * .9 * P(t, 13.0, 13.2), noBubble: true, noTicks: true });
    if (b) BL.petFX(ctx, b, { cx: ax, cy: ay, s: 1.0 * Z, t, alpha: k * .9, noBubble: true, noTicks: true });
    if (a === 'doze') zzz(ctx, ax + 250 * Z, ay - 250 * Z, Z, t, '#EEEBFF', 1 - k);
    // lockup
    const fsz = 250, base = 600, X0 = 1080;
    ctx.save(); ctx.font = `900 ${fsz}px ${T.display}`; ctx.letterSpacing = `${-fsz * .045}px`; const tw = ctx.measureText('BLIP').width; ctx.restore();
    const [wx, wy] = mp(X0, base);
    letters(ctx, 'BLIP', wx, wy, { size: fsz * Z, color: T.lilac, track: -fsz * .045 * Z }, t, 13.08, .05, .55);
    const msp = spring(t, 13.42, .5);
    if (msp > 0) {
      const mw = fsz * .36, [mx, my] = mp(X0 + tw + fsz * .05 + mw / 2, base - mw * .8 + mw * .8 * .48), w2 = mw * Z * msp, h2 = w2 * .8;
      BL.led(ctx, { x: mx - w2 / 2, y: my - h2 * .48, w: w2, h: h2, r: h2 * .42, pitch: w2 / 14, mode: 'glow', base: ['#1B1430', '#0A0714'], off: 'rgba(255,240,225,.09)', on, core: '#fff',
        edge: 1.2, bloom: w2 * .07, bloomA: .9, bulge: .12, sheen: .12, shadow: .4, sdf: BL.face({ L: 'roundHi', cx: mx, cy: my, size: w2 * .12, sep: w2 * .44, blink: Math.sin(Math.PI * P(t, 14.05, 14.15)) }) });
    }
    const [hx, hy] = mp(X0 + 6, 704);
    typeLED(ctx, 'hatching 11.11', hx, hy, { size: 50 * Z, color: T.lilac, weight: 700, track: 3 * Z, glow: 12, glowColor: '#C9B8FF' }, t, 13.62, 30);
    const bsp = spring(t, 14.0, .5);
    if (bsp > 0) {
      const [bx, by] = mp(X0 + 6 + 145, 754 + 41), bw = 290 * Z * bsp, bh = 82 * Z * bsp;
      ctx.fillStyle = T.bone; BL.rrect(ctx, bx - bw / 2, by - bh / 2, bw, bh, bh / 2); ctx.fill();
      BL.text(ctx, 'Pre-order', bx, by + 12 * Z * bsp, { size: 32 * Z * bsp, weight: 600, family: T.ui, color: T.violet, align: 'center', track: 0 });
    }
    return { vig: .3, ca: 2.5 };
  }

  /* ---------------- timeline ---------------- */
  const SCENES = [[0, hook], [1.6, title], [3.0, grow], [6.4, grid], [7.3, pets], [9.9, cast], [10.9, day], [12.9, end]];
  let IMG = {};
  async function start() {
    await BL.loadFonts();
    const [dev] = await Promise.all(['../assets/dev_cut.png'].map(BL.img)); IMG = { dev };
    window.__seek = async (t) => {
      t = clamp(t, 0, DUR - 1e-4);
      X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.filter = 'none'; X.clearRect(0, 0, W, H);
      let sc = SCENES[0]; for (const s of SCENES) if (t >= s[0]) sc = s;
      let post = { vig: .25, ca: 2 };
      try { post = sc[1](X, t) || post; } catch (e) { const m = sc[1].name + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1]; if (!errs.includes(m)) errs.push(m); }
      X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.filter = 'none';
      BL.post(X, { ca: post.ca, vig: post.vig, grain: .075, seed: Math.round(t * FPS) });
    };
    window.__errors = () => errs;
    window.__comp = { width: W, height: H, fps: FPS, duration: DUR };
    const q = new URLSearchParams(location.search); if (q.has('t')) window.__seek(parseFloat(q.get('t')));
  }
  start();
})();
