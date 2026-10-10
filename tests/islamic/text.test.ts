import { describe, expect, it } from "vitest";
import { chunkText, htmlToText, mainText, normalizeArabic, pageTitle, pickPassages, queryWords, tsQuery } from "@/lib/islamic/text";

describe("«الذكاء الإسلامي» · text", () => {
  it("turns HTML into readable text", () => {
    const html = `<html><head><title>الكافي | الثقلين</title><style>.a{}</style></head><body><script>x()</script><main><h1>كتاب العقل</h1><p>الحديث &laquo;الأول&raquo;.<br>سطر</p><ul><li>بند</li></ul></main></body></html>`;
    expect(pageTitle(html)).toBe("الكافي | الثقلين");
    expect(mainText(html)).toBe("كتاب العقل\nالحديث «الأول».\nسطر\nبند");
    expect(htmlToText("a &amp; b &#1575;")).toBe("a & b ا");
  });

  it("makes Arabic the same however it was written", () => {
    expect(normalizeArabic("الصَّلاةُ والوضوءِ بالكتابِ")).toBe("صلاه وضوء كتاب");
    // the article stays on short words (الله, الذي) and a lone prefix stays (بسم)
    expect(normalizeArabic("الله الذي بسم")).toBe("الله الذي بسم");
    expect(normalizeArabic("أحمد إبراهيم آدم")).toBe("احمد ابراهيم ادم");
    expect(normalizeArabic("مصطفى، عليٌ!")).toBe("مصطفي علي");
    expect(normalizeArabic("كـــتاب")).toBe("كتاب");
  });

  it("keeps the telling words of a question and drops the rest", () => {
    const w = queryWords("ما هو معنى كلمة ذو الفقار في الروايات؟");
    expect(w).toContain("فقار");
    expect(w).toContain("روايات");
    expect(w).not.toContain("ما");
    expect(w).not.toContain("في");
    expect(tsQuery(["فقار", "روايات", "ذو"])).toBe("فقار:* | روايات:* | ذو");
    expect(tsQuery(["فقار", "روايات"], true)).toBe("فقار:* & روايات:*");
  });

  it("cuts long text into overlapping pieces at sentence ends", () => {
    const para = "جملة طويلة بعض الشيء تنتهي هنا. ";
    const text = para.repeat(200);
    const pieces = chunkText(text, 500, 60);
    expect(pieces.length).toBeGreaterThan(8);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(500);
    // every piece ends at a sentence end, and the next one starts a little before it ended
    expect(pieces[0].endsWith(".")).toBe(true);
    expect(text.indexOf(pieces[1])).toBeLessThan(pieces[0].length);
    expect(chunkText("قصير", 500)).toEqual(["قصير"]);
    expect(chunkText("   ", 500)).toEqual([]);
  });
});


describe("«الذكاء الإسلامي» · الروايات أولًا", () => {
  const P = (chunk_id: number, doc_id: string) => ({ chunk_id, doc_id });
  it("gives most places to the narrations, then fills with the rest, at most perDoc from one document", () => {
    const nar = [P(1, "a"), P(2, "a"), P(3, "a"), P(4, "a"), P(5, "b"), P(6, "c")];
    const other = [P(10, "x"), P(11, "y"), P(12, "z")];
    const got = pickPassages(nar, other, 6, 3, 4);
    // 4 narrations (a×3 then b), then the others fill, never more than 3 from document a
    expect(got.map((p) => p.chunk_id)).toEqual([1, 2, 3, 5, 10, 11]);
    expect(got.filter((p) => p.doc_id === "a").length).toBe(3);
  });
  it("narrations fill the answer when the rest has nothing, and the rest when no narration was found", () => {
    expect(pickPassages([P(1, "a"), P(2, "b"), P(3, "c")], [], 5, 3, 2).map((p) => p.chunk_id)).toEqual([1, 2, 3]);
    expect(pickPassages([], [P(9, "x"), P(8, "y")], 5, 3).map((p) => p.chunk_id)).toEqual([9, 8]);
  });
});

import { isIslamicMode, isPrimary, MODE_LABEL } from "@/lib/islamic/text";
import { cleanTurns, titleOf } from "@/lib/islamic/chats";
import { contextOf } from "@/lib/islamic/ask";

describe("«الذكاء الإسلامي» · the ways to answer and the memory", () => {
  it("tells the primary source (thaqalayn) from the complements, and knows the three ways", () => {
    expect(isPrimary("https://thaqalayn.com/chapter/12")).toBe(true);
    expect(isPrimary("https://www.almojib.com/q/5")).toBe(false);
    expect(isPrimary("https://www.aqaed.com/faq/9")).toBe(false);
    expect(["auto", "narration", "research"].every(isIslamicMode)).toBe(true);
    expect(isIslamicMode("web")).toBe(false);
    expect(MODE_LABEL.narration).toBe("الرواية فقط");
  });
  it("keeps a conversation's turns checked, and gives a follow-up its context", () => {
    const t = cleanTurns([{ role: "user", text: "فضل الزيارة", mode: "research" }, { role: "assistant", text: "جواب", sources: [{ n: 1, url: "https://thaqalayn.com/x", title: "t", source: "s", kind: "hadith-chapter", primary: true }], found: true }, { role: "x", text: "y" }, null]);
    expect(t).toHaveLength(2);
    expect(t[0].mode).toBe("research");
    expect(t[1].sources?.[0].primary).toBe(true);
    expect(titleOf("  فضل   الزيارة ")).toBe("فضل الزيارة");
    const c = contextOf(t);
    expect(c).toContain("السائل: فضل الزيارة");
    expect(c).toContain("الجواب: جواب");
  });
});
