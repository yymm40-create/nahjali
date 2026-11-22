// The sheikh's own library (SQL 0124): the books of مكتبة الثقلين from the open copy on GitHub, and the pure helpers
// the server, the agent and the tests share (the books' Arabic names, normalising Arabic, building a search).

/** The open copy of thaqalayn's hadiths (refreshed weekly by its author): one JSON file per book. */
export const HADITHS_SOURCE = "https://raw.githubusercontent.com/MohammedArab1/ThaqalaynAPI/main/V2/ThaqalaynData";

/** The books, by their number on thaqalayn.com (the GitHub file's name): the Arabic name and the author. */
export const HADITH_BOOKS: Record<number, { name: string; author: string }> = {
  1: { name: "الكافي ج١", author: "الكليني" },
  2: { name: "الكافي ج٢", author: "الكليني" },
  3: { name: "الكافي ج٣", author: "الكليني" },
  4: { name: "الكافي ج٤", author: "الكليني" },
  5: { name: "الكافي ج٥", author: "الكليني" },
  6: { name: "الكافي ج٦", author: "الكليني" },
  7: { name: "الكافي ج٧", author: "الكليني" },
  8: { name: "الكافي ج٨ (الروضة)", author: "الكليني" },
  9: { name: "معجم الأحاديث المعتبرة", author: "الشيخ محمد آصف المحسني" },
  10: { name: "الخصال", author: "الشيخ الصدوق" },
  11: { name: "عيون أخبار الرضا ج١", author: "الشيخ الصدوق" },
  12: { name: "عيون أخبار الرضا ج٢", author: "الشيخ الصدوق" },
  13: { name: "الأمالي", author: "الشيخ المفيد" },
  14: { name: "التوحيد", author: "الشيخ الصدوق" },
  17: { name: "كتاب الضعفاء", author: "ابن الغضائري" },
  22: { name: "كتاب الغيبة", author: "النعماني" },
  23: { name: "ثواب الأعمال وعقاب الأعمال", author: "الشيخ الصدوق" },
  24: { name: "كامل الزيارات", author: "ابن قولويه القمي" },
  25: { name: "فضائل الشيعة", author: "الشيخ الصدوق" },
  26: { name: "صفات الشيعة", author: "الشيخ الصدوق" },
  27: { name: "كتاب الغيبة", author: "الشيخ الطوسي" },
  28: { name: "معاني الأخبار", author: "الشيخ الصدوق" },
  29: { name: "الأمالي", author: "الشيخ الصدوق" },
  30: { name: "كتاب المؤمن", author: "الحسين بن سعيد الأهوازي" },
  31: { name: "كتاب الزهد", author: "الحسين بن سعيد الأهوازي" },
  32: { name: "نهج البلاغة", author: "الشريف الرضي" },
  33: { name: "رسالة الحقوق", author: "المنسوبة إلى الإمام زين العابدين عليه السلام" },
  34: { name: "من لا يحضره الفقيه ج١", author: "الشيخ الصدوق" },
  35: { name: "من لا يحضره الفقيه ج٢", author: "الشيخ الصدوق" },
  36: { name: "من لا يحضره الفقيه ج٣", author: "الشيخ الصدوق" },
  37: { name: "من لا يحضره الفقيه ج٤", author: "الشيخ الصدوق" },
  38: { name: "من لا يحضره الفقيه ج٥", author: "الشيخ الصدوق" },
  39: { name: "كمال الدين وتمام النعمة", author: "الشيخ الصدوق" },
  40: { name: "فضائل الأشهر الثلاثة", author: "الشيخ الصدوق" },
  41: { name: "تهذيب الأحكام ج١", author: "الشيخ الطوسي" },
  42: { name: "تهذيب الأحكام ج٢", author: "الشيخ الطوسي" },
  43: { name: "تهذيب الأحكام ج٣", author: "الشيخ الطوسي" },
  44: { name: "تهذيب الأحكام ج٤", author: "الشيخ الطوسي" },
  45: { name: "الإمامة والتبصرة من الحيرة", author: "ابن بابويه القمي" },
};
export const HADITH_BOOK_NUMBERS = Object.keys(HADITH_BOOKS).map(Number);
export const bookName = (n: number) => HADITH_BOOKS[n]?.name ?? `كتاب ${n}`;
export const hadithUrl = (id: string) => `https://thaqalayn.com/hadith/${id}`;

/** One hadith as the GitHub file has it (the fields read). */
export interface RawHadith {
  id: number;
  bookId: string;
  volume?: number;
  category?: string;
  categoryId: number;
  chapter?: string;
  chapterInCategoryId: number;
  arabicText?: string;
  englishText?: string;
  majlisiGrading?: string;
  behbudiGrading?: string;
  mohseniGrading?: string;
  gradingsFull?: unknown[];
}

/** A row of mahdi_hadiths. */
export interface HadithRow {
  id: string;
  book: number;
  book_slug: string;
  volume: number;
  section_id: number;
  section: string;
  chapter_id: number;
  chapter: string;
  n: number;
  seq: number;
  arabic: string;
  english: string;
  majlisi: string;
  behbudi: string;
  mohseni: string;
  gradings: unknown[];
}

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");

/**
 * A book's file as rows. The file's own links point one book off, so each hadith's place is rebuilt the way
 * thaqalayn.com numbers it: book / section / chapter / its number in the chapter (counted in the file's order).
 */
export function hadithRows(book: number, file: RawHadith[]): HadithRow[] {
  const count = new Map<string, number>();
  const out: HadithRow[] = [];
  for (const x of file) {
    const arabic = typeof x.arabicText === "string" ? x.arabicText.trim() : "";
    if (!arabic || !Number.isInteger(x.categoryId) || !Number.isInteger(x.chapterInCategoryId)) continue;
    const key = `${x.categoryId}/${x.chapterInCategoryId}`;
    const n = (count.get(key) ?? 0) + 1;
    count.set(key, n);
    out.push({
      id: `${book}/${key}/${n}`,
      book,
      book_slug: clean(x.bookId),
      volume: Number.isInteger(x.volume) ? (x.volume as number) : 1,
      section_id: x.categoryId,
      section: clean(x.category),
      chapter_id: x.chapterInCategoryId,
      chapter: clean(x.chapter),
      n,
      seq: x.id,
      arabic,
      english: typeof x.englishText === "string" ? x.englishText.trim() : "",
      majlisi: clean(x.majlisiGrading),
      behbudi: clean(x.behbudiGrading),
      mohseni: clean(x.mohseniGrading),
      gradings: Array.isArray(x.gradingsFull) ? x.gradingsFull : [],
    });
  }
  return out;
}

/** Arabic as the index reads it (the same as SQL mahdi_ar_norm). */
export function normAr(s: string): string {
  return s
    .replace(/[ً-ْٰـۖ-ۭؐ-ؚ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىی]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ک/g, "ك")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(^|\s)[وفبكل]?(ال|لل)(?=\S\S\S)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The words of a search as a tsquery: each word normalised and matched as a beginning (زيار → زيارة، زيارته); all of
 * them (`all`) or any of them. Null when no word is left.
 */
export function hadithQuery(text: string, all = false): string | null {
  const words = [...new Set(normAr(text).split(" ").filter((w) => w.length >= 2))].slice(0, 12);
  if (!words.length) return null;
  return words.map((w) => `${w.replace(/[':&|!()*\\]/g, "")}:*`).filter((w) => w.length > 2).join(all ? " & " : " | ") || null;
}

/** A hadith's gradings in one line: «المجلسي: صحيح · البهبودي: …» (empty when none). */
export function gradingLine(h: { majlisi?: string; behbudi?: string; mohseni?: string; gradings?: unknown[] }): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const g of (h.gradings ?? []) as { grade_ar?: string | null; grade_en?: string | null; reference_en?: string; author?: { name_ar?: string; name_en?: string } }[]) {
    const grade = clean(g?.grade_ar) || clean(g?.grade_en);
    const who = clean(g?.author?.name_ar) || clean(g?.author?.name_en);
    if (!grade) continue;
    const line = `${who || "حكم"}: ${grade}${g?.reference_en ? ` (${clean(g.reference_en)})` : ""}`;
    if (!seen.has(line)) parts.push(line);
    seen.add(line);
  }
  if (!parts.length) {
    if (h.majlisi) parts.push(`المجلسي: ${h.majlisi}`);
    if (h.behbudi) parts.push(`البهبودي: ${h.behbudi}`);
    if (h.mohseni) parts.push(`المحسني: ${h.mohseni}`);
  }
  return parts.join(" · ");
}
