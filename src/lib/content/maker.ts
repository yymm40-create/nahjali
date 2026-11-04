import { findCarouselStyle, type CarouselStyle } from "@config/content-carousel-styles";
import { findContentFont, type ContentFont } from "@config/content-fonts";
import { findTemplate } from "@config/content-templates";
import { findMotionCarouselStyle, MOTION_ROUTES, type MotionCarouselStyle, type MotionRoute } from "@config/content-motion-carousel";
import { coinsOf, generatorById, GPT_IMAGE_2_ID } from "@config/jawad/generators";
import type { Question, Turn } from "./chats";

/** The last step before a new carousel is made: the person picks who makes the slides (the owner's order: no default). */
export const MAKER_LABEL = "من يصمم الشرائح؟";
export const MAKER_CODE = "حيدرا ماكس (كتابة عربية دقيقة بالكود)";
export const MAKER_GPT = "GPT Image 2 (رسم كامل بالذكاء الاصطناعي)";
export const MAKER_MIX = "GPT Image 2 للصور + حيدرا ماكس للكتابة";

export const MAKER_QUESTION = { label: MAKER_LABEL, kind: "choice" as const, options: [MAKER_CODE, MAKER_GPT, MAKER_MIX], multi: false };

/** The first step of a carousel: the table of 103 styles, in place of questions about colours and margins. */
export const CAROUSEL_LABEL = "اختر ستايل الكاروسيل";
export const CAROUSEL_QUESTION: Question = { label: CAROUSEL_LABEL, kind: "carousels", options: [], multi: false };

/** After the style: the font, from the list of 50 (a style with a ready font offers it first). */
export const FONT_LABEL = "اختر الخط";
export const FONT_QUESTION: Question = { label: FONT_LABEL, kind: "fonts", options: [], multi: false };

/** A style with realistic pictures: the person adds their own, or it is made from zero. */
export const PHOTOS_LABEL = "هذا الستايل فيه صور واقعية: تضيف صورك أو نسويها لك؟";
export const PHOTOS_MINE = "أضيف صوري";
export const PHOTOS_MAKE = "سوّوها لي من الصفر";
export const PHOTOS_QUESTION: Question = { label: PHOTOS_LABEL, kind: "choice", options: [PHOTOS_MINE, PHOTOS_MAKE], multi: false };

/** After the font: a still carousel, or a motion carousel (every slide a short video with its sound). */
export const KIND_LABEL = "الكاروسيل ثابت أو متحرك؟";
export const KIND_STILL = "ثابت (صور)";
export const KIND_MOTION = "موشن كاروسيل (كل شريحة تتحرك بصوت)";
export const KIND_QUESTION: Question = { label: KIND_LABEL, kind: "choice", options: [KIND_STILL, KIND_MOTION], multi: false };

/** A motion carousel: its motion style, from the table of ten (or built from zero with him). */
export const MOTION_CAROUSEL_LABEL = "اختر ستايل الحركة";
export const MOTION_CAROUSEL_QUESTION: Question = { label: MOTION_CAROUSEL_LABEL, kind: "motioncarousels", options: [], multi: false };

/** A motion carousel's last step: how its pictures are made, cheapest first (in place of who makes the slides). */
export const ROUTE_LABEL = "طريقة صنع الحركة";
export const ROUTE_QUESTION: Question = { label: ROUTE_LABEL, kind: "choice", options: MOTION_ROUTES.map((r) => r.label), multi: false };

/** About what one slide's GPT Image 2 picture costs the person (riyals, rounded to a half): its default price, high quality, a short prompt. */
export function slidePictureSar(): number {
  const def = generatorById(GPT_IMAGE_2_ID);
  const per = def?.priceKeys.find((k) => k.key === "out:high:std")?.defaultCenti ?? 0;
  const kb = def?.priceKeys.find((k) => k.key === "prompt:1kb")?.defaultCenti ?? 0;
  return Math.max(0.5, Math.ceil((coinsOf(per + 3 * kb, "image") / 100) * 2) / 2);
}

/** The note under the ways of making it: cheapest first, what each costs on top of «حيدرا ماكس»'s work. */
export const routeNote = (slides: number) => {
  const sar = slidePictureSar();
  return `⏸️ آخر خطوة قبل التصنيع: اختر طريقة صنع الحركة (من الأرخص للأغلى):\n${MOTION_ROUTES.map((r, i) => `${i + 1}) ${r.label}: ${r.what}${r.id === "code" ? "" : ` تقريبًا ${sar} ريال للصورة، يعني نحو ${Math.round(sar * slides * 10) / 10} ريال لـ ${slides} شرائح.`}`).join("\n")}`;
};

/** The turns since the last carousel/** The turns since the last carousel: what the next carousel is decided by. */
const sinceLastCarousel = (history: Turn[]) => history.slice(history.map((t) => !!t.slides).lastIndexOf(true) + 1);

/** What a person pressed: the whole message, or its line «• label: answer» when it was one of a batch. A sentence in their own words is not a press. */
function pressed(t: Turn, label: string): string[] {
  const out = [t.text.trim()];
  const prefix = `• ${label}: `;
  for (const line of t.text.split("\n")) if (line.trim().startsWith(prefix)) out.push(line.trim().slice(prefix.length).trim());
  return out;
}

/** The latest of `answers` the person pressed for `label`, since the last carousel. */
function lastPressed<T extends string>(history: Turn[], label: string, answers: readonly T[]): T | null {
  const turns = sinceLastCarousel(history);
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== "user") continue;
    const said = pressed(turns[i], label);
    const hit = answers.find((a) => said.includes(a));
    if (hit) return hit;
  }
  return null;
}

/** What the person picked for the carousel about to be made: their pressed answer after the last carousel, or null if they did not pick yet. */
export function pickedMaker(history: Turn[]): "code" | "gpt" | "mix" | null {
  const hit = lastPressed(history, MAKER_LABEL, [MAKER_CODE, MAKER_GPT, MAKER_MIX]);
  return hit === MAKER_CODE ? "code" : hit === MAKER_GPT ? "gpt" : hit === MAKER_MIX ? "mix" : null;
}

/** Still or motion, as pressed since the last carousel (null: not asked yet). */
export const pickedKind = (history: Turn[]): "still" | "motion" | null => {
  const hit = lastPressed(history, KIND_LABEL, [KIND_STILL, KIND_MOTION]);
  return hit === KIND_STILL ? "still" : hit === KIND_MOTION ? "motion" : null;
};

/** The way of making a motion carousel, as pressed (null: not picked yet). */
export const pickedRoute = (history: Turn[]): MotionRoute | null => {
  const hit = lastPressed(history, ROUTE_LABEL, MOTION_ROUTES.map((r) => r.label));
  return MOTION_ROUTES.find((r) => r.label === hit)?.id ?? null;
};

const MOTION_MARK = /\[حركة:([a-z0-9-]+)\]/g;

/** The motion style picked since the last carousel: one of the ten, "own" (built from zero, in the person's words), "help", or null. */
export function pickedMotionStyle(history: Turn[]): { id: string; style: MotionCarouselStyle | null; own?: string } | null {
  const turns = sinceLastCarousel(history);
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== "user") continue;
    const id = [...turns[i].text.matchAll(MOTION_MARK)].map((m) => m[1]).at(-1);
    if (!id) continue;
    if (id === "help") return { id, style: null };
    if (id === "own") {
      const line = turns[i].text.split("\n").find((l) => l.includes("[حركة:own]")) ?? "";
      return { id, style: null, own: line.replace(/^.*?من الصفر معك:\s*/, "").replace(/\s*\[حركة:own\]\s*$/, "").trim() };
    }
    const style = findMotionCarouselStyle(id);
    if (style) return { id, style };
  }
  return null;
}

const STYLE_MARK = /\[كاروسيل:([a-z0-9-]+)\]/g;
const TEMPLATE_MARK = /\[قالب:([a-z0-9-]+)\]/g;

/**
 * The carousel style picked for the carousel about to be made: a style of the table, "own" (something not in it, in the
 * person's own words), "help" (they asked to be helped: not a pick yet), or null. A conversation that began with the older
 * template gallery counts as picked ("own"), so it is not stopped halfway.
 */
export function pickedCarousel(history: Turn[]): { id: string; style: CarouselStyle | null } | null {
  const turns = sinceLastCarousel(history);
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== "user") continue;
    const marks = [...turns[i].text.matchAll(STYLE_MARK)].map((m) => m[1]);
    const id = marks.at(-1);
    if (id === "help" || id === "own") return { id, style: null };
    if (id && findCarouselStyle(id)) return { id, style: findCarouselStyle(id)! };
    const old = [...turns[i].text.matchAll(TEMPLATE_MARK)].map((m) => m[1]).at(-1);
    if (old && (old === "none" || findTemplate(old))) return { id: "own", style: null };
  }
  return null;
}

const FONT_MARK = /\[خط:([a-z0-9-]+)\]/g;

/**
 * The font picked for the carousel about to be made: a font of the list, "style" (the style's ready font, resolved to
 * it), "auto" («محمد باقر» picks), or null when not picked yet.
 */
export function pickedFont(history: Turn[]): { id: string; font: ContentFont | null } | null {
  const turns = sinceLastCarousel(history);
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== "user") continue;
    const id = [...turns[i].text.matchAll(FONT_MARK)].map((m) => m[1]).at(-1);
    if (!id) continue;
    if (id === "auto") return { id, font: null };
    if (id === "style") {
      const ready = pickedCarousel(history)?.style?.font;
      const f = ready ? findContentFont(ready) : undefined;
      return f ? { id: f.id, font: f } : { id: "auto", font: null };
    }
    const f = findContentFont(id);
    if (f) return { id, font: f };
  }
  return null;
}

/** Whether the person chose to add their own pictures, or to have them made from zero (null: not asked yet). */
export const pickedPhotos = (history: Turn[]): "mine" | "make" | null => {
  const hit = lastPressed(history, PHOTOS_LABEL, [PHOTOS_MINE, PHOTOS_MAKE]);
  return hit === PHOTOS_MINE ? "mine" : hit === PHOTOS_MAKE ? "make" : null;
};

/** Pictures the person attached since the last carousel. */
export const attachedPictures = (history: Turn[]) => sinceLastCarousel(history).flatMap((t) => (t.files ?? []).filter((f) => f.kind === "image"));

export interface CarouselHold {
  question: Question;
  note: string;
}

/**
 * What still stops a new carousel from being made, in order: the style, then (a realistic style) the person's pictures,
 * then the font, then still or motion, then (motion) its style and how it is made, or (still) who makes it. Null when nothing does. The server decides this from what was pressed, not from what the model says.
 */
export function carouselHold(history: Turn[], slides = 6): CarouselHold | null {
  const pick = pickedCarousel(history);
  if (!pick || pick.id === "help") return { question: CAROUSEL_QUESTION, note: "⏸️ قبل التصنيع: اختر ستايل الكاروسيل من الجدول، أو قل لي إن كنت تريد شيئًا غير الموجود." };
  if (pick.style?.photoIdea) {
    const photos = pickedPhotos(history);
    if (!photos) return { question: PHOTOS_QUESTION, note: `⏸️ ستايل «${pick.style.name}» فيه صور واقعية. ${pick.style.photoIdea}` };
    if (photos === "mine" && !attachedPictures(history).length) return { question: PHOTOS_QUESTION, note: `⏸️ اخترت إضافة صورك ولم تصلني صورة بعد: أرفقها بزر 📎 ثم أرسل. ${pick.style.photoIdea}` };
  }
  // a conversation that began with the older template gallery is not stopped for a font either
  const fromTable = sinceLastCarousel(history).some((x) => x.role === "user" && /\[كاروسيل:[a-z0-9-]+\]/.test(x.text));
  if (fromTable && !pickedFont(history)) {
    const ready = pick.style?.font ? findContentFont(pick.style.font) : undefined;
    return { question: FONT_QUESTION, note: ready ? `⏸️ اختر الخط: هذا الستايل معه خط جاهز «${ready.name}»، أو اختر غيره من القائمة.` : "⏸️ اختر الخط من القائمة، أو خلني أختاره لك." };
  }
  // still or motion (asked of carousels made from the table; an older conversation stays a still carousel)
  const kind = fromTable ? pickedKind(history) : "still";
  if (!kind) return { question: KIND_QUESTION, note: "⏸️ الكاروسيل ثابت (صور) أو موشن كاروسيل (كل شريحة فيديو قصير يتحرك فيه الكلام بصوت خفيف)؟" };
  if (kind === "motion") {
    const motion = pickedMotionStyle(history);
    if (!motion || motion.id === "help") return { question: MOTION_CAROUSEL_QUESTION, note: "⏸️ اختر ستايل الحركة من الجدول (١٠ ستايلات جاهزة)، أو ابنِه معي من الصفر." };
    if (!pickedRoute(history)) return { question: ROUTE_QUESTION, note: routeNote(slides) };
    return null;
  }
  if (!pickedMaker(history)) return { question: MAKER_QUESTION, note: "⏸️ آخر خطوة قبل التصنيع: اختر من يصمم الشرائح، وبعدها أبدأ." };
  return null;
}
