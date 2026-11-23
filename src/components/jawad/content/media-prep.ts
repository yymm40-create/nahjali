// «صانع المحتوى» · what the page prepares before a message goes to «محمد باقر», the way Claude itself works with a video:
//   - a video (attached, or downloaded from a YouTube link) → a contact sheet of its frames with their times, one JPEG
//     he LOOKS at (its sound is heard on the server: lib/link-listen listenToFiles, or the link itself);
//   - a YouTube link → downloaded (the video + its sound as MP3) through /api/content/youtube, then attached.
import { api, postJson } from "@/lib/fetch";
import { putWithProgress } from "@/components/jawad/studio/upload";

export interface PreparedFile {
  id: string;
  kind: "image" | "video" | "audio" | "doc";
  name: string;
  durationMs: number | null;
  url?: string | null;
}

/** how many frames a sheet holds, and the fewest seconds between two of them */
const SHEET_FRAMES = 16;
const MIN_GAP_S = 2;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The frames of a video (a local object URL or a stored file's link) laid out 4 across with their times, as a JPEG. */
export async function frameSheet(url: string): Promise<Blob> {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  await new Promise<void>((ok, fail) => {
    v.onloadeddata = () => ok();
    v.onerror = () => fail(new Error("load"));
    setTimeout(() => fail(new Error("timeout")), 30_000);
  });
  const dur = Number.isFinite(v.duration) ? v.duration : 0;
  const count = Math.max(1, Math.min(SHEET_FRAMES, Math.floor(dur / MIN_GAP_S) || 1));
  const times = Array.from({ length: count }, (_, i) => (count === 1 ? Math.min(0.5, dur / 2) : ((i + 0.5) * dur) / count));
  const cols = Math.min(4, count);
  const rows = Math.ceil(count / cols);
  const cellW = 360;
  const cellH = Math.round((cellW * (v.videoHeight || 9)) / (v.videoWidth || 16));
  const pad = 6;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cellW + (cols + 1) * pad;
  canvas.height = rows * cellH + (rows + 1) * pad;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < times.length; i++) {
    await new Promise<void>((ok, fail) => {
      v.onseeked = () => ok();
      v.onerror = () => fail(new Error("seek"));
      setTimeout(() => ok(), 8000);
      v.currentTime = Math.max(0, Math.min(times[i], dur - 0.05));
    });
    const x = pad + (i % cols) * (cellW + pad);
    const y = pad + Math.floor(i / cols) * (cellH + pad);
    ctx.drawImage(v, x, y, cellW, cellH);
    // the time of the frame, so «محمد باقر» can point at a moment
    ctx.font = "bold 20px sans-serif";
    const label = clock(times[i]);
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = "rgba(0,0,0,.7)";
    ctx.fillRect(x + 6, y + 6, w, 28);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 13, y + 27);
  }
  v.removeAttribute("src");
  v.load();
  return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("sheet"))), "image/jpeg", 0.82));
}

/** A picture made on the page, put up as the person's upload (signed, then checked by the server). */
export async function putImage(blob: Blob, fileName: string): Promise<PreparedFile> {
  const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "image", mime: "image/jpeg", bytes: blob.size, fileName });
  await putWithProgress(signed.signedUrl, new File([blob], fileName, { type: "image/jpeg" }), "image/jpeg", () => {});
  const conf = await postJson<{ upload: { id: string; status: string; error: string | null; url: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
  if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر رفع اللقطات.");
  return { id: conf.upload.id, kind: "image", name: fileName, durationMs: null, url: conf.upload.url };
}

/** A video's frames as a sheet upload (null when the browser can't read it: the video still goes, unseen). */
export async function sheetOf(url: string, name: string): Promise<PreparedFile | null> {
  try {
    return await putImage(await frameSheet(url), `لقطات من ${name.replace(/\.[a-z0-9]+$/i, "")}.jpg`.slice(0, 190));
  } catch {
    return null;
  }
}

const YT = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/|live\/|embed\/)|youtu\.be\/)[\w-]{6,20}[^\s<>«»"']*/gi;

/** The YouTube links of a message (at most two). */
export const youtubeLinks = (text: string) => [...new Set(text.match(YT) ?? [])].slice(0, 2);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Downloads a YouTube link for the message: its video and sound as the person's uploads, plus the video's frame sheet.
 * null when the download is not turned on; throws with the reason when it failed.
 */
/**
 * The message wants only the video's SOUND (a background, a nasheed, a latmiya): no sheet of its frames is attached
 * (the owner, 23 Nov 2026: «مانبيه ناخذ منه فريمز»).
 */
export const soundOnlyAsk = (text: string) => /(صوت|الصوت|صوته|خلفي[ةه]\s*صوتي[ةه]|موسيقى|موسيقا|لطمي[ةه]|نشيد|قصيد[ةه]|رادود|اوديو|أوديو|audio|sound|music)/i.test(text) && !/(فريم|لقطات|صور\s*من\s*الفيديو|frames?)/i.test(text);

export async function downloadYoutube(url: string, onStep: (s: string) => void, o: { frames?: boolean } = {}): Promise<PreparedFile[] | null> {
  const start = await postJson<{ enabled: boolean; key?: string }>("/api/content/youtube", { url });
  if (!start.enabled || !start.key) return null;
  onStep("⬇️ أنزّل الفيديو وصوته من يوتيوب…");
  const until = Date.now() + 16 * 60_000;
  for (;;) {
    const s = await api<{ state: string; why?: string; title?: string; files?: PreparedFile[] }>(`/api/content/youtube?key=${encodeURIComponent(start.key)}`);
    if (s.state === "failed") throw new Error(`ما قدرنا ننزّل الفيديو${s.why ? ` (${s.why})` : ""}.`);
    if (s.state === "ready") {
      const files = s.files ?? [];
      const video = files.find((f) => f.kind === "video");
      if (video?.url && o.frames !== false) {
        onStep("🎞️ أطلّع صور الفيديو…");
        const sheet = await sheetOf(video.url, video.name);
        if (sheet) files.push(sheet);
      }
      return files;
    }
    if (Date.now() > until) throw new Error("التنزيل طوّل أكثر من اللازم.");
    await wait(4000);
  }
}
