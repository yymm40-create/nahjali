// Makes the app icons of «لأجل المهدي» from the «نهج علي» logo (public/brand/logo.png): the logo centred on a
// white square, as on the rest of the site. Writes public/mahdi/icons/.
// Run:   npx tsx scripts/generate-mahdi-icons.mts
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const OUT = "public/mahdi/icons";
const LOGO = "public/brand/logo.png";
const BACKGROUND = "#ffffff";

/** `pad` is the share of each side kept empty (maskable icons need a larger safe zone: the centre 80% circle). */
async function icon(size: number, pad: number) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(LOGO).trim().resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: "center" }])
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(OUT, { recursive: true });
const jobs: [string, number, number][] = [
  ["icon-192.png", 192, 0.06],
  ["icon-512.png", 512, 0.06],
  ["icon-maskable-512.png", 512, 0.16],
  ["apple-touch-icon.png", 180, 0.07],
];
for (const [name, size, pad] of jobs) {
  await writeFile(`${OUT}/${name}`, await icon(size, pad));
  console.log("wrote", `${OUT}/${name}`);
}
