// «الطالب الذكي» — HTML of every designed file (book, slides, quiz sheets, transcript). Pure: used by the server to
// print PDFs with Chromium and by the pages for live previews (same HTML, same CSS — what is previewed is what prints).

import { STYLES, type Design } from "@config/jawad/student";
import type { Block, Doc, Question, SlidePlan } from "../model";
import { frontPages } from "../pages";
import { designCss, styleFor } from "./css";

export interface RenderOpts {
  fontFaces: string;
  /** storage path → URL (data: URI on the server, signed URL in the browser) */
  images?: Record<string, string>;
  sources?: { url: string; title: string; accessedAt: string }[];
  page?: "A4" | "A5";
  trial?: boolean;
  /** the page count the student asked for: chapters flow on (no page per chapter), cover and contents only when it has room */
  pages?: number;
  /** type scale that lands the document on `pages` (1 = normal) */
  scale?: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** **bold** / ==highlight== from the writer, everything else escaped. */
const rich = (s: string) =>
  esc(s)
    .replace(/==(.+?)==/g, "<mark>$1</mark>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");

const ROLE_OF: Record<Block["t"], "body" | "structure" | "compare" | "story"> = {
  h: "structure",
  p: "body",
  list: "body",
  note: "body",
  term: "body",
  quote: "body",
  addition: "body",
  research: "body",
  question: "body",
  cards: "compare",
  steps: "compare",
  compare: "compare",
  scene: "story",
  image: "body",
};

export function blockHtml(b: Block, design: Design, o: RenderOpts) {
  const st = styleFor(design, ROLE_OF[b.t]);
  const cls = `blk blk-${b.t} s-${st}`;
  switch (b.t) {
    case "h":
      return `<h3 class="${cls}">${rich(b.text || b.title)}</h3>`;
    case "list":
      return `<div class="${cls}">${b.title ? `<b>${rich(b.title)}</b>` : ""}<ul>${b.items.map((i) => `<li>${i.title ? `<b>${rich(i.title)}:</b> ` : ""}${rich(i.text)}</li>`).join("")}</ul>${b.text ? `<p>${rich(b.text)}</p>` : ""}</div>`;
    case "term":
      return `<div class="${cls}"><b>${rich(b.title)}</b>: ${rich(b.text)}</div>`;
    case "quote":
      return `<blockquote class="${cls}">${rich(b.text)}${b.title ? `<small>${rich(b.title)}</small>` : ""}</blockquote>`;
    case "research":
      return `<div class="${cls}">${rich(b.text)} ${b.sources.map((n) => `<sup>[${n + 1}]</sup>`).join("")}</div>`;
    case "cards":
    case "steps":
      return `<div class="${cls}">${b.title ? `<h4>${rich(b.title)}</h4>` : ""}<div class="cards">${b.items.map((i) => `<div class="card"><b>${rich(i.title)}</b>${rich(i.text)}</div>`).join("")}</div>${b.text ? `<p>${rich(b.text)}</p>` : ""}</div>`;
    case "compare": {
      const [head, ...rows] = b.rows.length ? b.rows : [[]];
      return `<div class="${cls}">${b.title ? `<h4>${rich(b.title)}</h4>` : ""}<table><thead><tr>${head.map((h) => `<th>${rich(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${rich(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>${b.text ? `<p>${rich(b.text)}</p>` : ""}</div>`;
    }
    case "scene":
      return `<div class="${cls}"><b>${rich(b.title)}</b>${rich(b.text)}</div>`;
    case "image": {
      const url = o.images?.[b.title];
      return url ? `<div class="${cls}"><figure><img src="${url}" alt=""><figcaption>${rich(b.text)}</figcaption></figure></div>` : "";
    }
    default:
      return `<div class="${cls}">${rich(b.text)}</div>`;
  }
}

function sourcesHtml(o: RenderOpts) {
  if (!o.sources?.length) return "";
  return `<section class="sources"><h3>مصادر البحث الخارجي</h3><ol>${o.sources
    .map((s) => `<li>${esc(s.title)} — <a href="${esc(s.url)}">${esc(s.url)}</a> (اطّلع عليه: ${esc(s.accessedAt.slice(0, 10))})</li>`)
    .join("")}</ol></section>`;
}

const trialMark = (o: RenderOpts) =>
  o.trial ? `<div style="position:fixed;top:40%;left:0;right:0;text-align:center;font-size:64px;font-weight:800;color:rgba(200,30,30,.13);transform:rotate(-24deg);pointer-events:none;z-index:9">نسخة تجريبية</div>` : "";

/**
 * A book / reading booklet: cover, contents, chapters (an opener each), research sources. One clear type scale (the
 * title, the subtitle, chapter titles, sub-headings, body), wide margins and a thin frame on every page (unless the
 * student turned it off). With a page count, chapters flow on and the cover / contents appear only when there is room.
 */
export function docHtml(doc: Doc, design: Design, o: RenderOpts) {
  const main = design.main;
  const cover = styleFor(design, "cover");
  const story = styleFor(design, "story");
  const size = o.page ?? "A4";
  const fixed = (o.pages ?? 0) > 0;
  const front = fixed ? frontPages(o.pages!, doc.chapters.length) : { cover: true, toc: doc.chapters.length > 1 };
  const k = o.scale ?? 1;
  const css = `${designCss(design, o.fontFaces)}
@page{size:${size};margin:${size === "A4" ? "20mm 18mm 22mm" : "15mm 13mm 17mm"}}
${front.cover ? "@page :first{margin:0}" : ""}
.page-bg{position:fixed;inset:-30mm;z-index:-1}
.cover{height:${size === "A4" ? "297mm" : "210mm"};display:flex;flex-direction:column;justify-content:center;padding:25mm;break-after:page;position:relative;z-index:1}
.cover h1{font-size:2.7em;line-height:1.3;margin:0 0 .35em}
.cover p{font-size:1.25em;color:var(--muted);margin:0}
.doc-head{margin:0 0 1.4em;padding-bottom:.6em;border-bottom:1.5pt solid var(--accent)}
.doc-head h1{font-size:2.1em;line-height:1.3;margin:0 0 .2em;color:var(--accent)}
.doc-head p{font-size:1.15em;color:var(--muted);margin:0}
.toc{break-after:page}
.toc h2{color:var(--accent);font-size:1.7em}
.toc ol{line-height:2.2;font-size:1.05em}
.chapter-open{padding:${fixed ? "4mm 6mm" : "12mm 9mm"};margin:0 0 ${fixed ? "5mm" : "8mm"};border-radius:6px;break-after:avoid}
.chapter-open .num{font-size:.85em;color:var(--muted);letter-spacing:.02em}
${fixed ? ".chapter-open .num{font-size:.85em !important;line-height:1.4 !important;letter-spacing:.02em !important}" : ""}
.chapter-open h2{font-size:${fixed ? "1.6em" : "1.85em"};line-height:1.35;margin:0}
.chapter{${fixed ? "margin-top:1.6em" : "break-before:page"}}
.chapter:first-of-type{margin-top:0}
.blk-h{font-size:1.3em;line-height:1.4;margin:1.3em 0 .45em;break-after:avoid}
.blk h4{font-size:1.08em;margin:0 0 .4em;break-after:avoid}
.blk-p{line-height:1.95;text-align:justify;orphans:3;widows:3}
main{position:relative;z-index:1}
/* the page frame is drawn on the printed PDF (render/server.ts: framePdf), exactly at the page's edges */
body{font-size:calc(${size === "A4" ? "12.5pt" : "11pt"} * ${k})}`;
  const head = doc.subtitle ? `<p>${rich(doc.subtitle)}</p>` : "";
  const body = [
    `<div class="page-bg s-${main}"></div>`,
    trialMark(o),
    front.cover ? `<section class="cover s-${cover}"><h1>${rich(doc.title)}</h1>${head}</section>` : "",
    `<main>`,
    front.cover ? "" : `<header class="doc-head s-${main}"><h1>${rich(doc.title)}</h1>${head}</header>`,
    front.toc ? `<section class="toc s-${main}"><h2>المحتويات</h2><ol>${doc.chapters.map((c) => `<li>${rich(c.title)}</li>`).join("")}</ol></section>` : "",
    ...doc.chapters.map(
      (c, i) =>
        `<section class="chapter s-${main}"><div class="chapter-open s-${story}">${doc.chapters.length > 1 ? `<div class="num">الفصل ${i + 1}</div>` : ""}<h2>${rich(c.title)}</h2></div>${c.blocks.map((b) => blockHtml(b, design, o)).join("\n")}</section>`,
    ),
    sourcesHtml(o),
    `</main>`,
  ].join("\n");
  return page(css, body, doc.title);
}

const page = (css: string, body: string, title: string) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`;

// ───────────────────────────── slides ─────────────────────────────

export const SLIDE_SIZE = { "16:9": { w: 1280, h: 720 }, "4:3": { w: 1024, h: 768 } } as const;

/** Slides as fixed-size pages. Each slide's text box shrinks to fit (down to a floor); the sizes found are reused for PPTX. */
export function slidesHtml(plan: SlidePlan, design: Design, o: RenderOpts & { aspect: "16:9" | "4:3"; only?: number[] }) {
  const { w, h } = SLIDE_SIZE[o.aspect];
  const main = design.main;
  const css = `${designCss(design, o.fontFaces)}
@page{size:${w}px ${h}px;margin:0}
.slide{width:${w}px;height:${h}px;position:relative;overflow:hidden;break-after:page;padding:56px 64px;display:flex;flex-direction:column;gap:18px}
.slide .page-bg{position:absolute;inset:0;z-index:-1}
.slide h2{font-size:44px;margin:0;color:var(--accent)}
.slide .sub{font-size:26px;color:var(--muted)}
.slide .body{flex:1;min-height:0;overflow:hidden;font-size:30px;line-height:1.55}
.slide .body ul{margin:0;padding-inline-start:1.1em}
.slide .body li{margin:0 0 .35em}
.slide .num{position:absolute;bottom:18px;inset-inline-end:28px;font-size:16px;color:var(--muted)}
.slide.l-title,.slide.l-section{justify-content:center}
.slide.l-title h2{font-size:64px}
.slide.l-section h2{font-size:56px}
.slide.l-quote .body{display:flex;align-items:center;justify-content:center;text-align:center;font-family:var(--fa);font-size:40px}
.slide.l-cards .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}
.slide.l-image .row{display:flex;gap:28px;align-items:center;height:100%}
.slide.l-image img{max-width:48%;max-height:100%;border-radius:12px}
.slide.l-compare table{width:100%;border-collapse:collapse;font-size:.8em}
.slide.l-compare td,.slide.l-compare th{border:1px solid var(--line);padding:8px 12px;text-align:start}`;
  const slides = plan.slides
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !o.only || o.only.includes(i))
    .map(({ s, i }) => {
      const st = s.layout === "cards" || s.layout === "compare" ? styleFor(design, "compare") : s.layout === "title" || s.layout === "section" ? styleFor(design, i === 0 ? "cover" : "story") : main;
      const items = s.text.filter(Boolean);
      let inner = "";
      if (s.layout === "cards") inner = `<div class="cards">${items.map((t) => { const [a, ...b] = t.split(":"); return `<div class="card">${b.length ? `<b>${rich(a)}</b>${rich(b.join(":"))}` : rich(t)}</div>`; }).join("")}</div>`;
      else if (s.layout === "quote") inner = rich(items.join("\n"));
      else if (s.layout === "compare") {
        const rows = items.map((r) => r.split("|").map((c) => c.trim()));
        inner = `<table>${rows.map((r, k) => `<tr>${r.map((c) => (k === 0 ? `<th>${rich(c)}</th>` : `<td>${rich(c)}</td>`)).join("")}</tr>`).join("")}</table>`;
      } else if (s.layout === "title" || s.layout === "section") inner = items.length ? `<div class="sub">${rich(items.join(" · "))}</div>` : "";
      else if (s.layout === "image") {
        const url = s.image.path ? o.images?.[s.image.path] : "";
        inner = `<div class="row">${url ? `<img src="${url}" alt="">` : ""}<ul>${items.map((t) => `<li>${rich(t)}</li>`).join("")}</ul></div>`;
      } else inner = `<ul>${items.map((t) => `<li>${rich(t)}</li>`).join("")}</ul>`;
      return `<section class="slide l-${s.layout} s-${st}" data-i="${i}"><div class="page-bg s-${st}"></div><h2>${rich(s.title)}</h2><div class="body">${inner}</div><div class="num">${i + 1}</div></section>`;
    })
    .join("\n");
  return page(css, `${trialMark(o)}${slides}`, plan.title);
}

/** Runs in the page: shrinks each slide's text until it fits (not below 16px). Returns [index, fontPx, stillOverflowing]. */
export const FIT_SCRIPT = `(() => {
  const out = [];
  for (const s of document.querySelectorAll('.slide')) {
    const b = s.querySelector('.body');
    let fs = parseFloat(getComputedStyle(b).fontSize);
    while (b.scrollHeight > b.clientHeight + 1 && fs > 16) { fs -= 1; b.style.fontSize = fs + 'px'; }
    out.push([Number(s.dataset.i), fs, b.scrollHeight > b.clientHeight + 1]);
  }
  return out;
})()`;

// ───────────────────────────── quiz, transcript ─────────────────────────────

export function quizHtml(title: string, questions: Question[], design: Design, o: RenderOpts & { answers: boolean }) {
  const css = `${designCss(design, o.fontFaces)}
@page{size:A4;margin:18mm 16mm}
body{font-size:12.5pt}
.page-bg{position:fixed;inset:-30mm;z-index:-1}
.q{break-inside:avoid;margin:0 0 1.2em}
.q h4{margin:0 0 .4em}
.q ol{margin:.3em 0;list-style:arabic-indic}
.lines{border-bottom:1px solid var(--line);height:2em}
.ans{color:var(--accent);margin-top:.3em}
.exp{color:var(--muted);font-size:.9em}`;
  const label: Record<string, string> = { mcq: "اختيار متعدد", tf: "صح أو خطأ", short: "سؤال قصير", essay: "سؤال مقالي", long: "سؤال طويل" };
  const body = `<div class="page-bg s-${design.main}"></div><div class="s-${design.main}"><h1>${rich(title)}${o.answers ? " — الإجابات" : ""}</h1>${questions
    .map(
      (q, i) => `<div class="q"><h4>${i + 1}. ${rich(q.question)} <small style="color:var(--muted)">(${esc(label[q.type] ?? q.type)})</small></h4>${
        q.options.length ? `<ol>${q.options.map((op) => `<li>${rich(op)}</li>`).join("")}</ol>` : o.answers ? "" : `<div class="lines"></div><div class="lines"></div>${q.type === "essay" || q.type === "long" ? '<div class="lines"></div><div class="lines"></div><div class="lines"></div>' : ""}`
      }${o.answers ? `<div class="ans"><b>الإجابة:</b> ${rich(q.answer)}</div><div class="exp">${rich(q.explanation)}</div>` : ""}</div>`,
    )
    .join("")}</div>`;
  return page(css, body, title);
}

export function transcriptHtml(title: string, segments: { label: string; text: string }[], o: RenderOpts) {
  const design = { main: "editorial" as const, roles: {}, fonts: { heading: "readex", body: "amiri", accent: "amiri" }, custom: null };
  const css = `${designCss(design, o.fontFaces)}
@page{size:A4;margin:18mm 16mm 20mm}
body{font-size:13pt;line-height:2}
.seg{margin:0 0 1.2em}
.seg .where{font-family:var(--fh);font-size:.75em;color:var(--muted)}
.seg p{white-space:pre-wrap;text-align:justify}`;
  return page(css, `<div class="s-editorial"><h1>${rich(title)}</h1>${segments.map((s) => `<div class="seg"><div class="where">${esc(s.label)}</div><p>${esc(s.text)}</p></div>`).join("")}</div>`, title);
}

/** A short sample of a design (the style pickers' live preview). */
export function sampleHtml(design: Design, fontFaces: string, sample: string) {
  const doc: Doc = {
    title: "عنوان الفصل",
    subtitle: "",
    chapters: [
      {
        title: "مثال من مادتك",
        blocks: [
          { t: "p", text: sample || "هذه فقرة تجريبية تُظهر الخط والتصميم على نص عربي.", title: "", items: [], rows: [], sources: [], segments: [] },
          { t: "note", text: "ملاحظة في الهامش: تعريف أو سؤال مراجعة.", title: "", items: [], rows: [], sources: [], segments: [] },
          { t: "cards", text: "", title: "", items: [{ title: "مفهوم", text: "شرح قصير" }, { title: "مثال", text: "من المادة" }, { title: "نتيجة", text: "ما نخرج به" }], rows: [], sources: [], segments: [] },
        ],
      },
    ],
  };
  const st = STYLES.find((s) => s.id === design.main)!;
  const css = `${designCss(design, fontFaces)}
body{font-size:13px;padding:14px;background:${design.custom?.colors.bg ?? st.colors.bg}}
.chapter-open{padding:10px 12px;border-radius:6px;margin-bottom:10px}
.chapter-open h2{font-size:20px}`;
  return page(css, `<div class="s-${design.main}" style="background:var(--paper);padding:14px;border-radius:8px"><div class="chapter-open s-${styleFor(design, "story")}"><h2>${esc(doc.chapters[0].title)}</h2></div>${doc.chapters[0].blocks.map((b) => blockHtml(b, design, { fontFaces })).join("")}</div>`, "sample");
}
