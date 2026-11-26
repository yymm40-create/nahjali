// «الصحة العلوية» in the address: every step of its setup and every view of its pages is kept in the link
// (/mahdi/health/setup?step=goal, ?step=build-day&i=2, /mahdi/health?date=…, /mahdi/health/learn?muscle=lats…), so
// «رجوع», a refresh or a shared link come back to the very same screen. Pure.

import type { HealthPlan } from "./plan";

export const HEALTH = "/mahdi/health";

/** The setup's screens, in order: the five questions, then the two «أختار بنفسي» builders. */
export const SETUP_STEPS = ["track", "about", "goal", "train", "mode", "build-food", "build-day"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
/** the questions (the barbell on top counts these) */
export const WIZARD_STEPS: readonly SetupStep[] = ["track", "about", "goal", "train", "mode"];
/** the nutrition builder's targets, one screen each */
export const FOOD_STEPS = ["kcal", "proteinG", "waterCups", "produce", "steps"] as const;

export const isSetupStep = (x: unknown): x is SetupStep => typeof x === "string" && (SETUP_STEPS as readonly string[]).includes(x);

/** A whole number from the link, inside 0…max (anything else is 0). */
export function parseIndex(raw: string | null | undefined, max: number): number {
  if (!raw || !/^\d{1,3}$/.test(raw)) return 0;
  return Math.min(Math.max(0, Number(raw)), Math.max(0, max));
}

/** The link of a setup screen (the first question has the plain link). */
export function setupHref(step: SetupStep = "track", i = 0): string {
  if (step === "track") return `${HEALTH}/setup`;
  const q = new URLSearchParams({ step });
  if ((step === "build-food" || step === "build-day") && i > 0) q.set("i", String(Math.floor(i)));
  return `${HEALTH}/setup?${q}`;
}

/**
 * The setup screen a link opens. A builder needs the plan it builds (opened from an old link or before the plan was
 * made, it falls back to «كيف تبي خطتك؟»), and its index stays inside the plan's days or the nutrition targets.
 */
export function resolveSetup(rawStep: string | null | undefined, rawI: string | null | undefined, plan: HealthPlan | null): { step: SetupStep; i: number } {
  const step: SetupStep = isSetupStep(rawStep) ? rawStep : "track";
  if (step === "build-food") return plan?.food ? { step, i: parseIndex(rawI, FOOD_STEPS.length - 1) } : { step: "mode", i: 0 };
  if (step === "build-day") {
    const n = plan?.workout && !plan.workout.blocked ? plan.workout.days.length : 0;
    return n ? { step, i: parseIndex(rawI, n - 1) } : { step: "mode", i: 0 };
  }
  return { step, i: 0 };
}

/** A day of the tracker from the link (YYYY-MM-DD, a real date), else today. */
export function parseDay(raw: string | null | undefined, today: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;
  const d = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? today : raw;
}

/** The session picked on the tracker (a weekday 0–6 that is a day of the plan), else null. */
export function parseSession(raw: string | null | undefined, weekdays: readonly number[]): number | null {
  if (!raw || !/^[0-6]$/.test(raw)) return null;
  const n = Number(raw);
  return weekdays.includes(n) ? n : null;
}

/**
 * The same address with some of its search values changed: null/""/false take a value out (a view's default leaves
 * the link clean), and the order of the others is kept.
 */
export function withParams(path: string, current: string, patch: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "" || v === false) q.delete(k);
    else q.set(k, v === true ? "1" : String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** The four views of «الصحة العلوية», a row on top of each of them (instead of its own second bar). */
export const HEALTH_VIEWS = [
  { href: HEALTH, label: "اليوم" },
  { href: `${HEALTH}/plan`, label: "خطتي" },
  { href: `${HEALTH}/progress`, label: "التقدم" },
  { href: `${HEALTH}/learn`, label: "تعلّم" },
] as const;

/** The view a page belongs to (null on the inner screens: the setup, the habits, the research, an exercise). */
export function healthViewOf(path: string): (typeof HEALTH_VIEWS)[number] | null {
  return HEALTH_VIEWS.find((v) => v.href === path) ?? null;
}

/** What عباس is told about where the person is: the setup's step, or the page. */
export function coachScreen(path: string, step: string | null | undefined): string {
  if (path === `${HEALTH}/setup`) return isSetupStep(step) ? step : "track";
  return (path.split(`${HEALTH}/`)[1] ?? "today").split("/")[0] || "today";
}
