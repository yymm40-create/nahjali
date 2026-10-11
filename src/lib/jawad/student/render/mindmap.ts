// «الطالب الذكي» — drawing a mind map as a page: the layout (where every box and line goes) and the HTML that
// Chromium turns into a sharp picture. Pure: no server imports, so the layout is tested without a browser.
//
// Two layouts, after the research (mindmap.ts):
// · «balanced» for the radial (Buzan) map: the topic in the centre, the main branches shared between the right and the
//   left (read from the right, top to bottom, then the left), each a coloured pill on a line that is thick at the
//   centre and thin at the end, the sub-branches as words sitting on their lines, the details under them.
// · «columns» for the tree, concept and flow maps: the topic at the top, the main branches in columns from right to
//   left, the sub-branches under each on a spine. A concept map writes its linking phrase on every line and draws its
//   cross-links dashed; a flow map joins the stages with arrows in their order.
// Text sizes are estimated (an Arabic letter is about 0.56 of its font size), with room to spare: a box never hides
// its words, it only grows.

import { MAP_ICONS, RECALL_STEPS, type MindMap } from "../mindmap";

export interface MapColors {
  bg: string;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
}

export interface MapFonts {
  heading: string;
  body: string;
}

type Kind = "center" | "branch" | "child" | "detail";

export interface Box {
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  font: number;
  color: string;
  icon?: string;
  /** the order of a main branch (1, 2, 3…) */
  num?: number;
  /** a concept map's linking phrase written above a sub-branch */
  link?: string;
  /** right or left of the centre (balanced layout): where the text leans */
  side?: 1 | -1;
}

export interface Edge {
  /** an SVG path */
  d: string;
  color: string;
  /** a filled (tapered) shape, or a line of this width */
  fill: boolean;
  width: number;
  dashed?: boolean;
  arrow?: boolean;
  label?: { text: string; x: number; y: number };
}

export interface Layout {
  w: number;
  h: number;
  boxes: Box[];
  edges: Edge[];
}

/** One colour per main branch (Buzan): bright and distinct, readable with white text. */
export const BRANCH_COLORS = ["#e11d48", "#ea580c", "#16a34a", "#0284c7", "#7c3aed", "#c026d3", "#0d9488", "#ca8a04", "#4f46e5"];

const CHAR = 0.56;
const LINE = 1.4;

/** A box for a text: as wide as the text up to `max`, as tall as the lines it wraps to. */
function measure(text: string, font: number, max: number, padX: number, padY: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const inner = max - padX * 2;
  // lines by words (a word never splits), each word ~ its letters
  let lines = 1;
  let cur = 0;
  let widest = 0;
  for (const w of words) {
    const ww = [...w].length * font * CHAR;
    const add = cur ? cur + font * 0.3 + ww : ww;
    if (cur && add > inner) {
      widest = Math.max(widest, cur);
      lines++;
      cur = ww;
    } else cur = add;
  }
  widest = Math.max(widest, cur, font * 2);
  return { w: Math.min(max, widest * 1.08 + padX * 2), h: lines * font * LINE + padY * 2, lines };
}

/** A curved band from (x0,y0) to (x1,y1), w0 wide at its start and w1 at its end (horizontal tangents). */
export function taper(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) {
  const dx = (x1 - x0) * 0.5;
  const a = (y: number, w: number) => [y - w / 2, y + w / 2];
  const [s0, s1] = a(y0, w0);
  const [e0, e1] = a(y1, w1);
  const wm = (w0 + w1) / 2;
  const f = (n: number) => Math.round(n * 10) / 10;
  return `M${f(x0)},${f(s0)} C${f(x0 + dx)},${f(s0 + (w0 - wm) / 4)} ${f(x1 - dx)},${f(e0)} ${f(x1)},${f(e0)} L${f(x1)},${f(e1)} C${f(x1 - dx)},${f(e1)} ${f(x0 + dx)},${f(s1 - (w0 - wm) / 4)} ${f(x0)},${f(s1)} Z`;
}

const R = (n: number) => Math.round(n * 10) / 10;

/** Where everything of the map goes. `details: false` leaves the details out (the picture GPT Image 2 redraws). */
export function layoutMap(m: MindMap, o: { details?: boolean; young?: boolean } = {}): Layout {
  const details = o.details !== false;
  const k = o.young ? 1.18 : 1;
  return m.type === "radial" ? balanced(m, details, k) : columns(m, details, k);
}

function balanced(m: MindMap, details: boolean, k: number): Layout {
  const boxes: Box[] = [];
  const edges: Edge[] = [];
  const c = measure(m.center, 40 * k, 480 * k, 34, 26);
  const cw = Math.max(c.w, 260 * k);
  const ch = Math.max(c.h + (m.icon ? 48 * k : 0), 130 * k);
  boxes.push({ kind: "center", x: -cw / 2, y: -ch / 2, w: cw, h: ch, text: m.center, font: 40 * k, color: "", icon: m.icon || undefined });

  type Blk = { b: MindMap["branches"][number]; i: number; bm: ReturnType<typeof measure>; kids: { m: ReturnType<typeof measure>; ds: ReturnType<typeof measure>[]; h: number }[]; h: number };
  const blocks: Blk[] = m.branches.map((b, i) => {
    const bm = measure(b.label, 28 * k, 340 * k, b.icon ? 54 : 22, 16);
    const kids = b.children.map((x) => {
      const km = measure(x.label, 22 * k, 300 * k, 10, 8);
      const ds = details ? x.details.map((d) => measure(`• ${d}`, 16 * k, 320 * k, 4, 3)) : [];
      return { m: km, ds, h: km.h + ds.reduce((s, d) => s + d.h, 0) + (ds.length ? 6 : 0) };
    });
    const kh = kids.reduce((s, x) => s + x.h, 0) + Math.max(0, kids.length - 1) * 18;
    return { b, i, bm, kids, h: Math.max(bm.h, kh) };
  });
  const right = blocks.slice(0, Math.ceil(blocks.length / 2));
  const left = blocks.slice(Math.ceil(blocks.length / 2));
  const GAP = 46;
  for (const [side, list] of [[1, right], [-1, left]] as const) {
    const total = list.reduce((s, b) => s + b.h, 0) + Math.max(0, list.length - 1) * GAP;
    let y = -total / 2;
    for (const blk of list) {
      const color = BRANCH_COLORS[blk.i % BRANCH_COLORS.length];
      const yc = y + blk.h / 2;
      const inner = side * (cw / 2 + 130);
      const bx = side > 0 ? inner : inner - blk.bm.w;
      boxes.push({ kind: "branch", x: bx, y: yc - blk.bm.h / 2, w: blk.bm.w, h: blk.bm.h, text: blk.b.label, font: 28 * k, color, icon: blk.b.icon || undefined, num: blk.i + 1, side });
      // the main branch: thick at the centre, thinner at its word
      const x0 = side * cw * 0.36;
      edges.push({ d: taper(x0, yc * 0.18, inner, yc, 26 * k, 9 * k), color, fill: true, width: 0 });
      const outer = side > 0 ? bx + blk.bm.w : bx;
      const kh = blk.kids.reduce((s, x) => s + x.h, 0) + Math.max(0, blk.kids.length - 1) * 18;
      let ky = yc - kh / 2;
      blk.b.children.forEach((kid, j) => {
        const km = blk.kids[j];
        const kx = side > 0 ? outer + 90 : outer - 90 - km.m.w;
        boxes.push({ kind: "child", x: kx, y: ky, w: km.m.w, h: km.m.h, text: kid.label, font: 22 * k, color, side });
        // the sub-branch: a thinner line ending under its word (the word sits on its line)
        const end = side > 0 ? kx : kx + km.m.w;
        edges.push({ d: taper(outer, yc, end, ky + km.m.h, 8 * k, 3), color, fill: true, width: 0 });
        edges.push({ d: `M${R(kx)},${R(ky + km.m.h)} L${R(kx + km.m.w)},${R(ky + km.m.h)}`, color, fill: false, width: 3 });
        let dy = ky + km.m.h + 6;
        km.ds.forEach((dm, n) => {
          const dx = side > 0 ? kx + 8 : kx + km.m.w - 8 - dm.w;
          boxes.push({ kind: "detail", x: dx, y: dy, w: dm.w, h: dm.h, text: kid.details[n], font: 16 * k, color, side });
          dy += dm.h;
        });
        ky += km.h + 18;
      });
      y += blk.h + GAP;
    }
  }
  crossLinks(m, boxes, edges);
  return frame(boxes, edges, m);
}

function columns(m: MindMap, details: boolean, k: number): Layout {
  const boxes: Box[] = [];
  const edges: Edge[] = [];
  const concept = m.type === "concept";
  const flow = m.type === "flow";
  const c = measure(m.center, 38 * k, 620 * k, 34, 22);
  const cw = Math.max(c.w, 280 * k);
  const ch = Math.max(c.h + (m.icon ? 46 * k : 0), 100 * k);
  const ROW = ch + (concept ? 150 : flow ? 90 : 110);
  type Col = { bm: ReturnType<typeof measure>; kids: { m: ReturnType<typeof measure>; ds: ReturnType<typeof measure>[]; lk: number }[]; w: number };
  const cols: Col[] = m.branches.map((b) => {
    const bm = measure(b.label, 27 * k, 330 * k, b.icon ? 54 : 22, 16);
    const kids = b.children.map((x) => {
      const km = measure(x.label, 21 * k, 290 * k, 14, 9);
      const ds = details ? x.details.map((d) => measure(`• ${d}`, 16 * k, 290 * k, 4, 3)) : [];
      return { m: km, ds, lk: concept && x.link ? 15 * k * LINE + 4 : 0 };
    });
    const w = Math.max(bm.w, ...kids.map((x) => Math.max(x.m.w, ...x.ds.map((d) => d.w)) + 34), 230 * k);
    return { bm, kids, w };
  });
  const GAP = flow ? 90 : 48;
  const total = cols.reduce((s, x) => s + x.w, 0) + Math.max(0, cols.length - 1) * GAP;
  boxes.push({ kind: "center", x: -cw / 2, y: 0, w: cw, h: ch, text: m.center, font: 38 * k, color: "", icon: m.icon || undefined });
  // from the right: the first branch is the rightmost column
  let right = total / 2;
  const tops: { x: number; y: number; w: number; h: number }[] = [];
  m.branches.forEach((b, i) => {
    const col = cols[i];
    const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
    const bx = right - col.w / 2 - col.bm.w / 2;
    boxes.push({ kind: "branch", x: bx, y: ROW, w: col.bm.w, h: col.bm.h, text: b.label, font: 27 * k, color, icon: b.icon || undefined, num: i + 1 });
    tops.push({ x: bx, y: ROW, w: col.bm.w, h: col.bm.h });
    if (!flow) {
      // from the centre down to the branch, with the linking phrase on a concept map
      const x0 = R(cw ? Math.max(-cw / 2 + 30, Math.min(cw / 2 - 30, right - col.w / 2)) : 0);
      const x1 = R(right - col.w / 2);
      const y0 = ch;
      const y1 = ROW;
      const my = (y0 + y1) / 2;
      edges.push({ d: `M${x0},${R(y0)} C${x0},${R(my)} ${x1},${R(my)} ${x1},${R(y1)}`, color, fill: false, width: 7 * k, label: concept && b.link ? { text: b.link, x: (x0 + x1) / 2, y: my } : undefined });
    }
    // the sub-branches on a spine down the right side of the column
    const spine = right - 14;
    let y = ROW + col.bm.h + 34;
    let last = ROW + col.bm.h;
    b.children.forEach((kid, j) => {
      const km = col.kids[j];
      y += km.lk;
      const kx = right - 34 - km.m.w;
      boxes.push({ kind: "child", x: kx, y, w: km.m.w, h: km.m.h, text: kid.label, font: 21 * k, color, link: concept && kid.link ? kid.link : undefined });
      edges.push({ d: `M${R(spine)},${R(y + km.m.h / 2)} L${R(right - 34)},${R(y + km.m.h / 2)}`, color, fill: false, width: 3.5 });
      last = y + km.m.h / 2;
      let dy = y + km.m.h + 4;
      km.ds.forEach((dm, n) => {
        boxes.push({ kind: "detail", x: right - 40 - dm.w, y: dy, w: dm.w, h: dm.h, text: kid.details[n], font: 16 * k, color });
        dy += dm.h;
      });
      y = dy + 22;
    });
    if (b.children.length) edges.push({ d: `M${R(spine)},${R(ROW + col.bm.h)} L${R(spine)},${R(last)}`, color, fill: false, width: 3.5 });
    right -= col.w + GAP;
  });
  // a flow map: the stages joined in their order, right to left
  if (flow) {
    for (let i = 0; i + 1 < tops.length; i++) {
      const a = tops[i];
      const b = tops[i + 1];
      const y = ROW + Math.min(a.h, b.h) / 2;
      edges.push({ d: `M${R(a.x - 8)},${R(y)} L${R(b.x + b.w + 14)},${R(y)}`, color: "#475569", fill: false, width: 5, arrow: true });
    }
  }
  crossLinks(m, boxes, edges);
  return frame(boxes, edges, m);
}

/** The cross-links: dashed curves between two nodes found by their labels, with their phrase in the middle. */
function crossLinks(m: MindMap, boxes: Box[], edges: Edge[]) {
  const key = (s: string) => s.replace(/[ً-ْـ]/g, "").replace(/\s+/g, " ").trim();
  const find = (label: string) => boxes.find((b) => (b.kind === "branch" || b.kind === "child") && key(b.text) === key(label));
  for (const l of m.links) {
    const a = find(l.from);
    const b = find(l.to);
    if (!a || !b) continue;
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h;
    const cx = (ax + bx) / 2;
    // under everything between them, so the dashed line never crosses a word
    const below = boxes.filter((x) => x.x + x.w >= Math.min(ax, bx) && x.x <= Math.max(ax, bx)).reduce((mx, x) => Math.max(mx, x.y + x.h), Math.max(ay, by));
    const cy = below + 70;
    edges.push({ d: `M${R(ax)},${R(ay)} Q${R(cx)},${R(cy)} ${R(bx)},${R(by)}`, color: "#64748b", fill: false, width: 3, dashed: true, label: l.label ? { text: l.label, x: cx, y: (ay + by) / 4 + cy / 2 } : undefined });
  }
}

/** Everything moved into a page with a margin and room for the title at the top. */
function frame(boxes: Box[], edges: Edge[], m: MindMap): Layout {
  const pts = boxes.flatMap((b) => [[b.x, b.y - (b.link ? 26 : 0)], [b.x + b.w, b.y + b.h]]);
  for (const e of edges) if (e.label) pts.push([e.label.x - 90, e.label.y - 20], [e.label.x + 90, e.label.y + 20]);
  for (const e of edges) for (const [, x, y] of e.d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) pts.push([Number(x), Number(y)]);
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const M = 70;
  const TOP = m.title ? 90 : 0;
  const dx = M - minX;
  const dy = M + TOP - minY;
  const move = (d: string) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${R(Number(x) + dx)},${R(Number(y) + dy)}`);
  // a pleasant page: never narrower than 3:4 nor wider than 12:5 (extra room shared on both sides)
  let w = maxX - minX + M * 2;
  let h = maxY - minY + M * 2 + TOP;
  let ox = 0;
  let oy = 0;
  if (w / h < 0.75) {
    ox = (h * 0.75 - w) / 2;
    w = h * 0.75;
  } else if (w / h > 2.4) {
    oy = (w / 2.4 - h) / 2;
    h = w / 2.4;
  }
  return {
    w: Math.ceil(w),
    h: Math.ceil(h),
    boxes: boxes.map((b) => ({ ...b, x: R(b.x + dx + ox), y: R(b.y + dy + oy) })),
    edges: edges.map((e) => ({ ...e, d: ox || oy ? shift(move(e.d), ox, oy) : move(e.d), label: e.label ? { ...e.label, x: R(e.label.x + dx + ox), y: R(e.label.y + dy + oy) } : undefined })),
  };
}

const shift = (d: string, ox: number, oy: number) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${R(Number(x) + ox)},${R(Number(y) + oy)}`);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const icon = (id: string | undefined, size: number, color: string) =>
  id && MAP_ICONS[id] ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${MAP_ICONS[id]}"/></svg>` : "";

export interface MapHtmlOpts {
  colors: MapColors;
  fonts: MapFonts;
  /** @font-face rules (the fonts inlined) */
  fontFaces: string;
  /** «نسخة التسميع»: the branches empty, to fill from memory (the centre, icons, numbers and linking phrases stay) */
  blank?: boolean;
  /** the small line under the title (the level, the shape) */
  caption?: string;
  details?: boolean;
  young?: boolean;
}

/** The map as one HTML page of exactly the layout's size (Chromium takes its picture). */
export function mapHtml(m: MindMap, o: MapHtmlOpts): { html: string; w: number; h: number } {
  const L = layoutMap(m, { details: o.details, young: o.young });
  const c = o.colors;
  // a dotted line as long as most of the box (in pixels: a percentage of an inline parent is nothing)
  const blankLines = (w: number, color: string) => `<span class="blank" style="border-color:${color};width:${Math.round(w)}px"></span>`;
  const boxHtml = (b: Box) => {
    const pos = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;font-size:${b.font}px`;
    const text = o.blank && b.kind !== "center" ? blankLines((b.w - (b.icon ? 70 : 30)) * 0.85, b.kind === "branch" ? "rgba(255,255,255,.9)" : b.color) : esc(b.text);
    if (b.kind === "center") {
      return `<div class="n center" style="${pos}">${b.icon ? `<span class="ic">${icon(b.icon, b.font * 1.1, c.paper)}</span>` : ""}<span>${esc(b.text)}</span></div>`;
    }
    if (b.kind === "branch") {
      return `<div class="n branch" style="${pos};background:${b.color}">${b.num ? `<span class="num" style="color:${b.color}">${b.num}</span>` : ""}${b.icon ? `<span class="ic">${icon(b.icon, b.font * 1.05, "#ffffff")}</span>` : ""}<span>${text}</span></div>`;
    }
    if (b.kind === "child") {
      const link = b.link ? `<span class="lk" style="color:${b.color}">${esc(b.link)}</span>` : "";
      const align = b.side === -1 ? "flex-end" : b.side === 1 ? "flex-start" : "flex-end";
      return `<div class="n child" style="${pos};justify-content:${align};color:${c.ink}">${link}<span>${text}</span></div>`;
    }
    return `<div class="n detail" style="${pos};color:${c.muted};justify-content:${b.side === 1 ? "flex-start" : "flex-end"}"><span>${o.blank ? blankLines(b.w * 0.7, b.color) : esc(`• ${b.text}`)}</span></div>`;
  };
  const edgeSvg = (e: Edge) => {
    const dash = e.dashed ? ` stroke-dasharray="12 9"` : "";
    const arrow = e.arrow ? ` marker-end="url(#arrow)"` : "";
    const path = e.fill ? `<path d="${e.d}" fill="${e.color}" opacity=".92"/>` : `<path d="${e.d}" fill="none" stroke="${e.color}" stroke-width="${e.width}" stroke-linecap="round"${dash}${arrow}/>`;
    return path;
  };
  const labels = L.edges
    .filter((e) => e.label)
    .map((e) => `<div class="el" style="left:${e.label!.x}px;top:${e.label!.y}px;color:${e.dashed ? c.muted : e.color};border-color:${e.dashed ? c.line : e.color}">${esc(e.label!.text)}</div>`)
    .join("");
  const steps = o.blank ? `<ol class="steps">${RECALL_STEPS.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : "";
  const title = m.title ? `<header><b>${esc(o.blank ? `${m.title} — نسخة التسميع` : m.title)}</b>${o.caption ? `<small>${esc(o.caption)}</small>` : ""}</header>` : "";
  const H = L.h + (o.blank ? 150 : 0);
  const css = `${o.fontFaces}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${L.w}px;height:${H}px;background:${c.bg};overflow:hidden}
body{direction:rtl;font-family:"${o.fonts.body}",sans-serif;position:relative;-webkit-font-smoothing:antialiased}
.map{position:absolute;inset:0;width:${L.w}px;height:${L.h}px}
svg.edges{position:absolute;inset:0}
.n{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;line-height:${LINE};overflow:visible}
.center{border-radius:999px;background:${c.accent};color:${c.paper};font-family:"${o.fonts.heading}",sans-serif;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.18),inset 0 0 0 6px rgba(255,255,255,.22);padding:0 28px;gap:12px;flex-direction:column}
.branch{border-radius:22px;color:#fff;font-family:"${o.fonts.heading}",sans-serif;font-weight:700;padding:0 18px;gap:10px;box-shadow:0 6px 16px rgba(0,0,0,.14)}
.branch .num{position:absolute;top:-14px;right:-14px;width:34px;height:34px;border-radius:50%;background:#fff;font:700 18px/34px "${o.fonts.heading}",sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.branch .ic,.center .ic{display:flex}
.child{font-weight:700;padding:0 10px;flex-direction:column;align-items:stretch}
.child>span:last-child{display:block}
.child .lk{position:absolute;top:-24px;right:0;left:0;font-size:15px;font-weight:600;font-style:italic;text-align:center}
.detail{line-height:1.4;padding:0 4px}
.el{position:absolute;transform:translate(-50%,-50%);background:${c.paper};border:2px solid;border-radius:999px;padding:3px 14px;font-size:16px;font-weight:600;white-space:nowrap}
.blank{display:inline-block;height:1.15em;border-bottom:3px dotted;align-self:center}
header{position:absolute;top:34px;right:56px;left:56px;display:flex;align-items:baseline;gap:18px;color:${c.ink};font-family:"${o.fonts.heading}",sans-serif}
header b{font-size:34px}
header small{font-size:18px;color:${c.muted};font-family:"${o.fonts.body}",sans-serif}
.steps{position:absolute;bottom:26px;right:56px;left:56px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;color:${c.ink};font-size:17px;list-style:none;counter-reset:s}
.steps li{counter-increment:s;background:${c.paper};border:2px solid ${c.line};border-radius:16px;padding:12px 14px}
.steps li::before{content:counter(s) ". ";font-weight:700;color:${c.accent}}`;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body>${title}<div class="map"><svg class="edges" width="${L.w}" height="${L.h}" viewBox="0 0 ${L.w} ${L.h}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker></defs>${L.edges.map(edgeSvg).join("")}</svg>${L.boxes.map(boxHtml).join("")}${labels}</div>${steps}</body></html>`;
  return { html, w: L.w, h: H };
}

/**
 * The device scale for a sharp picture: the long side near 4800 pixels, never past ~24 million pixels (what a
 * serverless Chromium holds comfortably), between 1 and 3.
 */
export function pictureScale(w: number, h: number, longSide = 4800, maxPixels = 24e6) {
  const s = Math.min(3, longSide / Math.max(w, h, 1), Math.sqrt(maxPixels / Math.max(1, w * h)));
  return Math.max(1, Math.round(s * 100) / 100);
}

/** The GPT Image 2 aspect nearest to the layout (it draws only 1:1, 3:2 and 2:3 here). */
export function pictureAspect(w: number, h: number): "1:1" | "3:2" | "2:3" {
  const r = w / Math.max(1, h);
  return r > 1.2 ? "3:2" : r < 0.83 ? "2:3" : "1:1";
}
