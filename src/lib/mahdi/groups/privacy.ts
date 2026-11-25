// «إخوة الولاية»: who sees each member's progress in a group (SQL 0129, mahdi_groups.progress_visibility).
//   'all'     — every member sees the others' progress (the ranking, how many did each shared work). The default, and
//               what every group did before the choice existed.
//   'leaders' — a member sees only their own; the leader and the admins holding «الإحصائيات» see everyone's.
// Pure functions, shared by the server (which trims what it sends) and the tests.

import { can, type Seat } from "./program";

export const GROUP_VISIBILITIES = ["all", "leaders"] as const;
export type GroupVisibility = (typeof GROUP_VISIBILITIES)[number];

export const cleanVisibility = (v: unknown): GroupVisibility => (v === "leaders" ? "leaders" : "all");

/** Whether this seat sees every member's progress in a group with this setting. */
export const seesEveryone = (seat: Pick<Seat, "role" | "perms">, visibility: GroupVisibility) => visibility === "all" || can(seat, "stats");

/** The column of SQL 0129 is not there yet (the group then works as before: everyone sees). */
export const visibilityMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /column \S*progress_visibility\S* does not exist|'progress_visibility' column/.test(e.message ?? ""));

/**
 * The group ranking as one member may see it. Whoever sees everyone gets it whole. In a private group a member gets
 * only their own row, with their own place in it (so a competition still tells them where they stand) — no one
 * else's name, picture, score or reading.
 */
export function rankingFor<T extends { ranked: { mine: boolean }[]; unranked: { mine: boolean }[] }>(ranking: T, full: boolean): T & { onlyMine: boolean } {
  if (full) return { ...ranking, onlyMine: false };
  return { ...ranking, ranked: ranking.ranked.filter((e) => e.mine), unranked: ranking.unranked.filter((e) => e.mine), onlyMine: true };
}

export interface WorkView {
  id: string;
  title: string;
  details: string;
  cadence: "daily" | "once";
  dueDate: string | null;
  mineDone: boolean;
  /** how many active members did it this cycle; null when the viewer may not see the others */
  doneCount: number | null;
  memberCount: number | null;
  /** who did it (names), for those who see everyone's progress in full (the leader, admins with «الإحصائيات») */
  doneBy?: string[];
}

/**
 * A shared work as one member may see it: their own tick always; how many did it when the group is open (or they see
 * everyone); who did it only for the leader and the admins holding «الإحصائيات».
 */
export function workFor(
  work: Omit<WorkView, "doneCount" | "memberCount" | "doneBy" | "mineDone">,
  doneBy: string[],
  activeIds: string[],
  me: string,
  opts: { full: boolean; names: boolean; nameOf: (id: string) => string },
): WorkView {
  const active = new Set(activeIds);
  const done = doneBy.filter((id) => active.has(id));
  return {
    ...work,
    mineDone: done.includes(me),
    doneCount: opts.full ? done.length : null,
    memberCount: opts.full ? activeIds.length : null,
    ...(opts.names ? { doneBy: done.map(opts.nameOf).filter(Boolean) } : {}),
  };
}
