// Screenshots of the signed-in home at phone and desktop sizes: node scripts/home-preview/run.mjs [outDir]
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = process.argv[2] ?? join(tmpdir(), "home-preview");
mkdirSync(out, { recursive: true });
const stubs = join(root, "scripts/course-preview/stubs.tsx");
await build({
  entryPoints: [join(root, "scripts/home-preview/entry.tsx")], bundle: true, outfile: join(out, "bundle.js"), format: "iife", jsx: "automatic", loader: { ".css": "css" },
  alias: { "@": join(root, "src"), "@config": join(root, "config"), "next/link": stubs, "next/navigation": stubs }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
});
["#7c3aed", "#ec4899", "#f97316", "#0ea5e9"].forEach((c, i) => execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${c}:s=300x300`, "-frames:v", "1", join(out, `s${i}.png`)]));
const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0a0618;font-family:system-ui,'Noto Sans Arabic',sans-serif}</style><link rel=stylesheet href="/bundle.css"><div id=root></div><script src="/bundle.js"></script>`;
const server = createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  if (p === "/") return void res.writeHead(200, { "content-type": "text/html" }).end(html);
  const f = p.slice(1);
  if (!existsSync(join(out, f))) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "image/png" }).end(readFileSync(join(out, f)));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const { default: puppeteer } = await import(join(root, "node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js"));
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
let bad = 0;
for (const [name, w, h] of [["phone360", 360, 740], ["phone", 390, 844], ["desk", 1280, 900]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
  page.on("pageerror", (e) => { bad++; console.log("  pageerror:", e.message); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await new Promise((r) => setTimeout(r, 600));
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (o.sw > o.iw) { bad++; console.log(`  ✗ ${name}: sideways overflow ${o.sw} > ${o.iw}`); }
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
server.close();
console.log(bad ? `✗ ${bad} problem(s) — ${out}` : `✓ all good — ${out}`);
process.exit(bad ? 1 : 0);
