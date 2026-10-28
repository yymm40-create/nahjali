import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
const removed: string[][] = [];
// the job's row: what the webhook wrote on it (a failure), and the progress the first step marks
const row = vi.hoisted(() => ({ error: null as string | null }));
vi.mock("@/lib/jawad/student/db", () => ({
  getProject: async () => ({ id: "p", user_id: "u" }),
  sources: async () => [],
  touch: async () => {},
  sdb: () => ({
    from: () => ({
      insert: async (r: Record<string, unknown>) => (inserted.push(r), { error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { error: row.error } }) }) }),
    }),
  }),
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
    row.error = null;
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
          expect(JSON.parse(String(f.get("webhook_metadata")))).toEqual({ studentJob: "j" });
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

  it("never names ElevenLabs on the page while it waits", async () => {
    const job = { id: "j", user_id: "u", project_id: "p", input: { path: "u/p/media/x.mp4", name: "x", seconds: 5 }, progress: {} } as never;
    const first = await mediaHandler.step(job);
    const waiting = await mediaHandler.step({ ...(job as object), progress: first.progress } as never);
    expect(`${first.stage} ${waiting.stage}`).not.toMatch(/ElevenLabs/i);
    expect(waiting.stage).toContain("نفرّغ الكلام");
  });

  it("stops at once when the webhook marked the transcription failed", async () => {
    const job = { id: "j", user_id: "u", project_id: "p", input: { url: "https://youtu.be/x", name: "x" }, progress: { tid: "t1", since: Date.now() } } as never;
    row.error = "ما قدرنا نفرّغ هذا المقطع (could not download). ما انخصم منك شيء";
    await expect(mediaHandler.step(job)).rejects.toThrow("could not download");
  });

  it("gives up after 20 minutes, not hours", async () => {
    const job = (min: number) => ({ id: "j", user_id: "u", project_id: "p", input: { url: "https://youtu.be/x", name: "x" }, progress: { tid: "t1", since: Date.now() - min * 60_000 } }) as never;
    expect((await mediaHandler.step(job(19))).done).toBe(false);
    await expect(mediaHandler.step(job(21))).rejects.toThrow("٢٠ دقيقة");
  });
});
