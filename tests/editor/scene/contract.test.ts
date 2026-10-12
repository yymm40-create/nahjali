import { describe, expect, it } from "vitest";
import { checkScene, LAB_FONTS, readCues, readPlan, readReview } from "@/lib/editor/scene/contract";
import { CUE_SFX, MOTION_LAB_SKILL, PASS, RUBRIC, SCENE_CONTRACT } from "@/lib/editor/scene/skill";
import { EXEMPLARS } from "@/lib/editor/scene/exemplars";
import { SFX_LIBRARY } from "@config/jawad/sfx-library";
import { readFileSync } from "node:fs";

describe("what the lab accepts from حيدرة", () => {
  it("passes the reference scenes", () => {
    for (const e of EXEMPLARS) expect(checkScene(e.code), e.id).toMatchObject({ ok: true, problems: [] });
  });
  it("refuses a program that reaches outside the scene, or depends on a clock", () => {
    const base = "scene({ duration: 5, draw: function (K, t, ctx) { %s } });";
    for (const bad of ["fetch('https://x')", "new XMLHttpRequest()", "import('x')", "eval('1')", "new Function('a')", "localStorage.x = 1", "parent.postMessage(1,'*')", "document.cookie", "Math.random()", "Date.now()", "performance.now()", "setTimeout(f, 1)", "requestAnimationFrame(f)", "navigator.userAgent", "new Worker('x')"]) {
      const r = checkScene(base.replace("%s", bad));
      expect(r.ok, bad).toBe(false);
      expect(r.problems.length, bad).toBeGreaterThan(0);
    }
    expect(checkScene("").ok).toBe(false);
    expect(checkScene("var a = 1;").problems).toContain("the program never calls scene({ … })");
    expect(checkScene("scene({ duration: 2 })").problems).toContain("the scene has no draw(K, t, ctx)");
    expect(checkScene("scene({ draw(K,t,ctx){} }) </script>").ok).toBe(false);
  });
  it("strips a code fence around the program", () => {
    expect(checkScene("```js\nscene({ duration: 3, draw: function (K, t, ctx) {} });\n```").code.startsWith("scene(")).toBe(true);
  });
  it("keeps only real sounds, inside the piece, spaced, sorted", () => {
    const cues = readCues(
      [
        { t: 2, sfx: CUE_SFX[0] },
        { t: 0.5, sfx: CUE_SFX[1], vol: 3 },
        { t: 0.55, sfx: CUE_SFX[2] },
        { t: 9, sfx: CUE_SFX[0] },
        { t: 1, sfx: "made-up" },
        { t: "x", sfx: CUE_SFX[0] },
      ],
      6,
    );
    expect(cues.map((c) => c.t)).toEqual([0.5, 2]);
    expect(cues[0].vol).toBe(1);
    expect(cues[1].vol).toBe(0.8);
  });
  it("bounds the plan: length, tempo, colours, fonts, shots, assets", () => {
    const p = readPlan({ seconds: 500, bpm: 999, palette: { bg: "red", accent: "#FFAA00" }, fonts: { head: "nope", body: "cairo" }, shots: [{ from: 0, to: 3, what: "x" }, { from: 4, to: 2 }], assets: [{ id: "a1", use: "logo" }, { id: "zz", use: "?" }] }, 15, ["a1"]);
    expect(p.seconds).toBe(60);
    expect(p.bpm).toBe(180);
    expect(p.palette.bg).toBe("#0b0b10");
    expect(p.palette.accent).toBe("#ffaa00");
    expect(p.fonts.head).toBe("alexandria");
    expect(p.fonts.body).toBe("cairo");
    expect(p.shots).toHaveLength(1);
    expect(p.assets).toEqual([{ id: "a1", use: "logo" }]);
    expect(LAB_FONTS).toContain("alexandria");
    expect(LAB_FONTS).toContain("cairo");
  });
  it("passes a review only when every score reaches the bar", () => {
    const all = (n: number) => Object.fromEntries(RUBRIC.map((r) => [r.id, n]));
    expect(readReview({ scores: all(PASS), verdict: "تمام" })).toMatchObject({ pass: true, low: PASS });
    const one = { ...all(9), wow: PASS - 1 };
    expect(readReview({ scores: one })).toMatchObject({ pass: false, low: PASS - 1 });
    expect(readReview({}).pass).toBe(false);
    expect(readReview({ scores: all(99) }).low).toBe(10);
  });
});

describe("حيدرة's training for motion in code", () => {
  it("scores a piece on twelve criteria, the million-dollar test among them", () => {
    expect(RUBRIC.map((r) => r.id)).toEqual(["hook", "concept", "hero", "motion", "camera", "light", "type", "color", "variety", "sound", "wow", "clean"]);
    expect(PASS).toBe(8);
  });
  it("cues only sounds the editor's library really has", () => {
    expect(CUE_SFX.length).toBeGreaterThan(40);
    for (const id of CUE_SFX) expect(SFX_LIBRARY.some((s) => s.id === id), id).toBe(true);
    expect(SCENE_CONTRACT).toContain(CUE_SFX[0]);
  });
  it("carries the bar, the blacklist, Arabic rules, viral formats and the kit", () => {
    for (const s of ["millions", "BLACKLIST", "kashida", "RIGHT → LEFT", "DUST TO WORD", "ONE SHAPE, NEVER CUT", "INFINITE ZOOM", "K.swarm", "K.springTo", "K.inSpace", "safe zone", "silk", "Overshoot budget"]) expect(MOTION_LAB_SKILL, s).toContain(s);
  });
  it("keeps its research with the sources next to it", () => {
    const r = readFileSync("config/editor/skills/motion-lab/RESEARCH.md", "utf8");
    for (const s of ["Higgsfield", "@stephanlivera", "@twoclipping", "remotion-dev/skills", "arabic-motion-graphics-skill", "## Sources", "harsh motion director"]) expect(r, s).toContain(s);
  });
});
