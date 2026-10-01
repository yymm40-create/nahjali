// Renders a template design (design/<id>/pages.html) into the files the app uses:
//   templates/<id>/template.json         slot coordinates (generated from the same page definitions)
//   templates/<id>/pages/page-NN.png     full pages at 300 DPI
//   public/templates/<id>/page-NN.jpg    small previews for the website
//   design/<id>/preview/page-NN-guides.png  previews with slot outlines (review only)
//
// Usage: npm run render-template -- habits-v1
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const id = process.argv[2] ?? "habits-v1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = pathToFileURL(path.join(root, "design", id, "pages.html")).href;
const out = path.join(root, "templates", id);
const pub = path.join(root, "public", "templates", id);
const preview = path.join(root, "design", id, "preview");
await Promise.all([out, pub, preview].map((d) => mkdir(path.join(d, d === out ? "pages" : ""), { recursive: true })));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

async function open(query, scale) {
  const page = await browser.newPage();
  // 874 CSS px wide at 2x = 1748 px = 148 mm at 300 DPI
  await page.setViewport({ width: 874, height: 1240, deviceScaleFactor: scale });
  await page.goto(`${src}?${query}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

try {
  const jsonPage = await open("json=1", 1);
  const template = JSON.parse(await jsonPage.$eval("#json", (el) => el.textContent));
  await writeFile(path.join(out, "template.json"), JSON.stringify(template, null, 2) + "\n");
  await jsonPage.close();

  for (let i = 1; i <= template.pages.length; i++) {
    const n = String(i).padStart(2, "0");

    const full = await open(`page=${i}`, 2);
    const png = await full.screenshot({ type: "png" });
    await full.close();
    await writeFile(path.join(out, "pages", `page-${n}.png`), png);
    await sharp(png).resize({ width: 700 }).jpeg({ quality: 80 }).toFile(path.join(pub, `page-${n}.jpg`));

    const guides = await open(`page=${i}&guides=1`, 1);
    await writeFile(path.join(preview, `page-${n}-guides.png`), await guides.screenshot({ type: "png" }));
    await guides.close();
  }
  console.log(`Rendered ${template.pages.length} pages -> templates/${id}`);
} finally {
  await browser.close();
}
