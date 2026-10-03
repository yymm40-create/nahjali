import { NextResponse } from "next/server";
import { MAHDI_LIMITS } from "@config/mahdi";
import { maxDate, todayIn, type HabitState } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import type { VersionRow } from "@/lib/mahdi/server/rows";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { cleanIcon, cleanLine, cleanText, oneOf, parseConfig, parseTime, requireName } from "@/lib/mahdi/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Edits a habit.
 * - name, icon, category, notes, reminderTime: stable details, changed in place.
 * - projectId: moves the habit (its history moves with it).
 * - config (measure, target, unit, freq, days) or state (active / paused / archived): a NEW VERSION from today,
 *   so every earlier day keeps being measured against the goal it had then.
 */
export const PATCH = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);

  const habit = (await supabase.from("mahdi_habits").select("id, project_id").eq("id", id).maybeSingle()).data;
  if (!habit) throw new UserError(t.errors.notFound, 404);
  const project = (await supabase.from("mahdi_projects").select("archived_at").eq("id", habit.project_id).single()).data;
  const projectArchived = Boolean(project?.archived_at);

  const details: Record<string, unknown> = {};
  if ("name" in body) details.name = requireName(body.name, MAHDI_LIMITS.habitNameMax);
  if ("icon" in body) details.icon = cleanIcon(body.icon);
  if ("category" in body) details.category = cleanLine(body.category, MAHDI_LIMITS.categoryMax);
  if ("notes" in body) details.notes = cleanText(body.notes, MAHDI_LIMITS.notesMax);
  if ("reminderTime" in body) details.reminder_time = parseTime(body.reminderTime);
  if ("projectId" in body && body.projectId !== habit.project_id) {
    if (projectArchived) throw new UserError(t.errors.archivedProject, 409);
    const target = (await supabase.from("mahdi_projects").select("id, archived_at").eq("id", requireId(body.projectId)).maybeSingle()).data;
    if (!target) throw new UserError(t.errors.notFound, 404);
    if (target.archived_at) throw new UserError(t.errors.archivedProject, 409);
    details.project_id = target.id;
  }
  if (Object.keys(details).length) check(await supabase.from("mahdi_habits").update(details).eq("id", id));

  const wantsConfig = "config" in body;
  const wantsState = "state" in body;
  if (wantsConfig || wantsState) {
    if (projectArchived) throw new UserError(t.errors.archivedProject, 409);
    const versions = check(
      await supabase.from("mahdi_habit_versions").select("*").eq("habit_id", id).order("effective_from", { ascending: true }),
    ) as VersionRow[];
    const latest = versions[versions.length - 1];
    if (!latest) throw new UserError(t.errors.notFound, 404);
    // Today, or the start date when the habit has not started yet: never earlier than the first version
    const from = maxDate(todayIn(profile.timeZone), versions[0].effective_from);
    const config =
      wantsConfig && body.config && typeof body.config === "object"
        ? parseConfig(body.config as Record<string, unknown>)
        : { measure: latest.measure, target: Number(latest.target), unit: latest.unit, freq: latest.freq, days: latest.days };
    const state: HabitState = wantsState ? oneOf(body.state, ["active", "paused", "archived"] as const) : latest.state;
    check(
      await supabase.from("mahdi_habit_versions").upsert(
        { habit_id: id, user_id: user.id, effective_from: from, ...config, state, reason: "", prev_state: null },
        { onConflict: "habit_id,effective_from" },
      ),
    );
  }
  return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
});

/** Deletes a habit and its whole history. */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const deleted = check(await supabase.from("mahdi_habits").delete().eq("id", id).select("id"));
  if (!(deleted as unknown[]).length) throw new UserError(t.errors.notFound, 404);
  return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
});
