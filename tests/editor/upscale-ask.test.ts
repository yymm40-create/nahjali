import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UPSCALE_MAX_MS, UPSCALE_TARGETS, UPSCALE_USD_PER_SEC, upscaleFactor, upscaledSize } from "@/lib/editor/upscale";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const assistant = readFileSync("src/lib/editor/assistant.ts", "utf8");
const panel = readFileSync("src/components/jawad/editor/AssistantPanel.tsx", "utf8");
const inspector = readFileSync("src/components/jawad/editor/Inspector.tsx", "utf8");

describe("«رفع الدقة» is reachable, not hidden in one corner", () => {
  it("حيدرة knows it: the request kind, the target and when not to offer it", () => {
    // the kind is in the schema's enum, and the guide tells him how to send it
    expect(assistant).toMatch(/enum: \["hook_design"[^\]]*"upscale"\]/);
    expect(assistant).toContain('{"kind":"upscale","clipId"');
    expect(assistant).toContain("رفع الدقة");
    // he must not start it by himself, and must say no for a clip that is already 4K
    expect(assistant).toContain("never start it on your own");
    expect(assistant).toContain("3800");
  });

  it("the chat runs it on the clip's own file, with a clear reason when it can't", () => {
    expect(panel).toContain('q.kind === "upscale"');
    expect(panel).toContain("رفع الدقة للفيديو فقط");
    expect(panel).toContain("هذا 4K أصلًا");
    expect(panel).toContain("onUpscale");
  });

  it("the button stays in the clip's own tab too", () => {
    expect(inspector).toContain("رفع الدقة بالذكاء الاصطناعي");
    expect(inspector).toContain("إلى 4K");
  });

  it("the person (and every robot) is told what it costs and what it does", () => {
    expect(JAWAD_KNOWLEDGE).toContain("رفع الدقة");
    expect(JAWAD_KNOWLEDGE).toContain("FAL_KEY");
    expect(JAWAD_KNOWLEDGE).toContain("Topaz");
  });
});

describe("the engine's own numbers", () => {
  it("raises a small clip and refuses one that has nothing to gain", () => {
    expect(UPSCALE_TARGETS["4k"]).toBe(3840);
    expect(upscaleFactor(1920, 1080, "4k")).toBeCloseTo(2, 5);
    expect(upscaleFactor(1080, 1920, "1080p")).toBeNull();
    expect(upscaleFactor(3840, 2160, "4k")).toBeNull();
    expect(UPSCALE_USD_PER_SEC["4k"]).toBeGreaterThan(UPSCALE_USD_PER_SEC["1080p"]);
    expect(UPSCALE_MAX_MS).toBe(300_000);
  });
  it("keeps the new size even (a video's frame must be)", () => {
    for (const [w, h] of [[1920, 1080], [1080, 1920], [1278, 719], [641, 361]] as const) {
      const f = upscaleFactor(w, h, "4k")!;
      const size = upscaledSize(w, h, f);
      expect(size.width % 2, `${w}x${h}`).toBe(0);
      expect(size.height % 2, `${w}x${h}`).toBe(0);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(3842);
    }
  });
});
