// «الجواد الذكي!» | JAWAD AI — identity defaults. The logo and the accent colour can be replaced from /jawad-ai/admin.

export const JAWAD = {
  /** The two names, exactly as given. */
  nameAr: "الجواد الذكي!",
  nameEn: "JAWAD AI",
  /** The card that leads here from the main site's home page. */
  entryTitle: "منصة الذكاء الاصطناعي",
  tagline: "استوديو عربي لصناعة الصور والفيديو والصوت والأفلام بالذكاء الاصطناعي.",
  base: "/jawad-ai",
  /** Shipped logo (from the owner's file); replaced by an uploaded one when set. */
  defaultLogo: "/jawad-ai/logo.png",
  /** Electric blue from the logo's glow. Adjustable from the admin page; not a final brand decision. */
  defaultAccent: "#3b8cff",
} as const;

/** Unfinished jobs a user may have at once. */
export const MAX_ACTIVE_JOBS = 3;

/** Works shown per page in the studio. */
export const WORKS_PAGE_SIZE = 18;

/** A valid #rrggbb accent colour, or the default. */
export const cleanAccent = (c: unknown) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : JAWAD.defaultAccent);

/**
 * Voices a person can keep in their library. Every saved voice takes one of the site's ElevenLabs voice slots (their
 * number depends on the ElevenLabs plan), so keep this × the number of users within the plan.
 */
export const JAWAD_VOICE_LIMIT = 10;
