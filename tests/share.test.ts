import { describe, expect, it } from "vitest";
import { cleanHandle, instagramUrl, SHARE, shareSeenKey } from "@config/share";

describe("«انشرنا واربح»", () => {
  it("reads an Instagram name however it is typed, and refuses what can't be one", () => {
    expect(cleanHandle("@Ali.Design")).toBe("ali.design");
    expect(cleanHandle("https://www.instagram.com/ali_99/")).toBe("ali_99");
    expect(cleanHandle("instagram.com/jawad.ai.studio?igsh=x")).toBe("jawad.ai.studio");
    expect(cleanHandle("علي")).toBe("");
    expect(cleanHandle("a b")).toBe("");
    expect(cleanHandle(".dot")).toBe("");
    expect(cleanHandle("x".repeat(31))).toBe("");
    expect(cleanHandle(null)).toBe("");
  });
  it("points at the platform's account and comes back with every version", () => {
    expect(SHARE.account).toBe("jawad.ai.studio");
    expect(instagramUrl("@jawad.ai.studio")).toBe("https://www.instagram.com/jawad.ai.studio/");
    expect(shareSeenKey("abc1234")).not.toBe(shareSeenKey("def5678"));
  });
});
