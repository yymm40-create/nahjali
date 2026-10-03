// What a share card says. Pure: the server runs the same function on its own copy of the data before posting,
// so numbers in the community always come from real logs.
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { MILESTONES } from "@config/mahdi-rewards";
import { compare, dayScore, dayStreak, itemStreak, periodOf, previousPeriod, readingSummary, scoreBy, weekGoals, startOfWeek, type Timeline } from "../engine";
import { fmtPct, fmtPoints, t } from "../i18n";
import type { Snapshot } from "../types";

export const SHARE_KINDS = ["week", "month", "day", "streak", "compare", "project", "habit", "milestone", "reading", "book"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export interface ShareOptions {
  kind: ShareKind;
  showDelta?: boolean;
  projectId?: string;
  habitId?: string;
  milestoneId?: string;
  bookId?: string;
}

export interface SharePayload {
  kind: ShareKind;
  /** e.g. «التزام هذا الأسبوع» */
  title: string;
  /** e.g. «87%» */
  value: string;
  /** e.g. «تحسن +12 نقطة عن الأسبوع الماضي» */
  sub: string;
  /** project / habit / milestone name */
  label: string;
}

/** Null when there is nothing honest to show (e.g. no data yet). */
export function buildShare(tl: Timeline, snap: Pick<Snapshot, "projects" | "habits" | "rewards" | "reading">, o: ShareOptions): SharePayload | null {
  const ws = tl.ctx.weekStart;
  const week = periodOf("week", tl.ctx.asOf, ws);
  const cw = compare(tl, previousPeriod(week, ws), week);
  const deltaLine = o.showDelta && cw.delta !== null && Math.round(cw.delta) !== 0 ? t.share.deltaLine(fmtPoints(cw.delta)) : "";
  const base = { kind: o.kind, sub: "", label: "" };

  switch (o.kind) {
    case "week":
      return cw.scoreB.score === null ? null : { ...base, title: t.share.cardWeek, value: fmtPct(cw.scoreB.score), sub: deltaLine };
    case "month": {
      const m = periodOf("month", tl.ctx.asOf, ws);
      const c = compare(tl, previousPeriod(m, ws), m);
      return c.scoreB.score === null ? null : { ...base, title: t.share.cardMonth, value: fmtPct(c.scoreB.score) };
    }
    case "day": {
      const s = dayScore(tl, tl.ctx.asOf).score;
      return s === null ? null : { ...base, title: t.share.cardDay, value: fmtPct(s) };
    }
    case "streak": {
      const s = dayStreak(tl, CONSISTENCY_THRESHOLD).current;
      return s < 1 ? null : { ...base, title: t.share.cardStreak, value: t.units.days(s) };
    }
    case "compare":
      return cw.delta === null ? null : { ...base, title: t.share.cardCompare, value: fmtPoints(cw.delta), sub: `${fmtPct(cw.scoreA.score)} ← ${fmtPct(cw.scoreB.score)}` };
    case "project": {
      const p = snap.projects.find((x) => x.id === o.projectId);
      const s = p ? scoreBy(weekGoals(tl, startOfWeek(tl.ctx.asOf, ws)), (i) => i.projectId).get(p.id)?.score ?? null : null;
      return !p || s === null ? null : { ...base, title: t.share.cardWeek, value: fmtPct(s), label: p.name };
    }
    case "habit": {
      const h = snap.habits.find((x) => x.id === o.habitId);
      if (!h) return null;
      const s = scoreBy(weekGoals(tl, startOfWeek(tl.ctx.asOf, ws)), (i) => i.itemId).get(h.id)?.score ?? null;
      const st = itemStreak(tl, h.id);
      return s === null ? null : { ...base, title: t.share.cardWeek, value: fmtPct(s), label: h.name, sub: st.current > 1 ? `${t.habit.streak}: ${st.current}` : "" };
    }
    case "reading": {
      const w = readingSummary(snap.reading.sessions, tl.ctx.asOf, ws).week;
      if (w.seconds < 60 && w.pages === 0 && w.narrations === 0) return null;
      const m = Math.floor(w.seconds / 60);
      const sub = [w.pages ? t.reading.pages(w.pages) : "", w.narrations ? t.reading.narrations(w.narrations) : ""].filter(Boolean).join(" · ");
      return { ...base, title: t.share.cardReading, value: t.reading.hours(Math.floor(m / 60), m % 60), sub };
    }
    case "book": {
      const e = snap.reading.library.find((x) => x.book.id === o.bookId && x.state === "finished");
      return e ? { ...base, title: t.share.cardBook, value: e.book.title, label: e.book.author, sub: t.reading.u[e.book.unit].count(e.book.pages) } : null;
    }
    case "milestone": {
      const m = MILESTONES.find((x) => x.id === o.milestoneId);
      return !m || !snap.rewards.some((r) => r.milestoneId === m.id) ? null : { ...base, title: t.share.cardMilestone, value: m.title, label: m.description };
    }
  }
}
