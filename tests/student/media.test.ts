import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
const removed: string[][] = [];
vi.mock("@/lib/jawad/student/db", () => ({
  getProject: async () => ({ id: "p", user_id: "u" }),
  sources: async () => [],
  touch: async () => {},
  sdb: () => ({ from: () => ({ insert: async (row: Record<string, unknown>) => (inserted.push(row), { error: null }) }) }),
}));
vi.mock("@/lib/storage", () => ({
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://r2.example/file.mp4?sig" } }), remove: async (paths: string[]) => (removed.push(paths), { data: [] }) }) },
}));

const { mediaHandler, mediaLink, mediaUsd, transcriptText } = await import("@/lib/jawad/student/media");
const words = [
  { text: "السلام", start: 0.2, end: 0.6 },
  { text: "عليكم", start: 0.6, end: 1 },
  { text: "اليوم", start: 3.4, end: 3.8 },
  { text: "درسنا", start: 3.8, end: 4.2 },
  { text: "،", start: 4.2, end: 4.25 },
];

describe("a video or recording as material", () => {
  it("writes paragraphs at the pauses, each with its time", () => {
    expect(transcriptText({ language: "ar", text: "", words })).toBe("[00:00] السلام عليكم\n\n[00:03] اليوم درسنا،");
    expect(transcriptText({ language: "ar", text: " نص فقط ", words: [] })).toBe("نص فقط");
  });

  it("takes https links only", () => {
    expect(mediaLink("https://www.youtube.com/watch?v=abc")).toBe("https://www.youtube.com/watch?v=abc");
    expect(mediaLink("http://youtube.com/x")).toBeNull();
    expect(mediaLink("javascript:alert(1)")).toBeNull();
    expect(mediaLink("not a link")).toBeNull();
  });

  it("prices the real length at Scribe's rate (a minute at least)", () => {
    expect(mediaUsd(3600)).toBeCloseTo(0.225, 3);
    expect(mediaUsd(5)).toBeCloseTo(60 / 3600 * 0.22 + 0.005, 5);
  });
});

describe("the background transcription", () => {
  const calls: string[] = [];
  let ready = false;
  beforeEach(() => {
    calls.length = inserted.length = removed.length = 0;
    ready = false;
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    vi.stubGlobal("setTimeout", ((f: () => void) => (f(), 0)) as never);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (String(url).endsWith("/v1/speech-to-text")) {
          const f = init!.body as FormData;
          expect(f.get("source_url")).toBe("https://r2.example/file.mp4?sig");
          expect(f.get("webhook")).toBe("true");
          return new Response(JSON.stringify({ message: "ok", request_id: "r", transcription_id: "t1" }), { status: 202 });
        }
        if (!ready) return new Response("{}", { status: 404 });
        return new Response(JSON.stringify({ language_code: "ar", text: "…", words: words.map((w) => ({ ...w, type: "word" })) }));
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("starts, waits while ElevenLabs works, then makes the transcript the material and deletes the file", async () => {
    const job = { id: "j", user_id: "u", project_id: "p", input: { path: "u/p/media/x.mp4", name: "درس الخلية", seconds: 5 }, progress: {} } as never;
    const first = await mediaHandler.step(job);
    expect(first).toMatchObject({ done: false, progress: { tid: "t1" } });
    const waiting = await mediaHandler.step({ ...(job as object), progress: first.progress } as never);
    expect(waiting.done).toBe(false);
    ready = true;
    const last = await mediaHandler.step({ ...(job as object), progress: first.progress } as never);
    expect(last.done).toBe(true);
    expect(inserted[0]).toMatchObject({ kind: "text", name: "تفريغ: درس الخلية", status: "ready" });
    expect(String(inserted[0].body)).toContain("[00:03] اليوم درسنا،");
    expect(removed).toEqual([["u/p/media/x.mp4"]]);
    expect(calls.filter((c) => c.includes("/transcripts/t1"))).toHaveLength(2);
  });
});
