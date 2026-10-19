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

describe("«صوت الجواد» provider (VoiceStudio)", () => {
  const env = { ...process.env };
  let calls: { method: string; url: string; body?: unknown; form?: FormData }[] = [];
  let profiles: { name: string }[] = [];
  beforeEach(() => {
    calls = [];
    profiles = [];
    process.env.VOICESTUDIO_URL = "https://vs.test:3900/";
    process.env.VOICESTUDIO_KEY = "key";
    delete process.env.VOICESTUDIO_ENGINE;
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const isForm = init?.body instanceof FormData;
        calls.push({ method, url, body: init?.body && !isForm ? JSON.parse(String(init.body)) : undefined, form: isForm ? (init!.body as FormData) : undefined });
        if (url.startsWith("https://ref/")) return new Response(wavOf(1000), { headers: { "content-type": "audio/wav" } });
        if (url === "https://vs.test:3900/profiles" && method === "GET") return new Response(JSON.stringify(profiles));
        if (url === "https://vs.test:3900/profiles" && method === "POST") {
          profiles.push({ name: String((init!.body as FormData).get("name")) });
          return new Response(JSON.stringify({ id: "p1" }));
        }
        if (url === "https://vs.test:3900/v1/audio/speech") {
          const b = JSON.parse(String(init!.body));
          if (b.input === "sleep") return new Response("starting", { status: 503 });
          return new Response(wavOf(400), { headers: { "content-type": "audio/wav" } });
        }
        return new Response("nope", { status: 404 });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...env };
  });

  it("makes the voice a profile once from the reference recording, then speaks with its name", async () => {
    const { jawadSpeak, profileName } = await import("@/lib/jawad/server/providers/jawad-voice");
    const r = await jawadSpeak({ refUrl: "https://ref/u/voice.wav?token=a", refText: "مرحبا بكم", text: "السلام عليكم ورحمة الله" });
    expect(r.engine).toBe("voicestudio");
    expect(r.mime).toBe("audio/wav");
    expect(r.durationMs).toBe(400);
    const made = calls.filter((c) => c.method === "POST" && c.url.endsWith("/profiles"));
    expect(made).toHaveLength(1);
    expect(made[0].form!.get("kind")).toBe("clone");
    expect(made[0].form!.get("ref_text")).toBe("مرحبا بكم");
    const name = profileName("https://ref/u/voice.wav?token=a");
    expect(made[0].form!.get("name")).toBe(name);
    // the same recording under another token is the same voice
    expect(profileName("https://ref/u/voice.wav?token=b")).toBe(name);
    const speech = calls.find((c) => c.url.endsWith("/v1/audio/speech"))!.body as Record<string, unknown>;
    expect(speech).toMatchObject({ model: "tts-1", voice: name, response_format: "wav", language: "ar" });
    // the second reading finds the profile: no new one
    await jawadSpeak({ refUrl: "https://ref/u/voice.wav?token=c", refText: "مرحبا بكم", text: "مرة ثانية" });
    expect(calls.filter((c) => c.method === "POST" && c.url.endsWith("/profiles"))).toHaveLength(1);
  });

  it("a long text goes in pieces and comes back as one WAV; the engine can be pinned", async () => {
    process.env.VOICESTUDIO_ENGINE = "voxcpm2";
    const { jawadSpeak } = await import("@/lib/jawad/server/providers/jawad-voice");
    const text = Array.from({ length: 160 }, (_, i) => `هذه جملة رقم ${i + 1} في نص طويل عن فضل الصدقة والعلم والعمل.`).join(" ");
    const r = await jawadSpeak({ refUrl: "https://ref/u/long.wav", refText: "x", text });
    const speeches = calls.filter((c) => c.url.endsWith("/v1/audio/speech")).map((c) => c.body as { input: string; model: string });
    expect(speeches.length).toBeGreaterThan(1);
    for (const s of speeches) {
      expect(s.input.length).toBeLessThanOrEqual(3500);
      expect(s.model).toBe("voxcpm2");
    }
    expect(speeches.map((s) => s.input).join(" ")).toBe(text);
    expect(r.durationMs).toBe(speeches.length * 400 + (speeches.length - 1) * 180);
    expect(readWav(new Uint8Array(r.audio))!.rate).toBe(24000);
  });

  it("says a waking server plainly, and refuses when no server is set", async () => {
    const { jawadSpeak, jawadVoiceReady } = await import("@/lib/jawad/server/providers/jawad-voice");
    await expect(jawadSpeak({ refUrl: "https://ref/u/w.wav", refText: "x", text: "sleep" })).rejects.toMatchObject({ userMessage: expect.stringMatching(/يستيقظ/) });
    delete process.env.VOICESTUDIO_URL;
    expect(jawadVoiceReady()).toBe(false);
    await expect(jawadSpeak({ refUrl: "https://ref/u/w.wav", refText: "x", text: "نص" })).rejects.toMatchObject({ userMessage: expect.stringMatching(/غير مفعّل/) });
  });

  it("the generator offers only the voice and the speed, and no old engine is left in the code", async () => {
    const { generatorById } = await import("@config/jawad/generators");
    expect(generatorById("jawad-voice")!.options.map((o) => o.key)).toEqual(["voice", "speed"]);
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/lib/jawad/server/providers/jawad-voice.ts", "config/jawad/generators.ts", "src/lib/jawad/server/jobs.ts", "src/lib/jawad/server/runtime.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/habibi|chatterbox|HABIBI_URL/i);
    }
  });
});
