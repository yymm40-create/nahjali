/* s4_prompt.js — Scene 4 "Prompt" (dark) · t0 5.0 / t1 6.5, pre 0.45 (visible from 4.55), post 0.35 (to 6.85)
   key 6.12 → stills/04_prompt.png (content check with ?nocam=1; lime retired → Strata AI; Leo replaces the white cursor)
   v4 = SPEC_v4 C2 (incoming, carry Leo) + C3 (outgoing, grow from the button) on a TRANSPARENT root. The engine draws the
   flowing background (C2 D1 → D2 from the right 4.55–5.10, C3a D2 → AI from the Generate button 6.15–6.45, C3b AI → L1),
   its dots and the grain — this module draws only content: no dots, no full-frame glow pool, no grain, no sweep, no flash.
   C2 · 4.55–5.25 · carry Leo (engine camera neutral ×1.04 → screen = 960 + 1.04·(x − 960), 540 + 1.04·(y − 540))
   4.55       Leo (cyan K.peer arrow 46 px + "Leo" tag) appears exactly where s3 leaves him: arrow tip on screen LEO_SCR,
              on-screen size LEO_SCR_S (measured in the s3 module at 4.549 with ?only=s3) → drawn at local scale LEO_SCR_S / 1.04
              → measured: s3 tip (1740.66, 512.56) @4.549 = s4 tip (1740.66, 512.56) @4.55, both 46.53 px wide on screen
   4.55–5.25  he is CARRIED (E.smooth in x/y) to the start of the prompt text (caret centre, screen (291, 535) @5.25 under
              camera ×1.04), lifted 88 local px (E.smooth 4.55–4.76) so he flies LEFT through the empty band between DESIGN
              (ink bottom ≈ 385) and TOGETHER (ink top ≈ 545): tip y ≈ 426–444, tag bottom ≤ 533 while letters are under him;
              dropped into the field (E.inOut(2) 4.97–5.24) once the bar has slid under him. Pick-up ×1 → ×1.10 → ×1
              (sin, 4.55–5.15) + a deeper soft shadow while held; scale eases to ×1 (K.peer native). s3 grammar: lagging tag
              ≤ 30 px, 7 soft trail segments — capped at 120 local px and faded out above 1500–4000 px/s (blur smears him)
   4.78–5.20  the bar slides in from the right (E.out(3), +1760 px; starts 30 ms after 4.75 so its left end stays behind the
              departing TOGETHER a frame longer), "✦ STRATA AI" +1500 (lands 5.17), chips +1650 (4.80–5.23), local
              under-glow +1500 (4.78–5.30); light x-blur 8 → 0 px on the sliding layers; bar .965 → 1
   5.06–5.20  as he enters the field his arrow turns into an I-beam (cross-fade at the hotspot, tag re-anchors)
   5.25       click: I-beam .9 + cyan ring, the field focuses (placeholder clears, Leo's cyan caret appears)
   In-scene (v3 details kept, re-timed after the landing)
   5.24–5.80  counter rises + ticks with typing; chips: + turns, iPhone 375×667 → 430×932, Auto layout toggles on, variant bars grow
   5.26–5.86  context row (45–60 ms stagger): DS glyph turns, separators grow, swatches settle, radius arc 12→30, gap hatch 10→24
   5.27–5.86  Leo types the prompt (seeded human cadence ≈ 70 cps); his I-beam rides the caret (multiplayer text cursor)
   5.87–6.08  he lifts off the caret (I-beam → arrow 5.87–5.95) and moves to Generate (E.smooth, ≈ 6 frames — s3/s4 cursor
              speed); the caret stays at the text end
   6.00       hover: Generate glow warms · 6.02–6.11 tooltip "Generate ⌘↵" rises in ABOVE the button (Leo's tag owns the
              space below the cursor, where the still had it)
   6.12       KEY (everything at rest)
   C3 · 6.15–6.45 · grow from the button (engine camera neutral ×1 → screen = scene px)
   6.15       press: Generate .95 / Leo .9 (spring back), AI flare, cyan ring, tooltip hides (70 ms), recoil −1.2 %,
              ✦ turns 180°, gradient flows (generating)
   6.18–6.42  AI bloom from the button, UNDER the bar (glows around the button, never over the label/Leo), violet core,
              ≤ ×1 (900 px): rise 6.18–6.23, fade 6.24–6.42 · 6.16–6.38 AI sheen crosses the bar from the button to the left
   6.22–6.45  the bar, label, chips, details, caret and Leo shrink ×1 → ×0.9 about the Generate centre (E.in(2)) and fade
              1 − E.out(3) (.50 @6.267, .28 @6.30, .14 @6.333 — clear before the AI flood makes white text low-contrast) —
              s5's variants are born from the same point (1485, 535)
   Depth: the UI floats above the surface; the engine camera tilts the plane during the crane (5.20–6.05) — the UI / tooltip
   layers shift by h·sin(angle) (UI h 90 px, tooltip h 200 px) — zero in every transition window and with ?nocam=1. */
(function () {
  const F = window.FILM, E = F.E, P = F.p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, q) => a + (b - a) * q;
  const AI = K.T.ai, CYAN = '#38D5FF';
  const glide = (t, t0, d) => E.glide(P(t, t0, t0 + d));
  const smooth = (t, t0, d) => E.smooth(P(t, t0, t0 + d));
  const esoft = (t, t0, d) => E.soft(P(t, t0, t0 + d));
  const soft = (t, t0, d) => F.soft(t, t0, d);
  // v1 damped spring 0→1 (≈7 % overshoot) — used only for the press
  const spring = (x, k, w) => { k = k || 18; w = w || 20; return x <= 0 ? 0 : x >= 0.5 ? 1 : 1 - Math.exp(-k * x) * Math.cos(w * x); };

  /* ---------- key-frame helpers (ported from frames/04_prompt.html) ---------- */
  const D = { ink: '#F0F0F2', mut: '#939496', soft: '#B1B2B4', line: 'rgba(240,240,242,.12)', fill: 'rgba(240,240,242,.045)' };
  const svg = (s, body, c) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c || D.mut}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none">${body}</svg>`;
  const G = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 5.5h3"/>',
    autoV: '<rect x="4" y="3.5" width="16" height="6.5" rx="1.8"/><rect x="4" y="14" width="16" height="6.5" rx="1.8"/>',
    variants: '<rect x="3" y="6" width="5" height="12" rx="1.4"/><rect x="9.5" y="4" width="5" height="16" rx="1.4"/><rect x="16" y="6" width="5" height="12" rx="1.4"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
  };
  const chip = (icon, label, value, o) => { o = o || {};
    return `<div class="s4-chip" style="display:flex;align-items:center;gap:9px;height:36px;padding:0 ${o.menu ? 10 : 13}px 0 11px;border-radius:9px;background:${o.on ? 'rgba(107,75,255,.14)' : D.fill};border:1px solid ${o.on ? 'rgba(107,75,255,.35)' : D.line};font:500 15px/1 var(--f-mono);white-space:nowrap;color:${D.mut}">${svg(16, icon, o.on ? D.soft : D.mut)}${label ? `<span>${label}</span>` : ''}${value ? `<span class="s4-val" style="color:${D.ink}">${value}</span>` : ''}${o.menu ? `<span style="margin-left:-1px">${svg(12, G.chevD)}</span>` : ''}</div>`; };
  const kbd = (k) => `<span style="display:inline-grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:6px;background:rgba(19,20,21,.06);box-shadow:inset 0 0 0 1px rgba(19,20,21,.16), inset 0 -2px 0 rgba(19,20,21,.14);font:600 16px/1 'Inter', system-ui, sans-serif;color:#131415">${k}</span>`;
  const radiusG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="display:block;flex:none"><path class="s4-rarc" d="M2.5 15V9.5a7 7 0 0 1 7-7H15" stroke="${D.mut}" stroke-width="1.8" stroke-linecap="round"/><circle class="s4-rdot" cx="9" cy="9" r="2.4" fill="#fff" stroke="#6B4BFF" stroke-width="1.6" style="transform-box:fill-box;transform-origin:center"/></svg>`;
  const gapG = `<i class="s4-gapg" style="width:16px;height:16px;display:block;flex:none;background:repeating-linear-gradient(-45deg, ${K.T.measure}88 0 2px, transparent 2px 5px);outline:1.5px solid ${K.T.measure}cc;outline-offset:-1.5px;border-radius:2px"></i>`;
  const sep = `<span class="s4-sep" style="width:1px;height:16px;background:${D.line}"></span>`;
  const tok = (hex, ring) => `<i class="s4-tok" style="width:18px;height:18px;border-radius:5px;background:${hex};display:block;box-shadow:inset 0 0 0 1px rgba(240,240,242,${ring || .16})"></i>`;
  const PROMPT = 'Design a fintech app — dark, bold, playful';
  const PLACEHOLDER = 'Describe a screen for Strata AI to design…';
  // Generate fill: the AI gradient drawn at 200 % width — the left half IS K.T.ai.grad (key look); sliding to the right half = "generating" flow
  const GEN_BG = `linear-gradient(100deg, ${AI.a} 0%, ${AI.b} 24%, ${AI.c} 50%, ${AI.b} 76%, ${AI.a} 100%)`;
  // Leo's text cursor: an I-beam in his colour (white keyline + shadow, like the K.arrow) — hotspot at its centre (12, 33)
  const IB_D = 'M5.5 4.5 Q12 4.5 12 9.5 Q12 4.5 18.5 4.5 M12 9.5 V56.5 M5.5 61.5 Q12 61.5 12 56.5 Q12 61.5 18.5 61.5';
  const IBEAM = `<svg width="24" height="66" viewBox="0 0 24 66" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;overflow:visible;filter:drop-shadow(0 3px 6px rgba(0,0,0,.28))"><path d="${IB_D}" stroke="#fff" stroke-width="6.6"/><path d="${IB_D}" stroke="${CYAN}" stroke-width="3.4"/></svg>`;

  /* ---------- C2 contract: Leo's pose when s3 hands him over (screen px, engine camera ×1.04 about the centre) ---------- */
  const T_HAND = 4.55;
  const LEO_SCR = [1740.66, 512.56];        // arrow tip on screen at 4.55 (s3 v4: #s3-cur-leo path bbox left/top at rest 4.45–4.549, measured)
  const LEO_SCR_S = 46.53 / 46;             // on-screen arrow size / K.peer native (s3 normalises ×1/1.03, camera ×1.04, depth)
  const CAM_C2 = 1.04;                      // engine camera in the C2 window (FILM.CAM 4.50–5.20, neutral)
  const LEO_A = [960 + (LEO_SCR[0] - 960) / CAM_C2, 540 + (LEO_SCR[1] - 540) / CAM_C2];   // same point in s4 scene px
  const LEO_S0 = LEO_SCR_S / CAM_C2;
  const ARW = 46, ARW_TIP = [2 * ARW / 24, 1.5 * ARW / 24];         // K.arrow tip in its own box
  const TAG_ARROW = [ARW * 0.62 - ARW_TIP[0], ARW * 1.02 - ARW_TIP[1]];   // K.peer tag offset from the tip
  const TAG_IBEAM = [17, 15];                                        // tag hangs off the I-beam's lower right

  /* ---------- timing ---------- */
  const FLY0 = 4.55, FLY1 = 5.25;           // C2 glide to the text start (E.smooth)
  // C2 carry path: he flies LEFT with the whip but HIGH, through the empty band between DESIGN (ink bottom ≈ 385 screen) and
  // TOGETHER (ink top ≈ 545): lifted C2_H local px above the straight line (tip y ≈ 440, tag bottom ≤ ≈ 535) while the letters
  // are still under him, then dropped into the field once the bar has slid under him (lift ↑ E.smooth UP, ↓ E.inOut(2) DOWN)
  const C2_H = 88, C2_UP = [4.55, 4.76], C2_DOWN = [4.97, 5.24];
  const LIFT1 = 5.15;                       // pick-up: ×1 → ×1.10 → ×1 over 4.55–5.15 (+ a deeper soft shadow while held)
  const TRAIL_CAP = 120, TRAIL_V0 = 1500, TRAIL_V1 = 4000;   // trail ≤ 120 local px; gone above ≈ 1500–4000 px/s (motion blur smears him)
  const SLIDE0 = 4.78, SLIDE1 = 5.20;       // C2 bar slide-in (E.out(3)); starts 30 ms after the spec's 4.75 so the bar's left
  const BAR_X = 1760, LAB_X = 1500, CHIP_X = 1650, UND_X = 1500;   // end stays behind the departing TOGETHER a frame longer (lands 5.20)
  const MORPH1 = [5.06, 5.20];              // arrow → I-beam
  const CLICK1 = 5.25;
  const TYPE0 = 5.27, TYPE1 = 5.86;         // first / last character
  const GO0 = 5.87, GO1 = 6.08;             // I-beam → arrow, move to Generate (≈ 6 frames, s3/s4 cursor speed)
  const MORPH2 = [5.87, 5.95];
  const HOV0 = 6.00, HOV_D = 0.2, TIP0 = 6.02, TIP_D = 0.09;
  const KEY = 6.12;
  const PRESS = 6.15;
  const BLM0 = 6.18, BLM1 = 6.42, BLM_UP = 6.23, BLM_FADE = 6.24;   // AI bloom UNDER the bar, from the bottom of the press
  const SH0 = 6.16, SH1 = 6.38;             // AI sheen across the bar
  const OUT0 = 6.22, OUT1 = 6.45;           // C3 shrink + fade about the button
  const CNT0 = 5.24;
  const CHIP0 = 5.24, CHIP_ST = 0.05;
  const CTX = { using: 5.26, ds: 5.32, sep1: 5.36, tok: [5.38, 5.43, 5.48, 5.53], sep2: 5.46, aa: 5.48, sep3: 5.52, rad: 5.54, sep4: 5.58, gap: 5.60 };
  const H_UI = 90, H_FR = 200;
  const NOCAM = !!new URLSearchParams(location.search).get('nocam');

  // typing cadence: per-character times (seeded, deterministic), first at TYPE0, last at TYPE1
  const CT = (() => {
    const r = F.rand(4242), d = [];
    for (let i = 1; i < PROMPT.length; i++) { let v = 0.55 + 0.9 * r(); if (PROMPT[i] === ' ' || PROMPT[i - 1] === ',') v *= 1.3; d.push(v); }
    const sum = d.reduce((a, b) => a + b, 0), span = TYPE1 - TYPE0, out = [TYPE0];
    for (let i = 0; i < d.length; i++) out.push(out[i] + d[i] / sum * span);
    return out;
  })();
  const typedN = (t) => { let n = 0; while (n < CT.length && CT[n] <= t) n++; return n; };

  const rgba = (a, b, q) => `rgba(${a.map((v, i) => i < 3 ? Math.round(lerp(v, b[i], q)) : +lerp(v, b[i], q).toFixed(3)).join(',')})`;
  const R = {};

  /* ---------- Leo: hotspot path (scene px, pure in t) ---------- */
  const arc = (A, B, e, k) => {             // A → B at eased progress e, bulging k·L to the right of travel for k < 0 (screen y down)
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, a = L * k * Math.sin(Math.PI * e);
    return [A[0] + dx * e - dy / L * a, A[1] + dy * e + dx / L * a];
  };
  const leoPos = (t) => {
    if (t <= FLY0) return LEO_A.slice();
    if (t < FLY1) {                         // C2 carry: E.smooth A → caret, lifted over the whipping letters, dropped into the field
      const e = E.smooth(P(t, FLY0, FLY1)), B = R.caretC[0];
      const up = C2_H * E.smooth(P(t, C2_UP[0], C2_UP[1])) * (1 - E.inOut(2)(P(t, C2_DOWN[0], C2_DOWN[1])));
      return [lerp(LEO_A[0], B[0], e), lerp(LEO_A[1], B[1], e) - up];
    }
    if (t <= GO0) return R.caretC[typedN(t)].slice();
    return arc(R.caretC[PROMPT.length], R.gTip, E.smooth(P(t, GO0, GO1)), -0.06);
  };
  // 0 = arrow, 1 = I-beam
  const ibeamMix = (t) => t < GO0 ? E.glide(P(t, MORPH1[0], MORPH1[1])) : 1 - E.glide(P(t, MORPH2[0], MORPH2[1]));

  F.scene({
    id: 's4', t0: 5.0, t1: 6.5, pre: 0.45, post: 0.35, world: 'dark',

    build(root) {
      root.innerHTML = `
<svg width="0" height="0" style="position:absolute"><defs><filter id="s4-xblur" x="-12%" y="-4%" width="124%" height="108%" color-interpolation-filters="sRGB"><feGaussianBlur id="s4-xblur-g" stdDeviation="0 0"/></filter></defs></svg>
<div id="s4-bloom" class="abs" style="width:900px;height:900px;border-radius:50%;opacity:0;background:radial-gradient(circle, rgba(150,140,255,.75) 0%, rgba(130,120,255,.55) 16%, rgba(108,122,255,.32) 34%, rgba(86,150,255,.12) 54%, rgba(62,182,255,0) 72%)"></div>
<div id="s4-grp" class="abs" style="left:0;top:0;width:1920px;height:1080px">
 <div id="s4-recoil" class="abs" style="left:0;top:0;width:1920px;height:1080px">
  <div id="s4-ui" class="abs" style="left:0;top:0;width:1920px;height:1080px">
   <div id="s4-slide" class="abs" style="left:0;top:0;width:1920px;height:1080px">
    <div id="s4-under" class="abs" style="left:160px;top:330px;width:1600px;height:460px;border-radius:50%;background:radial-gradient(closest-side, rgba(112,89,255,.30), rgba(112,89,255,.12) 55%, rgba(112,89,255,0) 100%)"></div>
    <div id="s4-label" class="abs mono" style="left:50%;top:388px;transform:translateX(-50%);font-size:26px;letter-spacing:.06em;color:${AI.text};display:flex;gap:12px;align-items:center">${K.icon('spark', 26, AI.text)}<span style="background:${AI.textGrad};-webkit-background-clip:text;background-clip:text;color:transparent">STRATA AI</span></div>
    <div id="s4-bar" class="abs" style="left:250px;top:460px;width:1420px;height:150px;border-radius:999px;background:#17171A;border:1.5px solid rgba(240,240,242,.14);box-shadow:0 40px 90px -30px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.06)">
     <div id="s4-ph" class="abs" style="left:74px;top:50%;transform:translateY(-50%);font:500 46px/1 var(--f-text);color:rgba(240,240,242,.30);letter-spacing:-.01em;white-space:nowrap">${PLACEHOLDER}</div>
     <div id="s4-ptext" class="abs" style="left:58px;top:50%;transform:translateY(-50%);font:500 46px/1 var(--f-text);color:#F0F0F2;letter-spacing:-.01em;white-space:nowrap"><span id="s4-typed"></span><span id="s4-caret" style="display:inline-block;width:4px;height:52px;margin-left:6px;vertical-align:-10px;background:${CYAN};border-radius:1px"></span></div>
     <div id="s4-shclip" class="abs" style="inset:0;border-radius:999px;overflow:hidden"><div id="s4-sheen" class="abs" style="left:0;top:-40px;width:180px;height:230px;opacity:0;background:linear-gradient(90deg, rgba(138,92,255,0) 0%, rgba(150,140,255,.20) 25%, rgba(214,222,255,.42) 50%, rgba(110,190,255,.20) 75%, rgba(62,182,255,0) 100%)"></div></div>
     <div id="s4-halo" class="abs" style="right:-2px;top:-2px;height:154px;width:370px;border-radius:999px;background:rgba(112,89,255,.55);filter:blur(75px)"></div>
     <div id="s4-flare" class="abs" style="right:18px;top:18px;height:114px;width:330px;border-radius:999px;background:${AI.grad};filter:blur(36px);opacity:0"></div>
     <div id="s4-gen" class="abs" style="right:18px;top:18px;height:114px;width:330px;border-radius:999px;overflow:hidden;background:${GEN_BG};background-size:200% 100%;background-position:0% 0;display:flex;align-items:center;justify-content:center;gap:14px;font:700 42px/1 var(--f-display);color:#fff;letter-spacing:-.01em">${K.icon('spark', 34, '#fff')}Generate</div>
    </div>
    <div id="s4-chips" class="abs" style="left:313px;top:634px;display:flex;gap:10px">
     <div class="s4-chip" style="width:36px;height:36px;border-radius:9px;background:${D.fill};border:1px solid ${D.line};display:grid;place-items:center">${svg(17, G.plus, D.soft)}</div>
     ${chip(G.phone, 'iPhone', '375 × 667', { menu: true })}
     ${chip(G.autoV, '', 'Auto layout', { on: true })}
     ${chip(G.variants, '', '3 variants', { menu: true })}
    </div>
   </div>
   <div id="s4-ctx" class="abs mono" style="left:312px;top:694px;display:flex;align-items:center;gap:12px;font:500 15px/1 var(--f-mono);color:${D.mut};white-space:nowrap">
    <span class="s4-ci" id="s4-c-using">Using</span>
    <span class="s4-ci" id="s4-c-ds" style="display:flex;align-items:center;gap:7px;color:${D.soft}">${K.glyph('component', 16, K.T.seed)}Strata DS</span>
    ${sep}
    <span class="s4-ci" id="s4-c-toks" style="display:flex;gap:5px">${tok('#7059FF')}${tok('#B49BFF')}${tok(AI.c)}${tok('#1A1A21', .32)}</span>
    ${sep}
    <span class="s4-ci" id="s4-c-aa" style="display:flex;align-items:baseline;gap:7px"><b style="font:700 17px/1 var(--f-display);color:${D.ink};letter-spacing:-.02em">Aa</b>Inter Tight</span>
    ${sep}
    <span class="s4-ci" id="s4-c-rad" style="display:flex;align-items:center;gap:7px">${radiusG}<span id="s4-rnum">30</span></span>
    ${sep}
    <span class="s4-ci" id="s4-c-gap" style="display:flex;align-items:center;gap:7px">${gapG}<span id="s4-gnum">24</span></span>
   </div>
   <div id="s4-count" class="abs mono" style="top:643px;font:500 15px/1 var(--f-mono);color:${D.mut};white-space:nowrap"><span id="s4-cnum">${PROMPT.length}</span><span style="opacity:.8"> / 500</span></div>
   <svg id="s4-fx" class="abs" style="left:0;top:0;overflow:visible" width="1" height="1"></svg>
   <div id="s4-leo" class="abs" style="left:0;top:0;width:0;height:0">
    <div id="s4-leo-ib" class="abs" style="left:-12px;top:-33px;transform-origin:12px 33px;opacity:0">${IBEAM}</div>
    <div id="s4-leo-ar" class="abs" style="left:${-ARW_TIP[0]}px;top:${-ARW_TIP[1]}px;transform-origin:${ARW_TIP[0]}px ${ARW_TIP[1]}px">${K.arrow(CYAN, '#fff', ARW)}</div>
    <div id="s4-leo-tag" class="tag" style="left:0;top:0;background:${CYAN};color:#131415">Leo</div>
   </div>
  </div>
  <div id="s4-front" class="abs" style="left:0;top:0;width:1920px;height:1080px">
   <div id="s4-tip" class="abs" style="left:0;top:0;width:0;height:0">${K.tip(0, 0, `<span style="display:flex;align-items:center;gap:10px">Generate<span style="display:flex;gap:4px">${kbd('⌘')}${kbd('↵')}</span></span>`, 'dark', { size: 15 })}</div>
  </div>
 </div>
</div>`;

      const q = (s) => root.querySelector(s), qa = (s) => Array.from(root.querySelectorAll(s));
      Object.assign(R, {
        grp: q('#s4-grp'), recoil: q('#s4-recoil'), ui: q('#s4-ui'), slide: q('#s4-slide'), front: q('#s4-front'), blurG: q('#s4-xblur-g'),
        under: q('#s4-under'), label: q('#s4-label'), labSpark: q('#s4-label svg'), bar: q('#s4-bar'), ph: q('#s4-ph'), typed: q('#s4-typed'), caret: q('#s4-caret'),
        sheen: q('#s4-sheen'), halo: q('#s4-halo'), flare: q('#s4-flare'), gen: q('#s4-gen'), genSpark: q('#s4-gen svg'),
        chipRow: q('#s4-chips'), chips: qa('#s4-chips > .s4-chip'), count: q('#s4-count'), cnum: q('#s4-cnum'),
        using: q('#s4-c-using'), ds: q('#s4-c-ds'), dsG: q('#s4-c-ds svg'), toks: qa('.s4-tok'), seps: qa('#s4-ctx .s4-sep'), aa: q('#s4-c-aa'),
        rad: q('#s4-c-rad'), rarc: q('.s4-rarc'), rdot: q('.s4-rdot'), rnum: q('#s4-rnum'), gapI: q('#s4-c-gap'), gapg: q('.s4-gapg'), gnum: q('#s4-gnum'),
        tip: q('#s4-tip'), tipBox: q('#s4-tip > div'), fx: q('#s4-fx'), leo: q('#s4-leo'), leoIb: q('#s4-leo-ib'), leoAr: q('#s4-leo-ar'), leoTag: q('#s4-leo-tag'),
        bloom: q('#s4-bloom'),
      });
      R.plusSvg = R.chips[0].querySelector('svg');
      R.devVal = R.chips[1].querySelector('.s4-val');
      R.autoSvg = R.chips[2].querySelector('svg');
      R.varRects = Array.from(R.chips[3].querySelectorAll('svg')[0].querySelectorAll('rect'));
      R.varRects.forEach((r) => { r.style.transformBox = 'fill-box'; r.style.transformOrigin = '50% 100%'; });
      [R.plusSvg, R.dsG, R.labSpark, R.genSpark].forEach((s) => { s.style.transformOrigin = '50% 50%'; });
      R.seps.forEach((s) => { s.style.transformOrigin = '50% 50%'; });

      // measured layout (as the key frame does after fonts.ready): counter right edge on Generate's left edge, centred on the chip row
      const rr = root.getBoundingClientRect(), g = R.gen.getBoundingClientRect();
      const rel = (b) => ({ l: b.left - rr.left, t: b.top - rr.top, r: b.right - rr.left, b: b.bottom - rr.top, w: b.width, h: b.height });
      const cr = R.count.getBoundingClientRect(), row = R.chipRow.getBoundingClientRect();
      R.count.style.left = 'auto';
      R.count.style.right = (1920 - (g.left - rr.left)) + 'px';
      R.count.style.top = (row.top - rr.top + row.height / 2 - cr.height / 2) + 'px';
      R.gx = g.left - rr.left + g.width / 2; R.gy = g.top - rr.top + g.height / 2;            // Generate centre (C3 origin)
      R.grp.style.transformOrigin = R.recoil.style.transformOrigin = `${R.gx}px ${R.gy}px`;
      R.bloom.style.left = (R.gx - 450) + 'px'; R.bloom.style.top = (R.gy - 450) + 'px';
      R.gTip = [1525, 584];                                                                   // Leo's arrow tip on Generate (the still's cursor tip)
      // tooltip: centred on Generate, 12 px above the bar
      const bar = rel(R.bar.getBoundingClientRect()), tb = R.tipBox.getBoundingClientRect();
      R.tipBox.style.left = (R.gx - tb.width / 2) + 'px'; R.tipBox.style.top = (bar.t - 12 - tb.height) + 'px';
      R.tip.style.transformOrigin = `${R.gx}px ${bar.t - 12}px`;
      // caret centre after n typed characters (scene px) — Leo's I-beam rides it
      R.caretC = [];
      for (let n = 0; n <= PROMPT.length; n++) {
        R.typed.textContent = PROMPT.slice(0, n);
        const c = rel(R.caret.getBoundingClientRect());
        R.caretC.push([c.l + c.w / 2, c.t + c.h / 2]);
      }
      R.typed.textContent = '';
      R.rarcLen = R.rarc.getTotalLength(); R.rarc.style.strokeDasharray = R.rarcLen + ' ' + R.rarcLen;
      const pl = F.place && F.place.s4 ? F.place.s4 : [0, 0];
      R.CX = pl[0] + 960; R.CY = pl[1] + 540;
      // Leo's trail (7 soft segments behind the hotspot, s3 grammar) + click rings
      R.fx.innerHTML = Array.from({ length: 7 }, () => `<line class="s4-trail" stroke="${CYAN}" stroke-linecap="round" opacity="0"/>`).join('') +
        `<circle class="s4-ring" fill="none" stroke="${CYAN}" stroke-width="2" opacity="0" r="1"/><circle class="s4-ring" fill="none" stroke="${CYAN}" stroke-width="2" opacity="0" r="1"/>`;
      R.segs = Array.from(R.fx.querySelectorAll('.s4-trail')); R.rings = Array.from(R.fx.querySelectorAll('.s4-ring'));
    },

    update(lt, t) {
      /* ---- C2 slide-in from the right (E.out(3)), light x-blur, bar .965 → 1 ---- */
      const pb = P(t, SLIDE0, SLIDE1), pl = P(t, SLIDE0, SLIDE1 - 0.03), pc = P(t, SLIDE0 + 0.02, SLIDE1 + 0.03), pu = P(t, SLIDE0, SLIDE1 + 0.10);
      const o3 = E.out(3), inSlide = t >= SLIDE0;
      R.slide.style.visibility = inSlide ? 'visible' : 'hidden';
      R.bar.style.transform = `translateX(${(BAR_X * (1 - o3(pb))).toFixed(2)}px) scale(${lerp(0.965, 1, o3(pb)).toFixed(4)})`;
      R.label.style.transform = `translateX(calc(-50% + ${(LAB_X * (1 - o3(pl))).toFixed(2)}px))`;
      R.chipRow.style.transform = `translateX(${(CHIP_X * (1 - o3(pc))).toFixed(2)}px)`;
      const breath = Math.sin(2 * Math.PI * (t - KEY) / 3.2);
      R.under.style.transform = `translateX(${(UND_X * (1 - o3(pu))).toFixed(2)}px) scale(${((1 + 0.15 * E.in(2)(P(t, PRESS, OUT1))) * (1 + 0.012 * breath)).toFixed(4)})`;
      R.under.style.opacity = E.glide(P(t, SLIDE0, SLIDE1 + 0.1)).toFixed(3);
      const blur = 8 * Math.pow(1 - pb, 2);
      R.blurG.setAttribute('stdDeviation', blur.toFixed(2) + ' 0');
      R.slide.style.filter = inSlide && blur > 0.05 ? 'url(#s4-xblur)' : 'none';
      const ls = P(t, 5.08, 5.44);
      R.labSpark.style.transform = `rotate(${(90 * E.out(3)(ls)).toFixed(2)}deg) scale(${(1 + 0.3 * Math.sin(Math.PI * ls)).toFixed(4)})`;

      /* ---- depth: the engine camera tilts the plane; floating UI / tooltip shift by h·sin(angle) (0 in transition windows, nocam) ---- */
      const cam = (!NOCAM && F.camNow) || null;
      let ux = 0, uy = 0, fx = 0, fy = 0;
      if (cam) {
        const sx = Math.sin(cam.ry * Math.PI / 180), sy = -Math.sin(cam.rx * Math.PI / 180), cs = cam.s || 1;
        const ox = (cam.cx - R.CX) * 0.025, oy = (cam.cy - R.CY) * 0.025;
        ux = (H_UI * sx) / cs - ox; uy = (H_UI * sy) / cs - oy;
        fx = (H_FR * sx) / cs - 1.8 * ox; fy = (H_FR * sy) / cs - 1.8 * oy;
      }
      R.ui.style.transform = `translate(${ux.toFixed(2)}px,${uy.toFixed(2)}px)`;
      R.front.style.transform = `translate(${fx.toFixed(2)}px,${fy.toFixed(2)}px)`;

      /* ---- C3: press recoil, then the whole UI shrinks into the Generate button and fades (s5 grows out of it) ---- */
      R.recoil.style.transform = `scale(${(1 - 0.012 * Math.sin(Math.PI * P(t, PRESS, PRESS + 0.16))).toFixed(5)})`;
      const po = P(t, OUT0, OUT1);
      R.grp.style.transform = `scale(${lerp(1, 0.9, E.in(2)(po)).toFixed(5)})`;
      R.grp.style.opacity = (1 - E.out(3)(po)).toFixed(4);          // clears fast (.50 @6.267, .28 @6.30, .14 @6.333): the AI flood owns the frame

      /* ---- typing + placeholder + caret + counter ---- */
      const n = typedN(t), txt = PROMPT.slice(0, n);
      if (R.typed.textContent !== txt) R.typed.textContent = txt;
      R.ph.style.opacity = t < CLICK1 ? 1 : (n > 0 ? 0 : (1 - glide(t, CLICK1, 0.04)).toFixed(3));
      R.caret.style.opacity = (glide(t, CLICK1, 0.05) * (1 - glide(t, PRESS + 0.07, 0.25))).toFixed(3);
      const rise = (el, t0, d, dy) => { d = d || 0.35; dy = dy == null ? 10 : dy;
        el.style.opacity = glide(t, t0, d * 0.75).toFixed(3);
        el.style.transform = `translateY(${(dy * (1 - esoft(t, t0, d))).toFixed(2)}px)`; };
      rise(R.count, CNT0, 0.3, 10);
      if (R.cnum.textContent !== String(n)) R.cnum.textContent = String(n);

      /* ---- chips: slid in with the bar; their own micro moves once landed ---- */
      R.plusSvg.style.transform = `rotate(${(-90 * (1 - soft(t, CHIP0, 0.6))).toFixed(2)}deg)`;
      const qd = smooth(t, CHIP0 + CHIP_ST + 0.06, 0.45);
      const dev = `${Math.round(lerp(375, 430, qd))} × ${Math.round(lerp(667, 932, qd))}`;
      if (R.devVal.textContent !== dev) R.devVal.textContent = dev;
      const on = glide(t, CHIP0 + 2 * CHIP_ST + 0.17, 0.3);
      R.chips[2].style.background = rgba([240, 240, 242, 0.045], [107, 75, 255, 0.14], on);
      R.chips[2].style.borderColor = rgba([240, 240, 242, 0.12], [107, 75, 255, 0.35], on);
      R.autoSvg.setAttribute('stroke', rgba([147, 148, 150, 1], [177, 178, 180, 1], on));
      R.varRects.forEach((r, k) => { r.style.transform = `scaleY(${(0.25 + 0.75 * soft(t, CHIP0 + 3 * CHIP_ST + 0.02 + k * 0.05, 0.40)).toFixed(4)})`; });

      /* ---- context row: labels fade + rise, separators grow, swatches settle, readouts draw / tick ---- */
      rise(R.using, CTX.using); rise(R.ds, CTX.ds); rise(R.aa, CTX.aa); rise(R.rad, CTX.rad); rise(R.gapI, CTX.gap);
      R.dsG.style.transform = `rotate(${(-90 * (1 - soft(t, CTX.ds, 0.55))).toFixed(2)}deg)`;
      [CTX.sep1, CTX.sep2, CTX.sep3, CTX.sep4].forEach((t0, i) => {
        R.seps[i].style.opacity = glide(t, t0, 0.25).toFixed(3);
        R.seps[i].style.transform = `scaleY(${(0.2 + 0.8 * smooth(t, t0, 0.3)).toFixed(4)})`; });
      R.toks.forEach((el, i) => { const t0 = CTX.tok[i];
        el.style.opacity = glide(t, t0, 0.25).toFixed(3);
        el.style.transform = `scale(${(0.9 + 0.1 * soft(t, t0, 0.34)).toFixed(4)})`; });
      const qr = smooth(t, CTX.rad + 0.02, 0.30);
      R.rarc.style.strokeDashoffset = (R.rarcLen * (1 - qr)).toFixed(2);
      R.rdot.style.opacity = glide(t, CTX.rad + 0.1, 0.22).toFixed(3);
      R.rdot.style.transform = `scale(${(0.9 + 0.1 * soft(t, CTX.rad + 0.1, 0.22)).toFixed(4)})`;
      R.rnum.textContent = String(Math.round(lerp(12, 30, qr)));
      const qg = smooth(t, CTX.gap + 0.02, 0.25);
      R.gapg.style.clipPath = `inset(0 ${(100 * (1 - qg)).toFixed(2)}% 0 0)`;
      R.gnum.textContent = String(Math.round(lerp(10, 24, qg)));

      /* ---- Leo: carried in from s3, glides to the text, becomes his I-beam, types, flicks to Generate, presses ---- */
      const [hx, hy] = leoPos(t), mix = ibeamMix(t);
      const lift = Math.sin(Math.PI * P(t, FLY0, LIFT1));                 // 0 at the hand-off (contract size), 0 again before he lands
      const sL = lerp(LEO_S0, 1, E.smooth(P(t, FLY0, FLY1))) * (1 + 0.10 * lift);
      // held: a deeper, softer shadow under the arrow while he is carried (reads as lifted above the moving world)
      R.leoAr.style.filter = lift > 0.002 ? `drop-shadow(0 ${(10 * lift).toFixed(2)}px ${(14 * lift).toFixed(2)}px rgba(0,0,0,${(0.32 * lift).toFixed(3)}))` : 'none';
      const dn1 = 1 - 0.10 * E.glide(P(t, CLICK1, CLICK1 + 0.06)) + 0.10 * E.glide(P(t, CLICK1 + 0.06, CLICK1 + 0.26));   // I-beam click
      const xp = t - PRESS;
      const dn2 = xp < 0 ? 1 : xp < 0.035 ? 1 - 0.10 * E.out(2)(xp / 0.035) : 0.90 + 0.10 * spring(xp - 0.035, 16, 20);    // arrow press .9
      R.leo.style.transform = `translate(${hx.toFixed(2)}px,${hy.toFixed(2)}px) scale(${sL.toFixed(5)})`;
      R.leoAr.style.opacity = (1 - mix).toFixed(3);
      R.leoAr.style.transform = `scale(${(lerp(1, 0.6, mix) * dn2).toFixed(4)})`;
      R.leoIb.style.opacity = mix.toFixed(3);
      R.leoIb.style.transform = `scale(${(lerp(0.6, 1, mix) * dn1).toFixed(4)})`;
      // tag: K.peer offset (arrow) ↔ I-beam offset, lags the move (≤ 30 px) only while he is a pointer
      const pp = leoPos(t - 0.08);
      let lx = -(hx - pp[0]) * 0.25 * (1 - mix), ly = -(hy - pp[1]) * 0.25 * (1 - mix); const lm = Math.hypot(lx, ly); if (lm > 30) { lx *= 30 / lm; ly *= 30 / lm; }
      R.leoTag.style.transform = `translate(${(lerp(TAG_ARROW[0], TAG_IBEAM[0], mix) + lx).toFixed(2)}px,${(lerp(TAG_ARROW[1], TAG_IBEAM[1], mix) + ly).toFixed(2)}px)`;
      // trail: 7 soft segments behind the hotspot, fading with speed (pointer moves only — not the caret's typing steps);
      // the whole trail fades with the pointer's current speed, so nothing lingers once he is at rest (key frame is clean)
      // capped: total length ≤ TRAIL_CAP local px (the last segment is clipped at the cap), and the whole trail fades out as
      // his speed passes TRAIL_V0 → TRAIL_V1 px/s — at carry speed (≈ 7000 px/s) the 12-sub-frame blur already smears him
      const pv = leoPos(t - 0.03), spd = Math.hypot(hx - pv[0], hy - pv[1]) / 0.03;
      const vNow = (t >= FLY1 && t <= GO0) ? 0 : clamp(spd * 0.03 / 12, 0, 1) * clamp(1 - (spd - TRAIL_V0) / (TRAIL_V1 - TRAIL_V0), 0, 1);
      let prev = [hx, hy], cum = 0;
      R.segs.forEach((sg, i) => {
        const tt = t - (i + 1) * 0.03, typing = tt >= FLY1 && tt <= GO0;
        let nx = leoPos(tt), len = typing ? 0 : Math.hypot(prev[0] - nx[0], prev[1] - nx[1]);
        if (len > 0 && cum + len > TRAIL_CAP) { const k = Math.max(0, TRAIL_CAP - cum) / len; nx = [lerp(prev[0], nx[0], k), lerp(prev[1], nx[1], k)]; len *= k; }
        cum += len;
        sg.setAttribute('opacity', (0.26 * (1 - i / 7) * clamp((len - 1) / 16, 0, 1) * (1 - mix) * vNow).toFixed(3));
        sg.setAttribute('stroke-width', (3.5 * (1 - i / 8)).toFixed(2));
        sg.setAttribute('x1', prev[0].toFixed(2)); sg.setAttribute('y1', prev[1].toFixed(2)); sg.setAttribute('x2', nx[0].toFixed(2)); sg.setAttribute('y2', nx[1].toFixed(2));
        prev = nx;
      });
      [[CLICK1, R.caretC[0]], [PRESS, R.gTip]].forEach(([tc, c], i) => {     // soft click rings (s3 grammar)
        const qq = P(t, tc, tc + 0.36), ring = R.rings[i];
        ring.setAttribute('cx', c[0]); ring.setAttribute('cy', c[1]);
        ring.setAttribute('r', (8 + 26 * E.soft(qq)).toFixed(2));
        ring.setAttribute('opacity', qq > 0 && qq < 1 ? (0.55 * E.glide(clamp(qq / 0.3, 0, 1)) * Math.pow(1 - qq, 2)).toFixed(3) : 0);
      });

      /* ---- tooltip: rises in above Generate on hover, hides on mouse-down (70 ms) ---- */
      const ti = glide(t, TIP0, TIP_D), ts = esoft(t, TIP0, TIP_D + 0.06), hide = E.in(2)(P(t, PRESS, PRESS + 0.07));
      R.tip.style.opacity = (ti * (1 - hide)).toFixed(3);
      R.tip.style.transform = `translateY(${(8 * (1 - ts)).toFixed(2)}px) scale(${((0.96 + 0.04 * ts) * (1 - 0.08 * hide)).toFixed(4)})`;

      /* ---- Generate: hover warm-up → press (.95, spring back) + AI flare → generating flow ---- */
      const h = soft(t, HOV0, HOV_D), fl = E.out(3)(P(t, PRESS, PRESS + 0.08));
      const gs = xp < 0 ? 1 : xp < 0.04 ? 1 - 0.05 * E.out(2)(xp / 0.04) : 0.95 + 0.05 * spring(xp - 0.04, 16, 22);
      R.gen.style.transform = `scale(${gs.toFixed(4)})`;
      const g1 = 0.5 * (0.22 + 0.13 * h) / 0.35 + 0.65 * fl, g2 = 0.16 * (0.06 + 0.04 * h) / 0.10 + 0.35 * fl;
      R.gen.style.boxShadow = `0 0 0 1px rgba(255,255,255,${(0.3 + 0.4 * fl).toFixed(3)}) inset, 0 0 40px 4px rgba(91,108,255,${g1.toFixed(3)}), 0 0 120px 24px rgba(62,182,255,${g2.toFixed(3)})`;
      R.genSpark.style.transform = `rotate(${(90 * smooth(t, HOV0, 0.25) + 180 * E.inOut(2)(P(t, PRESS, PRESS + 0.3))).toFixed(2)}deg)`;
      R.gen.style.backgroundPosition = `${(100 * glide(t, PRESS + 0.05, 1.15)).toFixed(2)}% 0`;
      R.halo.style.opacity = (0.8 + 0.2 * h).toFixed(3);
      R.flare.style.opacity = (0.9 * fl).toFixed(3);
      R.flare.style.transform = `scale(${(1 + 0.35 * E.out(2)(P(t, PRESS, PRESS + 0.3))).toFixed(4)})`;

      /* ---- AI kicks in: sheen crosses the bar from the button, a local bloom opens from the button ---- */
      const qs = E.inOut(1.6)(P(t, SH0, SH1));
      R.sheen.style.opacity = (P(t, SH0, SH0 + 0.04) * (1 - P(t, SH1 - 0.06, SH1))).toFixed(3);
      R.sheen.style.transform = `translateX(${lerp(1260, -260, qs).toFixed(2)}px) skewX(-24deg)`;
      // bloom lives UNDER the bar (glows around the button, never over it), violet core, ≤ ×1 (900 px) — the engine's liquid
      // D2 → AI front from the same point is the only shape that spreads across the frame
      const qb = P(t, BLM0 - 0.01, BLM1);
      R.bloom.style.opacity = (0.9 * E.out(2)(P(t, BLM0, BLM_UP)) * (1 - E.in(1.5)(P(t, BLM_FADE, BLM1)))).toFixed(3);
      R.bloom.style.transform = `scale(${(0.3 + 0.7 * E.out(2)(qb)).toFixed(4)})`;
    },
  });
})();
