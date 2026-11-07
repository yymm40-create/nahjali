import { describe, expect, it } from "vitest";
import { evaluate, fileProblem, priceTable } from "@/lib/jawad/engine";
import { centiFor, generatorById, GPT_IMAGE_26_ID, gptImage26OutputTokens, OMNI12_EDIT_ID, omni12EditSec } from "@config/jawad/generators";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";
import { omni12EditRequest } from "@/lib/jawad/server/gemini-omni";
import { cleanSvg } from "@/lib/jawad/server/providers/openai";

const media = (id: string, kind: "image" | "video", durationMs: number | null = null): RefMeta => ({ id, kind, role: "reference", mime: kind === "image" ? "image/png" : "video/mp4", bytes: 1000, width: 720, height: 1280, durationMs, fps: kind === "video" ? 24 : null, status: "ready" });
const run = (def: GeneratorDef, settings: Record<string, unknown>, refs: RefMeta[] = [], prompt = "make it night") =>
  evaluate(def, { settings: settings as never, prompt, instructions: "", refStyle: refs.length ? "references" : "none", refs, strict: false }, priceTable(def, undefined));

describe("Gemini Omni 1.2 · تعديل فيديو (fal v1.2/edit)", () => {
  const g = generatorById(OMNI12_EDIT_ID)!;
  it("is its own video card: one video of up to 15 s and an instruction", () => {
    expect(g.model.id).toBe("google/gemini-omni-flash/v1.2/edit");
    expect(g.modes).toHaveLength(1);
    expect(g.modes[0].refs).toEqual({ video: { min: 1, max: 1 } });
    expect(g.modes[0].promptRequired).toBe(true);
    expect(g.files.video?.maxMs).toBe(15_000);
    expect(g.files.image).toBeUndefined();
  });
  it("is priced per second of the clip sent, by resolution", () => {
    const r = run(g, { resolution: "720p" }, [media("v", "video", 10_000)]);
    expect(r.price.ok && r.price.usdCeiling).toBeCloseTo(10 * 0.0819);
    const k4 = run(g, { resolution: "4k" }, [media("v", "video", 15_000)]).price;
    expect(k4.ok && k4.usdCeiling).toBeCloseTo(15 * 0.2457);
    expect(run(g, { resolution: "720p" }).price.ok).toBe(false);
    expect(omni12EditSec([{ kind: "video", durationMs: 14_900 }])).toBe(15);
    expect(omni12EditSec([{ kind: "video", durationMs: 7_020 }])).toBe(7);
  });
  it("a 15.01 s video is refused with its real length and the way out (cut it)", () => {
    const msg = fileProblem(g, media("v", "video", 15_010));
    expect(msg).toContain("15.01");
    expect(msg).toContain("قصّه");
    expect(fileProblem(g, media("v", "video", 15_000))).toBeNull();
  });
  it("sends the instruction, the video and the resolution to the edit endpoint", () => {
    expect(omni12EditRequest({ modelId: g.model.id, settings: { resolution: "1080p" }, prompt: " night ", refs: [{ kind: "video", role: "reference" }], urls: ["v1"] })).toEqual({
      model: "google/gemini-omni-flash/v1.2/edit",
      input: { prompt: "night", video_url: "v1", resolution: "1080p" },
    });
  });
});

describe("GPT Image 2.6: animated GIF and SVG", () => {
  const g = generatorById(GPT_IMAGE_26_ID)!;
  it("a picture by default; GIF shows its frames (9 of 200 ms by default), one at a time, no resolution", () => {
    expect(run(g, {}).settings.format).toBe("png");
    const r = run(g, { format: "gif", count: 4 });
    expect(r.settings).toMatchObject({ format: "gif", frames: 9, frameMs: 200, count: 1 });
    expect(r.options.find((o) => o.key === "resolution")?.hidden).toBe(true);
    expect(run(g, {}).options.find((o) => o.key === "frames")?.hidden).toBe(true);
    expect(run(g, { format: "gif", frames: 99, frameMs: 5 }).settings).toMatchObject({ frames: 16, frameMs: 20 });
  });
  it("prices a GIF per frame like a picture of the frame's size", () => {
    const frame = Math.max(...[[512, 512], [768, 432], [432, 768], [768, 512], [512, 768]].map(([w, h]) => gptImage26OutputTokens(w, h, "medium")));
    expect(g.priceKeys.find((k) => k.key === "gif:frame:medium")!.defaultCenti).toBe(centiFor((frame * 30) / 1e6));
    const r = run(g, { format: "gif", frames: 12, quality: "medium" });
    expect(r.price.ok && r.price.lines[0]).toMatchObject({ label: "GIF · 12 إطار" });
    expect(r.price.ok && r.price.usdCeiling).toBeCloseTo((12 * frame * 30) / 1e6 + (13 * 5) / 1e6);
  });
  it("SVG: text only, one at a time", () => {
    const r = run(g, { format: "svg", count: 3 });
    expect(r.settings.count).toBe(1);
    expect(r.issues).toEqual([]);
    expect(run(g, { format: "svg" }, [media("a", "image")]).issues.some((i) => i.field === "refs")).toBe(true);
  });
  it("an SVG is kept as drawing only", () => {
    const out = cleanSvg(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>alert(1)</script><a href="javascript:x()"><rect width="9" height="9" onclick='y'/></a></svg>`)).toString();
    expect(out).not.toMatch(/script|onload|onclick|javascript:/i);
    expect(out).toContain("<rect");
    expect(() => cleanSvg(Buffer.from("not an svg"))).toThrow();
  });
});

describe("GPT Image 2.6 SVG: the author model", () => {
  it("names the model that writes the SVG (required: «SVG generation requires 'svg.model'»)", async () => {
    const { SVG_AUTHOR_MODEL } = await import("@config/jawad/generators");
    expect(SVG_AUTHOR_MODEL).toBe("gpt-6.1-sol");
  });
});
