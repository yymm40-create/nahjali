// SERVER ONLY. Strategic goals and their milestones (migration 0086), through the user's own client (RLS).
import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "../i18n";
import { UserError } from "./api";

const MISSING = ["42P01", "42703", "PGRST204", "PGRST205"];
/** Before SQL 0086 the new columns and tables do not exist: say so clearly instead of a generic error. */
export const goalsMissing = (e: unknown) => {
  const err = e as { code?: string; message?: string } | null;
  return !!err && (MISSING.includes(err.code ?? "") || /mahdi_milestone|column .*(kind|goal|milestone_id|color)/.test(err.message ?? ""));
};

/** Throws the database error, as «run SQL 0086» when that is the cause. */
export function checkGoals<T>(res: { data: T; error: unknown }): T {
  if (res.error) {
    if (goalsMissing(res.error)) throw new UserError(t.goal.notReady, 503);
    throw res.error;
  }
  return res.data;
}

/** A milestone of this user, with its goal's id (null when not found). */
export async function findMilestone(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("mahdi_milestones").select("id, project_id").eq("id", id).maybeSingle();
  if (error) checkGoals({ data, error });
  return data as { id: string; project_id: string } | null;
}

/** The milestone a habit may hang under: one of the same goal (null = general). */
export async function milestoneForHabit(supabase: SupabaseClient, milestoneId: unknown, projectId: string): Promise<string | null> {
  if (milestoneId === null || milestoneId === undefined || milestoneId === "") return null;
  if (typeof milestoneId !== "string") throw new UserError(t.errors.invalid, 400);
  const m = await findMilestone(supabase, milestoneId);
  if (!m || m.project_id !== projectId) throw new UserError(t.errors.notFound, 404);
  return m.id;
}
