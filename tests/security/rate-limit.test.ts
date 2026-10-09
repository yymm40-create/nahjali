import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, resetLimits, rulesFor, take } from "@/lib/rate-limit";

describe("حدّ الطلبات", () => {
  beforeEach(resetLimits);
  it("never limits the pages, the timers or the webhooks", () => {
    expect(rulesFor("/jawad-ai/film", "GET")).toEqual([]);
    expect(rulesFor("/api/cron/cleanup", "GET")).toEqual([]);
    expect(rulesFor("/api/mahdi/notifications/dispatch", "POST")).toEqual([]);
    // Telegram calls the course's bot webhook from its own servers
    expect(rulesFor("/api/course/telegram", "POST")).toEqual([]);
  });
  it("keeps the course's payment steps to a few presses (each one can buzz the owner's phone)", () => {
    expect(rulesFor("/api/course/order", "POST").map((r) => r.key)).toEqual(["course", "api"]);
    expect(rulesFor("/api/course/transferred", "POST").map((r) => r.key)).toEqual(["course", "api"]);
    const rules = rulesFor("/api/course/transferred", "POST");
    for (let i = 0; i < 20; i++) expect(take("9.9.9.9", rules, 0)).toBe(0);
    expect(take("9.9.9.9", rules, 1000)).toBeGreaterThan(0);
  });
  it("guards the secret codes hardest, then what costs money, then everything", () => {
    expect(rulesFor("/api/access/code", "POST").map((r) => r.key)).toEqual(["code", "api"]);
    expect(rulesFor("/api/film/projects/x/script", "POST").map((r) => r.key)).toEqual(["paid", "api"]);
    expect(rulesFor("/api/film/projects/x/progress", "GET").map((r) => r.key)).toEqual(["api"]);
    // the parts of a big upload are signed one by one: only the general wall
    expect(rulesFor("/api/jawad/editor/projects/x", "POST").map((r) => r.key)).toEqual(["api"]);
  });
  it("lets 8 code tries through, refuses the 9th with the wait, and counts each address apart", () => {
    const rules = rulesFor("/api/access/code", "POST");
    for (let i = 0; i < 8; i++) expect(take("1.1.1.1", rules, 0)).toBe(0);
    expect(take("1.1.1.1", rules, 1000)).toBe(599);
    expect(take("2.2.2.2", rules, 1000)).toBe(0);
    // the window over: allowed again
    expect(take("1.1.1.1", rules, 10 * 60_000 + 1)).toBe(0);
  });
  it("reads the caller's address from Vercel's header", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
