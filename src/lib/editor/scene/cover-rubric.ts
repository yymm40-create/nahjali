// «🎬 مختبر الموشن» · «🖼️ الكفر»: the cover's score sheet (shared by the page and the server). Pure.

/** The cover's score sheet: every criterion 1–10; it is kept only when every one is ≥ COVER_PASS. */
export const COVER_RUBRIC = [
  { id: "read", ar: "يُقرأ صغير", en: "At the profile grid's size (the 12 % picture) the headline is read at a glance; nothing important is under the skill's minimum sizes (headline ≥ 170 px, any other text ≥ 110 px, logos ≥ 200 px, lines ≥ 10 px)" },
  { id: "square", ar: "المربع الآمن", en: "Everything that must be seen (face, headline, logos) sits inside the centre 1:1 square (portrait y 420–1500); outside it only background; it survives the 1:1, 4:5 and 3:4 crops" },
  { id: "hook", ar: "الهوك", en: "The headline is the film's own hook in ≤ 5 words, two lines at most (≈ 9 letters a line at 170 px) — never words the film does not say" },
  { id: "face", ar: "الوجه", en: "The person (from the film's own frames) is big and clear, never redrawn, never covered by a word; chin above the headline, the body cut at the chest" },
  { id: "contrast", ar: "التباين", en: "Text contrast ≥ 4.5:1 (3:1 only for the huge headline), bold weights only, no letter-spacing on Arabic, no @handle" },
  { id: "brand", ar: "الهوية", en: "The film's own palette and fonts (one accent), so the cover belongs to the piece and to the brand" },
  { id: "finish", ar: "اللمسة", en: "A designer's finish: one clear idea, depth, nothing cheap (no clutter, no stock glow, no centred-title-on-gradient)" },
] as const;
export type CoverRubricId = (typeof COVER_RUBRIC)[number]["id"];
export const COVER_PASS = 8;
export const COVER_ROUNDS = 2;
