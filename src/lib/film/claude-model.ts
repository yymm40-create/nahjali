// The Claude model of the request being served (server only): a robot's route runs its work inside `withClaude(model, …)`
// and every Claude call below it — the chat itself, the helpers it calls — uses that model and is priced by it.

import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_CLAUDE_MODEL, capClaudeModel, claudeModelOf, type ClaudeModel, type ClaudeModelKey } from "@config/claude-models";
import { journeyModelId, type FilmJourney, type FilmTask } from "@config/film-journey";

const als = new AsyncLocalStorage<ClaudeModel>();

/** Runs `fn` with the person's chosen model (an unknown or missing id is the default). */
export const withClaude = <T>(id: unknown, fn: () => Promise<T>): Promise<T> => als.run(claudeModelOf(id), fn);

/** The model in force for the current request. */
export const currentClaude = (): ClaudeModel => als.getStore() ?? claudeModelOf(null);

/**
 * A job sold at a FIXED price in coins, worked out for the default model («المخرج الخارق», «التعديل الذكي», زينب's
 * prompt): it runs on the person's pick (cheaper for the platform when they chose a lighter mind), but never on a model
 * dearer than the default, which the price would not cover.
 */
export const withFixedPriceClaude = <T>(id: unknown, fn: () => Promise<T>): Promise<T> => withClaude(capClaudeModel(id, claudeModelOf(DEFAULT_CLAUDE_MODEL).key), fn);

// ───────────── «اختر رحلتك» (config/film-journey.ts): a film project's own choice of mind ─────────────

interface JourneyCtx {
  journey: FilmJourney;
  /** the ceiling a code sets on this person's mind (null = none) */
  cap: ClaudeModelKey | null;
}
const journeys = new AsyncLocalStorage<JourneyCtx>();

/** Runs `fn` inside a film's journey: its main mind is the request's model, and each task picks its own (`forTask`). */
export const withFilmJourney = <T>(journey: FilmJourney, cap: ClaudeModelKey | null | undefined, fn: () => Promise<T>): Promise<T> =>
  journeys.run({ journey, cap: cap ?? null }, () => withClaude(journeyModelId(journey, undefined, cap), fn));

/** The journey in force for the current request (null: a project without one — the person's own pick answers). */
export const currentJourney = (): FilmJourney | null => journeys.getStore()?.journey ?? null;

/**
 * Runs one Claude task of the film maker with the mind its journey gives it (the mixed journey: a different mind per
 * task). Outside a journey nothing changes: the request's model answers, as before.
 */
export const forTask = <T>(task: FilmTask, fn: () => Promise<T>): Promise<T> => {
  const j = journeys.getStore();
  return j ? withClaude(journeyModelId(j.journey, task, j.cap), fn) : fn();
};

/**
 * For work handed to `after()`: the model AND the journey of the request are taken now and put back around `fn` when it
 * runs (the reply written in the background answers with the same mind the request chose).
 */
export const keepClaude = <T>(fn: () => Promise<T>): (() => Promise<T>) => {
  const model = currentClaude().id;
  const j = journeys.getStore();
  return () => (j ? journeys.run(j, () => withClaude(model, fn)) : withClaude(model, fn));
};
