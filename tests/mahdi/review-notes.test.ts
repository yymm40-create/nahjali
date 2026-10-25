import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("«حاسبوا أنفسكم»: the review notes", () => {
  it("are the person's own: RLS on, one policy by user, no service role in the route", () => {
    const sql = read("supabase/migrations/0094_review_notes.sql");
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/);
    expect(sql).toMatch(/check \(kind in \('day', 'week', 'month'\)\)/);
    expect(sql).toMatch(/char_length\(note\) <= 2000/);
    const route = read("src/app/api/mahdi/notes/route.ts");
    expect(route).not.toMatch(/createAdminClient/);
    expect(route).toMatch(/mahdi_review_notes/);
  });
  it("sit on the day, the week and the month, each by its own start", () => {
    expect(read("src/components/mahdi/DayView.tsx")).toMatch(/<ReviewNote kind="day" start=\{date\} \/>/);
    expect(read("src/app/mahdi/(app)/progress/week/WeekReport.tsx")).toMatch(/<ReviewNote kind="week" start=\{ws\} \/>/);
    expect(read("src/app/mahdi/(app)/progress/month/MonthReport.tsx")).toMatch(/<ReviewNote kind="month" start=\{ms\} \/>/);
  });
});
