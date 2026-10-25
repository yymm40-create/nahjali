# Exemplar scenes

## من الغبار إلى الكلمة
Shows: particles assembling an Arabic word right→left on a curl flow, landing, light sweep, support line out of blur, blow-away exit, bloom + vignette + grain, a slow push, cues on the changes

```js
var word = "ابدأ الآن", sub = "قصتك تبدأ من هنا", pts, sw, size;
scene({
  title: "من الغبار إلى الكلمة", duration: 6, bpm: 120, background: "#0b0b10", blur: 0.5,
  cues: [
    { t: 0.0, sfx: "riser-riser-reveal", vol: 0.7 },
    { t: 1.95, sfx: "hit-bass-hit" },
    { t: 2.55, sfx: "magic-sparkle", vol: 0.55 },
    { t: 4.55, sfx: "transition-whoosh-deep" }
  ],
  setup: function (K, ctx) {
    size = K.fit(ctx, word, K.W * 0.78, K.W * 0.2, 900, K.fonts.head);
    pts = K.textPoints(word, { x: K.W / 2, y: K.H * 0.46, size: size, weight: 900, family: K.fonts.head, step: Math.max(3, Math.round(K.W / 360)), max: 5000, seed: 4 });
    sw = K.swarm(pts, { from: "edge", seed: 9, size: K.W / 520, wave: true, text: word, waveSpan: 0.4, delay: 0.3 });
  },
  draw: function (K, t, ctx) {
    var W = K.W, H = K.H, E = K.ease, y = H * 0.46;
    // the camera is always alive: a slow push over the whole shot
    var push = 1 + 0.05 * E.inOutSine(K.seg(t, 0, 6));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(push, push); ctx.translate(-W / 2, -H / 2);
    // depth: a warm light behind the word, drifting on noise
    var g = ctx.createRadialGradient(W * (0.5 + 0.06 * K.noise2(t * 0.2, 1)), y, 0, W / 2, y, W * 0.75);
    g.addColorStop(0, K.rgba("#d78d45", 0.22 * K.envelope(t, 0.2, 6, 1.6, 0.8))); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // the swarm assembles 0.15 → 2.0 s (right to left), holds, and blows away 4.6 → 5.6 s
    var p = t < 4.6 ? K.seg(t, 0.15, 1.85) : 1 - K.seg(t, 4.6, 1.0);
    sw.draw(ctx, p, t, { color: "#f2f0eb", curl: t < 4.6 ? 180 : 420, ease: t < 4.6 ? E.outExpo : E.inCubic, sizeLanded: 1 });
    // landed: the crisp word over its dust, a glow of the accent, one light sweep
    var land = K.seg(t, 1.85, 0.35) * (1 - K.seg(t, 4.5, 0.2));
    if (land > 0) K.text(ctx, word, W / 2, y, { size: size, weight: 900, family: K.fonts.head, color: "#f2f0eb", alpha: land, glow: { color: "#d78d45", blur: W * 0.03 } });
    if (t > 2.3 && t < 3.4) K.lightSweep(ctx, K.seg(t, 2.3, 1.1), function (x) { K.text(x, word, W / 2, y, { size: size, weight: 900, family: K.fonts.head, color: "#fff" }); }, { alpha: 0.8 });
    // the support line rises out of blur, thin against the heavy word
    var s = K.envelope(t, 2.5, 4.7, 0.7, 0.3);
    if (s > 0) K.text(ctx, sub, W / 2, y + size * 0.85 + (1 - E.outExpo(s)) * size * 0.3, { size: size * 0.32, weight: 400, family: K.fonts.body, color: "#cfc9bd", alpha: s, blur: (1 - s) * 12 });
    ctx.restore();
    K.bloom(ctx, { strength: 0.45 }); K.vignette(ctx, { amount: 0.4 }); K.grain(ctx, t, { amount: 0.05 });
  }
});
```

## شكل واحد
Shows: one shape morphing through states with K.springTo (no cuts), content swaps with blur, a drawn-on check, a counter and bars staggering in, a cursor on an arc pressing, a soft contact shadow, a loop back to frame 1

```js
// one shape, never cut: button → loader → done → card with a counter → back to the button (the last frame is the first)
var T = [0.5, 1.5, 2.5, 3.3, 5.3];
var C = { bg: "#e9e7e2", ink: "#141318", accent: "#493cca", paper: "#f7f6f3" };
function track(t, vals, base) { return function (K) { return K.springTo(t, base, T.map(function (at, i) { return [at, vals[i]]; }), { stiffness: 210, damping: 27 }); }; }
scene({
  title: "شكل واحد", duration: 6, bpm: 120, background: C.bg, blur: 0.35,
  cues: [
    { t: 0.5, sfx: "ui-click" }, { t: 1.5, sfx: "ui-pop-bright", vol: 0.7 }, { t: 2.5, sfx: "ui-success", vol: 0.8 },
    { t: 3.3, sfx: "transition-swipe", vol: 0.6 }, { t: 3.8, sfx: "ui-text-blip", vol: 0.5 }, { t: 5.3, sfx: "ui-tap", vol: 0.6 }
  ],
  draw: function (K, t, ctx) {
    var W = K.W, H = K.H, E = K.ease, u = Math.min(W, H);
    // size, radius and colour of the one shape, each a sum of springs (still a function of t)
    var w = track(t, [0.16, 0.16, 0.72, 0.72, 0.5], 0.5)(K) * u;
    var h = track(t, [0.16, 0.16, 0.16, 0.62, 0.12], 0.12)(K) * u;
    var r = Math.min(w, h) * track(t, [0.5, 0.5, 0.12, 0.08, 0.5], 0.5)(K);
    var cx = W / 2, cy = H * 0.48;
    // a soft contact shadow grounds it; a 2% breathing scale keeps the hold alive
    var breathe = 1 + 0.012 * Math.sin(t * 2.4);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(breathe, breathe);
    ctx.shadowColor = "rgba(20,19,24,0.18)"; ctx.shadowBlur = u * 0.05; ctx.shadowOffsetY = u * 0.02;
    var done = K.seg(t, 2.5, 0.25) * (1 - K.seg(t, 3.3, 0.2));
    K.roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = done > 0 ? K.mix(C.ink, C.accent, done) : C.ink; ctx.fill();
    ctx.shadowColor = "transparent";
    // the content of each state, swapping with a short blur (enter 0.25 s, leave faster)
    var a0 = K.envelope(t, 0, 0.5, 0.01, 0.15) + K.seg(t, 5.45, 0.3);
    if (a0 > 0) K.text(ctx, "ابدأ", 0, 0, { size: u * 0.05, weight: 700, family: K.fonts.head, color: C.paper, alpha: a0, blur: (1 - Math.min(1, a0)) * 6 });
    var a1 = K.envelope(t, 1.55, 2.5, 0.15, 0.1);
    if (a1 > 0) { ctx.save(); ctx.rotate(t * 6); ctx.strokeStyle = C.paper; ctx.lineWidth = u * 0.012; ctx.lineCap = "round"; ctx.globalAlpha = a1; ctx.beginPath(); ctx.arc(0, 0, u * 0.045, 0, Math.PI * 1.4); ctx.stroke(); ctx.restore(); }
    var a2 = K.envelope(t, 2.55, 3.3, 0.2, 0.1);
    if (a2 > 0) { ctx.save(); ctx.globalAlpha = a2; ctx.strokeStyle = C.paper; ctx.lineWidth = u * 0.014; ctx.lineCap = "round"; ctx.lineJoin = "round"; K.drawOn(ctx, K.seg(t, 2.55, 0.35), u * 0.16, function (x) { x.moveTo(-u * 0.035, 0); x.lineTo(-u * 0.008, u * 0.028); x.lineTo(u * 0.04, -u * 0.03); }); ctx.restore(); }
    var a3 = K.envelope(t, 3.55, 5.3, 0.3, 0.15);
    if (a3 > 0) {
      K.text(ctx, "متابع جديد", w * 0.36, -h * 0.34, { size: u * 0.034, weight: 400, family: K.fonts.body, color: "#b9b6c9", alpha: a3, align: "right" });
      K.text(ctx, K.counter(K.seg(t, 3.6, 1.2), 0, 1250, { comma: true, suffix: "+" }), 0, -h * 0.05, { size: u * 0.13, weight: 900, family: K.fonts.head, color: C.paper, alpha: a3 });
      for (var i = 0; i < 6; i++) { var g = K.ease.silk(K.seg(t, 3.75 + K.stagger(i, 0.06), 0.5)); var bh = h * (0.08 + 0.05 * i) * g; ctx.fillStyle = i === 5 ? C.accent : "rgba(247,246,243,0.35)"; ctx.globalAlpha = a3; K.roundRect(ctx, -w * 0.36 + i * w * 0.13, h * 0.38 - bh, w * 0.08, bh, u * 0.008); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // a cursor drives every change: it arrives on an arc, presses (scale 0.9), and leaves
    var cxr = K.keys(t, [[0, W * 0.8], [0.45, cx + u * 0.02], [3.25, cx + u * 0.02], [5.2, cx + u * 0.04], [6, W * 0.8]], E.inOutCubic);
    var cyr = K.keys(t, [[0, H * 0.7], [0.45, cy + u * 0.02], [3.25, cy + u * 0.02], [5.2, cy + u * 0.03], [6, H * 0.7]], E.inOutCubic) - Math.sin(K.seg(t, 0, 0.45) * Math.PI) * u * 0.05;
    var press = 1 - 0.1 * (K.envelope(t, 0.42, 0.62, 0.05, 0.12) + K.envelope(t, 5.22, 5.42, 0.05, 0.12));
    ctx.save(); ctx.translate(cxr, cyr); ctx.scale(press, press); ctx.fillStyle = "#ffffff"; ctx.strokeStyle = C.ink; ctx.lineWidth = u * 0.004;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, u * 0.05); ctx.lineTo(u * 0.013, u * 0.038); ctx.lineTo(u * 0.03, u * 0.036); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    K.grain(ctx, t, { amount: 0.025 });
  }
});
```

## رحلة في العمق
Shows: a 2.5D camera through 4 planes with depth of field, metaballs in the brand gradient, kinetic words on the beat (heavy number vs thin filler), a glass card with a counter, near dust parallax, a dive-through transition into a flash that becomes the end card (a landing title and a drawn line held to the last frame)

```js
// a 2.5D flight through planes: haze → liquid brand mass → hero words → near dust; the camera dives through the word
var words = ["١٠ آلاف", "طالب", "في شهر واحد"], dust = [];
scene({
  title: "رحلة في العمق", duration: 7, bpm: 96, background: "#0a0a0c", blur: 0.5,
  cues: [
    { t: 0.0, sfx: "transition-whoosh-light", vol: 0.6 }, { t: 1.25, sfx: "hit-impact-soft" },
    { t: 2.5, sfx: "ui-pop", vol: 0.6 }, { t: 3.75, sfx: "riser-riser-short", vol: 0.6 }, { t: 5.0, sfx: "transition-zoom-in" }, { t: 5.75, sfx: "hit-impact-soft", vol: 0.7 }
  ],
  setup: function (K) { var r = K.rng(5); for (var i = 0; i < 70; i++) dust.push([r() * 2 - 0.5, r() * 2 - 0.5, 200 + r() * 900, 1 + r() * 2.5]); },
  draw: function (K, t, ctx) {
    var W = K.W, H = K.H, E = K.ease, u = Math.min(W, H);
    // the camera: a slow cruise, then a dive through the hero plane at 5.0 s (fast, then a soft stop)
    var z = K.lerp(-200, 260, E.inOutSine(K.seg(t, 0, 5))) + 1500 * E.inExpo(K.seg(t, 5.0, 0.7));
    var cam = K.camera({ x: Math.sin(t * 0.4) * u * 0.03, y: Math.cos(t * 0.3) * u * 0.02, z: z, fov: 900 });
    // far: haze and a slow gradient turning with the story
    K.inSpace(ctx, cam, 1400, function (c) { var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#141318"); g.addColorStop(1, K.mix("#141318", "#2b1d4e", 0.6 + 0.2 * Math.sin(t * 0.5))); c.fillStyle = g; c.fillRect(-W, -H, W * 3, H * 3); });
    // mid: the liquid brand mass breathing behind the type
    K.inSpace(ctx, cam, 700, function (c) {
      var b = []; for (var i = 0; i < 5; i++) b.push({ x: W * (0.5 + 0.22 * Math.sin(t * 0.6 + i * 1.3)), y: H * (0.5 + 0.14 * Math.cos(t * 0.5 + i * 2.1)), r: u * (0.11 + 0.03 * Math.sin(t + i)) });
      K.metaballs(c, b, { gradient: ["#493cca", "#d78d45"], res: 0.2, alpha: 0.85 });
    }, { dof: 0.012, focus: 300 });
    // hero: the words build on the beat (0.625 s), heavy number, thin filler, right to left
    K.inSpace(ctx, cam, 300, function (c) {
      for (var i = 0; i < words.length; i++) {
        var at = 0.3 + i * 1.25, a = K.envelope(t, at, 5.2, 0.6, 0.2), e = E.silk(K.seg(t, at, 0.7));
        if (a <= 0) continue;
        var big = i === 0, size = big ? u * 0.2 : u * 0.075;
        K.text(c, words[i], W / 2, H * (0.38 + i * 0.13) + (1 - e) * u * 0.05, { size: size, weight: big ? 900 : 300, family: big ? K.fonts.head : K.fonts.body, color: big ? "#f2f0eb" : "#cfc9bd", alpha: a, blur: (1 - e) * 10, glow: big ? { color: "#d78d45", blur: u * 0.04 } : undefined });
      }
      var gl = K.envelope(t, 2.6, 5.2, 0.5, 0.2);
      if (gl > 0) { c.globalAlpha = gl; K.glass(c, W * 0.2, H * 0.72, W * 0.6, u * 0.12, { radius: u * 0.03 }); K.text(c, "+" + K.counter(K.seg(t, 2.7, 1.4), 0, 38) + "٪ نمو", W / 2, H * 0.72 + u * 0.06, { size: u * 0.045, weight: 700, family: K.fonts.head, color: "#f2f0eb" }); c.globalAlpha = 1; }
    }, { dof: 0.012, focus: 300 });
    // near: dust lit as it crosses the light (parallax: it moves the most)
    for (var k = 0; k < dust.length; k++) { var d = dust[k], p = K.project(cam, (d[0] - 0.5) * W, (d[1] - 0.5) * H, d[2] - 600); if (p.s <= 0 || p.s > 6) continue; ctx.fillStyle = "rgba(242,240,235," + (0.25 * K.clamp(2 - p.s)) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, d[3] * p.s, 0, K.TAU); ctx.fill(); }
    // the dive ends in a flash of the accent that becomes the next shot: the end card, which holds to the last frame
    var end = K.seg(t, 5.7, 0.2);
    if (end > 0) {
      ctx.fillStyle = K.rgba("#0d0b14", end); ctx.fillRect(0, 0, W, H);
      var land = E.silk(K.seg(t, 5.75, 0.6)), s = 1.25 - 0.25 * land;
      K.text(ctx, "وأنت التالي", W / 2, H * 0.47, { size: u * 0.13, weight: 900, family: K.fonts.head, color: "#f2f0eb", alpha: land, scale: s, blur: (1 - land) * 12, glow: { color: "#d78d45", blur: u * 0.05 } });
      var line = E.silk(K.seg(t, 6.05, 0.5));
      ctx.fillStyle = "#d78d45"; ctx.globalAlpha = line; ctx.fillRect(W / 2 - u * 0.18 * line, H * 0.555, u * 0.36 * line, u * 0.006); ctx.globalAlpha = 1;
      K.text(ctx, "ابدأ اليوم", W / 2, H * 0.6, { size: u * 0.05, weight: 300, family: K.fonts.body, color: "#cfc9bd", alpha: K.seg(t, 6.2, 0.4) });
    }
    var f = K.seg(t, 5.45, 0.25) * (1 - K.seg(t, 5.75, 0.45));
    if (f > 0) { ctx.fillStyle = K.rgba("#d78d45", f); ctx.fillRect(0, 0, W, H); }
    K.bloom(ctx, { strength: 0.35 }); K.vignette(ctx, { amount: 0.35 }); K.grain(ctx, t, { amount: 0.045 });
  }
});
```
