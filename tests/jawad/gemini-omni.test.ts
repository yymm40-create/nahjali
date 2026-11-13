import { describe, expect, it } from "vitest";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { generatorById, OMNI12_ID, OMNI12_SECOND_USD, OMNI_SECOND_USD } from "@config/jawad/generators";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";
import { omni12Request, omniRequest } from "@/lib/jawad/server/gemini-omni";

const media = (id: string, kind: "image" | "video", role: RefMeta["role"] = "reference", durationMs: number | null = null): RefMeta => ({ id, kind, role, mime: kind === "image" ? "image/png" : "video/mp4", bytes: 1000, width: 1024, height: 1024, durationMs, fps: kind === "video" ? 24 : null, status: "ready" });
const run = (def: GeneratorDef, settings: Record<string, unknown>, refs: RefMeta[] = [], refStyle: "none" | "references" | "frames" = refs.length ? "references" : "none") =>
  evaluate(def, { settings: settings as never, prompt: "a boy wakes up", instructions: "", refStyle, refs, strict: false }, priceTable(def, undefined));

describe("Gemini Omni (Google, on fal.ai)", () => {
  const omni = generatorById("gemini-omni")!;
  it("is a video generator on fal's queue", () => {
    expect(omni.provider.id).toBe("fal");
    expect(omni.output).toBe("video");
    expect(omni.model.id).toBe("google/gemini-omni-flash/v1.1/text-to-video");
  });
  it("is priced per second by resolution ($0.03 · $0.10 · $0.15 · $0.30), 3–10 s, and the sound is free and always on", () => {
    for (const [res, usd] of Object.entries({ "360p": 0.03, "720p": 0.1, "1080p": 0.15, "4k": 0.3 })) {
      expect(OMNI_SECOND_USD[res]).toBe(usd);
      const r = run(omni, { ratio: "16:9", resolution: res, duration: 10 });
      expect(r.price.ok && r.price.usdCeiling).toBeCloseTo(10 * usd);
    }
    expect(run(omni, { duration: 99 }).settings.duration).toBe(10);
    expect(run(omni, { duration: 0 }).settings.duration).toBe(3);
    expect(omni.options.some((o) => o.key === "audio")).toBe(false);
  });
  it("picks its mode from the references, and names them from zero", () => {
    expect(run(omni, {}).mode.id).toBe("text_to_video");
    expect(run(omni, {}, [media("a", "image", "first_frame")], "frames").mode.id).toBe("first_frame");
    expect(run(omni, {}, [media("a", "image", "first_frame"), media("b", "image", "last_frame")], "frames").mode.id).toBe("first_last_frame");
    expect(run(omni, {}, [media("a", "image")], "references").mode.id).toBe("omni_reference");
    expect(omni.refLabel?.("image", 1)).toBe("<IMAGE_REF_0>");
    expect(omni.refLabel?.("video", 2)).toBe("<VIDEO_REF_1>");
  });
});

describe("what Gemini Omni is sent", () => {
  const M = "google/gemini-omni-flash/v1.1/text-to-video";
  const settings = { ratio: "9:16", resolution: "720p", duration: 8 };
  it("text: the text endpoint", () => {
    expect(omniRequest({ modelId: M, settings, prompt: " a boy wakes up ", refs: [], urls: [] })).toEqual({ model: M, input: { prompt: "a boy wakes up", resolution: "720p", duration: 8, aspect_ratio: "9:16" } });
  });
  it("frames: the image endpoint with the first (and the last) picture", () => {
    const r = omniRequest({ modelId: M, settings, prompt: "", refs: [{ kind: "image", role: "last_frame" }, { kind: "image", role: "first_frame" }], urls: ["end", "start"] });
    expect(r.model).toBe("google/gemini-omni-flash/v1.1/image-to-video");
    expect(r.input).toMatchObject({ image_url: "start", end_image_url: "end", aspect_ratio: "9:16" });
  });
  it("references: pictures and videos in their own lists; the length stays inside 3–10", () => {
    const r = omniRequest({ modelId: M, settings: { ...settings, duration: 99 }, prompt: "p", refs: [{ kind: "image", role: "reference" }, { kind: "video", role: "reference" }, { kind: "image", role: "reference" }], urls: ["i1", "v1", "i2"] });
    expect(r.model).toBe("google/gemini-omni-flash/v1.1/reference-to-video");
    expect(r.input).toMatchObject({ image_urls: ["i1", "i2"], reference_video_urls: ["v1"], duration: 10 });
    expect(r.input).not.toHaveProperty("reference_audio_urls");
  });
});

describe("Gemini Omni 1.2 (Google, on fal.ai), beside 1.1", () => {
  const omni12 = generatorById(OMNI12_ID)!;
  const omni11 = generatorById("gemini-omni")!;
  it("is its own video generator on fal's queue, and 1.1 stays as it was", () => {
    expect(omni12.id).toBe("gemini-omni-1-2");
    expect(omni12.provider.id).toBe("fal");
    expect(omni12.output).toBe("video");
    expect(omni12.defaultSection).toBe("video");
    expect(omni12.model.id).toBe("google/gemini-omni-flash/v1.2/text-to-video");
    expect(omni11.model.id).toBe("google/gemini-omni-flash/v1.1/text-to-video");
    expect(omni11.options.find((o) => o.key === "duration")).toMatchObject({ max: 10 });
  });
  it("is priced per second by resolution ($0.0273 · $0.0819 · $0.1229 · $0.2457), 3–15 s, the sound free and always on", () => {
    for (const [res, usd] of Object.entries({ "360p": 0.0273, "720p": 0.0819, "1080p": 0.1229, "4k": 0.2457 })) {
      expect(OMNI12_SECOND_USD[res]).toBe(usd);
      const r = run(omni12, { ratio: "9:16", resolution: res, duration: 15 });
      expect(r.price.ok && r.price.usdCeiling).toBeCloseTo(15 * usd);
    }
    expect(run(omni12, { duration: 99 }).settings.duration).toBe(15);
    expect(run(omni12, { duration: 0 }).settings.duration).toBe(3);
    expect(omni12.options.some((o) => o.key === "audio")).toBe(false);
    expect(omni12.priceKeys.some((k) => k.key === "director:prompt")).toBe(true);
  });
  it("keeps a first-and-last-frame video within 10 s", () => {
    const r = run(omni12, { duration: 15 }, [media("a", "image", "first_frame"), media("b", "image", "last_frame")], "frames");
    expect(r.mode.id).toBe("first_last_frame");
    expect(r.settings.duration).toBe(10);
    expect(r.price.ok && r.price.usdCeiling).toBeCloseTo(10 * 0.0819);
    expect(run(omni12, { duration: 15 }, [media("a", "image", "first_frame")], "frames").settings.duration).toBe(15);
  });
  it("takes reference videos up to 15 s (1.1: up to 3 s)", () => {
    expect(omni12.files.video?.maxMs).toBe(15000);
    expect(omni11.files.video?.maxMs).toBe(3000);
    expect(run(omni12, {}, [media("v", "video", "reference", 14_000)]).mode.id).toBe("omni_reference");
  });
});

describe("what Gemini Omni 1.2 is sent", () => {
  const M = "google/gemini-omni-flash/v1.2/text-to-video";
  const settings = { ratio: "9:16", resolution: "1080p", duration: 15 };
  it("text: the v1.2 text endpoint, 15 s kept", () => {
    expect(omni12Request({ modelId: M, settings, prompt: "a boy", refs: [], urls: [] })).toEqual({ model: M, input: { prompt: "a boy", resolution: "1080p", duration: 15, aspect_ratio: "9:16" } });
  });
  it("a first frame alone keeps 15 s; with a last frame the length drops to 10", () => {
    expect(omni12Request({ modelId: M, settings, prompt: "", refs: [{ kind: "image", role: "first_frame" }], urls: ["start"] }).input.duration).toBe(15);
    const r = omni12Request({ modelId: M, settings, prompt: "", refs: [{ kind: "image", role: "first_frame" }, { kind: "image", role: "last_frame" }], urls: ["start", "end"] });
    expect(r.model).toBe("google/gemini-omni-flash/v1.2/image-to-video");
    expect(r.input).toMatchObject({ image_url: "start", end_image_url: "end", duration: 10 });
  });
  it("references: the v1.2 reference endpoint, the length inside 3–15", () => {
    const r = omni12Request({ modelId: M, settings: { ...settings, duration: 99 }, prompt: "p", refs: [{ kind: "video", role: "reference" }, { kind: "image", role: "reference" }], urls: ["v1", "i1"] });
    expect(r.model).toBe("google/gemini-omni-flash/v1.2/reference-to-video");
    expect(r.input).toMatchObject({ image_urls: ["i1"], reference_video_urls: ["v1"], duration: 15 });
  });
  it("1.1 still stops at 10 s", () => {
    expect(omniRequest({ modelId: "google/gemini-omni-flash/v1.1/text-to-video", settings, prompt: "p", refs: [], urls: [] }).input.duration).toBe(10);
  });
});
