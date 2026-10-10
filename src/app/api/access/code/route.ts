import { NextResponse } from "next/server";
import { isPublicOpen } from "@/lib/launch";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { codeFromRow, forgetAccess, hasAnyAccess } from "@/lib/access";
import { codeOpen } from "@config/access";

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

  // one of the owner's codes («الأكواد»): its own sections, its own time
  const { data: own } = await db.from("site_codes").select("*").eq("code", code).maybeSingle();
  if (own) {
    const row = codeFromRow(own);
    const { data: mine } = await db.from("site_code_uses").select("code_id,email,at").eq("code_id", row.id);
    const had = (mine ?? []).find((u) => u.email === email);
    const use = had ? { codeId: row.id, email, at: had.at as string } : { codeId: row.id, email, at: new Date().toISOString() };
    if (!row.enabled) throw new UserError("هذا الكود مو شغّال حاليًا.", 403);
    if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) throw new UserError("انتهت صلاحية هذا الكود.", 403);
    if (!had && row.maxUses && (mine ?? []).length >= row.maxUses) throw new UserError("هذا الكود وصل لأقصى عدد من الأشخاص.", 403);
    if (!codeOpen(row, use)) throw new UserError("انتهت صلاحيتك على هذا الكود.", 403);
    // entering again never renews the hours: the first entry stays
    if (!had) {
      const { error: e0 } = await db.from("site_code_uses").insert({ code_id: row.id, email, at: use.at });
      if (e0) throw e0;
    }
    forgetAccess(email);
    return NextResponse.json({ ok: true, open: await hasAnyAccess(email), opened: row.perms });
  }

  const { data: s, error } = await db.from("site_secret").select("code,code_id,enabled").eq("id", 1).maybeSingle();
  if (error || !s?.enabled || !s.code || s.code !== code) {
    await db.from("site_code_tries").insert({ user_id: user.id });
    throw new UserError("الكود غير صحيح.", 403);
  }
  const { error: e2 } = await db.from("site_code_grants").upsert({ email, code_id: s.code_id, created_at: new Date().toISOString() });
  if (e2) throw e2;
  forgetAccess(email);
  return NextResponse.json({ ok: true, open: await hasAnyAccess(email) });
});

/** Whether this visitor already has something open (so the question isn't asked again). */
export const GET = handle(async () => {
  const user = await requireApiUser().catch(() => null);
  // the site open to everyone (the owner's launch switch): nobody is asked for the code
  const everyone = await isPublicOpen().catch(() => false);
  return NextResponse.json({ signedIn: Boolean(user), open: everyone || (user ? await hasAnyAccess(user.email) : false) });
});
