import { describe, expect, it } from "vitest";
import { needsProxy, PROXY_SIDE } from "@/components/jawad/editor/proxy";

describe("«النسخة الخفيفة»: which videos get a light copy for the preview", () => {
  it("4K and anything over 1080p, in either orientation", () => {
    expect(needsProxy({ kind: "video", width: 3840, height: 2160 })).toBe(true);
    expect(needsProxy({ kind: "video", width: 2160, height: 3840 })).toBe(true);
    expect(needsProxy({ kind: "video", width: 2560, height: 1440 })).toBe(true);
  });
  it("not 1080p or smaller, not pictures or sounds, not a video of unknown size", () => {
    expect(needsProxy({ kind: "video", width: 1920, height: 1080 })).toBe(false);
    expect(needsProxy({ kind: "video", width: 1080, height: 1920 })).toBe(false);
    expect(needsProxy({ kind: "video", width: 1280, height: 720 })).toBe(false);
    expect(needsProxy({ kind: "image", width: 4000, height: 3000 })).toBe(false);
    expect(needsProxy({ kind: "video", width: null, height: null })).toBe(false);
    expect(PROXY_SIDE).toBe(1920);
  });
});
