import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bookProgress, readingSummary, readingTotals, type ReadingSession } from "@/lib/mahdi/engine";

const s = (o: Partial<ReadingSession>): ReadingSession => ({ id: Math.random().toString(36), bookId: "b", unit: "page", date: "2026-11-21", seconds: 0, ranges: [], pages: 0, note: "", ...o });
const read = (p: string) => readFileSync(p, "utf8");

describe("pages read before («earlier»)", () => {
  const sessions = [s({ ranges: [[1, 200]], pages: 200, earlier: true }), s({ ranges: [[201, 220]], pages: 20 })];
  it("never count as today's reading", () => {
    expect(readingTotals(sessions, "2026-11-21", "2026-11-21").pages).toBe(20);
    expect(readingSummary([s({ ranges: [[1, 50]], pages: 50, earlier: true })], "2026-11-21", 6).today.pages).toBe(0);
  });
  it("still fill the book's page map", () => {
    expect(bookProgress(sessions, 300).readPages).toBe(220);
  });
  it("are kept apart by the server and the challenge", () => {
    const sql = read("supabase/migrations/0121_mahdi_read_challenge_fix.sql");
    expect(sql).toContain("add column if not exists earlier boolean");
    expect(sql).toMatch(/not s\.earlier and b\.unit = 'page'/);
    // what was missing now counts
    expect(sql).toContain("mahdi_group_habit_logs");
    expect(sql).toContain("mahdi_challenge_logs");
    expect(sql).toContain("goal_habit");
    expect(read("src/app/api/mahdi/reading/sessions/route.ts")).toMatch(/if \(!earlier\) \{\s*await applyToHabit/);
  });
  it("the breakdown: mine for everyone, anyone's for the owner", () => {
    const api = read("src/app/api/mahdi/read-challenge/route.ts");
    expect(api).toContain('detail === "me"');
    expect(api).toMatch(/who !== user\.id && \(!owner/);
  });
});

describe("a page of a book counts once (SQL 0122)", () => {
  it("only the first session that saved a page counts it", () => {
    const sql = read("supabase/migrations/0122_mahdi_read_challenge_new_pages.sql");
    expect(sql).toContain("distinct on (user_id, book_id, page)");
    expect(sql).toContain("'repeat'");
    // works without the group tables (0083) too
    expect(sql).toContain("to_regclass('public.mahdi_group_habit_logs')");
  });
});

describe("warning before saving pages already in the book", () => {
  it("counts new and repeated pages against the book's map", async () => {
    const { newPages } = await import("@/lib/mahdi/engine");
    // Ahmed's case: pages 7–296 already there, then 9–166 again
    expect(newPages([[9, 166]], [[7, 296]])).toEqual({ fresh: 0, repeated: 158 });
    expect(newPages([[290, 310]], [[7, 296]])).toEqual({ fresh: 14, repeated: 7 });
    expect(newPages([[1, 10]], [])).toEqual({ fresh: 10, repeated: 0 });
  });
  it("both saving screens ask before saving only repeated pages", () => {
    for (const f of ["src/app/mahdi/(app)/reading/session/page.tsx", "src/app/mahdi/(app)/reading/book/[id]/page.tsx"]) {
      const src = read(f);
      expect(src).toContain("newPages(");
      expect(src).toContain("t.reading.repeat.saveAnyway");
    }
  });
  it("the owner sees who to look at", () => {
    expect(read("src/app/api/mahdi/read-challenge/route.ts")).toContain("readChallengeFlags");
  });
});
