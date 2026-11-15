import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { thumbOf } from "@/lib/storage/public";

describe("small sample pictures (app/files/thumb)", () => {
  it("turns a public sample picture into its thumbnail link, and leaves anything else alone", () => {
    expect(thumbOf("/files/jawad-public/samples/gpt/a1.png", 480)).toBe("/files/thumb/jawad-public/samples/gpt/a1.png?w=480");
    expect(thumbOf("/files/jawad-public/samples/x/b.JPG", 960)).toBe("/files/thumb/jawad-public/samples/x/b.JPG?w=960");
    expect(thumbOf("/files/jawad-public/samples/x/clip.mp4")).toBe("/files/jawad-public/samples/x/clip.mp4");
    expect(thumbOf("/files/mahdi-avatars/u.png")).toBe("/files/mahdi-avatars/u.png");
    expect(thumbOf("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(thumbOf(null)).toBeNull();
  });

  it("the route's recipe makes a big picture a small WebP", async () => {
    const big = await sharp({ create: { width: 2048, height: 2732, channels: 3, background: { r: 30, g: 60, b: 200 } } }).png().toBuffer();
    const out = await sharp(big).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 74, effort: 4 }).toBuffer();
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(480);
    expect(out.length).toBeLessThan(big.length / 5);
  });
});
