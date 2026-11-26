import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { answeredHistory, cleanQuestion, enterSends, linkPieces, pendingQuestion, plainAnswer, questionsLeftText, readEvents, renewText, riwayaWording, sheikhLeft, sheikhRenewAt, sheikhWording, SHEIKH_DAILY } from "@/lib/mahdi/sheikh";
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

describe("«الشيخ الذكي»: one chat, clearer and more honest", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("tells a narration as «روي عن…», never «قال الإمام» as a fact, and never touches the quoted text", () => {
    expect(riwayaWording("قال الإمام الصادق عليه السلام: «قال رسول الله صلى الله عليه وآله: …»")).toBe("روي عن الإمام الصادق عليه السلام: «قال رسول الله صلى الله عليه وآله: …»");
    expect(riwayaWording("وقال أبو عبد الله عليه السلام")).toBe("وروي عن أبي عبد الله عليه السلام");
    expect(riwayaWording("قال الشيخ الصدوق في كتابه")).toBe("قال الشيخ الصدوق في كتابه");
    expect(sheikhWording("قال النبي ﷺ")).toBe("روي عن النبي صلى الله عليه وآله");
  });

  it("says how many questions are left, and that one comes back within 24 hours (never «بكرة»)", () => {
    expect(questionsLeftText(8)).toBe("باقي لك 8 أسئلة اليوم");
    expect(questionsLeftText(28)).toBe("باقي لك 28 سؤال اليوم");
    expect(questionsLeftText(2)).toBe("باقي لك سؤالين اليوم");
    expect(questionsLeftText(1)).toBe("باقي لك سؤال واحد اليوم");
    expect(questionsLeftText(0)).toBe("خلصت أسئلتك اليوم");
    const now = Date.parse("2026-11-26T12:00:00Z");
    const at = sheikhRenewAt([new Date(now - 21 * 3600_000).toISOString(), new Date(now - 3600_000).toISOString(), new Date(now - 30 * 3600_000).toISOString()], now);
    expect(at).toBe(now + 3 * 3600_000);
    expect(renewText(at, now)).toBe("يتجدد لك سؤال خلال 3 ساعات");
    expect(renewText(now + 40 * 60_000, now)).toBe("يتجدد لك سؤال خلال 40 دقيقة");
    expect(sheikhRenewAt([], now)).toBeNull();
    expect(read("src/app/api/mahdi/sheikh/route.ts")).not.toContain("بكرة");
  });

  it("reads the streamed answer line by line, keeping a cut line for the next piece", () => {
    const a = readEvents('{"t":"search"}\n{"t":"text","v":"روي"}\n{"t":"te');
    expect(a.events).toEqual([{ t: "search" }, { t: "text", v: "روي" }]);
    const b = readEvents(`${a.rest}xt","v":" عن"}\nnot json\n`);
    expect(b.events).toEqual([{ t: "text", v: " عن" }]);
    expect(b.rest).toBe("");
  });

  it("on a phone Enter makes a new line; with a keyboard Enter sends", () => {
    expect(enterSends(true, false, false)).toBe(false);
    expect(enterSends(false, false, false)).toBe(true);
    expect(enterSends(false, true, false)).toBe(false);
    expect(enterSends(false, false, true)).toBe(false);
  });

  it("lives on /mahdi/sheikh only; clearing asks in a sheet, not the browser", () => {
    expect(read("src/components/mahdi/AssistantFloat.tsx")).not.toContain("SheikhChat");
    const chat = read("src/components/mahdi/SheikhChat.tsx");
    expect(chat).not.toContain("window.confirm");
    expect(chat).toContain("<ConfirmSheet");
    expect(chat).toContain('aria-haspopup="menu"');
    expect(chat).toContain("stream: true");
  });

  it("streams with the same model and limits, and a stopped question doesn't count", () => {
    const server = read("src/lib/mahdi/server/sheikh.ts");
    expect(server).toContain('const MODEL = "claude-haiku-5-5"');
    expect(server).toContain("ROUNDS: Record<SheikhMode, number> = { quick: 6, deep: 14 }");
    expect(server).toContain("claudeStream(");
    expect(server).toMatch(/await db\(\)\.delete\(\)\.eq\("id", q\.id\);\s*if \(e instanceof SheikhStopped\) throw e;/);
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

describe("«الشيخ الذكي»: one question at a time", () => {
  const now = Date.parse("2026-11-24T07:00:00Z");
  const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
  const u = (b: string, m: number) => ({ role: "user" as const, body: b, created_at: at(m) });
  const s = (b: string, m: number) => ({ role: "sheikh" as const, body: b, created_at: at(m) });

  it("waits while the newest message is a recent question", () => {
    expect(pendingQuestion([u("أ", 10), s("ج", 9), u("ب", 1)], now)?.body).toBe("ب");
    expect(pendingQuestion([u("أ", 10), s("ج", 9)], now)).toBeNull();
    expect(pendingQuestion([u("ضاع", 30)], now)).toBeNull();
    expect(pendingQuestion([], now)).toBeNull();
  });

  it("reads only questions that got their answer", () => {
    const rows = [u("أ", 10), s("ج أ", 9), u("بلا جواب", 8), u("ب", 7), s("ج ب", 6), u("الحين", 1)];
    expect(answeredHistory(rows).map((r) => r.body)).toEqual(["أ", "ج أ", "ب", "ج ب"]);
  });
});
