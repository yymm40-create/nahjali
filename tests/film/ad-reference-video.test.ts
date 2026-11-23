import { describe, expect, it } from "vitest";
import { wanFilmRequest } from "@/lib/film/seedance";
import { videoCostUsd, videoEstimateUsd } from "@config/film";
import { AD_REF_VIDEO_PROMPT } from "@config/film-ad";

const base = { model: "wan-3.0" as const, prompt: "Hands brew coffee <<<image_1>>>.", imageUrls: ["https://x/i1.png"], durationSec: 15, ratio: "9:16", generateAudio: true, resolution: "480p" as const };

describe("«📣 إعلان»: the reference ad's own video goes with Wan 3.0", () => {
  it("is sent as Wan's reference video, and the prompt asks to recreate it exactly", () => {
    const r = wanFilmRequest({ ...base, videoUrls: ["https://x/ref.mp4"] });
    expect(r.model).toBe("alibaba/wan-3.0/reference-to-video");
    expect(r.input.reference_video_urls).toEqual(["https://x/ref.mp4"]);
    expect(r.input.reference_image_urls).toEqual(["https://x/i1.png"]);
    expect(String(r.input.prompt)).toContain("Image 1");
    expect(String(r.input.prompt)).toContain(AD_REF_VIDEO_PROMPT);
    expect(AD_REF_VIDEO_PROMPT).toContain("Recreate Video 1 EXACTLY");
  });

  it("a video alone still goes as references, and without one nothing changes", () => {
    expect(wanFilmRequest({ ...base, imageUrls: [], videoUrls: ["https://x/ref.mp4"] }).model).toBe("alibaba/wan-3.0/reference-to-video");
    const plain = wanFilmRequest(base);
    expect(plain.input.reference_video_urls).toBeUndefined();
    expect(String(plain.input.prompt)).not.toContain("Video 1");
  });

  it("its seconds are charged like the video's own", () => {
    expect(videoCostUsd("wan-3.0", "480p", 15, 14)).toBeCloseTo(videoEstimateUsd("wan-3.0", "480p", 15) + videoEstimateUsd("wan-3.0", "480p", 14));
    expect(videoCostUsd("wan-3.0", "480p", 15)).toBeCloseTo(videoEstimateUsd("wan-3.0", "480p", 15));
    expect(videoCostUsd("wan-3.0", "480p", 0, 14)).toBeCloseTo(videoEstimateUsd("wan-3.0", "480p", 14));
  });
});
