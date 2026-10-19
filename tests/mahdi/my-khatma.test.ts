// «الختمة العلوية» · «ختمتي»: the person's own khatma — the pace, where to go on, the habit it fills, and the server's
// rules on the in-memory database.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dailyCount, dailyQuarters, habitValueAfter, juzOf, khatmaStats, nextPortion, nextQuarter, quartersText, unitText } from "@/lib/mahdi/khatma/mine";
import { linkHabit, loadMyKhatma, readQuarters, startMyKhatma, stopMyKhatma, unreadQuarter, updateMyKhatma } from "@/lib/mahdi/server/my-khatma";
import { homeWidgets, parseWidgets, WIDGETS } from "@/lib/mahdi/home-widgets";
import { MAHDI_FEATURES } from "@config/mahdi/app-knowledge";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { fakeDb } from "./fake-db";

const read = (p: string) => readFileSync(p, "utf8");

describe("the pace", () => {
  it("a juz a day for a month, a quarter a day for 240 days, rounded up", () => {
    expect(dailyQuarters(30)).toBe(8);
    expect(dailyQuarters(60)).toBe(4);
    expect(dailyQuarters(7)).toBe(35);
    expect(dailyQuarters(240)).toBe(1);
    expect(dailyQuarters(365)).toBe(1);
  });
  it("speaks of quarters as readers do", () => {
    expect(quartersText(8)).toBe("جزء");
    expect(quartersText(16)).toBe("جزءان");
    expect(quartersText(24)).toBe("3 أجزاء");
    expect(quartersText(4)).toBe("حزب");
    expect(quartersText(12)).toBe("3 أحزاب");
    expect(quartersText(2)).toBe("نصف حزب");
    expect(quartersText(1)).toBe("ربع حزب");
    expect(quartersText(35)).toBe("35 أرباع");
    expect(juzOf(8)).toBe(1);
    expect(juzOf(9)).toBe(2);
    expect(juzOf(240)).toBe(30);
  });
});

describe("where to go on", () => {
  it("after the furthest quarter read; then the gaps; null when all are read", () => {
    expect(nextQuarter([])).toBe(1);
    expect(nextQuarter([1, 2, 3])).toBe(4);
    expect(nextQuarter([1, 2, 10])).toBe(11);
    expect(nextQuarter([...Array.from({ length: 239 }, (_, i) => i + 2)])).toBe(1);
    expect(nextQuarter(Array.from({ length: 240 }, (_, i) => i + 1))).toBeNull();
  });
  it("today's portion, behind or ahead of the plan, and the days in a row", () => {
    const reads = [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((quarter) => ({ quarter, readOn: "2026-10-17" })),
      ...[9, 10, 11, 12, 13, 14, 15, 16].map((quarter) => ({ quarter, readOn: "2026-10-18" })),
      ...[17, 18, 19].map((quarter) => ({ quarter, readOn: "2026-10-19" })),
    ];
    const s = khatmaStats(reads, "2026-10-17", 30, "2026-10-19");
    expect(s).toMatchObject({ perDay: 8, read: 19, left: 221, todayCount: 3, todayLeft: 5, dayNo: 3, expected: 24, behind: 5, ahead: 0, streak: 3, next: 20, finishBy: "2026-11-15" });
    // nothing yet today: yesterday's run still counts
    expect(khatmaStats(reads.slice(0, 16), "2026-10-17", 30, "2026-10-19").streak).toBe(2);
    expect(khatmaStats(reads.slice(0, 16), "2026-10-17", 30, "2026-10-20").streak).toBe(0);
    expect(khatmaStats(reads, "2026-10-17", 60, "2026-10-19")).toMatchObject({ perDay: 4, expected: 12, ahead: 7, behind: 0 });
  });
  it("the linked habit: done/not-done becomes done, a counted one moves by the quarters", () => {
    expect(habitValueAfter("check", 0, 2)).toBe(1);
    expect(habitValueAfter("check", 1, -1)).toBe(1);
    expect(habitValueAfter("count", 3, 2)).toBe(5);
    expect(habitValueAfter("count", 1, -1)).toBe(0);
    expect(habitValueAfter("amount", 0, -1)).toBe(0);
  });
});

describe("«ختمتي» on the server", () => {
  const ME = "me";
  it("start, read, take back, finish, and the next khatma keeps the habit", async () => {
    const { db, tables } = fakeDb();
    expect(await loadMyKhatma(db, ME)).toMatchObject({ ready: true, current: null, history: [] });
    await expect(readQuarters(db, ME, "2026-10-19", [1])).rejects.toThrow(/ما عندك ختمة مفتوحة/);
    await startMyKhatma(db, ME, "2026-10-19", { days: 30, unit: "quarter", range: { from: 1, to: 240 }, dedicatedTo: "صاحب العصر والزمان عجل الله فرجه", forSoulOf: "" });
    await expect(startMyKhatma(db, ME, "2026-10-19", { days: 30, unit: "quarter", range: { from: 1, to: 240 }, dedicatedTo: "", forSoulOf: "" })).rejects.toThrow(/عندك ختمة مفتوحة/);
    await linkHabit(db, ME, "habit-1");

    expect(await readQuarters(db, ME, "2026-10-19", [1, 2, 3])).toEqual({ added: [1, 2, 3], finished: false });
    // read again: nothing new for the habit
    expect(await readQuarters(db, ME, "2026-10-20", [3, 4])).toEqual({ added: [4], finished: false });
    expect(await unreadQuarter(db, ME, 2)).toEqual({ readOn: "2026-10-19" });
    expect(await unreadQuarter(db, ME, 2)).toEqual({ readOn: null });
    let mine = await loadMyKhatma(db, ME);
    expect(mine.ready && mine.current).toMatchObject({ number: 1, days: 30, status: "open", habitId: "habit-1", dedicatedTo: "صاحب العصر والزمان عجل الله فرجه" });
    expect(mine.ready && mine.current!.reads).toEqual([
      { quarter: 1, readOn: "2026-10-19" },
      { quarter: 3, readOn: "2026-10-19" },
      { quarter: 4, readOn: "2026-10-20" },
    ]);
    await updateMyKhatma(db, ME, "2026-10-21", { days: 60, forSoulOf: "المرحوم الحاج علي" });

    const rest = Array.from({ length: 240 }, (_, i) => i + 1).filter((q) => ![1, 3, 4].includes(q));
    expect(await readQuarters(db, ME, "2026-11-01", rest)).toMatchObject({ finished: true });
    mine = await loadMyKhatma(db, ME);
    expect(mine.ready && mine.current).toMatchObject({ status: "done", finishedOn: "2026-11-01", days: 60, forSoulOf: "المرحوم الحاج علي" });
    await expect(readQuarters(db, ME, "2026-11-01", [1])).rejects.toThrow();

    await startMyKhatma(db, ME, "2026-11-02", { days: 30, unit: "quarter", range: { from: 1, to: 240 }, dedicatedTo: "", forSoulOf: "" });
    mine = await loadMyKhatma(db, ME);
    expect(mine.ready && mine.current).toMatchObject({ number: 2, status: "open", habitId: "habit-1", startedOn: "2026-11-02" });
    expect(mine.ready && mine.current!.reads).toEqual([]);
    expect(mine.ready && mine.history.map((h) => [h.number, h.status])).toEqual([[1, "done"]]);
    // someone else's khatma is not mine
    expect(await loadMyKhatma(db, "other")).toMatchObject({ current: null });
    expect(tables.mahdi_my_khatma_reads.filter((r) => r.user_id !== ME)).toEqual([]);
  });
  it("ending a khatma before it is finished keeps what was read in it", async () => {
    const { db } = fakeDb();
    await startMyKhatma(db, ME, "2026-10-19", { days: 10, unit: "quarter", range: { from: 1, to: 240 }, dedicatedTo: "", forSoulOf: "" });
    await readQuarters(db, ME, "2026-10-19", [1, 2]);
    await stopMyKhatma(db, ME, "2026-10-20");
    const mine = await loadMyKhatma(db, ME);
    expect(mine.ready && mine.current).toMatchObject({ status: "stopped", finishedOn: "2026-10-20" });
    expect(mine.ready && mine.current!.reads).toHaveLength(2);
    await expect(unreadQuarter(db, ME, 1)).rejects.toThrow();
  });
});

describe("a part of the Quran, not only a whole khatma", () => {
  const ME = "me";
  it("pages 1–20 in 5 days: 4 pages a day, and where to go on stays inside the stretch", () => {
    expect(dailyCount(20, 5)).toBe(4);
    expect(unitText("page", 4)).toBe("4 صفحات");
    expect(unitText("juz", 1)).toBe("جزء");
    expect(nextPortion([], { from: 5, to: 9 })).toBe(5);
    expect(nextPortion([5, 6, 7], { from: 5, to: 9 })).toBe(8);
    expect(nextPortion([5, 6, 7, 8, 9, 30], { from: 5, to: 9 })).toBeNull();
    const s = khatmaStats([{ quarter: 1, readOn: "2026-10-19" }, { quarter: 50, readOn: "2026-10-19" }], "2026-10-19", 5, "2026-10-19", { from: 1, to: 20 });
    expect(s).toMatchObject({ total: 20, perDay: 4, read: 1, todayCount: 1, next: 2 });
  });
  it("on the server: juz 28–30; outside it refused; the cut stays once reading started, the stretch may change; done when it is all read", async () => {
    const { db } = fakeDb();
    await startMyKhatma(db, ME, "2026-10-19", { days: 3, unit: "juz", range: { from: 28, to: 30 }, dedicatedTo: "", forSoulOf: "" });
    await expect(readQuarters(db, ME, "2026-10-19", [27])).rejects.toThrow(/خارج/);
    await readQuarters(db, ME, "2026-10-19", [28]);
    await expect(updateMyKhatma(db, ME, "2026-10-19", { unit: "page", range: { from: 1, to: 604 } })).rejects.toThrow(/ما يتغير تقسيمها/);
    // the stretch itself may change: down to juz 28–29…
    await updateMyKhatma(db, ME, "2026-10-19", { range: { from: 28, to: 29 } });
    let mine = await loadMyKhatma(db, ME);
    expect(mine.ready && mine.current).toMatchObject({ unit: "juz", range: { from: 28, to: 29 }, status: "open" });
    expect(await readQuarters(db, ME, "2026-10-20", [29])).toMatchObject({ finished: true });
    mine = await loadMyKhatma(db, ME);
    expect(mine.ready && mine.current).toMatchObject({ status: "done", finishedOn: "2026-10-20" });
  });
  it("before reading, the cut may change too", async () => {
    const { db } = fakeDb();
    await startMyKhatma(db, ME, "2026-10-19", { days: 30, unit: "quarter", range: { from: 1, to: 240 }, dedicatedTo: "", forSoulOf: "" });
    await updateMyKhatma(db, ME, "2026-10-19", { unit: "page", range: { from: 1, to: 50 } });
    const mine = await loadMyKhatma(db, ME);
    expect(mine.ready && mine.current).toMatchObject({ unit: "page", range: { from: 1, to: 50 } });
  });
});

describe("it is a main branch, tied to the habits", () => {
  it("its own page, reader, home card and menu entry; the habit link goes through the app's own log queue", () => {
    expect(read("src/components/mahdi/khatma/KhatmaTabs.tsx")).toContain("ختمتي");
    expect(read("src/app/mahdi/(app)/khatma/layout.tsx")).toContain("<KhatmaTabs />");
    expect(read("src/app/mahdi/(app)/khatma/read/[q]/page.tsx")).toContain("قرأته ✓ والتالي");
    expect(read("src/components/mahdi/khatma/useMyKhatma.ts")).toContain("store.setLog(");
    expect(read("src/app/api/mahdi/khatma/mine/route.ts")).toContain('p_name: "ورد الختمة العلوية"');
    expect(WIDGETS.some((w) => w.id === "khatma")).toBe(true);
    expect(parseWidgets(["khatma", "habits"])).toEqual(["khatma", "habits"]);
    // the standard home is unchanged; the card is added by the person («رتّب»)
    expect(homeWidgets(null)).not.toContain("khatma");
    expect(read("src/components/mahdi/HomeBoard.tsx")).toContain("<KhatmaCard />");
    expect(read("src/app/mahdi/(app)/more/page.tsx")).toContain("<KhatmaCard />");
  });
  it("the database and the knowledge", () => {
    const sql = read("supabase/migrations/0081_mahdi_my_khatma.sql");
    expect(sql).toContain("primary key (khatma_id, quarter)");
    expect(sql).toContain("unique (user_id, number)");
    expect(sql).toContain("references public.mahdi_habits (id) on delete set null");
    expect(sql).toMatch(/revoke all on public\.mahdi_my_khatmas, public\.mahdi_my_khatma_reads from anon, authenticated/);
    expect(MAHDI_FEATURES.find((f) => f.id === "khatma")!.how.join(" ")).toContain("ورد الختمة العلوية");
    const parts = read("supabase/migrations/0082_mahdi_khatma_parts.sql");
    for (const x of ["'page', 'juz', 'hizb', 'half', 'quarter'", "range_from", "from_v", "portion between 1 and 604", "quarter between 1 and 604"]) expect(parts).toContain(x);
    expect(MAHDI_FEATURES.find((f) => f.id === "khatma")!.how.join(" ")).toContain("مو شرط ختمة كاملة");
    expect(JAWAD_KNOWLEDGE).toContain("«ختمتي»");
  });
});
