# BLIP. — 15 s soundtrack, fully synthesized (numpy only). The cuts ARE the rhythm: every cut gets a hit,
# the stage cuts (0.85 s) and pet cuts (0.65 s) accelerate the pulse; each pet has its own little voice.
# usage: python3 tools/sound.py out.wav
import sys, numpy as np, wave

SR = 48000; DUR = 15.0; N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N); R = np.zeros(N)
t_all = np.arange(N) / SR

def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(round(t0 * SR)); n = min(len(sig), N - i0)
    if n <= 0 or i0 < 0: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i0:i0 + n] += sig[:n] * gain * l * 1.414; R[i0:i0 + n] += sig[:n] * gain * r * 1.414

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

# ---------- instruments ----------
def kick(g=1.0, f0=150, f1=44):
    t = tt(.5); f = f1 + (f0 - f1) * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) + band(rng.standard_normal(len(t)), 2000, 7000) * np.exp(-t * 90) * .15) * g
def clap(g=.5):
    t = tt(.28); n = band(rng.standard_normal(len(t)), 900, 5000)
    e = sum(np.exp(-np.maximum(t - d, 0) * 60) * (t >= d) for d in (0, .011, .022)) / 2 + np.exp(-t * 14) * .5
    return n * e * g
def hat(g=.2, d=.05): t = tt(d * 3); return band(rng.standard_normal(len(t)), 6500, 16000) * np.exp(-t / d * 3) * g
def blip(f=1200, d=.06, g=.25, shape='sine'):     # LED bleep
    t = tt(d); ph = 2 * np.pi * f * t
    s = np.sin(ph) if shape == 'sine' else np.sign(np.sin(ph)) * .55 + np.sin(ph) * .45
    return s * env(t, .002, d * .35) * g
def boop(f0=480, f1=980, d=.16, g=.35):            # cute rising boop
    t, s = glide(f0, f1, d, .6); return (s + .3 * np.sin(2 * np.arange(len(t)) * 0)) * env(t, .004, d * .45) * g
def pluck(m, d=.35, g=.18):
    t = tt(d); f = midi(m)
    s = np.sin(2 * np.pi * f * t) + .45 * np.sin(4 * np.pi * f * t) * np.exp(-t * 18) + .2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 30)
    return s * env(t, .003, d * .3) * g
def bell(m, d=1.2, g=.16):
    t = tt(d); f = midi(m)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k) for r, a, k in [(1, 1, 2.5), (2.76, .45, 5), (5.4, .25, 9), (8.9, .12, 14)])
    return s * np.minimum(1, t / .002) * g
def pad(notes, d, g=.07):
    t = tt(d); out = np.zeros(len(t))
    for m in notes:
        for det in (-.07, .07):
            f = midi(m) * (1 + det / 100 * 6); ph = 2 * np.pi * f * t
            out += np.sin(ph) + .25 * np.sin(2 * ph + .3) + .1 * np.sin(3 * ph)
    e = np.minimum(1, t / .35) * np.minimum(1, (d - t) / .4)
    return out * e * g / len(notes)
def bass(m, d, g=.3):
    t = tt(d); f = midi(m); s = np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t) + .1 * np.sin(6 * np.pi * f * t)
    return s * np.minimum(1, t / .01) * np.exp(-t * 1.6) * g
def whoosh(d, lo0, hi0, lo1, hi1, g=.4, rev=False):
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n); B = 2048
    for i in range(0, n, B // 2):                 # block-wise moving band
        p = i / n; seg = x[i:i + B]
        if len(seg) < 64: break
        w = np.hanning(len(seg)); out[i:i + len(seg)] += band(seg, lo0 + (lo1 - lo0) * p, hi0 + (hi1 - hi0) * p) * w
    p = np.arange(n) / n; e = (p ** 2.2) if rev else np.sin(np.pi * p) ** 1.4
    return out * e * g
def riser(d, g=.45):
    w = whoosh(d, 300, 1500, 2500, 12000, g * .8, rev=True)
    t, s = glide(180, 1400, d, 2.0); return w + s * (np.arange(len(t)) / len(t)) ** 3 * g * .25
def impact(g=.8):
    t = tt(1.6); boom = np.sin(2 * np.pi * np.cumsum(36 + 80 * np.exp(-t * 18)) / SR) * np.exp(-t * 2.8)
    air = band(rng.standard_normal(len(t)), 200, 3000) * np.exp(-t * 7) * .3
    return (boom + air) * g
def pop(f=900, g=.32):
    t = tt(.13); return np.sin(2 * np.pi * np.cumsum(f * (1 + 1.6 * np.exp(-t * 55))) / SR) * np.exp(-t * 34) * g
def tick(g=.12, f=3200): t = tt(.03); return band(rng.standard_normal(len(t)), f * .7, f * 1.6) * np.exp(-t * 200) * g + np.sin(2 * np.pi * f * .5 * t) * np.exp(-t * 300) * g
def heartbeat(g=.6): t = tt(.25); return np.sin(2 * np.pi * np.cumsum(70 + 40 * np.exp(-t * 30)) / SR) * np.exp(-t * 14) * g

# ---------- pet voices ----------
def grump_growl(d=.42, g=.32):
    t = tt(d); f = 95 + 25 * np.sin(2 * np.pi * 4 * t); ph = 2 * np.pi * np.cumsum(f) / SR
    saw = sum(np.sin(k * ph) / k for k in range(1, 14)); trem = .6 + .4 * np.sign(np.sin(2 * np.pi * 26 * t))
    return lp1(saw * trem, 900 + 600 * np.sin(np.pi * t / d)) * np.sin(np.pi * t / d) ** .6 * g
def huff(g=.35): t = tt(.32); return band(rng.standard_normal(len(t)), 400, 2500) * np.sin(np.pi * np.minimum(t / .32, 1)) ** 1.5 * np.exp(-t * 4) * g
def mochi_mwah(g=.3):
    t = tt(.34); f = 700 + 500 * np.sin(np.pi * t / .34) + 25 * np.sin(2 * np.pi * 9 * t); s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return (s + .2 * np.sin(2 * 2 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * t / .34) * g
def boing(g=.28, f0=220, f1=520):
    t = tt(.22); f = f0 + (f1 - f0) * (1 - np.exp(-t * 22)) + 30 * np.sin(2 * np.pi * 22 * t) * np.exp(-t * 10)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, .003, .09) * g
def doze_yawn(g=.3):
    t = tt(.75); f = 420 * (240 / 420) ** (t / .75) ; s = np.sin(2 * np.pi * np.cumsum(f) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    breath = band(rng.standard_normal(len(t)), 500, 2200) * .25
    return (s * .8 + breath) * np.sin(np.pi * t / .75) ** 1.3 * g
def snore(g=.18): t = tt(.6); return band(rng.standard_normal(len(t)), 80, 600) * (np.sin(2 * np.pi * 28 * t) * .5 + .5) * np.sin(np.pi * t / .6) * g
def zip_chirps(n=5, g=.22):
    out = np.zeros(int(.5 * SR))
    for i in range(n):
        s = boop(900 + i * 180, 1500 + i * 220, .05, 1.0); i0 = int(i * .062 * SR); out[i0:i0 + len(s)] += s[:len(out) - i0]
    return out * g

# ---------- bed: pad + bass, one chord per section ----------
SECT = [(0.0, 1.6, [53, 60, 65], None), (1.6, 3.0, [53, 57, 60, 64], 41), (3.0, 6.4, [57, 60, 64, 67], 45), (6.4, 9.9, [58, 62, 65, 69], 46),
        (9.9, 12.9, [60, 64, 67, 71], 48), (12.9, 15.0, [53, 57, 60, 64, 67], 41)]
for a, b, ch, bs in SECT:
    add(pad(ch, b - a + .5, .085 if a else .05), a, pan=-.05)
    if bs: add(bass(bs, b - a + .2, .32), a)
# sparkle arpeggio (141 BPM sixteenths) from the title on, follows the section chords
step = 60 / 141 / 4
for k in range(int((15 - 1.6) / step)):
    t0 = 1.6 + k * step
    if 7.0 <= t0 < 7.3 or 12.6 <= t0 < 12.9 or t0 > 14.6: continue
    ch = [c for a, b, c, _ in SECT if a <= t0 < b][0]
    m = ch[[0, 2, 1, 3, 2, 1][k % 6] % len(ch)] + 12
    add(pluck(m, .22, .075 if k % 4 else .1), t0, pan=.35 if k % 2 else -.35)

# ---------- the cut rhythm ----------
CUTS = [1.6, 3.0, 3.85, 4.7, 5.55, 6.4, 7.3, 7.95, 8.6, 9.25, 9.9, 10.9, 12.9]
for c in CUTS: add(kick(.85), c)
for c in [3.85, 4.7, 5.55, 7.95, 8.6, 9.25]: add(clap(.38), c + .0, pan=.1)
for i in range(int((12.6 - 3.0) / .2125)):          # light hat pulse under the middle
    t0 = 3.0 + i * .2125
    if 7.0 <= t0 < 7.3: continue
    add(hat(.13 if i % 2 else .07), t0, pan=.4 if i % 2 else -.3)

# ---------- picture sfx ----------
add(band(rng.standard_normal(int(1.6 * SR)), 40, 160) * np.minimum(1, tt(1.6) / .5) * .5, 0)  # dark room tone
add(blip(220, .25, .25, 'sq'), .26, pan=-.1); add(blip(330, .2, .18, 'sq'), .3, pan=.1)          # power on
for i in range(6): add(tick(.08, 2400 + i * 300), .27 + i * .033)
add(boop(420, 980, .18, .4), .86)                                                                  # eyes open
add(tick(.12, 2600), 1.0); add(blip(1800, .03, .14), 1.1); add(blip(1500, .03, .12), 1.2)        # look + blink
add(riser(.32, .5), 1.28); add(impact(.75), 1.6)
for i in range(4): add(tick(.16, 1600 - i * 120), 1.66 + i * .06)                                  # letters
add(pop(1100, .34), 1.98); add(boop(700, 1300, .1, .2), 2.0)
for i in range(0, 30, 2): add(blip(2100 + (i % 6) * 120, .025, .07), 2.08 + i / 58, pan=-.3 + i / 50)  # typing
add(blip(1700, .03, .12), 2.5); add(boop(900, 500, .2, .2), 2.7)                                    # blink, dozes off
add(riser(.3, .45), 2.7); add(impact(.6), 3.0)
add(snore(.16), 3.2, pan=.3)
for i, c in enumerate([3.85, 4.7, 5.55]):                                                          # level-ups
    base = 72 + i * 3
    for j, iv in enumerate([0, 4, 7, 12]): add(blip(midi(base + iv), .07, .16, 'sq'), c + j * .045, pan=.2)
    add(whoosh(.25, 400, 1500, 1500, 6000, .18), c - .16)
add(boop(900, 1400, .08, .2), 4.15); add(boop(1000, 1600, .08, .2), 4.26)                          # BABY: hi!
add(boop(700, 420, .22, .22), 4.85)                                                                  # TEEN: hmph
add(heartbeat(.55), 5.81); add(heartbeat(.45), 5.99)                                                 # BESTIE
add(whoosh(.5, 300, 1200, 120, 600, .3), 6.4)                                                        # pull back
for i in range(3): add(blip(880 + i * 220, .05, .1, 'sq'), 6.5 + i * .07, pan=-.4 + i * .3)
add(riser(.3, .5), 7.0); add(impact(.85), 7.3)
add(grump_growl(), 7.36, pan=-.15); add(huff(.4), 7.58, pan=-.1)                                     # GRUMP
add(whoosh(.36, 300, 1500, 800, 5000, .25), 7.77)
add(mochi_mwah(.28), 8.02, pan=-.1); add(boing(.26), 8.32); add(bell(84, .8, .08), 8.12, pan=.4)     # MOCHI
add(whoosh(.36, 800, 4000, 200, 900, .25), 8.42)
add(doze_yawn(.3), 8.66, pan=-.1); add(snore(.12), 9.0, pan=.2)                                      # DOZE
add(whoosh(.36, 300, 1200, 1500, 8000, .25), 9.07)
add(zip_chirps(5, .24), 9.3, pan=-.1); add(boing(.22, 300, 800), 9.5); add(boing(.2, 320, 850), 9.885)  # ZIP
add(whoosh(.45, 400, 2500, 200, 1200, .25), 9.9)
for i, (t0, f) in enumerate([(10.0, 520), (10.07, 660), (10.14, 780)]): add(pop(f, .3), t0, pan=-.5 + i * .4)
for j, m in enumerate([72, 76, 79, 84]): add(bell(m, 1.0, .07), 10.3 + j * .05, pan=-.3 + j * .2)
add(impact(.55), 10.9)
for i in range(13): add(tick(.11 if i % 4 else .16, 3000), 11.0 + i * .12, pan=.25)                # clock
def nowAt(t):
    p = min(max((t - 11.0) / 1.55, 0), 1); e = (2 * p) ** 2.4 / 2 if p < .5 else 1 - (2 - 2 * p) ** 2.4 / 2
    return 7 + 10.3 * e
def tAt(h):
    a, b = 11.0, 12.55
    for _ in range(40):
        m = (a + b) / 2
        if nowAt(m) < h: a = m
        else: b = m
    return b
for i, h in enumerate([7.25, 12.75, 16.25]): add(pop(700 + i * 160, .3), tAt(h), pan=.3); add(blip(1400 + i * 200, .05, .1), tAt(h) + .04)
add(bell(88, .9, .12), 12.3, pan=-.3); add(bell(91, .9, .1), 12.42, pan=-.3)                        # notification ♥
add(riser(.3, .5), 12.6); add(impact(.95), 12.9)
add(pad([53, 57, 60, 64, 67, 72], 2.1, .12), 12.9)
for i in range(4): add(tick(.15, 1500 - i * 100), 13.08 + i * .05)
add(zip_chirps(3, .18), 13.4, pan=.2)
add(pop(1100, .3), 13.42)
for i in range(0, 14, 2): add(blip(1900 + i * 30, .025, .07), 13.62 + i / 30)
add(grump_growl(.3, .2), 13.86, pan=-.2)
add(pop(800, .32), 14.0); add(blip(1200, .06, .12), 14.05)
add(mochi_mwah(.26), 14.42, pan=-.1)
for j, m in enumerate([79, 84, 88, 91]): add(bell(m, 1.2, .08), 14.45 + j * .06, pan=-.3 + j * .2)

# ---------- synced to the pets' body language (landings / huffs / evolution sparks) ----------
def shimmer(g=.12):
    out = np.zeros(int(.6 * SR))
    for j, m in enumerate([84, 88, 91, 96, 100]):
        s_ = bell(m, .5, 1.0); i0 = int(j * .03 * SR); out[i0:i0 + len(s_)] += s_[:len(out) - i0]
    return out * g
for c in [7.91, 8.56, 9.21]: add(shimmer(.1), c, pan=-.2)
add(huff(.25), 10.1, pan=-.6); add(grump_growl(.25, .14), 10.02, pan=-.6)
add(boing(.14), 10.43, pan=-.2); add(boing(.12, 300, 800), 10.27, pan=.6); add(boing(.12, 320, 850), 10.65, pan=.6)
add(snore(.08), 10.3, pan=.2)
add(boing(.15, 300, 800), 13.73, pan=-.1); add(huff(.28), 13.89, pan=-.1); add(boing(.16), 14.64, pan=-.1)

# ---------- master ----------
mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.2) * .9
mix *= np.clip((DUR - t_all) / .35, 0, 1)[:, None] * np.clip(t_all / .05, 0, 1)[:, None]
pk = np.max(np.abs(mix)); mix = mix / pk * .89
out = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote', sys.argv[1], f'{DUR}s', 'peak', round(float(pk), 3))
