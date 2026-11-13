// «الجواد الذكي!» | JAWAD AI — «ذوقي» and «هويتي» in «الاستوديو الإبداعي». Shared by the studio and the server. Pure.
//
//   «ذوقي» (like Midjourney's moodboards): a named taste made from 3–20 of the person's pictures. The site looks at them
//   ONCE (Claude) and writes the look in words (palette, light, texture, composition, mood — never who is in them, never
//   an artist's name); up to 4 of the pictures are kept. Applied in the studio, its words are added like a library style
//   (style-prompt.ts) and its pictures go in as STYLE references, only on the generators below.
//   «هويتي» (the brand kit): colours, a logo, fonts and a brand voice line, added to the prompt by «طبّق هويتي».

import { CONTENT_FONTS, findContentFont } from "@config/content-fonts";
import type { GeneratorDef, OutputKind, RefMeta, RefStyle, Settings } from "./types";

/** Tastes one person may keep. */
export const TASTE_LIMIT = 20;
/** Pictures a taste is made from. */
export const TASTE_PICTURES = { min: 3, max: 20 } as const;
/** Pictures of a taste kept as style references. */
export const TASTE_REFS_MAX = 4;
export const TASTE_NAME_MAX = 30;
/** What the one look at the pictures costs (halalas, ¤0.50): Claude reads up to 20 pictures once. The owner is not charged. */
export const TASTE_ANALYSE_COINS = 50;

export const BRAND_COLORS_MAX = 6;
export const BRAND_FONTS_MAX = 2;
export const BRAND_VOICE_MAX = 160;

/**
 * Generators whose reference pictures can be used for their LOOK only. Ideogram 3 takes them as style references by
 * design (its image_urls are style images); the others are picture models whose «بصور مرجعية» mode reads several
 * pictures with the prompt, so the prompt can say which ones are only for the look. Video generators never get them:
 * their references carry the people and things of the shot (identity), and a taste must never become one.
 */
export const STYLE_REF_GENERATORS: readonly string[] = [
  "ideogram-v3",
  "openai-gpt-image-2",
  "openai-gpt-image-2-6",
  "google-nano-banana",
  "google-nano-banana-2",
  "google-nano-banana-pro",
  "byteplus-seedream-5-lite",
  "bfl-flux-2-pro",
];

/** Does this generator, as set now, take pictures for their look? */
export function takesStyleRefs(def: Pick<GeneratorDef, "id" | "output" | "modes">, refStyle: RefStyle, settings: Settings = {}) {
  if (def.output !== "image" || !STYLE_REF_GENERATORS.includes(def.id)) return false;
  if (refStyle === "frames") return false;
  // GPT Image 2.6: GIF and SVG are made without reference pictures
  if (def.id === "openai-gpt-image-2-6" && settings.format != null && settings.format !== "png") return false;
  return def.modes.some((m) => m.refStyle === "references" && (m.refs.image?.max ?? 0) > 0);
}

/** How many more pictures fit beside the person's own (`imageRefs`), at most TASTE_REFS_MAX + 1 (the logo). */
export function styleRefRoom(def: Pick<GeneratorDef, "id" | "output" | "modes">, refStyle: RefStyle, settings: Settings, imageRefs: number) {
  if (!takesStyleRefs(def, refStyle, settings)) return 0;
  const max = Math.max(0, ...def.modes.filter((m) => m.refStyle === "references").map((m) => m.refs.image?.max ?? 0));
  return Math.max(0, Math.min(TASTE_REFS_MAX + 1, max - imageRefs));
}

/**
 * The extra pictures a generation gets, in order: the logo first (when asked), then the taste's pictures, as far as
 * there is room and each fits the generator (`fits`). The same on the studio's quote and on the server's charge.
 */
export function pickLookRefs<T extends { id: string }>(o: { room: number; logo?: T | null; taste?: readonly T[]; fits?: (r: T) => boolean }) {
  const ok = o.fits ?? (() => true);
  let room = o.room;
  const logo = o.logo && room > 0 && ok(o.logo) ? o.logo : null;
  if (logo) room -= 1;
  const taste = (o.taste ?? []).filter(ok).slice(0, Math.max(0, Math.min(TASTE_REFS_MAX, room)));
  return { logo, taste };
}

/** Names the extra pictures go by (never one the person's references already use). */
export function lookRefNames(taken: readonly string[], tasteCount: number, logo: boolean) {
  const used = new Set(taken.map((t) => t.toLocaleLowerCase()));
  const free = (base: string) => {
    let n = base;
    for (let i = 2; used.has(n.toLocaleLowerCase()); i++) n = `${base}_${i}`;
    used.add(n.toLocaleLowerCase());
    return n;
  };
  return { logo: logo ? free("brand_logo") : null, taste: Array.from({ length: tasteCount }, (_, i) => free(`taste_${i + 1}`)) };
}

/** The reference labels (as the model numbers them) of some references among all of them, in order. */
export function labelsOf(all: readonly Pick<RefMeta, "id" | "kind">[], ids: readonly string[], label?: GeneratorDef["refLabel"]) {
  const counts = { image: 0, video: 0, audio: 0 };
  const out: string[] = [];
  for (const r of all) {
    counts[r.kind] += 1;
    if (ids.includes(r.id)) out.push(label ? label(r.kind, counts[r.kind]) : `${r.kind} ${counts[r.kind]}`);
  }
  return out;
}

// ───────────────────────────── «ذوقي» ─────────────────────────────

/** A taste's name: spaces folded, 1–30 letters; null when empty or too long. */
export function cleanTasteName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const n = raw.replace(/\s+/g, " ").trim();
  return n && n.length <= TASTE_NAME_MAX ? n : null;
}
const fold = (s: string) => s.toLocaleLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

/** Why this name can't be used (null: it can). `exceptId`: the taste being renamed. */
export function tasteNameProblem(name: string | null, mine: readonly { id: string; name: string }[], exceptId?: string) {
  if (!name) return `اسم الذوق: من حرف إلى ${TASTE_NAME_MAX} حرفًا.`;
  if (mine.some((t) => t.id !== exceptId && fold(t.name) === fold(name))) return `عندك ذوق باسم «${name}» من قبل؛ اختر اسمًا آخر.`;
  if (!exceptId && mine.length >= TASTE_LIMIT) return `وصلت حد الأذواق (${TASTE_LIMIT}). احذف واحدًا لتصنع غيره.`;
  return null;
}

/** Why these pictures can't make a taste (null: they can). */
export function picturesProblem(ids: readonly string[]) {
  const n = new Set(ids).size;
  if (n !== ids.length) return "صورة مكررة؛ احذف التكرار.";
  if (n < TASTE_PICTURES.min) return `اختر ${TASTE_PICTURES.min} صور على الأقل.`;
  if (n > TASTE_PICTURES.max) return `الحد ${TASTE_PICTURES.max} صورة.`;
  return null;
}

/** A row the person may change or use: only their own (the same answer for someone else's and for none). */
export const ownRowProblem = (userId: string, row: { ownerId: string | null } | null, missing = "ما لقينا هذا الذوق.") => (row && row.ownerId && row.ownerId === userId ? null : missing);

/** What Claude writes back after looking at the pictures. */
export interface TasteAnalysis {
  /** one plain Arabic line for the person */
  summary: string;
  palette: string[];
  light: string;
  texture: string;
  composition: string;
  mood: string;
  /** the pictures that show the look best (1-based), up to TASTE_REFS_MAX */
  keep: number[];
}

export const TASTE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    palette: { type: "array", items: { type: "string" } },
    light: { type: "string" },
    texture: { type: "string" },
    composition: { type: "string" },
    mood: { type: "string" },
    keep: { type: "array", items: { type: "integer" } },
  },
  required: ["summary", "palette", "light", "texture", "composition", "mood", "keep"],
  additionalProperties: false,
} as const;

/** The task (the same on every call, so it stays cached; the count of pictures goes in the turn note). */
export const TASTE_TASK = `You look at a person's set of pictures (a moodboard) for JAWAD AI's creative studio and write down their shared VISUAL LOOK, so an image generator can make new, different pictures in the same taste.

Write, in English, short and concrete:
- palette: the 3–6 main colours as #rrggbb hex codes, most present first.
- light: the lighting (direction, softness, contrast, time of day, colour temperature).
- texture: surface and finish (grain, sharpness, paint/3D/photo/film qualities, materials).
- composition: framing, camera distance and angle, negative space, depth, symmetry.
- mood: the feeling, in a few words.
- summary: ONE plain Arabic sentence (no English words) that tells the person what their taste looks like.
- keep: the numbers (1-based) of up to 4 pictures that show this look best, the most typical first.

Rules: describe only the look shared by the set — never who or what is in the pictures (no people, faces, identities, ages, genders, brands, logos, places by name, readable text) and never name an artist, photographer, studio, film or franchise. Each field is one or two sentences, no lists inside.`;

const HEX = /^#[0-9a-f]{6}$/i;
/** A colour as #rrggbb (also «#abc» and «abc123»), or null. */
export function cleanHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return HEX.test(s) ? s : null;
}

/** Takes out what names a maker («in the style of X», «by X», «inspired by X»). */
export function scrubNames(s: string) {
  return s
    .replace(/\b(in the style of|in the manner of|inspired by|reminiscent of|à la|a la|by)\s+(the\s+)?[A-Z][\w'’.-]*(\s+(?:[A-Z][\w'’.-]*|de|da|van|von|del))*/g, "")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
const line = (v: unknown, max = 400) => (typeof v === "string" ? scrubNames(v.replace(/\s+/g, " ").trim()).slice(0, max) : "");

/** Claude's answer, cleaned; null when it says nothing usable. `count`: the pictures it looked at. */
export function readTasteAnalysis(raw: unknown, count: number): TasteAnalysis | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const a: TasteAnalysis = {
    summary: typeof o.summary === "string" ? o.summary.replace(/\s+/g, " ").trim().slice(0, 300) : "",
    palette: [...new Set((Array.isArray(o.palette) ? o.palette : []).map(cleanHex).filter((c): c is string => Boolean(c)))].slice(0, 8),
    light: line(o.light),
    texture: line(o.texture),
    composition: line(o.composition),
    mood: line(o.mood, 200),
    keep: [...new Set((Array.isArray(o.keep) ? o.keep : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= count))].slice(0, TASTE_REFS_MAX),
  };
  if ([a.light, a.texture, a.composition, a.mood].filter(Boolean).length < 2) return null;
  // the pictures to keep: Claude's choice, filled with the first ones
  for (let i = 1; a.keep.length < Math.min(TASTE_REFS_MAX, count); i++) if (!a.keep.includes(i)) a.keep.push(i);
  return a;
}

/** The look in words, as kept and as the generators read it. */
export function tasteText(a: Pick<TasteAnalysis, "palette" | "light" | "texture" | "composition" | "mood">) {
  return [
    a.palette.length ? `Palette: ${a.palette.join(", ")}.` : "",
    a.light ? `Light: ${a.light}` : "",
    a.texture ? `Texture and finish: ${a.texture}` : "",
    a.composition ? `Composition: ${a.composition}` : "",
    a.mood ? `Mood: ${a.mood}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

/**
 * The prompt with a taste: its words added like a library style (the person's prompt stays as written), and the
 * pictures that went with it named as style references only.
 */
export function withTaste(prompt: string, text: string, styleRefs: readonly string[] = []) {
  const refs = styleRefs.length
    ? `\nSTYLE REFERENCES: ${styleRefs.join(", ")} — use ${styleRefs.length > 1 ? "them" : "it"} ONLY for the look (colours, light, texture, finish, mood). Never copy ${styleRefs.length > 1 ? "their" : "its"} people, faces, identities, objects, text or layout.`
    : "";
  return `${prompt.trim()}\n\nTASTE (the look of the whole piece; it never changes who or what is shown): ${text.trim()}${refs}`;
}

// ───────────────────────────── «هويتي» ─────────────────────────────

export interface BrandKit {
  colors: string[];
  /** ids of config/content-fonts.ts */
  fonts: string[];
  voice: string;
  /** a jawad_uploads id (the person's own checked PNG) */
  logoUploadId: string | null;
}
export const EMPTY_BRAND: BrandKit = { colors: [], fonts: [], voice: "", logoUploadId: null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A kit as sent or as stored, cleaned to its limits (unknown fonts and bad colours dropped). */
export function cleanBrand(raw: unknown): BrandKit {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const colors = [...new Set((Array.isArray(o.colors) ? o.colors : []).map(cleanHex).filter((c): c is string => Boolean(c)))].slice(0, BRAND_COLORS_MAX);
  const fonts = [...new Set((Array.isArray(o.fonts) ? o.fonts : []).filter((f): f is string => typeof f === "string" && Boolean(findContentFont(f))))].slice(0, BRAND_FONTS_MAX);
  const voice = typeof o.voice === "string" ? o.voice.replace(/\s+/g, " ").trim().slice(0, BRAND_VOICE_MAX) : "";
  const logo = o.logoUploadId;
  return { colors, fonts, voice, logoUploadId: typeof logo === "string" && UUID.test(logo) ? logo : null };
}

export const brandIsEmpty = (k: BrandKit) => !k.colors.length && !k.fonts.length && !k.voice && !k.logoUploadId;

/**
 * The prompt with the brand: its colours and voice (and, for pictures, its fonts); `logo`: the label of the logo
 * picture when it went in as a reference.
 */
export function withBrand(prompt: string, kit: BrandKit, output: OutputKind, logo?: string | null) {
  if (output === "audio") return prompt;
  const parts: string[] = [];
  if (kit.colors.length) parts.push(`brand colours ${kit.colors.join(", ")} — the main palette of accents, graphics${output === "image" ? " and any text" : ", wardrobe details and set dressing"}`);
  if (output === "image") {
    const fonts = kit.fonts.map((f) => findContentFont(f)).filter((f) => Boolean(f));
    if (fonts.length) parts.push(`any Arabic text set in ${fonts.map((f) => f!.gpt).join("; headings and body: ")}`);
  }
  if (kit.voice) parts.push(`brand voice and tone: ${kit.voice}`);
  const logoLine = logo && output === "image" ? `\nBRAND LOGO: ${logo} is the brand's logo — place it once, small and clean (a corner), exactly as drawn; never redraw, recolour or distort it, and never use it for the style.` : "";
  if (!parts.length && !logoLine) return prompt;
  return `${prompt.trim()}\n\nBRAND (apply to this piece)${parts.length ? `: ${parts.join("; ")}.` : "."}${logoLine}`;
}

/**
 * The kit in a few lines for another section's brief («حيدرة كت»'s motion, «صانع المحتوى»): read by
 * brandKitFor (src/lib/jawad/server/taste.ts). Empty when the kit says nothing.
 */
export function brandBrief(kit: BrandKit) {
  if (brandIsEmpty(kit)) return "";
  const fonts = kit.fonts.map((f) => findContentFont(f)?.name).filter(Boolean);
  return [
    "هوية صاحب العمل («هويتي»):",
    kit.colors.length ? `- الألوان: ${kit.colors.join("، ")}` : "",
    fonts.length ? `- الخطوط: ${fonts.join("، ")}` : "",
    kit.voice ? `- نبرة الهوية: ${kit.voice}` : "",
    kit.logoUploadId ? "- عنده شعار محفوظ (صورة PNG في ملفاته)." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The fonts a kit can pick from (the site's 50 Arabic fonts of «صانع المحتوى»). */
export const BRAND_FONT_CHOICES = CONTENT_FONTS.map((f) => ({ id: f.id, name: f.name, group: f.group }));
