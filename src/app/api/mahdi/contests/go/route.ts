import { NextResponse } from "next/server";
import { CODE_RE } from "@/lib/mahdi/contests";
import { CONTEST_JOIN_COOKIE, contestByCode } from "@/lib/mahdi/server/contests";
import { getApiSession } from "@/lib/mahdi/server/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * «مسابقة الثبات» · the contest's link (`?c=<code>`), or `?resume=1` after signing in: opens the contest page with its
 * code. Someone not signed in keeps the code in a cookie and goes to sign up first; the home page brings them back here.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromCookie = decodeURIComponent(req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${CONTEST_JOIN_COOKIE}=([^;]*)`))?.[1] ?? "");
  const code = (url.searchParams.get("c") ?? (url.searchParams.get("resume") ? fromCookie : "")).toUpperCase();
  const go = (to: string) => new NextResponse(null, { status: 307, headers: { Location: to } });
  if (!CODE_RE.test(code)) {
    const res = go("/mahdi/contests");
    res.cookies.delete(CONTEST_JOIN_COOKIE);
    return res;
  }
  const { user } = await getApiSession(req).catch(() => ({ user: null }));
  if (!user) {
    const res = go("/mahdi/start");
    res.cookies.set(CONTEST_JOIN_COOKIE, code, { path: "/", maxAge: 7 * 86400, sameSite: "lax", httpOnly: true, secure: url.protocol === "https:" });
    return res;
  }
  const contest = await contestByCode(createAdminClient(), code).catch(() => null);
  const res = go(contest ? `/mahdi/contests/${contest.id}?c=${code}` : "/mahdi/contests");
  res.cookies.delete(CONTEST_JOIN_COOKIE);
  return res;
}
