// A robot's conversation turn, the same everywhere (server only): the person's chosen Claude model serves it, the balance
// must cover a typical reply of that model first, and afterwards the reply's real usage + 10% is taken. Free for the
// owner and unlimited accounts. The reply carries `model` and `coins` (halalas taken) for the page.

import { claudeMeter } from "@/lib/coins";
import { withClaude } from "@/lib/film/claude-model";
import { claudeModelOf } from "@config/claude-models";
import { isAdmin } from "@config/site";

export interface RobotUser {
  id: string;
  email?: string | null;
  /** a team series' wallet pays (سجاد in a team) */
  team?: string | null;
}

export async function robotTurn<T extends { usd: number }>(user: RobotUser, modelId: unknown, label: string, run: () => Promise<T>): Promise<T & { model: string; coins: number }> {
  const model = claudeModelOf(modelId);
  const bill = await claudeMeter({ id: user.id, email: user.email, owner: isAdmin(user.email), team: user.team }, model, label);
  const out = await withClaude(model.id, run);
  const coins = await bill.settle(out.usd).catch((e) => {
    console.error("claude settle failed", e);
    return 0;
  });
  return { ...out, model: model.id, coins };
}
