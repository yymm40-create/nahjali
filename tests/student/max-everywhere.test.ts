import { describe, expect, it } from "vitest";
import { BROCHURE_FOLDS, DESIGNED_KINDS, MAX_KINDS, OUTPUT_KINDS, foldOf, maxAvailable, maxOn } from "@config/jawad/student";
import { brochureSource, BROCHURE_SIDES, docSource, paginate, quizSource } from "@/lib/jawad/student/max-sources";
import { brochureHtml } from "@/lib/jawad/student/render/html";
import { emptyImage, type BrochurePlan, type Doc, type Question } from "@/lib/jawad/student/model";
import { splitOffer, startBody, makeRules } from "@/lib/jawad/student/offer";
import { autoSettings } from "@/lib/jawad/student/defaults";
import { settingsLine } from "@/lib/jawad/student/summary";
import { DECK_PAPER, DECK_SIZE, deckDocument } from "@/lib/slides/format";
import { defaultDesign } from "@config/jawad/student";

const para = (n: number, t = "كلمة"): string => Array.from({ length: n }, () => t).join(" ");
const doc = (chapters: number, wordsEach: number): Doc => ({
  title: "كتاب",
  subtitle: "",
  chapters: Array.from({ length: chapters }, (_, i) => ({ title: `فصل ${i + 1}`, blocks: [{ t: "p" as const, text: para(wordsEach), title: "", items: [], rows: [], sources: [], segments: [] }] })),
});

describe("حيدرا ماكس: which outputs have it", () => {
  it("is every output with pages, and never the recording or the chat", () => {
    for (const k of ["summary", "explain", "preread", "transcript", "book", "slides", "quiz", "mindmap", "sermon", "brochure"]) expect(maxAvailable(k)).toBe(true);
    expect(maxAvailable("audio")).toBe(false);
    expect(maxAvailable("chat")).toBe(false);
    expect(MAX_KINDS.every((k) => OUTPUT_KINDS.some((o) => o.kind === k))).toBe(true);
  });
  it("is on by the new setting or the older slides one", () => {
    expect(maxOn({ maker: "max" })).toBe(true);
    expect(maxOn({ render: "design" })).toBe(true);
    expect(maxOn({ render: "image" })).toBe(false);
    expect(maxOn(null)).toBe(false);
  });
});

describe("pages of a written output", () => {
  it("honours the student's page count and keeps every line", () => {
    const d = doc(3, 600);
    const s = docSource("summary", { pages: 5 }, d);
    expect(s.aspect).toBe("a4");
    expect(s.briefs.length).toBe(5);
    expect(s.sigs.length).toBe(s.briefs.length);
  });
  it("paginates by words and never leaves a page empty", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ lines: [`س${i}`], words: 60, head: false }));
    const pages = paginate(items, 0, 230);
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.every((p) => p.length > 0)).toBe(true);
    expect(pages.flat().length).toBe(20);
  });
});

describe("a quiz as sheets", () => {
  const qs: Question[] = Array.from({ length: 12 }, (_, i) => ({ type: "mcq", question: `سؤال ${i + 1}`, options: ["أ", "ب"], answer: "أ", explanation: "لأن", segments: [] }));
  it("makes question sheets and an answer key whose pages are told apart by id", () => {
    const s = quizSource("اختبار", qs);
    const ids = s.briefs.map((b) => b.id ?? "");
    expect(ids.filter((i) => i.startsWith("q")).length).toBe(3);
    expect(ids.filter((i) => i.startsWith("ans")).length).toBe(2);
  });
});

describe("a brochure", () => {
  const plan = (fold: "tri" | "bi"): BrochurePlan => ({
    title: "النظافة",
    subtitle: "عادة يومية",
    fold,
    panels: Array.from({ length: fold === "bi" ? 4 : 6 }, (_, i) => ({ role: i === 0 ? "cover" : i === (fold === "bi" ? 3 : 5) ? "back" : fold === "tri" && i === 4 ? "flap" : "content", title: `واجهة ${i + 1}`, text: [`سطر ${i + 1}`, "هل تعلم؟ معلومة"], visual: "", segments: [], image: emptyImage() })),
  });
  it("has the Arabic panel order on its two sides", () => {
    expect(BROCHURE_SIDES.tri).toEqual({ outside: [1, 6, 5], inside: [4, 3, 2] });
    expect(BROCHURE_SIDES.bi).toEqual({ outside: [1, 4], inside: [3, 2] });
    expect(BROCHURE_FOLDS.map((f) => f.panels)).toEqual([6, 4]);
    expect(foldOf({ fold: "bi" })).toBe("bi");
    expect(foldOf({})).toBe("tri");
  });
  it("is two landscape A4 sides for the designer, listing the columns from the right edge", () => {
    const s = brochureSource(plan("tri"));
    expect(s.aspect).toBe("a4l");
    expect(s.briefs.map((b) => b.id)).toEqual(["out", "in"]);
    const out = s.briefs[0].text.join("\n");
    // outside, left → right: 1 · 6 · 5, so from the right edge: 5 · 6 · 1
    expect(out.indexOf("panel 5,")).toBeLessThan(out.indexOf("panel 6,"));
    expect(out.indexOf("panel 6,")).toBeLessThan(out.indexOf("panel 1,"));
  });
  it("prints the standard way as two A4-landscape pages with a column per panel", () => {
    const html = brochureHtml(plan("tri"), defaultDesign("editorial"), { fontFaces: "" });
    expect(html).toContain("size:297mm 210mm");
    expect((html.match(/class="side /g) ?? []).length).toBe(2);
    expect((html.match(/class="panel /g) ?? []).length).toBe(6);
    expect(brochureHtml(plan("bi"), defaultDesign("editorial"), { fontFaces: "" }).match(/class="panel /g)?.length).toBe(4);
  });
  it("is an output with a design, defaults and a one-line summary", () => {
    expect(OUTPUT_KINDS.some((o) => o.kind === "brochure")).toBe(true);
    expect(DESIGNED_KINDS).toContain("brochure");
    expect(autoSettings("brochure", "").fold).toBe("tri");
    expect(settingsLine("brochure", { fold: "bi" })).toContain("ثنائية الطي");
  });
});

describe("paper decks", () => {
  it("are A4 at 192 dpi and print on real paper", () => {
    expect(DECK_SIZE.a4).toEqual({ w: 1588, h: 2246 });
    expect(DECK_SIZE.a4l).toEqual({ w: 2246, h: 1588 });
    expect(DECK_PAPER.a4).toEqual({ w: 210, h: 297 });
    expect(deckDocument({ v: 1, title: "x", aspect: "a4l", fonts: [], slides: [] }, { fontCss: "", resolve: () => undefined, print: true })).toContain("@page{size:297mm 210mm");
  });
});

describe("صادق offers it", () => {
  it("reads maker:max on a marker and only for outputs that can have it", () => {
    const r = splitOffer('تمام\n[[MAKE]]{"outputs":[{"kind":"brochure","note":"ثلاثية","maker":"max"},{"kind":"audio","note":"","maker":"max"},{"kind":"slides","note":""}]}');
    expect(r.offer?.items).toEqual([
      { kind: "brochure", note: "ثلاثية", maker: "max" },
      { kind: "audio", note: "" },
      { kind: "slides", note: "" },
    ]);
  });
  it("starts a Max output with maker:max (slides also render:design)", () => {
    const body = startBody({ items: [{ kind: "summary", note: "", maker: "max" }, { kind: "slides", note: "", maker: "max" }, { kind: "quiz", note: "" }] });
    expect(body.outputs).toEqual([
      { kind: "summary", settings: { maker: "max" } },
      { kind: "slides", settings: { maker: "max", render: "design" } },
      { kind: "quiz", settings: {} },
    ]);
  });
  it("is taught the option and the brochure", () => {
    const r = makeRules([]);
    expect(r).toContain('"maker":"max"');
    expect(r).toContain("brochure");
    expect(r).toContain("حيدرا ماكس");
  });
});
