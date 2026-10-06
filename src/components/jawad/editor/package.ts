// «احفظ المشروع في جهازي»: a whole project in one .zip file kept on the person's device — the timeline, every file
// it uses (videos, sounds, pictures), the captions as SRT and a short note — to keep, to take to another device and
// open there («افتح مشروع محفوظ»), or to take its files to another program. Stored (not compressed: the media is).

import type { Timeline } from "@/lib/editor/model";
import { toSRT } from "./captions";
import type { EditorAsset } from "./types";

export const PACKAGE_FORMAT = "haidara-cut";
const MAX = 0xffffffff;

/** What project.json in the package holds. */
export interface PackageManifest {
  format: typeof PACKAGE_FORMAT;
  version: 1;
  title: string;
  kind: string;
  savedAt: string;
  timeline: Timeline;
  assets: { id: string; kind: EditorAsset["kind"]; name: string; file: string; durationMs: number | null; width: number | null; height: number | null; hasAudio: boolean }[];
}

// ───────── zip (stored) ─────────

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array, crc = 0) {
  let c = ~crc >>> 0;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** A file's CRC, read in pieces (a video can be large). */
async function crcOf(b: Blob) {
  let c = 0;
  const step = 8 * 1024 * 1024;
  for (let at = 0; at < b.size; at += step) c = crc32(new Uint8Array(await b.slice(at, at + step).arrayBuffer()), c);
  return c;
}

/** Files into one .zip (stored, UTF-8 names). Each file and the whole stay under 4 GB. */
export async function zipStore(entries: { name: string; data: Blob }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const size = e.data.size;
    if (size > MAX || offset + size > MAX) throw new Error("المشروع أكبر من ٤ جيجا؛ احذف الملفات اللي ما تحتاجها من مكتبة المشروع وجرّب مرة ثانية.");
    const crc = await crcOf(e.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    parts.push(local.buffer, name, e.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, size, true);
    c.setUint32(24, size, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    const row = new Uint8Array(46 + name.length);
    row.set(new Uint8Array(c.buffer), 0);
    row.set(name, 46);
    central.push(row);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((n, r) => n + r.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central.map((r) => r.slice().buffer), end.buffer], { type: "application/zip" });
}

/** A .zip's files (stored, or compressed the usual way, as a computer's «compress» makes them). */
export async function unzip(file: Blob): Promise<Map<string, Blob>> {
  const tail = new DataView(await file.slice(Math.max(0, file.size - 65_557)).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--)
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error("هذا مو ملف مشروع (zip).");
  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdAt = tail.getUint32(eocd + 16, true);
  const cd = new DataView(await file.slice(cdAt, cdAt + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  const out = new Map<string, Blob>();
  for (let i = 0, p = 0; i < count; i++) {
    if (cd.getUint32(p, true) !== 0x02014b50) throw new Error("ملف المشروع تالف.");
    const method = cd.getUint16(p + 10, true);
    const csize = cd.getUint32(p + 20, true);
    const nlen = cd.getUint16(p + 28, true);
    const xlen = cd.getUint16(p + 30, true);
    const clen = cd.getUint16(p + 32, true);
    const at = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith("/") || name.startsWith("__MACOSX/")) continue;
    const head = new DataView(await file.slice(at, at + 30).arrayBuffer());
    const start = at + 30 + head.getUint16(26, true) + head.getUint16(28, true);
    const raw = file.slice(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob());
    else throw new Error("ملف المشروع مضغوط بطريقة ما نعرفها.");
  }
  return out;
}

// ───────── the project in and out ─────────

const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim().slice(0, 80) || "ملف";
const extOf = (a: EditorAsset, mime: string) => {
  const own = /\.([a-z0-9]{2,5})$/i.exec(a.name)?.[1];
  if (own) return own.toLowerCase();
  const m = mime.split(";")[0];
  return { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[m] ?? "bin";
};

/** The project as one .zip: every ready file of its library, the timeline, the captions and a note. */
export async function packProject(p: { title: string; kind: string; tl: Timeline; assets: EditorAsset[] }, onStep?: (text: string) => void) {
  const ready = p.assets.filter((a) => a.status === "ready" && a.url);
  const entries: { name: string; data: Blob }[] = [];
  const listed: PackageManifest["assets"] = [];
  const used = new Set<string>();
  for (const [i, a] of ready.entries()) {
    onStep?.(`نجهّز الملفات ${i + 1} من ${ready.length}…`);
    const r = await fetch(a.url!);
    if (!r.ok) throw new Error(`تعذّر تحميل «${a.name}»؛ جرّب مرة ثانية.`);
    const data = await r.blob();
    let base = `${String(i + 1).padStart(2, "0")} ${safe(a.name.replace(/\.[a-z0-9]{2,5}$/i, ""))}`;
    while (used.has(base)) base += "_";
    used.add(base);
    const file = `media/${base}.${extOf(a, data.type || a.mime)}`;
    entries.push({ name: file, data });
    listed.push({ id: a.id, kind: a.kind, name: a.name, file, durationMs: a.durationMs, width: a.width, height: a.height, hasAudio: a.hasAudio });
  }
  const manifest: PackageManifest = { format: PACKAGE_FORMAT, version: 1, title: p.title, kind: p.kind, savedAt: new Date().toISOString(), timeline: p.tl, assets: listed };
  entries.unshift({ name: "project.json", data: new Blob([JSON.stringify(manifest)], { type: "application/json" }) });
  const srt = toSRT(p.tl);
  if (srt) entries.push({ name: "captions.srt", data: new Blob([srt], { type: "application/x-subrip" }) });
  entries.push({
    name: "اقرأني.txt",
    data: new Blob(
      [
        `مشروع «${p.title}» من حيدرة كت (الجواد AI)\n\n` +
          "• افتحه من جديد في أي جهاز: حيدرة كت ← «افتح مشروع محفوظ» واختر هذا الملف (لا تفك ضغطه).\n" +
          "• مجلد media: كل الفيديوهات والأصوات والصور اللي في المشروع، تقدر تستخدمها في أي برنامج ثاني.\n" +
          "• captions.srt: الكابشن والنصوص بأوقاتها (يوتيوب، بريمير، كاب كت، دافنشي…).\n" +
          "• project.json: التايملاين نفسه.\n",
      ],
      { type: "text/plain;charset=utf-8" },
    ),
  });
  onStep?.("نجمع الملف…");
  return { blob: await zipStore(entries), name: `${safe(p.title)}.haidara.zip` };
}

/** A saved project read back: its timeline and its files, each with the id the timeline knows it by. */
export async function unpackProject(file: Blob) {
  const files = await unzip(file);
  const json = files.get("project.json");
  if (!json) throw new Error("هذا الملف مو مشروع من حيدرة كت (ما فيه project.json).");
  let m: PackageManifest;
  try {
    m = JSON.parse(await json.text());
  } catch {
    throw new Error("ملف المشروع تالف.");
  }
  if (m?.format !== PACKAGE_FORMAT || !m.timeline || !Array.isArray(m.assets)) throw new Error("هذا الملف مو مشروع من حيدرة كت.");
  const media = m.assets.flatMap((a) => {
    const b = files.get(a.file);
    return b ? [{ oldId: a.id, file: new File([b], a.name || a.file.split("/").pop()!, { type: mimeOf(a.file, a.kind) }) }] : [];
  });
  return { title: String(m.title ?? "مشروع"), kind: String(m.kind ?? "reel"), timeline: m.timeline, media, missing: m.assets.length - media.length };
}

const mimeOf = (path: string, kind: string) => {
  const ext = path.split(".").pop()!.toLowerCase();
  const map: Record<string, string> = { mp4: "video/mp4", webm: kind === "audio" ? "audio/webm" : "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  return map[ext] ?? "";
};

/** Each clip pointed at the file's new id (clips of a file that didn't come are left out). */
export function remapTimeline(tl: Timeline, ids: Map<string, string>): Timeline {
  return {
    ...tl,
    tracks: tl.tracks.map((t) => ({
      ...t,
      clips: t.clips.filter((c) => !c.assetId || ids.has(c.assetId)).map((c) => (c.assetId ? { ...c, assetId: ids.get(c.assetId)! } : c)),
    })),
  };
}

/** A file onto the device (the phone app turns it into its save / share sheet). */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
