// A real-browser check of the course videos' whole path (not part of `npm test`; needs ffmpeg and the Chromium of the sandbox):
//   node scripts/learn-check/run.mjs
// It makes a short video, the "owner's browser" cuts + locks + uploads it (to a fake store), the "student's player" plays it
// through the same locking the real site does, seeks, and then tampers with the name tag.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(tmpdir(), "learn-check");
mkdirSync(out, { recursive: true });
const alias = { "@": join(root, "src"), "@config": join(root, "config") };

await build({ entryPoints: [join(root, "scripts/learn-check/harness.ts")], bundle: true, outfile: join(out, "harness.js"), format: "iife", alias, logLevel: "error", define: { "process.env.NODE_ENV": '"test"' } });
await build({ entryPoints: [join(root, "src/lib/learn/crypto.ts")], bundle: true, outfile: join(out, "crypto.mjs"), format: "esm", platform: "node", alias, logLevel: "error" });
const C = await import(join(out, "crypto.mjs"));

const video = join(out, "test.mp4");
// VP9 + Opus in MP4: the sandbox's Chromium has no H.264 (real Chrome and Safari do); a key frame every second
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=40", "-f", "lavfi", "-i", "sine=frequency=440:duration=40", "-c:v", "libvpx-vp9", "-b:v", "300k", "-g", "25", "-keyint_min", "25", "-c:a", "libopus", "-b:a", "48k", "-shortest", video]);

const html = `<!doctype html><meta charset=utf-8><body style="margin:0"><div id=box style="position:relative;width:640px;height:360px;background:#000"><video id=v playsinline style="width:100%;height:100%"></video></div><script src="/harness.js"></script>`;
const store = new Map();
let keys = null;
const served = [];
const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const body = async () => Buffer.concat(await req.toArray());
  if (u.pathname === "/") return void res.writeHead(200, { "content-type": "text/html" }).end(html);
  if (u.pathname === "/harness.js") return void res.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(join(out, "harness.js")));
  if (u.pathname === "/test.mp4") return void res.writeHead(200, { "content-type": "video/mp4" }).end(readFileSync(video));
  if (u.pathname === "/__setup") { keys = JSON.parse((await body()).toString()); return void res.writeHead(200).end("ok"); }
  if (u.pathname.startsWith("/__store/") && req.method === "PUT") { store.set(Number(u.pathname.split("/").pop()), new Uint8Array(await body())); return void res.writeHead(200).end(); }
  if (u.pathname === "/api/learn/beat") { await body(); return void res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}'); }
  if (u.pathname === "/api/learn/seg") {
    if (req.headers["x-learn"] !== "1") return void res.writeHead(403).end();
    const n = Number(u.searchParams.get("n"));
    const sealed = store.get(n);
    if (!sealed) return void res.writeHead(404).end();
    const plain = await C.open(await C.importKey(C.fromB64(keys.contentKey)), sealed, C.aad("c", keys.lesson, n));
    const again = await C.seal(await C.importKey(C.fromB64(keys.sessionKey)), plain, C.aad("s", u.searchParams.get("s"), keys.lesson, n));
    served.push(n);
    return void res.writeHead(200, { "content-type": "application/octet-stream" }).end(Buffer.from(again));
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const { default: puppeteer } = await import(join(root, "node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js"));
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
page.on("console", (m) => { const t = m.text(); if (t.startsWith("[h]") || m.type() === "error") console.log("  browser:", t); });
page.on("pageerror", (e) => console.log("  pageerror:", e.message));
await page.goto(`http://127.0.0.1:${port}/`);

let failed = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "  ✓" : "  ✗", name, extra); if (!ok) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const probe = () => page.evaluate(() => window.probe());

const sessionKey = Buffer.from(C.randomKey()).toString("base64");
const info = await page.evaluate((k) => window.run(k), sessionKey);
console.log("  lesson:", info.mime, `${info.duration.toFixed(1)}s`, `${info.segs.length} pieces`);
check("the video was cut at key frames into pieces of about 6 s", info.segs.length >= 5 && info.segs.slice(0, -1).every((s) => s[2] >= 5.5 && s[2] <= 8.5), JSON.stringify(info.segs.map((s) => s[2])));
check("every piece was locked before it was uploaded", [...store.values()].every((b) => b.length > 28) && store.size === info.segs.length + 1);
check("no stored piece starts like an MP4 (it is not playable as it lies in the bucket)", [...store.values()].every((b) => String.fromCharCode(...b.slice(4, 8)) !== "ftyp" && String.fromCharCode(...b.slice(4, 8)) !== "moof"));

await sleep(4000);
let p = await probe();
check("plays by itself", p.t > 2 && !p.paused && p.frames > 20, JSON.stringify({ t: p.t.toFixed(1), frames: p.frames }));
check("the video's address is a revoked blob (cannot be fetched again)", p.src.startsWith("blob:"));
const fetchable = await page.evaluate((s) => fetch(s).then((r) => r.ok, () => false), p.src);
check("…and fetching it fails", fetchable === false);

await page.evaluate(() => window.seekTo(30));
await sleep(3000);
p = await probe();
check("seeking far ahead plays from there", p.t >= 30 && p.t < 36 && !p.paused, `t=${p.t.toFixed(1)}`);
await page.evaluate(() => window.seekTo(3));
await sleep(2500);
p = await probe();
check("seeking back works", p.t >= 3 && p.t < 8, `t=${p.t.toFixed(1)}`);

await page.evaluate(() => window.seekTo(36));
await sleep(6000);
p = await probe();
check("plays to the very end", p.ended || p.t >= 39.5, `t=${p.t.toFixed(1)} ended=${p.ended}`);

const raw = await page.evaluate(() => fetch("/api/learn/seg?s=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&n=1").then((r) => r.status));
check("a plain request for a piece (no player header) is refused", raw === 403);

await page.evaluate(() => window.tamper());
await sleep(1500);
p = await probe();
check("removing the name tag is noticed", p.tampered.includes("layer"), p.tampered);
const back = await page.evaluate(() => !!document.querySelector('[data-wm="layer"]'));
check("…and the tag is put back", back);

await browser.close();
server.close();
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
