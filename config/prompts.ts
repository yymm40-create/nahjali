// All AI prompts live here so the look can be tuned without touching app code.
// Art styles are in config/styles.ts.

import { STYLES, type StyleKey } from "./styles";

export type Gender = "boy" | "girl";

/** Shared rules that keep every character child-friendly and fully stylized. */
const STYLIZE = `A fully stylized cartoon CHILD character (about 5–8 years old), NOT a realistic human: no photorealism, no realistic skin pores, no photographic lighting. Big expressive eyes, warm friendly expression, modest and wholesome.`;

/**
 * «كتيب الجداول الذكي» also makes booklets for grown-ups: who the character is (a child by default). A grown-up is drawn
 * as a stylized cartoon adult of about their age, never realistic; a woman is dressed and covered exactly like a girl.
 */
export interface Who {
  adult: boolean;
  age?: number;
}
const stylize = (who?: Who) =>
  who?.adult
    ? `A fully stylized cartoon ADULT character (about ${Math.max(18, Math.min(80, who.age ?? 30))} years old), NOT a realistic human: no photorealism, no realistic skin pores, no photographic lighting. Friendly expressive eyes, warm expression, modest and wholesome.`
    : STYLIZE;

/** Girls: always a full Zainabiya abaya, face and hands only, no makeup, and NOT ONE hair visible. */
const GIRL_DRESS = `She wears a modest black Iraqi Zainabiya abaya: one loose black cloak draped from the top of the head down to the ankles, worn over a snug underscarf that tightly frames the face; ALL hair, ears and neck fully covered; long loose sleeves to the wrists; only the face and the hands are visible. Absolutely no makeup, no lipstick, no jewelry — a natural child's face.`;

/** Repeated at the very end of every girl prompt, so it wins over anything seen in her photo. */
export const GIRL_NO_HAIR = `ABSOLUTE RULE — ZERO HAIR VISIBLE: do not draw a single hair anywhere. Ignore the hair in the photo completely (do not copy its colour, fringe, bangs, parting or style). The underscarf edge sits across the upper forehead and tightly around the cheeks, hiding the entire hairline: no strands on the forehead, temples, cheeks or neck, no hair peeking from under the scarf, no braid, no ponytail, no hair on the shoulders or back. The head covering is fully opaque black fabric.`;

/** Asked to an image-reading model after every girl image; anything but "NO" rejects the picture. */
export const HAIR_CHECK = {
  model: "gpt-4o-mini",
  prompt: `This is a cartoon picture of a girl who must wear a full hijab. Look very carefully at the forehead, temples, cheeks, around the face, the neck, shoulders and back. Is ANY hair visible at all — even a single strand, fringe, bangs, a lock under the scarf edge, a braid or a ponytail? Answer with exactly one word: YES or NO.`,
  /**
   * Extra generations in the same request when hair is found (each costs money and ~1–2 minutes; a request may
   * run 5 minutes). Poses get no extra one here: a rejected pose goes back to the queue and is retried like any
   * failed pose (POSE_MAX_RETRIES).
   */
  retries: { character: 1, pose: 0 },
};

/** Boys keep the SAME clothes as in the uploaded photo on every page (owner's request) and never wear a cap. */
const BOY_DRESS = `He wears exactly the same clothes as the child in the FIRST reference image (same garments, colours and patterns), simplified in the cartoon style. Do not change his outfit. Nothing on his head: no cap, no hat, no kufi.`;

/** The outfit; a grown-up's says "person" where a child's says "child" (the rules themselves are the same). */
const dress = (gender: Gender, who?: Who) => {
  const d = gender === "girl" ? GIRL_DRESS : BOY_DRESS;
  return who?.adult ? d.replace("a natural child's face", "a natural face").replace("the child in the FIRST", "the person in the FIRST") : d;
};

const FRAMING = `Single character only, full body visible from head to feet, standing on the ground, centered, small empty margin around the character. No other people or creatures, no text, no logos, no props cut off by the frame.`;

const GREEN_SCREEN = `Background: one flat solid pure green color (#00FF00, chroma key green screen) filling the whole frame, perfectly even, no gradient, no floor, no cast shadow on the background. Do not use that bright green anywhere on the character or props.`;

const STYLE_REFERENCE_NOTE = `The LAST reference image is a STYLE REFERENCE ONLY: copy its rendering style, shading and colour treatment. Do NOT copy anything else from it — not its character, outfit, creature, text, buildings or background.`;

export const hasStyleReference = (style: StyleKey) => Boolean(STYLES[style].referenceImage);

/** Base character made from the child's photo (shown to the parent for approval). */
export function characterPrompt(style: StyleKey, gender: Gender, who?: Who) {
  return [
    `Turn the ${who?.adult ? "person" : "child"} in the FIRST reference photo into a stylized animated movie character (a complete cartoon re-design, not a filtered photo).`,
    gender === "boy"
      ? `Keep them clearly recognizable: same face shape, skin tone, eye colour and features, hair colour and hairstyle.`
      : `Keep her clearly recognizable from her FACE ONLY: same face shape, skin tone, eye colour and facial features. Take nothing from her hair or clothes in the photo.`,
    stylize(who),
    dress(gender, who),
    `Pose: standing relaxed with a warm happy smile, facing the viewer.`,
    FRAMING,
    `Plain flat light grey background.`,
    hasStyleReference(style) ? STYLE_REFERENCE_NOTE : "",
    `ART STYLE: ${STYLES[style].prompt}`,
    gender === "girl" ? GIRL_NO_HAIR : "",
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
export function posePrompt(poseKey: string, style: StyleKey, gender: Gender, who?: Who) {
  const pose = POSES[poseKey];
  if (!pose) throw new Error(`Unknown pose "${poseKey}" (config/prompts.ts → POSES)`);
  return [
    `Use the exact same ${who?.adult ? "" : "child "}character as the FIRST reference image: identical face, skin tone, proportions and the same stylized cartoon rendering. Do not make the character more realistic.`,
    stylize(who),
    dress(gender, who),
    `Pose: ${pose.action}.`,
    FRAMING,
    GREEN_SCREEN,
    hasStyleReference(style) ? STYLE_REFERENCE_NOTE : "",
    `ART STYLE: ${STYLES[style].prompt}`,
    gender === "girl" ? GIRL_NO_HAIR : "",
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
