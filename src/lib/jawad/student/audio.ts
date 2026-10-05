// «الطالب الذكي» — audio helpers: cutting the reading text into parts at sentence ends, and joining MP3 parts into
// one file (frames only: tags and the per-file Xing/Info header are dropped), then checking the result by walking its
// frames (a real MP3 with audio frames and a duration, not just a file with an .mp3 name).

const MPEG1_L3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_L3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

interface Frame {
  at: number;
  len: number;
  samples: number;
  rate: number;
}

function frameAt(b: Uint8Array, o: number): Frame | null {
  if (o + 4 > b.length || b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null;
  const ver = (b[o + 1] >> 3) & 3;
  const layer = (b[o + 1] >> 1) & 3;
  const bi = b[o + 2] >> 4;
  const si = (b[o + 2] >> 2) & 3;
  const pad = (b[o + 2] >> 1) & 1;
  if (ver === 1 || layer !== 1 || bi === 0 || bi === 15 || si === 3) return null; // Layer III only
  const rate = RATES[ver][si];
  const kbps = (ver === 3 ? MPEG1_L3_KBPS : MPEG2_L3_KBPS)[bi];
  const len = ver === 3 ? Math.floor((144 * kbps * 1000) / rate) + pad : Math.floor((72 * kbps * 1000) / rate) + pad;
  return { at: o, len, samples: ver === 3 ? 1152 : 576, rate };
}

function frames(b: Uint8Array) {
  let o = 0;
  if (b.length > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) o = 10 + (((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f));
  const out: Frame[] = [];
  // find the first frame, then follow frame lengths
  while (o + 4 < b.length && !frameAt(b, o)) o++;
  for (let f = frameAt(b, o); f && f.at + f.len <= b.length; f = frameAt(b, f.at + f.len)) out.push(f);
  return out;
}

const isInfoFrame = (b: Uint8Array, f: Frame) => {
  const s = Buffer.from(b.subarray(f.at, f.at + Math.min(f.len, 64))).toString("latin1");
  return s.includes("Xing") || s.includes("Info");
};

/** Joins MP3 parts (same encoding) into one stream of frames. */
export function joinMp3(parts: Uint8Array[]): Buffer {
  const out: Buffer[] = [];
  for (const p of parts) {
    const fs = frames(p);
    for (const f of fs) {
      if (f === fs[0] && isInfoFrame(p, f)) continue;
      out.push(Buffer.from(p.subarray(f.at, f.at + f.len)));
    }
  }
  return Buffer.concat(out);
}

/** The real check of an MP3: how many audio frames it has and how long it plays. */
export function checkMp3(b: Uint8Array) {
  const fs = frames(b).filter((f, i) => !(i === 0 && isInfoFrame(b, f)));
  const seconds = fs.reduce((s, f) => s + f.samples / f.rate, 0);
  return { frames: fs.length, seconds: Math.round(seconds * 10) / 10, ok: fs.length > 10 && seconds > 0.3 };
}

/** Cuts text into parts of at most `max` characters at sentence ends (then at commas/spaces). Nothing is dropped. */
export function splitForSpeech(text: string, max: number): string[] {
  const clean = text.replace(/\r\n?/g, "\n").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?؟۔\n]+[.!?؟۔]*[\s\n]*/g) ?? [clean];
  const parts: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) parts.push(cur.trim());
    cur = "";
  };
  for (let s of sentences) {
    while (s.length > max) {
      // a sentence longer than a part: cut at the last comma or space before the limit
      const cut = Math.max(s.lastIndexOf("،", max), s.lastIndexOf(",", max), s.lastIndexOf(" ", max));
      const at = cut > max / 2 ? cut + 1 : max;
      if (cur) push();
      parts.push(s.slice(0, at).trim());
      s = s.slice(at);
    }
    if (cur.length + s.length > max) push();
    cur += s;
  }
  push();
  return parts;
}

/** Arabic diacritics (tashkeel). */
export const TASHKEEL = /[ً-ْٰ]/g;
export const stripTashkeel = (s: string) => s.replace(TASHKEEL, "");
