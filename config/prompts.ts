// All AI prompts live here so the art style can be tuned without touching app code.

export const STYLE = `Illumination Entertainment 3D animation style. Rounded simplified shape language, smooth clean low-noise surfaces, broad readable forms, high-saturation color, soft even lighting with gentle contrast, reduced detail density, friendly accessible rendering.`;

// Shared framing rules so every image drops cleanly into the booklet slots (2:3 portrait).
const FRAMING = `Single character only, full body visible from head to feet, centered, facing the viewer, small empty margin around the character. No other people, no text, no logos, no props cut off by the frame.`;

export const CHARACTER_PROMPT = `Transform the person in the reference photo into a full-body 3D animated character, keeping their recognizable facial features, hairstyle and clothing. Standing in a relaxed friendly pose with a warm smile. ${FRAMING} Plain light grey studio background. ${STYLE}`;

// Each pose uses the APPROVED character image as its reference.
const POSE_BASE = `Use the exact same character from the reference image: same face, hairstyle, skin tone, body proportions and outfit. ${FRAMING} Background: one flat solid pure green color (#00FF00, chroma key green screen) filling the whole frame, perfectly even, no gradient, no floor, no cast shadow on the background. Do not use that bright green anywhere on the character or props.`;

export const POSE_PROMPTS: Record<string, string> = {
  reading: `${POSE_BASE} The character is standing and happily reading an open colorful book held with both hands, eyes on the pages. ${STYLE}`,
  praying: `${POSE_BASE} The character is standing calmly on a small prayer rug, both open palms raised in front of the chest in a respectful supplication (dua), peaceful expression. ${STYLE}`,
  sleeping: `${POSE_BASE} The character is standing in cozy pajamas, hugging a soft pillow, eyes half closed and yawning sleepily. ${STYLE}`,
  eating: `${POSE_BASE} The character is standing and holding a plate full of colorful healthy food (vegetables, fruit), biting into a fresh red apple with a delighted expression. ${STYLE}`,
  exercising: `${POSE_BASE} The character is in sporty clothes doing an energetic jumping-jack, arms up, dynamic and joyful, both feet visible. ${STYLE}`,
  happy: `${POSE_BASE} The character is jumping with joy, both arms raised in celebration, big proud smile. ${STYLE}`,
};

export const GENERATION_SETTINGS = {
  model: "gpt-image-2",
  size: "1024x1536",
  quality: "high",
  /**
   * Ask OpenAI for a real transparent background on poses. Off: this account gets
   * "Transparent background is not supported for this model" on the edit endpoint,
   * so poses are made on a green screen and the app removes it (src/lib/openai.ts).
   */
  transparentBackground: false,
} as const;
