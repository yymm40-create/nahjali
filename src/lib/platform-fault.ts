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

/**
 * The provider refused what was asked for its content policy, or was busy / down for a moment (after its own retries):
 * not the platform's account, not quite the person's fault either — ours for the first SOFT.free in a row, then theirs.
 */
const SOFT =
  /SensitiveContent|PolicyViolation|moderation|safety system|content.?policy|content_filter|RiskControl|سياسة المحتوى|rate.?limit|RateLimit|\b429\b|overloaded|\b529\b|\b503\b|ServiceUnavailable|InternalServiceError|server_error|مشغول|\bbusy\b/i;
export const isSoftFault = (text: string | null | undefined) => !!text && !isPlatformFault(text) && SOFT.test(text);

/**
 * The owner's rule (7 November 2026): a turn spoiled by a content refusal or a busy provider costs the person nothing
 * for `free` such turns in a row — a turn counts as «in a row» when it comes within `withinMs` of the last one — and
 * from the next one on it is charged as usual. A turn that went through clears the count.
 */
export const SOFT_RULE = { free: 3, withinMs: 10 * 60_000 } as const;

/** The count after one more spoiled turn now (`prev`: the count and when the last one was), and whether it is ours. */
export function nextSoft(prev: { count: number; at: number } | null, now = Date.now()): { count: number; at: number; ours: boolean } {
  const count = prev && now - prev.at <= SOFT_RULE.withinMs ? prev.count + 1 : 1;
  return { count, at: now, ours: count <= SOFT_RULE.free };
}

interface Watch {
  ours: boolean;
  soft: boolean;
  why: string;
  parent: Watch | null;
}
const turns = new AsyncLocalStorage<Watch>();

/**
 * Runs a robot's turn under a watch: `ours` — something inside failed because of the platform's account; `soft` — a
 * content refusal or a busy provider spoiled it (see SOFT_RULE).
 */
export async function watchTurn<T>(run: () => Promise<T>): Promise<{ out: T; ours: boolean; soft: boolean; why: string }> {
  const w: Watch = { ours: false, soft: false, why: "", parent: turns.getStore() ?? null };
  const out = await turns.run(w, run);
  return { out, ours: w.ours, soft: w.soft, why: w.why };
}

const mark = (text: string, key: "ours" | "soft") => {
  for (let w = turns.getStore() ?? null; w; w = w.parent) {
    w[key] = true;
    if (!w.why) w.why = text.slice(0, 300);
  }
};

/** A provider failed: when it is the platform's account, the turn it happened in (and every turn around it) is ours. */
export function reportFailure(...texts: (string | null | undefined)[]) {
  const text = texts.filter(Boolean).join(" ");
  if (isPlatformFault(text)) mark(text, "ours");
}

/**
 * A provider failed FOR GOOD (its retries spent, the job ended): the platform's account as above, or a content refusal
 * or a busy provider (the soft kind, never reported while a retry may still go through).
 */
export function reportFinalFailure(...texts: (string | null | undefined)[]) {
  const text = texts.filter(Boolean).join(" ");
  if (isPlatformFault(text)) mark(text, "ours");
  else if (isSoftFault(text)) mark(text, "soft");
}
