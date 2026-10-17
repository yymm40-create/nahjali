import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
import { countWords, dialoguePace, paceWarning, secondsFor } from "@/lib/film/pace";
import { replaceLineInPrompt } from "@/lib/film/voices";

describe("dialogue pace", () => {
  it("counts Arabic words, diacritics and punctuation aside", () => {
    expect(countWords("مَرْحَبًا يا صَدِيقِي ، كيف حالك؟")).toBe(5);
  });
  it("needs words ÷ 2 + 1 seconds", () => {
    expect(secondsFor(22)).toBe(12);
    expect(secondsFor(9)).toBe(6);
  });
  it("warns when 22 words sit in 6 seconds, with the seconds needed", () => {
    const line = Array.from({ length: 22 }, () => "كلمة").join(" ");
    const p = dialoguePace([line], 6);
    expect(p.fast).toBe(true);
    expect(paceWarning(p, 15)).toBe("⚠️ ٢٢ كلمة في ٦ ثواني، بيسرّع الكلام — طوّلها لـ١٢ ثانية أو قسّمها");
  });
  it("says split when even the longest shot is too short", () => {
    const p = dialoguePace([Array.from({ length: 40 }, () => "كلمة").join(" ")], 10);
    expect(paceWarning(p, 15)).toContain("قسّمها على مقطعين");
  });
  it("stays quiet at a natural pace", () => {
    expect(paceWarning(dialoguePace(["كيف حالك اليوم يا صديقي"], 8), 15)).toBe("");
  });
});

describe("an edited line changes in the prompt", () => {
  it("the exact words", () => {
    const r = replaceLineInPrompt('He says: "مرحبا يا صديقي" and smiles.', "مرحبا يا صديقي", "أهلا يا خوي", 0, 1);
    expect(r).toEqual({ prompt: 'He says: "أهلا يا خوي" and smiles.', found: true });
  });
  it("the same words written with diacritics in the prompt", () => {
    const r = replaceLineInPrompt('He says: "مَرْحَبًا يَا صَدِيقِي".', "مرحبا يا صديقي", "أهلا", 0, 1);
    expect(r.found).toBe(true);
    expect(r.prompt).toBe('He says: "أهلا".');
  });
  it("the i-th Arabic quote when the words differ", () => {
    const r = replaceLineInPrompt('A: «السلام عليكم» — B: «وعليكم السلام» (in "English")', "شيء آخر", "هلا والله", 1, 2);
    expect(r.prompt).toBe('A: «السلام عليكم» — B: «هلا والله» (in "English")');
  });
  it("tells when the line is not in the prompt", () => {
    expect(replaceLineInPrompt("No dialogue here", "مرحبا", "أهلا", 0, 1).found).toBe(false);
  });
});
