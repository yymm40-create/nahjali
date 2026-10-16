// «في حضرة السيدة زينب (ع)» — an unlisted branch of JAWAD AI (no card on the bar, no link anywhere: it opens only from its
// own address, /jawad-ai/zaynab). The person adds ordinary photos (no cut-out needed) of themselves and of as many other
// people as they like, picks one of the views of the owner's environment sheet («ENV-02 Zainab shrine courtyard»), a style
// of JAWAD AI's own library (the studios' «🎨 الستايل»), night or day, rain, snow or clear, and the greeting.
// THE WHOLE SHEET AND EVERY PHOTO GO TO GPT IMAGE 2 AS REFERENCES, and THE PROMPT IS WRITTEN BY «جواد» — the studio's
// assistant, with his own system prompt and knowledge — from the person's choices and from looking at the references
// (the owner's choice: no fixed template). When a style is chosen, everything in the picture, the people too, becomes
// that style (a Pixar look turns the people into Pixar characters of themselves). GPT Image 2 at the studio's price.

import { findStyle } from "../film-styles";
import type { RefMeta } from "./types";

export const ZAYNAB_BASE = "/jawad-ai/zaynab";
export const ZAYNAB_IMAGE = "openai-gpt-image-2";
/** One photo per person, or a group photo: up to this many photos. */
export const ZAYNAB_MAX_PHOTOS = 6;
export const ZAYNAB_KEY_PREFIX = "zaynab_";

/**
 * The views of the courtyard the person chooses from, each one a tile of the owner's environment sheet (the dome is in
 * every one of them; the courtyard is empty in all, so the people stand on the marble in front). `file` is under
 * public/zaynab/views and is read from disk for every generation.
 */
export const ZAYNAB_VIEWS = [
  { id: "shrine", name: "أمام الحرم", hint: "الواجهة الذهبية والقبة والمنارتان وسط الصورة", text: "the main view facing the shrine: the golden iwan facade centred, the golden dome rising behind it between the two tiled minarets, the arcades on both sides" },
  { id: "spot", name: "وسط الصحن", hint: "منظر أوسع من وسط الصحن بالقبة بعيدة وبالمنارتين", text: "a wide view from the middle of the courtyard: the shrine seen from further back, the dome centred between the two minarets, a large open marble floor in front" },
  { id: "left", name: "الرواق الأيسر", hint: "أقواس مزخرفة وبلاط أزرق والقبة تظهر من الجانب", text: "a view along the left arcade: a long row of tiled arches in blue and gold running into the distance, the golden dome and a minaret appearing beyond them" },
  { id: "right", name: "الرواق الأيمن", hint: "رواق مبلّط بالفيروزي والمنارة من الجانب الآخر", text: "a view along the right arcade: the long tiled arcade seen at an angle, a minaret above it and the shrine's facade at the end" },
  { id: "up", name: "من تحت لفوق", hint: "منظر منخفض يرفع القبة والمنارتين فوق الأشخاص", text: "a low looking-up view: the golden dome and the two tiled minarets rising tall into the sky over the facade, with the dome large above the viewer" },
] as const;
export type ZaynabView = (typeof ZAYNAB_VIEWS)[number]["id"];
export const ZAYNAB_VIEW_DEFAULT: ZaynabView = "shrine";
export const zaynabViewFile = (id: string) => `public/zaynab/views/${id}.jpg`;
/** The tile of the sheet each view is (its label as written on the sheet). */
export const ZAYNAB_VIEW_TILE: Record<ZaynabView, string> = { shrine: "03 VIEW TO SHRINE", spot: "07 SPOT A", left: "05 LEFT ARCADE", right: "06 RIGHT ARCADE", up: "08 LOOKING UP" };
/** The owner's whole environment sheet: Image 1 of every generation. */
export const ZAYNAB_SHEET_FILE = "public/zaynab/env-sheet.jpg";

/** The greeting written in the picture by the model (the person can switch it off). */
export const ZAYNAB_GREETING = ["نرفع أسمى آيات التهاني والتبريك لمقام صاحب العصر والزمان (عج)", "بمناسبة ميلاد السيدة زينب عليها السلام"] as const;


export const ZAYNAB_TIMES = { day: "☀️ نهار", night: "🌙 ليل" } as const;
export type ZaynabTime = keyof typeof ZAYNAB_TIMES;
export const ZAYNAB_WEATHER = { clear: "✨ صافي", rain: "🌧️ مطر", snow: "❄️ ثلج" } as const;
export type ZaynabWeather = keyof typeof ZAYNAB_WEATHER;
export const ZAYNAB_ASPECTS = { "2:3": "عمودي", "3:2": "أفقي", "1:1": "مربع" } as const;
export type ZaynabAspect = keyof typeof ZAYNAB_ASPECTS;

export interface ZaynabInput {
  /** which view of the courtyard (a tile of the environment sheet) */
  view: ZaynabView;
  /** a style of JAWAD AI's library (config/film-styles.ts): always one (nothing realistic remains, the owner's order) */
  style: string;
  time: ZaynabTime;
  weather: ZaynabWeather;
  aspect: ZaynabAspect;
  /** a name or a word for each photo, in the order they were added (may be blank) */
  labels: string[];
  /** the greeting is written in the picture */
  greeting: boolean;
  count: number;
  consent: boolean;
}

/** Reads a request's input; anything unknown is refused with the sentence the page shows. */
export function zaynabInput(raw: unknown): ZaynabInput {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (!ZAYNAB_VIEWS.some(view => view.id === v.view)) throw new Error("اختر المنظر.");
  const style = typeof v.style === "string" ? v.style : "";
  if (!findStyle(style)) throw new Error("اختر الستايل من القائمة.");
  if (!Object.hasOwn(ZAYNAB_TIMES, String(v.time))) throw new Error("اختر ليل أو نهار.");
  if (!Object.hasOwn(ZAYNAB_WEATHER, String(v.weather))) throw new Error("اختر الجو: صافي أو مطر أو ثلج.");
  if (!Object.hasOwn(ZAYNAB_ASPECTS, String(v.aspect))) throw new Error("اختر شكل الصورة.");
  if (!Number.isInteger(v.count) || Number(v.count) < 1 || Number(v.count) > 4) throw new Error("اختر من صورة إلى أربع صور.");
  if (v.consent !== true) throw new Error("أكد أن لديك إذن استخدام الصور، وموافقة ولي الأمر لصور الأطفال.");
  const labels = Array.isArray(v.labels) ? v.labels.slice(0, ZAYNAB_MAX_PHOTOS).map(label => String(label ?? "").trim().slice(0, 40)) : [];
  return { view: v.view as ZaynabView, style, time: v.time as ZaynabTime, weather: v.weather as ZaynabWeather, aspect: v.aspect as ZaynabAspect, labels, greeting: v.greeting !== false, count: Number(v.count), consent: true };
}

const TIME_AR: Record<ZaynabTime, string> = { day: "daytime", night: "night (the dome and minarets lit by warm floodlights)" };
const WEATHER_AR: Record<ZaynabWeather, string> = { clear: "clear sky", rain: "rain falling (a wet, reflective marble floor)", snow: "snow falling (the dome stays gold)" };

/**
 * «جواد»'s recipe for this request type: what the picture is and what must survive, so HE writes the prompt. Said once,
 * after his own system prompt.
 */
export const ZAYNAB_RECIPE = `REQUEST TYPE — «في حضرة السيدة زينب (ع)» (a picture of the person and their people at the holy shrine of Sayyida Zaynab, peace be upon her, in Damascus). You write the WHOLE final prompt for GPT Image 2 yourself, from the brief and from looking at the references; there is no template.
What the references are (the generator numbers them in this order, "Image 1", "Image 2"…):
- Image 1 is the owner's ENVIRONMENT SHEET of the shrine's courtyard: many labelled tiles of the same place (an overview, a plan, views to the shrine, the gate, the arcades, spot A, looking up, details of the dome, the minarets, the tiles and the marble, the colour palette and the "locks"). It is the source of truth for the architecture: the gilded dome between two blue-tiled minarets, the golden iwan facade, the tiled arcades, the white marble courtyard. The brief names the tile whose camera view the picture is composed like.
- Image 2 onwards are the PEOPLE's photos: ordinary photos (one person each, or a group). Every person in them is in the picture as a stylised version of themselves — none dropped or merged, no one added.
Must hold in your prompt:
- NOTHING REALISTIC REMAINS: the people are re-made COMPLETELY in the chosen style — their faces are the style's own faces with only a loose likeness (hair, skin tone, a beard, glasses, age and build), never a photo face, photographic skin, pores, real hair strands, camera lighting or any photo texture. The shrine, the sky and everything else are the style too. A Pixar style makes them Pixar characters through and through.
- YOU ARE NOT BOUND by the photos: take from them only who the people are and how many; their photos' clothes, poses and backgrounds are not kept. Pose and arrange them as you judge best for a joyful visit to a holy place.
- THE CLOTHES (the owner's rule, exactly): a man or a boy wears a plain THOBE only — NO ghutra, NO shemagh, NO headwear of any kind, his own hair showing. A woman or a girl wears a plain black ZAYNABI HEAD ABAYA (عباية رأس زينبية): one plain black abaya draped from the top of the head down to the feet, covering the hair, the neck and the whole body completely, with no decoration — only the face and the hands are visible.
- The people stand in the courtyard in front of the shrine, the dome clearly behind them, in the chosen tile's view.
- The chosen time and weather relight the sheet's plain daytime courtyard; the architecture stays.
- Respect: modest, calm and dignified, as on a visit to a holy place; nobody touching or climbing the shrine; no holy figure depicted; no logos or watermarks.
- The greeting (when asked): the given Arabic lines written in the sky above the dome, EXACTLY as given, letter for letter, in joyful festive gold lettering that fits the style, clear of the dome, the minarets and the faces; no other writing. When not asked: no writing at all.
- The picture's shape is the one given (it is the generator's setting; just compose for it).`;

/** The brief «جواد» receives with the references: the person's choices, plainly. */
export function zaynabBrief(input: ZaynabInput, photos: number): string {
  const style = findStyle(input.style)!;
  const view = ZAYNAB_VIEWS.find(item => item.id === input.view)!;
  const people = Array.from({ length: photos }, (_, i) => `Image ${i + 2}` + (input.labels[i] ? ` — «${input.labels[i]}»` : "")).join("\n");
  return [
    "THE BRIEF",
    "View: the sheet's tile «" + ZAYNAB_VIEW_TILE[input.view] + "» — " + view.text + ".",
    "People (" + photos + (photos === 1 ? " photo" : " photos") + "):\n" + people,
    "Style (the whole picture, nothing realistic left): «" + style.name + "» — " + style.text,
    "Time: " + TIME_AR[input.time] + ". Weather: " + WEATHER_AR[input.weather] + ".",
    "Shape: " + input.aspect + ".",
    input.greeting ? "Greeting — write these two lines exactly:\nline 1: «" + ZAYNAB_GREETING[0] + "»\nline 2: «" + ZAYNAB_GREETING[1] + "»" : "Greeting: none — no writing in the picture.",
  ].join("\n");
}

/** The faults sent back to «جواد» (his prompt must name the references and, when asked, carry the greeting letter for letter). */
export function zaynabPromptProblems(prompt: string, input: ZaynabInput): string[] {
  const out: string[] = [];
  if (!prompt.trim()) out.push('The "prompt" is empty: write the whole final prompt.');
  if (prompt.length > 30_000) out.push("The prompt is too long: keep it under 30,000 characters.");
  if (!/Image 1\b/.test(prompt)) out.push("Refer to the environment sheet as Image 1.");
  if (input.greeting) for (const line of ZAYNAB_GREETING) if (!prompt.includes(line)) out.push(`The greeting line must appear in the prompt exactly, letter for letter: «${line}».`);
  return out;
}

/**
 * The references a price is asked for, before any file is added: the chosen view and the people's photos, each a ready
 * image with real pixels (a reference without them is turned down by the generator's rules, whatever its count).
 */
export const zaynabQuoteRefs = (photos: number): RefMeta[] =>
  Array.from({ length: photos + 1 }, (_, i) => ({ id: `q${i}`, kind: "image", role: "reference", mime: "image/jpeg", bytes: 200_000, width: 1024, height: 1024, name: `image${i + 1}`, status: "ready" }));
