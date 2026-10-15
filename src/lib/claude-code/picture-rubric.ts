// «Claude Code» pictures — the frame sizes and the art director's score sheet (pure: the page shows the scores too).

export const PICTURE_SIZES: Record<string, [number, number]> = { "1:1": [1440, 1440], "16:9": [1920, 1080], "9:16": [1080, 1920], "3:2": [1800, 1200], "2:3": [1200, 1800], "4:5": [1440, 1800] };

export const PICTURE_RUBRIC = [
  { id: "ask", ar: "الطلب", en: "It is exactly what the person asked for: the subject, every word written, the mood, the use (a post, a thumbnail, a poster)" },
  { id: "composition", ar: "التكوين", en: "One clear hero and focal point, a strong silhouette, deliberate negative space, a reading order, balanced margins (nothing cut by the frame)" },
  { id: "type", ar: "الخط", en: "Typography: Arabic correct, joined and right to left, readable at phone size, a clear hierarchy, ≤ 2 families, nothing overlapping" },
  { id: "light", ar: "الإضاءة", en: "Light and depth: a motivated key, glow or rim, ≥ 3 depth planes, contact shadows, no flat clip-art" },
  { id: "color", ar: "الألوان", en: "Colour discipline: 3–5 colours, one accent, near-black / off-white instead of pure #000/#fff, no banding" },
  { id: "finish", ar: "اللمسة", en: "The finish of a paid studio: grain, texture, detail where the eye goes; a viewer would think a top designer made it" },
] as const;

export const pictureSize = (aspect: unknown): [number, number] => PICTURE_SIZES[String(aspect)] ?? PICTURE_SIZES["1:1"];
