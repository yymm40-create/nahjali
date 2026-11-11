import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { MAJLIS_TEMPLATES, orderMissing, readOrder, templatesFor } from "@config/designer-majlis";
import { majlisGptPrompt, majlisPhotos, majlisProgram } from "@/lib/designer/majlis";
import { checkScene } from "@/lib/editor/scene/contract";

const PUB = path.join(__dirname, "..", "..", "public", "designer", "majlis");
const order = (id: string) => readOrder({ templateId: id, fields: { host: "مأتم الزهراء", night: "ليلة الجمعة", date: "١٥ جمادى الأولى", time: "٨:٣٠", place: "القطيف" }, people: [{ role: "kh", name: "الشيخ حسن", photo: "u1" }, { role: "rd", name: "الملا علي", photo: "u2" }] })!;

describe("«كاظم»'s ready majlis designs", () => {
  it("has the 60 invitations, each with its files, two frames and its words", () => {
    expect(MAJLIS_TEMPLATES).toHaveLength(60);
    for (const t of MAJLIS_TEMPLATES) {
      expect(t.slots.map((s) => s.who)).toEqual(["kh", "rd"]);
      expect(t.words.some((w) => w.k === "kh") && t.words.some((w) => w.k === "rd")).toBe(true);
      for (const f of [`${t.id}.jpg`, `${t.id}_base.jpg`, ...(t.mask ? [`${t.id}_mask.png`] : [])]) expect(existsSync(path.join(PUB, f)), f).toBe(true);
    }
  });
  it("shows the designs that fit the count", () => {
    expect(templatesFor(1, 1)).toHaveLength(60);
    expect(templatesFor(0, 2)).toHaveLength(60);
    expect(templatesFor(2, 1)).toHaveLength(0);
  });
  it("checks an order and says what is missing", () => {
    expect(readOrder({ templateId: "nope" })).toBeNull();
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
