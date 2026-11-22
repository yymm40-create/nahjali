import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultBookTarget } from "@/lib/mahdi/server/reading-write";

const read = (p: string) => readFileSync(p, "utf8");

describe("a book's own habit («القارئ العلوي» → العادات)", () => {
  it("defaults: the daily reading goal in pages, else 10 pages or 5 narrations", () => {
    expect(defaultBookTarget("page")).toBe(10);
    expect(defaultBookTarget("narration")).toBe(5);
    expect(defaultBookTarget("page", { daily: { metric: "pages", target: 25 }, weekly: null, habitId: null, habitMetric: "minutes" })).toBe(25);
    expect(defaultBookTarget("page", { daily: { metric: "minutes", target: 30 }, weekly: null, habitId: null, habitMetric: "minutes" })).toBe(10);
  });
  it("is made when a book is added, unless turned off", () => {
    expect(read("src/app/api/mahdi/reading/library/route.ts")).toMatch(/body\.habit !== false\) await autoBookHabit/);
    expect(read("src/app/api/mahdi/reading/books/route.ts")).toMatch(/form\.get\("habit"\) !== "0"\) await autoBookHabit/);
  });
  it("is filled by the book's sessions (and emptied when one is deleted), never twice with the reading-goal habit", () => {
    expect(read("src/app/api/mahdi/reading/sessions/route.ts")).toMatch(/bookHabit !== reading\.goals\.habitId\) await addToHabit\(supabase, bookHabit, date, pages, 1\)/);
    expect(read("src/app/api/mahdi/reading/sessions/[id]/route.ts")).toMatch(/addToHabit\(supabase, bookHabit, s\.log_date, s\.pages_count, -1\)/);
  });
  it("isn't counted twice in «تحدي القراءة»", () => {
    const sql = read("supabase/migrations/0125_mahdi_book_habits.sql");
    expect(sql).toContain("add column if not exists habit_id");
    expect(sql).toContain("'book_habit'");
    expect(sql).toMatch(/where not o\.goal_linked and o\.habit_book is null/);
  });
});
