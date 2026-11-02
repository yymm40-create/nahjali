// Screenshots and checks of the table of carousel styles and the list of fonts at phone and desktop sizes: node scripts/content-preview/run.mjs [outDir]
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = process.argv[2] ?? join(tmpdir(), "content-preview");
mkdirSync(out, { recursive: true });
const stubs = join(root, "scripts/course-preview/stubs.tsx");
await build({
  entryPoints: [join(root, "scripts/content-preview/entry.tsx")], bundle: true, outfile: join(out, "bundle.js"), format: "iife", jsx: "automatic", loader: { ".css": "css", ".svg": "dataurl", ".png": "dataurl" },
  alias: { "@": join(root, "src"), "@config": join(root, "config"), "next/link": stubs, "next/navigation": stubs }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
});
const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel=stylesheet href=/bundle.css><style>body{margin:0;background:#141018;font-family:system-ui,sans-serif}</style><div id=root></div><script src=/bundle.js></script>`;
const server = createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  if (p === "/") return void res.writeHead(200, { "content-type": "text/html" }).end(html);
  const f = p.slice(1);
  const file = [join(out, f), join(root, "public", f)].find(existsSync);
  if (!file) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "image/webp" }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const { default: puppeteer } = await import(join(root, "node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js"));
const exe = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
let bad = 0;
for (const [name, w, h] of [["phone360", 360, 740], ["phone", 390, 844], ["desk", 1280, 900]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
  page.on("pageerror", (e) => { bad++; console.log("  pageerror:", e.message); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await new Promise((r) => setTimeout(r, 900));
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, rows: document.querySelectorAll(".ct-ctable tbody tr:not(.niche)").length }));
  if (o.sw > o.iw) { bad++; console.log(`  ✗ ${name}: sideways overflow ${o.sw} > ${o.iw}`); }
  if (o.rows !== 103) { bad++; console.log(`  ✗ ${name}: ${o.rows} rows`); }
  await page.screenshot({ path: join(out, `${name}.png`) });
  // a pick sends its line with the mark
  await page.evaluate(() => [...document.querySelectorAll(".ct-ctable .act button")][1].click());
  await new Promise((r) => setTimeout(r, 200));
  const sent = await page.$eval("#log", (e) => e.textContent);
  if (!/\[كاروسيل:white-text\]/.test(sent)) { bad++; console.log(`  ✗ ${name}: pick sent «${sent}»`); }
  // a niche filter narrows the table, and an image opens the large view
  await page.evaluate(() => [...document.querySelectorAll(".ct-ctable-chips button")][5].click());
  await new Promise((r) => setTimeout(r, 200));
  const rows = await page.evaluate(() => document.querySelectorAll(".ct-ctable tbody tr:not(.niche)").length);
  if (rows !== 10) { bad++; console.log(`  ✗ ${name}: niche shows ${rows}`); }
  await page.evaluate(() => document.querySelector(".ct-ctable .pics button").click());
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: join(out, `${name}-big.png`) });
  await page.close();
}
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900 });
await page.goto(`http://127.0.0.1:${port}/?rec=dark-art-fact,notebook,tweet-dark&batch=1`);
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: join(out, "recommended.png") });
const first = await page.evaluate(() => document.querySelector(".ct-ctable .niche th").textContent);
if (!first.includes("ترشيحات")) { bad++; console.log("  ✗ recommendations are not first"); }
// the list of fonts after the style: the style's ready font first, every font written in itself
for (const [name, w, h] of [["fonts-phone", 390, 844], ["fonts-desk", 1280, 900]]) {
  const fp = await browser.newPage();
  await fp.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
  fp.on("pageerror", (e) => { bad++; console.log("  pageerror:", e.message); });
  await fp.goto(`http://127.0.0.1:${port}/?fonts=1`);
  await new Promise((r) => setTimeout(r, 2500));
  const o = await fp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, rows: document.querySelectorAll(".ct-ftable tbody tr:not(.niche)").length, first: document.querySelector(".ct-ftable .niche th")?.textContent ?? "", loaded: [...document.fonts].filter((f) => f.family.startsWith("jw-") && f.status === "loaded").length }));
  if (o.sw > o.iw) { bad++; console.log(`  ✗ ${name}: sideways overflow ${o.sw} > ${o.iw}`); }
  if (o.rows !== 51) { bad++; console.log(`  ✗ ${name}: ${o.rows} font rows`); }
  if (!o.first.includes("خط الستايل")) { bad++; console.log(`  ✗ ${name}: the ready font is not first («${o.first}»)`); }
  if (o.loaded < 4) { bad++; console.log(`  ✗ ${name}: only ${o.loaded} fonts loaded`); }
  await fp.screenshot({ path: join(out, `${name}.png`) });
  await fp.evaluate(() => [...document.querySelectorAll(".ct-ftable .ct-ctable-ways button")][0].click());
  await new Promise((r) => setTimeout(r, 200));
  const sent = await fp.$eval("#log", (e) => e.textContent);
  if (!/\[خط:style\]/.test(sent)) { bad++; console.log(`  ✗ ${name}: ready font sent «${sent}»`); }
  await fp.close();
}
await browser.close();
server.close();
console.log(bad ? `✗ ${bad} problem(s) — ${out}` : `✓ all good — ${out}`);
process.exit(bad ? 1 : 0);
