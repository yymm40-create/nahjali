import { describe, expect, it } from "vitest";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { FAL_IMAGE_SIZES, generatorById, KLING_SECOND_USD } from "@config/jawad/generators";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";

const img = (id: string, role: RefMeta["role"] = "reference"): RefMeta => ({ id, kind: "image", role, mime: "image/png", bytes: 1000, width: 1024, height: 1024, durationMs: null, fps: null, status: "ready" });
const run = (def: GeneratorDef, settings: Record<string, unknown>, refs: RefMeta[] = [], refStyle: "none" | "references" | "frames" = refs.length ? "references" : "none", prompt = "a red apple") =>
  evaluate(def, { settings: settings as never, prompt, instructions: "", refStyle, refs, strict: false }, priceTable(def, undefined));

describe("the fal.ai generators (FLUX.2 Pro · Ideogram 3 · Kling 3.0)", () => {
  const flux = generatorById("bfl-flux-2-pro")!;
  const ideo = generatorById("ideogram-v3")!;
  const kling = generatorById("kling-3-pro")!;

  it("are registered on fal, each in its own section", () => {
    for (const g of [flux, ideo, kling]) expect(g.provider.id).toBe("fal");
    expect([flux.output, ideo.output, kling.output]).toEqual(["image", "image", "video"]);
    expect(kling.api.tracking).toBe("async");
    for (const a of flux.options.find((o) => o.key === "aspect")!.kind === "choice" ? (flux.options.find((o) => o.key === "aspect") as { values: { value: string }[] }).values : []) expect(FAL_IMAGE_SIZES[a.value]).toBeTruthy();
  });

  it("FLUX.2 Pro: one picture, each reference picture adds its price", () => {
    const plain = run(flux, { aspect: "16:9", count: 4 });
    expect(plain.price.ok && plain.price.usdCeiling).toBeCloseTo(0.03);
    const two = run(flux, { aspect: "1:1" }, [img("a"), img("b")]);
    expect(two.price.ok && two.price.usdCeiling).toBeCloseTo(0.09);
    expect(two.mode.id).toBe("image_reference");
  });

  it("Ideogram 3: the speed sets the price, Arabic only warns", () => {
    const turbo = run(ideo, { aspect: "1:1", resolution: "TURBO", count: 2 });
    expect(turbo.price.ok && turbo.price.usdCeiling).toBeCloseTo(0.06);
    const quality = run(ideo, { aspect: "1:1", resolution: "QUALITY", count: 1 }, [], "none", "تفاحة حمراء");
    expect(quality.price.ok && quality.price.usdCeiling).toBeCloseTo(0.09);
    expect(quality.issues).toEqual([]);
    expect(quality.notes.join(" ")).toMatch(/الإنجليزية/);
  });

  it("Kling 3.0: priced per second, sound costs more, frames pick the mode", () => {
    const loud = run(kling, { ratio: "9:16", duration: 10, audio: true });
    expect(loud.price.ok && loud.price.usdCeiling).toBeCloseTo(10 * KLING_SECOND_USD.audio);
    const quiet = run(kling, { ratio: "9:16", duration: 10, audio: false });
    expect(quiet.price.ok && quiet.price.usdCeiling).toBeCloseTo(10 * KLING_SECOND_USD.silent);
    expect(run(kling, { duration: 99 }).settings.duration).toBe(15);
    expect(run(kling, {}, [img("a", "first_frame")], "frames").mode.id).toBe("first_frame");
    expect(run(kling, {}, [img("a", "first_frame"), img("b", "last_frame")], "frames").mode.id).toBe("first_last_frame");
  });
});

describe("Wan 3.0 (Alibaba, on fal.ai)", () => {
  const wan = generatorById("wan-3-0")!;
  const media = (id: string, kind: "image" | "video" | "audio", durationMs: number | null = null): RefMeta => ({ id, kind, role: "reference", mime: kind === "image" ? "image/png" : kind === "video" ? "video/mp4" : "audio/mpeg", bytes: 1000, width: kind === "audio" ? null : 1024, height: kind === "audio" ? null : 1024, durationMs, fps: kind === "video" ? 24 : null, status: "ready" });

  it("is a video generator on fal's queue, followed like Kling", () => {
    expect(wan.provider.id).toBe("fal");
    expect(wan.output).toBe("video");
    expect(wan.api.tracking).toBe("async");
    expect(wan.model.id).toBe("alibaba/wan-3.0/text-to-video");
  });
  it("is priced per second by resolution ($0.05 · $0.10 · $0.20), 2–30 s", () => {
    for (const [res, usd] of [["480p", 0.05], ["720p", 0.1], ["1080p", 0.2]] as const) {
      const r = run(wan, { ratio: "16:9", resolution: res, duration: 10 });
      expect(r.price.ok && r.price.usdCeiling).toBeCloseTo(10 * usd);
    }
    expect(run(wan, { duration: 99 }).settings.duration).toBe(30);
    expect(run(wan, { duration: 0 }).settings.duration).toBe(2);
  });
  it("picks its mode from the references: text, first frame, first and last, references", () => {
    expect(run(wan, {}).mode.id).toBe("text_to_video");
    expect(run(wan, {}, [img("a", "first_frame")], "frames").mode.id).toBe("first_frame");
    expect(run(wan, {}, [img("a", "first_frame"), img("b", "last_frame")], "frames").mode.id).toBe("first_last_frame");
    expect(run(wan, {}, [img("a")], "references").mode.id).toBe("omni_reference");
  });
  it("takes sound references (up to 5, 15 s in all) and bills the reference videos' seconds on top", () => {
    const one = run(wan, { resolution: "720p", duration: 10 }, [img("a"), media("s", "audio", 8000)], "references");
    expect(one.mode.id).toBe("omni_reference");
    expect(one.issues).toEqual([]);
    expect(one.price.ok && one.price.usdCeiling).toBeCloseTo(10 * 0.1);
    expect(one.notes.join(" ")).toMatch(/الصوت المرجعي/);
    // two sounds of 10 s: over the 15 s total
    const tooLong = run(wan, { resolution: "720p" }, [img("a"), media("s1", "audio", 10_000), media("s2", "audio", 10_000)], "references");
    expect(tooLong.issues.length).toBeGreaterThan(0);
    // six sounds: over the count
    const six = run(wan, { resolution: "720p" }, [img("a"), ...Array.from({ length: 6 }, (_, i) => media(`s${i}`, "audio", 1000))], "references");
    expect(six.issues.length).toBeGreaterThan(0);
    // a 6 s reference video is billed on top of a 10 s output
    const withVideo = run(wan, { resolution: "720p", duration: 10 }, [img("a"), media("v", "video", 6000)], "references");
    expect(withVideo.price.ok && withVideo.price.usdCeiling).toBeCloseTo(16 * 0.1);
  });
  it("names the references «Image 1», «Video 1», «Audio 1» for the prompt", () => {
    expect(wan.refLabel?.("image", 1)).toBe("Image 1");
    expect(wan.refLabel?.("video", 2)).toBe("Video 2");
    expect(wan.refLabel?.("audio", 1)).toBe("Audio 1");
  });
});
