// «اختر رحلتك»: which mind writes a film's texts, chosen once for the whole project (the owner, 22 November 2026:
// «رحلة كاملة هايكو، ورحلة كاملة أصيل، والخيار الثالث المخلط: كل مهمة بما يتناسب — ونحط يمه منصوح به»). Pure (pages and
// server alike). The person sees our own names only (config/claude-models.ts), never the maker's or the model's.

import { CLAUDE_MODELS, capClaudeModel, type ClaudeModelKey } from "./claude-models";

export type FilmJourney = "mixed" | "opus" | "haiku";

export interface FilmJourneyDef {
  key: FilmJourney;
  icon: string;
  /** the name the person sees */
  name: string;
  /** one line: what it is */
  tagline: string;
  /** when to pick it and what it costs in quality */
  advice: string;
  /** «منصوح به» sits beside this one */
  recommended?: true;
}

/** In the order they are shown: the recommended one first. */
export const FILM_JOURNEYS: readonly FilmJourneyDef[] = [
  {
    key: "mixed",
    icon: "🎛️",
    name: "الرحلة المخلّطة",
    tagline: "كل مهمة بالعقل اللي يناسبها",
    advice: "الشغل الثقيل (السيناريو، أوصاف الشيتات، خريطة اللقطات وبرومبتات الفيديو) يكتبه «الأصيل»، والباقي بعقل أخف وأرخص. اللي تنبني عليه الصور والفيديو يبقى بأقوى عقل، والسعر أقل.",
    recommended: true,
  },
  {
    key: "opus",
    icon: "🎬",
    name: "رحلة الأصيل",
    tagline: "كل شي بأقوى عقل · الأغلى",
    advice: "كل رد في الرحلة يكتبه «الأصيل»، حتى المهام الخفيفة. أعلى جودة في كل خطوة، وأغلى سعر.",
  },
  {
    key: "haiku",
    icon: "🪶",
    name: "رحلة الخفيف",
    tagline: "كل شي بأخف عقل · الأرخص",
    advice: "كل رد يكتبه «الخفيف»: أرخص بكثير وأسرع، لكن الكتابة والإخراج أبسط، وقد تحتاج تعدّل أو تعيد توليد أكثر. تناسب التجربة والأفكار البسيطة.",
  },
];

/** The journey a new project starts with (the recommended one). */
export const DEFAULT_FILM_JOURNEY: FilmJourney = "mixed";

export const isFilmJourney = (v: unknown): v is FilmJourney => typeof v === "string" && FILM_JOURNEYS.some((j) => j.key === v);
export const filmJourneyOf = (v: unknown): FilmJourneyDef | null => FILM_JOURNEYS.find((j) => j.key === v) ?? null;

/** Every kind of text the film maker asks Claude for (a conversation robot's reply is named by the deliverable it writes). */
export type FilmTask =
  | "intake"
  | "script.understanding"
  | "script.questions"
  | "script.screenplay"
  | "script.handoff"
  | "sheets.plan"
  | "sheets.prompt"
  | "sheets.understand_edit"
  | "sheets.likeness"
  | "director.understanding"
  | "director.shots"
  | "voice.describe"
  | "impact"
  | "watch";

/**
 * The mixed journey: the mind that suits each task. «الأصيل» writes what the film is made of and what a mistake in costs a
 * paid picture or video; «الرشيق» reads, plans and checks; «الخفيف» restates and describes.
 */
export const MIXED_TASK_MODEL: Record<FilmTask, ClaudeModelKey> = {
  // سجاد understands the idea and asks what is missing
  intake: "sonnet",
  // the screenwriter: «فهمت قصتك» is a restatement the person reads and corrects
  "script.understanding": "haiku",
  // the one round of questions for the whole journey (story, design, directing)
  "script.questions": "sonnet",
  // the developed story and the screenplay: the film itself
  "script.screenplay": "opus",
  // the handoff copies the approved screenplay whole and lists the characters and decisions
  "script.handoff": "sonnet",
  // the sheet maker: which sheets, and its questions
  "sheets.plan": "sonnet",
  // every sheet's English prompt: a paid picture is drawn from each
  "sheets.prompt": "opus",
  // «فهمت تعديلك» in two lines
  "sheets.understand_edit": "haiku",
  // a real person's photograph described for the cartoon: the likeness depends on it
  "sheets.likeness": "opus",
  // the director reads both handoffs and the references and says what he understood
  "director.understanding": "sonnet",
  // the generation map and every generation's prompt (English and Chinese): a paid video is made from each
  "director.shots": "opus",
  // a character's voice described for the voice designer
  "voice.describe": "haiku",
  // «الرجوع الذكي»: what an edited screenplay reaches
  impact: "sonnet",
  // سجاد's continuity watch between a series' scenes
  watch: "sonnet",
};

/** The mind of a journey for a task (a journey of one mind answers every task with it; no task = the journey's main mind). */
export const journeyModelKey = (journey: FilmJourney, task?: FilmTask): ClaudeModelKey => (journey === "mixed" ? (task ? MIXED_TASK_MODEL[task] : "opus") : journey);

/** The model id to serve, under a code's ceiling («الأكواد»: a dearer mind is served by the ceiling's). */
export const journeyModelId = (journey: FilmJourney, task?: FilmTask, cap?: ClaudeModelKey | null): string =>
  capClaudeModel(CLAUDE_MODELS.find((m) => m.key === journeyModelKey(journey, task))!.id, cap);

/** The journeys a person may pick under a code's ceiling: «رحلة الأصيل» needs «الأصيل» itself. */
export const journeysUpTo = (cap: ClaudeModelKey | null | undefined): readonly FilmJourneyDef[] =>
  cap === "haiku" || cap === "sonnet" ? FILM_JOURNEYS.filter((j) => j.key !== "opus") : FILM_JOURNEYS;

/** Where a new film's choice is remembered on this device (the next film starts with it). */
export const FILM_JOURNEY_KEY = "jw-film-journey";

const SCRIPT_KIND_TASK: Record<string, FilmTask> = {
  understanding: "script.understanding",
  questions: "script.questions",
  story: "script.screenplay",
  screenplay: "script.screenplay",
  handoff: "script.handoff",
};
/** What the screenwriter writes after «اعتمد» on each of his deliverables. */
const SCRIPT_NEXT: Record<string, FilmTask> = {
  understanding: "script.questions",
  questions: "script.screenplay",
  story: "script.screenplay",
  screenplay: "script.handoff",
  handoff: "script.handoff",
};

/**
 * The screenwriter's next reply, named before it is written: from the person's latest message and his deliverables so
 * far (any order; `created_at` sorts them). «اعتمد» asks for what follows the latest deliverable, the answers ask for
 * the story and the screenplay, and an edit rewrites the latest deliverable — once a screenplay exists, an edit is
 * always the screenplay's (a story change flows into it), so the film's writing never drops to a lighter mind.
 */
export function scriptTask(lastUser: string, versions: readonly { kind: string; created_at: string }[]): FilmTask {
  const sorted = [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latest = sorted.at(-1)?.kind;
  if (!latest) return "script.understanding";
  const said = lastUser.trim();
  if (said === "اعتمد") return SCRIPT_NEXT[latest] ?? "script.screenplay";
  if (said.startsWith("إجاباتي:")) return "script.screenplay";
  if (sorted.some((v) => v.kind === "screenplay" || v.kind === "story")) return "script.screenplay";
  return SCRIPT_KIND_TASK[latest] ?? "script.screenplay";
}
