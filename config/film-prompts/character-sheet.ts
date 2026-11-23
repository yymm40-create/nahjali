// The film maker's character sheet (the owner, 23 Nov 2026: «الكاركترشيت خلاص وحدة فكل صانع الفيلم»): every character
// sheet — one the sheet maker designs, a real person converted to the style, or a series' cast member — is exactly
// three panels on plain grey: the character in three-quarter view from just above the chest up, the whole body from
// the front with NO face (from the neck down), and the whole body from the back. Only those three: the face appears
// once, so the video model follows one clear face. The layout is added to the character's look by the code, word for
// word, so it never drifts.

export const CHARACTER_SHEET_LAYOUT =
  "CHARACTER REFERENCE SHEET LAYOUT, exactly this and nothing else: three tall panels side by side, evenly spaced, the same height, thin gaps between them. " +
  "Every panel has the same plain flat neutral medium grey background (not white, not black), even soft studio lighting, no scenery, no props. " +
  "LEFT PANEL: the character in a three-quarter view framed from just above the chest up (head, neck, shoulders and the top of the chest), the face turned three-quarters toward the viewer, calm natural expression, the face large, sharp and clear. " +
  "MIDDLE PANEL: full front view of the character's body framed from the neck down: the top edge of this panel cuts just below the chin, so the head and face are not visible in this panel at all; the neck, clothing, arms, hands, legs and feet are visible, standing straight in a relaxed neutral pose, arms at the sides. " +
  "RIGHT PANEL: full-body back view in the same pose and outfit, from the back of the head down to the feet. " +
  "The middle and right panels show the body at the same scale. The only face in the whole sheet is in the left panel. " +
  "If the character's face is covered, veiled, hidden in light or featureless by the approved design, keep it exactly so in the left panel too. " +
  "The same character, outfit, colours and art style in all three panels. No other views, no expression studies, no close-ups, no colour swatches, no text, no labels, no numbers, no logos, no watermark.";

/** What the writer of a character's prompt is told: the look only, because the layout above is added after it. */
export const CHARACTER_LOOK_RULE =
  "the CHARACTER'S LOOK for a character reference sheet whose layout is fixed and added after your text by the website (three panels: three-quarter view from above the chest, front body without the face, back view): describe only the character (age, build, face shape, eyes, eyebrows, nose, mouth, hair, skin tone, clothing and its colours, shoes, key accessories) and the rendering style. Do not describe panels, views, poses, expressions, backgrounds, lighting or framing.";

/** A character's picture prompt: the look, then the fixed layout (once). */
export const withCharacterLayout = (look: string) => (hasCharacterLayout(look) ? look.trim() : `${look.trim()}\n\n${CHARACTER_SHEET_LAYOUT}`);

/** Whether a prompt already ends with the fixed layout. */
export const hasCharacterLayout = (prompt: string) => prompt.includes(CHARACTER_SHEET_LAYOUT);
