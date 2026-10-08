import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readWav } from "@/lib/jawad/voice-text";

// The provider against a fake fal queue and a fake Habibi endpoint: pieces, joining, fallbacks and plain errors.
const wavOf = (ms: number, rate = 24000) => {
  const n = Math.round((rate * ms) / 1000);
  const data = new Uint8Array(n * 2);
  const out = new Uint8Array(44 + data.length);
  const v = new DataView(out.buffer);
  const tag = (at: number, s: string) => [...s].forEach((c, i) => (out[at + i] = c.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 36 + data.length, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, data.length, true);
  return out;
};

describe("«صوت الجواد» provider", () => {
  const env = { ...process.env };
  let calls: { url: string; body?: unknown }[] = [];
  beforeEach(() => {
    calls = [];
    process.env.FAL_KEY = "test";
    delete process.env.HABIBI_URL;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, body });
        // fal: submit → status → result → file
        if (url.startsWith("https://queue.fal.run/")) return new Response(JSON.stringify({ request_id: "r1", status_url: `https://q/status/${calls.length}`, response_url: `https://q/result/${calls.length}` }));
        if (url.startsWith("https://q/status/")) return new Response(JSON.stringify({ status: "COMPLETED" }));
        if (url.startsWith("https://q/result/")) return new Response(JSON.stringify({ audio: { url: `https://files/${url.split("/").pop()}.wav` } }));
        if (url.startsWith("https://files/")) return new Response(wavOf(400));
        // Habibi endpoint
        if (url.startsWith("https://habibi.test/")) {
          if (body?.inputs?.gen_text === "sleep") return new Response("starting", { status: 503 });
          return new Response(JSON.stringify({ audio_base64: Buffer.from(wavOf(900)).toString("base64"), sample_rate: 24000, format: "wav" }));
        }
        return new Response("nope", { status: 404 });
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 50 });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    process.env = { ...env };
  });

  it("Chatterbox: a long Arabic text goes in pieces of ≤ 300 characters and comes back as one WAV", async () => {
    const { jawadSpeak } = await import("@/lib/jawad/server/providers/jawad-voice");
    const text = Array.from({ length: 12 }, (_, i) => `هذه جملة رقم ${i + 1} في نص طويل عن فضل الصدقة والعلم والعمل.`).join(" ");
    const r = await jawadSpeak({ refUrl: "https://ref/x.wav", refText: "", text });
    expect(r.engine).toBe("chatterbox");
    expect(r.mime).toBe("audio/wav");
    const submits = calls.filter((c) => c.url.startsWith("https://queue.fal.run/fal-ai/chatterbox/text-to-speech/multilingual"));
    expect(submits.length).toBeGreaterThan(1);
    for (const s of submits) {
      const b = s.body as { text: string; voice: string; custom_audio_language: string };
      expect(b.text.length).toBeLessThanOrEqual(300);
      expect(b.voice).toBe("https://ref/x.wav");
      expect(b.custom_audio_language).toBe("arabic");
    }
    expect(submits.map((s) => (s.body as { text: string }).text).join(" ")).toBe(text);
    const w = readWav(new Uint8Array(r.audio))!;
    // the pieces plus a breath between each two
    expect(r.durationMs).toBe(submits.length * 400 + (submits.length - 1) * 180);
    expect(w.rate).toBe(24000);
  });

  it("Habibi when configured: one call with the reference words and the dialect; 503 while waking is said plainly", async () => {
    process.env.HABIBI_URL = "https://habibi.test/";
    process.env.HABIBI_TOKEN = "tok";
    const { jawadSpeak } = await import("@/lib/jawad/server/providers/jawad-voice");
    const r = await jawadSpeak({ refUrl: "https://ref/x.wav", refText: "مرحبا بكم", text: "السلام عليكم ورحمة الله", dialect: "SAU" });
    expect(r.engine).toBe("habibi");
    expect(r.durationMs).toBe(900);
    const call = calls.find((c) => c.url.startsWith("https://habibi.test/"))!;
    expect((call.body as { inputs: { dialect: string; ref_text: string } }).inputs).toMatchObject({ dialect: "SAU", ref_text: "مرحبا بكم" });
    await expect(jawadSpeak({ refUrl: "https://ref/x.wav", refText: "x", text: "sleep" })).rejects.toMatchObject({ userMessage: expect.stringMatching(/يستيقظ/) });
    // asked for Chatterbox explicitly: Habibi is skipped
    const c = await jawadSpeak({ refUrl: "https://ref/x.wav", refText: "x", text: "قصير", engine: "chatterbox" });
    expect(c.engine).toBe("chatterbox");
  });

  it("Habibi without the reference words refuses before calling the endpoint", async () => {
    process.env.HABIBI_URL = "https://habibi.test/";
    const { jawadSpeak } = await import("@/lib/jawad/server/providers/jawad-voice");
    await expect(jawadSpeak({ refUrl: "https://ref/x.wav", refText: "", text: "نص" })).rejects.toMatchObject({ userMessage: expect.stringMatching(/نصّ مرجعي/) });
    expect(calls.some((c) => c.url.startsWith("https://habibi.test/"))).toBe(false);
  });

  it("knows which engines are on", async () => {
    const { jawadEngines, jawadVoiceReady } = await import("@/lib/jawad/server/providers/jawad-voice");
    expect(jawadEngines()).toEqual(["chatterbox"]);
    process.env.HABIBI_URL = "https://habibi.test/";
    expect(jawadEngines()).toEqual(["habibi", "chatterbox"]);
    delete process.env.FAL_KEY;
    delete process.env.HABIBI_URL;
    expect(jawadVoiceReady()).toBe(false);
  });
});
