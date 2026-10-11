import { describe, expect, it } from "vitest";
import { MOODS, MOTION_STYLES, motionStyleOf } from "@/lib/editor/motion-styles";
import { TALK_STYLES } from "@/lib/editor/talk-styles";
import { framePreviewSvg, previewSvg, talkPreviewSvg } from "@/lib/editor/motion-preview";
import { MOTION_TEN, askForTen, tenInText } from "@/lib/editor/motion-ten";

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

// «خلنهم ١٠ أساليب فقط لكنهم مختلفين تماما» — the picker of «أساليب الموشن»
describe("the ten motion styles", () => {
  it("are exactly ten, numbered 1–10, each on a real engine look, with unique names", () => {
    expect(MOTION_TEN).toHaveLength(10);
    expect(MOTION_TEN.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(MOTION_TEN.map((s) => s.ar)).size).toBe(10);
    for (const s of MOTION_TEN) {
      const base = motionStyleOf(s.base);
      expect(base, s.id).toBeTruthy();
      // the talking-video style rides on a talking layout, the others on full pieces
      expect(Boolean(base?.talk), s.id).toBe(s.talk);
    }
  });
  it("are completely different: no two share a base look, and the energies span 1 to 5", () => {
    expect(new Set(MOTION_TEN.map((s) => s.base)).size).toBe(10);
    const energies = new Set(MOTION_TEN.map((s) => s.energy));
    for (const e of [1, 2, 3, 4, 5]) expect(energies.has(e as 1)).toBe(true);
  });
  it("include the four recipes of the Motion Video Director skill", () => {
    const ids = MOTION_TEN.map((s) => s.id);
    for (const id of ["premium-talk", "story-doc", "saas-launch", "brand-kinetic"]) expect(ids).toContain(id);
  });
  it("draw a picture each, and what a pick sends is read back as that very style", () => {
    for (const s of MOTION_TEN) {
      const svg = s.talk ? framePreviewSvg(motionStyleOf(s.base)!.talk!) : previewSvg({ style: s.base });
      expect(svg, s.id).toMatch(/^<svg[\s\S]*<\/svg>$/);
      const words = askForTen(s, "تطبيق يرتّب المواعيد");
      expect(tenInText(words)?.id, s.id).toBe(s.id);
      expect(words, s.id).toContain(s.talk ? "فيديو كلامي" : "موشن جرافيكس");
    }
  });
});
