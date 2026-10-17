/*! hero-glyph.js — the ONE hero motif of both proofs: the 7-bar wave (S1 geometry, generalised), drawn flat / 2.5D
 *  in the active theme's material. Shared by styleboard.js (frame D) and motion_demo/demo.js (the hero shape), so the
 *  styleboard and the film show the same object. Never a blank capsule, never a metallic slab.
 *
 *  Every look decision is read from the theme (no style names in here):
 *    geometry   S1: 7 bars 86 px wide, step 120, heights 311/426/651/311/395/290/185, peak = bar 3 (index 2),
 *               all bars centred on one line (y 325.5) → the wave grows from a visible baseline
 *    treatment  policy.hero.treatment (fallback: HFT.styles[style].composition.hero) › voice / texture / material axis
 *                 flat · satin (metallic-subtle) · clay · soft-shadow · paper-grain · neon (emitter) · glass/iridescent
 *                 tint-steps (inactive bars = accent tints 30–45 %) · rim-silhouette · segments (scanlines) · dots (pixel)
 *    colour     accent.action, accent ramp, accent.secondary / tertiary, three(theme).materials.hero.color, bg.*, fg.*
 *    shadow     shadow.float (style token layer first), glow.hero, atmos.primary; halftone only as the offset shadow
 *    brand      a brand recipe for the motif (brands[*].recipes.s1Capsule) wins for the fill and the light
 *
 *  API  HeroGlyph.create(HFT, theme, opts) → { root, bars[], box, peak, setSweep(x, amt), theme, mini }
 *         opts: { multi, treatment, shadow:'halftone'|'hard-offset'|null, atmos:true, idPrefix,
 *                 scale: on-screen px per glyph px (the scale the caller will apply, camera included; default 1),
 *                 mini: true | false (force; default = bar narrower than 24 px on screen) }
 *       each bar: { el, i, x, y, w, h }  — el is positioned in the 806 × 651 box; transform-origin = the wave's
 *       centre line, so scaleY(k) grows a bar from the baseline.
 *  MINI SIZE  bars narrower than 24 px on screen (an S1 in a lockup, a chip, a favicon-size mark) get a SOLID accent fill
 *       and a ~6 px glow at 35 % instead of the treatment: gradients, sheens, dots and segments turn to mush at that size.
 *       Decide it once per shot from the largest scale the glyph reaches, never mid-move (a fill swap pops).
 *       A mark built from bars must be heavier and taller than the wordmark's stems, or it reads as letters («IIII»).
 */
(function (root) {
  'use strict';
  const S1 = { w: 86, step: 120, T: [170, 112.5, 0, 170, 128, 180.5, 233], H: [311, 426, 651, 311, 395, 290, 185], boxW: 806, boxH: 651, line: 325.5, peak: 2 };
  const TINT = [0.42, 0.36, 1, 0.45, 0.33, 0.40, 0.30];   /* inactive bars: 30–45 % accent tint, value-stepped */
  const MINI_PX = 24;                                      /* bars narrower than this on screen → solid fill (see MINI SIZE) */

  const rgb = (h) => { const n = parseInt(String(h).slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + (+a).toFixed(3) + ')'; };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const shadowCss = (arr, k) => (!arr || !arr.length) ? '' : arr.filter((s) => s.alpha > 0).map((s) => (s.inset ? 'inset ' : '') + s.x * (k || 1) + 'px ' + s.y * (k || 1) + 'px ' + s.blur * (k || 1) + 'px ' + (s.spread || 0) + 'px ' + rgba(s.color, s.alpha)).join(', ');
  const joinSh = (...xs) => xs.filter(Boolean).join(', ') || 'none';

  /* style-level data the engine may not surface yet (handoff E3 / E4): read the theme first, then the style */
  function styleOf(HFT, th) { return (th.meta.style && HFT.styles[th.meta.style]) || null; }
  function styleTok(HFT, th, k) { const s = styleOf(HFT, th); return s && s.tokens && s.tokens[k] !== undefined ? s.tokens[k] : th.tokens[k]; }
  const ARCH_BY_COMP = { 'minimal-centred': 'centre', 'editorial-asymmetric': 'editorial-split', 'keynote-left-axis': 'thirds', 'poster-type-led': 'full-bleed', 'maximal-collage': 'z-corner' };
  function heroPolicy(HFT, th) {
    if (th.policy.hero) return th.policy.hero;
    const s = styleOf(HFT, th);
    if (s && s.composition && s.composition.hero) return s.composition.hero;
    return { archetype: ARCH_BY_COMP[th.policy.composition.id] || 'centre' };
  }
  function decorPolicy(HFT, th) {
    if (th.policy.decor) return th.policy.decor;
    const s = styleOf(HFT, th);
    return (s && s.composition && s.composition.decor) || { maxPerFrame: 2, sparklesPerFilm: 1, halftone: th.meta.axes.texture === 'halftone' ? 'hero-shadow' : 'none', backingShapeWithComponent: false };
  }
  function componentsPolicy(HFT, th) {
    if (th.policy.components) return th.policy.components;
    const s = styleOf(HFT, th);
    return (s && s.components) || { cta: { form: 'pill' }, prompt: { form: 'bar' } };
  }
  /* ---- type roles for both proofs. type.input / type.action come from the engine; until it emits them
          (handoff E2) they resolve from the style's semantic data (HFT.styles[id].semantic.type) on the same floors.
          CAPS ≤ 64 px get positive tracking (core rule, handoff E1) — a no-op once the engine emits it. */
  const MONO_VOICES = ['mono-terminal', 'pixel'];
  function fallbackRole(HFT, th, r) {
    const st = styleOf(HFT, th), sem = st && st.type && st.type.semantic && st.type.semantic[r], T = th.tokens;
    const body = T['type.body'], code = T['type.code'], label = T['type.label'];
    const fam = sem ? sem.family : MONO_VOICES.indexOf(th.meta.axes.typeVoice) >= 0 ? code.family : body.family;
    const upper = !!(sem && sem.case === 'upper');
    const weight = Math.max(500, sem ? sem.weight : r === 'action' ? Math.max(600, body.weight) : body.weight);
    const size = Math.max(48, fam === code.family ? code.size : upper ? label.size : body.size);
    return { family: fam, weight, size, lineHeight: upper ? 1 : 1.2, trackingEm: sem && typeof sem.tracking === 'number' ? sem.tracking : 0, case: upper ? 'upper' : 'sentence', features: upper ? ['case'] : [], role: 'mustRead', heightRatio: r === 'action' ? 0.34 : undefined, fallback: true };
  }
  function capsRule(HFT, th, r, t) {
    if (!t || t.case !== 'upper') return t;
    let tr = t.trackingEm;
    const st = styleOf(HFT, th), sem = st && st.type && st.type.semantic && st.type.semantic[r];
    if (t.size <= 64 && tr < 0.04) tr = Math.min(0.12, Math.max(0.04, sem && typeof sem.tracking === 'number' ? sem.tracking : 0.06));
    else if (t.size > 64 && t.size < 120 && tr < -0.005) tr = -0.005;
    const ws = t.wordSpacingEm || (/Condensed/.test(t.family) ? 0.1 : 0);
    return tr === t.trackingEm && !ws ? t : Object.assign({}, t, { trackingEm: tr, wordSpacingEm: ws });
  }
  function role(HFT, th, r) {
    const t = th.tokens['type.' + r] || ((r === 'input' || r === 'action') ? fallbackRole(HFT, th, r) : null);
    return capsRule(HFT, th, r, t);
  }
  /* an accent FACE on one word: didone / editorial serif voices; variable-kinetic = same family, 200 vs 900 */
  const ACCENT_WORD_VOICES = ['didone-luxury', 'editorial-serif', 'variable-kinetic'];
  function accentFace(HFT, th) {
    const fa = th.tokens['font.accent'];
    if (!fa || ACCENT_WORD_VOICES.indexOf(th.meta.axes.typeVoice) < 0) return null;
    const st = styleOf(HFT, th), a = st && st.type && st.type.roles && st.type.roles.accent;
    return { family: fa.family, style: fa.style || 'normal', weight: (a && a.weights && a.weights[0]) || 400, trackingEm: th.meta.axes.typeVoice === 'variable-kinetic' ? 0 : -0.01 };
  }

  function iridescent(HFT, th) {
    const s = styleOf(HFT, th), m = s && s.material && s.material.iridescent;
    if (m) return m;
    if (th.meta.axes.palette === 'spectral' && th.tokens['accent.secondary']) return { stops: [th.tokens['accent.action'].hex, mix(th.tokens['accent.action'].hex, th.tokens['accent.secondary'].hex, 0.5), th.tokens['accent.secondary'].hex], angleDeg: 135 };
    return null;
  }
  function treatmentOf(HFT, th, opts) {
    if (opts && opts.treatment) return opts.treatment;
    const hp = heroPolicy(HFT, th), a = th.meta.axes;
    if (hp.treatment) return hp.treatment;
    if (a.typeVoice === 'pixel') return 'dots';
    if (a.texture === 'scanlines') return 'segments';
    if (a.material === 'glass-modern' && iridescent(HFT, th)) return 'iridescent';
    return { flat: 'flat', 'metallic-subtle': 'satin', clay: 'clay', 'soft-shadow': 'tint-steps', 'paper-grain': 'tint-steps', 'neon-light': 'neon', 'glass-modern': 'glass' }[a.material] || 'flat';
  }

  function create(HFT, th, opts) {
    opts = opts || {};
    const C = HFT.color, T = th.tokens, dark = th.meta.scheme === 'dark';
    const hex = (k) => (T[k] && T[k].hex) || null;
    const shiftL = (h, dL, dC) => { const c = C.fromHex(h); return C.mk(Math.max(0, Math.min(1, c.L + dL)), Math.max(0, c.C * (dC === undefined ? 1 : dC)), c.H).hex; };
    const acc = hex('accent.action'), base = hex('bg.base'), raised = hex('bg.raised');
    const sec = hex('accent.secondary') || acc;
    const tert = th.extras && th.extras['accent.tertiary'];
    const treat = treatmentOf(HFT, th, opts);
    const brand = th.meta.brand && HFT.brands[th.meta.brand];
    const recipe = brand && brand.recipes && brand.recipes.s1Capsule;   /* the brand's own motif recipe wins */
    const x3 = HFT.three(th), heroCol = (x3.materials.hero && x3.materials.hero.color) || T['material.hero3d.color'] || acc;
    const radius = (w) => Math.min(T['radius.pill'], w / 2);
    let shadowMode = opts.shadow !== undefined ? opts.shadow : (heroPolicy(HFT, th).shadow || (decorPolicy(HFT, th).halftone === 'hero-shadow' ? 'halftone' : null));
    if (shadowMode === 'halftone' && th.meta.axes.texture !== 'halftone') shadowMode = null;   /* a halftone shadow needs the halftone texture axis */
    const floatSh = styleTok(HFT, th, 'shadow.float');
    const glowHero = styleTok(HFT, th, 'glow.hero');
    const irid = iridescent(HFT, th);
    const core = hex('accent.core') || shiftL(acc, 0.1, 0.5);

    const rootEl = document.createElement('div');
    rootEl.style.cssText = 'position:absolute;left:0;top:0;width:' + S1.boxW + 'px;height:' + S1.boxH + 'px;';
    const add = (parent, css, html) => { const e = document.createElement('div'); e.style.cssText = css; if (html) e.innerHTML = html; parent.appendChild(e); return e; };

    /* atmosphere: the light pool behind the hero (dark grounds), or the hero glow for an emitter / rim */
    const at = T['atmos.primary'];
    let atmos = null;
    if (opts.atmos !== false && dark && treat !== 'tint-steps') {
      const col = treat === 'rim-silhouette' && glowHero && glowHero[0] ? glowHero[0].color : at ? at.hex : acc;
      const a0 = treat === 'rim-silhouette' ? 0.22 : at ? Math.min(0.32, at.alpha * 2.2) : 0.2;
      atmos = add(rootEl, 'position:absolute;left:-35%;top:-18%;width:170%;height:136%;pointer-events:none;background:radial-gradient(ellipse 50% 50% at ' + (treat === 'rim-silhouette' ? '60%' : '50%') + ' 50%,' + rgba(col, a0) + ',' + rgba(col, a0 * 0.3) + ' 45%,transparent 72%);filter:blur(30px);');
    }

    /* colour of bar i */
    const colour0 = (i) => {
      if (opts.multi || treat === 'multi') { const cs = [acc, sec, tert, acc].filter(Boolean); return cs[[0, 2, 0, 1, 3, 0, 2][i] % cs.length]; }
      if (treat === 'tint-steps') return i === S1.peak ? acc : mix(base, acc, TINT[i]);
      if (treat === 'satin') return heroCol;
      if (treat === 'rim-silhouette') return mix(base, raised, 0.6);
      return acc;
    };
    /* opts.fade < 1: a depth echo of the glyph (exploded stack) — the same colours pulled toward the ground */
    const colourOf = (i) => (opts.fade !== undefined && opts.fade < 1 ? mix(base, colour0(i), opts.fade) : colour0(i));

    const bars = [];
    const bwK = Math.max(0.3, Math.min(1, heroPolicy(HFT, th).barWidth || 1));   /* a voice may slim the bars (didone hairlines) */
    /* mini size: < 24 px on screen → solid accent fill + ~6 px glow at 35 % (gradients turn to mush at that size) */
    const k = opts.scale > 0 ? opts.scale : 1;
    const mini = opts.mini !== undefined ? !!opts.mini : Math.round(S1.w * bwK) * k < MINI_PX;
    if (mini) shadowMode = null;   /* no halftone / hard offset at mini size either */
    for (let i = 0; i < 7; i++) {
      const w = Math.round(S1.w * bwK), x = i * S1.step + (S1.w - w) / 2, y = S1.T[i], h = S1.H[i], col = colourOf(i), r = radius(w);
      /* the offset shadow layer (halftone or hard) travels with the bar: it is a child of the bar group */
      const g = add(rootEl, 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;transform-origin:50% ' + ((S1.line - y) / h * 100).toFixed(2) + '%;');
      if (shadowMode === 'halftone')
        add(g, 'position:absolute;left:' + Math.round(w * 0.36) + 'px;top:' + Math.round(w * 0.3) + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + r + 'px;opacity:.6;background:radial-gradient(circle,' + mix(col, hex('fg.primary') || '#000', 0.55) + ' 44%,transparent 48%) 0 0/14px 14px;');
      const body = add(g, 'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;border-radius:' + r + 'px;overflow:hidden;');
      let bg = col, sh = '';
      switch (treat) {
        case 'dots': { /* emissive dot column, 2 wide on a w/2 pitch */
          const p = w / 2, d = Math.round(p * 0.72), rows = Math.max(1, Math.round(h / p));
          const st = th.detail && th.detail.glowStack;
          const halo = st ? st.layers.slice(0, 3).map((l) => '0 0 ' + Math.round(l.blur * 0.6) + 'px ' + rgba(st.color, l.alpha * 0.9)).join(', ') : '';
          body.style.overflow = 'visible'; body.style.borderRadius = '0';
          const y0 = (h - rows * p) / 2;
          for (let j = 0; j < rows; j++) for (let q = 0; q < 2; q++)
            add(body, 'position:absolute;left:' + (q * p + (p - d) / 2) + 'px;top:' + (y0 + j * p + (p - d) / 2) + 'px;width:' + d + 'px;height:' + d + 'px;border-radius:50%;background:radial-gradient(circle,' + (st ? st.core : col) + ' 0%,' + col + ' 70%);box-shadow:' + (halo || 'none') + ';');
          bg = 'transparent'; break;
        }
        case 'segments': { /* terminal VU column: sharp segments, brightest at the top */
          const seg = 34, gap = 12, n = Math.floor((h + gap) / (seg + gap));
          body.style.overflow = 'visible'; body.style.borderRadius = '0';
          const y0 = (h - (n * seg + (n - 1) * gap)) / 2;
          for (let j = 0; j < n; j++) add(body, 'position:absolute;left:0;top:' + (y0 + j * (seg + gap)) + 'px;width:' + w + 'px;height:' + seg + 'px;border-radius:' + Math.min(T['radius.chip'], 4) + 'px;background:' + col + ';opacity:' + (1 - 0.55 * j / Math.max(1, n - 1)).toFixed(2) + ';' + (j === 0 && dark ? 'box-shadow:0 0 18px ' + rgba(col, 0.55) + ';' : ''));
          bg = 'transparent'; break;
        }
        case 'satin': /* metallic-subtle as satin ribbon: soft top light falling into the ground, one faint edge sheen — never a slab */
          bg = 'linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.12) 16%,rgba(255,255,255,0) 38%),' +
            'linear-gradient(180deg,' + shiftL(col, 0.05, 0.9) + ' 0%,' + col + ' 28%,' + shiftL(col, -0.1) + ' 68%,' + shiftL(col, -0.3, 0.8) + ' 100%)';
          sh = 'inset 1px 0 0 rgba(255,255,255,.28)';
          body.style.webkitMaskImage = body.style.maskImage = 'linear-gradient(180deg,#000 0%,#000 58%,rgba(0,0,0,.18) 100%)';
          break;
        case 'clay':
        case 'multi':
          bg = 'linear-gradient(180deg,' + shiftL(col, 0.06) + ' 0%,' + col + ' 45%,' + shiftL(col, -0.05) + ' 100%)';
          sh = joinSh(shadowCss(T['shadow.innerLight']), 'inset 0 -' + Math.round(w * 0.14) + 'px ' + Math.round(w * 0.24) + 'px ' + rgba(hex('fg.primary') || '#000', 0.14), shadowMode ? '' : shadowCss(floatSh));
          break;
        case 'tint-steps': /* soft UI / paper: tinted bars, the peak carries the accent; soft depth only */
          bg = col;
          sh = joinSh(shadowCss(T['shadow.innerLight']), th.meta.axes.material === 'paper-grain' ? shadowCss(T['shadow.contact']) : shadowCss(floatSh));
          break;
        case 'neon': {
          const st = th.detail && th.detail.glowStack;
          bg = 'linear-gradient(90deg,' + col + ' 0%,' + (st ? st.core : core) + ' 50%,' + col + ' 100%)';
          sh = st ? st.layers.map((l) => '0 0 ' + l.blur + 'px ' + rgba(st.color, Math.min(1, l.alpha * 1.4))).join(', ') : shadowCss(T['glow.action']);
          body.style.overflow = 'visible';
          break;
        }
        case 'iridescent':
        case 'glass': { /* modern glass with an iridescent body: one gradient across the whole glyph, inner light, soft halo */
          const stops = (irid && irid.stops) || [acc, sec, acc];
          const ang = (irid && irid.angleDeg) || 135;
          bg = 'linear-gradient(180deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,0) 22%,rgba(255,255,255,0) 78%,rgba(255,255,255,.12) 100%),' +
            'linear-gradient(' + ang + 'deg,' + rgba(stops[0], 0.92) + ' 0%,' + rgba(stops[1], 0.86) + ' 50%,' + rgba(stops[2], 0.92) + ' 100%) ' + (-x) + 'px ' + (-y) + 'px/' + S1.boxW + 'px ' + S1.boxH + 'px';
          sh = joinSh('inset 0 0 0 1.5px rgba(255,255,255,.45)', 'inset 0 2px 0 rgba(255,255,255,.55)', '0 0 34px ' + rgba(stops[1], 0.35), shadowCss(floatSh, 0.5));
          break;
        }
        case 'rim-silhouette': { /* one body against the dark, lit from behind-right: a rim of the accent on its edge */
          const rim = (glowHero && glowHero[0] && glowHero[0].color) || acc;
          bg = 'linear-gradient(90deg,' + col + ' 0%,' + col + ' 62%,' + mix(col, rim, 0.22) + ' 88%,' + mix(col, rim, 0.55) + ' 100%)';
          sh = joinSh('inset -3px 0 0 ' + rgba(rim, 0.95), 'inset -10px 0 14px -6px ' + rgba(rim, 0.7), '6px 0 26px -4px ' + rgba(rim, 0.42));
          body.style.overflow = 'visible';
          break;
        }
        default: { /* flat: the fill itself (brand recipe when the identity has one); light as glow on dark only */
          if (recipe && recipe.background) { bg = recipe.background; sh = dark ? recipe.boxShadow || shadowCss(T['glow.action']) : ''; }
          else { bg = col; sh = dark ? shadowCss(styleTok(HFT, th, 'glow.action'), 0.6) : ''; }
          if (shadowMode === 'hard-offset' || (floatSh && floatSh.length && floatSh[0].blur === 0)) sh = joinSh(shadowCss(floatSh), sh);
          body.style.overflow = 'visible';
        }
      }
      if (mini) {   /* one solid fill per bar (its own colour: accent, tint step or multi), glow 6 px on screen at 35 % */
        const solid = treat === 'dots' || treat === 'segments' || treat === 'iridescent' || treat === 'glass' || treat === 'satin' || treat === 'neon' || treat === 'rim-silhouette' ? acc : col;
        body.innerHTML = ''; body.style.overflow = 'hidden'; body.style.borderRadius = r + 'px';
        body.style.webkitMaskImage = body.style.maskImage = 'none';
        bg = solid; sh = '0 0 ' + (6 / k).toFixed(2) + 'px ' + rgba(solid, 0.35);
      }
      body.style.background = bg;
      body.style.boxShadow = sh || 'none';
      /* light sweep (the demo's emphasis): a sheen band in glyph coordinates, clipped to the bar */
      const sheen = add(body, 'position:absolute;left:0;top:0;width:100%;height:100%;border-radius:inherit;pointer-events:none;opacity:0;mix-blend-mode:' + (dark ? 'screen' : 'soft-light') + ';');
      bars.push({ el: g, body, sheen, i, x, y, w, h, colour: col });
    }

    const sweepCol = treat === 'satin' ? '#FFFFFF' : treat === 'rim-silhouette' ? ((glowHero && glowHero[0] && glowHero[0].color) || acc) : core;
    /** sweep: x in glyph coordinates (−200 … 1000), amt 0…1 */
    function setSweep(sx, amt) {
      bars.forEach((b) => {
        if (!amt) { b.sheen.style.opacity = '0'; return; }
        const p = sx - b.x, bw = 150;
        b.sheen.style.opacity = String(Math.min(1, amt));
        b.sheen.style.background = 'linear-gradient(100deg,rgba(255,255,255,0) ' + (p - bw / 2) + 'px,' + rgba(sweepCol, 0.75) + ' ' + p + 'px,rgba(255,255,255,0) ' + (p + bw / 2) + 'px)';
      });
    }
    return { root: rootEl, bars, box: { w: S1.boxW, h: S1.boxH, line: S1.line }, peak: S1.peak, setSweep, atmos, treatment: mini ? 'mini-solid' : treat, mini, theme: th };
  }

  root.HeroGlyph = { S1, MINI_PX, create, heroPolicy, decorPolicy, componentsPolicy, styleTok, iridescent, treatmentOf, role, accentFace, ACCENT_WORD_VOICES };
})(typeof window !== 'undefined' ? window : globalThis);
