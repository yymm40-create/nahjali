import { describe, expect, it } from "vitest";
import { MOODS, MOTION_STYLES, moodInText, styleInText } from "@/lib/editor/motion-styles";
import { TALK_STYLES, talkStyleInText } from "@/lib/editor/talk-styles";
import { framePreviewSvg, previewSvg, talkPreviewSvg } from "@/lib/editor/motion-preview";
import { askFor } from "@/components/jawad/editor/SkillGallery";

describe("the gallery's pictures", () => {
  it("draws one for every motion kind, with no broken numbers", () => {
    for (const s of MOTION_STYLES.filter((x) => !x.talk)) {
      const svg = previewSvg({ style: s.id });
      expect(svg, s.id).toMatch(/^<svg[\s\S]*<\/svg>$/);
      expect(svg, s.id).not.toMatch(/NaN|undefined/);
      expect(svg.length, s.id).toBeGreaterThan(300);
    }
  });
  it("draws one for every feeling and every talking-reel look", () => {
    for (const m of MOODS) {
      const svg = previewSvg({ mood: m.id });
      expect(svg, m.id).toMatch(/^<svg[\s\S]*<\/svg>$/);
      expect(svg, m.id).not.toMatch(/NaN|undefined/);
    }
    for (const s of TALK_STYLES) {
      const svg = talkPreviewSvg(s.id);
      expect(svg, s.id).toMatch(/^<svg[\s\S]*<\/svg>$/);
      expect(svg, s.id).not.toMatch(/NaN|undefined/);
      // the look's own word card and the person's window are both in it
      expect(svg, s.id).toContain("كلمتك تطلع هنا");
    }
    expect(talkPreviewSvg("nothing")).toBe("");
  });
  it("draws the frame of every talking kind: the person in a box, a corner, a half or full", () => {
    const seen = new Map<string, string>();
    for (const s of MOTION_STYLES.filter((x) => x.talk)) {
      const svg = framePreviewSvg(s.talk!);
      expect(svg, s.id).toMatch(/^<svg[\s\S]*<\/svg>$/);
      expect(svg, s.id).not.toMatch(/NaN|undefined/);
      expect(seen.get(svg), `«${s.ar}» and «${seen.get(svg)}» show the same frame`).toBeUndefined();
      seen.set(svg, s.ar);
    }
  });
  it("two kinds never draw the same picture", () => {
    const seen = new Map<string, string>();
    for (const s of MOTION_STYLES.filter((x) => !x.talk)) {
      const svg = previewSvg({ style: s.id });
      expect(seen.get(svg), `«${s.ar}» and «${seen.get(svg)}» look the same`).toBeUndefined();
      seen.set(svg, s.ar);
    }
    const looks = new Map<string, string>();
    for (const s of TALK_STYLES) {
      const svg = talkPreviewSvg(s.id);
      expect(looks.get(svg), `«${s.ar}» and «${looks.get(svg)}» look the same`).toBeUndefined();
      looks.set(svg, s.ar);
    }
  });
});

describe("what a pick writes in the box", () => {
  it("is a sentence the engine reads back as that very skill", () => {
    for (const s of MOTION_STYLES.filter((x) => !x.talk)) {
      const words = askFor({ kind: "skill", id: s.id, ar: s.ar, talk: false });
      expect(styleInText(words)?.id, s.id).toBe(s.id);
      expect(words, s.id).toContain("موشن جرافيكس");
    }
  });
  it("names the talking-video skill and its layout", () => {
    for (const s of MOTION_STYLES.filter((x) => x.talk)) {
      const words = askFor({ kind: "skill", id: s.id, ar: s.ar, talk: true });
      expect(styleInText(words)?.talk, s.id).toBe(s.talk);
      expect(words, s.id).toContain("على كلامي");
    }
  });
  it("names the look and the feeling so the server picks them up", () => {
    for (const s of TALK_STYLES) expect(talkStyleInText(askFor({ kind: "look", id: s.id, ar: s.ar }))?.id, s.id).toBe(s.id);
    for (const m of MOODS) expect(moodInText(askFor({ kind: "mood", id: m.id, ar: m.ar }))?.id, m.id).toBe(m.id);
  });
});
