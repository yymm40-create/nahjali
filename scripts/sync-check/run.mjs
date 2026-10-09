// A real-browser check of «زامن الصوت» on real files (not part of `npm test`; needs ffmpeg and the sandbox's Chromium):
//   node scripts/sync-check/run.mjs
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(tmpdir(), "sync-check");
mkdirSync(out, { recursive: true });
await build({ entryPoints: [join(root, "scripts/sync-check/harness.ts")], bundle: true, outfile: join(out, "harness.js"), format: "iife", alias: { "@": join(root, "src"), "@config": join(root, "config") }, logLevel: "error", define: { "process.env.NODE_ENV": '"test"' } });

// speech-like sound: bursts of voiced tones and noise with pauses (seeded)
const R = 16000;
let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const N = R * 70;
const pcm = new Int16Array(N);
for (let i = 0; i < N; ) {
  i += Math.round((0.05 + rnd() * 0.5) * R);
  const len = Math.round((0.1 + rnd() * 0.5) * R);
  const lvl = 0.1 + rnd() * 0.8;
  const f1 = 120 + rnd() * 200, f2 = 700 + rnd() * 900;
  for (let k = 0; k < len && i + k < N; k++) {
    const t = (i + k) / R;
    const v = lvl * Math.sin((Math.PI * k) / len) * (0.5 * Math.sin(2 * Math.PI * f1 * t) + 0.3 * Math.sin(2 * Math.PI * f2 * t) + 0.2 * (rnd() * 2 - 1));
    pcm[i + k] = Math.round(v * 20000);
  }
  i += len;
}
const wav = Buffer.alloc(44 + N * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + N * 2, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(R, 24); wav.writeUInt32LE(R * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(N * 2, 40);
Buffer.from(pcm.buffer).copy(wav, 44);
const src = join(out, "src.wav");
writeFileSync(src, wav);
// device A: the whole sound. device B: starts 12.345 s later, duller and quieter, with its own hiss, and stereo
const A = join(out, "a.webm"), B = join(out, "b.webm");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-c:a", "libopus", "-b:a", "48k", A]);
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "12.345", "-i", src, "-af", "lowpass=f=1800,volume=0.4,aeval=val(0)+0.002*random(0)|val(0)", "-c:a", "libopus", "-b:a", "48k", B]);

const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const file = { "/": null, "/harness.js": join(out, "harness.js"), "/a.webm": A, "/b.webm": B }[u.pathname];
  if (u.pathname === "/") return void res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><script src="/harness.js"></script>');
  if (!file) return void res.writeHead(404).end();
  const buf = readFileSync(file);
  const type = file.endsWith(".js") ? "text/javascript" : "audio/webm";
  const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  if (range) {
    const a = Number(range[1]), b = range[2] ? Number(range[2]) : buf.length - 1;
    return void res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${buf.length}`, "content-length": b - a + 1 }).end(buf.subarray(a, b + 1));
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": buf.length }).end(buf);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const { default: puppeteer } = await import(join(root, "node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js"));
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("  pageerror:", e.message));
await page.goto(`http://127.0.0.1:${port}/`);
const r = await page.evaluate((p) => window.go(`http://127.0.0.1:${p}/a.webm`, `http://127.0.0.1:${p}/b.webm`), port);
console.log(r);
const ok = r.confidence === "high" && Math.abs(r.lag + 12.345) < 0.01;
console.log(ok ? `✓ found the shift: ${r.lag.toFixed(4)} s (true −12.345), in ${r.ms} ms` : "✗ WRONG");
await browser.close();
server.close();
process.exit(ok ? 0 : 1);
