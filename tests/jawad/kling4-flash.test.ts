import { describe, expect, it } from "vitest";
import { evaluate, fileProblem, priceTable } from "@/lib/jawad/engine";
import { generatorById, KLING4_FLASH_EDIT_ID, KLING4_FLASH_ID, KLING4_FLASH_USD, kling4Billed } from "@config/jawad/generators";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";
import { kling4FlashEditRequest, kling4FlashRequest } from "@/lib/jawad/server/kling4";

const media = (id: string, kind: "image" | "video", role = "reference", durationMs: number | null = null, side = 720): RefMeta =>
  ({ id, kind, role, mime: kind === "image" ? "image/png" : "video/mp4", bytes: 1000, width: side, height: 1280, durationMs, fps: kind === "video" ? 24 : null, status: "ready" }) as RefMeta;
const run = (def: GeneratorDef, settings: Record<string, unknown>, refs: RefMeta[] = [], style: "none" | "frames" | "references" = refs.length ? "references" : "none", prompt = "a boy flies over the city") =>
  evaluate(def, { settings: settings as never, prompt, instructions: "", refStyle: style, refs, strict: false }, priceTable(def, undefined));

describe("Kling 4.0 Flash (fal kling/v4/flash)", () => {
  const g = generatorById(KLING4_FLASH_ID)!;
  it("is a fal video card: text, a first frame (no end frame) or references, 3–20 s", () => {
    expect(g.provider.id).toBe("fal");
    expect(g.model.id).toBe("kling/v4/flash/text-to-video");
    expect(g.modes.map((m) => m.id)).toEqual(["text_to_video", "first_frame", "omni_reference"]);
    expect(run(g, {}).mode.id).toBe("text_to_video");
    expect(run(g, {}, [media("a", "image", "first_frame")], "frames").mode.id).toBe("first_frame");
    expect(run(g, {}, [media("a", "image")], "references").mode.id).toBe("omni_reference");
    expect(run(g, { duration: 99 }).settings.duration).toBe(20);
    expect(run(g, { duration: 1 }).settings.duration).toBe(3);
    expect(g.refLabel!("image", 1)).toBe("@Image1");
    expect(g.refLabel!("video", 2)).toBe("@Video2");
  });
  it("prices $0.094 a second, or $0.063 × (output + the longer of the input videos and the output)", () => {
    const t = run(g, { ratio: "9:16", duration: 10 }).price;
    expect(t.ok && t.usdCeiling).toBeCloseTo(10 * KLING4_FLASH_USD.second);
    const r = run(g, { duration: 5 }, [media("i", "image"), media("v", "video", "reference", 8_000)]).price;
    expect(r.ok && r.usdCeiling).toBeCloseTo((5 + 8) * KLING4_FLASH_USD.withVideo);
    expect(kling4Billed(10, 4)).toEqual({ per: KLING4_FLASH_USD.withVideo, sec: 20 });
    expect(kling4Billed(10, 0)).toEqual({ per: KLING4_FLASH_USD.second, sec: 10 });
  });
  it("sends each mode to its endpoint at 720p", () => {
    const base = { modelId: g.model.id, settings: { ratio: "9:16", duration: 10 }, prompt: " fly " };
    expect(kling4FlashRequest({ ...base, refs: [], urls: [] })).toEqual({ model: "kling/v4/flash/text-to-video", input: { prompt: "fly", duration: 10, resolution: "720p", aspect_ratio: "9:16" } });
    expect(kling4FlashRequest({ ...base, refs: [{ kind: "image", role: "first_frame" }], urls: ["f"] })).toEqual({ model: "kling/v4/flash/image-to-video", input: { prompt: "fly", duration: 10, resolution: "720p", start_image_url: "f" } });
    expect(kling4FlashRequest({ ...base, refs: [{ kind: "image", role: "reference" }, { kind: "video", role: "reference" }, { kind: "image", role: "reference" }], urls: ["i1", "v1", "i2"] })).toEqual({
      model: "kling/v4/flash/reference-to-video",
      input: { prompt: "fly", duration: 10, resolution: "720p", aspect_ratio: "9:16", image_urls: ["i1", "i2"], video_urls: ["v1"] },
    });
  });
});

describe("Kling 4.0 Flash · تعديل فيديو (fal kling/v4/flash/video-to-video)", () => {
  const g = generatorById(KLING4_FLASH_EDIT_ID)!;
  it("one video of 3–20 s (smallest side 700 px) and up to 10 pictures", () => {
    expect(g.modes).toHaveLength(1);
    expect(g.modes[0].refs).toEqual({ video: { min: 1, max: 1 }, image: { min: 0, max: 10 } });
    expect(fileProblem(g, media("v", "video", "reference", 20_000))).toBeNull();
    expect(fileProblem(g, media("v", "video", "reference", 20_500))).toContain("قصّه");
    expect(fileProblem(g, media("v", "video", "reference", 2_000))).not.toBeNull();
    expect(fileProblem(g, media("v", "video", "reference", 8_000, 480))).not.toBeNull();
  });
  it("is priced as the clip's seconds × 2 at the with-video rate", () => {
    const r = run(g, {}, [media("v", "video", "reference", 8_000)], "references", "make it rain").price;
    expect(r.ok && r.usdCeiling).toBeCloseTo(16 * KLING4_FLASH_USD.withVideo);
    expect(run(g, {}, [], "references", "make it rain").price.ok).toBe(false);
  });
  it("sends the video, the instruction and the pictures", () => {
    expect(kling4FlashEditRequest({ modelId: g.model.id, settings: {}, prompt: " rain ", refs: [{ kind: "image", role: "reference" }, { kind: "video", role: "reference" }], urls: ["i1", "v1"] })).toEqual({
      model: "kling/v4/flash/video-to-video",
      input: { prompt: "rain", video_url: "v1", resolution: "720p", image_urls: ["i1"] },
    });
    expect(() => kling4FlashEditRequest({ modelId: g.model.id, settings: {}, prompt: "rain", refs: [], urls: [] })).toThrow();
  });
});
