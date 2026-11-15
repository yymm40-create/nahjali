// «الجواد الذكي!» | JAWAD AI — reads what a file really is from its bytes (never from its name or the browser's
// claim), plus the dimensions / duration the generators' limits need. Pure: runs in the browser (early feedback)
// and on the server (the check that counts). Images' pixel sizes are read with sharp on the server.

export type Sniffed =
  | { kind: "image"; mime: "image/png" | "image/jpeg" | "image/webp" }
  | { kind: "video"; mime: "video/mp4" | "video/quicktime" }
  | { kind: "audio"; mime: AudioMime }
  | { kind: "doc"; mime: "application/pdf" }
  | null;

/** Every sound the uploads take (the owner, 15 Nov 2026: «خله يقبل كل الاصوات»); each generator narrows it to what it reads. */
export type AudioMime = "audio/mpeg" | "audio/wav" | "audio/mp4" | "audio/aac" | "audio/ogg" | "audio/flac" | "audio/webm" | "audio/amr" | "audio/aiff";

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

/** The real type of a file from its first bytes (16 are enough). */
export function sniff(b: Uint8Array): Sniffed {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a) return { kind: "image", mime: "image/png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", mime: "image/jpeg" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return { kind: "image", mime: "image/webp" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return { kind: "audio", mime: "audio/wav" };
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (brand === "qt  ") return { kind: "video", mime: "video/quicktime" };
    // audio-only MPEG-4 brands: an M4A sound (iPhone voice memos, iTunes, most phone recorders)
    if (/^(M4A |M4B |M4P |F4A |F4B )$/.test(brand)) return { kind: "audio", mime: "audio/mp4" };
    return { kind: "video", mime: "video/mp4" };
  }
  // a PDF: the robots read it themselves (a lecture, a report, a form to follow)
  if (ascii(b, 0, 5) === "%PDF-") return { kind: "doc", mime: "application/pdf" };
  if (ascii(b, 0, 4) === "OggS") return { kind: "audio", mime: "audio/ogg" };
  if (ascii(b, 0, 4) === "fLaC") return { kind: "audio", mime: "audio/flac" };
  if (ascii(b, 0, 5) === "#!AMR") return { kind: "audio", mime: "audio/amr" };
  if (ascii(b, 0, 4) === "FORM" && /^AIF[FC]$/.test(ascii(b, 8, 4))) return { kind: "audio", mime: "audio/aiff" };
  // WebM / Matroska (a browser or WhatsApp-web recording): taken as a sound; a WebM video is heard the same way
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "audio", mime: "audio/webm" };
  // an ID3 tag can sit before AAC as well as MP3: what follows the tag decides
  if (ascii(b, 0, 3) === "ID3") return { kind: "audio", mime: "audio/mpeg" };
  // AAC in ADTS frames (layer bits 00, which MP3 never has)
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { kind: "audio", mime: "audio/aac" };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && ((b[1] >> 1) & 0x3) !== 0) return { kind: "audio", mime: "audio/mpeg" };
  return null;
}

export interface Probe {
  width?: number;
  height?: number;
  durationMs?: number;
  fps?: number;
}

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) * 2 ** 32 + u32(b, o + 4);

interface Box {
  type: string;
  start: number;
  body: number;
  end: number;
}
function* boxes(b: Uint8Array, from: number, to: number): Generator<Box> {
  let o = from;
  while (o + 8 <= to) {
    let size = u32(b, o);
    const type = ascii(b, o + 4, 4);
    let body = o + 8;
    if (size === 1) {
      if (o + 16 > to) return;
      size = u64(b, o + 8);
      body = o + 16;
    } else if (size === 0) size = to - o;
    if (size < 8 || o + size > to) return;
    yield { type, start: o, body, end: o + size };
    o += size;
  }
}
const child = (b: Uint8Array, box: Box, type: string) => {
  for (const c of boxes(b, box.body, box.end)) if (c.type === type) return c;
  return undefined;
};

/** MP4 / MOV: duration (mvhd), the video track's size (tkhd) and frame rate (samples ÷ duration). Needs the whole file. */
export function probeIsoBmff(b: Uint8Array): Probe {
  const moov = [...boxes(b, 0, b.length)].find((x) => x.type === "moov");
  if (!moov) return {};
  const out: Probe = {};
  const mvhd = child(b, moov, "mvhd");
  if (mvhd) {
    const v = b[mvhd.body];
    const scale = v === 1 ? u32(b, mvhd.body + 20) : u32(b, mvhd.body + 12);
    const dur = v === 1 ? u64(b, mvhd.body + 24) : u32(b, mvhd.body + 16);
    if (scale) out.durationMs = Math.round((dur / scale) * 1000);
  }
  for (const trak of boxes(b, moov.body, moov.end)) {
    if (trak.type !== "trak") continue;
    const mdia = child(b, trak, "mdia");
    const hdlr = mdia && child(b, mdia, "hdlr");
    if (!hdlr || ascii(b, hdlr.body + 8, 4) !== "vide") continue;
    const tkhd = child(b, trak, "tkhd");
    if (tkhd) {
      const v = b[tkhd.body];
      const at = tkhd.body + (v === 1 ? 88 : 76);
      out.width = Math.round(u32(b, at) / 65536);
      out.height = Math.round(u32(b, at + 4) / 65536);
    }
    const mdhd = child(b, mdia!, "mdhd");
    const stbl = (() => {
      const minf = child(b, mdia!, "minf");
      return minf && child(b, minf, "stbl");
    })();
    const stsz = stbl && child(b, stbl, "stsz");
    if (mdhd && stsz) {
      const v = b[mdhd.body];
      const scale = v === 1 ? u32(b, mdhd.body + 20) : u32(b, mdhd.body + 12);
      const dur = v === 1 ? u64(b, mdhd.body + 24) : u32(b, mdhd.body + 16);
      const samples = u32(b, stsz.body + 8);
      if (scale && dur) out.fps = Math.round((samples / (dur / scale)) * 100) / 100;
    }
    break;
  }
  return out;
}

/** MP4 / MOV: whether the file has a sound track (a track whose handler is "soun"). Needs the whole file. */
export function hasSoundTrack(b: Uint8Array): boolean {
  const moov = [...boxes(b, 0, b.length)].find((x) => x.type === "moov");
  if (!moov) return false;
  for (const trak of boxes(b, moov.body, moov.end)) {
    if (trak.type !== "trak") continue;
    const mdia = child(b, trak, "mdia");
    const hdlr = mdia && child(b, mdia, "hdlr");
    if (hdlr && ascii(b, hdlr.body + 8, 4) === "soun") return true;
  }
  return false;
}

/** WAV: duration from the data size and byte rate. */
export function probeWav(b: Uint8Array): Probe {
  let o = 12;
  let byteRate = 0;
  while (o + 8 <= b.length) {
    const id = ascii(b, o, 4);
    const size = (b[o + 4] | (b[o + 5] << 8) | (b[o + 6] << 16) | (b[o + 7] << 24)) >>> 0;
    if (id === "fmt ") byteRate = (b[o + 16] | (b[o + 17] << 8) | (b[o + 18] << 16) | (b[o + 19] << 24)) >>> 0;
    if (id === "data") {
      const bytes = Math.min(size, b.length - o - 8);
      return byteRate ? { durationMs: Math.round((bytes / byteRate) * 1000) } : {};
    }
    o += 8 + size + (size & 1);
  }
  return {};
}

const MP3_BITRATES: Record<string, number[]> = {
  // [version][layer] → kbps by index (MPEG-1 / MPEG-2/2.5, layers I–III)
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2-3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** MP3: duration from the Xing/Info frame count when present, otherwise from the bitrate (constant bitrate). */
export function probeMp3(b: Uint8Array): Probe {
  let o = 0;
  if (ascii(b, 0, 3) === "ID3") o = 10 + (((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f));
  for (; o + 4 < b.length && o < 1_000_000; o++) {
    if (b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) continue;
    const ver = (b[o + 1] >> 3) & 3; // 3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5
    const layer = 4 - ((b[o + 1] >> 1) & 3); // 1..3
    const bi = b[o + 2] >> 4;
    const si = (b[o + 2] >> 2) & 3;
    if (ver === 1 || layer === 4 || bi === 0 || bi === 15 || si === 3) continue;
    const kbps = MP3_BITRATES[`${ver === 3 ? 1 : 2}-${layer}`][bi];
    const rate = MP3_RATES[ver][si];
    const spf = layer === 1 ? 384 : layer === 3 && ver !== 3 ? 576 : 1152;
    const mono = b[o + 3] >> 6 === 3;
    const xingAt = o + 4 + (ver === 3 ? (mono ? 17 : 32) : mono ? 9 : 17);
    const tag = ascii(b, xingAt, 4);
    if ((tag === "Xing" || tag === "Info") && b[xingAt + 7] & 1) {
      const frames = u32(b, xingAt + 8);
      return { durationMs: Math.round(((frames * spf) / rate) * 1000) };
    }
    return { durationMs: Math.round((((b.length - o) * 8) / (kbps * 1000)) * 1000) };
  }
  return {};
}

const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/** AAC (ADTS): every frame holds 1024 samples; the frames are counted. */
export function probeAdts(b: Uint8Array): Probe {
  let o = ascii(b, 0, 3) === "ID3" ? 10 + (((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f)) : 0;
  let frames = 0;
  let rate = 0;
  while (o + 7 <= b.length) {
    if (b[o] !== 0xff || (b[o + 1] & 0xf6) !== 0xf0) break;
    rate ||= AAC_RATES[(b[o + 2] >> 2) & 0xf] ?? 0;
    const len = ((b[o + 3] & 3) << 11) | (b[o + 4] << 3) | (b[o + 5] >> 5);
    if (len < 7) break;
    frames++;
    o += len;
  }
  return rate && frames ? { durationMs: Math.round(((frames * 1024) / rate) * 1000) } : {};
}

/** Ogg (Opus / Vorbis): the last page's granule position over the sample rate. */
export function probeOgg(b: Uint8Array): Probe {
  const head = ascii(b, 0, Math.min(b.length, 200));
  let rate = 0;
  if (head.includes("OpusHead")) rate = 48000;
  else {
    const v = head.indexOf("\x01vorbis");
    if (v >= 0) rate = le32(b, v + 12);
  }
  if (!rate) return {};
  for (let o = b.length - 14; o >= 0 && o > b.length - 200_000; o--) {
    if (b[o] !== 0x4f || ascii(b, o, 4) !== "OggS") continue;
    const granule = le32(b, o + 6) + le32(b, o + 10) * 2 ** 32;
    // Opus starts with a pre-skip (usually 312 samples), small enough to leave in
    return granule > 0 && granule < 2 ** 52 ? { durationMs: Math.round((granule / rate) * 1000) } : {};
  }
  return {};
}

/** FLAC: STREAMINFO's total samples over its sample rate. */
export function probeFlac(b: Uint8Array): Probe {
  if (b.length < 26) return {};
  const rate = (b[18] << 12) | (b[19] << 4) | (b[20] >> 4);
  const total = (b[21] & 0x0f) * 2 ** 32 + u32(b, 22);
  return rate && total ? { durationMs: Math.round((total / rate) * 1000) } : {};
}

/** AMR (narrow band): 20 ms frames, each as long as its mode says. */
export function probeAmr(b: Uint8Array): Probe {
  const SIZES = [13, 14, 16, 18, 20, 21, 27, 32, 6, 0, 0, 0, 0, 0, 0, 1];
  let o = 6;
  let frames = 0;
  while (o < b.length) {
    const size = SIZES[(b[o] >> 3) & 0xf];
    if (!size) break;
    frames++;
    o += size;
  }
  return frames ? { durationMs: frames * 20 } : {};
}

/** AIFF: COMM's frame count over its 80-bit sample rate. */
export function probeAiff(b: Uint8Array): Probe {
  let o = 12;
  while (o + 8 <= b.length) {
    const id = ascii(b, o, 4);
    const size = u32(b, o + 4);
    if (id === "COMM") {
      const frames = u32(b, o + 10);
      const exp = (((b[o + 16] & 0x7f) << 8) | b[o + 17]) - 16383;
      const rate = u32(b, o + 18) * 2 ** (exp - 31);
      return rate ? { durationMs: Math.round((frames / rate) * 1000) } : {};
    }
    o += 8 + size + (size & 1);
  }
  return {};
}

/** WebM / Matroska: Segment Info's Duration (float) × TimecodeScale (ns, 1 ms when absent). */
export function probeWebm(b: Uint8Array): Probe {
  const end = Math.min(b.length, 64_000);
  let scale = 1_000_000;
  for (let o = 0; o + 4 < end; o++) {
    if (b[o] === 0x2a && b[o + 1] === 0xd7 && b[o + 2] === 0xb1) {
      const len = b[o + 3] & 0x7f;
      if (len >= 1 && len <= 4) {
        let v = 0;
        for (let i = 0; i < len; i++) v = v * 256 + b[o + 4 + i];
        if (v) scale = v;
      }
    }
    if (b[o] === 0x44 && b[o + 1] === 0x89 && (b[o + 2] === 0x84 || b[o + 2] === 0x88)) {
      const dv = new DataView(b.buffer, b.byteOffset + o + 3, b[o + 2] === 0x84 ? 4 : 8);
      const d = b[o + 2] === 0x84 ? dv.getFloat32(0) : dv.getFloat64(0);
      if (Number.isFinite(d) && d > 0) return { durationMs: Math.round((d * scale) / 1_000_000) };
    }
  }
  return {};
}

/** Dimensions / duration / fps of a sniffed audio or video file. */
export function probe(b: Uint8Array, s: NonNullable<Sniffed>): Probe {
  if (s.kind === "video") return probeIsoBmff(b);
  if (s.mime === "audio/wav") return probeWav(b);
  if (s.mime === "audio/mpeg") return probeMp3(b);
  if (s.mime === "audio/mp4") return probeIsoBmff(b);
  if (s.mime === "audio/aac") return probeAdts(b);
  if (s.mime === "audio/ogg") return probeOgg(b);
  if (s.mime === "audio/flac") return probeFlac(b);
  if (s.mime === "audio/amr") return probeAmr(b);
  if (s.mime === "audio/aiff") return probeAiff(b);
  if (s.mime === "audio/webm") return probeWebm(b);
  return {};
}

/** Every type the studio accepts for upload (each generator narrows it further). */
export const UPLOAD_MIMES: Record<string, "image" | "video" | "audio" | "doc"> = {
  "application/pdf": "doc",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/mp4": "audio",
  "audio/aac": "audio",
  "audio/ogg": "audio",
  "audio/flac": "audio",
  "audio/webm": "audio",
  "audio/amr": "audio",
  "audio/aiff": "audio",
};
export const UPLOAD_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/webm": "webm",
  "audio/amr": "amr",
  "audio/aiff": "aiff",
};
/** The storage limit per file (Supabase Free plan). */
/** A reference file: up to 200 MB (R2 holds it; the server reads it once to check what it is). */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
