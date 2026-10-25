import { NextResponse } from "next/server";
import { cleanGrowItem, GROW_HORIZONS, GROW_LIMITS, type GrowHorizon, type GrowItem } from "@/lib/mahdi/planner";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireUser, UserError } from "@/lib/mahdi/server/api";
import { missingTable } from "@/lib/mahdi/server/inbox";

type Row = { id: string; title: string; horizon: GrowHorizon; note: string; done_at: string | null; created_at: string };
const view = (r: Row): GrowItem => ({ id: r.id, title: r.title, horizon: r.horizon, note: r.note, doneAt: r.done_at, createdAt: r.created_at });

/** «تطوّر وازدهر»: what I intend to achieve. `ready` is false until migration 0095 runs. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  const { data, error } = await supabase.from("mahdi_grow_items").select("id, title, horizon, note, done_at, created_at").order("created_at").limit(GROW_LIMITS.items);
  if (error) {
    if (missingTable(error)) return NextResponse.json({ ready: false, items: [] });
    throw new UserError(t.errors.generic, 500);
  }
  return NextResponse.json({ ready: true, items: (data as Row[]).map(view) }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Adds one: { title, horizon?, note? }. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireUser(req);
  const item = cleanGrowItem(await readJson(req));
  if (!item) throw new UserError(t.errors.invalid, 400);
  const { count } = await supabase.from("mahdi_grow_items").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= GROW_LIMITS.items) throw new UserError(t.errors.tooMany, 403);
  const { data, error } = await supabase.from("mahdi_grow_items").insert({ user_id: user.id, ...item }).select("id, title, horizon, note, done_at, created_at").single();
  if (error) throw new UserError(missingTable(error) ? t.notes.off : t.errors.generic, 503);
  return NextResponse.json({ item: view(data as Row) });
});

/** Changes one: { id, title?, horizon?, note?, done? } (done: true stamps the achievement, false takes it back). */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  const b = await readJson(req);
  const id = requireId(b.id);
  const patch: Record<string, unknown> = {};
  if (typeof b.title === "string") {
    const c = cleanGrowItem({ title: b.title });
    if (!c) throw new UserError(t.errors.invalid, 400);
    patch.title = c.title;
  }
  if (b.horizon !== undefined) {
    if (!(GROW_HORIZONS as readonly unknown[]).includes(b.horizon)) throw new UserError(t.errors.invalid, 400);
    patch.horizon = b.horizon;
  }
  if (typeof b.note === "string") patch.note = b.note.trim().slice(0, GROW_LIMITS.noteMax);
  if (typeof b.done === "boolean") patch.done_at = b.done ? new Date().toISOString() : null;
  if (!Object.keys(patch).length) throw new UserError(t.errors.invalid, 400);
  const { data, error } = await supabase.from("mahdi_grow_items").update(patch).eq("id", id).select("id, title, horizon, note, done_at, created_at").maybeSingle();
  if (error) throw new UserError(t.errors.generic, 500);
  if (!data) throw new UserError(t.errors.notFound, 404);
  return NextResponse.json({ item: view(data as Row) });
});

/** Deletes one: ?id=. */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  const id = requireId(new URL(req.url).searchParams.get("id"));
  const { error } = await supabase.from("mahdi_grow_items").delete().eq("id", id);
  if (error) throw new UserError(t.errors.generic, 500);
  return NextResponse.json({ ok: true });
});
