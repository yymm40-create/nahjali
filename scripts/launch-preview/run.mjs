// Screenshots of the launch pages (front page, packages, «سلمان») at phone and desktop sizes: node scripts/launch-preview/run.mjs [outDir]
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = process.argv[2] ?? join(tmpdir(), "launch-preview");
mkdirSync(out, { recursive: true });
const stubs = join(root, "scripts/course-preview/stubs.tsx");
await build({
  entryPoints: [join(root, "scripts/launch-preview/entry.tsx")], bundle: true, outfile: join(out, "bundle.js"), format: "iife", jsx: "automatic", loader: { ".css": "css" },
  alias: { "@": join(root, "src"), "@config": join(root, "config"), "next/link": stubs, "next/navigation": stubs },
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
});
const colors = ["#7c3aed", "#ec4899", "#f97316", "#0ea5e9"];
colors.forEach((c, i) => execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${c}:s=300x400,drawtext=text='${i + 1}':fontsize=120:fontcolor=white:x=(w-tw)/2:y=(h-th)/2`, "-frames:v", "1", join(out, `sample${i}.png`)]));
const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#0b0c0f;font-family:system-ui,'Noto Sans Arabic',sans-serif}
.inline-flex{display:inline-flex}.items-center{align-items:center}.gap-1{gap:4px}.whitespace-nowrap{white-space:nowrap}.tabular-nums{font-variant-numeric:tabular-nums}
</style><link rel=stylesheet href="/bundle.css"><div id=root></div><script src="/bundle.js"></script>`;
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/") return void res.writeHead(200, { "content-type": "text/html" }).end(html);
  const f = { "/bundle.js": "bundle.js", "/bundle.css": "bundle.css" }[u.pathname] ?? (/^\/sample\d\.png$/.test(u.pathname) ? u.pathname.slice(1) : null);
  if (u.pathname === "/api/salman") return void res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ reply: "سهلة 👌\n١) اضغط «+ اشحن» جنب رصيدك فوق.\n٢) اختر الباقة واضغط «اشحن الآن».\n٣) حوّل المبلغ واضغط «تم التحويل»، ويوصلك الرصيد بعد التأكيد.", links: [{ label: "اشحن رصيدك", href: "/jawad-ai/credits" }] }));
  if (!f || !existsSync(join(out, f))) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "image/png" }).end(readFileSync(join(out, f)));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const { default: puppeteer } = await import(join(root, "node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js"));
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const shots = [
  ["landing-phone", "view=landing", 390, 844, true], ["landing-phone-top", "view=landing", 390, 844, false], ["landing-desk", "view=landing", 1280, 900, true],
  ["credits-phone", "view=credits", 390, 844, true], ["credits-phone-top", "view=credits&waiting=1", 390, 844, false], ["credits-desk", "view=credits", 1280, 900, false],
  ["credits-sheet", "view=credits&signed=1&sheet=1", 390, 844, false], ["small-landing", "view=landing", 360, 740, false],
];
let bad = 0;
for (const [name, qs, w, h, full] of shots) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: w < 700, hasTouch: w < 700 });
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));
  await page.goto(`http://127.0.0.1:${port}/?${qs}`);
  await new Promise((r) => setTimeout(r, 700));
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (o.sw > o.iw) { bad++; console.log(`  ✗ ${name}: sideways overflow ${o.sw} > ${o.iw}`); }
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  await page.close();
}
// «سلمان»: open, ask, read the answer
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(`http://127.0.0.1:${port}/?view=landing`);
await page.click(".slm-fab");
await page.click(".slm-quick button");
await page.waitForSelector(".slm-links a", { timeout: 5000 });
await page.screenshot({ path: join(out, "salman-phone.png") });
const answer = await page.evaluate(() => document.querySelectorAll(".slm-msg").length);
console.log(answer >= 3 ? "  ✓ salman answered with a link" : "  ✗ salman did not answer");
await browser.close();
server.close();
console.log(bad ? "overflow found" : "no sideways overflow", "→", out);
