// «كتيب الجداول الذكي» — a designed booklet as pages: each one a background (the theme's colours), a layer of shapes (the
// title plate, the table's grid, the marks to colour or tick) drawn here as SVG, the person's character where the design
// puts it, and every word written with real Arabic shaping by the booklet's composer (src/lib/compose.ts). Pure; the
// shapes are in millimetres on the 210×210 mm page.

import type { Template, TemplatePage, TemplateText } from "@/lib/templates";
import { COLUMN_KINDS, posesOf, TB, THEMES, type BookletSpec, type Mark, type TableSpec } from "@config/tables-booklet";

const SIZE = 210;
const PX = 2480;
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${PX}" height="${PX}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;
const r2 = (n: number) => Math.round(n * 100) / 100;

type Colours = (typeof THEMES)[keyof typeof THEMES];

/** The page's background: the theme's two colours top to bottom, with a soft dotted pattern. */
export function sceneSvg(t: Colours): string {
  return svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.top}"/><stop offset="1" stop-color="${t.bottom}"/></linearGradient>` +
      `<pattern id="d" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.6" fill="#ffffff" fill-opacity="0.35"/></pattern></defs>` +
      `<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/><rect width="${SIZE}" height="${SIZE}" fill="url(#d)"/>`,
  );
}

/** A plate with a hard shadow (the title banners, the cards). */
const plate = (x: number, y: number, w: number, h: number, fill: string, ink: string, r = 5) =>
  `<rect x="${r2(x + 1.6)}" y="${r2(y + 1.8)}" width="${r2(w)}" height="${r2(h)}" rx="${r}" fill="${ink}" fill-opacity="0.9"/>` +
  `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r}" fill="${fill}" stroke="${ink}" stroke-width="0.9"/>`;

function starPath(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${r2(cx + rr * Math.cos(a))},${r2(cy + rr * Math.sin(a))}`);
  }
  return `M${pts.join("L")}Z`;
}

/** One cell's mark, centred, `s` mm across. */
export function markSvg(mark: Mark, cx: number, cy: number, s: number, ink: string): string {
  const w = r2(Math.max(0.35, s * 0.06));
  const line = `fill="none" stroke="${ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const h = s / 2;
  switch (mark) {
    case "star":
      return `<path d="${starPath(cx, cy + s * 0.04, h)}" ${line}/>`;
    case "check":
      return `<rect x="${r2(cx - h * 0.8)}" y="${r2(cy - h * 0.8)}" width="${r2(h * 1.6)}" height="${r2(h * 1.6)}" rx="${r2(h * 0.3)}" ${line}/>`;
    case "smile":
      return (
        `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(h * 0.85)}" ${line}/>` +
        `<circle cx="${r2(cx - h * 0.3)}" cy="${r2(cy - h * 0.2)}" r="${r2(h * 0.09)}" fill="${ink}"/><circle cx="${r2(cx + h * 0.3)}" cy="${r2(cy - h * 0.2)}" r="${r2(h * 0.09)}" fill="${ink}"/>` +
        `<path d="M${r2(cx - h * 0.4)},${r2(cy + h * 0.15)} Q${r2(cx)},${r2(cy + h * 0.55)} ${r2(cx + h * 0.4)},${r2(cy + h * 0.15)}" ${line}/>`
      );
    case "heart":
      return `<path d="M${r2(cx)},${r2(cy + h * 0.75)} C${r2(cx - h * 1.2)},${r2(cy - h * 0.1)} ${r2(cx - h * 0.55)},${r2(cy - h * 0.95)} ${r2(cx)},${r2(cy - h * 0.35)} C${r2(cx + h * 0.55)},${r2(cy - h * 0.95)} ${r2(cx + h * 1.2)},${r2(cy - h * 0.1)} ${r2(cx)},${r2(cy + h * 0.75)}Z" ${line}/>`;
    case "circle":
      return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(h * 0.8)}" ${line}/>`;
    case "number":
      return `<rect x="${r2(cx - h * 1.05)}" y="${r2(cy - h * 0.7)}" width="${r2(h * 2.1)}" height="${r2(h * 1.4)}" rx="${r2(h * 0.25)}" ${line}/>`;
  }
}

const text = (value: string, x: number, y: number, w: number, h: number, o: Partial<TemplateText> = {}): TemplateText => ({
  value,
  font: "body",
  color: "#14234a",
  stroke: null,
  effect: null,
  wrap: false,
  x_mm: r2(x),
  y_mm: r2(y),
  width_mm: r2(w),
  height_mm: r2(h),
  ...o,
});

export interface LaidPage extends TemplatePage {
  overlaySvg: string;
  sceneSvg: string;
}

/** A table's page: its title plate, the goal, the grid (items on the right, days across), a mark in every cell. */
export function tablePage(t: TableSpec, c: Colours, withPose: boolean, copy: number, copies: number): LaidPage {
  const heads = COLUMN_KINDS[t.columns].heads as readonly string[];
  const gx1 = 198;
  const gx0 = withPose ? 58 : 12;
  const labelW = withPose ? 44 : 52;
  const marksX0 = gx0;
  const marksX1 = gx1 - labelW;
  const cw = (marksX1 - marksX0) / heads.length;
  const top = t.goal ? 54 : 47;
  const headH = 11;
  const rh = Math.min(16, (200 - top - headH) / t.rows.length);
  const gridBottom = top + headH + rh * t.rows.length;
  const texts: TemplateText[] = [];
  let body = plate(10, 8, 190, 28, c.banner, c.line, 6);
  texts.push(text(copies > 1 ? `${t.title} (${copy} من ${copies})` : t.title, 16, 11, 178, 22, { font: "display", color: c.bannerInk }));
  body += plate(gx0 - 4, 41, gx1 - gx0 + 8, Math.max(gridBottom - 41 + 4, 30), c.panel, c.line, 5);
  if (t.goal) texts.push(text(t.goal, gx0, 43.5, gx1 - gx0, 8, { color: c.mark }));
  // the header row (days) and the lines between the rows
  body += `<rect x="${r2(marksX0)}" y="${r2(top)}" width="${r2(marksX1 - marksX0)}" height="${headH}" rx="2" fill="${c.accent}" fill-opacity="0.25"/>`;
  // right to left: the first day sits next to the items
  const colX = (i: number) => marksX1 - (i + 1) * cw;
  heads.forEach((hd, i) => texts.push(text(hd, colX(i) + 0.3, top + 0.8, cw - 0.6, headH - 1.6, { color: c.mark, wrap: true })));
  t.rows.forEach((row, j) => {
    const y = top + headH + j * rh;
    if (j % 2 === 0) body += `<rect x="${r2(gx0)}" y="${r2(y)}" width="${r2(gx1 - gx0)}" height="${r2(rh)}" fill="${c.accent}" fill-opacity="0.08"/>`;
    body += `<line x1="${r2(gx0)}" y1="${r2(y + rh)}" x2="${r2(gx1)}" y2="${r2(y + rh)}" stroke="${c.line}" stroke-opacity="0.18" stroke-width="0.3"/>`;
    const lh = Math.min(rh * 0.86, 12);
    texts.push(text(row, marksX1 + 1, y + (rh - lh) / 2, labelW - 2, lh, { color: c.mark, wrap: true }));
    const s = Math.min(cw, rh) * 0.66;
    for (let i = 0; i < heads.length; i++) body += markSvg(t.mark, colX(i) + cw / 2, y + rh / 2, s, c.mark);
  });
  // a light line between the items and the days
  body += `<line x1="${r2(marksX1)}" y1="${r2(top)}" x2="${r2(marksX1)}" y2="${r2(gridBottom)}" stroke="${c.line}" stroke-opacity="0.3" stroke-width="0.4"/>`;
  return {
    scene: null,
    overlay: "",
    overlaySvg: svg(body),
    sceneSvg: sceneSvg(c),
    slots: withPose && t.pose ? [{ pose: t.pose, x_mm: 1, y_mm: 96, width_mm: 56, height_mm: 112, front: false }] : [],
    texts,
  };
}

/** A few stars scattered over a page (the pages without a picture). */
const sparkle = (c: Colours) =>
  [
    [30, 70, 6],
    [178, 64, 5],
    [40, 150, 4],
    [170, 150, 6],
    [105, 60, 3.5],
  ]
    .map(([x, y, r]) => `<path d="${starPath(x, y, r)}" fill="${c.accent}" stroke="${c.line}" stroke-width="0.5"/>`)
    .join("");

export function coverPage(spec: BookletSpec, c: Colours): LaidPage {
  let body = spec.photo ? "" : sparkle(c);
  body += plate(30, 170, 150, 26, c.banner, c.line, 8);
  return {
    scene: null,
    overlay: "",
    overlaySvg: svg(body),
    sceneSvg: sceneSvg(c),
    slots: spec.photo ? [{ pose: "happy", x_mm: 45, y_mm: 52, width_mm: 120, height_mm: 116, front: false }] : [],
    texts: [
      text(spec.title, 8, 14, 194, 34, { font: "display", color: "#ffffff", effect: "sticker" }),
      text("{name}", 36, 173, 138, 20, { font: "title", color: c.bannerInk }),
    ],
  };
}

export function messagePage(spec: BookletSpec, c: Colours): LaidPage {
  return {
    scene: null,
    overlay: "",
    overlaySvg: svg(plate(10, 8, 190, 28, c.banner, c.line, 6) + plate(14, 46, 182, spec.photo ? 96 : 150, c.panel, c.line, 8)),
    sceneSvg: sceneSvg(c),
    slots: spec.photo ? [{ pose: "happy", x_mm: 70, y_mm: 146, width_mm: 70, height_mm: 62, front: false }] : [],
    texts: [text("رسالة لـ {name}", 16, 11, 178, 22, { font: "display", color: c.bannerInk }), text("{message}", 24, 54, 162, spec.photo ? 80 : 134, { font: "hand", color: c.mark, wrap: true })],
  };
}

export function rewardsPage(spec: BookletSpec, c: Colours): LaidPage {
  let body = plate(10, 8, 190, 28, c.banner, c.line, 6);
  const texts: TemplateText[] = [text("مكافآتي", 16, 11, 178, 22, { font: "display", color: c.bannerInk })];
  const n = spec.rewards.length;
  const h = Math.min(19, 150 / n);
  spec.rewards.forEach((r, i) => {
    const y = 46 + i * (h + 2.5);
    body += plate(18, y, 174, h, c.panel, c.line, 5);
    body += `<path d="${starPath(30, y + h / 2, h * 0.32)}" fill="${c.accent}" stroke="${c.line}" stroke-width="0.4"/>`;
    texts.push(text(r, 40, y + h * 0.12, 146, Math.min(h * 0.76, 13), { color: c.mark, wrap: true }));
  });
  return { scene: null, overlay: "", overlaySvg: svg(body), sceneSvg: sceneSvg(c), slots: [], texts };
}

export function certificatePage(spec: BookletSpec, c: Colours): LaidPage {
  const body =
    plate(14, 14, 182, 182, c.panel, c.line, 10) +
    `<rect x="20" y="20" width="170" height="170" rx="7" fill="none" stroke="${c.accent}" stroke-width="1.4" stroke-dasharray="3 2"/>` +
    (spec.photo ? "" : sparkle(c)) +
    `<line x1="60" y1="184" x2="150" y2="184" stroke="${c.line}" stroke-width="0.4"/>`;
  return {
    scene: null,
    overlay: "",
    overlaySvg: svg(body),
    sceneSvg: sceneSvg(c),
    slots: spec.photo ? [{ pose: "happy", x_mm: 72, y_mm: 90, width_mm: 66, height_mm: 70, front: true }] : [],
    texts: [
      text("شهادة إنجاز", 30, 26, 150, 24, { font: "display", color: "#ffffff", effect: "epic" }),
      text("أحسنت يا {name}!", 30, 56, 150, 16, { font: "title", color: c.mark }),
      text(`أكملت «${spec.title}»`, 30, 74, 150, 11, { color: c.mark }),
      text("التاريخ", 80, 176, 50, 7, { color: c.mark }),
    ],
  };
}

/** The whole booklet of a design, as a template the composer draws (every page carries its own background and shapes). */
export function bookletTemplate(spec: BookletSpec): Template & { pages: LaidPage[] } {
  const c = THEMES[spec.theme];
  const pages: LaidPage[] = [coverPage(spec, c)];
  if (spec.message) pages.push(messagePage(spec, c));
  for (const t of spec.tables) for (let k = 1; k <= t.copies; k++) pages.push(tablePage(t, c, spec.photo && !!t.pose, k, t.copies));
  if (spec.rewards.length) pages.push(rewardsPage(spec, c));
  if (spec.certificate) pages.push(certificatePage(spec, c));
  return { id: TB.customTemplate, name: spec.title, page_size_mm: { width: SIZE, height: SIZE }, poses: posesOf(spec), scenes: [], pages };
}
