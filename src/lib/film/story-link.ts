// «صانع الأفلام» · the third way to give the story (the owner, 22 Nov 2026: «خيار كتابة القصة وهو رابط يوتيوب وتحته مجال
// للتوضيح من المستخدم»): a YouTube link — the only kind of link turned on for now — and, under it, the person's own words
// on what to take from it. Both ride in the story text in a fixed shape, so every page and route that already carries the
// story carries them too; «سجاد» (lib/film/intake) downloads the video, looks at its frames, hears its words, and builds
// the film on it only after the person confirms what he understood. Pure: pages and server alike.

/** The first line of a story given as a link. */
export const STORY_LINK_HEAD = "🔗 رابط يوتيوب:";

const YT = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?\S*v=[\w-]{6,20}|shorts\/[\w-]{6,20}|live\/[\w-]{6,20}|embed\/[\w-]{6,20})|youtu\.be\/[\w-]{6,20})\S*$/i;

/** Is this a YouTube video link (watch / shorts / live / embed / youtu.be)? */
export const isYoutubeLink = (url: string) => YT.test(url.trim());

/** The story text of a link and its note. */
export function storyFromLink(url: string, note: string) {
  const n = note.trim();
  return `${STORY_LINK_HEAD} ${url.trim()}${n ? `\n\n${n}` : ""}`;
}

/** The link and note of a story given as a link, or null when the story was written. */
export function storyLink(story: string): { url: string; note: string } | null {
  const s = String(story ?? "");
  if (!s.startsWith(STORY_LINK_HEAD)) return null;
  const rest = s.slice(STORY_LINK_HEAD.length).replace(/^[ \t]+/, "");
  const nl = rest.indexOf("\n");
  const url = (nl < 0 ? rest : rest.slice(0, nl)).trim();
  const note = nl < 0 ? "" : rest.slice(nl).trim();
  return { url, note };
}
