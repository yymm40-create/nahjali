// «الستايل» in the image and video studios: one of the 24 styles (config/film-styles.ts) picked by its picture. Its
// text is added to what the generator reads as THE style of the piece; the person's own prompt stays as written.

/** The prompt the generator reads with a style. Motion language is appended only for video. */
export const withStyle = (prompt: string, style: string, videoStyle?: string) =>
  `${prompt.trim()}\n\nSTYLE (the whole piece is in this style): ${style.trim()}${videoStyle?.trim() ? `\nVIDEO MOTION: ${videoStyle.trim()}` : ""}`;
