import { describe, expect, it } from "vitest";
import { wanRequest } from "@/lib/jawad/server/wan";

const MODEL = "alibaba/wan-3.0/text-to-video";
const settings = { ratio: "9:16", resolution: "720p", duration: 8, audio: true };

describe("what Wan 3.0 is sent (fal's queue)", () => {
  it("text: the text endpoint with the ratio", () => {
    const r = wanRequest({ modelId: MODEL, settings, prompt: "  a boy wakes up  ", refs: [], urls: [] });
    expect(r.model).toBe(MODEL);
    expect(r.input).toEqual({ prompt: "a boy wakes up", resolution: "720p", duration: 8, audio: true, aspect_ratio: "9:16" });
  });
  it("first frame, and first and last: the image endpoint, no ratio (it follows the picture)", () => {
    const one = wanRequest({ modelId: MODEL, settings, prompt: "", refs: [{ kind: "image", role: "first_frame" }], urls: ["u1"] });
    expect(one.model).toBe("alibaba/wan-3.0/image-to-video");
    expect(one.input).toEqual({ resolution: "720p", duration: 8, audio: true, start_image_url: "u1" });
    const two = wanRequest({ modelId: MODEL, settings, prompt: "x", refs: [{ kind: "image", role: "last_frame" }, { kind: "image", role: "first_frame" }], urls: ["end", "start"] });
    expect(two.input).toMatchObject({ start_image_url: "start", end_image_url: "end" });
  });
  it("references: pictures, videos and SOUNDS each in their own list", () => {
    const refs = [
      { kind: "image", role: "reference" },
      { kind: "audio", role: "reference" },
      { kind: "video", role: "reference" },
      { kind: "image", role: "reference" },
      { kind: "audio", role: "reference" },
    ];
    const r = wanRequest({ modelId: MODEL, settings: { ...settings, audio: false }, prompt: "the boy in Image 1 speaks Audio 1", refs, urls: ["i1", "a1", "v1", "i2", "a2"] });
    expect(r.model).toBe("alibaba/wan-3.0/reference-to-video");
    expect(r.input).toMatchObject({ audio: false, aspect_ratio: "9:16", reference_image_urls: ["i1", "i2"], reference_video_urls: ["v1"], reference_audio_urls: ["a1", "a2"] });
  });
  it("leaves out the lists with nothing in them, and keeps the length inside 2–30", () => {
    const r = wanRequest({ modelId: MODEL, settings: { ...settings, duration: 99 }, prompt: "p", refs: [{ kind: "audio", role: "reference" }], urls: ["a1"] });
    expect(r.input).not.toHaveProperty("reference_image_urls");
    expect(r.input).not.toHaveProperty("reference_video_urls");
    expect(r.input).toMatchObject({ duration: 30, reference_audio_urls: ["a1"] });
    expect(wanRequest({ modelId: MODEL, settings: { ...settings, duration: 0 }, prompt: "p", refs: [], urls: [] }).input.duration).toBe(5);
  });
});
