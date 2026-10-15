// «Claude Code» — the COMPUTE page: where a program Claude wrote for a task runs (a colour grade, a cut of the timeline).
// The same idea as «مختبر الموشن» (src/lib/editor/scene/runtime.ts), but for programs that compute instead of drawing:
// a sandboxed iframe (scripts only, no same-origin, a content policy that blocks every request) with a small kit, frozen
// clocks and seeded randomness, so a program gives the same answer every time. Two kinds of program:
//   grade(c, K) → [r, g, b]       a colour grade as a function of one colour; the page samples it into a 3D LUT
//   edit(T, K)  → [command, …]    the timeline's edit, computed from the facts of the timeline (clips, words, silences)
// Pure strings and checks (no DOM here); the host is src/components/claude-code/compute-host.ts.

export const PROGRAM_MAX = 60_000;
/** The LUT edge a grade program is sampled at (25³: smooth enough for any grade, small enough to keep in the timeline). */
export const GRADE_LUT_SIZE = 25;

export type ProgramKind = "grade" | "edit";

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

const ENTRY: Record<ProgramKind, RegExp> = { grade: /\bfunction\s+grade\s*\(|\bgrade\s*=\s*(\(|function)/, edit: /\bfunction\s+edit\s*\(|\bedit\s*=\s*(\(|function)/ };

/** The program as it will run, and what is wrong with it before it ever runs. */
export function checkProgram(kind: ProgramKind, code: unknown): { ok: boolean; problems: string[]; code: string } {
  const s = typeof code === "string" ? code.replace(/^```[a-z]*\n?|```\s*$/g, "").trim() : "";
  const problems: string[] = [];
  if (!s) problems.push("the program is empty");
  if (s.length > PROGRAM_MAX) problems.push(`the program is longer than ${PROGRAM_MAX} characters`);
  if (s && !ENTRY[kind].test(s)) problems.push(`the program never defines ${kind === "grade" ? "function grade(c, K)" : "function edit(T, K)"}`);
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
  K.round = function (x) { return Math.round(x); };
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
  window.addEventListener("message", function (e) {
    if (e.source !== parent) return;
    var m = e.data || {};
    if (m.type !== "run") return;
    try { if (m.kind === "grade") runGrade(m); else if (m.kind === "edit") runEdit(m); else throw new Error("unknown program kind"); }
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
