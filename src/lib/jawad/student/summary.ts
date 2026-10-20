// «الطالب الذكي» — what the student already chose for an output, in one line. The choices are made ONCE, on the outputs
// page (the page count, the file type, the density, the difficulty…), and every output is created with them; this line
// is what each output's panel shows afterwards instead of asking the same questions again. Pure.

import { FORMATS, MAX_NAME, QUESTION_TYPES, formatOf, maxAvailable, maxOn, pagesOf, type OutputKind } from "@config/jawad/student";
import { readSermonLength } from "@config/jawad/khateeb";
import { MAP_TYPES } from "./mindmap";

type S = Record<string, unknown>;

const DENSITY: Record<string, string> = { low: "مستوى خفيف", medium: "مستوى متوسط", high: "مستوى عميق", max: "مستوى أعمق" };
const DIFFICULTY: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
const USAGE: Record<string, string> = { interactive: "أحلّه هنا", sheet: "ورقة أطبعها", both: "هنا وورقة" };
const NOTES: Record<string, string> = { slide: "الشرح على الشريحة", notes: "الشرح في ملاحظات المحاضر", both: "الشرح على الشريحة وفي الملاحظات" };
const WRITING: Record<string, string> = { explain: "كتاب شرح", summary: "كتاب ملخص", verbatim: "النص كامل كما هو" };

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The choices of an output as short phrases, in the order the questions were asked. Empty for an output with none (a chat). */
export function settingsParts(kind: OutputKind | string, s: S): string[] {
  const out: string[] = [];
  switch (kind) {
    case "summary":
    case "explain":
    case "preread":
    case "book": {
      if (kind === "book" && WRITING[str(s.writing)]) out.push(WRITING[str(s.writing)]);
      if (!(kind === "book" && s.writing === "verbatim")) out.push(pagesOf(s) ? `${pagesOf(s)} صفحة` : "عدد الصفحات حسب المادة");
      if (!(kind === "book" && s.writing === "verbatim") && DENSITY[str(s.density)]) out.push(DENSITY[str(s.density)]);
      out.push(FORMATS.find((f) => f.id === formatOf(s))!.label);
      break;
    }
    case "sermon": {
      const l = readSermonLength(s.length);
      out.push(`خطبة ${l.label} (نحو ${l.minutes.toLocaleString("ar")} دقيقة)`);
      out.push(FORMATS.find((f) => f.id === formatOf(s))!.label);
      if (str(s.occasion).trim()) out.push(str(s.occasion).trim().slice(0, 60));
      break;
    }
    case "slides": {
      const n = Math.max(0, Math.round(Number(s.count) || 0));
      out.push(n ? `${n} شريحة` : "عدد الشرائح حسب المادة");
      out.push(s.render === "image" ? "تُرسم صورًا" : maxOn(s) ? `${MAX_NAME}: يصممها بالكود + محرر وعرض` : "شرائح قابلة للتعديل");
      if (NOTES[str(s.notesMode)]) out.push(NOTES[str(s.notesMode)]);
      out.push(s.aspect === "4:3" ? "4:3" : "عريض 16:9");
      break;
    }
    case "quiz": {
      const n = Math.max(0, Math.round(Number(s.count) || 0));
      if (n) out.push(`${n} سؤالًا`);
      if (DIFFICULTY[str(s.difficulty)]) out.push(DIFFICULTY[str(s.difficulty)]);
      const types = (Array.isArray(s.types) ? s.types : []).flatMap((t): string[] => {
        const label: string | undefined = QUESTION_TYPES.find((q) => q.id === t)?.label;
        return label ? [label] : [];
      });
      if (types.length) out.push(types.join(" + "));
      if (USAGE[str(s.usage)]) out.push(USAGE[str(s.usage)]);
      break;
    }
    case "mindmap":
      out.push(MAP_TYPES.find((t) => t.id === s.mapType)?.name ?? "النوع يختاره صادق");
      out.push(s.scope === "sections" ? "شاملة + خريطة لكل قسم" : "خريطة وحدة");
      out.push(maxOn(s) ? `${MAX_NAME}: يصممها بالكود` : s.render === "image" ? "يرسمها GPT Image 2" : "يصممها صادق");
      if (s.recall !== false && !maxOn(s)) out.push("مع نسخة التسميع");
      break;
    case "brochure":
      out.push(s.fold === "bi" ? "ثنائية الطي (٤ واجهات)" : "ثلاثية الطي (٦ واجهات)");
      if (DENSITY[str(s.density)]) out.push(DENSITY[str(s.density)]);
      if (str(s.audience).trim()) out.push(`لـ ${str(s.audience).trim().slice(0, 40)}`);
      break;
    case "audio":
      out.push(s.mode === "multi" ? "ملف لكل قسم" : "ملف واحد");
      break;
    default:
      break;
  }
  if (maxOn(s) && maxAvailable(kind) && kind !== "slides" && kind !== "mindmap") out.push(`${MAX_NAME}: يصممه بالكود`);
  return out;
}

/** The same, as one line: «٢٠ صفحة · مفصل · PDF». Empty when there is nothing to say. */
export const settingsLine = (kind: OutputKind | string, s: S) => settingsParts(kind, s).join(" · ");
