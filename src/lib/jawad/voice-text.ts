// «صوت الجواد» — pure helpers of JAWAD's own voice engine: a text cut into pieces a speech model takes at once
// (at sentence ends, never inside a word), and the pieces' WAV files joined back into one. No I/O; tested.

/** Where Arabic and Latin sentences end (the mark stays with its sentence). */
const SENTENCE_END = /(?<=[.!?؟؛،,:…\n])\s+/u;

/**
 * `text` as pieces of at most `max` characters: whole sentences first; a sentence longer than `max` is cut at its
 * last space before the limit (a single word longer than `max` is cut hard). Empty pieces are dropped.
 */
export function splitForSpeech(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = "";
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split(SENTENCE_END)) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > max) {
      push();
      // a long sentence: words up to the limit, then the rest
      let rest = s;
      while (rest.length > max) {
        const cut = rest.lastIndexOf(" ", max);
        const at = cut > max * 0.4 ? cut : max;
        out.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      cur = rest;
      continue;
    }
    if ((cur + " " + s).trim().length > max) push();
    cur = cur ? `${cur} ${s}` : s;
  }
  push();
  return out;
}

/** The PCM part of a 16-bit WAV (and its format), or null when it isn't one. */
export function readWav(buf: Uint8Array): { rate: number; channels: number; bits: number; data: Uint8Array } | null {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (at: number) => String.fromCharCode(buf[at], buf[at + 1], buf[at + 2], buf[at + 3]);
  if (buf.length < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let at = 12;
  let fmt: { rate: number; channels: number; bits: number } | null = null;
  while (at + 8 <= buf.length) {
    const id = tag(at);
    const size = v.getUint32(at + 4, true);
    if (id === "fmt ") fmt = { channels: v.getUint16(at + 10, true), rate: v.getUint32(at + 12, true), bits: v.getUint16(at + 22, true) };
    else if (id === "data" && fmt) return { ...fmt, data: buf.subarray(at + 8, Math.min(buf.length, at + 8 + size)) };
    at += 8 + size + (size % 2);
  }
  return null;
}

/** A 16-bit PCM WAV file from its samples' bytes. */
export function writeWav(data: Uint8Array, rate: number, channels: number, bits = 16): Uint8Array {
  const out = new Uint8Array(44 + data.length);
  const v = new DataView(out.buffer);
  const tag = (at: number, s: string) => [...s].forEach((c, i) => (out[at + i] = c.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 36 + data.length, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, (rate * channels * bits) / 8, true);
  v.setUint16(32, (channels * bits) / 8, true);
  v.setUint16(34, bits, true);
  tag(36, "data");
  v.setUint32(40, data.length, true);
  out.set(data, 44);
  return out;
}

/**
 * Several WAV files (same rate and channels) as one, with `gapMs` of silence between them (a breath between
 * sentences). Throws when a piece isn't a WAV or the formats differ.
 */
export function joinWavs(pieces: Uint8Array[], gapMs = 180): { wav: Uint8Array; durationMs: number } {
  const parsed = pieces.map((p) => {
    const w = readWav(p);
    if (!w) throw new Error("a piece of the speech is not a WAV file");
    return w;
  });
  if (!parsed.length) throw new Error("no speech pieces");
  const { rate, channels, bits } = parsed[0];
  if (parsed.some((w) => w.rate !== rate || w.channels !== channels || w.bits !== bits)) throw new Error("the speech pieces differ in format");
  const frame = (channels * bits) / 8;
  const gap = Math.round((rate * gapMs) / 1000) * frame;
  const total = parsed.reduce((n, w) => n + w.data.length, 0) + gap * (parsed.length - 1);
  const data = new Uint8Array(total);
  let at = 0;
  parsed.forEach((w, i) => {
    data.set(w.data, at);
    at += w.data.length + (i < parsed.length - 1 ? gap : 0);
  });
  return { wav: writeWav(data, rate, channels, bits), durationMs: Math.round((total / frame / rate) * 1000) };
}

/** Habibi's dialect ids and their Arabic names (the licence of each model is noted in the generator). */
export const HABIBI_DIALECTS = [
  { id: "MSA", ar: "فصحى" },
  { id: "SAU", ar: "سعودي" },
  { id: "UAE", ar: "إماراتي" },
  { id: "IRQ", ar: "عراقي" },
  { id: "EGY", ar: "مصري" },
  { id: "LEV", ar: "شامي" },
  { id: "OMN", ar: "عُماني" },
  { id: "ALG", ar: "جزائري" },
  { id: "MAR", ar: "مغربي" },
  { id: "TUN", ar: "تونسي" },
  { id: "SDN", ar: "سوداني" },
  { id: "LBY", ar: "ليبي" },
  { id: "UNK", ar: "يحدّده من العينة" },
] as const;
export type HabibiDialect = (typeof HABIBI_DIALECTS)[number]["id"];
