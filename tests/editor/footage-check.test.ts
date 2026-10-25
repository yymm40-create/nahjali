// «مختبر الموشن» on the person's video: a missing file stops with a plain message instead of being handed to حيدرا ماكس as a
// scene bug (the desktop program answers 404 for a file that moved or was deleted).
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkFootage, FootageUnavailable, LabSetupError, onDeviceOnly } from "@/components/jawad/editor/footage-check";

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

  it("what stops the build without asking حيدرا ماكس to fix a scene, and the video that lives only on the computer", async () => {
    answer(404);
    const e = await checkFootage("https://example.com/v.mp4").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(LabSetupError);
    expect(onDeviceOnly("haidara-media://file/35dbe696")).toBe(true);
    expect(onDeviceOnly("https://example.com/v.mp4")).toBe(false);
  });
});

describe("readLocalFile", () => {
  it("reads the file in ranges and puts it together, saying how far it is", async () => {
    const { readLocalFile } = await import("@/components/jawad/editor/footage-check");
    const data = new Uint8Array(25);
    for (let i = 0; i < 25; i++) data[i] = i;
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      const m = /bytes=(\d+)-(\d+)/.exec(String((init?.headers as Record<string, string>)?.Range ?? ""));
      const a = Number(m![1]), b = Math.min(24, Number(m![2]));
      return new Response(data.slice(a, b + 1), { status: 206, headers: { "Content-Range": `bytes ${a}-${b}/25`, "Content-Type": "video/mp4" } });
    }));
    const seen: number[] = [];
    const blob = await readLocalFile("haidara-media://file/x", (d) => seen.push(d), 10);
    expect(blob.size).toBe(25);
    expect(blob.type).toBe("video/mp4");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(data);
    expect(seen).toEqual([10, 20, 25]);
    expect(vi.mocked(fetch).mock.calls).toHaveLength(4);
  });

  it("a file that is gone fails as such", async () => {
    const { readLocalFile, FootageUnavailable } = await import("@/components/jawad/editor/footage-check");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 404 })));
    await expect(readLocalFile("haidara-media://file/x")).rejects.toBeInstanceOf(FootageUnavailable);
  });
});
