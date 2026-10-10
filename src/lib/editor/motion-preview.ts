// «موشن جرافيكس» — a small still of what a skill or a mood looks like, drawn by the engine itself (the real background,
// the real decoration and scene, the real layout of a sample title), as an SVG picture محمد باقر's galleries show next to
// each name. Pure and deterministic.

import { motionPlan, type Storyboard } from "./motion-build";
import { moodOf } from "./motion-styles";
import { inkOn, panelSvg, talkStyleOf, type TalkStyle } from "./talk-styles";
import { frameGeo, frameModes, type FrameMode, type TalkLayout } from "./talk-motion";

const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The preview as an SVG string (portrait 9:16, `width` px wide). */
export function previewSvg(o: { style?: string; mood?: string }, width = 270): string {
  const W = 540;
  const H = 960;
  const mood = moodOf(o.mood);
  const sb: Storyboard = {
    ...(o.style ? { style: o.style } : {}),
    ...(mood ? { look: { mood: mood.id } } : {}),
    beats: [{ kind: "title", title: "عنوان الموشن", text: "فكرة واحدة بوضوح", icon: "bulb" }],
  };
  const plan = motionPlan(sb, W, H);
  const bg = plan.art.find((a) => a.key === "bg-0");
  const deco = plan.art.find((a) => a.key === "art-0");
  const texts = plan.placed
    .map((p) => {
      const px = p.size * H;
      const lh = px * 1.3;
      const top = p.y * H - (p.lines.length * lh) / 2;
      const x = p.align === "right" ? (p.x + p.w / 2) * W : p.x * W;
      // in right-to-left text the "start" is the right edge
      const anchor = p.align === "right" ? "start" : "middle";
      const box = p.box ? `<rect x="${(p.x * W - (p.w * W) / 2).toFixed(1)}" y="${(p.y * H - (p.lines.length * lh) / 2).toFixed(1)}" width="${(p.w * W).toFixed(1)}" height="${(p.lines.length * lh).toFixed(1)}" rx="8" fill="${p.box}"/>` : "";
      return `${box}<text direction="rtl" text-anchor="${anchor}" font-family="Cairo, Tajawal, Arial, sans-serif" font-weight="${p.weight}" font-size="${px.toFixed(1)}" fill="${p.color}">${p.lines.map((l, i) => `<tspan x="${x.toFixed(1)}" y="${(top + lh * (i + 0.8)).toFixed(1)}">${esc(l)}</tspan>`).join("")}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round((width * H) / W)}" viewBox="0 0 ${W} ${H}">${bg ? inner(bg.svg) : `<rect width="${W}" height="${H}" fill="${plan.palette.bg}"/>`}${deco ? inner(deco.svg) : ""}${texts}</svg>`;
}

/** The preview as a data: URI an <img> can show. */
export const previewUri = (o: { style?: string; mood?: string }) => `data:image/svg+xml;utf8,${encodeURIComponent(previewSvg(o))}`;

// ───────── «موشن على كلامه»: a still of a look's panel, with a word on it and the person's window ─────────

const FAMILY: Record<string, string> = {
  "playpen-sans-arabic": "'Playpen Sans Arabic', Cairo, sans-serif",
  lalezar: "Lalezar, Cairo, sans-serif",
  handjet: "Handjet, Cairo, sans-serif",
  "ibm-plex-sans-arabic": "'IBM Plex Sans Arabic', Cairo, sans-serif",
  "aref-ruqaa": "'Aref Ruqaa', Cairo, serif",
  marhey: "Marhey, Cairo, sans-serif",
  alexandria: "Alexandria, Cairo, sans-serif",
  rakkas: "Rakkas, Cairo, sans-serif",
  "el-messiri": "'El Messiri', Cairo, sans-serif",
  lemonada: "Lemonada, Cairo, sans-serif",
  cairo: "Cairo, sans-serif",
  rubik: "Rubik, Cairo, sans-serif",
  "reem-kufi-fun": "'Reem Kufi Fun', Cairo, sans-serif",
  "markazi-text": "'Markazi Text', Cairo, serif",
  "baloo-bhaijaan-2": "'Baloo Bhaijaan 2', Cairo, sans-serif",
  tajawal: "Tajawal, Cairo, sans-serif",
  "cascadia-code": "'Cascadia Code', monospace",
};
const familyOf = (id: string) => FAMILY[id] ?? "Cairo, Tajawal, Arial, sans-serif";

/**
 * A still of a talking-reel look: its panel as the engine draws it, the window the person shows through (a grey
 * stand-in with a face mark), and one word on its card in the look's own title font.
 */
export function talkPreviewSvg(id: string, width = 270, word = "فكرتك"): string {
  const st: TalkStyle | null = talkStyleOf(id);
  if (!st) return "";
  const W = 540;
  const H = 960;
  const bg = st.panels[0];
  // the person's window: a box at the bottom, as the «المربع الصغير» frame has it
  const hw = W * 0.36;
  const hh = H * 0.36;
  const hole = { x: W * 0.5 - hw / 2, y: H * 0.8 - hh / 2, w: hw, h: hh, round: false };
  const panel = panelSvg(st, W, H, bg, 7, hole);
  const ink = inkOn(bg, st.ink);
  const size = H * 0.1;
  const cardW = size * (word.length * 0.7 + 1.1);
  const cardY = H * 0.3;
  const card =
    st.card === "none"
      ? ""
      : st.card === "sticker"
        ? `<rect x="${(W / 2 - cardW / 2).toFixed(1)}" y="${(cardY - size * 0.8).toFixed(1)}" width="${cardW.toFixed(1)}" height="${(size * 1.55).toFixed(1)}" rx="${(size * 0.3).toFixed(1)}" fill="#ffffff" stroke="#111111" stroke-opacity="0.2" stroke-width="3"/>`
        : st.card === "marker"
          ? `<rect x="${(W / 2 - cardW / 2).toFixed(1)}" y="${(cardY - size * 0.45).toFixed(1)}" width="${cardW.toFixed(1)}" height="${(size * 0.9).toFixed(1)}" fill="#fde047"/>`
          : `<rect x="${(W / 2 - cardW / 2).toFixed(1)}" y="${(cardY - size * 0.8).toFixed(1)}" width="${cardW.toFixed(1)}" height="${(size * 1.55).toFixed(1)}" rx="${(size * 0.3).toFixed(1)}" fill="${st.accent}"/>`;
  const wordColor = st.card === "sticker" || st.card === "marker" ? "#111111" : st.card === "pill" ? inkOn(st.accent, st.ink) : ink;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round((width * H) / W)}" viewBox="0 0 ${W} ${H}">
${inner(panel)}
<rect x="${hole.x.toFixed(1)}" y="${hole.y.toFixed(1)}" width="${hole.w.toFixed(1)}" height="${hole.h.toFixed(1)}" rx="${(hole.w * 0.08).toFixed(1)}" fill="#8b8b8b"/>
<circle cx="${(W / 2).toFixed(1)}" cy="${(hole.y + hh * 0.42).toFixed(1)}" r="${(hw * 0.19).toFixed(1)}" fill="#d9d9d9"/>
<path d="M${(W / 2 - hw * 0.3).toFixed(1)} ${(hole.y + hh).toFixed(1)} q ${(hw * 0.3).toFixed(1)} ${(-hh * 0.3).toFixed(1)} ${(hw * 0.6).toFixed(1)} 0 z" fill="#d9d9d9"/>
${card}
<text direction="rtl" text-anchor="middle" x="${(W / 2).toFixed(1)}" y="${(cardY + size * 0.36).toFixed(1)}" font-family="${familyOf(st.title)}" font-weight="900" font-size="${size.toFixed(1)}" fill="${wordColor}">${esc(word)}</text>
<text direction="rtl" text-anchor="middle" x="${(W / 2).toFixed(1)}" y="${(cardY + size * 1.7).toFixed(1)}" font-family="${familyOf(st.body)}" font-weight="700" font-size="${(size * 0.42).toFixed(1)}" fill="${ink}">كلمتك تطلع هنا</text>
</svg>`;
}

export const talkPreviewUri = (id: string) => `data:image/svg+xml;utf8,${encodeURIComponent(talkPreviewSvg(id))}`;

// ───────── the frames of a talking reel: what the screen does at each moment, drawn from the engine's own geometry ─────────

const FACE = { x: 0.5, y: 0.4, w: 0.3, h: 0.22 };

/** The person as a grey stand-in with a face, where the frame puts them (the real transform of the engine). */
function personAt(mode: FrameMode, W: number, H: number): string {
  const t = frameGeo(mode, W, H, FACE).person({ x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 });
  const w = W * t.scale;
  const h = H * t.scale;
  const x = t.x * W - w / 2;
  const y = t.y * H - h / 2;
  const fx = x + FACE.x * w;
  const fy = y + FACE.y * h;
  const r = Math.min(w, h) * 0.13;
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#8b8b8b"/><circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${r.toFixed(1)}" fill="#d9d9d9"/><path d="M${(fx - r * 1.9).toFixed(1)} ${(fy + h * 0.3).toFixed(1)} q ${(r * 1.9).toFixed(1)} ${(-r * 1.7).toFixed(1)} ${(r * 3.8).toFixed(1)} 0 z" fill="#d9d9d9"/>`;
}

/** One frame of a talking reel: the person where it puts them, the look's panel over the rest, and the word's card. */
function frameSvg(mode: FrameMode, st: TalkStyle, W: number, H: number, word: string): string {
  const geo = frameGeo(mode, W, H, FACE);
  const parts = [personAt(mode, W, H)];
  if (geo.panel) {
    // the panel spans the frame's width; a half-frame one covers its own half. Its window (when it has one) lets the person through
    const pw = W;
    const ph = (geo.panel.h / geo.panel.w) * W;
    const k = pw / geo.panel.w;
    const hole = geo.panel.hole ? { ...geo.panel.hole, x: geo.panel.hole.x * k, y: geo.panel.hole.y * k, w: geo.panel.hole.w * k, h: geo.panel.hole.h * k } : null;
    const svg = panelSvg(st, Math.round(pw), Math.round(ph), st.panels[0], 11, hole);
    parts.push(`<g transform="translate(${(geo.panel.x * W - pw / 2).toFixed(1)} ${(geo.panel.y * H - ph / 2).toFixed(1)})">${inner(svg)}</g>`);
  }
  const ink = inkOn(st.panels[0], st.ink);
  const size = H * 0.085;
  const cw = size * (word.length * 0.7 + 1.1);
  const cy = geo.area.y * H;
  parts.push(
    `<rect x="${(geo.area.x * W - cw / 2).toFixed(1)}" y="${(cy - size * 0.8).toFixed(1)}" width="${cw.toFixed(1)}" height="${(size * 1.5).toFixed(1)}" rx="${(size * 0.3).toFixed(1)}" fill="${st.accent}"/>`,
    `<text direction="rtl" text-anchor="middle" x="${(geo.area.x * W).toFixed(1)}" y="${(cy + size * 0.32).toFixed(1)}" font-family="${familyOf(st.title)}" font-weight="900" font-size="${size.toFixed(1)}" fill="${inkOn(st.accent, st.ink)}">${esc(word)}</text>`,
  );
  if (geo.divider != null) parts.push(`<rect x="0" y="${(geo.divider * H - H * 0.004).toFixed(1)}" width="${W}" height="${(H * 0.008).toFixed(1)}" fill="${st.accent}"/>`);
  return parts.join("");
}

/**
 * A still of a talking-reel KIND: what the screen looks like at a moment — the person in a box, in a corner, one half
 * of a split, or full with the words over them. «ريل متنوع» shows four of its frames at once, since changing is its point.
 */
export function framePreviewSvg(layout: TalkLayout, width = 270, lookId = "minimal"): string {
  const W = 540;
  const H = 960;
  const st = talkStyleOf(lookId) ?? talkStyleOf("minimal")!;
  const words = ["فكرتك", "الرياض", "٧٠٪", "جديد"];
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round((width * H) / W)}" viewBox="0 0 ${W} ${H}">`;
  if (layout === "mix") {
    // four of its frames in a 2×2 grid: the frame never stays the same twice in a row
    const modes = frameModes("mix", 4);
    const cells = modes
      .map((m, i) => {
        const x = (i % 2) * (W / 2);
        const y = Math.floor(i / 2) * (H / 2);
        return `<g transform="translate(${x} ${y}) scale(0.5)"><clipPath id="c${i}"><rect width="${W}" height="${H}"/></clipPath><g clip-path="url(#c${i})"><rect width="${W}" height="${H}" fill="${st.panels[0]}"/>${frameSvg(m, st, W, H, words[i])}</g></g>`;
      })
      .join("");
    return `${open}<rect width="${W}" height="${H}" fill="#1a1a1a"/>${cells}<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#1a1a1a" stroke-width="6"/><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#1a1a1a" stroke-width="6"/>${open.length ? "" : ""}</svg>`;
  }
  const mode: FrameMode = layout === "split" ? "split-top" : layout === "corner" ? "corner" : layout === "shrink" ? "shrink" : "punch";
  const over = layout === "over" || layout === "over3d";
  const body = frameSvg(mode, st, W, H, words[0]);
  // «فوق كلامي ثلاثي الأبعاد»: the card lifted off the picture, with its own side and shadow
  const lift = layout === "over3d" ? `<rect x="${(W * 0.22).toFixed(1)}" y="${(H * 0.3).toFixed(1)}" width="${(W * 0.56).toFixed(1)}" height="${(H * 0.1).toFixed(1)}" rx="18" fill="#000" opacity="0.35" transform="translate(10 18)"/>` : "";
  return `${open}<rect width="${W}" height="${H}" fill="${over ? "#2b2b2b" : st.panels[0]}"/>${lift}${body}</svg>`;
}

export const framePreviewUri = (layout: TalkLayout, lookId?: string) => `data:image/svg+xml;utf8,${encodeURIComponent(framePreviewSvg(layout, 270, lookId))}`;
