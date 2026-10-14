import { describe, expect, it } from "vitest";
import { SCENE_CSP, SCENE_RUNTIME_JS, sceneDoc } from "@/lib/editor/scene/runtime";
import { SCENE_KIT_JS } from "@/lib/editor/scene/kit";

describe("the sandbox the scene runs in", () => {
  it("draws on CPU-backed surfaces and resets the canvas fully before every frame (no earlier frame shows through)", () => {
    expect(SCENE_RUNTIME_JS).toContain('canvas.getContext("2d", { willReadFrequently: true })');
    expect(SCENE_RUNTIME_JS).toContain('acc.getContext("2d", { willReadFrequently: true })');
    expect(SCENE_RUNTIME_JS).toMatch(/ctx\.reset\(\)/);
    expect(SCENE_KIT_JS).not.toMatch(/getContext\("2d"\)/);
  });
  it("keeps native canvas wrappers scoped to their own canvas type (Safari illegal-invocation regression)", () => {
    expect(SCENE_RUNTIME_JS).toContain("let P = protos[i]");
    expect(SCENE_RUNTIME_JS).toContain("let cp = P.createPattern");
    expect(SCENE_RUNTIME_JS).not.toContain("var cp = P.createPattern");
  });
  it("lets nothing out: no network but the CDN, no forms, and the kit and runtime inline", () => {
    expect(SCENE_CSP).toContain("default-src 'none'");
    expect(SCENE_CSP).toContain("form-action 'none'");
    const doc = sceneDoc();
    expect(doc).toContain(SCENE_CSP);
    expect(doc).toContain('<canvas id="c">');
  });
});
