import type { Turn } from "./chats";

/** The last step before a new carousel is made: the person picks who designs the slides (the owner's order: no default). */
export const MAKER_LABEL = "من يصمم الشرائح؟";
export const MAKER_CODE = "حيدرا ماكس (كتابة عربية دقيقة بالكود)";
export const MAKER_GPT = "GPT Image 2 (رسم كامل بالذكاء الاصطناعي)";

export const MAKER_QUESTION = { label: MAKER_LABEL, kind: "choice" as const, options: [MAKER_CODE, MAKER_GPT], multi: false };

/** What the person picked for the carousel about to be made: their pressed answer after the last carousel, or null if they did not pick yet. */
export function pickedMaker(history: Turn[]): "code" | "gpt" | null {
  const from = history.map((t) => !!t.slides).lastIndexOf(true) + 1;
  for (let i = history.length - 1; i >= from; i--) {
    const t = history[i];
    if (t.role !== "user") continue;
    const said = t.text.trim();
    if (said === MAKER_CODE) return "code";
    if (said === MAKER_GPT) return "gpt";
  }
  return null;
}
