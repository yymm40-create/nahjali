// Background scenes for the booklet pages (generated once per art style by scripts/generate-scenes.mts).
// The child is NOT in these images; it is placed on top later, standing on the floor on the LEFT side.

/** Shared composition so every scene leaves room for the child (left) and the text cards (right). */
export const SCENE_LAYOUT = `Square children's book illustration, eye-level camera, wide shot. Composition: the LEFT 45% of the frame has a clear open floor area in the foreground where a child will later be placed standing (do NOT draw any person there); keep the RIGHT half and the TOP band calm and uncluttered (text cards will be placed there). Warm, magical, wholesome and inviting for 5–8 year old children. No people, no animals, no text, no letters, no logos.`;

const SHRINE = `the holy shrine of Imam Ali in Najaf: great golden dome, two golden minarets, golden clock tower gate, arches with turquoise and blue Islamic tile mosaics, shining marble courtyard`;

export const SCENES: Record<string, string> = {
  "shrine-day": `The marble courtyard of ${SHRINE}, bright sunny golden morning, soft clouds, white doves in the sky.`,
  "shrine-dawn": `The marble courtyard of ${SHRINE} at dawn, soft pink and golden first light, gentle glow, a few stars fading, peaceful and hopeful.`,
  "shrine-night": `${SHRINE} at night, glowing golden lights, deep navy starry sky with a crescent moon, magical and serene.`,
  "prayer-room": `A cozy, clean home prayer corner: a beautiful prayer rug on the floor with a small round clay prayer tablet (turbah) on it, a wooden shelf with a Quran and prayer beads (tasbih), a window showing a golden dome in the distance, warm daylight.`,
  "prayer-room-night": `The same cozy home prayer corner at night: prayer rug with a small clay turbah, a soft warm lamp glowing, a window showing a starry sky and a crescent moon, calm and spiritual.`,
  "quran-nook": `A warm reading nook at home: a carved wooden Quran stand (rahl) holding an open Quran on a soft carpet, floor cushions, a lantern, bookshelves, soft sunlight through a window with Islamic arch shape.`,
  "bedroom-morning": `A bright tidy child's bedroom in the morning: a neatly made bed with colorful blanket, a small bathroom door ajar showing a sink with a toothbrush cup, sunlight and curtains, cheerful.`,
  "bedroom-night": `The same child's bedroom at night: cozy bed with blanket and pillow, a glowing night lamp, window with a big moon and stars, a wall clock, sleepy calm blue and gold tones.`,
  "study-desk": `A cheerful study corner: a small wooden desk with notebooks, colorful pencils, a school backpack and a globe, a cork board with drawings, warm afternoon light.`,
  pattern: `A soft decorative background with an elegant Islamic geometric star pattern in gold and turquoise on warm ivory, gentle glow, very low contrast and calm (it will sit behind text tables), subtle sparkles. No focal objects.`,
};
