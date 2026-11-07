// «الغلط علينا»: a robot's turn in which something failed because of the PLATFORM's own account at a provider (balance,
// billing, key) costs the person nothing — not the picture, and not the robot's reply either.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPlatformFault, reportFailure, watchTurn } from "@/lib/platform-fault";
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

  it("the person's own refusal leaves the turn paid as usual, and nothing outside a turn is touched", async () => {
    const t = await watchTurn(async () => {
      reportFailure("400 moderation_blocked");
      return 1;
    });
    expect(t.ours).toBe(false);
    expect(() => reportFailure("insufficient_quota")).not.toThrow();
  });

  it("is wired: the robot's turn waives its bill, and every provider failure reports", () => {
    const turn = read("src/lib/claude-run.ts");
    expect(turn).toContain("watchTurn(");
    expect(turn).toContain("await bill.waive(out.usd)");
    expect(read("src/lib/coins.ts")).toContain("waive: async (usd: number)");
    expect(read("src/lib/jawad/server/providers/common.ts")).toContain("reportFailure(detail, userMessage)");
    expect(read("src/lib/jawad/server/jobs.ts")).toContain('if (status === "failed") reportFailure(o.detail, o.message)');
    expect(read("src/lib/film/anthropic.ts").match(/reportFailure\(/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
