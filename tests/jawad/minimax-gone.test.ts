import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATORS } from "@config/jawad/generators";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
});

describe("MiniMax is gone from the site (the owner, 1 November 2026)", () => {
  it("has no generator, no provider file and no call to MiniMax anywhere", () => {
    expect(GENERATORS.some((g) => /minimax/i.test(g.id) || /minimax/i.test(g.provider.id))).toBe(false);
    expect(existsSync("src/lib/jawad/server/providers/minimax.ts")).toBe(false);
    const hits = [...files("src"), ...files("config")].filter((f) => /minimaxSpeech|minimaxCloneVoice|minimaxDesignVoice|MINIMAX_READY_VOICES|fal-ai\/minimax|minimax-speech-2-8/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
  it("old MiniMax voices are never listed or spoken, and Claude knows it was removed", () => {
    const v = readFileSync("src/lib/jawad/server/voices.ts", "utf8");
    expect(v).toContain('.neq("provider", "minimax")');
    expect(v).toContain('data.provider === "minimax"');
    expect(JAWAD_KNOWLEDGE).toContain("MINIMAX IS GONE");
  });
});
