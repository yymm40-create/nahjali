/*! Neutral motion-personality demo — ONE choreography, any style.
 *
 *  Content: the hero (the 7-bar wave — the same glyph as styleboard frame D, hero-glyph.js), a title lockup
 *  «Your Product», a CTA «Get started». Never a blank capsule, never a metallic slab.
 *  Style:   window.DEMO_STYLE (per-copy constant) › ?style=<preset> (read by hf-motion v2) › 'higgsfield'.
 *
 *  There is no `if (style === …)` anywhere. Every visual and temporal decision comes from the active theme:
 *    colour / type / radius / shadow / glow / texture     → HF.theme.tokens (+ HFT.toCSSVars, HFT.fontLink)
 *    title line 2                                         → the accent FACE only for didone / editorial / kinetic voices
 *                                                           (HeroGlyph.accentFace — the same rule as the styleboard)
 *    CTA label                                            → type.action (Higgsfield: Inter 600, sentence, 0.34 × height)
 *    hero material                                        → hero-glyph.js (material axis, policy.hero.treatment, brand recipe)
 *    easing, durations, stagger, overshoot, camera speed  → hf-motion v2 (HF.E, HF.D, HF.stagger, HF.os, HF.cameraSpeed)
 *    HOW things reveal / get emphasised                   → core.motion.byPersonality[personality]
 *                                                           mask = bars grow from a drawn baseline · light = exposure 0.35 → 1
 *                                                           under a passing sheen · assembly = bars pop in with squash ·
 *                                                           focus = blur → sharp · cut
 *    camera verb, texture kind                            → theme.policy.camera / theme.policy.texture
 *  The cue sheet (when each beat starts) is the edit and is identical for every style.
 *
 *  Contract for capture: window.__comp = {width, height, fps, duration}; window.__seek(t) is a pure function of t.
 */
(function () {
  'use strict';
  const HFT = window.HFT, HF = window.HF, HG = window.HeroGlyph;
  if (window.DEMO_STYLE) HF.use(window.DEMO_STYLE, window.DEMO_OPTS || undefined);
  const th = HF.theme, T = th.tokens, POL = th.policy, CORE = HFT.core;
  const W = T['frame.w'], H = T['frame.h'], FPS = HF.fps, DUR = 4;
  const MOT = CORE.motion, SC = MOT.scalars;
  const BY = MOT.byPersonality[HF.personality] || MOT.byPersonality.productive;
  const REVEAL = BY.reveal, EMPH = BY.emphasis;
  const PERS = (HFT.axes.motionPersonality && HFT.axes.motionPersonality[HF.personality]) || {};
  const SQUASH = ((PERS.overshoot && PERS.overshoot.squashStretchPct) || 0) / 100;
  const du = (v) => HFT.du(v, th.meta.format);
  const { clamp, lerp } = HF;

  /* ------------------------------------------------------------ cue sheet (the edit — same for every style) */
  const CUE = { hero: 0.0, settle: 0.8, cta: 2.1, press: 2.85 };
  const T_TITLE = CUE.settle + 0.5 * HF.d('hero');            // the title follows the hero as it vacates the centre
  const ORDER = [0, 1, 6, 2, 3, 4, 5];                        // S1 appearance order (brand archive, generalised)

  /* ------------------------------------------------------------ token helpers */
  const hex = (k) => T[k].hex;
  const rgba = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${+a.toFixed(4)})`; };
  const shadowCSS = (list, gain = 1) => (Array.isArray(list) && list.length
    ? list.map((s) => `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread || 0}px ${rgba(s.color, clamp(s.alpha * gain, 0, 1))}`).join(', ')
    : '');
  const joinShadows = (...xs) => xs.filter(Boolean).join(', ') || 'none';
  const fontStack = (fam) => { const f = HFT.fonts[fam]; return `"${fam}", ${f && f.cat === 'serif' ? 'serif' : f && f.cat === 'mono' ? 'monospace' : 'sans-serif'}`; };
  const sTok = (k) => HG.styleTok(HFT, th, k);
  const tex = POL.texture || { kind: 'none' };
  const texRecipe = (HFT.axes.texture || {})[tex.kind === 'dotGrid' ? 'dot-grid' : tex.kind] || {};
  const texOpacity = (() => { const r = texRecipe.opacity && texRecipe.opacity[th.meta.scheme]; return r ? (r[0] + r[1]) / 2 : tex.amount || 0; })();

  /* ------------------------------------------------------------ CSS variables + fonts from the theme */
  const D = T['type.display'];
  const ACT = HG.role(HFT, th, 'action');
  const ACC = HG.accentFace(HFT, th);                          // null → line 2 is set in type.display
  const vars = document.createElement('style'); vars.textContent = HFT.toCSSVars(th); document.head.appendChild(vars);
  const fontLinks = [HFT.fontLink(th)];
  const extraFace = (fam, w, ital) => { const f = HFT.fonts[fam]; if (!f) return; const spec = f.wght ? (ital ? 'ital,wght@1,' + w : 'wght@' + w) : (ital ? 'ital,wght@1,' + w : 'wght@' + w); fontLinks.push('https://fonts.googleapis.com/css2?family=' + fam.replace(/ /g, '+') + ':' + spec + '&display=block'); };
  if (ACT.fallback) extraFace(ACT.family, ACT.weight, false);
  if (ACC) extraFace(ACC.family, ACC.weight, ACC.style === 'italic');
  const linkLoaded = Promise.all(fontLinks.map((href) => new Promise((r) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = r; l.onerror = r; setTimeout(r, 15000); document.head.appendChild(l); })));

  /* ------------------------------------------------------------ DOM */
  const el = (tag, cls, parent, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; (parent || stage).appendChild(e); return e; };
  const stage = document.getElementById('stage');
  stage.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden;background:var(--bg-base)`;

  const pool = el('div', 'pool', stage, 'position:absolute;inset:0');
  const fx = el('div', 'fx', stage, `position:absolute;inset:0;transform-origin:${T['focal.home.x']}px ${T['focal.home.y']}px`);
  // the hero: the shared 7-bar glyph in the theme's material
  const glyph = HG.create(HFT, th, {});
  const heroBox = el('div', 'hero', fx, 'position:absolute;left:0;top:0;width:' + glyph.box.w + 'px;height:' + glyph.box.h + 'px;transform-origin:' + (glyph.box.w / 2) + 'px ' + glyph.box.line + 'px');
  // the visible baseline the bars grow from (mask reveal) — drawn in the accent, then it hands over to the bars
  const baseline = el('div', '', heroBox, 'position:absolute;left:-4%;width:108%;top:' + (glyph.box.line - T['stroke.accent'] / 2) + 'px;height:' + T['stroke.accent'] + 'px;background:var(--accent-action);transform-origin:0 50%;border-radius:' + Math.min(2, T['radius.chip']) + 'px');
  heroBox.appendChild(glyph.root);
  const cam = el('div', 'cam', stage, `position:absolute;inset:0;transform-origin:${T['focal.home.x']}px ${T['focal.home.y']}px`);

  // title lockup: "Your" in type.display; "Product" in the accent face only where the voice owns one
  const title = el('div', 'title', cam, 'position:absolute;left:0;top:0;white-space:nowrap');
  const mkLine = (text, accent) => {
    const line = el('div', 'line', title, 'position:relative');
    const word = el('div', 'word', line, 'display:inline-block;transform-origin:0% 80%');
    word.textContent = text;
    word.style.fontFamily = fontStack(accent ? ACC.family : D.family);
    word.style.fontWeight = accent ? ACC.weight : D.weight;
    word.style.fontStyle = accent && ACC.style === 'italic' ? 'italic' : 'normal';
    word.style.fontOpticalSizing = 'auto';
    word.style.color = 'var(--fg-primary)';
    word.style.textTransform = D.case === 'upper' ? 'uppercase' : 'none';
    if (D.features && D.features.length) word.style.fontFeatureSettings = D.features.map((f) => `"${f}" 1`).join(',');
    return { line, word, accent };
  };
  const lines = [mkLine('Your', false), mkLine('Product', !!ACC)];

  // CTA: core.components.button in the theme's form (policy.components.cta.form), label in type.action
  const BTN = CORE.components.button;
  const FORM = (HG.componentsPolicy(HFT, th).cta || {}).form || 'pill';
  const cta = el('div', 'cta', cam, 'position:absolute;left:0;top:0');
  const ring = el('div', '', cta, 'position:absolute;inset:0;pointer-events:none');
  const body = el('div', '', cta, 'position:absolute;inset:0;display:flex;align-items:center');
  const label = el('div', '', body, 'position:relative;white-space:nowrap;line-height:1');
  label.textContent = 'Get started';
  const onFill = FORM === 'pill' || FORM === 'block';
  label.style.cssText += `;font-family:${fontStack(ACT.family)};font-weight:${ACT.weight};color:${onFill ? 'var(--fg-on-accent)' : 'var(--fg-primary)'};` +
    `text-transform:${ACT.case === 'upper' ? 'uppercase' : 'none'};letter-spacing:${ACT.trackingEm}em;` +
    (ACT.features && ACT.features.length ? `font-feature-settings:${ACT.features.map((f) => `"${f}" 1`).join(',')};` : '');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const arrow = document.createElementNS(SVGNS, 'svg'); arrow.setAttribute('viewBox', '0 0 24 24'); arrow.style.cssText = 'position:relative;display:block;overflow:visible;flex:none';
  const ap = document.createElementNS(SVGNS, 'path'); ap.setAttribute('d', 'M4 12h15M13 5.5 19.5 12 13 18.5'); ap.setAttribute('fill', 'none');
  ap.setAttribute('stroke', onFill ? 'var(--fg-on-accent)' : 'var(--accent-action)'); ap.setAttribute('stroke-width', '2.2');
  const roundCaps = T['radius.pill'] > 0;
  ap.setAttribute('stroke-linecap', roundCaps ? 'round' : 'square'); ap.setAttribute('stroke-linejoin', roundCaps ? 'round' : 'miter');
  arrow.appendChild(ap); body.appendChild(arrow);
  const underline = FORM === 'text-link' ? el('div', '', cta, 'position:absolute;left:0;bottom:0;height:' + (((HG.componentsPolicy(HFT, th).cta || {}).underlinePx) || 4) + 'px;width:100%;background:var(--accent-action);transform-origin:0 50%') : null;

  // texture overlays
  let grainTurb = null;
  if (tex.kind === 'grain') {
    const g = document.createElementNS(SVGNS, 'svg'); g.setAttribute('width', W); g.setAttribute('height', H);
    g.style.cssText = `position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;opacity:${texOpacity}`;
    const f = document.createElementNS(SVGNS, 'filter'); f.setAttribute('id', 'gr');
    grainTurb = document.createElementNS(SVGNS, 'feTurbulence');
    grainTurb.setAttribute('type', 'fractalNoise'); grainTurb.setAttribute('baseFrequency', '0.9'); grainTurb.setAttribute('numOctaves', '2'); grainTurb.setAttribute('stitchTiles', 'stitch');
    const cm = document.createElementNS(SVGNS, 'feColorMatrix'); cm.setAttribute('type', 'saturate'); cm.setAttribute('values', '0');
    f.appendChild(grainTurb); f.appendChild(cm); g.appendChild(f);
    const r = document.createElementNS(SVGNS, 'rect'); r.setAttribute('width', '100%'); r.setAttribute('height', '100%'); r.setAttribute('filter', 'url(#gr)');
    g.appendChild(r); stage.appendChild(g);
  } else if (tex.kind === 'scanlines' || tex.kind === 'dotGrid') {
    el('div', '', stage, `position:absolute;inset:0;pointer-events:none;opacity:${texOpacity};background:` +
      (tex.kind === 'scanlines' ? 'repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 1px, transparent 1px 4px)' : `radial-gradient(circle, ${hex('fg.primary')} 1px, transparent 1.2px) 0 0 / 28px 28px`));
  }
  if (th.extras && th.extras.vignette) el('div', '', stage, `position:absolute;inset:0;pointer-events:none;background:${th.extras.vignette}`);

  /* ------------------------------------------------------------ layout (computed once fonts are in) */
  const L = {};
  function layout() {
    const margin = T['frame.margin'], col = T['frame.column'], gut = T['frame.gutter'], cols = T['frame.columns'];
    const span = Math.round(cols / 2);
    L.xText = margin + col + gut;                                     // keynote left axis: column 2
    L.fitW = span * col + (span - 1) * gut;                           // title never wider than half the grid
    const cv = document.createElement('canvas').getContext('2d');
    const xh = (fam, wt, st) => { cv.font = `${st} ${wt} 200px "${fam}"`; return cv.measureText('x').actualBoundingBoxAscent / 200; };
    // equal x-heights when the accent face joins the display face (measured on the real fonts)
    L.accK = ACC ? clamp(xh(D.family, D.weight, 'normal') / Math.max(0.2, xh(ACC.family, ACC.weight, ACC.style === 'italic' ? 'italic' : 'normal')), 1, 1.3) : 1;
    L.accTrack = ACC ? ACC.trackingEm : D.trackingEm;
    lines.forEach((ln) => { ln.word.style.fontSize = (ln.accent ? 100 * L.accK : 100) + 'px'; ln.word.style.letterSpacing = (ln.accent ? L.accTrack : D.trackingEm) + 'em'; });
    const wMax = Math.max(...lines.map((ln) => ln.word.getBoundingClientRect().width));
    L.size = Math.max(D.minPx, Math.min(D.size, Math.floor((100 * L.fitW) / wMax)));
    L.pitch = L.size * D.lineHeight;
    lines.forEach((ln) => { ln.word.style.fontSize = (ln.accent ? L.size * L.accK : L.size) + 'px'; ln.word.style.lineHeight = L.pitch + 'px'; ln.line.style.height = L.pitch + 'px'; });
    // CTA: type.action at its must-read size; the button height follows the label (size = 0.34 × height)
    L.labelPx = Math.round(Math.max(48, ACT.size));
    label.style.fontSize = L.labelPx + 'px';
    L.ctaH = FORM === 'text-link' ? Math.round(L.labelPx * 1.45) : FORM === 'block' ? Math.round(L.labelPx * 1.7) : Math.round(L.labelPx / (ACT.heightRatio || 0.34));
    L.padX = FORM === 'text-link' ? 0 : Math.round(L.ctaH * 0.4);
    L.arrow = Math.round(L.labelPx * 0.82);
    arrow.setAttribute('width', L.arrow); arrow.setAttribute('height', L.arrow);
    arrow.style.marginLeft = Math.round(L.labelPx * 0.4) + 'px';
    ap.setAttribute('stroke-width', String(+(T['stroke.accent'] * 24 / L.arrow).toFixed(3)));
    body.style.padding = `0 ${Math.round(L.padX * 0.92)}px ${FORM === 'text-link' ? Math.round(L.labelPx * 0.25) : 0}px ${L.padX}px`;
    L.ctaW = Math.ceil(L.padX * 1.92 + label.getBoundingClientRect().width + L.labelPx * 0.4 + L.arrow);
    L.radius = FORM === 'block' || FORM === 'text-link' ? 0 : Math.min(T['radius.pill'], L.ctaH / 2);
    // vertical stack: title + gap + CTA, centred on the focal row
    const gap = T['space.7'];
    const block = 2 * L.pitch + gap + L.ctaH;
    L.yTitle = Math.round(T['focal.home.y'] - block / 2);
    L.yCta = Math.round(L.yTitle + 2 * L.pitch + gap);
    title.style.left = L.xText + 'px'; title.style.top = L.yTitle + 'px';
    cta.style.left = L.xText + 'px'; cta.style.top = L.yCta + 'px';
    cta.style.width = L.ctaW + 'px'; cta.style.height = L.ctaH + 'px';
    // CTA surface: always flat (metal belongs to the hero) — brand recipe › form › material
    const brand = th.meta.brand && HFT.brands[th.meta.brand], rec = brand && brand.recipes && brand.recipes.ctaPill;
    const ir = HG.iridescent(HFT, th);
    if (FORM === 'pill' || FORM === 'block') {
      body.style.background = rec ? rec.background : 'var(--accent-action)';
      const hard = (sTok('shadow.float') || []).filter((s) => s.blur === 0);
      L.ctaShadow = (gain) => joinShadows(rec ? rec.boxShadow : '', hard.length ? shadowCSS(hard) : shadowCSS(th.meta.axes.material === 'flat' && th.meta.scheme === 'light' ? [] : sTok('shadow.float')),
        th.meta.scheme === 'dark' && ['flat', 'neon-light'].indexOf(th.meta.axes.material) >= 0 ? shadowCSS(sTok('glow.action'), gain) : '', rec ? '' : shadowCSS(T['shadow.innerLight']));
    } else if (FORM === 'outline') {
      const s = ir ? ir.stops : [hex('accent.action'), hex('accent.action'), hex('accent.action')];
      body.style.border = T['stroke.accent'] + 'px solid transparent';
      body.style.background = `linear-gradient(${hex('bg.raised')},${hex('bg.raised')}) padding-box, linear-gradient(${(ir && ir.angleDeg) || 120}deg,${s[0]},${s[1]},${s[2]}) border-box`;
      L.ctaShadow = (gain) => `0 0 ${Math.round(36 * gain)}px ${rgba(s[1], 0.22 * gain)}`;
    } else {
      L.ctaShadow = () => 'none';
    }
    body.style.borderRadius = L.radius + 'px'; ring.style.borderRadius = L.radius + 'px';
    ring.style.boxShadow = FORM === 'text-link' ? 'none' : `inset 0 0 0 ${T['stroke.accent']}px var(--accent-action)`;
    // hero: the glyph in the free half, as large as the zone allows (≤ 62 % of the frame height)
    const zone0 = L.xText + L.fitW + T['space.7'], zone1 = W - margin;
    L.k = Math.min((H * 0.62) / glyph.box.h, (zone1 - zone0) / glyph.box.w);
    L.restX = Math.round((zone0 + zone1) / 2); L.restY = T['focal.home.y'];
    L.macroX = T['focal.home.x']; L.macroY = T['focal.home.y']; L.macroS = 1.18;
    L.push = POL.camera.verb === 'pushIn' ? 0.035 * HF.cameraSpeed : POL.camera.verb === 'pullBack' ? -0.035 * HF.cameraSpeed : 0;
  }

  /* ------------------------------------------------------------ reveal / emphasis mechanisms (core.motion.byPersonality) */
  function revealText(t, t0, i) {
    const k = HF.enter(t, t0, 'headline'), u = clamp((t - t0) / HF.d('headline')), o = HF.p(t, t0, t0 + HF.d('ui'), 'ui');
    const r = { op: u > 0 ? 1 : 0, y: 0, s: 1, rot: 0, blur: 0, track: 0, clip: false };
    if (REVEAL === 'mask') { r.y = (1 - k) * L.pitch; r.clip = true; }
    else if (REVEAL === 'light') { r.op = o; r.y = (1 - k) * du(SC.travelDu.small); r.blur = T['blur.reveal'] * (1 - clamp(k)) * 0.6; r.track = 0.06 * (1 - clamp(k)); }
    else if (REVEAL === 'assembly') { r.op = clamp(u * 5); r.s = lerp(0.55, 1, k); r.y = (1 - k) * du(SC.travelDu.medium); r.rot = (i % 2 ? 1 : -1) * SC.expressiveTiltMaxDeg * 1.5 * (1 - k); }
    else if (REVEAL === 'focus') { r.op = o; r.blur = T['blur.reveal'] * (1 - clamp(k)); }
    else { r.op = u > 0 ? 1 : 0; }
    return r;
  }
  /* the hero: per-bar state + glyph-level light */
  function revealHero(t) {
    const t0 = CUE.hero, dHero = HF.d('hero');
    const g = { op: 1, expo: 1, blur: 0, s: 1, base: 0, sweep: null };
    const bars = [];
    if (REVEAL === 'mask') {               // the baseline draws L→R, then each bar grows up and down from it (S1 order)
      const lineK = HF.p(t, t0, t0 + HF.d('ui'), 'move');
      g.base = lineK;
      const b0 = t0 + HF.d('ui') * 0.55;
      for (let i = 0; i < 7; i++) { const n = ORDER.indexOf(i); const k = HF.enter(t, b0 + n * HF.stagger * 0.6, 'hero'); bars.push({ sy: Math.max(0.0001, k), op: k > 0 ? 1 : 0, y: 0, rot: 0, sx: 1 }); }
      g.baseOp = 1 - HF.p(t, b0 + 6 * HF.stagger * 0.6 + dHero * 0.6, b0 + 6 * HF.stagger * 0.6 + dHero, 'exit');
    } else if (REVEAL === 'light') {       // exposure 0.35 → 1 while one sheen passes over the bars (never a dark box)
      g.op = HF.p(t, t0, t0 + HF.d('ui'), 'ui');
      g.expo = lerp(0.35, 1, HF.p(t, t0, t0 + dHero * 1.2, 'enter'));
      g.s = lerp(SC.scaleEnterFrom, 1, HF.enter(t, t0, 'hero'));
      const sw = HF.p(t, t0 + 0.1, t0 + 0.1 + dHero * 1.1, 'camera');
      g.sweep = sw > 0 && sw < 1 ? { x: lerp(-200, 1000, sw), amt: Math.sin(Math.PI * sw) } : null;
      for (let i = 0; i < 7; i++) bars.push({ sy: 1, op: 1, y: 0, rot: 0, sx: 1 });
    } else if (REVEAL === 'assembly') {    // each bar pops in with overshoot; stretch in flight, squash on the overshoot
      for (let i = 0; i < 7; i++) {
        const n = ORDER.indexOf(i), b0 = t0 + n * HF.stagger * 0.7;
        const k = HF.enter(t, b0, 'ui'), u = clamp((t - b0) / HF.d('ui'));
        const peak = Math.max(1e-3, HF.os);
        const v = k < 1 ? -(1 - clamp(k)) : clamp((k - 1) / peak);
        bars.push({ sy: Math.max(0.0001, lerp(0.2, 1, k) * (1 - SQUASH * v)), sx: 1 + SQUASH * v * 0.8, op: clamp(u * 6), y: (1 - k) * du(SC.travelDu.medium) * (i % 2 ? -1 : 1), rot: (i % 2 ? 1 : -1) * SC.expressiveTiltMaxDeg * (1 - clamp(k)) });
      }
    } else if (REVEAL === 'focus') {
      g.op = HF.p(t, t0, t0 + dHero, 'ui'); g.blur = T['blur.reveal'] * (1 - clamp(HF.enter(t, t0, 'hero')));
      for (let i = 0; i < 7; i++) bars.push({ sy: 1, op: 1, y: 0, rot: 0, sx: 1 });
    } else {
      for (let i = 0; i < 7; i++) bars.push({ sy: 1, op: 1, y: 0, rot: 0, sx: 1 });
    }
    return { g, bars };
  }
  function revealCta(t) {
    const t0 = CUE.cta, k = HF.enter(t, t0, 'ui'), u = clamp((t - t0) / HF.d('ui')), o = HF.p(t, t0, t0 + HF.d('chip'), 'ui');
    const r = { op: u > 0 ? 1 : 0, s: 1, rot: 0, wFrac: 1, blur: 0, y: 0 };
    if (REVEAL === 'mask') { r.wFrac = lerp(L.ctaH / L.ctaW, 1, k); }
    else if (REVEAL === 'light') { r.op = o; r.s = lerp(SC.scaleEnterFrom, 1, k); r.blur = T['blur.reveal'] * 0.5 * (1 - clamp(k)); }
    else if (REVEAL === 'assembly') { r.op = clamp(u * 6); r.s = HF.pop(t, t0, 0.6, 'ui'); r.rot = -SC.expressiveTiltMaxDeg * 2 * (1 - clamp(k)); r.y = (1 - k) * du(SC.travelDu.small); }
    else if (REVEAL === 'focus') { r.op = o; r.blur = T['blur.reveal'] * (1 - clamp(k)); }
    return r;
  }
  function emphasis(t) {
    // press on the CTA (every style), then the personality's emphasis; the hero answers with one light sweep
    const t0 = CUE.press, hit = HF.d('hit'), ft = HF.followThrough;
    let s = HF.kf(t, [[t0, 1], [t0 + hit, BTN.pressScale || SC.pressScale, 'ui'], [t0 + hit + HF.d('chip'), 1, 'enter']]);
    let glow = 0, ringK = -1, heroS = 1, heroGlow = 0;
    if (EMPH === 'scale') {
      s = HF.kf(t, [[t0, 1], [t0 + hit, BTN.pressScale || SC.pressScale, 'ui'], [t0 + hit + HF.d('chip'), 1 + HF.os, 'enter'], [t0 + hit + HF.d('chip') + HF.d('ui'), 1, 'ui']]);
      heroS = HF.kf(t, [[t0 + ft, 1], [t0 + ft + HF.d('chip'), 1 + HF.os * 0.5, 'enter'], [t0 + ft + HF.d('chip') + HF.d('ui'), 1, 'ui']]);
    } else if (EMPH === 'contrast') {
      glow = HF.kf(t, [[t0, 0], [t0 + hit, 1, 'enter'], [t0 + hit + HF.d('hero'), 0, 'ui']]);
      ringK = t >= t0 + hit ? HF.p(t, t0 + hit, t0 + hit + HF.d('hero'), 'enter') : -1;
      heroGlow = HF.kf(t, [[t0 + ft, 0], [t0 + ft + hit, 1, 'enter'], [t0 + ft + HF.d('hero'), 0, 'ui']]);
    }
    const sw0 = t0 + hit + HF.stagger;                                   // the hero answers the press one stagger later
    const sw = HF.p(t, sw0, sw0 + HF.d('sweep'), 'camera');
    return { s, glow, ringK, heroS, heroGlow, sweep: lerp(-200, 1000, sw), sweepAmt: sw > 0 && sw < 1 ? Math.sin(Math.PI * sw) : 0 };
  }

  /* ------------------------------------------------------------ frame */
  const f4 = (v) => +v.toFixed(4);
  function update(t) {
    const frame = Math.round(t * FPS);
    const camK = HF.p(t, 0, DUR, 'camera');
    const camS = 1 + L.push * camK;
    const camT = `scale(${f4(camS)})`;
    fx.style.transform = camT; cam.style.transform = camT;

    // ---- hero: reveal at the centre (macro) → settle to the free half → emphasis
    const rv = revealHero(t), em = emphasis(t);
    const m = HF.p(t, CUE.settle, CUE.settle + HF.d('hero'), 'move');
    const cx = lerp(L.macroX, L.restX, m), cy = lerp(L.macroY, L.restY, m);
    const sBase = L.k * lerp(L.macroS, 1, m) * rv.g.s * em.heroS;
    heroBox.style.transform = `translate(${f4(cx - glyph.box.w / 2)}px,${f4(cy - glyph.box.line)}px) scale(${f4(sBase)})`;
    heroBox.style.opacity = f4(rv.g.op);
    const bright = rv.g.expo * (1 + 0.18 * em.heroGlow);
    heroBox.style.filter = [rv.g.blur > 0.05 ? `blur(${(rv.g.blur / sBase).toFixed(2)}px)` : '', Math.abs(bright - 1) > 0.002 ? `brightness(${bright.toFixed(3)})` : ''].filter(Boolean).join(' ') || 'none';
    glyph.bars.forEach((b, i) => {
      const s = rv.bars[i];
      b.el.style.opacity = f4(s.op);
      b.el.style.transform = `translateY(${f4(s.y)}px) rotate(${f4(s.rot)}deg) scale(${f4(s.sx)},${f4(s.sy)})`;
    });
    baseline.style.opacity = REVEAL === 'mask' ? f4(clamp(rv.g.baseOp === undefined ? 0 : rv.g.baseOp)) : '0';
    baseline.style.transform = `scaleX(${f4(Math.max(0.0001, rv.g.base))})`;
    const sweep = rv.g.sweep || (em.sweepAmt > 0 ? { x: em.sweep, amt: em.sweepAmt } : null);
    glyph.setSweep(sweep ? sweep.x : 0, sweep ? sweep.amt : 0);
    if (glyph.atmos) glyph.atmos.style.opacity = f4(clamp(rv.g.op * rv.g.expo * (1 + em.heroGlow)));
    // background light pool: follows the hero (parallax 0.6) + periphery drift; lights up with the hero
    const gp = T['glow.pool'], px = lerp(T['focal.home.x'], cx, 0.6) + T['motion.peripheryDrift'] * t, py = T['focal.home.y'];
    pool.style.background = `radial-gradient(circle ${gp.radiusPx}px at ${f4(px)}px ${py}px, ${gp.stops.map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(', ')})`;
    pool.style.opacity = f4(0.35 + 0.65 * clamp(rv.g.op * rv.g.expo));

    // ---- title lines
    lines.forEach((ln, i) => {
      const r = revealText(t, T_TITLE + i * HF.staggerLine2, i);
      ln.word.style.opacity = f4(r.op);
      ln.word.style.transform = `translateY(${f4(r.y)}px) rotate(${f4(r.rot)}deg) scale(${f4(r.s)})`;
      ln.word.style.filter = r.blur > 0.05 ? `blur(${r.blur.toFixed(2)}px)` : 'none';
      ln.word.style.letterSpacing = f4((ln.accent ? L.accTrack : D.trackingEm) + r.track) + 'em';
      ln.line.style.clipPath = r.clip ? 'inset(-60% -30% -0.28em -30%)' : 'none';
    });

    // ---- CTA
    const rc = revealCta(t);
    const lt0 = CUE.cta + HF.staggerAccent;
    const lk = REVEAL === 'mask' ? HF.enter(t, lt0, 'chip') : 1;
    const ak = HF.enter(t, lt0 + (REVEAL === 'mask' ? HF.stagger : 0), 'chip');
    cta.style.opacity = f4(rc.op);
    cta.style.transformOrigin = `${f4(L.ctaH / 2)}px 50%`;
    cta.style.transform = `translateY(${f4(rc.y)}px) rotate(${f4(rc.rot)}deg) scale(${f4(rc.s * em.s)})`;
    cta.style.filter = rc.blur > 0.05 ? `blur(${rc.blur.toFixed(2)}px)` : 'none';
    body.style.clipPath = rc.wFrac < 0.999 ? `inset(0 ${f4((1 - rc.wFrac) * L.ctaW)}px 0 0 round ${f4(L.radius)}px)` : 'none';
    body.style.boxShadow = L.ctaShadow(1 + em.glow * 1.6);
    if (underline) underline.style.transform = `scaleX(${f4(Math.max(0.0001, rc.wFrac))})`;
    label.style.opacity = f4(clamp(lk));
    label.style.transform = `translateX(${f4((1 - lk) * -du(SC.travelDu.small))}px)`;
    arrow.style.opacity = f4(clamp(ak * 1.5));
    arrow.style.transform = `translateX(${f4((1 - ak) * -du(SC.travelDu.small))}px)`;
    ring.style.opacity = em.ringK >= 0 ? f4(0.85 * (1 - em.ringK)) : '0';
    ring.style.transform = em.ringK >= 0 ? `scale(${f4(1 + 0.12 * em.ringK)},${f4(1 + 0.12 * em.ringK * (L.ctaW / L.ctaH))})` : 'none';

    if (grainTurb) grainTurb.setAttribute('seed', String((Math.floor(frame / 2) % 97) + 1));   // reseed at 12 fps
  }

  /* ------------------------------------------------------------ capture contract */
  window.__comp = { width: W, height: H, fps: FPS, duration: DUR, style: th.meta.style, personality: HF.personality, reveal: REVEAL, emphasis: EMPH, hero: glyph.treatment, cta: FORM };
  window.__seek = async (t) => { await window.__ready; update(Math.max(0, Math.min(DUR, t))); return true; };
  window.__ready = (async () => {
    await linkLoaded;
    const faces = [`${D.weight} 100px "${D.family}"`, `${ACT.weight} 100px "${ACT.family}"`].concat(ACC ? [`${ACC.style === 'italic' ? 'italic ' : ''}${ACC.weight} 100px "${ACC.family}"`] : []);
    await Promise.all(faces.map((f) => document.fonts.load(f, 'Your Product Get started GET STARTED x').catch(() => null)));
    await document.fonts.ready;
    layout();
    update(0);
    document.documentElement.dataset.ready = '1';
    return true;
  })();
})();
