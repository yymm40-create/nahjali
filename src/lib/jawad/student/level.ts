// «الطالب الذكي» · «🧪 اختبر فهمي» — turning a student's answers into a LEVEL (how well they understood the material),
// with the weak spots to go back to. Pure: no server, no model, no cost — the page and the tests both use it.
//
// A question is worth one point. A multiple-choice or true/false answer is marked by the site; a written answer
// (short / essay / long) is marked by the student themselves against the model answer — right, partly, or not — and
// counts one, a half, or nothing. Nothing is hidden: the verdict says how many of each were marked by whom.

import type { Question } from "./model";

/** What the student said of a written answer, once the model answer was in front of them. */
export type SelfMark = "right" | "partly" | "wrong";

export interface Level {
  id: "start" | "partial" | "good" | "strong" | "master";
  /** from this percentage up */
  from: number;
  name: string;
  emoji: string;
  /** one line: what the level means */
  says: string;
  /** what to do next at this level */
  next: string;
}

/** The levels, lowest first. The thresholds are the page's own and are shown to the student beside the verdict. */
export const LEVELS_OF_UNDERSTANDING: readonly Level[] = [
  { id: "start", from: 0, name: "في البداية", emoji: "🌱", says: "المادة لسا ما استقرت عندك.", next: "ارجع للمادة من أولها: اقرأ الملخص أو اطلب الشرح، وبعدها أعد الاختبار." },
  { id: "partial", from: 40, name: "فهم جزئي", emoji: "🧩", says: "عندك أساس، وفيه نقاط لسا ناقصة.", next: "ركّز على النقاط اللي أخطأت فيها تحت، وراجعها في الملخص أو في بطاقات المراجعة." },
  { id: "good", from: 60, name: "فهم جيد", emoji: "📘", says: "فاهم أغلب المادة، وتبقى لك تفاصيل.", next: "اضغط على أخطائك بالتحديد: اختبار جديد يركّز عليها يكفي." },
  { id: "strong", from: 75, name: "متمكّن", emoji: "🎯", says: "تمسك المادة وتجاوب بثقة.", next: "جرّب صعوبة أعلى، أو اشرح المادة لغيرك: هذا أقوى اختبار للفهم." },
  { id: "master", from: 90, name: "متقن", emoji: "🏆", says: "المادة عندك مضبوطة.", next: "انتقل لمادة جديدة، وارجع لهذي قبل الاختبار بيوم للتثبيت." },
];

/** The level a percentage (0–100) falls in. Anything out of range or not a number is the lowest level. */
export function levelOf(percent: number): Level {
  const p = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  let found = LEVELS_OF_UNDERSTANDING[0];
  for (const l of LEVELS_OF_UNDERSTANDING) if (p >= l.from) found = l;
  return found;
}

/** Whether a question is marked by the site (it has options and one right answer) or by the student (it is written). */
export const isAutoMarked = (q: Pick<Question, "type" | "options">) => q.options.length > 0 && (q.type === "mcq" || q.type === "tf");

const POINT: Record<SelfMark, number> = { right: 1, partly: 0.5, wrong: 0 };

/** One answered question of a test: what was asked, and what it earned (0, a half, or 1). */
export interface Marked {
  index: number;
  question: Question;
  points: number;
  /** by the site, or by the student against the model answer */
  by: "site" | "self";
}

/** Marks one answer. A choice answer is right only when it is the model answer exactly; a written one by the student's mark. */
export function mark(q: Question, index: number, answer: string, self?: SelfMark): Marked {
  if (isAutoMarked(q)) return { index, question: q, points: String(answer ?? "").trim() === q.answer.trim() ? 1 : 0, by: "site" };
  return { index, question: q, points: POINT[self ?? "wrong"], by: "self" };
}

export interface Verdict {
  /** 0–100, rounded; 0 when nothing was answered */
  percent: number;
  points: number;
  total: number;
  level: Level;
  /** the questions that earned less than a point, the worst first (wrong, then partly) */
  weak: Marked[];
  bySite: number;
  bySelf: number;
}

/** The verdict on a finished test. */
export function verdict(marked: Marked[]): Verdict {
  const total = marked.length;
  const points = marked.reduce((n, m) => n + m.points, 0);
  const percent = total ? Math.round((points / total) * 100) : 0;
  return {
    percent,
    points,
    total,
    level: levelOf(percent),
    weak: marked.filter((m) => m.points < 1).sort((a, b) => a.points - b.points || a.index - b.index),
    bySite: marked.filter((m) => m.by === "site").length,
    bySelf: marked.filter((m) => m.by === "self").length,
  };
}
