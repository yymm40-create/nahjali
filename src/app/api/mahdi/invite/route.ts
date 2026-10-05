import { NextResponse } from "next/server";

/** Where the person who invited someone is remembered while they sign up (a week at most). */
export const INVITE_COOKIE = "mahdi_invite";
const HANDLE = /^[\p{L}\p{N}_.-]{1,30}$/u;
/** A redirect to a path on this same site (relative, so it keeps whatever address the visitor used). */
const to = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });

/**
 * «لأجل المهدي» · from an invitation link: `?u=<username>&to=signup|login|app` remembers who invited, then opens
 * sign-up / sign-in / the app; once the visitor is in the app, `?done=1` forgets it and opens that person's page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("done")) {
    const handle = decodeURIComponent(req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${INVITE_COOKIE}=([^;]*)`))?.[1] ?? "");
    const res = to(HANDLE.test(handle) ? `/mahdi/u/${encodeURIComponent(handle)}?invited=1` : "/mahdi");
    res.cookies.delete(INVITE_COOKIE);
    return res;
  }
  const handle = (url.searchParams.get("u") ?? "").trim().replace(/^@/, "");
  const next = url.searchParams.get("to");
  const res = to(next === "login" ? "/mahdi/login" : next === "app" ? "/mahdi" : "/mahdi/signup");
  if (HANDLE.test(handle)) res.cookies.set(INVITE_COOKIE, encodeURIComponent(handle), { path: "/", maxAge: 7 * 86400, sameSite: "lax", httpOnly: true, secure: url.protocol === "https:" });
  return res;
}
