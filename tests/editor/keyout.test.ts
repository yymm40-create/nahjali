import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const { keyOutGreen } = await import("@/lib/editor/generate");

describe("the hook picture's green background", () => {
  it("is taken out, the letters kept, and the picture cropped to them", async () => {
    // 600×300 pure green with a white 200×100 «letters» block in the middle
    const png = await sharp({ create: { width: 600, height: 300, channels: 3, background: { r: 0, g: 255, b: 0 } } })
      .composite([{ input: await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer(), left: 200, top: 100 }])
      .png()
      .toBuffer();
    const out = await keyOutGreen(png);
    expect([out.width, out.height]).toEqual([224, 124]);
    const { data, info } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4));
    expect(px(2, 2)[3]).toBe(0);
    expect(px(112, 62)).toEqual([255, 255, 255, 255]);
  });
});
