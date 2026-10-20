// Database rows (snake_case) → app shapes (camelCase).
import type { MahdiTheme, MilestonePeriod, ProjectColor } from "@config/mahdi";
import type { Freq, HabitState, Measure, Version } from "../engine";
import type { GoalPlan, Habit, Milestone, Profile, Project, Shrine } from "../types";
import { publicFileUrl } from "@/lib/storage/public";

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
  /** the home cards in order (migration 0062; null = the standard home) */
  home_widgets?: string[] | null;
  /** where the drawn shrine shows (migration 0064; null = as the design does) */
  shrine_place?: string | null;
}
export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: ProjectColor;
  sort_order: number;
  archived_at: string | null;
  /** migration 0086 */
  kind?: "project" | "goal" | null;
  goal?: unknown;
}
export interface MilestoneRow {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  obstacle: string;
  plan: string;
  target: number | string;
  unit: string;
  period: MilestonePeriod;
  starts_on: string;
  done_at: string | null;
  sort_order: number;
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
  /** migration 0086 */
  milestone_id?: string | null;
  color?: string | null;
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
export const avatarUrl = (path: string | null) => (path ? publicFileUrl(AVATAR_BUCKET, path) : null);

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
  homeWidgets: r.home_widgets ?? null,
  shrinePlace: r.shrine_place ?? "auto",
});

export const projectFromRow = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  color: r.color,
  sortOrder: r.sort_order,
  archivedAt: r.archived_at,
  kind: r.kind === "goal" ? "goal" : "project",
  goal: r.kind === "goal" ? goalFromJson(r.goal) : null,
});

const str = (v: unknown) => (typeof v === "string" ? v : "");
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** A stored goal plan, read defensively (it is free JSON). */
export function goalFromJson(v: unknown): GoalPlan {
  const g = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const obstacles = Array.isArray(g.obstacles) ? g.obstacles : [];
  return {
    statement: str(g.statement),
    why: str(g.why),
    vision: str(g.vision),
    horizon: date(g.horizon),
    obstacles: obstacles
      .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === "object")
      .map((o) => ({ id: str(o.id), text: str(o.text) }))
      .filter((o) => o.id && o.text),
    habitScope: g.habitScope === "general" ? "general" : "milestone",
    reviewedAt: date(g.reviewedAt),
  };
}

export const milestoneFromRow = (r: MilestoneRow): Milestone => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  obstacle: r.obstacle,
  plan: r.plan,
  target: Number(r.target),
  unit: r.unit,
  period: r.period,
  startsOn: r.starts_on,
  doneAt: r.done_at,
  sortOrder: r.sort_order,
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
    milestoneId: h.milestone_id ?? null,
    color: h.color ?? null,
  }));
}
