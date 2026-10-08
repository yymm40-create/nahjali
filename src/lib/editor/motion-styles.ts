// «مهارات الموشن» — the motion-graphics skills by name. Each one is a look the layout engine knows (pace, entrances,
// transitions between beats, the background, the drawn decorations, the sounds, the palette and fonts) plus the craft
// حيدرة follows when it is asked for (which beats, how long, the structure). The person writes its name («الريل
// السريع»، «الرقم الصادم»…) and حيدرة builds the piece in it; anything the person asks for beyond the name wins
// (another colour, slower, no sounds…), and every clip stays editable. Shown as chips in حيدرة's panel.
// Pure: shared by the server (حيدرة, the engine) and the page.

import type { BeatKind } from "./motion-build";
import type { TalkLayout } from "./talk-motion";

export type MotionPace = "fast" | "normal" | "calm";
export type MotionEntrance = "mixed" | "whip" | "rise" | "right" | "fade" | "settle" | "punch" | "blur" | "glitch" | "flash" | "wipe";

/** What the engine does with a piece (every field has a default; a skill sets some, the person's wishes override). */
export interface MotionLook {
  /** a named palette (night, paper, riso, studio, majlis) */
  palette?: string;
  /** headline and body fonts */
  head?: string;
  body?: string;
  /** how long beats stay and how quick the entrances are */
  pace: MotionPace;
  /** the headline's entrance ("mixed": a whip and a rise, alternating beat to beat) */
  entrance: MotionEntrance;
  /** the transitions between beats, cycled (none: hard cuts) */
  transitions: string[];
  /** a background that shifts a little every beat, or one steady colour */
  background: "beat" | "steady";
  /** the engine's drawn shapes around the words (bands, rings, rails, quote marks) */
  decor: boolean;
  /** the arrival sounds: all of them, only the big moments (quieter), or none */
  sfx: "full" | "soft" | "none";
  /** the slow push-in on headlines and decorations */
  drift: boolean;
}

export const DEFAULT_LOOK: MotionLook = {
  pace: "normal",
  entrance: "mixed",
  transitions: ["wipe", "slideLeft", "iris", "wipeDiagTR", "pushUp", "diamond", "clock", "uncoverLeft"],
  background: "beat",
  decor: true,
  sfx: "full",
  drift: true,
};

export interface MotionStyle {
  id: string;
  /** the name the person writes */
  ar: string;
  /** other ways of saying it (matched too) */
  aliases: string[];
  icon: string;
  /** one line for the chip's tooltip and the list */
  hint: string;
  /** the beats it is built from, mostly */
  beats: BeatKind[];
  look: Partial<MotionLook>;
  /** how حيدرة builds it (for Claude) */
  craft: string;
  /** a skill for a TALKING video (motion on the person's words, «talk»), with its layout — not a storyboard piece */
  talk?: TalkLayout;
}

export const MOTION_STYLES: MotionStyle[] = [
  {
    id: "explainer",
    ar: "الشرح العلمي",
    aliases: ["شرح علمي", "كرتزقزت", "kurzgesagt", "اكسبلينر", "explainer"],
    icon: "🔭",
    hint: "شرح هادئ وواضح على خلفية ليلية، فكرة وحدة بكل لقطة، أرقام وخطوات",
    beats: ["title", "statement", "stat", "steps", "points", "outro"],
    look: { palette: "night", pace: "normal", entrance: "rise", transitions: ["iris", "wipeSoft", "softDissolve", "pushUp"], background: "beat", sfx: "soft" },
    craft: "Kurzgesagt-like explainer: hook question → the problem → the mechanism in 3–6 one-idea beats (a stat or steps where it helps) → the payoff → outro. Calm, clear sentences; 4–5 s a beat.",
  },
  {
    id: "news",
    ar: "الهايلايتر الصحفي",
    aliases: ["هايلايتر", "صحفي", "فوكس", "vox", "تقرير"],
    icon: "🖍️",
    hint: "أسلوب التقارير: ورق فاتح، كلمة مظللة بالأصفر، اقتباسات وأرقام موثّقة",
    beats: ["kinetic", "quote", "stat", "statement", "outro"],
    look: { palette: "paper", pace: "normal", entrance: "fade", transitions: ["wipeLeft", "slideLeft", "wipe"], background: "steady", sfx: "soft" },
    craft: "Vox-like journalism: a kinetic hook with the key word in the highlighter pill (hot), quotes with their source, numbers only from the person's words; sober tone.",
  },
  {
    id: "reel",
    ar: "الريل السريع",
    aliases: ["ريل سريع", "ريلز", "reel", "تيك توك", "سوشال"],
    icon: "⚡",
    hint: "إيقاع سريع للسوشال: لقطات ٢–٣ ثواني، سحبات وانتقالات قوية ومؤثرات على كل دخول",
    beats: ["kinetic", "statement", "stat", "points", "outro"],
    look: { palette: "studio", pace: "fast", entrance: "whip", transitions: ["whipLeft", "whipRight", "punchIn", "zoomFlash"], background: "beat", sfx: "full" },
    craft: "A fast social reel (15–30 s): a kinetic hook in the first second, short punchy lines (2–5 words), 2–3 s beats, ends on the handle.",
  },
  {
    id: "kinetic",
    ar: "الكلمات الطائرة",
    aliases: ["كلمات طائرة", "كاينتك", "kinetic", "تايبوغرافي", "typography"],
    icon: "🔤",
    hint: "الكلام نفسه هو الموشن: كلمة تنزل ورا كلمة، والكلمة المهمة مظللة، قطع حاد بين اللقطات",
    beats: ["kinetic", "statement"],
    look: { pace: "fast", entrance: "punch", transitions: [], background: "steady", decor: false, sfx: "full" },
    craft: "Kinetic typography: almost every beat is «kinetic» (2–6 words, one a line, the key word hot), a statement between them for breath; hard cuts; follows the voice word by word.",
  },
  {
    id: "stat",
    ar: "الرقم الصادم",
    aliases: ["رقم صادم", "الأرقام", "انفوجرافيك", "infographic", "إحصائيات"],
    icon: "📊",
    hint: "الأرقام بطل القصة: رقم كبير يضرب على الشاشة مع وصفه، ومؤثر ضربة على كل رقم",
    beats: ["title", "stat", "stat", "compare", "outro"],
    look: { palette: "night", pace: "normal", entrance: "punch", transitions: ["flashWhite", "zoom", "pushUp"], background: "beat", sfx: "full" },
    craft: "An animated infographic: one big number per beat (≤ 6 characters) with its label and a short note; numbers ONLY from the person's words; a comparison when two numbers meet.",
  },
  {
    id: "steps",
    ar: "خطوة بخطوة",
    aliases: ["خطوه بخطوه", "الخطوات", "شرح خطوات", "تعليمي", "tutorial"],
    icon: "🪜",
    hint: "خطوات مرقمة تدخل من اليمين وحدة ورا وحدة، مناسب للشرح والتعليم",
    beats: ["title", "steps", "steps", "statement", "outro"],
    look: { pace: "normal", entrance: "right", transitions: ["slideLeft", "pushRight"], background: "beat", sfx: "soft" },
    craft: "A how-to: a title, then numbered steps (3–4 a screen, split over beats when more), each a short imperative; one closing statement and the outro.",
  },
  {
    id: "compare",
    ar: "قبل وبعد",
    aliases: ["المقارنة", "مقارنة", "قبل و بعد", "before after"],
    icon: "⚖️",
    hint: "طرفين جنب بعض: قبل وبعد، الخطأ والصح، هذا وذاك",
    beats: ["title", "compare", "compare", "statement", "outro"],
    look: { pace: "normal", entrance: "mixed", transitions: ["wipeDiagTR", "barnH", "slideLeft"], background: "beat", sfx: "soft" },
    craft: "Comparisons: each beat a «compare» (right = before / the first / the better one), a statement that says the lesson, the outro.",
  },
  {
    id: "luxury",
    ar: "الفخامة",
    aliases: ["فخم", "فخامة", "لكجري", "luxury", "ذهبي"],
    icon: "👑",
    hint: "هادئ وفخم: ذهبي على كحلي، خط أميري، ظهور ناعم وانتقالات ذهبية",
    beats: ["title", "statement", "quote", "outro"],
    look: { palette: "majlis", head: "amiri", body: "tajawal", pace: "calm", entrance: "fade", transitions: ["softDissolve", "dipGold", "fade"], background: "steady", sfx: "soft" },
    craft: "Luxury: few words, generous holds (5–6 s), elegant sentences, no exclamation; the brand name held long at the end.",
  },
  {
    id: "spiritual",
    ar: "الروحاني",
    aliases: ["روحاني", "ديني", "إيماني", "ايماني", "مناسبة دينية"],
    icon: "🕌",
    hint: "للمحتوى الديني والمناسبات: هادئ وخاشع، خط أميري، ظهور ناعم بدون ضربات قوية",
    beats: ["title", "quote", "statement", "outro"],
    look: { palette: "majlis", head: "amiri", body: "naskh", pace: "calm", entrance: "blur", transitions: ["softDissolve", "dipGold"], background: "steady", sfx: "soft" },
    craft: "Religious and occasion content: reverent and calm, quotes (a verse or a narration exactly as the person gave it, with its source in «by»), no punches or glitches, no music unless asked.",
  },
  {
    id: "playful",
    ar: "المرح",
    aliases: ["مرح", "أطفال", "اطفال", "كيوت", "playful", "kids"],
    icon: "🎈",
    hint: "ألوان مرحة وأشكال، دخول مستقر لطيف وانتقالات بأشكال (نجمة، قلب، ماسة)",
    beats: ["kinetic", "points", "statement", "outro"],
    look: { palette: "riso", pace: "fast", entrance: "settle", transitions: ["diamond", "star", "heart", "iris"], background: "beat", sfx: "full" },
    craft: "Playful and for kids: simple words, short beats, friendly tone, lists of fun points; never scary.",
  },
  {
    id: "ad",
    ar: "الإعلان الخاطف",
    aliases: ["إعلان خاطف", "اعلان", "إعلان", "ad", "برومو", "promo"],
    icon: "📣",
    hint: "إعلان ١٥–٣٠ ثانية: هوك ← المشكلة ← الحل ← النداء، سريع وقوي",
    beats: ["kinetic", "statement", "points", "stat", "outro"],
    look: { palette: "studio", pace: "fast", entrance: "whip", transitions: ["whipLeft", "punchIn", "flashWhite"], background: "beat", sfx: "full" },
    craft: "An ad of 15–30 s: hook (≤ 2 s) → the pain (1 beat) → the product as the answer (2–3 beats: benefits, one number) → the offer and the call to action, held ≥ 3 s.",
  },
  {
    id: "clean",
    ar: "البسيط النظيف",
    aliases: ["بسيط", "نظيف", "مينيمال", "minimal", "clean"],
    icon: "◻️",
    hint: "هادئ ومرتب بدون زخارف: خلفية ثابتة، صعود ناعم، انتقالات قليلة",
    beats: ["title", "statement", "points", "outro"],
    look: { pace: "normal", entrance: "rise", transitions: ["wipe", "slideLeft"], background: "steady", decor: false, sfx: "soft" },
    craft: "Minimal (School of Motion-like): strict hierarchy, lots of space, one idea a beat, no decoration; reads like a calm brand piece.",
  },
  {
    id: "tech",
    ar: "التقني",
    aliases: ["تقني", "تكنو", "tech", "قلتش", "glitch", "سايبر"],
    icon: "💻",
    hint: "طابع تقني: دخول قلتش، انتقالات رقمية (بكسل، تشويش)، سريع",
    beats: ["kinetic", "stat", "points", "outro"],
    look: { palette: "studio", head: "readex", pace: "fast", entrance: "glitch", transitions: ["glitchT", "rgbSplitT", "pixelT"], background: "beat", sfx: "full" },
    craft: "Tech: crisp short lines, numbers and features, a launch feel; Latin product names kept as they are.",
  },
  {
    id: "cinematic",
    ar: "السينمائي",
    aliases: ["سينمائي", "سينما", "cinematic", "تريلر", "trailer"],
    icon: "🎞️",
    hint: "مثل التريلر: جمل قليلة على خلفية داكنة، ظهور من الضباب، انتقالات للأسود",
    beats: ["statement", "kinetic", "quote", "outro"],
    look: { palette: "night", pace: "calm", entrance: "blur", transitions: ["black", "zoom", "softDissolve"], background: "steady", decor: false, sfx: "soft" },
    craft: "A trailer: short dramatic lines with pauses, building up; the title revealed last, held long.",
  },
  {
    id: "box",
    ar: "المربع الصغير",
    aliases: ["مربع صغير", "اسلوب ماجد", "ستايل ماجد", "بكتشر ان بكتشر", "pip"],
    icon: "🔳",
    hint: "على فيديو تتكلم فيه: أول ما تقول شي يطلع، وأنت تصغر في مربع تحت (متمركز على وجهك) وترجع",
    beats: [],
    look: {},
    talk: "shrink",
    craft: "Motion on the person's talking video («talk», layout \"shrink\"): the moment they say a thing it appears above, and they shrink into a box at the bottom, the box centred on their face.",
  },
  {
    id: "float3d",
    ar: "فوق كلامي ثلاثي الأبعاد",
    aliases: ["ثلاثي الابعاد", "ثري دي", "فوق كلامي", "بدون ما يصغرني", "بدون مربع"],
    icon: "🧊",
    hint: "على فيديو تتكلم فيه وأنت بملء الشاشة: الكلمات والأرقام والشعارات تطلع بشكل ثلاثي الأبعاد بعيد عن وجهك",
    beats: [],
    look: {},
    talk: "over3d",
    craft: "Motion on the person's talking video («talk», layout \"over3d\"): they stay full screen; the words, numbers and app logos float in 3D (slabs and tiles flipping in, tilting slowly) where their face isn't.",
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[«»"'“”:،,.!؟?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const motionStyleOf = (id: unknown): MotionStyle | undefined => (typeof id === "string" && id ? MOTION_STYLES.find((s) => s.id === id || norm(s.ar) === norm(id)) : undefined);

/** The skill named in the person's words (the full name first, then an alias), or none. */
export function styleInText(text: string): MotionStyle | undefined {
  const t = ` ${norm(text)} `;
  return MOTION_STYLES.find((s) => t.includes(` ${norm(s.ar)} `)) ?? MOTION_STYLES.find((s) => s.aliases.some((a) => norm(a).length >= 3 && t.includes(` ${norm(a)} `)));
}

const PACES: MotionPace[] = ["fast", "normal", "calm"];
const ENTRANCES: MotionEntrance[] = ["mixed", "whip", "rise", "right", "fade", "settle", "punch", "blur", "glitch", "flash", "wipe"];

/** A look from حيدرة's JSON (what the person asked to change), unknown values dropped. */
export function readLook(raw: unknown, transitionIds: ReadonlySet<string>): Partial<MotionLook> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<MotionLook> = {};
  if (PACES.includes(o.pace as MotionPace)) out.pace = o.pace as MotionPace;
  if (ENTRANCES.includes(o.entrance as MotionEntrance)) out.entrance = o.entrance as MotionEntrance;
  if (Array.isArray(o.transitions)) out.transitions = o.transitions.filter((x): x is string => typeof x === "string" && transitionIds.has(x)).slice(0, 8);
  if (o.background === "beat" || o.background === "steady") out.background = o.background;
  if (typeof o.decor === "boolean") out.decor = o.decor;
  if (o.sfx === "full" || o.sfx === "soft" || o.sfx === "none") out.sfx = o.sfx;
  if (typeof o.drift === "boolean") out.drift = o.drift;
  return out;
}

/** The look of a piece: the defaults, then the named skill's, then what the person asked for (always last: it wins). */
export function lookOf(style: string | undefined, own: Partial<MotionLook> | undefined): MotionLook & { style?: MotionStyle } {
  const s = motionStyleOf(style);
  return { ...DEFAULT_LOOK, ...(s?.look ?? {}), ...(own ?? {}), ...(s ? { style: s } : {}) };
}

/** What حيدرة knows about the named skills (in his system prompt). */
export const MOTION_STYLES_SKILL = `NAMED MOTION SKILLS («مهارات الموشن») — each one a look the engine knows. When the person writes one of these names (or asks for "a motion in the style of …"), build the storyboard in it: set "style":"<id>" and follow its craft. THE PERSON'S OWN WISHES COME FIRST: anything they ask beyond the name (another colour or palette, slower, other fonts, no sounds, no decorations, a different transition, other beats) goes in the storyboard and wins over the skill — "palette"/"colors"/"head"/"body" for colours and fonts, and "look" for the rest: {"pace":"fast"|"normal"|"calm","entrance":"mixed"|"whip"|"rise"|"right"|"fade"|"settle"|"punch"|"blur"|"glitch"|"flash"|"wipe","transitions":["<transition id>",…] ([] = hard cuts),"background":"beat"|"steady","decor":true|false,"sfx":"full"|"soft"|"none","drift":true|false}. Only write "palette"/"look" fields the person asked for (the skill sets the rest). Say in your reply which skill you used and that they can change anything in it.
${MOTION_STYLES.map((s) => (s.talk ? `- «${s.ar}» (also: ${s.aliases.slice(0, 3).join("، ")}) — ${s.craft} Not a storyboard: write "talk" with "layout":"${s.talk}" (or the talk_motion request first when the clip has no "speech").` : `- «${s.ar}» (style "${s.id}"; also: ${s.aliases.slice(0, 3).join("، ")}) — ${s.craft} Beats: ${s.beats.join(", ")}.`)).join("\n")}`;
