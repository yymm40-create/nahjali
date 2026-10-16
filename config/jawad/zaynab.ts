// «في حضرة السيدة زينب (ع)» — an unlisted branch of JAWAD AI (no card on the bar, no link anywhere: it opens only from its
// own address, /jawad-ai/zaynab). The person adds a photo of themselves — an ordinary photo, no cut-out needed — and of
// as many other people as they like (one photo each, or a group photo), chooses how the picture is drawn, whether it is
// night or day and rain, snow or clear, and gets themselves standing in the courtyard of the holy shrine of Sayyida
// Zaynab (peace be upon her) with its golden dome behind them. THE PLACE IS ONE OF THE VIEWS OF THE OWNER'S ENVIRONMENT
// SHEET («ENV-02 Zainab shrine courtyard»: public/zaynab/views, cut from the sheet), chosen by the person and sent as the
// first reference of EVERY generation, so the dome, the minarets and the facade are the sheet's own and are redrawn in
// the chosen look, time and weather together with the people. The greeting is written
// over the top of the finished picture by the page (real Arabic letters in a joyful font, never drawn by the model).
// GPT Image 2 at the studio's price, the people's own faces kept.

import { CARTOON_STYLES } from "./cartoon";
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

/** The greeting written over the top of every picture (the person can switch it off). */
export const ZAYNAB_GREETING = ["نرفع أسمى آيات التهاني والتبريك لمقام صاحب العصر والزمان (عج)", "بمناسبة ميلاد السيدة زينب عليها السلام"] as const;

const cartoon = (id: string) => CARTOON_STYLES.find(style => style.id === id)!.text;

/** How the people are drawn: six or seven looks, from «as they are» to paintings and cartoons. */
export const ZAYNAB_STYLES = [
  {
    id: "real",
    name: "واقعي كما أنت",
    icon: "📷",
    hint: "صورة حقيقية بإضاءة سينمائية، وجهك كما هو",
    text: "Photorealistic cinematic photograph: the people exactly as they are, their real faces, real skin and real hair kept without any smoothing or beautifying, natural lens perspective at about 35 mm, shallow depth of field on the people with the shrine softly sharp behind them, true-to-life colour with a gentle film grade.",
  },
  {
    id: "oil",
    name: "لوحة زيتية",
    icon: "🖼️",
    hint: "ضربات فرشاة كلاسيكية ودفء متحف",
    text: "Classical oil painting in the tradition of the great portrait and architectural painters: visible brush strokes and impasto highlights, rich layered glazes, a warm museum-varnish palette, careful drawn likenesses with each face recognisably their own, soft chiaroscuro and a canvas grain over everything.",
  },
  {
    id: "watercolor",
    name: "ألوان مائية",
    icon: "🎨",
    hint: "غسلات ألوان ناعمة وحواف تنساب",
    text: "Delicate watercolour illustration: transparent washes with soft bloom edges and granulation on textured paper, a fine loose pencil contour under the colour, unpainted paper left as the brightest highlights, a harmonious limited palette, gentle diffuse light, faces drawn simply but recognisably.",
  },
  {
    id: "anime",
    name: "أنمي",
    icon: "🌸",
    hint: "حبر نظيف وظلال سِل وخلفية مرسومة",
    text: cartoon("anime"),
  },
  {
    id: "cartoon3d",
    name: "كرتون ثلاثي الأبعاد",
    icon: "🎬",
    hint: "فيلم كرتون عالمي بإضاءة سينمائية",
    text: cartoon("cinematic-3d"),
  },
  {
    id: "miniature",
    name: "منمنمة إسلامية",
    icon: "🕌",
    hint: "رسم الكتب الفارسية: ذهب وأزرق وزخرفة دقيقة",
    text: "Persian-Islamic book miniature: flattened luminous perspective with the figures and the architecture drawn in fine ink contour and flat jewel colours (lapis blue, turquoise, vermilion, leaf-green), burnished gold leaf on the dome, haloless modest figures, an ornamented arabesque border around the picture, delicate tile patterns drawn stroke by stroke, the faces simplified in the miniature manner yet each recognisably its person.",
  },
  {
    id: "charcoal",
    name: "رسم فحم وقلم",
    icon: "✏️",
    hint: "أبيض وأسود بتظليل ناعم مثل رسم الفنان",
    text: "Black-and-white charcoal and graphite drawing on warm paper: soft blended tonal shading, fine hatching in the shadows, lifted highlights made with an eraser, a confident hand-drawn contour, careful likenesses with each face recognisably their own, the whole picture in greys with the dome glowing as the lightest tone.",
  },
] as const;
export type ZaynabStyle = (typeof ZAYNAB_STYLES)[number]["id"];

export const ZAYNAB_TIMES = { day: "☀️ نهار", night: "🌙 ليل" } as const;
export type ZaynabTime = keyof typeof ZAYNAB_TIMES;
export const ZAYNAB_WEATHER = { clear: "✨ صافي", rain: "🌧️ مطر", snow: "❄️ ثلج" } as const;
export type ZaynabWeather = keyof typeof ZAYNAB_WEATHER;
export const ZAYNAB_ASPECTS = { "2:3": "عمودي", "3:2": "أفقي", "1:1": "مربع" } as const;
export type ZaynabAspect = keyof typeof ZAYNAB_ASPECTS;

const TIME_TEXT: Record<ZaynabTime, string> = {
  day: "DAYTIME: bright clear daylight, the golden dome blazing in the sun, the blue and turquoise tiles vivid, soft shadows on the marble.",
  night: "NIGHT: a deep blue night sky with a few stars, the golden dome and the minarets lit by warm golden floodlights, glowing lamps and lanterns around the courtyard, the marble floor reflecting the lights, the people lit softly by the light of the shrine.",
};
const WEATHER_TEXT: Record<ZaynabWeather, string> = {
  clear: "WEATHER: clear and calm, a sky free of storm.",
  rain: "WEATHER: gentle rain falling, fine rain streaks catching the light, the marble courtyard wet and mirroring the dome and the lights, a soft grey sky, a quiet and moving atmosphere.",
  snow: "WEATHER: soft snow falling, flakes drifting through the air and catching the light, a thin layer of snow on the courtyard edges and rooftops while the golden dome stays gold, a pale hush over the sky, a cold breath of mist.",
};

export interface ZaynabInput {
  /** which view of the courtyard (a tile of the environment sheet) */
  view: ZaynabView;
  style: ZaynabStyle;
  time: ZaynabTime;
  weather: ZaynabWeather;
  aspect: ZaynabAspect;
  /** a name or a word for each photo, in the order they were added (may be blank) */
  labels: string[];
  /** leave room at the top of the picture for the greeting the page writes over it */
  greeting: boolean;
  count: number;
  consent: boolean;
}

/** Reads a request's input; anything unknown is refused with the sentence the page shows. */
export function zaynabInput(raw: unknown): ZaynabInput {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (!ZAYNAB_VIEWS.some(view => view.id === v.view)) throw new Error("اختر المنظر.");
  if (!ZAYNAB_STYLES.some(style => style.id === v.style)) throw new Error("اختر أسلوب التحويل.");
  if (!Object.hasOwn(ZAYNAB_TIMES, String(v.time))) throw new Error("اختر ليل أو نهار.");
  if (!Object.hasOwn(ZAYNAB_WEATHER, String(v.weather))) throw new Error("اختر الجو: صافي أو مطر أو ثلج.");
  if (!Object.hasOwn(ZAYNAB_ASPECTS, String(v.aspect))) throw new Error("اختر شكل الصورة.");
  if (!Number.isInteger(v.count) || Number(v.count) < 1 || Number(v.count) > 4) throw new Error("اختر من صورة إلى أربع صور.");
  if (v.consent !== true) throw new Error("أكد أن لديك إذن استخدام الصور، وموافقة ولي الأمر لصور الأطفال.");
  const labels = Array.isArray(v.labels) ? v.labels.slice(0, ZAYNAB_MAX_PHOTOS).map(label => String(label ?? "").trim().slice(0, 40)) : [];
  return { view: v.view as ZaynabView, style: v.style as ZaynabStyle, time: v.time as ZaynabTime, weather: v.weather as ZaynabWeather, aspect: v.aspect as ZaynabAspect, labels, greeting: v.greeting !== false, count: Number(v.count), consent: true };
}

/**
 * The picture's prompt. Image 1 is ALWAYS the photograph of the shrine (the place, never changed — only redrawn in the
 * look), the images after it are the people. Respectful by construction: modest and calm, nobody touching the shrine,
 * no holy figure shown, no writing (the greeting is added over the picture by the page).
 */
export function zaynabPrompt(input: ZaynabInput, photos: number): string {
  const style = ZAYNAB_STYLES.find(item => item.id === input.style)!;
  const view = ZAYNAB_VIEWS.find(item => item.id === input.view)!;
  const who = Array.from({ length: photos }, (_, i) => `Image ${i + 2}` + (input.labels[i] ? ` (“${input.labels[i]}”)` : "")).join(", ");
  return [
    "PUT THE PEOPLE IN THE PLACE. Image 1 is the PLACE: the courtyard of the holy shrine of Sayyida Zaynab (peace be upon her) near Damascus, as " + view.text + ". " + who + (photos > 1 ? " are" : " is") + " the PEOPLE: each of those photos shows one person, or a group — every person in every one of them appears in the final picture, standing together in front of the shrine.",
    "THE PLACE: keep the architecture of Image 1 exactly as it is — its golden dome, the drum below it, the two minarets, the iwan facade, the arcades, the tilework and the marble courtyard — the same shapes, proportions, colours and details, never redesigned, never invented anew; it is a plain daytime reference of an EMPTY courtyard, so its light and sky are changed to the time and weather asked below while the architecture stays, and it is redrawn in the look below together with the people. The dome stays visible and large behind the people, never hidden by them; the people stand in the foreground on the marble floor of the courtyard.",
    "WHO THEY ARE: keep each person's own face, hair, skin tone, age, build and anything distinctive (glasses, beard, freckles, dimples) and their own clothing exactly as it is in their photo — never merge two people, never drop anyone, never add a person who is not in a photo, never give two people the same face, and keep their real difference in height and age. Do not beautify: no smoothing, no slimming, no replacing a face with a generic one. Do not use the backgrounds of the people's photographs.",
    "THE PEOPLE'S POSE: standing together quietly and calmly, facing the camera or the shrine, with the dignity and modesty of a visit to a holy place; relaxed hands at their sides or together; natural gentle expressions. Nobody touches or climbs the shrine, nobody is shown in a disrespectful pose, no holy figure is depicted, and there is no writing, text, logo or watermark anywhere in the picture.",
    input.greeting ? "COMPOSITION: leave the top fifth of the frame as open sky with nothing important in it (no dome tip, no minaret top, no faces): a greeting is written there afterwards." : "",
    TIME_TEXT[input.time],
    WEATHER_TEXT[input.weather],
    "HOW IT IS DRAWN — " + style.name + ": " + style.text,
    "Everything — the people, the shrine and the sky — is rendered in this one look at one consistent level of stylisation, so the picture reads as a single image.",
  ].filter(Boolean).join("\n");
}

/**
 * The references a price is asked for, before any file is added: the chosen view and the people's photos, each a ready
 * image with real pixels (a reference without them is turned down by the generator's rules, whatever its count).
 */
export const zaynabQuoteRefs = (photos: number): RefMeta[] =>
  Array.from({ length: photos + 1 }, (_, i) => ({ id: `q${i}`, kind: "image", role: "reference", mime: "image/jpeg", bytes: 200_000, width: 1024, height: 1024, name: `image${i + 1}`, status: "ready" }));
