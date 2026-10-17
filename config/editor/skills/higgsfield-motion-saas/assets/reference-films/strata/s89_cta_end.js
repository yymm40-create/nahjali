/* Strata 2.0 launch film — s8 CTA (12.0–13.5, dark) + s9 End card (13.5–15.0, light).   · v4
   v4 = reference-style transitions (one continuous canvas, object carry-over) + engine-owned flowing background.
   Scenes are transparent: no full-frame fills, dot grids or grain here (the engine draws the living mesh gradient,
   its dots and one global grain). Local glows that belong to the CTA pill stay. Key frames: frames/08_cta.html @12.85,
   frames/09_end.html @14.6.
   C6 · 11.60–12.25 · Canvas → CTA (carry the Follow button), s8 pre 0.40:
     11.60        s8 draws the selected Profile phone's "Follow" (paper theme, #141414) exactly where s7 holds it (measured
                  in frames/07_canvas.html with zero-size probes at the button's corners: centre (1627.96, 509.24) local,
                  46.75 × 23.49, rotate 4.30° · skewX −4.10°; the engine camera ×1.025 about the centre puts it at
                  (1644.66, 508.47) on screen). s7 hides its own Follow from 11.60.
     11.60–11.70  lift-off: ×1.12 + a soft drop shadow (E.out(2)), the canvas starts to fall away underneath.
     11.70–12.25  flight to the centre (E.smooth, slight −26 px arc) while it morphs into the CTA pill: size grows in log
                  space to 800 × 164 (radius stays full), tilt straightens (11.70–12.10), colour #141414 → violet gradient
                  (11.68–12.05), "Follow" → "Try Strata free" as a vertical roll inside the pill (Follow up and out
                  11.85–11.95, Try in from below 11.92–12.05; never both in the box). At 12.25 it IS the pill (hand-off to
                  the real pill element, pixel-identical).
     12.10–12.40  glow blooms (pool under the pill + the pill's halo).
   s8 in-scene (v3): 12.30–12.80 details soften in · 12.05–12.62 cursor arcs in from bottom-right · 12.70 press + ring +
     "State = Pressed" · 12.70–13.32 particles land on their key-frame spots at 12.85 and dissolve (violet slot #A99BFF
     so the ring keeps its density on the D4 mesh). Engine orbit 12.30–12.90 (×1.05); its return 12.90–13.15 is HELD by
     the scene root (×S_ORB / cam) so the pill does not read as a pull-back before C7; released inside the morph
     (E.in(2)), exactly 1 at 13.42.
   C7 · 13.02–13.50 · CTA → End — the pill LEADS the light (r2): anticipation squeeze 13.02–13.18; details leave
     13.06–13.22, readout 13.10–13.22, cursor slides out 13.08–13.30 (gone 13.28), particles gone ≤ 13.32, label leaves
     13.14–13.26 (×1.22). 13.16–13.29 the pill turns pure white and its halo turns white and blooms (violet pool + flare
     out by 13.28) — at 13.27–13.30 it is the brightest thing in frame, ahead of the engine's light wave (13.20–13.50
     from the centre, opaque core reaches the pill ≈ 13.30). 13.18–13.42 it expands toward the full frame (E.in(2),
     radius → 0) and fades out 13.30–13.42 (fill + bloom), so it is gone before its edge crosses the frame.
   s9 (pre 0.16, from 13.34 — overlaps the dissolving pill, no empty frames): 13.40–14.15 settle ×1.05 → 1 · mark planes
     drop in TOP → bottom 13.36 / 13.43 / 13.50 (the darkest #6B4BFF plane is the first thing on the white) · 13.44–13.98
     wordmark letters rise through a baseline mask · 14.00 url · 13.92–14.58 construction draws on · 14.24 footers
     ("Background · Mesh / L3") · 14.28–14.95 soft light sheen across the lockup (a masked lavender copy of the mark +
     letters — the v3 screen-blend sweep needed an opaque backdrop, which the scene no longer has). */
(function () {
  const F = FILM, E = F.E, P = F.p;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const out2 = E.out(2), soft = E.soft, glide = E.glide, smooth = E.smooth;
  const out3 = E.out(3), in2 = E.in(2), io2 = E.inOut(2);          // v1 transition curves
  const NOCAM = !!new URLSearchParams(location.search).get('nocam');
  const camS = () => (NOCAM || !F.camNow) ? 1 : F.camNow.s;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };
  /* soft entrance: fade (out(2), ≥ .22 s) + travel (dx, dy px) and optional scale s0 → 1 with a long soft settle.
     k multiplies the opacity (exit fades). Uses the individual translate / scale properties so layout transforms stay. */
  const enter = (el, t, t0, o) => {
    o = o || {};
    const d = o.d || 0.5, q = soft(P(t, t0, t0 + d)), f = out2(P(t, t0, t0 + (o.fade || 0.28)));
    el.style.opacity = (f * (o.k == null ? 1 : o.k)).toFixed(3);
    if (o.dx || o.dy) el.style.translate = `${((o.dx || 0) * (1 - q)).toFixed(2)}px ${((o.dy || 0) * (1 - q)).toFixed(2)}px`;
    if (o.s0 != null) el.style.scale = lerp(o.s0, 1, q).toFixed(4);
    return q;
  };
  // measurements must run with the real faces (the film page lays nothing out before build, so fonts.ready can
  // resolve before Inter Tight / Geist Mono are fetched): load them explicitly, then measure with the root shown
  const fontsReady = () => Promise.all([
    document.fonts.load('700 72px "Inter Tight"', 'Try Strata free'), document.fonts.load('700 140px "Inter Tight"', 'stratax'),
    document.fonts.load('500 16px "Geist Mono"', 'Button 0123456789'), document.fonts.load('400 30px "Geist Mono"', 'strata.design'),
    document.fonts.load('500 16px "Inter"', 'a'),
  ]).catch(() => null);
  const measured = (root, id, fn) => fontsReady().then(() => {
    const prev = root.style.display; root.style.display = 'block';
    try { fn(); } catch (e) { FILM.errors.push(id + ' measure: ' + e.message); console.error(id, e); }
    root.style.display = prev;
  });

  /* =====================================================================================
     s8 · CTA (dark)
     ===================================================================================== */
  const A = {};
  const S = 0.965, VIO_T = '#A9AAFF', MUT = '#939496';
  // C7: the morph now starts inside the anticipation and ends at 13.42 (the pill grows while it is still the bright
  // white source; it is at 0 opacity before its edge crosses the frame)
  const T_PRESS = 12.70, T_KEY8 = 12.85, T_MORPH = 13.18, T_MEND = 13.42;
  const T_LIFT = 11.60, T_FLY = 11.70, T_LAND = 12.25, T_HOLD = 12.90;
  /* C6 contract — the s7 key-frame "Follow" button (selected Profile phone, frames/07_canvas.html), scene-local px:
     corners TL (1606.54, 495.94) · TR (1653.15, 499.28) · BR (1649.72, 522.74) · BL (1603.09, 519.07), projected centre
     (1627.96, 509.24); as an affine box: 46.75 × 23.49 (94 × 48 design px × .4977 / .4893), rotate 4.30°, skewX −4.10°.
     Label: Inter 600 16 px "Follow", centred (span 22,14 · 49.9 × 20 in the 94 × 48 box). */
  const FOL = { cx: 1627.96, cy: 509.24, w: 46.752, h: 23.4875, rot: 4.30, skx: -4.10, dw: 93.94, dh: 48 };
  const LIFT = 1.12;
  // the pill's halo (shared by the flying button and the landed pill so the hand-off at T_LAND is identical);
  // sz scales the blur/spread with the box (1 = the 800 × 164 pill)
  // w (C7, 0 → 1): the halo turns white and blooms — the pill becomes the light source ahead of the engine's wave
  // (w = 0 is the v4 violet halo, so the C6 hand-off at T_LAND stays pixel-identical)
  const halo = (bl, fx, sz, rim, dropA, dropS, w = 0) => {
    const c = `${Math.round(lerp(112, 255, w))},${Math.round(lerp(89, 255, w))},255`;
    const a1 = lerp(Math.min(1, 0.75 * bl), 0.9, w), a2 = lerp(0.45 * bl, 0.5, w), fw = fx * (1 - w);
    return `0 0 0 1.5px rgba(255,255,255,${rim.toFixed(3)}) inset, ` +
      (dropA > 0.001 ? `0 ${(3.5 * dropS).toFixed(2)}px ${(9 * dropS).toFixed(2)}px rgba(12,12,30,${dropA.toFixed(3)}), ` : '') +
      `0 0 ${((60 + 24 * fw + 160 * w) * sz).toFixed(2)}px ${((8 + 4 * fw + 40 * w) * sz).toFixed(2)}px rgba(${c},${a1.toFixed(3)}), ` +
      `0 0 ${((200 + 80 * w) * sz).toFixed(2)}px ${((40 + 40 * w) * sz).toFixed(2)}px rgba(${c},${a2.toFixed(3)})`;
  };
  const KP = 8, H0 = 0.70;                        // particles: decay rate of the outward drift · start (fraction of the path)
  // morph box on screen (before the engine camera) for geometry m ∈ [0,1] at pill scale vs; radius → 0 (v1 geometry)
  const morphBox = (m, vs) => {
    const vw = lerp(800 * vs, 1960, m), vh = lerp(164 * vs, 1120, m);
    return { vw, vh, vr: Math.min(vh / 2, 82 * vs + 400 * m) * (1 - m) * (1 - m) };
  };
  // particle colours (lime retired): sky / violet / white
  // v4: the violet slot is lighter (#A99BFF, was #7059FF) so the ring keeps its key-frame density on the engine's
  // D4 violet mesh (#7059FF squares vanished into its #3C2AB4 / #2B1464 blobs); glow alpha stays 66
  const SKY = '#3EB6FF', VIO = '#A99BFF', WHT = '#F0F0F2';

  F.scene({
    id: 's8', t0: 12.0, t1: 13.5, world: 'dark', pre: 0.40,          // v4: from 11.60 (C6 carry)
    build(root) {
      // ---- deterministic pixel ring: same LCG + call order as frames/08_cta.html (positions unchanged) ----
      const rnd = F.rand(7), rnd2 = F.rand(4242);
      let px = ''; A.parts = [];
      for (let i = 0; i < 150; i++) {
        const ang = rnd() * Math.PI * 2, rr = 0.82 + rnd() * 0.42;
        let x = 960 + Math.cos(ang) * 560 * rr, y = 540 + Math.sin(ang) * 300 * rr;
        if (i === 136 || i === 57) { x += 16; y -= 8; }
        if (i === 64 || i === 9) { y -= 12; }
        const s = 8 + Math.round(rnd() * 26);
        // former lime slot → sky or violet (hash of i, so the LCG sequence is untouched)
        const h01 = (((i + 1) * 2654435761) >>> 0) / 4294967296;
        const c = rnd() < .55 ? (h01 < .55 ? SKY : VIO) : (rnd() < .6 ? VIO : WHT);
        const a = Math.max(0, (0.5 + rnd() * 0.5) * (1 - Math.abs(rr - 1.03) * 1.6));
        px += `<i class="abs" style="left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;background:${c};opacity:0;border-radius:3px;box-shadow:0 0 ${s}px ${c}66"></i>`;
        // origin on the pressed pill's edge (stadium 772 × 158, centre 960,540) along the ray centre → particle
        const dx = x - 960, dy = y - 540, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        const hw = 386, hh = 79, cx = hw - hh;
        let se = Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : 1e9;
        if (Math.abs(se * ux) > cx) { const b = cx * Math.abs(ux); se = b + Math.sqrt(Math.max(0, b * b - cx * cx + hh * hh)); }
        // emission spread 0–30 ms; fe = dissolve key (13.06–13.20; each particle is gone by fe + 0.12 ≤ 13.32, before the
        // white core of C7 arrives — same rnd2 call order, so positions/timings of everything else are unchanged)
        const d = rnd2() * 0.03, spin = (rnd2() < .5 ? -1 : 1) * (20 + rnd2() * 40), fe = 13.06 + rnd2() * 0.14;
        // path: from just inside the pressed pill's edge → key-frame spot; they fade up 70 % of the way out (see update8)
        // nk normalises the drift so h = 1 (the key-frame spot) EXACTLY at T_KEY8 for this particle's emission time
        A.parts.push({ a: +a.toFixed(2), ox: 960 + ux * (se - 18) - x, oy: 540 + uy * (se - 18) - y, d, spin: spin * 0.45, fe,
          depth: (s - 8) / 26, nk: 1 / (1 - Math.exp(-KP * (T_KEY8 - T_PRESS - d))) });
      }
      // v4: no dot grid / grain / full-frame fill (engine-owned flowing background); the glow pool + flare are local
      // to the pill (transparent well inside the frame edges)
      root.innerHTML = `
        <div id="s8cam" class="abs" style="inset:0;transform-origin:960px 540px">
          <div id="s8glow" class="abs" style="inset:0;transform-origin:960px 540px;background:radial-gradient(ellipse 38% 34% at 50% 50%, rgba(112,89,255,.55), rgba(13,13,15,0) 72%)"></div>
          <div id="s8flare" class="abs" style="inset:0;opacity:0;transform-origin:960px 540px;background:radial-gradient(ellipse 30% 26% at 50% 50%, rgba(150,132,255,.5), rgba(112,89,255,.16) 55%, rgba(13,13,15,0) 80%)"></div>
          <div id="s8px" class="abs" style="inset:0;transform-origin:960px 540px">${px}</div>
          <div id="s8comp" class="abs" style="inset:0;transform-origin:960px 540px">
            <div id="s8cta" class="abs" style="left:50%;top:50%;transform:translate(-50%,-50%) scale(.965);width:800px;height:164px;border-radius:999px;background:linear-gradient(180deg,#8470FF,#6B4BFF);box-shadow:0 0 0 1.5px rgba(255,255,255,.25) inset, 0 0 60px 8px rgba(112,89,255,.75), 0 0 200px 40px rgba(112,89,255,.45);display:flex;align-items:center;justify-content:center;font:700 72px/1 var(--f-display);letter-spacing:-.025em;color:#fff"><span id="s8ctaT" style="display:block;white-space:nowrap">Try Strata free</span></div>
            <div id="s8det" class="abs" style="left:0;top:0"></div>
          </div>
          <div id="s8fly" class="abs" style="left:0;top:0;width:0;height:0;display:none">
            <div id="s8flyB" class="abs" style="left:0;top:0;border-radius:999px;overflow:hidden">
              <div id="s8flyF" class="abs" style="left:50%;top:50%;font:600 16px/20px var(--f-text);color:#fff;white-space:nowrap">Follow</div>
              <div id="s8flyT" class="abs" style="left:50%;top:50%;font:700 72px/1 var(--f-display);letter-spacing:-.025em;color:#fff;white-space:nowrap;opacity:0">Try Strata free</div>
            </div>
          </div>
        </div>
        <div id="s8ring" class="abs" style="left:0;top:0;width:0;height:0;border-radius:50%;border:2px solid rgba(240,240,242,.6);opacity:0"></div>
        <div id="s8tipw" class="abs" style="left:0;top:0"></div>
        <div id="s8cur" class="abs" style="left:1210px;top:560px;transform-origin:5.33px 4px">${K.arrow('#F0F0F2', '#131415', 64)}</div>`;
      const q = (s) => root.querySelector(s);
      Object.assign(A, { root, cam: q('#s8cam'), glow: q('#s8glow'), flare: q('#s8flare'), pxw: q('#s8px'),
        comp: q('#s8comp'), pill: q('#s8cta'), txt: q('#s8ctaT'), det: q('#s8det'), cur: q('#s8cur'), tipw: q('#s8tipw'), ring: q('#s8ring'),
        fly: q('#s8fly'), flyB: q('#s8flyB'), flyF: q('#s8flyF'), flyT: q('#s8flyT') });
      A.px = [...q('#s8px').children];
      this.ready = measured(root, 's8', () => measure8(root));
    },
    update(lt, t) { update8(t); },
  });

  // ---- design details, measured from the rendered pill exactly like the key frame ----
  function measure8(root) {
      const R0 = root.getBoundingClientRect();
      const pr = A.pill.getBoundingClientRect();
      const P_ = { left: pr.left - R0.left, top: pr.top - R0.top, width: pr.width, height: pr.height };
      P_.right = P_.left + P_.width; P_.bottom = P_.top + P_.height;
      const rg = document.createRange(); rg.selectNodeContents(A.pill);
      const trr = rg.getBoundingClientRect();
      const Tb = { left: trr.left - R0.left - 2, top: trr.top - R0.top - 2, width: trr.width + 4, height: trr.height + 4 };
      const L = P_.left, R = P_.right, Tp = P_.top, B = P_.bottom, cy = (Tp + B) / 2, cx = (L + R) / 2;
      const dd = (v) => Math.round(v / S);
      const W = dd(P_.width), H = dd(P_.height), rad = Math.round(H / 2);
      const padL = dd(Tb.left - L), padT = dd(Tb.top - Tp);
      A.vals = { W, H, rad, padL, padT };
      const lab = (id, x, y, text, o) => {
        o = o || {}; const sz = o.size || 16, col = o.color || MUT;
        const tr = o.align === 'right' ? 'translate(-100%,-50%)' : 'translateY(-50%)';
        const ic = o.icon ? (o.icon === 'chip' ? o.chip : K.glyph(o.icon, sz + 2, o.iconColor || col)) : '';
        return `<div id="${id}" class="abs mono" style="left:${x}px;top:${y}px;transform:${tr};font:500 ${sz}px/1 var(--f-mono);color:${col};white-space:nowrap;display:flex;align-items:center;gap:8px">${ic}<span>${text}</span></div>`;
      };
      let h = '';
      h += `<div id="s8sel" class="abs" style="left:0;top:0">${K.sel(L - 1.5, Tp - 1.5, P_.width + 3, P_.height + 3)}</div>`;
      h += lab('s8name', L - 1, Tp - 30, 'Button / Primary / Large', { icon: 'instance', color: VIO_T });
      h += lab('s8click', R + 1, Tp - 30, 'On click → Sign up', { align: 'right', icon: 'play', iconColor: VIO_T, color: MUT });
      h += `<div id="s8dim" class="abs" style="left:0;top:0">${K.dim(cx, B + 22, `${W} × ${H}`)}</div>`;
      h += `<div id="s8tbox" class="abs" style="left:${Tb.left}px;top:${Tb.top}px;width:${Tb.width}px;height:${Tb.height}px;outline:1px solid ${K.T.measure}"></div>`;
      h += `<div id="s8rlL" class="abs" style="left:0;top:0">${K.redline(L, cy, Tb.left, cy, String(padL))}</div>`;
      const tx = Tb.left + Tb.width / 2;
      h += `<div id="s8rlT" class="abs" style="left:0;top:0">${K.redline(tx, Tp, tx, Tb.top, '')}</div>`;
      h += `<div id="s8padT" class="abs mono" style="left:${tx + 9}px;top:${(Tp + Tb.top) / 2}px;transform:translateY(-50%);background:${K.T.measure};color:#fff;font:500 14px/1 var(--f-mono);padding:5px 7px;border-radius:5px;white-space:nowrap">${padT}</div>`;
      const capR = P_.height / 2, ccx = L + capR, a45 = Math.SQRT1_2;
      const rx = ccx - capR * a45 + 14, ry = cy - capR * a45 + 14;
      h += `<div id="s8rdot" class="abs" style="left:0;top:0">${K.radiusDot(rx, ry).replace('border:', 'box-shadow:0 0 0 1.5px rgba(19,20,21,.38);border:')}</div>`;
      h += lab('s8rlab', rx + 14, ry, `R ${rad}`, { color: 'rgba(255,255,255,.82)', size: 15 });
      h += lab('s8spec0', L - 1, B + 36, 'Inter Tight 700 · 72 · −2.5%', { icon: 'text' });
      const chip = `<i style="width:16px;height:16px;border-radius:4px;background:linear-gradient(180deg,#8470FF,#6B4BFF);box-shadow:inset 0 0 0 1px rgba(255,255,255,.28);display:block;flex:none;margin:0 1px"></i>`;
      h += lab('s8spec1', L - 1, B + 64, '#8470FF → #6B4BFF', { icon: 'chip', chip });
      const fx = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${MUT}" stroke-width="2" stroke-linecap="round" style="display:block;flex:none"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>`;
      h += lab('s8spec2', L - 1, B + 92, 'Shadow · Blur 200 · 45%', { icon: 'chip', chip: fx });
      A.det.innerHTML = h;
      // cursor readout (rides with the cursor; key position 1240, B + 22)
      A.tipw.innerHTML = K.tip(1240, B + 22, 'State = Pressed', 'dark', { center: true });
      A.tip = A.tipw.firstElementChild;

      const d = (s) => A.det.querySelector(s);
      A.sel = d('#s8sel .sel'); A.handles = [...A.sel.querySelectorAll('.h')];
      A.name = d('#s8name'); A.click = d('#s8click');
      A.dim = d('#s8dim').firstElementChild; A.tbox = d('#s8tbox');
      const rlL = d('#s8rlL'), rlT = d('#s8rlT');
      A.rlL = { main: rlL.querySelectorAll('line')[0], t: [...rlL.querySelectorAll('line')].slice(1), chip: rlL.querySelector('div') };
      A.rlT = { main: rlT.querySelectorAll('line')[0], t: [...rlT.querySelectorAll('line')].slice(1) };
      A.padT = d('#s8padT'); A.rdot = d('#s8rdot').firstElementChild; A.rlab = d('#s8rlab'); A.rlabT = A.rlab.querySelector('span');
      A.spec = [d('#s8spec0'), d('#s8spec1'), d('#s8spec2')];
      A.tbW = Tb.width;
      F.drawOn(A.rlL.main, 1); F.drawOn(A.rlT.main, 1);
  }

  /* ---- C6 carry: the s7 "Follow" button lifts off, flies to the centre and becomes the CTA pill ----
     returns the colour progress k (0 = #141414 Follow, 1 = violet CTA); the element is shown only before T_LAND */
  function carry(t, gb) {
      const k = smooth(P(t, 11.68, 12.05));
      if (t >= T_LAND) { A.fly.style.display = 'none'; return k; }
      A.fly.style.display = 'block';
      const lf = out2(P(t, T_LIFT, T_FLY));                         // lift-off ×1.12 + drop shadow
      const L = 1 + (LIFT - 1) * lf;
      const q = smooth(P(t, T_FLY, T_LAND));                        // flight (position + size)
      const qt = smooth(P(t, T_FLY, 12.10));                        // tilt straightens a little earlier
      const w0 = FOL.w * L, h0 = FOL.h * L;
      const W = Math.exp(lerp(Math.log(w0), Math.log(800), q)), H = Math.exp(lerp(Math.log(h0), Math.log(164), q));
      const cx = lerp(FOL.cx, 960, q), cy = lerp(FOL.cy, 540, q) - 26 * Math.sin(Math.PI * q);
      A.fly.style.transform = `translate(${cx.toFixed(3)}px,${cy.toFixed(3)}px) rotate(${(FOL.rot * (1 - qt)).toFixed(4)}deg) skewX(${(FOL.skx * (1 - qt)).toFixed(4)}deg)`;
      const B = A.flyB.style;
      B.left = (-W / 2).toFixed(3) + 'px'; B.top = (-H / 2).toFixed(3) + 'px';
      B.width = W.toFixed(3) + 'px'; B.height = H.toFixed(3) + 'px'; B.borderRadius = (H / 2).toFixed(3) + 'px';
      B.background = `linear-gradient(180deg,${mix('#141414', '#8470FF', k)},${mix('#141414', '#6B4BFF', k)})`;
      const sz = H / 164;
      B.boxShadow = halo(0.45 * k + 0.55 * gb, 0, sz, 0.25 * k, 0.34 * lf * (1 - k), lf * H / h0);
      // labels scale with the box: "Follow" at its button proportion, "Try Strata free" at the pill's
      // v4 label swap = a vertical roll inside the pill (#s8flyB clips): "Follow" rolls up and out 0 → −0.8·H (E.in(2),
      // 11.85–11.95), "Try Strata free" rolls in from +0.8·H → 0 (E.out(3), 11.92–12.05) and settles from ×.86. At ±0.8·H
      // each label is fully outside the box, so the two words never share a frame (no "TrFollowee").
      const fo = in2(P(t, 11.85, 11.95)), fi = out3(P(t, 11.92, 12.05));
      const sF = Math.min(W / FOL.dw, H / FOL.dh), sT = Math.min(W / 800, H / 164) * lerp(0.86, 1, E.soft(P(t, 11.91, 12.12)));
      A.flyF.style.transform = `translate(-50%,-50%) translateY(${(-0.8 * H * fo).toFixed(3)}px) scale(${sF.toFixed(5)})`;
      A.flyF.style.opacity = (1 - P(t, 11.90, 11.95)).toFixed(3);
      A.flyT.style.transform = `translate(-50%,-50%) translateY(${(0.8 * H * (1 - fi)).toFixed(3)}px) scale(${sT.toFixed(5)})`;
      A.flyT.style.opacity = t < 11.92 ? '0' : P(t, 11.92, 11.95).toFixed(3);
      return k;
  }

  function update8(t) {
      const cs = camS();
      const mq = in2(P(t, T_MORPH, T_MEND));                  // v1 morph growth: accelerates into the cut (13.18–13.42)
      /* ---- no camera pull-back before C7: the engine's orbit return (12.90–13.15, ×1.05 → 1) would stack on the v1
         anticipation squeeze and read as a pull-back right before the expansion. The scene root (centred on the camera
         target, so a root scale == a camera zoom) holds the orbit's ×S_ORB from 12.90 through 13.25 and releases it
         inside the morph with the morph's own E.in(2) — hold ≥ 1 there (frame coverage kept) and exactly 1 at 13.50. ---- */
      const S_ORB = NOCAM ? 1 : F.camAt(T_HOLD - 1e-4).s;
      const hold = t < T_HOLD ? 1 : (S_ORB / cs) * (t < T_MORPH ? 1 : lerp(1, 1 / S_ORB, mq));
      A.root.style.transform = hold === 1 ? 'none' : `scale(${hold.toFixed(5)})`;
      const ce = cs * hold;                                    // effective camera zoom on screen (parallax reads this)
      A.cam.style.transform = 'none';                          // v4: no v1 arrival push — the pill is carried in (C6)

      /* ---- glow bloom 12.10–12.40 as the carried button lands + soft press bloom (v2) ---- */
      const gb = out3(P(t, 12.10, 12.40));
      const kc = carry(t, gb);
      const flare = glide(P(t, T_PRESS - 0.01, T_PRESS + 0.21)) * (1 - glide(P(t, T_PRESS + 0.21, 13.30)));
      /* ---- press (v2) + anticipation squeeze before the morph (v1); component wrapper, details hug the pill ---- */
      const pd = smooth(P(t, T_PRESS, T_PRESS + 0.12)), an = io2(P(t, 13.02, T_MORPH));
      const press = 1 - 0.035 * pd - 0.016 * an;              // .965 at the key frame
      A.comp.style.transform = `scale(${(press / S).toFixed(5)})`;
      /* v4 C7: the pill LEADS the engine's light wave (13.20–13.50 from the centre; its opaque core reaches the pill's
         edge ≈ 13.30): it turns pure white 13.16–13.29 and its halo turns white and blooms, so at 13.27–13.30 it is the
         brightest thing in frame — the light pours out of it. The violet pool + press flare under it are gone by 13.28. */
      const mk = io2(P(t, 13.16, 13.29)), mg = io2(P(t, 13.16, 13.28));
      A.glow.style.opacity = (gb * (1 - mg)).toFixed(3);
      A.glow.style.transform = `scale(${(0.78 + 0.22 * gb + 0.06 * flare + 0.5 * mq).toFixed(4)})`;
      A.flare.style.opacity = (0.55 * flare * (1 - mg)).toFixed(3);
      A.flare.style.transform = `scale(${(0.92 + 0.12 * flare).toFixed(4)})`;

      /* ---- pill: takes over from the carried button at T_LAND (identical frame), then (v1) morphs into the full
         light frame and dissolves into the engine's light (C7) ---- */
      A.pill.style.visibility = t < T_LAND ? 'hidden' : 'visible';
      const bl = 0.45 * kc + 0.55 * gb + 0.3 * flare;
      A.pill.style.boxShadow = halo(bl, flare, 1, 0.25 * (1 - mk), 0, 0, mk);
      // after 13.30 it is white on white: it keeps expanding and fades out (fill + bloom together) 13.30–13.42, i.e. it is
      // gone before its edge crosses the frame (no off-white "ghost card" over the L3 mesh)
      A.pill.style.opacity = (1 - glide(P(t, 13.30, T_MEND))).toFixed(3);
      A.pill.style.background = mk > 0 ? `linear-gradient(180deg,${mix('#8470FF', '#FFFFFF', mk)},${mix('#6B4BFF', '#FFFFFF', mk)})` : 'linear-gradient(180deg,#8470FF,#6B4BFF)';
      if (t < T_MORPH) {
        A.pill.style.width = '800px'; A.pill.style.height = '164px'; A.pill.style.borderRadius = '999px';
      } else {
        const vs = press, b = morphBox(mq, vs);              // visual scale of the pill box (comp × .965 × squeeze)
        A.pill.style.width = (b.vw / vs).toFixed(2) + 'px'; A.pill.style.height = (b.vh / vs).toFixed(2) + 'px';
        A.pill.style.borderRadius = (b.vr / vs).toFixed(2) + 'px';
      }
      /* ---- label (v1): leaves 13.14–13.26 (before the pill is white) while it grows ×1.22 into the morph ---- */
      const to = out2(P(t, 13.14, 13.26));
      A.txt.style.opacity = (1 - to).toFixed(3);
      A.txt.style.filter = 'none';
      A.txt.style.transform = `scale(${(1 + 0.22 * in2(P(t, 13.14, 13.34))).toFixed(4)})`;

      /* ---- design details soften in 12.30–12.80 (v2, after the hero settles), leave 13.06–13.22 (E.in(2)) — gone before
         the pill turns white, so no red chips ghost over the brightening pill ---- */
      const dOut = 1 - in2(P(t, 13.06, 13.22));
      A.det.style.opacity = dOut.toFixed(3);
      // selection: fades on with a hair of settle; handles follow (60 ms stagger)
      A.sel.style.opacity = out2(P(t, 12.30, 12.58)).toFixed(3);
      A.sel.style.transform = `scale(${lerp(1.012, 1, soft(P(t, 12.30, 12.85))).toFixed(5)})`;
      A.handles.forEach((hd, i) => {
        const t0 = 12.34 + 0.06 * i;
        hd.style.opacity = out2(P(t, t0, t0 + 0.24)).toFixed(3);
        hd.style.transform = `scale(${lerp(0.9, 1, soft(P(t, t0, t0 + 0.45))).toFixed(4)})`;
      });
      enter(A.name, t, 12.36, { dx: -10, d: 0.45 });
      enter(A.click, t, 12.42, { dx: 10, d: 0.45 });
      // text-layer outline opens from its centre
      const tb = smooth(P(t, 12.40, 12.84));
      const ti = ((1 - tb) * A.tbW / 2 - 3).toFixed(2);
      A.tbox.style.clipPath = `inset(-3px ${ti}px -3px ${ti}px)`;
      A.tbox.style.opacity = out2(P(t, 12.40, 12.62)).toFixed(3);
      // readouts measure the pill AFTER it has settled (800 × 164 · 176 · 36 · R 82, written at build from the
      // measured geometry): they never tick, they only fade + rise 8–10 px once their redline / handle is in place.
      // left padding redline: draws from the pill edge to the text box, then its value
      const l1 = smooth(P(t, 12.42, 12.80));
      F.drawOn(A.rlL.main, l1);
      A.rlL.t[0].style.opacity = out2(P(t, 12.42, 12.64)).toFixed(3); A.rlL.t[1].style.opacity = out2(P(t, 12.66, 12.86)).toFixed(3);
      enter(A.rlL.chip, t, 12.50, { dy: 8, d: 0.4 });
      // top padding redline (short, vertical) + its value
      const l2 = smooth(P(t, 12.46, 12.78));
      F.drawOn(A.rlT.main, l2);
      A.rlT.t[0].style.opacity = out2(P(t, 12.46, 12.68)).toFixed(3); A.rlT.t[1].style.opacity = out2(P(t, 12.62, 12.84)).toFixed(3);
      enter(A.padT, t, 12.54, { dy: 8, d: 0.4 });
      // corner radius handle + readout
      const rq = soft(P(t, 12.48, 12.93));
      A.rdot.style.opacity = out2(P(t, 12.48, 12.72)).toFixed(3);
      A.rdot.style.transform = `scale(${lerp(0.9, 1, rq).toFixed(4)})`;
      enter(A.rlab, t, 12.52, { dy: 8, d: 0.45 });
      // dimension badge fades up under the selection
      enter(A.dim, t, 12.46, { dy: 10, d: 0.45 });
      // type / fill / effect spec under the left edge
      A.spec.forEach((el, i) => enter(el, t, 12.52 + 0.06 * i, { dx: -10, d: 0.45 }));

      /* ---- cursor: arcs in from bottom-right (v1 path + start, just after the cut) with v2's calm E.glide timing
         12.05–12.62 (peak ≈ 98 px/frame instead of v1's 170 px/frame whip), dwells, press at 12.70 (v2), slides out
         13.08–13.30 (×1.5 v1 travel) and is gone by 13.28, before the white core arrives ---- */
      const cu = glide(P(t, 12.05, 12.62));
      const sx = 720, sy = 590, ch = Math.hypot(sx, sy), nx = sy / ch, ny = -sx / ch, bow = 0.1 * ch * Math.sin(Math.PI * cu);
      let ox = sx * (1 - cu) + nx * bow, oy = sy * (1 - cu) + ny * bow;
      const cx = in2(P(t, 13.08, 13.30));
      ox += 450 * cx; oy += 360 * cx;
      const csq = t < T_PRESS + 0.12 ? lerp(1, 0.92, smooth(P(t, T_PRESS, T_PRESS + 0.12))) : lerp(0.92, 1, smooth(P(t, T_PRESS + 0.12, T_PRESS + 0.32)));
      A.cur.style.transform = `translate(${ox.toFixed(2)}px,${oy.toFixed(2)}px) scale(${csq.toFixed(4)})`;
      // (it enters from off-frame bottom-right, so the fade-in is never seen; exit fade 13.14–13.28)
      A.cur.style.opacity = (out2(P(t, 12.05, 12.20)) * (1 - P(t, 13.14, 13.28))).toFixed(3);
      // soft click ring at the cursor tip (same language as s7's cursors: 9 → 24 px radius); sin envelope over 0.4 s
      const rp = P(t, T_PRESS + 0.02, T_PRESS + 0.42), rs = 9 + 15 * out2(rp);
      A.ring.style.width = A.ring.style.height = (2 * rs).toFixed(2) + 'px';
      A.ring.style.transform = `translate(${(1210 + 5.33 + ox - rs).toFixed(2)}px,${(560 + 4 + oy - rs).toFixed(2)}px)`;
      A.ring.style.opacity = rp > 0 && rp < 1 ? (0.5 * Math.sin(Math.PI * rp)).toFixed(3) : 0;
      // readout rides with the cursor: fades + rises 10 px with the press (v2), leaves 13.10–13.22 (v1)
      const tq = soft(P(t, T_PRESS, T_PRESS + 0.36));
      A.tip.style.translate = `${ox.toFixed(2)}px ${(oy + 10 * (1 - tq)).toFixed(2)}px`;
      A.tip.style.opacity = (out2(P(t, T_PRESS, T_PRESS + 0.22)) * (1 - P(t, 13.10, 13.22))).toFixed(3);

      /* ---- particles: the click's energy — squares fade up on the way out (h0 = 70 % of the edge → ring path),
         drift outward decelerating, land on the key-frame ring (h = 1) exactly at 12.85 (unrotated from there on),
         keep drifting outward while they dissolve (E.in(2) from 12.90, gone by fe + 0.12 = 13.18–13.32, before C7's white core).
         Larger squares (nearer) drift farther and get more camera parallax. */
      A.pxw.style.transform = `scale(${(1 + 0.6 * (ce - 1)).toFixed(5)})`;
      for (let i = 0; i < A.px.length; i++) {
        const pp = A.parts[i], el = A.px[i];
        const ts = T_PRESS + pp.d;
        if (t < ts || pp.a === 0) { el.style.opacity = 0; continue; }
        const x = t - ts;
        let h = H0 + (1 - H0) * pp.nk * (1 - Math.exp(-KP * x));   // = 1 at T_KEY8 (key-frame ring), then drifts on
        if (h > 1) h = 1 + (h - 1) * (0.6 + 0.8 * pp.depth);
        const fo = in2(P(t, 12.9, pp.fe + 0.12));
        const sc = lerp(0.6, 1, cl(h, 0, 1)) * (1 - 0.3 * fo);
        el.style.transform = `translate(${(pp.ox * (1 - h)).toFixed(2)}px,${(pp.oy * (1 - h)).toFixed(2)}px) rotate(${(pp.spin * (1 - Math.min(h, 1))).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        el.style.opacity = (pp.a * out2(P(x, 0, 0.22)) * (1 - fo)).toFixed(3);
      }
  }

  /* =====================================================================================
     s9 · End card (light)
     ===================================================================================== */
  const B9 = {};
  F.scene({
    id: 's9', t0: 13.5, t1: 15.0, world: 'light', pre: 0.16,          // v4: from 13.34 — the top mark plane drops in from 13.36 over the dissolving white pill
    build(root) {
      root.innerHTML = `
        <div id="s9cam" class="abs" style="inset:0;transform-origin:960px 500px">
          <div id="s9under" class="abs" style="inset:0"></div>
          <div id="s9lock" class="abs" style="left:50%;top:500px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:30px">
            <div style="margin-top:4px">${K.logo(128, 'light')}</div>${K.wordmark(140, '#131415')}</div>
          <div id="s9letters" class="abs" style="left:0;top:0;width:1920px"></div>
          <div id="s9url" class="abs mono" style="left:0;right:0;top:640px;text-align:center;font-size:30px;letter-spacing:.02em;color:#737376">strata.design</div>
          <div id="s9sheen" class="abs" style="left:0;top:0;width:1920px;height:1080px;opacity:0;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat"></div>
          <div id="s9over" class="abs" style="inset:0"></div>
        </div>`;
      this.ready = measured(root, 's9', () => measure9(root));
    },
    update(lt, t) { update9(t); },
  });

  function measure9(root) {
      const q = (s) => root.querySelector(s);
      const R0 = root.getBoundingClientRect();
      const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left - R0.left, top: r.top - R0.top, width: r.width, height: r.height, right: r.right - R0.left, bottom: r.bottom - R0.top }; };
      const CONC = 'rgba(19,20,21,.20)', R = K.T.measure, MUT9 = '#737376', SUB = '#919194';
      const px = (v) => Math.round(v - 0.5) + 0.5;

      // mark geometry (logo viewBox 0..100)
      const svg = q('#s9lock svg'), lg = rect(svg), u = lg.width / 100;
      const X = (v) => lg.left + v * u, Y = (v) => lg.top + v * u;
      const mL = X(6), mR = X(94), mT = Y(6), mB = Y(96), mCx = X(50);
      const layY = [Y(30), Y(51), Y(72)];
      const layHex = ['#6B4BFF', '#A08EFF', '#D8D0FF'];
      // wordmark metrics via canvas (same as the key frame)
      const wm = q('#s9lock span');
      const cs = getComputedStyle(wm), sp = rect(wm), fs = parseFloat(cs.fontSize);
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${cs.fontWeight} ${cs.fontSize} "Inter Tight"`; c.letterSpacing = cs.letterSpacing;
      const m = c.measureText('strata');
      const base = sp.top + (fs - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      const xh = base - c.measureText('x').actualBoundingBoxAscent;
      const inkL = sp.left - m.actualBoundingBoxLeft, inkR = sp.left + m.actualBoundingBoxRight;
      const x = inkL - mR;
      const bT = Math.min(mT, base - m.actualBoundingBoxAscent), bB = Math.max(mB, base + m.actualBoundingBoxDescent);
      const zL = mL - x, zR = inkR + x, zT = bT - x, zB = bB + x;

      // ---- wordmark → per-letter spans at the measured (kerned) positions; the original span stays for layout ----
      const tn = wm.firstChild, rg = document.createRange();
      let lh = '';
      for (let i = 0; i < tn.length; i++) {
        rg.setStart(tn, i); rg.setEnd(tn, i + 1);
        const r = rg.getBoundingClientRect();
        lh += `<span style="position:absolute;left:${(r.left - R0.left).toFixed(3)}px;top:0;font:700 140px/1 var(--f-display);letter-spacing:-.045em;color:#131415;white-space:pre">${tn.data[i]}</span>`;
      }
      const lw = q('#s9letters');
      lw.style.top = sp.top + 'px'; lw.style.height = sp.height + 'px';
      lw.style.clipPath = `inset(-80px 0 ${Math.max(0, sp.height - (base - sp.top) - 4).toFixed(2)}px 0)`;   // the letters rise out of a slot at the baseline
      lw.innerHTML = lh;
      wm.style.visibility = 'hidden';

      // ---- under: construction hairlines (each line: origin → target, drawn by moving its free end) ----
      const swR = Math.round(zL) - 30;
      const lines = [];   // {id, ox, oy, tx, ty, dash, stroke}
      layY.forEach((y, i) => lines.push({ k: 'lead' + i, ox: i === 0 ? mR : mCx, oy: px(y), tx: swR + 8, ty: px(y) }));
      const tgL = mR + 5;
      lines.push({ k: 'tgx', ox: tgL, oy: px(xh), tx: zR + 14, ty: px(xh), dash: '4 4' });
      lines.push({ k: 'tgb', ox: tgL, oy: px(base), tx: zR + 14, ty: px(base), dash: '4 4' });
      lines.push({ k: 'stub', ox: zR, oy: px(zB), tx: zR + 14, ty: px(zB), dash: '4 4', stroke: 'rgba(19,20,21,.24)' });
      const X0 = px(zL), Y0 = px(zT), X1 = X0 + Math.round(zR - zL), Y1 = Y0 + Math.round(zB - zT);
      const zs = 'rgba(19,20,21,.24)';
      lines.push({ k: 'zT', ox: X0, oy: Y0, tx: X1, ty: Y0, dash: '5 5', stroke: zs });
      lines.push({ k: 'zL', ox: X0, oy: Y0, tx: X0, ty: Y1, dash: '5 5', stroke: zs });
      lines.push({ k: 'zB', ox: X1, oy: Y1, tx: X0, ty: Y1, dash: '5 5', stroke: zs });
      lines.push({ k: 'zR', ox: X1, oy: Y1, tx: X1, ty: Y0, dash: '5 5', stroke: zs });
      let us = `<svg class="abs" style="left:0;top:0;overflow:visible" width="1920" height="1080"><g stroke="${CONC}" stroke-width="1" fill="none">`;
      lines.forEach((L) => { us += `<line data-k="${L.k}" x1="${L.ox}" y1="${L.oy}" x2="${L.tx}" y2="${L.ty}"${L.dash ? ` stroke-dasharray="${L.dash}"` : ''}${L.stroke ? ` stroke="${L.stroke}"` : ''}/>`; });
      // vertical axis of the mark (grows from its middle)
      us += `<line data-k="axis" x1="${px(mCx)}" y1="${zT}" x2="${px(mCx)}" y2="${zB}"/>`;
      us += `</g></svg>`;
      q('#s9under').innerHTML = us;
      B9.lines = {};
      lines.forEach((L) => { L.el = q(`#s9under line[data-k="${L.k}"]`); B9.lines[L.k] = L; });
      B9.axis = { el: q('#s9under line[data-k="axis"]'), x: px(mCx), y0: zT, y1: zB, ym: (zT + zB) / 2 };

      // ---- over: measurements + labels ----
      const mono = (sz, col) => `font:500 ${sz}px/1 var(--f-mono);color:${col};white-space:nowrap`;
      const xchip = `background:#FAFAFC;color:${R};font:500 15px/1 var(--f-mono);padding:3px 5px 4px;border-radius:4px`;
      const xsq = (id, qx, qy, s) => `<div id="${id}" class="abs" style="left:${qx}px;top:${qy}px;width:${s}px;height:${s}px;background:repeating-linear-gradient(-45deg, ${R}38 0 2px, transparent 2px 7px);outline:1px solid ${R}80;outline-offset:-1px">
          <div class="mono" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);${xchip}">x</div></div>`;
      let o = '';
      const qs = Math.round(x);
      [[zL, zT], [inkR, zT], [zL, bB], [inkR, bB]].forEach(([qx, qy], i) => { o += xsq('s9xq' + i, Math.round(qx), Math.round(qy), qs); });
      const gy = Math.round((bB + zB) / 2);
      const exT = Math.round(layY[2]) + 12;
      o += `<svg id="s9ext" class="abs" style="left:0;top:0;overflow:visible" width="1920" height="1080"><g stroke="${R}99" stroke-width="1">
        <line x1="${px(mR)}" y1="${exT}" x2="${px(mR)}" y2="${gy + 8}"/><line x1="${px(inkL)}" y1="${exT}" x2="${px(inkL)}" y2="${gy + 8}"/></g></svg>`;
      o += `<div id="s9gap" class="abs" style="left:0;top:0">${K.redline(px(mR), gy, px(inkL), gy, null)}</div>`;
      o += `<div id="s9gapx" class="abs mono" style="left:${(mR + inkL) / 2}px;top:${gy}px;transform:translate(-50%,-50%);${xchip}">x</div>`;
      const anchor = (id, ax, ay) => `<i id="${id}" class="abs" style="left:${ax - 3}px;top:${ay - 3}px;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px ${MUT9}"></i>`;
      layY.forEach((y, i) => {
        o += `<div id="s9sw${i}" class="abs" style="left:${swR - 12}px;top:${Math.round(y) - 6}px;width:12px;height:12px;border-radius:3px;background:${layHex[i]};box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)"></div>`;
        o += `<div id="s9hx${i}" class="abs mono" style="left:${swR - 22}px;top:${Math.round(y) - 7}px;transform:translateX(-100%);${mono(14, MUT9)}">${layHex[i]}</div>`;
        o += anchor('s9an' + i, mL, y);
      });
      o += anchor('s9an3', mR, layY[0]);
      o += `<div id="s9lx" class="abs mono" style="left:${Math.round(zR) + 24}px;top:${Math.round(xh) - 7}px;${mono(14, MUT9)}">x-height</div>`;
      o += `<div id="s9lb" class="abs mono" style="left:${Math.round(zR) + 24}px;top:${Math.round(base) - 7}px;${mono(14, MUT9)}">baseline</div>`;
      o += `<div id="s9lc" class="abs mono" style="left:${Math.round(zR) + 24}px;top:${Math.round(zB) - 7}px;${mono(14, MUT9)}">clear space <span style="color:${R}">x</span></div>`;
      o += `<div id="s9fl" class="abs" style="left:0;top:0">${K.frameLabel(Math.round(zL), Math.round(zT) - 30, 'Lockup / Horizontal', 'light', { icon: 'component', color: K.T.seed, size: 15 })}</div>`;
      o += `<div id="s9ts" class="abs" style="left:${Math.round(zR)}px;top:${Math.round(zT) - 30}px;transform:translateX(-100%)">${K.frameLabel(0, 0, 'Inter Tight · Bold · 140 · −4.5%', 'light', { icon: 'text', size: 15 }).replace('class="abs mono"', 'class="mono"')}</div>`;
      o += `<div id="s9f0" class="abs mono" style="left:64px;top:1002px;${mono(14, SUB)}">Strata 2.0 — Brand / Logo</div>`;
      o += `<div id="s9f1" class="abs mono" style="right:64px;top:1002px;display:flex;align-items:center;gap:8px;${mono(14, SUB)}">Background<i style="width:12px;height:12px;border-radius:3px;background:linear-gradient(135deg,#ECE9FF,#FAFAFC);box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);display:block;margin-left:4px"></i>Mesh / L3</div>`;
      q('#s9over').innerHTML = o;

      /* ---- sheen (v4): a lavender copy of the mark + letters (final pose) revealed by a moving, 18°-slanted band mask.
         Same look as v3's screen-blend sweep over the lockup (screen of rgba(186,176,255,.3) on #131415 ≈ this copy at
         .3 over it), but it needs no opaque backdrop. Band geometry = v3's sweep element: 240 px wide, skewX(−18°) about
         the lockup box's centre row, x = (mL − 24) − 300 + (W + 360)·glide(sq) + 120. ---- */
      const sh = q('#s9sheen');
      const mk = document.createElement('div');
      mk.className = 'abs'; mk.style.cssText = `left:${lg.left}px;top:${lg.top}px;width:${lg.width}px;height:${lg.height}px`;
      const sv = svg.cloneNode(true);
      sv.querySelectorAll('path').forEach((p) => { p.setAttribute('fill', 'rgb(206,198,255)'); p.setAttribute('fill-opacity', '0.3'); p.removeAttribute('style'); });
      mk.appendChild(sv); sh.appendChild(mk);
      const lc = lw.cloneNode(true); lc.removeAttribute('id');
      [...lc.children].forEach((sp9) => { sp9.style.color = 'rgba(186,176,255,.31)'; });
      sh.appendChild(lc);
      B9.sheen = { el: sh, x0: mL - 24, W: inkR - mL + 48, yc: (bT + bB) / 2 };

      Object.assign(B9, {
        cam: q('#s9cam'), paths: [...svg.querySelectorAll('path')], letters: [...lw.children], url: q('#s9url'),
        xq: [0, 1, 2, 3].map((i) => q('#s9xq' + i)), ext: [...q('#s9ext').querySelectorAll('line')],
        gap: [...q('#s9gap').querySelectorAll('line')], gapx: q('#s9gapx'),
        sw: [0, 1, 2].map((i) => q('#s9sw' + i)), hx: [0, 1, 2].map((i) => q('#s9hx' + i)), an: [0, 1, 2, 3].map((i) => q('#s9an' + i)),
        labs: [q('#s9lx'), q('#s9lb'), q('#s9lc')], fl: q('#s9fl').firstElementChild, ts: q('#s9ts'), foot: [q('#s9f0'), q('#s9f1')],
        ex: { y0: exT, y1: gy + 8 }, geo: { mL, mR, mCx, swR },
      });
      F.drawOn(B9.gap[0], 1);
  }

  const settle9 = (t) => lerp(1.05, 1, out3(P(t, 13.40, 14.15)));   // s9 settle (shared by the lockup + the footer pin)
  function update9(t) {
      /* ---- v1 camera settle: continues the morph's expansion out of the cut, decelerating ×1.05 → 1 (E.out(3)); v4: it
         starts at 13.40, inside the pill's expansion, so the motion carries straight into the lockup. The engine camera
         adds its slow in-scene push (×1.035) underneath from 13.50 ---- */
      B9.cam.style.transform = `scale(${settle9(t).toFixed(5)})`;

      /* ---- mark: three planes drop in (−70 px, E.out(3), stagger .07, no overshoot). v4: TOP → bottom, so the darkest
         plane (#6B4BFF, paths[2]) is the first thing on the white (13.36, over the dissolving pill — no empty frames
         between the scenes); the lighter planes slot in beneath it 13.43 / 13.50 ---- */
      B9.paths.forEach((p, i) => {
        const t0 = 13.36 + 0.07 * (2 - i), q = P(t, t0, t0 + 0.42);
        p.style.transform = `translateY(${(-70 * (1 - out3(q))).toFixed(2)}px)`;
        p.style.opacity = out2(cl(q / 0.3, 0, 1)).toFixed(3);
      });
      /* ---- wordmark (v1): letters rise through a baseline mask (E.out(3), 35 ms stagger); soft fade under the mask.
         v4: from 13.44 (was 13.60), so the lockup assembles while the pill's light is still settling — no sparse frames ---- */
      B9.letters.forEach((el, i) => {
        const t0 = 13.44 + 0.035 * i, q = P(t, t0, t0 + 0.36);
        el.style.transform = `translateY(${(150 * (1 - out3(q))).toFixed(2)}px)`;
        el.style.opacity = out2(cl(q / 0.4, 0, 1)).toFixed(3);
      });
      /* ---- url fades up ---- */
      enter(B9.url, t, 14.0, { dy: 10, d: 0.5, fade: 0.36 });

      /* ---- construction draws on 13.92–14.58 and stays (calm hold to the end) ---- */
      const setL = (L, p) => {
        const k = cl(p, 0, 1);
        L.el.setAttribute('x1', L.ox); L.el.setAttribute('y1', L.oy);
        L.el.setAttribute('x2', (L.ox + (L.tx - L.ox) * k).toFixed(2)); L.el.setAttribute('y2', (L.oy + (L.ty - L.oy) * k).toFixed(2));
        L.el.style.opacity = cl(k * 6, 0, 1).toFixed(3);
      };
      const Ls = B9.lines;
      const ax = smooth(P(t, 13.92, 14.42)), A_ = B9.axis;
      A_.el.setAttribute('y1', (A_.ym - (A_.ym - A_.y0) * ax).toFixed(2)); A_.el.setAttribute('y2', (A_.ym + (A_.y1 - A_.ym) * ax).toFixed(2));
      A_.el.style.opacity = cl(ax * 6, 0, 1).toFixed(3);
      [0, 1, 2].forEach((i) => setL(Ls['lead' + i], smooth(P(t, 13.98 + 0.06 * i, 14.43 + 0.06 * i))));
      const zq = smooth(P(t, 14.0, 14.5));
      ['zT', 'zL', 'zB', 'zR'].forEach((k) => setL(Ls[k], zq));
      setL(Ls.tgx, smooth(P(t, 14.06, 14.5)));
      setL(Ls.tgb, smooth(P(t, 14.10, 14.54)));
      setL(Ls.stub, smooth(P(t, 14.22, 14.52)));
      // anchors appear as the leaders pass them (the top plane's right anchor first)
      const anT = [14.06, 14.12, 14.18, 14.0];
      B9.an.forEach((el, i) => enter(el, t, anT[i], { s0: 0.9, d: 0.4, fade: 0.24 }));
      // x-squares (clear-space units)
      B9.xq.forEach((el, i) => enter(el, t, 14.10 + 0.05 * i, { s0: 0.94, d: 0.45 }));
      // gap dimension: extension lines drop, redline draws, x chip fades up
      const eq = smooth(P(t, 14.08, 14.42));
      B9.ext.forEach((ln) => { ln.setAttribute('y2', (B9.ex.y0 + (B9.ex.y1 - B9.ex.y0) * eq).toFixed(2)); ln.style.opacity = cl(eq * 6, 0, 1).toFixed(3); });
      const gq = smooth(P(t, 14.16, 14.48));
      F.drawOn(B9.gap[0], gq);
      B9.gap[1].style.opacity = out2(P(t, 14.16, 14.38)).toFixed(3); B9.gap[2].style.opacity = out2(P(t, 14.34, 14.56)).toFixed(3);
      enter(B9.gapx, t, 14.28, { s0: 0.92, d: 0.4 });
      // swatches fade + settle, hex values slide in from the swatch side
      B9.sw.forEach((el, i) => enter(el, t, 14.10 + 0.05 * i, { s0: 0.9, d: 0.4, fade: 0.24 }));
      B9.hx.forEach((el, i) => enter(el, t, 14.16 + 0.05 * i, { dx: 10, d: 0.45 }));
      // guide labels + frame label + type spec
      B9.labs.forEach((el, i) => enter(el, t, 14.20 + 0.05 * i, { dx: -10, d: 0.45 }));
      enter(B9.fl, t, 14.12, { dy: 10, d: 0.45 });
      enter(B9.ts, t, 14.16, { dy: 10, d: 0.45 });
      // sheet footer: fades + rises 8 px, pinned to its 64 px screen margins (outer edge, text centre y 1009) against the
      // engine's slow push (×1.035 about 960,540) and the s9 settle (about 960,500) — the lockup pushes in, the sheet
      // chrome stays put
      const s9 = camS(), c9 = settle9(t);
      B9.foot.forEach((el, i) => {
        const q = enter(el, t, 14.24 + 0.06 * i, { d: 0.5, fade: 0.32 });
        const x0 = i ? 1856 : 64, y0 = 1009;
        const px = 960 + (x0 - 960) / (s9 * c9) - x0;
        const py = 500 + (540 + (y0 - 540) / s9 - 500) / c9 - y0;
        el.style.translate = `${px.toFixed(2)}px ${(py + 8 * (1 - q)).toFixed(2)}px`;
      });

      /* ---- soft light sheen across the lockup (v3 sweep timing/geometry, masked copy — see measure9) ---- */
      const sq = P(t, 14.28, 14.95), SH = B9.sheen;
      SH.el.style.opacity = (Math.sin(Math.PI * sq)).toFixed(3);
      if (sq > 0 && sq < 1) {
        // gradient line of a 108° linear-gradient over the 1920 × 1080 sheen box: through (960,540), d = (sin108°, −cos108°)
        const a = 108 * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), Lg = 1920 * Math.abs(dx) + 1080 * Math.abs(dy);
        const bx = SH.x0 - 300 + (SH.W + 360) * glide(sq) + 120;
        const sc = (bx - 960) * dx + (SH.yc - 540) * dy + Lg / 2, hw = 120 * Math.cos(18 * Math.PI / 180);
        const m = `linear-gradient(108deg, rgba(0,0,0,0) ${(sc - hw).toFixed(2)}px, rgba(0,0,0,1) ${sc.toFixed(2)}px, rgba(0,0,0,0) ${(sc + hw).toFixed(2)}px)`;
        SH.el.style.webkitMaskImage = m; SH.el.style.maskImage = m;
      }
  }
})();
