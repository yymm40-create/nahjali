// Turns habits (their versions and daily logs) into goal instances. Pure functions.
import { addDays, addMonths, daysInMonth, eachDay, endOfMonth, maxDate, startOfMonth, startOfWeek, weekday, type ISODate } from "./dates";
import type { EngineContext, Instance, Item, SlotKind, Version } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The version in effect on `d`, or null before the habit starts. */
export function versionAt(item: Item, d: ISODate): Version | null {
  const vs = item.versions;
  for (let i = vs.length - 1; i >= 0; i--) if (vs[i].effectiveFrom <= d) return vs[i];
  return null;
}

/** Is a goal due on this exact day (daily habits, or one of the chosen weekdays)? */
export function isDueOn(v: Version | null, d: ISODate) {
  if (!v || v.state !== "active") return false;
  if (v.freq === "daily") return true;
  return v.freq === "days" && v.days.includes(weekday(d));
}

function statusOf(start: ISODate, end: ISODate, asOf: ISODate): Instance["status"] {
  if (end < asOf) return "past";
  if (start > asOf) return "future";
  return "current";
}

function finish(base: Omit<Instance, "progress" | "over" | "status">, asOf: ISODate): Instance {
  return {
    ...base,
    progress: Math.min(base.value / base.target, 1),
    over: Math.max(0, round2(base.value - base.target)),
    status: statusOf(base.start, base.end, asOf),
  };
}

/** One day's goal for an item, if one is due. */
export function dayInstance(item: Item, d: ISODate, ctx: EngineContext): Instance | null {
  const v = versionAt(item, d);
  if (!isDueOn(v, d)) return null;
  const raw = item.logs[d] ?? 0;
  return finish(
    {
      itemId: item.id,
      projectId: item.projectId,
      kind: "day",
      key: `${item.id}|day|${d}`,
      start: d,
      end: d,
      periodStart: d,
      periodEnd: d,
      measure: v!.measure,
      unit: v!.unit,
      target: v!.target,
      value: v!.measure === "check" ? Math.min(raw, 1) : raw,
      partial: false,
    },
    ctx.asOf,
  );
}

/**
 * Week or month goals of an item for one period. The goal is spread over the days on which the habit was active
 * with a weekly/monthly schedule, so a habit that started, was paused or changed mid-period gets a fair,
 * pro-rated goal ("3 a week" started on the 6th day of the week → 1 this week). Days with a different measure or
 * unit form their own goal.
 */
export function periodInstances(item: Item, kind: Exclude<SlotKind, "day">, periodStart: ISODate, ctx: EngineContext): Instance[] {
  const freq = kind === "week" ? "weekly" : "monthly";
  const periodEnd = kind === "week" ? addDays(periodStart, 6) : endOfMonth(periodStart);
  const len = kind === "week" ? 7 : daysInMonth(periodStart);

  const groups = new Map<string, { v: Version; days: ISODate[]; targetSum: number; value: number; versions: Set<Version> }>();
  for (const d of eachDay(periodStart, periodEnd)) {
    const v = versionAt(item, d);
    if (!v || v.state !== "active" || v.freq !== freq) continue;
    const gk = `${v.measure}|${v.unit}`;
    let g = groups.get(gk);
    if (!g) groups.set(gk, (g = { v, days: [], targetSum: 0, value: 0, versions: new Set() }));
    g.days.push(d);
    g.targetSum += v.target;
    g.versions.add(v);
    const raw = item.logs[d] ?? 0;
    g.value += v.measure === "check" ? Math.min(raw, 1) : raw;
  }

  const out: Instance[] = [];
  for (const g of groups.values()) {
    const full = g.days.length === len && g.versions.size === 1;
    let target = g.targetSum / len;
    if (g.v.measure === "amount") target = Math.max(0.1, Math.round(target * 10) / 10);
    else target = Math.max(1, Math.round(target));
    if (g.v.measure === "check") target = Math.min(target, g.days.length);
    out.push(
      finish(
        {
          itemId: item.id,
          projectId: item.projectId,
          kind,
          key: `${item.id}|${kind}|${periodStart}|${g.days[0]}`,
          start: g.days[0],
          end: g.days[g.days.length - 1],
          periodStart,
          periodEnd,
          measure: g.v.measure,
          unit: g.v.unit,
          target: full ? g.v.target : target,
          value: round2(g.value),
          partial: !full,
        },
        ctx.asOf,
      ),
    );
  }
  return out;
}

/**
 * Every goal instance of the given items over [from, to], indexed for fast lookups.
 * Week and month goals are included for every period that overlaps the range.
 */
export interface Timeline {
  from: ISODate;
  to: ISODate;
  ctx: EngineContext;
  /** Day goals, by date. */
  byDay: Map<ISODate, Instance[]>;
  /** Week goals, by the week's first day. */
  byWeek: Map<ISODate, Instance[]>;
  /** Month goals, by the month's first day. */
  byMonth: Map<ISODate, Instance[]>;
  /** All instances, by item. */
  byItem: Map<string, Instance[]>;
}

export function buildTimeline(items: Item[], from: ISODate, to: ISODate, ctx: EngineContext): Timeline {
  const tl: Timeline = { from, to, ctx, byDay: new Map(), byWeek: new Map(), byMonth: new Map(), byItem: new Map() };
  const push = <K,>(m: Map<K, Instance[]>, k: K, i: Instance) => {
    const list = m.get(k);
    if (list) list.push(i);
    else m.set(k, [i]);
  };

  for (const item of items) {
    if (item.versions.length === 0) continue;
    const first = item.versions[0].effectiveFrom;
    if (first > to) continue;
    const start = maxDate(from, first);
    const usesWeeks = item.versions.some((v) => v.freq === "weekly");
    const usesMonths = item.versions.some((v) => v.freq === "monthly");

    for (const d of eachDay(start, to)) {
      const inst = dayInstance(item, d, ctx);
      if (inst) {
        push(tl.byDay, d, inst);
        push(tl.byItem, item.id, inst);
      }
    }
    if (usesWeeks) {
      for (let ws = startOfWeek(start, ctx.weekStart); ws <= to; ws = addDays(ws, 7)) {
        for (const inst of periodInstances(item, "week", ws, ctx)) {
          push(tl.byWeek, ws, inst);
          push(tl.byItem, item.id, inst);
        }
      }
    }
    if (usesMonths) {
      for (let ms = startOfMonth(start); ms <= to; ms = addMonths(ms, 1)) {
        for (const inst of periodInstances(item, "month", ms, ctx)) {
          push(tl.byMonth, ms, inst);
          push(tl.byItem, item.id, inst);
        }
      }
    }
  }
  for (const list of tl.byItem.values()) list.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
  return tl;
}
