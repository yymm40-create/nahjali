// «موشن جرافيكس» — the scenes the engine DRAWS behind the words (rain, stars, dunes, a city skyline, a mosque against
// the sky, waves, clouds, rays, sparkles…): vector shapes in the piece's own palette, kept faint and mostly to the
// edges so they never fight the words. The editor draws them itself — never a generator. Deterministic and pure: the
// same scene, palette and beat draw the same picture.

import type { Palette } from "./motion-build";
import type { SceneId } from "./motion-styles";

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const isDark = (h: string) => rgb(h).reduce((s, v) => s + v, 0) / 3 < 128;
const f1 = (n: number) => n.toFixed(1);
const seeded = (seed: number) => {
  let s = ((Math.abs(Math.round(seed)) + 1) * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};

/** Every layer of a scene is at most this opaque (the words stay readable on any of them: tested for every palette). */
export const SCENE_MAX_ALPHA = 0.3;

/** A four-point sparkle centred at (x, y) with radius r. */
const spark = (x: number, y: number, r: number, color: string, op: number) =>
  `<path d="M${f1(x)} ${f1(y - r)} Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r)} Q${f1(x)} ${f1(y)} ${f1(x - r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r)} Z" fill="${color}" opacity="${op.toFixed(2)}"/>`;

/** A cloud: three circles on a rounded base. */
const cloud = (x: number, y: number, s: number, color: string, op: number) =>
  `<g fill="${color}" opacity="${op.toFixed(2)}"><circle cx="${f1(x - s * 0.5)}" cy="${f1(y)}" r="${f1(s * 0.38)}"/><circle cx="${f1(x)}" cy="${f1(y - s * 0.22)}" r="${f1(s * 0.5)}"/><circle cx="${f1(x + s * 0.55)}" cy="${f1(y)}" r="${f1(s * 0.36)}"/><rect x="${f1(x - s * 0.9)}" y="${f1(y)}" width="${f1(s * 1.8)}" height="${f1(s * 0.3)}" rx="${f1(s * 0.15)}"/></g>`;

/** A dome with a crescent finial: base centre (x, y) on the ground, half-width r. */
const dome = (x: number, y: number, r: number, color: string, op: number) =>
  `<g fill="${color}" opacity="${op.toFixed(2)}"><path d="M${f1(x - r)} ${f1(y)} A${f1(r)} ${f1(r * 1.05)} 0 0 1 ${f1(x + r)} ${f1(y)} Z"/><rect x="${f1(x - r * 0.04)}" y="${f1(y - r * 1.5)}" width="${f1(r * 0.08)}" height="${f1(r * 0.5)}"/><circle cx="${f1(x)}" cy="${f1(y - r * 1.58)}" r="${f1(r * 0.12)}"/></g>`;

/** A minaret: a tall tapered shaft with a balcony and a pointed cap. */
const minaret = (x: number, y: number, w: number, hgt: number, color: string, op: number) =>
  `<g fill="${color}" opacity="${op.toFixed(2)}"><path d="M${f1(x - w / 2)} ${f1(y)} L${f1(x - w * 0.36)} ${f1(y - hgt)} L${f1(x + w * 0.36)} ${f1(y - hgt)} L${f1(x + w / 2)} ${f1(y)} Z"/><rect x="${f1(x - w * 0.62)}" y="${f1(y - hgt)}" width="${f1(w * 1.24)}" height="${f1(w * 0.18)}"/><path d="M${f1(x - w * 0.4)} ${f1(y - hgt - w * 0.18)} L${f1(x)} ${f1(y - hgt - w * 1.7)} L${f1(x + w * 0.4)} ${f1(y - hgt - w * 0.18)} Z"/></g>`;

/** A filled wave band along the bottom: `amp` and `len` in pixels, top edge at `y`. */
function wave(w: number, h: number, y: number, amp: number, len: number, phase: number, color: string, op: number) {
  let d = `M0 ${f1(y)}`;
  const n = Math.ceil(w / len) + 1;
  for (let k = 0; k < n; k++) {
    const x0 = k * len - phase;
    d += ` Q${f1(x0 + len / 4)} ${f1(y - amp)} ${f1(x0 + len / 2)} ${f1(y)} T${f1(x0 + len)} ${f1(y)}`;
  }
  d += ` L${f1(n * len)} ${f1(h)} L0 ${f1(h)} Z`;
  return `<path d="${d}" fill="${color}" opacity="${op.toFixed(2)}"/>`;
}

/**
 * One scene as SVG elements (no wrapper) for beat `i`, drawn over the background colour, in the palette's colours.
 * The beat number changes details (where the sun sits, which windows are lit) so no two beats look the same.
 */
export function sceneSvg(scene: SceneId | undefined, pal: Palette, i: number, w: number, h: number): string {
  if (!scene || scene === "none") return "";
  const u = Math.min(w, h);
  const r = seeded(i * 13 + scene.length * 7 + 1);
  const ink = isDark(pal.bg) ? "#ffffff" : "#000000";
  const p: string[] = [];
  switch (scene) {
    case "stars": {
      for (let k = 0; k < 46; k++) p.push(`<circle cx="${f1(r() * w)}" cy="${f1(r() * h * 0.7)}" r="${f1(u * (0.0025 + r() * 0.004))}" fill="${ink}" opacity="${(0.1 + r() * 0.2).toFixed(2)}"/>`);
      for (let k = 0; k < 5; k++) p.push(spark(w * (0.1 + r() * 0.8), h * (0.06 + r() * 0.4), u * (0.012 + r() * 0.016), pal.pill, 0.28));
      // a thin crescent in a corner that changes side every beat
      const cx = i % 2 ? w * 0.82 : w * 0.18;
      p.push(`<path d="M${f1(cx)} ${f1(h * 0.1)} a${f1(u * 0.05)} ${f1(u * 0.05)} 0 1 0 ${f1(u * 0.05)} ${f1(u * 0.07)} a${f1(u * 0.04)} ${f1(u * 0.04)} 0 1 1 ${f1(-u * 0.05)} ${f1(-u * 0.07)} Z" fill="${pal.pill}" opacity="0.26"/>`);
      break;
    }
    case "rain": {
      const sw = f1(u * 0.0035);
      for (let k = 0; k < 44; k++) {
        const x = r() * w * 1.1;
        const y = r() * h;
        const len = u * (0.035 + r() * 0.05);
        p.push(`<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x - len * 0.35)}" y2="${f1(y + len)}" stroke="${pal.second}" stroke-width="${sw}" stroke-linecap="round" opacity="${(0.1 + r() * 0.12).toFixed(2)}"/>`);
      }
      // ripples on the ground
      for (let k = 0; k < 4; k++) p.push(`<ellipse cx="${f1(w * (0.15 + r() * 0.7))}" cy="${f1(h * (0.9 + r() * 0.06))}" rx="${f1(u * (0.03 + r() * 0.03))}" ry="${f1(u * 0.009)}" fill="none" stroke="${pal.second}" stroke-width="${f1(u * 0.003)}" opacity="0.2"/>`);
      p.push(`<rect width="${w}" height="${f1(h * 0.16)}" fill="${ink}" opacity="${isDark(pal.bg) ? "0.0" : "0.04"}"/>`);
      break;
    }
    case "dunes": {
      p.push(`<circle cx="${f1(w * (i % 2 ? 0.8 : 0.2))}" cy="${f1(h * 0.62)}" r="${f1(u * 0.12)}" fill="${pal.pill}" opacity="0.2"/>`);
      p.push(wave(w, h, h * 0.84, u * 0.05, w * 0.9, w * 0.15 * (i % 3), pal.accent, 0.12));
      p.push(wave(w, h, h * 0.89, u * 0.04, w * 0.7, w * 0.3 * (i % 2), pal.second, 0.16));
      p.push(wave(w, h, h * 0.94, u * 0.03, w * 0.55, w * 0.1, pal.accent, 0.2));
      break;
    }
    case "skyline": {
      let x = -u * 0.02;
      const base = h * 0.97;
      while (x < w) {
        const bw = u * (0.05 + r() * 0.07);
        const bh = h * (0.05 + r() * 0.15);
        p.push(`<rect x="${f1(x)}" y="${f1(base - bh)}" width="${f1(bw)}" height="${f1(bh)}" fill="${pal.second}" opacity="${(0.12 + r() * 0.1).toFixed(2)}"/>`);
        if (r() > 0.55) p.push(`<rect x="${f1(x + bw * 0.45)}" y="${f1(base - bh - u * 0.04)}" width="${f1(u * 0.004)}" height="${f1(u * 0.04)}" fill="${pal.second}" opacity="0.2"/>`);
        // a few lit windows
        for (let k = 0; k < 3; k++) if (r() > 0.5) p.push(`<rect x="${f1(x + bw * (0.2 + 0.25 * k))}" y="${f1(base - bh * (0.3 + r() * 0.5))}" width="${f1(bw * 0.12)}" height="${f1(bw * 0.12)}" fill="${pal.pill}" opacity="0.28"/>`);
        x += bw + u * 0.004;
      }
      p.push(`<rect y="${f1(base)}" width="${w}" height="${f1(h - base)}" fill="${pal.second}" opacity="0.2"/>`);
      break;
    }
    case "mosque": {
      const base = h * 0.95;
      const mx = w * 0.5;
      p.push(spark(w * 0.2, h * 0.14, u * 0.02, pal.pill, 0.26), spark(w * 0.82, h * 0.2, u * 0.016, pal.pill, 0.24), spark(w * 0.62, h * 0.08, u * 0.012, pal.pill, 0.22));
      p.push(`<rect x="${f1(mx - u * 0.3)}" y="${f1(base - u * 0.08)}" width="${f1(u * 0.6)}" height="${f1(u * 0.08)}" fill="${pal.accent}" opacity="0.18"/>`);
      p.push(dome(mx, base - u * 0.08, u * 0.13, pal.accent, 0.2));
      p.push(dome(mx - u * 0.22, base - u * 0.08, u * 0.06, pal.accent, 0.18), dome(mx + u * 0.22, base - u * 0.08, u * 0.06, pal.accent, 0.18));
      p.push(minaret(mx - u * 0.38, base, u * 0.035, u * 0.34, pal.accent, 0.18), minaret(mx + u * 0.38, base, u * 0.035, u * 0.34, pal.accent, 0.18));
      p.push(`<rect y="${f1(base)}" width="${w}" height="${f1(h - base)}" fill="${pal.accent}" opacity="0.2"/>`);
      break;
    }
    case "waves": {
      p.push(wave(w, h, h * 0.8, u * 0.025, u * 0.5, 0, pal.second, 0.1));
      p.push(wave(w, h, h * 0.86, u * 0.03, u * 0.42, u * 0.12, pal.accent, 0.12));
      p.push(wave(w, h, h * 0.92, u * 0.03, u * 0.36, u * 0.2, pal.second, 0.18));
      break;
    }
    case "clouds": {
      for (let k = 0; k < 5; k++) p.push(cloud(w * (0.1 + r() * 0.8), h * (0.08 + r() * 0.3), u * (0.06 + r() * 0.07), ink, 0.07 + r() * 0.05));
      p.push(cloud(w * (0.2 + 0.6 * r()), h * 0.9, u * 0.12, ink, 0.06));
      break;
    }
    case "rays": {
      const cx = w * 0.5;
      const cy = h * (i % 2 ? 0.1 : 0.9);
      const n = 18;
      for (let k = 0; k < n; k++) {
        if (k % 2) continue;
        const a0 = (Math.PI * 2 * k) / n + i * 0.07;
        const a1 = (Math.PI * 2 * (k + 1)) / n + i * 0.07;
        const R = Math.max(w, h) * 1.2;
        p.push(`<polygon points="${f1(cx)},${f1(cy)} ${f1(cx + Math.cos(a0) * R)},${f1(cy + Math.sin(a0) * R)} ${f1(cx + Math.cos(a1) * R)},${f1(cy + Math.sin(a1) * R)}" fill="${pal.accent}" opacity="0.07"/>`);
      }
      p.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(u * 0.09)}" fill="${pal.pill}" opacity="0.22"/>`);
      break;
    }
    case "sparkles": {
      const cols = [pal.pill, pal.accent, pal.second];
      for (let k = 0; k < 22; k++) p.push(spark(r() * w, r() * h, u * (0.008 + r() * 0.02), cols[k % 3], 0.2 + r() * 0.24));
      for (let k = 0; k < 14; k++) p.push(`<circle cx="${f1(r() * w)}" cy="${f1(r() * h)}" r="${f1(u * (0.004 + r() * 0.006))}" fill="${cols[(k + 1) % 3]}" opacity="${(0.2 + r() * 0.2).toFixed(2)}"/>`);
      break;
    }
    case "bars": {
      const n = 9;
      const gap = w / (n + 1);
      for (let k = 0; k < n; k++) {
        const bh = h * (0.05 + 0.025 * k + r() * 0.02);
        p.push(`<rect x="${f1(gap * (k + 0.5))}" y="${f1(h - bh)}" width="${f1(gap * 0.6)}" height="${f1(bh)}" rx="${f1(u * 0.005)}" fill="${k === n - 1 ? pal.accent : pal.second}" opacity="${(0.12 + k * 0.012).toFixed(2)}"/>`);
      }
      p.push(`<path d="M${f1(gap * 0.8)} ${f1(h * 0.93)} L${f1(w - gap * 0.8)} ${f1(h * 0.78)}" stroke="${pal.accent}" stroke-width="${f1(u * 0.004)}" stroke-dasharray="${f1(u * 0.012)} ${f1(u * 0.012)}" fill="none" opacity="0.25"/>`);
      break;
    }
    case "rings": {
      const cx = w * 0.5;
      const cy = h * (0.45 + 0.1 * (i % 2));
      for (let k = 1; k <= 6; k++) p.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(u * 0.12 * k)}" fill="none" stroke="${k % 2 ? pal.accent : pal.second}" stroke-width="${f1(u * 0.004)}" opacity="${(0.16 - k * 0.018).toFixed(2)}"/>`);
      break;
    }
    case "stripes": {
      const gap = u * 0.09;
      for (let x = -h; x < w + h; x += gap * 2) p.push(`<polygon points="${f1(x)},${h} ${f1(x + gap)},${h} ${f1(x + gap + h * 0.6)},${f1(h * 0.4)} ${f1(x + h * 0.6)},${f1(h * 0.4)}" fill="${pal.accent}" opacity="0.08"/>`);
      p.push(`<rect y="0" width="${w}" height="${f1(h * 0.018)}" fill="${pal.accent}" opacity="0.28"/>`, `<rect y="${f1(h * 0.982)}" width="${w}" height="${f1(h * 0.018)}" fill="${pal.accent}" opacity="0.28"/>`);
      break;
    }
    case "dots": {
      const step = u * 0.06;
      for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
        const k = Math.max(0, (x / w + y / h) / 2 - 0.15);
        if (k > 0.05) p.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(step * 0.32 * k)}" fill="${pal.second}" opacity="0.2"/>`);
      }
      break;
    }
    case "hills": {
      p.push(`<circle cx="${f1(w * (0.25 + 0.5 * (i % 2)))}" cy="${f1(h * 0.18)}" r="${f1(u * 0.07)}" fill="${pal.pill}" opacity="0.22"/>`);
      p.push(`<path d="M0 ${f1(h * 0.86)} Q${f1(w * 0.25)} ${f1(h * 0.76)} ${f1(w * 0.5)} ${f1(h * 0.86)} T${w} ${f1(h * 0.84)} L${w} ${h} L0 ${h} Z" fill="${pal.accent}" opacity="0.12"/>`);
      p.push(`<path d="M0 ${f1(h * 0.92)} Q${f1(w * 0.3)} ${f1(h * 0.84)} ${f1(w * 0.6)} ${f1(h * 0.92)} T${w} ${f1(h * 0.9)} L${w} ${h} L0 ${h} Z" fill="${pal.second}" opacity="0.18"/>`);
      for (let k = 0; k < 6; k++) {
        const tx = w * (0.08 + r() * 0.84);
        const ty = h * (0.93 + r() * 0.03);
        p.push(`<path d="M${f1(tx)} ${f1(ty - u * 0.05)} L${f1(tx - u * 0.02)} ${f1(ty)} L${f1(tx + u * 0.02)} ${f1(ty)} Z" fill="${pal.second}" opacity="0.26"/>`);
      }
      break;
    }
    case "chalk": {
      const g = u * 0.08;
      for (let x = g; x < w; x += g) p.push(`<line x1="${f1(x)}" y1="0" x2="${f1(x)}" y2="${h}" stroke="${ink}" stroke-width="1" opacity="0.045"/>`);
      for (let y = g; y < h; y += g) p.push(`<line x1="0" y1="${f1(y)}" x2="${w}" y2="${f1(y)}" stroke="${ink}" stroke-width="1" opacity="0.045"/>`);
      for (let k = 0; k < 7; k++) {
        const x = w * (0.08 + r() * 0.84);
        const y = h * (r() > 0.5 ? 0.05 + r() * 0.1 : 0.86 + r() * 0.1);
        const s = u * 0.016;
        p.push(`<path d="M${f1(x - s)} ${f1(y)} L${f1(x + s)} ${f1(y)} M${f1(x)} ${f1(y - s)} L${f1(x)} ${f1(y + s)}" stroke="${pal.second}" stroke-width="${f1(u * 0.004)}" stroke-linecap="round" opacity="0.28"/>`);
      }
      p.push(`<path d="M${f1(w * 0.08)} ${f1(h * 0.95)} C${f1(w * 0.3)} ${f1(h * 0.95)} ${f1(w * 0.4)} ${f1(h * 0.88)} ${f1(w * 0.55)} ${f1(h * 0.88)} S${f1(w * 0.8)} ${f1(h * 0.8)} ${f1(w * 0.92)} ${f1(h * 0.82)}" fill="none" stroke="${pal.accent}" stroke-width="${f1(u * 0.005)}" stroke-dasharray="${f1(u * 0.014)} ${f1(u * 0.012)}" stroke-linecap="round" opacity="0.26"/>`);
      break;
    }
  }
  return p.join("");
}
