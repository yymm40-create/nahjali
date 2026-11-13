// «حوّل شخصية واقعية إلى كرتون» in the sheet maker (src/lib/film/sheets.ts): the approved method (2 November 2026).
// Three steps in order, each one approved before the next:
//   1. the person's features are written from his real photo (the likeness block);
//   2. a SINGLE image (waist-up, 3:4) in the film's style, its only reference that real photo — every real photo the
//      person gives is converted on its own, as it is (its outfit, its setting, its expression);
//   3. the character sheet (16:9) from the approved single image(s) only — never from the real photo, so the generator
//      copies the same character instead of designing him again.
// The style text goes into STYLE exactly as it is in the library (config/film-styles.ts).

export type ConvertGender = "boy" | "girl" | "man" | "woman";

/** What step 1 writes for one real photo (stored on that upload's meta.likeness). */
export interface Likeness {
  gender: ConvertGender;
  /** the filled «KEEP his identity fully recognizable…» block, English */
  likeness: string;
  /** the outfit as seen in the photo, e.g. "the same red football jersey with a dark green V collar" */
  outfit: string;
  /** what he wears below the waist on the full-body views, e.g. "below the jersey he wears dark navy sports shorts and white sneakers" */
  lower_body: string;
  /** a short style name for «Transform … into …», e.g. "an anime character" */
  style_short: string;
}

const PRONOUN = {
  boy: { him: "him", his: "his", He: "He" },
  man: { him: "him", his: "his", He: "He" },
  girl: { him: "her", his: "her", He: "She" },
  woman: { him: "her", his: "her", He: "She" },
} as const;
export const pronouns = (g: ConvertGender) => PRONOUN[g] ?? PRONOUN.man;

/** Added at the end of the style text when the single image came out semi-realistic («أكثر كرتونية»). */
export const MORE_STYLIZED = "fully animated, more stylized";

/** Step 1: the features from one real photo, written into the method's likeness template. */
export const LIKENESS_SYSTEM = `You write the likeness block of a real person's photo, for turning that person into a stylized animated character with an image generator. Look ONLY at the attached photo.

Fill this template exactly, replacing every bracket with what you see (keep the wording outside the brackets word for word, choose his/her and He/She by the person):
KEEP [his/her] identity fully recognizable as the same [boy/girl/man/woman] from the reference photo: [FACE SHAPE AND CHIN], [HAIR: length, color, texture, cut, hairline], [EYEBROWS: thickness, shape, distance from eyes], [EYES: color, shape, lids, expression], [NOSE: shape, tip], [MOUTH/SMILE], [CHEEKS], [EARS], [SKIN TONE], about [AGE] years old. Keep the spacing and proportions between [his/her] eyes, nose and mouth exactly as in the photo, the same head tilt and the same expression. [He/She] wears [OUTFIT IN THE PHOTO], with no logos or badges. Setting: [BACKGROUND IN THE PHOTO].

Example of a filled block:
KEEP his identity fully recognizable as the same boy from the reference photo: a slightly long oval face with a narrow rounded chin, short dark brown curly hair cut short on the sides with a little volume on top and a straight low hairline, thick straight dark eyebrows sitting close to the eyes, dark brown almond-shaped eyes with slightly heavy lids squinting happily, a soft rounded nose with a wide rounded tip, a wide closed-mouth cheeky grin lifted a little more on one side, round cheeks, ears that stick out a little, light warm olive skin, about eleven years old. Keep the spacing and proportions between his eyes, nose and mouth exactly as in the photo, the same slight head tilt and the same expression. He wears the same red football jersey with a dark green V collar, with no logos or badges. Setting: the same old traditional mud-brick courtyard with a weathered wooden door, a palm trunk, patterned floor cushions and dappled sunlight through leaves.

Be precise and concrete about the face: this description is what keeps the likeness. Describe what is there, never flatter or judge.
Also return:
- "gender": boy, girl, man or woman.
- "outfit": the outfit as in the photo, short, e.g. "the same red football jersey with a dark green V collar" (no logos or badges).
- "lower_body": what the person wears below the waist on full-body views, as one clause, e.g. "below the jersey he wears dark navy sports shorts and white sneakers". If the photo shows below the waist, describe it; if not, decide something that suits the outfit and the person (trousers, shorts, shoes…).
- "style_short": a short English name of the target style given in the message, as "a/an … character", e.g. "an anime character", "a 3D animated character", "a clay animation character".
All values in English.`;

export const LIKENESS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["gender", "likeness", "outfit", "lower_body", "style_short"],
  properties: {
    gender: { type: "string", enum: ["boy", "girl", "man", "woman"] },
    likeness: { type: "string" },
    outfit: { type: "string" },
    lower_body: { type: "string" },
    style_short: { type: "string" },
  },
} as const;

/** Step 2: the single image of one real photo (its only reference: that photo). */
export function portraitPrompt(l: Likeness, styleText: string, moreStylized = false) {
  const style = styleText.trim().replace(/\s*$/, "") + (moreStylized ? ` ${MORE_STYLIZED}.` : "");
  return `Transform the ${l.gender} in the reference photo into ${l.style_short}. Still image, waist-up portrait. ${l.likeness.trim()} STYLE: ${style} Fully stylized, not semi-realistic, no photographic texture anywhere. AVOID: photorealism, realistic skin pores, warped features, extra people, text, logos, watermark.`;
}

/**
 * Step 3: the character sheet from the approved single image(s) only. One single image is the method itself; with
 * more (one per real photo), the first is the main one (its outfit) and the others are the same character.
 */
export function convertSheetPrompt(l: Likeness, references = 1) {
  const p = pronouns(l.gender);
  const many = references > 1;
  const ref = many ? "the reference images" : "the reference image";
  const intro = many
    ? `Turn the character in the reference images into a character reference sheet. All ${references} reference images show the same character; the FIRST one is the main reference. It must be the EXACT same character as in the reference images, do not redesign ${p.him} and do not make ${p.him} younger or older:`
    : `Turn the character in the reference image into a character reference sheet. It must be the EXACT same character as in the reference image, do not redesign ${p.him} and do not make ${p.him} younger or older:`;
  return `${intro} copy ${p.his} face shape, eyes, eyebrows, nose, smile, ears, hair shape and hair color, skin tone, age, head size and body proportions, ${l.outfit.trim()}${many ? " (as in the first reference image)" : ""}, and the exact same art style, rendering, materials, line work and colors as ${ref}. Only the background and the poses change. Plain flat neutral medium grey background, even soft studio lighting, no scenery. TOP ROW: four full-body views of ${p.him} standing in a relaxed neutral pose, evenly spaced, all at the same scale, feet visible: front view, three-quarter view, side profile view, back view; ${l.lower_body.trim().replace(/\.$/, "")}. BOTTOM ROW: five head-and-shoulders close-ups of the same face with different expressions: happy grin, big laugh, surprised, thinking, sad. Every view must look like ${ref}. No text, no labels, no numbers, no logos, no watermark.`;
}

/** Single images one press makes for a real photo (the method: 3, then the closest face is chosen). */
export const PORTRAITS_PER_PHOTO = 3;
/** Sheets one press makes from the chosen single images (the method: 2, then the better one is chosen). */
export const CONVERT_SHEETS = 2;
