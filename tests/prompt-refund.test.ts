import { describe, expect, it, vi } from "vitest";

// the database is never reached when the failure was not the platform's account
const from = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));

const { failureText, refundPromptOfFilmJob, refundPromptOfStudioJob } = await import("@/lib/prompt-refund");

describe("رجّع مبلغ كلود", () => {
  it("reads a failure's text from any shape", () => {
    expect(failureText("BalanceNotEnough")).toBe("BalanceNotEnough");
    expect(failureText(new Error("insufficient_quota"))).toContain("insufficient_quota");
    expect(failureText({ userMessage: "رفض", detail: "AccountOverdueError" })).toContain("AccountOverdueError");
    expect(failureText(null)).toBe("");
  });

  it("a content refusal or a busy provider gives no reply back (only the platform's own account does)", async () => {
    await refundPromptOfStudioJob("j1", "OutputVideoSensitiveContentDetected");
    await refundPromptOfFilmJob("j2", "429 rate limit");
    await refundPromptOfFilmJob("j3", "انتهى وقت التوليد قبل ما يكمل");
    expect(from).not.toHaveBeenCalled();
  });
});
