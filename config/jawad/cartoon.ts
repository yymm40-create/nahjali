export const CARTOON_IMAGE = "openai-gpt-image-2";
export const CARTOON_VIDEO = "byteplus-seedance-2-5";
export const CARTOON_PRICE = 200;
export const CARTOON_STYLES = [
  { id: "cinematic-3d", name: "سينمائي 3D", text: "Fully cartoon feature-film 3D, sculpted stylized surfaces, moderate proportions, expressive but not oversized eyes, soft lighting." },
  { id: "soft-2d", name: "كرتون 2D ناعم", text: "Fully hand-drawn 2D cartoon, clean contours, soft cel shading, distinctive facial silhouette." },
  { id: "storybook", name: "قصة مصوّرة", text: "Warm illustrated storybook character, painterly color, clear recognizable facial contours." },
  { id: "anime", name: "أنمي معتدل", text: "Moderate anime cel shading; retain distinctive nose, jaw, brows and skin tone rather than a generic anime face." },
  { id: "clay", name: "صلصال", text: "Fully stylized clay-animation character, distinctive facial features sculpted in soft clay." },
] as const;
export const CARTOON_AGES = { same: "نفس العمر", baby: "رضيع", toddler: "طفل صغير", child: "طفل", adult: "بالغ" } as const;
export const CARTOON_MOVES = { still: "ساكن / يتفاعل بيديه", crawl: "يحبي", walk: "يمشي" } as const;
export const CARTOON_STORIES = {
  space: "مغامرة الفضاء",
  garden: "الحديقة السحرية",
  sea: "عالم البحر",
  custom: "قصتي الخاصة",
} as const;
export interface CartoonInput {
  style: string;
  age: keyof typeof CARTOON_AGES;
  desiredAge: string;
  movement: keyof typeof CARTOON_MOVES;
  outfit: string;
  interests: string;
  story: keyof typeof CARTOON_STORIES;
  customStory: string;
  count: number;
  video: boolean;
  consent: boolean;
}
export function cartoonInput(raw: unknown): CartoonInput {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const field = (name: string, max: number) => String(value[name] ?? "").trim().slice(0, max);
  if (!CARTOON_STYLES.some(style => style.id === value.style)) throw new Error("اختر الستايل.");
  if (!Object.hasOwn(CARTOON_AGES, String(value.age)) || !Object.hasOwn(CARTOON_MOVES, String(value.movement))) throw new Error("اختر العمر والحركة.");
  if (!Object.hasOwn(CARTOON_STORIES, String(value.story))) throw new Error("اختر القصة.");
  if (!Number.isInteger(value.count) || Number(value.count) < 1 || Number(value.count) > 4) throw new Error("اختر من صورة إلى أربع صور.");
  if (value.consent !== true) throw new Error("أكد أن لديك إذن استخدام الصور، وموافقة ولي الأمر لصور الأطفال.");
  if (value.video === true && value.story === "custom" && !field("customStory", 3000)) throw new Error("اكتب قصتك أولًا.");
  return { style: String(value.style), age: value.age as CartoonInput["age"], desiredAge: field("desiredAge", 60), movement: value.movement as CartoonInput["movement"], outfit: field("outfit", 400), interests: field("interests", 400), story: value.story as CartoonInput["story"], customStory: field("customStory", 3000), count: Number(value.count), video: value.video === true, consent: true };
}
const AGE = { same: "the same apparent age as the references", baby: "a cartoon baby, age-reinterpreted infant proportions", toddler: "a cartoon toddler", child: "a cartoon child", adult: "a cartoon adult" };
const MOVE = { still: "a stable safe seated pose, interacting with hands and expressions, not walking", crawl: "crawling on hands and knees on safe level ground, visible grounded contacts, low camera", walk: "walking with short balanced steps, feet contacting the ground without sliding" };
export function cartoonIdentity(input: CartoonInput) {
  return [
    CARTOON_STYLES.find(style => style.id === input.style)!.text,
    "Fully cartoon face AND body, not a filtered photograph or photoreal face on a cartoon body.",
    "Preserve recognizable face outline, eye spacing, brows, nose and mouth silhouette, skin tone, hair and visible distinctive features. Do not replace them with a generic cute face.",
    "Age: " + (input.desiredAge || AGE[input.age]) + ". Age changes are imaginative reinterpretations, not historical reconstruction. Adapt age-dependent proportions and facial hair appropriately.",
    "Movement: " + MOVE[input.movement] + ". Keep age and movement consistent throughout; fantasy baby movement is cartoon fiction.",
    "Outfit: " + (input.outfit || "retain the reference clothing, adapted to the chosen age") + ". Interests: " + (input.interests || "a gentle colorful adventure") + ".",
  ].join("\n");
}
export function cartoonImagePrompt(input: CartoonInput, canonical = false) {
  return (canonical
    ? "Image 1 is the canonical CARTOON character. Reuse its exact identity, age, outfit and style. Create a new pose or composition of this same character. "
    : "All supplied identity references depict ONE person. Create one recognizable cartoon character inspired by their visible features. References supply identity, not photographic rendering. ") +
    cartoonIdentity(input) + "\nOne character in a single composition, face readable, coherent anatomy. Do not add unrequested text; allow text or logos explicitly requested in the outfit/brief.";
}
export function cartoonVideoPrompt(input: CartoonInput) {
  const story = input.story === "custom" ? input.customStory : {
    space: "0–7s: discovers a glowing star in a safe cartoon observatory. 7–16s: reacts to colorful planets through the window. 16–24s: reaches toward a large button; stars form a beautiful pattern. 24–30s: smiles beside the glowing star.",
    garden: "0–7s: notices a luminous flower in a safe garden. 7–16s: reacts to a friendly butterfly. 16–24s: the flower opens and softly lights the garden. 24–30s: a delighted expression and a calm ending.",
    sea: "0–7s: discovers a shell inside a dry safe underwater observation room. 7–16s: watches a colorful fish through glass. 16–24s: waves as the fish swims in a clear arc. 24–30s: smiles and waves goodbye.",
  }[input.story];
  return "30 seconds, vertical 9:16 cartoon film. @character is the canonical character: preserve the same stylized face, proportions, outfit and age in every shot.\n" + cartoonIdentity(input) +
    "\nStory: " + story + "\nAdapt actions to the selected movement; a stationary baby watches/reaches, never walks. Use 3–4 clear beats, one action per beat, gentle camera moves and grounded motion. No age or style morph. Gentle original music and appropriate foley; no invented spoken dialogue. Do not copy the photo background.";
}
export const CARTOON_VIDEO_SETTINGS = { ratio: "9:16", resolution: "720p", duration: 30, audio: true } as const;

