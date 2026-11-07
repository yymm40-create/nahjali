// «الغلط علينا» (the owner, 7 November 2026): when something a robot was asked to make fails because of the PLATFORM's
// own account at a provider — Claude's, OpenAI's, fal's, BytePlus's or ElevenLabs's balance ran out, its billing or its
// key — the person pays nothing for that turn: not the picture (its job is refunded anyway) and not the robot's reply
// either. The turn's cost is ours. A robot's turn (`robotTurn`) opens a watch; any provider failure inside it reports
// here, and a failure of the platform's account marks the turn (and every turn around it) as ours. Server only.

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * A provider's answer that is the platform's own account, never the person's request: no balance or credit, billing
 * off or overdue, the quota of the account, a key that is wrong, missing or refused.
 */
const OURS =
  /credit balance is too low|insufficient_quota|exceeded your current quota|billing_hard_limit|billing_not_active|billing|invalid_api_key|incorrect api key|invalid x-api-key|authentication_error|permission_error|Claude 40[13]\b|ANTHROPIC_API_KEY is not set|_KEY missing|API key (is )?(missing|not set)|exhausted balance|user is locked|AccountOverdue|OverdueBalance|BalanceNotEnough|InsufficientBalance|ArrearsError|quota_exceeded|insufficient (balance|credits?|funds)|payment required|\b402\b|إعدادات الحساب|رصيد حساب|رصيد مزوّد|حساب المنصة عنده/i;

/** Whether a provider's failure (its detail, or the message shown for it) is the platform's own account. */
export const isPlatformFault = (text: string | null | undefined) => !!text && OURS.test(text);

interface Watch {
  ours: boolean;
  why: string;
  parent: Watch | null;
}
const turns = new AsyncLocalStorage<Watch>();

/** Runs a robot's turn under a watch; `ours` says whether something inside failed because of the platform's account. */
export async function watchTurn<T>(run: () => Promise<T>): Promise<{ out: T; ours: boolean; why: string }> {
  const w: Watch = { ours: false, why: "", parent: turns.getStore() ?? null };
  const out = await turns.run(w, run);
  return { out, ours: w.ours, why: w.why };
}

/** A provider failed: when it is the platform's account, the turn it happened in (and every turn around it) is ours. */
export function reportFailure(...texts: (string | null | undefined)[]) {
  const text = texts.filter(Boolean).join(" ");
  if (!isPlatformFault(text)) return;
  for (let w = turns.getStore() ?? null; w; w = w.parent) {
    w.ours = true;
    if (!w.why) w.why = text.slice(0, 300);
  }
}
