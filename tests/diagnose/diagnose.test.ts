import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { allowedPath, codeFiles, forgetCode, hideKeys, listDir, MAX_READ_LINES, readCode, searchCode } from "@/lib/diagnose/code";
import { EMAIL, expectedSchema } from "@/lib/diagnose/state";
import { MAX_ROUNDS, runLooks } from "@/lib/diagnose/platform";

// The owner's 🐞 diagnostician reads the site's own code to find out why something can't be done. It may read source only —
// never a secret — and it must find the tables a missing migration would have created.
beforeEach(() => forgetCode());

describe("reading the site's code", () => {
  it("lists the source folders and the root files, and never env files, node_modules or git", async () => {
    const files = await codeFiles();
    expect(files.length).toBeGreaterThan(500);
    for (const f of ["config/coins.ts", "src/lib/film/anthropic.ts", "supabase/migrations/0045_riyal_pricing.sql", "package.json", "AGENTS.md"]) expect(files).toContain(f);
    expect(files.some((f) => /(^|\/)\.env|node_modules|\.next\/|\.git\//.test(f))).toBe(false);
    expect(files.every((f) => /^(src|config|supabase\/migrations|tests)\//.test(f) || ["AGENTS.md", "CLAUDE.md", "package.json", "next.config.ts"].includes(f))).toBe(true);
  });

  it("refuses paths outside what may be read: parent folders, absolute paths, env files, packages, secrets", async () => {
    for (const p of ["../.env", ".env", ".env.local", "src/../.env", "/etc/passwd", "C:\\Windows\\win.ini", "node_modules/next/package.json", ".git/config", "src/../../etc/passwd", "keys/server.pem", "", null, 42, "src/\0x.ts"]) {
      expect(await allowedPath(p)).toBeNull();
      const r = await readCode(p);
      expect("error" in r).toBe(true);
    }
    expect(await allowedPath("./config/coins.ts")).toBe("config/coins.ts");
    expect(await allowedPath("config\\coins.ts")).toBe("config/coins.ts");
    expect(await listDir("..")).toEqual([]);
    expect(await listDir("/etc")).toEqual([]);
    expect(await listDir(".git")).toEqual([]);
  });

  it("reads numbered lines, at most a page at a time", async () => {
    const r = await readCode("config/coins.ts", 1, 5);
    if ("error" in r) throw new Error(r.error);
    expect(r.path).toBe("config/coins.ts");
    expect(r.from).toBe(1);
    expect(r.to).toBe(5);
    expect(r.text.split("\n")).toHaveLength(5);
    expect(r.text.startsWith("1: ")).toBe(true);
    const big = await readCode("config/jawad/knowledge.ts", 1, 100000);
    if ("error" in big) throw new Error(big.error);
    expect(big.text.split("\n").length).toBeLessThanOrEqual(MAX_READ_LINES);
    const late = await readCode("config/coins.ts", 60, 62);
    if ("error" in late) throw new Error(late.error);
    expect(late.text.startsWith("60: ")).toBe(true);
  });

  it("hides anything that looks like a key in what it returns", () => {
    expect(hideKeys("key sk-abcdefghijklmnopqrstuvwxyz0123 end")).toBe("key [مخفي] end");
    expect(hideKeys("jwt eyJhbGciOiJIUzI1NiJ9abcdef.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fw end")).toBe("jwt [مخفي] end");
    expect(hideKeys("AKIAABCDEFGHIJKLMNOP")).toBe("[مخفي]");
    expect(hideKeys("plain text with no key")).toBe("plain text with no key");
  });

  it("searches by text or /regex/, narrows by path, and puts the tests last", async () => {
    const hits = await searchCode("callClaudeJson");
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.some((h) => h.path === "src/lib/film/anthropic.ts")).toBe(true);
    const narrow = await searchCode("callClaudeJson", { in: "src/lib/diagnose" });
    expect(narrow.length).toBeGreaterThan(0);
    expect(narrow.every((h) => h.path.includes("src/lib/diagnose"))).toBe(true);
    const re = await searchCode("/export const sellHalalas|export function sellHalalas/");
    expect(re.some((h) => h.path === "config/coins.ts")).toBe(true);
    expect(await searchCode("x")).toEqual([]);
    expect(await searchCode("/([unclosed/")).toEqual([]);
    const ranked = await searchCode("sellHalalas", { max: 80 });
    const firstTest = ranked.findIndex((h) => h.path.startsWith("tests/"));
    const lastSrc = ranked.map((h) => h.path.startsWith("tests/")).lastIndexOf(false);
    if (firstTest !== -1) expect(firstTest).toBeGreaterThan(lastSrc);
    expect((await searchCode("e", { max: 3 })).length).toBeLessThanOrEqual(3);
  });

  it("lists one level of a folder", async () => {
    const top = await listDir("");
    for (const d of ["src/", "config/", "supabase/", "tests/"]) expect(top).toContain(d);
    const lib = await listDir("src/lib/diagnose");
    expect(lib).toEqual(expect.arrayContaining(["code.ts", "platform.ts", "state.ts"]));
  });

  it("answers a round of looks: lists, searches and reads, and says what it looked at", async () => {
    const r = await runLooks({ lists: ["src/lib/diagnose"], searches: [{ query: "MAX_ROUNDS", in: "src/lib" }], reads: [{ path: "config/coins.ts", from: 1, to: 3 }, { path: "../.env", from: 1, to: 3 }] });
    expect(r.text).toContain("LIST src/lib/diagnose");
    expect(r.text).toContain("SEARCH \"MAX_ROUNDS\"");
    expect(r.text).toContain("READ config/coins.ts lines 1-3");
    expect(r.text).toMatch(/READ \.\.\/\.env: ملف غير موجود أو غير مسموح/);
    expect(r.looked).toEqual(expect.arrayContaining(["📁 src/lib/diagnose", "🔎 MAX_ROUNDS في src/lib", "📄 config/coins.ts:1-3"]));
    expect(MAX_ROUNDS).toBeGreaterThanOrEqual(4);
    expect((await runLooks({ lists: [], searches: [], reads: [] })).text).toMatch(/answer now/);
  });
});

describe("what the database should have, from the migrations", () => {
  it("finds the tables and the added columns, with the file that makes each", async () => {
    const exp = await expectedSchema();
    const table = (n: string) => exp.tables.find((t) => t.name === n);
    expect(exp.tables.length).toBeGreaterThan(50);
    expect(table("smart_coin_wallets")?.file).toBe("0015_smart_coins.sql");
    expect(table("team_coin_wallets")?.file).toBe("0033_team_coins.sql");
    expect(table("jawad_jobs")?.file).toBe("0017_jawad_ai.sql");
    expect(exp.columns.find((c) => c.table === "site_access" && c.column === "unlimited")?.file).toBe("0045_riyal_pricing.sql");
    expect(exp.columns.find((c) => c.table === "smart_coin_wallets" && c.column === "plan")).toBeTruthy();
  });

  it("reads e-mails in the owner's words", () => {
    expect("ليش x@example.com ما يقدر يدخل؟".match(EMAIL)).toEqual(["x@example.com"]);
    expect("شوف ali.k+1@mail.sa، وبعدين".match(EMAIL)).toEqual(["ali.k+1@mail.sa"]);
    expect("بدون إيميل".match(EMAIL)).toBeNull();
  });
});

describe("shipping the source to the server", () => {
  it("the diagnostician route traces the code folders and the migrations", () => {
    const cfg = readFileSync("next.config.ts", "utf8");
    const line = cfg.split("\n").find((l) => l.includes('"/api/report/diagnose"')) ?? "";
    for (const g of ["./src/**", "./config/**", "./supabase/migrations/*.sql", "./tests/**", "./package.json"]) expect(line).toContain(g);
    expect(line).not.toMatch(/\.env/);
  });
});
