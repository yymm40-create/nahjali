import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CDN_PAGES, cdnCacheable, hasAuthCookie } from "@/lib/cdn-cache";

const req = (o: Partial<{ method: string; path: string; search: string; cookies: string[]; headers: Record<string, string> }> = {}) => ({
  method: o.method ?? "GET",
  path: o.path ?? "/jawad-ai",
  search: o.search ?? "",
  cookieNames: o.cookies ?? [],
  header: (n: string) => o.headers?.[n] ?? null,
});

describe("the CDN keeps public pages only for visitors who have not signed in", () => {
  it("a plain visit to a public page is kept", () => {
    for (const path of CDN_PAGES) expect(cdnCacheable(req({ path }))).toBe(true);
    // other cookies (a theme, a language) do not make the page personal
    expect(cdnCacheable(req({ cookies: ["jw-layout", "theme"] }))).toBe(true);
  });
  it("never with a sign-in cookie, even a chunked or stale one", () => {
    expect(hasAuthCookie(["sb-abcd-auth-token"])).toBe(true);
    expect(hasAuthCookie(["sb-abcd-auth-token.0"])).toBe(true);
    expect(hasAuthCookie(["sb-abcd-auth-token-code-verifier"])).toBe(true);
    expect(cdnCacheable(req({ cookies: ["sb-abcd-auth-token.0"] }))).toBe(false);
  });
  it("not a query, a form, another page, or the router's data requests", () => {
    expect(cdnCacheable(req({ search: "?next=/jawad-ai/film" }))).toBe(false);
    expect(cdnCacheable(req({ method: "POST" }))).toBe(false);
    expect(cdnCacheable(req({ path: "/jawad-ai/film" }))).toBe(false);
    expect(cdnCacheable(req({ path: "/jawad-ai/admin" }))).toBe(false);
    expect(cdnCacheable(req({ path: "/mahdi" }))).toBe(false);
    expect(cdnCacheable(req({ headers: { rsc: "1" } }))).toBe(false);
    expect(cdnCacheable(req({ headers: { "next-router-prefetch": "1" } }))).toBe(false);
  });
  it("only pages with nothing personal in them are on the list", () => {
    expect([...CDN_PAGES].sort()).toEqual(["/jawad-ai", "/jawad-ai/course", "/jawad-ai/games", "/jawad-ai/login"]);
  });
  it("the proxy keeps them under their own address, only when nobody is signed in", () => {
    const src = readFileSync("src/proxy.ts", "utf8");
    expect(src).toMatch(/!user &&\s*cdnCacheable\(/);
    expect(src).toMatch(/searchParams\.set\(CDN_KEY_PARAM/);
    expect(src).toMatch(/Vercel-CDN-Cache-Control/);
  });
});
