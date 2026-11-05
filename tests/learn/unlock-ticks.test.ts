import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 6 Nov 2026: ticking «المباشرة» then «المسجلة» quickly in «مكان الدورات» kept only the last tick, because each save
// was built from the course as it was before the previous save came back.
describe("the course's «تفتح لمن اشترى» ticks", () => {
  const src = readFileSync("src/app/admin/learn/LearnAdmin.tsx", "utf8");
  it("are saved one after another, each with the latest set", () => {
    expect(src).toContain("onChange={(e) => toggleUnlock(p, e.target.checked)}");
    expect(src).toContain("unlockChain.current = unlockChain.current.then(");
    expect(src).not.toMatch(/save\(\{ unlock: e\.target\.checked \? \[\.\.\.c\.unlock/);
  });
});
