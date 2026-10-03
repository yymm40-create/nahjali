// The site-wide @username: rules shared by the browser and the server (no imports, no database).
//
// A username is 3–20 characters: Arabic or lowercase Latin letters, digits and _, starting with a letter.
// Spaces become _, diacritics and tatweel are dropped, Arabic-Indic digits become 0–9. Unique across the whole site.

const AR_LETTER = "ء-غف-ي"; // ء … ي, without tatweel (ـ)
export const USERNAME_RE = new RegExp(`^[a-z${AR_LETTER}][a-z0-9_${AR_LETTER}]{2,19}$`);

export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "mahdi", "nahjali", "support", "help", "root", "system", "owner", "moderator", "official",
  "api", "www", "null", "undefined", "الادارة", "الإدارة", "المشرف", "الدعم", "نهج_علي", "نهجعلي",
]);

/** What the person typed, in the stored form (the result may still be invalid: check USERNAME_RE). */
export function cleanUsername(input: string): string {
  return input
    .normalize("NFKC")
    .trim()
    .replace(/^@+/, "")
    .replace(/[ً-ٰٟـ]/g, "") // diacritics and tatweel
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[\s.\-ـ]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

/** A valid username made from a name («عبدالله محمد» → «عبدالله_محمد»), or null when nothing usable is left. */
export function suggestUsername(name: string | null | undefined): string | null {
  let s = cleanUsername(name ?? "").replace(new RegExp(`[^a-z0-9_${AR_LETTER}]`, "g"), "");
  s = s.replace(/^[0-9_]+/, "").replace(/_+$/, "");
  // A long name is cut at a whole word: «عبدالله_بن_محمد_الطويل» → «عبدالله_بن_محمد»
  if (s.length > 20) {
    const cut = s.slice(0, 21).lastIndexOf("_");
    s = (cut >= 3 ? s.slice(0, cut) : s.slice(0, 20)).replace(/_+$/, "");
  }
  return USERNAME_RE.test(s) && !RESERVED_USERNAMES.has(s) ? s : null;
}

export type UsernameProblem = "invalid" | "reserved" | "taken";
