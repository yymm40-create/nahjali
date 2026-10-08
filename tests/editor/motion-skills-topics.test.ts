import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, type AssetInfo, type Ratio } from "@/lib/editor/model";
import { layoutMotion, lintMotion, lintPlaced, motionCommands, motionPlan } from "@/lib/editor/motion-build";
import { lookOf, MOTION_STYLES } from "@/lib/editor/motion-styles";
import { storyboardFor, TOPICS } from "./motion-topics";

const RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];
const SKILLS = MOTION_STYLES.filter((s) => !s.talk);

describe("«مهارات الموشن» · ten topics a skill: every piece comes out clean and in its own look", () => {
  expect(TOPICS.length).toBe(10);
  for (const s of SKILLS) {
    for (const [k, t] of TOPICS.entries()) {
      const ratio = RATIOS[k % RATIOS.length];
      it(`«${s.ar}» · ${t.topic} (${ratio})`, () => {
        const tl = emptyTimeline(ratio);
        const sb = storyboardFor(s.id, s.beats, t);
        const plan = motionPlan(sb, tl.width, tl.height);
        // every beat placed, readable, nothing overlapping, inside the safe area
        expect(new Set(plan.placed.map((p) => p.beat)).size).toBeGreaterThanOrEqual(s.beats.length);
        expect(lintPlaced(plan.placed, tl.width, tl.height, plan.palette.bg)).toEqual([]);
        // the skill's own look reached the piece
        const look = lookOf(s.id, undefined);
        expect(plan.look.theme).toBe(look.theme);
        for (const p of plan.placed) {
          expect(p.align).toBe(look.align);
          if (p.role === "head" || p.role === "value") expect(p.font).toBe(look.head ?? "cairo");
          // a right-aligned block sits flush with the right margin, never past it
          if (look.align === "right" && p.x !== 0.73 && p.x !== 0.27) expect(p.x + p.w / 2).toBeLessThanOrEqual(0.92 + 0.005);
        }
        // the art: a background per beat, a decoration when the skill draws them, all valid
        expect(plan.art.filter((a) => a.key.startsWith("bg-")).length).toBe(plan.beats.length);
        expect(plan.art.filter((a) => a.key.startsWith("art-")).length).toBe(look.decor ? plan.beats.length : 0);
        for (const a of plan.art) {
          expect(a.svg.startsWith("<svg") && a.svg.endsWith("</svg>")).toBe(true);
          expect(a.svg).not.toMatch(/NaN|undefined/);
        }
        // the commands run on a real timeline, and the timeline's texts pass the same check
        const infos = new Map<string, AssetInfo>();
        const ids = new Map<string, string>();
        for (const a of plan.art) {
          ids.set(a.key, `f-${a.key}`);
          infos.set(`f-${a.key}`, { id: `f-${a.key}`, kind: "image", durationMs: null, width: a.w, height: a.h, hasAudio: false });
        }
        const { commands } = motionCommands(sb, tl.width, tl.height, 0, ids);
        const out = applyAll(tl, commands, infos).timeline;
        expect(lintMotion(out)).toEqual([]);
      });
    }
  }
});

describe("«مهارات الموشن» · no two skills share one template", () => {
  it("each skill has its own fonts-and-alignment-and-art-language, and its own backgrounds and decorations", () => {
    const tl = emptyTimeline("9:16");
    const t = TOPICS[0];
    const seen = new Map<string, string>();
    const bgs = new Map<string, string>();
    const decos = new Map<string, string>();
    for (const s of SKILLS) {
      const look = lookOf(s.id, undefined);
      // the words always start with a title or a hook: the same first beat for everyone, so the art is comparable
      const plan = motionPlan(storyboardFor(s.id, ["title", "stat", "outro"], t), tl.width, tl.height);
      const key = `${look.head}|${look.body}|${look.align}|${look.theme}`;
      expect(seen.get(key), `«${s.ar}» and «${seen.get(key)}» share fonts, alignment and art language`).toBeUndefined();
      seen.set(key, s.ar);
      const bg = plan.art.find((a) => a.key === "bg-1")!.svg;
      expect(bgs.get(bg), `«${s.ar}» and «${bgs.get(bg)}» draw the same background`).toBeUndefined();
      bgs.set(bg, s.ar);
      const deco = plan.art.find((a) => a.key === "art-1")?.svg ?? "";
      if (deco) {
        expect(decos.get(deco), `«${s.ar}» and «${decos.get(deco)}» decorate the number the same way`).toBeUndefined();
        decos.set(deco, s.ar);
      }
    }
    // the fonts: at least eight different headline fonts across the skills
    expect(new Set(SKILLS.map((s) => lookOf(s.id, undefined).head)).size).toBeGreaterThanOrEqual(8);
    // the art languages: every skill its own
    expect(new Set(SKILLS.map((s) => lookOf(s.id, undefined).theme)).size).toBe(SKILLS.length);
  });

  it("the same topic in two skills is laid out differently (alignment, fonts, pace), not only recoloured", () => {
    const tl = emptyTimeline("9:16");
    const a = layoutMotion(storyboardFor("news", ["title", "points"], TOPICS[2]), tl.width, tl.height);
    const b = layoutMotion(storyboardFor("explainer", ["title", "points"], TOPICS[2]), tl.width, tl.height);
    expect(a.placed[0].align).toBe("right");
    expect(b.placed[0].align).toBe("center");
    expect(a.placed[0].font).not.toBe(b.placed[0].font);
    expect(a.placed[0].x).not.toBe(b.placed[0].x);
    const fast = layoutMotion(storyboardFor("reel", ["title", "points"], TOPICS[2]), tl.width, tl.height);
    expect(fast.endMs).toBeLessThan(b.endMs);
  });
});
