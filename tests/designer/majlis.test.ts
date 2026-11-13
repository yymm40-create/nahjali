import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { MAJLIS_PEOPLE, MAJLIS_TEMPLATES, orderMissing, readOrder, readUserTemplate, templateOf, templatesFor } from "@config/designer-majlis";
import { majlisGptPrompt, majlisPhotos, majlisProgram } from "@/lib/designer/majlis";
import { checkScene } from "@/lib/editor/scene/contract";

const PUB = path.join(__dirname, "..", "..", "public", "designer", "majlis");
const order = (id: string) => readOrder({ templateId: id, fields: { occ: "السيدة فاطمة الزهراء عليها السلام", host: "مأتم الزهراء", night: "ليلة الجمعة", date: "١٥ جمادى الأولى", time: "٨:٣٠", place: "القطيف" }, people: [{ role: "kh", name: "الشيخ حسن", photo: "u1" }, { role: "rd", name: "الملا علي", photo: "u2" }], cut: false })!;

describe("«كاظم»'s ready majlis designs", () => {
  it("has the 60 invitations, each with its files, two frames and its words", () => {
    expect(MAJLIS_TEMPLATES).toHaveLength(60);
    for (const t of MAJLIS_TEMPLATES) {
      expect(t.slots.map((s) => s.who)).toEqual(["kh", "rd"]);
      expect(t.words.some((w) => w.k === "kh") && t.words.some((w) => w.k === "rd")).toBe(true);
      for (const f of [`${t.id}.jpg`, `${t.id}_base.jpg`, ...(t.mask ? [`${t.id}_mask.png`] : [])]) expect(existsSync(path.join(PUB, f)), f).toBe(true);
    }
  });
  it("puts each name on its own plate, right under its own frame (no two names on one plate)", () => {
    for (const t of MAJLIS_TEMPLATES) {
      const kh = t.words.find((w) => w.k === "kh")!.r, rd = t.words.find((w) => w.k === "rd")!.r;
      expect(Math.abs(kh[0] - rd[0]) + Math.abs(kh[1] - rd[1]), t.id).toBeGreaterThan(0.05);
      if (t.source !== "gpt") continue;
      for (const [who, r] of [["kh", kh], ["rd", rd]] as const) {
        const f = t.slots.find((s) => s.who === who)!.r;
        expect(r[1], `${t.id} ${who}`).toBeGreaterThan(f[1] + f[3] - 0.04);
        expect(r[1], `${t.id} ${who}`).toBeLessThan(f[1] + f[3] + 0.1);
      }
    }
  });
  it("carries a designer's template («قوالب المصممين») in the order, and draws it", () => {
    const raw = { id: "u0123456789ab", aspect: "4:5", title: "يا زهراء", slots: [{ r: [0.1, 0.2, 0.3, 0.35], shape: "circle" }, { r: [0.6, 0.2, 0.3, 0.35] }], words: [{ k: "kh", r: [0.1, 0.6, 0.3, 0.04] }, { k: "rd", r: [0.6, 0.6, 0.3, 0.04], grad: "gold" }, { k: "dateLine", r: [0.2, 0.8, 0.6, 0.03] }, { k: "evil", r: [0, 0, 1, 1] }] };
    const t = readUserTemplate(raw)!;
    expect(t.source).toBe("user");
    expect(t.words.map((w) => w.k)).toEqual(["kh", "rd", "dateLine"]);
    expect(readUserTemplate({ ...raw, id: "x1" })).toBeNull();
    expect(readUserTemplate({ ...raw, words: [] })).toBeNull();
    const o = readOrder({ templateId: t.id, template: t, fields: { host: "م", night: "ل", date: "د", time: "٨", place: "ق" }, people: [{ role: "kh", name: "أ", photo: "u1" }, { role: "rd", name: "ب", photo: "u2" }], cut: false })!;
    expect(templateOf(o)?.id).toBe(t.id);
    expect(templatesFor(1, 1, [t]).at(-1)?.id).toBe(t.id);
    const ph = majlisPhotos(t, o, (id) => `https://x/${id}`);
    expect(ph.urls[0]).toContain(`/api/designer/templates/${t.id}/image`);
    expect(checkScene(majlisProgram(t, o, ph.ids)).ok).toBe(true);
  });
  it("shows the designs that fit the count: the invitations first, then the ones with people", () => {
    const two = templatesFor(1, 1);
    expect(two.slice(0, 60).every((t) => t.kind === "invite")).toBe(true);
    expect(two.length).toBe(60 + MAJLIS_PEOPLE.filter((t) => t.slots.length === 2).length);
    expect(templatesFor(1, 0).every((t) => t.kind === "people" && t.slots.length === 1)).toBe(true);
    expect(templatesFor(1, 0).length).toBeGreaterThan(0);
    expect(templatesFor(2, 1)).toHaveLength(0);
  });
  it("has the designs with people: their empty base, the man's face to stand in, the title layer and the band", () => {
    expect(MAJLIS_PEOPLE.length).toBeGreaterThanOrEqual(18);
    for (const t of MAJLIS_PEOPLE) {
      for (const f of [`${t.id}.jpg`, `${t.id}_base.jpg`, `${t.id}_pose.jpg`, ...(t.titleLayer ? [`${t.id}_title.png`] : [])]) expect(existsSync(path.join(PUB, f)), f).toBe(true);
      for (const s of t.slots) if (s.shape === "person") expect(s.face).toHaveLength(4);
      expect(t.band).toHaveLength(2);
      const o = readOrder({ templateId: t.id, fields: { host: "م", night: "ل", date: "د", time: "٨", place: "ق" }, people: t.slots.map((_, i) => ({ role: i ? "rd" : "kh", name: "س", photo: "u" + i })), cut: true })!;
      const ph = majlisPhotos(t, o, (id) => `https://x/${id}`);
      expect(checkScene(majlisProgram(t, o, ph.ids)).ok).toBe(true);
    }
  });
  it("checks an order and says what is missing", () => {
    expect(readOrder({ templateId: "nope" })).toBeNull();
    // the background choice is always asked
    expect(readOrder({ ...order("q201"), cut: undefined })).toBeNull();
    expect(readOrder({ ...order("q201"), cut: true })?.cut).toBe(true);
    expect(orderMissing(order("q201"))).toEqual([]);
    expect(orderMissing({ ...order("q201"), people: [{ role: "kh", name: "", photo: "" }, { role: "rd", name: "x", photo: "y" }] }).length).toBe(2);
  });
  it("writes a valid program for every design, with the photos in order", () => {
    for (const t of MAJLIS_TEMPLATES) {
      const o = order(t.id);
      const ph = majlisPhotos(t, o, (id) => `https://x/${id}`);
      expect(ph.urls[0]).toContain(`${t.id}_base.jpg`);
      expect(ph.ids.people).toEqual(t.mask ? ["photo3", "photo4"] : ["photo2", "photo3"]);
      const code = majlisProgram(t, o, ph.ids);
      expect(checkScene(code).ok).toBe(true);
      expect(code).toContain("الشيخ حسن");
    }
  });
  it("tells GPT the exact words and to keep the faces", () => {
    const p = majlisGptPrompt(MAJLIS_TEMPLATES[0], order(MAJLIS_TEMPLATES[0].id));
    expect(p).toContain("«الشيخ حسن»");
    expect(p).toContain("EXACTLY as in his photo");
  });
});

describe("«دعوة مجلس» for any of the Ma'sumeen", () => {
  it("asks the occasion, writes it, and keeps Lady Fatima's designs to GPT for another occasion", async () => {
    const { MAJLIS_OCCASIONS, ZAHRA, codeFits, zahraOnly, wordText } = await import("@config/designer-majlis");
    const husain = MAJLIS_OCCASIONS.find((x) => x.call === "يا حسين")!.name;
    const t = MAJLIS_PEOPLE.find((x) => x.id === "p28")!;
    const base = { templateId: t.id, fields: { host: "مأتم", night: "ليلة", date: "١", time: "٨", place: "هنا" }, people: t.slots.map((s, i) => ({ role: s.who === "rd" ? "rd" : "kh", name: `ن${i}`, photo: "x" })), cut: true };
    expect(orderMissing(readOrder(base)!)).toContain("المناسبة: ذكرى استشهاد");
    const o = readOrder({ ...base, fields: { ...base.fields, occ: husain } })!;
    expect(orderMissing(o)).toEqual([]);
    expect(wordText(o, "detailsA")).toContain(husain);
    expect(readOrder({ ...base, fields: { ...base.fields, occ: "غيره" } })!.fields.occ).toBeUndefined();
    expect(zahraOnly(t)).toBe(true);
    expect(codeFits(t, o)).toBe(false);
    expect(codeFits(t, { fields: { occ: ZAHRA } })).toBe(true);
    expect(majlisGptPrompt(t, o)).toContain("«يا حسين»");
    expect(majlisGptPrompt(t, readOrder({ ...base, fields: { ...base.fields, occ: ZAHRA } })!)).toContain(`«${t.title}»`);
    const list = templatesFor(1, 1, [], husain);
    expect(zahraOnly(list[0])).toBe(false);
  });
});
