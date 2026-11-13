import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeAll } from "@/lib/mcp/user";

/** «افصل الربط» on /jawad-ai/connect: every Claude / ChatGPT link of this account stops working (from the person's own page only). */
export const POST = async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "طلب غير مسموح." }, { status: 403 });
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "لازم تسجّل دخولك أول." }, { status: 401 });
  try {
    await revokeAll(user);
  } catch (e) {
    console.error("mcp revoke", e);
    return NextResponse.json({ error: "ما قدرنا نفصل الربط الحين؛ جرّب مرة ثانية." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
};
