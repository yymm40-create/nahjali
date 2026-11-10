/**
 * «طرق إبداعية» (/jawad-ai/creative): full workflows behind the platform's own films, step by step, with the references
 * and the exact prompts that made them (explained in Arabic, prompts in English and copyable). One entry per method;
 * its media live in public/jawad-ai/creative/<slug>/.
 */

export const CREATIVE_BASE = "/jawad-ai/creative";

export type CreativePrompt = {
  /** what it makes, in Arabic */
  label: string;
  /** the generator */
  tool: string;
  /** settings in short Arabic, e.g. «٨ ث · 1080p · 9:16» */
  settings?: string;
  /** the references attached, each with its @tag */
  refs?: { tag: string; name: string; src?: string }[];
  note?: string;
  text: string;
  /** «جرّبه في الاستوديو»: the generator and settings it was made with (inferred from `tool`/`settings` when absent; null = no button) */
  use?: PromptUse | null;
};

/** What the Creative Studio is opened with from a method: the same generator, settings and style; the person adds their own references. */
export type PromptUse = {
  generatorId: string;
  settings?: Record<string, string | number | boolean>;
  /** a style from the studio's style map (config/film-styles) */
  styleId?: string;
  refStyle?: "references" | "frames" | "none";
};

const DIGITS = (t: string) => t.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** The studio set-up of a prompt: its own `use`, else read from the generator name and the settings line. */
export function promptUse(p: CreativePrompt): PromptUse | null {
  if (p.use !== undefined) return p.use;
  const tool = p.tool;
  const set = DIGITS(p.settings ?? "");
  const ratio = set.match(/\b(16:9|9:16|1:1|4:3|3:4|3:2|2:3)\b/)?.[1];
  const hasRefs = Boolean(p.refs?.some((r) => r.tag.startsWith("@")));
  if (/GPT Image 2(?!\.\d)/.test(tool)) {
    const q = /متوسطة/.test(tool + set) ? "medium" : /عالية/.test(tool + set) ? "high" : undefined;
    return { generatorId: "openai-gpt-image-2", settings: { ...(ratio ? { aspect: ratio } : {}), ...(q ? { quality: q } : {}) } };
  }
  const video = /Wan 3\.0/.test(tool) ? "wan-3-0" : /Seedance 2\.0/.test(tool) ? "byteplus-seedance-2-0" : null;
  if (!video) return null;
  const sec = set.match(/(\d+)\s*ث/)?.[1];
  const res = set.match(/\b(480p|720p|1080p)\b/)?.[1];
  return {
    generatorId: video,
    settings: { ...(ratio ? { ratio } : {}), ...(res ? { resolution: res } : {}), ...(sec ? { duration: Number(sec) } : {}) },
    ...(hasRefs ? { refStyle: "references" as const } : {}),
  };
}

export type CreativeStep = {
  title: string;
  body: string[];
  images?: { src: string; alt: string; wide?: boolean }[];
  table?: { head: string[]; rows: string[][] };
  prompts?: CreativePrompt[];
  tip?: string;
};

export type CreativeMethod = {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  cover: string;
  /** wide: a 16:9 film (the page lays it out under the text instead of beside it) */
  film: { src: string; poster: string; wide?: boolean };
  facts: { k: string; v: string }[];
  steps: CreativeStep[];
  fixes: { problem: string; fix: string }[];
  faq: { q: string; a: string }[];
};

const M = `${CREATIVE_BASE}/golden-badge`;
const img = (f: string) => `${M}/${f}`;

const OUTFIT = "black two-piece suit, white shirt, slim black tie, black leather shoes, short curly black hair and a goatee";
const LIKENESS = `Use the attached photo as the ONLY identity reference. Recreate this exact man — same face shape, eyes, nose, eyebrows, beard, hairline and skin tone — in this style. Likeness comes first. Full body, standing, relaxed confident pose, front view, same outfit as the reference: ${OUTFIT}, plain light background, no text.`;

const STYLE = {
  pixar:
    "Modern stylized 3D football animation, built on the stylistic-drift look. Deliberate anime-influenced distortion of the players: exaggerated squash and stretch, big expressive eyes, spiky sculpted hair, extreme reactions in the faces. Flatter shading ramps with crisp graphic shadow shapes, punchy saturated colour, graphic simplification of secondary detail, cinematic lighting from warm sun or blazing stadium floodlights, dramatic low and close camera angles, impact frames on the kick with radial speed lines and flat colour bursts behind the hero, glowing energy trails and",
  kids: "Preschool 3D animation. Very simple rounded toy-like forms, big round glossy eyes, smooth plastic-clean materials, bright primary colours with soft pastel backgrounds, soft shadowless even lighting, uncluttered sets with few large props, gentle friendly expressions.",
  comic: "Graphic comic-print animation style. Halftone dot shading in shadow zones, chromatic aberration split on high-contrast edges, hand-drawn line work and speed-line accents, print-registration misalignment, flat bold color blocking, comic ink texture",
  anime:
    "2.5D anime football art, built on the anime fighting-game look. 3D characters that read as hand-drawn Japanese anime: inked outlines of varying weight, hard two-tone cel shadows, spiky windswept hair in sharp strands, big expressive anime eyes and exaggerated reactions — shock, sweat drops, gritted teeth. Bright saturated colour under warm sunlight or blazing stadium floodlights, dramatic low and close camera angles, impact frames on the kick with radial speed lines and bold flat colour bursts behind the hero, glowing energy trails and sparks around the ball, detailed painted backgrounds of the pitch, stands and city.",
  golden: "Classic hand-drawn 2D animation style. Ink-and-paint cel characters with soft pencil line weight, flat gouache color fills, lush watercolor painted backgrounds with visible paper grain, warm vintage film tone, gentle vignetting.",
};

const REAL_LOOK =
  "Photorealistic cinematic live-action. ARRI Alexa 65 with anamorphic lenses, natural skin texture and real-world physics, golden-hour sunlight with soft horizontal anamorphic flares, shallow depth of field, subtle 35mm film grain, rich natural grade with warm highlights and deep teal shadows.";

const refsWan = (char: string) => [
  { tag: "@img1", name: "شخصيتك بنفس الستايل", src: img(char) },
  { tag: "@img2", name: "الشارة", src: img("badge.webp") },
];

const GOLDEN_BADGE: CreativeMethod = {
  slug: "golden-badge",
  title: "فيلم واحد بخمس ستايلات كرتونية",
  kicker: "الشارة الذهبية",
  summary:
    "قصة وحدة مستمرة: تبدأ واقعية، تطيح في خمس ستايلات كرتونية، وترجع للواقع. البطل أنت، بصورة وحدة من وجهك. هنا الطريقة كاملة بالترتيب: المراجع، والحوار، وكل برومبت كتبناه حرفيًا، والمونتاج.",
  cover: img("film-poster.webp"),
  film: { src: img("film.mp4"), poster: img("film-poster.webp") },
  facts: [
    { k: "المشاهد", v: "٧ توليدات: ٢ واقعية + ٥ كرتون" },
    { k: "الصور", v: "GPT Image 2 (جودة متوسطة)" },
    { k: "الواقعي", v: "Seedance 2.0 · 1080p" },
    { k: "الكرتون", v: "Wan 3.0 · 1080p" },
    { k: "الحوار", v: "٧ جمل فصحى بصوتك" },
    { k: "المونتاج", v: "حيدرة كت" },
  ],
  steps: [
    {
      title: "اكتب القصة قبل أي توليد",
      body: [
        "الفكرة: بطل يطارد شارة ذهبية مكتوب عليها «٥ ستايلات كرتونية». كل ما ينتقل من مكان لمكان يتغيّر الستايل، والشارة هي الخيط اللي يربط المشاهد.",
        "ثلاث قواعد تخلي الفيلم يبان قطعة وحدة: الحركة دايم من يمين الشاشة ليسارها، والشارة نفس المرجع في كل توليد، وكل مشهد فيه جملة حوار وحدة بس.",
      ],
      table: {
        head: ["المشهد", "الستايل", "المولّد", "الجملة"],
        rows: [
          ["١ الطيارة والنطّة", "واقعي سينمائي", "Seedance 2.0", "ها هي الشارة… لن تفلتَ مني هذه المرة!"],
          ["٢ الماء والسمك", "بيكسار حديث", "Wan 3.0", "ماءٌ؟! لا بأس… سألحقُ بكِ!"],
          ["٣ السباحة والقفزة", "ثري دي الصغار", "Wan 3.0", "أسرعُ من السمكِ… انتظري!"],
          ["٤ الملعب", "الكوميكس المطبوع", "Wan 3.0", "ملعبٌ كامل… وهدفٌ واحد!"],
          ["٥ القتال", "أنمي قتال ٢٫٥دي", "Wan 3.0", "مَن أنت؟! اتركِ الشارةَ… فهي لي!"],
          ["٦ المسكة والضوء", "ثنائي الأبعاد · العصر الذهبي", "Wan 3.0", "أخيرًا… أمسكتُ بكِ!"],
          ["٧ الرجوع للطيارة", "واقعي سينمائي", "Seedance 2.0", "خمسُ قصصٍ… من صورةٍ واحدة، في منصّة الجواد!"],
        ],
      },
    },
    {
      title: "المرجع الواقعي: صورتك وشيت الشخصية",
      body: [
        "ابدأ بصورة واضحة لوجهك ولبسك. منها نسوي شيت واقعي (من قدام، ومن الجنب، ومن ورا، ووجه قريب). هذا الشيت هو @img1 في المشهدين الواقعيين.",
        "في الواقعي لبسنا نظارة طيار غامقة، ونفس البدلة السوداء في كل الفيلم.",
      ],
      images: [{ src: img("sheet-real.webp"), alt: "الشيت الواقعي للشخصية", wide: true }],
      prompts: [
        {
          label: "الشيت الواقعي",
          tool: "GPT Image 2 · جودة متوسطة",
          settings: "16:9",
          refs: [{ tag: "صورة", name: "صورتك الواقعية" }],
          text: `STYLE: ${REAL_LOOK}\nCharacter sheet built ONLY from the attached image, same face and outfit, with dark aviator sunglasses: front view, three-quarter view, side view, back view, plus a close-up of the face. Plain light grey background, evenly spaced, no text, no labels.`,
        },
      ],
    },
    {
      title: "الشارة الذهبية",
      body: ["صورة وحدة للشارة، وبعدها شيل الخلفية. هي @img2 في كل توليد بعدها، عشان تطلع بنفس الشكل والكلام في كل الستايلات."],
      images: [{ src: img("badge.webp"), alt: "الشارة الذهبية: ٥ ستايلات كرتونية" }],
      prompts: [
        {
          label: "الشارة",
          tool: "GPT Image 2 · جودة متوسطة",
          settings: "1:1",
          refs: [{ tag: "صورة", name: "شعارك (اختياري)" }],
          text: "A single golden emblem badge, round medal with a glowing polished gold rim and a shining gold orb in the center like the attached JAWAD logo, a dark navy ribbon across the middle with the Arabic text «٥ ستايلات كرتونية» written clearly in a bold modern Arabic font, every letter correct, no other text anywhere. Premium 3D metal, soft cinematic studio light, centered, isolated on a plain flat light-grey background.",
        },
      ],
    },
    {
      title: "شخصيتك في كل ستايل",
      body: [
        "خمس صور، وحدة لكل ستايل. ترفق صورتك الواقعية بس، والبرومبت يبدأ بسطر الستايل نفسه اللي بيتكرر بعدين في الفيديو، حرف بحرف.",
        "الشبه أول شي: إذا الوجه ما يشبهك، ولّد مرة ثانية قبل ما تكمل.",
      ],
      images: [
        { src: img("char-pixar.webp"), alt: "بيكسار حديث" },
        { src: img("char-kids.webp"), alt: "ثري دي الصغار" },
        { src: img("char-comic.webp"), alt: "الكوميكس المطبوع" },
        { src: img("char-anime.webp"), alt: "أنمي قتال ٢٫٥دي" },
        { src: img("char-golden.webp"), alt: "ثنائي الأبعاد · العصر الذهبي" },
      ],
      prompts: [
        { label: "بيكسار حديث", tool: "GPT Image 2 · جودة متوسطة", refs: [{ tag: "صورة", name: "صورتك الواقعية" }], text: `STYLE: ${STYLE.pixar}\n${LIKENESS}` },
        { label: "ثري دي الصغار", tool: "GPT Image 2 · جودة متوسطة", refs: [{ tag: "صورة", name: "صورتك الواقعية" }], text: `STYLE: ${STYLE.kids}\n${LIKENESS}` },
        { label: "الكوميكس المطبوع", tool: "GPT Image 2 · جودة متوسطة", refs: [{ tag: "صورة", name: "صورتك الواقعية" }], text: `STYLE: ${STYLE.comic}\n${LIKENESS}` },
        { label: "أنمي قتال ٢٫٥دي", tool: "GPT Image 2 · جودة متوسطة", refs: [{ tag: "صورة", name: "صورتك الواقعية" }], text: `STYLE: ${STYLE.anime}\n${LIKENESS}` },
        { label: "ثنائي الأبعاد · العصر الذهبي", tool: "GPT Image 2 · جودة متوسطة", refs: [{ tag: "صورة", name: "صورتك الواقعية" }], text: `STYLE: ${STYLE.golden}\n${LIKENESS}` },
      ],
    },
    {
      title: "سجّل الحوار بصوتك",
      body: [
        "سجّل الجمل السبع بالفصحى في تسجيل واحد، وبعدها قصّها سبع ملفات مرقّمة. طول كل مشهد على قد جملته: عدد الكلمات ÷ ٢ + ١ ثانية تقريبًا.",
        "المشهدين الواقعيين ياخذون ملف الصوت مرجع (@aud1). مشاهد الكرتون تكتب الجملة العربية داخل البرومبت، وWan ينطقها بوضوح.",
      ],
      tip: "Seedance يطلّع الكلام العربي مكسّر حتى لو رفعت صوتك، فنبدّل صوت المشهدين الواقعيين بتسجيلك الأصلي في المونتاج.",
    },
    {
      title: "المشهد الأول: الواقعي",
      body: ["الطيارة فوق الغيوم، الشارة قدامها، يتكلم، الشارة تطيح، يفتح الباب وينط وراها. ١٤ ثانية في توليدة وحدة، والبرومبت مقسّم على الثواني."],
      images: [
        { src: img("scene-sky.webp"), alt: "البداية فوق الغيوم" },
        { src: img("ref-cockpit.webp"), alt: "داخل الكابينة" },
      ],
      prompts: [
        {
          label: "الطيارة والنطّة",
          tool: "Seedance 2.0",
          settings: "١٤ ث · 1080p · 9:16",
          refs: [
            { tag: "@img1", name: "الشيت الواقعي", src: img("sheet-real.webp") },
            { tag: "@img2", name: "الشارة", src: img("badge.webp") },
            { tag: "@aud1", name: "الجملة ١ بصوتك" },
          ],
          text: `Legend: @img1 is the man — keep his exact face, short curly black hair and goatee; he wears a black two-piece suit, white shirt, slim black tie and dark aviator sunglasses. @img2 is the golden badge — keep its exact shape, colours and Arabic text. @aud1 is his spoken line — use this exact voice and performance, lip-synced to him, and no other dialogue.

Style & Mood: ${REAL_LOOK} Tense, thrilling chase.

Dynamic Description:
0–2.5s: Extreme wide aerial at a high angle, the camera trucking alongside: a small white single-engine propeller plane cruises above a sea of golden clouds, flying from right to left; a few meters ahead of its nose the golden badge @img2 floats and slowly spins, flashing in the sun.
2.5–7.5s: Inside the cockpit, front three-quarter at eye level, medium close-up on a 50mm lens with a slow push-in: @img1 grips the yoke, eyes locked on the badge beyond the windshield; he leans forward, jaw set, a determined half-smile, and speaks the line from @aud1.
7.5–9s: His point of view through the windshield, 35mm, slight handheld: the badge suddenly drops below the nose and out of sight.
9–11s: Low angle from the cockpit floor, wide 24mm, handheld: he unbuckles, throws the side door open, the wind blasts his tie and jacket, and he dives out of frame to the left.
11–14s: Outside, high angle looking down from the plane's side, wide 28mm, the camera tilting down to follow: he freefalls head-first after the spinning badge toward a bright turquoise sea far below, arms swept back, as the plane pulls out of frame at the top.

Static Description: One man only. Clean white propeller plane with no logos or writing. Open sky, golden clouds, turquoise sea.

Audio: Steady propeller drone and wind; muffled cockpit hum while he speaks; a roaring blast of wind when the door opens; rushing freefall wind. His voice comes only from @aud1. No music, no other voices, no subtitles.

Avoid: any text or logo other than the badge's own Arabic text, distorted or extra hands, a second person, sunglasses falling off, the badge changing shape or colour, cartoon look.`,
        },
      ],
    },
    {
      title: "مشاهد الكرتون الخمسة",
      body: [
        "كل مشهد توليدة وحدة في Wan 3.0. البرومبت يبدأ بسطر الستايل نفسه، وبعده من هو @img1 ومن هي @img2، وبعدين ملخص القصة والثواني، والجملة العربية مكتوبة داخل البرومبت.",
        "كل مشهد يكمل من وين وقف اللي قبله: يطيح في البحر، يسبح ويطلع، ينزل في الملعب، يتقاتل على الشارة، يمسكها ويملأ الضوء الشاشة.",
      ],
      images: [
        { src: img("scene-sea.webp"), alt: "بيكسار حديث: تحت الماء" },
        { src: img("scene-kids.webp"), alt: "ثري دي الصغار: الشارة تطلع من الماء" },
        { src: img("scene-stadium.webp"), alt: "أنمي: الملعب" },
        { src: img("scene-night.webp"), alt: "العصر الذهبي: المسكة" },
      ],
      prompts: [
        {
          label: "٢ · بيكسار حديث: الماء والسمك",
          tool: "Wan 3.0",
          settings: "٨ ث · 1080p · 9:16",
          refs: refsWan("char-pixar.webp"),
          text: `STYLE (the whole piece is in this style): ${STYLE.pixar}

Legend: @img1 is the man — keep his exact face, short curly black hair and goatee, black two-piece suit, white shirt and slim black tie. @img2 is the golden badge — keep its exact shape, colours and Arabic text.

Narrative Summary: Still chasing the golden badge after jumping from a plane, the man falls into the sea and keeps chasing it underwater.

Dynamic Description:
0–1.5s: Top-down wide shot on a 24mm lens, the camera falling with him: @img1 plunges head-first toward a bright turquoise sea at golden hour, the spinning badge @img2 just below him, both moving from the right side of the frame to the left.
1.5–4s: Medium close-up, front three-quarter, slight low angle, wind whipping his hair and tie: eyes wide, mouth stretched in an exaggerated shout, he says in clear Arabic: «ماءٌ؟! لا بأس… سألحقُ بكِ!»
4–5s: Impact frame as he hits the water — a huge splash with radial speed lines and a flat colour burst behind him.
5–8s: Underwater, side profile tracking shot on a 28mm lens: he swims hard after the sinking badge, which glints ahead of him, through a bright school of fish that swirls around him; bubbles trail from his suit, movement from right to left.

Static Description: One man only. Clear turquoise water, sunbeams cutting down from the surface, colourful fish.

Audio: Rushing wind, then a deep splash, then muffled underwater sound with bubbles. His single Arabic line in a young adult male voice, formal Arabic, energetic. No music, no other voices, no subtitles.

Avoid: any text or logo other than the badge's own Arabic text, a second person, extra limbs, the badge changing shape or colour, the suit changing colour, photorealistic look.`,
        },
        {
          label: "٣ · ثري دي الصغار: السباحة والقفزة",
          tool: "Wan 3.0",
          settings: "٧ ث · 1080p · 9:16",
          refs: refsWan("char-kids.webp"),
          text: `STYLE (the whole piece is in this style): ${STYLE.kids}

Legend: @img1 is the man — keep his exact face, curly black hair and goatee, black suit, white shirt and black tie. @img2 is the golden badge — keep its exact shape, colours and Arabic text.

Narrative Summary: Underwater, the man races after the golden badge, and when it leaps out of the sea he leaps out after it.

Dynamic Description:
0–2.5s: Underwater, side profile tracking shot at eye level on a 35mm lens: @img1 swims fast like a little torpedo, arms forward, moving from the right side of the frame to the left; a few big round friendly fish swim beside him and the badge @img2 glints just ahead.
2.5–4.5s: Medium close-up, front three-quarter, the camera gliding backward with him: cheeks puffed, big eager eyes, he says in clear Arabic: «أسرعُ من السمكِ… انتظري!»
4.5–5.5s: Low angle looking up toward the bright surface: the badge rockets upward and bursts out of the water.
5.5–7s: Above the sea, low angle wide shot on a 24mm lens: he bursts out of the water after it in a high joyful jump, water droplets sparkling around him, the badge flying ahead to the left.

Static Description: One man only. Calm pastel sea, soft round waves, clear sky.

Audio: Bubbly underwater whoosh, a cheerful splash as he breaks the surface. His single Arabic line in a young adult male voice, formal Arabic, playful and energetic. No music, no other voices, no subtitles.

Avoid: any text or logo other than the badge's own Arabic text, a second person, extra limbs, sharp or scary details, the badge changing shape or colour, the suit changing colour, photorealistic look.`,
        },
        {
          label: "٤ · الكوميكس المطبوع: الملعب",
          tool: "Wan 3.0",
          settings: "٧ ث · 1080p · 9:16",
          refs: refsWan("char-comic.webp"),
          note: "هذا المشهد ما دخل المونتاج الأخير لأن الشبه طلع ضعيف. جرّبه، وإذا طلع الوجه زين حطه بين ثري دي الصغار والأنمي.",
          text: `STYLE (the whole piece is in this style): ${STYLE.comic}

Legend: @img1 is the man — keep his exact face, curly black hair and goatee, black suit, white shirt and black tie. @img2 is the golden badge — keep its exact shape, colours and Arabic text.

Narrative Summary: Still chasing the golden badge, the man drops into a huge night stadium and fires it toward midfield with a bicycle kick.

Dynamic Description:
0–1.5s: Wide shot from a high angle on a 28mm lens: @img1 drops from the sky and lands in a crouch on the floodlit grass of a huge stadium at night, a crowd of young men roaring in the stands; the badge @img2 bounces onto the grass ahead of him to the left.
1.5–3.5s: Medium close-up, low angle, front three-quarter on a 35mm lens, speed lines behind him: he rises, grins with fierce focus and says in clear Arabic: «ملعبٌ كامل… وهدفٌ واحد!»
3.5–5s: Tracking shot at ground level on a 24mm lens: the badge rolls across the grass like a ball and he sprints after it from right to left.
5–7s: Low angle, slow push-in, impact frame: he leaps into a bicycle kick, his shoe strikes the badge with a burst of halftone speed lines, and it shoots away toward midfield.

Static Description: One player only on the pitch — the man in his suit. Bright floodlights, painted crowd in the stands, white pitch lines.

Audio: Stadium crowd roar, a thud as he lands, fast footsteps on grass, a sharp kick impact, the crowd erupting. His single Arabic line in a young adult male voice, formal Arabic, confident. No music, no other voices, no subtitles.

Avoid: any text or logo other than the badge's own Arabic text, speech bubbles, comic captions, a second player on the pitch, extra limbs, the badge changing shape or colour, the suit changing colour, photorealistic look.`,
        },
        {
          label: "٥ · أنمي قتال ٢٫٥دي: القتال",
          tool: "Wan 3.0",
          settings: "٨ ث · 1080p · 9:16",
          refs: refsWan("char-anime.webp"),
          text: `STYLE (the whole piece is in this style): ${STYLE.anime}

Legend: @img1 is the man (the hero) — keep his exact face, short curly black hair and goatee, black suit, white shirt and black tie. @img2 is the golden badge — keep its exact shape, colours and Arabic text.

Narrative Summary: At midfield of a floodlit stadium, a masked rival holds the golden badge; the hero confronts him, they clash, and the hero snatches it back.

Dynamic Description:
0–2s: Wide shot at a low angle on a 28mm lens: at midfield under blazing floodlights, a masked rival in a dark hooded jacket and a plain silver mask holds the badge @img2 in one hand; @img1 lands facing him from the right side of the frame, both in fighting stance, energy auras flaring.
2–4s: Medium close-up of the hero, front three-quarter, low angle on a 50mm lens: sweat drop, gritted teeth, he points at the rival and says in clear Arabic: «مَن أنت؟! اتركِ الشارةَ… فهي لي!»
4–6.5s: Dynamic tracking shot circling at waist height: they clash in a fast duel — strikes and blocks trade back and forth, glowing energy trails, shockwaves tearing up the grass; control shifts to the hero.
6.5–8s: Low angle impact frame with radial speed lines and a bold colour burst: the hero lands a final strike, the rival staggers back, and the hero snatches the badge and holds it up.

Static Description: Two figures only on the pitch: the hero and the masked rival. Packed stands of young men cheering, floodlights, painted night sky.

Audio: Crowd roar, whooshes of fast strikes, heavy impact hits, crackling energy. Only the hero speaks: his single Arabic line in a young adult male voice, formal Arabic, fierce. The rival is silent. No music, no subtitles.

Avoid: any text or logo other than the badge's own Arabic text, blood or injuries, extra limbs, more than two people on the pitch, the badge changing shape or colour, the hero's suit changing colour, photorealistic look.`,
        },
        {
          label: "٦ · العصر الذهبي: المسكة والضوء",
          tool: "Wan 3.0",
          settings: "٥ ث · 1080p · 9:16",
          refs: refsWan("char-golden.webp"),
          text: `STYLE (the whole piece is in this style): ${STYLE.golden}

Legend: @img1 is the man — keep his exact face, short curly black hair and goatee, black suit, white shirt and black tie. @img2 is the golden badge — keep its exact shape, colours and Arabic text.

Narrative Summary: The badge flies up into the night sky; the man leaps, finally catches it, and its glow fills the screen.

Dynamic Description:
0–1.5s: Low angle wide shot on a 28mm lens against a painted starry night sky: @img1 leaps high from the right side of the frame toward the left, arm stretched, the badge @img2 spinning just above his fingertips.
1.5–3s: Medium close-up, front three-quarter, slight low angle on a 50mm lens: his hand closes around the badge; relief and a wide smile, he says in clear Arabic: «أخيرًا… أمسكتُ بكِ!»
3–5s: Slow push-in on the badge held up in his hand: it glows brighter and brighter, warm golden rays spreading, until pure white light fills the whole frame.

Static Description: One man only. Painted night sky with soft stars and watercolor clouds.

Audio: Rushing air, a soft metallic catch, then a rising shimmering glow sound. His single Arabic line in a young adult male voice, formal Arabic, relieved and happy. No music, no other voices, no subtitles.

Avoid: any text or logo other than the badge's own Arabic text, a second person, extra limbs, the badge changing shape or colour, the suit changing colour, 3D or photorealistic look.`,
        },
      ],
    },
    {
      title: "المشهد الأخير: الرجوع للواقع",
      body: [
        "الضوء الأبيض اللي خلص فيه العصر الذهبي يفتح على السما، ويطيح من فوق في كرسي الطيارة، والشارة على صدره.",
        "عشان تطلع نفس الطيارة ونفس الكابينة، أخذنا لقطتين من فيديو المشهد الأول وحطيناهم مراجع (@img3 و@img4). وشاشة الطيارة طلبناها بيضاء فاضية عشان نحط عليها الأفلام الخمسة في المونتاج.",
      ],
      images: [
        { src: img("ref-plane.webp"), alt: "مرجع الطيارة من المشهد الأول" },
        { src: img("ref-cockpit.webp"), alt: "مرجع الكابينة من المشهد الأول" },
        { src: img("scene-cockpit.webp"), alt: "يرجع للطيارة" },
      ],
      prompts: [
        {
          label: "الرجوع للطيارة",
          tool: "Seedance 2.0",
          settings: "٨ ث · 1080p · 9:16",
          refs: [
            { tag: "@img1", name: "الشيت الواقعي", src: img("sheet-real.webp") },
            { tag: "@img2", name: "الشارة", src: img("badge.webp") },
            { tag: "@img3", name: "الطيارة", src: img("ref-plane.webp") },
            { tag: "@img4", name: "الكابينة", src: img("ref-cockpit.webp") },
            { tag: "@aud1", name: "الجملة ٧ بصوتك" },
          ],
          text: `Legend: @img1 is the man — keep his exact face, short curly black hair and goatee; he wears a black two-piece suit, white shirt, slim black tie and dark aviator sunglasses. @img2 is the golden badge — keep its exact shape, colours and Arabic text. @img3 is the same small white propeller plane from earlier in the film. @img4 is the same cockpit interior. @aud1 is his spoken line — use this exact voice and performance, lip-synced to him, and no other dialogue.

Style & Mood: ${REAL_LOOK} Breathless relief turning into a confident smile.

Dynamic Description:
0–1s: Pure white light fades into open golden-hour sky above the clouds; the plane @img3 flies from right to left, its cockpit canopy wide open.
1–3s: High angle from above and behind the plane on a 28mm lens: @img1 suddenly falls into frame from above and drops cleanly into the pilot seat through the open canopy; the canopy slides shut.
3–4.5s: Inside the cockpit @img4, front three-quarter at eye level, medium shot on a 35mm lens: he catches his breath, chest heaving; the golden badge @img2 is now pinned on his chest like pilot wings. The large screen in the center of the dashboard lights up bright, plain and empty.
4.5–8s: Slow push-in to a medium close-up on a 50mm lens: he turns to the camera, a confident half-smile, and speaks the line from @aud1.

Static Description: One man only. The same white propeller plane and the same cockpit as the references. The dashboard screen stays plain bright white with nothing on it.

Audio: Steady propeller drone and wind, a solid thump as he lands in the seat, the canopy clicking shut, a soft electronic chime as the screen lights up. His voice comes only from @aud1. No music, no other voices, no subtitles.

Avoid: any text or logo other than the badge's own Arabic text, images or text on the dashboard screen, distorted or extra hands, a second person, sunglasses falling off, the badge changing shape or colour, cartoon look.`,
        },
      ],
    },
    {
      title: "المونتاج في حيدرة كت",
      body: [
        "رتّب المشاهد بالترتيب، وقصّ من كل توليدة أحلى ثواني القصة بس. الانتقال بين الستايلات يصير بالحركة نفسها (يطيح، يغطس، يطلع)، فما يحتاج مؤثرات انتقال.",
        "بدّل صوت المشهدين الواقعيين بتسجيلك الأصلي، وخل صوت Wan في مشاهد الكرتون.",
        "على شاشة الطيارة البيضاء ركّب لقطات من الستايلات الخمسة، وحدة ورا الثانية.",
        "حط موسيقى أفلام أكشن (مب إيقاع أغاني) تنخفض تحت الكلام، وفي البداية جملة قصيرة تشد، وفي النهاية دعوة واضحة.",
      ],
    },
  ],
  fixes: [
    { problem: "الوجه ما يشبهك في ستايل معيّن", fix: "ولّد صورة الشخصية مرة ثانية قبل الفيديو. إذا ظل ضعيف، شيل المشهد من المونتاج زي ما سوينا بالكوميكس." },
    { problem: "Seedance نطق العربي غلط", fix: "ارفع صوتك @aud1، وفي المونتاج بدّل صوته بتسجيلك الأصلي." },
    { problem: "الشارة تغيّر شكلها أو كلامها", fix: "ارفع نفس صورة الشارة المفرّغة في كل توليد، واكتب في Avoid: the badge changing shape or colour." },
    { problem: "الفيلم يبان مقاطع متقطعة", fix: "خل الحركة دايم من اليمين لليسار، وابدأ كل مشهد من وين خلص اللي قبله." },
    { problem: "الستايل يطلع واقعي في مشهد كرتون", fix: "سطر STYLE أول شي في البرومبت، وفي Avoid اكتب photorealistic look." },
  ],
  faq: [
    { q: "أقدر أسويها على شخصيتي؟", a: "إيه. تحتاج صورة وحدة واضحة لوجهك ولبسك، وتمشي على نفس الخطوات وتبدّل الشارة والقصة باللي يناسبك." },
    { q: "ليش الواقعي في Seedance والكرتون في Wan؟", a: "Seedance أقوى في اللقطات الواقعية وحركة الكاميرا. Wan أرخص منه بحوالي ٤ مرات ومستواه ممتاز في الكرتون، وينطق الجملة العربية المكتوبة في البرومبت." },
    { q: "ليش الحوار بالفصحى؟", a: "المولّدات تنطق الفصحى أوضح من اللهجات، والجملة القصيرة تطلع بالتزامن مع الشفايف أحسن." },
    { q: "أقدر أغيّر الستايلات؟", a: "إيه. بدّل سطر STYLE بس في صورة الشخصية وفي برومبت الفيديو، وخل باقي البرومبت زي ما هو." },
    { q: "وين أسويها؟", a: "كلها داخل منصة الجواد: الصور والفيديو في الاستوديو الإبداعي، والمونتاج في حيدرة كت." },
  ],
};

const B2 = {
  g1a: "Legend: @img1 = the hero, photoreal, wearing dark aviator sunglasses. @img2 = the four gang men, photoreal, left to right: bald bearded man in a black leather jacket, man in a red hoodie, scarred man in a brown bomber jacket, man in a backwards black cap and denim jacket. @img3 = the golden badge pinned on his left chest pocket; keep its shape and Arabic text.\n\nStyle & Mood: STYLE (the whole piece is in this style): Modern blockbuster cinema. Teal-and-orange colour grade, anamorphic widescreen with oval bokeh and horizontal lens flares, high-contrast heroic lighting, smoke and sparks in the air, epic scale, crisp digital detail. Everything is photoreal live action from the first frame to the last. Breathless, relentless chase energy.\n\nEditing: aggressive fast cutting from the very first frame — a hard cut every 0.5 to 1 second, mostly inserts, extreme close-ups and close-ups, only one or two very short wide shots.\n\nDynamic Description: 0–0.7s: Cold open at full sprint, extreme close-up of his eyes behind aviator lenses, the sunset reflected in them, ragged breathing. 0.7–1.3s: Insert: his black shoe smashes through a puddle, water exploding. 1.3–2.1s: Ground-level tracking shot racing beside him: he sprints flat out from right to left, tie whipping over his shoulder, the four men only a few steps behind. 2.1–2.8s: Close-up: the bald man roars and points at the badge: \"That badge is ours!\". 2.8–3.4s: Insert: the golden badge bouncing on his chest pocket, a lens flare across it. 3.4–4.2s: Insert: four pairs of boots and sneakers pounding the wet ground. 4.2–5s: Handheld side tracking: he vaults over a stack of wooden crates and the gang smashes straight through them, splinters flying. 5–5.6s: Insert: the bald man's hand grabs at his jacket and misses by an inch. 5.6–6.4s: Close-up: his jaw clenched, sweat on his temple, still running. 6.4–7.2s: Insert: he kicks a metal trash can back into their path and the man in the red hoodie trips over it. 7.2–8s: Overhead shot looking straight down the narrow alley as the chase tears through bursting steam vents. 8–8.8s: Close-up: the scarred man running, teeth gritted. 8.8–9.6s: Insert: shoes skidding around a corner, water spraying. 9.6–10.4s: Close-up: the man in the cap leaps over a fallen bin. 10.4–11.2s: Extreme close-up: the hero's eyes widen. 11.2–12s: Crash zoom into a tall dead-end brick wall. 12–12.8s: Insert: the four men slow down, grinning, closing in. 12.8–13.6s: Insert: his shoe plants on the bricks, dust bursting. 13.6–15s: Low angle: he runs two steps up the wall and launches into a high backflip over the four men; the clip ends at the top of the arc with the men below looking up.\n\nStatic Description: One hero and exactly four gang men, nobody else. The badge stays on his left chest pocket the whole time.\n\nAudio: Pounding footsteps, hard breathing, the bald man's shout, crates splintering, a trash can clattering, steam hissing, a rising whoosh on the jump. No music, no subtitles.",
  g1b: "Legend: @img1 = the opening frame: the hero at the top of a backflip above the four gang men in a sunset brick alley, photoreal. The video begins exactly on this image and continues it. @img2 = the hero's face and body, photoreal: keep this exact face in every frame and in both styles. @img3 = the four gang men, photoreal, left to right: bald bearded man in a black leather jacket, man in a red hoodie, scarred man in a brown bomber jacket, man in a backwards black cap and denim jacket; keep these exact faces. @img4 = the same hero in hero-game 3D. @img5 = the same four men in hero-game 3D. @img6 = the golden badge pinned on his left chest pocket; keep its shape and Arabic text.\n\nStyle & Mood: From 0 to 1.5s — STYLE: Modern blockbuster cinema. Teal-and-orange colour grade, anamorphic widescreen with oval bokeh and horizontal lens flares, high-contrast heroic lighting, smoke and sparks in the air, epic scale, crisp digital detail. From 1.5s to the end — STYLE: Stylised hero-game 3D art. Clean appealing character shapes with clear readable silhouettes, smooth painted materials with subtle texture, bold saturated colour accents, bright clean lighting with strong rim light, energetic action poses, polished cinematic finish. The change happens inside one continuous moment, no cut. The faces never change: the 3D hero is the man of @img2 and the 3D gang are the men of @img3.\n\nEditing: aggressive fast cutting after the transformation — a hard cut every 0.5 to 1 second, mostly inserts, extreme close-ups and close-ups, only one very short wide shot.\n\nDynamic Description: 0–1.5s: Begin exactly on @img1 at the top of the backflip; time slows; a bright wave sweeps out from his body across the frame and the alley, the four men and the hero turn from photoreal into the hero-game 3D of @img4 and @img5 in one flowing motion; his sunglasses vanish in the change. 1.5–2.1s: 3D close-up: his eyes narrowing under hard rim light. 2.1–2.8s: Insert: his shoes land on the wet ground behind the four men, water splashing. 2.8–3.6s: Low insert: a sweeping kick cuts the bald man's ankles and he flips into the air. 3.6–4.4s: Close-up: a spinning back kick lands on the jaw of the man in the red hoodie, sweat spraying, frame shake. 4.4–5s: Insert: the scarred man and the man in the cap spin round, fists up. 5–6.6s: Medium: he jumps and splits his legs in mid-air, kicking both of them in the chest at the same moment, slow motion snapping back to full speed. 6.6–7.2s: Insert: the two bodies smash into wooden crates. 7.2–7.8s: Insert: the badge glints, untouched. 7.8–8.6s: Close-up: the bald man's stunned face on the wet ground. 8.6–9.4s: Insert: the hero straightens his tie. 9.4–10.2s: Insert: his shoe pushes off as he starts to run. 10.2–12s: Low tracking beside his running feet, then a whip pan to the far end of the alley where the scissor doors of a matte-black Italian supercar rise.\n\nStatic Description: One hero and exactly four gang men, nobody else. The badge stays on his left chest pocket. The car has no logos.\n\nAudio: A rising whoosh slowing into a deep shimmering chime on the transformation, then punchy game-style hits on every kick, crates splintering, groans, running footsteps, a car door hiss. No music, no subtitles.",
  g2: "Legend: @img1 = the hero in hero-game 3D. @img2 = the four gang men in hero-game 3D. @img3 = the same hero in pixel art. @img4 = the same four men in pixel art. @img5 = the golden badge on his left chest pocket; keep its shape and Arabic text. @img6 = loose inspiration for the street only.\n\nStyle & Mood: From 0 to 3.5s — STYLE: Stylised hero-game 3D art. Clean appealing character shapes with clear readable silhouettes, smooth painted materials with subtle texture, bold saturated colour accents, bright clean lighting with strong rim light, energetic action poses, polished cinematic finish. From 3.5s to the end — STYLE: Pixel art. A low-resolution image built from crisp visible square pixels with no anti-aliasing, a limited palette of about thirty-two colours, careful dithering for gradients, strong readable sprites, parallax background layers. One continuous take, no cut.\n\nEditing: aggressive fast cutting from the very first frame — a hard cut every 0.5 to 1.5 seconds, mostly inserts, extreme close-ups and close-ups, with only one or two very short wide shots in the whole clip. The style change happens inside one continuous moment, never on a cut.\n\nDynamic Description: 0–0.9s: Insert: the scissor door of the matte-black Italian supercar swinging up, a glint running along it, at the end of a brick alley at sunset. 0.9–2.4s: Medium, side on: he slides across the hood and drops feet-first into the driver's seat in one movie-style move. 2.4–3s: Insert: the door slams down. 3–4s: Extreme close-up of his hand gripping the wheel; as his knuckles tighten, square pixels spread out from his hand across the whole image until everything is the pixel art of @img3 and @img4. 4–4.6s: Pixel insert: the rev needle slams into the red. 4.6–5.3s: Pixel insert: the rear tyre spins, pixel smoke bursting. 5.3–6.1s: Pixel close-up: the bald man yelling as he dives into a battered red muscle car. 6.1–6.8s: Pixel insert: a gang foot stomps the gas pedal. 6.8–7.5s: Pixel insert: the red muscle car's grille and headlights lunging forward. 7.5–8.2s: Pixel extreme close-up: the hero's eyes, neon streaking across them. 8.2–10s: Pixel side-scrolling view, short: the supercar blasts from right to left, the red muscle car and a black SUV roaring after it.\n\nStatic Description: One hero and exactly four gang men. Matte-black Italian supercar with no logos. Neon signs are blank, no writing.\n\nAudio: Engine roar, tyre screech, an 8-bit chiptune sound on the change, car doors slamming, chase engines. No music, no subtitles.",
  g3: "Legend: @img1 = the hero in pixel art. @img2 = the four gang men in pixel art. @img3 = the same hero in cut-and-paste punk zine style. @img4 = the same four men in punk zine style. @img5 = the golden badge on his left chest pocket; keep its shape and Arabic text.\n\nStyle & Mood: From 0 to 7.5s — STYLE: Pixel art. A low-resolution image built from crisp visible square pixels with no anti-aliasing, a limited palette of about thirty-two colours, careful dithering for gradients, strong readable sprites, parallax background layers. From 7.5s to the end — STYLE: Cut-and-paste punk zine animation. Characters built from torn magazine cut-outs and photocopied textures, xerox grain and harsh black toner, clashing hot pink, acid green and cyan ink, each layer moving at its own frame rate, rough hand-lettered shapes and safety-pin collage edges. One continuous story, no cut at the change.\n\nEditing: aggressive fast cutting — a hard cut every 0.5 to 1 second, mostly inserts and close-ups, one short side-on chase shot. This is a pure car chase: all cars drive in the same direction, nobody leans out of a window and nobody reaches for the badge.\n\nDynamic Description: 0–0.8s: Pixel close-up: his eyes in the rear-view mirror, two pairs of headlights growing behind him. 0.8–1.5s: Pixel insert: his foot floors the gas pedal. 1.5–3.3s: Pixel side-scrolling chase, all three cars racing from right to left in the same direction: the matte-black supercar in front, the battered red muscle car and the black SUV right behind it, closing the gap, neon streaking past. 3.3–4s: Pixel insert: the red car's front bumper almost touching the supercar's rear, sparks. 4–4.6s: Pixel close-up: the hero gritting his teeth and swerving. 4.6–5.2s: Pixel insert: the black SUV pulls up into the next lane right beside him, same direction, engine roaring. 5.2–5.8s: Crash zoom: a huge truck's headlights fill the frame straight ahead, its horn blasting one long deafening note. 5.8–6.2s: Pixel extreme close-up: his eyes widen. 6.2–6.7s: Pixel insert: his finger smashes a red button on the gear stick. 6.7–7.5s: The roof blasts open and his seat rockets straight up on a smoke trail. 7.5–9s: Low angle racing up with the seat; as he punches through the cloud layer the image tears like paper and re-forms as the punk zine collage of @img3 and @img4. 9–10s: Punk close-up: his face in the wind as a small parachute snaps open above the seat.\n\nStatic Description: One hero and exactly four gang men, inside their two cars. Blank signs, no writing anywhere.\n\nAudio: 8-bit engines and tyre squeals, the cars' engines closing in, a long truck horn, a button click, a rocket blast, loud paper tearing on the change. No music, no subtitles.",
  g4: "Legend: @img1 = the hero in punk zine style. @img2 = the four gang men in punk zine style. @img3 = the same hero in chibi style. @img4 = the same four men in chibi style. @img5 = the golden badge on his left chest pocket; keep its shape and Arabic text. @img6 = loose inspiration for the candy world only.\n\nStyle & Mood: From 0 to 8s — STYLE: Cut-and-paste punk zine animation. Characters built from torn magazine cut-outs and photocopied textures, xerox grain and harsh black toner, clashing hot pink, acid green and cyan ink, each layer moving at its own frame rate, rough hand-lettered shapes and safety-pin collage edges. From 8s to the end — STYLE: Chibi style. Compressed proportions of exactly 2.5 heads tall, oversized head and simplified body, thick soft outlines, pastel palette, flat gentle shading, minimal detail, cute rounded forms. One continuous take, no cut.\n\nEditing: aggressive fast cutting from the very first frame — a hard cut every 0.5 to 1.5 seconds, mostly inserts, extreme close-ups and close-ups, with only one or two very short wide shots in the whole clip. The style change happens inside one continuous moment, never on a cut.\n\nDynamic Description: 0–0.8s: Punk insert: his shoes slam onto a huge cloud, fluff bursting. 0.8–1.5s: Close-up: he looks back over his shoulder. 1.5–2.5s: Close-up: the bald man bursts up through the edge of the cloud, roaring, the other three right behind him. 2.5–3.2s: Insert: their legs sinking knee-deep into the cloud, stumbling. 3.2–4.1s: Close-up: the bald man's hand grabs at the badge and the hero twists away. 4.1–4.9s: Insert: his feet at the very edge of the cloud. 4.9–6.2s: He dives off; the camera drops with him, close on his face in the rushing wind; the four leap after him. 6.2–8.2s: In one continuous fall the paper collage softens and rounds into the pastel chibi forms of @img3 and @img4. 8.2–9.2s: Chibi point of view straight down: a world of giant sweets rushing up. 9.2–10s: Chibi close-up: the hero grinning.\n\nStatic Description: One hero and exactly four gang men. No writing anywhere.\n\nAudio: Soft cloud thumps, the men's grunts, wind rushing in the fall, a cute pop on the change. No music, no subtitles.",
  g5: "Legend: @img1 = the hero in chibi style. @img2 = the four gang men in chibi style. @img3 = the same hero in classic slapstick cartoon style. @img4 = the same four men in slapstick cartoon style. @img5 = the golden badge on his left chest pocket; keep its shape and Arabic text.\n\nStyle & Mood: From 0 to 7.5s — STYLE: Chibi style. Compressed proportions of exactly 2.5 heads tall, oversized head and simplified body, thick soft outlines, pastel palette, flat gentle shading, minimal detail, cute rounded forms. From 7.5s to the end — STYLE: Classic theatrical slapstick cartoon. Extreme stretched takes and wild expressions, crisp ink line, flat cel colour over lush painted backgrounds of desert and town, dust clouds and speed lines, impossible physics played for laughs, saturated mid-century palette. One continuous take, no cut.\n\nEditing: aggressive fast cutting from the very first frame — a hard cut every 0.5 to 1.5 seconds, mostly inserts, extreme close-ups and close-ups, with only one or two very short wide shots in the whole clip. The style change happens inside one continuous moment, never on a cut.\n\nDynamic Description: 0–0.8s: Chibi insert: they plop onto a giant marshmallow and bounce. 0.8–1.6s: Close-up: his hand snatches a lollipop and pops it into his mouth. 1.6–2.4s: Close-up: the scarred man reaching for the badge. 2.4–3.1s: Insert: a giant candy cane bonks his head, stars spinning. 3.1–3.8s: Insert: bonk on the bald man's head. 3.8–4.5s: Insert: bonk on the man in the red hoodie. 4.5–5.2s: Insert: bonk on the man in the cap, his cap flying. 5.2–6s: Insert: four pairs of dizzy spiral eyes in a pile. 6–7.6s: He springs off a giant donut; at the top of the jump the pastel world snaps into the crisp ink lines and flat cel colour of @img3 and @img4. 7.6–8.6s: Cartoon insert: he lands in the saddle of a brown horse and the horse's eyes pop out of its head. 8.6–10s: Close-up: the horse rears in a burst of dust and gallops off from right to left.\n\nStatic Description: One hero and exactly four gang men. No writing anywhere.\n\nAudio: Squishy candy steps, cartoon boing and bonk sounds, a twinkle of stars, a classic cartoon whistle on the jump, hoofbeats on landing. No music, no subtitles.",
  g6: "Legend: @img1 = the hero in slapstick cartoon style, riding a brown horse and holding a curved sword. @img2 = the four gang men in slapstick cartoon style, each on his own horse with a curved sword. @img3 = the same hero, photoreal; in the photoreal part he wears dark aviator sunglasses. @img4 = the same four men, photoreal. @img5 = the golden badge on his left chest pocket; keep its shape and Arabic text.\n\nStyle & Mood: From 0 to 9.6s — STYLE: Classic theatrical slapstick cartoon. Extreme stretched takes and wild expressions, crisp ink line, flat cel colour over lush painted backgrounds of desert and town, dust clouds and speed lines, impossible physics played for laughs, saturated mid-century palette. From 9.6s to the end — STYLE: Modern blockbuster cinema. Teal-and-orange colour grade, anamorphic widescreen with oval bokeh and horizontal lens flares, high-contrast heroic lighting, smoke and sparks in the air, epic scale, crisp digital detail. One continuous story, no cut at the change.\n\nEditing: aggressive fast cutting — a hard cut every 0.5 to 1 second, mostly inserts and close-ups, only one very short wide shot. Real sword fighting at full gallop, not just riding.\n\nDynamic Description: 0–0.8s: Cartoon insert: hooves pounding the sand, dust exploding. 0.8–1.6s: Close-up: the hero galloping from right to left, glancing back over his shoulder. 1.6–2.4s: Tracking side shot: the bald man's black horse surges up alongside on the hero's right, the two horses neck and neck. 2.4–3.2s: Close-up: the bald man swings his sword down and the hero blocks it, sparks bursting. 3.2–4s: Insert: the two blades grinding together between the galloping horses. 4–4.8s: Close-up: the man in the red hoodie pulls up alongside on the hero's left, sword raised. 4.8–5.6s: Both attack at once from right and left; the hero ducks flat on his horse's neck and the two swords clang into each other above him. 5.6–6.4s: Close-up: the two attackers' faces stretch in a huge shocked take as their horses bump and both tumble out of the saddle into the sand. 6.4–7.2s: Insert: the scarred man and the man in the cap close in from behind, swords up. 7.2–8s: Close-up: the hero turns in the saddle and parries both swords in two fast strokes, sparks flying. 8–8.8s: Insert: a zigzag crack rips through the sand right ahead of the horses. 8.8–9.6s: Close-up: everyone's eyes pop as they hang in the air for one frozen beat. 9.6–11.4s: They drop into darkness and in one continuous fall the drawn world turns photoreal; his aviator sunglasses are back on. 11.4–12.2s: Photoreal insert: his shoes slam into a puddle on the wet ground of the same narrow brick alley at sunset from the opening. 12.2–13.4s: Fast cuts: the four bodies crash onto the wet asphalt around him. 13.4–15s: Close-up: he rises into frame, the sunset burning in his lenses.\n\nStatic Description: One hero and exactly four gang men, nobody else. Horses only in the desert part. No writing anywhere.\n\nAudio: Galloping hooves, ringing sword clangs and scrapes, cartoon boings as the two riders fall, a ground-cracking rumble, a falling whistle, then a heavy realistic impact on wet ground and groans. No music, no subtitles.",
  g7: "Legend: @img1 = the hero, photoreal, wearing dark aviator sunglasses. @img2 = the four gang men, photoreal, left to right: bald bearded man in a black leather jacket, man in a red hoodie, scarred man in a brown bomber jacket, man in a backwards black cap and denim jacket. @img3 = the golden badge on his left chest pocket; keep its shape and Arabic text.\n\nStyle & Mood: STYLE (the whole piece is in this style): Modern blockbuster cinema. Teal-and-orange colour grade, anamorphic widescreen with oval bokeh and horizontal lens flares, high-contrast heroic lighting, smoke and sparks in the air, epic scale, crisp digital detail.\n\nEditing: aggressive fast cutting from the very first frame — a hard cut every 0.5 to 1.5 seconds, mostly inserts, extreme close-ups and close-ups, with only one or two very short wide shots in the whole clip. The style change happens inside one continuous moment, never on a cut.\n\nNarrative Summary: Back in the real alley, the four men try one last time. He beats them one by one, says one calm line and walks away.\n\nDynamic Description: 0–0.8s: Extreme close-up: the bald man's knuckles cracking. 0.8–1.6s: Close-up: the hero's eyes behind his aviators. 1.6–2.6s: Close-up: the bald man charges and takes a palm strike to the chest, the jacket rippling from the impact. 2.6–3.4s: Insert: his back slams onto the wet ground, water spraying. 3.4–4.4s: Insert: the hero's forearm blocks the high kick of the man in the red hoodie, shin on bone. 4.4–5.2s: Low insert: a sweep takes out his standing leg. 5.2–6.2s: Close-up: the scarred man throws fast punches and the hero parries twice. 6.2–7s: Close-up: an elbow to the jaw in slow motion, sweat flying. 7–7.8s: Insert: metal trash cans crash over. 7.8–8.6s: Extreme close-up: the hero's eyes flick sideways as the man in the cap attacks from behind. 8.6–10s: A spinning hook kick, slowing right at the impact and snapping back to speed. 10–10.8s: Insert: the cap lands in a puddle. 10.8–11.6s: Insert: four limp hands in the puddles, steam rising, silence. 11.6–13.4s: Close-up: he straightens his tie, touches the badge and says calmly \"Five worlds... and you still couldn't take it.\" 13.4–14.2s: Insert: his fingers settle the aviators on his nose. 14.2–15s: Wide: he walks away down the alley into the setting sun.\n\nStatic Description: One hero and exactly four gang men, nobody else. The badge stays on his left chest pocket.\n\nAudio: Scuffing shoes, heavy realistic punches and kicks, a body hitting the ground, trash cans crashing, a slowed-down impact, then quiet with distant city sound under his line, footsteps walking away. No music, no subtitles.",
  gang_real: "Still image, 16:9 wide. Character reference sheet of four adult men, photorealistic real people.\nSTYLE: Modern blockbuster cinema. Teal-and-orange colour grade, anamorphic widescreen with oval bokeh and horizontal lens flares, high-contrast heroic lighting, smoke and sparks in the air, epic scale, crisp digital detail.\nTHE FOUR MEN, always in this order from left to right: (1) a huge bald man with a thick black beard, black leather jacket over a black t-shirt, dark jeans, black boots; (2) a tall lean man with short black hair and a thin moustache, red hoodie, dark jeans, white sneakers; (3) a stocky man with a buzz cut and a scar across his left cheek, brown bomber jacket over a grey t-shirt, dark jeans, brown boots; (4) a skinny man with a light stubble, backwards black cap, denim jacket over a black t-shirt, black jeans, black sneakers.\nLAYOUT: top row — the four men full body, front view, standing straight in a neutral pose, side by side and evenly spaced. Bottom row — a close-up of each man's face in the same order. Plain medium-grey studio background, even light so every face and outfit reads clearly.\nAVOID: any text, labels or numbers, extra people, women, robes or traditional headwear, sunglasses, extra limbs, merged bodies.",
  gang_conv: "Still image, 16:9 wide. Recreate the attached reference sheet of four men (the first attached image) in a new style. Keep EXACTLY the same four men — same faces, beards, hair, scar, cap, clothes and colours — in the same order and the same layout: top row full body front view with the whole head visible and space above the heads, bottom row a close-up of each face. Plain light grey background. Use the second attached image ONLY as the reference for how this style draws people; do not add the man from it.\nSTYLE: Pixel art. A low-resolution image built from crisp visible square pixels with no anti-aliasing, a limited palette of about thirty-two colours, careful dithering for gradients, strong readable sprites, parallax background layers.\nAVOID: any text, labels or numbers, extra people, cropped heads, women, robes or traditional headwear, sunglasses.",
};

// ── part 2: «الشارة ٢» — one hero, a gang of four, five styles, every switch inside one generation ──
const M2 = `${CREATIVE_BASE}/golden-badge-2`;
const img2 = (f: string) => `${M2}/${f}`;
const R2 = {
  heroReal: { tag: "@img", name: "البطل واقعي (شيت)", src: img2("hero-real.webp") },
  gangReal: { tag: "@img", name: "العصابة واقعي", src: img2("gang-real.webp") },
  badge: { tag: "@img", name: "الشارة", src: img2("badge.webp") },
  flip: { tag: "@img", name: "آخر فريم من ١أ", src: img2("flip-frame.webp") },
  hero3d: { tag: "@img", name: "البطل ألعاب 3D", src: img2("hero-3d.webp") },
  gang3d: { tag: "@img", name: "العصابة ألعاب 3D", src: img2("gang-3d.webp") },
  heroPixel: { tag: "@img", name: "البطل بكسل", src: img2("hero-pixel.webp") },
  gangPixel: { tag: "@img", name: "العصابة بكسل", src: img2("gang-pixel.webp") },
  heroPunk: { tag: "@img", name: "البطل بانك", src: img2("hero-punk.webp") },
  gangPunk: { tag: "@img", name: "العصابة بانك", src: img2("gang-punk.webp") },
  heroChibi: { tag: "@img", name: "البطل تشيبي", src: img2("hero-chibi.webp") },
  gangChibi: { tag: "@img", name: "العصابة تشيبي", src: img2("gang-chibi.webp") },
  heroCartoon: { tag: "@img", name: "البطل كرتون مجنون", src: img2("hero-cartoon.webp") },
  gangCartoon: { tag: "@img", name: "العصابة كرتون مجنون", src: img2("gang-cartoon.webp") },
};
/** numbers the references @img1…@imgN in the order they are uploaded */
const tagged = (...rs: { tag: string; name: string; src?: string }[]) => rs.map((r, i) => ({ ...r, tag: `@img${i + 1}` }));

const GOLDEN_BADGE_2: CreativeMethod = {
  slug: "golden-badge-2",
  title: "فيلم أكشن: بطل وعصابة يركضون في خمس ستايلات",
  kicker: "الشارة الذهبية ٢",
  summary:
    "مطاردة وحدة ما توقف: تبدأ واقعية، وكل مرة يقفز البطل يتحول العالم لستايل جديد — ألعاب 3D، بكسل آرت، بانك مقصوص، تشيبي، كرتون مجنون — ويرجع للواقع في النهاية. السر إن الانتقال يصير داخل نفس التوليدة، ومراجع الوجيه في كل توليدة عشان ما تتغير. هنا الطريقة كاملة بالترتيب، بكل مرجع وكل برومبت.",
  cover: img2("cover.webp"),
  film: { src: img2("film.mp4"), poster: img2("film-poster.webp"), wide: true },
  facts: [
    { k: "التوليدات", v: "٨: ٤ Seedance + ٤ Wan" },
    { k: "الصور", v: "GPT Image 2 (جودة متوسطة)" },
    { k: "الواقعي والانتقالات الصعبة", v: "Seedance 2.0 · 1080p" },
    { k: "الكرتون", v: "Wan 3.0 · 1080p · ١٠ ث" },
    { k: "المقاس", v: "١٦:٩ عرض، ونسخة ريلز ٩:١٦" },
    { k: "المونتاج", v: "حيدرة كت" },
  ],
  steps: [
    {
      title: "القصة: مطاردة وحدة وثمان توليدات",
      body: [
        "عصابة من أربعة يبون الشارة الذهبية اللي على صدر البطل. يطاردونه في زقاق، ويقفز على الجدار — وفي نص القفزة يتحول العالم. كل توليدة تبدأ في ستايل وتخلص في الستايل اللي بعده، فالمونتاج يركب بدون قص.",
        "الحوار سطرين بس، مكتوبين بالإنجليزي داخل البرومبت والمولّد ينطقهم: سطر الأصلع في التوليدة ١أ، وسطر البطل في التوليدة ٧.",
      ],
      table: {
        head: ["التوليدة", "من ← إلى", "وش يصير", "المولّد"],
        rows: [
          ["١أ", "واقعي", "مطاردة في الزقاق، والجدار، والقفزة", "Seedance 2.0"],
          ["١ب", "واقعي ← ألعاب 3D", "يتحول في الهوا ويطيّح الأربعة", "Seedance 2.0"],
          ["٢", "ألعاب 3D ← بكسل", "يركب اللامبرغيني ويدعس", "Wan 3.0"],
          ["٣", "بكسل ← بانك مقصوص", "مطاردة سيارات، التريلة، والكرسي يطير", "Wan 3.0"],
          ["٤", "بانك ← تشيبي", "الغيمة، ويطبون لعالم الحلويات", "Wan 3.0"],
          ["٥", "تشيبي ← كرتون مجنون", "ضرب بالحلاوة، ويطيح على حصان", "Wan 3.0"],
          ["٦", "كرتون مجنون ← واقعي", "سيوف على الخيل، والأرض تنشق", "Seedance 2.0"],
          ["٧", "واقعي", "قتال كونغ فو، والسطر الأخير، ويمشي", "Seedance 2.0"],
        ],
      },
      tip: "اكتب القصة كجدول قبل أي توليد: كل سطر توليدة، وكل توليدة تبدأ بآخر لحظة من اللي قبلها.",
    },
    {
      title: "البطل في الستايلات الخمسة",
      body: [
        "نفس طريقة الجزء الأول: صورة وحدة واضحة لوجهك، تصنع منها شيت واقعي، وبعدها صورة لشخصيتك في كل ستايل (GPT Image 2، جودة متوسطة، صورتك هي المرجع الوحيد ومعها سطر STYLE).",
        "هذي الصور هي مراجع الوجه في كل توليدة فيديو، فخلها نظيفة: جسم كامل، خلفية فاضية، نفس اللبس.",
      ],
      images: [
        { src: img2("hero-real.webp"), alt: "الواقعي (شيت)", wide: true },
        { src: img2("hero-3d.webp"), alt: "ألعاب 3D" },
        { src: img2("hero-pixel.webp"), alt: "بكسل آرت" },
        { src: img2("hero-punk.webp"), alt: "البانك المقصوص" },
        { src: img2("hero-chibi.webp"), alt: "موي تشيبي" },
        { src: img2("hero-cartoon.webp"), alt: "الكرتون المجنون" },
      ],
      tip: "طريقة صنع صورة الشخصية خطوة بخطوة موجودة في الجزء الأول: «الشارة الذهبية».",
    },
    {
      title: "العصابة: شيت واقعي وبعدين كل ستايل",
      body: [
        "اكتب الأربعة بالكلام وبنفس الترتيب في كل مكان: الضخم الأصلع بجاكيت جلد، الطويل بهودي أحمر، المربوع اللي على خده جرح، والنحيف بكاب مقلوب. الوصف الثابت هو اللي يخليهم نفس الأشخاص في كل ستايل.",
        "أول شي شيت واقعي (صف أجسام وصف وجيه). بعدها تحوّل الشيت لكل ستايل: ترفع الشيت الواقعي + صورة البطل بالستايل (عشان يعرف كيف الستايل يرسم الناس)، وتبدّل سطر STYLE بس.",
      ],
      images: [
        { src: img2("gang-real.webp"), alt: "العصابة واقعي", wide: true },
        { src: img2("gang-3d.webp"), alt: "ألعاب 3D" },
        { src: img2("gang-pixel.webp"), alt: "بكسل آرت" },
        { src: img2("gang-punk.webp"), alt: "البانك المقصوص" },
        { src: img2("gang-chibi.webp"), alt: "موي تشيبي" },
        { src: img2("gang-cartoon.webp"), alt: "الكرتون المجنون" },
      ],
      prompts: [
        { label: "شيت العصابة الواقعي", tool: "GPT Image 2", settings: "جودة متوسطة · ١٦:٩", text: B2.gang_real },
        {
          label: "تحويل الشيت لستايل (مثال: بكسل آرت)",
          tool: "GPT Image 2",
          settings: "جودة متوسطة · ١٦:٩",
          refs: tagged(R2.gangReal, R2.heroPixel),
          note: "لكل ستايل: نفس البرومبت، بدّل سطر STYLE وصورة البطل الثانية بس.",
          text: B2.gang_conv,
        },
      ],
      tip: "إذا انقصت الرؤوس في الشيت، أضف في البرومبت: «the whole head visible and space above the heads».",
    },
    {
      title: "القاعدة اللي تخلي الانتقال سلس",
      body: [
        "الانتقال لستايل جديد ما يصير على القص — يصير داخل التوليدة نفسها، وسط حركة: قفزة، يد على الدركسون، كرسي طاير، سقوط. فترفع في نفس التوليدة مراجع الستايلين: البطل والعصابة بالستايل القديم، والبطل والعصابة بالستايل الجديد.",
        "في البرومبت قسّم الستايل بالثواني: «From 0 to 3.5s — STYLE: …  From 3.5s to the end — STYLE: …»، واكتب لحظة التحول نفسها في الوصف (موجة ضوء، بكسلات تنتشر، الورق يتمزق…).",
        "والقص سريع: لقطة كل نص ثانية لثانية، أغلبها لقطات قريبة وتفاصيل (رجل تدعس موية، يد تمسك، الشارة تلمع)، ولقطات واسعة قليلة جدًا.",
      ],
      tip: "رتّب المراجع بنفس ترتيب @img في البرومبت، وبعد ما ترفعها كبّر الشاشة وتأكد إن كل صورة في مكانها. إذا اختلف الترتيب، عدّل الأرقام في البرومبت.",
    },
    {
      title: "البداية الواقعية: ١أ و١ب",
      body: [
        "١أ واقعي بس: لا ترفع أي صورة كرتون، وإلا يخلط ويطلع 3D من البداية. مطاردة وركض وتفاصيل، وتخلص في قمة القفزة.",
        "١ب تكمل من آخر فريم في ١أ: في Artlist افتح الفيديو، واضغط Use ثم Extract Frame، واسحب للفريم الأخير، واختر Image Reference. لا تستخدم Start Frame، لأنه يقفل رفع المراجع وتتغير الوجيه.",
      ],
      prompts: [
        {
          label: "١أ: المطاردة الواقعية",
          tool: "Seedance 2.0",
          settings: "١٥ ث · 1080p · ١٦:٩",
          refs: tagged(R2.heroReal, R2.gangReal, R2.badge),
          text: B2.g1a,
        },
        {
          label: "١ب: التحول لألعاب 3D",
          tool: "Seedance 2.0",
          settings: "١٢ ث · 1080p · ١٦:٩",
          refs: tagged(R2.flip, R2.heroReal, R2.gangReal, R2.hero3d, R2.gang3d, R2.badge),
          text: B2.g1b,
        },
      ],
    },
    {
      title: "الستايلات الكرتونية: ٢ إلى ٥",
      body: [
        "كل توليدة فيها أربع صور: البطل والعصابة بالستايل الحالي، والبطل والعصابة بالستايل الجاي، والشارة. والمدة ١٠ ثواني.",
        "في المطاردة بالسيارات خلها مطاردة بس: كل السيارات نفس الاتجاه، والعصابة تقرّب من ورا، وما أحد يمد يده على الشارة من الشباك.",
      ],
      prompts: [
        { label: "٢: اللامبرغيني ← بكسل آرت", tool: "Wan 3.0", settings: "١٠ ث · 1080p · ١٦:٩", refs: tagged(R2.hero3d, R2.gang3d, R2.heroPixel, R2.gangPixel, R2.badge), text: B2.g2 },
        { label: "٣: مطاردة السيارات ← البانك المقصوص", tool: "Wan 3.0", settings: "١٠ ث · 1080p · ١٦:٩", refs: tagged(R2.heroPixel, R2.gangPixel, R2.heroPunk, R2.gangPunk, R2.badge), text: B2.g3 },
        { label: "٤: الغيمة ← موي تشيبي", tool: "Wan 3.0", settings: "١٠ ث · 1080p · ١٦:٩", refs: tagged(R2.heroPunk, R2.gangPunk, R2.heroChibi, R2.gangChibi, R2.badge), text: B2.g4 },
        { label: "٥: الحلويات ← الكرتون المجنون", tool: "Wan 3.0", settings: "١٠ ث · 1080p · ١٦:٩", refs: tagged(R2.heroChibi, R2.gangChibi, R2.heroCartoon, R2.gangCartoon, R2.badge), text: B2.g5 },
      ],
    },
    {
      title: "الرجوع للواقع والنهاية: ٦ و٧",
      body: [
        "٦ قتال سيوف وهم على الخيل: واحد يجي يمينه وواحد يساره، ويصير قتال حقيقي وهم يركضون — مب بس ركوب. بعدين تنشق الأرض، ووهم طايحين يرجع كل شي واقعي في نفس الزقاق الأول.",
        "٧ النهاية: قتال كونغ فو واحد واحد، والسطر الأخير، ويمشي للغروب.",
      ],
      prompts: [
        { label: "٦: السيوف على الخيل ← واقعي", tool: "Seedance 2.0", settings: "١٥ ث · 1080p · ١٦:٩", refs: tagged(R2.heroCartoon, R2.gangCartoon, R2.heroReal, R2.gangReal, R2.badge), text: B2.g6 },
        { label: "٧: القتال الأخير", tool: "Seedance 2.0", settings: "١٥ ث · 1080p · ١٦:٩", refs: tagged(R2.heroReal, R2.gangReal, R2.badge), text: B2.g7 },
      ],
    },
    {
      title: "المونتاج والنسخة الطولية",
      body: [
        "في حيدرة كت حط التوليدات بالترتيب من ١أ إلى ٧، وقص بداية ونهاية كل وحدة عند لحظة الحركة نفسها. الانتقالات جاهزة داخل التوليدات، فما يحتاج مؤثرات انتقال.",
        "فوق الفيلم: نص الهوك في أول ثواني («فيلم سينمائي كامل · صنعناه بالذكاء الاصطناعي»)، واسم كل ستايل ومولّده لما يتغير، وترجمة عربية للسطرين، وخاتمة «اكتب جواد».",
        "للريلز (٩:١٦): الفيلم بعرضه الكامل في النص بدون قص، وخلفية ألوانها تتغير مع كل ستايل، واسم الستايل فوق، وشريط تقدّم الستايلات تحت.",
      ],
    },
  ],
  fixes: [
    { problem: "طلع 3D من أول ثانية بدل الواقعي", fix: "في التوليدة الواقعية لا ترفع إلا المراجع الواقعية. مراجع الستايل الجديد بس في توليدة الانتقال." },
    { problem: "الوجيه تغيّرت بعد الانتقال", fix: "ارفع شيت البطل الواقعي وشيت العصابة في نفس التوليدة، واكتب: the 3D hero is the man of @img2… they never change." },
    { problem: "Start Frame قفل رفع المراجع", fix: "استخدم Extract Frame ← Image Reference بدله، واكتب في البرومبت: The video begins exactly on @img1." },
    { problem: "السيارات تمشي عكس بعض", fix: "اكتب صريح: all cars drive in the same direction، وخل الاتجاه من اليمين لليسار في كل الفيلم." },
    { problem: "قتال السيوف طلع ركوب بس", fix: "قسّمه بالثواني: واحد يجي يمينه، واحد يساره، ضربة، صد… واكتب Real sword fighting at full gallop, not just riding." },
    { problem: "الفيلم بطيء وما فيه إثارة", fix: "أضف سطر Editing: hard cut every 0.5–1 s، mostly inserts and close-ups، وحوّل اللقطات الواسعة لتفاصيل قريبة." },
  ],
  faq: [
    { q: "ليش ثمان توليدات وما سويناه بتوليدة وحدة؟", a: "كل توليدة فيها انتقال واحد بين ستايلين. لو حطيت ستايلات أكثر في توليدة وحدة يخلط بينها والوجيه تضيع." },
    { q: "أقدر أرسلهم كلهم مرة وحدة؟", a: "إيه، كلها بنفس الوقت، إلا ١ب لأنها تحتاج آخر فريم من ١أ." },
    { q: "ليش Seedance في بعض الكرتون؟", a: "التوليدات اللي فيها رجوع للواقعي (٦) أو قتال طويل تطلع أقوى في Seedance. والكرتون الصافي Wan أرخص وممتاز." },
    { q: "أقدر أغيّر الستايلات؟", a: "إيه. بدّل سطر STYLE وصور البطل والعصابة بالستايل الجديد، وخل باقي البرومبت زي ما هو." },
    { q: "وين أسويها؟", a: "كلها داخل منصة الجواد: الصور والفيديو في الاستوديو الإبداعي، والمونتاج في حيدرة كت." },
  ],
};


// ───────── «من كلاود إلى الجواد»: Claude talks the idea through, then works the Creative Studio itself in the browser ─────────
const M3 = `${CREATIVE_BASE}/claude-carpet`;
const img3 = (f: string) => `${M3}/${f}`;
const SHEET_USE: PromptUse = { generatorId: "openai-gpt-image-2", settings: { aspect: "16:9", resolution: "hi", quality: "high" }, styleId: "football-drift" };
const CARPET_SHEETS = [
  { tag: "@image1", name: "شيت الشخصية", src: img3("sheet-character.webp") },
  { tag: "@image2", name: "شيت المكان", src: img3("sheet-place.webp") },
  { tag: "@image3", name: "شيت الزولية", src: img3("sheet-carpet.webp") },
];

const CLAUDE_CARPET: CreativeMethod = {
  slug: "claude-carpet",
  title: "خل كلاود يسوي لك الصور والفيديو بنفسه",
  kicker: "من كلاود إلى الجواد",
  summary:
    "تسولف مع كلاود عن فكرتك، يطوّر القصة ويختار الستايل ويكتب البرومبتات، وبعدها تعطيه رابط الجواد فيدخل الاستوديو الإبداعي من المتصفح ويسوي الشيتات والفيديو ويحمّلها لك. المثال: ولد متعلق بغصن على جبل، الغصن ينكسر، وتلقفه زولية سحرية وتطير فيه. هنا السير كامل وكل برومبت حرفيًا.",
  cover: img3("cover.webp"),
  film: { src: img3("film.mp4"), poster: img3("film-poster.webp") },
  facts: [
    { k: "المساعد", v: "Claude في المتصفح (أو ChatGPT)" },
    { k: "الستايل", v: "كورة بيكسار حديث" },
    { k: "الشيتات", v: "GPT Image 2 · ٣ برومبتات بتوليدة وحدة" },
    { k: "الفيديو", v: "Wan 3.0 · ٢٠ ث · 480p · 9:16" },
    { k: "المراجع", v: "الشيتات الثلاث @image1 إلى @image3" },
    { k: "المكان", v: "الاستوديو الإبداعي بس" },
  ],
  steps: [
    {
      title: "افتح كلاود وسولف معاه عن فكرتك",
      body: [
        "افتح Claude (أو ChatGPT) من المتصفح في جهازك، واكتب له فكرتك بكلامك العادي. إحنا قلنا له: «أبي طفل متعلق بجذع شجرة على منحدر جبل كبير، والغصن على وشك الانكسار ووجهه خايف، فينكسر الغصن ويطيح، وهو يطيح تمر عليه زولية سحرية فيطيح عليها في الهوا وتطير فيه ويفرح».",
        "وطلبنا منه بنفس الرسالة: شيت للشخصية بثلاث أقسام (الملابس، والولد من قدام ميديم كلوز، والولد من ورا)، وشيت للمكان بدون شخصيات، وشيت للزولية، وبعدها فيديو واحد ٢٠ ثانية بـ Wan 3.0.",
      ],
      table: {
        head: ["الثواني", "اللي يصير"],
        rows: [
          ["٠–٦", "التعلّق والخوف: الغصن يطقطق والشق يكبر"],
          ["٦–٩", "الغصن ينكسر والولد يطيح ويصرخ"],
          ["٩–١٣", "الزولية تنقضّ من الغروب وتلقفه في الهوا"],
          ["١٣–٢٠", "تطير فيه بعيد عن الجبل، يرتخي ويضحك"],
        ],
      },
      tip: "خل كلاود يطوّر القصة ويقسّمها على الثواني قبل أي توليد. القصة الواضحة تطلع برومبتات واضحة.",
    },
    {
      title: "عطه رابط الجواد وخله يدخل بنفسه",
      body: [
        "عطه الرابط aljawadai.app/jawad-ai/images وقل له: «ادخل الاستوديو الإبداعي وسوّها لي». كلاود يفتح المتصفح، ويختار المولّد والإعدادات، ويكتب البرومبت، ويضغط توليد، وينزّل الملفات على جهازك.",
        "انتبه: كل الشغل داخل «الاستوديو الإبداعي» بس، مو في أقسام ثانية.",
      ],
      tip: "أول مرة كروم بيسألك يسمح بتنزيل أكثر من ملف من الموقع: وافق، وإلا بينزل ملف واحد بس.",
    },
    {
      title: "الستايل: كورة بيكسار حديث",
      body: [
        "جرّبنا ستايلين من «خريطة الستايلات» في الاستوديو: «بيكسار الطبيعية» و«كورة بيكسار حديث»، واعتمدنا الثاني لأن ألوانه أقوى وتعابيره أوضح.",
        "نفس الستايل يتحط مع الشيتات ومع الفيديو، عشان الشخصية والمكان والزولية يطلعون بنفس الشكل.",
      ],
    },
    {
      title: "الشيتات الثلاث في توليدة وحدة",
      body: [
        "GPT Image 2، نسبة ١٦:٩، دقة عالية، جودة عالية، والستايل «كورة بيكسار حديث». حطينا البرومبتات الثلاث مع بعض بزر «أضف برومبت ثاني» و«أضف برومبت ثالث»، فطلعت الشيتات الثلاث بتوليدة وحدة.",
      ],
      images: [
        { src: img3("sheet-character.webp"), alt: "شيت الشخصية: الملابس، من قدام، من ورا", wide: true },
        { src: img3("sheet-place.webp"), alt: "شيت المكان بدون شخصيات", wide: true },
        { src: img3("sheet-carpet.webp"), alt: "شيت الزولية", wide: true },
      ],
      prompts: [
        { label: "شيت الشخصية", tool: "GPT Image 2", settings: "١٦:٩ · دقة عالية · جودة عالية", use: SHEET_USE, text: "Character sheet in three panels side by side on a clean warm off-white background, one consistent character design. The character: a slim 8-9-year-old boy with warm wheat-tan skin, big brown eyes and short black hair, wearing a light green t-shirt with a small simple graphic on the chest, light blue jeans and grey sneakers. Panel 1 (left): the outfit alone, laid out neatly with no person - the light green t-shirt, the light blue jeans and the grey sneakers. Panel 2 (middle): the boy from the front, medium close-up from the chest up, wearing the outfit, calm natural expression, looking at the camera. Panel 3 (right): the boy full body seen from behind, same hair and outfit. Soft even studio light, the same proportions in every panel. No text, no labels, no logos." },
        { label: "شيت المكان", tool: "GPT Image 2", settings: "١٦:٩ · دقة عالية · جودة عالية", use: SHEET_USE, text: "Environment design sheet with NO people, NO characters and NO animals anywhere. A towering rocky mountain cliff with scattered green shrubs at golden sunset. From a crack in the rock grows a small twisted tree whose one long branch stretches out over a deep drop. Far below lies a green valley with a winding river glinting with the sunset light, thin clouds drifting at mid height. Three panels: a wide establishing shot of the whole cliff, the tree and the valley; a medium shot of the twisted tree and its branch reaching over the void; the view looking straight down from the branch to the valley and the shining river. Warm golden light, cinematic depth and atmosphere, the same place in every panel. No text, no labels." },
        { label: "شيت الزولية", tool: "GPT Image 2", settings: "١٦:٩ · دقة عالية · جودة عالية", use: SHEET_USE, text: "Prop design sheet of a magic flying carpet, with NO people and NO characters. A medium-size traditional red carpet, big enough for a child to sit and lie on, covered in ornate eastern patterns whose lines carry a soft golden glow, with golden tassels along both short ends. Four views on a clean warm off-white background: the top view laid flat showing the full pattern; a three-quarter view floating in the air with a gentle wave rippling through the fabric; a low side view showing its thickness and the swinging tassels; a flying view with the edges curling slightly and a soft golden light trail behind it. The same carpet in every view. No text, no labels." },
      ],
    },
    {
      title: "الفيديو: ٢٠ ثانية بـ Wan 3.0",
      body: [
        "اختار «فيديو» ثم Wan 3.0 بوضع «مراجع متعددة»، وأضف الشيتات الثلاث بالترتيب: @image1 الشخصية، @image2 المكان، @image3 الزولية. الإعدادات: ٢٠ ثانية، 480p، ٩:١٦، والصوت المتزامن شغّال.",
        "البرومبت مكتوب بطريقة المخرج: كل قطع يغيّر حجم اللقطة وحركة الكاميرا، وفيه انسرتات قصيرة (الأصابع تزلق، شق الغصن، العيون، الشراشيب). نسخة إنجليزية ونسخة صينية بنفس المعنى في برومبت واحد.",
      ],
      prompts: [
        {
          label: "الفيديو",
          tool: "Wan 3.0",
          settings: "٢٠ ث · 480p · 9:16 · صوت متزامن",
          refs: CARPET_SHEETS,
          use: { generatorId: "wan-3-0", settings: { ratio: "9:16", resolution: "480p", duration: 20, audio: true }, styleId: "football-drift", refStyle: "references" },
          note: "أول نسخة كانت لقطة وحدة طويلة وما عجبتنا. هذي النسخة المعتمدة: كلوزات وانسرتات أكثر.",
          text: "[{\"lang\": \"en\", \"prompt\": \"@image1 = the figure in the light green t-shirt (face, spiky black hair, green t-shirt with the mountain-and-sun graphic, light blue jeans, grey sneakers). @image2 = the cliff, the twisted tree and the valley. @image3 = the red magic carpet with golden tassels. Style & Mood: modern stylized 3D animation matching the references, slightly anime-influenced proportions, bold saturated colour. Golden-hour backlight, amber sun low on the horizon, orange rim light on rock, hair and shoulders, warm haze over the valley. 24mm wide for the drop, 85mm for faces. Tension, then a fast release, then open joy. Dynamic Description: handheld close-up, the figure from @image1 hangs from the long twisted branch of @image2, jaw clenched, nostrils flaring, chest heaving, legs swinging over the drop. Insert, static extreme close-up of the figure's fingers slipping on the bark, knuckles pale. Insert, handheld close-up of the branch where it meets the trunk: the bark splits, splinters lifting. Cut to a low-angle wide crane rising slowly: the figure small against the sheer cliff, the branch dipping, the sun behind. Insert, static extreme close-up of the figure's eyes widening, locked on the split. The branch snaps. Hard cut to a stabilized vertical tracking medium shot falling with the figure: hair and t-shirt whipping upward, arms flailing, speed ramp into the drop. Insert, handheld close-up of the figure's grey sneakers kicking at empty air, the river far below. Cut to an aerial extreme wide: the red carpet of @image3 streaks in from the sunset side of the sky, a golden light trail behind it, diving under the falling figure. Insert, handheld close-up of the carpet's golden tassels whipping as it banks. Cut to a stabilized orbit, medium close-up: the figure lands on their back on the carpet, the fabric sags and its edges curl up around them like a hug. Insert, static extreme close-up of the figure's hands gripping the carpet's edge, trembling. Cut to a handheld close-up of the figure's face: eyes wide, breath shaking, then the corners of the mouth lift and they burst out laughing, head tipping back. Final aerial pull-back, extreme wide: the carpet climbs away from the cliff over the green valley toward the low sun, golden trail behind it, the figure sitting up with both arms raised. Static Description: sheer cliff of orange-brown rock with green shrubs; a small gnarled tree with one long branch over the void; far below a green valley with a river shining gold; soft clouds under the cliff line. No text on screen. Audio: no words, no music. Branch creaking, bark cracking, fast breathing, a sharp snap, one scream over rising wind, a soft thump on the catch, tassels fluttering, then loud happy laughter.\"}, {\"lang\": \"zh\", \"prompt\": \"@image1\u4e3a\u8eab\u7a7f\u6d45\u7effT\u6064\u7684\u8eab\u5f71\uff08\u9762\u5bb9\u3001\u84ec\u4e71\u9ed1\u53d1\u3001\u5370\u5c71\u5ce6\u592a\u9633\u56fe\u6848\u7684\u7effT\u6064\u3001\u6d45\u84dd\u725b\u4ed4\u88e4\u3001\u7070\u8272\u8fd0\u52a8\u978b\uff09\u3002@image2\u4e3a\u60ac\u5d16\u3001\u626d\u66f2\u5c0f\u6811\u4e0e\u5c71\u8c37\u3002@image3\u4e3a\u91d1\u8272\u6d41\u82cf\u7684\u7ea2\u8272\u9b54\u6bef\u3002\u98ce\u683c\u4e0e\u6c1b\u56f4\uff1a\u4e0e\u53c2\u8003\u56fe\u4e00\u81f4\u7684\u73b0\u4ee3\u98ce\u683c\u5316\u4e09\u7ef4\u52a8\u753b\uff0c\u7565\u5e26\u65e5\u6f2b\u6bd4\u4f8b\uff0c\u8272\u5f69\u9971\u6ee1\u6d53\u70c8\u3002\u9ec4\u91d1\u65f6\u523b\u9006\u5149\uff0c\u7425\u73c0\u8272\u5915\u9633\u4f4e\u5782\uff0c\u6a59\u8272\u8f6e\u5ed3\u5149\u52fe\u52d2\u5ca9\u9762\u3001\u53d1\u68a2\u4e0e\u80a9\u5934\uff0c\u5c71\u8c37\u6696\u8272\u8584\u972d\u300224mm\u5e7f\u89d2\u62cd\u6df1\u6e0a\uff0c85mm\u62cd\u9762\u90e8\u3002\u5148\u7d27\u7ef7\uff0c\u518d\u6025\u5760\u91ca\u653e\uff0c\u7ec8\u81f3\u5f00\u9614\u559c\u60a6\u3002\u52a8\u6001\u63cf\u8ff0\uff1a\u624b\u6301\u7279\u5199\uff0c@image1\u4e2d\u7684\u8eab\u5f71\u60ac\u6302\u5728@image2\u90a3\u6839\u626d\u66f2\u957f\u679d\u4e0a\uff0c\u4e0b\u988c\u54ac\u7d27\uff0c\u9f3b\u7ffc\u7fd5\u5f20\uff0c\u80f8\u53e3\u5267\u70c8\u8d77\u4f0f\uff0c\u53cc\u817f\u5728\u6df1\u6e0a\u4e0a\u65b9\u6643\u8361\u3002\u63d2\u5165\u56fa\u5b9a\u6781\u7279\u5199\uff1a\u8eab\u5f71\u624b\u6307\u5728\u6811\u76ae\u4e0a\u6253\u6ed1\uff0c\u6307\u8282\u53d1\u767d\u3002\u63d2\u5165\u624b\u6301\u7279\u5199\uff1a\u6811\u679d\u4e0e\u6811\u5e72\u8fde\u63a5\u5904\u6811\u76ae\u5d29\u88c2\uff0c\u6728\u5c51\u7fd8\u8d77\u3002\u5207\u81f3\u4f4e\u89d2\u5ea6\u5e7f\u89d2\u6447\u81c2\u7f13\u5347\uff1a\u8eab\u5f71\u5728\u9661\u5ced\u5d16\u58c1\u524d\u663e\u5f97\u6e3a\u5c0f\uff0c\u6811\u679d\u4e0b\u6c89\uff0c\u5915\u9633\u5728\u540e\u3002\u63d2\u5165\u56fa\u5b9a\u6781\u7279\u5199\uff1a\u8eab\u5f71\u53cc\u773c\u9aa4\u7136\u7741\u5927\uff0c\u6b7b\u76ef\u88c2\u53e3\u3002\u6811\u679d\u65ad\u88c2\u3002\u786c\u5207\u81f3\u7a33\u5b9a\u5782\u76f4\u8ddf\u62cd\u4e2d\u666f\uff0c\u968f\u8eab\u5f71\u4e00\u540c\u4e0b\u5760\uff1a\u5934\u53d1\u4e0eT\u6064\u88ab\u98ce\u6380\u8d77\uff0c\u56db\u80a2\u4e71\u821e\uff0c\u53d8\u901f\u51b2\u5165\u5760\u843d\u3002\u63d2\u5165\u624b\u6301\u7279\u5199\uff1a\u8eab\u5f71\u7684\u7070\u8272\u8fd0\u52a8\u978b\u5728\u7a7a\u4e2d\u4e71\u8e6c\uff0c\u6cb3\u6d41\u8fdc\u5728\u4e0b\u65b9\u3002\u5207\u81f3\u822a\u62cd\u6781\u8fdc\u666f\uff1a@image3\u7684\u7ea2\u8272\u9b54\u6bef\u4ece\u843d\u65e5\u4e00\u4fa7\u75be\u63a0\u800c\u6765\uff0c\u62d6\u51fa\u91d1\u8272\u5149\u8ff9\uff0c\u4fef\u51b2\u81f3\u4e0b\u5760\u8eab\u5f71\u4e0b\u65b9\u3002\u63d2\u5165\u624b\u6301\u7279\u5199\uff1a\u9b54\u6bef\u4fa7\u8f6c\u65f6\u91d1\u8272\u6d41\u82cf\u731b\u70c8\u7529\u52a8\u3002\u5207\u81f3\u7a33\u5b9a\u73af\u7ed5\u4e2d\u8fd1\u666f\uff1a\u8eab\u5f71\u4ef0\u9762\u843d\u5728\u6bef\u4e0a\uff0c\u6bef\u9762\u4e0b\u9677\uff0c\u56db\u8fb9\u5377\u8d77\u5982\u62e5\u62b1\u822c\u5c06\u5176\u5305\u4f4f\u3002\u63d2\u5165\u56fa\u5b9a\u6781\u7279\u5199\uff1a\u8eab\u5f71\u53cc\u624b\u7d27\u6293\u6bef\u8fb9\uff0c\u5fae\u5fae\u53d1\u6296\u3002\u5207\u81f3\u624b\u6301\u7279\u5199\u8eab\u5f71\u9762\u90e8\uff1a\u53cc\u773c\u5706\u7741\uff0c\u547c\u5438\u98a4\u6296\uff0c\u968f\u540e\u5634\u89d2\u4e0a\u626c\uff0c\u4ef0\u5934\u653e\u58f0\u5927\u7b11\u3002\u6700\u540e\u822a\u62cd\u540e\u62c9\u6781\u8fdc\u666f\uff1a\u9b54\u6bef\u79bb\u5f00\u60ac\u5d16\uff0c\u8d8a\u8fc7\u7eff\u8272\u5c71\u8c37\u98de\u5411\u4f4e\u5782\u5915\u9633\uff0c\u8eab\u540e\u91d1\u8272\u5149\u8ff9\uff0c\u8eab\u5f71\u5750\u8d77\u9ad8\u4e3e\u53cc\u81c2\u3002\u9759\u6001\u63cf\u8ff0\uff1a\u6a59\u8910\u8272\u9661\u5ced\u60ac\u5d16\uff0c\u77f3\u7f1d\u751f\u51fa\u704c\u6728\uff1b\u866c\u66f2\u5c0f\u6811\uff0c\u552f\u4e00\u957f\u679d\u4f38\u5411\u865a\u7a7a\uff1b\u4e0b\u65b9\u7eff\u8272\u5c71\u8c37\uff0c\u6cb3\u6d41\u6cdb\u7740\u91d1\u5149\uff1b\u5d16\u7ebf\u4e0b\u67d4\u4e91\u98d8\u6d6e\u3002\u753b\u9762\u65e0\u6587\u5b57\u3002\u97f3\u6548\uff1a\u65e0\u53f0\u8bcd\u65e0\u97f3\u4e50\u3002\u6811\u679d\u5431\u560e\uff0c\u6811\u76ae\u5f00\u88c2\uff0c\u6025\u4fc3\u5598\u606f\uff0c\u4e00\u58f0\u8106\u54cd\uff0c\u4e00\u58f0\u5c16\u53eb\u76d6\u8fc7\u6e10\u5f3a\u98ce\u58f0\uff0c\u63a5\u4f4f\u65f6\u4e00\u58f0\u95f7\u54cd\uff0c\u6d41\u82cf\u7ffb\u52a8\uff0c\u968f\u540e\u54cd\u4eae\u5f00\u6000\u7684\u7b11\u58f0\u3002\"}]",
        },
      ],
    },
  ],
  fixes: [
    { problem: "«المخرج الخارق» كتب برومبت لخمس ثواني بس", fix: "يكتب على المدة المضبوطة في الفورم، فاضبط ٢٠ ثانية قبل ما تضغطه." },
    { problem: "زر التوليد وقف بعد «المخرج الخارق»", fix: "البرومبت تعدّى ٤٠٠٠ حرف (حد Wan 3.0). قصّره لين ينزل تحت الحد." },
    { problem: "الفيديو طلع لقطة وحدة طويلة ومملة", fix: "اكتب البرومبت لقطات: كل قطع يغيّر حجم اللقطة وحركة الكاميرا، وحط انسرتات قصيرة بين اللقطات." },
    { problem: "Wan 3.0 رجّع خطأ عند الإرسال", fix: "صار معنا مرة وحدة، وأعدنا المحاولة واشتغل." },
    { problem: "كلاود دخل قسم ثاني غير الاستوديو", fix: "قل له بوضوح: الاستوديو الإبداعي بس (aljawadai.app/jawad-ai/images)، ولا يروح مكان ثاني." },
  ],
  faq: [
    { q: "لازم يكون كلاود؟", a: "لا، أي مساعد يقدر يفتح المتصفح ويستخدمه (مثل ChatGPT) يمشي على نفس الطريقة." },
    { q: "أقدر أسوي نفس الشي بشخصيتي أنا؟", a: "إيه. اضغط «جرّبه في الاستوديو» تحت أي برومبت، ينفتح الاستوديو بنفس البرومبت والمولّد والإعدادات، وتضيف صورك أنت مراجع وتولّد." },
    { q: "ليش ٤٨٠p؟", a: "عشان التجربة أسرع وأرخص. إذا عجبك الناتج ولّده مرة ثانية بدقة أعلى." },
  ],
};

export const CREATIVE_METHODS: CreativeMethod[] = [CLAUDE_CARPET, GOLDEN_BADGE_2, GOLDEN_BADGE];

export const creativeMethod = (slug: string) => CREATIVE_METHODS.find((m) => m.slug === slug) ?? null;
