// The layout of a series character's reference picture (سجاد's «🎭 الشخصيات والبيئات»). Adopted from Higgsfield's
// "same AI face in every shot" rule: a plain grey background, three views only (a face close-up, the body from the
// front, the body from the back), and NO face on the front body view, so the video model has one clear face to follow.
// سجاد writes only the character's look; this layout is added to it by the code, word for word, so it never drifts.

export const CHARACTER_SHEET_LAYOUT =
  "CHARACTER REFERENCE SHEET LAYOUT, exactly this: three tall panels side by side, evenly spaced, the same height, thin gaps between them. " +
  "Every panel has the same plain flat neutral medium grey background (not white, not black), even soft studio lighting, no scenery, no props. " +
  "LEFT PANEL: head-and-shoulders close-up of the character's face looking straight forward, calm natural expression, the face large, sharp and clear. " +
  "MIDDLE PANEL: front view of the character's body framed from the neck down: the top edge of this panel cuts just below the chin, so the head and face are not visible in this panel at all; the neck, clothing, arms, legs and feet are visible, standing straight in a relaxed neutral pose, arms at the sides. " +
  "RIGHT PANEL: full-body back view in the same pose and outfit, the back of the head and the hair visible. " +
  "The middle and right panels show the body at the same scale. The only face in the whole sheet is the close-up in the left panel. " +
  "The same character, outfit, colours and art style in all three panels. No text, no labels, no numbers, no logos, no watermark.";

/** What سجاد writes for a character: the look only, because the layout above is added after it. */
export const CHARACTER_LOOK_RULE =
  "the CHARACTER'S LOOK for a reference sheet whose layout is fixed and added after your text: describe only the character (age, build, face shape, eyes, eyebrows, nose, mouth, hair, skin tone, clothing and its colours, shoes, key accessories) and the series' rendering style, in one or two paragraphs. Do not describe panels, views, poses, backgrounds, lighting or framing.";

/** A character's picture prompt: the look سجاد wrote, then the fixed layout. */
export const withCharacterLayout = (look: string) => `${look.trim()}\n\n${CHARACTER_SHEET_LAYOUT}`;

/** A stored character prompt from before this layout is written again, so a redraw follows the new layout. */
export const hasCharacterLayout = (prompt: string) => prompt.includes(CHARACTER_SHEET_LAYOUT);
