// «المجتمع» without shame (the plan «واجهة لأجل المهدي الجديدة», 26 November 2026): no ranking that shows who is at
// the bottom. A small weekly ranking (the first few and my own place, never the rest), «أهل الثبات» for showing up
// day after day rather than for doing the most, and «ذكّرته بلطف» once a day. Pure functions, shared by the server
// (which trims what it sends) and the tests.

/** How many places a ranking shows; anyone below them sees only their own place, never the others below. */
export const KIND_TOP = 3;

/**
 * A ranking as anyone may see it: the first `top` places, and my own row apart when I am below them. Nobody else
 * below the top is sent, so the people at the bottom are never listed for others to see.
 */
export function kindBoard<T extends { rank: number; mine: boolean }>(ranked: readonly T[], top = KIND_TOP): { entries: T[]; me: T | null; total: number } {
  const entries = ranked.filter((e) => e.rank <= top).slice(0, Math.max(top, 0) + 2);
  const mine = ranked.find((e) => e.mine) ?? null;
  return { entries, me: mine && !entries.includes(mine) ? mine : null, total: ranked.length };
}

/** «أهل الثبات»: the days looked at (the last week, today included) and how many of them must have something done. */
export const STEADY_WINDOW = 7;
export const STEADY_DAYS = 5;

/** The dates of the window that ends on `today` (oldest first). */
export function windowDays(today: string, size = STEADY_WINDOW): string[] {
  const out: string[] = [];
  const d = new Date(`${today}T00:00:00Z`);
  for (let i = size - 1; i >= 0; i--) out.push(new Date(d.getTime() - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

/**
 * On how many days of the window someone did anything (a habit, a challenge or a shared work): any day with a value
 * above zero counts once, however much was done on it. Consistency, not volume.
 */
export function presentDays(logs: Record<string, Record<string, number>>, today: string, extra: Iterable<string> = [], size = STEADY_WINDOW): number {
  const days = new Set(windowDays(today, size));
  const seen = new Set<string>();
  for (const byDate of Object.values(logs)) for (const [date, v] of Object.entries(byDate)) if (days.has(date) && Number(v) > 0) seen.add(date);
  for (const date of extra) if (days.has(date)) seen.add(date);
  return seen.size;
}

export const isSteady = (days: number) => days >= STEADY_DAYS;

export interface SteadyRow {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  days: number;
  mine: boolean;
}

/**
 * Who earned «أهل الثبات» this week, as one member may see it: only the ones who earned it (never a list of who did
 * not), and in a group where each one's work is private, only myself.
 */
export function steadyFor(rows: readonly SteadyRow[], full: boolean): SteadyRow[] {
  return rows.filter((r) => isSteady(r.days) && (full || r.mine)).sort((a, b) => b.days - a.days || a.displayName.localeCompare(b.displayName, "ar"));
}

/** «ذكّرته بلطف»: one gentle reminder a day from one member to another. */
export function nudgeBlock(p: { me: string; target: string; targetActive: boolean; sentToday: ReadonlySet<string> }): "self" | "notMember" | "already" | null {
  if (p.me === p.target) return "self";
  if (!p.targetActive) return "notMember";
  if (p.sentToday.has(p.target)) return "already";
  return null;
}

/** The table of SQL 0135 is not there yet (the button stays hidden until it is). */
export const nudgesMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation \S*mahdi_group_nudges\S* does not exist/.test(e.message ?? ""));
