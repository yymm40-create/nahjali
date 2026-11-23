// A real-browser check of «only what is seen is decoded» and of «S» / «H» on the editor's Player (not part of
// `npm test`; needs ffmpeg and the sandbox's Chromium):
//   node scripts/player-check/run.mjs
// Twelve cameras of one moment, each a plain colour, stacked on one another. Exits 1 when a check fails.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = join(tmpdir(), "player-check-2");
mkdirSync(out, { recursive: true });
await build({ entryPoints: [join(root, "scripts/player-check/harness.ts")], bundle: true, outfile: join(out, "harness.js"), format: "iife", alias: { "@": join(root, "src"), "@config": join(root, "config") }, logLevel: "error", define: { "process.env.NODE_ENV": '"test"' }, loader: { ".css": "empty" } });

const N = 12;
// camera i is a plain colour whose red says which one it is
const red = (i) => 20 + i * 18;
for (let i = 0; i < N; i++) {
  const f = join(out, `cam${i}.webm`);
  if (!existsSync(f)) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0x${red(i).toString(16).padStart(2, "0")}8040:s=320x180:r=30:d=20`, "-f", "lavfi", "-i", `sine=frequency=${220 + i * 40}:duration=20`, "-c:v", "libvpx", "-b:v", "200k", "-g", "30", "-c:a", "libvorbis", "-shortest", f]);
}
const server = createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  const file = join(out, p);
  if (p !== "/" && existsSync(file)) {
    const buf = readFileSync(file);
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    const type = p.endsWith(".js") ? "text/javascript" : "video/webm";
    if (range) {
      const a = Number(range[1]);
      const b = range[2] ? Number(range[2]) : buf.length - 1;
      return void res.writeHead(206, { "content-type": type, "content-range": `bytes ${a}-${b}/${buf.length}`, "accept-ranges": "bytes", "access-control-allow-origin": "*" }).end(buf.subarray(a, b + 1));
    }
    return void res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "access-control-allow-origin": "*" }).end(buf);
  }
  res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><meta charset=utf-8><body><script src="/harness.js"></script>');
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const { createRequire } = await import("node:module");
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => typeof window.pcStart === "function");
await page.evaluate((n) => window.pcStart(n), N);

const failed = [];
const cam = (px) => Math.round((px[0] - 20) / 18);
const check = async (name, want, act) => {
  if (act) await act();
  await page.evaluate(() => window.pcSeek(5000));
  const got = await page.evaluate(() => window.pcLook());
  const ok = cam(got.pixel) === want.camera && got.videos <= want.videos && (want.sounds == null || got.sounds === want.sounds);
  console.log(`${ok ? "✓" : "✗"} ${name}: draws camera ${cam(got.pixel) + 1} (want ${want.camera + 1}), ${got.videos} video(s) decoding (want ≤ ${want.videos})${want.sounds == null ? "" : `, ${got.sounds} sound-only (want ${want.sounds})`}`);
  if (!ok) failed.push(name);
};
const run = (cmd) => page.evaluate((c) => window.pcRun(c), cmd);
const all = Array.from({ length: N }, (_, i) => (i ? `v${i}` : "main"));

// every camera's own sound on: the covered ones are heard through sound-only elements, one picture is decoded
await check(`${N} cameras stacked, their sound on: one picture decoded, the rest sound only`, { camera: N - 1, videos: 1, sounds: N - 1 });
// the cameras' sound off (the poem is on its own track): nothing at all for the covered ones
await check("their sound off (⌥ + speaker): one element in all", { camera: N - 1, videos: 1, sounds: 0 }, () => run({ type: "update_tracks", trackIds: all, patch: { muted: true } }));
await check("«H» on the top camera: the one under it shows", { camera: N - 2, videos: 1, sounds: 0 }, () => run({ type: "update_track", trackId: `v${N - 1}`, patch: { off: true } }));
await check("«S» on camera 4: it is the only video", { camera: 3, videos: 1, sounds: 0 }, () => run({ type: "update_track", trackId: "v3", patch: { solo: true } }));
await check("«S» off again: back to the top camera that is on", { camera: N - 2, videos: 1, sounds: 0 }, () => run({ type: "update_track", trackId: "v3", patch: { solo: false } }));
await check("the top camera made smaller: the one under it is seen around it, both decoded", { camera: N - 1, videos: 2, sounds: 0 }, async () => {
  await run({ type: "update_track", trackId: `v${N - 1}`, patch: { off: false } });
  await run({ type: "update_clip", clipId: `c${N - 1}`, patch: { transform: { x: 0.5, y: 0.5, scale: 0.5, rotate: 0, opacity: 1 } } });
});
// playing: still one decoder running
await run({ type: "update_clip", clipId: `c${N - 1}`, patch: { transform: { x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 } } });
await page.evaluate(() => window.pcPlay(1500));
const playing = await page.evaluate(() => window.pcLook());
const okPlay = playing.videos === 1 && playing.playing === 1;
console.log(`${okPlay ? "✓" : "✗"} while playing: ${playing.playing} playing of ${playing.videos} video element(s) (want 1 of 1)`);
if (!okPlay) failed.push("playing");

await browser.close();
server.close();
console.log(failed.length ? `\n${failed.length} FAILED` : "\nall checks passed");
process.exit(failed.length ? 1 : 0);
