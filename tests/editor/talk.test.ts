import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// the paid-call wrapper and the database, quiet: what is tested is what goes to ElevenLabs and what comes back
vi.mock("@/lib/coins", () => ({ coinsRequired: async () => false, holdCoins: async () => {}, releaseCoins: async () => {} }));
vi.mock("@/lib/film/limits", () => ({ getLimit: async () => 120 }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: async () => ({}) }) }) }));

const { voiceIn, voiceOut } = await import("@/lib/editor/speech");
const project = { id: "p", user_id: "u", version: 1, purge_at: null, purged_at: null } as never;
const owner = { id: "u", email: "o@x.y", owner: true };
const calls: { url: string; body: unknown }[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv("ELEVENLABS_API_KEY", "k");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: init.body instanceof FormData ? Object.fromEntries(init.body.entries()) : JSON.parse(String(init.body)) });
      if (String(url).includes("speech-to-text"))
        return new Response(JSON.stringify({ language_code: "ar", words: [{ text: "قص", type: "word", start: 0, end: 0.3 }, { text: " ", type: "spacing", start: 0.3, end: 0.3 }, { text: "السكتات", type: "word", start: 0.3, end: 0.9 }, { text: "،", type: "word", start: 0.9, end: 0.95 }] }));
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("talking with حيدرة", () => {
  it("writes what was said", async () => {
    const r = await voiceIn(project, owner, { audio: Buffer.from("voice").toString("base64"), mime: "audio/webm;codecs=opus", seconds: 3 });
    expect(r.text).toBe("قص السكتات،");
    expect(calls[0].url).toContain("speech-to-text");
  });

  it("refuses what isn't a short recording", async () => {
    await expect(voiceIn(project, owner, { audio: "x", mime: "video/mp4" })).rejects.toThrow("صيغة");
    await expect(voiceIn(project, owner, { audio: Buffer.alloc(3_100_000).toString("base64"), mime: "audio/webm" })).rejects.toThrow("طويل");
  });

  it("reads the reply aloud without markdown, code, links or emoji, in Arabic", async () => {
    const r = await voiceOut(project, owner, { text: "**تم** قصّيت السكتات ✂️ شوف https://x.y\n```\nprompt\n```" });
    expect(r.mime).toBe("audio/mpeg");
    expect(Buffer.from(r.audio, "base64")).toEqual(Buffer.from([1, 2, 3]));
    const body = calls[0].body as { text: string; model_id: string; language_code?: string };
    expect(body.text).toBe("تم قصّيت السكتات شوف");
    expect(body.model_id).toBe("eleven_v4");
    expect(body.language_code).toBe("ar");
  });

  it("says nothing for an empty reply", async () => {
    await expect(voiceOut(project, owner, { text: "✂️ ```x```" })).rejects.toThrow("ما فيه كلام");
  });
});
