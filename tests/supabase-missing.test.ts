import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("scripts/supabase-missing.mjs", () => {
  const out = execFileSync("node", ["scripts/supabase-missing.mjs"], { encoding: "utf8" });
  it("names every migration: checked in the query, or listed as not checkable", () => {
    for (const f of readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql"))) expect(out).toContain(f);
  });
  it("only reads: no statement that changes the database", () => {
    const body = out.replace(/--[^\n]*/g, "").toLowerCase();
    for (const w of ["insert ", "update ", "delete ", "drop ", "alter ", "create ", "grant ", "revoke "]) expect(body.includes(w)).toBe(false);
  });
});
