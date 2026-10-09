// The Claude models every robot of the site can talk with, the person's choice in each conversation. Pure (pages and
// server alike). Rates are USD per million tokens (platform.claude.com/docs/en/about-claude/pricing, checked 2026-10-09).
// A robot's price is the real usage of the model chosen plus the platform's 10% — see `claudeHalalas` in config/coins.ts.

export type ClaudeModelKey = "fable" | "opus" | "sonnet" | "haiku";

export interface ClaudeRates {
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
}

export interface ClaudeModel {
  key: ClaudeModelKey;
  /** the API id */
  id: string;
  /** the name the person sees: our own, never the maker's or the model's (nothing in the pages says whose it is) */
  name: string;
  /** one line: what it is */
  tagline: string;
  /** the advice shown with it: when to pick it and when not to */
  advice: string;
  rates: ClaudeRates;
  /** a request whose prompt is longer than this many tokens is priced at `longRates` (Haiku 5.5 only) */
  longAbove?: number;
  longRates?: ClaudeRates;
  /** whether the model takes the `effort` setting */
  effort: boolean;
}

export const CLAUDE_MODELS: readonly ClaudeModel[] = [
  {
    key: "fable",
    id: "claude-fable-5-1",
    name: "العبقري",
    tagline: "الأقوى والأغلى",
    advice: "استخدمه بس للمهام المعقدة جدًا والصعبة حيل: تخطيط طويل، تحليل عميق، شغل ما قدر عليه غيره. للشغل العادي لا تستخدمه؛ يغلّي عليك الرصيد بدون فرق يبين.",
    rates: { input: 10, cacheWrite5m: 12.5, cacheWrite1h: 20, cacheRead: 0.25, output: 50 },
    effort: true,
  },
  {
    key: "opus",
    id: "claude-opus-5-5",
    name: "الأصيل",
    tagline: "صاحب أغلب المهمات (الافتراضي)",
    advice: "الاختيار الافتراضي لأغلب الشغل: كتابة وتخطيط وتعديل ومحادثات طويلة بجودة عالية وسعر معقول.",
    rates: { input: 4, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2, output: 20 },
    effort: true,
  },
  {
    key: "sonnet",
    id: "claude-sonnet-5-5",
    name: "الرشيق",
    tagline: "سريع وسعره وسط",
    advice: "للشغل اليومي لما تبي الشغل يمشي سريع: أسئلة، تعديلات، صياغة، أفكار. يكفي في أغلب الحالات وأرخص من الأصيل.",
    rates: { input: 2, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.1, output: 10 },
    effort: true,
  },
  {
    key: "haiku",
    id: "claude-haiku-5-5",
    name: "الخفيف",
    tagline: "الأسرع والأرخص",
    advice: "للأشياء الخفيفة والسريعة: أسئلة قصيرة، ترتيب أفكار، تصحيح كلام. أرخص بكثير، لكنه ما يناسب الشغل الطويل المعقد.",
    rates: { input: 0.1, cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, output: 0.5 },
    longAbove: 100_000,
    longRates: { input: 0.5, cacheWrite5m: 0.625, cacheWrite1h: 1, cacheRead: 0.05, output: 2.5 },
    effort: false,
  },
];

/** The model a robot uses when the person has not chosen. */
export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

export const findClaudeModel = (id: unknown): ClaudeModel | null => (typeof id === "string" ? CLAUDE_MODELS.find((m) => m.id === id) ?? null : null);

/** The model for a request body's `model` (anything unknown is the default). */
export const claudeModelOf = (id: unknown): ClaudeModel => findClaudeModel(id) ?? CLAUDE_MODELS.find((m) => m.id === DEFAULT_CLAUDE_MODEL)!;

/** The model that answered, from the API's `model` field (it may carry a date suffix); null when it is none of ours. */
export const servedModel = (id: unknown): ClaudeModel | null =>
  typeof id === "string" ? CLAUDE_MODELS.find((m) => id === m.id || id.startsWith(`${m.id}-`)) ?? null : null;

/** What a typical chat reply uses (the site's knowledge as the prompt, a medium answer): the balance a conversation needs to start. */
export const TYPICAL_REPLY = { inputTokens: 20_000, outputTokens: 2_000 } as const;
export const typicalReplyUsd = (m: ClaudeModel) => (TYPICAL_REPLY.inputTokens * m.rates.input + TYPICAL_REPLY.outputTokens * m.rates.output) / 1_000_000;

/** The platform's only profit on Claude's usage, in percent — shown to the person wherever the model is chosen. */
export const CLAUDE_MARGIN_PCT = 10;

/** Where the person's choice is kept on this device. */
export const CLAUDE_MODEL_KEY = "jw-claude-model";
