import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { forgetAccess, unlimitedFor } from "@/lib/access";

const TRIES_PER_HOUR = 8;

/** «الكود السري»: a signed-in person enters it (so the owner knows who used it) → everything opens while it stays on. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const email = (user.email ?? "").toLowerCase();
  if (!email) throw new UserError("حسابك بدون إيميل.", 400);
  const b = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = String(b.code ?? "").trim();
  if (!code || code.length > 64) throw new UserError("اكتب الكود.", 400);
  const db = createAdminClient();

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("site_code_tries").select("user_id", { count: "exact", head: true }).eq("user_id", user.id).gte("at", since);
  if ((count ?? 0) >= TRIES_PER_HOUR) throw new UserError("محاولات كثيرة؛ جرّب بعد ساعة.", 429);

  const { data: s, error } = await db.from("site_secret").select("code,code_id,enabled").eq("id", 1).maybeSingle();
  if (error || !s?.enabled || !s.code || s.code !== code) {
    await db.from("site_code_tries").insert({ user_id: user.id });
    throw new UserError("الكود غير صحيح.", 403);
  }
  const { error: e2 } = await db.from("site_code_grants").upsert({ email, code_id: s.code_id, created_at: new Date().toISOString() });
  if (e2) throw e2;
  forgetAccess(email);
  return NextResponse.json({ ok: true, open: await unlimitedFor(email) });
});

/** Whether this visitor already has something open (so the question isn't asked again). */
export const GET = handle(async () => {
  const user = await requireApiUser().catch(() => null);
  return NextResponse.json({ signedIn: Boolean(user), open: user ? await unlimitedFor(user.email) : false });
});
