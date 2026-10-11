import { describe, expect, it } from "vitest";
import { PICK_COOKIE, readPickValue, resolveTheme, writePickValue } from "@/lib/mahdi/look-pick";

// «الستايل اللي اخترته يبقى لك»: the device copy of a pick, and when it wins over the account's look.

describe("the picked style", () => {
  it("round-trips through the cookie value", () => {
    const v = writePickValue({ user: "u1", pick: "bento", saw: "minimal" });
    expect(readPickValue(encodeURIComponent(v))).toEqual({ user: "u1", pick: "bento", saw: "minimal" });
    expect(PICK_COOKIE).toBe("mahdi-look");
  });
  it("ignores anything that is not ours", () => {
    for (const bad of [undefined, null, "", "x", "u1.bento", "u1.nope.minimal", "u1.bento.nope", "a.b.c.d"]) expect(readPickValue(bad as string)).toBeNull();
  });
  it("the pick wins while the account still holds what it held then", () => {
    const raw = encodeURIComponent(writePickValue({ user: "u1", pick: "bento", saw: "minimal" }));
    expect(resolveTheme("minimal", "u1", raw)).toBe("bento");
  });
  it("the account wins once it changed (another device, a reward), or for another person", () => {
    const raw = encodeURIComponent(writePickValue({ user: "u1", pick: "bento", saw: "minimal" }));
    expect(resolveTheme("neon", "u1", raw)).toBe("neon");
    expect(resolveTheme("minimal", "u2", raw)).toBe("minimal");
    expect(resolveTheme("minimal", null, raw)).toBe("minimal");
    expect(resolveTheme("minimal", "u1", undefined)).toBe("minimal");
  });
});
