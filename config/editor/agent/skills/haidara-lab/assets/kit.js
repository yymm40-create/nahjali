
(function () {
  "use strict";
  var K = {};
  // ── numbers ──
  K.clamp = function (v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : v > b ? b : v; };
  K.lerp = function (a, b, t) { return a + (b - a) * t; };
  K.map = function (v, a, b, c, d, clamp) { var t = (v - a) / ((b - a) || 1e-9); if (clamp !== false) t = K.clamp(t); return c + (d - c) * t; };
  K.seg = function (t, start, dur) { return K.clamp((t - start) / (dur || 1e-9)); };
  K.smooth = function (e0, e1, x) { var t = K.clamp((x - e0) / ((e1 - e0) || 1e-9)); return t * t * (3 - 2 * t); };
  K.fract = function (x) { return x - Math.floor(x); };
  K.TAU = Math.PI * 2;

  // ── easing ──
  var pow = Math.pow, sin = Math.sin, cos = Math.cos, PI = Math.PI, sqrt = Math.sqrt;
  var E = {
    linear: function (x) { return x; },
    inQuad: function (x) { return x * x; },
    outQuad: function (x) { return 1 - (1 - x) * (1 - x); },
    inOutQuad: function (x) { return x < 0.5 ? 2 * x * x : 1 - pow(-2 * x + 2, 2) / 2; },
    inCubic: function (x) { return x * x * x; },
    outCubic: function (x) { return 1 - pow(1 - x, 3); },
    inOutCubic: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2; },
    outQuart: function (x) { return 1 - pow(1 - x, 4); },
    inOutQuart: function (x) { return x < 0.5 ? 8 * pow(x, 4) : 1 - pow(-2 * x + 2, 4) / 2; },
    outQuint: function (x) { return 1 - pow(1 - x, 5); },
    inExpo: function (x) { return x <= 0 ? 0 : pow(2, 10 * x - 10); },
    outExpo: function (x) { return x >= 1 ? 1 : 1 - pow(2, -10 * x); },
    inOutExpo: function (x) { return x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? pow(2, 20 * x - 10) / 2 : (2 - pow(2, -20 * x + 10)) / 2; },
    outCirc: function (x) { return sqrt(1 - pow(x - 1, 2)); },
    inOutSine: function (x) { return -(cos(PI * x) - 1) / 2; },
    outBack: function (x, s) { s = s === undefined ? 1.70158 : s; var c3 = s + 1; return 1 + c3 * pow(x - 1, 3) + s * pow(x - 1, 2); },
    inBack: function (x, s) { s = s === undefined ? 1.70158 : s; return (s + 1) * x * x * x - s * x * x; },
    outElastic: function (x) { var c4 = (2 * PI) / 3; return x <= 0 ? 0 : x >= 1 ? 1 : pow(2, -10 * x) * sin((x * 10 - 0.75) * c4) + 1; },
    // the "expensive" curve of product films: a long, silky landing (cubic-bezier(0.16, 1, 0.3, 1))
    silk: function (x) { return K.bezier(0.16, 1, 0.3, 1)(x); },
    // a fast start and a soft stop with a hint of overshoot (cubic-bezier(0.34, 1.56, 0.64, 1))
    snap: function (x) { return K.bezier(0.34, 1.56, 0.64, 1)(x); },
  };
  K.ease = E;
  // a CSS-like cubic-bezier easing, solved by Newton then bisection
  K.bezier = function (x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function sx(t) { return ((ax * t + bx) * t + cx) * t; }
    function sy(t) { return ((ay * t + by) * t + cy) * t; }
    function dx(t) { return (3 * ax * t + 2 * bx) * t + cx; }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x, i;
      for (i = 0; i < 8; i++) { var e = sx(t) - x; if (Math.abs(e) < 1e-6) return sy(t); var d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      var lo = 0, hi = 1; t = x;
      for (i = 0; i < 30; i++) { var v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return sy(t);
    };
  };
  // a damped spring from 0 to 1 at time t seconds (stiffness/damping as in physics UIs; mass 1)
  K.spring = function (t, o) {
    o = o || {}; var k = o.stiffness || 170, c = o.damping || 26, m = o.mass || 1;
    if (t <= 0) return 0;
    var w0 = sqrt(k / m), z = c / (2 * sqrt(k * m));
    if (z < 1) { var wd = w0 * sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (cos(wd * t) + (z * w0 / wd) * sin(wd * t)); }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  // a value that springs to new targets over time and stays a pure function of t: the SUM of one spring per change.
  // changes: [[atSeconds, target], …] (sorted); starts at "from". The way the viral UI-morph films move.
  K.springTo = function (t, from, changes, o) {
    var v = from, prev = from;
    for (var i = 0; i < changes.length; i++) { var c = changes[i]; if (t <= c[0]) break; v += (c[1] - prev) * K.spring(t - c[0], o); prev = c[1]; }
    return v;
  };
  // keyframes [[t, value], …] with an easing per segment (the ease of the key it leaves)
  K.keys = function (t, keys, ease) {
    if (!keys.length) return 0; if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) if (t < keys[i][0]) { var a = keys[i - 1], b = keys[i], e = a[2] || ease || E.inOutCubic; return K.lerp(a[1], b[1], e(K.seg(t, a[0], b[0] - a[0]))); }
    return keys[keys.length - 1][1];
  };
  // from → to over [start, start+dur] with an easing
  K.tween = function (t, start, dur, from, to, ease) { return K.lerp(from, to, (ease || E.outCubic)(K.seg(t, start, dur))); };
  K.stagger = function (i, gap) { return i * (gap === undefined ? 0.06 : gap); };
  // a value that goes in, holds, and goes out: 0 → 1 → 0 (in/out in seconds)
  K.envelope = function (t, start, end, inDur, outDur, easeIn, easeOut) {
    inDur = inDur === undefined ? 0.35 : inDur; outDur = outDur === undefined ? 0.25 : outDur;
    if (t < start || t > end) return 0;
    var a = (easeIn || E.outCubic)(K.seg(t, start, inDur)), b = 1 - (easeOut || E.inCubic)(K.seg(t, end - outDur, outDur));
    return Math.min(a, b);
  };
  // the beat grid of a tempo: which beat t is on, and how far into it (0..1)
  K.beat = function (t, bpm, offset) { var p = ((t - (offset || 0)) * bpm) / 60; return { n: Math.floor(p), f: K.fract(p) }; };

  // ── randomness (seeded) ──
  K.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  K.hash = function (n) { var x = sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ── simplex noise (2D / 3D), seeded ──
  function makeNoise(seed) {
    var r = K.rng(seed || 7), p = new Uint8Array(256), i;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    var perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    var g3 = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
    var F2 = 0.5 * (sqrt(3) - 1), G2 = (3 - sqrt(3)) / 6, F3 = 1 / 3, G3 = 1 / 6;
    function n2(xin, yin) {
      var s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
      var x0 = xin - (i - t), y0 = yin - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255, n = 0, tt, gi;
      tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { gi = pm12[ii + perm[jj]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x0 + g3[gi + 1] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { gi = pm12[ii + i1 + perm[jj + j1]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x1 + g3[gi + 1] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { gi = pm12[ii + 1 + perm[jj + 1]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x2 + g3[gi + 1] * y2); }
      return 70 * n;
    }
    function n3(xin, yin, zin) {
      var s = (xin + yin + zin) * F3, i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s), t = (i + j + k) * G3;
      var x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t), i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
      else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
      var x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3, x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      var ii = i & 255, jj = j & 255, kk = k & 255, n = 0, tt, gi;
      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0; if (tt > 0) { gi = pm12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x0 + g3[gi + 1] * y0 + g3[gi + 2] * z0); }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1; if (tt > 0) { gi = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x1 + g3[gi + 1] * y1 + g3[gi + 2] * z1); }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2; if (tt > 0) { gi = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x2 + g3[gi + 1] * y2 + g3[gi + 2] * z2); }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3; if (tt > 0) { gi = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x3 + g3[gi + 1] * y3 + g3[gi + 2] * z3); }
      return 32 * n;
    }
    return { n2: n2, n3: n3 };
  }
  var NZ = makeNoise(7);
  K.noise2 = function (x, y) { return NZ.n2(x, y); };
  K.noise3 = function (x, y, z) { return NZ.n3(x, y, z); };
  K.fbm = function (x, y, z, oct) { var s = 0, a = 0.5, f = 1, i; oct = oct || 4; for (i = 0; i < oct; i++) { s += a * NZ.n3(x * f, y * f, (z || 0) * f); f *= 2; a *= 0.5; } return s; };
  // a swirling, divergence-free flow (curl of noise): smoke, dust, magic
  K.curl = function (x, y, z) { var e = 0.01; var a = NZ.n3(x, y + e, z) - NZ.n3(x, y - e, z), b = NZ.n3(x + e, y, z) - NZ.n3(x - e, y, z); return [a / (2 * e), -b / (2 * e)]; };
  // a smooth camera/handheld shake (pixels), seeded
  K.shake = function (t, amp, freq, seed) { freq = freq || 7; var s = (seed || 1) * 13.7; return [NZ.n2(t * freq, s) * amp, NZ.n2(s, t * freq) * amp]; };

  // ── colour ──
  K.rgb = function (hex) { var h = String(hex).replace("#", ""); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  K.rgba = function (hex, a) { var c = K.rgb(hex); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a === undefined ? 1 : a) + ")"; };
  K.mix = function (a, b, t) { var x = K.rgb(a), y = K.rgb(b); function h(v) { return Math.round(K.clamp(v, 0, 255)).toString(16).padStart(2, "0"); } return "#" + h(K.lerp(x[0], y[0], t)) + h(K.lerp(x[1], y[1], t)) + h(K.lerp(x[2], y[2], t)); };

  // ── numbers on screen ──
  var AR = "٠١٢٣٤٥٦٧٨٩";
  K.digits = function (s, arabic) { return arabic ? String(s).replace(/[0-9]/g, function (d) { return AR[+d]; }) : String(s); };
  K.counter = function (p, from, to, o) { o = o || {}; var v = K.lerp(from, to, (o.ease || E.outExpo)(K.clamp(p))); var s = v.toFixed(o.decimals || 0); if (o.comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); return K.digits((o.prefix || "") + s + (o.suffix || ""), o.arabic); };

  // ── canvas (filled in by the runtime: K.W, K.H, K.ctx, K.canvas, K.fonts, K.img) ──
  K.layers = {};
  // an offscreen canvas of the frame's size (or w×h), reused by name
  K.layer = function (name, w, h) {
    w = Math.max(1, Math.round(w || K.W)); h = Math.max(1, Math.round(h || K.H));
    var l = K.layers[name];
    if (!l) { var c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas"); c.width = w; c.height = h; l = { c: c, x: c.getContext("2d", { willReadFrequently: true }) }; K.layers[name] = l; }
    if (l.c.width !== w || l.c.height !== h) { l.c.width = w; l.c.height = h; }
    l.x.setTransform(1, 0, 0, 1, 0, 0); l.x.globalAlpha = 1; l.x.globalCompositeOperation = "source-over"; l.x.filter = "none"; l.x.clearRect(0, 0, w, h);
    return l;
  };
  // a repeating fill from a layer, a canvas or a picture (a layer's own canvas is taken for you)
  K.pattern = function (ctx, src, rep) { var c = src && src.c ? src.c : src && src.canvas ? src.canvas : src; return c ? ctx.createPattern(c, rep || "repeat") : null; };
  K.reset = function (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none"; ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; ctx.setLineDash([]); };
  K.isArabic = function (s) { return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(String(s)); };
  K.font = function (size, weight, family) { return (weight || 700) + " " + Math.max(1, Math.round(size)) + "px " + (family || (K.fonts && K.fonts.head) || "sans-serif"); };
  // the largest size (≤ max) at which a line fits in maxW
  K.fit = function (ctx, str, maxW, max, weight, family, min) {
    var s = max, lo = min || 8;
    ctx.save(); ctx.font = K.font(s, weight, family);
    var w = ctx.measureText(str).width;
    if (w > maxW) s = Math.max(lo, Math.floor(s * maxW / w));
    ctx.restore(); return s;
  };
  // words wrapped into lines no wider than maxW
  K.wrap = function (ctx, str, maxW, size, weight, family) {
    ctx.save(); ctx.font = K.font(size, weight, family);
    var words = String(str).split(/\s+/).filter(Boolean), lines = [], cur = "";
    for (var i = 0; i < words.length; i++) { var test = cur ? cur + " " + words[i] : words[i]; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = test; }
    if (cur) lines.push(cur); ctx.restore(); return lines;
  };
  // one line of type: size, weight, family, color or gradient [c1,c2], glow {color, blur}, shadow, tracking (Latin only),
  // align, alpha, blur (px, for a blur-in), scale. Arabic is set right-to-left and never tracked (it would break the joins).
  K.text = function (ctx, str, x, y, o) {
    o = o || {}; var size = o.size || 64, ar = K.isArabic(str);
    ctx.save();
    ctx.font = K.font(size, o.weight, o.family);
    ctx.textAlign = o.align || "center"; ctx.textBaseline = o.baseline || "middle";
    ctx.direction = ar ? "rtl" : "ltr";
    if ("letterSpacing" in ctx) ctx.letterSpacing = !ar && o.tracking ? o.tracking + "px" : "0px";
    ctx.globalAlpha *= o.alpha === undefined ? 1 : K.clamp(o.alpha);
    if (o.scale && o.scale !== 1) { ctx.translate(x, y); ctx.scale(o.scale, o.scale); x = 0; y = 0; }
    if (o.rotate) { ctx.translate(x, y); ctx.rotate(o.rotate); x = 0; y = 0; }
    if (o.blur) ctx.filter = "blur(" + o.blur + "px)";
    var fill = o.color || "#ffffff";
    if (o.gradient) { var m = ctx.measureText(str); var g = ctx.createLinearGradient(0, y - size * 0.6, 0, y + size * 0.6); g.addColorStop(0, o.gradient[0]); g.addColorStop(1, o.gradient[1]); fill = g; void m; }
    if (o.glow) { ctx.save(); ctx.shadowColor = o.glow.color || fill; ctx.shadowBlur = o.glow.blur || 24; ctx.fillStyle = fill; ctx.fillText(str, x, y); ctx.restore(); }
    if (o.shadow) { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = size * 0.18; ctx.shadowOffsetY = size * 0.06; }
    if (o.stroke) { ctx.lineWidth = o.stroke.width || 2; ctx.strokeStyle = o.stroke.color || "#000"; ctx.lineJoin = "round"; ctx.strokeText(str, x, y); }
    ctx.fillStyle = fill; ctx.fillText(str, x, y);
    ctx.restore();
  };
  K.roundRect = function (ctx, x, y, w, h, r) { r = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  // a path drawn on: p 0..1 of its length (len = the path's length, roughly)
  K.drawOn = function (ctx, p, len, pathFn) { ctx.save(); ctx.setLineDash([len, len]); ctx.lineDashOffset = len * (1 - K.clamp(p)); ctx.beginPath(); pathFn(ctx); ctx.stroke(); ctx.restore(); };

  // ── particles: a word, a logo or a picture out of dust ──
  // the points (x, y[, r, g, b]) where something is drawn: drawFn draws it on a mask layer; every "step" px is sampled
  K.sample = function (drawFn, o) {
    o = o || {}; var step = Math.max(1, Math.round(o.step || 4)), l = K.layer("__sample"), d, out = [], r = K.rng(o.seed || 3);
    drawFn(l.x);
    d = l.x.getImageData(0, 0, l.c.width, l.c.height).data;
    for (var y = 0; y < l.c.height; y += step) for (var x = 0; x < l.c.width; x += step) { var i = (y * l.c.width + x) * 4; if (d[i + 3] > 128) out.push([x + (r() - 0.5) * step * 0.6, y + (r() - 0.5) * step * 0.6, d[i], d[i + 1], d[i + 2]]); }
    for (var k = out.length - 1; k > 0; k--) { var j = Math.floor(r() * (k + 1)); var tmp = out[k]; out[k] = out[j]; out[j] = tmp; }
    if (o.max && out.length > o.max) out.length = o.max;
    return out;
  };
  K.textPoints = function (str, o) { o = o || {}; return K.sample(function (x) { K.text(x, str, o.x === undefined ? K.W / 2 : o.x, o.y === undefined ? K.H / 2 : o.y, { size: o.size || 160, weight: o.weight || 900, family: o.family, color: "#fff" }); }, o); };
  K.imagePoints = function (id, o) { o = o || {}; var im = K.img(id); return K.sample(function (x) { if (im) x.drawImage(im, o.x || 0, o.y || 0, o.w || im.width, o.h || im.height); }, o); };
  // a swarm flying to its points: p 0..1 (0 = scattered, 1 = assembled). from: "scatter" | "center" | "bottom" | "edge"
  // | "explode" (outward from the shape). Each particle starts after its own delay (wave by x when o.wave), drifts on a
  // curl-noise flow while it travels, and lands with an ease. Draw dissolve with p going 1 → 0.
  K.swarm = function (pts, o) {
    o = o || {}; var r = K.rng(o.seed || 11), n = pts.length, sx = new Float32Array(n), sy = new Float32Array(n), dl = new Float32Array(n), sz = new Float32Array(n);
    var cx = K.W / 2, cy = K.H / 2, minX = 1e9, maxX = -1e9, i;
    for (i = 0; i < n; i++) { if (pts[i][0] < minX) minX = pts[i][0]; if (pts[i][0] > maxX) maxX = pts[i][0]; }
    for (i = 0; i < n; i++) {
      var a = r() * K.TAU, d;
      if (o.from === "center") { d = r() * 30; sx[i] = cx + cos(a) * d; sy[i] = cy + sin(a) * d; }
      else if (o.from === "bottom") { sx[i] = r() * K.W; sy[i] = K.H + 40 + r() * K.H * 0.4; }
      else if (o.from === "edge") { d = Math.max(K.W, K.H) * (0.6 + r() * 0.3); sx[i] = cx + cos(a) * d; sy[i] = cy + sin(a) * d; }
      else if (o.from === "explode") { var dx = pts[i][0] - cx, dy = pts[i][1] - cy, m = sqrt(dx * dx + dy * dy) || 1, f = (o.spread || 0.9) * Math.max(K.W, K.H) * (0.4 + r() * 0.8); sx[i] = pts[i][0] + (dx / m) * f; sy[i] = pts[i][1] + (dy / m) * f; }
      else { sx[i] = (r() * 1.4 - 0.2) * K.W; sy[i] = (r() * 1.4 - 0.2) * K.H; }
      dl[i] = o.wave ? (K.isArabic(o.text || "") ? (maxX - pts[i][0]) : (pts[i][0] - minX)) / ((maxX - minX) || 1) * (o.waveSpan || 0.45) + r() * 0.08 : r() * (o.delay === undefined ? 0.35 : o.delay);
      sz[i] = (o.size || 2.2) * (0.6 + r() * 0.8);
    }
    return {
      count: n,
      draw: function (ctx, p, t, d) {
        d = d || {}; var amp = d.curl === undefined ? 160 : d.curl, col = d.color || o.color || "#ffffff", ease = d.ease || E.outCubic, span = 1 - (o.delay === undefined ? 0.35 : o.delay);
        ctx.save(); if (d.additive !== false) ctx.globalCompositeOperation = "lighter";
        var useOwn = d.ownColor && pts[0] && pts[0].length >= 5;
        if (!useOwn) ctx.fillStyle = col;
        for (var k = 0; k < n; k++) {
          var q = ease(K.seg(p, dl[k], span)), inv = 1 - q, fx = 0, fy = 0;
          if (inv > 0.001 && amp) { var c = K.curl(sx[k] * 0.0022, sy[k] * 0.0022, t * 0.35 + k * 0.0001); fx = c[0] * amp * inv; fy = c[1] * amp * inv; }
          var x = sx[k] + (pts[k][0] - sx[k]) * q + fx, y = sy[k] + (pts[k][1] - sy[k]) * q + fy, s = sz[k] * (d.sizeLanded === undefined ? 1 : K.lerp(1.6, d.sizeLanded, q));
          if (useOwn) ctx.fillStyle = "rgb(" + pts[k][2] + "," + pts[k][3] + "," + pts[k][4] + ")";
          ctx.globalAlpha = (d.alpha === undefined ? 1 : d.alpha) * (0.35 + 0.65 * q);
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
        ctx.restore();
      },
    };
  };

  // ── liquid: metaballs (balls [{x, y, r}]) drawn as one goo, colour or gradient [c1, c2] ──
  K.metaballs = function (ctx, balls, o) {
    o = o || {}; var res = o.res || 0.25, w = Math.ceil(K.W * res), h = Math.ceil(K.H * res), l = K.layer("__meta", w, h), img = l.x.createImageData(w, h), d = img.data;
    var c1 = K.rgb(o.color || (o.gradient && o.gradient[0]) || "#ffffff"), c2 = K.rgb((o.gradient && o.gradient[1]) || o.color || "#ffffff"), th = o.threshold || 1, edge = o.edge || 0.25;
    var bs = balls.map(function (b) { return [b.x * res, b.y * res, b.r * res * b.r * res]; });
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var s = 0; for (var i = 0; i < bs.length; i++) { var dx = x - bs[i][0], dy = y - bs[i][1]; s += bs[i][2] / (dx * dx + dy * dy + 1e-3); }
      var a = K.smooth(th - edge, th + edge, s), k = (y * w + x) * 4, g = y / h;
      d[k] = c1[0] + (c2[0] - c1[0]) * g; d[k + 1] = c1[1] + (c2[1] - c1[1]) * g; d[k + 2] = c1[2] + (c2[2] - c1[2]) * g; d[k + 3] = a * 255;
    }
    l.x.putImageData(img, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; if (o.soften !== false) ctx.filter = "blur(" + Math.max(1, 1 / res) + "px)";
    ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha; ctx.drawImage(l.c, 0, 0, K.W, K.H); ctx.restore();
  };

  // ── light ──
  // what drawFn draws, with a soft glow of itself around it
  K.glow = function (ctx, drawFn, o) {
    o = o || {}; var l = K.layer("__glow"); drawFn(l.x);
    ctx.save(); ctx.globalCompositeOperation = o.comp || "lighter"; ctx.globalAlpha *= o.alpha === undefined ? 0.9 : o.alpha;
    ctx.filter = "blur(" + (o.blur || 24) + "px)"; ctx.drawImage(l.c, 0, 0);
    if (o.wide) { ctx.filter = "blur(" + o.wide + "px)"; ctx.globalAlpha *= 0.6; ctx.drawImage(l.c, 0, 0); }
    ctx.restore(); ctx.drawImage(l.c, 0, 0);
  };
  // the whole frame's bright parts bleed light (call near the end of draw)
  K.bloom = function (ctx, o) {
    o = o || {}; var q = o.res || 0.25, l = K.layer("__bloom", K.W * q, K.H * q);
    l.x.filter = "brightness(" + (o.threshold || 1.15) + ") saturate(1.2)"; l.x.drawImage(ctx.canvas, 0, 0, l.c.width, l.c.height);
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = o.strength === undefined ? 0.55 : o.strength; ctx.imageSmoothingQuality = "high";
    ctx.filter = "blur(" + (o.radius || 18) + "px)"; ctx.drawImage(l.c, 0, 0, K.W, K.H); ctx.restore();
  };
  // a band of light crossing what clipFn draws (p 0..1): the "premium" sheen on type, cards and logos
  K.lightSweep = function (ctx, p, clipFn, o) {
    o = o || {}; var l = K.layer("__sweep"); clipFn(l.x);
    l.x.globalCompositeOperation = "source-in";
    var ang = (o.angle === undefined ? -22 : o.angle) * PI / 180, w = (o.width || 0.18) * K.W, x = K.lerp(-w * 2, K.W + w * 2, E.inOutCubic(K.clamp(p)));
    var g = l.x.createLinearGradient(x - w * cos(ang), -w * sin(ang), x + w * cos(ang), w * sin(ang));
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, K.rgba(o.color || "#ffffff", o.alpha === undefined ? 0.75 : o.alpha)); g.addColorStop(1, "rgba(255,255,255,0)");
    l.x.fillStyle = g; l.x.fillRect(0, 0, K.W, K.H);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(l.c, 0, 0); ctx.restore();
  };
  // a motion trail: drawFn(ctx, t') at earlier times, fading (copies, dt seconds apart), optionally tinted
  K.echo = function (ctx, t, drawFn, o) {
    o = o || {}; var n = o.copies || 5, dt = o.dt || 0.035;
    for (var i = n; i >= 1; i--) { var l = K.layer("__echo"); drawFn(l.x, t - i * dt); if (o.tint) { l.x.globalCompositeOperation = "source-in"; l.x.fillStyle = o.tint; l.x.fillRect(0, 0, K.W, K.H); } ctx.save(); ctx.globalAlpha *= (o.alpha === undefined ? 0.5 : o.alpha) * (1 - i / (n + 1)); ctx.drawImage(l.c, 0, 0); ctx.restore(); }
    drawFn(ctx, t);
  };

  // ── film finish ──
  var grainTiles = null;
  K.grain = function (ctx, t, o) {
    o = o || {}; var amt = o.amount === undefined ? 0.02 : o.amount; if (amt <= 0) return;
    if (!grainTiles) { grainTiles = []; for (var g = 0; g < 4; g++) { var c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(256, 256) : document.createElement("canvas"); c.width = c.height = 256; var x = c.getContext("2d", { willReadFrequently: true }), im = x.createImageData(256, 256), r = K.rng(100 + g); for (var i = 0; i < im.data.length; i += 4) { var v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); grainTiles.push(c); } }
    var tile = grainTiles[(((Math.floor(t * 24) || 0) % 4) + 4) % 4]; if (!tile) return;
    ctx.save(); ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = amt; ctx.fillStyle = ctx.createPattern(tile, "repeat"); ctx.fillRect(0, 0, K.W, K.H); ctx.restore();
  };
  K.vignette = function (ctx, o) {
    o = o || {}; var g = ctx.createRadialGradient(K.W / 2, K.H / 2, Math.min(K.W, K.H) * (o.inner || 0.35), K.W / 2, K.H / 2, Math.max(K.W, K.H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, K.rgba(o.color || "#000000", o.amount === undefined ? 0.45 : o.amount));
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, K.W, K.H); ctx.restore();
  };
  // RGB split of the whole frame (px apart): glitch hits and lens fringe
  K.rgbSplit = function (ctx, px, o) {
    o = o || {}; if (!px) return; var src = K.layer("__rgbsrc"); src.x.drawImage(ctx.canvas, 0, 0, K.W, K.H);
    var chans = [["#ff0000", -px, 0], ["#00ff00", 0, 0], ["#0000ff", px, o.dy || 0]];
    K.reset(ctx); ctx.fillStyle = o.bg || "#000"; ctx.fillRect(0, 0, K.W, K.H);
    for (var i = 0; i < 3; i++) { var l = K.layer("__rgb" + i); l.x.drawImage(src.c, 0, 0); l.x.globalCompositeOperation = "multiply"; l.x.fillStyle = chans[i][0]; l.x.fillRect(0, 0, K.W, K.H); ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.drawImage(l.c, chans[i][1], chans[i][2]); ctx.restore(); }
  };
  // frosted glass over what is already drawn: a rounded card that blurs and lifts what is behind it
  K.glass = function (ctx, x, y, w, h, o) {
    o = o || {}; var r = o.radius === undefined ? 28 : o.radius, src = K.layer("__glass"); src.x.drawImage(ctx.canvas, 0, 0, K.W, K.H);
    ctx.save();
    if (o.shadow !== false) { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; K.roundRect(ctx, x, y, w, h, r); ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fill(); ctx.shadowColor = "transparent"; }
    K.roundRect(ctx, x, y, w, h, r); ctx.clip();
    ctx.filter = "blur(" + (o.blur || 26) + "px) saturate(1.4)"; ctx.drawImage(src.c, 0, 0); ctx.filter = "none";
    ctx.fillStyle = o.tint || "rgba(255,255,255,0.10)"; ctx.fillRect(x, y, w, h);
    var g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, "rgba(255,255,255,0.22)"); g.addColorStop(0.35, "rgba(255,255,255,0.04)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.save(); K.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.lineWidth = o.border || 1.5; ctx.strokeStyle = o.borderColor || "rgba(255,255,255,0.35)"; ctx.stroke(); ctx.restore();
  };

  // ── a 2.5D camera: layers at depth z move and scale with it (parallax, push-ins, fly-throughs) ──
  K.camera = function (o) { o = o || {}; return { x: o.x || 0, y: o.y || 0, z: o.z || 0, fov: o.fov || 900, roll: o.roll || 0 }; };
  K.project = function (cam, x, y, z) { var dz = (z || 0) - cam.z, s = cam.fov / Math.max(1, cam.fov + dz); return { x: K.W / 2 + (x - cam.x) * s, y: K.H / 2 + (y - cam.y) * s, s: s }; };
  // draws drawFn(ctx) for a layer at depth z (its content laid out around the frame's centre in world units)
  K.inSpace = function (ctx, cam, z, drawFn, o) {
    o = o || {}; var p = K.project(cam, 0, 0, z); if (p.s <= 0.01) return;
    ctx.save(); ctx.translate(p.x, p.y); if (cam.roll) ctx.rotate(cam.roll); ctx.scale(p.s, p.s);
    if (o.dof) { var b = Math.abs((z || 0) - (o.focus || 0)) * o.dof; if (b > 0.3) ctx.filter = "blur(" + b.toFixed(1) + "px)"; }
    ctx.translate(-K.W / 2, -K.H / 2); drawFn(ctx); ctx.restore();
  };

  // ── assets the runtime handed in (pictures by id) ──
  K.img = function (id) { return (K.assets && K.assets[id]) || null; };
  // a picture drawn to cover / contain a box, with an optional rounded clip
  K.picture = function (ctx, id, x, y, w, h, o) {
    o = o || {}; var im = K.img(id); if (!im) return false;
    var s = (o.fit === "contain" ? Math.min : Math.max)(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s;
    ctx.save(); if (o.radius) { K.roundRect(ctx, x, y, w, h, o.radius); ctx.clip(); }
    ctx.globalAlpha *= o.alpha === undefined ? 1 : o.alpha; ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore(); return true;
  };

  // ── the owner's motion grammar (higgsfield-motion-saas, assets/film-template/engine.js), as calls ──
  // a DISCRETE change (a word swapped in, a typed character, a cut) lands on a frame, so the sub-frame blur never doubles it
  K.TQ = function (t) { var f = K.fps || 30; return Math.round(t * f) / f; };
  var bz = function (a, b, c, d) { var f = null; return function (x) { f = f || K.bezier(a, b, c, d); return f(x); }; };
  K.E = {
    lin: function (p) { return p; },
    in: function (k) { k = k || 3; return function (p) { return Math.pow(p, k); }; },
    out: function (k) { k = k || 3; return function (p) { return 1 - Math.pow(1 - p, k); }; },
    inOut: function (k) { k = k || 3; return function (p) { return p < 0.5 ? Math.pow(2 * p, k) / 2 : 1 - Math.pow(2 - 2 * p, k) / 2; }; },
    soft: bz(0.16, 1, 0.3, 1), smooth: bz(0.5, 0, 0.1, 1), glide: bz(0.45, 0, 0.55, 1), sine: bz(0.37, 0, 0.63, 1),
    expoIn: bz(0.7, 0, 0.84, 0), needle: bz(0.95, 0, 0.05, 1), into: bz(0.5, 0, 0.85, 0.625), settle: bz(0.2, 0.7, 0.05, 1),
    morph1: bz(0.66, 0, 0.9, 0.1), morph2: bz(0.07, 0.44, 0.16, 1), width: bz(0.75, 0, 0.25, 1),
    back: function (s) { s = s === undefined ? 1.2 : s; return function (p) { return 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2); }; },
  };
  // keys that never stop at a middle key: [[t, v], [t, v, easeIntoThisKey], …] (numbers or arrays), smooth by default
  K.kf = function (t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      var k1 = keys[i], k0 = keys[i - 1];
      if (t <= k1[0]) { var q = (k1[2] || K.E.smooth)(K.clamp((t - k0[0]) / ((k1[0] - k0[0]) || 1e-9))); return Array.isArray(k0[1]) ? k0[1].map(function (a, j) { return a + (k1[1][j] - a) * q; }) : k0[1] + (k1[1] - k0[1]) * q; }
    }
    return keys[keys.length - 1][1];
  };
  // zoom in LOG space (equal ratios feel equal); the needle puts its fastest frame ON the cut
  K.zoom = function (t, t0, t1, a, b, e) { return Math.exp(K.lerp(Math.log(a), Math.log(b), (e || K.E.smooth)(K.clamp((t - t0) / ((t1 - t0) || 1e-9))))); };
  K.needle = function (t, cut, a, b, h) { h = h === undefined ? 0.2 : h; return K.zoom(t, cut - h, cut + h - 1 / (K.fps || 30), a, b, K.E.needle); };
  // scale/rotate about a pivot (the "parent null"): ctx is transformed, draw after it inside save/restore
  K.about = function (ctx, px, py, s, dx, dy, r) { ctx.translate(px + (dx || 0), py + (dy || 0)); if (r) ctx.rotate(r); ctx.scale(s, s); ctx.translate(-px, -py); };
  // entrances: a pop (≈6% overshoot), a soft settle (none), the After Effects inertial bounce and a rise into it
  K.pop = function (t, t0, d) { d = d || 0.5; var x = (t - t0) / d; if (x <= 0) return 0; if (x >= 1) return 1; return 1 - Math.exp(-6.5 * x) * Math.cos(10.5 * x); };
  K.settle = function (t, t0, d) { d = d || 0.6; var x = t - t0; if (x <= 0) return 0; if (x >= d) return 1; var k = 7 / d; return 1 - (1 + k * x) * Math.exp(-k * x); };
  K.bounce = function (dt, v, amp, freq, decay) { amp = amp === undefined ? 0.0375 : amp; freq = freq || 1.8; decay = decay || 3.2; return dt <= 0 ? 0 : v * amp * Math.sin(freq * dt * K.TAU) / Math.exp(decay * dt); };
  K.rise = function (dt, dist, v) { v = v || 1860; var T = dist / v; if (dt < 0) return dist; if (dt < T) return dist * (1 - dt / T); return -K.bounce(dt - T, v); };
  // typing with a human cadence (Latin by characters; Arabic: pass words joined, and type whole words)
  K.cadence = function (n, T0, T1, seed) { var r = K.rng(seed || 4242), d = [], out = [T0], sum = 0, i; for (i = 1; i < n; i++) { var v = 0.55 + 0.9 * r(); d.push(v); sum += v; } sum = sum || 1; for (i = 0; i < d.length; i++) out.push(out[i] + (d[i] / sum) * (T1 - T0)); return out; };
  K.typedN = function (times, t) { t = K.TQ(t); var n = 0; while (n < times.length && times[n] <= t + 1e-6) n++; return n; };
  K.caretOn = function (t, tEnd, hz) { hz = hz || 2; return t < tEnd ? 1 : Math.floor((t - tEnd) * hz * 2) % 2 === 0 ? 1 : 0; };

  // ── the editable values (texts and colours the person changes on the timeline): K.p(id) reads one ──
  K.P = {};
  K.p = function (id, d) { return K.P && K.P[id] !== undefined && K.P[id] !== null && K.P[id] !== "" ? K.P[id] : d; };

  // ── the person's own filmed video (when the piece is built on it): the runtime hands in the frame of now ──
  K.footage = null;
  K.useFootage = function (m) {
    if (!m) { K.footage = null; return null; }
    var faces = (m.face || []).slice().sort(function (a, b) { return a.t - b.t; });
    var F = { w: m.w || 1080, h: m.h || 1920, duration: m.duration || 0, words: m.words || [], lines: m.lines || [], frame: null, personFrame: null, hasPerson: !!m.person, t: 0 };
    F.faceAt = function (t) {
      if (t === undefined) t = F.t;
      if (!faces.length) return { x: 0.5, y: 0.36, w: 0.3, h: 0.3 };
      if (t <= faces[0].t) return faces[0];
      var last = faces[faces.length - 1];
      if (t >= last.t) return last;
      for (var i = 1; i < faces.length; i++) if (faces[i].t >= t) {
        var a = faces[i - 1], b = faces[i], k = K.smooth(a.t, b.t, t);
        return { x: K.lerp(a.x, b.x, k), y: K.lerp(a.y, b.y, k), w: K.lerp(a.w, b.w, k), h: K.lerp(a.h, b.h, k) };
      }
      return last;
    };
    F.wordAt = function (t) {
      if (t === undefined) t = F.t;
      for (var i = 0; i < F.words.length; i++) if (F.words[i].s <= t && t < Math.max(F.words[i].e, F.words[i].s + 0.05)) return F.words[i];
      return null;
    };
    // the part of the picture that fills a w×h box with the face kept in it (headroom: the face a little above the middle)
    F.crop = function (bw, bh, o) {
      o = o || {};
      var fw = F.frame ? F.frame.width : F.w, fh = F.frame ? F.frame.height : F.h;
      if (o.fit === "contain") { var c = Math.min(bw / fw, bh / fh); return { sx: 0, sy: 0, sw: fw, sh: fh, s: c, dx: (bw - fw * c) / 2, dy: (bh - fh * c) / 2, dw: fw * c, dh: fh * c }; }
      var z = Math.max(1, o.zoom || 1), s = Math.max(bw / fw, bh / fh) * z, sw = Math.min(fw, bw / s), sh = Math.min(fh, bh / s);
      var f = F.faceAt(o.t), cx = (o.cx !== undefined ? o.cx : f.x) * fw, cy = (o.cy !== undefined ? o.cy : f.y) * fh;
      var sx = K.clamp(cx - sw / 2, 0, Math.max(0, fw - sw)), sy = K.clamp(cy - sh * (o.cy !== undefined ? 0.5 : 0.42), 0, Math.max(0, fh - sh));
      return { sx: sx, sy: sy, sw: sw, sh: sh, s: bw / sw, dx: 0, dy: 0, dw: bw, dh: bh };
    };
    F.draw = function (ctx, x, y, w, h, o) {
      o = o || {};
      var c = F.crop(w, h, o), im = F.frame, r = o.circle ? Math.min(w, h) / 2 : Math.max(0, o.radius || 0);
      // «قص الشخص»: the person alone, with the same crop (its picture may be another size), over whatever is drawn
      if (o.person) {
        var pf = F.personFrame;
        if (pf && im) {
          var kx = pf.width / im.width, ky = pf.height / im.height;
          ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= K.clamp(o.alpha);
          K.roundRect(ctx, x + c.dx, y + c.dy, c.dw, c.dh, r); ctx.clip();
          ctx.drawImage(pf, c.sx * kx, c.sy * ky, c.sw * kx, c.sh * ky, x + c.dx, y + c.dy, c.dw, c.dh);
          ctx.restore();
        }
        var f0 = F.faceAt(o.t), fw0 = im ? im.width : F.w, fh0 = im ? im.height : F.h, k0 = c.dw / c.sw;
        return { x: x + c.dx + ((f0.x - f0.w / 2) * fw0 - c.sx) * k0, y: y + c.dy + ((f0.y - f0.h / 2) * fh0 - c.sy) * k0, w: f0.w * fw0 * k0, h: f0.h * fh0 * k0 };
      }
      ctx.save();
      if (o.alpha !== undefined) ctx.globalAlpha *= K.clamp(o.alpha);
      if (o.shadow) {
        var sb = typeof o.shadow === "number" ? o.shadow : Math.round(Math.min(K.W, K.H) * 0.06);
        ctx.save(); ctx.shadowColor = o.shadowColor || "rgba(12,10,24,0.38)"; ctx.shadowBlur = sb; ctx.shadowOffsetY = sb * 0.45;
        K.roundRect(ctx, x + c.dx, y + c.dy, c.dw, c.dh, r); ctx.fillStyle = "#15151a"; ctx.fill(); ctx.restore();
      }
      ctx.save();
      K.roundRect(ctx, x + c.dx, y + c.dy, c.dw, c.dh, r); ctx.clip();
      if (im) ctx.drawImage(im, c.sx, c.sy, c.sw, c.sh, x + c.dx, y + c.dy, c.dw, c.dh);
      else { ctx.fillStyle = "#26262b"; ctx.fillRect(x + c.dx, y + c.dy, c.dw, c.dh); }
      ctx.restore();
      if (o.border) { K.roundRect(ctx, x + c.dx + o.border / 2, y + c.dy + o.border / 2, c.dw - o.border, c.dh - o.border, Math.max(0, r - o.border / 2)); ctx.lineWidth = o.border; ctx.strokeStyle = o.borderColor || "rgba(255,255,255,0.6)"; ctx.stroke(); }
      ctx.restore();
      var f = F.faceAt(o.t), fw = im ? im.width : F.w, fh = im ? im.height : F.h, k = c.dw / c.sw;
      return { x: x + c.dx + ((f.x - f.w / 2) * fw - c.sx) * k, y: y + c.dy + ((f.y - f.h / 2) * fh - c.sy) * k, w: f.w * fw * k, h: f.h * fh * k };
    };
    F.full = function (ctx, o) { return F.draw(ctx, 0, 0, K.W, K.H, o); };
    K.footage = F;
    return F;
  };

  if (typeof window !== "undefined") window.K = K;
  if (typeof module !== "undefined" && module.exports) module.exports = K;
  return K;
})();
