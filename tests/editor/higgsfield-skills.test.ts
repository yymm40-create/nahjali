import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HF_REFS, HF_SKILLS } from "@/lib/editor/higgsfield-skills-text";
import { ALWAYS_AT_PLAN, HF_LAB_TEXT, knownRefs, OPEN_BUDGET, openRefs } from "@/lib/editor/scene/higgsfield";
import { readPlan } from "@/lib/editor/scene/contract";
import { MOTION_SKILL } from "@/lib/editor/motion";

const ROOT = "config/editor/skills";
const read = (p: string) => readFileSync(p, "utf8");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f)) : [path.join(dir, f)]));

describe("the owner's two Higgsfield skills, installed verbatim", () => {
  it("both skills are in the repo with every file, and each SKILL.md is carried word for word", () => {
    for (const name of ["higgsfield-motion", "higgsfield-motion-saas"]) {
      const skill = HF_SKILLS.find((s) => s.name === name)!;
      expect(skill.text).toBe(read(`${ROOT}/${name}/SKILL.md`));
      expect(skill.text.startsWith(`---\nname: ${name}\n`)).toBe(true);
    }
    expect(walk(`${ROOT}/higgsfield-motion`).length + walk(`${ROOT}/higgsfield-motion-saas`).length).toBe(91);
  });

  it("every text file of both skills is a reference, and a split file joins back to the file byte for byte", () => {
    for (const name of ["higgsfield-motion", "higgsfield-motion-saas"]) {
      for (const full of walk(`${ROOT}/${name}`)) {
        const file = path.relative(`${ROOT}/${name}`, full);
        if (file === "SKILL.md" || !/\.(md|js|mjs|jsx|html|py|sh|swift)$/.test(file) || file === "scripts/hf-tokens.js") continue;
        const parts = HF_REFS.filter((r) => r.skill === name && r.file === file);
        expect(parts.length, file).toBeGreaterThan(0);
        expect(parts.map((p) => p.text).join(""), file).toBe(read(full));
      }
    }
  });

  it("the skills' own code runs in the scene page: the files served are the skill's, and they work as a page loads them", () => {
    for (const f of ["hf-tokens.js", "hf-motion.js"]) expect(read(`public/editor/skills/${f}`)).toBe(read(`${ROOT}/higgsfield-motion/scripts/${f}`));
    const g = globalThis as unknown as { HFT?: { theme: (s: string, o: object) => { tokens: Record<string, unknown> } }; HF?: { use: (s: string) => unknown; p: (...a: number[]) => number } };
    new Function(read("public/editor/skills/hf-tokens.js"))();
    new Function(read("public/editor/skills/hf-motion.js"))();
    expect(typeof g.HFT?.theme).toBe("function");
    expect(Object.keys(g.HFT!.theme("swiss-editorial", { scheme: "light", format: "9x16" }).tokens).length).toBeGreaterThan(20);
    g.HF!.use("swiss-editorial");
    expect(g.HF!.p(0.5, 0, 1)).toBeGreaterThan(0);
    const runtime = read("src/lib/editor/scene/runtime.ts");
    expect(runtime).toContain("new Function(m.libs[li])()");
    expect(runtime).toContain("K.HFT = window.HFT");
    expect(read("src/components/jawad/editor/scene-host.ts")).toContain('"/editor/skills/hf-tokens.js", "/editor/skills/hf-motion.js"');
  });

  it("the motion lab is given both skills and opens their files on demand", () => {
    for (const s of HF_SKILLS) expect(HF_LAB_TEXT).toContain(`<skill name="${s.name}">\n${s.text}\n</skill>`);
    for (const r of HF_REFS) expect(HF_LAB_TEXT).toContain(r.id);
    const director = read("src/lib/editor/scene/director.ts");
    expect(director).toContain("${HF_LAB_TEXT}");
    expect(director).toContain("openRefs([...ALWAYS_AT_PLAN, ...choicesRefs(choices)])");
    expect(director.match(/openRefs\(knownRefs\(plan\.skillRefs\)\)/g)?.length).toBe(2);
    // the taste files both skills say to read first are always opened at the plan
    const atPlan = openRefs(ALWAYS_AT_PLAN);
    expect(atPlan.opened).toEqual(ALWAYS_AT_PLAN);
    // the plan keeps the ids it asked for; unknown ones are never opened; the budget holds
    const plan = readPlan({ skillRefs: ["higgsfield-motion-saas/references/transitions.md", "../../etc/passwd", "higgsfield-motion/nope.md"] }, 15);
    expect(plan.skillRefs).toEqual(["higgsfield-motion-saas/references/transitions.md", "higgsfield-motion/nope.md"]);
    expect(knownRefs(plan.skillRefs)).toEqual(["higgsfield-motion-saas/references/transitions.md"]);
    const all = openRefs(HF_REFS.map((r) => r.id));
    expect(all.text.length).toBeLessThan(OPEN_BUDGET + 40_000);
    expect(all.skipped.length).toBeGreaterThan(0);
  });

  it("حيدرة carries both skills in his motion method too", () => {
    for (const s of HF_SKILLS) expect(MOTION_SKILL).toContain(s.text);
  });
});
