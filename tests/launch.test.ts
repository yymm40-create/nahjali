import { describe, expect, it } from "vitest";
import { bonusPct, CREDITS, DEFAULT_CREDIT_SETTINGS, DEFAULT_PACKS, readCreditSettings, SCENE_PACK_SAR, supportLink } from "@config/credits";
import { claudeHalalas, coinsFor } from "@config/coins";
import { videoEstimateUsd } from "@config/film";
import { cleanLinks, cleanTurns } from "@/lib/salman";
import { PUBLIC_PERMS } from "@config/access";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { NAHJ_ALI_HIDDEN, SITE_NAME } from "@config/site";

describe("the balance packages", () => {
  it("are six: the ¤10 trial, «المشهد السينمائي» at what one scene costs, then the four as they were", () => {
    expect(DEFAULT_PACKS.map((p) => [p.id, p.price, p.credit])).toEqual([
      ["try", 10, 10],
      ["scene", SCENE_PACK_SAR, SCENE_PACK_SAR],
      ["basic", 99, 100],
      ["pro", 119, 140],
      ["studio", 279, 330],
      ["business", 549, 660],
    ]);
    expect(DEFAULT_PACKS.some((p) => p.price === 19)).toBe(false);
    expect(DEFAULT_PACKS).toHaveLength(CREDITS.maxPacks);
    expect(DEFAULT_CREDIT_SETTINGS.featured).toBe("pro");
    // still a push to the next one: «المحترف» only a little dearer than «الأساسية» but with much more
    const [, , b, c] = DEFAULT_PACKS;
    expect(c.price - b.price).toBeLessThan(b.price * 0.3);
    expect(bonusPct(c)).toBeGreaterThan(bonusPct(b) + 10);
  });
  it("«المشهد السينمائي» covers one 15-second Seedance 2.0 scene at 720p with a redo, 4 sheets and the robots' replies", () => {
    const video = coinsFor(videoEstimateUsd("seedance-2.0", "720p", 15) * 2);
    const pictures = coinsFor(6 * 0.4 + 2 * 0.07);
    const robots = claudeHalalas(4 * 0.6) + claudeHalalas(5 * 0.8) + claudeHalalas(3 * 1.0) + claudeHalalas(0.3);
    const total = video + pictures + robots;
    expect(SCENE_PACK_SAR * 100).toBeGreaterThanOrEqual(total);
    expect(SCENE_PACK_SAR * 100 - total).toBeLessThan(100);
  });
  it("never give so much extra that the balance sells under cost (the site's margin is ~30%)", () => {
    for (const p of DEFAULT_PACKS) expect(bonusPct(p)).toBeLessThanOrEqual(25);
    // more balance per riyal as the package grows (after the try and the scene)
    const per = DEFAULT_PACKS.map((p) => p.credit / p.price);
    for (let i = 3; i < per.length; i++) expect(per[i]).toBeGreaterThanOrEqual(per[i - 1] - 1e-9);
  });
  it("read what the owner saved: bad rows dropped, at most six, the featured one kept only if it exists", () => {
    const s = readCreditSettings({
      packs: [{ id: "A b!", name: "س", price: 10, credit: 12 }, { id: "x", name: "", price: 5, credit: 5 }, { id: "y", name: "ص", price: -1, credit: 5 }, { id: "ab", name: "مكرر", price: 1, credit: 1 }],
      featured: "zzz",
      whatsapp: "0501234567",
    });
    expect(s.packs.map((p) => p.id)).toEqual(["ab"]);
    expect(s.featured).toBe("ab");
    expect(s.whatsapp).toBe("+966501234567");
    expect(readCreditSettings(null).packs).toEqual(DEFAULT_PACKS);
    const many = readCreditSettings({ packs: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `ب${i}`, price: i + 1, credit: i + 1 })) });
    expect(many.packs).toHaveLength(6);
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

describe("«سلمان»", () => {
  it("keeps the last turns, starting with the person, sides alternating", () => {
    const t = cleanTurns([{ role: "assistant", text: "هلا" }, { role: "user", text: "سؤال" }, { role: "user", text: "وثاني" }, { role: "assistant", text: "جواب" }, { role: "x", text: "؟" }, { role: "user", text: "  " }]);
    expect(t).toEqual([{ role: "user", text: "سؤال\nوثاني" }, { role: "assistant", text: "جواب" }]);
    expect(cleanTurns("nope")).toEqual([]);
  });
  it("only links inside the site", () => {
    expect(cleanLinks([{ label: "اشحن", href: "/jawad-ai/credits" }, { label: "برا", href: "https://evil.com" }, { label: "x", href: "//evil.com" }, { label: "api", href: "/api/x" }, { label: "", href: "/a" }])).toEqual([{ label: "اشحن", href: "/jawad-ai/credits" }]);
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
    expect(JAWAD_KNOWLEDGE).toContain("سلمان");
    expect(JAWAD_KNOWLEDGE).toContain("/jawad-ai/credits");
    expect(JAWAD_KNOWLEDGE).toContain("فتح الموقع للجميع");
    expect(JAWAD_KNOWLEDGE).not.toContain("الملاحظ حسن");
  });
});
