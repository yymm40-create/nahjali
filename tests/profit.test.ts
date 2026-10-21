import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estimateCost } from "@/lib/profit";

const read = (p: string) => readFileSync(p, "utf8");

describe("«صافي الربح»", () => {
  it("estimates an older operation's cost from what was charged, at its kind's margin of that time", () => {
    // before 21 October 2026: Claude 10٪, pictures 60٪, videos 40٪, the rest 30٪
    expect(estimateCost(110, "محادثة جواد", "2026-10-10T10:00:00Z")).toBeCloseTo(100, 6);
    expect(estimateCost(160, "صناعة الصور", "2026-10-10T10:00:00Z")).toBeCloseTo(100, 6);
    expect(estimateCost(140, "صناعة الفيديو", "2026-10-10T10:00:00Z")).toBeCloseTo(100, 6);
    // from 21 October 2026: Claude 40٪, GPT Image 2 30٪, videos and the rest 40٪
    expect(estimateCost(140, "محادثة جواد", "2026-10-21T10:00:00Z")).toBeCloseTo(100, 6);
    expect(estimateCost(130, "صناعة الصور", "2026-10-22T10:00:00Z")).toBeCloseTo(100, 6);
    expect(estimateCost(140, "أخرى", "2026-10-22T10:00:00Z")).toBeCloseTo(100, 6);
  });

  it("writes every operation's real cost where it is charged", () => {
    const coins = read("src/lib/coins.ts");
    // the robots' replies and «حيدرا ماكس» (paid and free), jobs paid after use, settled jobs
    expect(coins.match(/await logCost\(who\.id, ref, label, usd\)/g)?.length).toBe(2);
    expect(coins).toContain("await logCost(userId, jobId, label, costUsd)");
    expect(coins).toContain("await logCost(r.userId, jobId, r.label, costUsd)");
    expect(read("src/lib/editor/pricing.ts")).toContain("await logCostHalalas(who.id, ref, label, cost)");
    expect(read("src/lib/tables-booklet/server.ts")).toContain("await logCost(user.id, `booklet:");
    expect(read("supabase/migrations/0090_site_costs.sql")).toContain("create table if not exists public.site_costs");
  });

  it("is in the dashboard's menus and its unified panel", () => {
    expect(read("src/app/admin/AdminNav.tsx")).toContain('"/admin/profit"');
    expect(read("src/components/jawad/admin/AdminNav.tsx")).toContain('"/jawad-ai/admin/profit"');
    expect(read("src/app/jawad-ai/admin/[panel]/page.tsx")).toContain('case "profit"');
  });
});
