// «صانع المحتوى» — the start form's choices per kind of work, and the ONE message it becomes: a head line
// (BRIEF_HEAD), the kind, a «• label: answer» line per choice (the same lines the buttons send, so the server's own
// reading of the maker and the pictures — lib/content/maker.ts — counts them), the topic, the person's text and notes.
// Pure (server and browser).

import { BRIEF_HEAD, CAROUSEL_AUTO_LINE } from "./marks";
import { MAKER_CODE, MAKER_GPT, MAKER_LABEL, MAKER_MIX, PHOTOS_LABEL, PHOTOS_MAKE, PHOTOS_MINE } from "./labels";

export type BriefKind = "carousel" | "reel_script" | "reel_produced" | "motion" | "titles" | "repurpose";

export interface BriefField {
  /** the label sent in the message (and the one the server reads) */
  label: string;
  /** what the form shows, when it differs from the label */
  title?: string;
  hint?: string;
  options: string[];
  multi?: boolean;
  required?: boolean;
  default?: string;
  /** the option that asks for the person's files (a button to attach shows under it) */
  attach?: string;
}

export interface BriefDef {
  icon: string;
  title: string;
  /** what the work is, as the message names it */
  what: string;
  topicHint: string;
  topicRequired: boolean;
  textTitle: string;
  textHint: string;
  fields: BriefField[];
  /** the kind needs the person's files (their clips) */
  needsFiles?: boolean;
}

export const AFTER_LABEL = "بعد الأسئلة";
export const AFTER_MAKE = "اصنع مباشرة";
export const AFTER_SHOW = "اعرض علي النص أولًا";
const AFTER: BriefField = { label: AFTER_LABEL, title: "بعد ما يكتمل كل شي", options: [AFTER_MAKE, AFTER_SHOW], default: AFTER_MAKE };
const DIALECT: BriefField = { label: "لغة المحتوى ولهجته", options: ["فصحى", "خليجي", "عراقي", "شامي", "مصري", "إنجليزي"] };
const GOAL: BriefField = { label: "الهدف", options: ["تعليم وشرح", "بيع منتج أو خدمة", "توعية", "تحفيز", "قصة", "ترفيه", "مناسبة دينية"] };
const KEEP: BriefField = { label: "التعامل مع نصي", options: ["التزم بنصي حرفيًا", "حافظ على المعنى وأعد الصياغة", "طوّره وحسّنه"] };

export const BRIEF_KINDS: Record<BriefKind, BriefDef> = {
  carousel: {
    icon: "🖼️",
    title: "كاروسيل",
    what: "كاروسيل",
    topicHint: "عن إيش الكاروسيل؟ مثل: ٥ أخطاء تخلي إعلانك ما يبيع",
    topicRequired: true,
    textTitle: "نص الشرائح إذا عندك",
    textHint: "الصق نصك هنا، أو اتركه فاضي ويكتبه هو",
    fields: [
      { label: "المقاس", options: ["مربع 1:1", "طولي 4:5 (انستغرام)", "ستوري 9:16", "عرضي 16:9 (لينكدإن، إكس)"], default: "طولي 4:5 (انستغرام)" },
      GOAL,
      { label: "عدد الشرائح", options: ["٥", "٧", "١٠", "اختر أنت"], default: "اختر أنت" },
      { label: "كثافة النص", options: ["قليلة", "متوسطة", "مفصّلة"], default: "متوسطة" },
      DIALECT,
      KEEP,
      { label: MAKER_LABEL, title: "من يصمم الشرائح؟", hint: "حيدرا ماكس: الكتابة العربية دقيقة. GPT Image 2: رسم أغنى والحروف قد تخطئ. الاثنين: صورة GPT وكتابة حيدرا ماكس.", options: [MAKER_CODE, MAKER_GPT, MAKER_MIX], required: true },
      { label: PHOTOS_LABEL, title: "الصور الواقعية (إذا الستايل فيه صور)", options: [PHOTOS_MAKE, PHOTOS_MINE], default: PHOTOS_MAKE, attach: PHOTOS_MINE },
      AFTER,
    ],
  },
  reel_script: {
    icon: "🎬",
    title: "سكربت ريل",
    what: "سكربت ريل",
    topicHint: "عن إيش الريل؟",
    topicRequired: true,
    textTitle: "نصك أو أفكارك إذا عندك",
    textHint: "الصق نصك أو نقاطك هنا",
    fields: [
      { label: "المدة", options: ["١٥ ثانية", "٣٠ ثانية", "٦٠ ثانية", "٩٠ ثانية"], default: "٣٠ ثانية" },
      GOAL,
      { label: "من يقدّمه", options: ["أنا أمام الكاميرا", "تعليق صوتي فقط", "بدون كلام (نص على الشاشة)"], default: "أنا أمام الكاميرا" },
      DIALECT,
      { label: "النبرة", options: ["حماسية", "هادئة", "جدّية", "مرحة", "مؤثرة"] },
      KEEP,
    ],
  },
  reel_produced: {
    icon: "✂️",
    title: "ريل منتج",
    what: "ريل منتج من مقاطعي مع حيدرا ماكس",
    topicHint: "عن إيش الريل؟",
    topicRequired: true,
    textTitle: "السكربت أو الكلام إذا عندك",
    textHint: "الصق السكربت هنا، أو اتركه فاضي",
    needsFiles: true,
    fields: [
      { label: "المقاس", options: ["طولي 9:16", "عرضي 16:9"], default: "طولي 9:16" },
      { label: "المدة", options: ["١٥ ثانية", "٣٠ ثانية", "٦٠ ثانية", "٩٠ ثانية"], default: "٣٠ ثانية" },
      GOAL,
      { label: "الكابشن على الشاشة", options: ["نعم، كابشن عربي", "لا"], default: "نعم، كابشن عربي" },
      { label: "الموسيقى", options: ["بموسيقى", "بدون موسيقى", "اختر أنت"], default: "اختر أنت" },
      { label: "إيقاع المونتاج", options: ["سريع", "متوسط", "هادئ"], default: "سريع" },
      DIALECT,
      AFTER,
    ],
  },
  motion: {
    icon: "✨",
    title: "موشن جرافيكس",
    what: "موشن جرافيكس",
    topicHint: "إيش الفكرة؟ مثل: إعلان ١٠ ثواني لتطبيقي",
    topicRequired: true,
    textTitle: "النص اللي يبين أو ينقال",
    textHint: "الكلام اللي تبيه يظهر أو التعليق الصوتي",
    fields: [
      { label: "المقاس", options: ["طولي 9:16", "عرضي 16:9", "مربع 1:1"], default: "طولي 9:16" },
      { label: "المدة", options: ["١٠ ثواني", "١٥ ثانية", "٣٠ ثانية", "٦٠ ثانية"], default: "١٥ ثانية" },
      { label: "الصوت", options: ["تعليق صوتي", "موسيقى فقط", "بدون صوت"], default: "موسيقى فقط" },
      { label: "الإحساس", options: ["فخم", "مرح ملوّن", "مينيمال نظيف", "تقني", "حماس", "سكينة وخشوع"] },
      GOAL,
      AFTER,
    ],
  },
  titles: {
    icon: "🏷️",
    title: "عناوين وكابشن",
    what: "عناوين وكابشن",
    topicHint: "عن إيش البوست أو الفيديو؟",
    topicRequired: true,
    textTitle: "النص أو السكربت إذا عندك",
    textHint: "الصق المحتوى اللي تبي له عناوين وكابشن",
    fields: [
      { label: "المطلوب", options: ["عناوين غلاف", "كابشن", "دعوة للتفاعل", "هاشتاقات"], multi: true, default: "كابشن" },
      { label: "المنصة", options: ["انستغرام", "تيك توك", "يوتيوب", "سناب", "لينكدإن", "إكس"], default: "انستغرام" },
      { label: "عدد البدائل", options: ["٣", "٥", "١٠"], default: "٥" },
      DIALECT,
    ],
  },
  repurpose: {
    icon: "🔁",
    title: "أعد توظيف محتوى",
    what: "إعادة توظيف محتوى في أكثر من مخرج",
    topicHint: "إيش المحتوى الأصلي؟ (أو أرفقه / الصقه تحت)",
    topicRequired: false,
    textTitle: "المحتوى الأصلي",
    textHint: "الصق المحتوى هنا",
    fields: [
      { label: "المخرجات المطلوبة", options: ["كاروسيل", "سكربت ريل", "كابشن", "تغريدات", "موشن جرافيكس"], multi: true, required: true },
      DIALECT,
      KEEP,
      AFTER,
    ],
  },
};

export interface BriefInput {
  picked: Record<string, string[]>;
  topic: string;
  text: string;
  notes?: string;
  /** the carousel style line (carouselLine) when picked from the table; else «اختر لي الأنسب» */
  style?: string | null;
  files?: number;
}

/** Why «ابدأ» can't be pressed yet, or null. */
export function briefMissing(kind: BriefKind, b: Pick<BriefInput, "picked" | "topic" | "text" | "files">): string | null {
  const def = BRIEF_KINDS[kind];
  if (def.topicRequired && !b.topic.trim() && !b.text.trim()) return "اكتب الموضوع أو الفكرة.";
  if (!def.topicRequired && !b.topic.trim() && !b.text.trim() && !b.files) return "اكتب المحتوى الأصلي أو أرفقه.";
  const need = def.fields.find((f) => f.required && !(b.picked[f.label] ?? []).length);
  if (need) return `اختر: ${need.title ?? need.label}`;
  const photos = def.fields.find((f) => f.attach && (b.picked[f.label] ?? []).includes(f.attach));
  if (photos && !b.files) return "اخترت إضافة صورك: أرفقها بزر 📎 أولًا.";
  if (def.needsFiles && !b.files) return "أرفق مقاطعك بزر 📎 (الريل المنتج يُبنى منها).";
  return null;
}

/** The one message the form sends. */
export function briefMessage(kind: BriefKind, b: BriefInput): string {
  const def = BRIEF_KINDS[kind];
  const lines = [`${BRIEF_HEAD} — ${def.title}`, `• نوع المحتوى: ${def.what}`];
  for (const f of def.fields) {
    const a = (b.picked[f.label] ?? []).filter((x) => f.options.includes(x));
    if (a.length) lines.push(`• ${f.label}: ${a.join("، ")}`);
  }
  if (kind === "carousel") lines.push(b.style?.trim() || CAROUSEL_AUTO_LINE);
  lines.push("• ما لم أحدده: اختر أنت الأنسب لهدفي وجمهوري، واذكر اختياراتك.");
  if (b.topic.trim()) lines.push("", `الموضوع: ${b.topic.trim()}`);
  if (b.text.trim()) lines.push("", `${def.textTitle}:`, b.text.trim());
  if (b.notes?.trim()) lines.push("", `ملاحظات: ${b.notes.trim()}`);
  return lines.join("\n");
}
