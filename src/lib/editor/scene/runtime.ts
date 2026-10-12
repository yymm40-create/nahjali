// «مختبر الموشن» — the scene PAGE: a sandboxed iframe (scripts only, no same-origin: it cannot read the site, the
// person's cookies or storage) with a strict content policy (no network but the pinned three.js and the fonts' CDN),
// the kit, and a small runtime that loads حيدرة's scene and draws any frame on request. A frame depends only on its
// time; Math.random and the clocks are replaced by seeded, frozen ones so a preview frame is the final frame.
// Motion blur: the frame is the average of sub-frames across the shutter. Pure strings (no DOM here).

import { SCENE_KIT_JS } from "./kit";

export const THREE_VERSION = "0.170.0";
export const THREE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
export const THREE_ADDONS = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/`;

/** What the page may load: inline scripts (the kit, the runtime), three.js and the fonts from jsDelivr. Nothing else. */
export const SCENE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data: blob: https://cdn.jsdelivr.net",
  "connect-src https://cdn.jsdelivr.net",
  "media-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/** The runtime inside the page (plain JS). Messages: load → ready | error; frame → frame | error. */
export const SCENE_RUNTIME_JS = String.raw`
(function () {
  "use strict";
  var K = window.K, def = null, canvas = document.getElementById("c"), gl = document.getElementById("g"), ctx = canvas.getContext("2d", { willReadFrequently: true }), acc = null, accX = null;
  // every 2D surface is CPU-backed (willReadFrequently): frames are read back all the time (sub-frames, bloom, glass,
  // particles), the result is the same on every machine, and a GPU-backed canvas was seen to show an earlier frame
  var post = function (m, transfer) { parent.postMessage(m, "*", transfer || []); };
  // frozen clocks and seeded randomness: a frame depends only on its time
  var seeded = K.rng(20261012);
  Math.random = function () { return seeded(); };
  Date.now = function () { return 0; };
  try { performance.now = function () { return 0; }; } catch (e) {}
  window.requestAnimationFrame = function () { return 0; };
  window.setTimeout = window.setInterval = function () { return 0; };
  function scene(d) { def = d || {}; }
  function fail(where, e) { post({ type: "error", where: where, message: String((e && e.message) || e), stack: String((e && e.stack) || "").split("\n").slice(0, 4).join("\n") }); }
  function drawOnce(t) {
    // a full reset (state stack, clip, transform, pixels): nothing a frame left behind reaches the next one
    if (typeof ctx.reset === "function") ctx.reset(); else for (var guard = 0; guard < 64; guard++) ctx.restore();
    K.reset(ctx); ctx.clearRect(0, 0, K.W, K.H);
    if (def.background) { ctx.fillStyle = def.background; ctx.fillRect(0, 0, K.W, K.H); }
    def.draw(K, t, ctx);
  }
  async function load(m) {
    canvas.width = gl.width = m.w; canvas.height = gl.height = m.h;
    K.W = m.w; K.H = m.h; K.fps = m.fps || 30; K.ctx = ctx; K.canvas = canvas; K.glCanvas = gl; K.assets = {};
    for (var i = 0; i < (m.assets || []).length; i++) K.assets[m.assets[i].id] = m.assets[i].bitmap;
    K.fonts = {};
    var faces = (m.fonts || []).map(function (f) {
      K.fonts[f.role] = '"' + f.family + '"';
      return Promise.all(f.files.map(function (file) { return new FontFace(f.family, "url(" + file.url + ")", { weight: String(file.weight), unicodeRange: file.range || undefined }).load().then(function (face) { document.fonts.add(face); }).catch(function () {}); }));
    });
    await Promise.all(faces);
    if (!K.fonts.head) K.fonts.head = "sans-serif";
    if (!K.fonts.body) K.fonts.body = K.fonts.head;
    def = null;
    new Function("scene", "K", m.code)(scene, K);
    if (!def || typeof def.draw !== "function") throw new Error("the scene must call scene({ duration, draw(K, t, ctx) { … } })");
    if (def.three) { K.THREE = await import("three"); K.addon = function (p) { return import("three/addons/" + p); }; }
    if (typeof def.setup === "function") await def.setup(K, ctx);
    post({ type: "ready", duration: Number(def.duration) || 0, cues: Array.isArray(def.cues) ? def.cues : [], blur: Number(def.blur) || 0, bpm: Number(def.bpm) || 0, title: String(def.title || "") });
  }
  async function frame(m) {
    var n = Math.max(1, Math.min(8, Math.round(m.sub || 1))), shutter = Math.max(0, Math.min(1, def.blur === undefined ? (m.shutter || 0) : Number(def.blur))), out = canvas;
    if (n > 1 && shutter > 0) {
      if (!acc) { acc = new OffscreenCanvas(K.W, K.H); accX = acc.getContext("2d", { willReadFrequently: true }); }
      if (acc.width !== K.W || acc.height !== K.H) { acc.width = K.W; acc.height = K.H; }
      accX.globalCompositeOperation = "source-over"; accX.globalAlpha = 1; accX.clearRect(0, 0, K.W, K.H);
      for (var i = 0; i < n; i++) { drawOnce(m.t + ((i + 0.5) / n - 0.5) * shutter / (m.fps || 30)); accX.globalAlpha = 1 / (i + 1); accX.drawImage(canvas, 0, 0); }
      out = acc;
    } else drawOnce(m.t);
    var w = Math.max(1, Math.round(K.W * (m.scale || 1))), h = Math.max(1, Math.round(K.H * (m.scale || 1)));
    var bm = await createImageBitmap(out, w === K.W ? undefined : { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    post({ type: "frame", id: m.id, bitmap: bm }, [bm]);
  }
  window.addEventListener("message", function (e) {
    if (e.source !== parent) return;
    var m = e.data || {};
    if (m.type === "load") load(m).catch(function (err) { fail("load", err); });
    else if (m.type === "frame") { if (!def) return fail("frame", "not loaded"); frame(m).catch(function (err) { post({ type: "error", where: "frame", id: m.id, t: m.t, message: String((err && err.message) || err), stack: String((err && err.stack) || "").split("\n").slice(0, 4).join("\n") }); }); }
  });
  window.addEventListener("error", function (e) { fail("page", e.error || e.message); });
  post({ type: "boot" });
})();
`;

/** The whole scene page, for an iframe's srcdoc. */
export function sceneDoc(): string {
  const importMap = JSON.stringify({ imports: { three: THREE_URL, "three/addons/": THREE_ADDONS } });
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SCENE_CSP}"><script type="importmap">${importMap}</script><style>html,body{margin:0;background:transparent;overflow:hidden}canvas{position:absolute;left:0;top:0}</style></head><body><canvas id="c"></canvas><canvas id="g" style="visibility:hidden"></canvas><script>${SCENE_KIT_JS}</script><script>${SCENE_RUNTIME_JS}</script></body></html>`;
}
