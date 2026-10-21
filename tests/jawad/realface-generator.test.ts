import { describe, expect, it } from "vitest";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { generatorById, REALFACE_20_SECOND_USD, REALFACE_SECOND_USD } from "@config/jawad/generators";
import type { GeneratorDef, RefMeta } from "@config/jawad/types";

const img = (id: string, role: RefMeta["role"] = "reference"): RefMeta => ({ id, kind: "image", role, mime: "image/png", bytes: 1000, width: 1024, height: 1024, durationMs: null, fps: null, status: "ready" });
const run = (def: GeneratorDef, settings: Record<string, unknown>, refs: RefMeta[], refStyle: "references" | "frames") =>
  evaluate(def, { settings: settings as never, prompt: "", instructions: "", refStyle, refs, strict: false }, priceTable(def, undefined));

describe("«Seedance وجه واقعي»", () => {
  const def = generatorById("seedance-real-face")!;

  it("is a video generator whose partner is never named to users", () => {
    expect(def.output).toBe("video");
    expect(def.api.tracking).toBe("async");
    expect(`${def.name} ${def.provider.label} ${def.model.id} ${def.notes.join(" ")}`).not.toMatch(/higgs/i);
  });

  it("a photo as the first frame, or photos as references", () => {
    expect(run(def, { version: "2.5", resolution: "720p", duration: 5, audio: true, ratio: "9:16" }, [img("a", "first_frame")], "frames").mode.id).toBe("first_frame");
    expect(run(def, { version: "2.5", resolution: "720p", duration: 5, audio: true, ratio: "9:16" }, [img("a", "first_frame"), img("b", "last_frame")], "frames").mode.id).toBe("first_last_frame");
    expect(run(def, { version: "2.5", resolution: "720p", duration: 5, audio: true, ratio: "9:16" }, [img("a"), img("b")], "references").mode.id).toBe("omni_reference");
  });

  it("priced per second by version and resolution", () => {
    const a = run(def, { version: "2.5", resolution: "720p", duration: 10, audio: true, ratio: "9:16" }, [img("a")], "references");
    expect(a.price.ok && a.price.usdCeiling).toBeCloseTo(REALFACE_SECOND_USD["720p"] * 10);
    const b = run(def, { version: "2.0", resolution: "480p", duration: 10, audio: true, ratio: "9:16" }, [img("a")], "references");
    expect(b.price.ok && b.price.usdCeiling).toBeCloseTo(REALFACE_20_SECOND_USD["480p"] * 10);
  });

  it("2.0 is references only", () => {
    const r = run(def, { version: "2.0", resolution: "720p", duration: 5, audio: true, ratio: "9:16" }, [img("a", "first_frame")], "frames");
    expect(r.issues.some((i) => i.field === "version")).toBe(true);
  });
});

describe("«Seedance وجه واقعي» failures", () => {
  it("a short balance at the partner is said plainly, without naming it", async () => {
    const { explainFailure } = await import("@/lib/jawad/server/jobs");
    const m = explainFailure("realface bytedance/seedance-2.0/reference-to-video 402 Not enough credits", "x")!;
    expect(m).toMatch(/Seedance وجه واقعي/);
    expect(m).not.toMatch(/higgs|البرومبت/i);
    expect(explainFailure("credit balance is too low", "x")).toMatch(/البرومبت/);
  });
});
