import { describe, expect, it } from "vitest";
import { visitPath } from "@config/stats";
import { rangeStart } from "@/lib/stats";

describe("the owner's statistics", () => {
  it("count the site's pages under one name each, never the dashboard or the API", () => {
    expect(visitPath("/jawad-ai/course?x=1")).toBe("/jawad-ai/course");
    expect(visitPath("/jawad-ai/")).toBe("/jawad-ai");
    expect(visitPath("/play/11111111-1111-1111-1111-111111111111")).toBe("/play");
    expect(visitPath("/jawad-ai/editor/22222222-2222-2222-2222-222222222222")).toBe("/jawad-ai/editor/:id");
    expect(visitPath("/admin/stats")).toBeNull();
    expect(visitPath("/jawad-ai/admin/ads")).toBeNull();
    expect(visitPath("/api/visit")).toBeNull();
    expect(visitPath("https://evil.example/")).toBeNull();
    expect(visitPath(5)).toBeNull();
  });

  it("start «today» at midnight in Riyadh", () => {
    // 10 Oct 2026, 23:30 in Riyadh = 20:30 UTC → today began 9 Oct 21:00 UTC
    expect(rangeStart("today", Date.UTC(2026, 9, 10, 20, 30))).toBe("2026-10-09T21:00:00.000Z");
    // 11 Oct 2026, 01:00 in Riyadh = 10 Oct 22:00 UTC → today began 10 Oct 21:00 UTC
    expect(rangeStart("today", Date.UTC(2026, 9, 10, 22, 0))).toBe("2026-10-10T21:00:00.000Z");
    expect(rangeStart("all")).toBeNull();
  });
});
