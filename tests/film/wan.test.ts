import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ submit: vi.fn(async () => "req9"), task: vi.fn(async () => ({ status: "succeeded", videoUrl: "https://v/w.mp4", error: null })) }));
vi.mock("@/lib/jawad/server/providers/fal", () => ({ falSubmit: mocks.submit, falTask: mocks.task }));
import { createVideoTask, getVideoTask, wanFilmRequest } from "@/lib/film/seedance";
import { VIDEO_MODELS, videoEstimateUsd } from "@config/film";

describe("Wan 3.0 in the film maker", () => {
  it("is offered beside Seedance: up to 30 s, and much cheaper than 2.5", () => {
    expect(VIDEO_MODELS["wan-3.0"].maxSeconds).toBe(30);
    for (const q of ["480p", "720p", "1080p"] as const) expect(videoEstimateUsd("wan-3.0", q, 10)).toBeLessThan(0.5 * videoEstimateUsd("seedance-2.5", q, 10));
    // the estimate matches fal's per-second price ($0.10 a second at 720p)
    expect(videoEstimateUsd("wan-3.0", "720p", 10)).toBeCloseTo(1, 1);
  });
  it("sends the references named its way, at most 10 pictures, and is followed on fal", async () => {
    const imgs = Array.from({ length: 12 }, (_, i) => `i${i}`);
    const id = await createVideoTask({ model: "wan-3.0", prompt: "<<<image_1>>> rides past <<<image_2>>>, says <<<audio_1>>>", imageUrls: imgs, audioUrls: ["a1"], durationSec: 30, resolution: "720p", ratio: "9:16", generateAudio: true });
    expect(id).toBe("wan:req9");
    expect(mocks.submit).toHaveBeenCalledWith("alibaba/wan-3.0/reference-to-video", expect.objectContaining({ prompt: "Image 1 rides past Image 2, says Audio 1", reference_image_urls: imgs.slice(0, 10), reference_audio_urls: ["a1"], duration: 30, resolution: "720p", aspect_ratio: "9:16", audio: true }));
    expect(await getVideoTask(id)).toMatchObject({ status: "succeeded", videoUrl: "https://v/w.mp4", tokens: null });
    expect(mocks.task).toHaveBeenCalledWith("alibaba/wan-3.0", "req9");
  });
  it("without references it is text to video", () => {
    expect(wanFilmRequest({ model: "wan-3.0", prompt: "a boy", imageUrls: [], durationSec: 8, resolution: "480p", ratio: "16:9", generateAudio: false }).model).toBe("alibaba/wan-3.0/text-to-video");
  });
});
