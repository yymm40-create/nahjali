export const CARTOON_IMAGE = "openai-gpt-image-2";
export const CARTOON_VIDEO = "byteplus-seedance-2-0";
export const CARTOON_PRICE = 200;
/**
 * The looks «حوّلني إلى الستايل الكرتوني» offers. Each one is a WHOLE look — line, shading, texture, palette, lighting
 * and material — named with the markers a generator can actually reproduce, not a one-word label. They are deliberately
 * far apart from each other (a flat line look next to a painted 3D one next to stop-motion clay), so the person feels
 * they are choosing a world, not a filter.
 *
 * `real` is the look's LEVEL OF STYLISATION, and it is written into the prompt because the uncanny valley comes from
 * MIXING levels — big cartoon eyes on an almost-real face — not from being cartoon. EEG work on six stylisation levels
 * found the trough in the middle and the ease at the two ends (ncbi.nlm.nih.gov/pmc/articles/PMC5362933), and the ACM
 * Interactions review of character design says people accept an unrealistic character easily as long as it is
 * CONSISTENTLY unrealistic. So each look declares one level and holds it across the face, body and world.
 *
 * `fits` is who the look reads best for (the person's own choice always wins): "child", "all" or "grown".
 */
export const CARTOON_STYLES = [
  {
    id: "cinematic-3d",
    group: "world",
    name: "سينمائي 3D",
    icon: "🎬",
    hint: "فيلم كرتون عالمي، نعومة وإضاءة سينمائية",
    fits: "all",
    real: "stylised 3D: shapes simplified well away from a real face, held at that level everywhere",
    text: "Feature-film 3D animation: sculpted stylised forms with clean topology, slightly simplified anatomy, soft subsurface skin with visible pore-free but not plastic surface, cinematic three-point lighting with a warm key and a cool rim, shallow depth of field, physically-based materials (cloth weave, hair clumps in groomed strands), gentle ambient occlusion in the creases.",
  },
  {
    id: "anime",
    group: "anime",
    name: "أنمي معتدل",
    icon: "🌸",
    hint: "أنمي هادئ يحافظ على ملامحك الحقيقية",
    fits: "all",
    real: "moderate anime: a drawn face, never a photo-real one, with eye size kept under control",
    text: "Moderate anime cel work: clean confident ink line of varying weight, two-tone cel shading with a hard shadow edge, restrained highlight on the hair in a single soft band, eyes drawn in anime grammar but at a MODERATE size with the real eye shape and spacing kept, the real nose bridge, jawline, brow shape and skin tone kept rather than replaced by a generic anime face, simple painted background with soft gradients.",
  },
  {
    id: "painted-3d",
    group: "world",
    name: "ثلاثي مرسوم باليد",
    icon: "🖌️",
    hint: "ثلاثي الأبعاد بملمس لوحة مرسومة — أسلوب ٢٠٢٦",
    fits: "all",
    real: "painterly stylised: a drawn surface over solid form, the same everywhere",
    text: "Hand-painted textures over 3D form (the Arcane / Fortiche look): visible brush strokes baked into skin, cloth and hair, painterly edges that break up the silhouette, graphic shadow shapes rather than soft falloff, rich saturated keylight with coloured bounce, a touch of canvas grain over everything, the form solid and three-dimensional but every surface reading as painted by hand.",
  },
  {
    id: "soft-2d",
    group: "kids",
    name: "كرتون 2D ناعم",
    icon: "🎨",
    hint: "خط نظيف وألوان مسطّحة — كرتون القنوات",
    fits: "child",
    real: "flat 2D: drawn shapes and flat colour, far from photographic",
    text: "Modern 2D television animation: a clean even contour line, flat colour fills with one soft cel shadow, simple rounded shape language, a clear readable silhouette, minimal interior detail, bright flat background shapes, no gradients on the character beyond a single soft shade.",
  },
  {
    id: "storybook",
    group: "kids",
    name: "قصة مصوّرة",
    icon: "📖",
    hint: "غواش وألوان مائية مثل كتب الأطفال",
    fits: "child",
    real: "illustrated: painted and drawn, never photographic",
    text: "Children's picture-book illustration: gouache and watercolour on textured paper, visible paper tooth and granulation, soft pencil contour that wanders a little, warm limited palette of six or seven colours, hand-painted washes with bloom edges, gentle diffuse light with no hard shadows, white paper breathing around the figure.",
  },
  {
    id: "ghibli",
    group: "anime",
    name: "الدفء المرسوم",
    icon: "🌿",
    hint: "خلفيات مرسومة ووجوه لطيفة وضوء طبيعي",
    fits: "all",
    real: "hand-drawn film: a drawn face on a painted world, consistently so",
    text: "Hand-drawn feature animation in the warm Japanese tradition: a fine understated line, gentle simplified features with small soft eyes and a tiny nose, mild blush on the cheeks, lovingly painted background with layered foliage and real atmospheric depth, natural daylight with soft shadow edges, nostalgic muted-but-luminous palette, clouds and wind given weight.",
  },
  {
    id: "print-comic",
    group: "art",
    name: "كوميكس مطبوع",
    icon: "💥",
    hint: "نقاط هاف‌تون وطباعة مزاحة — أسلوب سبايدر-فيرس",
    fits: "grown",
    real: "graphic print: ink and dots, nothing photographic",
    text: "Printed comic-book art brought to life (the Spider-Verse language): bold varied ink line with heavy spotted blacks, ben-day halftone dots in the midtones, slight CMYK misregistration with chromatic offset on the edges, limited high-contrast palette, cross-hatching for shadow, paper-print grain, graphic speed lines and a hard rim light.",
  },
  {
    id: "clay",
    group: "kids",
    name: "صلصال",
    icon: "🧸",
    hint: "ستوب موشن بملمس يد وبصمات أصابع",
    fits: "child",
    real: "stop-motion object: a sculpted physical thing, consistently so",
    text: "Stop-motion clay puppet photographed on a real set: plasticine surface with faint fingerprints and tool marks, slightly uneven hand-sculpted forms, matte soft-scattering material, visible seams where parts meet, practical studio lighting with real soft shadows falling on a tangible miniature set, shallow macro depth of field.",
  },
  {
    id: "papercut",
    group: "kids",
    name: "ورق مقصوص",
    icon: "✂️",
    hint: "طبقات ورق ملوّن وظلال خفيفة",
    fits: "child",
    real: "paper collage: cut shapes and layers, nothing photographic",
    text: "Cut-paper collage animation: every element a separate piece of coloured textured paper with a clean scissor edge and a tiny drop shadow onto the layer beneath, visible paper fibre and slight curl at the corners, simple geometric shape language, flat bright colours with torn-edge accents, even front lighting.",
  },
  {
    id: "ligne-claire",
    group: "art",
    name: "الخط الصافي",
    icon: "🖋️",
    hint: "خط واحد ثابت وألوان مسطّحة بلا تدرّج — مدرسة تان‌تان",
    fits: "grown",
    real: "clear-line drawing: pure line and flat colour",
    text: "Ligne claire (the Franco-Belgian clear line): one uniform-weight black contour on every form with no line variation, completely flat colour fills with NO gradients and no cast shadows, equal clarity in foreground and background, calm clean composition, a precise architectural background drawn with the same line, mid-saturation European palette.",
  },
  {
    id: "webtoon",
    group: "anime",
    name: "ويبتون",
    icon: "📱",
    hint: "رسم رقمي نظيف وألوان ناعمة — مدرسة الويبتون",
    fits: "grown",
    real: "clean digital drawing: drawn features with soft airbrushed rendering",
    text: "Korean webtoon digital illustration: crisp thin line art, smooth airbrushed soft shading with a glossy highlight on hair and lips, slender elongated proportions, delicate features with detailed irises, pastel-leaning palette with one saturated accent, soft bloom and a simple blurred gradient background.",
  },
  {
    id: "rubber-hose",
    group: "art",
    name: "كلاسيكي مطاطي",
    icon: "🎩",
    hint: "كرتون الثلاثينات: أطراف مطاطية وملمس فيلم قديم",
    fits: "all",
    real: "vintage cartoon: rubbery drawn forms, far from real",
    text: "1930s rubber-hose animation: boneless curving limbs with no elbows or knees, pie-cut eyes and round white gloves, bouncy circular construction, thick inked outlines, cream-and-sepia or two-tone palette, aged film grain, slight frame jitter and vignette, hand-painted background with simple repeating shapes.",
  },
  {
    id: "game-2-5d",
    group: "games",
    name: "لعبة 2.5D",
    icon: "🎮",
    hint: "عالم لعبة بطبقات عمق: شخصية مسطّحة على ديوراما ثلاثي الأبعاد",
    fits: "all",
    real: "2.5D game art: flat-feeling characters on a layered 3D diorama, the same everywhere",
    text: "2.5D video-game art (the HD-2D / side-scroller diorama look): the character drawn as a crisp stylised sprite-like figure with a clean outline and a few flat shading steps, standing on a layered miniature 3D stage built of separate depth planes — foreground leaves out of focus, a mid-ground platform with modelled ground and props, a far painted backdrop — with tilt-shift depth of field, rich bloom and glowing particles, warm volumetric light shafts and a saturated game-engine colour grade.",
  },
  {
    id: "pixel",
    group: "games",
    name: "بكسل ريترو",
    icon: "👾",
    hint: "ألعاب الـ١٦ بت: مربعات كبيرة وألوان محدودة",
    fits: "all",
    real: "pixel art: every shape built from visible square pixels, nothing smooth or photographic",
    text: "16-bit pixel art: the whole picture built from large visible square pixels with no anti-aliasing, a limited palette of about sixteen colours with dithered shading, one-pixel dark outlines, simple chunky face features of only a few pixels, a tiled retro game background with layered parallax scenery, crisp edges everywhere and not a single smooth gradient.",
  },
  {
    id: "voxel",
    group: "games",
    name: "عالم مكعبات",
    icon: "🧱",
    hint: "كل شي من مكعبات صغيرة مثل ألعاب البناء",
    fits: "child",
    real: "voxel blocks: the character and the world made of small cubes, consistently so",
    text: "Voxel block world: the character and everything around them built from small cubes of flat colour, a blocky face made of a few cubes with the features kept recognisable, stepped silhouettes, soft ambient occlusion where cubes meet, clean toy-like lighting with a gentle sun shadow, bright cheerful palette, a diorama of cube trees, water and clouds, shallow tilt-shift focus.",
  },
  {
    id: "anime-action",
    group: "anime",
    name: "أنمي أكشن",
    icon: "⚡",
    hint: "حدود حبر قوية وظلال حادة وإضاءة درامية",
    fits: "grown",
    real: "action anime: drawn cel characters over painted depth, held consistently",
    text: "Modern action anime (the shonen-film look): crisp ink outlines of varying weight, hard-edged cel shadow shapes, dynamic low-angle framing with wind-swept hair and cloth, volumetric light shafts and floating sparks over a detailed painted environment, a dramatic colour script with a hot accent against cool shadows, speed-line energy and a controlled glow bloom.",
  },
  {
    id: "anime-sky",
    group: "anime",
    name: "أنمي السماء المضيئة",
    icon: "🌅",
    hint: "سماء وماء مرسومة بتفاصيل وإضاءة رومانسية",
    fits: "all",
    real: "painted-background anime: a clean drawn character in front of a hyper-detailed painted sky, consistently so",
    text: "Luminous-sky anime (the romantic painted-backdrop school): the character drawn with clean thin anime linework and soft flat shading, set against a hyper-detailed painted background with towering cumulus clouds, glassy reflective water, restrained lens flares, light scattering and soft bloom, deep saturated blues melting into glowing warm gold at the horizon.",
  },
  {
    id: "retro-anime",
    group: "anime",
    name: "أنمي الثمانينات",
    icon: "📼",
    hint: "ألوان سِل قديمة وحبيبات فيلم وإحساس بث قديم",
    fits: "all",
    real: "vintage cel anime: hand-painted cels, far from real, consistently so",
    text: "1980s-90s retro cel anime: hand-painted cel colour with visible paint texture, slightly off-register colour edges, warm film grain and halation around the highlights, big glossy eyes with sparkling reflections, sharp linework under the grain, a vintage broadcast palette with soft scanline feel and a painted airbrushed sunset backdrop.",
  },
  {
    id: "chibi",
    group: "anime",
    name: "تشيبي لطيف",
    icon: "🍡",
    hint: "رأس كبير وجسم صغير وخدود وردية",
    fits: "child",
    real: "chibi: deliberately tiny-bodied, big-headed drawn shapes, consistently so",
    text: "Chibi cute style: a very large round head on a tiny two-heads-tall body, short soft limbs, big shiny eyes with simple highlights, a tiny nose and a small smiling mouth, rosy blush on the cheeks, the hair shape and colour and any glasses or beard kept as simplified graphic shapes, soft pastel cel shading, rounded bubbly outlines and little sparkles and hearts floating around.",
  },
  {
    id: "vinyl-toy",
    group: "kids",
    name: "مجسّم لعبة",
    icon: "🪀",
    hint: "فيجر لامع من الفينيل مثل ألعاب المجموعات",
    fits: "all",
    real: "designer vinyl toy: a manufactured glossy object, consistently so",
    text: "Collectible designer vinyl toy figure photographed on a tabletop: smooth glossy injection-moulded plastic with a soft specular highlight, simplified rounded body with a seam line at the joints, painted-on face features and a matte paint finish, tiny scuffs of realistic manufacturing, a small round display base, bright studio softbox lighting with a clean coloured backdrop and a shallow macro depth of field.",
  },
  {
    id: "felt",
    group: "kids",
    name: "صوف ولباد",
    icon: "🧶",
    hint: "غرز يدوية وقماش لباد ناعم مثل دمى الأطفال",
    fits: "child",
    real: "felt and yarn craft: stitched soft fabric forms, consistently so",
    text: "Handmade felt-and-yarn craft: every shape cut from thick coloured wool felt with fuzzy fibre edges, visible hand stitches in contrasting thread along the seams, button eyes and embroidered smiles, hair made of looped yarn, soft stuffing puffing the forms, a knitted and quilted background set, warm cosy window light with soft shadows and macro depth of field.",
  },
] as const;
export type CartoonStyle = (typeof CARTOON_STYLES)[number]["id"];

/** The looks only this page has (games and toys): the shared style map keeps the library's own 100, so these are not in it. */
export const CARTOON_ONLY: readonly string[] = ["game-2-5d", "pixel", "voxel", "vinyl-toy", "felt"];

/** The shelves the styles are shown under (the person can still see them all at once). */
export const CARTOON_GROUPS = {
  world: { name: "عوالم سينمائية", icon: "🎬" },
  anime: { name: "أنمي", icon: "🌸" },
  games: { name: "ألعاب", icon: "🎮" },
  kids: { name: "للأطفال", icon: "🧸" },
  art: { name: "فن ورسم", icon: "🖋️" },
} as const;
export type CartoonGroup = keyof typeof CARTOON_GROUPS;

/**
 * The picture of each look (drawn once by the owner from /admin/film, kept in the public bucket): a friendly made-up
 * character, never a real person, in this look's whole world. A look without one shows its coloured tile.
 */
export const CARTOON_PICTURE_DIR = "cartoon-styles";
export function cartoonStylePicturePrompt(id: string): string {
  const style = CARTOON_STYLES.find(item => item.id === id);
  if (!style) throw new Error("unknown cartoon style " + id);
  return "A friendly made-up young character with a warm smile, modest clothing, waving hello in a bright garden with a small house and a tree behind. A wide 16:9 frame, the character clear and well staged. No writing, letters or captions anywhere in the picture.\n\nART STYLE: " + style.text + "\nHOLD ONE LEVEL OF STYLISATION — " + style.real + ".";
}

/**
 * Who the picture is FOR — a separate question from who is IN it. It came out of the research: Disney Research measured
 * the characters of real children's shows and found that the ones made for younger audiences have a bigger head-to-body
 * ratio (r = −0.724), bigger eyes relative to the head (r = −0.672) and rounder eyes, while how wide-set the eyes are
 * carries no relation to the audience's age at all. But in the SAME study, when 4–10-year-olds chose between characters
 * or built their own, they showed NO preference for those features and actually disliked enlarged heads — they kept
 * choosing the unaltered character and regular head sizes (studios.disneyresearch.com, IDC 2016). So the childlike look
 * is a convention of the people who draw, not a thing children ask for.
 *
 * What we do with that: a child's picture is made gentler by its WORLD — simple shapes, a clear silhouette, a warm safe
 * palette, soft light and no frightening detail — and its proportions are only nudged, never ballooned, and the real
 * face of the person is kept, because that is what the children themselves chose.
 */
export const CARTOON_AUDIENCES = { child: "لطفل", family: "للعائلة", grown: "لكبار" } as const;
export type CartoonAudience = keyof typeof CARTOON_AUDIENCES;
export const AUDIENCE_RULES: Record<CartoonAudience, string> = {
  child:
    "Made FOR A CHILD to look at. Nudge the proportions a little towards a childlike build (head slightly larger relative to the body, eyes a little larger and rounder) — a nudge, NOT a balloon head, and never at the cost of the real face. Simple clear shape language, one readable silhouette, few interior details, a warm bright safe palette with high figure-to-background contrast, soft even light, friendly open expression, nothing frightening, dark, sharp-toothed or ambiguous, and one clear thing happening in the frame.",
  family:
    "Made FOR THE WHOLE FAMILY. Natural balanced proportions, warm readable lighting, enough detail to be interesting up close but a silhouette that still reads from far, a friendly expression and a palette that is bright without being childish.",
  grown:
    "Made FOR GROWN-UPS. Natural adult proportions (about seven and a half heads tall), restrained eye size, richer texture and surface detail, considered cinematic or graphic lighting, a sophisticated palette, and an expression with some character to it rather than a wide smile.",
};

/**
 * What is actually being made. «الصورة كما هي» turns the photograph itself into a drawing — the same pose, the same
 * framing, the same background and EVERY person in it, each keeping their own face — which is what a person means when
 * they hold up a picture of themselves with their father and say «حوّلها». «شخصية جديدة» is the other thing: one person
 * lifted out of their photos and drawn anew in a pose, an age and an outfit they choose.
 */
/**
 * What is done with the photograph: the photograph itself redrawn (the same place, everyone in it), or a character made
 * of the person — either one picture on a plain grey background, or a complete CHARACTER SHEET (from a front and a
 * side photograph) ready to be used later as a character of a film.
 */
export const CARTOON_MODES = { scene: "حوّل الصورة كما هي", character: "شخصية بخلفية رمادية", sheet: "كاركتر شيت كامل" } as const;
export type CartoonMode = keyof typeof CARTOON_MODES;

/** The shapes a picture can come out in; «الصورة كما هي» keeps the photograph's own shape instead of forcing 9:16. */
export const CARTOON_ASPECTS = ["1:1", "16:9", "9:16", "3:2", "2:3"] as const;
export type CartoonAspect = (typeof CARTOON_ASPECTS)[number];
/** The listed shape closest to a photograph of this size (the page measures the picture it is about to send). */
export function nearestAspect(width: number, height: number): CartoonAspect {
  if (!(width > 0) || !(height > 0)) return "9:16";
  const r = width / height;
  const of = (a: CartoonAspect) => Number(a.split(":")[0]) / Number(a.split(":")[1]);
  return CARTOON_ASPECTS.reduce((best, a) => (Math.abs(Math.log(of(a) / r)) < Math.abs(Math.log(of(best) / r)) ? a : best), "9:16" as CartoonAspect);
}

export const CARTOON_AGES = { same: "نفس العمر", baby: "رضيع", toddler: "طفل صغير", child: "طفل", adult: "بالغ" } as const;
export const CARTOON_MOVES = { still: "ساكن / يتفاعل بيديه", crawl: "يحبي", walk: "يمشي" } as const;
/**
 * Whether how the character moves is even a question. It is one for a baby or a small child, where crawling or taking
 * first steps is the whole picture; for a grown-up it is not — nobody wants to be asked whether they crawl. It is also
 * not a question when the photograph itself is being redrawn: the pose is already in the picture.
 */
export const movementAsked = (input: Pick<CartoonInput, "mode" | "age">) => input.mode === "character" && (input.age === "baby" || input.age === "toddler" || input.age === "child");
export const CARTOON_STORIES = {
  space: "مغامرة الفضاء",
  garden: "الحديقة السحرية",
  sea: "عالم البحر",
  custom: "قصتي الخاصة",
} as const;
export interface CartoonInput {
  /** the photograph itself redrawn, or a new character made from it */
  mode: CartoonMode;
  /** the picture's shape (the photograph's own, when the photograph is what is being redrawn) */
  aspect: CartoonAspect;
  style: string;
  /** who the picture is FOR (a separate thing from who is in it) */
  audience: CartoonAudience;
  age: keyof typeof CARTOON_AGES;
  desiredAge: string;
  movement: keyof typeof CARTOON_MOVES;
  outfit: string;
  interests: string;
  story: keyof typeof CARTOON_STORIES;
  customStory: string;
  /** the person's own story in English, for the film (Seedance 2.0 reads no Arabic): filled on the server */
  storyEn?: string;
  count: number;
  video: boolean;
  consent: boolean;
}
export function cartoonInput(raw: unknown): CartoonInput {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const field = (name: string, max: number) => String(value[name] ?? "").trim().slice(0, max);
  if (!CARTOON_STYLES.some(style => style.id === value.style)) throw new Error("اختر الستايل.");
  const mode: CartoonMode = Object.hasOwn(CARTOON_MODES, String(value.mode)) ? (value.mode as CartoonMode) : "character";
  if (!Object.hasOwn(CARTOON_AGES, String(value.age)) || !Object.hasOwn(CARTOON_MOVES, String(value.movement))) throw new Error("اختر العمر والحركة.");
  if (!Object.hasOwn(CARTOON_STORIES, String(value.story))) throw new Error("اختر القصة.");
  if (!Number.isInteger(value.count) || Number(value.count) < 1 || Number(value.count) > 4) throw new Error("اختر من صورة إلى أربع صور.");
  if (value.consent !== true) throw new Error("أكد أن لديك إذن استخدام الصور، وموافقة ولي الأمر لصور الأطفال.");
  if (value.video === true && value.story === "custom" && !field("customStory", 3000) && mode === "character") throw new Error("اكتب قصتك أولًا.");
  // a run saved before this question existed reads as «للعائلة», so old work still makes the same kind of picture
  // a character sheet is one wide sheet, alone (no film made from a sheet)
  const sheet = mode === "sheet";
  return { mode, aspect: sheet ? "16:9" : (CARTOON_ASPECTS as readonly string[]).includes(String(value.aspect)) ? (value.aspect as CartoonAspect) : "9:16", style: String(value.style), audience: (Object.hasOwn(CARTOON_AUDIENCES, String(value.audience)) ? value.audience : "family") as CartoonAudience, age: value.age as CartoonInput["age"], desiredAge: field("desiredAge", 60), movement: value.movement as CartoonInput["movement"], outfit: field("outfit", 400), interests: field("interests", 400), story: value.story as CartoonInput["story"], customStory: field("customStory", 3000), count: sheet ? 1 : Number(value.count), video: !sheet && value.video === true, consent: true };
}
const AGE = { same: "the same apparent age as the references", baby: "a cartoon baby, age-reinterpreted infant proportions", toddler: "a cartoon toddler", child: "a cartoon child", adult: "a cartoon adult" };
const MOVE = { still: "a stable safe seated pose, interacting with hands and expressions, not walking", crawl: "crawling on hands and knees on safe level ground, visible grounded contacts, low camera", walk: "walking with short balanced steps, feet contacting the ground without sliding" };
/**
 * What every picture and every shot of this person is told, in one block: the look, the identity, the audience, the age
 * and the movement.
 *
 * The identity part is written against what image models actually do wrong. Left alone they beautify: they smooth the
 * skin, slim the jaw, straighten the teeth and hand back a generic pretty face that is no longer the person. The
 * answer that works is to NAME the features that must survive and to separate identity from rendering — the references
 * say WHO, the style says HOW IT IS DRAWN — rather than asking vaguely for "a resemblance".
 */
export function cartoonIdentity(input: CartoonInput) {
  const style = CARTOON_STYLES.find(item => item.id === input.style)!;
  return [
    "THE LOOK — " + style.text,
    "HOLD ONE LEVEL OF STYLISATION — " + style.real + ". The face, the body, the clothes and the world are all drawn at that same level; never a half-real face with cartoon eyes, and never a photographic face on a drawn body. A cartoon that is wholly a cartoon is easy to look at; a mixture of levels is what turns unsettling.",
    "WHO IT IS: the references are the identity, not the rendering. Carry over, as drawn shapes in this style: the outline of the face and the jaw, the shape and spacing of the eyes and the brows, the line of the nose and its bridge, the shape of the mouth and lips, the hairline, the hair's own colour, texture and the way it falls, the skin tone, and anything distinctive — glasses, a beard and how it grows, freckles, a mole, a gap in the teeth, a scar, a dimple, the ears.",
    "DO NOT BEAUTIFY: do not smooth the skin into blankness, do not slim or lengthen the face, do not straighten the teeth, do not shrink the nose, do not enlarge the eyes beyond what the chosen look allows, do not change the skin tone, and do not replace any of it with a generically cute or handsome face. If a feature is unusual, it is the point: keep it.",
    "WHO IT IS FOR — " + AUDIENCE_RULES[input.audience],
    input.mode === "scene"
      ? "KEEP THE PICTURE: this is the photograph itself redrawn, so the age, the pose, the gestures, the expressions and the clothing are the ones already in it. Change none of them."
      : "AGE: " + (input.desiredAge || AGE[input.age]) + ". An age change is an imaginative reinterpretation, not a reconstruction of how they really looked; keep the identity features above and adapt only what age really changes (proportions, the softness of the features, facial hair).",
    input.mode === "scene" ? "" : movementAsked(input) ? "MOVEMENT: " + MOVE[input.movement] + ". Age and movement stay the same throughout." : "",
    input.mode === "scene"
      ? input.interests
        ? "WHAT MATTERS TO THEM (only if it can be honoured without changing the picture): " + input.interests + "."
        : ""
      : "OUTFIT: " + (input.outfit || "the clothing from the references, redrawn in this style and adapted to the chosen age") + ". INTERESTS: " + (input.interests || "a gentle colourful adventure") + ".",
  ].filter(Boolean).join("\n");
}

/**
 * The picture's prompt. In «الصورة كما هي» the references ARE the picture: the whole photograph is redrawn — its
 * composition, its background and everyone standing in it, each with their own face — so a person and their father
 * stay a person and their father. In «شخصية جديدة» the references are only the identity of ONE person, and the
 * composition is made fresh. `canonical` is the follow-up picture: the cartoon already made is the reference now.
 */
export function cartoonImagePrompt(input: CartoonInput, canonical = false) {
  if (input.mode === "scene") {
    return (canonical
      ? "Image 1 is the cartoon version already made of this photograph. Keep its exact style, its characters and their identities, and draw the same scene again, equally faithful to it. "
      : "REDRAW THE PHOTOGRAPH ITSELF as a cartoon. The references are the picture to redraw, not identity angles of one person. Keep its composition, the framing and camera angle, who stands where, every pose and gesture, the expressions, the clothing and the background exactly as they are — the same moment, drawn instead of photographed. ") +
      "EVERY PERSON in the photograph is redrawn, each one a separate character keeping their OWN face: never merge two people, never drop anyone, never add a person who is not there, and never give two of them the same face. Keep their real difference in age and in height.\n" +
      cartoonIdentity(input) +
      "\nThe identity rules above apply to EACH person in the picture. Redraw the background of the photograph in the same style rather than replacing it with a new setting. No text and no logos that are not already in the photograph.";
  }
  if (input.mode === "sheet") {
    return "Every supplied reference is the SAME ONE PERSON — a FRONT photograph and a SIDE (profile) photograph, maybe one more. Read them together to understand the face and head shape from both angles, and draw a COMPLETE CHARACTER SHEET (model sheet) of ONE cartoon character of that person, ready to be used as a film character.\n" +
      cartoonIdentity(input) +
      "\nLAYOUT, on a plain light-grey (#d9d9d9) seamless background, wide 16:9: TOP ROW — a full-body turnaround of the same character at the same scale and height, standing in a neutral A-pose: front, three-quarter, side profile and back, aligned on one ground line. BOTTOM ROW — four head close-ups of the same face: neutral, smiling, surprised and sad, plus the outfit's key details (shoes, hands, any accessory) small at the end. The same proportions, colours, outfit and age in every view; even, neutral studio light with no cast shadows on the background; clean separation between the views. No text, no labels, no numbers, no logos.";
  }
  return (canonical
    ? "Image 1 is the canonical CARTOON character already made for this person. Reuse its exact identity, age, outfit and style, and give this same character a new pose or composition. "
    : "Every supplied reference is the SAME ONE PERSON, photographed from different angles — read them together to understand the face, and draw ONE cartoon character of that person. The references give identity only; how it is drawn comes from the look below. ") +
    cartoonIdentity(input) +
    "\nOne character, full body, standing on a PLAIN NEUTRAL MID-GREY (#9a9a9a) seamless studio background — no scene, no props, no other objects, a soft contact shadow only. The face clearly readable and the anatomy coherent. No text and no logos unless the outfit or the brief asked for them.";
}

/** Arabic letters in a text (Seedance 2.0 only reads English, Spanish, Indonesian, Portuguese and Japanese). */
export const hasArabic = (s: string) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
/**
 * The film's prompt is English only: the person's own words in Arabic (an outfit, interests, an age written out) are
 * already drawn into the character picture, so the film reads them from @character instead of from the text.
 */
const videoInput = (input: CartoonInput): CartoonInput => ({
  ...input,
  outfit: hasArabic(input.outfit) ? "exactly as drawn in @character" : input.outfit,
  interests: hasArabic(input.interests) ? "" : input.interests,
  desiredAge: hasArabic(input.desiredAge) ? "" : input.desiredAge,
});

export function cartoonVideoPrompt(raw: CartoonInput) {
  const input = videoInput(raw);
  if (input.mode === "scene") {
    // the photograph, now drawn, simply begins to move: no story, no new events, nobody leaves the frame
    return "15 seconds, a drawn picture coming gently to life. @character is the cartoon made from this photograph: keep its style, its composition, its background and EVERY person in it with the same face, clothing and position.\n" +
      cartoonIdentity(input) +
      "\nNothing new happens: the people in the picture breathe, blink, shift their weight a little, their hair and clothes move, a small natural gesture or a smile passes between them, and the background has its own quiet life (leaves, light, dust in the air). A very slow camera push or drift, nothing more. Nobody walks out of frame, nobody changes age or style, no new person or object appears, no cuts. Gentle original music and soft ambience; no invented spoken dialogue.";
  }
  const story = input.story === "custom" ? (input.storyEn || (hasArabic(input.customStory) ? "a short, gentle adventure that fits the character, in 3–4 clear beats" : input.customStory)) : {
    space: "0–4s: discovers a glowing star in a safe cartoon observatory. 4–8s: reacts to colorful planets through the window. 8–12s: reaches toward a large button; stars form a beautiful pattern. 12–15s: smiles beside the glowing star.",
    garden: "0–4s: notices a luminous flower in a safe garden. 4–8s: reacts to a friendly butterfly. 8–12s: the flower opens and softly lights the garden. 12–15s: a delighted expression and a calm ending.",
    sea: "0–4s: discovers a shell inside a dry safe underwater observation room. 4–8s: watches a colorful fish through glass. 8–12s: waves as the fish swims in a clear arc. 12–15s: smiles and waves goodbye.",
  }[input.story];
  return "15 seconds, vertical 9:16 cartoon film. @character is the canonical character: preserve the same stylized face, proportions, outfit and age in every shot.\n" + cartoonIdentity(input) +
    "\nStory: " + story + (movementAsked(input) ? "\nAdapt actions to the selected movement; a stationary baby watches/reaches, never walks." : "\nLet the character move naturally for their age.") +
    " Use 3–4 clear beats, one action per beat, gentle camera moves and grounded motion. No age or style morph. Gentle original music and appropriate foley; no invented spoken dialogue. Do not copy the photo background.";
}

// the owner's choice: Seedance 2.0, 15 seconds, 480p (Seedance 2.5 is no longer used here)
export const CARTOON_VIDEO_SETTINGS = { ratio: "9:16", resolution: "480p", duration: 15, audio: true } as const;
/** The film's settings; a redrawn photograph keeps its own shape, a new character's story is vertical. */
export const cartoonVideoSettings = (input: CartoonInput) => ({ ...CARTOON_VIDEO_SETTINGS, ...(input.mode === "scene" ? { ratio: input.aspect === "1:1" ? "1:1" : input.aspect === "16:9" || input.aspect === "3:2" ? "16:9" : "9:16" } : {}) });

