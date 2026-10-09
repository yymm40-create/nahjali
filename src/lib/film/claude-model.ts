// The Claude model of the request being served (server only): a robot's route runs its work inside `withClaude(model, …)`
// and every Claude call below it — the chat itself, the helpers it calls — uses that model and is priced by it.

import { AsyncLocalStorage } from "node:async_hooks";
import { claudeModelOf, type ClaudeModel } from "@config/claude-models";

const als = new AsyncLocalStorage<ClaudeModel>();

/** Runs `fn` with the person's chosen model (an unknown or missing id is the default). */
export const withClaude = <T>(id: unknown, fn: () => Promise<T>): Promise<T> => als.run(claudeModelOf(id), fn);

/** The model in force for the current request. */
export const currentClaude = (): ClaudeModel => als.getStore() ?? claudeModelOf(null);
