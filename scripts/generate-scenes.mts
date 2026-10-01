// One-time: generates the booklet background scenes with OpenAI (one fixed set for every art style).
//   templates/<template>/scenes/<scene>.jpg   (2480×2480, 300 DPI for 21×21 cm)
// Usage: npx tsx --env-file=.env.local scripts/generate-scenes.mts [scene...] [--style=pixar] [--quality=high] [--template=nahjali-v1]
// Skips files that already exist; delete a file to regenerate it.
import { existsSync } from "fs";
import { mkdir, readFile } from "fs/promises";
import OpenAI from "openai";
import sharp from "sharp";
import { SCENE_LAYOUT, SCENES } from "@config/scenes";
import { isStyle, STYLES } from "@config/styles";
import { GENERATION_SETTINGS } from "@config/prompts";

const args = process.argv.slice(2);
const flag = (name: string, def: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const quality = flag("quality", "high") as "low" | "medium" | "high";
const templateId = flag("template", "nahjali-v1");
const sceneArgs = args.filter((a) => !a.startsWith("--"));
const style = flag("style", "pixar");
if (!isStyle(style)) throw new Error(`Unknown style ${style}`);

const template = JSON.parse(await readFile(`templates/${templateId}/template.json`, "utf8")) as { scenes: string[] };
const sceneKeys = sceneArgs.length ? sceneArgs : template.scenes;
const openai = new OpenAI();

{
  const dir = `templates/${templateId}/scenes`;
  await mkdir(dir, { recursive: true });
  // Generate the scenes in parallel (a few at a time)
  const queue = sceneKeys.filter((k) => !existsSync(`${dir}/${k}.jpg`));
  const worker = async () => {
    for (let key = queue.shift(); key; key = queue.shift()) {
      const prompt = `${SCENES[key]}\n${SCENE_LAYOUT}\nART STYLE: ${STYLES[style].prompt}`;
      const t = Date.now();
      const res = await openai.images.generate({ model: GENERATION_SETTINGS.model, prompt, size: "1024x1024", quality, output_format: "png" });
      const png = Buffer.from(res.data![0].b64_json!, "base64");
      // Upscale to print size; scenes are backgrounds, so a soft upscale is fine
      await sharp(png).resize(2480, 2480, { kernel: "lanczos3" }).jpeg({ quality: 90, mozjpeg: true }).toFile(`${dir}/${key}.jpg`);
      console.log(`saved ${dir}/${key}.jpg (${((Date.now() - t) / 1000).toFixed(0)}s)`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}
