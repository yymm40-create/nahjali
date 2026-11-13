import { describe, expect, it } from "vitest";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { centiFor, generatorById, GPT_IMAGE_2_ID, GPT_IMAGE_26_ID, gptImage26Model, gptImage26OutputTokens, gptImage2OutputTokens, priceKindOf } from "@config/jawad/generators";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";

const image = (id: string): RefMeta => ({ id, kind: "image", role: "reference", mime: "image/png", bytes: 1000, width: 1024, height: 1024, status: "ready" });
const run = (def: GeneratorDef, settings: Record<string, unknown>, refs: RefMeta[] = [], prompt = "a cat") =>
  evaluate(def, { settings: settings as never, prompt, instructions: "", refStyle: refs.length ? "references" : "none", refs, strict: false }, priceTable(def, undefined));

describe("GPT Image 2.6 (OpenAI: Flare and Sunburst)", () => {
  const g = generatorById(GPT_IMAGE_26_ID)!;
  it("is an OpenAI picture generator of the creative studio, beside GPT Image 2 (kept as it was)", () => {
    expect(g.id).toBe("openai-gpt-image-2-6");
    expect(g.provider.id).toBe("openai");
    expect(g.output).toBe("image");
    expect(g.defaultSection).toBe("images");
    expect(generatorById(GPT_IMAGE_2_ID)!.model.id).toBe("gpt-image-2-2026-04-21");
    // «ربح الصور» stays GPT Image 2's alone (the owner's decision); 2.6 takes the general margin
    expect(priceKindOf(g)).toBe("other");
  });
  it("offers both models: Sunburst by default, Flare when chosen", () => {
    const variant = g.options.find((o) => o.key === "variant");
    expect(variant && variant.kind === "choice" && variant.values.map((v) => v.value)).toEqual(["flare", "sunburst"]);
    expect(run(g, {}).settings.variant).toBe("sunburst");
    expect(gptImage26Model("flare")).toBe("gpt-image-2.6-flare");
    expect(gptImage26Model("sunburst")).toBe("gpt-image-2.6-sunburst");
    expect(gptImage26Model("other")).toBe("gpt-image-2.6-sunburst");
  });
  it("has five qualities and the planning depth (high by default)", () => {
    const q = g.options.find((o) => o.key === "quality");
    expect(q && q.kind === "choice" && q.values.map((v) => v.value)).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(run(g, { quality: "max", complexity: "low" }).settings).toMatchObject({ quality: "max", complexity: "low" });
    expect(run(g, {}).settings.complexity).toBe("high");
  });
  it("counts output tokens with OpenAI's calculator for 2.6 (1024×1024: 823 · 1,449 · 1,756 · 3,122 · 7,024)", () => {
    expect((["low", "medium", "high", "xhigh", "max"] as const).map((q) => gptImage26OutputTokens(1024, 1024, q))).toEqual([823, 1449, 1756, 3122, 7024]);
    // GPT Image 2's own formula is untouched
    expect(gptImage2OutputTokens(1024, 1024, "medium")).toBe(1756);
  });
  it("prices a picture at the dearest size of its tier × $30 per million, plus the prompt and the references", () => {
    const tierMax = (q: "low" | "max") => Math.max(...[[1024, 1024], [1536, 864], [864, 1536], [1536, 1024], [1024, 1536]].map(([w, h]) => gptImage26OutputTokens(w, h, q)));
    expect(g.priceKeys.find((k) => k.key === "out:max:std")!.defaultCenti).toBe(centiFor((tierMax("max") * 30) / 1e6));
    expect(g.priceKeys.find((k) => k.key === "out:low:std")!.defaultCenti).toBe(centiFor((tierMax("low") * 30) / 1e6));
    const one = run(g, { quality: "medium", aspect: "1:1", count: 1 });
    expect(one.price.ok && one.price.usdCeiling).toBeCloseTo((1449 * 30) / 1e6 + (5 * 5) / 1e6);
    const two = run(g, { quality: "medium", count: 2 }, [image("a")]);
    expect(two.mode.id).toBe("image_reference");
    expect(two.price.ok && two.price.lines.map((l) => l.label)).toEqual(["2 × صورة", "البرومبت", "1 × مرجع"]);
  });
  it("takes up to 16 reference pictures", () => {
    expect(g.modes.find((m) => m.id === "image_reference")!.refs.image).toEqual({ min: 1, max: 16 });
  });
});
