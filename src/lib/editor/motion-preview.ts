// «موشن جرافيكس» — a small still of what a skill or a mood looks like, drawn by the engine itself (the real background,
// the real decoration and scene, the real layout of a sample title), as an SVG picture محمد باقر's galleries show next to
// each name. Pure and deterministic.

import { motionPlan, type Storyboard } from "./motion-build";
import { moodOf } from "./motion-styles";

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
