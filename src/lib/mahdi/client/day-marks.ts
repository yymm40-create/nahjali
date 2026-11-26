// «أيام العذر والقضاء» on the device: the same changes the server makes (POST /api/mahdi/day-marks), applied to a list. Before
// migration 0131 runs the account keeps no marks, so the app keeps them here (per person) and they still count on this device.
import { canMark, cleanMarks, pauseAround, pauseDays, type DayMark, type DayMarkKind, type ISODate, type MarkCheck } from "../engine";

export type MarkOp =
  | { action: "set"; day: ISODate; kind: Exclude<DayMarkKind, "pause"> }
  | { action: "pause"; from: ISODate; days: number }
  | { action: "clear"; day: ISODate }
  | { action: "endPause"; day: ISODate };

/** What the server would answer, worked out here: the new list, or why the change is refused. */
export function applyMark(marks: readonly DayMark[], op: MarkOp, today: ISODate, weekStart: number): { marks: DayMark[] } | { refused: Exclude<MarkCheck, { ok: true }>["reason"] | "pauseLong" } {
  const without = (days: Set<ISODate>) => marks.filter((m) => !days.has(m.day));
  switch (op.action) {
    case "set": {
      const ok = canMark(marks, op.day, op.kind, today, weekStart);
      if (!ok.ok) return { refused: ok.reason };
      return { marks: cleanMarks([...without(new Set([op.day])), { day: op.day, kind: op.kind }]) };
    }
    case "pause": {
      const days = pauseDays(op.from, op.days);
      if (!days) return { refused: "pauseLong" };
      const ok = canMark(marks, op.from, "pause", today, weekStart);
      if (!ok.ok) return { refused: ok.reason };
      return { marks: cleanMarks([...without(new Set(days)), ...days.map((day) => ({ day, kind: "pause" as const }))]) };
    }
    case "clear":
      return { marks: without(new Set([op.day])) };
    case "endPause": {
      const p = pauseAround(marks, op.day);
      if (!p) return { marks: [...marks] };
      return { marks: marks.filter((m) => !(m.kind === "pause" && m.day >= op.day && m.day <= p.to)) };
    }
  }
}

/** The words for a refusal (the same as the server's). */
export const REFUSED: Record<string, string> = {
  future: "ما تقدر تعلّم يوم ما جا للحين.",
  tooOld: "تقدر تعلّم آخر 30 يوم بس.",
  weekFull: "خلصت أيام العذر هالأسبوع (يومين). تقدر توقف عاداتك لين 14 يوم بدالها.",
  notMissed: "القضاء يكون ليوم فات.",
  pauseLong: "الإيقاف من يوم لين 14 يوم.",
};

const key = (userId: string) => `mahdi:day-marks:${userId}`;

export function readDeviceMarks(userId: string): DayMark[] {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? cleanMarks(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeDeviceMarks(userId: string, marks: readonly DayMark[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(marks));
  } catch {}
}
