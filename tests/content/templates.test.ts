import { describe, expect, it } from "vitest";
import { womanCheck } from "@config/content";
import { ARABIC_TEXT_RULES, CAROUSEL_TEMPLATES, designSystem, findTemplate, STRUCTURES, TEMPLATE_GROUPS, THUMB_TEXT, thumbPrompt } from "@config/content-templates";
import { allTemplateExamples, nearestTemplateExamples, TEMPLATE_EXAMPLES_PER, templateExamplesBrief, templateExamplesFor } from "@config/content-template-examples";

// The carousel templates «محمد باقر» offers: 24 complete design systems, three palettes each, readable on their own
// background; and 125 worked carousels for each (3,000), every one a full plan with the prompts exactly as they go to
// the image generator.
const HEX = /^#[0-9A-F]{6}$/;
const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const WOMAN = /\b(woman|women|girl|female|lady|she|her)\b|بنت|امرأة|نساء|فتاة|سيدة/iu;

describe("the 24 templates", () => {
  it("are 24, each with its own id, a known group, and a complete design system", () => {
    expect(CAROUSEL_TEMPLATES).toHaveLength(24);
    expect(new Set(CAROUSEL_TEMPLATES.map((t) => t.id)).size).toBe(24);
    expect(new Set(CAROUSEL_TEMPLATES.map((t) => t.name)).size).toBe(24);
    const structures = new Set(STRUCTURES.map((s) => s.id));
    for (const t of CAROUSEL_TEMPLATES) {
      expect(TEMPLATE_GROUPS, t.id).toContain(t.group);
      expect(t.name.length).toBeGreaterThan(3);
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.bestFor.length).toBeGreaterThan(8);
      expect(t.structures.length).toBeGreaterThanOrEqual(3);
      for (const s of t.structures) expect(structures.has(s), `${t.id} ${s}`).toBe(true);
      expect(t.words, t.id).toBeGreaterThanOrEqual(15);
      expect(t.words, t.id).toBeLessThanOrEqual(40);
      for (const f of [t.look, t.type, t.cover, t.body, t.closing]) expect(f.length, t.id).toBeGreaterThan(40);
      expect(t.type, t.id).toMatch(/Arabic/);
      expect(WOMAN.test(`${t.look} ${t.cover} ${t.body} ${t.closing}`), t.id).toBe(false);
    }
    expect(findTemplate("scrapbook")?.name).toBe("دفتر قصاصات");
    expect(findTemplate("nope")).toBeUndefined();
  });

  it("have three palettes of valid colours, with text readable on the background", () => {
    for (const t of CAROUSEL_TEMPLATES) {
      expect(t.palettes, t.id).toHaveLength(3);
      expect(new Set(t.palettes.map((p) => p.name)).size, t.id).toBe(3);
      for (const p of t.palettes) {
        for (const c of [p.bg, p.text, p.primary, p.accent]) expect(c.toUpperCase(), `${t.id} ${p.name}`).toMatch(HEX);
        expect(contrast(p.bg, p.text), `${t.id} ${p.name} text on background`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("write their design system with the palette, the typography and the safe area into every prompt", () => {
    for (const t of CAROUSEL_TEMPLATES) {
      for (let i = 0; i < 3; i++) {
        const d = designSystem(t, i);
        const p = t.palettes[i];
        expect(d).toContain(t.look);
        expect(d).toContain(t.type);
        for (const c of [p.bg, p.text, p.primary, p.accent]) expect(d).toContain(c);
        expect(d).toContain("safe area");
        expect(d.length).toBeLessThan(1800);
      }
    }
  });

  it("have a thumbnail prompt with the same sample headline, the Arabic rules, and no people", () => {
    for (const t of CAROUSEL_TEMPLATES) {
      const p = thumbPrompt(t);
      expect(p).toContain(`"${THUMB_TEXT}"`);
      expect(p).toContain(ARABIC_TEXT_RULES);
      expect(p).toContain(t.id);
      expect(p.length).toBeLessThan(4000);
      expect(womanCheck(p)).toBe("none");
    }
    expect(ARABIC_TEXT_RULES).toMatch(/right-to-left/);
    expect(ARABIC_TEXT_RULES).toMatch(/joined/);
  });
});

describe("the worked carousels", () => {
  it("are 125 for each of the 24 templates, 3,000 in all", () => {
    expect(TEMPLATE_EXAMPLES_PER).toBe(125);
    expect(allTemplateExamples()).toHaveLength(24 * TEMPLATE_EXAMPLES_PER);
  });

  for (const t of CAROUSEL_TEMPLATES) {
    describe(`${t.id}: ${TEMPLATE_EXAMPLES_PER} worked carousels`, () => {
      const list = templateExamplesFor(t.id);

      it("are distinct ones", () => {
        expect(list).toHaveLength(TEMPLATE_EXAMPLES_PER);
        expect(new Set(list.map((e) => `${e.ask}|${e.slides.map((s) => s.title + s.line).join("|")}|${e.palette}`)).size).toBe(TEMPLATE_EXAMPLES_PER);
        expect(new Set(list.map((e) => e.ask)).size).toBeGreaterThan(TEMPLATE_EXAMPLES_PER / 3);
      });

      it.each(list.map((e) => [e.id, e] as const))("%s is a complete plan with its prompts", (_id, e) => {
        expect(e.template).toBe(t.id);
        expect(e.ask).toContain(t.name);
        expect(t.structures).toContain(e.structure);
        // the slides: a cover, bodies in order, a closing; short copy
        expect(e.slides.length).toBeGreaterThanOrEqual(5);
        expect(e.slides.length).toBeLessThanOrEqual(10);
        e.slides.forEach((s, i) => {
          expect(s.n).toBe(i + 1);
          expect(s.role).toBe(i === 0 ? "cover" : i === e.slides.length - 1 ? "closing" : "body");
          expect(`${s.title} ${s.line}`.split(/\s+/).length).toBeLessThanOrEqual(t.words);
        });
        // the prompts: the whole design system with this palette, the slide's text quoted exactly, the rules, under the limit
        const p = t.palettes[e.palette];
        const cover = e.slides[0];
        for (const prompt of [e.coverPrompt, e.bodyPrompt]) {
          expect(prompt.length).toBeLessThanOrEqual(4000);
          expect(prompt).toContain(t.look);
          for (const c of [p.bg, p.text, p.primary, p.accent]) expect(prompt).toContain(c);
          expect(prompt).toContain(ARABIC_TEXT_RULES);
          expect(prompt).toContain("right-to-left");
        }
        expect(e.coverPrompt).toContain(`"${cover.title}"`);
        expect(e.coverPrompt).toContain(`"${cover.line}"`);
        expect(e.coverPrompt).toContain(t.cover);
        expect(e.bodyPrompt).toContain(t.body);
        // the site's rule: no woman anywhere in an example
        expect(WOMAN.test(e.ask)).toBe(false);
        expect(womanCheck(e.coverPrompt)).toBe("none");
        expect(womanCheck(e.bodyPrompt)).toBe("none");
      });

      it("come back first for their own requests, within their template", () => {
        for (const e of list.slice(0, 20)) {
          const near = nearestTemplateExamples(e.ask, t.id, 2);
          expect(near.map((x) => x.ask)).toContain(e.ask);
          expect(near.every((x) => x.template === t.id)).toBe(true);
        }
        const brief = templateExamplesBrief(list.slice(0, 2));
        expect(brief).toContain(t.name);
        expect(brief).toContain(list[0].coverPrompt);
      });
    });
  }
});
