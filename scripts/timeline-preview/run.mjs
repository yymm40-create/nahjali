// «حيدرة كت»'s timeline in the sandbox's Chromium with a made-up project (not part of `npm test`):
//   node scripts/timeline-preview/run.mjs [outDir]
// Serves the page, runs the checks in checks.mjs against it and saves screenshots; exits 1 when a check fails.
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const here = join(root, "scripts/timeline-preview");
const out = resolve(process.argv[2] ?? join(tmpdir(), "timeline-preview"));
const work = join(tmpdir(), "timeline-preview-build");
mkdirSync(work, { recursive: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(here, "entry.tsx")], bundle: true, outfile: join(work, "bundle.js"), format: "iife", jsx: "automatic", loader: { ".css": "css", ".png": "file", ".svg": "file", ".woff2": "file" },
  alias: { "@": join(root, "src"), "@config": join(root, "config") }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error", external: ["node:*"],
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
  if (extname(p)) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": "text/html" }).end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const { createRequire } = await import("node:module");
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const { default: checks } = await import(pathToFileURL(join(here, "checks.mjs")).href);
const failed = await checks({ browser, base, out });
await browser.close();
server.close();
console.log(failed.length ? `\n${failed.length} FAILED:\n- ${failed.join("\n- ")}` : "\nall checks passed");
console.log(`shots: ${out}`);
process.exit(failed.length ? 1 : 0);
