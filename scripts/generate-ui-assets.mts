// One-time: generates the 3D decorative pieces used by the booklet design (design/<template>/assets/*.png).
// Made on a green screen and keyed out to transparent PNGs (transparent output isn't available on this account).
// Usage: npx tsx --env-file=.env.local scripts/generate-ui-assets.mts [name...] [--quality=high]
// Skips files that already exist; delete a file to regenerate it.
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import OpenAI from "openai";
import sharp from "sharp";
import { ensureTransparent } from "@/lib/openai";
import { GENERATION_SETTINGS } from "@config/prompts";

const args = process.argv.slice(2);
const quality = (args.find((a) => a.startsWith("--quality="))?.split("=")[1] ?? "high") as "low" | "medium" | "high";
const only = args.filter((a) => !a.startsWith("--"));
const DIR = "design/nahjali-v1/assets";

const LOOK = `Premium cinematic 3D render in a modern Pixar-like animated movie style, soft studio lighting, glossy materials, gentle reflections, crisp clean edges. Color palette: shining gold, turquoise and teal Islamic mosaic tiles, deep navy, warm ivory. Single isolated object, centered, fully visible with a margin, front view, no text, no letters, no numbers. Background: one flat solid pure green color (#00FF00) filling the whole frame, no shadow on the background, no green on the object.`;

const ASSETS: Record<string, { prompt: string; size: "1536x1024" | "1024x1024" | "1024x1536" }> = {
  plaque: {
    prompt: `A wide ornate horizontal title plaque banner: thick glossy gold frame with rounded ends and small Islamic arch ornaments, a turquoise mosaic tile border inside the gold, and a large smooth EMPTY warm-ivory center panel for a title. Wide aspect, about 4 to 1.`,
    size: "1536x1024",
  },
  panel: {
    prompt: `A rounded square card panel: smooth warm-ivory enamel surface, beveled glossy gold rim, tiny turquoise mosaic corner ornaments. The center is completely EMPTY and flat for text.`,
    size: "1024x1024",
  },
  star: {
    prompt: `One cute chunky 3D five-pointed star with soft rounded points: glossy WHITE enamel face (uncolored, so a child can color it) with a thin shiny gold rim and a subtle dark navy outline.`,
    size: "1024x1024",
  },
  medal: {
    prompt: `A 3D round medal: glossy gold rim and ribbon loop on top with a turquoise ribbon, the inner circle is plain WHITE enamel (empty, for a child to color).`,
    size: "1024x1024",
  },
  bubble: {
    prompt: `A big rounded cloud-like speech bubble, glossy WHITE enamel with a thick shiny gold beveled rim, and a short rounded tail at the bottom-left corner pointing down. The inside is completely EMPTY and flat for text. Wide aspect, about 3 to 1.`,
    size: "1536x1024",
  },
  stone: {
    prompt: `One round glossy stepping-stone button seen slightly from above: thick shiny gold rim, small turquoise mosaic ring, and a flat plain WHITE center (empty, for a child to color).`,
    size: "1024x1024",
  },
  ring: {
    prompt: `A round sticker frame: thick ornate shiny gold ring with small turquoise mosaic gems and tiny gold stars around it, the inside is completely EMPTY and plain white.`,
    size: "1024x1024",
  },
  arch: {
    prompt: `A tall ornate picture frame shaped like an Islamic pointed arch (mihrab shape): thick glossy gold frame with turquoise and navy mosaic inlay and a small star on top. The inside of the arch is completely EMPTY and plain soft warm-ivory. Tall aspect, about 2 to 3.`,
    size: "1024x1536",
  },
  nameplate: {
    prompt: `A wide horizontal name plate: deep navy blue glossy enamel pill shape with a shiny gold beveled rim and small gold star ornaments at each end. The center is EMPTY. Wide aspect, about 5 to 1.`,
    size: "1536x1024",
  },
};

const openai = new OpenAI();
await mkdir(DIR, { recursive: true });

for (const [name, a] of Object.entries(ASSETS)) {
  if (only.length && !only.includes(name)) continue;
  const out = `${DIR}/${name}.png`;
  if (existsSync(out)) {
    console.log(`skip ${out}`);
    continue;
  }
  const t = Date.now();
  const res = await openai.images.generate({
    model: GENERATION_SETTINGS.model,
    prompt: `${a.prompt}\n${LOOK}`,
    size: a.size,
    quality,
    output_format: "png",
  });
  const keyed = await ensureTransparent(Buffer.from(res.data![0].b64_json!, "base64"));
  await sharp(keyed).trim({ threshold: 1 }).png().toFile(out);
  console.log(`saved ${out} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
}
