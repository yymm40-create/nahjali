// «الغلط علينا»: a robot's turn in which something failed because of the PLATFORM's own account at a provider (balance,
// billing, key) costs the person nothing — not the picture, and not the robot's reply either.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPlatformFault, isSoftFault, nextSoft, reportFailure, reportFinalFailure, SOFT_RULE, watchTurn } from "@/lib/platform-fault";
import { ProviderError } from "@/lib/jawad/server/providers/common";

const read = (p: string) => readFileSync(p, "utf8");

describe("which failures are the platform's own account", () => {
  it.each([
    "Claude 400: Your credit balance is too low to access the Anthropic API.",
    "429 insufficient_quota You exceeded your current quota, please check your plan and billing details.",
    "400 billing_hard_limit_reached Billing hard limit has been reached",
    "401 invalid_api_key Incorrect API key provided",
    "fal fal-ai/x submit 403 User is locked. Reason: Exhausted balance.",
    "AccountOverdueError: The request failed because your account has an overdue balance.",
    "quota_exceeded: You have 0 credits remaining",
    "ANTHROPIC_API_KEY is not set",
    "FAL_KEY missing",
  ])("ours: %s", (t) => expect(isPlatformFault(t)).toBe(true));

  it.each([
    "400 moderation_blocked Your request was rejected by the safety system",
    "InputTextSensitiveContentDetected",
    "Claude 529: Overloaded",
    "timeout",
    "رفض المزوّد الطلب لأنه قد يخالف سياسة المحتوى",
    "",
  ])("the person's request or a passing hiccup: %s", (t) => expect(isPlatformFault(t)).toBe(false));
});

describe("the soft kind: a content refusal or a busy provider", () => {
  it.each(["InputTextSensitiveContentDetected", "400 moderation_blocked Your request was rejected by the safety system", "Claude 529: Overloaded", "429 rate_limit_exceeded", "ServiceUnavailable", "رفض المزوّد الطلب لأنه قد يخالف سياسة المحتوى"])("soft: %s", (t) => expect(isSoftFault(t)).toBe(true));
  it.each(["429 insufficient_quota You exceeded your current quota", "Claude 400: prompt is too long", "timeout", ""])("not soft: %s", (t) => expect(isSoftFault(t)).toBe(false));

  it("the first three spoiled turns in a row are ours, the fourth is charged; a pause long enough starts again", () => {
    expect(SOFT_RULE.free).toBe(3);
    const t0 = 1_000_000;
    let s = nextSoft(null, t0);
    expect([s.count, s.ours]).toEqual([1, true]);
    s = nextSoft(s, t0 + 60_000);
    expect([s.count, s.ours]).toEqual([2, true]);
    s = nextSoft(s, t0 + 120_000);
    expect([s.count, s.ours]).toEqual([3, true]);
    s = nextSoft(s, t0 + 180_000);
    expect([s.count, s.ours]).toEqual([4, false]);
    expect(nextSoft(s, t0 + 180_000 + SOFT_RULE.withinMs + 1)).toMatchObject({ count: 1, ours: true });
  });
});

describe("the turn's watch", () => {
  it("a failure of the platform's account anywhere inside marks the turn, and the turns around it", async () => {
    const outer = await watchTurn(async () => {
      const inner = await watchTurn(async () => {
        try {
          throw new ProviderError("rejected", "تعذّر الاتصال بالمزوّد حاليًا (إعدادات الحساب). أبلغنا بالمشكلة.", "401 invalid_api_key");
        } catch {
          return "picture failed";
        }
      });
      expect(inner.ours).toBe(true);
      return inner.out;
    });
    expect(outer.out).toBe("picture failed");
    expect(outer.ours).toBe(true);
  });

  it("a content refusal or a busy provider is the soft kind — only once it failed for good, never while a retry may go through", async () => {
    const t = await watchTurn(async () => {
      reportFailure("400 moderation_blocked"); // a provider's error on the way: not counted
      return 1;
    });
    expect(t.ours).toBe(false);
    expect(t.soft).toBe(false);
    const f = await watchTurn(async () => {
      reportFinalFailure("InputTextSensitiveContentDetected");
      return 1;
    });
    expect(f.soft).toBe(true);
    expect(f.ours).toBe(false);
    const both = await watchTurn(async () => {
      reportFinalFailure("Claude 529: Overloaded");
      reportFinalFailure("429 insufficient_quota");
      return 1;
    });
    expect(both.ours).toBe(true);
    expect(() => reportFailure("insufficient_quota")).not.toThrow();
  });

  it("is wired: the robot's turn waives its bill, and every provider failure reports", () => {
    const turn = read("src/lib/claude-run.ts");
    expect(turn).toContain("watchTurn(");
    expect(turn).toContain("await bill.waive(out.usd)");
    expect(read("src/lib/coins.ts")).toContain("waive: async (usd: number)");
    expect(read("src/lib/jawad/server/providers/common.ts")).toContain("reportFailure(detail, userMessage)");
    expect(read("src/lib/jawad/server/jobs.ts")).toContain('if (status === "failed") reportFinalFailure(o.detail, o.message)');
    expect(read("src/lib/film/anthropic.ts").match(/reportFinalFailure\(/g)?.length).toBe(2);
    expect(turn).toContain("softTurnIsOurs(user.id)");
    expect(turn).toContain("clearSoftStreak(user.id)");
  });
});
