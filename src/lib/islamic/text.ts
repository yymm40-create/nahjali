// «الذكاء الإسلامي» — text work shared by the readers, the index and the search. Pure (no server imports).

/** HTML → readable text: scripts and styles out, block tags become line breaks, entities decoded, spaces collapsed. */
export function htmlToText(html: string): string {
  const s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|header|footer|ul|ol|table|main)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(s)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", hellip: "…", mdash: "—", ndash: "–" };
export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** The <main> (or <article>, or the body) of a page, as text. */
export function mainText(html: string): string {
  const m = /<main[\s>][\s\S]*?<\/main>/i.exec(html) ?? /<article[\s>][\s\S]*?<\/article>/i.exec(html);
  const body = /<body[\s>][\s\S]*?<\/body>/i.exec(html);
  return htmlToText((m ?? body)?.[0] ?? html);
}

export function pageTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : "";
}

/**
 * Arabic made the same however it was typed: no diacritics or tatweel, one alef, one ya, ta marbuta as ha, Persian
 * letters as Arabic, no punctuation, and the article «ال» (with a one-letter prefix before it) dropped from words
 * long enough. The same rules as islamic_norm in SQL (migration 0037): the question and the index must agree.
 */
export function normalizeArabic(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED\u0610-\u061A]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/[\u0649\u06CC\u0626]/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u06A9/g, "\u0643")
    .replace(/\u0624/g, "\u0648")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(^|\s)[وفبكل]?(ال|لل)(?=\S\S\S)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Words of a question that carry meaning (short and function words out), normalised. */
const STOP = new Set(
  "في من على الى إلى عن ان أن إن ما لا لم لن هل هو هي هم هن انا أنا انت أنت نحن هذا هذه ذلك تلك التي الذي الذين او أو و يا كان كانت يكون ثم قد كل بعض مع عند حتى اذا إذا كيف لماذا ماذا متى اين أين ايش وش شنو ليش هالـ هال بس مو مب يعني مثل بين فوق تحت قبل بعد كم اي أي الا إلا غير له لها لهم لي لك لنا فيه فيها منه منها عليه عليها به بها بعد ولا".split(
    " ",
  ),
);
export function queryWords(question: string, max = 8): string[] {
  const words = normalizeArabic(question)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP.has(w));
  // longer words first (rarer, more telling), then the order they came in
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, max);
}

/** A tsquery over the words: any of them matches; words of four letters or more also match as prefixes. */
export function tsQuery(words: string[], all = false): string {
  return words.map((w) => (w.length >= 4 ? `${w}:*` : w)).join(all ? " & " : " | ");
}

/** Cuts a text into pieces of about `size` characters at paragraph or sentence ends, each starting a little before the last ended. */
export function chunkText(text: string, size = 1400, overlap = 160): string[] {
  const t = text.trim();
  if (t.length <= size) return t ? [t] : [];
  const out: string[] = [];
  let at = 0;
  while (at < t.length) {
    let end = Math.min(t.length, at + size);
    if (end < t.length) {
      const window = t.slice(at, end);
      const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf("۔"), window.lastIndexOf("."), window.lastIndexOf("؟"), window.lastIndexOf("!"));
      if (cut > size * 0.4) end = at + cut + 1;
    }
    const piece = t.slice(at, end).trim();
    if (piece) out.push(piece);
    if (end >= t.length) break;
    at = Math.max(at + 1, end - overlap);
  }
  return out;
}

/** The host of a URL without «www.», or empty. */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}


/** The kinds of document that are narrations (the hadith chapters, the duas and ziyarat): they come first in every answer. */
export const NARRATION_KINDS = ["hadith-chapter", "dua"];

/** What a kind of document is called when Claude is told where a passage comes from. */
export const KIND_LABEL: Record<string, string> = { "hadith-chapter": "رواية", dua: "دعاء/زيارة", quran: "قرآن", commentary: "تفسير", fatwa: "فتوى", page: "صفحة" };

/**
 * The passages of one answer: up to `quota` narrations first (at most `perDoc` from one document), then the rest by
 * their own rank, then any narrations left over, until `k`. A narration never loses its place to a shorter fatwa that
 * merely repeats the words more densely.
 */
export function pickPassages<T extends { doc_id: string; chunk_id: number }>(narrations: T[], others: T[], k: number, perDoc: number, quota = Math.ceil(k * 0.67)): T[] {
  const out: T[] = [];
  const count: Record<string, number> = {};
  const used = new Set<number>();
  const take = (list: T[], limit: number) => {
    for (const p of list) {
      if (out.length >= limit) break;
      if (used.has(p.chunk_id) || (count[p.doc_id] ?? 0) >= perDoc) continue;
      used.add(p.chunk_id);
      count[p.doc_id] = (count[p.doc_id] ?? 0) + 1;
      out.push(p);
    }
  };
  take(narrations, quota);
  take(others, k);
  take(narrations, k);
  return out;
}
