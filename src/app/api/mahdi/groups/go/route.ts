import { NextResponse } from "next/server";

import { GROUP_JOIN_COOKIE } from "@/lib/mahdi/server/groups";
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * «إخوة الولاية» · a group's join link (`?t=<token>`): remembers the token, then opens the join page (which asks the
 * visitor to sign in or up first when needed — the home page sends them back here afterwards).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t") ?? "";
  const res = new NextResponse(null, { status: 307, headers: { Location: TOKEN.test(t) ? "/mahdi/groups/join" : "/mahdi" } });
  if (TOKEN.test(t)) res.cookies.set(GROUP_JOIN_COOKIE, t, { path: "/", maxAge: 7 * 86400, sameSite: "lax", httpOnly: true, secure: url.protocol === "https:" });
  return res;
}
