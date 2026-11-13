// «الجواد الذكي!» | JAWAD AI — «جاهز بضغطة»: the kinds of work in playbooks.ts as one-click cards in «الاستوديو
// الإبداعي» (the way Higgsfield and Runway offer «Apps»: pick a use-case, add your photo, go). A card fills the studio's
// own form — the kind, a generator, the shape, the reference slots and a prompt — written here from the playbook's
// recipe and the person's few inputs, with no AI call: free and instant. The person adds their photo and presses the
// usual «توليد», so the price confirmation and the refund stay the studio's own. Pure; shared by the studio and the
// tests. «جواد»'s own use of the playbooks is untouched.
//
// Every playbook is a card: each one is a real use-case people come for, and each can be written from its recipe with
// at most three inputs. The prompts follow each recipe's order and avoid each playbook's pitfalls (the label kept
// exactly, one product, few words of text, one effect, one change per pass).

import { defaultSettings, generatorById, hasArabic } from "./generators";
import { PLAYBOOKS, playbookById } from "./playbooks";
import { FIGHT_PLAYBOOK_ID, FIGHT_SCHOOLS } from "./fight-scenes";
import { LOCK_CLAUSE, TRANSFORM_PLAYBOOK_ID } from "./video-transform";
import type { GeneratorDef, RefKind, RefRole, RefStyle, Settings } from "./types";

/** One of a card's choices: its chip, the words it puts in the prompt, and the options it sets (a shape, sound). */
export interface ReadyChoice {
  value: string;
  label: string;
  en: string;
  settings?: Settings;
  /** a style from «خريطة الستايلات» that fits it (config/film-styles.ts) */
  styleId?: string;
}

/** A short input of a card: a line of text, or chips. */
export type ReadyInput =
  | { key: string; label: string; kind: "text"; placeholder: string; optional?: boolean; max: number }
  | { key: string; label: string; kind: "choice"; choices: ReadyChoice[]; when?: { key: string; value: string } };

/** A reference the person adds: its «@name» in the prompt, its kind and what it is, in the person's words. */
export interface ReadySlot {
  name: string;
  kind: RefKind;
  what: string;
  role?: RefRole;
}

export type ReadyValues = Record<string, string>;
/** The chosen chip of one of the card's inputs. */
export type Chosen = (key: string) => ReadyChoice;

export interface ReadyApp {
  /** the playbook's id */
  id: string;
  icon: string;
  name: string;
  /** what it makes, one plain line */
  line: string;
  /** what the person adds */
  needs: string;
  output: "image" | "video";
  /** the generators that suit it, best first (the playbook's options are written for the first) */
  prefer: string[];
  refStyle: RefStyle;
  slots: (c: Chosen) => ReadySlot[];
  inputs: ReadyInput[];
  /** one more line shown on the card (a step after generating) */
  note?: string;
  /** the side left empty for the person's own photo («ركّب الشخص»), thumbnails only */
  composerSide?: (c: Chosen) => "left" | "right" | "center";
  /** the prompt: `v` the person's inputs, `c` a chosen chip, `sec` the clip's seconds */
  prompt: (x: { v: ReadyValues; c: Chosen; sec: number }) => string;
}

const IMAGE_GENS = ["openai-gpt-image-2", "openai-gpt-image-2-6", "google-nano-banana-pro", "google-nano-banana-2", "byteplus-seedream-5-lite"];
const VIDEO_GENS = ["byteplus-seedance-2-5", "byteplus-seedance-2-0", "kling-4", "wan-3-0", "gemini-omni-1-2", "gemini-omni"];

/** The person's words, quoted for the prompt. */
const q = (s: string) => `"${s.replace(/"/g, "'")}"`;
const product = (name: string) => (name ? `the product ${q(name)}` : "the product");
const one = (s: string) => s.replace(/\s+/g, " ").trim();
/** The chosen choice of an input (the first one when nothing is chosen). */
function chosen(app: ReadyApp, v: ReadyValues, key: string): ReadyChoice {
  const input = app.inputs.find((i) => i.key === key);
  if (!input || input.kind !== "choice") throw new Error(`no choice ${key}`);
  return input.choices.find((c) => c.value === v[key]) ?? input.choices[0];
}

const SHAPE_SOCIAL: ReadyChoice[] = [
  { value: "story", label: "ستوري ٩:١٦", en: "Instagram story design 9:16", settings: { aspect: "9:16" } },
  { value: "post", label: "بوست مربع", en: "Square 1:1 social post", settings: { aspect: "1:1" } },
  { value: "print", label: "بوستر طباعة", en: "Event poster 2:3", settings: { aspect: "2:3" } },
];

// the fight schools as chips (the desert duel's thobes and shemaghs are left to «جواد»'s conversation)
const FIGHT_CHOICES: ReadyChoice[] = FIGHT_SCHOOLS.filter((s) => s.id !== "desert-sword").map((s) => ({ value: s.id, label: s.ar, en: s.style }));
const FIGHT_DEFAULTS: Record<string, { place: string; weapon: string }> = {
  wuxia: { place: "a misty bamboo forest", weapon: "straight swords" },
  corridor: { place: "a long dim hotel corridor", weapon: "a short wooden stick" },
  samurai: { place: "a windswept grass field at dusk", weapon: "curved swords" },
  egyptian: { place: "a crowded old market alley and the rooftops above it", weapon: "wooden sticks" },
  tahtib: { place: "a village square at dusk with a ring of watching men", weapon: "long wooden sticks" },
};

/** A card, named after its playbook. */
const card = (a: Omit<ReadyApp, "name">): ReadyApp => ({ ...a, name: playbookById(a.id)?.name ?? a.id });

export const READY_APPS: ReadyApp[] = [
  card({
    id: "product-shot",
    icon: "📦",
    line: "صورة منتج نظيفة للمتجر أو للإعلان، والمنتج نفسه بدون ما يتغير.",
    needs: "صورة منتجك",
    output: "image",
    prefer: IMAGE_GENS,
    refStyle: "references",
    slots: () => [{ name: "product", kind: "image", what: "صورة منتجك" }],
    inputs: [
      { key: "product", label: "وش المنتج؟", kind: "text", placeholder: "مثال: عطر، علبة قهوة، كريم", optional: true, max: 40 },
      { key: "use", label: "وين بتستخدمها؟", kind: "choice", choices: [
        { value: "ad", label: "إعلان بجو", en: "advertising" },
        { value: "listing", label: "صفحة متجر (أبيض)", en: "listing" },
      ] },
      { key: "mood", label: "الجو", kind: "choice", when: { key: "use", value: "ad" }, choices: [
        { value: "ice", label: "❄️ ثلج", en: "standing on a slab of clear ice with frost crystals and small ice cubes around it, cold blue-white light with a soft warm rim, water droplets on the surface" },
        { value: "water", label: "💧 رذاذ ماء", en: "in a frozen splash of clear water curling around it, fine droplets in the air, fresh cool light" },
        { value: "marble", label: "🤍 رخام", en: "on a polished white marble pedestal, soft daylight, an elegant minimal set" },
        { value: "wood", label: "🪵 خشب", en: "on warm oak wood with a few natural props softly out of focus behind, morning window light, a cosy mood" },
        { value: "linen", label: "🧺 قماش", en: "on soft draped linen in neutral tones, gentle folds, soft diffused light" },
        { value: "pastel", label: "🎨 لون سادة", en: "on a simple pedestal in a seamless pastel void, one soft colour, clean shadows" },
      ] },
    ],
    prompt: ({ v, c }) => {
      const P = product(v.product);
      if (c("use").value === "listing") {
        return `Professional e-commerce product photo of ${P} @product, exactly as in @product: the same shape, label, colours and text; do not redraw or change the label. Centred on a pure white seamless background, nothing else, eye-level three-quarter view, soft studio key light from the left, a subtle rim light on the edges, a soft natural shadow beneath, a faint reflection. Photoreal, sharp, high-end commercial product photography. No hands, no other products, no added text.`;
      }
      return `Advertising product shot of ${P} @product (keep it exactly as in @product: the same shape, label, colours and text; do not redraw or change the label). Set: the product ${c("mood").en}. Three-quarter view at eye level, a soft studio key from the side, a rim light on the edge, a soft shadow under the product and a gentle reflection, no harsh glare on the label. Photoreal, sharp, high-end commercial product photography, one product, one idea. No hands, no extra products, no text.`;
    },
  }),
  card({
    id: "product-lifestyle",
    icon: "🤳",
    line: "منتجك بيد شخص في لحظة طبيعية، كأنها صورة حقيقية من الجوال.",
    needs: "صورة منتجك",
    output: "image",
    prefer: IMAGE_GENS,
    refStyle: "references",
    slots: () => [{ name: "product", kind: "image", what: "صورة منتجك" }],
    inputs: [
      { key: "product", label: "وش المنتج؟", kind: "text", placeholder: "مثال: علبة مشروب، كاب، كريم", optional: true, max: 40 },
      { key: "who", label: "مين يستخدمه؟", kind: "choice", choices: [
        { value: "young", label: "شاب", en: "a young man in his twenties in a casual summer outfit" },
        { value: "man", label: "رجل", en: "a man in his thirties in smart casual clothes" },
        { value: "boy", label: "ولد", en: "a boy of about ten in a t-shirt" },
      ] },
      { key: "place", label: "وين؟", kind: "choice", choices: [
        { value: "street", label: "شارع", en: "on a city street at golden hour, warm light from behind" },
        { value: "kitchen", label: "مطبخ", en: "in a bright home kitchen, soft morning window light" },
        { value: "office", label: "مكتب", en: "at a desk in a modern office, soft daylight from a window" },
        { value: "beach", label: "بحر", en: "on a sunny beach boardwalk, golden hour light" },
      ] },
    ],
    prompt: ({ v, c }) =>
      `Lifestyle photo: ${c("who").en} holds ${product(v.product)} @product (shape, label and colours exactly as in @product) in one natural action, a simple grip, the product large in frame, sharp and readable, ${c("place").en}. Candid phone-shot feel, natural expression, shallow depth of field, real skin texture, a fresh natural mood. Vertical 2:3 framing. No text, no logos other than the product's own.`,
  }),
  card({
    id: "hyper-motion",
    icon: "💥",
    line: "فيديو إعلاني سينمائي لمنتجك بدون ناس: انفجار ألوان أو فخامة هادية.",
    needs: "صورة منتجك",
    output: "video",
    prefer: VIDEO_GENS,
    refStyle: "references",
    slots: () => [{ name: "product", kind: "image", what: "صورة منتجك" }],
    inputs: [
      { key: "product", label: "وش المنتج؟", kind: "text", placeholder: "مثال: عصير، عطر، شيبس", optional: true, max: 40 },
      { key: "feel", label: "الإحساس", kind: "choice", choices: [
        { value: "energy", label: "⚡ طاقة وانفجار", en: "energy" },
        { value: "luxury", label: "✨ فخامة وهدوء", en: "luxury" },
      ] },
      { key: "shape", label: "وين ينعرض؟", kind: "choice", choices: [
        { value: "reels", label: "ريلز ٩:١٦", en: "vertical", settings: { ratio: "9:16" } },
        { value: "wide", label: "شاشة ١٦:٩", en: "widescreen", settings: { ratio: "16:9" } },
      ] },
    ],
    prompt: ({ v, c, sec }) => {
      const P = product(v.product);
      const shape = c("shape").en;
      if (c("feel").value === "luxury") {
        return `Luxury hyper-motion CGI product commercial, ${sec} seconds, ${shape}, no people, no voice-over, no text on screen. ${cap(P)} @product is the hero and keeps its exact shape, label and colours throughout. 0–3 s: a slow dolly in through drifting golden particles as the product rises from dark silk that ripples like water. 3–6 s: a gentle 180° orbit, light caustics travel across it. 6–${sec} s: it settles on a black marble pedestal under a soft spotlight with deep shadows. Premium studio lighting with rim lights, controlled depth of field, 24 fps film feel, colours from the packaging. Sound: an airy pad, a soft chime, silk rustle; no speech.`;
      }
      return `High-energy hyper-motion CGI product commercial, ${sec} seconds, ${shape}, no people, no voice-over, no text on screen. ${cap(P)} @product is the hero and keeps its exact shape, label and colours throughout. 0–2 s: a fast macro push-in on the product on a glossy reflective studio floor. 2–5 s: the camera sweeps a fast orbit as one burst matched to the product — a liquid splash, fruit and ice, or a cloud of powder — explodes around it in slow motion without covering the label. 5–${sec} s: everything settles and the product lands centred and sharp under a bright rim light. Bold colours from the packaging, premium studio lighting, controlled depth of field, 24 fps film feel. Sound: whooshes, an impact hit, a satisfying splash, a bass drop at the end; no speech.`;
    },
  }),
  card({
    id: "ugc-ad",
    icon: "🎙️",
    line: "إعلان كأنه من صانع محتوى: يمسك منتجك ويتكلم عنه للكاميرا بجواله.",
    needs: "صورة منتجك",
    output: "video",
    prefer: VIDEO_GENS,
    refStyle: "references",
    slots: () => [{ name: "product", kind: "image", what: "صورة منتجك" }],
    inputs: [
      { key: "product", label: "وش المنتج؟", kind: "text", placeholder: "مثال: سماعة، كريم، قهوة", optional: true, max: 40 },
      { key: "type", label: "النوع", kind: "choice", choices: [
        { value: "review", label: "مراجعة", en: "product review" },
        { value: "unboxing", label: "أنبوكسنق", en: "unboxing video" },
        { value: "tutorial", label: "شرح استخدام", en: "how-to tutorial" },
      ] },
      { key: "line", label: "وش يقول؟ (جملة قصيرة)", kind: "text", placeholder: "بحروف إنجليزية أوضح: Jarrabtah w ma nadimt", optional: true, max: 90 },
    ],
    prompt: ({ v, c, sec }) => {
      const P = product(v.product);
      const type = c("type");
      const act =
        type.value === "unboxing"
          ? `opens a cardboard box on a table, lifts out ${P} @product (exactly as in @product), his eyes widen with a genuine reaction and he turns it in his hands`
          : type.value === "tutorial"
            ? `shows how he uses ${P} @product (exactly as in @product) step by step, holding it close to the lens so its label reads`
            : `holds ${P} @product (exactly as in @product) up beside his face, turns it so the label reads, then gives a small nod`;
      const said = v.line ? ` He says: ${q(v.line)} — his lips match the words.` : " He reacts naturally without speaking.";
      return `UGC-style ${type.en}, ${sec} seconds, vertical phone video, front camera, handheld, natural window light in a tidy real room, slightly imperfect. A young man in his late twenties in a casual t-shirt ${act}; the label stays readable.${said} Shot order: the hook in the first second (his face and the product together), then the ${type.value === "unboxing" ? "reveal" : "demo"}, then a last look to the camera. Real skin texture, slight camera shake. Sound: room tone${v.line ? " and his clear voice" : " and the product's own small sounds"}, no music.`;
    },
  }),
  card({
    id: "thumbnail",
    icon: "🖼️",
    line: "ثامبنيل يوتيوب أو كفر ريل بعنوان كبير واضح، ومكان فاضي لصورتك.",
    needs: "نص العنوان (٣–٥ كلمات)",
    note: "بعد التوليد أضف صورتك كمرجع واضغط «ركّب الشخص»: نقصك من صورتك الأصلية فوجهك ما يتغير.",
    output: "image",
    prefer: ["openai-gpt-image-2", "openai-gpt-image-2-6", "google-nano-banana-pro", "google-nano-banana-2"],
    refStyle: "none",
    slots: () => [],
    inputs: [
      { key: "title", label: "النص على الصورة", kind: "text", placeholder: "مثال: وين تروح فلوسك؟", max: 40 },
      { key: "topic", label: "الفيديو عن إيش؟", kind: "text", placeholder: "مثال: السفر لليابان", optional: true, max: 60 },
      { key: "shape", label: "المقاس", kind: "choice", choices: [
        { value: "youtube", label: "يوتيوب ١٦:٩", en: "YouTube thumbnail 16:9", settings: { aspect: "16:9" } },
        { value: "reel", label: "كفر ريل ٩:١٦", en: "Reel cover 9:16", settings: { aspect: "9:16" } },
      ] },
    ],
    composerSide: (c) => (c("shape").value === "reel" ? "center" : "left"),
    prompt: ({ v, c }) => {
      const about = v.topic ? ` for a video about ${q(v.topic)}` : "";
      const title = q(v.title || "شاهد للنهاية");
      if (c("shape").value === "reel") {
        return `Reel cover 9:16${about}. ONE idea, one focal point. Big bold text ${title} at the top third in thick white letters with a dark outline, very high contrast, its position fixed. A bright, simple, slightly blurred background with one or two strong colours that fit the topic. The lower half kept simple and EMPTY with a soft warm glow and a faint rim light where a person will be placed later; do not draw any person or face anywhere. No clutter, no small details, readable at phone size, nothing in the bottom corners.`;
      }
      return `YouTube thumbnail 16:9${about}. ONE idea, one focal point. Right two-thirds: a bright, simple, slightly blurred background with one or two strong colours that fit the topic, and the huge bold text ${title} in thick white letters with a black outline and one word highlighted in yellow, high contrast, centred vertically. The left third left EMPTY with a soft warm glow and a faint rim light where a person will be placed later; do not draw any person or face anywhere. No clutter, no small details, readable at 168×94 px on a phone, the bottom-right corner kept clear.`;
    },
  }),
  card({
    id: "poster-social",
    icon: "📣",
    line: "بوستر أو ستوري بنص قصير واضح: عرض، فعالية، منيو، افتتاح.",
    needs: "العنوان، وسطر صغير لو تبي",
    output: "image",
    prefer: ["openai-gpt-image-2", "openai-gpt-image-2-6", "google-nano-banana-pro", "google-nano-banana-2"],
    refStyle: "none",
    slots: () => [],
    inputs: [
      { key: "headline", label: "العنوان (٢–٤ كلمات)", kind: "text", placeholder: "مثال: خصم ٥٠٪", max: 30 },
      { key: "detail", label: "سطر صغير", kind: "text", placeholder: "مثال: على كل العطور · لين الخميس", optional: true, max: 40 },
      { key: "shape", label: "لمين؟", kind: "choice", choices: SHAPE_SOCIAL },
    ],
    prompt: ({ v, c }) => {
      const detail = v.detail ? `, and one smaller line ${q(v.detail)} below it in a lighter weight` : "";
      return `${c("shape").en} that carries text. The exact headline ${q(v.headline || "عرض خاص")} is the largest element, in bold, clear, well-spaced Arabic letters, high contrast${detail}; no other text anywhere. A striking subject picture that fits the headline on one side and the text on the other, or the text over a darkened area; 2–3 harmonious brand-like colours, a clean modern mood. Clear hierarchy, safe margins, the text kept away from the edges, no clutter.`;
    },
  }),
  card({
    id: "try-on-fashion",
    icon: "🧥",
    line: "قطعتك (لبس أو إكسسوار) ملبوسة على مانيكان أو موديل، للمتجر أو كلقطة مجلة.",
    needs: "صورة القطعة (مفرودة أو على مانيكان)",
    output: "image",
    prefer: IMAGE_GENS,
    refStyle: "references",
    slots: () => [{ name: "piece", kind: "image", what: "صورة القطعة" }],
    inputs: [
      { key: "piece", label: "وش القطعة؟", kind: "text", placeholder: "مثال: جاكيت جلد، ساعة، شنطة", optional: true, max: 40 },
      { key: "wearer", label: "مين يلبسها؟", kind: "choice", choices: [
        { value: "ghost", label: "مانيكان بدون وجه", en: "ghost" },
        { value: "man", label: "موديل رجل", en: "a man in his thirties with a slim athletic build" },
        { value: "cartoon", label: "شخصية كرتونية", en: "cartoon" },
      ] },
      { key: "goal", label: "الهدف", kind: "choice", choices: [
        { value: "shop", label: "صورة متجر", en: "shop" },
        { value: "editorial", label: "لقطة مجلة", en: "editorial" },
      ] },
    ],
    prompt: ({ v, c }) => {
      const piece = v.piece ? `the ${q(v.piece)} @piece` : "the garment @piece";
      const keep = `(cut, colour, pattern, fabric and prints exactly as in @piece)`;
      const shop = c("goal").value === "shop";
      const place = shop ? "in a clean light-grey studio, soft even lighting" : "in a stylish interior by a tall window, natural side light, 85mm lens, shallow depth of field, a moody magazine look";
      const wearer = c("wearer");
      if (wearer.value === "ghost") {
        return `Ghost-mannequin product photo of ${piece} ${keep} shown as if worn on an invisible mannequin: no person, no face, no skin, full length, ${place}, the fabric draping naturally and the details catching the light. Photoreal, sharp fabric texture, correct fit, vertical 2:3, no text.`;
      }
      if (wearer.value === "cartoon") {
        return `Flat 2D illustrated fashion figure of a man in a clean cartoon style wearing ${piece} ${keep}, a simple stylised face, an easy pose that shows the piece, soft shading, ${shop ? "a clean pastel studio" : "a simple stylish backdrop"}. Illustration only, not photoreal, vertical 2:3, no text.`;
      }
      return `${shop ? "Fashion catalogue photo" : "Editorial fashion photo"}: ${wearer.en} wears ${piece} ${keep}, ${shop ? "standing full length facing the camera, a relaxed pose that shows the fit" : "a confident mid-step pose looking slightly off camera"}, ${place}. The piece is the hero: correct fit, the way it hangs and catches the light, real fabric texture, natural skin. Photoreal, vertical 2:3, no text.`;
    },
  }),
  card({
    id: "viral-effect",
    icon: "🌀",
    line: "صورة وحدة تصير مقطع ترند: زوم من الفضاء، تجميد الزمن، نسخ منك…",
    needs: "صورتك (تصير أول لقطة)",
    output: "video",
    prefer: ["byteplus-seedance-2-5", "byteplus-seedance-2-0", "kling-4", "kling-3-pro", "wan-3-0", "gemini-omni-1-2", "gemini-omni"],
    refStyle: "frames",
    slots: () => [{ name: "photo", kind: "image", what: "صورتك", role: "first_frame" }],
    inputs: [
      { key: "effect", label: "المؤثر", kind: "choice", choices: [
        { value: "earth", label: "🌍 زوم من الفضاء", en: "Earth zoom: the camera pulls straight up and back from the subject at increasing speed — rooftops, the city grid, clouds, the curve of the Earth — in one unbroken move, ending on the planet seen from orbit." },
        { value: "bullet", label: "⏸️ تجميد الزمن", en: "Bullet time: the subject freezes mid-action while the camera sweeps a smooth 180° arc around the frozen scene, then time resumes." },
        { value: "orbit", label: "🔄 دوران ٣٦٠", en: "360 orbit: the camera circles the subject in one smooth full turn at their height, the background streaming past with parallax." },
        { value: "clones", label: "👥 نسخ منك", en: "Clones: identical copies of the subject step out beside them one by one and mirror the same move; the original stays in the middle." },
        { value: "crash", label: "💨 كراش زوم", en: "Crash zoom: after a still beat the camera rushes in toward the subject's face in a fast whip, stopping hard on a tight close-up." },
      ] },
      { key: "sound", label: "الصوت", kind: "choice", choices: [
        { value: "on", label: "بصوت", en: "Sound: a whoosh and a deep bass hit at the move; no speech.", settings: { audio: true } },
        { value: "off", label: "بدون صوت", en: "No sound.", settings: { audio: false } },
      ] },
    ],
    prompt: ({ c }) =>
      `Starts exactly from @photo as the first frame. ${c("effect").en} The subject's face, clothes and the place stay exactly as in @photo. ONE effect only, slow motion for the hero moment, 24 fps cinematic, vertical for reels. ${c("sound").en}`,
  }),
  card({
    id: "headshot-avatar",
    icon: "🧑‍💼",
    line: "صورتك كهيدشوت رسمي للينكدإن، أو أفاتار بأسلوب أنمي أو ثلاثي الأبعاد.",
    needs: "صورة وجهك (واضحة وإضاءتها حلوة)",
    output: "image",
    prefer: IMAGE_GENS,
    refStyle: "references",
    slots: () => [{ name: "face", kind: "image", what: "صورة وجهك" }],
    inputs: [
      { key: "type", label: "النوع", kind: "choice", choices: [
        { value: "headshot", label: "هيدشوت رسمي", en: "headshot" },
        { value: "pixar", label: "ثلاثي الأبعاد", en: "a 3D animated character portrait in a Pixar-like style: big expressive eyes, soft subsurface skin, a clean polished 3D render, a bright colourful room with soft bokeh", styleId: "pixar-classic" },
        { value: "anime", label: "أنمي", en: "an anime portrait with clean cel shading, crisp line art and bold flat colours, a soft gradient sky behind" },
        { value: "vector", label: "رسم فيكتور", en: "a flat vector illustration with clean shapes, bold simple colours and no outlines, a plain backdrop" },
      ] },
      { key: "outfit", label: "اللبس", kind: "choice", choices: [
        { value: "formal", label: "رسمي", en: "a navy blazer over a white shirt" },
        { value: "casual", label: "كاجوال", en: "a casual plain sweater" },
      ] },
    ],
    prompt: ({ c }) => {
      const id = "the same person as @face: the same face, features, skin tone, hair and beard, identity unchanged; glasses, hijab and other identity features kept as in @face";
      const type = c("type");
      const outfit = c("outfit").en;
      if (type.value === "headshot") {
        return `Professional LinkedIn headshot of ${id}. Head-and-shoulders crop, 85mm lens look, a soft large key light from the front-left with a gentle fill, a plain warm-grey studio background slightly blurred, wearing ${outfit}, a natural confident expression, eyes to camera. Photoreal, sharp eyes, square 1:1, no text.`;
      }
      return `Avatar of ${id}, drawn as ${type.en}. Waist-up, a friendly expression, wearing ${outfit}. Bold clean colours, square 1:1, no text.`;
    },
  }),
  card({
    id: "motion-graphics",
    icon: "🔷",
    line: "موشن جرافيك قصير: شعار يتحرك، شرح تطبيق، أو كلمات تنط على الشاشة.",
    needs: "شعارك أو لقطة شاشة تطبيقك (حسب النوع)",
    output: "video",
    prefer: VIDEO_GENS,
    refStyle: "references",
    slots: (c) => {
      const what = c("what").value;
      return what === "logo" ? [{ name: "logo", kind: "image", what: "شعارك" }] : what === "app" ? [{ name: "screen", kind: "image", what: "لقطة شاشة تطبيقك" }] : [];
    },
    inputs: [
      { key: "what", label: "وش يتحرك؟", kind: "choice", choices: [
        { value: "logo", label: "شعار", en: "logo" },
        { value: "app", label: "شاشة تطبيق", en: "app" },
        { value: "text", label: "نص متحرك", en: "text" },
      ] },
      { key: "words", label: "كلمات على الشاشة (٢–٤)", kind: "text", placeholder: "مثال: سريع · آمن · مجاني", optional: true, max: 40 },
      { key: "look", label: "الأسلوب", kind: "choice", choices: [
        { value: "clean", label: "نظيف مينيمال", en: "clean minimal style with soft gradients and rounded cards, smooth easing" },
        { value: "playful", label: "مرح ملوّن", en: "playful flat 2D vector style with pastel shapes and bouncy easing" },
        { value: "chrome", label: "3D لامع", en: "glossy 3D chrome style with light sweeps and snappy easing" },
        { value: "collage", label: "ريترو كولاج", en: "paper-cut retro collage style with grain and stepped motion" },
      ] },
    ],
    prompt: ({ v, c, sec }) => {
      const look = c("look").en;
      const words = v.words ? q(v.words) : "";
      const what = c("what").value;
      const body =
        what === "logo"
          ? `On a solid gradient background, light particles drift; the logo @logo (kept exactly: shape, colours and text) assembles from pieces that fly in and snap together, a light sweep passes across it, and it settles centred with a subtle glow${words ? `; then the words ${words} slide in under it` : ""}; the last second holds still.`
          : what === "app"
            ? `A phone mock-up slides in from the side and tilts slightly; inside it the app screenshot @screen (the exact UI of @screen); ${words ? `short labels ${words} pop out of the screen one by one as rounded cards` : "three rounded cards pop out of the screen one by one"}, a tap ripples on the first, and everything settles into a tidy layout.`
            : `Kinetic typography on a bright solid background: the words ${words || q("جاهز بضغطة")} slam in one after another in thick letters, each scaling up with an overshoot and sliding away as the next arrives; the final frame holds them stacked.`;
      return `Motion graphics, ${sec} seconds, 16:9, ${look}. ${body} One focus at a time, a 2–3 colour palette, consistent line weights. Sound: UI clicks, soft swooshes and a light music bed; no speech.`;
    },
  }),
  card({
    id: FIGHT_PLAYBOOK_ID,
    icon: "🥋",
    line: "مشهد قتال سينمائي بلقطات مرقّمة على طريقة كبار مخرجي الأكشن، بدون دم.",
    needs: "ولا شي: اختر المدرسة واكتب مين يتقاتل",
    output: "video",
    prefer: VIDEO_GENS,
    refStyle: "none",
    slots: () => [],
    inputs: [
      { key: "school", label: "مدرسة القتال", kind: "choice", choices: FIGHT_CHOICES },
      { key: "who", label: "مين يتقاتل؟", kind: "text", placeholder: "مثال: شاب بهودي رمادي ضد رجل ضخم", optional: true, max: 80 },
      { key: "place", label: "وين؟", kind: "text", placeholder: "مثال: مستودع مليان صناديق", optional: true, max: 60 },
    ],
    prompt: ({ v, c, sec }) => {
      const school = FIGHT_SCHOOLS.find((s) => s.id === c("school").value)!;
      const d = FIGHT_DEFAULTS[school.id] ?? { place: "a dusty warehouse full of crates", weapon: "bare hands" };
      const place = v.place ? q(v.place) : d.place;
      const who = v.who ? `The fighters: ${q(v.who)} — the first named stands screen-left, the other screen-right` : "An athletic young man in a grey hoodie (screen-left) against a huge bald man in a vest (screen-right)";
      const shots =
        school.id === "corridor"
          ? `SHOT 1 (0–${sec} s, one continuous take): a single lateral tracking shot from the side: the hero pushes forward through his opponents, each one entering from screen-right and dropping out of frame, the hero slowing and breathing hard by the end; one clean final strike, then silence.`
          : school.id === "samurai"
            ? `SHOT 1 (0–5 s, wide, symmetrical, low horizon): they stand still facing each other, wind moving the grass and their clothes, hands near the hilts. CUT TO SHOT 2 (5–6 s, insert): the hand closes on the hilt. CUT TO SHOT 3 (6–${sec} s, wide): one lightning-fast exchange of cuts, then both stand still back to back; the opponent slowly sinks to one knee, silence.`
            : `SHOT 1 (0–2 s, wide): the two face each other, the distance between them clear, a breath before the move. CUT TO SHOT 2 (2–4 s, medium two-shot): a fast exchange — strike, block, counter, each with weight from the back foot. CUT TO SHOT 3 (4–5 s, insert): insert of the back foot pivoting on the ground, dust kicked up. CUT TO SHOT 4 (5–7.5 s, medium, camera circling low): the hero uses the place itself as a weapon, the environment reacting (dust, splinters, something skidding). CUT TO SHOT 5 (7.5–${sec} s, wide): one decisive finish sends the opponent down; a two-frame freeze and a slight shake on the impact, then a held beat.`;
      return [
        `Cinematic fight scene, ${sec} seconds, 16:9, ${school.style}, high-energy. Photoreal, film grain, natural motion blur. NON-IP — generic people, men only, no known actor's likeness. No blood, no gore, no wounds.`,
        `Setting: ${place}. ${who}, ${d.weapon}; each keeps his side of the frame through every cut, the camera at their height, the action in the centre of the frame.`,
        `Choreography (${school.masters}): ${school.grammar}.`,
        shots,
        "Physics: weight shifting from the back foot, follow-through on every strike, the body reacting to each hit, hair and cloth trailing the motion.",
        `Sound: whooshes, the thud of each blow, blocks clacking, cloth snapping, feet scraping, grunts and breaths, no words${school.id === "tahtib" ? ", tahtib drums under it" : school.id === "wuxia" ? ", soaring strings" : ""}.`,
      ].join("\n\n");
    },
  }),
  card({
    id: TRANSFORM_PLAYBOOK_ID,
    icon: "🎬",
    line: "مقطعك نفسه بنفس الوجه والحركة، ويتغيّر شي واحد حوله: المكان أو الإضاءة أو الطقس.",
    needs: "مقطعك (٤–١٥ ثانية، ثابت وواضح)",
    note: "اضبط «المدة» على طول مقطعك، وغيّر شي واحد بكل مرة.",
    output: "video",
    prefer: ["byteplus-seedance-2-5", "byteplus-seedance-2-0", "kling-4", "wan-3-0"],
    refStyle: "references",
    slots: () => [{ name: "source", kind: "video", what: "مقطعك" }],
    inputs: [
      { key: "clip", label: "وش في مقطعك؟", kind: "text", placeholder: "مثال: شاب بقميص أزرق يتكلم للكاميرا في مكتب", optional: true, max: 100 },
      { key: "change", label: "وش يتغيّر؟", kind: "choice", choices: [
        { value: "environment", label: "المكان", en: "the environment around him" },
        { value: "relight", label: "الإضاءة والوقت", en: "the light and the time of day" },
        { value: "weather", label: "الطقس", en: "the weather and the sky" },
      ] },
      { key: "to", label: "يصير إيش؟", kind: "text", placeholder: "مثال: سطح بناية وقت الغروب", max: 80 },
    ],
    prompt: ({ v, c }) => {
      const change = c("change");
      const to = v.to ? q(v.to) : "a sunlit rooftop at golden hour";
      const clip = v.clip ? `original clip — ${q(v.clip)}` : "original clip of a person, as filmed";
      const fence = "Keep the person, his face, his clothes, his hands, the framing and the timing exactly as in @source.";
      const act =
        change.value === "relight"
          ? `Relight the whole frame to ${to}: the new light falls on him and on the place alike, with matched shadow direction and softness; his identity, expression, lip movement and wardrobe are locked while only light and grade change.`
          : change.value === "weather"
            ? `Change the weather to ${to}. It touches the plate truthfully — the sky, the ground, the surfaces, his hair and shoulders — with the light adjusted only as that weather would, the same key direction kept.`
            : `Replace only the environment: it becomes ${to}. The new world moves like the old one — the same parallax and speed as his motion — with a ground he really stands on and his own soft contact shadow on it. Keep his original light and light the new world to match it: the same key direction and softness, the world's bounce on him, matched haze, depth of field and grain, no cut-out edges or halos.`;
      return `@source: ${clip}. Preserve his identity, face, wardrobe, performance, framing, camera and motion exactly; change only ${change.en}.\n\nPhotoreal. The same aspect and length as @source. A natural cinematic grade. NON-IP — generic designs, nothing from a brand or a character. SFX and source dialogue only.\n\nOne continuous shot, the same framing as @source. ${fence} ${act} ${LOCK_CLAUSE}\n\nSFX and source dialogue only: his own voice as in the source, the new scene's quiet sound under it.`;
    },
  }),
];

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const readyAppById = (id: string) => READY_APPS.find((a) => a.id === id);

/** The inputs a card shows now (a choice that only matters after another one is hidden until then). */
export const visibleInputs = (app: ReadyApp, v: ReadyValues) => app.inputs.filter((i) => i.kind !== "choice" || !i.when || (v[i.when.key] ?? firstChoice(app, i.when.key)) === i.when.value);
const firstChoice = (app: ReadyApp, key: string) => {
  const i = app.inputs.find((x) => x.key === key);
  return i?.kind === "choice" ? i.choices[0].value : "";
};

/** The person's inputs cleaned: text trimmed to its length, a missing or unknown choice → its first one. */
export function readyValues(app: ReadyApp, given: ReadyValues = {}): ReadyValues {
  const out: ReadyValues = {};
  for (const i of app.inputs) {
    const raw = one(String(given[i.key] ?? ""));
    out[i.key] = i.kind === "text" ? raw.slice(0, i.max) : i.choices.some((c) => c.value === raw) ? raw : i.choices[0].value;
  }
  return out;
}

/** What a required text is missing, or null (shown on the card; the person can still press «استخدمه» and type it there). */
export const missingInput = (app: ReadyApp, v: ReadyValues) => app.inputs.find((i) => i.kind === "text" && !i.optional && !one(v[i.key] ?? "")) ?? null;

export interface ReadyForm {
  output: "image" | "video";
  prompt: string;
  /** the playbook's options with the chosen shape and sound (the generator keeps what it has: fitSettings) */
  settings: Settings;
  refStyle: RefStyle;
  slots: ReadySlot[];
  styleId: string;
}

/** The form a card fills: deterministic, from the playbook's recipe and the person's inputs. */
export function composeReady(app: ReadyApp, given: ReadyValues = {}): ReadyForm {
  const v = readyValues(app, given);
  const c: Chosen = (key) => chosen(app, v, key);
  const settings: Settings = { ...(playbookById(app.id)?.settings[app.output] ?? {}) };
  let styleId = "";
  for (const i of visibleInputs(app, v)) {
    if (i.kind !== "choice") continue;
    Object.assign(settings, c(i.key).settings ?? {});
    styleId = c(i.key).styleId ?? styleId;
  }
  const slots = app.slots(c);
  const prompt = app.prompt({ v, c, sec: Number(settings.duration ?? 5) }).trim();
  return { output: app.output, prompt, settings, refStyle: slots.length ? app.refStyle : "none", slots, styleId };
}

/** The side a thumbnail card leaves empty for the person's photo, or null for the other cards. */
export const composerSideOf = (app: ReadyApp, given: ReadyValues = {}) => {
  const v = readyValues(app, given);
  return app.composerSide ? app.composerSide((key) => chosen(app, v, key)) : null;
};

const ratioOf = (s: string) => {
  const [w, h] = s.split(":").map(Number);
  return w && h ? w / h : NaN;
};

/** The wanted options as one generator has them: a value it lacks → its nearest shape (or left at its default). */
export function fitSettings(def: GeneratorDef, wanted: Settings): Settings {
  const out: Settings = defaultSettings(def);
  for (const [key, value] of Object.entries(wanted)) {
    const o = def.options.find((x) => x.key === key);
    if (!o) continue;
    if (o.kind === "bool") out[key] = Boolean(value);
    else if (o.kind === "int") out[key] = Math.max(o.min, Math.min(o.max, Math.round(Number(value) || o.default)));
    else if (o.values.some((x) => x.value === String(value))) out[key] = String(value);
    else if (key === "aspect" || key === "ratio") {
      const want = ratioOf(String(value));
      const near = o.values.map((x) => ({ v: x.value, d: Math.abs(Math.log(ratioOf(x.value) / want)) })).filter((x) => Number.isFinite(x.d)).sort((a, b) => a.d - b.d)[0];
      if (near) out[key] = near.v;
    }
  }
  return out;
}

/** Whether a generator can take a card's form: its kind, and a way to use the references as the card does. */
export function suits(def: GeneratorDef, form: Pick<ReadyForm, "output" | "refStyle" | "slots">) {
  if (def.output !== form.output) return false;
  if (form.refStyle === "none") return def.modes.some((m) => m.refStyle === "none" && !m.needsOneOf);
  return def.modes.some((m) => {
    if (m.refStyle !== form.refStyle) return false;
    const kinds = new Set(form.slots.map((s) => s.kind));
    for (const k of kinds) if ((m.refs[k]?.max ?? 0) < form.slots.filter((s) => s.kind === k).length) return false;
    // a mode that requires another kind (an editor that needs a video) is not this card's
    return (Object.entries(m.refs) as [RefKind, { min: number }][]).every(([k, r]) => r.min === 0 || kinds.has(k));
  });
}

/** A generator of this account: the studio's list (`usable` = live, or hidden but the owner's). */
export interface ReadyGenerator {
  id: string;
  usable: boolean;
}

/**
 * The generator a card uses: the first of its preferred ones this account can use; else any other of the same kind
 * that takes the form (one that reads Arabic first when the prompt has Arabic); null when there is none.
 */
export function pickReadyGenerator(app: ReadyApp, form: Pick<ReadyForm, "output" | "refStyle" | "slots" | "prompt">, generators: ReadyGenerator[]): string | null {
  const arabic = hasArabic(form.prompt);
  const rank = (d: GeneratorDef) => (arabic && !d.prompt.arabic ? 100 : 0) + (app.prefer.includes(d.id) ? app.prefer.indexOf(d.id) : 50);
  const fit = generators.flatMap((g) => {
    const d = g.usable ? generatorById(g.id) : undefined;
    return d && suits(d, form) ? [d] : [];
  });
  return fit.sort((a, b) => rank(a) - rank(b))[0]?.id ?? null;
}

/** Every playbook has its card (a new playbook without one fails the tests). */
export const playbooksWithoutCard = () => PLAYBOOKS.filter((p) => !readyAppById(p.id)).map((p) => p.id);
