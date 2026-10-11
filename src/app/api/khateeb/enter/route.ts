import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { check } from "@/lib/khateeb/gate";
import { KHATEEB } from "@config/jawad/khateeb";

export const dynamic = "force-dynamic";

/** «الخطيب الذكي» · the password at the door: `{ slug, password }`. Right: the cookie is set. Wrong: the same plain answer whatever was wrong. */
export const POST = handle(async (req: Request) => {
  const b = (await req.json().catch(() => ({}))) as { slug?: unknown; password?: unknown };
  const got = await check(String(b.slug ?? ""), String(b.password ?? ""));
  if (!got) throw new UserError("كلمة السر غير صحيحة.", 403);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(KHATEEB.cookie, got.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: got.maxAge });
  return res;
});
