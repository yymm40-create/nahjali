// TEMPORARY test (the owner, 16 Nov 2026: «نجرّب yt-dlp على سيرفر الموقع نفسه… جرب قبل»): does YouTube let the site's
// own server download with yt-dlp, the way Claude does it on the owner's Mac? Owner only. Fetches the official yt-dlp
// Linux build (checked against its SHA2-256SUMS) into /tmp, reads the video's details, then downloads a small file
// (360p video, then the sound) and reports what happened. Remove after the test.
import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { isOwner } from "@config/site";

export const runtime = "nodejs";
export const maxDuration = 300;

const VERSION = "2026.10.26";
const DIR = "/tmp/ytdlp";

async function binary(): Promise<string> {
  const name = process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
  const path = `${DIR}/${name}`;
  if (existsSync(path)) return path;
  await mkdir(DIR, { recursive: true });
  const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}`;
  const sums = await (await fetch(`${base}/SHA2-256SUMS`)).text();
  const want = sums.split("\n").find((l) => l.trim().endsWith(` ${name}`))?.split(/\s+/)[0];
  const bytes = Buffer.from(await (await fetch(`${base}/${name}`)).arrayBuffer());
  const got = createHash("sha256").update(bytes).digest("hex");
  if (!want || got !== want) throw new Error(`checksum mismatch for ${name}`);
  await writeFile(path, bytes);
  await chmod(path, 0o755);
  return path;
}

function run(bin: string, args: string[], ms: number) {
  const t0 = Date.now();
  return new Promise<{ ok: boolean; ms: number; out: string; err: string }>((done) => {
    execFile(bin, args, { timeout: ms, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, HOME: "/tmp" } }, (e, out, err) =>
      done({ ok: !e, ms: Date.now() - t0, out: String(out), err: String(err).slice(-1500) }),
    );
  });
}

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isOwner(user.email)) throw new UserError("غير مسموح.", 404);
  const url = new URL(req.url).searchParams.get("url") || "https://www.youtube.com/watch?v=jNQXAC9IVRw";
  const t0 = Date.now();
  const bin = await binary();
  const setupMs = Date.now() - t0;
  // node is the JavaScript runtime yt-dlp uses for YouTube's challenges
  const common = ["--no-warnings", "--no-playlist", "--no-cache-dir", "--js-runtimes", `node:${process.execPath}`];
  const info = await run(bin, [...common, "-J", url], 90_000);
  let details: Record<string, unknown> | null = null;
  try {
    const j = JSON.parse(info.out);
    details = { title: j.title, duration: j.duration, formats: (j.formats ?? []).length };
  } catch {
    /* no details */
  }
  const out = `${DIR}/dl`;
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const video = await run(bin, [...common, "-f", "18/best[height<=360][ext=mp4]/best[height<=360]", "--max-filesize", "60M", "-o", `${out}/v.%(ext)s`, url], 120_000);
  const audio = await run(bin, [...common, "-f", "bestaudio[ext=m4a]/bestaudio", "--max-filesize", "60M", "-o", `${out}/a.%(ext)s`, url], 120_000);
  const files = await Promise.all((await readdir(out)).map(async (f) => ({ f, bytes: (await stat(`${out}/${f}`)).size })));
  await rm(out, { recursive: true, force: true });
  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    arch: process.arch,
    setupMs,
    details,
    info: { ok: info.ok, ms: info.ms, err: info.err },
    video: { ok: video.ok, ms: video.ms, err: video.err },
    audio: { ok: audio.ok, ms: audio.ms, err: audio.err },
    files,
  });
});
