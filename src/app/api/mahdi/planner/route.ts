import { NextResponse } from "next/server";
import { cleanPlanItem, PLAN_LIMITS, type PlanItem } from "@/lib/mahdi/planner";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireUser, UserError } from "@/lib/mahdi/server/api";
import { missingTable } from "@/lib/mahdi/server/inbox";

type Row = { id: string; title: string; day: string; start_time: string | null; end_time: string | null; repeat: PlanItem["repeat"]; note: string; remind?: boolean };
const BASE = "id, title, day, start_time, end_time, repeat, note";
// «اجعله تنبيهًا» needs migration 0102; before it, the planner works without it
const COLS = `${BASE}, remind`;
const view = (r: Row): PlanItem => ({ id: r.id, title: r.title, day: r.day, start: r.start_time, end: r.end_time, repeat: r.repeat, note: r.note, remind: Boolean(r.remind) });
const row = (c: Omit<PlanItem, "id">, alerts = true) => ({
  title: c.title,
  day: c.day,
  start_time: c.start,
  end_time: c.end,
  repeat: c.repeat,
  note: c.note,
  // a changed alert is sent again on its next day
  ...(alerts ? { remind: Boolean(c.remind), reminded_on: null } : {}),
});
/** The column (or the table's newer columns) is not there yet. */
const missingColumn = (e: unknown) => ["42703", "PGRST204"].includes((e as { code?: string } | null)?.code ?? "");

/** The planner: my events and times (the repeating ones included). `ready` is false until migration 0095 runs. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  let { data, error }: { data: unknown[] | null; error: unknown } = await supabase.from("mahdi_plan_items").select(COLS).order("day").limit(PLAN_LIMITS.items);
  let alerts = true;
  if (missingColumn(error)) {
    alerts = false;
    ({ data, error } = await supabase.from("mahdi_plan_items").select(BASE).order("day").limit(PLAN_LIMITS.items));
  }
  if (error) {
    if (missingTable(error)) return NextResponse.json({ ready: false, items: [] });
    throw new UserError(t.errors.generic, 500);
  }
  return NextResponse.json({ ready: true, alerts, items: (data as Row[]).map(view) }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Adds one: { title, day, start?, end?, repeat?, note? }. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireUser(req);
  const item = cleanPlanItem(await readJson(req));
  if (!item) throw new UserError(t.errors.invalid, 400);
  const { count } = await supabase.from("mahdi_plan_items").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= PLAN_LIMITS.items) throw new UserError(t.errors.tooMany, 403);
  let { data, error }: { data: unknown; error: unknown } = await supabase.from("mahdi_plan_items").insert({ user_id: user.id, ...row(item) }).select(COLS).single();
  if (missingColumn(error)) ({ data, error } = await supabase.from("mahdi_plan_items").insert({ user_id: user.id, ...row(item, false) }).select(BASE).single());
  if (error) throw new UserError(missingTable(error) ? t.notes.off : t.errors.generic, 503);
  return NextResponse.json({ item: view(data as Row) });
});

/** Changes one: { id, ...the same fields, remind? }. */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  const b = await readJson(req);
  const id = requireId(b.id);
  const item = cleanPlanItem(b);
  if (!item) throw new UserError(t.errors.invalid, 400);
  let { data, error }: { data: unknown; error: unknown } = await supabase.from("mahdi_plan_items").update(row(item)).eq("id", id).select(COLS).maybeSingle();
  if (missingColumn(error)) {
    if (item.remind) throw new UserError(t.alert.planOff, 503);
    ({ data, error } = await supabase.from("mahdi_plan_items").update(row(item, false)).eq("id", id).select(BASE).maybeSingle());
  }
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
