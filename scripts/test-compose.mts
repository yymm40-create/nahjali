// Offline check of the PDF composer and the background-removal fallback.
// Uses simple placeholder shapes instead of AI images, so it needs no API keys.
// Usage: npx tsx scripts/test-compose.mts   → writes tmp/test-booklet.pdf
import { mkdir, writeFile } from "fs/promises";
import sharp from "sharp";
import { composeBooklet } from "@/lib/compose";
import { ensureTransparent } from "@/lib/openai";
import { getTemplate } from "@/lib/templates";

const COLORS = ["#e63946", "#2a9d8f", "#264653", "#f4a261", "#8338ec", "#3a86ff"];

/** 1024x1536 placeholder on a flat grey background (like an opaque AI result). */
function placeholder(label: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
    <rect width="1024" height="1536" fill="#d9d9d9"/>
    <rect x="262" y="160" width="500" height="1240" rx="250" fill="${color}" stroke="#111" stroke-width="24"/>
    <text x="512" y="800" font-size="110" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const template = await getTemplate("habits-v1");
if (!template) throw new Error("template not found");

const images: Record<string, Buffer> = {};
for (const [i, pose] of template.poses.entries()) {
  // Exercise the fallback: grey background must become transparent
  images[pose] = await ensureTransparent(await placeholder(pose, COLORS[i % COLORS.length]));
}

const { data, info } = await sharp(images.happy).raw().toBuffer({ resolveWithObject: true });
const corner = data[3];
const center = data[((info.height / 2) * info.width + info.width / 2) * 4 + 3];
console.log(`background removal: corner alpha=${corner} (want 0), center alpha=${center} (want 255)`);
if (corner !== 0 || center !== 255) throw new Error("background removal failed");

const pdf = await composeBooklet(template, images);
await mkdir("tmp", { recursive: true });
await writeFile("tmp/test-booklet.pdf", pdf);
console.log(`PDF ok: ${template.pages.length} pages, ${(pdf.length / 1024 / 1024).toFixed(1)} MB → tmp/test-booklet.pdf`);
