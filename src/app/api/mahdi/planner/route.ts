import { NextResponse } from "next/server";
import { cleanPlanItem, PLAN_LIMITS, type PlanItem } from "@/lib/mahdi/planner";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireUser, UserError } from "@/lib/mahdi/server/api";
import { missingTable } from "@/lib/mahdi/server/inbox";

type Row = { id: string; title: string; day: string; start_time: string | null; end_time: string | null; repeat: PlanItem["repeat"]; note: string };
const COLS = "id, title, day, start_time, end_time, repeat, note";
const view = (r: Row): PlanItem => ({ id: r.id, title: r.title, day: r.day, start: r.start_time, end: r.end_time, repeat: r.repeat, note: r.note });
const row = (c: Omit<PlanItem, "id">) => ({ title: c.title, day: c.day, start_time: c.start, end_time: c.end, repeat: c.repeat, note: c.note });

/** The planner: my events and times (the repeating ones included). `ready` is false until migration 0095 runs. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  const { data, error } = await supabase.from("mahdi_plan_items").select(COLS).order("day").limit(PLAN_LIMITS.items);
  if (error) {
    if (missingTable(error)) return NextResponse.json({ ready: false, items: [] });
    throw new UserError(t.errors.generic, 500);
  }
  return NextResponse.json({ ready: true, items: (data as Row[]).map(view) }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Adds one: { title, day, start?, end?, repeat?, note? }. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireUser(req);
  const item = cleanPlanItem(await readJson(req));
  if (!item) throw new UserError(t.errors.invalid, 400);
  const { count } = await supabase.from("mahdi_plan_items").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= PLAN_LIMITS.items) throw new UserError(t.errors.tooMany, 403);
  const { data, error } = await supabase.from("mahdi_plan_items").insert({ user_id: user.id, ...row(item) }).select(COLS).single();
  if (error) throw new UserError(missingTable(error) ? t.notes.off : t.errors.generic, 503);
  return NextResponse.json({ item: view(data as Row) });
});

/** Changes one: { id, ...the same fields }. */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  const b = await readJson(req);
  const id = requireId(b.id);
  const item = cleanPlanItem(b);
  if (!item) throw new UserError(t.errors.invalid, 400);
  const { data, error } = await supabase.from("mahdi_plan_items").update(row(item)).eq("id", id).select(COLS).maybeSingle();
  if (error) throw new UserError(t.errors.generic, 500);
  if (!data) throw new UserError(t.errors.notFound, 404);
  return NextResponse.json({ item: view(data as Row) });
});

/** Deletes one (a repeating one goes with all its days): ?id=. */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  const id = requireId(new URL(req.url).searchParams.get("id"));
  const { error } = await supabase.from("mahdi_plan_items").delete().eq("id", id);
  if (error) throw new UserError(t.errors.generic, 500);
  return NextResponse.json({ ok: true });
});
