import { describe, expect, it } from "vitest";
import { evaluate, fileProblem, priceTable } from "@/lib/jawad/engine";
import { generatorById, KLING4_EDIT_ID, KLING4_FLASH_EDIT_ID, KLING4_FLASH_ID, KLING4_FLASH_USD, KLING4_ID, KLING4_USD, kling4Billed } from "@config/jawad/generators";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";
import { kling4EditRequest, kling4FlashEditRequest, kling4FlashRequest, kling4Request } from "@/lib/jawad/server/kling4";

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

describe("Kling 4.0 (fal kling/v4)", () => {
  const g = generatorById(KLING4_ID)!;
  const full = KLING4_USD.full;
  it("text, a first frame, first and last frames, or references; 3–30 s at 720p or 1080p", () => {
    expect(g.model.id).toBe("kling/v4/text-to-video");
    expect(g.modes.map((m) => m.id)).toEqual(["text_to_video", "first_frame", "first_last_frame", "omni_reference"]);
    expect(run(g, {}, [media("a", "image", "first_frame"), media("b", "image", "last_frame")], "frames").mode.id).toBe("first_last_frame");
    expect(run(g, { duration: 99 }).settings.duration).toBe(30);
    expect(run(g, {}).settings.resolution).toBe("1080p");
    expect(g.modes[3].refs.video).toEqual({ min: 0, max: 5, totalMaxMs: 30_000 });
  });
  it("prices by resolution, and with a reference video the input plus the output (at least twice the output)", () => {
    const hd = run(g, { duration: 10, resolution: "1080p" }).price;
    expect(hd.ok && hd.usdCeiling).toBeCloseTo(10 * full["1080p"].second);
    const sd = run(g, { duration: 10, resolution: "720p" }).price;
    expect(sd.ok && sd.usdCeiling).toBeCloseTo(10 * full["720p"].second);
    const withVid = run(g, { duration: 10, resolution: "1080p" }, [media("v", "video", "reference", 4_000)]).price;
    expect(withVid.ok && withVid.usdCeiling).toBeCloseTo(20 * full["1080p"].withVideo);
    const longVid = run(g, { duration: 5, resolution: "720p" }, [media("v", "video", "reference", 12_000)]).price;
    expect(longVid.ok && longVid.usdCeiling).toBeCloseTo(17 * full["720p"].withVideo);
  });
  it("sends the last frame and the resolution", () => {
    expect(kling4Request({ modelId: g.model.id, settings: { duration: 12, resolution: "720p" }, prompt: "", refs: [{ kind: "image", role: "first_frame" }, { kind: "image", role: "last_frame" }], urls: ["a", "b"] })).toEqual({
      model: "kling/v4/image-to-video",
      input: { duration: 12, resolution: "720p", start_image_url: "a", end_image_url: "b" },
    });
    expect(kling4Request({ modelId: g.model.id, settings: { ratio: "16:9", duration: 30 }, prompt: "go", refs: [], urls: [] }).input).toMatchObject({ resolution: "1080p", duration: 30, aspect_ratio: "16:9" });
  });
});

describe("Kling 4.0 · تعديل فيديو (fal kling/v4/video-to-video/edit)", () => {
  const g = generatorById(KLING4_EDIT_ID)!;
  it("a video of up to 30 s, priced as its seconds × 2 at the with-video rate of the resolution", () => {
    expect(g.model.id).toBe("kling/v4/video-to-video/edit");
    expect(fileProblem(g, media("v", "video", "reference", 30_000))).toBeNull();
    expect(fileProblem(g, media("v", "video", "reference", 30_500))).toContain("قصّه");
    const r = run(g, { resolution: "1080p" }, [media("v", "video", "reference", 12_000)], "references", "rain").price;
    expect(r.ok && r.usdCeiling).toBeCloseTo(24 * KLING4_USD.full["1080p"].withVideo);
  });
  it("sends the video, the instruction and the resolution", () => {
    expect(kling4EditRequest({ modelId: g.model.id, settings: { resolution: "720p" }, prompt: "rain", refs: [{ kind: "video", role: "reference" }], urls: ["v1"] })).toEqual({
      model: "kling/v4/video-to-video/edit",
      input: { prompt: "rain", video_url: "v1", resolution: "720p" },
    });
  });
});
