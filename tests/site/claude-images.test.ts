import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { fitImages } from "@/lib/claude-images";

type Blk = { source: { type: string; media_type?: string; data?: string; url?: string }; cache_control?: unknown };
const answer = (buf: Buffer) => vi.fn(async () => new Response(new Uint8Array(buf)));
const imageAt = (url: string) => [{ role: "user", content: [{ type: "text", text: "x" }, { type: "image", source: { type: "url", url }, cache_control: { type: "ephemeral" } }] }];
const sizeOf = async (b64: string) => sharp(Buffer.from(b64, "base64")).metadata();

afterEach(() => vi.unstubAllGlobals());

describe("pictures for Claude", () => {
  it("makes a huge cut-out logo small, keeping its transparency", async () => {
    const big = await sharp({ create: { width: 5000, height: 3000, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } } }).png().toBuffer();
    vi.stubGlobal("fetch", answer(big));
    const [m] = await fitImages(imageAt("https://r2.example/logo.png"));
    const b = (m.content as unknown as Blk[])[1];
    expect(b.source.type).toBe("base64");
    expect(b.source.media_type).toBe("image/png");
    expect(b.cache_control).toEqual({ type: "ephemeral" });
    const meta = await sizeOf(b.source.data!);
    expect(Math.max(meta.width!, meta.height!)).toBe(1568);
    expect(meta.hasAlpha).toBe(true);
  });

  it("sends a small picture as it is, and leaves a link it can't fetch", async () => {
    const small = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#123456" } }).jpeg().toBuffer();
    vi.stubGlobal("fetch", answer(small));
    const [m] = await fitImages(imageAt("https://r2.example/a.jpg"));
    expect((m.content as unknown as Blk[])[1].source).toEqual({ type: "base64", media_type: "image/jpeg", data: small.toString("base64") });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    const [n] = await fitImages(imageAt("https://r2.example/gone.jpg"));
    expect((n.content as unknown as Blk[])[1].source).toEqual({ type: "url", url: "https://r2.example/gone.jpg" });
  });
});
