// Draws the app icons of «لأجل المهدي» (a gold crescent and star on a dark ground) into public/mahdi/icons/.
// Run:   npx tsx scripts/generate-mahdi-icons.mts
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const OUT = "public/mahdi/icons";

/** `pad` is the share of the canvas kept empty around the drawing (maskable icons need a larger safe zone). */
function svg(size: number, pad: number) {
  const c = size / 2;
  const r = (size * (1 - pad * 2)) / 2; // radius of the crescent's outer circle
  const cut = r * 0.82; // the circle that bites the crescent out
  const dx = r * 0.42;
  const star = r * 0.34;
  const sx = c + r * 0.52;
  const sy = c - r * 0.1;
  const starPoints = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? star : star * 0.45;
    return `${(sx + rad * Math.cos(a)).toFixed(1)},${(sy + rad * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#2a2218"/><stop offset="1" stop-color="#0d0c0b"/></radialGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4da95"/><stop offset="1" stop-color="#d4a843"/></linearGradient>
<mask id="m"><rect width="${size}" height="${size}" fill="#fff"/><circle cx="${(c + dx).toFixed(1)}" cy="${(c - r * 0.06).toFixed(1)}" r="${cut.toFixed(1)}" fill="#000"/></mask>
</defs>
<rect width="${size}" height="${size}" fill="url(#bg)"/>
<circle cx="${(c - r * 0.1).toFixed(1)}" cy="${c}" r="${r.toFixed(1)}" fill="url(#gold)" mask="url(#m)"/>
<polygon points="${starPoints}" fill="url(#gold)"/>
</svg>`;
}

await mkdir(OUT, { recursive: true });
const jobs: [string, number, number][] = [
  ["icon-192.png", 192, 0.2],
  ["icon-512.png", 512, 0.2],
  ["icon-maskable-512.png", 512, 0.3], // important parts stay inside the central 80% circle
  ["apple-touch-icon.png", 180, 0.22],
];
for (const [name, size, pad] of jobs) {
  await writeFile(`${OUT}/${name}`, await sharp(Buffer.from(svg(size, pad))).png({ compressionLevel: 9 }).toBuffer());
  console.log("wrote", `${OUT}/${name}`);
}
