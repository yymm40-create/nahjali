import { describe, expect, it } from "vitest";
import { ENV_RATE, crossCorrelate, envelope, findLag, syncedStart } from "@/lib/editor/sync";

const RATE = 4000;

/** a small seeded random generator */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Speech-like sound: bursts of noise of 0.1–0.6 s with pauses between, each with its own level. */
function speech(seconds: number, seed: number) {
  const r = rng(seed);
  const x = new Float32Array(Math.round(seconds * RATE));
  let i = 0;
  while (i < x.length) {
    const pause = Math.round((0.05 + r() * 0.5) * RATE);
    const len = Math.round((0.1 + r() * 0.5) * RATE);
    const level = 0.1 + r() * 0.8;
    // a few "voice" tones inside the burst, so the waves resemble each other and not only the loudness
    const f1 = 120 + r() * 200;
    const f2 = 700 + r() * 900;
    for (let k = 0; k < len && i + pause + k < x.length; k++) {
      const t = (i + pause + k) / RATE;
      const env = Math.sin((Math.PI * k) / len);
      x[i + pause + k] = level * env * (0.5 * Math.sin(2 * Math.PI * f1 * t) + 0.3 * Math.sin(2 * Math.PI * f2 * t) + 0.2 * (r() * 2 - 1));
    }
    i += pause + len;
  }
  return x;
}

/** The same sound as another device hears it: later/earlier by `shiftSec`, quieter, duller, with its own noise. */
function otherDevice(a: Float32Array, shiftSec: number, seed: number, noise = 0.02) {
  const r = rng(seed);
  const shift = Math.round(shiftSec * RATE);
  const out = new Float32Array(Math.max(1, a.length - shift));
  let lp = 0;
  for (let i = 0; i < out.length; i++) {
    const v = a[i + shift] ?? 0;
    lp += 0.35 * (v - lp);
    out[i] = 0.4 * lp + noise * (r() * 2 - 1);
  }
  return out;
}

describe("crossCorrelate", () => {
  it("matches the direct sum", () => {
    const a = Float32Array.from([1, 2, 3, 0, -1]);
    const b = Float32Array.from([0, 1, 2, 3, 4, 1]);
    const c = crossCorrelate(a, b);
    for (let l = c.min; l <= c.max; l++) {
      let s = 0;
      for (let t = 0; t < a.length; t++) if (t + l >= 0 && t + l < b.length) s += a[t] * b[t + l];
      expect(c.get(l)).toBeCloseTo(s, 6);
    }
  });
});

describe("envelope", () => {
  it("has ENV_RATE values a second", () => {
    expect(envelope(new Float32Array(RATE * 3), RATE).length).toBe(ENV_RATE * 3);
  });
});

describe("findLag", () => {
  const a = speech(90, 7);

  it("finds a device that started 12.345 s after the first, within a few milliseconds", () => {
    const b = otherDevice(a, 12.345, 11);
    const f = findLag(a, b, RATE);
    expect(f.confidence).toBe("high");
    // the moment at t in `a` is at t − 12.345 in `b`
    expect(Math.abs(f.lag + 12.345)).toBeLessThan(0.004);
  });

  it("finds a device that started BEFORE the first (the lag is positive)", () => {
    // b hears 7.5 s of sound before `a` begins: b = [7.5 s of other sound] + a
    const lead = speech(7.5, 99);
    const b = new Float32Array(lead.length + a.length);
    b.set(lead, 0);
    b.set(otherDevice(a, 0, 5), lead.length);
    const f = findLag(a, b, RATE);
    expect(f.confidence).toBe("high");
    expect(Math.abs(f.lag - 7.5)).toBeLessThan(0.004);
  });

  it("copes with a short clip taken from the middle, and with a loud room", () => {
    const b = otherDevice(a.subarray(Math.round(30 * RATE), Math.round(55 * RATE)), 0, 21, 0.08);
    const f = findLag(a, b, RATE);
    expect(f.confidence).not.toBe("none");
    expect(Math.abs(f.lag + 30)).toBeLessThan(0.006);
  });

  it("does not guess between two unrelated recordings", () => {
    const f = findLag(a, speech(90, 12345), RATE);
    expect(f.confidence).toBe("none");
  });

  it("says so for silence", () => {
    expect(findLag(a, new Float32Array(RATE * 30), RATE).confidence).toBe("none");
  });
});

describe("syncedStart", () => {
  it("puts the other clip where its sound meets the anchor's", () => {
    // the other device began 2 s after the anchor's (lag −2 s): its clip starts 2 s later on the timeline
    expect(syncedStart({ id: "a", start: 0, in: 0, speed: 1 }, { id: "b", start: 99, in: 0, speed: 1 }, -2000)).toBe(2000);
    // anchor placed at 5 s, cut from its 1 s on; the other cut from 4 s on, lag +3 s
    expect(syncedStart({ id: "a", start: 5000, in: 1000, speed: 1 }, { id: "b", start: 0, in: 4000, speed: 1 }, 3000)).toBe(5000 - (1000 + 3000 - 4000));
    // the file time anchor.in + lag = 4000 is exactly b.in: b starts where a starts
    expect(syncedStart({ id: "a", start: 5000, in: 1000, speed: 1 }, { id: "b", start: 0, in: 4000, speed: 1 }, 3000)).toBe(5000);
  });
  it("accounts for a faster other clip", () => {
    expect(syncedStart({ id: "a", start: 0, in: 0, speed: 1 }, { id: "b", start: 0, in: 0, speed: 2 }, -4000)).toBe(2000);
  });
});

/** A poem on a beat: a thump on every beat and a chanted syllable on every half beat (new words every time). */
function poem(seconds: number, seed: number, bpm = 96) {
  const r = rng(seed);
  const n = seconds * RATE;
  const x = new Float32Array(n);
  const beat = (60 / bpm) * RATE;
  for (let b = 0; b * beat < n; b++) {
    const at = Math.round(b * beat);
    for (let k = 0; k < 0.08 * RATE && at + k < n; k++) x[at + k] += 0.9 * Math.exp(-k / (0.02 * RATE)) * Math.sin((2 * Math.PI * 70 * k) / RATE);
  }
  for (let h = 0; (h * beat) / 2 < n; h++) {
    const at = Math.round((h * beat) / 2);
    const len = Math.round(((0.6 + 0.35 * r()) * beat) / 2);
    const lvl = 0.25 + 0.35 * r();
    const f = 140 + 60 * Math.sin((h / 16) * 2 * Math.PI) + 30 * r();
    if (r() < 0.12) continue;
    for (let k = 0; k < len && at + k < n; k++) x[at + k] += lvl * Math.sin((Math.PI * k) / len) * (Math.sin((2 * Math.PI * f * k) / RATE) + 0.4 * Math.sin((2 * Math.PI * f * 2.02 * k) / RATE) + 0.25 * (r() * 2 - 1));
  }
  return x;
}

/** A camera in the room: `len` seconds of the master from `from`, with echoes, duller, and its own noise (`snr`: signal over noise). */
function camera(master: Float32Array, from: number, len: number, seed: number, snr: number) {
  const r = rng(seed);
  const a = Math.round(from * RATE);
  const n = Math.round(len * RATE);
  const y = new Float32Array(n);
  const taps: [number, number][] = [[0, 0.5], [Math.round(0.013 * RATE), 0.3], [Math.round(0.031 * RATE), 0.22], [Math.round(0.07 * RATE), 0.15], [Math.round(0.12 * RATE), 0.1]];
  let p = 0;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const [d, g] of taps) v += g * (master[a + i - d] ?? 0);
    y[i] = v;
    p += v * v;
  }
  const noise = Math.sqrt(p / n) / snr;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += 0.35 * (y[i] - lp);
    y[i] = lp + noise * (r() * 2 - 1) * 1.7;
  }
  return y;
}

describe("findLag on a poem with a beat (the loudness fits at every beat)", () => {
  const master = poem(180, 7);

  it("finds every camera clip of the poem, to the right beat", () => {
    for (const snr of [3, 1]) {
      for (let i = 0; i < 6; i++) {
        const from = 5 + i * 23.37;
        const f = findLag(master, camera(master, from, 12 + (i % 4) * 4, 100 + i, snr), RATE);
        expect(f.confidence, `clip ${i} at snr ${snr}`).not.toBe("none");
        expect(Math.abs(f.lag + from), `clip ${i} at snr ${snr}`).toBeLessThan(0.02);
      }
    }
  }, 60_000);

  it("the same whichever of the two is given first", () => {
    const f = findLag(camera(master, 40, 16, 5, 3), master, RATE);
    expect(f.confidence).not.toBe("none");
    expect(Math.abs(f.lag - 40)).toBeLessThan(0.02);
  }, 30_000);

  it("refuses a clip of another poem, on the same beat or on another", () => {
    for (const [seed, bpm] of [[99, 96], [55, 104]] as const) {
      const other = poem(180, seed, bpm);
      for (let i = 0; i < 5; i++) expect(findLag(master, camera(other, 5 + i * 23.37, 12 + (i % 4) * 4, 300 + i, 1), RATE).confidence, `${bpm} bpm, clip ${i}`).toBe("none");
    }
  }, 60_000);
});

describe("pickAnchor: which clip the others line up to", () => {
  it("is the first when the files are about as long as each other", async () => {
    const { pickAnchor } = await import("@/components/jawad/editor/sync");
    expect(pickAnchor([{ id: "a", fileMs: 60_000 }, { id: "b", fileMs: 70_000 }])).toBe("a");
  });
  it("is the long master under many short clips, wherever it stands", async () => {
    const { pickAnchor } = await import("@/components/jawad/editor/sync");
    expect(pickAnchor([{ id: "cam1", fileMs: 20_000 }, { id: "poem", fileMs: 240_000 }, { id: "cam2", fileMs: 31_000 }])).toBe("poem");
    expect(pickAnchor([{ id: "poem", fileMs: 240_000 }, { id: "cam1", fileMs: 20_000 }])).toBe("poem");
  });
});

/** A recited poem: the same tune every verse, new words (formants) on every syllable, a soft beat under it. */
function recital(seconds: number, seed: number, bpm = 92, beatLevel = 0.5) {
  const r = rng(seed);
  const n = Math.round(seconds * RATE);
  const x = new Float32Array(n);
  const beat = (60 / bpm) * RATE;
  for (let b = 0; b * beat < n; b++) {
    const at = Math.round(b * beat);
    for (let k = 0; k < 0.09 * RATE && at + k < n; k++) x[at + k] += beatLevel * Math.exp(-k / (0.02 * RATE)) * Math.sin((2 * Math.PI * 65 * k) / RATE);
  }
  const tune = [0, 2, 4, 5, 4, 2, 0, -1, 0, 2, 4, 7, 5, 4, 2, 0];
  for (let h = 0; (h * beat) / 2 < n; h++) {
    const at = Math.round((h * beat) / 2 + (r() - 0.5) * 0.02 * RATE);
    const len = Math.round(((0.55 + 0.4 * r()) * beat) / 2);
    const f0 = 130 * Math.pow(2, tune[h % 16] / 12);
    const F1 = 300 + r() * 500;
    const F2 = 900 + r() * 900;
    const lvl = 0.3 + 0.3 * r();
    if (r() < 0.1) continue;
    for (let k = 0; k < len && at + k < n; k++) {
      const t = k / RATE;
      let v = 0;
      for (let hm = 1; hm * f0 < 1900; hm++) {
        const f = hm * f0;
        v += ((Math.exp(-(((f - F1) / 140) ** 2)) + 0.7 * Math.exp(-(((f - F2) / 180) ** 2)) + 0.08) / hm ** 0.3) * Math.sin(2 * Math.PI * f * t);
      }
      x[at + k] += lvl * Math.sin((Math.PI * k) / len) ** 0.6 * v * 0.3;
    }
  }
  return x;
}

/** A camera in a real room: a dense echo that rings for `rt` seconds, a dull mic, hiss; `rate`: its clock against the master's. */
function roomCamera(master: Float32Array, from: number, len: number, seed: number, o: { rt: number; snr: number; rate?: number; along?: Float32Array }) {
  const r = rng(seed);
  const n = Math.round(len * RATE);
  const a0 = Math.round(from * RATE);
  const L = Math.round(o.rt * RATE);
  const ir = new Float32Array(L);
  ir[0] = 1;
  for (let i = 1; i < L; i++) if (r() < 0.25) ir[i] = (r() * 2 - 1) * 0.5 * Math.exp((-6.9 * i) / L);
  const rate = o.rate ?? 1;
  const dry = new Float32Array(n + L);
  for (let i = -L; i < n; i++) {
    const p = a0 + i * rate;
    const k = Math.floor(p);
    dry[i + L] = (master[k] ?? 0) * (1 - (p - k)) + (master[k + 1] ?? 0) * (p - k);
  }
  const y = new Float32Array(n);
  let pw = 0;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = 0; k < L; k++) if (ir[k]) v += ir[k] * dry[i + L - k];
    y[i] = v;
    pw += v * v;
  }
  if (o.along) for (let i = 0; i < n; i++) y[i] += 0.8 * (o.along[a0 + i] ?? 0);
  const noise = Math.sqrt(pw / n) / o.snr;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += 0.3 * (y[i] - lp);
    y[i] = lp + noise * (r() * 2 - 1) * 1.7;
  }
  return y;
}

describe("findLag on camera clips of a recited poem, in a room (the sound's picture)", () => {
  const master = recital(160, 7);
  const clips = [
    [6, 12],
    [41.3, 20],
    [93.7, 15],
    [128.2, 25],
  ] as const;
  const all = (name: string, o: Parameters<typeof roomCamera>[4], tol: number) =>
    it(name, () => {
      clips.forEach(([from, len], i) => {
        const f = findLag(master, roomCamera(master, from, len, 500 + i, o), RATE);
        expect(f.confidence, `clip at ${from}`).not.toBe("none");
        expect(Math.abs(f.lag + from), `clip at ${from}`).toBeLessThan(tol);
      });
    }, 120_000);

  all("a room that rings for 0.8 s", { rt: 0.8, snr: 2 }, 0.04);
  all("people reciting along with the playback", { rt: 0.6, snr: 2, along: recital(160, 7, 92, 0) }, 0.04);
  // a clock a thousandth off slides 25 ms over a 25 s clip: any place within that is as right as another
  all("a camera whose clock runs a thousandth fast", { rt: 0.6, snr: 2, rate: 1.001 }, 0.045);
  all("…or a thousandth slow", { rt: 0.3, snr: 3, rate: 0.999 }, 0.045);

  it("still refuses talk that has nothing to do with it", () => {
    for (let i = 0; i < 4; i++) expect(findLag(speech(60 + i * 20, 40 + i), speech(25 + i * 10, 140 + i), RATE).confidence, `pair ${i}`).toBe("none");
  }, 120_000);
});
