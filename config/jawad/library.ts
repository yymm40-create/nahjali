// «الجواد الذكي!» | JAWAD AI — «المكتبة» (an add-on): the person's own voices, characters and places, kept to be used
// again and mentioned by «@name». Shared by the studio and the server. Pure.

export type LibraryKind = "character" | "place";
export const LIBRARY_KINDS: LibraryKind[] = ["character", "place"];
export const LIBRARY_KIND: Record<LibraryKind, { one: string; many: string; hint: string; example: string }> = {
  character: { one: "شخصية", many: "الشخصيات", hint: "شخص أو كائن تريده بنفس الشكل في كل عمل", example: "مثال: رجل خليجي في الثلاثين، لحية قصيرة، ثوب أبيض وغترة حمراء، ملامح هادئة" },
  place: { one: "مكان", many: "الأماكن", hint: "بيئة أو مكان يتكرر في أعمالك", example: "مثال: مجلس عربي قديم، جدران طين، فوانيس نحاسية، ضوء الغروب من النافذة" },
};

/** Things kept of each kind (voices have their own limit: they take slots in the site's ElevenLabs account). */
export const LIBRARY_LIMIT = 60;
export const LIBRARY_NOTE_MAX = 1000;

/**
 * What GPT Image 2 is asked for when a character or a place is made from a description: a clean picture that works as
 * a reference (one subject, plain background for a character; the place itself, empty, for a place).
 */
export function libraryImagePrompt(kind: LibraryKind, note: string) {
  return kind === "character"
    ? `Character reference picture, to be reused in later images and videos: ${note.trim()}\nOne character only, full body, standing, facing the camera, neutral pose, clearly visible face and clothing, plain light-grey studio background, soft even lighting, sharp details. No text, no frame.`
    : `Location reference picture, to be reused in later images and videos: ${note.trim()}\nA wide establishing view of the place itself, no people, natural light, sharp details, rich textures. No text, no frame.`;
}

/** GPT Image 2 settings for a made character (portrait) or place (landscape). */
export const librarySettings = (kind: LibraryKind) => ({ aspect: kind === "character" ? "2:3" : "16:9", resolution: "std", quality: "medium", count: 1 });
