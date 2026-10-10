// Screenshots of the course page at phone and desktop sizes (not part of `npm test`): node scripts/course-preview/run.mjs [outDir]
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = process.argv[2] ?? join(tmpdir(), "course-preview");
mkdirSync(out, { recursive: true });
const here = join(root, "scripts/course-preview");
await build({
  entryPoints: [join(here, "entry.tsx")], bundle: true, outfile: join(out, "bundle.js"), format: "iife", jsx: "automatic", loader: { ".css": "css" },
  alias: { "@": join(root, "src"), "@config": join(root, "config"), "next/link": join(here, "stubs.tsx"), "next/navigation": join(here, "stubs.tsx") },
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
});
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=20:duration=3", "-c:v", "libvpx", "-b:v", "200k", join(out, "reel.webm")]);
const css = readFileSync(join(root, "src/app/jawad-ai/course/course.css"), "utf8");
const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#0b0c0f;font-family:system-ui,'Noto Sans Arabic',sans-serif}
.inline-flex{display:inline-flex}.items-center{align-items:center}.gap-1{gap:4px}.whitespace-nowrap{white-space:nowrap}.tabular-nums{font-variant-numeric:tabular-nums}.align-middle{vertical-align:middle}
.header{height:56px;background:#14161b;color:#fff;display:grid;place-items:center}
${css}</style><div class=header>JAWAD AI</div><div id=root></div><script src="/bundle.js"></script>`;
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/") return void res.writeHead(200, { "content-type": "text/html" }).end(html);
  if (u.pathname === "/bundle.js") return void res.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(join(out, "bundle.js")));
  if (u.pathname === "/reel.mp4") return void res.writeHead(200, { "content-type": "video/webm" }).end(readFileSync(join(out, "reel.webm")));
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const { default: puppeteer } = await import(join(root, "node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js"));
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const shots = [
  ["phone-A", "phase=A", 390, 844, true], ["phone-A-top", "phase=A", 390, 844, false], ["phone-B", "phase=B", 390, 844, true], ["phone-C", "phase=C", 390, 844, true], ["phone-soon", "phase=soon", 390, 844, false],
  ["phone-sheet-form", "phase=A&signed=1&sheet=form", 390, 844, false], ["phone-small-A", "phase=B", 360, 740, false],
  ["desk-A", "phase=A", 1280, 900, true], ["desk-B", "phase=B", 1280, 900, false],
];
let bad = 0;
for (const [name, qs, w, h, full] of shots) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));
  await page.goto(`http://127.0.0.1:${port}/?${qs}`);
  await new Promise((r) => setTimeout(r, 600));
  const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (over.sw > over.iw) { bad++; console.log(`  ✗ ${name}: sideways overflow ${over.sw} > ${over.iw}`); }
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  await page.close();
}
await browser.close();
server.close();
console.log(bad ? "overflow found" : "no sideways overflow", "→", out);
