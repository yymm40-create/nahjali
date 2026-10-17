/*! clips.js — generated footage inside a __seek page, frame-exact.
 *
 *  Why: headless Chromium has no H.264, and <video> seeking is not frame-deterministic. Footage enters the page as an
 *  image sequence extracted at the clip's NATIVE fps (scripts/extract.swift → <dir>/f_0000.jpg … + <dir>/_clip.json) and
 *  is drawn as an <img> (never a canvas: capture waits for <img> decode, not for canvas draws).
 *
 *  Rules this helper enforces
 *    · CLAMP, never loop: the index is clamped to [0, n−1] with n = the REAL frame count from _clip.json (a 5 s Seedance
 *      clip had 120 frames; asking for f_0120 threw inside __seek and killed the capture worker). Past the end the last
 *      frame holds; before the start the first frame holds.
 *    · HOLD under motion blur: capture.mjs --mb renders each output frame from sub-frames and sets window.__mbBase (the
 *      frame's own time) before each sub-frame. Footage already carries its own motion blur, so every sub-frame of one
 *      output frame shows the SAME source frame (the one at __mbBase) — no double blur, no ghosting.
 *    · Cover-crop around the subject: object-fit: cover + object-position at the subject's focus point [fx, fy].
 *    · Fallback chain: clip → still → ✦ GENERATION plate. A clip that is not registered yet (or has frames: 0) shows
 *      its still, else a labelled plate (console.info, not an error: drafts are allowed placeholders). A REGISTERED
 *      clip whose frame fails to load is an error (console.error + window.__clipErrors): capture fails loudly.
 *    · LRU of decoded images (default 240): preload() decodes the next frames ahead; memory stays bounded.
 *    · Headless decoding is not perfectly deterministic either (frames 285/286 once rendered paler): after every render,
 *      re-check the stills around reveals.
 *
 *  API (browser global window.Clips; CommonJS module.exports in Node for tests)
 *    const clips = Clips.create({ fps: 24, cache: 240 })   // fps = the FILM fps (default window.__comp.fps)
 *    clips.add(id, { dir, frames, fps, pattern = 'f_%04d.jpg', first = 0, still, label })   // numbers from _clip.json
 *    await clips.load(id, dir, { still, label })            // reads <dir>/_clip.json (XHR: works over http:// and over
 *                                                           // file:// with --allow-file-access-from-files, as cdp.mjs sets)
 *    clips.index(id, clipT)            → frame index (clamped)          clipT = seconds into the clip
 *    clips.url(id, clipT)              → frame URL (or the still / null)
 *    clips.at(id, t, t0, { in: 0, rate: 1 })  → clip seconds for film time t of a clip placed at film time t0
 *                                               (t is replaced by __mbBase while a motion-blur frame is rendering)
 *    clips.draw(img, id, clipT, { focus: [0.5, 0.5], zoom: 1, label })   sets img.src only when it changes; falls back to
 *                                               the still, then turns the <img> into a ✦ GENERATION plate
 *    await clips.preload(id, clipT, ahead = 12)   decode the next frames into the LRU (call from __seek, awaited)
 *    Clips.heldTime(t, fps)            → __mbBase when t is a sub-frame of the frame being blurred, else t
 *    Clips.plate(label)                → a ✦ GENERATION plate element (token colours via CSS variables when present)
 *
 *  Example inside __seek:
 *    const ct = clips.at('v1_host', t, 3.0, { in: 0.9, rate: 1 });      // the clip starts at film 3.0 s, from its 0.9 s
 *    clips.draw(hostImg, 'v1_host', ct, { focus: [0.42, 0.35] });
 *    await clips.preload('v1_host', ct);
 */
(function (root) {
  'use strict';
  const clampI = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmtPattern = (pattern, i) => pattern.replace(/%0(\d+)d/, (_, n) => String(i).padStart(+n, '0')).replace(/%d/, String(i));
  const hasDOM = typeof document !== 'undefined';

  /** __mbBase while a motion-blur frame is rendering (t is a sub-frame of that frame), else t */
  function heldTime(t, fps) {
    const b = root && root.__mbBase;
    const f = fps > 0 ? fps : (root && root.__comp && root.__comp.fps) || 24;
    if (typeof b === 'number' && isFinite(b) && t >= b - 1e-6 && t - b < 1 / f - 1e-9) return b;
    return t;
  }

  function plate(label) {
    if (!hasDOM) return null;
    const el = document.createElement('div');
    el.className = 'clip-plate';
    el.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;' +
      'background:var(--surface-card, var(--bg-raised, #1B1B1B));color:var(--fg-muted, #9A9A9A);' +
      'font:600 28px/1.25 var(--font-label, Inter, system-ui, sans-serif);letter-spacing:.06em;text-transform:uppercase;text-align:center;' +
      'box-shadow:inset 0 0 0 1px var(--line-hairline, rgba(255,255,255,.12));';
    const a = document.createElement('div'); a.textContent = '✦ GENERATION';
    const b = document.createElement('div'); b.textContent = label || ''; b.style.cssText = 'text-transform:none;letter-spacing:0;font-weight:500;max-width:70%;opacity:.8';
    el.appendChild(a); if (label) el.appendChild(b);
    return el;
  }

  function create(opts) {
    opts = opts || {};
    const filmFps = () => opts.fps || (root && root.__comp && root.__comp.fps) || 24;
    const cacheMax = opts.cache > 0 ? opts.cache : 240;
    const reg = new Map();            // id → { dir, frames, fps, pattern, first, still, label }
    const lru = new Map();            // url → Promise<HTMLImageElement> (insertion order = recency)
    const broken = new Set();         // urls that failed to load
    const errors = (root && (root.__clipErrors = root.__clipErrors || [])) || [];

    function touch(url) {
      if (lru.has(url)) { const p = lru.get(url); lru.delete(url); lru.set(url, p); return p; }
      if (!hasDOM) return null;
      const im = new Image(); im.decoding = 'sync'; im.src = url;
      const p = im.decode().then(() => im, (e) => { broken.add(url); fail('could not decode ' + url + (e && e.message ? ' (' + e.message + ')' : '')); return null; });
      lru.set(url, p);
      while (lru.size > cacheMax) lru.delete(lru.keys().next().value);
      return p;
    }
    function fail(msg) {
      const m = 'clips: ' + msg;
      errors.push(m);
      if (root && root.console) root.console.error(m);
    }
    function add(id, m) {
      if (!m || typeof m !== 'object') throw new Error('clips.add(' + id + '): give { dir, frames, fps } (numbers from _clip.json)');
      const frames = Math.floor(+m.frames || 0);
      const c = { dir: String(m.dir || '').replace(/\/$/, ''), frames, fps: +m.fps || filmFps(), pattern: m.pattern || 'f_%04d.jpg', first: Math.floor(+m.first || 0), still: m.still || null, label: m.label || id };
      if (frames > 0 && !c.dir) throw new Error('clips.add(' + id + '): dir is required when frames > 0');
      reg.set(id, c);
      return c;
    }
    function load(id, dir, extra) {
      extra = extra || {};
      const url = String(dir).replace(/\/$/, '') + '/_clip.json';
      return new Promise((res) => {
        const x = new XMLHttpRequest();
        x.open('GET', url, true);
        x.onload = () => {
          let j = null;
          try { if (x.status === 0 || (x.status >= 200 && x.status < 300)) j = JSON.parse(x.responseText); } catch (e) { j = null; }
          if (!j) { fail('could not read ' + url + ' (status ' + x.status + ')'); res(add(id, { dir, frames: 0, still: extra.still, label: extra.label })); return; }
          res(add(id, Object.assign({ dir }, j, extra)));
        };
        x.onerror = () => { fail('could not read ' + url); res(add(id, { dir, frames: 0, still: extra.still, label: extra.label })); };
        x.send();
      });
    }
    function index(id, clipT) {
      const c = reg.get(id);
      if (!c || c.frames <= 0) return -1;
      return clampI(Math.floor(clipT * c.fps + 1e-6), 0, c.frames - 1);   // clamp: hold the last frame, never loop
    }
    function frameUrl(c, i) { return c.dir + '/' + fmtPattern(c.pattern, c.first + i); }
    function url(id, clipT) {
      const c = reg.get(id);
      if (!c) return null;
      if (c.frames <= 0) return c.still || null;
      const u = frameUrl(c, index(id, clipT));
      return broken.has(u) ? c.still || null : u;
    }
    function at(id, t, t0, o) {
      o = o || {};
      const th = heldTime(t, filmFps());
      return (+o.in || 0) + Math.max(0, th - (t0 || 0)) * (o.rate === undefined ? 1 : +o.rate);
    }
    function preload(id, clipT, ahead) {
      const c = reg.get(id);
      if (!c || c.frames <= 0 || !hasDOM) return Promise.resolve();
      const i0 = index(id, clipT), n = ahead === undefined ? 12 : ahead, ps = [];
      for (let i = i0; i <= Math.min(c.frames - 1, i0 + n); i++) ps.push(touch(frameUrl(c, i)));
      return Promise.all(ps).then(() => undefined);
    }
    function draw(img, id, clipT, o) {
      o = o || {};
      if (!img) return null;
      const c = reg.get(id);
      const u = url(id, clipT);
      const fx = o.focus ? o.focus[0] : 0.5, fy = o.focus ? o.focus[1] : 0.5;
      if (!c && !img.__clipNoted) { img.__clipNoted = true; if (root && root.console) root.console.info('clips: "' + id + '" not registered yet → ✦ GENERATION plate'); }
      if (u) {
        if (img.__plate) { img.__plate.remove(); img.__plate = null; img.style.visibility = ''; }
        if (img.getAttribute('src') !== u) {
          img.onerror = () => { if (!broken.has(u)) { broken.add(u); fail('frame failed to load: ' + u); } };
          img.setAttribute('src', u);
        }
        img.style.objectFit = 'cover';
        img.style.objectPosition = (fx * 100).toFixed(2) + '% ' + (fy * 100).toFixed(2) + '%';
        const z = o.zoom || 1;
        img.style.transformOrigin = (fx * 100).toFixed(2) + '% ' + (fy * 100).toFixed(2) + '%';
        img.style.transform = z !== 1 ? 'scale(' + z + ')' : '';
        return u;
      }
      // no clip, no still → a labelled plate in the img's place (the img stays in the DOM, hidden)
      if (!img.__plate && hasDOM && img.parentNode) {
        const p = plate(o.label || (c && c.label) || id);
        img.parentNode.insertBefore(p, img.nextSibling);
        img.__plate = p; img.style.visibility = 'hidden';
      }
      return null;
    }
    return { add, load, index, url, at, draw, preload, heldTime: (t) => heldTime(t, filmFps()), has: (id) => reg.has(id), meta: (id) => reg.get(id) || null, errors: () => errors.slice(), cacheSize: () => lru.size };
  }

  const api = { create, heldTime, plate, pattern: fmtPattern };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Clips = api;
})(typeof window !== 'undefined' ? window : globalThis);
