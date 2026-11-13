import { describe, expect, it } from "vitest";
import { PROOF_FLOOR, roundedDown } from "@/lib/jawad/server/social-proof";

describe("«انصنع في الجواد»: real numbers, never more than happened", () => {
  it("rounds down, to the 50 and from 1,000 to the 100", () => {
    expect(roundedDown(649)).toBe(600);
    expect(roundedDown(650)).toBe(650);
    expect(roundedDown(1299)).toBe(1200);
    expect(roundedDown(100)).toBe(100);
  });
  it("shows nothing below the floor", () => {
    expect(PROOF_FLOOR).toBe(100);
  });
});
