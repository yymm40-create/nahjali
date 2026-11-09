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
};

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
  film: { src: string; poster: string };
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

export const CREATIVE_METHODS: CreativeMethod[] = [GOLDEN_BADGE];

export const creativeMethod = (slug: string) => CREATIVE_METHODS.find((m) => m.slug === slug) ?? null;
