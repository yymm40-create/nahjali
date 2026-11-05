// «الرابط يُسمع»: a YouTube or TikTok link in a message to «محمد باقر» (صانع المحتوى) or «حيدرا ماكس» (حيدرة كت)
// is heard before the robot answers: ElevenLabs Scribe fetches the video itself and writes what is said in it, and the
// words ride with the turn, so the robot can rewrite, summarise or build a carousel / reel / motion piece from it
// (the owner, 5 Nov 2026). A downloader for the picture itself comes later. Server only.
//
// Each link is written once: the transcript is kept in the private bucket by the video's id, so the next messages of
// the conversation (and anyone else who pastes the same video) read it back free. A long video that is not written
// within the turn's budget keeps running at ElevenLabs (when the account's webhook is on) and is picked up next turn.

import { createHash } from "crypto";
import { elevenTranscribeUrl, elevenTranscript, type Heard } from "@/lib/jawad/server/providers/elevenlabs";
import { mediaUsd, transcriptText } from "@/lib/jawad/student/media";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { storage } from "@/lib/storage";

/** How many links of one message are heard; the rest are named as not heard. */
export const LINKS_PER_MESSAGE = 2;
/** The transcript given to the robot, per link (about 25 minutes of speech). */
export const HEARD_CHARS = 30_000;

const LINK = /https?:\/\/[^\s<>«»"'()]+/gi;

/** The video links of a text (YouTube: watch / shorts / live / youtu.be; TikTok), each once, cleaned. */
export function videoLinks(text: string): string[] {
  const out: string[] = [];
  for (const raw of String(text ?? "").match(LINK) ?? []) {
    const url = raw.replace(/[.,،؛!?؟)\]]+$/, "");
    if (keyOf(url) && !out.some((u) => keyOf(u) === keyOf(url))) out.push(url);
  }
  return out;
}

/** The video's own id (the same video by any of its links), or null when it is not a video link we hear. */
export function keyOf(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") return ytId(u.pathname.slice(1));
  if (host === "youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return ytId(v);
    const m = u.pathname.match(/^\/(shorts|live|embed)\/([^/?#]+)/);
    return m ? ytId(m[2]) : null;
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const m = u.pathname.match(/\/video\/(\d+)/);
    if (m) return `tt:${m[1]}`;
    // a short share link (vm.tiktok.com/…): its own path names it
    return u.pathname.length > 3 ? `tt:${createHash("sha1").update(u.hostname + u.pathname).digest("hex").slice(0, 16)}` : null;
  }
  return null;
}
const ytId = (id: string) => (/^[\w-]{6,20}$/.test(id) ? `yt:${id}` : null);

interface Kept {
  url: string;
  title: string;
  status: "ready" | "pending" | "failed";
  /** ElevenLabs' background transcription, while pending */
  id?: string;
  text?: string;
  seconds?: number;
  why?: string;
  at: string;
}

const pathOf = (key: string) => `link-heard/${createHash("sha256").update(key).digest("hex")}.json`;

async function readKept(key: string): Promise<Kept | null> {
  try {
    const { data, error } = await storage.from(JAWAD_BUCKET).download(pathOf(key));
    if (error || !data) return null;
    return JSON.parse(await data.text()) as Kept;
  } catch {
    return null;
  }
}

async function keep(key: string, k: Kept) {
  await storage
    .from(JAWAD_BUCKET)
    .upload(pathOf(key), Buffer.from(JSON.stringify(k)), { contentType: "application/json", upsert: true })
    .catch(() => null);
}

/** The webhook's word on a background transcription that failed (lib: api/jawad/eleven/stt-webhook). */
export async function linkFailed(key: string, why: string) {
  const k = await readKept(key);
  if (k?.status === "pending") await keep(key, { ...k, status: "failed", why: why.slice(0, 200), at: new Date().toISOString() });
}

/** The video's title (YouTube's and TikTok's public oEmbed), empty when it can't be read. */
async function titleOf(url: string) {
  const key = keyOf(url) ?? "";
  const api = key.startsWith("yt:") ? "https://www.youtube.com/oembed?format=json&url=" : key.startsWith("tt:") ? "https://www.tiktok.com/oembed?url=" : "";
  if (!api) return "";
  try {
    const r = await fetch(api + encodeURIComponent(url), { signal: AbortSignal.timeout(5000) });
    return r.ok ? String(((await r.json()) as { title?: string }).title ?? "").replace(/\s+/g, " ").slice(0, 200) : "";
  } catch {
    return "";
  }
}

const secondsOf = (h: Heard) => (h.words.length ? h.words[h.words.length - 1].end : 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ready(url: string, title: string, h: Heard): Kept {
  const text = transcriptText(h);
  return text ? { url, title, status: "ready", text, seconds: Math.round(secondsOf(h)), at: new Date().toISOString() } : { url, title, status: "failed", why: "ما فيه كلام مسموع", at: new Date().toISOString() };
}

/** One link heard (or read back): a background one is waited for until `until`. Never throws. */
async function hear(url: string, until: number, write: boolean): Promise<{ kept: Kept | null; fresh: boolean }> {
  const key = keyOf(url)!;
  let k = await readKept(key);
  if (k?.status === "ready" || (k?.status === "failed" && !write)) return { kept: k, fresh: false };
  if (!k || k.status === "failed") {
    if (!write) return { kept: null, fresh: false };
    const title = await titleOf(url);
    try {
      const r = await elevenTranscribeUrl({ url, waitMs: Math.max(20_000, until - Date.now()), metadata: { linkKey: key } });
      if ("heard" in r) {
        k = ready(url, title, r.heard);
        await keep(key, k);
        return { kept: k, fresh: k.status === "ready" };
      }
      k = { url, title, status: "pending", id: r.id, at: new Date().toISOString() };
      await keep(key, k);
    } catch (e) {
      const why = e instanceof Error ? e.message.replace(/\s+/g, " ").slice(0, 160) : "";
      k = { url, title, status: "failed", why, at: new Date().toISOString() };
      await keep(key, k);
      return { kept: k, fresh: false };
    }
  }
  // pending: look until the budget ends
  while (k.status === "pending" && k.id) {
    const h = await elevenTranscript(k.id).catch(() => null);
    if (h) {
      k = ready(k.url, k.title, h);
      await keep(key, k);
      return { kept: k, fresh: k.status === "ready" };
    }
    const latest = await readKept(key);
    if (latest?.status === "failed") return { kept: latest, fresh: false };
    // ElevenLabs writes an hour in a minute or two: a job still silent after 20 minutes failed without a word
    if (Date.now() - Date.parse(k.at) > 20 * 60_000) {
      k = { ...k, status: "failed", why: "ما وصل التفريغ" };
      await keep(key, k);
      return { kept: k, fresh: false };
    }
    if (Date.now() + 4000 > until) break;
    await sleep(3000);
  }
  return { kept: k, fresh: false };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export interface Listened {
  /** the block that rides with the robot's turn (empty when the messages have no video link) */
  block: string;
  /** what the transcriptions written in THIS turn cost (read-backs are free) */
  usd: number;
  /** the links of the latest message, for the page: heard, still being written, or failed */
  links: { url: string; title: string; status: Kept["status"] | "skipped"; seconds?: number }[];
}

/**
 * The video links of the latest message are heard (written now, or read back); those of the earlier messages of the
 * conversation are only read back, so the transcript stays with the robot for the rest of the talk.
 */
export async function listenToLinks(latest: string, earlier: string[] = [], o: { budgetMs?: number } = {}): Promise<Listened> {
  const now = videoLinks(latest);
  const before = earlier.flatMap(videoLinks).filter((u) => !now.some((n) => keyOf(n) === keyOf(u)));
  if (!now.length && !before.length) return { block: "", usd: 0, links: [] };
  const until = Date.now() + (o.budgetMs ?? 150_000);
  const heardNow = await Promise.all(now.slice(0, LINKS_PER_MESSAGE).map((u) => hear(u, until, true)));
  const heardBefore = await Promise.all(before.slice(-3).map((u) => hear(u, until, false)));
  let usd = 0;
  const lines: string[] = [];
  const links: Listened["links"] = [];
  heardNow.forEach(({ kept, fresh }, i) => {
    const url = now[i];
    if (fresh && kept?.seconds) usd += mediaUsd(kept.seconds);
    links.push({ url, title: kept?.title ?? "", status: kept?.status ?? "failed", ...(kept?.seconds ? { seconds: kept.seconds } : {}) });
    lines.push(describe(url, kept));
  });
  for (const url of now.slice(LINKS_PER_MESSAGE)) {
    links.push({ url, title: "", status: "skipped" });
    lines.push(`• ${url}: ما انسمع (أكثر من ${LINKS_PER_MESSAGE} روابط في رسالة وحدة). قل للعميل يرسله في رسالة ثانية.`);
  }
  heardBefore.forEach(({ kept }, i) => {
    if (kept?.status === "ready") lines.push(describe(before[i], kept));
  });
  if (!lines.length) return { block: "", usd, links };
  const block = [
    "## روابط الفيديو في المحادثة — مسموعة",
    "العميل أرسل رابط فيديو. جواد سمع الفيديو بأداة ElevenLabs وكتب كلامه تحت (بالوقت كل فقرة). اشتغل منه مباشرة: لخّصه، أو اقتبس منه، أو ابنِ منه المحتوى المطلوب (كاروسيل، سكربت ريل، موشن…) بأسلوبك. لا تقل إنك ما تقدر تفتح الروابط. الكلام وحده هو المسموع: الصورة نفسها ما انشافت، فلا تصف مشاهد الفيديو.",
    ...lines,
  ].join("\n\n");
  return { block, usd, links };
}

function describe(url: string, k: Kept | null): string {
  const name = k?.title ? `«${k.title}»` : url;
  if (!k || k.status === "failed") return `• ${name}: ما قدرنا نسمعه${k?.why ? ` (${k.why})` : ""}. قل للعميل بلطف، واطلب منه يرفع الملف أو يلصق الكلام.`;
  if (k.status === "pending") return `• ${name}: الفيديو طويل وتفريغه شغّال الحين. قل للعميل إنك تسمعه، ويرسل أي رسالة بعد دقيقة أو دقيقتين وتكمل منه.`;
  const text = k.text ?? "";
  const cut = text.length > HEARD_CHARS ? `${text.slice(0, HEARD_CHARS)}\n…(باقي الكلام مقطوع: الفيديو أطول من المسموح في الرد)` : text;
  return `### ${name}\nالرابط: ${url}${k.seconds ? ` · المدة ${clock(k.seconds)}` : ""}\n\n${cut}`;
}
