// «Claude Code» — the COMPUTE page: where a program Claude wrote for a task runs (a colour grade, a cut of the timeline).
// The same idea as «مختبر الموشن» (src/lib/editor/scene/runtime.ts), but for programs that compute instead of drawing:
// a sandboxed iframe (scripts only, no same-origin, a content policy that blocks every request) with a small kit, frozen
// clocks and seeded randomness, so a program gives the same answer every time. Three kinds of program:
//   grade(c, K) → [r, g, b]       a colour grade as a function of one colour; the page samples it into a 3D LUT
//   edit(T, K)  → [command, …]    the timeline's edit, computed from the facts of the timeline (clips, words, silences)
//   clean(A, K) → Float32Array    a voice recording cleaned (silences cut, hum and rumble out, level evened, peaks held)
//   layout(D, K) → [op, …]        «زهراء فوتو ماستر»'s design: layers placed, photos arranged, words written and changed
// Pure strings and checks (no DOM here); the host is src/components/claude-code/compute-host.ts.

export const PROGRAM_MAX = 60_000;
/** The LUT edge a grade program is sampled at (25³: smooth enough for any grade, small enough to keep in the timeline). */
export const GRADE_LUT_SIZE = 25;

export type ProgramKind = "grade" | "edit" | "clean" | "layout";

/** Things a program must never contain (the page blocks them anyway; this tells Claude before it runs). */
const FORBIDDEN: [RegExp, string][] = [
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, "network access"],
  [/\bimport\s*\(|\brequire\s*\(|\bimportScripts\b/, "loading code"],
  [/\beval\s*\(|new\s+Function\b|\bFunction\s*\(/, "evaluating strings"],
  [/\bdocument\.|\bwindow\.|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/, "the page or its storage"],
  [/\b(parent|top|opener)\s*\.|\bpostMessage\s*\(/, "other windows"],
  [/\bWorker\s*\(|SharedArrayBuffer|\bnavigator\./, "workers or the device"],
  [/Math\.random\s*\(|Date\.now|new\s+Date\s*\(|performance\.now|setTimeout|setInterval/, "clocks or unseeded randomness (use K.rng)"],
];

const ENTRY: Record<ProgramKind, RegExp> = { grade: /\bfunction\s+grade\s*\(|\bgrade\s*=\s*(\(|function)/, edit: /\bfunction\s+edit\s*\(|\bedit\s*=\s*(\(|function)/, clean: /\bfunction\s+clean\s*\(|\bclean\s*=\s*(\(|function)/, layout: /\bfunction\s+layout\s*\(|\blayout\s*=\s*(\(|function)/ };
const SIGNATURE: Record<ProgramKind, string> = { grade: "function grade(c, K)", edit: "function edit(T, K)", clean: "function clean(A, K)", layout: "function layout(D, K)" };

/** The program as it will run, and what is wrong with it before it ever runs. */
export function checkProgram(kind: ProgramKind, code: unknown): { ok: boolean; problems: string[]; code: string } {
  const s = typeof code === "string" ? code.replace(/^```[a-z]*\n?|```\s*$/g, "").trim() : "";
  const problems: string[] = [];
  if (!s) problems.push("the program is empty");
  if (s.length > PROGRAM_MAX) problems.push(`the program is longer than ${PROGRAM_MAX} characters`);
  if (s && !ENTRY[kind].test(s)) problems.push(`the program never defines ${SIGNATURE[kind]}`);
  for (const [re, why] of FORBIDDEN) if (re.test(s)) problems.push(`it uses ${why}`);
  if (/<\/?script/i.test(s)) problems.push("it contains a script tag");
  return { ok: !problems.length, problems, code: s };
}

/** What the page may load: its own inline scripts. Nothing else, ever. */
export const COMPUTE_CSP = ["default-src 'none'", "script-src 'unsafe-inline' 'unsafe-eval'", "style-src 'unsafe-inline'", "img-src 'none'", "connect-src 'none'", "frame-src 'none'", "worker-src 'none'", "form-action 'none'", "base-uri 'none'"].join("; ");

/** The kit, as Claude is told it (the same names the page gives the program as K). */
export const GRADE_KIT_API = `THE GRADE KIT (K) — colours are display-referred Rec.709, every channel 0…1; c is { r, g, b }:
K.clamp(x, lo=0, hi=1) · K.mix(a, b, t) · K.smoothstep(e0, e1, x) · K.pow(x, p) (safe for x ≤ 0)
K.luma(c) → Rec.709 luminance · K.rgb(r, g, b) → { r, g, b } · K.lerpColor(c1, c2, t)
K.toHsl(c) → { h: 0…360, s, l } · K.fromHsl({ h, s, l }) → c · K.toHsv(c) / K.fromHsv({ h, s, v })
K.curve(points) → f(x): a smooth monotone curve through [[x, y], …] (0…1), e.g. K.curve([[0, 0.03], [0.25, 0.2], [0.75, 0.82], [1, 0.97]])
K.contrast(x, amount, pivot = 0.45) → contrast around the pivot (amount 1 = none, 1.2 = more)
K.filmic(x, shoulder = 0.85) → a soft film shoulder that rolls highlights off instead of clipping
K.saturate(c, s) → saturation around luma (1 = none, 0 = grey) · K.vibrance(c, v) → saturation that spares already-saturated colours and skin
K.temperature(c, t) → warmer (t > 0) or cooler (t < 0), −1…1, luma kept · K.tint(c, t) → magenta (t > 0) / green (t < 0)
K.wheels(c, { lift: [r, g, b], gamma: [r, g, b], gain: [r, g, b] }) → the colourist's three wheels (lift adds in the shadows, gamma bends the mids, gain multiplies the highlights; neutral = [0,0,0], [1,1,1], [1,1,1])
K.splitTone(c, { shadow: hue°, shadowAmt, high: hue°, highAmt, balance: −1…1 })
K.hueWeight(c, centre°, width°) → 0…1 how much c sits in that hue band (soft edges; for one-colour changes)
K.skin(c) → 0…1 how much c looks like skin (protect it: mix the graded colour back toward the original by it)
K.shadowsMask(c) / K.midsMask(c) / K.highsMask(c) → 0…1 soft tonal ranges by luma
K.rng(seed) → a seeded random() (rarely needed in a grade)`;

export const EDIT_KIT_API = `THE EDIT KIT (K) — times are whole milliseconds on the timeline:
K.merge(ranges, gapMs = 0) → [[a, b], …] sorted, overlapping or nearer than gapMs joined
K.pad(ranges, beforeMs, afterMs) → each range shrunk (negative numbers grow it) and dropped if empty
K.invert(ranges, from, to) → the parts of [from, to] not covered by ranges
K.total(ranges) → the summed length · K.inside(t, ranges) → true when t is in one of them
K.words(T) → every spoken word or phrase on the timeline as { clipId, s, e, w } (from T.speech), in time order
K.clipsOf(T, kind) → the clips of every track of that kind ("video" | "audio" | "text"), with their trackId, in time order
K.main(T) → the main video track (the first video track) · K.find(T, clipId) → { clip, track } or null
K.sortBy(list, key) · K.sum(list, f) · K.round(x)`;

export const AUDIO_KIT_API = `THE AUDIO KIT (K.A) — s is a Float32Array of mono samples −1…1, rate the sample rate (Hz); times in ms; every function returns a NEW Float32Array (or the numbers asked for) and never changes s:
K.A.db(x) / K.A.fromDb(db) · K.A.peakDb(s) · K.A.rmsDb(s)
K.A.frames(s, rate, ms = 20) → the level of each frame in dB (an Array)
K.A.noiseFloorDb(s, rate) → the level of the quietest 10% of frames (the room and the hiss)
K.A.speechDb(s, rate) → the average level of the frames that are clearly speech
K.A.silences(s, rate, { threshDb, minMs }) → [[fromMs, toMs], …] the stretches quieter than threshDb for at least minMs (threshDb: about noiseFloor + 6…10)
K.A.keep(s, rate, rangesMs, fadeMs = 8) → only those stretches, joined with short crossfades (no clicks)
K.A.removeSilences(s, rate, { threshDb, minMs = 450, keepMs = 180 }) → long pauses shortened to keepMs of air (never cutting into a word)
K.A.trim(s, rate, { threshDb, padMs = 150 }) → the silence before the first word and after the last cut, padMs kept
K.A.dc(s) → the DC offset removed
K.A.highpass(s, rate, hz = 80) / K.A.lowpass(s, rate, hz) → 2nd-order filters (rumble, plosive thumps / hiss above the voice)
K.A.notch(s, rate, hz, q = 30) · K.A.humHz(s, rate) → 50, 60 or 0 (mains hum found) · K.A.dehum(s, rate, hz, harmonics = 4)
K.A.gate(s, rate, { threshDb, floorDb = -18, attackMs = 5, releaseMs = 120 }) → a gentle downward expander between words (floorDb = how far the room goes down; never mute fully)
K.A.compress(s, rate, { threshDb = -24, ratio = 2.5, attackMs = 10, releaseMs = 120, makeupDb = 0 })
K.A.normalizeSpeech(s, rate, targetDb = -20) → the speech frames brought to targetDb RMS
K.A.limit(s, ceilingDb = -1.5) → peaks held under the ceiling (soft, no hard clipping)
K.A.fade(s, rate, inMs = 10, outMs = 30)`;

export const LAYOUT_KIT_API = `THE LAYOUT KIT (K) — every position and size is a PERCENT of the canvas (x, y = a layer's centre; w, h = its width and height; a text's size = % of the canvas height), exactly like the editor's commands:
K.layersOf(D, kind) → the layers of that kind ("text" | "image" | "shape"), in stacking order (first = bottom) · K.layer(D, id) → a layer or null
K.fit(iw, ih, bw, bh, mode = "cover") → { w, h } an iw×ih picture scaled into a bw×bh box ("cover" fills it, "contain" fits inside) — pixels in, pixels out
K.pct(px, D, axis) → pixels as a percent of the canvas ("x" = of its width, "y" = of its height) · K.px(pct, D, axis) → the other way
K.imageW(file, hPct, D) → the width (%) a picture of that file takes when its height is hPct (%), keeping its shape
K.grid(n, cols, area, gap = 0) → n boxes { x, y, w, h } (centres, %) filling area { x, y, w, h } (its top-left corner and size, %), row by row
K.textW(text, sizePct, D) → about how wide (%) one line of that Arabic text is at that size · K.lines(text, sizePct, maxW, D) → the text broken into lines that fit maxW (%)
K.round(x, d = 0) → x rounded to d decimals · K.clamp(x, lo, hi) · K.sortBy(list, key) · K.sum(list, f)`;

/** The kit's code inside the page (plain JS). */
const KIT_JS = String.raw`
var K = (function () {
  var K = {};
  K.clamp = function (x, lo, hi) { lo = lo === undefined ? 0 : lo; hi = hi === undefined ? 1 : hi; return x < lo ? lo : x > hi ? hi : x; };
  K.mix = function (a, b, t) { return a + (b - a) * t; };
  K.smoothstep = function (e0, e1, x) { var t = K.clamp((x - e0) / (e1 - e0 || 1e-6)); return t * t * (3 - 2 * t); };
  K.pow = function (x, p) { return x <= 0 ? 0 : Math.pow(x, p); };
  K.rgb = function (r, g, b) { return { r: r, g: g, b: b }; };
  K.luma = function (c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
  K.lerpColor = function (a, b, t) { return { r: K.mix(a.r, b.r, t), g: K.mix(a.g, b.g, t), b: K.mix(a.b, b.b, t) }; };
  K.toHsl = function (c) {
    var r = c.r, g = c.g, b = c.b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d > 1e-6) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return { h: h, s: s, l: l };
  };
  K.fromHsl = function (o) {
    var h = (((o.h % 360) + 360) % 360) / 360, s = K.clamp(o.s), l = K.clamp(o.l);
    if (s < 1e-6) return { r: l, g: l, b: l };
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    var f = function (t) { t = t < 0 ? t + 1 : t > 1 ? t - 1 : t; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return { r: f(h + 1 / 3), g: f(h), b: f(h - 1 / 3) };
  };
  K.toHsv = function (c) { var mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), d = mx - mn, h = K.toHsl(c).h; return { h: h, s: mx > 1e-6 ? d / mx : 0, v: mx }; };
  K.fromHsv = function (o) { var v = K.clamp(o.v), s = K.clamp(o.s), l = v * (1 - s / 2), sl = l > 1e-6 && l < 1 - 1e-6 ? (v - l) / Math.min(l, 1 - l) : 0; return K.fromHsl({ h: o.h, s: sl, l: l }); };
  K.curve = function (pts) {
    var p = (pts || []).map(function (q) { return [K.clamp(+q[0]), K.clamp(+q[1])]; }).sort(function (a, b) { return a[0] - b[0]; });
    if (!p.length || p[0][0] > 0) p.unshift([0, 0]);
    if (p[p.length - 1][0] < 1) p.push([1, 1]);
    var n = p.length, d = [], m = [];
    for (var i = 0; i < n - 1; i++) d.push((p[i + 1][1] - p[i][1]) / ((p[i + 1][0] - p[i][0]) || 1e-6));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (var j = 1; j < n - 1; j++) m[j] = d[j - 1] * d[j] <= 0 ? 0 : (d[j - 1] + d[j]) / 2;
    for (var k = 0; k < n - 1; k++) { if (Math.abs(d[k]) < 1e-9) { m[k] = m[k + 1] = 0; continue; } var a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b; if (s > 9) { var t = 3 / Math.sqrt(s); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; } }
    return function (x) {
      x = K.clamp(x); var i = 0; while (i < n - 2 && x > p[i + 1][0]) i++;
      var h = (p[i + 1][0] - p[i][0]) || 1e-6, t = (x - p[i][0]) / h, t2 = t * t, t3 = t2 * t;
      return K.clamp((2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h * m[i + 1]);
    };
  };
  K.contrast = function (x, amount, pivot) { pivot = pivot === undefined ? 0.45 : pivot; return K.clamp(pivot + (x - pivot) * amount); };
  K.filmic = function (x, sh) { sh = sh === undefined ? 0.85 : sh; if (x <= sh) return x; var r = 1 - sh; return sh + r * (1 - Math.exp(-(x - sh) / r)); };
  K.saturate = function (c, s) { var y = K.luma(c); return { r: y + (c.r - y) * s, g: y + (c.g - y) * s, b: y + (c.b - y) * s }; };
  K.skin = function (c) { var o = K.toHsl(c), d = Math.abs(((o.h - 25 + 540) % 360) - 180); return K.clamp((1 - K.smoothstep(15, 32, d)) * K.smoothstep(0.1, 0.22, o.s) * (1 - K.smoothstep(0.75, 0.92, o.s)) * K.smoothstep(0.1, 0.28, o.l) * (1 - K.smoothstep(0.85, 0.97, o.l))); };
  K.vibrance = function (c, v) { var o = K.toHsl(c), w = (1 - o.s) * (1 - 0.7 * K.skin(c)); return K.saturate(c, 1 + (v - 1) * w); };
  K.temperature = function (c, t) { var y = K.luma(c), o = { r: c.r * (1 + 0.12 * t), g: c.g * (1 + 0.02 * t), b: c.b * (1 - 0.14 * t) }, y2 = K.luma(o) || 1e-6, k = y / y2; return { r: o.r * k, g: o.g * k, b: o.b * k }; };
  K.tint = function (c, t) { var y = K.luma(c), o = { r: c.r * (1 + 0.05 * t), g: c.g * (1 - 0.08 * t), b: c.b * (1 + 0.05 * t) }, y2 = K.luma(o) || 1e-6, k = y / y2; return { r: o.r * k, g: o.g * k, b: o.b * k }; };
  K.wheels = function (c, w) {
    var lift = (w && w.lift) || [0, 0, 0], gamma = (w && w.gamma) || [1, 1, 1], gain = (w && w.gain) || [1, 1, 1];
    var f = function (x, i) { var y = x * gain[i] + lift[i] * (1 - x); return K.pow(K.clamp(y, 0, 4), 1 / Math.max(0.05, gamma[i])); };
    return { r: f(c.r, 0), g: f(c.g, 1), b: f(c.b, 2) };
  };
  K.shadowsMask = function (c) { return 1 - K.smoothstep(0.05, 0.45, K.luma(c)); };
  K.highsMask = function (c) { return K.smoothstep(0.5, 0.95, K.luma(c)); };
  K.midsMask = function (c) { return K.clamp(1 - K.shadowsMask(c) - K.highsMask(c)); };
  K.splitTone = function (c, o) {
    o = o || {}; var bal = K.clamp(((o.balance || 0) + 1) / 2), y = K.luma(c);
    var tone = function (hue, amt, w) { var t = K.fromHsl({ h: hue || 0, s: 1, l: 0.5 }); return { r: (t.r - 0.5) * amt * w, g: (t.g - 0.5) * amt * w, b: (t.b - 0.5) * amt * w }; };
    var ws = (1 - K.smoothstep(0, 0.4 + 0.4 * bal, y)) * 0.25, wh = K.smoothstep(0.2 + 0.4 * bal, 1, y) * 0.25;
    var s = tone(o.shadow, o.shadowAmt || 0, ws), h = tone(o.high, o.highAmt || 0, wh);
    return { r: c.r + s.r + h.r, g: c.g + s.g + h.g, b: c.b + s.b + h.b };
  };
  K.hueWeight = function (c, centre, width) { var o = K.toHsl(c), d = Math.abs((((o.h - centre) % 360) + 540) % 360 - 180); return (1 - K.smoothstep(width * 0.5, width, d)) * K.smoothstep(0.05, 0.2, o.s); };
  K.rng = function (seed) { var a = seed >>> 0 || 1; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // ── edit ──
  K.round = function (x, d) { var m = Math.pow(10, d === undefined ? 0 : d); return Math.round(x * m) / m; };
  K.sortBy = function (list, key) { var f = typeof key === "function" ? key : function (o) { return o[key]; }; return list.slice().sort(function (a, b) { return f(a) - f(b); }); };
  K.sum = function (list, f) { var s = 0; for (var i = 0; i < list.length; i++) s += f ? f(list[i]) : list[i]; return s; };
  K.merge = function (ranges, gap) { gap = gap || 0; var r = (ranges || []).map(function (x) { return [Math.round(Math.min(x[0], x[1])), Math.round(Math.max(x[0], x[1]))]; }).filter(function (x) { return x[1] > x[0]; }).sort(function (a, b) { return a[0] - b[0]; }), out = []; for (var i = 0; i < r.length; i++) { var l = out[out.length - 1]; if (l && r[i][0] - l[1] <= gap) l[1] = Math.max(l[1], r[i][1]); else out.push(r[i].slice()); } return out; };
  K.pad = function (ranges, before, after) { return (ranges || []).map(function (x) { return [Math.round(x[0] + before), Math.round(x[1] - after)]; }).filter(function (x) { return x[1] > x[0]; }); };
  K.invert = function (ranges, from, to) { var m = K.merge(ranges), out = [], t = from; for (var i = 0; i < m.length; i++) { if (m[i][1] <= from || m[i][0] >= to) continue; if (m[i][0] > t) out.push([t, m[i][0]]); t = Math.max(t, m[i][1]); } if (t < to) out.push([t, to]); return out; };
  K.total = function (ranges) { return K.sum(ranges || [], function (x) { return Math.max(0, x[1] - x[0]); }); };
  K.inside = function (t, ranges) { for (var i = 0; i < (ranges || []).length; i++) if (t >= ranges[i][0] && t < ranges[i][1]) return true; return false; };
  K.words = function (T) { var out = []; (T.speech || []).forEach(function (s) { (s.phrases || []).forEach(function (p) { out.push({ clipId: s.clipId, s: p[0], e: p[1], w: p[2] }); }); }); return K.sortBy(out, "s"); };
  K.clipsOf = function (T, kind) { var out = []; (T.tracks || []).forEach(function (t) { if (!kind || t.kind === kind) t.clips.forEach(function (c) { var o = {}; for (var k in c) o[k] = c[k]; o.trackId = t.id; out.push(o); }); }); return K.sortBy(out, "start"); };
  K.main = function (T) { return (T.tracks || []).find(function (t) { return t.kind === "video"; }) || null; };
  // ── layout (percent of the canvas, like the photo editor's commands) ──
  K.layersOf = function (D, kind) { return (D.layers || []).filter(function (l) { return !kind || l.kind === kind; }); };
  K.layer = function (D, id) { return (D.layers || []).find(function (l) { return l.id === id; }) || null; };
  K.fit = function (iw, ih, bw, bh, mode) { var s = (mode === "contain" ? Math.min : Math.max)(bw / iw, bh / ih); return { w: iw * s, h: ih * s }; };
  K.pct = function (px, D, axis) { return (px / (axis === "y" ? D.height : D.width)) * 100; };
  K.px = function (p, D, axis) { return (p / 100) * (axis === "y" ? D.height : D.width); };
  K.imageW = function (file, hPct, D) { var f = typeof file === "string" ? (D.files || []).find(function (x) { return x.id === file; }) : file; if (!f) throw new Error("no file " + file); return ((hPct / 100) * D.height * (f.w / f.h) / D.width) * 100; };
  K.grid = function (n, cols, area, gap) { gap = gap || 0; cols = Math.max(1, cols); var rows = Math.max(1, Math.ceil(n / cols)), w = (area.w - gap * (cols - 1)) / cols, h = (area.h - gap * (rows - 1)) / rows, out = []; for (var i = 0; i < n; i++) { var r = Math.floor(i / cols), c = i % cols; out.push({ x: area.x + c * (w + gap) + w / 2, y: area.y + r * (h + gap) + h / 2, w: w, h: h }); } return out; };
  K.textW = function (text, size, D) { return (String(text).length * 0.5 * (size / 100) * D.height / D.width) * 100; };
  K.lines = function (text, size, maxW, D) { var words = String(text).split(/\s+/), out = [], cur = ""; words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (cur && K.textW(t, size, D) > maxW) { out.push(cur); cur = w; } else cur = t; }); if (cur) out.push(cur); return out; };
  // ── audio ──
  var A = {};
  A.db = function (x) { return x > 1e-9 ? 20 * Math.log10(x) : -180; };
  A.fromDb = function (d) { return Math.pow(10, d / 20); };
  A.peakDb = function (s) { var m = 0; for (var i = 0; i < s.length; i++) { var v = s[i] < 0 ? -s[i] : s[i]; if (v > m) m = v; } return A.db(m); };
  A.rmsDb = function (s) { var e = 0; for (var i = 0; i < s.length; i++) e += s[i] * s[i]; return A.db(Math.sqrt(e / Math.max(1, s.length))); };
  A.frames = function (s, rate, ms) { var n = Math.max(1, Math.round(rate * (ms || 20) / 1000)), out = []; for (var i = 0; i < s.length; i += n) { var e = 0, m = Math.min(s.length, i + n); for (var j = i; j < m; j++) e += s[j] * s[j]; out.push(A.db(Math.sqrt(e / Math.max(1, m - i)))); } return out; };
  var pct = function (arr, p) { var a = arr.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : -180; };
  A.noiseFloorDb = function (s, rate) { return pct(A.frames(s, rate, 20), 0.1); };
  A.speechDb = function (s, rate) { var f = A.frames(s, rate, 20), floor = pct(f, 0.1), loud = f.filter(function (d) { return d > floor + 15; }); if (!loud.length) return pct(f, 0.9); var e = 0; loud.forEach(function (d) { e += Math.pow(10, d / 10); }); return 10 * Math.log10(e / loud.length); };
  A.silences = function (s, rate, o) {
    o = o || {}; var ms = 10, f = A.frames(s, rate, ms), th = o.threshDb === undefined ? A.noiseFloorDb(s, rate) + 8 : o.threshDb, min = o.minMs === undefined ? 300 : o.minMs, out = [], st = -1;
    for (var i = 0; i <= f.length; i++) { var q = i < f.length && f[i] < th; if (q && st < 0) st = i; if (!q && st >= 0) { if ((i - st) * ms >= min) out.push([st * ms, Math.min(i * ms, Math.round(s.length / rate * 1000))]); st = -1; } }
    return out;
  };
  A.keep = function (s, rate, ranges, fadeMs) {
    var fade = Math.max(1, Math.round(rate * (fadeMs === undefined ? 8 : fadeMs) / 1000)), parts = K.merge(ranges || []).map(function (r) { return [Math.max(0, Math.round(r[0] * rate / 1000)), Math.min(s.length, Math.round(r[1] * rate / 1000))]; }).filter(function (r) { return r[1] > r[0]; });
    var total = 0; parts.forEach(function (r) { total += r[1] - r[0]; }); var out = new Float32Array(total), o = 0;
    parts.forEach(function (r) { var n = r[1] - r[0], f = Math.min(fade, Math.floor(n / 2)); for (var i = 0; i < n; i++) { var g = i < f ? i / f : i > n - f ? (n - i) / f : 1; out[o + i] = s[r[0] + i] * g; } o += n; });
    return out;
  };
  A.removeSilences = function (s, rate, o) {
    o = o || {}; var keepMs = o.keepMs === undefined ? 180 : o.keepMs, half = keepMs / 2, dur = s.length / rate * 1000;
    var sil = A.silences(s, rate, { threshDb: o.threshDb, minMs: o.minMs === undefined ? 450 : o.minMs }), cut = sil.map(function (r) { return [r[0] + half, r[1] - half]; }).filter(function (r) { return r[1] > r[0]; });
    return A.keep(s, rate, K.invert(cut, 0, dur), 6);
  };
  A.trim = function (s, rate, o) {
    o = o || {}; var th = o.threshDb === undefined ? A.noiseFloorDb(s, rate) + 10 : o.threshDb, pad = o.padMs === undefined ? 150 : o.padMs, f = A.frames(s, rate, 10), a = 0, b = f.length - 1;
    while (a < f.length && f[a] < th) a++; while (b > a && f[b] < th) b--;
    if (a >= f.length) return new Float32Array(s);
    return A.keep(s, rate, [[Math.max(0, a * 10 - pad), Math.min(s.length / rate * 1000, (b + 1) * 10 + pad)]], 4);
  };
  A.dc = function (s) { var m = 0, i; for (i = 0; i < s.length; i++) m += s[i]; m /= Math.max(1, s.length); var out = new Float32Array(s.length); for (i = 0; i < s.length; i++) out[i] = s[i] - m; return out; };
  var biquad = function (s, c) { var out = new Float32Array(s.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (var i = 0; i < s.length; i++) { var x = s[i], y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y; } return out; };
  var coef = function (type, rate, hz, q) {
    var w = 2 * Math.PI * Math.min(hz, rate * 0.45) / rate, cs = Math.cos(w), al = Math.sin(w) / (2 * (q || Math.SQRT1_2)), b0, b1, b2, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === "hp") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; } else if (type === "lp") { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; } else { b0 = 1; b1 = -2 * cs; b2 = 1; }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  };
  A.highpass = function (s, rate, hz) { return biquad(s, coef("hp", rate, hz || 80)); };
  A.lowpass = function (s, rate, hz) { return biquad(s, coef("lp", rate, hz || 12000)); };
  A.notch = function (s, rate, hz, q) { return biquad(s, coef("notch", rate, hz, q || 30)); };
  var goertzel = function (s, rate, hz) { var n = Math.min(s.length, rate * 8), k = 2 * Math.cos(2 * Math.PI * hz / rate), a = 0, b = 0; for (var i = 0; i < n; i++) { var c = s[i] + k * a - b; b = a; a = c; } return (a * a + b * b - k * a * b) / Math.max(1, n); };
  A.humHz = function (s, rate) {
    var e = function (hz) { return goertzel(s, rate, hz); }, ref = (e(70) + e(85) + e(40)) / 3 || 1e-12, h50 = e(50) + e(100) + e(150), h60 = e(60) + e(120) + e(180);
    return h50 > h60 && h50 > ref * 30 ? 50 : h60 > ref * 30 ? 60 : 0;
  };
  A.dehum = function (s, rate, hz, harmonics) { var out = s; for (var k = 1; k <= (harmonics || 4); k++) out = A.notch(out, rate, hz * k, 30); return out; };
  var follower = function (s, rate, attackMs, releaseMs) { var at = Math.exp(-1 / (rate * attackMs / 1000)), rl = Math.exp(-1 / (rate * releaseMs / 1000)), env = 0, out = new Float32Array(s.length); for (var i = 0; i < s.length; i++) { var v = s[i] < 0 ? -s[i] : s[i]; env = v > env ? at * env + (1 - at) * v : rl * env + (1 - rl) * v; out[i] = env; } return out; };
  A.gate = function (s, rate, o) {
    o = o || {}; var th = o.threshDb === undefined ? A.noiseFloorDb(s, rate) + 8 : o.threshDb, floor = A.fromDb(o.floorDb === undefined ? -18 : Math.max(-40, o.floorDb)), env = follower(s, rate, o.attackMs || 5, o.releaseMs || 120), out = new Float32Array(s.length), g = 1, sm = Math.exp(-1 / (rate * 0.01));
    for (var i = 0; i < s.length; i++) { var d = A.db(env[i]), want = d >= th ? 1 : Math.max(floor, A.fromDb((d - th) * 1.5)); g = sm * g + (1 - sm) * want; out[i] = s[i] * g; }
    return out;
  };
  A.compress = function (s, rate, o) {
    o = o || {}; var th = o.threshDb === undefined ? -24 : o.threshDb, ratio = Math.max(1, o.ratio || 2.5), mk = A.fromDb(o.makeupDb || 0), env = follower(s, rate, o.attackMs || 10, o.releaseMs || 120), out = new Float32Array(s.length);
    for (var i = 0; i < s.length; i++) { var d = A.db(env[i]), red = d > th ? (d - th) * (1 - 1 / ratio) : 0; out[i] = s[i] * A.fromDb(-red) * mk; }
    return out;
  };
  A.normalizeSpeech = function (s, rate, target) { var g = A.fromDb((target === undefined ? -20 : target) - A.speechDb(s, rate)), out = new Float32Array(s.length); for (var i = 0; i < s.length; i++) out[i] = s[i] * g; return out; };
  A.limit = function (s, ceilingDb) { var c = A.fromDb(ceilingDb === undefined ? -1.5 : ceilingDb), knee = c * 0.8, out = new Float32Array(s.length); for (var i = 0; i < s.length; i++) { var v = s[i], a = v < 0 ? -v : v; if (a > knee) { var over = (a - knee) / (c - knee + 1e-9); a = knee + (c - knee) * Math.tanh(over); } out[i] = v < 0 ? -a : a; } return out; };
  A.fade = function (s, rate, inMs, outMs) { var out = new Float32Array(s), a = Math.round(rate * (inMs === undefined ? 10 : inMs) / 1000), b = Math.round(rate * (outMs === undefined ? 30 : outMs) / 1000); for (var i = 0; i < a && i < out.length; i++) out[i] *= i / a; for (var j = 0; j < b && j < out.length; j++) out[out.length - 1 - j] *= j / b; return out; };
  K.A = A;
  K.find = function (T, id) { var tr = T.tracks || []; for (var i = 0; i < tr.length; i++) for (var j = 0; j < tr[i].clips.length; j++) if (tr[i].clips[j].id === id) return { clip: tr[i].clips[j], track: tr[i] }; return null; };
  return K;
})();
`;

/** The runtime inside the page: run → result | error. */
const RUNTIME_JS = String.raw`
(function () {
  "use strict";
  var post = function (m, transfer) { parent.postMessage(m, "*", transfer || []); };
  var seeded = K.rng(20261015);
  Math.random = function () { return seeded(); };
  Date.now = function () { return 0; };
  try { performance.now = function () { return 0; }; } catch (e) {}
  window.setTimeout = window.setInterval = function () { return 0; };
  function entry(code, name) { return new Function("K", code + "\n;return typeof " + name + " === 'function' ? " + name + " : null;")(K); }
  function asColour(v) { if (Array.isArray(v)) return v; if (v && typeof v === "object") return [v.r, v.g, v.b]; return null; }
  function runGrade(m) {
    var fn = entry(m.code, "grade"); if (!fn) throw new Error("the program must define function grade(c, K)");
    var n = m.size, out = new Uint8Array(n * n * n * 3), bad = 0, first = "";
    for (var b = 0; b < n; b++) for (var g = 0; g < n; g++) for (var r = 0; r < n; r++) {
      var v = asColour(fn({ r: r / (n - 1), g: g / (n - 1), b: b / (n - 1) }, K)), i = ((b * n + g) * n + r) * 3;
      for (var k = 0; k < 3; k++) {
        var x = v ? Number(v[k]) : NaN;
        if (!isFinite(x)) { bad++; if (!first) first = "grade(" + [r, g, b].map(function (q) { return (q / (n - 1)).toFixed(2); }).join(", ") + ") gave " + JSON.stringify(v); x = 0; }
        out[i + k] = Math.round(K.clamp(x) * 255);
      }
    }
    if (bad) throw new Error(bad + " colour values were not numbers; the first: " + first);
    post({ type: "result", id: m.id, lut: out }, [out.buffer]);
  }
  function runEdit(m) {
    var fn = entry(m.code, "edit"); if (!fn) throw new Error("the program must define function edit(T, K)");
    var cmds = fn(JSON.parse(JSON.stringify(m.input)), K);
    if (!Array.isArray(cmds)) throw new Error("edit(T, K) must return an array of commands, it returned " + typeof cmds);
    post({ type: "result", id: m.id, commands: JSON.parse(JSON.stringify(cmds)) });
  }
  function runLayout(m) {
    var fn = entry(m.code, "layout"); if (!fn) throw new Error("the program must define function layout(D, K)");
    var ops = fn(JSON.parse(JSON.stringify(m.input)), K);
    if (!Array.isArray(ops)) throw new Error("layout(D, K) must return an array of commands, it returned " + typeof ops);
    post({ type: "result", id: m.id, commands: JSON.parse(JSON.stringify(ops)) });
  }
  function runClean(m) {
    var fn = entry(m.code, "clean"); if (!fn) throw new Error("the program must define function clean(A, K)");
    var src = new Float32Array(m.samples), v = fn({ rate: m.rate, samples: src, seconds: src.length / m.rate }, K);
    var out = v instanceof Float32Array ? v : v && v.samples instanceof Float32Array ? v.samples : Array.isArray(v) ? new Float32Array(v) : null;
    if (!out) throw new Error("clean(A, K) must return a Float32Array of samples");
    if (out.length < m.rate * 0.5) throw new Error("clean(A, K) returned less than half a second (" + (out.length / m.rate).toFixed(2) + " s)");
    for (var i = 0; i < out.length; i++) { var x = out[i]; if (!isFinite(x)) throw new Error("sample " + i + " is not a number"); out[i] = x > 1 ? 1 : x < -1 ? -1 : x; }
    var copy = new Float32Array(out);
    post({ type: "result", id: m.id, samples: copy }, [copy.buffer]);
  }
  window.addEventListener("message", function (e) {
    if (e.source !== parent) return;
    var m = e.data || {};
    if (m.type !== "run") return;
    try { if (m.kind === "grade") runGrade(m); else if (m.kind === "edit") runEdit(m); else if (m.kind === "clean") runClean(m); else if (m.kind === "layout") runLayout(m); else throw new Error("unknown program kind"); }
    catch (err) { post({ type: "error", id: m.id, message: String((err && err.message) || err), stack: String((err && err.stack) || "").split("\n").slice(0, 4).join("\n") }); }
  });
  post({ type: "boot" });
})();
`;

/** The whole compute page, for an iframe's srcdoc. */
export function computeDoc(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${COMPUTE_CSP}"></head><body><script>${KIT_JS}</script><script>${RUNTIME_JS}</script></body></html>`;
}

/** For tests (Node): the kit's source, to run it outside a page. */
export const COMPUTE_KIT_JS = KIT_JS;
