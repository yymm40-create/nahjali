// Database rows (snake_case) → app shapes (camelCase).
import type { MahdiTheme, ProjectColor } from "@config/mahdi";
import type { Freq, HabitState, Measure, Version } from "../engine";
import type { Habit, Profile, Project, Shrine } from "../types";

export interface ShrineRow {
  id: string;
  name: string;
  place: string;
  image_url: string | null;
  image_alt: string;
  image_position: string;
  image_credit: string;
  is_artwork: boolean;
  sort_order: number;
  active: boolean;
}
export interface ProfileRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  shrine_id: string;
  theme: MahdiTheme;
  theme_variant: string;
  time_zone: string;
  week_start: number;
  show_hijri: boolean;
  hijri_offset: number;
  frame?: string;
  view_mode?: "list" | "compact";
}
export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: ProjectColor;
  sort_order: number;
  archived_at: string | null;
}
export interface HabitRow {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  icon: string;
  category: string;
  notes: string;
  reminder_time: string | null;
  sort_order: number;
}
export interface VersionRow {
  habit_id: string;
  effective_from: string;
  measure: Measure;
  target: number | string;
  unit: string;
  freq: Freq;
  days: number[];
  state: HabitState;
  reason: string;
  prev_state: HabitState | null;
}
export interface LogRow {
  habit_id: string;
  log_date: string;
  value: number | string;
}

export const AVATAR_BUCKET = "mahdi-avatars";
export const avatarUrl = (path: string | null) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}` : null;

export const shrineFromRow = (r: ShrineRow): Shrine => ({
  id: r.id,
  name: r.name,
  place: r.place,
  imageUrl: r.image_url,
  imageAlt: r.image_alt,
  imagePosition: r.image_position,
  imageCredit: r.image_credit,
  isArtwork: r.is_artwork,
  active: r.active,
});

export const profileFromRow = (r: ProfileRow): Profile => ({
  userId: r.user_id,
  displayName: r.display_name,
  avatarUrl: avatarUrl(r.avatar_path),
  shrineId: r.shrine_id,
  theme: r.theme,
  themeVariant: r.theme_variant,
  timeZone: r.time_zone,
  weekStart: r.week_start,
  showHijri: r.show_hijri,
  hijriOffset: r.hijri_offset,
  frame: r.frame ?? "",
  viewMode: r.view_mode ?? "list",
});

export const projectFromRow = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color,
  sortOrder: r.sort_order,
  archivedAt: r.archived_at,
});

export const versionFromRow = (r: VersionRow): Version => ({
  effectiveFrom: r.effective_from,
  measure: r.measure,
  target: Number(r.target),
  unit: r.unit,
  freq: r.freq,
  days: r.days ?? [],
  state: r.state,
});

export function habitsFromRows(habits: HabitRow[], versions: VersionRow[]): Habit[] {
  const byHabit = new Map<string, Version[]>();
  for (const v of [...versions].sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1))) {
    const list = byHabit.get(v.habit_id);
    if (list) list.push(versionFromRow(v));
    else byHabit.set(v.habit_id, [versionFromRow(v)]);
  }
  return habits.map((h) => ({
    id: h.id,
    projectId: h.project_id,
    name: h.name,
    icon: h.icon,
    category: h.category,
    notes: h.notes,
    reminderTime: h.reminder_time ? h.reminder_time.slice(0, 5) : null,
    sortOrder: h.sort_order,
    versions: byHabit.get(h.id) ?? [],
  }));
}
