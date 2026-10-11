// «لأجل المهدي» — the home screen's cards («الويدجت»): what each is, the standard set, and reading what the person
// arranged. Pure (the server checks with it, the page draws with it).
//
// The standard home answers three questions at a glance (researched: trackers that win keep the day's state on one
// screen and let a habit be completed in ONE tap — Streaks' big buttons, Duolingo's streak, bento cards of 6–9 tiles):
// how far am I in today's habits, how far in today's reading goal, and what is left to tap. Everything else can be
// added, removed and moved by the person.

export type WidgetId = "habits" | "reading" | "quick" | "priorities" | "tasks" | "week" | "book" | "phrase" | "projects" | "health" | "booklet" | "stories";

export interface WidgetDef {
  id: WidgetId;
  name: string;
  hint: string;
  /** half = two side by side on a phone (the rings); full = the whole width */
  size: "half" | "full";
}

export const WIDGETS: readonly WidgetDef[] = [
  { id: "habits", name: "هدف العادات اليومي", hint: "كم أنجزت من عادات اليوم، وسلسلة أيامك", size: "half" },
  { id: "reading", name: "هدف القراءة اليومي", hint: "كم قرأت اليوم من هدفك", size: "half" },
  { id: "quick", name: "اضغط وأنجز", hint: "عادات اليوم أزرار كبيرة: ضغطة وحدة وتكتمل", size: "full" },
  { id: "priorities", name: "أولويات اليوم", hint: "أهم ثلاث أشياء اليوم", size: "full" },
  { id: "tasks", name: "مهام اليوم", hint: "قائمة المهام السريعة", size: "full" },
  { id: "week", name: "أسبوعك", hint: "أعمدة الأيام السبعة ونسبة الأسبوع", size: "full" },
  { id: "book", name: "الكتاب الحالي", hint: "كتابك وزر «ابدأ القراءة»", size: "full" },
  { id: "phrase", name: "كلمة اليوم", hint: "عبارة تحفيزية تتغير كل يوم", size: "full" },
  { id: "projects", name: "عاداتي حسب المشاريع", hint: "القائمة الكاملة مقسمة على مشاريعك", size: "full" },
  { id: "health", name: "الصحة العلوية", hint: "تمرين اليوم وتقدّمك", size: "full" },
  { id: "booklet", name: "الكتيّب", hint: "كتيّب لأجل المهدي", size: "full" },
  { id: "stories", name: "قصص المتابَعين", hint: "قصص من تتابعهم في المجتمع", size: "full" },
];

/** The standard home: the two goals side by side, the habits to tap, then the day's plan. */
export const DEFAULT_WIDGETS: readonly WidgetId[] = ["habits", "reading", "quick", "priorities", "tasks", "week", "book", "phrase"];

const IDS = new Set<string>(WIDGETS.map((w) => w.id));

/** What the person arranged, checked: known cards only, each once, in their order. */
export function parseWidgets(v: unknown): WidgetId[] {
  if (!Array.isArray(v)) return [...DEFAULT_WIDGETS];
  const out: WidgetId[] = [];
  for (const x of v) if (typeof x === "string" && IDS.has(x) && !out.includes(x as WidgetId)) out.push(x as WidgetId);
  return out;
}

/** The cards to show: the person's own arrangement, or the standard one. */
export const homeWidgets = (saved: unknown): WidgetId[] => (Array.isArray(saved) ? parseWidgets(saved) : [...DEFAULT_WIDGETS]);

/** One card moved up (-1) or down (+1). */
export function moveWidget(list: readonly WidgetId[], id: WidgetId, by: -1 | 1): WidgetId[] {
  const i = list.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const widgetDef = (id: WidgetId) => WIDGETS.find((w) => w.id === id)!;
