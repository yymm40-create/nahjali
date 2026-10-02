// Renders a template design (design/<id>/pages.html) into the files the app uses:
//   templates/<id>/template.json               page layout (generated from the same page definitions)
//   templates/<id>/overlays/page-NN.png        transparent text/frames layer per page, 300 DPI
//   design/<id>/preview/page-NN-guides.png     low-res previews with slot outlines (review only)
// Page size comes from the template (1rem = 1mm in pages.html).
//
// Usage: npm run render-template -- nahjali-v1
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const id = process.argv[2] ?? "nahjali-v1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = pathToFileURL(path.join(root, "design", id, "pages.html")).href;
const out = path.join(root, "templates", id);
const preview = path.join(root, "design", id, "preview");
await mkdir(path.join(out, "overlays"), { recursive: true });
await mkdir(preview, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--allow-file-access-from-files"],
});

/** Opens one view of the design. 1 CSS px = page_mm * 5.9048 / 210 ⇒ width in px = mm * (1240 / 210). */
async function open(query, widthMm, heightMm, scale) {
  const page = await browser.newPage();
  const pxPerMm = 1240 / 210;
  await page.setViewport({ width: Math.round(widthMm * pxPerMm), height: Math.round(heightMm * pxPerMm), deviceScaleFactor: scale });
  await page.goto(`${src}?${query}`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

try {
  const jsonPage = await open("json=1", 210, 210, 1);
  const template = JSON.parse(await jsonPage.$eval("#json", (el) => el.textContent));
  await writeFile(path.join(out, "template.json"), JSON.stringify(template, null, 2) + "\n");
  await jsonPage.close();
  const { width, height } = template.page_size_mm;

  for (let i = 1; i <= template.pages.length; i++) {
    const n = String(i).padStart(2, "0");
    // Transparent overlay at 300 DPI (scale 2 on 1240px = 2480px for 210mm)
    const full = await open(`page=${i}`, width, height, 2);
    // Palette PNG keeps transparency and makes the booklet PDF much smaller with no visible change
    const overlay = await full.screenshot({ type: "png", omitBackground: true });
    await sharp(overlay).png({ palette: true, quality: 95, effort: 10 }).toFile(path.join(out, "overlays", `page-${n}.png`));
    await full.close();

    // Coloured background layer (drawn behind the child), saved as a scene image
    const scene = template.pages[i - 1].scene;
    if (scene?.startsWith("bg-")) {
      const bg = await open(`page=${i}&layer=bg`, width, height, 2);
      await sharp(await bg.screenshot({ type: "png" })).jpeg({ quality: 90, mozjpeg: true }).toFile(path.join(out, "scenes", `${scene}.jpg`));
      await bg.close();
    }

    const guides = await open(`page=${i}&preview=1`, width, height, 1);
    await writeFile(path.join(preview, `page-${n}-guides.png`), await guides.screenshot({ type: "png" }));
    await guides.close();
  }
  console.log(`Rendered ${template.pages.length} pages -> templates/${id}`);
} finally {
  await browser.close();
}
