// «الطالب الذكي» — the settings the assistant chooses when the student doesn't (shared by the server, which
// pre-fills every new output with them, and by «تخطَّ ودع المساعد يقرر» in the browser). No server imports here.

import { STYLES, defaultDesign, type StyleId } from "@config/jawad/student";

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const randomStyle = (): StyleId => pick(STYLES.map((s) => s.id));

/** Sensible settings for an output of this kind, for a student of this level (a design picked at random). */
export function autoSettings(kind: string, level: string): Record<string, unknown> {
  const young = /ابتدائي|متوسط/.test(level);
  switch (kind) {
    case "summary":
      return { purpose: "مراجعة المادة", density: young ? "low" : "medium", tone: young ? "بسيطة وودودة" : "واضحة" };
    case "explain":
      return { purpose: "فهم المادة", density: "medium", tone: young ? "بسيطة مع أمثلة" : "واضحة مع أمثلة" };
    case "book":
      return { writing: "explain", density: "medium", page: "A4", numbered: true, design: defaultDesign(randomStyle()) };
    case "slides":
      return { density: young ? "low" : "medium", aspect: "16:9", notesMode: "both", count: 0, render: "editable", design: defaultDesign(randomStyle()) };
    case "audio":
      return { source: "text", mode: "single" };
    case "quiz":
      return { difficulty: young ? "easy" : "medium", count: 10, types: young ? ["mcq", "tf"] : ["mcq", "tf", "short"], usage: "both" };
    default:
      return {};
  }
}
