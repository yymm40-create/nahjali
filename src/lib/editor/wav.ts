// Plain WAV files read into samples and mixed back into one (for the separated parts of a clip's sound).

export interface Pcm {
  rate: number;
  /** one Float32Array per channel, -1..1 */
  channels: Float32Array[];
}

/** A WAV file's samples (16/24/32-bit PCM or 32-bit float). Throws on anything else. */
export function parseWav(buf: Buffer): Pcm {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAV file");
  let at = 12;
  let fmt: { format: number; ch: number; rate: number; bits: number } | null = null;
  while (at + 8 <= buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    let size = buf.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === "fmt ") {
      let format = buf.readUInt16LE(body);
      // WAVE_FORMAT_EXTENSIBLE: the real format is the sub-format GUID's first two bytes
      if (format === 0xfffe && size >= 26) format = buf.readUInt16LE(body + 24);
      fmt = { format, ch: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (id === "data") {
      if (!fmt) throw new Error("WAV data before its format");
      // streamed WAVs may say 0 or more than there is
      if (size === 0 || body + size > buf.length) size = buf.length - body;
      const step = fmt.bits / 8;
      const frames = Math.floor(size / (step * fmt.ch));
      const channels = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
      const read =
        fmt.format === 3 && fmt.bits === 32
          ? (o: number) => buf.readFloatLE(o)
          : fmt.format === 1 && fmt.bits === 16
            ? (o: number) => buf.readInt16LE(o) / 0x8000
            : fmt.format === 1 && fmt.bits === 24
              ? (o: number) => buf.readIntLE(o, 3) / 0x800000
              : fmt.format === 1 && fmt.bits === 32
                ? (o: number) => buf.readInt32LE(o) / 0x80000000
                : null;
      if (!read) throw new Error(`WAV format ${fmt.format}/${fmt.bits} not supported`);
      for (let i = 0, o = body; i < frames; i++) for (let c = 0; c < fmt.ch; c++, o += step) channels[c][i] = read(o);
      return { rate: fmt.rate, channels };
    }
    at = body + size + (size % 2);
  }
  throw new Error("WAV without data");
}

/** One channel of `p` at `rate` (linear), taken as `c` of `ch` channels (mono spread, more folded). */
function channelAt(p: Pcm, c: number, ch: number, rate: number): Float32Array {
  const src = p.channels.length === ch ? p.channels[c] : p.channels.length === 1 ? p.channels[0] : mixdown(p.channels);
  if (p.rate === rate) return src;
  const n = Math.round((src.length * rate) / p.rate);
  const out = new Float32Array(n);
  const k = p.rate / rate;
  for (let i = 0; i < n; i++) {
    const x = i * k;
    const j = Math.floor(x);
    const f = x - j;
    out[i] = (src[j] ?? 0) * (1 - f) + (src[j + 1] ?? src[j] ?? 0) * f;
  }
  return out;
}

const mixdown = (chs: Float32Array[]) => {
  const out = new Float32Array(chs[0].length);
  for (const d of chs) for (let i = 0; i < out.length; i++) out[i] += d[i] / chs.length;
  return out;
};

/** The sounds played together, as one 16-bit WAV at the first one's rate and channels (two at most). */
export function mixWavs(parts: Pcm[]): Buffer {
  const rate = parts[0].rate;
  const ch = Math.min(2, Math.max(...parts.map((p) => p.channels.length)));
  const chans = Array.from({ length: ch }, (_, c) => parts.map((p) => channelAt(p, c, ch, rate)));
  const n = Math.max(...chans[0].map((d) => d.length));
  return toWav(
    rate,
    chans.map((list) => {
      const out = new Float32Array(n);
      for (const d of list) for (let i = 0; i < d.length; i++) out[i] += d[i];
      return out;
    }),
  );
}

/** Samples as a 16-bit PCM WAV file. */
export function toWav(rate: number, channels: Float32Array[]): Buffer {
  const ch = channels.length;
  const n = channels[0]?.length ?? 0;
  const b = Buffer.alloc(44 + n * ch * 2);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(36 + n * ch * 2, 4);
  b.write("WAVEfmt ", 8, "ascii");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * ch * 2, 28);
  b.writeUInt16LE(ch * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "ascii");
  b.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (const d of channels) {
      const x = Math.max(-1, Math.min(1, d[i]));
      b.writeInt16LE(Math.round(x < 0 ? x * 0x8000 : x * 0x7fff), o);
      o += 2;
    }
  return b;
}
