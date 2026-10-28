import { beforeEach, describe, expect, it, vi } from "vitest";

// the ElevenLabs speech-to-text webhook: a failed transcription is written on the student's job that waits for it
const writes = vi.hoisted(() => [] as { set: Record<string, unknown>; where: [string, unknown][] }[]);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (set: Record<string, unknown>) => {
        const w = { set, where: [] as [string, unknown][] };
        writes.push(w);
        const chain = { eq: (k: string, v: unknown) => (w.where.push([k, v]), chain), in: async (k: string, v: unknown) => (w.where.push([k, v]), { error: null }) };
        return chain;
      },
    }),
  }),
}));

const { POST } = await import("@/app/api/jawad/eleven/stt-webhook/route");
const JOB = "0b9d1c2e-1111-4222-8333-444455556666";
const post = (body: unknown) => POST(new Request("https://x/api/jawad/eleven/stt-webhook", { method: "POST", body: JSON.stringify(body) }));

describe("the speech-to-text webhook", () => {
  beforeEach(() => {
    writes.length = 0;
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("marks the waiting job with the reason when the transcription failed", async () => {
    const r = await post({ type: "webhook_error", request_id: "r", error_message: "Failed to download media", webhook_metadata: JSON.stringify({ studentJob: JOB }) });
    expect(r.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(String(writes[0].set.error)).toContain("Failed to download media");
    expect(writes[0].where).toEqual([["id", JOB], ["kind", "media"], ["status", ["queued", "running"]]]);
  });

  it("keeps nothing from a success, a job id that is not one, or a broken body", async () => {
    await post({ type: "speech_to_text_transcription", data: { request_id: "r", webhook_metadata: { studentJob: JOB }, transcription: { text: "fake" } } });
    await post({ type: "webhook_error", error_message: "x", webhook_metadata: { studentJob: "1 or 1=1" } });
    await POST(new Request("https://x", { method: "POST", body: "not json" }));
    expect(writes).toHaveLength(0);
  });
});
