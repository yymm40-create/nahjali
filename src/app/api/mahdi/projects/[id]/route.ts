import { NextResponse } from "next/server";
import { MAHDI_LIMITS } from "@config/mahdi";
import { todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { cleanIcon, parseBool, parseColor, requireName } from "@/lib/mahdi/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Renames, recolours, archives or brings back a project. */
export const PATCH = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);

  // RLS: another user's project simply isn't found
  const current = (await supabase.from("mahdi_projects").select("id, archived_at").eq("id", id).maybeSingle()).data;
  if (!current) throw new UserError(t.errors.notFound, 404);

  const fields: Record<string, unknown> = {};
  if ("name" in body) fields.name = requireName(body.name, MAHDI_LIMITS.projectNameMax);
  if ("icon" in body) fields.icon = cleanIcon(body.icon);
  if ("color" in body) fields.color = parseColor(body.color);
  if (Object.keys(fields).length) check(await supabase.from("mahdi_projects").update(fields).eq("id", id));

  if ("archived" in body) {
    const archive = parseBool(body.archived);
    if (archive !== Boolean(current.archived_at)) {
      check(await supabase.rpc("mahdi_archive_project", { p_project: id, p_date: todayIn(profile.timeZone), p_archive: archive }));
    }
  }
  return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
});

/** Deletes a project with all its habits and their history. */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const deleted = check(await supabase.from("mahdi_projects").delete().eq("id", id).select("id"));
  if (!(deleted as unknown[]).length) throw new UserError(t.errors.notFound, 404);
  return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
});
