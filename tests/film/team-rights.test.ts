import { describe, expect, it } from "vitest";
import { isTeamStage, rightsText, TEAM_STAGES } from "@/lib/film/team-rights";

describe("«المسلسل الذكي»: a team member's rights", () => {
  it("knows its four steps", () => {
    expect(TEAM_STAGES.map((s) => s.key)).toEqual(["screenwriter", "sheets", "director", "montage"]);
    expect(isTeamStage("sheets")).toBe(true);
    expect(isTeamStage("voices")).toBe(false);
  });
  it("says them in words, with the attempts left", () => {
    expect(rightsText({ stages: ["screenwriter"], maxAttempts: 20, usedAttempts: 7 })).toBe("السيناريست · 13 محاولة باقية من 20");
    expect(rightsText({ stages: null, maxAttempts: null, usedAttempts: 3 })).toBe("كل الخطوات · محاولات بلا حد");
    expect(rightsText({ stages: [], maxAttempts: 2, usedAttempts: 5 })).toBe("ولا خطوة · 0 محاولة باقية من 2");
  });
});
