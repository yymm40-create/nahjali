// «قنبر» builds nothing until the person has seen what it will take from their wallet and confirmed it.
import { describe, expect, it } from "vitest";
import { writingUsd } from "@/lib/games/build";
import { GAMES_PLATFORM_RULES } from "@config/games";
import { GAME_BUILD } from "@config/games-build";
import { findClaudeModel } from "@config/claude-models";

describe("what a game costs before it is built", () => {
  const model = findClaudeModel(GAME_BUILD.model)!;

  it("the writing: the usual cost, and a ceiling that covers a continuation and a fix more", () => {
    const w = writingUsd(model);
    expect(w.typical).toBeGreaterThan(0);
    expect(w.max).toBeGreaterThan(w.typical);
    // the usual game is a few tenths of a dollar or less on the model that writes it, never pennies and never dollars
    expect(w.typical).toBeGreaterThan(0.05);
    expect(w.typical).toBeLessThan(2);
    // a change to a finished game is one rewrite of the code: dearer than nothing, cheaper than building it all
    expect(w.edit.typical).toBeGreaterThan(0);
    expect(w.edit.typical).toBeLessThan(w.typical);
    expect(w.edit.max).toBeGreaterThan(w.edit.typical);
  });

  it("follows the model's own rates", () => {
    const dear = findClaudeModel("claude-opus-5-5");
    const cheap = findClaudeModel("claude-haiku-5-5");
    if (dear && cheap) expect(writingUsd(dear).typical).toBeGreaterThan(writingUsd(cheap).typical);
  });

  it("«قنبر» is told to start nothing before the confirmation, and never to quote prices himself", () => {
    expect(GAMES_PLATFORM_RULES).toContain("لا تبدأ البناء ولا تقل إنه بدأ");
    expect(GAMES_PLATFORM_RULES).toContain("ثم يؤكد في نافذة التكلفة");
    expect(GAMES_PLATFORM_RULES).toContain("ولا تذكر أنت أرقام أسعار من عندك");
  });
});
