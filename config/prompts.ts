// All AI prompts live here so the art style can be tuned without touching app code.

/**
 * The look we want: a modern animated feature film still (see config/style-reference.png).
 * Written as concrete visual rules so the model fully stylizes instead of staying photo-real.
 */
export const STYLE = `ART STYLE — modern stylized Pixar-quality 3D animated feature film with a hand-painted finish, matching the style reference exactly:
- Fully stylized cartoon character, NOT a realistic human. Stylized proportions: slightly larger head, large expressive almond-shaped eyes with big glossy irises and bright catchlights, bold graphic eyebrows, small simplified nose, wide expressive mouth.
- Deliberate anime-influenced distortion and exaggerated squash-and-stretch in the shapes; confident, dynamic, expressive posing and acting.
- Simplified, sculpted, slightly faceted forms with crisp clean silhouettes; hair as big chunky sculpted clumps with a few loose flyaway strands.
- Flatter shading ramps (2–3 tone cel-like transitions), painterly brush-texture on surfaces, graphic simplification of secondary detail (simple clothing folds, minimal small details).
- Punchy saturated colour; warm golden key light with cool blue-teal shadows, strong rim light, cinematic lighting.
- Absolutely NO photorealism: no realistic skin pores, no photographic textures, no real-camera lighting, no realistic human proportions, no uncanny semi-real look.`;

/** Image used only to show the art style (sent as an extra reference image). Set the flags to false to stop sending it. */
export const STYLE_REFERENCE = {
  file: "config/style-reference.png",
  useForCharacter: true,
  useForPoses: true,
};

const STYLE_REFERENCE_NOTE = `The LAST reference image is a STYLE REFERENCE ONLY: copy its rendering style, shading, colour treatment, eye design and level of stylization. Do NOT copy anything else from it — not its character, face, outfit, creature, text, buildings or background.`;

// Shared framing rules so every image drops cleanly into the booklet slots (2:3 portrait).
const FRAMING = `Single character only, full body visible from head to feet, centered, facing the viewer, small empty margin around the character. No other people or creatures, no text, no logos, no props cut off by the frame.`;

export const CHARACTER_PROMPT = `Turn the person in the FIRST reference photo into a fully stylized animated movie character (a complete cartoon re-design, not a filtered photo).
Keep them clearly recognizable: same apparent age and gender, skin tone, hair colour and hairstyle, eye colour, face shape cues, facial hair, glasses or head covering if present, and the same outfit and outfit colours (simplified).
Pose: standing in a relaxed friendly pose with a warm confident smile. ${FRAMING} Plain flat light grey background.
${STYLE_REFERENCE.useForCharacter ? STYLE_REFERENCE_NOTE : ""}
${STYLE}`;

// Each pose uses the APPROVED character image as its first reference.
const POSE_BASE = `Use the exact same character as the FIRST reference image: identical face, hairstyle, skin tone, proportions, outfit and the same stylized cartoon rendering. Do not make the character more realistic. ${FRAMING}
Background: one flat solid pure green color (#00FF00, chroma key green screen) filling the whole frame, perfectly even, no gradient, no floor, no cast shadow on the background. Do not use that bright green anywhere on the character or props.
${STYLE_REFERENCE.useForPoses ? STYLE_REFERENCE_NOTE : ""}`;

export const POSE_PROMPTS: Record<string, string> = {
  reading: `${POSE_BASE}\nPose: standing and happily reading an open colorful book held with both hands, eyes on the pages.\n${STYLE}`,
  praying: `${POSE_BASE}\nPose: standing calmly on a small prayer rug, both open palms raised in front of the chest in a respectful supplication (dua), peaceful expression.\n${STYLE}`,
  sleeping: `${POSE_BASE}\nPose: standing in cozy pajamas, hugging a soft pillow, eyes half closed and yawning sleepily.\n${STYLE}`,
  eating: `${POSE_BASE}\nPose: standing and holding a plate full of colorful healthy food (vegetables, fruit), biting into a fresh red apple with a delighted expression.\n${STYLE}`,
  exercising: `${POSE_BASE}\nPose: in sporty clothes doing an energetic jumping-jack, arms up, dynamic and joyful, both feet visible.\n${STYLE}`,
  happy: `${POSE_BASE}\nPose: jumping with joy, both arms raised in celebration, big proud smile.\n${STYLE}`,
};

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
