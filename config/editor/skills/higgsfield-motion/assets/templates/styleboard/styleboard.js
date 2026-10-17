/*! styleboard.js — HFT proof (a): the same 4 archetype frames in every preset + derived identities.
 *  Every frame is a real 1920x1080 composition, built ONLY from HFT semantic tokens and policies:
 *    theme / derive → tokens, policy (composition, hero archetype, decor budget, components), ramps, extras
 *    toCSSVars (scoped per theme) · fontLink · hero-glyph.js (the shared 7-bar hero, also used by the motion demo)
 *  Frame A (title) and C (CTA) follow the composition axis — centred only where the axis is minimal-centred;
 *  frame D follows policy.hero.archetype (thirds · z-corner · editorial-split · full-bleed · orbit · exploded-stack ·
 *  macro · type-led · centre). Material, shape, texture and type voice come from the theme's axes. Prompt text is
 *  type.input, the CTA label is type.action. No hand-picked colours or fonts.
 *
 *  Config (optional, set before this script):  window.SB_CONFIG = { rows: ['higgsfield', …], scale: 0.25 }
 */
(function () {
  'use strict';
  const HFT = window.HFT, C = HFT.color, HG = window.HeroGlyph;
  const CFG = window.SB_CONFIG || {};
  const W = 1920, H = 1080;

  /* ------------------------------------------------------------ rows */
  const ALL_ROWS = [
    { id: 'higgsfield', spec: 'higgsfield', kind: 'brand', alt: { A: 'light' }, note: 'title on the light world, as approved' },
  ].concat(HFT.list('styles').filter((s) => s !== 'higgsfield').map((s) => ({ id: s, spec: s, kind: 'preset' })))
    .concat([
      { id: 'derived-energetic', spec: { seed: '#FF5A1F', mood: ['energetic'], scheme: 'dark' }, kind: 'derive' },
      { id: 'derived-technical', spec: { seed: '#2B59FF', mood: ['technical'], scheme: 'light' }, kind: 'derive' },
    ]);
  const ROWS = CFG.rows ? ALL_ROWS.filter((r) => CFG.rows.indexOf(r.id) >= 0) : ALL_ROWS;
  const SCALE = CFG.scale || 0.25;


  /* copy; two-line breaks are explicit (balanced, never a one-word last line) */
  const COPY = {
    kicker: 'Introducing', title: ['Make it', 'move'], sub: 'One system for every identity.', subLines: ['One system', 'for every identity.'],
    prompt: 'Make a 15-second launch film', promptKicker: 'Describe it',
    ctaKicker: 'Available today', ctaLine: 'Ready when you are.', cta: 'Get started',
    caption: 'Every voice, one shape.', captionLines: ['Every voice,', 'one shape.'], captionKicker: 'Sound',
    orbit: ['Prompt', 'Voice', 'Image'],
  };
  const S1 = HG.S1;

  /* ------------------------------------------------------------ resolve themes */
  function resolveRow(row) {
    const make = (scheme) => {
      if (typeof row.spec === 'string') return scheme ? HFT.theme(row.spec, { scheme }) : HFT.theme(row.spec);
      return HFT.derive(scheme ? Object.assign({}, row.spec, { scheme }) : row.spec);
    };
    const base = make(null);
    const per = { A: base, B: base, C: base, D: base };
    for (const [f, s] of Object.entries(row.alt || {})) per[f] = make(s);
    return { row, base, per };
  }
  const RESOLVED = ROWS.map(resolveRow);

  /* ------------------------------------------------------------ helpers */
  const tok = (th, k) => th.tokens[k];
  const hex = (th, k) => { const t = th.tokens[k]; return t && t.hex ? t.hex : (typeof t === 'string' ? t : null); };
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + (+a).toFixed(3) + ')'; };
  const shiftL = (h, dL, dC) => { const c = C.fromHex(h); return C.mk(Math.max(0, Math.min(1, c.L + dL)), Math.max(0, c.C * (dC === undefined ? 1 : dC)), c.H).hex; };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const shadowCss = (arr) => (!arr || !arr.length) ? '' : arr.filter((s) => s.alpha > 0).map((s) => (s.inset ? 'inset ' : '') + s.x + 'px ' + s.y + 'px ' + s.blur + 'px ' + (s.spread || 0) + 'px ' + rgba(s.color, s.alpha)).join(', ');
  const joinSh = (...xs) => xs.filter(Boolean).join(', ') || 'none';
  const ax = (th) => th.meta.axes;
  const dark = (th) => th.meta.scheme === 'dark';
  const comp = (th) => th.policy.composition.id;
  const styleOf = (th) => (th.meta.style && HFT.styles[th.meta.style]) || null;
  const sTok = (th, k) => HG.styleTok(HFT, th, k);
  const heroPol = (th) => HG.heroPolicy(HFT, th);
  const decorPol = (th) => HG.decorPolicy(HFT, th);
  const compPol = (th) => HG.componentsPolicy(HFT, th);
  const grid = (th) => { const m = tok(th, 'frame.margin'), c = tok(th, 'frame.column'), g = tok(th, 'frame.gutter'); return { m, c, g, x: (n) => m + n * (c + g), w: (n) => n * c + (n - 1) * g }; };
  /* the left text axis named by the composition axis (core 3.4): editorial x242, keynote x144, else the margin */
  const axisX = (th) => ({ 'editorial-asymmetric': 242, 'keynote-left-axis': 144 }[comp(th)] || grid(th).m);
  const focal = (th) => (th.policy.composition.focal || HFT.axes.composition[comp(th)].focal)[0];
  const accentTertiary = (th) => th.extras && th.extras['accent.tertiary'];
  const mono = (th) => ['mono-terminal', 'pixel'].indexOf(ax(th).typeVoice) >= 0;

  /* type roles (shared with the demo): type.input / type.action + the CAPS tracking rule — see hero-glyph.js */
  const role = (th, r) => HG.role(HFT, th, r);
  function generic(fam) { const f = HFT.fonts[fam]; return f && f.cat === 'serif' ? 'serif' : f && f.cat === 'mono' ? 'monospace' : 'sans-serif'; }
  function tyT(t) {
    return 'font-family:"' + t.family + '",' + generic(t.family) + ';font-size:' + t.size + 'px;font-weight:' + t.weight + ';line-height:' + t.lineHeight +
      ';letter-spacing:' + t.trackingEm + 'em;' + (t.wordSpacingEm ? 'word-spacing:' + t.wordSpacingEm + 'em;' : '') + 'text-transform:' + (t.case === 'upper' ? 'uppercase' : 'none') + ';' +
      (t.features && t.features.length ? 'font-feature-settings:' + t.features.map((f) => '"' + f + '"').join(',') + ';' : '') + 'white-space:nowrap;font-optical-sizing:auto;';
  }
  const ty = (th, r) => tyT(role(th, r));
  /* kicker role: the label when it is must-read size, otherwise the caption (legibility floor ≥ 48 px) */
  const kickerRole = (th) => (tok(th, 'type.label').role === 'mustRead' && tok(th, 'type.label').size >= 48) ? 'label' : 'caption';
  const minPx = (th, r) => Math.max(48, (role(th, r) || {}).minPx || 48);
  const accentAllowed = (th) => !!HG.accentFace(HFT, th);
  const balanced = (lines) => lines.join('<br>');

  /* ------------------------------------------------------------ CSS variables + fonts */
  const themes = [];
  const clsOf = new Map();
  RESOLVED.forEach((r) => Object.values(r.per).forEach((th) => {
    if (clsOf.has(th)) return;
    const cls = 'th-' + th.meta.id.replace(/[^a-z0-9-]/gi, '') + '-' + themes.length;
    clsOf.set(th, cls); themes.push(th);
  }));
  const chrome = HFT.theme('higgsfield');
  const links = new Set([HFT.fontLink(chrome)]);
  themes.forEach((th) => links.add(HFT.fontLink(th)));
  /* faces the proof needs beyond fontLink(theme): fallback input / action weights and the accent weight */
  const extra = {};
  const need = (fam, w, ital) => { if (!fam || !HFT.fonts[fam]) return; const k = fam + (ital ? '|i' : ''); (extra[k] = extra[k] || new Set()).add(w); };
  themes.forEach((th) => {
    ['input', 'action'].forEach((r) => { const t = role(th, r); need(t.family, t.weight); });
    const af = HG.accentFace(HFT, th); if (af) need(af.family, af.weight, af.style === 'italic');
  });
  Object.entries(extra).forEach(([k, ws]) => {
    const [fam, it] = k.split('|'), f = HFT.fonts[fam], name = fam.replace(/ /g, '+'), list = Array.from(ws).sort((a, b) => a - b);
    const spec = f.wght ? (it ? 'ital,wght@' + list.map((w) => '1,' + w).join(';') : 'wght@' + list.join(';')) : (it ? 'ital,wght@' + list.filter((w) => (f.weights || [400]).indexOf(w) >= 0).map((w) => '1,' + w).join(';') : 'wght@' + list.filter((w) => (f.weights || [400]).indexOf(w) >= 0).join(';'));
    if (/@$/.test(spec)) return;
    links.add('https://fonts.googleapis.com/css2?family=' + name + ':' + spec + '&display=block');
  });
  let css = '';
  themes.forEach((th) => { css += HFT.toCSSVars(th, { selector: '.' + clsOf.get(th) }) + '\n'; });
  css += HFT.toCSSVars(chrome, { selector: '.chrome', prefix: 'c' }) + '\n';
  css += '.bal{white-space:normal!important;text-wrap:balance;min-width:14ch}\n';
  document.write(Array.from(links).map((u) => '<link rel="stylesheet" href="' + u.replace(/&/g, '&amp;') + '">').join('') + '<style>' + css + '</style>');

  function el(parent, css, html, tag) {
    const e = document.createElement(tag || 'div');
    if (css) e.style.cssText = css;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }

  function accentWord(th, word) {
    const af = HG.accentFace(HFT, th);
    if (!af) return word;
    return '<span style="font-family:\'' + af.family + '\',' + generic(af.family) + ';font-style:' + af.style + ';font-weight:' + af.weight + ';letter-spacing:' + af.trackingEm + 'em">' + word + '</span>';
  }
  /* title ink: brand title gradient (Higgsfield light world) · iridescent glass text (spectral palette) · fg.primary */
  function titleInk(th) {
    const g = th.extras && th.extras['fg.titleGradient'];
    if (g) {
      const [grad, filt] = g.split(' + ');
      return 'background:' + grad + ';-webkit-background-clip:text;background-clip:text;color:transparent;' + (filt ? 'filter:' + filt + ';' : '');
    }
    const ir = HG.iridescent(HFT, th);
    if (ir && ax(th).palette === 'spectral') {
      const s = ir.stops;
      return 'background:linear-gradient(' + (ir.angleDeg || 135) + 'deg,' + s[0] + ' 0%,' + s[1] + ' 50%,' + s[2] + ' 100%);-webkit-background-clip:text;background-clip:text;color:transparent;';
    }
    return 'color:var(--fg-primary);';
  }

  /* ------------------------------------------------------------ UI surfaces: ALWAYS flat (metal is for the hero only) */
  function actionFill(th, color, h) {
    const m = ax(th).material, d = dark(th);
    const brand = th.meta.brand && HFT.brands[th.meta.brand];
    const rec = brand && brand.recipes && brand.recipes.ctaPill;
    if (rec && color === hex(th, 'accent.action')) return { bg: rec.background, sh: rec.boxShadow };
    /* fill-only accent on a light ground: the fill needs its edge (accent.edge "use") */
    const edge = (!d && tok(th, 'accent.action').mode === 'fill-only' && hex(th, 'accent.edge')) ? 'inset 0 0 0 ' + tok(th, 'stroke.default') + 'px ' + rgba(hex(th, 'accent.edge'), 0.55) : '';
    const glow = d ? shadowCss(sTok(th, 'glow.action')) : '';
    switch (m) {
      case 'clay': return { bg: 'linear-gradient(180deg,' + shiftL(color, 0.05) + ',' + color + ' 45%,' + shiftL(color, -0.04) + ')', sh: joinSh(shadowCss(tok(th, 'shadow.innerLight')), 'inset 0 -' + Math.round(h * 0.12) + 'px ' + Math.round(h * 0.2) + 'px ' + rgba(hex(th, 'fg.primary'), 0.12), shadowCss(tok(th, 'shadow.float'))) };
      case 'soft-shadow': return { bg: color, sh: joinSh(shadowCss(tok(th, 'shadow.innerLight')), shadowCss(sTok(th, 'shadow.float'))) };
      case 'paper-grain': return { bg: color, sh: joinSh(shadowCss(tok(th, 'shadow.contact'))) };
      case 'neon-light': {
        const st = th.detail && th.detail.glowStack;
        const halo = st ? st.layers.slice(1, 4).map((l) => '0 0 ' + l.blur + 'px ' + rgba(st.color, l.alpha * 0.55)).join(', ') : glow;
        return { bg: color, sh: joinSh('inset 0 0 0 2px ' + rgba(st ? st.core : color, 0.35), halo) };
      }
      case 'metallic-subtle': return { bg: color, sh: joinSh(shadowCss(tok(th, 'shadow.card'))) };
      default: return { bg: color, sh: joinSh(edge, glow, shadowCss((sTok(th, 'shadow.float') || []).filter((s) => s.blur === 0))) };
    }
  }
  /* container surface (prompt bar): glass on dark, raised paper on light; brutal = hard border + hard shadow */
  function containerFill(th) {
    const d = dark(th), m = ax(th).material;
    const stroke = tok(th, 'material.glass.stroke'), fill = tok(th, 'material.glass.fill');
    const hi = shadowCss(tok(th, 'material.glass.highlight'));
    const win = shadowCss(tok(th, 'shadow.window')), flt = shadowCss(sTok(th, 'shadow.float')), card = shadowCss(tok(th, 'shadow.card'));
    const hair = 'inset 0 0 0 ' + tok(th, 'stroke.hairline') + 'px ' + (tok(th, 'line.hairline').rgba || hex(th, 'line.hairline'));
    const hard = (sTok(th, 'shadow.float') || []).some((s) => s.blur === 0);
    if (hard) return { bg: hex(th, 'bg.raised'), sh: joinSh('inset 0 0 0 ' + tok(th, 'stroke.accent') + 'px ' + hex(th, 'fg.primary'), shadowCss(sTok(th, 'shadow.float').map((s) => Object.assign({}, s, { x: 12, y: 12 })))) };
    if (d) {
      if (m === 'neon-light' || m === 'flat' && ax(th).shape === 'sharp') return { bg: hex(th, 'bg.raised'), sh: joinSh(hair) };
      return { bg: 'linear-gradient(180deg,' + fill + ',' + rgba('#FFFFFF', 0.02) + '),' + hex(th, 'bg.raised'), sh: joinSh('inset 0 0 0 1.5px ' + stroke, hi, 'inset 0 -14px 24px rgba(0,0,0,.28)', win || flt) };
    }
    const surf = (th.extras && th.extras['surface.card']) || hex(th, 'bg.raised');
    if (m === 'flat') return { bg: surf, sh: joinSh(hair, card) };
    return { bg: surf, sh: joinSh(m === 'paper-grain' ? '' : hair, flt || card) };
  }
  /* iridescent outline (glass fill + gradient stroke) for outline-form components */
  function outlineSurface(th, sw) {
    const ir = HG.iridescent(HFT, th), s = ir ? ir.stops : [hex(th, 'accent.action'), hex(th, 'accent.action'), hex(th, 'accent.action')];
    const fill = dark(th) ? 'linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02)),' + hex(th, 'bg.raised') : hex(th, 'bg.raised');
    return 'border:' + sw + 'px solid transparent;background:linear-gradient(' + hex(th, 'bg.raised') + ',' + hex(th, 'bg.raised') + ') padding-box,' + fill.replace(/,#[0-9A-F]{6}$/i, '') + ' padding-box,linear-gradient(' + ((ir && ir.angleDeg) || 120) + 'deg,' + s[0] + ',' + s[1] + ',' + s[2] + ') border-box;box-shadow:0 0 36px ' + rgba(s[1], 0.22) + ';';
  }

  /* ------------------------------------------------------------ frame + background layers */
  function frameRoot(th, pool) {
    const f = el(null, 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:' + hex(th, 'bg.base') + ';');
    f.className = 'frame ' + clsOf.get(th);
    const [fx, fy] = pool || focal(th);
    if (dark(th)) {
      const gp = tok(th, 'glow.pool');
      if (gp) el(f, 'position:absolute;inset:0;background:radial-gradient(circle ' + gp.radiusPx + 'px at ' + (fx * 100) + '% ' + (fy * 100) + '%,' + gp.stops.map((s) => s.color + ' ' + Math.round(s.at * 100) + '%').join(',') + ');');
      const bp = th.extras && th.extras['bg.pool'];
      if (bp) el(f, 'position:absolute;inset:0;background:' + bp.replace(/at 50% 50%/, 'at ' + (fx * 100) + '% ' + (fy * 100) + '%').replace(/,\s*#[0-9A-F]{6}\s*$/i, '') + ';');
    } else {
      const bp = th.extras && th.extras['bg.pool'];
      el(f, 'position:absolute;inset:0;background:' + (bp || 'radial-gradient(ellipse 70% 65% at ' + (fx * 100) + '% ' + (fy * 100) + '%,' + hex(th, 'bg.raised') + ',' + hex(th, 'bg.base') + ' 62%,' + mix(hex(th, 'bg.base'), hex(th, 'fg.primary'), 0.025) + ' 100%)') + ';');
    }
    return f;
  }
  function finishFrame(th, f) {
    const vg = th.extras && th.extras.vignette;
    if (vg) el(f, 'position:absolute;inset:0;pointer-events:none;background:' + vg + ';');
    texture(th, f);
    return f;
  }
  function textureOpacity(th) {
    const kind = ax(th).texture, def = HFT.axes.texture[kind];
    const r = def && def.opacity && def.opacity[th.meta.scheme];
    return r ? (r[0] + r[1]) / 2 : 0;
  }
  function texture(th, f) {
    const kind = ax(th).texture, op = textureOpacity(th);
    if (!op || kind === 'none') return;
    const ink = hex(th, 'texture.ink') || hex(th, 'fg.primary');
    if (kind === 'halftone') {   /* halftone: a full-frame background texture only when the decor policy says so */
      if (decorPol(th).halftone !== 'background') return;
      el(f, 'position:absolute;inset:0;pointer-events:none;opacity:' + Math.min(0.5, op * 3) + ';background:radial-gradient(circle,' + ink + ' 1.6px,transparent 2px) 0 0/12px 12px;' +
        '-webkit-mask-image:linear-gradient(160deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.9) 100%);', undefined).style.zIndex = '0';
      f.insertBefore(f.lastChild, f.children[1] || null);
      return;
    }
    if (kind === 'grain') {
      const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";
      el(f, 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;opacity:' + op + ';background:url("data:image/svg+xml;utf8,' + svg + '");');
    } else if (kind === 'dot-grid') {
      el(f, 'position:absolute;inset:0;pointer-events:none;opacity:' + Math.min(1, op * 4) + ';background:radial-gradient(circle,' + ink + ' 2px,transparent 2.6px) 14px 14px/28px 28px;' +
        '-webkit-mask-image:radial-gradient(ellipse 60% 62% at 50% 50%,rgba(0,0,0,.2) 0%,rgba(0,0,0,.9) 60%,rgba(0,0,0,0) 96%);');
    } else if (kind === 'scanlines') {
      el(f, 'position:absolute;inset:0;pointer-events:none;opacity:' + Math.min(1, op * 5) + ';background:repeating-linear-gradient(0deg,rgba(0,0,0,.55) 0 2px,transparent 2px 6px);');
    }
  }

  /* ------------------------------------------------------------ shared components */
  const ARROW_R = (s, c, sw, sq) => '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M5 12h14M13 6l6 6-6 6" stroke="' + c + '" stroke-width="' + sw + '" fill="none" stroke-linecap="' + (sq ? 'square' : 'round') + '" stroke-linejoin="' + (sq ? 'miter' : 'round') + '"/></svg>';
  const ARROW_U = (s, c, sw) => '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 19V5M5 12l7-7 7 7" stroke="' + c + '" stroke-width="' + sw + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SPARK = (s, c) => '<svg width="' + s + '" height="' + s + '" viewBox="-1 -1 2 2" style="display:block;flex:none"><path fill="' + c + '" d="M0,-1 C0.12,-0.12 0.12,-0.12 1,0 C0.12,0.12 0.12,0.12 0,1 C-0.12,0.12 -0.12,0.12 -1,0 C-0.12,-0.12 -0.12,-0.12 0,-1Z"/></svg>';

  function kicker(th, parent, text, css, color) {
    return el(parent, ty(th, kickerRole(th)) + 'color:' + (color || 'var(--fg-muted)') + ';' + (css || ''), text);
  }
  function caption(th, parent, css, align) {   /* the hero caption: balanced two lines, never a one-word last line */
    return el(parent, 'position:absolute;' + ty(th, 'caption') + 'white-space:nowrap;text-align:' + (align || 'left') + ';color:var(--fg-primary);' + (css || ''), balanced(COPY.captionLines));
  }

  /* CTA: type.action label; forms = pill · outline · block · text-link (policy.components.cta.form) */
  function ctaPill(th, parent, css, opts) {
    opts = opts || {};
    const form = opts.form || compPol(th).cta.form || 'pill';
    const t = role(th, 'action');
    const fs = Math.round(opts.size || t.size);
    const wrap = el(parent, 'position:absolute;' + (css || ''));
    wrap.dataset.cta = form;
    const label = (color) => el(null, tyT(t) + 'font-size:' + fs + 'px;color:' + color + ';line-height:1;', opts.text || COPY.cta);
    if (form === 'text-link') {   /* a word, an arrow and a 4 px accent underline — no container */
      const row = el(wrap, 'position:relative;display:flex;align-items:center;gap:' + Math.round(fs * 0.3) + 'px;padding-bottom:' + Math.round(fs * 0.2) + 'px;');
      row.appendChild(label('var(--fg-primary)'));
      row.insertAdjacentHTML('beforeend', ARROW_R(Math.round(fs * 0.8), hex(th, 'accent.text') || hex(th, 'accent.action'), 2.4, T0(th)));
      el(row, 'position:absolute;left:0;right:0;bottom:0;height:' + ((compPol(th).cta.underlinePx) || 4) + 'px;background:var(--accent-action);');
      return wrap;
    }
    const block = form === 'block';
    const h = opts.h || (block ? Math.round(fs * 1.7) : Math.round(fs / (t.heightRatio || 0.34)));
    const r = block ? 0 : Math.min(tok(th, 'radius.pill'), h / 2);
    const padX = Math.round(block ? fs * 0.6 : h * 0.4);
    const color = hex(th, 'accent.action');
    if (form === 'outline') {
      const pill = el(wrap, 'position:relative;display:flex;align-items:center;gap:' + Math.round(fs * 0.4) + 'px;height:' + h + 'px;box-sizing:border-box;padding:0 ' + Math.round(padX * 0.9) + 'px 0 ' + padX + 'px;border-radius:' + r + 'px;' + outlineSurface(th, tok(th, 'stroke.accent')));
      pill.appendChild(label('var(--fg-primary)'));
      pill.insertAdjacentHTML('beforeend', ARROW_R(Math.round(fs * 0.85), hex(th, 'accent.action'), 2.4));
      return wrap;
    }
    const s = actionFill(th, color, h);
    if (dark(th) && !block && ['flat', 'neon-light'].indexOf(ax(th).material) >= 0) /* floor light under the action (Higgsfield ctaPill recipe, generalised) */
      el(wrap, 'position:absolute;left:-12%;right:-12%;top:62%;height:' + Math.round(h * 0.6) + 'px;background:radial-gradient(ellipse 50% 50% at 50% 50%,' + rgba(color, 0.26) + ',' + rgba(color, 0.08) + ' 42%,transparent 72%);filter:blur(20px);');
    const pill = el(wrap, 'position:relative;display:flex;align-items:center;gap:' + Math.round(fs * 0.42) + 'px;height:' + h + 'px;box-sizing:border-box;padding:0 ' + Math.round(padX * 0.92) + 'px 0 ' + padX + 'px;border-radius:' + r + 'px;background:' + s.bg + ';box-shadow:' + s.sh + ';' + (opts.extra || ''));
    pill.appendChild(label('var(--fg-on-accent)'));
    pill.insertAdjacentHTML('beforeend', ARROW_R(Math.round(fs * 0.9), hex(th, 'fg.onAccent'), 2.4, block));
    return wrap;
  }
  const T0 = (th) => tok(th, 'radius.pill') === 0;

  /* prompt bar: container + type.input text + accent caret + send control; forms = bar · outline */
  function promptBar(th, parent, x, y, w, opts) {
    opts = opts || {};
    const form = compPol(th).prompt && compPol(th).prompt.form || 'bar';
    const t = role(th, 'input');
    const fs = Math.round(opts.size || t.size);
    const h = opts.h || Math.max(184, Math.round(fs * 2.85));
    const r = Math.min(tok(th, 'radius.control'), Math.round(h * 0.5));
    const isMono = HFT.fonts[t.family] && HFT.fonts[t.family].cat === 'mono';
    let surf;
    if (form === 'outline') surf = outlineSurface(th, tok(th, 'stroke.accent'));
    else { const s = containerFill(th); surf = 'background:' + s.bg + ';box-shadow:' + s.sh + ';'; }
    const bar = el(parent, 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;box-sizing:border-box;flex:none;border-radius:' + r + 'px;' + surf + 'display:flex;align-items:center;padding:0 ' + Math.round((h - h * 0.6) / 2) + 'px 0 ' + Math.round(fs * 1.0) + 'px;' + (opts.css || ''));
    bar.dataset.bar = opts.anchor || 'left';
    if (isMono) el(bar, tyT(t) + 'font-size:' + fs + 'px;color:var(--accent-text);margin-right:' + Math.round(fs * 0.5) + 'px;line-height:1;', '&gt;');
    const txt = el(bar, tyT(t) + 'font-size:' + fs + 'px;color:var(--fg-primary);line-height:1;flex:0 1 auto;overflow:hidden;', COPY.prompt);
    txt.dataset.fitw = String(w - fs * (isMono ? 2.1 : 1.0) - h * 0.8 - fs * 0.75);
    txt.dataset.min = '48';
    el(bar, 'flex:none;width:' + tok(th, 'stroke.accent') + 'px;height:' + Math.round(fs * 0.92) + 'px;margin-left:' + Math.round(fs * 0.12) + 'px;background:var(--accent-action);border-radius:' + Math.min(2, tok(th, 'radius.chip')) + 'px;');
    el(bar, 'flex:1;');
    const bs = Math.round(h * 0.6);
    const sendR = Math.min(tok(th, 'radius.control'), bs / 2);
    let send;
    if (form === 'outline') {
      send = el(bar, 'flex:none;box-sizing:border-box;width:' + bs + 'px;height:' + bs + 'px;border-radius:' + sendR + 'px;' + outlineSurface(th, tok(th, 'stroke.accent')) + 'display:flex;align-items:center;justify-content:center;');
      send.innerHTML = ARROW_U(Math.round(bs * 0.42), hex(th, 'accent.action'), 2.6);
    } else {
      const sf = actionFill(th, hex(th, 'accent.action'), bs);
      send = el(bar, 'flex:none;width:' + bs + 'px;height:' + bs + 'px;border-radius:' + sendR + 'px;background:' + sf.bg + ';box-shadow:' + sf.sh + ';display:flex;align-items:center;justify-content:center;');
      send.innerHTML = ARROW_U(Math.round(bs * 0.46), hex(th, 'fg.onAccent'), 2.6);
    }
    return bar;
  }

  /* hero: the shared glyph (hero-glyph.js) placed by centre (cx, cy) and scale k; opts → HeroGlyph */
  function glyph(th, parent, cx, cy, k, opts) {
    const g = HG.create(HFT, th, opts || {});
    g.root.style.left = (cx - S1.boxW / 2) + 'px'; g.root.style.top = (cy - S1.line) + 'px';
    g.root.style.transform = 'scale(' + k + ')'; g.root.style.transformOrigin = (S1.boxW / 2) + 'px ' + S1.line + 'px';
    parent.appendChild(g.root);
    return g;
  }
  /* place a glyph so that bar `bi` is centred at x = fx (macro / bleed crops) */
  function glyphAtBar(th, parent, bi, fx, cy, k, opts) {
    const barCx = bi * S1.step + S1.w / 2;
    return glyph(th, parent, fx + (S1.boxW / 2 - barCx) * k, cy, k, opts);
  }

  /* ------------------------------------------------------------ the 4 archetype frames */
  function frameTitle(th) {
    const c = comp(th), G = grid(th), ax0 = axisX(th);
    const f = frameRoot(th, c === 'keynote-left-axis' ? [0.3, 0.45] : c === 'editorial-asymmetric' ? [0.36, 0.62] : null);
    const ink = titleInk(th);
    const st = styleOf(th), crop = st && st.composition && st.composition.title && st.composition.title.crop === 'off-frame';
    if (crop) {   /* macro type: "MAKE IT" set solid, the accent line "MOVE" bigger than the frame, cropped by the right edge */
      kicker(th, f, COPY.kicker, 'position:absolute;left:' + G.m + 'px;top:' + G.m + 'px;');
      el(f, ty(th, 'body') + 'color:var(--fg-muted);position:absolute;right:' + G.m + 'px;top:' + G.m + 'px;', COPY.sub);
      const l1 = el(f, ty(th, 'display') + ink + 'position:absolute;left:' + (G.m - 6) + 'px;top:' + (G.m + 110) + 'px;', COPY.title[0]);
      const l2 = el(f, ty(th, 'display') + ink + 'position:absolute;left:' + (G.m - 14) + 'px;', accentWord(th, COPY.title[1]));
      l1.dataset.crop = '1'; l2.dataset.crop = '2';
      f.dataset.cropbox = [G.m, W].join(',');
    } else if (c === 'poster-type-led') {
      const box = el(f, 'position:absolute;left:' + G.m + 'px;top:' + (G.m + 96) + 'px;width:' + (W - 2 * G.m) + 'px;height:' + (H - 2 * G.m - 200) + 'px;display:flex;flex-direction:column;justify-content:center;');
      box.dataset.poster = (W - 2 * G.m) + ',' + (H - 2 * G.m - 200);
      el(box, ty(th, 'display') + ink + 'display:block;width:max-content;', COPY.title[0]).dataset.line = 'display';
      const l2 = el(box, ty(th, 'headline') + 'color:var(--accent-text);display:block;width:max-content;', COPY.title[1]);
      l2.dataset.line = 'headline';
      if (accentTertiary(th) == null && tok(th, 'accent.action').mode === 'fill-only') { l2.style.color = 'var(--fg-on-accent)'; l2.style.background = 'var(--accent-action)'; l2.style.padding = '0 0.06em'; }
      kicker(th, f, COPY.kicker, 'position:absolute;left:' + G.m + 'px;top:' + G.m + 'px;');
      el(f, ty(th, 'body') + 'color:var(--fg-muted);position:absolute;right:' + G.m + 'px;bottom:' + G.m + 'px;', COPY.sub);
    } else if (c === 'editorial-asymmetric') {
      kicker(th, f, COPY.kicker, 'position:absolute;left:' + ax0 + 'px;top:' + (G.m + 40) + 'px;');
      el(f, 'position:absolute;left:' + ax0 + 'px;right:' + G.m + 'px;top:' + (G.m + 40 + tok(th, 'type.' + kickerRole(th)).size * 1.6) + 'px;height:' + tok(th, 'stroke.hairline') + 'px;background:var(--line-strong);');
      const t = el(f, 'position:absolute;left:' + (ax0 - 8) + 'px;bottom:' + (G.m + 60) + 'px;');
      const ruleY = G.m + 40 + tok(th, 'type.' + kickerRole(th)).size * 1.6;
      const availH = H - (G.m + 60) - (ruleY + tok(th, 'space.6'));
      const sz = Math.round(Math.min(tok(th, 'type.display').size, availH / (2 * tok(th, 'type.display').lineHeight)));
      const l1 = el(t, ty(th, 'display') + ink + 'display:block;width:max-content;font-size:' + sz + 'px;', COPY.title[0]);
      const l2 = el(t, ty(th, 'display') + ink + 'display:block;width:max-content;font-size:' + sz + 'px;', accentWord(th, COPY.title[1]) + '.');
      [l1, l2].forEach((e) => { e.dataset.fitw = String(G.w(7) + 60); e.dataset.min = String(minPx(th, 'display')); });
      el(f, ty(th, 'body') + 'color:var(--fg-muted);position:absolute;left:' + G.x(8) + 'px;bottom:' + (G.m + 60 + sz * 0.08) + 'px;', balanced(COPY.subLines));
    } else if (c === 'keynote-left-axis') {
      const box = el(f, 'position:absolute;left:' + ax0 + 'px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;padding-bottom:' + Math.round(H * 0.1) + 'px;');
      kicker(th, box, COPY.kicker, 'margin-bottom:' + tok(th, 'space.5') + 'px;', 'var(--accent-text)');
      const l1 = el(box, ty(th, 'display') + ink + 'width:max-content;', COPY.title[0]);
      const l2 = el(box, ty(th, 'display') + ink + 'width:max-content;', COPY.title[1]);
      [l1, l2].forEach((e) => { e.dataset.fitw = String(G.w(9)); e.dataset.min = String(minPx(th, 'display')); });
      el(box, ty(th, 'body') + 'color:var(--fg-muted);margin-top:' + tok(th, 'space.6') + 'px;', COPY.sub);
    } else if (c === 'maximal-collage') {   /* one blob + the kicker as a tilted tag: ≤ 2 decorations, no free halftone, no sparkle */
      const fy = focal(th)[1];
      el(f, 'position:absolute;left:' + (W / 2 - 520) + 'px;top:' + (H * fy - 470) + 'px;width:1040px;height:940px;border-radius:50%;background:' + ((th.extras && th.extras['accent.subtle']) || rgba(hex(th, 'accent.action'), 0.12)) + ';');
      const box = el(f, 'position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;');
      const t = el(box, 'position:relative;');
      const l = el(t, ty(th, 'display') + ink + 'width:max-content;', COPY.title[0] + ' ' + COPY.title[1]);
      l.dataset.fitw = String(W * 0.78); l.dataset.min = String(minPx(th, 'display'));
      const sec = hex(th, 'accent.secondary') || hex(th, 'accent.action');
      const chip = el(t, 'position:absolute;left:-36px;top:-' + Math.round(tok(th, 'type.display').size * 0.42) + 'px;transform:rotate(-6deg);padding:18px 36px;border-radius:' + Math.min(tok(th, 'radius.chip'), 60) + 'px;background:' + sec + ';box-shadow:' + joinSh(shadowCss(tok(th, 'shadow.innerLight')), shadowCss(tok(th, 'shadow.float'))) + ';');
      el(chip, ty(th, 'caption') + 'color:var(--fg-on-secondary, #fff);line-height:1;', COPY.kicker);
      el(box, ty(th, 'body') + 'color:var(--fg-muted);margin-top:' + tok(th, 'space.5') + 'px;', COPY.sub);
    } else { /* minimal-centred: the lockup is the one place the centre is ideal */
      const fy = focal(th)[1];
      const box = el(f, 'position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:' + Math.round((0.5 - fy) * 2 * H) + 'px;');
      kicker(th, box, COPY.kicker, 'margin-bottom:' + tok(th, 'space.5') + 'px;');
      const l = el(box, ty(th, 'display') + ink + 'width:max-content;padding:0 0.04em;', COPY.title[0] + ' ' + accentWord(th, COPY.title[1]));
      l.dataset.fitw = String(W * 0.8); l.dataset.min = String(minPx(th, 'display'));
      el(box, ty(th, 'body') + 'color:var(--fg-muted);margin-top:' + tok(th, 'space.5') + 'px;', COPY.sub);
    }
    return finishFrame(th, f);
  }

  function framePrompt(th) {
    const c = comp(th), G = grid(th), ax0 = axisX(th);
    const f = frameRoot(th, c === 'keynote-left-axis' ? [0.36, 0.5] : null);
    const inp = role(th, 'input');
    if (c === 'poster-type-led') {   /* typed text stays typed text: type.input, sentence case, set large */
      kicker(th, f, COPY.promptKicker, 'position:absolute;left:' + G.m + 'px;top:' + G.m + 'px;');
      const fs = Math.round(inp.size * 1.5);
      promptBar(th, f, G.m, Math.round(H / 2 - fs * 1.55), W - 2 * G.m, { size: fs, h: Math.round(fs * 3.1) });
    } else if (c === 'editorial-asymmetric') {
      kicker(th, f, COPY.promptKicker, 'position:absolute;left:' + ax0 + 'px;top:' + (H * 0.5 - 92 - 120) + 'px;');
      promptBar(th, f, ax0 - 8, Math.round(H * 0.5 - 92), Math.min(1320, W - ax0 - G.m));
    } else if (c === 'keynote-left-axis') {
      kicker(th, f, '01 · ' + COPY.promptKicker, 'position:absolute;left:' + ax0 + 'px;top:' + (H * 0.45 - 92 - 120) + 'px;', 'var(--accent-text)');
      promptBar(th, f, ax0, Math.round(H * 0.45 - 92), 1320);
    } else if (c === 'maximal-collage') {   /* the component stands on the ground: no backing capsule, no ornament */
      const fy = focal(th)[1];
      promptBar(th, f, W / 2 - 620, Math.round(H * fy - 92), 1240, { css: 'transform:rotate(-2deg);', anchor: 'center' });
    } else {
      promptBar(th, f, W / 2 - 620, Math.round(H * focal(th)[1] - 92), 1240, { anchor: 'center' });
    }
    return finishFrame(th, f);
  }

  function frameCTA(th) {
    const c = comp(th), G = grid(th), ax0 = axisX(th);
    const form = compPol(th).cta.form || 'pill';
    const f = frameRoot(th, c === 'keynote-left-axis' || c === 'editorial-asymmetric' ? [0.34, 0.56] : null);
    if (c === 'poster-type-led') {
      kicker(th, f, COPY.ctaKicker, 'position:absolute;left:' + G.m + 'px;top:' + G.m + 'px;');
      if (form === 'text-link') {   /* kinetic: the claim is the poster, the action is a link under it */
        const hl = el(f, ty(th, 'headline') + titleInk(th) + 'position:absolute;left:' + (G.m - 4) + 'px;top:' + Math.round(H * 0.3) + 'px;', COPY.ctaLine);
        hl.dataset.fitw = String(W - 2 * G.m); hl.dataset.min = String(minPx(th, 'headline'));
        ctaPill(th, f, 'left:' + G.m + 'px;top:' + Math.round(H * 0.3 + tok(th, 'type.headline').size * 1.3) + 'px;', { size: Math.round(Math.max(role(th, 'action').size, tok(th, 'type.headline').size * 0.78)) });
      } else {
        const fs = Math.round(tok(th, 'type.headline').size * (form === 'block' ? 1 : 0.62));
        const w = ctaPill(th, f, 'left:' + G.m + 'px;top:' + Math.round(H / 2 - fs * 1.0) + 'px;', { size: fs, h: Math.round(fs * (form === 'block' ? 1.7 : 2.1)) });
        w.dataset.posterpill = String(W - 2 * G.m);
      }
    } else if (c === 'editorial-asymmetric' || c === 'keynote-left-axis') {
      const box = el(f, 'position:absolute;left:' + ax0 + 'px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding-bottom:' + Math.round(H * 0.06) + 'px;');
      const hl = el(box, ty(th, 'headline') + titleInk(th) + 'width:max-content;margin-bottom:' + tok(th, 'space.7') + 'px;', COPY.ctaLine);
      hl.dataset.fitw = String(W - ax0 - G.m); hl.dataset.min = String(minPx(th, 'headline'));
      const t = role(th, 'action');
      const holder = el(box, 'position:relative;height:' + Math.round(t.size / (t.heightRatio || 0.34)) + 'px;width:10px;');
      ctaPill(th, holder, 'left:0;top:0;');
    } else if (c === 'maximal-collage') {   /* no backing circle; the film's one sparkle lives here */
      const fy = focal(th)[1];
      kicker(th, f, COPY.ctaKicker, 'position:absolute;left:0;right:0;text-align:center;top:' + Math.round(H * fy - 230) + 'px;');
      const box = el(f, 'position:absolute;left:0;right:0;top:' + Math.round(H * fy - 100) + 'px;display:flex;justify-content:center;');
      const holder = el(box, 'position:relative;transform:rotate(-3deg);');
      ctaPill(th, holder, 'position:relative;');
      const tert = accentTertiary(th);
      if (tert && decorPol(th).sparklesPerFilm >= 1) el(holder, 'position:absolute;right:-96px;top:-84px;transform:rotate(10deg);', SPARK(104, tert));
    } else {
      const fy = focal(th)[1];
      const box = el(f, 'position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:' + Math.round((0.5 - fy) * 2 * H) + 'px;');
      kicker(th, box, COPY.ctaKicker, 'margin-bottom:' + tok(th, 'space.6') + 'px;');
      const holder = el(box, 'position:relative;');
      ctaPill(th, holder, 'position:relative;');
    }
    return finishFrame(th, f);
  }

  /* frame D: policy.hero.archetype decides the composition; the hero is always the 7-bar glyph (or type) */
  function frameHero(th) {
    const G = grid(th), ax0 = axisX(th), hp = heroPol(th), arch = hp.archetype || 'centre';
    const pools = { thirds: [0.66, 0.46], 'editorial-split': [0.66, 0.46], 'z-corner': hp.corner === 'bottom-left' ? [0.33, 0.6] : [0.68, 0.38], 'full-bleed': [0.62, 0.5], macro: [0.64, 0.5], orbit: [0.5, 0.45], 'exploded-stack': [0.44, 0.5], 'type-led': [0.3, 0.6] };
    const f = frameRoot(th, pools[arch] || null);
    const capH = role(th, 'caption').size * role(th, 'caption').lineHeight * 2;
    const kick = (css, color) => kicker(th, f, COPY.captionKicker, 'position:absolute;' + css, color);
    if (arch === 'thirds') {   /* hero on the right third, caption on the left third, bottoms aligned */
      const kc = comp(th) === 'keynote-left-axis';
      const cx = kc ? 1412 : Math.round(W * 2 / 3) + 20, k = 0.92, cy = H * 0.5;
      glyph(th, f, cx, cy, k);
      const bottom = Math.round(H - (cy + S1.line * k));
      const x0 = kc ? ax0 : G.x(1);
      caption(th, f, 'left:' + x0 + 'px;bottom:' + bottom + 'px;');
      kick('left:' + x0 + 'px;bottom:' + Math.round(bottom + capH + 24) + 'px;', kc ? 'var(--accent-text)' : null);
    } else if (arch === 'editorial-split') {
      glyph(th, f, G.x(8) + 40, H * 0.46, 0.92);
      kick('left:' + ax0 + 'px;bottom:' + Math.round(G.m + 60 + capH + 28) + 'px;');
      caption(th, f, 'left:' + ax0 + 'px;bottom:' + (G.m + 60) + 'px;');
    } else if (arch === 'macro') {   /* the motif cropped by the frame, focal on the peak bar */
      const k = (H * (hp.cropScale || 1.4)) / S1.boxH;
      const fb = hp.focalBar === undefined ? S1.peak : hp.focalBar;
      const fx = Math.max(W * 0.64, (fb * S1.step + S1.w / 2) * k + 620);
      glyphAtBar(th, f, fb, fx, H * 0.5, k);
      kick('left:' + G.m + 'px;bottom:' + Math.round(G.m + 40 + capH + 24) + 'px;');
      caption(th, f, 'left:' + G.m + 'px;bottom:' + (G.m + 40) + 'px;');
    } else if (arch === 'z-corner') {   /* hero and caption on the diagonal corners */
      if (hp.corner === 'bottom-left') {
        glyph(th, f, G.m + S1.boxW * 0.55, H * 0.6, 1.0);
        kick('right:' + G.m + 'px;top:' + G.m + 'px;text-align:right;');
        caption(th, f, 'right:' + G.m + 'px;top:' + Math.round(G.m + role(th, kickerRole(th)).size * 1.6) + 'px;', 'right');
      } else {
        if (ax(th).composition === 'maximal-collage') el(f, 'position:absolute;left:' + (W * 0.68 - 470) + 'px;top:' + (H * 0.38 - 430) + 'px;width:940px;height:860px;border-radius:50%;background:' + ((th.extras && th.extras['accent.subtle']) || rgba(hex(th, 'accent.action'), 0.12)) + ';');
        glyph(th, f, W * 0.68, H * 0.38, 0.86);
        kick('left:' + G.m + 'px;bottom:' + Math.round(G.m + 40 + capH + 24) + 'px;');
        caption(th, f, 'left:' + G.m + 'px;bottom:' + (G.m + 40) + 'px;');
      }
    } else if (arch === 'full-bleed') {   /* the motif runs off the frame: vertically (silhouette) or off the right edge */
      if (hp.bleed === 'right') {
        const k = 1.22;
        glyphAtBar(th, f, 6, W + 20, H * 0.5, k);
        kick('left:' + ax0 + 'px;bottom:' + Math.round(G.m + 60 + capH + 28) + 'px;');
        caption(th, f, 'left:' + ax0 + 'px;bottom:' + (G.m + 60) + 'px;');
      } else {
        const k = (H * 1.1) / S1.boxH;
        glyphAtBar(th, f, S1.peak, W * 0.63, H * 0.5, k);
        kick('left:' + ax0 + 'px;bottom:' + Math.round(G.m + 60 + capH + 28) + 'px;');
        caption(th, f, 'left:' + ax0 + 'px;bottom:' + (G.m + 60) + 'px;');
      }
    } else if (arch === 'orbit') {   /* the inputs orbit the wave: hairline orbit + 3 outline chips that carry words */
      const cx = W / 2, cy = H * 0.44, rx = 600, ry = 250;
      el(f, 'position:absolute;left:' + (cx - rx) + 'px;top:' + (cy - ry) + 'px;width:' + 2 * rx + 'px;height:' + 2 * ry + 'px;border-radius:50%;box-shadow:inset 0 0 0 ' + tok(th, 'stroke.hairline') + 'px ' + (tok(th, 'line.strong').rgba || hex(th, 'line.strong')) + ';transform:rotate(-8deg);');
      glyph(th, f, cx, cy, 0.6);
      const lab = role(th, 'label');
      [[198, COPY.orbit[0]], [-38, COPY.orbit[1]], [28, COPY.orbit[2]]].forEach(([deg, word]) => {
        const a = deg * Math.PI / 180, r8 = -8 * Math.PI / 180;
        const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
        const px = cx + ex * Math.cos(r8) - ey * Math.sin(r8), py = cy + ex * Math.sin(r8) + ey * Math.cos(r8);
        const h = Math.round(lab.size * 2.1);
        const chip = el(f, 'position:absolute;left:' + Math.round(px) + 'px;top:' + Math.round(py - h / 2) + 'px;transform:translateX(-50%);box-sizing:border-box;height:' + h + 'px;padding:0 ' + Math.round(lab.size * 0.8) + 'px;display:flex;align-items:center;border-radius:' + Math.min(tok(th, 'radius.pill'), h / 2) + 'px;' + outlineSurface(th, Math.max(2, tok(th, 'stroke.default'))));
        el(chip, tyT(lab) + 'color:var(--fg-primary);line-height:1;', word);
      });
      caption(th, f, 'left:0;right:0;bottom:' + (G.m + 10) + 'px;', 'center').innerHTML = COPY.caption;
    } else if (arch === 'exploded-stack') {   /* an exploded view of the product layer: card → wave → playhead, pulled apart in depth */
      const cx = W * 0.4, cy = H * 0.62, PW = 860, PH = 540, rc = Math.min(tok(th, 'radius.card'), 56);
      const iso = el(f, 'position:absolute;left:' + cx + 'px;top:' + cy + 'px;width:0;height:0;transform-style:preserve-3d;transform:rotateX(57deg) rotateZ(-38deg);');
      const plane = (z, css) => el(iso, 'position:absolute;left:' + (-PW / 2) + 'px;top:' + (-PH / 2) + 'px;width:' + PW + 'px;height:' + PH + 'px;box-sizing:border-box;transform:translateZ(' + z + 'px);' + css);
      const acc = hex(th, 'accent.action'), surf = (th.extras && th.extras['surface.card']) || hex(th, 'bg.raised');
      const lift = shadowCss(sTok(th, 'shadow.float'));
      plane(0, 'border-radius:' + rc + 'px;background:' + surf + ';box-shadow:' + joinSh(lift, 'inset 0 0 0 1.5px ' + rgba(hex(th, 'fg.primary'), 0.06)) + ';');
      const mid = plane(200, 'border-radius:' + rc + 'px;background:' + rgba('#FFFFFF', 0.38) + ';box-shadow:' + joinSh('inset 0 0 0 2px rgba(255,255,255,.9)', lift) + ';');
      const g = HG.create(HFT, th, { atmos: false });
      g.root.style.left = ((PW - S1.boxW) / 2) + 'px'; g.root.style.top = ((PH - S1.boxH) / 2) + 'px'; g.root.style.transform = 'scale(0.66)'; g.root.style.transformOrigin = '50% 50%';
      mid.appendChild(g.root);
      const top = plane(400, 'display:flex;align-items:center;justify-content:center;');
      const track = el(top, 'position:relative;width:' + Math.round(PW * 0.74) + 'px;height:30px;border-radius:15px;background:' + mix(hex(th, 'bg.base'), acc, 0.3) + ';box-shadow:' + lift + ';');
      el(track, 'position:absolute;left:0;top:0;bottom:0;width:46%;border-radius:15px;background:' + acc + ';');
      el(track, 'position:absolute;left:calc(46% - 34px);top:-19px;width:68px;height:68px;border-radius:50%;background:' + acc + ';box-shadow:' + joinSh('0 0 0 8px #FFFFFF', lift) + ';');
      [[-PW / 2, -PH / 2], [PW / 2, PH / 2]].forEach(([x, y]) => el(iso, 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:400px;height:0;border-top:2px dashed ' + rgba(hex(th, 'fg.primary'), 0.18) + ';transform-origin:0 0;transform:rotateY(-90deg);'));
      kick('right:' + G.m + 'px;bottom:' + Math.round(G.m + 40 + capH + 24) + 'px;text-align:right;');
      caption(th, f, 'right:' + G.m + 'px;bottom:' + (G.m + 40) + 'px;', 'right');
    } else if (arch === 'type-led') {   /* the type IS the hero; the wave is a small mark beside the kicker */
      const k = 0.16;
      glyph(th, f, G.m + S1.boxW * k / 2, G.m + 40, k, { atmos: false });
      kick('left:' + Math.round(G.m + S1.boxW * k + 28) + 'px;top:' + Math.round(G.m + 40 - role(th, kickerRole(th)).size * 0.55) + 'px;');
      const box = el(f, 'position:absolute;left:' + (G.m - 6) + 'px;bottom:' + G.m + 'px;');
      const l1 = el(box, ty(th, 'display') + titleInk(th) + 'display:block;width:max-content;', COPY.captionLines[0]);
      const l2 = el(box, ty(th, 'display') + 'color:var(--accent-text);display:block;width:max-content;', accentWord(th, COPY.captionLines[1]));
      [l1, l2].forEach((e) => { e.dataset.grow = String(W - 2 * G.m); });
    } else {   /* centre */
      glyph(th, f, W / 2, H * 0.43, 0.74);
      caption(th, f, 'left:0;right:0;top:' + Math.round(H * 0.43 + S1.line * 0.74 + 92) + 'px;color:var(--fg-muted);', 'center').innerHTML = COPY.caption;
    }
    return finishFrame(th, f);
  }

  /* ------------------------------------------------------------ fit pass (after fonts load) */
  function fitAll(root) {
    root.querySelectorAll('[data-fitw]').forEach((e) => {
      const max = +e.dataset.fitw, w = Math.max(e.offsetWidth, e.scrollWidth);
      if (w <= max) return;
      const fs = parseFloat(getComputedStyle(e).fontSize), min = +e.dataset.min || 48;
      e.style.fontSize = Math.max(min, fs * max / w) + 'px';
      const bar = e.closest('[data-bar]');
      const deficit = Math.max(e.offsetWidth, e.scrollWidth) - max;
      if (bar && deficit > 0) {
        const grow = Math.ceil(deficit + 8);
        bar.style.width = (bar.offsetWidth + grow) + 'px';
        if (bar.dataset.bar === 'center') bar.style.left = (parseFloat(bar.style.left) - grow / 2) + 'px';
      }
    });
    /* type-led hero: each line grows (or shrinks) to the measure */
    root.querySelectorAll('[data-grow]').forEach((e) => {
      const max = +e.dataset.grow, fs = parseFloat(getComputedStyle(e).fontSize), w = e.offsetWidth;
      e.style.fontSize = Math.min(fs * max / w, 330) + 'px';
    });
    /* macro type: line 1 to ~62 % of the frame width, line 2 (the accent) 1.12 × the measure → cropped by the right edge */
    root.querySelectorAll('[data-cropbox]').forEach((fr) => {
      const [m] = fr.dataset.cropbox.split(',').map(Number);
      const l1 = fr.querySelector('[data-crop="1"]'), l2 = fr.querySelector('[data-crop="2"]');
      const fs1 = parseFloat(getComputedStyle(l1).fontSize), fs2 = parseFloat(getComputedStyle(l2).fontSize);
      const s1 = Math.min(fs1 * (W * 0.62) / l1.offsetWidth, 300);
      l1.style.fontSize = s1 + 'px';
      const s2 = Math.min(fs2 * ((W - m) * 1.12) / l2.offsetWidth, 760);
      l2.style.fontSize = s2 + 'px';
      const top1 = parseFloat(l1.style.top);
      l2.style.top = Math.round(top1 + s1 * 0.86) + 'px';
    });
    root.querySelectorAll('[data-poster]').forEach((box) => {
      const [maxW, maxH] = box.dataset.poster.split(',').map(Number);
      const lines = Array.from(box.querySelectorAll('[data-line]'));
      const th = themeOf(box), cap = tok(th, 'type.mega').size;
      const r = lines.map((e) => e.offsetWidth / parseFloat(getComputedStyle(e).fontSize));
      const lh = lines.map((e) => tok(th, 'type.' + e.dataset.line).lineHeight);
      let s2 = r.map((ri) => Math.min(cap, maxW / ri));
      const h2 = s2.reduce((a, s, i) => a + s * lh[i], 0);
      if (h2 > maxH) s2 = s2.map((s) => s * maxH / h2);
      const gap = 0.24;
      const s1 = Math.min(cap, maxW / (r[0] + r[1] + gap), maxH / Math.max(lh[0], lh[1]));
      if (s1 > Math.min(s2[0], s2[1])) {
        const row = el(box, 'display:flex;align-items:baseline;gap:' + (s1 * gap) + 'px;');
        lines.forEach((e) => { e.style.fontSize = s1 + 'px'; row.appendChild(e); });
      } else lines.forEach((e, i) => { e.style.fontSize = s2[i] + 'px'; });
    });
    root.querySelectorAll('[data-posterpill]').forEach((w) => {
      const max = +w.dataset.posterpill; const pw = w.offsetWidth;
      if (pw > max) w.style.transform = 'scale(' + (max / pw) + ')', w.style.transformOrigin = '0 50%';
    });
  }
  function themeOf(node) { while (node && !(node.classList && node.classList.contains('frame'))) node = node.parentNode; const cls = Array.from(node.classList).find((c) => c.indexOf('th-') === 0); return themes.find((t) => clsOf.get(t) === cls); }

  /* ------------------------------------------------------------ board */
  const BOARD = { pad: 64, label: 400, gap: 32, fgap: 20, head: 300, rowGap: 56, foot: 72 };
  const FW = Math.round(W * SCALE), FH = Math.round(H * SCALE);
  BOARD.width = BOARD.pad * 2 + BOARD.label + BOARD.gap + FW * 4 + BOARD.fgap * 3;
  BOARD.height = BOARD.head + ROWS.length * (FH + BOARD.rowGap) + BOARD.foot;

  function swatch(parent, label, h) {
    if (!h) return;
    const s = el(parent, 'display:flex;flex-direction:column;gap:6px;width:56px;');
    el(s, 'width:56px;height:40px;border-radius:8px;background:' + h + ';box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);');
    el(s, 'font:500 10.5px/1.1 var(--c-font-mono);color:var(--c-fg-subtle);letter-spacing:0;', h.toUpperCase());
    el(s, 'font:500 10.5px/1.1 var(--c-font-text);color:var(--c-fg-muted);margin-top:-2px;', label);
  }

  function render(root) {
    root.className = 'chrome';
    root.style.cssText = 'position:relative;width:' + BOARD.width + 'px;height:' + BOARD.height + 'px;background:var(--c-bg-sunken);color:var(--c-fg-primary);font-family:var(--c-font-text);overflow:hidden;';
    const hd = el(root, 'position:absolute;left:' + BOARD.pad + 'px;top:' + BOARD.pad + 'px;right:' + BOARD.pad + 'px;height:' + (BOARD.head - BOARD.pad) + 'px;');
    el(hd, 'font:500 64px/1 var(--c-font-display);letter-spacing:-0.04em;', 'Styleboard');
    el(hd, 'margin-top:18px;font:500 22px/1.4 var(--c-font-text);color:var(--c-fg-muted);letter-spacing:-0.01em;max-width:1500px;',
      'HFT v' + HFT.VERSION + ' · the same four archetype frames in every preset, the Higgsfield brand and two identities derived from a seed. ' +
      'Every frame is a real 1920×1080 composition built only from semantic tokens (theme → toCSSVars, fontLink), shown at ' + Math.round(SCALE * 100) + ' %. ' +
      'A and C follow the composition axis; D follows the hero archetype; the hero is one motif (the 7-bar wave) in each material.');
    const heads = ['A · Title lockup', 'B · Prompt bar (type.input)', 'C · Action (type.action)', 'D · Hero archetype + caption'];
    heads.forEach((t, i) => el(root, 'position:absolute;top:' + (BOARD.head - 40) + 'px;left:' + (BOARD.pad + BOARD.label + BOARD.gap + i * (FW + BOARD.fgap)) + 'px;font:500 15px/1 var(--c-font-mono);letter-spacing:0.06em;text-transform:uppercase;color:var(--c-fg-muted);', t));
    el(root, 'position:absolute;top:' + (BOARD.head - 40) + 'px;left:' + BOARD.pad + 'px;font:500 15px/1 var(--c-font-mono);letter-spacing:0.06em;text-transform:uppercase;color:var(--c-fg-muted);', 'Identity');

    RESOLVED.forEach((R, ri) => {
      const th = R.base, top = BOARD.head + ri * (FH + BOARD.rowGap);
      el(root, 'position:absolute;left:' + BOARD.pad + 'px;right:' + BOARD.pad + 'px;top:' + (top - BOARD.rowGap / 2) + 'px;height:1px;background:var(--c-line-hairline);');
      const lab = el(root, 'position:absolute;left:' + BOARD.pad + 'px;top:' + top + 'px;width:' + BOARD.label + 'px;height:' + FH + 'px;display:flex;flex-direction:column;');
      const name = R.row.kind === 'derive' ? (R.row.id === 'derived-energetic' ? 'Derived · Energetic' : 'Derived · Technical') : th.meta.name;
      const l1 = el(lab, 'display:flex;align-items:baseline;gap:14px;');
      el(l1, 'font:500 16px/1 var(--c-font-mono);color:var(--c-fg-subtle);', String(ri + 1).padStart(2, '0'));
      el(l1, 'font:500 34px/1.05 var(--c-font-display);letter-spacing:-0.03em;', name);
      const src = R.row.kind === 'derive' ? 'derive({seed:\'' + R.row.spec.seed + '\', mood:[\'' + R.row.spec.mood.join("','") + '\']})' : (R.row.kind === 'brand' ? 'brand · style ' + th.meta.style : 'preset');
      el(lab, 'margin-top:12px;font:500 14px/1.35 var(--c-font-mono);color:var(--c-fg-muted);', src + ' · ' + th.meta.scheme + (R.row.alt ? ' (A: ' + R.per.A.meta.scheme + ')' : ''));
      const a = ax(th);
      el(lab, 'margin-top:14px;font:500 15px/1.5 var(--c-font-text);color:var(--c-fg-muted);',
        a.typeVoice + ' · ' + a.material + ' · ' + a.shape + '<br>' + a.motion + ' · ' + a.composition + ' · ' + a.texture + '<br>hero ' + heroPol(th).archetype + ' · cta ' + (compPol(th).cta.form || 'pill'));
      const fam = (r) => role(th, r).family + ' ' + role(th, r).weight;
      el(lab, 'margin-top:8px;font:500 15px/1.5 var(--c-font-text);color:var(--c-fg-primary);',
        fam('display') + (tok(th, 'type.headline').family !== tok(th, 'type.display').family || tok(th, 'type.headline').weight !== tok(th, 'type.display').weight ? ' / ' + tok(th, 'type.headline').weight : '') + '<br>' + fam('input') + ' · ' + fam('action'));
      const sw = el(lab, 'margin-top:auto;display:flex;gap:8px;');
      swatch(sw, 'bg', hex(th, 'bg.base')); swatch(sw, 'raised', hex(th, 'bg.raised')); swatch(sw, 'fg', hex(th, 'fg.primary')); swatch(sw, 'muted', hex(th, 'fg.muted'));
      swatch(sw, 'action', hex(th, 'accent.action')); swatch(sw, 'second', hex(th, 'accent.secondary'));
      const errs = th.issues.filter((i) => i.severity === 'error').length, warns = th.issues.filter((i) => i.severity === 'warn').length;
      el(lab, 'margin-top:12px;font:500 13px/1 var(--c-font-mono);color:' + (errs ? '#F29A92' : 'var(--c-fg-subtle)') + ';', 'validate · ' + errs + ' errors · ' + warns + ' warnings · ' + th.meta.fixes.length + ' auto-fixes');
      const builders = { A: frameTitle, B: framePrompt, C: frameCTA, D: frameHero };
      ['A', 'B', 'C', 'D'].forEach((k, i) => {
        const box = el(root, 'position:absolute;top:' + top + 'px;left:' + (BOARD.pad + BOARD.label + BOARD.gap + i * (FW + BOARD.fgap)) + 'px;width:' + FW + 'px;height:' + FH + 'px;overflow:hidden;border-radius:10px;box-shadow:0 0 0 1px var(--c-line-hairline);');
        let fr;
        try { fr = builders[k](R.per[k]); } catch (err) {
          fr = el(null, 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background:#300;color:#F99;font:500 40px/1.3 monospace;padding:60px;box-sizing:border-box;white-space:pre-wrap;', String(err && err.stack || err));
        }
        fr.style.transform = 'scale(' + SCALE + ')'; fr.style.transformOrigin = '0 0';
        box.appendChild(fr);
      });
    });
    el(root, 'position:absolute;left:' + BOARD.pad + 'px;bottom:' + (BOARD.pad - 24) + 'px;font:500 14px/1 var(--c-font-mono);color:var(--c-fg-subtle);',
      'system/proof/styleboard.html · fonts: Google Fonts via HFT.fontLink() · colours, type, radii, shadows, glows, materials: HFT semantic tokens · hero: hero-glyph.js (shared with the motion demo) · ' + themes.length + ' themes resolved');

    void root.offsetHeight;
    const go = () => document.fonts.ready.then(() => {
      fitAll(root);
      const failed = Array.from(document.fonts).filter((f) => f.status === 'error').map((f) => f.family + ' ' + f.weight + ' ' + f.style);
      document.documentElement.dataset.ready = '1';
      document.documentElement.dataset.fontErrors = failed.join(' | ');
    }).catch((err) => { document.documentElement.dataset.fitError = String(err && err.stack || err); });
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  }

  window.SB = { render, ROWS, BOARD, themes, RESOLVED, role };
})();
