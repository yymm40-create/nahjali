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
