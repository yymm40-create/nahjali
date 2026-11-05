// «⬇️ من رابط» in «الجواد AI» (the owner, 5 Nov 2026): a YouTube (or TikTok, X, Instagram…) video is downloaded ON THE PERSON'S OWN
// COMPUTER with yt-dlp — YouTube refuses the site's servers, not a home connection — into Downloads/الجواد AI, and is
// kept like any file of the computer (haidara-media://), so it is on «حيدرة كت»'s timeline at once with nothing uploaded.
//
// The tools are not shipped inside the program (yt-dlp must follow YouTube's changes every few weeks): the first
// download fetches the official yt-dlp from its GitHub release, checked against the release's own SHA2-256SUMS, and
// ffmpeg (to join the picture and the sound) from ffmpeg-static's release, checked against a fixed hash. yt-dlp updates
// itself when it is more than three days old.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { spawn } = require("node:child_process");

const YTDLP = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";
const YTDLP_NAME = { darwin: "yt-dlp_macos", win32: "yt-dlp.exe", linux: "yt-dlp_linux" };
// ffmpeg-static b6.1.1, by platform and processor: the file and its sha256 (GitHub's digest of the release asset)
const FFMPEG = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/";
const FFMPEG_GZ = {
  "darwin-arm64": ["ffmpeg-darwin-arm64.gz", "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa"],
  "darwin-x64": ["ffmpeg-darwin-x64.gz", "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106"],
  "win32-x64": ["ffmpeg-win32-x64.gz", "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77"],
  // Windows on ARM runs the x64 build
  "win32-arm64": ["ffmpeg-win32-x64.gz", "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77"],
  "linux-x64": ["ffmpeg-linux-x64.gz", "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa"],
};
const UPDATE_EVERY_MS = 3 * 24 * 3600_000;

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

async function fetchBuf(url) {
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10 * 60_000) });
  if (!r.ok) throw new Error(`تعذّر تنزيل الأداة (${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}

/** Writes a program file where it is run from: whole or not at all. */
function writeTool(file, buf) {
  const tmp = `${file}.part`;
  fs.writeFileSync(tmp, buf, { mode: 0o755 });
  fs.renameSync(tmp, file);
}

function tools(userData) {
  const dir = path.join(userData, "tools");
  fs.mkdirSync(dir, { recursive: true });
  const exe = process.platform === "win32" ? ".exe" : "";
  return { dir, ytdlp: path.join(dir, `yt-dlp${exe}`), ffmpeg: path.join(dir, `ffmpeg${exe}`) };
}

/** yt-dlp and ffmpeg on the computer (fetched and checked the first time). */
async function ensureTools(userData, say) {
  const t = tools(userData);
  if (!fs.existsSync(t.ytdlp)) {
    const name = YTDLP_NAME[process.platform];
    if (!name) throw new Error("التنزيل من الروابط ما يشتغل على هذا النظام.");
    say({ stage: "tools", note: "أجهّز أداة التنزيل أول مرة…" });
    const sums = (await fetchBuf(YTDLP + "SHA2-256SUMS")).toString("utf8");
    const want = sums.split("\n").map((l) => l.trim().split(/\s+/)).find((p) => p[1] === name)?.[0];
    const buf = await fetchBuf(YTDLP + name);
    if (!want || sha256(buf) !== want) throw new Error("أداة التنزيل ما طابقت توقيعها الرسمي، فما شغّلناها.");
    writeTool(t.ytdlp, buf);
  }
  if (!fs.existsSync(t.ffmpeg)) {
    const pick = FFMPEG_GZ[`${process.platform}-${process.arch}`];
    if (!pick) throw new Error("ما عندنا ffmpeg لهذا الجهاز.");
    say({ stage: "tools", note: "أجهّز أداة دمج الصورة والصوت أول مرة…" });
    const gz = await fetchBuf(FFMPEG + pick[0]);
    if (sha256(gz) !== pick[1]) throw new Error("أداة الدمج ما طابقت توقيعها، فما شغّلناها.");
    writeTool(t.ffmpeg, zlib.gunzipSync(gz));
  }
  return t;
}

/** yt-dlp follows YouTube's changes: it updates itself when it is a few days old (a failed update keeps the old one). */
async function freshen(t) {
  let age = 0;
  try {
    age = Date.now() - fs.statSync(t.ytdlp).mtimeMs;
  } catch {
    return;
  }
  if (age < UPDATE_EVERY_MS) return;
  await new Promise((done) => {
    const p = spawn(t.ytdlp, ["-U"], { windowsHide: true });
    const timer = setTimeout(() => p.kill(), 120_000);
    p.on("close", () => (clearTimeout(timer), done()));
    p.on("error", () => (clearTimeout(timer), done()));
  });
  try {
    const now = new Date();
    fs.utimesSync(t.ytdlp, now, now);
  } catch {
    /* checked again next time */
  }
}

/** A link we hand to yt-dlp: http(s) only, nothing that looks like an option. */
function cleanLink(v) {
  const s = String(v ?? "").trim();
  if (s.length > 2000 || s.startsWith("-")) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Plain words for what yt-dlp said went wrong. */
function why(log) {
  const l = log.toLowerCase();
  if (/sign in to confirm|not a bot/.test(l)) return "يوتيوب طلب تسجيل دخول لهذا الفيديو؛ جرّب بعد شوي أو فيديو ثاني.";
  if (/private video|members-only|this video is private/.test(l)) return "الفيديو خاص، ما نقدر ننزّله.";
  if (/video unavailable|has been removed|not available/.test(l)) return "الفيديو مو متاح (محذوف أو ممنوع في بلدك).";
  if (/unsupported url/.test(l)) return "هذا الرابط ما ندعم التنزيل منه.";
  if (/age/.test(l) && /confirm|restricted/.test(l)) return "الفيديو مقيّد بالعمر ويحتاج تسجيل دخول.";
  if (/no space left/.test(l)) return "ما فيه مساحة كافية في الجهاز.";
  return "ما قدرنا ننزّل الفيديو. تأكد من الرابط وجرّب مرة ثانية.";
}

/**
 * Downloads one video: the best MP4 the editor plays (H.264, up to 1080p, with AAC sound), into `outDir`.
 * `say` gets { stage: "tools" | "download" | "merge", p (0–1), note } along the way. Resolves to the file's path.
 */
async function download({ userData, outDir, link, say }) {
  const url = cleanLink(link);
  if (!url) throw new Error("الصق رابط فيديو صحيح يبدأ بـ https.");
  const t = await ensureTools(userData, say);
  say({ stage: "tools", note: "أتأكد إن أداة التنزيل آخر نسخة…" });
  await freshen(t);
  fs.mkdirSync(outDir, { recursive: true });
  const args = [
    "--no-playlist",
    "--newline",
    // --print silences yt-dlp: the progress is asked for again
    "--progress",
    "--no-colors",
    "--ffmpeg-location", t.ffmpeg,
    "-f", "bv*[vcodec^=avc1][height<=1080]+ba[acodec^=mp4a]/b[ext=mp4][vcodec^=avc1]/bv*[height<=1080]+ba/b",
    "--merge-output-format", "mp4",
    "--remux-video", "mp4",
    "-P", outDir,
    "-o", "%(title).80B [%(id)s].%(ext)s",
    "--print", "before_dl:JAWADF %(format_id)s",
    "--print", "after_move:filepath",
    "--progress-template", "download:JAWADP %(progress._percent_str)s",
    "--", url,
  ];
  return new Promise((resolve, reject) => {
    const p = spawn(t.ytdlp, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    let file = "";
    let log = "";
    let parts = 0;
    let last = -1;
    // how many files make the video (picture + sound = 2, one ready MP4 = 1): its format, «137+140»
    let pieces = 2;
    const onLine = (line) => {
      const s = line.trim();
      if (!s) return;
      const m = /JAWADP\s+([\d.]+)%/.exec(s);
      if (m) {
        const v = Number(m[1]) / 100;
        // the picture and the sound come one after the other: two passes of 0–100 %
        if (v < last - 0.5) parts++;
        last = v;
        say({ stage: "download", p: Math.min(0.98, (Math.min(parts, pieces - 1) + v) / pieces) });
        return;
      }
      const f = /^JAWADF\s+(\S+)/.exec(s);
      if (f) {
        pieces = f[1].split("+").length;
        return;
      }
      if (/^\[Merger\]|^\[VideoRemuxer\]/.test(s)) say({ stage: "merge", p: 0.99, note: "أدمج الصورة والصوت…" });
      else if (path.isAbsolute(s) && /\.(mp4|m4a|webm|mkv|mov)$/i.test(s)) file = s;
      log = (log + "\n" + s).slice(-4000);
    };
    let buf = "";
    p.stdout.setEncoding("utf8");
    p.stdout.on("data", (d) => {
      buf += d;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.forEach(onLine);
    });
    p.stderr.setEncoding("utf8");
    p.stderr.on("data", (d) => (log = (log + d).slice(-4000)));
    p.on("error", () => reject(new Error("ما قدرنا نشغّل أداة التنزيل على هذا الجهاز.")));
    p.on("close", (code) => {
      if (buf) onLine(buf);
      if (code === 0 && file && fs.existsSync(file)) resolve(file);
      else reject(new Error(why(log)));
    });
  });
}

module.exports = { download, cleanLink };
