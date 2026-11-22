import { describe, expect, it } from "vitest";
import { cleanQuestion, linkPieces, plainAnswer, sheikhLeft, sheikhWording, SHEIKH_DAILY } from "@/lib/mahdi/sheikh";
import { sheikhLog, type SheikhLogRow } from "@/lib/mahdi/sheikh-log";
import { gradingLine, hadithQuery, hadithRows, normAr, type RawHadith } from "@/lib/mahdi/hadiths";

describe("«الشيخ الذكي»", () => {
  it("counts the day's questions of each kind", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
    expect(sheikhLeft("quick", [hoursAgo(1), hoursAgo(2), hoursAgo(30)], now)).toBe(SHEIKH_DAILY.quick - 2);
    expect(sheikhLeft("deep", Array.from({ length: SHEIKH_DAILY.deep + 1 }, () => hoursAgo(1)), now)).toBe(0);
  });

  it("keeps a question up to 1000 letters", () => {
    expect(cleanQuestion("  ما فضل زيارة عاشوراء؟ ")).toBe("ما فضل زيارة عاشوراء؟");
    expect(cleanQuestion(" ")).toBeNull();
    expect(cleanQuestion("x".repeat(1001))).toBeNull();
  });

  it("writes «صلى الله عليه وآله», never ﷺ", () => {
    expect(sheikhWording("روي عن النبي ﷺ")).toBe("روي عن النبي صلى الله عليه وآله");
    expect(sheikhWording("رسول الله صلى الله عليه وسلم")).toBe("رسول الله صلى الله عليه وآله");
  });

  it("cuts a line into text, links and bold", () => {
    expect(linkPieces("**الكافي** https://thaqalayn.com/hadith/2/1/44/2.")).toEqual([
      { t: "bold", v: "الكافي" },
      { t: "text", v: " " },
      { t: "link", v: "https://thaqalayn.com/hadith/2/1/44/2" },
      { t: "text", v: "." },
    ]);
    expect(plainAnswer("## عنوان\n- أولًا")).toBe("عنوان\n• أولًا");
  });
});

describe("the sheikh's library", () => {
  const raw = (id: number, cat: number, ch: number, extra: Partial<RawHadith> = {}): RawHadith => ({ id, bookId: "Al-Kafi-Volume-2-Kulayni", volume: 2, categoryId: cat, chapterInCategoryId: ch, arabicText: `نص ${id}`, ...extra });

  it("rebuilds each hadith's place on thaqalayn (the number in its chapter)", () => {
    const rows = hadithRows(2, [raw(1, 1, 1), raw(2, 1, 1), raw(3, 1, 2), raw(4, 2, 1), raw(5, 1, 2, { arabicText: "" })]);
    expect(rows.map((r) => r.id)).toEqual(["2/1/1/1", "2/1/1/2", "2/1/2/1", "2/2/1/1"]);
    expect(rows[0]).toMatchObject({ book: 2, volume: 2, seq: 1, n: 1 });
  });

  it("normalises Arabic like the index and builds the search", () => {
    expect(normAr("وَالزِّيارَةُ")).toBe("زياره");
    expect(normAr("أمير المؤمنين")).toBe("امير مومنين");
    expect(hadithQuery("زيارة الحسين", true)).toBe("زياره:* & حسين:*");
    expect(hadithQuery("زيارة الحسين")).toBe("زياره:* | حسين:*");
    expect(hadithQuery("؟!")).toBeNull();
  });

  it("writes the gradings in one line", () => {
    expect(gradingLine({ gradings: [{ grade_ar: " مرسل ", reference_en: "Mirʾāt al-ʿUqūl (1/7)", author: { name_ar: "العلامة باقر المجلسي" } }] })).toBe("العلامة باقر المجلسي: مرسل (Mirʾāt al-ʿUqūl (1/7))");
    expect(gradingLine({ majlisi: "صحيح", gradings: [] })).toBe("المجلسي: صحيح");
    expect(gradingLine({ gradings: [] })).toBe("");
  });
});

describe("«أسئلة الشيخ الذكي» (the owner's log)", () => {
  const row = (user_id: string, role: "user" | "sheikh", at: string, body: string, extra: Partial<SheikhLogRow> = {}): SheikhLogRow => ({
    user_id, role, body, created_at: at, mode: "quick", sources: [], usd: 0, report: null, ...extra,
  });
  const rows: SheikhLogRow[] = [
    row("b", "user", "2026-11-22T04:00:00Z", "روايات في بر الوالدين"),
    row("b", "sheikh", "2026-11-22T04:00:08Z", "جواب", { usd: "0.002", sources: [{ n: 1, url: "u", title: "t", source: "s" }] }),
    row("me", "user", "2026-11-22T05:00:00Z", "روايات في بر الوالدين؟", { mode: "deep" }),
    row("me", "sheikh", "2026-11-22T05:00:30Z", "جواب طويل", { usd: "0.01", mode: "deep" }),
    row("c", "user", "2026-11-22T22:00:00Z", "مسجد القمامة"),
    row("c", "sheikh", "2026-11-22T22:00:09Z", "ما لقيت", { usd: 0.003, report: "غلط" }),
    row("b", "user", "2026-11-22T23:00:00Z", "سؤال بلا جواب"),
  ];
  const { questions, stats } = sheikhLog(rows, "me");

  it("names nobody: the owner is 0, the others numbered by their first question", () => {
    expect(questions.map((q) => q.person)).toEqual([1, 2, 0, 1]);
  });

  it("pairs each question with its answer", () => {
    const deep = questions.find((q) => q.person === 0)!;
    expect(deep).toMatchObject({ mode: "deep", answer: "جواب طويل", secs: 30, usd: 0.01 });
    expect(questions[0].answer).toBeNull();
  });

  it("counts people, cost, time, repeats and days in Riyadh time", () => {
    expect(stats).toMatchObject({ questions: 4, people: 3, othersQuestions: 3, othersPeople: 2, cameBack: 1, quick: 3, deep: 1, noAnswer: 1, noSources: 2, reports: 1 });
    expect(stats.usd).toBeCloseTo(0.015);
    expect(stats.othersUsd).toBeCloseTo(0.005);
    expect(stats.avgSecs.quick).toBeCloseTo(8.5);
    expect(stats.top).toEqual([{ question: "روايات في بر الوالدين", times: 2, people: 2 }]);
    expect(stats.days).toEqual([{ day: "2026-11-22", questions: 2, people: 2 }, { day: "2026-11-23", questions: 2, people: 2 }]);
  });
});
