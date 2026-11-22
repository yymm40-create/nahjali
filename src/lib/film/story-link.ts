// «صانع الأفلام» · the story given as a VIDEO instead of words (the owner, 22 Nov 2026): «🔗 رابط يوتيوب» — a YouTube
// link (the only kind of link turned on for now) — or «📤 ارفع فيديو» — a video from the person's own device («سو خيار ان
// ترفع فيديو من عندك ويقراه … كخيار اخر غير اليوتيوب»). Under either, the person's own words on what to take from it. All
// of it rides in the story text in a fixed shape, so every page and route that already carries the story carries it too;
// «سجاد» (lib/film/intake) looks at the video's frames, hears its words, and builds the film on it only after the person
// confirms what he understood. Pure: pages and server alike.

/** The first line of a story given as a YouTube link. */
export const STORY_LINK_HEAD = "🔗 رابط يوتيوب:";
/** The first line of a story given as an uploaded video. */
export const STORY_UPLOAD_HEAD = "📤 فيديو من جهازي:";

const YT = /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?\S*v=[\w-]{6,20}|shorts\/[\w-]{6,20}|live\/[\w-]{6,20}|embed\/[\w-]{6,20})|youtu\.be\/[\w-]{6,20})\S*$/i;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const IDS = new RegExp(`\\[فيديو:(${UUID})(?: لقطات:(${UUID}))?\\]\\s*$`, "i");

/** Is this a YouTube video link (watch / shorts / live / embed / youtu.be)? */
export const isYoutubeLink = (url: string) => YT.test(url.trim());

/** The story text of a link and its note. */
export function storyFromLink(url: string, note: string) {
  const n = note.trim();
  return `${STORY_LINK_HEAD} ${url.trim()}${n ? `\n\n${n}` : ""}`;
}

/** An uploaded video (the person's upload id, and the upload of its frame sheet when the page could make one). */
export interface StoryVideo {
  name: string;
  videoId: string;
  sheetId: string | null;
}

/** The story text of an uploaded video and its note (no video yet: only the head, so the way stays chosen). */
export function storyFromUpload(video: StoryVideo | null, note: string) {
  const n = note.trim();
  const line = video ? `${video.name.replace(/[[\]\n]/g, " ").slice(0, 120)} [فيديو:${video.videoId}${video.sheetId ? ` لقطات:${video.sheetId}` : ""}]` : "";
  return `${STORY_UPLOAD_HEAD} ${line}`.trimEnd() + (n ? `\n\n${n}` : "");
}

/** The first line and the note of a story that starts with `head`. */
function split(story: string, head: string) {
  const rest = story.slice(head.length).replace(/^[ \t]+/, "");
  const nl = rest.indexOf("\n");
  return { first: (nl < 0 ? rest : rest.slice(0, nl)).trim(), note: nl < 0 ? "" : rest.slice(nl).trim() };
}

/** The link and note of a story given as a YouTube link, or null when it was not. */
export function storyLink(story: string): { url: string; note: string } | null {
  const s = String(story ?? "");
  if (!s.startsWith(STORY_LINK_HEAD)) return null;
  const { first, note } = split(s, STORY_LINK_HEAD);
  return { url: first, note };
}

/** The video and note of a story given as an uploaded video (video null: not uploaded yet), or null when it was not. */
export function storyUpload(story: string): { video: StoryVideo | null; note: string } | null {
  const s = String(story ?? "");
  if (!s.startsWith(STORY_UPLOAD_HEAD)) return null;
  const { first, note } = split(s, STORY_UPLOAD_HEAD);
  const m = first.match(IDS);
  if (!m) return { video: null, note };
  return { video: { name: first.slice(0, m.index).trim(), videoId: m[1].toLowerCase(), sheetId: m[2] ? m[2].toLowerCase() : null }, note };
}
