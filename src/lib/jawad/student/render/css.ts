// «الطالب الذكي» — the five design styles as CSS, shared by the PDF renderer (server) and the live previews (browser).
// Every rule is scoped to a style class (.s-notebook …) so styles can be mixed block by block: the main style dresses
// the page, and each role (body, structure, comparisons, stories, cover) can take another style.

import { fontById, styleById, type Design, type StyleDef, type StyleId, type StyleRole } from "@config/jawad/student";

export const ALL_STYLES: StyleId[] = ["notebook", "editorial", "bento", "cinematic", "collage"];

/** The colours in force: a style's own, or the student's own style (custom) on top of the main one. */
export function colorsOf(design: Design, id: StyleId): StyleDef["colors"] {
  return id === design.main && design.custom ? design.custom.colors : styleById(id).colors;
}

export const styleFor = (design: Design, role: StyleRole): StyleId => design.roles[role] ?? design.main;

const fam = (id: string) => `"${fontById(id).family}"`;

/** CSS variables + each style's rules. `fontUrl` turns a font file into a URL (data: URI on the server, a route in the browser). */
export function designCss(design: Design, fontFaces: string) {
  const used = new Set<StyleId>([design.main, ...(Object.values(design.roles).filter(Boolean) as StyleId[])]);
  const vars = [...used]
    .map((id) => {
      const c = colorsOf(design, id);
      return `.s-${id}{--bg:${c.bg};--paper:${c.paper};--ink:${c.ink};--muted:${c.muted};--accent:${c.accent};--accent2:${c.accent2};--line:${c.line};}`;
    })
    .join("\n");
  const texture = design.custom?.texture ?? null;
  return `${fontFaces}
:root{--fh:${fam(design.fonts.heading)},sans-serif;--fb:${fam(design.fonts.body)},sans-serif;--fa:${fam(design.fonts.accent)},serif;--radius:${design.custom?.radius ?? 14}px}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{direction:rtl;font-family:var(--fb);color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact;font-variant-numeric:normal}
h1,h2,h3,h4{font-family:var(--fh);line-height:1.35;margin:0 0 .5em}
p{margin:0 0 .8em}
${vars}
${BASE}
${[...used].map((id) => STYLE_CSS[id]).join("\n")}
${texture === "lines" ? `.page-bg{background-image:repeating-linear-gradient(to bottom,transparent 0 31px,var(--line) 31px 32px)}` : texture === "grid" ? `.page-bg{background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:24px 24px}` : texture === "paper" ? `.page-bg{background-image:radial-gradient(rgba(0,0,0,.035) 1px,transparent 1px);background-size:5px 5px}` : ""}`;
}

const BASE = `
.blk{margin:0 0 1em;break-inside:auto}
.blk-p{font-size:1em;line-height:1.95;text-align:justify}
.blk-list ul,.blk-list ol{margin:0 0 .8em;padding-inline-start:1.4em;line-height:1.9}
.blk-h{font-size:1.25em;color:var(--accent);margin-top:1.2em}
.blk-term{border-inline-start:4px solid var(--accent);padding:.5em .9em;background:color-mix(in srgb,var(--accent) 7%,transparent);border-radius:8px}
.blk-term b{font-family:var(--fh);color:var(--accent)}
.blk-quote{font-family:var(--fa);font-size:1.15em;line-height:1.9;padding:.6em 1em;border-inline-start:3px solid var(--accent2);color:var(--ink)}
.blk-quote small{display:block;font-family:var(--fb);font-size:.7em;color:var(--muted);margin-top:.3em}
.blk-addition,.blk-research{border:1.5px dashed var(--accent2);border-radius:10px;padding:.6em .9em;position:relative}
.blk-addition::before{content:"إضافة من المساعد — ليست من المادة";display:block;font-size:.72em;font-weight:700;color:var(--accent2);margin-bottom:.3em}
.blk-research::before{content:"من البحث الخارجي";display:block;font-size:.72em;font-weight:700;color:var(--accent2);margin-bottom:.3em}
.blk-research sup{color:var(--accent);font-size:.7em}
.blk-question{font-weight:600;color:var(--accent)}
.blk-question::before{content:"سؤال مراجعة: ";color:var(--muted);font-weight:400}
.blk-cards .cards,.blk-steps .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7em}
.card{border:1px solid var(--line);border-radius:var(--radius);padding:.7em .8em;background:var(--paper);break-inside:avoid}
.card b{display:block;font-family:var(--fh);color:var(--accent);margin-bottom:.2em}
.blk-steps .card{counter-increment:step}
.blk-steps .cards{counter-reset:step}
.blk-steps .card b::before{content:counter(step,arabic-indic) ". "}
.blk-compare table{width:100%;border-collapse:collapse;font-size:.92em}
.blk-compare th,.blk-compare td{border:1px solid var(--line);padding:.45em .6em;text-align:start;vertical-align:top}
.blk-compare th{background:color-mix(in srgb,var(--accent) 12%,var(--paper));font-family:var(--fh)}
.blk-image figure{margin:0;text-align:center}
.blk-image img{max-width:100%;max-height:120mm;border-radius:8px}
.blk-image figcaption{font-size:.8em;color:var(--muted);margin-top:.3em}
.blk-scene{border-radius:var(--radius);padding:1em;background:color-mix(in srgb,var(--accent) 9%,var(--paper))}
.blk-scene b{font-family:var(--fh);display:block;color:var(--accent)}
.sources{font-size:.8em;color:var(--muted);direction:rtl}
.sources a{color:var(--accent);word-break:break-all}
mark{background:linear-gradient(transparent 40%,color-mix(in srgb,var(--accent2) 65%,transparent) 40%);color:inherit;padding:0 .1em}
`;

const STYLE_CSS: Record<StyleId, string> = {
  notebook: `
.s-notebook.page-bg{background-color:var(--paper);background-image:repeating-linear-gradient(to bottom,transparent 0 31px,var(--line) 31px 32px),linear-gradient(to left,transparent 0 22mm,rgba(220,80,80,.35) 22mm 22.4mm,transparent 22.4mm)}
.s-notebook .blk-note{font-family:var(--fa);color:var(--accent);background:color-mix(in srgb,var(--accent2) 45%,#fff);padding:.5em .8em;border-radius:3px;box-shadow:0 2px 4px rgba(0,0,0,.12);transform:rotate(-1deg);width:fit-content;max-width:85%;margin-inline-start:auto}
.s-notebook .blk-h{border-bottom:2px solid var(--accent2);display:inline-block;padding-bottom:.1em}
.s-notebook.chapter-open h2{font-size:2em;color:var(--accent);border-bottom:3px solid var(--accent2);display:inline-block}
.s-notebook .card{transform:rotate(-.4deg);box-shadow:0 2px 5px rgba(0,0,0,.08)}
.s-notebook .card:nth-child(2n){transform:rotate(.5deg)}
.s-notebook.cover{background:var(--paper);border:10px solid var(--accent);}
.s-notebook.cover h1{font-size:2.6em;color:var(--accent)}
`,
  editorial: `
.s-editorial.page-bg{background:var(--paper)}
.s-editorial .blk-p{font-size:1.06em}
.s-editorial .blk-h{color:var(--ink);font-size:1.35em;border-top:2px solid var(--ink);padding-top:.4em}
.s-editorial .blk-quote{font-size:1.5em;border:0;border-top:3px solid var(--accent);border-bottom:3px solid var(--accent);text-align:center;padding:.6em 1.2em;color:var(--accent)}
.s-editorial .blk-note{font-size:.88em;color:var(--muted);border-inline-start:2px solid var(--accent);padding-inline-start:.8em}
.s-editorial.chapter-open{border-top:8px solid var(--accent)}
.s-editorial.chapter-open .num{font-family:var(--fh);font-size:4.5em;color:var(--accent);line-height:1}
.s-editorial.chapter-open h2{font-size:2.3em}
.s-editorial.cover{background:var(--ink);color:var(--paper)}
.s-editorial.cover h1{font-size:3em;color:var(--paper);border-bottom:6px solid var(--accent);padding-bottom:.2em}
`,
  bento: `
.s-bento.page-bg{background:var(--bg)}
.s-bento .blk-p,.s-bento .blk-list,.s-bento .blk-note,.s-bento .blk-term{background:var(--paper);border-radius:var(--radius);padding:.8em 1em;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.s-bento .blk-note{border-top:4px solid var(--accent2)}
.s-bento .card{box-shadow:0 2px 6px rgba(17,24,39,.07);border:0}
.s-bento .card:first-child{grid-column:span 2;background:color-mix(in srgb,var(--accent) 10%,var(--paper))}
.s-bento .blk-h{color:var(--accent);background:var(--paper);display:inline-block;padding:.2em .7em;border-radius:999px}
.s-bento.chapter-open h2{font-size:2em;background:var(--accent);color:#fff;border-radius:var(--radius);padding:.5em .8em}
.s-bento.cover{background:var(--bg)}
.s-bento.cover h1{font-size:2.6em;background:var(--paper);border-radius:var(--radius);padding:.6em .8em;box-shadow:0 4px 14px rgba(0,0,0,.08)}
`,
  cinematic: `
.s-cinematic.page-bg{background:var(--paper);color:var(--ink)}
.s-cinematic .blk-h{color:var(--accent);letter-spacing:.02em}
.s-cinematic .blk-scene{background:linear-gradient(180deg,rgba(0,0,0,.0),rgba(0,0,0,.35)),var(--bg);border:1px solid var(--line)}
.s-cinematic .blk-scene b::before{content:"مشهد — ";color:var(--muted)}
.s-cinematic .blk-note{color:var(--accent2);border-inline-start:2px solid var(--accent2);padding-inline-start:.8em}
.s-cinematic .card{background:var(--bg);border-color:var(--line)}
.s-cinematic.chapter-open{background:radial-gradient(120% 80% at 70% 20%,color-mix(in srgb,var(--accent) 25%,transparent),transparent 60%),var(--bg);color:var(--ink)}
.s-cinematic.chapter-open .num{font-family:var(--fh);letter-spacing:.3em;color:var(--accent)}
.s-cinematic.chapter-open h2{font-size:2.4em}
.s-cinematic.cover{background:radial-gradient(120% 90% at 30% 10%,color-mix(in srgb,var(--accent) 30%,transparent),transparent 60%),var(--bg);color:var(--ink)}
.s-cinematic.cover h1{font-size:3em;color:var(--ink);text-shadow:0 2px 16px rgba(0,0,0,.5)}
`,
  collage: `
.s-collage.page-bg{background-color:var(--bg);background-image:radial-gradient(rgba(0,0,0,.04) 1px,transparent 1px);background-size:6px 6px}
.s-collage .blk-p,.s-collage .blk-list{background:var(--paper);padding:.8em 1em;box-shadow:0 3px 8px rgba(0,0,0,.12);clip-path:polygon(0 2%,3% 0,30% 1.5%,60% 0,100% 1%,99% 40%,100% 98%,70% 100%,35% 98.5%,0 100%,1% 60%)}
.s-collage .blk-note{font-family:var(--fa);background:#fff7b8;padding:.6em .9em;transform:rotate(1.5deg);box-shadow:0 3px 6px rgba(0,0,0,.15);position:relative;width:fit-content;max-width:85%}
.s-collage .blk-note::before{content:"";position:absolute;top:-.6em;inset-inline-start:40%;width:4em;height:1.2em;background:rgba(255,255,255,.55);border:1px solid rgba(0,0,0,.06);transform:rotate(-4deg)}
.s-collage .blk-image figure{background:#fff;padding:.6em .6em 1.6em;box-shadow:0 4px 10px rgba(0,0,0,.18);transform:rotate(-1.5deg);display:inline-block}
.s-collage .card{background:var(--paper);box-shadow:0 3px 7px rgba(0,0,0,.12);border:0;transform:rotate(-.6deg)}
.s-collage .card:nth-child(2n){transform:rotate(.8deg)}
.s-collage .blk-h{background:var(--accent);color:#fff;display:inline-block;padding:.1em .6em;transform:rotate(-1deg)}
.s-collage.chapter-open h2{font-size:2.4em;background:var(--paper);display:inline-block;padding:.3em .7em;box-shadow:0 4px 10px rgba(0,0,0,.15);transform:rotate(-1.2deg)}
.s-collage.cover{background-color:var(--bg)}
.s-collage.cover h1{font-size:3em;background:var(--paper);display:inline-block;padding:.3em .6em;box-shadow:0 6px 14px rgba(0,0,0,.2);transform:rotate(-2deg)}
`,
};
