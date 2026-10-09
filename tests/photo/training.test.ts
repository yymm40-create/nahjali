import { describe, expect, it } from "vitest";
import { applyOps, docFromPicture, readOps, type Op, type PhotoDoc } from "@/lib/photo/doc";
import { nearestPhotoExamples, PHOTO_EXAMPLES_COUNT, PHOTO_KINDS, photoExamples, photoExamplesBrief, type Expect } from "@config/photo-training";
import { drawsRealWoman } from "@config/jawad/assistant";
import { FONTS } from "@config/jawad/student";
import { PHOTO } from "@config/photo";

// «زهراء» learns from a thousand worked requests. Every one is run on a real project: its commands must work, do what the
// example claims, explain themselves, and never draw or edit a real woman.
const FILES = new Map([["f1", { w: 4000, h: 3000 }], ["f2", { w: 800, h: 800 }]]);
const ctx = { files: FILES, fonts: FONTS.map((f) => f.id) };
const WOMAN = /\b(woman|women|girl|female|lady)\b|امرأة|نساء|فتاة|سيدة|موظفة|مدرّسة|عروس|بنت|أختي|زوجتي|أمي/u;

/** The project the examples run on: a 4:3 photo with a title (t1), a dark bar (s2) and a picture (i3). */
const baseline = (): PhotoDoc => {
  const r = applyOps(
    docFromPicture({ id: "f1", w: 4000, h: 3000 }, 1600),
    [
      { op: "add_text", text: "العنوان", font: "readex", size: 8, x: 50, y: 20, w: 70, color: "#FFFFFF" },
      { op: "add_shape", shape: "rect", x: 50, y: 90, w: 100, h: 10, fill: "#000000", opacity: 0.5 },
      { op: "add_image", file: "f2", x: 20, y: 70, w: 25 },
    ],
    ctx,
  );
  if (r.error) throw new Error(r.error.message);
  return r.doc;
};

function check(base: PhotoDoc, doc: PhotoDoc, e: Expect) {
  for (const [k, [cmp, v]] of Object.entries(e.adjust ?? {})) {
    const got = doc.adjust[k as keyof PhotoDoc["adjust"]];
    if (cmp === ">") expect(got).toBeGreaterThan(v);
    else if (cmp === "<") expect(got).toBeLessThan(v);
    else expect(got).toBe(v);
  }
  if (e.filter) expect(doc.filter.id).toBe(e.filter);
  if (e.size) expect([doc.width, doc.height]).toEqual(e.size.map((n) => Math.min(PHOTO.maxSide, n)));
  if (e.ratio) expect(Math.abs(doc.width / doc.height - e.ratio)).toBeLessThan(0.03);
  if (e.layers !== undefined) expect(doc.layers.length - base.layers.length).toBe(e.layers);
  if (e.text) expect(doc.layers.some((l) => l.kind === "text" && l.text === e.text)).toBe(true);
  if (e.rotate !== undefined) expect(doc.base?.rotate).toBe(e.rotate);
  if (e.none) expect(doc).toEqual(base);
}

describe("a thousand worked requests", () => {
  const list = photoExamples();

  it("are exactly a thousand, spread over every kind, all different", () => {
    expect(list).toHaveLength(PHOTO_EXAMPLES_COUNT);
    expect(new Set(list.map((e) => e.id)).size).toBe(PHOTO_EXAMPLES_COUNT);
    for (const k of PHOTO_KINDS) expect(list.filter((e) => e.kind === k.id).length).toBeGreaterThanOrEqual(30);
    expect(new Set(list.map((e) => `${e.ask}|${JSON.stringify(e.ops)}`)).size).toBe(PHOTO_EXAMPLES_COUNT);
    expect(new Set(list.map((e) => e.ask)).size).toBeGreaterThan(450);
  });

  it.each(list.map((e) => [e.id, e] as const))("%s: its commands work, do what it says, and explain why", (_id, e) => {
    const base = baseline();
    const parsed = readOps(e.ops.map((o) => JSON.stringify(o)));
    expect(parsed.error).toBeNull();
    expect(parsed.ops).toHaveLength(e.ops.length);
    expect(e.ops.length).toBeLessThanOrEqual(PHOTO.maxOps);
    const r = applyOps(base, parsed.ops as Op[], ctx);
    expect(r.error).toBeNull();
    check(base, r.doc, e.expect);
    expect(e.ask.length).toBeGreaterThan(5);
    expect(e.diagnosis.length).toBeGreaterThan(15);
    expect(e.reply.length).toBeGreaterThan(25);
    expect(e.suggestions.length).toBeGreaterThan(0);
    expect(e.suggestions.length).toBeLessThanOrEqual(4);
    if (e.jawad) {
      expect(["generate", "cutout", "edit"]).toContain(e.jawad.kind);
      expect(["base", "layer", "file"]).toContain(e.jawad.target);
      if (e.jawad.kind !== "cutout") expect(e.jawad.prompt.length).toBeGreaterThan(20);
      expect(drawsRealWoman(e.jawad.prompt)).toBe(false);
      expect(e.jawad.prompt).not.toMatch(WOMAN);
      expect(e.jawad.prompt).toMatch(e.jawad.kind === "generate" || e.jawad.kind === "edit" ? /no text/i : /^$/);
    }
    if (e.kind === "refuse") {
      expect(e.ops).toEqual([]);
      expect(e.jawad).toBeUndefined();
      expect(e.reply).toMatch(/قاعدة الموقع/);
      expect(e.ask).toMatch(WOMAN);
    } else {
      // nothing she does, says or sends draws a woman
      expect(`${e.reply} ${e.diagnosis} ${JSON.stringify(e.ops)} ${e.jawad?.prompt ?? ""}`).not.toMatch(WOMAN);
      expect(e.ask).not.toMatch(WOMAN);
    }
  });

  it("show the lessons she teaches: moderate values, legible titles, no fixing by brute force", () => {
    for (const e of list.filter((x) => x.kind === "exposure" || x.kind === "flat" || x.kind === "color_cast")) {
      const v = e.ops.flatMap((o) => Object.values((o.values as Record<string, number>) ?? {}));
      for (const n of v) expect(Math.abs(n)).toBeLessThanOrEqual(40);
    }
    for (const e of list.filter((x) => x.kind === "title")) {
      expect(e.ops.map((o) => o.op)).toEqual(["add_shape", "add_text"]);
      const t = e.ops[1] as { size: number; w: number; y: number };
      expect(t.size).toBeGreaterThanOrEqual(6);
      expect(t.size).toBeLessThanOrEqual(10);
      expect(t.w).toBeLessThanOrEqual(90);
    }
    for (const e of list.filter((x) => x.kind === "thumbnail")) expect(e.ops[0]).toMatchObject({ op: "canvas", preset: "yt_thumb" });
  });

  it("are shown by likeness: the closest to what the person says, one kind first", () => {
    const dark = nearestPhotoExamples("الصورة غامقة وما تبين التفاصيل", 3);
    expect(dark.length).toBeGreaterThan(0);
    expect(dark[0].kind).toBe("exposure");
    const wedding = nearestPhotoExamples("اكتب العنوان فوق الصورة", 3);
    expect(wedding.some((e) => e.kind === "title")).toBe(true);
    const thumb = nearestPhotoExamples("جهّز مصغّرة يوتيوب", 3);
    expect(thumb[0].kind).toBe("thumbnail");
    const refuse = nearestPhotoExamples("حسّن صورة زوجتي", 3);
    expect(refuse[0].kind).toBe("refuse");
    expect(nearestPhotoExamples("xyz", 3)).toEqual([]);
    const brief = photoExamplesBrief(dark);
    expect(brief).toContain("الطلب:");
    expect(brief).toContain("الأوامر:");
    expect(photoExamplesBrief([])).toBe("");
  });
});
