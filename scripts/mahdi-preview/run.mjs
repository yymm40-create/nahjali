// Phone screenshots of «لأجل المهدي» with a mock account (no sign-in, no database):
//   node scripts/mahdi-preview/run.mjs [outDir] [only,these,shots]
// 390×844 CSS px at 3× (1170×2532 PNG), plus tall *_full.png for home, projects and progress.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const here = join(root, "scripts/mahdi-preview");
const out = resolve(process.argv[2] ?? join(tmpdir(), "mahdi-preview"));
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
// THEME=zakhrafa node scripts/mahdi-preview/run.mjs … → the shots in that look; ALL_FULL=1 → a tall *_full.png for every page
const theme = process.env.THEME ?? "";
const allFull = process.env.ALL_FULL === "1";
const work = join(tmpdir(), "mahdi-preview-build"); // the bundle, css and fonts (fonts are downloaded once)
mkdirSync(work, { recursive: true });

// 1. the app's code, with Next's link / router / image replaced
const stubs = join(here, "stubs.tsx");
await build({
  entryPoints: [join(here, "entry.tsx")], bundle: true, outfile: join(work, "bundle.js"), format: "iife", jsx: "automatic", loader: { ".css": "css", ".png": "file", ".svg": "file" },
  alias: { "@": join(root, "src"), "@config": join(root, "config"), "next/link": stubs, "next/navigation": stubs, "next/image": join(here, "image.tsx") },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": '"preview-key"' }, logLevel: "error",
});

// 2. the site's Tailwind (v4), scanning the project for the classes in use
const gcss = join(root, "src/app/globals.css");
const tw = await postcss([tailwind({ base: root })]).process(readFileSync(gcss, "utf8"), { from: gcss });
writeFileSync(join(work, "app.css"), tw.css);

// 3. the app's fonts (IBM Plex Sans Arabic, Amiri, Amiri Quran, and Marhey for «الدفتر»), saved once next to the shots
const fontsCss = join(work, "fonts-v2.css");
if (!existsSync(fontsCss)) {
  const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
  let css = execFileSync("curl", ["-sS", "-A", ua, "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Amiri:wght@400;700&family=Amiri+Quran&family=Marhey:wght@400;700&display=block"], { encoding: "utf8" });
  let i = 0;
  css = css.replace(/url\((https:[^)]+)\)/g, (_, u) => {
    const name = `f${i++}.woff2`;
    execFileSync("curl", ["-sS", "-o", join(work, name), u]);
    return `url(/${name})`;
  });
  writeFileSync(fontsCss, css);
}

const html = `<!doctype html><html lang="ar" dir="rtl" class="h-full antialiased"><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel=stylesheet href="/fonts-v2.css"><link rel=stylesheet href="/app.css"><link rel=stylesheet href="/bundle.css">
<style>.pv-fonts{--font-plex:'IBM Plex Sans Arabic';--font-amiri:'Amiri';--font-quran:'Amiri Quran';--font-marhey:'Marhey'} nextjs-portal{display:none}</style></head>
<body class="flex min-h-full flex-col font-sans"><div id=root></div><script src="/bundle.js"></script></body></html>`;
const types = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webp": "image/webp" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = [join(work, p), join(root, "public", p)].find((f) => existsSync(f) && statSync(f).isFile());
  if (file) return void res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  if (p.startsWith("/api/") || extname(p)) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": "text/html" }).end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// playwright is installed globally (NODE_PATH), which only require() finds
const { createRequire } = await import("node:module");
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "ar", timezoneId: "Asia/Riyadh", colorScheme: "dark" });
// this phone already gets notifications (so «اجعله تنبيهًا» shows its normal sheet, not a setup note)
await ctx.grantPermissions(["notifications"]);
await ctx.addInitScript(() => {
  if (window.Notification) Object.defineProperty(Notification, "permission", { get: () => "granted" });
  if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => ({ pushManager: { getSubscription: async () => ({ endpoint: "preview" }) } });
});

// name, page, path, full-page too, what to do before the shot
const SHOTS = [
  ["home", "home", "/mahdi", true],
  ["habits", "habits", "/mahdi/projects", true],
  ["reading", "reading", "/mahdi/reading"],
  ["khatma", "khatma", "/mahdi/khatma"],
  ["groups", "groups", "/mahdi/groups"],
  ["health", "health", "/mahdi/health"],
  ["community", "community", "/mahdi/community"],
  ["challenges", "challenges", "/mahdi/challenges"],
  ["progress", "progress", "/mahdi/progress", true],
  ["week", "week", "/mahdi/progress/week"],
  ["month", "month", "/mahdi/progress/month"],
  ["calendar", "calendar", "/mahdi/progress/calendar"],
  ["compare", "compare", "/mahdi/progress/compare"],
  ["compare-day", "compare", "/mahdi/progress/compare", false, async (page) => {
    // today against yesterday
    await page.getByRole("radio", { name: "يومي", exact: true }).first().click();
  }],
  ["priorities", "progress", "/mahdi/progress", false, async (page) => {
    // the past days' priorities in «حاسبوا أنفسكم», the newest day opened
    await page.locator("#priorities button[aria-expanded]").first().click();
    await page.locator("#priorities").evaluate((e) => e.scrollIntoView({ block: "start" }));
  }],
  ["menu", "home", "/mahdi", false, async (page) => { 
    // the inbox count inside the drawer is position:absolute in mahdi.css (its Tailwind «static» loses to it), so it
    // floats to the drawer's corner; drawn in its row here, as intended
    await page.addStyleTag({ content: ".m-drawer .m-badge.static{position:static}" });
    await page.click("button.m-menu-btn[aria-haspopup=dialog]");
  }],
  ["alert", "home", "/mahdi", false, async (page) => {
    // the bell of the task at 20:30 (on in gold), its sheet open
    const bell = page.locator('button[aria-pressed="true"][aria-label*="20:30"]').first();
    await bell.scrollIntoViewIfNeeded();
    await bell.click();
  }],
];

let bad = 0;
for (const [name, key, path, full, act] of SHOTS) {
  if (only && !only.has(name)) continue;
  const page = await ctx.newPage();
  // a fixed moment: Tuesday 3 November 2026, 17:40 in Riyadh
  await page.clock.setFixedTime(new Date("2026-11-03T14:40:00Z"));
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { const t = m.text(); if (t.startsWith("[mock]") || m.type() === "error") problems.push(t); });
  await page.goto(`${base}${path}?page=${key}${theme ? `&theme=${theme}` : ""}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  if (act) { await act(page); await page.waitForTimeout(1200); }
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (o.sw > o.iw) problems.push(`sideways overflow ${o.sw} > ${o.iw}`);
  await page.screenshot({ path: join(out, `${name}.png`) });
  if (full || allFull) {
    // a phone as tall as the page, so the floating bar and buttons sit at its bottom instead of over the middle
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 390, height: h });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, `${name}_full.png`) });
    // where each heading and card sits on the tall shot (CSS px; ×3 for the PNG), for zooming on details in a video
    const boxes = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,section,.m-card")].map((e) => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName.toLowerCase(), text: (e.getAttribute("aria-label") || e.innerText || "").trim().split("\n")[0].slice(0, 60), x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter((b) => b.w > 40 && b.h > 20));
    writeFileSync(join(out, `${name}_boxes.json`), JSON.stringify(boxes, null, 1));
  }
  console.log(`${problems.length ? "✗" : "✓"} ${name}${problems.length ? `\n    ${problems.join("\n    ")}` : ""}`);
  bad += problems.filter((p) => !p.startsWith("Failed to load resource")).length;
  await page.close();
}
await browser.close();
server.close();
console.log(bad ? `✗ ${bad} problem(s) — ${out}` : `✓ all good — ${out}`);
process.exit(bad ? 1 : 0);
