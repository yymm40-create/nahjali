import { describe, expect, it } from "vitest";
import { bonusPct, CREDITS, DEFAULT_CREDIT_SETTINGS, DEFAULT_PACKS, packYield, readCreditSettings, SCENE_PACK_SAR, STUDENT_PACK_SAR, STUDENT_SUMMARY_HALALAS, supportLink } from "@config/credits";
import { claudeHalalas, coinsFor } from "@config/coins";
import { videoEstimateUsd } from "@config/film";
import { PUBLIC_PERMS } from "@config/access";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { NAHJ_ALI_HIDDEN, SITE_NAME } from "@config/site";

describe("the balance packages", () => {
  it("are seven: the ¤10 trial, «المشهد السينمائي» at what one scene costs, «الطالب الذكي» at ¤12, then the four as they were", () => {
    expect(DEFAULT_PACKS.map((p) => [p.id, p.price, p.credit])).toEqual([
      ["try", 10, 10],
      ["scene", SCENE_PACK_SAR, SCENE_PACK_SAR],
      ["student", STUDENT_PACK_SAR, STUDENT_PACK_SAR],
      ["basic", 99, 100],
      ["pro", 119, 140],
      ["studio", 279, 330],
      ["business", 549, 660],
    ]);
    expect(DEFAULT_PACKS.some((p) => p.price === 19)).toBe(false);
    expect(DEFAULT_PACKS.length).toBeLessThanOrEqual(CREDITS.maxPacks);
    expect(DEFAULT_CREDIT_SETTINGS.featured).toBe("pro");
    // still a push to the next one: «المحترف» only a little dearer than «الأساسية» but with much more
    const [, , , b, c] = DEFAULT_PACKS;
    expect(c.price - b.price).toBeLessThan(b.price * 0.3);
    expect(bonusPct(c)).toBeGreaterThan(bonusPct(b) + 10);
  });
  it("«المشهد السينمائي» covers one 15-second Seedance 2.0 scene at 480p in one take, 4 sheets and one reply from each robot, at the owner's margins", () => {
    const video = coinsFor(videoEstimateUsd("seedance-2.0", "480p", 15), "video");
    const pictures = coinsFor(4 * 0.4, "image");
    const robots = claudeHalalas(0.6) + claudeHalalas(0.8) + claudeHalalas(1.0) + claudeHalalas(0.3);
    const total = video + pictures + robots;
    expect(SCENE_PACK_SAR * 100).toBeGreaterThanOrEqual(total);
    expect(SCENE_PACK_SAR * 100 - total).toBeLessThan(100);
    expect(SCENE_PACK_SAR).toBe(31);
    expect(SCENE_PACK_SAR).toBeLessThanOrEqual(50);
  });
  it("say what each package makes (pictures, 5-second videos, scenes, study summaries), each on its own", () => {
    const u = { image: 100, video5: 450, scene: SCENE_PACK_SAR * 100, summary: STUDENT_SUMMARY_HALALAS };
    expect(packYield(10, u)).toEqual({ images: 10, videos: 2, scenes: 0, summaries: 1 });
    expect(packYield(SCENE_PACK_SAR, u)).toEqual({ images: 31, videos: 6, scenes: 1, summaries: 5 });
    expect(packYield(660, u).scenes).toBe(21);
    expect(packYield(10, { image: 0, video5: 0, scene: 0, summary: 0 })).toEqual({ images: 0, videos: 0, scenes: 0, summaries: 0 });
    // «الطالب الذكي» makes one short PDF's summary comfortably, often two (measured: ¤2.40–¤8 each)
    expect(packYield(STUDENT_PACK_SAR, u).summaries).toBe(2);
    expect(STUDENT_PACK_SAR).toBe(12);
  });
  it("never give so much extra that the balance sells under cost (the site's margin is ~30%)", () => {
    for (const p of DEFAULT_PACKS) expect(bonusPct(p)).toBeLessThanOrEqual(25);
    // more balance per riyal as the package grows (after the try, the scene and the student's)
    const per = DEFAULT_PACKS.map((p) => p.credit / p.price);
    for (let i = 4; i < per.length; i++) expect(per[i]).toBeGreaterThanOrEqual(per[i - 1] - 1e-9);
  });
  it("read what the owner saved: bad rows dropped, at most six, the featured one kept only if it exists", () => {
    const s = readCreditSettings({
      packs: [{ id: "A b!", name: "س", price: 10, credit: 12 }, { id: "x", name: "", price: 5, credit: 5 }, { id: "y", name: "ص", price: -1, credit: 5 }, { id: "ab", name: "مكرر", price: 1, credit: 1 }],
      featured: "zzz",
      whatsapp: "0501234567",
      removed: ["scene", "student"],
    });
    expect(s.packs.map((p) => p.id)).toEqual(["ab"]);
    expect(s.featured).toBe("ab");
    expect(s.whatsapp).toBe("+966501234567");
    expect(readCreditSettings(null).packs).toEqual(DEFAULT_PACKS);
    const many = readCreditSettings({ packs: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `ب${i}`, price: i + 1, credit: i + 1 })) });
    expect(many.packs).toHaveLength(CREDITS.maxPacks);
  });
  it("a list the owner saved before «الطالب الذكي» (¤12) existed shows it too, in its place by price — unless he deleted it", () => {
    const old = { packs: DEFAULT_PACKS.filter((p) => p.id !== "student" && p.id !== "scene"), featured: "pro" };
    const ids = readCreditSettings(old).packs.map((p) => p.id);
    expect(ids).toEqual(["try", "student", "scene", "basic", "pro", "studio", "business"]);
    expect(readCreditSettings({ ...old, removed: ["student"] }).packs.map((p) => p.id)).not.toContain("student");
  });
  it("«طال الوقت؟» opens a WhatsApp chat with the message written, only when the owner set a number", () => {
    const o = { id: "12345678-aaaa", packName: "المحترف", price: 119, email: "a@b.c" };
    expect(supportLink(DEFAULT_CREDIT_SETTINGS, o)).toBe("");
    const link = supportLink({ ...DEFAULT_CREDIT_SETTINGS, whatsapp: "+966500000000" }, o);
    expect(link.startsWith("https://wa.me/966500000000?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("المحترف");
    expect(decodeURIComponent(link)).toContain("12345678");
  });
});

describe("the launch", () => {
  it("opens every section, the booklet of tables included (it lives in JAWAD AI now)", () => {
    expect(PUBLIC_PERMS).toContain("booklet");
    expect(PUBLIC_PERMS).toContain("video");
    expect(PUBLIC_PERMS).toContain("photo");
  });
  it("the site is «الجواد الذكي» while «نهج علي» is hidden, and the robots know the new parts", () => {
    if (NAHJ_ALI_HIDDEN) expect(SITE_NAME).toBe("الجواد الذكي");
    expect(JAWAD_KNOWLEDGE).toContain("/jawad-ai/credits");
    expect(JAWAD_KNOWLEDGE).toContain("فتح الموقع للجميع");
    expect(JAWAD_KNOWLEDGE).not.toContain("الملاحظ حسن");
  });
});
