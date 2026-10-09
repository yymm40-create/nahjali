import { describe, expect, it } from "vitest";
import { ALL_PERMS, codeOpen, unlimitedByCodes, NAMED_ONLY, newCodeText, normalizePerms, OPEN_PERMS, permsByCodes, type CodeRow, type CodeUse } from "@config/access";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const hour = 3600_000;
const code = (id: string, o: Partial<CodeRow> = {}): CodeRow => ({ id, label: id, code: id.toUpperCase().repeat(4), perms: ["games"], expiresAt: null, validHours: null, maxUses: null, enabled: true, unlimited: false, ...o });
const use = (codeId: string, ago = 0): CodeUse => ({ codeId, email: "a@b.co", at: new Date(NOW - ago).toISOString() });

describe("«الأكواد»: each code stands alone", () => {
  it("opens exactly the sections it names, and only for someone who entered it", () => {
    const c = code("a", { perms: ["games", "image"] });
    expect([...permsByCodes([c], [use("a")], NOW)].sort()).toEqual(["games", "image"]);
    expect(permsByCodes([c], [], NOW).size).toBe(0);
    expect(permsByCodes([c], [use("zzz")], NOW).size).toBe(0);
  });

  it("an off code, an expired code and a person's past hours each close that code only", () => {
    expect(codeOpen(code("a", { enabled: false }), use("a"), NOW)).toBe(false);
    expect(codeOpen(code("a", { expiresAt: new Date(NOW - 1).toISOString() }), use("a"), NOW)).toBe(false);
    expect(codeOpen(code("a", { expiresAt: new Date(NOW + hour).toISOString() }), use("a"), NOW)).toBe(true);
    // 24 hours from entering: open at hour 23, closed at hour 24
    expect(codeOpen(code("a", { validHours: 24 }), use("a", 23 * hour), NOW)).toBe(true);
    expect(codeOpen(code("a", { validHours: 24 }), use("a", 24 * hour), NOW)).toBe(false);
  });

  it("no overlap: one code ending takes nothing from another; two codes add up", () => {
    const games = code("g", { perms: ["games"], expiresAt: new Date(NOW - 1).toISOString() });
    const image = code("i", { perms: ["image"] });
    const video = code("v", { perms: ["video"], enabled: false });
    const uses = [use("g"), use("i"), use("v")];
    // the expired games code and the off video code give nothing; the image code is untouched by them
    expect([...permsByCodes([games, image, video], uses, NOW)]).toEqual(["image"]);
    const both = permsByCodes([code("x", { perms: ["games"] }), image], [use("x"), use("i")], NOW);
    expect([...both].sort()).toEqual(["games", "image"]);
    // taking the image code away leaves the games code exactly as it was
    expect([...permsByCodes([code("x", { perms: ["games"] })], [use("x"), use("i")], NOW)]).toEqual(["games"]);
  });
});

describe("what the all-opening code gives", () => {
  it("everything, «صانع الألعاب» and «صانع المحتوى» included", () => {
    // the owner put «صانع الألعاب» and «صانع المحتوى» inside the all-opening code: nothing opens by name only now
    expect(NAMED_ONLY).toEqual([]);
    expect(OPEN_PERMS).toContain("games");
    expect(OPEN_PERMS).toContain("content");
    expect(OPEN_PERMS.length).toBe(ALL_PERMS.length);
    expect(ALL_PERMS).toContain("games");
  });
  it("makes for free only through a code the owner marked «بلا حدود», and only while it opens", () => {
    expect(unlimitedByCodes([code("a")], [use("a")], NOW)).toBe(false);
    expect(unlimitedByCodes([code("a", { unlimited: true })], [use("a")], NOW)).toBe(true);
    expect(unlimitedByCodes([code("a", { unlimited: true, enabled: false })], [use("a")], NOW)).toBe(false);
    expect(unlimitedByCodes([code("a", { unlimited: true })], [], NOW)).toBe(false);
  });
});

describe("the owner's form", () => {
  it("keeps only known sections, once each", () => {
    expect(normalizePerms(["games", "games", "nope", "image", 7])).toEqual(["games", "image"]);
    expect(normalizePerms("games")).toEqual([]);
  });
  it("makes readable random codes (no look-alike characters)", () => {
    for (let i = 0; i < 200; i++) expect(newCodeText()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(new Set(Array.from({ length: 50 }, () => newCodeText())).size).toBeGreaterThan(45);
  });
});
