// The whole «حيدرة كت» editor in the sandbox's Chromium with a made-up project (not part of `npm test`), to look at
// the interface:  node scripts/editor-preview/run.mjs [outDir] [wide,phone]
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const here = join(root, "scripts/editor-preview");
const out = resolve(process.argv[2] ?? join(tmpdir(), "editor-preview"));
const work = join(tmpdir(), "editor-preview-build");
mkdirSync(work, { recursive: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(here, "entry.tsx")], bundle: true, outfile: join(work, "bundle.js"), format: "iife", jsx: "automatic", loader: { ".css": "css", ".png": "file", ".svg": "file", ".woff2": "file" },
  alias: { "@": join(root, "src"), "@config": join(root, "config"), "next/link": join(root, "scripts/mahdi-preview/stubs.tsx"), "next/navigation": join(root, "scripts/mahdi-preview/stubs.tsx"), "next/image": join(root, "scripts/mahdi-preview/image.tsx") }, define: { "process.env.NODE_ENV": '"production"' }, banner: { js: "var process={env:{NODE_ENV:'production'}};" }, logLevel: "error", external: ["node:*"],
});
const gcss = join(root, "src/app/globals.css");
const tw = await postcss([tailwind({ base: root })]).process(readFileSync(gcss, "utf8"), { from: gcss });
writeFileSync(join(work, "app.css"), tw.css);

const html = `<!doctype html><html lang="ar" dir="rtl" class="h-full antialiased"><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<link rel=stylesheet href="/app.css"><link rel=stylesheet href="/bundle.css"><style>html,body{margin:0;height:100%}</style></head><body><div id=root></div><script src="/bundle.js"></script></body></html>`;
const types = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = [join(work, p), join(root, "public", p)].find((f) => existsSync(f) && statSync(f).isFile());
  if (file) return void res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  if (p.startsWith("/api/")) return void res.writeHead(404, { "content-type": "application/json" }).end('{"error":"preview"}');
  if (extname(p)) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": "text/html" }).end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const { createRequire } = await import("node:module");
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const shots = (process.argv[3] ?? "wide").split(",");
for (const name of shots) {
  const phone = name === "phone";
  const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1600, height: 950 }, deviceScaleFactor: phone ? 2 : 1, colorScheme: "dark" });
  page.on("pageerror", (e) => console.log("pageerror:", e.message, "\n", (e.stack ?? "").split("\n").slice(1, 5).join("\n")));
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  // the first-visit question («أي برنامج مونتاج تعودت عليه؟»): حيدرة كت's own keys
  const own = page.getByText("JAWAD", { exact: true });
  if (await own.count()) await own.first().click();
  await page.waitForTimeout(800);
  // the whole timeline on the screen, one camera clip selected
  const fit = page.getByRole("button", { name: "اعرض الكل" });
  if (await fit.count()) await fit.first().click();
  await page.waitForTimeout(400);
  const one = page.locator('[data-clip="c3a"]');
  if (await one.count()) await one.first().click({ position: { x: 6, y: 20 } });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, `${name}.png`) });
  if (!phone) {
    // a menu open over the glass, then the flat look
    await page.getByRole("button", { name: "مجلدات المسارات" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `${name}-menu.png`), clip: { x: 0, y: 480, width: 800, height: 470 } });
    await page.keyboard.press("Escape");
    await page.mouse.click(1300, 300);
    await page.getByRole("button", { name: /المظهر: زجاجي/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `${name}-flat.png`) });
  }
  await page.close();
}
if (process.env.HOLD) { console.log("BASE", base); await new Promise((r) => setTimeout(r, Number(process.env.HOLD))); }
const failed = [];
await browser.close();
server.close();
console.log(failed.length ? `\n${failed.length} FAILED:\n- ${failed.join("\n- ")}` : "\nall checks passed");
console.log(`shots: ${out}`);
process.exit(failed.length ? 1 : 0);
