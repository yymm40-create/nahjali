// «دورة الجواد الذكي» — the owner's settings: one row, read with the defaults filled in, and the part of it the public page may see
// (never the bank data nor the links that only a confirmed buyer gets). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { publicUrl } from "@/lib/jawad/server/runtime";
import { DEFAULT_SETTINGS, readSettings, type CourseSettings } from "@config/course";

const db = () => createAdminClient();

export async function loadSettings(): Promise<CourseSettings> {
  const { data, error } = await db().from("course_settings").select("data").eq("id", 1).maybeSingle();
  if (error) return DEFAULT_SETTINGS;
  return readSettings(data?.data);
}

/** Saves a change on top of what is there (checked as a whole). */
export async function saveSettings(patch: Record<string, unknown>): Promise<CourseSettings> {
  const cur = await loadSettings();
  const next = readSettings({ ...cur, ...patch, prices: { ...cur.prices, ...((patch.prices as object) ?? {}) }, was: { ...cur.was, ...((patch.was as object) ?? {}) }, bonus: { ...cur.bonus, ...((patch.bonus as object) ?? {}) }, bank: { ...cur.bank, ...((patch.bank as object) ?? {}) } });
  const { error } = await db().from("course_settings").upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
  if (error) throw error;
  return next;
}

/** What the public page gets: the clock, prices, words and the video — no bank data, no private links. */
export interface PublicCourse extends Omit<CourseSettings, "bank" | "groupLink" | "recordedLink" | "videoPath" | "posterPath"> {
  videoFileUrl: string | null;
  posterUrl: string | null;
  /** the bank data is set (so «ادفع الآن» can work) */
  payable: boolean;
}

export function publicView(s: CourseSettings): PublicCourse {
  const { bank, groupLink: _g, recordedLink: _r, videoPath, posterPath, ...rest } = s;
  void _g;
  void _r;
  return { ...rest, videoFileUrl: videoPath ? publicUrl(videoPath) : null, posterUrl: posterPath ? publicUrl(posterPath) : null, payable: !!(bank.iban || bank.account) };
}
