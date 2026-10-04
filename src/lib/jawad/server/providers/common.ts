// JAWAD AI — what every provider adapter reports. Server only.
import { createHash } from "crypto";

/**
 * A provider call that did not produce a result.
 *  • rejected: the provider answered with an error (nothing was generated; safe to refund and let the user retry)
 *  • unknown:  no answer (timeout / connection lost): the provider may have accepted it, so it is never re-sent blindly
 */
export class ProviderError extends Error {
  constructor(
    public outcome: "rejected" | "unknown",
    /** Arabic, safe to show the user (no secrets, no internals). */
    public userMessage: string,
    /** For the owner's job log only. */
    public detail: string,
  ) {
    super(detail);
  }
}

/** A stable, anonymous id of the user for the providers' abuse monitoring (`user` / `safety_identifier`). */
export const providerUserId = (userId: string) => createHash("sha256").update(`jawad:${userId}`).digest("hex").slice(0, 32);

/** Turns a provider's HTTP error into a message the user can act on. */
export function rejectedMessage(status: number, text: string) {
  const t = text.toLowerCase();
  if (status === 400 && /(safety|moderation|policy|sensitive|content_policy|riskcontrol|risk)/.test(t)) {
    return "رفض المزوّد الطلب لأنه قد يخالف سياسة المحتوى. عدّل البرومبت أو المراجع وجرّب.";
  }
  if (status === 400) return "رفض المزوّد الطلب (إعداد أو ملف غير مقبول). راجع الإعدادات والمراجع وجرّب.";
  if (status === 401 || status === 403) return "تعذّر الاتصال بالمزوّد حاليًا (إعدادات الحساب). أبلغنا بالمشكلة.";
  if (status === 429) return "المزوّد مشغول حاليًا. جرّب بعد قليل.";
  return "صار خطأ عند المزوّد. جرّب بعد قليل.";
}
