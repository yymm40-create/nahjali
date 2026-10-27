
window.SFX = (function () {
  "use strict";
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000000) / 1000000; }; }
  function make(rate, seconds) {
    var n = Math.max(1, Math.round(rate * seconds)), L = new Float32Array(n), R = new Float32Array(n), r = rng(424242);
    var nz = function () { return r() * 2 - 1; };
    var idx = function (t) { return Math.round(t * rate); };
    function put(i, v, pan) {
      if (i < 0 || i >= n || !isFinite(v)) return;
      var p = Math.max(-1, Math.min(1, pan || 0));
      L[i] += v * (p > 0 ? 1 - p : 1); R[i] += v * (p < 0 ? 1 + p : 1);
    }
    function osc(type, ph) {
      var x = ph - Math.floor(ph);
      return type === "square" ? (x < 0.5 ? 1 : -1) : type === "saw" ? 2 * x - 1 : type === "tri" ? 1 - 4 * Math.abs(x - 0.5) : Math.sin(2 * Math.PI * x);
    }
    // a state-variable filter: band / low / high of a signal, its centre moving sample by sample
    function svf() { var lo = 0, bp = 0; return function (x, fc, q) { var f = 2 * Math.sin(Math.PI * Math.min(fc, rate * 0.24) / rate), hi = x - lo - q * bp; bp += f * hi; lo += f * bp; return { lo: lo, bp: bp, hi: hi }; }; }
    var S = {
      rate: rate, seconds: seconds, L: L, R: R,
      noise: nz, at: idx, add: put,
      /** a note: f Hz (glide to "to"), dur s, attack, an exponential release */
      tone: function (t, o) {
        o = o || {}; var f = o.f || 440, to = o.to || f, d = o.dur || 0.3, g = o.gain == null ? 0.3 : o.gain, a = o.attack || 0.005, type = o.type || "sine", ph = 0, i0 = idx(t), m = idx(d);
        for (var i = 0; i < m; i++) { var x = i / rate, k = x / d, fr = f * Math.pow(to / f, k); ph += fr / rate; var e = Math.min(1, x / a) * Math.exp(-4 * k); put(i0 + i, osc(type, ph) * e * g, o.pan); }
      },
      /** filtered air sweeping past: peaks AT t (it starts before it), from → to Hz */
      whoosh: function (t, o) {
        o = o || {}; var d = o.dur || 0.5, g = o.gain == null ? 0.5 : o.gain, f0 = o.from || 300, f1 = o.to || 3200, s = t - d * 0.6, m = idx(d), F = svf();
        for (var i = 0; i < m; i++) { var k = i / m, fc = f0 * Math.pow(f1 / f0, k), e = Math.pow(Math.sin(Math.PI * Math.min(1, k)), 2); put(idx(s) + i, F(nz(), fc, 0.6).bp * e * g * 1.6, o.pan == null ? (k - 0.5) * 0.8 : o.pan); }
      },
      /** an impact: a pitched body falling f0 → f1 and a short transient */
      hit: function (t, o) {
        o = o || {}; var d = o.dur || 0.6, g = o.gain == null ? 0.9 : o.gain, f0 = o.f0 || 120, f1 = o.f1 || 42, ph = 0, i0 = idx(t), m = idx(d), F = svf();
        for (var i = 0; i < m; i++) { var x = i / rate, fr = f1 + (f0 - f1) * Math.exp(-x * 18); ph += fr / rate; var body = Math.sin(2 * Math.PI * ph) * Math.exp(-x * 5.5), click = F(nz(), 2500, 0.8).lo * Math.exp(-x * 90); put(i0 + i, (body * 0.9 + click * 0.8) * g, o.pan); }
      },
      /** tension rising from t0, cresting at t1 (where the reveal lands) */
      riser: function (t0, t1, o) {
        o = o || {}; var g = o.gain == null ? 0.4 : o.gain, m = idx(Math.max(0.05, t1 - t0)), ph = 0, F = svf();
        for (var i = 0; i < m; i++) { var k = i / m, e = Math.pow(k, 2.2), fc = 200 * Math.pow(30, k), fr = 90 * Math.pow(10, k); ph += fr / rate; put(idx(t0) + i, (F(nz(), fc, 0.5).bp * 1.2 + osc("saw", ph) * 0.25) * e * g, Math.sin(k * 12) * 0.3 * k); }
      },
      click: function (t, o) { o = o || {}; var g = o.gain == null ? 0.35 : o.gain, m = idx(0.008), F = svf(); for (var i = 0; i < m; i++) put(idx(t) + i, F(nz(), o.f || 3000, 0.4).bp * (1 - i / m) * g * 2, o.pan); },
      tick: function (t, o) { o = o || {}; S.tone(t, { f: o.f || 2600, dur: 0.03, gain: o.gain == null ? 0.18 : o.gain, pan: o.pan }); },
      pop: function (t, o) { o = o || {}; var f = o.f || 620; S.tone(t, { f: f * 1.7, to: f, dur: 0.09, gain: o.gain == null ? 0.45 : o.gain, pan: o.pan }); },
      /** sparkle: a few high partials that twinkle and fade */
      shimmer: function (t, o) {
        o = o || {}; var d = o.dur || 1, g = o.gain == null ? 0.18 : o.gain;
        for (var j = 0; j < 7; j++) { var f = 2400 + r() * 4200, st = t + r() * d * 0.4; S.tone(st, { f: f, to: f * (1 + (r() - 0.5) * 0.04), dur: d * (0.4 + r() * 0.6), gain: g / 3, attack: 0.01, pan: (r() - 0.5) * 1.4 }); }
      },
      glitch: function (t, o) {
        o = o || {}; var d = o.dur || 0.25, g = o.gain == null ? 0.3 : o.gain, m = idx(d), hold = 0, v = 0;
        for (var i = 0; i < m; i++) { if (hold-- <= 0) { hold = 40 + Math.floor(r() * 400); v = r() < 0.35 ? 0 : Math.round(nz() * 3) / 3; } put(idx(t) + i, v * g, (r() - 0.5) * 0.6); }
      },
      /** a deep drop under a big moment */
      sub: function (t, o) { o = o || {}; S.tone(t, { f: o.f || 70, to: (o.f || 70) * 0.55, dur: o.dur || 1.2, gain: o.gain == null ? 0.6 : o.gain, attack: 0.01 }); },
      /** a soft bed (music by code): detuned saws through a slow low-pass, faded in and out */
      drone: function (t0, t1, o) {
        o = o || {}; var g = o.gain == null ? 0.1 : o.gain, base = o.f || 110, ch = o.chord || [1, 1.5, 2], m = idx(Math.max(0.1, t1 - t0)), ph = [], F = svf(), fade = Math.min(1.5, (t1 - t0) / 4);
        for (var c = 0; c < ch.length * 2; c++) ph.push(r());
        for (var i = 0; i < m; i++) {
          var x = i / rate, s = 0;
          for (var c2 = 0; c2 < ch.length; c2++) { ph[c2 * 2] += base * ch[c2] * 1.003 / rate; ph[c2 * 2 + 1] += base * ch[c2] * 0.997 / rate; s += osc("saw", ph[c2 * 2]) + osc("saw", ph[c2 * 2 + 1]); }
          var e = Math.min(1, x / fade, (t1 - t0 - x) / fade);
          put(idx(t0) + i, F(s / ch.length, 500 + 300 * Math.sin(x * 0.7), 0.7).lo * e * g, 0);
        }
      },
      /** a beat on the bpm (music by code): kick on the beats, a hat between, a clap on 2 and 4 when "full" */
      beat: function (t0, t1, o) {
        o = o || {}; var bpm = o.bpm || 120, g = o.gain == null ? 0.35 : o.gain, step = 60 / bpm, k = 0;
        for (var t = t0; t < t1 - 0.01; t += step, k++) {
          S.hit(t, { f0: 150, f1: 48, dur: 0.35, gain: g });
          S.click(t + step / 2, { f: 8000, gain: g * 0.35 });
          if (o.full && k % 2 === 1) for (var j = 0; j < 3; j++) S.click(t + j * 0.012, { f: 1600, gain: g * 0.5 });
        }
      },
    };
    return S;
  }
  /** The finished buffers, kept under 0 dBFS with a soft knee (never clipped). */
  function finish(S) {
    var peak = 0, i;
    for (i = 0; i < S.L.length; i++) peak = Math.max(peak, Math.abs(S.L[i]), Math.abs(S.R[i]));
    var k = peak > 0.89 ? 0.89 / peak : 1;
    for (i = 0; i < S.L.length; i++) { S.L[i] = Math.tanh(S.L[i] * k * 1.1) / 1.1; S.R[i] = Math.tanh(S.R[i] * k * 1.1) / 1.1; }
    return { L: S.L, R: S.R, peak: peak };
  }
  return { make: make, finish: finish };
})();
