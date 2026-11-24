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

// eight little videos, each a plain colour with its number, for ?media=1
const { execFileSync } = await import("node:child_process");
for (let i = 0; i < 8; i++) {
  const f = join(work, `cam${i}.webm`);
  const colour = ["8b1e1e", "8b5a1e", "1e8b3a", "1e7f8b", "1e3f8b", "5a1e8b", "8b1e6a", "4a4a4a"][i];
  if (!existsSync(f)) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0x${colour}:s=270x480:r=30:d=40`, "-c:v", "libvpx", "-b:v", "150k", "-g", "30", f]);
}

const html = `<!doctype html><html lang="ar" dir="rtl" class="h-full antialiased"><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<link rel=stylesheet href="/app.css"><link rel=stylesheet href="/bundle.css"><style>html,body{margin:0;height:100%}</style></head><body><div id=root></div><script src="/bundle.js"></script></body></html>`;
const types = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = [join(work, p), join(root, "public", p)].find((f) => existsSync(f) && statSync(f).isFile());
  if (file && extname(file) === ".webm") {
    // (videos are asked for in ranges)
    const buf = readFileSync(file);
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    const a = m ? Number(m[1]) : 0;
    const b = m && m[2] ? Number(m[2]) : buf.length - 1;
    return void res.writeHead(m ? 206 : 200, { "content-type": "video/webm", "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${buf.length}`, "access-control-allow-origin": "*" }).end(buf.subarray(a, b + 1));
  }
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
const problems = [];
const enter = async (page) => {
  await page.waitForTimeout(2000);
  // the first-visit question («أي برنامج مونتاج تعودت عليه؟»): حيدرة كت's own keys
  const own = page.getByText("JAWAD", { exact: true });
  if (await own.count()) await own.first().click();
  await page.waitForTimeout(800);
  const fit = page.getByRole("button", { name: "اعرض الكل" });
  if (await fit.count()) await fit.first().click();
  await page.waitForTimeout(400);
};
for (const name of shots) {
  const phone = name === "phone";
  const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1600, height: 950 }, deviceScaleFactor: phone ? 2 : 1, colorScheme: "dark" });
  page.on("pageerror", (e) => console.log("pageerror:", e.message, "\n", (e.stack ?? "").split("\n").slice(1, 5).join("\n")));
  if (name === "cameras") {
    // «شبكة الكاميرات» on real little videos: the cameras of a moment, a press cuts to one
    await page.goto(`${base}/?media=1`, { waitUntil: "load" });
    await enter(page);
    const c = await page.locator('[data-clip="c5a"]').first().boundingBox();
    const ruler = await page.locator("[data-no-press] .cursor-col-resize").first().boundingBox();
    await page.mouse.click(c.x + 6, ruler.y + ruler.height / 2);
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "الكاميرات" }).click();
    await page.waitForTimeout(2500);
    const tiles = await page.locator("[data-cam]").count();
    if (tiles < 6) problems.push(`the grid shows ${tiles} cameras, expected at least 6`);
    const ready = await page.evaluate(() => [...document.querySelectorAll("[data-cam] video")].filter((v) => v.readyState >= 2 && v.currentTime > 0.5).length);
    if (ready < tiles) problems.push(`${ready} of ${tiles} tiles show their moment`);
    await page.screenshot({ path: join(out, "cameras.png") });
    if (tiles < 5) {
      await page.close();
      continue;
    }
    await page.locator("[data-cam]").nth(2).click();
    await page.waitForTimeout(600);
    if (!(await page.getByText("المونتاج").count())) problems.push("no «المونتاج» track after the cut");
    if ((await page.locator('[data-cam][aria-pressed="true"]').count()) !== 1 || (await page.locator("[data-cam]").nth(2).getAttribute("aria-pressed")) !== "true") problems.push("the camera cut to is not the live one");
    // its number on the keyboard cuts too
    await page.keyboard.press("5");
    await page.waitForTimeout(500);
    if ((await page.locator("[data-cam]").nth(4).getAttribute("aria-pressed")) !== "true") problems.push("the key 5 did not cut to the fifth camera");
    await page.screenshot({ path: join(out, "cameras-cut.png") });
    // «تقطيع ذكي»: the whole stretch of the cameras cut by itself
    await page.getByRole("tab", { name: /تقطيع ذكي/ }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, "smart.png"), clip: { x: 940, y: 100, width: 660, height: 400 } });
    await page.getByRole("button", { name: "✨ قطّع" }).click();
    await page.waitForTimeout(1500);
    const made = await page.locator("[data-track-id]").filter({ hasText: "المونتاج" }).locator("[data-clip]").count();
    if (made < 8) problems.push(`the smart cut made ${made} shots, expected many`);
    await page.screenshot({ path: join(out, "smart-done.png") });
    await page.close();
    continue;
  }
  await page.goto(`${base}/`, { waitUntil: "load" });
  await enter(page);
  const one = page.locator('[data-clip="c3a"]');
  if (await one.count()) await one.first().click({ position: { x: 6, y: 20 } });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, `${name}.png`) });
  await page.close();
}
for (const p of problems) console.log("✗", p);
if (process.env.HOLD) { console.log("BASE", base); await new Promise((r) => setTimeout(r, Number(process.env.HOLD))); }
const failed = problems;
await browser.close();
server.close();
console.log(failed.length ? `\n${failed.length} FAILED:\n- ${failed.join("\n- ")}` : "\nall checks passed");
console.log(`shots: ${out}`);
process.exit(failed.length ? 1 : 0);
