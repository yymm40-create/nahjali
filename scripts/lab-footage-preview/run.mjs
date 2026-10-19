// Runs entry.ts in Chromium on a real talking video: node scripts/lab-footage-preview/run.mjs <video.mp4> [outDir]
// Writes sheet.jpg (the contact sheet from the scene page) and film.mp4 (the rendered piece with the video's sound).
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const video = resolve(process.argv[2]);
const out = process.argv[3] ?? join(tmpdir(), "lab-footage-preview");
mkdirSync(out, { recursive: true });
await build({
  entryPoints: [join(root, "scripts/lab-footage-preview/entry.ts")], bundle: true, outfile: join(out, "bundle.js"), format: "iife",
  alias: { "@": join(root, "src"), "@config": join(root, "config") }, define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error",
});
const html = `<!doctype html><meta charset=utf-8><body><script src="/bundle.js"></script>`;
const server = createServer((req, res) => {
  if (req.url === "/") return void res.writeHead(200, { "content-type": "text/html" }).end(html);
  if (req.url === "/bundle.js") return void res.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(join(out, "bundle.js")));
  if (req.url === "/talk.mp4") {
    const size = statSync(video).size, buf = readFileSync(video);
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    if (!m) return void res.writeHead(200, { "content-type": "video/mp4", "content-length": size, "accept-ranges": "bytes", "access-control-allow-origin": "*" }).end(buf);
    const a = Number(m[1]), b = m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
    return void res.writeHead(206, { "content-type": "video/mp4", "content-range": `bytes ${a}-${b}/${size}`, "content-length": b - a + 1, "accept-ranges": "bytes", "access-control-allow-origin": "*" }).end(buf.subarray(a, b + 1));
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
page.on("console", (m) => console.log("page:", m.text()));
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`http://127.0.0.1:${port}/`);
const r = await page.evaluate((u) => window.runLab(u), `http://127.0.0.1:${port}/talk.mp4`);
writeFileSync(join(out, "sheet.jpg"), Buffer.from(r.sheet, "base64"));
writeFileSync(join(out, "film.mp4"), Buffer.from(r.mp4, "base64"));
delete r.sheet;
delete r.mp4;
console.log(JSON.stringify(r, null, 1));
await browser.close();
server.close();
