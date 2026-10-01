// Offline check of the PDF composer and the background removal.
// Uses simple placeholder shapes instead of AI images, so it needs no API keys.
// Usage: npx tsx scripts/test-compose.mts   → writes tmp/test-booklet.pdf
import { mkdir, writeFile } from "fs/promises";
import sharp from "sharp";
import { composeBooklet } from "@/lib/compose";
import { ensureTransparent } from "@/lib/openai";
import { getTemplate } from "@/lib/templates";

const COLORS = ["#e63946", "#2a9d8f", "#264653", "#f4a261", "#8338ec", "#3a86ff"];

/** 1024x1536 placeholder on a green screen (like an AI pose), with an enclosed gap and a green prop. */
function placeholder(label: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
    <rect width="1024" height="1536" fill="#00FF00"/>
    <rect x="262" y="160" width="500" height="1240" rx="250" fill="${color}" stroke="#111" stroke-width="24"/>
    <circle cx="512" cy="420" r="150" fill="#4CAF50" stroke="#111" stroke-width="16"/>
    <rect x="452" y="1000" width="120" height="200" fill="#00FF00" stroke="#111" stroke-width="12"/>
    <text x="512" y="800" font-size="110" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const template = await getTemplate("habits-v1");
if (!template) throw new Error("template not found");

const images: Record<string, Buffer> = {};
for (const [i, pose] of template.poses.entries()) {
  // The green screen must become transparent
  images[pose] = await ensureTransparent(await placeholder(pose, COLORS[i % COLORS.length]));
}

const { data, info } = await sharp(images.happy).raw().toBuffer({ resolveWithObject: true });
const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
const checks: Record<string, [number, number]> = {
  corner: [alphaAt(0, 0), 0],
  body: [alphaAt(512, 800), 255],
  enclosedGap: [alphaAt(512, 1100), 0],
  greenProp: [alphaAt(512, 420), 255],
};
console.log("background removal [got, want]:", JSON.stringify(checks));
if (Object.values(checks).some(([got, want]) => got !== want)) throw new Error("background removal failed");

const pdf = await composeBooklet(template, images);
await mkdir("tmp", { recursive: true });
await writeFile("tmp/test-booklet.pdf", pdf);
console.log(`PDF ok: ${template.pages.length} pages, ${(pdf.length / 1024 / 1024).toFixed(1)} MB → tmp/test-booklet.pdf`);
