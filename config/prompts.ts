// All AI prompts live here so the look can be tuned without touching app code.
// Art styles are in config/styles.ts.

import { STYLES, type StyleKey } from "./styles";

export type Gender = "boy" | "girl";

/** Shared rules that keep every character child-friendly and fully stylized. */
const STYLIZE = `A fully stylized cartoon CHILD character (about 5–8 years old), NOT a realistic human: no photorealism, no realistic skin pores, no photographic lighting. Big expressive eyes, warm friendly expression, modest and wholesome.`;

/** Girls: always a full Zainabiya abaya, face and hands only, no makeup. */
const GIRL_DRESS = `She wears a modest black Iraqi Zainabiya abaya: one loose black cloak draped from the top of the head down to the ankles, worn over a snug underscarf that tightly frames the face; ALL hair, ears and neck fully covered; long loose sleeves to the wrists; only the face and the hands are visible. Absolutely no makeup, no lipstick, no jewelry — a natural child's face.`;

/** Boys keep the SAME clothes as in the uploaded photo on every page (owner's request) and never wear a cap. */
const BOY_DRESS = `He wears exactly the same clothes as the child in the FIRST reference image (same garments, colours and patterns), simplified in the cartoon style. Do not change his outfit. Nothing on his head: no cap, no hat, no kufi.`;

const dress = (gender: Gender) => (gender === "girl" ? GIRL_DRESS : BOY_DRESS);

const FRAMING = `Single character only, full body visible from head to feet, standing on the ground, centered, small empty margin around the character. No other people or creatures, no text, no logos, no props cut off by the frame.`;

const GREEN_SCREEN = `Background: one flat solid pure green color (#00FF00, chroma key green screen) filling the whole frame, perfectly even, no gradient, no floor, no cast shadow on the background. Do not use that bright green anywhere on the character or props.`;

const STYLE_REFERENCE_NOTE = `The LAST reference image is a STYLE REFERENCE ONLY: copy its rendering style, shading and colour treatment. Do NOT copy anything else from it — not its character, outfit, creature, text, buildings or background.`;

export const hasStyleReference = (style: StyleKey) => Boolean(STYLES[style].referenceImage);

/** Base character made from the child's photo (shown to the parent for approval). */
export function characterPrompt(style: StyleKey, gender: Gender) {
  return [
    `Turn the child in the FIRST reference photo into a stylized animated movie character (a complete cartoon re-design, not a filtered photo).`,
    `Keep them clearly recognizable: same face shape, skin tone, eye colour and features${gender === "boy" ? ", hair colour and hairstyle" : ""}.`,
    STYLIZE,
    dress(gender),
    `Pose: standing relaxed with a warm happy smile, facing the viewer.`,
    FRAMING,
    `Plain flat light grey background.`,
    hasStyleReference(style) ? STYLE_REFERENCE_NOTE : "",
    `ART STYLE: ${STYLES[style].prompt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Poses used by the booklet pages (several pages may reuse one pose). */
export const POSES: Record<string, { action: string }> = {
  happy: { action: "jumping with joy, both arms raised in celebration, big proud smile" },
  praying: {
    action:
      "standing in Shia prayer (qiyam), facing the viewer, on a prayer rug that lies flat on the floor under the feet and extends forward toward the viewer: body upright, arms resting straight down at the sides (hands NOT folded), calm peaceful face, eyes lowered. One small round clay prayer tablet (turbah) lies on the rug a little in front of the feet, centered, exactly where the forehead would touch in prostration. Only ONE rug and ONE turbah",
  },
  quran: { action: "standing and lovingly reading an open Holy Quran held with both hands, gentle smile" },
  morning: { action: "cheerfully brushing teeth with a toothbrush, fresh and awake, morning energy" },
  sleeping: { action: "standing sleepily hugging a soft pillow, eyes half closed, yawning" },
  salam: {
    action: "standing respectfully with the right hand placed on the chest in greeting, a slight respectful bow of the head, gentle smile",
  },
  studying: { action: "holding an open notebook and a pencil, thinking happily, ready to study" },
};

/** One pose, made from the APPROVED character image (first reference). */
export function posePrompt(poseKey: string, style: StyleKey, gender: Gender) {
  const pose = POSES[poseKey];
  if (!pose) throw new Error(`Unknown pose "${poseKey}" (config/prompts.ts → POSES)`);
  return [
    `Use the exact same child character as the FIRST reference image: identical face, skin tone, proportions and the same stylized cartoon rendering. Do not make the character more realistic.`,
    STYLIZE,
    dress(gender),
    `Pose: ${pose.action}.`,
    FRAMING,
    GREEN_SCREEN,
    hasStyleReference(style) ? STYLE_REFERENCE_NOTE : "",
    `ART STYLE: ${STYLES[style].prompt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const GENERATION_SETTINGS = {
  model: "gpt-image-2",
  size: "1024x1536",
  // Image quality comes from the tier the customer picks (config/pricing.ts → QUALITY_TIERS)
  /**
   * Ask OpenAI for a real transparent background on poses. Off: this account gets
   * "Transparent background is not supported for this model" on the edit endpoint,
   * so poses are made on a green screen and the app removes it (src/lib/openai.ts).
   */
  transparentBackground: false,
} as const;
