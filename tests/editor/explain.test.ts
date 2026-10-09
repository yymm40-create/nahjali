import { describe, expect, it } from "vitest";
import { explainFailure } from "@/lib/jawad/server/jobs";

describe("why a generation failed, in plain words", () => {
  it("says the AI provider's credit ran out, without naming it", () => {
    expect(explainFailure("smart edit prompt: Claude 400: Your credit balance is too low to access the Anthropic API.", "x")).toMatch(/رصيد مزوّد الذكاء الاصطناعي/);
  });
  it("says the video looked like copyrighted content, with the provider's code", () => {
    const m = explainFailure("OutputVideoSensitiveContentDetected.PolicyViolation The request failed because the output video may be related to copyright restrictions.", "x")!;
    expect(m).toMatch(/حقوق نشر/);
    expect(m).toContain("(OutputVideoSensitiveContentDetected.PolicyViolation)");
  });
  it("tells sound apart from picture", () => {
    expect(explainFailure("OutputAudioSensitiveContentDetected.PolicyViolation ... copyright restrictions", "x")).toMatch(/الصوت الناتج/);
  });
  it("keeps the usual message when nothing is recognised", () => {
    // the provider's own words are never hidden
    expect(explainFailure("something else", "الرسالة")).toBe("الرسالة السبب عند المزوّد: something else");
    expect(explainFailure("failed", "الرسالة")).toBe("الرسالة");
    expect(explainFailure("InputVideoUnsupported the reference video has no audio track", "x")).toMatch(/مقطع الفيديو المرجعي/);
    expect(explainFailure("InvalidParameter.UnsupportedVideo fps must be between 24 and 60", "x")).toMatch(/غير مقبول عنده: InvalidParameter/);
  });

  it("a continuity video the provider calls private information: says so, and points to «كامل» (no video reference), with the code the page looks for", () => {
    const m = explainFailure("ModelArk 400 InputVideoSensitiveContentDetected.PrivacyInformation The request failed because the input video may contain private information. content[1]", "x")!;
    expect(m).toMatch(/مقطع الاستمرارية/);
    expect(m).toContain("كاملًا");
    expect(m).toContain("InputVideoSensitiveContentDetected");
    expect(m).toMatch(/ما انخصم/);
  });
  it("the platform's own overdue account at the provider is never «busy» — and says it is not the person's doing", () => {
    for (const d of ["ModelArk 403 AccountOverdueError: the account has an overdue balance (req 429-17)", "AccountOverdueError"]) {
      const m = explainFailure(d, "x")!;
      expect(m).not.toMatch(/مشغول/);
      expect(m).toMatch(/حساب المنصة/);
      expect(m).toMatch(/أُعيدت لك نقودك/);
    }
    // a real rate limit still is
    expect(explainFailure("429 rate limit exceeded", "x")).toMatch(/مشغول/);
  });
});
