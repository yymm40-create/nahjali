import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAB_GROUPS, choicesRefs, choicesText, chosenOptions, readChoices } from "@config/editor/lab-options";
import { DEMO_KINDS } from "@/components/jawad/editor/lab-demos";
import { HF_REFS } from "@/lib/editor/higgsfield-skills-text";
import { readPlan } from "@/lib/editor/scene/contract";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const read = (p: string) => readFileSync(p, "utf8");

describe("مختبر الموشن · كتالوج الخيارات", () => {
  it("has the nine groups, every option complete and unique, every sample drawable", () => {
    expect(LAB_GROUPS.map((g) => g.id)).toEqual(["look", "structure", "connect", "feel", "pace", "camera", "type", "finish", "ending"]);
    expect(LAB_GROUPS.reduce((n, g) => n + g.options.length, 0)).toBeGreaterThanOrEqual(60);
    for (const g of LAB_GROUPS) {
      expect(new Set(g.options.map((o) => o.id)).size).toBe(g.options.length);
      for (const o of g.options) {
        for (const k of ["ar", "en", "tip", "prompt", "from", "demo"] as const) expect(o[k].length, `${g.id}/${o.id}.${k}`).toBeGreaterThan(1);
        expect(o.prompt).toMatch(/^(LOOK|STRUCTURE|CONNECT|FEEL|PACE|CAMERA|TYPE|FINISH|ENDING):/);
        expect(DEMO_KINDS, `${o.id} has no live sample`).toContain(o.demo);
      }
    }
    for (const o of LAB_GROUPS[0].options) expect(o.swatch, `${o.id} needs a swatch`).toBeTruthy();
  });

  it("points only at files that exist in the owner's Higgsfield catalogue", () => {
    const ids = new Set(HF_REFS.map((r) => r.id));
    for (const g of LAB_GROUPS) for (const o of g.options) for (const r of o.refs ?? []) expect(ids.has(r), `${o.id} → ${r}`).toBe(true);
  });

  it("reads picks safely: unknown ids dropped, single groups keep one, connect keeps up to three", () => {
    const c = readChoices({ look: ["swiss-editorial", "nope", "luxury-serif"], connect: ["needle-zoom", "fly-through", "needle-zoom", "flood", "pour"], feel: "house", bogus: ["x"] });
    expect(c).toEqual({ look: ["swiss-editorial"], connect: ["needle-zoom", "fly-through", "flood"], feel: ["house"] });
    expect(readChoices(null)).toEqual({});
    expect(readChoices({ look: ["nope"] })).toEqual({});
  });

  it("turns picks into binding lines for the plan, with the look's palette and what is left to حيدرا ماكس", () => {
    expect(choicesText({})).toBe("");
    const c = readChoices({ look: ["gulf-gold"], connect: ["object-carry"], ending: ["loop"] });
    const t = choicesText(c);
    expect(t).toContain("BINDING");
    expect(t).toContain("LOOK: Gulf gold");
    expect(t).toContain("CONNECT: object carry");
    expect(t).toContain("ENDING: a seamless loop");
    expect(t).toContain("accent #d4af37");
    expect(t).toContain("Left to you:");
    expect(t).toContain("بنية الفيلم");
    expect(chosenOptions(c).map((x) => x.option.id)).toEqual(["gulf-gold", "object-carry", "loop"]);
    expect(choicesRefs(c)).toEqual(["higgsfield-motion/references/parts/11_part1b_type_colour.md#3", "higgsfield-motion-saas/references/transitions.md"]);
  });

  it("rides with the plan (readPlan keeps valid picks, drops the rest)", () => {
    const p = readPlan({ title: "x", choices: { look: ["cinematic-noir"], connect: ["glitch"] } }, 15);
    expect(p.choices).toEqual({ look: ["cinematic-noir"] });
    expect(readPlan({}, 15).choices).toEqual({});
  });

  it("is wired into the director's plan and into the lab window", () => {
    const director = read("src/lib/editor/scene/director.ts");
    expect(director).toContain("choicesText(choices)");
    expect(director).toContain("choicesRefs(choices)");
    expect(director).toContain("const plan = { ...readPlan(r.data, seconds, assets.map((a) => a.id), foot?.seconds), choices");
    const lab = read("src/components/jawad/editor/MotionLab.tsx");
    expect(lab).toContain("LAB_GROUPS");
    expect(lab).toContain("choices");
    expect(lab).toContain("motion-lab.css");
    // the old see-through, tiny-type window is gone
    expect(lab).not.toContain("jw-glass");
    expect(lab).not.toMatch(/text-\[1[01]px\]/);
    const css = read("src/components/jawad/editor/motion-lab.css");
    expect(css).toContain("backdrop-filter: none");
    expect(css).toMatch(/\.mlab \{[^}]*font-size: 15px/);
  });

  it("is in what Claude knows about the site", () => {
    expect(JAWAD_KNOWLEDGE).toContain("خيارات المختبر");
  });
});
