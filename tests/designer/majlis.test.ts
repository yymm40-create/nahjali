import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { MAJLIS_PEOPLE, MAJLIS_TEMPLATES, orderMissing, readOrder, templatesFor } from "@config/designer-majlis";
import { majlisGptPrompt, majlisPhotos, majlisProgram } from "@/lib/designer/majlis";
import { checkScene } from "@/lib/editor/scene/contract";

const PUB = path.join(__dirname, "..", "..", "public", "designer", "majlis");
const order = (id: string) => readOrder({ templateId: id, fields: { host: "مأتم الزهراء", night: "ليلة الجمعة", date: "١٥ جمادى الأولى", time: "٨:٣٠", place: "القطيف" }, people: [{ role: "kh", name: "الشيخ حسن", photo: "u1" }, { role: "rd", name: "الملا علي", photo: "u2" }], cut: false })!;

describe("«كاظم»'s ready majlis designs", () => {
  it("has the 60 invitations, each with its files, two frames and its words", () => {
    expect(MAJLIS_TEMPLATES).toHaveLength(60);
    for (const t of MAJLIS_TEMPLATES) {
      expect(t.slots.map((s) => s.who)).toEqual(["kh", "rd"]);
      expect(t.words.some((w) => w.k === "kh") && t.words.some((w) => w.k === "rd")).toBe(true);
      for (const f of [`${t.id}.jpg`, `${t.id}_base.jpg`, ...(t.mask ? [`${t.id}_mask.png`] : [])]) expect(existsSync(path.join(PUB, f)), f).toBe(true);
    }
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
      for (const f of [`${t.id}.jpg`, `${t.id}_base.jpg`, ...(t.titleLayer ? [`${t.id}_title.png`] : [])]) expect(existsSync(path.join(PUB, f)), f).toBe(true);
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
