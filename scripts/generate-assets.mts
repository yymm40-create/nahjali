// One-time: generates the website artwork with OpenAI (text-to-image, no customer photos).
//   public/brand/hero.jpg          cinematic Najaf shrine scene for the home page
//   public/styles/<style>.jpg      one sample per art style for the order page
// Usage: npx tsx --env-file=.env.local scripts/generate-assets.mts [hero] [styles] [--quality=high]
// Skips files that already exist; delete a file to regenerate it.
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import OpenAI from "openai";
import sharp from "sharp";
import { STYLES, type StyleKey } from "@config/styles";
import { GENERATION_SETTINGS } from "@config/prompts";

const args = process.argv.slice(2);
const quality = (args.find((a) => a.startsWith("--quality="))?.split("=")[1] ?? "high") as "low" | "medium" | "high";
const want = (k: string) => args.filter((a) => !a.startsWith("--")).length === 0 || args.includes(k);
const openai = new OpenAI();

const SHRINE = `the holy shrine of Imam Ali in Najaf, Iraq: the great golden dome with its golden finial, two tall golden minarets, the golden clock tower gate, courtyard arches decorated with turquoise and blue Islamic tile mosaics`;

async function generate(prompt: string, size: "1536x1024" | "1024x1024", out: string, width: number) {
  if (existsSync(out)) return console.log(`skip ${out} (exists)`);
  const t = Date.now();
  const res = await openai.images.generate({ model: GENERATION_SETTINGS.model, prompt, size, quality, output_format: "png" });
  const png = Buffer.from(res.data![0].b64_json!, "base64");
  await sharp(png).resize({ width }).jpeg({ quality: 85, mozjpeg: true }).toFile(out);
  console.log(`saved ${out} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
}

await mkdir("public/brand", { recursive: true });
await mkdir("public/styles", { recursive: true });

if (want("hero")) {
  await generate(
    `Cinematic 3D animated feature film still, modern stylized Pixar look. Wide establishing shot of ${SHRINE}, at magical golden hour turning into blue dusk, warm glowing lights, soft volumetric light rays, gentle floating sparkles, a few white doves flying. Peaceful, sacred, wondrous and inviting for young children. Rich gold, turquoise and deep navy color palette. Leave calm open sky in the upper part of the frame. No people, no text, no logos.`,
    "1536x1024",
    "public/brand/hero.jpg",
    1600,
  );
}

if (want("styles")) {
  for (const [key, style] of Object.entries(STYLES) as [StyleKey, (typeof STYLES)[StyleKey]][]) {
    await generate(
      `A cheerful 7-year-old boy in a white dishdasha and a 6-year-old girl in a modest black Zainabiya abaya (hair, ears and neck fully covered, only face and hands visible, no makeup) standing side by side, smiling and waving, full body. Behind them, softly in the background: ${SHRINE}. Warm, wholesome, child-friendly. No text, no logos.
ART STYLE: ${style.prompt}`,
      "1024x1024",
      `public/styles/${key}.jpg`,
      800,
    );
  }
}
