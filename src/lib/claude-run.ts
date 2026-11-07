// A robot's conversation turn, the same everywhere (server only): the person's chosen Claude model serves it, the balance
// must cover a typical reply of that model first, and afterwards the reply's real usage + its profit is taken. Free for the
// owner and unlimited accounts. The reply carries `model` and `coins` (halalas taken) for the page.

import { after } from "next/server";
import { claudeMeter } from "@/lib/coins";
import { withMemory } from "@/lib/memory/context";
import { learn, memoryFor } from "@/lib/memory/server";
import { withClaude } from "@/lib/film/claude-model";
import { claudeModelOf } from "@config/claude-models";
import { isAdmin } from "@config/site";
import { claudeFor } from "@/lib/access-perks";
import { watchTurn } from "@/lib/platform-fault";
import { clearSoftStreak, softTurnIsOurs } from "@/lib/soft-streak";

export interface RobotUser {
  id: string;
  email?: string | null;
  /** a team series' wallet pays (سجاد in a team) */
  team?: string | null;
}

/** What the memory learns from a turn: what the person said, and the robot's reply in the answer. */
export interface Memo<T> {
  said: string;
  reply: (r: T) => string;
}

export interface RobotTurnOptions {
  /** "isolated" keeps this conversation independent from the account-wide assistant memory. */
  memory?: "shared" | "isolated";
  /** "max": «حيدرا ماكس» writing a program for the job, at its own profit (config/claude-models.ts) */
  price?: "claude" | "max";
}

/**
 * Runs a robot's work with the person's memory («ذاكرتي»: on unless they turned it off, for good or for this
 * conversation) read by every Claude call under it, and lets the memory learn from the turn afterwards.
 */
export async function remembering<T>(userId: string, run: () => Promise<T>, memo?: Memo<T>): Promise<T> {
  const mem = await memoryFor(userId).catch(() => ({ notes: "", learn: false }));
  const out = await withMemory(mem.notes, run);
  if (mem.learn && memo?.said?.trim()) {
    const reply = (() => {
      try {
        return memo.reply(out) ?? "";
      } catch {
        return "";
      }
    })();
    try {
      after(() => learn(userId, memo.said, reply, mem.notes));
    } catch {
      void learn(userId, memo.said, reply, mem.notes);
    }
  }
  return out;
}

export async function robotTurn<T extends { usd: number }>(user: RobotUser, modelId: unknown, label: string, run: () => Promise<T>, memo?: Memo<T>, options: RobotTurnOptions = {}): Promise<T & { model: string; coins: number; worth: number }> {
  // a code may cap the model (the owner's «الأكواد»): a dearer pick is served by the ceiling's model
  const model = claudeModelOf(await claudeFor(user.email, modelId));
  const bill = await claudeMeter({ id: user.id, email: user.email, owner: isAdmin(user.email), team: user.team }, model, label, options.price ?? "claude");
  const { out, ours, soft, why } = await watchTurn(() => withClaude(model.id, () => (options.memory === "isolated" ? withMemory("", run) : remembering(user.id, run, memo)))).catch(async (e) => {
    await bill.release().catch(() => {});
    throw e;
  });
  // «الغلط علينا»: something in this turn failed because of the platform's own account at a provider (Claude's,
  // OpenAI's… balance or key): the person pays nothing for the turn, not even the reply — its cost is ours
  if (ours) {
    console.warn("robot turn waived (platform account)", label, why);
    await bill.waive(out.usd).catch(() => {});
    return { ...out, model: model.id, coins: 0, worth: 0 };
  }
  // a content refusal or a busy provider spoiled it: ours for the first three in a row, then charged as usual
  if (soft && !bill.free && (await softTurnIsOurs(user.id).catch(() => false))) {
    console.warn("robot turn waived (refused or busy)", label, why);
    await bill.waive(out.usd).catch(() => {});
    return { ...out, model: model.id, coins: 0, worth: 0 };
  }
  if (!soft && !bill.free) clearSoftStreak(user.id);
  const coins = await bill.settle(out.usd).catch((e) => {
    console.error("claude settle failed", e);
    return 0;
  });
  // `worth`: what was taken, or for a free account what it would have cost — a conversation's running total adds it
  return { ...out, model: model.id, coins, worth: bill.worth };
}
