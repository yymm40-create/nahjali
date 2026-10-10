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
