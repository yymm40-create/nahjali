import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";

const PER_DAY = 40;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null);
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * «الملاحظ حسن»: a signed-in person leaves a note at the exact spot they clicked, on any page; it lands in the
 * dashboard's «الملاحظات» with where it was left.
 *   GET            → { signedIn, name }            (to fill the form)
 *   GET ?id=…      → one note (owners only: to show its pin on the page)
 *   POST { name, note, path, x, y, vx, vy, target, viewport }
 */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser().catch(() => null);
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    if (!user || !isAdmin(user.email) || !/^[0-9a-f-]{36}$/i.test(id)) throw new UserError("غير مسموح.", 404);
    const { data } = await createAdminClient().from("site_notes").select("id,name,note,path,x,y,vx,vy,target,viewport,created_at").eq("id", id).maybeSingle();
    if (!data) throw new UserError("ما لقينا الملاحظة.", 404);
    return NextResponse.json({ note: data });
  }
  const name = user ? String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim() || (user.email ?? "").split("@")[0] : "";
  return NextResponse.json({ signedIn: Boolean(user), name });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = text(b.name, 80);
  const note = text(b.note, 4000);
  const path = text(b.path, 1000);
  if (!name) throw new UserError("اكتب اسمك.", 400);
  if (!note) throw new UserError("اكتب ملاحظتك.", 400);
  if (!path.startsWith("/")) throw new UserError("طلب غير صحيح.", 400);
  const db = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await db.from("site_notes").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= PER_DAY) throw new UserError("وصلت لحد الملاحظات اليوم؛ شكرًا لك! كمّل بكرة.", 429);
  const { error } = await db.from("site_notes").insert({
    user_id: user.id,
    email: user.email?.toLowerCase() ?? null,
    name,
    note,
    path,
    x: num(b.x),
    y: num(b.y),
    vx: num(b.vx),
    vy: num(b.vy),
    target: text(b.target, 300),
    viewport: text(b.viewport, 60),
  });
  if (error) throw new UserError("قسم الملاحظات ما انضاف للحين (ملف SQL رقم 0035).", 500);
  return NextResponse.json({ ok: true });
});

/** Owners: { id, status: "new" | "done" } or { id, delete: true }. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; status?: unknown; delete?: unknown };
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError("طلب غير صحيح.", 400);
  const db = createAdminClient();
  if (b.delete === true) await db.from("site_notes").delete().eq("id", id);
  else if (b.status === "new" || b.status === "done") await db.from("site_notes").update({ status: b.status }).eq("id", id);
  else throw new UserError("طلب غير صحيح.", 400);
  return NextResponse.json({ ok: true });
});
