import { describe, expect, it } from "vitest";
import { integratedLufs, master, truePeak } from "@/lib/editor/loudness";

const RATE = 48000;
const sine = (amp: number, hz: number, secs: number) => Float32Array.from({ length: RATE * secs }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / RATE));
const db = (v: number) => 20 * Math.log10(v);

describe("loudness as the platforms hear it (BS.1770 / EBU R128)", () => {
  it("measures the reference tone: a 1 kHz sine at −23 dBFS in both channels is −23 LUFS", () => {
    const a = Math.pow(10, -23 / 20);
    expect(integratedLufs([sine(a, 1000, 5), sine(a, 1000, 5)], RATE)).toBeCloseTo(-23, 0);
    expect(integratedLufs([new Float32Array(RATE), new Float32Array(RATE)], RATE)).toBe(-Infinity);
  });

  it("gates silence out: a tone with long silence around it measures like the tone", () => {
    const a = Math.pow(10, -20 / 20);
    const tone = sine(a, 1000, 3);
    const padded = new Float32Array(RATE * 9);
    padded.set(tone, RATE * 3);
    expect(Math.abs(integratedLufs([padded, padded.slice()], RATE) - integratedLufs([tone, tone.slice()], RATE))).toBeLessThan(0.5);
  });

  it("masters to −14 LUFS with the true peak under −1.5 dBTP, and never lifts a quiet take by more than 12 dB", () => {
    const L = sine(0.05, 440, 6), R = sine(0.05, 440, 6);
    // a loud click on top: the limiter must hold it
    for (let i = 0; i < 200; i++) L[RATE * 3 + i] = R[RATE * 3 + i] = 0.9;
    const r = master([L, R], RATE);
    expect(r.after).toBeGreaterThan(-15);
    expect(r.after).toBeLessThan(-13);
    expect(db(truePeak([L, R]))).toBeLessThanOrEqual(-1.4);
    const q = [sine(0.0005, 440, 3), sine(0.0005, 440, 3)];
    expect(master(q, RATE).gainDb).toBe(12);
  });
});
