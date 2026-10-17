#!/usr/bin/python3
# LO. — 15.0 s stereo soundtrack, fully synthesized (numpy + stdlib only: no scipy, no samples, no downloads).
# Theme: the birth of the internet / "you live inside the system". Before 2.5 s only a 1969 CRT terminal
# (hum, whine, teletype, code-rain chatter, crash + power sag); from 2.5 s a dark minimal 120 BPM techno
# groove in D minor (i - VI - III - iv - V - i : Dm Bb F Gm A Dm(add9)). The cuts are the rhythm: every cut gets a hit.
# Helpers are taken from tools/sound.py (BLIP) — copied here, not imported, because that file renders on import.
# usage: /usr/bin/python3 tools/sound_lo.py [out.wav]     (default film/lo_sound.wav, then film/lo_sound.m4a)
import os, sys, time, wave, shutil, subprocess, numpy as np

T_RUN = time.time()
SR = 48000; DUR = 15.0; N = int(round(SR * DUR))
rng = np.random.default_rng(1969)
t_all = np.arange(N) / SR
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_WAV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'film', 'lo_sound.wav')

# buses: drum (dry, not ducked) · mus (sidechained to the kick) · duckfx (sfx that sit under the music, also
# sidechained) · sfx (dry) · hall / room / echo (sends)
BUS = {k: np.zeros((2, N)) for k in ('drum', 'mus', 'duckfx', 'sfx', 'hall', 'room', 'echo')}
SIDECHAIN = []

def add(sig, t0, gain=1.0, pan=0.0, bus='sfx', hall=0.0, room=0.0, echo=0.0):
    """mono or (2,n) stereo signal at t0 s; pan may be a scalar or a per-sample array (equal power, centre = 1)."""
    sig = np.asarray(sig, float)
    if sig.ndim == 1: sig = np.vstack([sig, sig])
    i0 = int(round(t0 * SR)); p = np.asarray(pan, float)
    if i0 < 0:
        sig = sig[:, -i0:]; p = p[-i0:] if p.ndim else p; i0 = 0
    n = min(sig.shape[1], N - i0)
    if n <= 0: return
    if p.ndim: p = p[:n]
    l, r = np.cos((p + 1) * np.pi / 4) * 1.4142, np.sin((p + 1) * np.pi / 4) * 1.4142
    blk = np.vstack([sig[0, :n] * l, sig[1, :n] * r]) * gain
    BUS[bus][:, i0:i0 + n] += blk
    for k, v in (('hall', hall), ('room', room), ('echo', echo)):
        if v: BUS[k][:, i0:i0 + n] += blk * v
def add_end(sig, t1, gain=1.0, **kw):  # place a sound so that it ENDS exactly at t1 (risers into hits)
    add(sig, t1 - np.shape(sig)[-1] / SR, gain, **kw)

# ---------- helpers from tools/sound.py ----------
def tt(d): return np.arange(int(d * SR)) / SR
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def band(x, lo, hi, soft=.25):          # FFT band-pass with soft skirts
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.clip((f - lo * (1 - soft)) / (lo * soft + 1e-9), 0, 1) * np.clip((hi * (1 + soft) - f) / (hi * soft + 1e-9), 0, 1)
    return np.fft.irfft(X * m, len(x))
def lp1(x, fc):                          # one-pole low-pass, fc may be an array (short sounds only)
    fc = np.broadcast_to(np.asarray(fc, float), x.shape); a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s += a[i] * (x[i] - s); y[i] = s
    return y
def env(t, a, d): return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
def glide(f0, f1, d, curve=1.0):
    t = tt(d); p = (t / d) ** curve; f = f0 * (f1 / f0) ** p; return t, np.sin(2 * np.pi * np.cumsum(f) / SR)
def kick(g=1.0, f0=150, f1=44):
    t = tt(.5); f = f1 + (f0 - f1) * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + band(rng.standard_normal(len(t)), 2000, 7000) * np.exp(-t * 90) * .15) * g
def clap(g=.5):
    t = tt(.28); n = band(rng.standard_normal(len(t)), 900, 5000)
    e = sum(np.exp(-np.maximum(t - d, 0) * 60) * (t >= d) for d in (0, .011, .022)) / 2 + np.exp(-t * 14) * .5
    return n * e * g
def hat(g=.2, d=.05): t = tt(d * 3); return band(rng.standard_normal(len(t)), 6500, 16000) * np.exp(-t / d * 3) * g
def blip(f=1200, d=.06, g=.25, shape='sine'):
    t = tt(d); ph = 2 * np.pi * f * t
    s = np.sin(ph) if shape == 'sine' else np.sign(np.sin(ph)) * .55 + np.sin(ph) * .45
    return s * env(t, .002, d * .35) * g
def boop(f0=480, f1=980, d=.16, g=.35):
    t, s = glide(f0, f1, d, .6); return s * env(t, .004, d * .45) * g
def pluck(m, d=.35, g=.18):
    t = tt(d); f = midi(m)
    s = np.sin(2 * np.pi * f * t) + .45 * np.sin(4 * np.pi * f * t) * np.exp(-t * 18) + .2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 30)
    return s * env(t, .003, d * .3) * g
def bell(m, d=1.2, g=.16):
    t = tt(d); f = midi(m)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k) for r, a, k in [(1, 1, 2.5), (2.76, .45, 5), (5.4, .25, 9), (8.9, .12, 14)] if f * r < SR * .45)
    return s * np.minimum(1, t / .002) * g
def pad(notes, d, g=.07):
    t = tt(d); out = np.zeros(len(t))
    for m in notes:
        for det in (-.07, .07):
            f = midi(m) * (1 + det / 100 * 6); ph = 2 * np.pi * f * t
            out += np.sin(ph) + .25 * np.sin(2 * ph + .3) + .1 * np.sin(3 * ph)
    e = np.minimum(1, t / .35) * np.clip((d - t) / .4, 0, 1)
    return out * e * g / len(notes)
def bass(m, d, g=.3):
    t = tt(d); f = midi(m); s = np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t) + .1 * np.sin(6 * np.pi * f * t)
    return s * np.minimum(1, t / .01) * np.exp(-t * 1.6) * g
def whoosh(d, lo0, hi0, lo1, hi1, g=.4, rev=False):
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n); B = 2048
    for i in range(0, n, B // 2):
        p = i / n; seg = x[i:i + B]
        if len(seg) < 64: break
        w = np.hanning(len(seg)); out[i:i + len(seg)] += band(seg, lo0 + (lo1 - lo0) * p, hi0 + (hi1 - hi0) * p) * w
    p = np.arange(n) / n; e = (p ** 2.2) if rev else np.sin(np.pi * p) ** 1.4
    return out * e * g
def riser(d, g=.45):
    w = whoosh(d, 300, 1500, 2500, 12000, g * .8, rev=True)
    t, s = glide(180, 1400, d, 2.0); return w + s * (np.arange(len(t)) / len(t)) ** 3 * g * .25
def pop(f=900, g=.32):
    t = tt(.13); return np.sin(2 * np.pi * np.cumsum(f * (1 + 1.6 * np.exp(-t * 55))) / SR) * np.exp(-t * 34) * g
def tick(g=.12, f=3200): t = tt(.03); return band(rng.standard_normal(len(t)), f * .7, f * 1.6) * np.exp(-t * 200) * g + np.sin(2 * np.pi * f * .5 * t) * np.exp(-t * 300) * g

# ---------- new DSP ----------
def ar(n, a=.002, r=.005):               # linear attack / release edges for a buffer of n samples
    e = np.ones(n); na = min(n, max(1, int(a * SR))); nr = min(n, max(1, int(r * SR)))
    e[:na] *= np.linspace(0, 1, na); e[n - nr:] *= np.linspace(1, 0, nr); return e
def nrm(x): return x / (np.max(np.abs(x)) + 1e-12)
def soft_end(x, r=.015): return x * ar(len(x), .0, r)   # no click when a decaying buffer is cut
def _blep(p, dt):                        # polyBLEP residual (band-limited saw / pulse)
    y = np.zeros_like(p)
    m = p < dt; x = p[m] / dt[m]; y[m] = x + x - x * x - 1
    m = p > 1 - dt; x = (p[m] - 1) / dt[m]; y[m] = x * x + x + x + 1
    return y
def _phase(f, ph0):
    dt = np.maximum(np.broadcast_to(np.asarray(f, float), np.shape(f)) / SR, 1e-9)
    return (ph0 + np.cumsum(dt) - dt[0]) % 1.0, dt
def saw(f, ph0=0.0):
    p, dt = _phase(f, ph0); return 2 * p - 1 - _blep(p, dt)
def pulse(f, duty=.5, ph0=0.0):
    p, dt = _phase(f, ph0); q = (p + duty) % 1
    return (2 * p - 1 - _blep(p, dt)) - (2 * q - 1 - _blep(q, dt))
def svf(x, fc, res=.5, mode='lp'):       # TPT state-variable filter, time-varying cutoff, resonance 0..0.98
    x = np.asarray(x, float); n = len(x)
    g = np.tan(np.pi * np.clip(np.broadcast_to(np.asarray(fc, float), (n,)), 20, SR * .42) / SR); k = 2 - 2 * min(res, .98)
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    X, A1, A2, A3 = x.tolist(), a1.tolist(), a2.tolist(), a3.tolist()
    lp = [0.0] * n; bp = [0.0] * n; c1 = c2 = 0.0
    for i in range(n):
        v3 = X[i] - c2; v1 = A1[i] * c1 + A2[i] * v3; v2 = c2 + A2[i] * c1 + A3[i] * v3
        c1 = 2 * v1 - c1; c2 = 2 * v2 - c2; lp[i] = v2; bp[i] = v1
    lp = np.array(lp); bp = np.array(bp)
    return lp if mode == 'lp' else bp if mode == 'bp' else x - k * bp - lp
def sweep_noise(d, lo0, hi0, lo1, hi1, curve=1.0):   # noise through a band that glides (log-spaced) — whoosh core
    n = int(d * SR); pad_ = int(.05 * SR); x = rng.standard_normal(n + 2 * pad_); out = np.zeros(len(x)); B = 2048
    for i in range(0, len(x), B // 2):
        seg = x[i:i + B]
        if len(seg) < 256: break
        q = float(np.clip((i + len(seg) / 2 - pad_) / n, 0, 1)) ** curve
        out[i:i + len(seg)] += band(seg, lo0 * (lo1 / lo0) ** q, hi0 * (hi1 / hi0) ** q) * np.hanning(len(seg))
    return nrm(out[pad_:pad_ + n])
def events(t0, t1, rate, lam):           # inhomogeneous Poisson event times (thinning), rate(t) <= lam
    out = []; t = t0
    while True:
        t += rng.exponential(1 / lam)
        if t >= t1: return out
        if rng.random() * lam < rate(t): out.append(t)
def make_ir(dur, rt_lo, rt_hi, pre, seed, hp=120, er=()):
    """decorrelated stereo IR: noise with frequency-dependent decay (RT60 rt_lo @200 Hz -> rt_hi @10 kHz)."""
    r = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    f = np.fft.rfftfreq(n, 1 / SR); lf = np.log(np.maximum(f, 20))
    cen = np.array([60, 200, 500, 1200, 2800, 6000, 12000, 20000.]); lc = np.log(cen)
    out = []
    for ch in range(2):
        X = np.fft.rfft(r.standard_normal(n)); y = np.zeros(n)
        for j, c in enumerate(cen):
            w = np.interp(lf, lc, np.eye(len(cen))[j])
            a = np.clip(np.log(c / 200) / np.log(10000 / 200), 0, 1); rt = rt_lo + (rt_hi - rt_lo) * a
            y += np.fft.irfft(X * w, n) * np.exp(-6.91 * t / rt)
        y *= np.minimum(1, t / .012)
        for dt_, a in er:                                   # sparse early reflections
            i = int((dt_ + r.uniform(-.002, .002)) * SR); y[i] += a * r.choice([-1, 1]) * 6
        y = band(y, hp, 16000, .4)
        y = np.concatenate([np.zeros(int(pre * SR)), y]); out.append(y / np.sqrt(np.sum(y ** 2)))
    return out
def conv(x, h):
    nfft = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:len(x)]
def verb(send, ir):
    l, r = send; return np.vstack([conv(.72 * l + .28 * r, ir[0]), conv(.28 * l + .72 * r, ir[1])])

IR_HALL = make_ir(2.9, 2.5, .95, .021, 7, hp=140, er=[(.011, .5), (.019, .35), (.027, .3), (.041, .22), (.058, .15)])
IR_ROOM = make_ir(.55, .42, .2, .004, 8, hp=170, er=[(.003, .6), (.007, .4), (.012, .3), (.017, .2)])

# ---------- instruments ----------
def kick_t(g=1.0, f0=165, f1=47, pd=30, decay=6.0, d=.6, click=.22, drive=1.5):   # punchy techno kick
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * pd)
    amp = np.minimum(1, t / .0012) * np.where(t < .012, 1.0, np.exp(-(t - .012) * decay))
    body = np.tanh(drive * np.sin(2 * np.pi * np.cumsum(f) / SR) * amp) / np.tanh(drive)
    ck = band(rng.standard_normal(len(t)), 1800, 9000) * np.exp(-t * 260) * click
    return (body + ck) * ar(len(t), .0, .03) * g
def impact2(g=.8, decay=2.8, d=1.6, f_lo=34, sweep=85):
    t = tt(d)
    boom = np.sin(2 * np.pi * np.cumsum(f_lo + sweep * np.exp(-t * 16)) / SR) * np.exp(-t * decay) * np.minimum(1, t / .012) ** 2  # body, not transient
    air = band(rng.standard_normal(len(t)), 250, 4000) * np.exp(-t * 9) * .35
    crack = band(rng.standard_normal(len(t)), 2500, 10000) * np.exp(-t * 45) * .25
    return (boom + air + crack) * ar(len(t), .0005, .05) * g
def hat2(g=.08, d=.03, tone=1.0):        # 808-style metallic hat (six squares + noise)
    n = int(max(d * 5, .04) * SR); t = np.arange(n) / SR
    m = sum(np.sign(np.sin(2 * np.pi * f * tone * t + rng.uniform(0, 6.28))) for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0))
    x = band(m * .35 + rng.standard_normal(n) * .7, 7000, 15000)
    return nrm(x * np.exp(-t / d) * np.minimum(1, t / .0004)) * g
def cymbal(d=1.2, g=.3, decay=3.2):
    t = tt(d); m = sum(np.sign(np.sin(2 * np.pi * f * 1.73 * t + rng.uniform(0, 6.28))) for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0))
    s = band(m * .4 + rng.standard_normal(len(t)), 4200, 15000) + band(rng.standard_normal(len(t)), 2500, 6000) * .25
    return nrm(s * np.exp(-t * decay) * np.minimum(1, t / .001) * ar(len(t), .0, .15)) * g
def rev_cymbal(d=.5, g=.3):
    c = cymbal(d * 1.4, 1.0, 4.0)[::-1][-int(d * SR):]
    return c * np.linspace(0, 1, len(c)) ** 1.5 * g
def stab(notes, d=.9, g=.2, fc0=5000, fc1=280, res=.35, fdec=8):  # detuned saw chord stab, stereo
    t = tt(d); L = np.zeros(len(t)); R = np.zeros(len(t))
    for m in notes:
        L += saw(np.full(len(t), midi(m) * 2 ** (-.09 / 12)), rng.random()) + .5 * pulse(np.full(len(t), midi(m) * .5), .5, rng.random())
        R += saw(np.full(len(t), midi(m) * 2 ** (.09 / 12)), rng.random()) + .5 * pulse(np.full(len(t), midi(m) * .5 * 1.002), .5, rng.random())
    fc = fc1 + (fc0 - fc1) * np.exp(-t * fdec)
    e = np.minimum(1, t / .003) * np.exp(-t * 4.2) * ar(len(t), .0, .05)
    return np.vstack([svf(L, fc, res), svf(R, fc, res)]) * e * g / len(notes) ** .5
def downlifter(d=.9, g=.2):
    w = sweep_noise(d, 3000, 12000, 200, 1200, .7); t = np.arange(len(w)) / SR
    return w * np.minimum(1, t / .01) * np.exp(-t * 3.5) * ar(len(t), .0, .1) * g
def riser2(d, f0=160, f1=2400, g=.4, lo0=250, hi0=1200, lo1=3500, hi1=14000, curve=2.4, trem=(4, 32)):
    t = tt(d); p = t / d; pc = p ** curve
    nz = sweep_noise(d, lo0, hi0, lo1, hi1, curve)[:len(t)]
    f = f0 * (f1 / f0) ** pc
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .6 + saw(f) * .25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * .25
    rate = trem[0] * (trem[1] / trem[0]) ** pc; tr = .62 + .38 * np.sin(2 * np.pi * np.cumsum(rate) / SR)
    return nrm((nz * .7 + tone * .35 * tr) * p ** 1.4) * g                         # steady swell, peak = g at the hit
def bit(f, d=.012, g=.04, fall=1.0):     # tiny digital grain (glyph / data bit), optional pitch fall
    t = tt(d); ph = 2 * np.pi * np.cumsum(f * fall ** (t / d)) / SR
    return (np.sin(ph) + .22 * np.sin(3 * ph)) * np.minimum(1, t / .0006) * np.exp(-t / (d * .3)) * ar(len(t), .0, d * .3) * g
def sparkle(f, d=.06, g=.04):
    t = tt(d); return (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 90)) * np.minimum(1, t / .0005) * np.exp(-t / (d * .28)) * ar(len(t), .0, d * .3) * g
def decode(t0, d, g=.03, pan=0.0, width=.3, rate=60., fmin=1800, fmax=6000, bus='sfx', power=1.5):
    for tk in events(t0, t0 + d, lambda t: rate * max(0., 1 - (t - t0) / d) ** power, rate):
        p = (tk - t0) / d; f = rng.uniform(fmin, fmax)
        s = bit(f, rng.uniform(.005, .014), 1.0, rng.choice([1.0, .88, 1.12])) if rng.random() < .72 else tick(.6, f * .8)
        add(s, tk, g * rng.uniform(.55, 1.0) * (1 - .5 * p), pan=float(np.clip(pan + rng.uniform(-width, width), -1, 1)), bus=bus, room=.15)

# ---- 1969 terminal ----
def sag_curve(t, t0=1.46):               # brown-out: fast dip at t0, slow recovery
    u = np.maximum(t - t0, 0); return (1 - np.exp(-u / .012)) * np.exp(-u / .28) * (t >= t0)
def hum_bed(d):
    t = tt(d); sag = sag_curve(t); f = 60 * (1 - .13 * sag); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + .55 * np.sin(2 * ph + .4) + .32 * np.sin(3 * ph + 1.1) + .16 * np.sin(4 * ph) + .08 * np.sin(5 * ph + .7)
    buzz = band(np.tanh(3 * np.sin(ph)), 150, 2200) * .25
    return (s + buzz) * (.8 + .2 * np.sin(2 * np.pi * .7 * t)) * (1 - .55 * sag) * np.minimum(1, t / .08)
def crt_whine(d, f=11650):
    t = tt(d); sag = sag_curve(t)
    fr = f * (1 - .12 * sag) + 6 * np.sin(2 * np.pi * 3.1 * t)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.clip((t - .05) / .35, 0, 1) * (1 - .7 * sag)
def crt_on():
    t = tt(1.3)
    thump = np.sin(2 * np.pi * np.cumsum(38 + 72 * np.exp(-t * 25)) / SR) * np.exp(-t * 6.5) * np.minimum(1, t / .003)
    ph = 2 * np.pi * 60 * t                                           # degauss bloom
    deg = (np.sin(ph) + .6 * np.sin(2 * ph) + .35 * np.sin(3 * ph) + .2 * band(np.tanh(4 * np.sin(ph)), 200, 3000)) \
        * np.exp(-t * 3.4) * np.minimum(1, t / .02) * (1 + .3 * np.sin(2 * np.pi * 7 * t)) * .32
    cr = np.zeros(len(t)); idx = rng.integers(0, int(.45 * SR), 70)   # static crackle on the glass
    cr[idx] = rng.uniform(-1, 1, 70) * np.exp(-idx / SR * 5)
    cr = band(cr, 1500, 9000) * 2.2
    _, sw = glide(380, 5200, .17, 1.5); sw *= np.sin(np.pi * np.arange(len(sw)) / len(sw)) ** 2 * .1   # raster line opens
    out = thump * .95 + deg + cr * .16; i = int(.03 * SR); out[i:i + len(sw)] += sw
    return nrm(out * ar(len(t), .0005, .1))
def clack(g=.5, heavy=True):             # teletype (ASR-33-ish) type-bar strike
    d = .3 if heavy else .075; t = tt(d); j = rng.uniform(.94, 1.06)
    m = sum(a * np.sin(2 * np.pi * f * j * t + rng.uniform(0, 6)) * np.exp(-t * k) for f, k, a in
            [(1870, 60, 1), (2710, 75, .7), (3480, 90, .5), (4960, 120, .35), (6230, 150, .25)])
    nz = band(rng.standard_normal(len(t)), 1200, 9000) * np.exp(-t * 170)
    body = np.sin(2 * np.pi * np.cumsum(95 + 130 * np.exp(-t * 60)) / SR) * np.exp(-t * 32)
    bn = band(rng.standard_normal(len(t)), 120, 900) * np.exp(-t * 45)
    s = m * .22 + nz * .9 + (body * .95 + bn * .7) * (1 if heavy else .3)
    if heavy:                                                          # carriage / hammer return + rattle
        for dt_, a in [(.029, .5), (.054, .2), (.071, .12), (.084, .07), (.093, .04)]:
            i = int(dt_ * SR); k_ = t[:len(t) - i]
            s[i:] += (band(rng.standard_normal(len(k_)), 1500, 7000) * np.exp(-k_ * 320) + np.sin(2 * np.pi * 240 * k_) * np.exp(-k_ * 90) * .5) * a
    return nrm(s * np.minimum(1, t / .0004) * ar(len(t), .0, .01)) * g
def glitch_burst(d=.30):                 # buffer-repeat stutter, bitcrush, pitch falling into the sag
    src = np.zeros(int(.3 * SR)); st = tt(.032)
    for k, f in enumerate([1760, 1318, 2093, 880, 1568, 1046, 2637]):
        i = int(k * .036 * SR); src[i:i + len(st)] += (np.sin(2 * np.pi * f * st) + .3 * np.sin(6 * np.pi * f * st)) * .55
    src += band(rng.standard_normal(len(src)), 700, 9000) * .5
    c = clack(1.0); src[:len(c)] += c[:len(src)] * .8
    n = int(d * SR); out = np.zeros((2, n)); pos = 0; side = 1
    while pos < n:
        p = pos / n; L = int(SR * rng.choice([.005, .008, .011, .016, .022, .03]))
        if rng.random() < .12:
            pos += L // 2; continue                                     # dropout
        rate = .28 ** (p ** 1.4)
        if rng.random() < .3:                                           # crushed white-noise burst
            x = rng.uniform(-1, 1, L) * .7
        else:
            s0 = rng.integers(0, len(src) - 2 * L); seg = src[s0:s0 + int(L * rate) + 2]
            x = np.interp(np.arange(L) * rate, np.arange(len(seg)), seg)
        q = 2 ** int(round(7 - 4.5 * p)); x = np.round(x * q) / q        # bit depth 7 -> ~3 bits
        h = 1 + int(p * 14); x = np.repeat(x[::h], h)[:L]               # sample-rate crush
        x = x * ar(L, .0004, .0006)
        pn = side * rng.uniform(.2, .8); side = -side
        l, r = np.cos((pn + 1) * np.pi / 4) * 1.414, np.sin((pn + 1) * np.pi / 4) * 1.414
        for _ in range(int(rng.integers(2, 6))):
            if pos + L > n: break
            out[0, pos:pos + L] += x * l; out[1, pos:pos + L] += x * r; pos += L
        if pos + L > n: break
    return out * (1 - .35 * np.linspace(0, 1, n))
def power_sag(d=1.0, g=.6):             # "dunnn": pitch-falling saw through a closing filter + relay clunk
    t = tt(d); f = 40 + (112 - 40) * np.exp(-t * 5)
    s = saw(f) * .6 + pulse(f * 1.003, .4) * .3
    s = svf(s, 2600 * np.exp(-t * 4.5) + 110, .55)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR)
    e = np.minimum(1, t / .004) * np.exp(-t * 2.4) * ar(len(t), .0, .08)
    relay = (band(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t * 260) + np.sin(2 * np.pi * 170 * t) * np.exp(-t * 60)) * .5
    return (np.tanh(1.7 * (s * .9 + sub * .75)) * e + relay) * g
def caret_tick(g=.07):
    t = tt(.03); return (np.sin(2 * np.pi * 2350 * t) * np.exp(-t * 260) + band(rng.standard_normal(len(t)), 3000, 9000) * np.exp(-t * 700) * .5) * np.minimum(1, t / .0003) * g

# ---- network / globe ----
def modem(d=1.3):                        # stylized handshake: DTMF "1969" -> answer tone -> FSK -> bee-dong -> scramble
    n = int(d * SR); s = np.zeros(n)
    def put(x, t0):
        i = int(t0 * SR); m = min(len(x), n - i); s[i:i + m] += x[:m]
    keys = {'1': (697, 1209), '9': (852, 1477), '6': (770, 1477)}
    for k, ch in enumerate('1969'):
        a, b = keys[ch]; t = tt(.046); put((np.sin(2 * np.pi * a * t) + np.sin(2 * np.pi * b * t)) * ar(len(t), .003, .004) * .5, k * .062)
    t = tt(.19); put(np.sin(2 * np.pi * 2100 * t + np.pi * (t > .095)) * ar(len(t), .005, .01) * .45, .265)
    t = tt(.22); idx = (t * 300).astype(int); b1 = rng.integers(0, 2, idx[-1] + 1); b2 = rng.integers(0, 2, idx[-1] + 1)
    fsk = np.sin(2 * np.pi * np.cumsum(np.where(b1[idx], 980, 1180)) / SR) * .4 + np.sin(2 * np.pi * np.cumsum(np.where(b2[idx], 1650, 1850)) / SR) * .35
    put(fsk * ar(len(t), .005, .01), .47)
    t = tt(.12); put(np.sin(2 * np.pi * np.cumsum(np.where((t * 28).astype(int) % 2, 1200, 2400)) / SR) * ar(len(t), .004, .01) * .4, .68)
    for a, b in [(.80, .95), (.985, 1.12), (1.15, 1.29)]:
        t = tt(b - a); nz = rng.standard_normal(len(t))
        car = np.sin(2 * np.pi * 1800 * t + np.cumsum(rng.standard_normal(len(t))) * .06)
        am = .6 + .4 * np.sign(np.sin(2 * np.pi * rng.uniform(40, 90) * t))
        put((nz * .55 + car * .5) * am * ar(len(t), .006, .02) * .5, a)
    s = band(s, 300, 3400, .2); s = np.round(s * 48) / 48; s = band(s, 300, 3500, .15)
    return np.tanh(2.2 * s) / 2.2
def plink(m, g=.1, d=.6):                # node ping: soft FM plink
    t = tt(d); f = midi(m); I = 2.0 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.01 * t)) + .25 * np.sin(4 * np.pi * f * t) * np.exp(-t * 25)
    return s * np.minimum(1, t / .001) * np.exp(-t * 8) * ar(len(t), .0, .05) * g
def zap(g=.06):
    d = rng.uniform(.018, .045); t = tt(d)
    crack = band(rng.standard_normal(len(t)) * (rng.random(len(t)) < .22), 2500, 11000) * 2
    chirp = np.sin(2 * np.pi * np.cumsum(5200 * np.exp(-t * 90) + 400) / SR) * .45
    return (crack + chirp) * np.exp(-t / (d * .4)) * np.minimum(1, t / .0005) * ar(len(t), .0, d * .4) * g
def otick(g=.06, f=3600):               # odometer wheel tick
    t = tt(.02); n = rng.standard_normal(len(t))
    return nrm(band(n, f * .6, f * 1.8) * np.exp(-t * 650) + np.sin(2 * np.pi * f * t) * np.exp(-t * 900) * .4 + np.sin(2 * np.pi * f * .31 * t) * np.exp(-t * 400) * .3) * g
def odometer(t0, t1, g=.1, pan=.1):
    tk, k = t0, 0
    while tk < t1 - .012:
        p = (tk - t0) / (t1 - t0); add(otick(g * (.8 + .2 * (k % 2)), 3300 + 500 * (k % 3)), tk, pan=pan + (.12 if k % 2 else -.12), room=.2)
        tk += 1 / (8 + 42 * (1 - p) ** 1.4); k += 1
    t = tt(.08)                                                        # the wheels settle: small clunk
    th = (np.sin(2 * np.pi * np.cumsum(300 + 300 * np.exp(-t * 80)) / SR) * np.exp(-t * 60) * .5 + band(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t * 300))
    add(th * g * 1.6, t1, pan=pan, room=.3)

# ---- windows / cursors / messenger ----
def wpop(f, g=.2):                       # cute window pop: rising "bwip" + octave sparkle
    t = tt(.13); ff = f * (1 - .38 * np.exp(-t * 70))
    s = np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 26) + np.sin(2 * np.pi * np.cumsum(ff * 2) / SR) * np.exp(-t * 55) * .3
    return soft_end(s * np.minimum(1, t / .0008) + pop(f * .5, .25)[:len(t)] * .5, .03) * g
def mclick(g=.25):                       # crisp plastic mouse click (micro-switch)
    t = tt(.05); n = rng.standard_normal(len(t))
    hi = band(n, 2500, 12000) * np.exp(-t * 900)
    s = hi + np.sin(2 * np.pi * rng.uniform(4300, 4800) * t) * np.exp(-t * 650) * .6 \
        + np.sin(2 * np.pi * 1150 * t) * np.exp(-t * 380) * .45 + band(n, 400, 2000) * np.exp(-t * 420) * .5
    i = int(.0035 * SR); s[i:] += hi[:len(s) - i] * .45
    return nrm(s * np.minimum(1, t / .0002)) * g
def keyclick(g=.18, thock=.5):
    t = tt(.09); n = rng.standard_normal(len(t))
    s = band(n, 1800, 7000) * np.exp(-t * 500) + (band(n, 180, 900) * np.exp(-t * 90) + np.sin(2 * np.pi * np.cumsum(260 + 200 * np.exp(-t * 120)) / SR) * np.exp(-t * 70) * .8) * thock
    i = int(.006 * SR); s[i:] += band(n, 600, 3000)[:len(s) - i] * np.exp(-t[:len(s) - i] * 300) * .5
    return nrm(s * np.minimum(1, t / .0003) * ar(len(t), .0, .01)) * g
def thunk(g=.6):                         # retro computer lands on the desk
    t = tt(.6); n = rng.standard_normal(len(t))
    low = np.sin(2 * np.pi * np.cumsum(70 + 85 * np.exp(-t * 45)) / SR) * np.exp(-t * 13)
    modes = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t * k) for f, k, a in [(212, 30, .5), (347, 40, .4), (590, 55, .3), (930, 70, .2), (1480, 90, .12)])
    s = np.tanh(1.5 * (low * .95 + band(n, 180, 1400) * np.exp(-t * 38) * .6 + modes * .6)) + band(n, 2000, 7000) * np.exp(-t * 200) * .3
    return nrm(s * np.minimum(1, t / .0008) * ar(len(t), .0, .05)) * g
def chime(m, g=.15, d=1.0):
    t = tt(d); f = midi(m)
    s = np.sin(2 * np.pi * f * t + .8 * np.exp(-t * 12) * np.sin(2 * np.pi * f * 2 * t)) + .3 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6)
    return s * np.minimum(1, t / .002) * np.exp(-t * 4) * ar(len(t), .0, .05) * g
def paper(d=.2, g=.15, up=True):         # paper swish with crinkle
    w = whoosh(d, 900, 3500, 2200, 8000, 1.0) if up else whoosh(d, 2200, 8000, 900, 3500, 1.0)
    n = len(w); steps = np.repeat(np.abs(rng.standard_normal(n // 60 + 2)), 60)[:n]
    p = np.arange(n) / n
    return nrm(w * (.45 + .55 * lp1(steps, 900)) * np.minimum(1, p / .2) * (1 - p) ** .6) * g

# ---- the Enter key ----
def enter_thock(g=1.0):
    t = tt(1.4); n = rng.standard_normal(len(t))
    thump = np.sin(2 * np.pi * np.cumsum(60 + 95 * np.exp(-t * 38)) / SR) * np.minimum(1, t / .0008) * np.where(t < .022, 1, np.exp(-(t - .022) * 8.5))
    sub = np.sin(2 * np.pi * np.cumsum(38 + 16 * np.exp(-t * 10)) / SR) * np.minimum(1, t / .006) * np.exp(-t * 3.0)
    click = band(n, 1600, 9000) * np.exp(-t * 320) + np.sin(2 * np.pi * 2350 * t) * np.exp(-t * 240) * .5
    plastic = band(n, 300, 1600) * np.exp(-t * 55) * .9 + sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, k, a in [(620, 60, .5), (1040, 80, .35), (1730, 110, .2)])
    mid = np.sin(2 * np.pi * np.cumsum(190 + 160 * np.exp(-t * 90)) / SR) * np.exp(-t * 28) * .7
    s = np.tanh(1.35 * (thump + sub * .7)) + click * .55 + plastic * .5 + mid
    i = int(.017 * SR); s[i:] += band(n, 2000, 6000)[:len(s) - i] * np.exp(-t[:len(s) - i] * 450) * .22   # stabilizer bar
    return nrm(s * ar(len(t), .0, .1)) * g
def shockwave(d=.95, g=.5):
    L = sweep_noise(d, 2500, 12000, 150, 1100, .55); R = sweep_noise(d, 2700, 12500, 165, 1200, .55)
    t = np.arange(len(L)) / SR; e = np.minimum(1, t / .02) * np.exp(-t * 4.2)
    return np.vstack([L * e, R * e]) * g
def whip(d=.22, g=.4):
    w = sweep_noise(d, 400, 1600, 3000, 13000, 1.6); p = np.arange(len(w)) / len(w)
    _, z = glide(500, 3400, d, 2.0)
    return (w * .85 + z[:len(w)] * .2) * p ** 2.4 * ar(len(w), .0, .008) * g

# ---------- music: 120 BPM, D minor ----------
G0, S16, MUS_END = 2.5, .125, 12.96
SECT = [(2.5, 5.0, 'Dm'), (5.0, 7.5, 'Bb'), (7.5, 10.0, 'F'), (10.0, 12.5, 'Gm'), (12.5, MUS_END, 'A')]
def chord_at(t): return next((c for a, b, c in SECT if a <= t < b), None)
BASS_ROOT = {'Dm': 38, 'Bb': 34, 'F': 41, 'Gm': 43, 'A': 33}
ARP_SET = {'Dm': [69, 74, 77, 81, 84, 86], 'Bb': [70, 74, 77, 81, 82, 86], 'F': [69, 72, 77, 81, 84, 88],
           'Gm': [70, 74, 79, 82, 86, 89], 'A': [69, 73, 76, 81, 85, 88]}
PADS = [(2.5, 5.0, [50, 57, 60, 65], 800, .12), (5.0, 7.5, [46, 53, 57, 62], 1000, .12), (7.5, 10.0, [53, 57, 60, 64, 67], 1500, .12),
        (10.0, 12.5, [43, 50, 58, 62, 65, 69], 900, .11), (12.5, MUS_END, [45, 52, 57, 61, 64], 2200, .13)]
GAP = (7.25, 7.5)                                                       # pre-drop breath before the 7.5 hit
def in_gap(t): return GAP[0] <= t < GAP[1]
def kf(t, keys): return np.interp(t, [k[0] for k in keys], [k[1] for k in keys])

def night_pad(notes, d, g, lp, atk=.22, rel=.35):
    n = int(d * SR); t = np.arange(n) / SR; L = np.zeros(n); R = np.zeros(n)
    for m in notes:
        for det in (-.1, -.035, .035, .1):
            s = saw(np.full(n, midi(m) * 2 ** (det / 12)), rng.random())
            if det < 0: L += s
            else: R += s
    e = np.minimum(1, t / atk) * np.clip((d - t) / rel, 0, 1)
    body = pad(notes, d, 1.0)
    L = band(L, 70, lp, .6) * e / len(notes) * .7 + body * .4; R = band(R, 70, lp, .6) * e / len(notes) * .7 + body * .4
    return np.vstack([L, R]) * g

def render_bass():
    """rolling 16th saw/square bass arpeggio, resonant LP with per-note envelope + scene automation, gritty drive."""
    n = int((MUS_END - G0) * SR) + int(.05 * SR)
    f = np.zeros(n); amp = np.zeros(n); tn = np.full(n, 9.0); acc = np.zeros(n)
    PAT = [None, 0, 12, 0, None, 0, 12, 7, None, 0, 12, 0, None, 0, 7, 12]
    PAT_S5 = [None, None, 0, None, None, 0, 12, None, None, None, 0, None, None, 0, 7, 0]
    for s in range(int((MUS_END - G0) / S16) + 1):
        ts = G0 + s * S16
        if ts >= MUS_END - .01 or in_gap(ts): continue
        c = chord_at(ts); iv = (PAT_S5 if c == 'Gm' else PAT)[s % 16]
        if iv is None: continue
        i0 = int(round((ts - G0) * SR)); L = min(int(.104 * SR), n - i0); tl = np.arange(L) / SR
        a = 1.0 if s % 4 == 2 else .8
        f[i0:i0 + L] = midi(BASS_ROOT[c] + iv); tn[i0:i0 + L] = tl; acc[i0:i0 + L] = a
        amp[i0:i0 + L] = np.minimum(1, tl / .002) * np.exp(-tl / .17) * np.clip((L - np.arange(L)) / (.006 * SR), 0, 1) * a
    nz = np.nonzero(f)[0]; fz = np.interp(np.arange(n), nz, f[nz])     # hold pitch through rests (no phase jumps)
    tg = G0 + np.arange(n) / SR
    base = kf(tg, [(2.5, 170), (4.3, 300), (4.95, 560), (5.0, 260), (7.2, 950), (7.5, 420), (9.5, 1050), (10.0, 230),
                   (12.0, 280), (12.5, 520), (12.95, 2800)])
    fc = base * (1 + 4.5 * np.exp(-tn / .05) * acc)
    osc = saw(fz * 1.004) * .45 + saw(fz * .996) * .45 + pulse(fz, .32) * .3
    y = np.tanh(2.4 * svf(osc, fc, .72)) * .6 + np.sin(2 * np.pi * np.cumsum(fz) / SR) * .42
    return y * amp

def render_arp():
    """digital square-pluck 16th arpeggio, filter envelope per note, alternating pan, ping-pong echo send."""
    a0 = 3.5; n = int((MUS_END - a0) * SR) + int(.05 * SR)
    f = np.zeros(n); amp = np.zeros(n); tn = np.full(n, 9.0); pan = np.zeros(n)
    PAT = [0, 2, 4, 1, 3, 5, 2, 4, 0, 3, 5, 2, 4, 1, 3, 5]
    for s in range(int((MUS_END - G0) / S16) + 1):
        ts = G0 + s * S16
        if ts < a0 or ts >= MUS_END - .01 or in_gap(ts): continue
        c = chord_at(ts); m = ARP_SET[c][PAT[s % 16]]
        lvl = kf(ts, [(3.5, .22), (4.5, .45), (5.0, .75), (7.5, .9), (9.9, 1.0), (10.0, .55), (12.1, .55), (12.5, 1.0)])
        i0 = int(round((ts - a0) * SR)); L = min(int(.118 * SR), n - i0); tl = np.arange(L) / SR
        f[i0:i0 + L] = midi(m); tn[i0:i0 + L] = tl; pan[i0:i0 + L] = .55 if s % 2 else -.55
        amp[i0:i0 + L] = np.minimum(1, tl / .0015) * np.exp(-tl / .065) * np.clip((L - np.arange(L)) / (.004 * SR), 0, 1) * lvl * (1.0 if s % 4 == 0 else .82)
    nz = np.nonzero(f)[0]; fz = np.interp(np.arange(n), nz, f[nz])
    tg = a0 + np.arange(n) / SR
    base = kf(tg, [(3.5, 320), (4.5, 520), (5.0, 800), (7.2, 2400), (7.5, 1500), (9.8, 3200), (10.0, 650), (12.1, 800), (12.5, 2200), (12.95, 5500)])
    osc = pulse(fz, .5) * .8 + saw(fz * 2.003) * .2
    y = svf(osc, np.minimum(base * (1 + 6 * np.exp(-tn / .028)), 15000), .38)
    return y * amp, pan, a0

# ================================ SCORE ================================
# ---- S1  0.0 – 2.5 : 1969 CRT terminal, amber code rain ----
add(crt_on(), 0.0, .52, room=.12)
hb = hum_bed(2.6); hb *= ar(len(hb), .0, .1)
add(hb, 0.0, .06, pan=-.05)
wh = crt_whine(2.5); wh *= np.clip((2.45 - tt(2.5)) / .4, 0, 1)                # whine fades into the needle zoom
add(wh, 0.0, .0045, pan=.1)
for tk in events(.14, 2.42, lambda t: 0. if 1.16 <= t < 1.66 else (26. if t < 1.16 else 18.), 26.):   # code rain
    if rng.random() < .7: s = bit(rng.uniform(1700, 4600), rng.uniform(.006, .016), 1.0, rng.uniform(.8, .95))
    else: s = tick(.7, rng.uniform(2200, 5200))
    add(s, tk, rng.uniform(.024, .052), pan=rng.uniform(-.7, .7), room=.25)
for tk, pn in [(.42, -.12), (.78, .08), (1.12, -.04)]:
    add(clack(.5), tk, pan=pn, room=.4)                                         # heavy teletype clacks
add(glitch_burst(.30), 1.16, .34, room=.18)                                     # crash
add(power_sag(), 1.46, .62, room=.12)                                           # "dunnn"
for i in range(14):                                                             # 14 chars in 0.3 s
    add(clack(1.0, heavy=False), 1.42 + i * .3 / 14 + rng.uniform(-.002, .002), rng.uniform(.2, .28), pan=.1 + rng.uniform(-.15, .15), room=.32)
add(caret_tick(.07), 1.6, pan=.05, room=.2); add(caret_tick(.07), 2.1, pan=.05, room=.2)
add_end(riser2(.5, 150, 2600, 1.0, curve=2.6, trem=(5, 40)), 2.5, .58, hall=.12)   # needle zoom
add_end(rev_cymbal(.5, 1.0), 2.5, .3, pan=.1, hall=.15)

# ---- hits ----
def hit(t0, peak, size=1.0, chord=None, clap_g=0.0, cym=0.0, down=0.0, stab_g=.2, kick_kw=None, imp_kw=None):
    """cut hit = kick + impact body (+ clap, stab, cymbal, downlifter). The dry parts are pre-summed and scaled so the
    hit peaks at exactly `peak` (pre-master) — this fixes the loudness hierarchy: ENTER > final > big hits > soft hits."""
    SIDECHAIN.append(t0)
    kk = dict(decay=max(2.5, 6.5 - 2 * size)); kk.update(kick_kw or {})
    ik = dict(decay=4.2 - size * 1.2); ik.update(imp_kw or {})                   # impact boom lands on the chord root
    parts = [(kick_t(size, **kk), 0.0, 0.0, dict(bus='drum')), (impact2(.5 * size, **ik), 0.0, 0.0, dict(hall=.16))]
    if clap_g: parts.append((clap(clap_g), .002, .04, dict(bus='drum', hall=.3, room=.2)))
    if chord: parts.append((stab(chord, .95, stab_g), 0.0, 0.0, dict(hall=.32, echo=.16)))
    if cym: parts.append((cymbal(1.8, cym, 2.2), 0.0, .15, dict(hall=.22)))
    if down: parts.append((downlifter(.9, down), .01, 0.0, dict(hall=.2)))
    n = int(.1 * SR); tmp = np.zeros((2, n))
    for sig, off, pn, kw in parts:
        s2 = sig if np.ndim(sig) == 2 else np.vstack([sig, sig]); i = int(off * SR); m = min(n - i, s2.shape[1])
        tmp[0, i:i + m] += s2[0, :m] * np.cos((pn + 1) * np.pi / 4) * 1.4142; tmp[1, i:i + m] += s2[1, :m] * np.sin((pn + 1) * np.pi / 4) * 1.4142
    sc = peak / np.max(np.abs(tmp))
    for sig, off, pn, kw in parts: add(sig, t0 + off, sc, pan=pn, **kw)
hit(2.5, 1.2, 1.0, [62, 65, 69, 74], clap_g=.34, cym=.11, down=.16, stab_g=.24, imp_kw=dict(f_lo=midi(26)))   # BIG: groove starts
hit(5.0, .8, .62, [58, 62, 65, 70], clap_g=.16, stab_g=.11, imp_kw=dict(f_lo=midi(22)))                         # soft
hit(7.5, 1.05, .9, [60, 65, 69, 72, 76], clap_g=.22, cym=0.0, down=.12, stab_g=.14, imp_kw=dict(f_lo=midi(29)))
hit(10.0, .78, .6, [58, 62, 67, 70], clap_g=.14, stab_g=.1, imp_kw=dict(f_lo=midi(31)))                         # lighter
hit(12.5, 1.05, .92, [57, 61, 64, 69, 73], clap_g=.3, cym=.08, stab_g=.2, imp_kw=dict(f_lo=midi(33)))

# ---- groove: kick, hats, claps ----
KICKS = [G0 + k * .5 for k in range(int((12.5 - G0) / .5) + 1)]
KICKS = [k for k in KICKS if k not in (2.5, 5.0, 7.5, 10.0, 12.5) and not (10.0 < k < 12.5 and (k * 2) % 2)]   # S5 half-time
for k in KICKS: SIDECHAIN.append(k); add(kick(.5) if k > 10.0 else kick_t(.56, decay=8.5, d=.45), k, bus='drum')   # S5: BLIP's rounder kick
HC = [hat2(1.0, .026) for _ in range(6)]; HO = [hat2(1.0, .12) for _ in range(3)]
for j in range(int((12.5 - G0) / S16)):
    ts = G0 + j * S16
    if in_gap(ts) or ts >= 12.5: continue
    c16 = j % 4; sw = .007 if c16 % 2 else 0.0; pn = {0: -.12, 1: -.5, 2: .42, 3: .55}[c16]
    if ts < 5.0:   g = {0: .045, 2: .11}.get(c16, 0)
    elif ts < 7.5: g = {0: .045, 2: .115}.get(c16, .035)
    elif ts < 10.0: g = {0: .05, 2: 0}.get(c16, .04)
    else:          g = {2: .07}.get(c16, 0)
    if ts >= 7.5 and ts < 10.0 and c16 == 2: add(HO[j % 3], ts, .1, pan=.38, bus='drum', room=.1, hall=.05)
    if g and 5.0 <= ts < 7.5 and c16 % 2: add(nrm(hat(1.0, .03)), ts + sw, g, pan=pn, bus='drum')   # S3 ghosts: BLIP's softer noise hat
    elif g: add(HC[j % 6], ts + sw, g, pan=pn, bus='drum')
ROLL = list(np.arange(12.5, 12.75, .125)) + list(np.arange(12.75, 12.875, .0625)) + list(np.arange(12.875, 12.94, .03125))
for j, ts in enumerate(ROLL):                                                   # S6 build: 16ths -> 32nds -> 64ths
    p = (ts - 12.5) / .46; add(hat2(1.0, .022, 1 + .3 * p), ts, .03 + .09 * p ** 1.5, pan=(-.4 if j % 2 else .4) * (1 - p), bus='drum')
for c in (6.0, 7.0): add(clap(.17), c, pan=.05, bus='drum', room=.25)
for c in (8.0, 9.0): add(clap(.2), c, pan=.05, bus='drum', hall=.12, room=.2)
def snap(g=.12):
    t = tt(.09); return (band(rng.standard_normal(len(t)), 1500, 6500) * np.exp(-t * 55) + np.sin(2 * np.pi * 1750 * t) * np.exp(-t * 90) * .4) * g
for c in (10.5, 11.5): add(snap(.14), c, pan=-.1, bus='drum', hall=.2, room=.2)

# ---- bass, arp, pad ----
add(render_bass(), G0, .42, bus='mus')
arp, arp_pan, a0 = render_arp(); add(arp, a0, .26, pan=arp_pan, bus='mus', echo=.3, hall=.1)
for a, b, notes, lp, g in PADS:
    last = b == MUS_END; d = b - a + (0 if last else .35)
    p_ = night_pad(notes, d, g, lp, atk=.12 if a in (2.5, 12.5) else .25, rel=.015 if last else .35)
    if last: p_ *= np.linspace(.6, 1.25, p_.shape[1])                            # swell into the Enter key
    add(p_, a, 1.0, bus='mus', hall=.22)

# ---- S2  2.5 – 5.0 : paper title, dots decode ----
decode(2.5, .8, .045, 0.0, .85, 320., 2000, 8000, power=2.0)                   # dense -> 0 by 3.3
add(bit(midi(98), .06, .05), 3.3, pan=0.0, hall=.25, echo=.2)                   # resolved
add(paper(.2, .16), 3.0, pan=-.15, room=.2); add(paper(.2, .13), 3.12, pan=.15, room=.2)
add_end(sweep_noise(.6, 300, 1300, 2200, 9500, 1.5) * np.linspace(0, 1, int(.6 * SR)) ** 1.8, 5.0, .34, hall=.12)   # morph whoosh
def spinup(d=.6, g=.3):
    t = tt(d); p = t / d; f = 90 * (1400 / 90) ** (p ** 1.6); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + .5 * np.sin(2 * ph + .5) + .25 * np.sin(3 * ph) + .12 * np.sin(5 * ph)
    return s * (.7 + .3 * np.sin(2 * np.pi * np.cumsum(f * .25) / SR)) * p ** 1.8 * ar(len(t), .02, .004) * g
add_end(spinup(.6, 1.0), 5.0, .2, pan=-.05, hall=.1)

# ---- S3  5.0 – 7.5 : night globe, ARPANET -> WWW -> 2026 ----
add(modem(1.3), 5.0, .32, pan=.3, bus='duckfx', room=.15)
for tk, m, pn in [(5.18, 81, -.4), (5.27, 84, .3), (5.36, 86, -.15), (5.45, 89, .45)]:
    add(plink(m, 1.0), tk, .13, pan=pn, hall=.25, echo=.25)
for tk in sorted(rng.uniform(5.24, 5.6, 8)): add(zap(1.0), tk, rng.uniform(.04, .07), pan=rng.uniform(-.6, .6), room=.1)
odometer(5.78, 6.20, .1, .12); odometer(6.36, 6.78, .1, -.08)
add(soft_end(bell(93, 1.7, 1.0), .1), 5.86, .16, pan=-.22, hall=.4, echo=.22); add(soft_end(bell(100, 1.0, 1.0), .1), 5.865, .035, pan=-.22, hall=.4)   # CERN
PENTA = [74, 77, 79, 81, 84, 86, 89, 91, 93, 96, 98]
for tk in events(6.38, 7.1, lambda t: 10 + 80 * ((t - 6.38) / .72) ** 1.6, 90.):  # rain of plinks
    m = int(rng.choice(PENTA)); s = plink(m, 1.0, .45) * .7; s[:int(.3 * SR)] += soft_end(pluck(m, .3, 1.0)) * .3
    add(s, tk, rng.uniform(.035, .06), pan=rng.uniform(-.9, .9), hall=.2, echo=.15)
add_end(riser2(.4, 160, 2200, 1.0, curve=2.6, trem=(6, 44)), 7.5, .58, hall=.12)   # dive
add_end(riser(.4, 1.0), 7.5, .2)
add_end(rev_cymbal(.4, 1.0), 7.5, .25, pan=-.1)

for tk in events(5.0, 12.1, lambda t: 0. if (7.25 < t < 7.6 or 9.5 < t < 10.05) else 16., 16.):   # data shimmer bed: the system is alive
    add(bit(float(rng.choice([2349, 2794, 3136, 3520, 4186, 4699, 5588])), rng.uniform(.008, .02), 1.0, rng.choice([1.0, .94])), tk,
        rng.uniform(.012, .024), pan=float(rng.choice([-1, 1]) * rng.uniform(.5, .95)), echo=.25, hall=.1)

# ---- S4  7.5 – 10.0 : ten "hello" windows, three cursors ----
POPS = [72, 74, 77, 79, 81, 84, 86, 89, 91, 93]
PANS = [-0.66, 0.63, -0.73, 0.68, -0.26, 0.29, -0.15, 0.22, 0.93, -0.93]
for i, (m, pn) in enumerate(zip(POPS, PANS)):
    t0 = 7.56 + i * .04
    add(wpop(midi(m), 1.0), t0, .22, pan=pn, room=.15, echo=.08)
    decode(t0 + .03, .3, .022, pn * .9, .1, 45., 2200, 6500)
add(paper(.22, .12, up=False), 8.12, pan=-.2, room=.2); add(paper(.22, .1, up=False), 8.24, pan=.2, room=.2)
for tk, pn in [(8.78, .7), (8.86, .7), (9.02, -.65), (9.20, .63), (9.46, -.73)]:
    add(mclick(1.0), tk, .3, pan=pn, room=.18)
w = sweep_noise(.45, 3000, 11000, 300, 1500, .8)                               # reverse whoosh: sucked into the screen
add_end(w * np.linspace(0, 1, len(w)) ** 1.8 * ar(len(w), 0, .004), 10.0, .4, hall=.1)
for tk in events(9.55, 9.995, lambda t: 40 + 200 * ((t - 9.55) / .45) ** 1.4, 240.):
    p = (tk - 9.55) / .45
    add(bit(rng.uniform(1500, 3500) * (1 + 1.4 * p), rng.uniform(.006, .012), 1.0, 1.15), tk, .03 + .045 * p,
        pan=float(rng.choice([-1, 1]) * .95 * (1 - p) ** 1.2 * rng.uniform(.6, 1)), room=.1)
_, rs = glide(300, 1800, .45, 2.2); add_end(rs * np.linspace(0, 1, len(rs)) ** 2.5 * ar(len(rs), 0, .004), 10.0, .08)

# ---- S5  10.0 – 12.5 : the retro computer lands, messenger ----
add(thunk(1.0), 10.34, .85, pan=-.05, room=.3, hall=.08)
for k, dt_ in enumerate([.065, .11, .145, .17, .19, .205]):                     # settle rattle
    add(otick(1.0, rng.uniform(2200, 4200)), 10.34 + dt_, .16 * .72 ** k, pan=rng.uniform(-.3, .3), room=.3)
add(keyclick(1.0), 10.62, .34, pan=.12, room=.25); add(keyclick(1.0), 10.80, .3, pan=.16, room=.25)
add(soft_end(boop(520, 1350, .14, 1.0), .03), 11.0, .2, pan=.05, hall=.15, echo=.18)           # send
add(whoosh(.25, 1200, 4000, 3000, 9000, 1.0), 11.0, .05, pan=.2)
for k in range(9):                                                              # typing indicator: three dots x3
    tk = 11.42 + (k // 3) * .16 + (k % 3) * .05
    add(soft_end(blip((1400, 1650, 1900)[k % 3], .03, 1.0), .01), tk, .045, pan=-.2 + (k % 3) * .2, room=.2)
add(chime(81, 1.0), 11.86, .2, pan=-.1, hall=.3, echo=.2); add(chime(86, 1.0), 11.95, .19, pan=.1, hall=.3, echo=.2)
decode(11.86, .24, .02, 0.0, .4, 70., 2500, 7000)
add_end(riser2(.4, 220, 1760, 1.0, curve=2.2, trem=(6, 36)), 12.5, .55, hall=.12)   # push-in
add_end(rev_cymbal(.4, 1.0), 12.5, .22, pan=.1)

# ---- S6  12.5 – 15.0 : Enter, end card ----
th = enter_thock(1.0)
hp_th = band(th, 300, 9000); tail = verb(np.vstack([hp_th, hp_th]), IR_HALL)[0][:int(.32 * SR)]   # reverse suck into the key
suck = nrm(tail[::-1]) * np.linspace(0, 1, len(tail)) ** 2
add_end(suck, 12.975, .1, pan=0.0)
add(th, 12.98, 2.0, hall=.18, room=.15)
SIDECHAIN.append(12.98)
add(shockwave(.95, 1.0), 13.04, .3, hall=.25)
for tk in events(13.04, 13.5, lambda t: 140 * np.exp(-(t - 13.04) * 7), 140.):  # glittery glyph burst
    add(sparkle(rng.uniform(3500, 8000), rng.uniform(.03, .08), 1.0), tk, rng.uniform(.02, .045), pan=rng.uniform(-.95, .95), hall=.25, echo=.12)
fr = sweep_noise(.14, 900, 2600, 1300, 3600, 1.0)                               # key release: spring friction + top-out click
add(fr * np.sin(np.pi * np.arange(len(fr)) / len(fr)), 13.2, .03, room=.2)
add(keyclick(1.0, .25), 13.335, .26, room=.25)
add_end(whip(.22, 1.0), 13.5, .42, pan=np.linspace(-.75, .75, int(.22 * SR)), hall=.1)
# final hit + chord bloom Dm(add9) -> resolve (9 -> 8) at 14.1
hit(13.5, 1.4, 1.1, None, clap_g=.3, cym=.1, kick_kw=dict(decay=4.0, d=.8), imp_kw=dict(decay=1.9, d=1.5, f_lo=midi(26)))
def bloom(d=1.5, g=.2):
    n = int(d * SR); t = np.arange(n) / SR
    A = [50, 57, 62, 64, 65, 69, 76]; B = [50, 57, 62, 65, 69, 74, 77]
    xf = .5 - .5 * np.cos(np.pi * np.clip((t - .6) / .35, 0, 1)); L = np.zeros(n); R = np.zeros(n)
    for chord, w_ in ((A, 1 - xf), (B, xf)):
        for m in chord:
            for det, side in ((-.08, 0), (.08, 1), (-.025, 1), (.03, 0)):
                s = saw(np.full(n, midi(m) * 2 ** (det / 12)), rng.random()) * w_
                if side: R += s
                else: L += s
    fc = 700 + 3000 * np.minimum(1, t / .12) ** 1.5 * np.exp(-t * .8)
    body = pad(A, d + 2, 1.0)[:n] * (1 - xf) + pad(B, d + 2, 1.0)[:n] * xf
    e = np.minimum(1, t / .03)
    return np.vstack([svf(L, fc, .2) / len(A) * .6 + body * .5, svf(R, fc, .2) / len(A) * .6 + body * .5]) * e * g
add(bloom(1.5, 1.0), 13.5, .3, bus='mus', hall=.5, echo=.12)
add(bass(38, 1.5, 1.0), 13.5, .3, bus='mus')
for j, m in enumerate([74, 81, 86, 88, 89, 93]):
    add(soft_end(bell(m, 1.5, 1.0), .1), 13.5 + j * .045, .07, pan=-.5 + j * .2, hall=.45, echo=.2)
add(bell(86, 1.0, 1.0), 14.1, .05, pan=.1, hall=.5, echo=.2)                     # the resolution
for tk in events(13.52, 14.1, lambda t: 6 + 110 * (1 - (t - 13.52) / .58) ** 1.3, 116.):   # sparkle cascade (glyphs fall into dots)
    p = (tk - 13.52) / .58
    add(bit(rng.uniform(3500, 7500) * (1 - .4 * p), rng.uniform(.01, .024), 1.0, .72), tk, rng.uniform(.018, .036) * (1 - .3 * p),
        pan=rng.uniform(-.9, .9) * (1 - .7 * p), hall=.2, echo=.1)
add(paper(.22, .09), 14.0, pan=.1, room=.2)
decode(14.2, .16, .02, 0.0, .3, 60., 2500, 6500)
add(mclick(1.0), 14.6, .42, pan=0.0, room=.2, hall=.1); add(caret_tick(.05), 14.6, pan=0.0, hall=.2)

# ================================ MIX / MASTER ================================
def duck_env(times, depth=.5, rel=.24):
    d = np.ones(N); n = int(rel * SR) + int(.003 * SR); t = (np.arange(n) - int(.003 * SR)) / SR
    shape = 1 - depth * np.where(t < 0, (t + .003) / .003, .5 + .5 * np.cos(np.pi * np.clip(t / rel, 0, 1)))
    for tk in times:
        i0 = int(round(tk * SR)) - int(.003 * SR); m = min(n, N - i0)
        if m > 0: d[i0:i0 + m] = np.minimum(d[i0:i0 + m], shape[:m])
    return d
def pingpong(send, D=.375, fb=.42, taps=6):
    src = send[0] * .5 + send[1] * .5; out = np.zeros((2, N)); k_ = int(D * SR)
    for k in range(1, taps + 1):
        sh = np.zeros(N); sh[k * k_:] = src[:N - k * k_]
        out[(k - 1) % 2] += band(sh, 250, 7000 * .78 ** k) * fb ** (k - 1)
    return out
def compress(x, thr_db=-10.0, ratio=2.0, atk=.001, rel=.15, look=.005, B=48):
    mono = np.max(np.abs(x), axis=0); nb = len(mono) // B + 1
    pk = np.zeros(nb * B); pk[:len(mono)] = mono; pk = pk.reshape(nb, B).max(1)
    la = pk.copy()
    for j in range(1, int(look * SR / B) + 1): la[:-j] = np.maximum(la[:-j], pk[j:])
    thr = 10 ** (thr_db / 20) * pk.max()
    gdb = -(1 - 1 / ratio) * 20 * np.log10(np.maximum(la / thr, 1.0))
    aa, rr = np.exp(-B / (atk * SR)), np.exp(-B / (rel * SR)); g = np.empty(nb); s = 0.0
    for j, tg in enumerate(gdb.tolist()):
        c = aa if tg < s else rr; s = c * s + (1 - c) * tg; g[j] = s
    return x * np.interp(np.arange(x.shape[1]), (np.arange(nb) + .5) * B, 10 ** (g / 20))

duck = duck_env(sorted(SIDECHAIN), .5, .24)
hall = verb(BUS['hall'], IR_HALL); room = verb(BUS['room'], IR_ROOM); echo = pingpong(BUS['echo'])
mix = BUS['drum'] + (BUS['mus'] + BUS['duckfx']) * duck + BUS['sfx'] + hall * .42 + room * .38 + echo * duck * .55
def master_eq(ch):                                                              # 22 Hz high-pass + soft air shelf (-0.9 dB > 14 kHz)
    X = np.fft.rfft(ch); f = np.fft.rfftfreq(len(ch), 1 / SR)
    hp = np.clip((f - 15) / 7, 0, 1); shelf = 1 - .1 * np.clip((f - 9000) / 5000, 0, 1)
    return np.fft.irfft(X * hp * shelf, len(ch))
mix = np.vstack([master_eq(ch) for ch in mix])
pre_peak = float(np.max(np.abs(mix)))
mix = compress(mix / pre_peak)
mix = mix / np.max(np.abs(mix)); K = .88                                         # soft-knee clip: only the residual overshoot
mix = np.where(np.abs(mix) > K, np.sign(mix) * (K + (1 - K) * np.tanh((np.abs(mix) - K) / (1 - K))), mix)
fade = np.clip(t_all / .002, 0, 1) * (.5 + .5 * np.cos(np.pi * np.clip((t_all - 14.6) / .4, 0, 1)))
mix = mix * fade
mix = mix / np.max(np.abs(mix)) * 10 ** (-1 / 20)                               # -1 dBFS
out = np.round(mix.T * 32767).astype(np.int16)
os.makedirs(os.path.dirname(os.path.abspath(OUT_WAV)), exist_ok=True)
with wave.open(OUT_WAV, 'wb') as w_:
    w_.setnchannels(2); w_.setsampwidth(2); w_.setframerate(SR); w_.writeframes(out.tobytes())

# ================================ VERIFY ================================
x = out.astype(float) / 32768
db = lambda v: 20 * np.log10(max(v, 1e-12))
print(f'wrote {OUT_WAV}  samples/ch={x.shape[0]} (expect {N})  channels={x.shape[1]}  render {time.time() - T_RUN:.1f}s')
print(f'finite: {bool(np.all(np.isfinite(mix)))}   peak L {db(np.max(np.abs(x[:, 0]))):.2f} dBFS  R {db(np.max(np.abs(x[:, 1]))):.2f} dBFS'
      f'   int16 extremes {out.min()} .. {out.max()}   pre-master peak {pre_peak:.2f}')
print('RMS per second (dBFS):', ' '.join(f'{s}s:{db(np.sqrt(np.mean(x[s * SR:(s + 1) * SR] ** 2))):.1f}' for s in range(15)))
blk = 48; e = np.abs(x).max(1)[:N // blk * blk].reshape(-1, blk).max(1)          # 1 ms broadband peak envelope
def benv(lo, hi):
    y = np.vstack([band(x[:, 0], lo, hi), band(x[:, 1], lo, hi)]); return np.abs(y).max(0)[:N // blk * blk].reshape(-1, blk).max(1)
ENV = {'lf': benv(25, 180), 'mid': benv(600, 3000), 'hf': benv(2500, 16000)}
CUES = [('CRT on', 0.0, 'lf'), ('clack', .42, 'hf'), ('clack', .78, 'hf'), ('clack', 1.12, 'hf'), ('sag dunnn', 1.46, 'lf'), ('caret', 1.6, 'mid'),
        ('HIT', 2.5, 'lf'), ('paper', 3.0, 'hf'), ('paper', 3.12, 'hf'), ('hit', 5.0, 'lf'), ('CERN bell', 5.86, 'hf'), ('HIT', 7.5, 'lf'),
        ('pop 0', 7.56, 'mid'), ('click', 8.78, 'hf'), ('click', 8.86, 'hf'), ('click', 9.02, 'hf'), ('click', 9.20, 'hf'), ('click', 9.46, 'hf'),
        ('hit', 10.0, 'lf'), ('thunk', 10.34, 'lf'), ('key', 10.62, 'hf'), ('key', 10.80, 'hf'), ('send', 11.0, 'mid'), ('chime', 11.86, 'mid'),
        ('HIT', 12.5, 'lf'), ('ENTER', 12.98, 'lf'), ('release', 13.335, 'hf'), ('FINAL', 13.5, 'lf'), ('cursor', 14.6, 'hf')]
print('cue          t     band  onset err(ms)  broadband peak dBFS (cue window)')
for name, tc, bd in CUES:
    v = ENV[bd]; a = max(0, int((tc - .015) * 1000)); seg = v[a:int((tc + .05) * 1000)]; j = int(np.argmax(seg))
    base = float(np.median(v[max(0, a - 40):a])) if a > 0 else 0.0
    on = int(np.argmax(seg >= base + .5 * (seg[j] - base)))
    print(f'{name:11s} {tc:6.3f}  {bd:4s}  {a + on - tc * 1000:+5.0f}          {db(e[int(tc * 1000):int(tc * 1000) + 60].max()):6.1f}')
top = np.argsort(e)[::-1]; picks = []
for i in top:
    if all(abs(i - p) > 150 for p in picks): picks.append(int(i))
    if len(picks) == 6: break
print('loudest transients (s, dBFS):', ', '.join(f'{p / 1000:.3f}:{db(e[p]):.2f}' for p in picks))
if OUT_WAV.endswith('.wav') and shutil.which('afconvert'):
    m4a = OUT_WAV[:-4] + '.m4a'
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '256000', OUT_WAV, m4a], check=True)
    print('wrote', m4a, os.path.getsize(m4a), 'bytes')
