import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chat = readFileSync("src/components/jawad/content/ContentChat.tsx", "utf8");

describe("محمد باقر keeps the conversation when the wallet runs out", () => {
  it("reopens the conversation of the address or of the last visit", () => {
    expect(chat).toMatch(/get\("chat"\)/);
    expect(chat).toMatch(/store\.get\(OPEN_KEY\)/);
    expect(chat).toMatch(/store\.set\(OPEN_KEY, chatId\)/);
    expect(chat).toMatch(/searchParams\.set\("chat", chatId\)/);
  });

  it("an unanswered message goes back into the box with its files, and the draft is kept", () => {
    expect(chat).toMatch(/setQ\(\(now\) => now \|\| message\)/);
    expect(chat).toMatch(/setPending\(\(now\) => \(now\.length \? now : files\)\)/);
    expect(chat).toMatch(/store\.set\(draftKey\(chatId\)/);
  });
});
