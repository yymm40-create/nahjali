import { describe, expect, it } from "vitest";
import { HABIBI_DIALECTS, joinWavs, readWav, splitForSpeech, writeWav } from "@/lib/jawad/voice-text";

describe("«صوت الجواد»: a text in pieces the model takes at once", () => {
  it("cuts at sentence ends, never inside a word, within the limit", () => {
    const text = "السلام عليكم ورحمة الله. اليوم بنتكلم عن الصدقة، وفضلها عند الله تعالى! هل تعرف إن الصدقة تطفئ غضب الرب؟ نعم.";
    const parts = splitForSpeech(text, 60);
    expect(parts.join(" ")).toBe(text);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(60);
      expect(p.endsWith(" ")).toBe(false);
    }
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });
  it("a sentence longer than the limit is cut at a space; a huge word is cut hard", () => {
    const long = Array.from({ length: 40 }, (_, i) => `كلمة${i}`).join(" ");
    const parts = splitForSpeech(long, 50);
    expect(parts.every((p) => p.length <= 50)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long);
    const word = "ا".repeat(120);
    expect(splitForSpeech(word, 50).every((p) => p.length <= 50)).toBe(true);
  });
  it("keeps short texts whole and drops blanks", () => {
    expect(splitForSpeech("  مرحبا  ", 300)).toEqual(["مرحبا"]);
    expect(splitForSpeech("\n\n", 300)).toEqual([]);
  });
});

describe("joining the pieces' WAV files", () => {
  const tone = (ms: number, rate = 24000) => {
    const n = Math.round((rate * ms) / 1000);
    const data = new Uint8Array(n * 2);
    for (let i = 0; i < n; i++) new DataView(data.buffer).setInt16(i * 2, Math.round(Math.sin(i / 10) * 8000), true);
    return writeWav(data, rate, 1);
  };
  it("reads back what it writes", () => {
    const w = readWav(tone(100))!;
    expect(w.rate).toBe(24000);
    expect(w.channels).toBe(1);
    expect(w.bits).toBe(16);
    expect(w.data.length).toBe(2400 * 2);
  });
  it("joins with a breath between pieces and reports the length", () => {
    const { wav, durationMs } = joinWavs([tone(500), tone(300), tone(200)], 200);
    expect(durationMs).toBe(500 + 300 + 200 + 400);
    expect(readWav(wav)!.data.length).toBe(Math.round(24000 * 1.4) * 2);
  });
  it("refuses a non-WAV piece and mixed formats", () => {
    expect(() => joinWavs([tone(100), new Uint8Array([1, 2, 3])])).toThrow();
    expect(() => joinWavs([tone(100), tone(100, 16000)])).toThrow();
    expect(() => joinWavs([])).toThrow();
  });
  it("lists Habibi's dialects with the sample-inferred one last", () => {
    expect(HABIBI_DIALECTS[0].id).toBe("MSA");
    expect(HABIBI_DIALECTS[HABIBI_DIALECTS.length - 1].id).toBe("UNK");
  });
});
