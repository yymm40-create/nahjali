import { describe, expect, it } from "vitest";
import { mixWavs, parseWav, toWav } from "@/lib/editor/wav";

const tone = (n: number, v: number) => new Float32Array(n).fill(v);

describe("wav", () => {
  it("reads back what it writes", () => {
    const p = parseWav(toWav(44100, [tone(100, 0.5), tone(100, -0.25)]));
    expect(p.rate).toBe(44100);
    expect(p.channels).toHaveLength(2);
    expect(p.channels[0][50]).toBeCloseTo(0.5, 3);
    expect(p.channels[1][50]).toBeCloseTo(-0.25, 3);
  });

  it("reads 32-bit float files", () => {
    const b = Buffer.alloc(44 + 8);
    b.write("RIFF", 0, "ascii");
    b.write("WAVEfmt ", 8, "ascii");
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(3, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(48000, 24);
    b.writeUInt16LE(32, 34);
    b.write("data", 36, "ascii");
    b.writeUInt32LE(8, 40);
    b.writeFloatLE(0.75, 44);
    b.writeFloatLE(-0.5, 48);
    expect(Array.from(parseWav(b).channels[0])).toEqual([0.75, -0.5]);
  });

  it("mixes parts of different rates and channels into the first one's", () => {
    const a = parseWav(toWav(48000, [tone(480, 0.2), tone(480, 0.2)]));
    const mono = parseWav(toWav(24000, [tone(240, 0.3)]));
    const m = parseWav(mixWavs([a, mono]));
    expect(m.rate).toBe(48000);
    expect(m.channels).toHaveLength(2);
    expect(m.channels[0].length).toBe(480);
    expect(m.channels[1][100]).toBeCloseTo(0.5, 2);
  });
});
