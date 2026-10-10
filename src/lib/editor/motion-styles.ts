// «مهارات الموشن» — the motion-graphics skills by name. Each one is a look the layout engine knows (pace, entrances,
// transitions between beats, the background, the drawn decorations, the sounds, the palette and fonts) plus the craft
// حيدرة follows when it is asked for (which beats, how long, the structure). The person writes its name («الريل
// السريع»، «الرقم الصادم»…) and حيدرة builds the piece in it; anything the person asks for beyond the name wins
// (another colour, slower, no sounds…), and every clip stays editable. Shown as chips in حيدرة's panel.
// Pure: shared by the server (حيدرة, the engine) and the page.

import type { BeatKind } from "./motion-build";
import type { TalkLayout } from "./talk-motion";

export type MotionPace = "fast" | "normal" | "calm";
/** The art's language: how backgrounds and decorations are drawn (motion-art.ts) — each skill its own. */
export type MotionTheme = "glow" | "paper" | "bold" | "flat" | "chart" | "rail" | "split" | "frame" | "arabesque" | "confetti" | "badge" | "none" | "grid" | "film" | "blueprint" | "comic" | "neon" | "collage" | "sketch" | "gradient" | "terminal" | "mosaic" | "isometric" | "fluid" | "stamp" | "ticket" | "xray" | "marble" | "duotone" | "scoreboard" | "halftone" | "circuit" | "origami" | "spotlight" | "weave";
/** The drawn scenes that can sit behind a beat (motion-scenes.ts); "none" = no scene. */
export type SceneId = "stars" | "rain" | "dunes" | "skyline" | "mosque" | "waves" | "clouds" | "rays" | "sparkles" | "bars" | "rings" | "stripes" | "dots" | "hills" | "chalk" | "none";
export const SCENE_IDS: SceneId[] = ["stars", "rain", "dunes", "skyline", "mosque", "waves", "clouds", "rays", "sparkles", "bars", "rings", "stripes", "dots", "hills", "chalk", "none"];
/** The feeling a piece (or one beat) carries: it sets the tempo, the entrances and the scene drawn behind the words. */
export type MotionMood = "joy" | "sad" | "teach" | "aware" | "urgent" | "calm" | "proud" | "hype" | "faith";
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
  /** the art's language (backgrounds, decorations) */
  theme: MotionTheme;
  /** the words centred, or on the right (Arabic's start) */
  align: "center" | "right";
  /** the feeling of the piece (a beat can carry its own) */
  mood?: MotionMood;
  /** a scene behind every beat that has none of its own ("none"/absent: only the theme's art) */
  scene?: SceneId;
}

export const DEFAULT_LOOK: MotionLook = {
  pace: "normal",
  entrance: "mixed",
  transitions: ["wipe", "slideLeft", "iris", "wipeDiagTR", "pushUp", "diamond", "clock", "uncoverLeft"],
  background: "beat",
  decor: true,
  sfx: "full",
  drift: true,
  theme: "glow",
  align: "center",
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
    look: { palette: "night", head: "cairo", body: "tajawal", pace: "normal", entrance: "rise", transitions: ["iris", "wipeSoft", "softDissolve", "pushUp"], background: "beat", sfx: "soft", theme: "glow", align: "center" },
    craft: "Kurzgesagt-like explainer: hook question → the problem → the mechanism in 3–6 one-idea beats (a stat or steps where it helps) → the payoff → outro. Calm, clear sentences; 4–5 s a beat.",
  },
  {
    id: "news",
    ar: "الهايلايتر الصحفي",
    aliases: ["هايلايتر", "صحفي", "فوكس", "vox", "تقرير"],
    icon: "🖍️",
    hint: "أسلوب التقارير: ورق فاتح، كلمة مظللة بالأصفر، اقتباسات وأرقام موثّقة",
    beats: ["kinetic", "quote", "stat", "statement", "outro"],
    look: { palette: "paper", head: "changa", body: "ibm-plex-sans-arabic", pace: "normal", entrance: "fade", transitions: ["wipeLeft", "slideLeft", "wipe"], background: "steady", sfx: "soft", theme: "paper", align: "right" },
    craft: "Vox-like journalism: a kinetic hook with the key word in the highlighter pill (hot), quotes with their source, numbers only from the person's words; sober tone.",
  },
  {
    id: "reel",
    ar: "الريل السريع",
    aliases: ["ريل سريع", "ريلز", "reel", "تيك توك", "سوشال"],
    icon: "⚡",
    hint: "إيقاع سريع للسوشال: لقطات ٢–٣ ثواني، سحبات وانتقالات قوية ومؤثرات على كل دخول",
    beats: ["kinetic", "statement", "stat", "points", "outro"],
    look: { palette: "studio", head: "alexandria", body: "cairo", pace: "fast", entrance: "whip", transitions: ["whipLeft", "whipRight", "punchIn", "zoomFlash"], background: "beat", sfx: "full", theme: "bold", align: "center" },
    craft: "A fast social reel (15–30 s): a kinetic hook in the first second, short punchy lines (2–5 words), 2–3 s beats, ends on the handle.",
  },
  {
    id: "kinetic",
    ar: "الكلمات الطائرة",
    aliases: ["كلمات طائرة", "كاينتك", "kinetic", "تايبوغرافي", "typography"],
    icon: "🔤",
    hint: "الكلام نفسه هو الموشن: كلمة تنزل ورا كلمة، والكلمة المهمة مظللة، قطع حاد بين اللقطات",
    beats: ["kinetic", "statement"],
    look: { head: "kufam", body: "cairo", pace: "fast", entrance: "punch", transitions: [], background: "steady", decor: false, sfx: "full", theme: "flat", align: "center" },
    craft: "Kinetic typography: almost every beat is «kinetic» (2–6 words, one a line, the key word hot), a statement between them for breath; hard cuts; follows the voice word by word.",
  },
  {
    id: "stat",
    ar: "الرقم الصادم",
    aliases: ["رقم صادم", "الأرقام", "انفوجرافيك", "infographic", "إحصائيات"],
    icon: "📊",
    hint: "الأرقام بطل القصة: رقم كبير يضرب على الشاشة مع وصفه، ومؤثر ضربة على كل رقم",
    beats: ["title", "stat", "stat", "compare", "outro"],
    look: { palette: "night", head: "changa", body: "tajawal", pace: "normal", entrance: "punch", transitions: ["flashWhite", "zoom", "pushUp"], background: "beat", sfx: "full", theme: "chart", align: "center" },
    craft: "An animated infographic: one big number per beat (≤ 6 characters) with its label and a short note; numbers ONLY from the person's words; a comparison when two numbers meet.",
  },
  {
    id: "steps",
    ar: "خطوة بخطوة",
    aliases: ["خطوه بخطوه", "الخطوات", "شرح خطوات", "تعليمي", "tutorial"],
    icon: "🪜",
    hint: "خطوات مرقمة تدخل من اليمين وحدة ورا وحدة، مناسب للشرح والتعليم",
    beats: ["title", "steps", "steps", "statement", "outro"],
    look: { head: "almarai", body: "almarai", pace: "normal", entrance: "right", transitions: ["slideLeft", "pushRight"], background: "beat", sfx: "soft", theme: "rail", align: "right" },
    craft: "A how-to: a title, then numbered steps (3–4 a screen, split over beats when more), each a short imperative; one closing statement and the outro.",
  },
  {
    id: "compare",
    ar: "قبل وبعد",
    aliases: ["المقارنة", "مقارنة", "قبل و بعد", "before after"],
    icon: "⚖️",
    hint: "طرفين جنب بعض: قبل وبعد، الخطأ والصح، هذا وذاك",
    beats: ["title", "compare", "compare", "statement", "outro"],
    look: { head: "cairo", body: "tajawal", pace: "normal", entrance: "mixed", transitions: ["wipeDiagTR", "barnH", "slideLeft"], background: "beat", sfx: "soft", theme: "split", align: "center" },
    craft: "Comparisons: each beat a «compare» (right = before / the first / the better one), a statement that says the lesson, the outro.",
  },
  {
    id: "luxury",
    ar: "الفخامة",
    aliases: ["فخم", "فخامة", "لكجري", "luxury", "ذهبي"],
    icon: "👑",
    hint: "هادئ وفخم: ذهبي على كحلي، خط أميري، ظهور ناعم وانتقالات ذهبية",
    beats: ["title", "statement", "quote", "outro"],
    look: { palette: "majlis", head: "amiri", body: "markazi-text", pace: "calm", entrance: "fade", transitions: ["softDissolve", "dipGold", "fade"], background: "steady", sfx: "soft", theme: "frame", align: "center" },
    craft: "Luxury: few words, generous holds (5–6 s), elegant sentences, no exclamation; the brand name held long at the end.",
  },
  {
    id: "spiritual",
    ar: "الروحاني",
    aliases: ["روحاني", "ديني", "إيماني", "ايماني", "مناسبة دينية"],
    icon: "🕌",
    hint: "للمحتوى الديني والمناسبات: هادئ وخاشع، خط أميري، ظهور ناعم بدون ضربات قوية",
    beats: ["title", "quote", "statement", "outro"],
    look: { palette: "majlis", head: "amiri", body: "harmattan", pace: "calm", entrance: "blur", transitions: ["softDissolve", "dipGold"], background: "steady", sfx: "soft", theme: "arabesque", align: "center" },
    craft: "Religious and occasion content: reverent and calm, quotes (a verse or a narration exactly as the person gave it, with its source in «by»), no punches or glitches, no music unless asked.",
  },
  {
    id: "playful",
    ar: "المرح",
    aliases: ["مرح", "أطفال", "اطفال", "كيوت", "playful", "kids"],
    icon: "🎈",
    hint: "ألوان مرحة وأشكال، دخول مستقر لطيف وانتقالات بأشكال (نجمة، قلب، ماسة)",
    beats: ["kinetic", "points", "statement", "outro"],
    look: { palette: "riso", head: "marhey", body: "baloo-bhaijaan-2", pace: "fast", entrance: "settle", transitions: ["diamond", "star", "heart", "iris"], background: "beat", sfx: "full", theme: "confetti", align: "center" },
    craft: "Playful and for kids: simple words, short beats, friendly tone, lists of fun points; never scary.",
  },
  {
    id: "ad",
    ar: "الإعلان الخاطف",
    aliases: ["إعلان خاطف", "اعلان", "إعلان", "ad", "برومو", "promo"],
    icon: "📣",
    hint: "إعلان ١٥–٣٠ ثانية: هوك ← المشكلة ← الحل ← النداء، سريع وقوي",
    beats: ["kinetic", "statement", "points", "stat", "outro"],
    look: { palette: "studio", head: "lalezar", body: "cairo", pace: "fast", entrance: "whip", transitions: ["whipLeft", "punchIn", "flashWhite"], background: "beat", sfx: "full", theme: "badge", align: "center" },
    craft: "An ad of 15–30 s: hook (≤ 2 s) → the pain (1 beat) → the product as the answer (2–3 beats: benefits, one number) → the offer and the call to action, held ≥ 3 s.",
  },
  {
    id: "clean",
    ar: "البسيط النظيف",
    aliases: ["بسيط", "نظيف", "مينيمال", "minimal", "clean"],
    icon: "◻️",
    hint: "هادئ ومرتب بدون زخارف: خلفية ثابتة، صعود ناعم، انتقالات قليلة",
    beats: ["title", "statement", "points", "outro"],
    look: { head: "fustat", body: "fustat", pace: "normal", entrance: "rise", transitions: ["wipe", "slideLeft"], background: "steady", decor: false, sfx: "soft", theme: "none", align: "right" },
    craft: "Minimal (School of Motion-like): strict hierarchy, lots of space, one idea a beat, no decoration; reads like a calm brand piece.",
  },
  {
    id: "tech",
    ar: "التقني",
    aliases: ["تقني", "تكنو", "tech", "قلتش", "glitch", "سايبر"],
    icon: "💻",
    hint: "طابع تقني: دخول قلتش، انتقالات رقمية (بكسل، تشويش)، سريع",
    beats: ["kinetic", "stat", "points", "outro"],
    look: { palette: "studio", head: "readex", body: "ibm-plex-sans-arabic", pace: "fast", entrance: "glitch", transitions: ["glitchT", "rgbSplitT", "pixelT"], background: "beat", sfx: "full", theme: "grid", align: "right" },
    craft: "Tech: crisp short lines, numbers and features, a launch feel; Latin product names kept as they are.",
  },
  {
    id: "cinematic",
    ar: "السينمائي",
    aliases: ["سينمائي", "سينما", "cinematic", "تريلر", "trailer"],
    icon: "🎞️",
    hint: "مثل التريلر: جمل قليلة على خلفية داكنة، ظهور من الضباب، انتقالات للأسود",
    beats: ["statement", "kinetic", "quote", "outro"],
    look: { palette: "night", head: "el-messiri", body: "amiri", pace: "calm", entrance: "blur", transitions: ["black", "zoom", "softDissolve"], background: "steady", decor: false, sfx: "soft", theme: "film", align: "center" },
    craft: "A trailer: short dramatic lines with pauses, building up; the title revealed last, held long.",
  },
  // ── twenty more kinds of motion graphics, each one radically different: its own palette, art language, fonts,
  // tempo, entrances, transitions, decorations, sounds and alignment — nothing shared with its neighbours ──
  {
    id: "blueprint",
    ar: "مخطط هندسي",
    aliases: ["بلوبرنت", "هندسي", "رسم تقني", "blueprint", "مخطط"],
    icon: "📐",
    hint: "ورق أزرق بشبكة وخطوط مقاسات: الكلام يطلع كأنه مخطط تقني يُرسم أمامك",
    beats: ["title", "steps", "points", "stat", "outro"],
    look: { palette: "cyan", theme: "blueprint", head: "ibm-plex-sans-arabic", body: "ibm-plex-sans-arabic", pace: "calm", entrance: "wipe", transitions: ["wipeSoft", "barnH", "clock"], background: "steady", decor: true, sfx: "soft", drift: false, align: "right", scene: "none" },
    craft: "An engineer's blueprint: the cyan grid stays still while everything is DRAWN in — titles wipe in from the right, steps and dimensions appear in order, no bounce and no drift. Numbers are circled like a detail callout. Calm tempo, quiet sounds, the words on the right like a technical sheet.",
  },
  {
    id: "comicbook",
    ar: "كوميكس",
    aliases: ["كوميك", "مانجا", "قصص مصورة", "comic", "بوب آرت"],
    icon: "💥",
    hint: "لوحة كوميكس: نقاط هالفتون وحدود حبر سميكة وانفجارات، والكلمات تضرب بقوة",
    beats: ["title", "statement", "stat", "points", "outro"],
    look: { palette: "mono", theme: "comic", head: "lalezar", body: "baloo-bhaijaan-2", pace: "fast", entrance: "punch", transitions: ["whipLeft", "flashWhite", "staticT", "whipRight"], background: "beat", decor: true, sfx: "full", drift: false, align: "center" },
    craft: "A comic page: halftone dots, a thick ink border and a burst behind the words. Every beat PUNCHES in (never grows from nothing), whips and white flashes between beats, loud arrival sounds, display type (Lalezar) for the shouting lines. Fast, two or three words a beat.",
  },
  {
    id: "neonnight",
    ar: "نيون ليلي",
    aliases: ["نيون", "سايبر", "ليل نيون", "neon", "توهج"],
    icon: "🌃",
    hint: "ليل وشبكة نيون متوهجة تجري للأفق، ألوان سيان ووردي ودخول قلتش",
    beats: ["title", "statement", "stat", "kinetic", "outro"],
    look: { palette: "neonpal", theme: "neon", head: "handjet", body: "readex-pro", pace: "fast", entrance: "glitch", transitions: ["glitchT", "rgbSplitT", "zoomFlash", "tvOff"], background: "steady", decor: true, sfx: "full", drift: true, align: "center", mood: "hype" },
    craft: "A neon night: the glowing horizon grid runs to its vanishing point, the words glitch in with an RGB split, the transitions are electric (glitch, tv-off). Keep the text few and huge; the glow does the work. Never a warm colour here.",
  },
  {
    id: "collage",
    ar: "كولاج ورق",
    aliases: ["ورق مقصوص", "قص ولزق", "مجلة", "collage", "سكرابوك"],
    icon: "✂️",
    hint: "طبقات ورق ممزق وشرائط لاصقة: شكل المجلات المقصوصة باليد",
    beats: ["title", "quote", "points", "statement", "outro"],
    look: { palette: "cream", theme: "collage", head: "el-messiri", body: "markazi-text", pace: "normal", entrance: "settle", transitions: ["staggerRows", "wipeDiagTL", "checker"], background: "beat", decor: true, sfx: "soft", drift: true, align: "right" },
    craft: "Cut-and-paste: torn paper strips with tape at their corners, serif-ish Arabic (El Messiri over Markazi), each line settling onto the page as if laid down by hand. Staggered and diagonal transitions. Quotes belong here.",
  },
  {
    id: "sketchbook",
    ar: "دفتر رسم",
    aliases: ["خربشة", "كرايون", "مرسوم باليد", "sketch", "دودل"],
    icon: "🖍️",
    hint: "صفحة مرسومة باليد: خربشات ونجوم وأسهم كرايون وإطار متقطع، بخط يد",
    beats: ["title", "steps", "points", "statement", "outro"],
    look: { palette: "candy", theme: "sketch", head: "reem-kufi-fun", body: "playpen-sans-arabic", pace: "normal", entrance: "wipe", transitions: ["wipeSoft", "dotsT", "staggerCols"], background: "beat", decor: true, sfx: "soft", drift: false, align: "center", mood: "joy" },
    craft: "A hand-drawn page: crayon squiggles, stars and arrows around the words, a dashed border, handwriting fonts (Playpen). Everything is WRITTEN in (wipe), never punched. Good for teaching a child or a light idea.",
  },
  {
    id: "terminal",
    ar: "شاشة طرفية",
    aliases: ["كونسول", "كود", "ترمنال", "terminal", "مبرمج"],
    icon: "🖥️",
    hint: "كونسول أخضر على أسود بسطور أوامر ومؤشر وامض: شكل المبرمجين",
    beats: ["title", "points", "steps", "stat", "outro"],
    look: { palette: "term", theme: "terminal", head: "cascadia-code", body: "cascadia-code", pace: "fast", entrance: "wipe", transitions: ["staticT", "pixelT", "glitchT"], background: "steady", decor: true, sfx: "soft", drift: false, align: "right" },
    craft: "A console: the prompt line at the top, a blinking cursor block at the bottom, monospace (Cascadia) everywhere, lines TYPED in (wipe) one after another in brackets. Pixel and static transitions. For anything technical, a command, a release note.",
  },
  {
    id: "appstore",
    ar: "واجهة تطبيق",
    aliases: ["تطبيق", "موبايل", "كروت", "app", "تدرجات"],
    icon: "📱",
    hint: "تدرجات ناعمة وكروت مستديرة: شكل واجهات التطبيقات الحديثة",
    beats: ["title", "points", "stat", "compare", "outro"],
    look: { palette: "sunset", theme: "gradient", head: "rubik", body: "alexandria", pace: "normal", entrance: "rise", transitions: ["softDissolve", "pushUp", "blurWhip"], background: "beat", decor: false, sfx: "soft", drift: true, align: "center" },
    craft: "A product page: blurred colour blobs behind rounded cards, geometric sans (Rubik over Alexandria), everything RISES in softly and dissolves out. No decorations fighting the words — the gradient is the design. For a feature, a price, an app's news.",
  },
  {
    id: "newspaper",
    ar: "صحيفة",
    aliases: ["جريدة", "خبر عاجل", "newspaper", "مطبوعة"],
    icon: "📰",
    hint: "ورق مطبوع بأعمدة وعنوان عريض وشريط عاجل: شكل الصحف",
    beats: ["title", "statement", "quote", "points", "outro"],
    look: { palette: "ink", theme: "stamp", head: "alyamama", body: "amiri", pace: "normal", entrance: "right", transitions: ["wipeLeft", "slideLeft", "flashWhite"], background: "steady", decor: true, sfx: "soft", drift: false, align: "right" },
    craft: "Print: a headline in display Arabic (Alyamama) over body Naskh (Amiri) on near-white paper, lines sliding in from the right like a press plate, a highlighted strip for the one claim. Keep it sober — one red accent only.",
  },
  {
    id: "chalkboard",
    ar: "سبورة الدرس",
    aliases: ["سبورة", "طباشير", "معلم", "chalk", "درس"],
    icon: "🧑‍🏫",
    hint: "سبورة خضراء بآثار طباشير: الشرح يُكتب بخط اليد خطوة خطوة",
    beats: ["title", "steps", "points", "statement", "outro"],
    look: { palette: "forest", theme: "xray", head: "aref-ruqaa", body: "playpen-sans-arabic", pace: "calm", entrance: "wipe", transitions: ["wipeSoft", "fade"], background: "steady", decor: true, sfx: "none", drift: false, align: "right", scene: "chalk", mood: "teach" },
    craft: "A teacher's board: chalk marks behind the words, Ruqaa for the title and handwriting for the body, each step WRITTEN in slowly, no sounds at all, nothing moving but the writing. The calmest kind — for a real explanation.",
  },
  {
    id: "luxurygold",
    ar: "ذهب على أسود",
    aliases: ["فخامة ذهبية", "ذهبي", "رفاهية", "luxury gold", "فندق"],
    icon: "🥇",
    hint: "أسود عميق وخطوط ذهبية رقيقة وإطار: فخامة هادئة",
    beats: ["title", "statement", "points", "quote", "outro"],
    look: { palette: "gold", theme: "marble", head: "badeen-display", body: "alexandria", pace: "calm", entrance: "fade", transitions: ["dipGold", "softDissolve", "flareSweep"], background: "steady", decor: true, sfx: "soft", drift: true, align: "center" },
    craft: "Quiet luxury: black, a fine gold double frame, display Arabic for the one line that matters, everything FADES (never whips), gold dips between beats and a slow drift on every title. Few words, much space.",
  },
  {
    id: "datadash",
    ar: "لوحة بيانات",
    aliases: ["داشبورد", "أرقام", "تقرير", "dashboard", "إحصاء"],
    icon: "📊",
    hint: "شبكة وأعمدة بيانات: الأرقام والمقارنات هي البطل",
    beats: ["title", "stat", "compare", "points", "outro"],
    look: { palette: "studio", theme: "weave", head: "zain", body: "ibm-plex-sans-arabic", pace: "normal", entrance: "rise", transitions: ["wipeUp", "staggerCols", "pushUp"], background: "steady", decor: true, sfx: "soft", drift: false, align: "center" },
    craft: "A dashboard: the faint grid and bars stay, numbers RISE from the baseline and count into place, every beat is a number or a comparison with its label under it. Nothing decorative — the chart language is the design.",
  },
  {
    id: "vhs",
    ar: "شريط VHS",
    aliases: ["ريترو تسعينات", "كاسيت", "vhs", "تلفزيون قديم"],
    icon: "📼",
    hint: "شريط قديم: خطوط تتبع وتشويش وألوان منزاحة، شكل التسعينات",
    beats: ["title", "statement", "kinetic", "stat", "outro"],
    look: { palette: "mono", theme: "duotone", head: "handjet", body: "rubik", pace: "fast", entrance: "glitch", transitions: ["tvOff", "staticT", "rgbSplitT", "pixelT"], background: "beat", decor: true, sfx: "full", drift: false, align: "center" },
    craft: "A worn tape: scanlines and corner brackets, the words arrive with a glitch and an RGB split, the cuts are tv-off and static. Pixel type (Handjet) for the title. Loud and rough on purpose — for nostalgia or a joke.",
  },
  {
    id: "stickerpop",
    ar: "ستيكرات ملونة",
    aliases: ["ملصقات", "كونفيتي", "ألوان حلوة", "sticker", "مرح جدا"],
    icon: "🏷️",
    hint: "ألوان حلوة وكونفيتي وستيكرات بحواف بيضاء: أعلى درجات المرح",
    beats: ["title", "points", "stat", "statement", "outro"],
    look: { palette: "candy", theme: "spotlight", head: "lemonada", body: "baloo-bhaijaan-2", pace: "fast", entrance: "punch", transitions: ["heart", "star", "sparkleT", "dotsT"], background: "beat", decor: true, sfx: "full", drift: true, align: "center", mood: "joy" },
    craft: "Stickers and confetti: soft blobs, tilted confetti, rounded playful type (Lemonada), words punching in with hearts and stars between beats. The loudest happy kind — for children, sweets, a celebration.",
  },
  {
    id: "arabesque",
    ar: "زخرفة إسلامية",
    aliases: ["أرابيسك", "نجمة إسلامية", "زخارف", "arabesque", "تراث"],
    icon: "🕌",
    hint: "شبكة نجوم إسلامية وضوء من أعلى وخط عربي أصيل: للمناسبات والتراث",
    beats: ["title", "quote", "statement", "points", "outro"],
    look: { palette: "majlis", theme: "mosaic", head: "aref-ruqaa", body: "scheherazade-new", pace: "calm", entrance: "fade", transitions: ["dipGold", "iris", "softDissolve"], background: "steady", decor: true, sfx: "soft", drift: true, align: "center", scene: "mosque", mood: "faith" },
    craft: "The star lattice with light from above, Ruqaa titles over Scheherazade body, everything fades and drifts, gold dips between beats, an arch behind a quote. For a hadith, a poem, an occasion — dignified, never flashy.",
  },
  {
    id: "brutalist",
    ar: "بروتاليست",
    aliases: ["مينيمال جريء", "لونين", "حاد", "brutalist", "أسود وأحمر"],
    icon: "⬛",
    hint: "لونين فقط ومساحات فاضية وعناوين ضخمة وقطع حاد بلا أي زخرفة",
    beats: ["title", "statement", "stat", "outro"],
    look: { palette: "mono", theme: "origami", head: "cairo", body: "cairo", pace: "fast", entrance: "right", transitions: [], background: "steady", decor: false, sfx: "none", drift: false, align: "right" },
    craft: "Brutalist: two colours, one font (Cairo) at two sizes, enormous titles, no decorations, no sounds, NO transitions — hard cuts only, the words sliding in from the right. The emptiest kind, and the strongest for one sentence.",
  },
  {
    id: "typeposter",
    ar: "بوستر تايبوغرافي",
    aliases: ["تايبوغرافي", "خطوط ضخمة", "بوستر", "typography", "كلمات كبيرة"],
    icon: "🔠",
    hint: "الخط نفسه هو التصميم: كلمات ضخمة متراكبة بأحجام مختلفة تتبدل على الإيقاع",
    beats: ["kinetic", "title", "statement", "quote", "outro"],
    look: { palette: "ink", theme: "halftone", head: "oi", body: "changa", pace: "fast", entrance: "whip", transitions: ["whipUp", "whipDown", "squeezeV", "stretchIn"], background: "beat", decor: true, sfx: "full", drift: false, align: "center" },
    craft: "Typography as the whole design: a huge display face (Oi) with Changa under it, words whipping in and out on the beat, sizes jumping between beats, a diagonal block behind them. Kinetic beats belong here; keep pictures out.",
  },
  {
    id: "desertdoc",
    ar: "وثائقي صحراوي",
    aliases: ["صحراء", "وثائقي", "رملي", "desert", "طبيعة"],
    icon: "🏜️",
    hint: "رمل وشمس وكثبان: عناوين هادئة على لقطات طبيعة مع ضوء دافئ",
    beats: ["title", "statement", "quote", "points", "outro"],
    look: { palette: "cream", theme: "isometric", head: "alyamama", body: "markazi-text", pace: "calm", entrance: "fade", transitions: ["softDissolve", "leakWarmT", "dipGold"], background: "steady", decor: false, sfx: "soft", drift: true, align: "right", scene: "dunes", mood: "calm" },
    craft: "A documentary: letterbox bars and a vignette, dunes behind the words, warm light leaks between beats, a slow drift, nothing punching. Titles in display Arabic, the body in Markazi. For a story about a place or a people.",
  },
  {
    id: "sportshype",
    ar: "رياضي حماسي",
    aliases: ["رياضة", "حماس", "بطولة", "sports", "ملعب"],
    icon: "🏟️",
    hint: "شرائط قُطرية وأرقام ضخمة وقطع سريع بفلاش: شكل مقدمات المباريات",
    beats: ["title", "stat", "compare", "statement", "outro"],
    look: { palette: "forest", theme: "scoreboard", head: "jomhuria", body: "changa", pace: "fast", entrance: "punch", transitions: ["zoomFlash", "whipLeft", "flashGold", "shakeT"], background: "beat", decor: true, sfx: "full", drift: true, align: "center", mood: "hype" },
    craft: "A match intro: thick diagonal bars in the corners, condensed display numbers (Jomhuria) punching in with a burst, flashes and shakes between beats, loud. Scores and comparisons are the point.",
  },
  {
    id: "mysterydark",
    ar: "غامض مشوق",
    aliases: ["تشويق", "غموض", "جريمة", "mystery", "مظلم"],
    icon: "🕵️",
    hint: "أسود وظلال وضوء واحد: كلمة كلمة ببطء مع تشويق، للقصص والجرائم",
    beats: ["title", "statement", "quote", "stat", "outro"],
    look: { palette: "mono", theme: "fluid", head: "el-messiri", body: "alexandria", pace: "calm", entrance: "blur", transitions: ["black", "zoomBlurT", "burn"], background: "steady", decor: false, sfx: "soft", drift: true, align: "center", mood: "aware" },
    craft: "Suspense: one glow in the dark that moves beat to beat, words arriving out of a BLUR, dips to black between them, a slow push-in. One short line a beat, long holds. For a story, a crime, a warning.",
  },
  {
    id: "risoprint",
    ar: "طباعة ريزو",
    aliases: ["ريزو", "سكرين برنت", "طباعة", "riso", "حبر مزاح"],
    icon: "🖨️",
    hint: "طباعة بحبرين مزاحين قليلًا وملمس خشن: شكل الملصقات المطبوعة",
    beats: ["title", "points", "quote", "statement", "outro"],
    look: { palette: "riso", theme: "ticket", head: "kufam", body: "tajawal", pace: "normal", entrance: "settle", transitions: ["checkerBig", "mosaicT", "staggerRows"], background: "beat", decor: true, sfx: "soft", drift: false, align: "right" },
    craft: "Riso printing: two inks slightly out of register over a rough texture, a numbered rail down the side, Kufi titles (Kufam) over Tajawal, words settling in place. Lists read beautifully here.",
  },
  {
    id: "gameui",
    ar: "واجهة لعبة",
    aliases: ["ألعاب", "جيمنق", "لاعب", "game", "واجهة لعب"],
    icon: "🎮",
    hint: "شبكة وأقواس زوايا وأرقام نقاط: شكل واجهات الألعاب والبث",
    beats: ["title", "stat", "points", "steps", "outro"],
    look: { palette: "neonpal", theme: "circuit", head: "kufam", body: "vazirmatn", pace: "fast", entrance: "flash", transitions: ["zoomSpin", "hexagon", "glitchT", "whipUp"], background: "beat", decor: true, sfx: "full", drift: false, align: "center", mood: "hype" },
    craft: "A game HUD: the fine grid, corner brackets and a row of dots, numbers flashing in like a score, hexagon and spin transitions, loud arrival sounds. Pixel display type. For gaming, a challenge, a leaderboard.",
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
  {
    id: "split",
    ar: "قص الشاشة نصين",
    aliases: ["نصين", "شق الشاشة", "سبليت", "split", "نص ونص", "شاشة مقسومة"],
    icon: "⬓",
    hint: "على فيديو تتكلم فيه: الشاشة تنقص نصين، أنت في نص والكلمة على لوحة مصممة في النص الثاني، فوق وتحت بالتناوب",
    beats: [],
    look: {},
    talk: "split",
    craft: "Motion on the person's talking video («talk», layout \"split\"): at each moment the screen is cut in two — the person's face in one half, a designed panel of the style with the word in the other — the halves taking turns (top, then bottom).",
  },
  {
    id: "corner",
    ar: "أنا صغير في الزاوية",
    aliases: ["في الزاوية", "دائرة صغيرة", "خليني صغير", "corner", "بابل", "صغير فوق"],
    icon: "◴",
    hint: "على فيديو تتكلم فيه: أنت في دائرة صغيرة في الزاوية، والكلام والرسومات تملأ الباقي على لوحة بالستايل",
    beats: [],
    look: {},
    talk: "corner",
    craft: "Motion on the person's talking video («talk», layout \"corner\"): the person becomes a small circle in a corner (on their face) and the style's panel fills the rest with the word and its graphic.",
  },
  {
    id: "mix",
    ar: "ريل متنوع",
    aliases: ["نوّع", "متنوع", "غيّر الإطار", "ريل متقدم", "mix", "كل مرة شكل"],
    icon: "🎛️",
    hint: "على فيديو تتكلم فيه: كل لحظة بإطار مختلف — نصين، مربع، زاوية، زووم على وجهك — ولوحات بألوان تتبدل ودخول مختلف كل مرة (أسلوب محرري الريلز)",
    beats: [],
    look: {},
    talk: "mix",
    craft: "Motion on the person's talking video («talk», layout \"mix\" — the default for an advanced talking reel): the frame changes at every moment, never the same twice in a row — the screen cut in two, the person in a box, in a corner circle, a punch-in on the face — on designed panels whose colour changes each time, every word entering a different way; one style («style») holds it all together.",
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


export interface MoodDef {
  id: MotionMood;
  /** the name the person writes */
  ar: string;
  aliases: string[];
  icon: string;
  hint: string;
  /** the tempo and entrance this feeling asks for (they win over a skill's, because the feeling is what the viewer feels) */
  pace: MotionPace;
  entrance: MotionEntrance;
  sfx: "full" | "soft" | "none";
  /** the scene drawn behind the words */
  scene: SceneId;
  /** the palette it starts from when the piece has no skill and no palette of its own */
  palette: string;
  /** how حيدرة writes for it (for Claude and محمد باقر) */
  craft: string;
}

export const MOODS: MoodDef[] = [
  { id: "joy", ar: "الفرح", aliases: ["فرح", "سعادة", "مبهج", "احتفال", "تهنئة", "joy", "happy"], icon: "🎉", hint: "ألوان دافئة وشرارات صاعدة، دخول مستقر لطيف وإيقاع خفيف", pace: "normal", entrance: "settle", sfx: "full", scene: "sparkles", palette: "riso", craft: "Joy: warm, bright words that rise; short upbeat lines, a celebratory number or wish, rounded friendly shapes; sparkles behind; never heavy words." },
  { id: "sad", ar: "الحزن", aliases: ["حزن", "حزين", "مأساوي", "عزاء", "فقد", "sad", "grief"], icon: "🌧️", hint: "مطر هادئ وألوان باردة، ظهور ناعم وبطيء وكلمات قليلة", pace: "calm", entrance: "fade", sfx: "soft", scene: "rain", palette: "night", craft: "Sadness: few words, long holds (≥ 5 s), soft fades, no punches or exclamation marks, cool dim colours, rain behind; the pain is stated plainly, then one line of consolation or meaning." },
  { id: "teach", ar: "التعليم", aliases: ["تعليم", "تعليمي", "شرح", "درس", "تدريب", "teach", "lesson"], icon: "🧠", hint: "سبورة طباشير وشبكة هادئة، خطوات تدخل من اليمين وفكرة واحدة في كل لقطة", pace: "normal", entrance: "right", sfx: "soft", scene: "chalk", palette: "night", craft: "Teaching: one idea a beat, a question first, then the rule, then an example; numbered steps enter from the right; a chalk-board scene; end with a one-line summary." },
  { id: "aware", ar: "التوعية", aliases: ["توعية", "توعوي", "تحذير", "انتباه", "حملة", "aware", "awareness"], icon: "📢", hint: "دوائر نبض تلفت الانتباه، رقم يضرب ثم السبب ثم المطلوب فعله", pace: "normal", entrance: "rise", sfx: "soft", scene: "rings", palette: "studio", craft: "Awareness: a striking number or question first, then the cause, then the ONE action asked of the viewer; pulse rings behind; serious but not scary; end with the action and the handle." },
  { id: "urgent", ar: "الاستعجال", aliases: ["استعجال", "عاجل", "تنبيه عاجل", "عرض محدود", "urgent", "hurry"], icon: "⏱️", hint: "خطوط مائلة وإيقاع سريع، قطع حاد ودخول سحب سريع", pace: "fast", entrance: "whip", sfx: "full", scene: "stripes", palette: "studio", craft: "Urgency: 2 s beats, imperative verbs, a deadline or count, diagonal stripes behind, whips and punches; the call to action is held ≥ 3 s." },
  { id: "calm", ar: "السكينة", aliases: ["سكينة", "هدوء", "هادئ", "استرخاء", "تأمل", "calm", "relax"], icon: "🌿", hint: "سحب وموجات ناعمة، ظهور من الضباب وإيقاع بطيء جدًا", pace: "calm", entrance: "blur", sfx: "none", scene: "clouds", palette: "night", craft: "Calm: breathing room — one short line per beat held 5–6 s, soft clouds, blur-in, no sounds, long gentle transitions." },
  { id: "proud", ar: "الفخر", aliases: ["فخر", "اعتزاز", "وطني", "إنجاز", "اليوم الوطني", "proud", "pride"], icon: "🏆", hint: "أفق مدينة ذهبي وأشعة، ظهور واثق ثابت وكلمات كبيرة", pace: "normal", entrance: "punch", sfx: "soft", scene: "skyline", palette: "majlis", craft: "Pride: confident, large words, an achievement number, a skyline behind with gold light; steady, never rushed; the closing line gives credit." },
  { id: "hype", ar: "الحماس", aliases: ["حماس", "حماسي", "متحمس", "إثارة", "هايب", "hype", "energy"], icon: "🔥", hint: "أشعة منطلقة وسرعة عالية، ضربات ودخول سحب وكلمات مظللة", pace: "fast", entrance: "punch", sfx: "full", scene: "rays", palette: "studio", craft: "Hype: 2 s beats, the key word in the highlight pill, big numbers that hit, rays behind, hard cuts or flashes; it ends on the biggest moment." },
  { id: "faith", ar: "الخشوع", aliases: ["خشوع", "إيمان", "روحانية", "دعاء", "عبادة", "faith", "devotion"], icon: "🕌", hint: "أفق مسجد ونجوم وهلال، ظهور ناعم وخط أميري هادئ", pace: "calm", entrance: "blur", sfx: "none", scene: "mosque", palette: "majlis", craft: "Devotion: reverent and slow; a verse or narration exactly as given, with its source; a mosque skyline and stars behind; no punches, no music unless asked." },
];

export const moodOf = (id: unknown): MoodDef | undefined => (typeof id === "string" && id ? MOODS.find((m) => m.id === id || m.ar === id) : undefined);

/** The mood named in the person's words (the Arabic name first, then an alias), or none. */
export function moodInText(text: string): MoodDef | undefined {
  const t = ` ${norm(text)} `;
  const word = (a: string) => norm(a).length >= 3 && (t.includes(` ${norm(a)} `) || t.includes(` ب${norm(a)} `) || t.includes(` ال${norm(a)} `) || t.includes(` بال${norm(a)} `));
  return MOODS.find((m) => word(m.ar.replace(/^ال/, ""))) ?? MOODS.find((m) => m.aliases.some(word));
}

const PACES: MotionPace[] = ["fast", "normal", "calm"];
export const THEMES: MotionTheme[] = ["glow", "paper", "bold", "flat", "chart", "rail", "split", "frame", "arabesque", "confetti", "badge", "none", "grid", "film"];
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
  if (THEMES.includes(o.theme as MotionTheme)) out.theme = o.theme as MotionTheme;
  if (o.align === "center" || o.align === "right") out.align = o.align;
  if (moodOf(o.mood)) out.mood = moodOf(o.mood)!.id;
  if (SCENE_IDS.includes(o.scene as SceneId)) out.scene = o.scene as SceneId;
  return out;
}

/** The look of a piece: the defaults, then the named skill's, then what the person asked for (always last: it wins). */
export function lookOf(style: string | undefined, own: Partial<MotionLook> | undefined): MotionLook & { style?: MotionStyle } {
  const s = motionStyleOf(style);
  const m = moodOf(own?.mood);
  // the feeling sets the tempo, entrances and sounds (over the skill's: the viewer feels the mood), and the palette when no skill gives one
  return { ...DEFAULT_LOOK, ...(m ? { palette: m.palette } : {}), ...(s?.look ?? {}), ...(m ? { pace: m.pace, entrance: m.entrance, sfx: m.sfx } : {}), ...(own ?? {}), ...(s ? { style: s } : {}) };
}

/** The person asked for a generated picture in so many words (otherwise a motion piece draws everything itself). */
export const askedForPicture = (message: string) => /(?:ارسم|ولّد|ولد|اصنع|سوّ|سو|ابي|أبي|أبغى|ابغى|اعمل)\s+(?:لي\s+)?(?:صور[ةه]|رسم[ةه]?|illustration|image)|جي\s*بي\s*تي|gpt\s*image|بصور[ةه] (?:من|مولد)|generate (?:an? )?(?:image|picture)/i.test(message);

/** What حيدرة knows about the feelings (in his system prompt). */
export const MOODS_SKILL = `MOODS («المشاعر») — the feeling the piece carries; the engine changes tempo, entrances, sounds and draws a scene behind the words for it. When the person says the feeling (or it is plain from the topic), set "mood" in the storyboard (and a beat can carry its own "mood" when the piece changes feeling: a sad beat, then a hopeful one). The person's own words about pace or colour still win.
${MOODS.map((m) => `- «${m.ar}» (mood "${m.id}"; also: ${m.aliases.slice(0, 3).join("، ")}) — ${m.craft} Scene: ${m.scene}.`).join("\n")}`;

/** What حيدرة knows about the named skills (in his system prompt). */
export const MOTION_STYLES_SKILL = `NAMED MOTION SKILLS («مهارات الموشن») — each one a look the engine knows. When the person writes one of these names (or asks for "a motion in the style of …"), build the storyboard in it: set "style":"<id>" and follow its craft. THE PERSON'S OWN WISHES COME FIRST: anything they ask beyond the name (another colour or palette, slower, other fonts, no sounds, no decorations, a different transition, other beats) goes in the storyboard and wins over the skill — "palette"/"colors"/"head"/"body" for colours and fonts, and "look" for the rest: {"pace":"fast"|"normal"|"calm","entrance":"mixed"|"whip"|"rise"|"right"|"fade"|"settle"|"punch"|"blur"|"glitch"|"flash"|"wipe","transitions":["<transition id>",…] ([] = hard cuts),"background":"beat"|"steady","decor":true|false,"sfx":"full"|"soft"|"none","drift":true|false,"align":"center"|"right","theme":<one of the art languages: glow, paper, bold, flat, chart, rail, split, frame, arabesque, confetti, badge, none, grid, film>}. Only write "palette"/"look" fields the person asked for (the skill sets the rest). Say in your reply which skill you used and that they can change anything in it.
${MOTION_STYLES.map((s) => (s.talk ? `- «${s.ar}» (also: ${s.aliases.slice(0, 3).join("، ")}) — ${s.craft} Not a storyboard: write "talk" with "layout":"${s.talk}" (or the talk_motion request first when the clip has no "speech").` : `- «${s.ar}» (style "${s.id}"; also: ${s.aliases.slice(0, 3).join("، ")}) — ${s.craft} Beats: ${s.beats.join(", ")}.`)).join("\n")}`;
