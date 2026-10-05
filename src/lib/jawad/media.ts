// «الجواد الذكي!» | JAWAD AI — reads what a file really is from its bytes (never from its name or the browser's
// claim), plus the dimensions / duration the generators' limits need. Pure: runs in the browser (early feedback)
// and on the server (the check that counts). Images' pixel sizes are read with sharp on the server.

export type Sniffed =
  | { kind: "image"; mime: "image/png" | "image/jpeg" | "image/webp" }
  | { kind: "video"; mime: "video/mp4" | "video/quicktime" }
  | { kind: "audio"; mime: "audio/mpeg" | "audio/wav" }
  | null;

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
    // Audio-only MPEG-4 brands are not videos
    if (/^(M4A |M4B |M4P |F4A )$/.test(brand)) return null;
    return { kind: "video", mime: "video/mp4" };
  }
  if (ascii(b, 0, 3) === "ID3") return { kind: "audio", mime: "audio/mpeg" };
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

/** Dimensions / duration / fps of a sniffed audio or video file. */
export function probe(b: Uint8Array, s: NonNullable<Sniffed>): Probe {
  if (s.kind === "video") return probeIsoBmff(b);
  if (s.mime === "audio/wav") return probeWav(b);
  if (s.mime === "audio/mpeg") return probeMp3(b);
  return {};
}

/** Every type the studio accepts for upload (each generator narrows it further). */
export const UPLOAD_MIMES: Record<string, "image" | "video" | "audio"> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
};
export const UPLOAD_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};
/** The storage limit per file (Supabase Free plan). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
