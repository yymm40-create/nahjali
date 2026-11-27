import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { VOTE_PERFORMERS, VOTE_POINTS } from "@config/mahdi-vote";
import { cleanVoterName, nameKey } from "@/lib/mahdi/server/vote";
import { rulesFor } from "@/lib/rate-limit";

describe("«تصويت محبوبة الباري»", () => {
  it("has the nine performers, each with a picture on disk and a unique id", () => {
    expect(VOTE_PERFORMERS).toHaveLength(9);
    expect(new Set(VOTE_PERFORMERS.map((p) => p.id)).size).toBe(9);
    for (const p of VOTE_PERFORMERS) expect(existsSync(join(process.cwd(), "public", p.photo)), p.photo).toBe(true);
  });
  it("a radood's vote counts two points, the public's one", () => {
    expect(VOTE_POINTS).toEqual({ public: 1, radood: 2 });
  });
  it("keeps a name as written, refuses an empty name or a link", () => {
    expect(cleanVoterName("  علي   حسن ")).toBe("علي حسن");
    expect(cleanVoterName("")).toBeNull();
    expect(cleanVoterName("   ")).toBeNull();
    expect(cleanVoterName("www.spam.com")).toBeNull();
    expect(cleanVoterName("ا".repeat(41))).toBeNull();
  });
  it("sees the same name however it is spelled", () => {
    expect(nameKey("أحمد  عليّ")).toBe(nameKey("احمد علي"));
    expect(nameKey("فاطمة")).toBe(nameKey("فاطمه"));
    expect(nameKey("حسن")).not.toBe(nameKey("حسين"));
  });
  it("the vote route is limited per address", () => {
    expect(rulesFor("/api/mahdi/vote", "POST").some((r) => r.key === "vote")).toBe(true);
  });
});
