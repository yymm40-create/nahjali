import { describe, expect, it } from "vitest";
import { explainFailure } from "@/lib/jawad/server/jobs";

describe("why a generation failed, in plain words", () => {
  it("says Claude's credit ran out", () => {
    expect(explainFailure("smart edit prompt: Claude 400: Your credit balance is too low to access the Anthropic API.", "x")).toMatch(/رصيد Claude/);
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
    expect(explainFailure("something else", "الرسالة")).toBe("الرسالة");
  });
});
