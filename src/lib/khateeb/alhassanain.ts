// «الخطيب الذكي» — a book of شبكة الإمامين الحسنين (alhassanain.org) brought into the library as it is: the site gives every book as
// an HTML file whose pages are marked, so the text comes out exact (no reading from pictures) and with its page numbers. Only this
// one site, only a book's number. Server only.

import JSZip from "jszip";
import { UserError } from "@/lib/api";

const HOST = "alhassanain.org";
const MAX_ZIP = 40 * 1024 * 1024;

/** A book's number from what the owner pasted: the number itself, or a link of the site with `id=…`. */
export function bookIdOf(input: string): number | null {
  const s = input.trim();
  if (/^\d{1,6}$/.test(s)) return Number(s);
  try {
    const u = new URL(s);
    if (u.hostname.replace(/^www\./, "") !== HOST) return null;
    const id = u.searchParams.get("id");
    return id && /^\d{1,6}$/.test(id) ? Number(id) : null;
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** The text of a piece of the book's HTML: a paragraph or a break is a new line, tags are dropped. */
export function textOf(html: string): string {
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[‌‍]/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface BookPageText {
  /** the page's number as the book numbers it */
  label: string;
  text: string;
}

/** The book's pages: the HTML is cut at the page marks (`<a name='124'></a>`), and each part is made text. */
export function parsePages(html: string): BookPageText[] {
  const body = html.slice(Math.max(0, html.indexOf("<body")));
  const marks = [...body.matchAll(/<a name=['"](\d+)['"]\s*><\/a>/gi)];
  return marks
    .map((m, i) => ({ label: m[1], text: textOf(body.slice((m.index ?? 0) + m[0].length, marks[i + 1]?.index ?? body.length)) }))
    .filter((p) => p.text.length > 0);
}

export function titleOf(html: string): string {
  const t = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  return decode(t).split(" - ").pop()?.trim() ?? "";
}

/** The book `id` of the site, as pages of text. */
export async function fetchBook(id: number): Promise<{ title: string; pages: BookPageText[]; url: string }> {
  const url = `http://${HOST}/arabic/?com=book&id=${id}&view=download&format=html`;
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000), headers: { "user-agent": "Mozilla/5.0 (JAWAD AI)" } }).catch(() => null);
  if (!res || !res.ok) throw new UserError("ما قدرنا نجيب الكتاب من شبكة الإمامين الحسنين. تأكد من الرقم وجرّب بعد شوي.", 502);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > MAX_ZIP) throw new UserError("الكتاب كبير على الاستيراد.", 413);
  let html = "";
  try {
    const zip = await JSZip.loadAsync(buf);
    const file = Object.values(zip.files).find((f) => !f.dir && /\.html?$/i.test(f.name));
    if (!file) throw new Error("no html");
    html = await file.async("string");
  } catch {
    throw new UserError("الملف اللي رجع من الشبكة مو كتاب صالح: تأكد من الرقم.", 502);
  }
  const pages = parsePages(html);
  if (!pages.length) throw new UserError("ما لقينا صفحات نص في هذا الكتاب.", 502);
  return { title: titleOf(html), pages, url: `http://${HOST}/arabic/?com=book&id=${id}` };
}
