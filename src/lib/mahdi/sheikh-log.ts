// «أسئلة الشيخ الذكي» for the owner: every question people asked the sheikh, with its answer, and the numbers.
// Nobody is named: each person is a number by the order they first asked («شخص ١», «شخص ٢»…); the owner is «أنت».
// Pure, so the server, the page and the tests share it.
import type { SheikhMode, SheikhSource } from "./sheikh";

/** A message as kept in mahdi_sheikh_messages (only what the log needs). */
export interface SheikhLogRow {
  user_id: string;
  role: "user" | "sheikh";
  mode?: SheikhMode | null;
  body: string;
  sources: SheikhSource[] | null;
  usd: number | string;
  report: string | null;
  created_at: string;
}

export interface SheikhLogQuestion {
  /** 0 = the owner, 1… = the others by the order they first asked */
  person: number;
  mode: SheikhMode;
  at: string;
  question: string;
  answer: string | null;
  sources: number;
  usd: number;
  /** seconds from the question to the answer (null when no answer came) */
  secs: number | null;
  report: string | null;
}

export interface SheikhLogStats {
  questions: number;
  people: number;
  /** without the owner */
  othersQuestions: number;
  othersPeople: number;
  /** others who asked more than once */
  cameBack: number;
  quick: number;
  deep: number;
  avgSecs: Record<SheikhMode, number | null>;
  usd: number;
  othersUsd: number;
  avgUsd: Record<SheikhMode, number | null>;
  noAnswer: number;
  noSources: number;
  reports: number;
  /** the same question asked more than once, most asked first */
  top: { question: string; times: number; people: number }[];
  /** questions per day (Riyadh time), oldest first */
  days: { day: string; questions: number; people: number }[];
}

const RIYADH_MS = 3 * 3600_000;
export const riyadhDay = (iso: string) => new Date(Date.parse(iso) + RIYADH_MS).toISOString().slice(0, 10);
const same = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[؟?.!،]+$/u, "");
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Pairs each question with the sheikh's next answer to the same person, numbers the people, and counts. */
export function sheikhLog(rows: SheikhLogRow[], ownerId: string | null): { questions: SheikhLogQuestion[]; stats: SheikhLogStats } {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const person = new Map<string, number>();
  const pending = new Map<string, SheikhLogQuestion>();
  const questions: SheikhLogQuestion[] = [];
  for (const r of sorted) {
    if (r.role === "user") {
      if (!person.has(r.user_id)) person.set(r.user_id, r.user_id === ownerId ? 0 : [...person.keys()].filter((k) => k !== ownerId).length + 1);
      const q: SheikhLogQuestion = {
        person: person.get(r.user_id)!,
        mode: r.mode === "deep" ? "deep" : "quick",
        at: r.created_at,
        question: r.body,
        answer: null,
        sources: 0,
        usd: 0,
        secs: null,
        report: null,
      };
      questions.push(q);
      pending.set(r.user_id, q);
    } else {
      const q = pending.get(r.user_id);
      if (!q) continue;
      pending.delete(r.user_id);
      q.answer = r.body;
      q.sources = Array.isArray(r.sources) ? r.sources.length : 0;
      q.usd = Number(r.usd) || 0;
      q.secs = Math.max(0, Math.round((Date.parse(r.created_at) - Date.parse(q.at)) / 1000));
      q.report = r.report;
    }
  }

  const others = questions.filter((q) => q.person !== 0);
  const perOther = new Map<number, number>();
  for (const q of others) perOther.set(q.person, (perOther.get(q.person) ?? 0) + 1);
  const answered = questions.filter((q) => q.answer !== null);
  const byMode = (m: SheikhMode) => answered.filter((q) => q.mode === m);

  const groups = new Map<string, { question: string; times: number; who: Set<number> }>();
  for (const q of questions) {
    const k = same(q.question);
    const g = groups.get(k) ?? { question: q.question.trim(), times: 0, who: new Set<number>() };
    g.times++;
    g.who.add(q.person);
    groups.set(k, g);
  }
  const daysMap = new Map<string, { questions: number; who: Set<number> }>();
  for (const q of questions) {
    const d = riyadhDay(q.at);
    const e = daysMap.get(d) ?? { questions: 0, who: new Set<number>() };
    e.questions++;
    e.who.add(q.person);
    daysMap.set(d, e);
  }

  const stats: SheikhLogStats = {
    questions: questions.length,
    people: person.size,
    othersQuestions: others.length,
    othersPeople: perOther.size,
    cameBack: [...perOther.values()].filter((n) => n > 1).length,
    quick: questions.filter((q) => q.mode === "quick").length,
    deep: questions.filter((q) => q.mode === "deep").length,
    avgSecs: { quick: avg(byMode("quick").map((q) => q.secs!)), deep: avg(byMode("deep").map((q) => q.secs!)) },
    usd: questions.reduce((a, q) => a + q.usd, 0),
    othersUsd: others.reduce((a, q) => a + q.usd, 0),
    avgUsd: { quick: avg(byMode("quick").map((q) => q.usd)), deep: avg(byMode("deep").map((q) => q.usd)) },
    noAnswer: questions.length - answered.length,
    noSources: answered.filter((q) => q.sources === 0).length,
    reports: questions.filter((q) => q.report).length,
    top: [...groups.values()]
      .filter((g) => g.times > 1)
      .sort((a, b) => b.times - a.times || b.who.size - a.who.size)
      .slice(0, 10)
      .map((g) => ({ question: g.question, times: g.times, people: g.who.size })),
    days: [...daysMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, e]) => ({ day, questions: e.questions, people: e.who.size })),
  };
  return { questions: questions.reverse(), stats };
}
