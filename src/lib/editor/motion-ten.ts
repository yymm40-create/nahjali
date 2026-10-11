// «أساليب الموشن العشرة» — the ONLY motion styles the person picks from (the owner's choice: ten, each completely
// different, instead of forty chips that repeat each other). Four are the reverse-engineered recipes of the "Motion
// Video Director" skill (a premium talking-head caption reel, a cinematic storyteller documentary, a SaaS product
// launch, a beat-synced brand promo); six cover what those don't (teaching, numbers, devotion, quiet luxury, playful,
// neon hype). Each one rides on a look the engine already draws (`base`, a MOTION_STYLES id) and adds its direction:
// intensity, structure, type, colour, motion and sound — so the older looks keep working for old projects.
// Pure: shared by the page (the picker) and حيدرة (his system prompt).

export interface MotionTen {
  id: string;
  n: number;
  ar: string;
  icon: string;
  /** one line under the name in the picker */
  one: string;
  /** what it is for, shown when the card is opened */
  when: string;
  /** editing intensity 1 (restrained) … 5 (hyper) — the director's scale */
  energy: 1 | 2 | 3 | 4 | 5;
  /** made ON the person's talking video (not a full-screen piece) */
  talk: boolean;
  /** the engine look it is built on (a MOTION_STYLES id) */
  base: string;
  aliases: string[];
  /** how حيدرة builds it */
  craft: string;
}

export const MOTION_TEN: MotionTen[] = [
  {
    id: "premium-talk",
    n: 1,
    ar: "ريل الكلام الفاخر",
    icon: "🎙️",
    one: "أنت تتكلم بملء الشاشة، والكلمات المهمة تطلع حولك بتدرّج وتوهج وكروت تنبثق",
    when: "ريل تتكلم فيه للكاميرا: عقار، خدمة، نصيحة، براند شخصي",
    energy: 4,
    talk: true,
    base: "float3d",
    aliases: ["كلام فاخر", "ريل فاخر", "كابشن فاخر", "talking head"],
    craft: `PREMIUM TALKING-HEAD CAPTION REEL (9:16, intensity 3–4) — on the person's own talking video, full screen ("talk" with "layout":"over3d"). Captions 1–3 words at a time at chest/face height AROUND the person, changing position per group, never over the eyes or mouth. Two-weight type: filler words thin (weight 400, white ~80 %, soft shadow); the keyword heavy (900) and 2–3× bigger with a "grad" fill + light "depth" (0.2–0.35), each keyword its own accent family (steel-teal, lilac, green, neon yellow with an orange "glow"); one keyword may sit BEHIND the head (the person's smart mask on a track above the words). Words blur in ~200 ms and leave letter by letter; a number rolls up with "count" while 4–6 rounded photo cards (thin white border, soft shadow) pop around them in an arc (60–80 ms stagger); a post or screen as proof tilted slightly; pill buttons (dark fill, glowing border) grow on the spoken word. Sound: a quiet music bed under the voice, a low hit on the first keyword, tick/shimmer under the counter, an airy whoosh into the next idea, soft pops per card; nothing on filler words.`,
  },
  {
    id: "story-doc",
    n: 2,
    ar: "القصة السينمائية",
    icon: "🎞️",
    one: "كل جملة عالم جديد: أشرطة سينما، ورق محبب، كلمات ثلاثية الأبعاد، قلتش وسحبات",
    when: "قصة نجاح، رحلة، بداية شخص أو مشروع، فيديو وثائقي قصير",
    energy: 5,
    talk: false,
    base: "cinematic",
    aliases: ["قصة سينمائية", "وثائقي قصصي", "ستوري تيلنج", "storytelling", "documentary"],
    craft: `CINEMATIC STORYTELLER DOCUMENTARY (16:9 letterboxed or 9:16, intensity 5) — 1–2 s per visual idea, EVERY SENTENCE A NEW WORLD, one-frame black cuts as punctuation, "letterbox" bars on the cinematic moments. A sequence of looks, not one: a warm dim talking/opening shot with a bold white caption and a yellow keyword → a cream halftone-paper beat with film grain and a red distressed word inside a selection box (drawing tools: dashed bounds, square handles) → a black word building word by word → a torn-paper window onto footage → chunky 3D white words ("depth" 0.5–0.7) standing in the shot → a yellow hand-marker word per spoken word on a collage → a black void with a spotlit frame and a slow push-in → a purple grunge beat with a red keyword → an "rgbSplit"/"glitchHeavy" slice → a light-streak/hyperspace beat with a chrome-like gradient word → a B&W old-film beat ("oldFilm") with tiny yellow subtitles → a whip back to the speaker with stacked left-aligned captions and the keyword in heavy yellow with a glow. Sound: music + voice; paper rustles on the paper beats; a whoosh on each world change landing on its first frame; a glitch burst on the slice; a riser into the big word; a projector crackle under the B&W beat.`,
  },
  {
    id: "saas-launch",
    n: 3,
    ar: "إطلاق منتج تقني",
    icon: "🚀",
    one: "هدوء فاخر: سطر يفك شفرته، أيقونات تتجمع، كروت واجهة ثلاثية تنفتح، شعار يتجمّع",
    when: "تطبيق، موقع، منصة، خدمة رقمية، ميزة جديدة",
    energy: 2,
    talk: false,
    base: "appstore",
    aliases: ["إطلاق منتج", "اطلاق منتج", "ساس", "saas", "product launch", "اطلاق تطبيق"],
    craft: `SAAS PRODUCT LAUNCH (16:9 or 9:16, intensity 2–3, clarity-first but premium) — open on a calm, slightly desaturated textured background with grain and a soft vignette; one thin mono line DECODES ("decode") into the promise ("حياتك… بس مرتبة"); glowing brand-colour orbs drift in and condense into app icons lined up in a glass dock (rounded pill, soft shadow). A vertical camera move with motion blur as the transition; a slow push-in on the dock; a cursor hovers and clicks; real product screens fly out as slightly tilted 3D cards ("flip" in, a soft blue shadow). One 3D hero moment: a device turning in while concentric brand-colour circles burst behind (120 ms stagger), then flattening into line art and pushing THROUGH to white. Type: a wide geometric sans; a small line types on letter by letter → a giant cropped keyword bleeding off the frame over a blurred brand-gradient blob → shrinks into a phrase → a word swap in the same slot ("صفر تنظيم" → "صفر تأخير"); the logo enters big, settles small, its letters wide then collapsing into the lockup. Sound: soft music with low pulses; an air whoosh on the camera move; descending tonal sweeps on zooms; glassy clicks on hovers; ONE clean impact with a long tail on the logo, then near-silence.`,
  },
  {
    id: "brand-kinetic",
    n: 4,
    ar: "إعلان العلامة الحركي",
    icon: "🟧",
    one: "أبيض وأسود بالتناوب ولون واحد برتقالي، قطع على كل نبضة، كروت تلتف وتنفجر لشبكة",
    when: "إعلان علامة تجارية، وكالة، منتج بهوية قوية، بدون صوت معلّق",
    energy: 4,
    talk: false,
    base: "typeposter",
    aliases: ["اعلان حركي", "إعلان العلامة", "براند بروموشن", "brand promo", "kinetic promo"],
    craft: `BEAT-SYNCED BRAND PROMO (16:9 or 9:16, intensity 4) — MUSIC ONLY, no voice. Palette: off-white #FAF8FA and black #0A0A0A alternating cut to cut, ONE accent orange #FF6A1A ("colors" in the storyboard); one geometric display sans, contrast by scale only. A huge word with an orange motion echo trailing it (3–6 offset copies in the accent fading out) → cut to black: the same word tiny, an orange glow wave rising from the bottom → a word smearing in sideways → a short phrase building → the problem word in white over a dark grid of dimmed work. A "card snake": 20–30 copies of a card trailing along an arc behind the word (each a step later and slightly smaller). The logo as an outline drawing itself, then the wordmark. A rotated card stack shuffling on every beat, then exploding into a 4×2 grid with 3D flips and labels; a zoom into one label that becomes a search chip; typing with a cursor; a click → the background inverts to black, the button turns into an orange gradient circle with an arrow → zoom out to the closing card. Rhythm: a cut or shuffle on EVERY beat (≈ 0.31 s at 96 BPM eighths) after a riser into a bass drop on the logo; sparse whoosh-pops on the opening words; a UI click and soft pop on the button; typing ticks.`,
  },
  {
    id: "teach",
    n: 5,
    ar: "الشرح التعليمي",
    icon: "🧠",
    one: "فكرة وحدة بكل لقطة: سؤال، ثم القاعدة، ثم مثال، بأسهم وخطوات مرقّمة وسبورة",
    when: "درس، شرح فكرة، طريقة استخدام، معلومة علمية",
    energy: 3,
    talk: false,
    base: "explainer",
    aliases: ["شرح تعليمي", "تعليمي", "درس", "explainer", "tutorial"],
    craft: `TEACHING EXPLAINER (intensity 3) — Kurzgesagt/School-of-Motion clarity: a hook QUESTION → the problem → the mechanism in 3–6 one-idea beats (numbered steps entering from the right, an arrow or a diagram drawn with the drawing tools, ONE highlighted term per beat) → a worked example → a one-line summary → the CTA. 4–5 s a beat, calm music, soft sounds only on arrivals and step changes; a chalk-board or night-grid scene; counters ("count") for any number; never an effect that covers the content.`,
  },
  {
    id: "numbers",
    n: 6,
    ar: "الأرقام والإنفوجرافيك",
    icon: "📊",
    one: "الأرقام هي البطل: عدّاد يصعد، أعمدة ودوائر ترسم نفسها، مقارنة قبل وبعد",
    when: "إحصائيات، نتائج، تقرير، إنجازات، مقارنة",
    energy: 3,
    talk: false,
    base: "datadash",
    aliases: ["انفوجرافيك", "إنفوجرافيك", "الأرقام", "إحصائيات", "infographic", "data"],
    craft: `NUMBERS & INFOGRAPHIC (intensity 3) — each number its own beat: the figure big in the accent rolling up with "count" (900–1500 ms, a tick run under it, a soft hit when it lands), the label short under it; bars, rings and lines drawn ON with the drawing tools; a before/after comparison beat; the source of every number said or shown. Numbers ONLY from the person's words. A dashboard/grid background, one accent colour for every highlight, Western digits.`,
  },
  {
    id: "devotion",
    n: 7,
    ar: "الروحاني الهادئ",
    icon: "🕌",
    one: "خشوع وسكينة: زخرفة إسلامية، خط أميري، ظهور ناعم بطيء، بدون ضربات ولا موسيقى",
    when: "آية، رواية، دعاء، مناسبة دينية، ذكرى أهل البيت عليهم السلام",
    energy: 1,
    talk: false,
    base: "arabesque",
    aliases: ["روحاني", "خشوع", "ديني", "دعاء", "spiritual"],
    craft: `QUIET DEVOTION (intensity 1) — reverent and slow: a verse, narration or supplication EXACTLY as given with its source, one short line per beat held 5–6 s, "blur"/"fade" entrances, an arabesque or mosque-and-stars scene, gold on deep night colours, a naskh or amiri-like font; no punches, no glitch, no flashes, NO music unless asked (a soft ambience at most); "عليه السلام" and the salawat written in full.`,
  },
  {
    id: "quiet-luxury",
    n: 8,
    ar: "الفخامة الهادئة",
    icon: "✨",
    one: "ذهب على أسود ومساحات واسعة: دخول بطيء واثق، إطار رفيع، سطر وحيد بكل لقطة",
    when: "عطور، مجوهرات، فنادق، عقار فاخر، شركات ومؤسسات",
    energy: 1,
    talk: false,
    base: "luxurygold",
    aliases: ["فخامة", "فخم", "لاكشري", "luxury", "رزين", "شركات"],
    craft: `QUIET LUXURY / CORPORATE (intensity 1–2) — generous negative space, one short line a beat, slow push-ins (motion points, 0.5–2 % a second), fades and a fine double frame, a serif or elegant display headline with small sans labels, gold or one muted accent on black or ivory, lower-third style labels; one clean impact with a long tail on the logo and silence around it; no glitch, neon or hard flashes.`,
  },
  {
    id: "sticker-fun",
    n: 9,
    ar: "المرح والستيكرز",
    icon: "🎨",
    one: "ألوان مرحة: ستيكرات تنلصق وتنقشر، كلمات تنط، إيموجي وأسهم مرسومة باليد",
    when: "أطفال، مطاعم ومقاهي، عروض خفيفة، محتوى ترفيهي",
    energy: 4,
    talk: false,
    base: "stickerpop",
    aliases: ["ستيكرات", "مرح", "ممتع", "playful", "fun"],
    craft: `PLAYFUL STICKERS (intensity 4) — bright riso-like colours, words that "pop" (the one style where a bounce is welcome), stickers and badges with a white border that slap on with a paper-rip sound, hand-drawn arrows and circles (drawing tools), a marker-style accent font, emoji-like icons drawn by the engine, confetti on the big moment; 2–3 s beats, cheerful sounds on every arrival but varied.`,
  },
  {
    id: "neon-hype",
    n: 10,
    ar: "الهايب والنيون",
    icon: "⚡",
    one: "طاقة قصوى: نيون يتوهج، قلتش وانقسام ألوان، سحبات وضربات على كل نبضة",
    when: "رياضة، ألعاب، فعاليات، إطلاق حماسي، هوك قوي",
    energy: 5,
    talk: false,
    base: "neonnight",
    aliases: ["هايب", "نيون", "حماسي", "hype", "neon"],
    craft: `NEON HYPE (intensity 5) — dark night background, neon words with a strong "glow" and light "depth", "glitchLight"/"rgbSplit"/"scanlines" on hits, whips and punch-ins, a flash on the biggest word, light streaks behind; 1–2 s beats cut on the beat, a hit or whoosh on almost every beat with varied sounds, a riser → drop on the peak; it ends on the biggest moment and the handle.`,
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

export const tenOf = (id: unknown) => (typeof id === "string" ? MOTION_TEN.find((t) => t.id === id || norm(t.ar) === norm(id)) : undefined);

/** The style named in the person's words (its full name first, then an alias). */
export function tenInText(text: string): MotionTen | undefined {
  const t = ` ${norm(text)} `;
  return MOTION_TEN.find((s) => t.includes(` ${norm(s.ar)} `)) ?? MOTION_TEN.find((s) => s.aliases.some((a) => norm(a).length >= 3 && t.includes(` ${norm(a)} `)));
}

/** What the picker writes for the person (they add the topic, or it is sent as is for a talking video). */
export const askForTen = (s: MotionTen, topic: string) =>
  s.talk ? `ركّب على فيديو كلامي بأسلوب «${s.ar}»${topic.trim() ? ` — ${topic.trim()}` : ""}` : `موشن جرافيكس بأسلوب «${s.ar}» عن: ${topic.trim()}`;

/** حيدرة's list of the ten (in his system prompt). */
export const MOTION_TEN_SKILL = `THE TEN MOTION STYLES («أساليب الموشن») — the only styles the person picks from, each completely different. When the person names one (or picks it in the picker), build in it: set "style" in the storyboard to its BASE look (in brackets) and follow its direction below; for the talking-video one, use "talk" with its layout. The person's own wishes beyond the name (colours, pace, fonts, no sounds…) always win. If they ask for "a motion" with NO style named, do not reach for one of these and do not offer them: compose the piece from the owner's motion skill — its own background per beat and its own arrivals — as that skill orders. Older style names they may still write (from the engine's looks) keep working.
${MOTION_TEN.map((s) => `${s.n}. «${s.ar}» [base "${s.base}"${s.talk ? ", on the talking video" : ""}, intensity ${s.energy}] — for: ${s.when}. ${s.craft}`).join("\n")}`;
