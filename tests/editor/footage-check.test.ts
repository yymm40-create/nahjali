// «مختبر الموشن» on the person's video: a missing file stops with a plain message instead of being handed to حيدرة as a
// scene bug (the desktop program answers 404 for a file that moved or was deleted).
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkFootage, FootageUnavailable } from "@/components/jawad/editor/footage-check";

const answer = (status: number) => vi.stubGlobal("fetch", vi.fn(async () => new Response(status === 206 ? "x" : "gone", { status })));
afterEach(() => vi.unstubAllGlobals());

describe("checkFootage", () => {
  it("a file kept on the computer that is gone: says so and what to do", async () => {
    answer(404);
    const e = await checkFootage("haidara-media://file/35dbe696").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(FootageUnavailable);
    expect((e as Error).message).toMatch(/جهازك/);
  });

  it("a link that stopped opening: asks to upload it again", async () => {
    answer(403);
    await expect(checkFootage("https://example.com/v.mp4")).rejects.toThrow(/ما عاد يفتح \(403\)/);
  });

  it("a file that is there (or a server that does not do ranges) passes", async () => {
    answer(206);
    await expect(checkFootage("https://example.com/v.mp4")).resolves.toBeUndefined();
    answer(200);
    await expect(checkFootage("https://example.com/v.mp4")).resolves.toBeUndefined();
  });

  it("offline: not this check's business, the next steps report it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(checkFootage("https://example.com/v.mp4")).resolves.toBeUndefined();
  });

  it("asks for the first byte only", async () => {
    answer(206);
    await checkFootage("https://example.com/v.mp4");
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ headers: { Range: "bytes=0-0" } });
  });
});
