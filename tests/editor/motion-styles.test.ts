import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, TRANSITIONS, type Ratio } from "@/lib/editor/model";
import { layoutMotion, lintMotion, lintPlaced, motionCommands, motionPlan, readStoryboard, type Beat, type Storyboard } from "@/lib/editor/motion-build";
import { DEFAULT_LOOK, lookOf, MOTION_STYLES, MOTION_STYLES_SKILL, motionStyleOf, styleInText } from "@/lib/editor/motion-styles";
import { isFont } from "@/lib/editor/fonts";

const WORDS = "الصدقة تطفئ غضب الرب وتدفع البلاء وتزيد الرزق والبركة في المال والعمر والذرية بإذن الله تعالى".split(" ");
const pick = (seed: number, n: number) => Array.from({ length: n }, (_, i) => WORDS[(seed * 5 + i * 3) % WORDS.length]).join(" ");
const RATIOS: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];

function board(style: string, i: number): Storyboard {
  const kinds = motionStyleOf(style)!.beats;
  const beats: Beat[] = kinds.map((kind, k) => ({
    kind,
    title: pick(i + k, 1 + ((i + k) % 5)),
    text: pick(i * 3 + k, 3 + ((i + k) % 9)),
    items: Array.from({ length: 2 + ((i + k) % 3) }, (_, j) => pick(i + j + k, 2 + ((i + j) % 5))),
    value: ["70%", "1,250", "3×", "+400"][(i + k) % 4],
    label: pick(i + 2 * k, 2 + (i % 3)),
    by: "الإمام علي (ع)",
    left: { title: pick(k, 1 + (i % 3)), text: pick(i + k + 1, 3 + (i % 6)) },
    right: { title: pick(k + 1, 1 + (i % 3)), text: pick(i + k + 2, 3 + (i % 6)) },
    handle: "@nahjali",
    words: pick(i + k, 2 + ((i + k) % 5)).split(" "),
    hot: (i + k) % 3,
  }));
  return { style, beats };
}

describe("«مهارات الموشن»: every named skill builds a clean piece", () => {
  for (const s of MOTION_STYLES.filter((x) => !x.talk)) {
    for (let i = 0; i < 12; i++) {
      const ratio = RATIOS[i % RATIOS.length];
      it(`«${s.ar}» piece ${i + 1} (${ratio})`, () => {
        const tl = emptyTimeline(ratio);
        const sb = board(s.id, i);
        const { placed, palette } = layoutMotion(sb, tl.width, tl.height);
        expect(lintPlaced(placed, tl.width, tl.height, palette.bg)).toEqual([]);
        const { commands } = motionCommands(sb, tl.width, tl.height);
        const out = applyAll(tl, commands, new Map()).timeline;
        expect(lintMotion(out)).toEqual([]);
      });
    }
  }
});

describe("«مهارات الموشن»: names, looks and the person's wishes", () => {
  it("every skill uses transitions, fonts and palettes the editor has, and its name is unique", () => {
    for (const s of MOTION_STYLES) {
      for (const t of s.look.transitions ?? []) expect(t in TRANSITIONS, `${s.id}: ${t}`).toBe(true);
      for (const f of [s.look.head, s.look.body].filter(Boolean)) expect(isFont(f), `${s.id}: ${f}`).toBe(true);
      expect(MOTION_STYLES_SKILL).toContain(`«${s.ar}»`);
    }
    expect(new Set(MOTION_STYLES.map((s) => s.ar)).size).toBe(MOTION_STYLES.length);
    expect(new Set(MOTION_STYLES.map((s) => s.id)).size).toBe(MOTION_STYLES.length);
  });

  it("finds the skill named in the person's words (with or without the article, diacritics or quotes)", () => {
    expect(styleInText("ابي موشن جرافيكس بمهارة «الريل السريع» عن الصلاة")?.id).toBe("reel");
    expect(styleInText("سوّ لي الرقم الصادم عن الصدقة")?.id).toBe("stat");
    expect(styleInText("ابيه سينمائي")?.id).toBe("cinematic");
    expect(styleInText("ابي اعلان لمنتجي")?.id).toBe("ad");
    expect(styleInText("قص السكتات وحط كابشن")).toBeUndefined();
  });

  it("the person's wishes win over the skill", () => {
    const look = lookOf("reel", { pace: "calm", sfx: "none" });
    expect(look.pace).toBe("calm");
    expect(look.sfx).toBe("none");
    expect(look.entrance).toBe("whip");
    expect(lookOf(undefined, undefined)).toEqual(DEFAULT_LOOK);
    // their palette and fonts over the skill's
    const tl = emptyTimeline("9:16");
    const own = layoutMotion({ style: "luxury", palette: "riso", head: "cairo", beats: [{ kind: "title", title: "عنوان" }] }, tl.width, tl.height);
    expect(own.palette.id).toBe("riso");
    expect(own.placed[0].font).toBe("cairo");
    const skill = layoutMotion({ style: "luxury", beats: [{ kind: "title", title: "عنوان" }] }, tl.width, tl.height);
    expect(skill.palette.id).toBe("majlis");
    expect(skill.placed[0].font).toBe("amiri");
  });

  it("the look reaches the piece: pace, sounds, decorations, background and cuts", () => {
    const tl = emptyTimeline("9:16");
    const beats: Beat[] = [{ kind: "title", title: "عنوان قصير", text: "سطر تحته" }, { kind: "stat", value: "70%", label: "من الناس" }, { kind: "outro", title: "تابعنا", handle: "@nahjali" }];
    const fast = layoutMotion({ style: "reel", beats }, tl.width, tl.height).endMs;
    const calm = layoutMotion({ style: "reel", look: { pace: "calm" }, beats }, tl.width, tl.height).endMs;
    expect(calm).toBeGreaterThan(fast);
    expect(motionPlan({ style: "reel", look: { sfx: "none" }, beats }, tl.width, tl.height).cues).toEqual([]);
    expect(motionPlan({ style: "luxury", beats }, tl.width, tl.height).cues.every((c) => c.kind === "hit" || c.kind === "shimmer")).toBe(true);
    const clean = motionPlan({ style: "clean", beats }, tl.width, tl.height);
    expect(clean.art.some((a) => a.key.startsWith("art-"))).toBe(false);
    expect(new Set(clean.art.map((a) => a.svg)).size).toBe(1);
    // hard cuts: no transition on the backgrounds
    const art = new Map(motionPlan({ style: "kinetic", beats }, tl.width, tl.height).art.map((a) => [a.key, `f-${a.key}`]));
    const cmds = motionCommands({ style: "kinetic", beats }, tl.width, tl.height, 0, art).commands;
    expect(cmds.filter((c) => c.type === "update_clip" && "transition" in c.patch && c.patch.transition)).toEqual([]);
  });

  it("reads the style and the look from حيدرة's JSON, dropping what isn't known", () => {
    const sb = readStoryboard(JSON.stringify({ style: "news", look: { pace: "fast", transitions: ["wipe", "nope"], sfx: "loud", decor: false }, beats: [{ kind: "statement", text: "جملة" }] }))!;
    expect(sb.style).toBe("news");
    expect(sb.look).toEqual({ pace: "fast", transitions: ["wipe"], decor: false });
  });
});
