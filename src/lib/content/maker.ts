import { findCarouselStyle, type CarouselStyle } from "@config/content-carousel-styles";
import { findContentFont, type ContentFont } from "@config/content-fonts";
import { findTemplate } from "@config/content-templates";
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

/** The turns since the last carousel: what the next carousel is decided by. */
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
 * then the font, then who makes it. Null when nothing does. The server decides this from what was pressed, not from what the model says.
 */
export function carouselHold(history: Turn[]): CarouselHold | null {
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
  if (!pickedMaker(history)) return { question: MAKER_QUESTION, note: "⏸️ آخر خطوة قبل التصنيع: اختر من يصمم الشرائح، وبعدها أبدأ." };
  return null;
}
