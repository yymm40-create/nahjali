// «محمد الخارق» — the PDF he delivers: his own words (light markdown) printed as a clean A4 Arabic document with the
// fonts embedded, so the letters join and the direction is right on any device. Chromium does the printing (the same
// one «الطالب الذكي» prints its books with). Server only.

import { fontFacesData, htmlToPdf } from "@/lib/jawad/student/render/server";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** **عريض** · *مائل* · `كود` · [نص](رابط) inside a line. */
function inline(s: string) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

const cells = (line: string) => line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
const isRule = (line: string) => /^\s*\|?[\s:|-]*-{2,}[\s:|-]*\|?\s*$/.test(line) && line.includes("-");

/**
 * His markdown as the document's body: headings, lists, quotes, rules, pipe tables, fenced blocks, paragraphs.
 * Anything it does not know stays a paragraph — nothing is dropped.
 */
export function bodyHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let code: string[] | null = null;
  const flush = () => {
    if (!list) return;
    out.push(`<${list.tag}>${list.items.map((x) => `<li>${inline(x)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      if (code) {
        out.push(`<pre dir="auto">${esc(code.join("\n"))}</pre>`);
        code = null;
      } else code = [];
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    // a pipe table: its head row, the dashes under it, then its body
    if (/\|/.test(line) && lines[i + 1] && isRule(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      for (; i < lines.length && /\|/.test(lines[i]) && lines[i].trim(); i++) rows.push(cells(lines[i]));
      i--;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? "")}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }
    const li = /^\s*(?:([-•*])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      const tag = li[2] ? "ol" : "ul";
      if (list && list.tag !== tag) flush();
      (list ??= { tag, items: [] }).items.push(li[3]);
      continue;
    }
    flush();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (/^\s*>\s?/.test(line)) out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
    else if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) out.push("<hr/>");
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  if (code) out.push(`<pre dir="auto">${esc(code.join("\n"))}</pre>`);
  return out.join("\n");
}

/** The whole page: A4, right to left, Amiri for the headings and Tajawal for the body, both embedded. */
export async function documentHtml(title: string, markdown: string): Promise<string> {
  const faces = await fontFacesData(["amiri", "tajawal"]);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
${faces}
@page { size: A4; margin: 20mm 18mm; }
* { box-sizing: border-box; }
body { font-family: "Tajawal", sans-serif; color: #15202b; font-size: 11.5pt; line-height: 1.95; margin: 0; }
h1, h2, h3, h4 { font-family: "Amiri", serif; color: #0f172a; line-height: 1.5; margin: 1.1em 0 .45em; page-break-after: avoid; }
h1 { font-size: 21pt; border-bottom: 2px solid #0f172a; padding-bottom: .3em; margin-top: 0; }
h2 { font-size: 16pt; }
h3 { font-size: 13.5pt; }
h4 { font-size: 12pt; }
p { margin: 0 0 .7em; }
ul, ol { margin: 0 0 .8em; padding-inline-start: 1.5em; }
li { margin-bottom: .3em; }
blockquote { margin: 0 0 .8em; padding: .5em 1em; border-inline-start: 3px solid #c8d2dd; background: #f6f8fa; }
hr { border: 0; border-top: 1px solid #d7dee6; margin: 1.2em 0; }
code { font-family: ui-monospace, monospace; background: #f1f4f7; padding: .1em .35em; border-radius: 4px; font-size: .92em; }
pre { font-family: ui-monospace, monospace; background: #f6f8fa; border: 1px solid #e2e8ee; border-radius: 6px; padding: .8em 1em; white-space: pre-wrap; font-size: 9.5pt; }
table { width: 100%; border-collapse: collapse; margin: 0 0 1em; page-break-inside: avoid; }
th, td { border: 1px solid #ccd5de; padding: .45em .6em; text-align: start; vertical-align: top; }
th { background: #eef2f6; font-weight: 700; }
a { color: #0b5cab; }
</style></head><body>${/^#\s/m.test(markdown) ? "" : `<h1>${esc(title)}</h1>`}
${bodyHtml(markdown)}</body></html>`;
}

/** The file itself. Throws when Chromium could not print it. */
export async function makePdf(title: string, markdown: string): Promise<Buffer> {
  const { pdf } = await htmlToPdf(await documentHtml(title, markdown), { numbered: true });
  return pdf;
}

/** A name the browser can save: the title's own words, with nothing a file system refuses. */
export const fileNameOf = (title: string) => `${(title || "ملف").replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "ملف"}.pdf`;
