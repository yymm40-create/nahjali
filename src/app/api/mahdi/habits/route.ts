import { NextResponse } from "next/server";
import { MAHDI_LIMITS } from "@config/mahdi";
import { addDays, todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { cleanIcon, cleanLine, cleanText, parseConfig, parseDate, parseTime, requireName } from "@/lib/mahdi/server/validate";

/** Creates a habit with its first goal. Returns the new id and a fresh snapshot. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, profile } = await requireProfile(req);
  const body = await readJson(req);
  const projectId = requireId(body.projectId);
  const project = (await supabase.from("mahdi_projects").select("id, archived_at").eq("id", projectId).maybeSingle()).data;
  if (!project) throw new UserError(t.errors.notFound, 404);
  if (project.archived_at) throw new UserError(t.errors.archivedProject, 409);

  const { count } = await supabase.from("mahdi_habits").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAHDI_LIMITS.maxHabits) throw new UserError(t.errors.tooMany, 403);

  const today = todayIn(profile.timeZone);
  const start = body.startDate === undefined ? today : parseDate(body.startDate);
  if (start < addDays(today, -5 * 366) || start > addDays(today, 366)) throw new UserError(t.errors.invalid, 400);
  const config = parseConfig(body);

  const id = check(
    await supabase.rpc("mahdi_create_habit", {
      p_project: projectId,
      p_name: requireName(body.name, MAHDI_LIMITS.habitNameMax),
      p_icon: cleanIcon(body.icon),
      p_category: cleanLine(body.category, MAHDI_LIMITS.categoryMax),
      p_notes: cleanText(body.notes, MAHDI_LIMITS.notesMax),
      p_reminder: parseTime(body.reminderTime),
      p_start: start,
      p_measure: config.measure,
      p_target: config.target,
      p_unit: config.unit,
      p_freq: config.freq,
      p_days: config.days,
    }),
  ) as string;
  return NextResponse.json({ id, snapshot: await loadSnapshot(supabase, profile) });
});
