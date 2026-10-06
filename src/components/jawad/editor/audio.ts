// «الممنتج الذكي» — sound a browser's WebCodecs can't read (Safari on iPhone and AAC, for one) is decoded whole by the
// Web Audio API instead, which every browser can. Kept per file for the session (a few files at most).

const cache = new Map<string, Promise<AudioBuffer>>();
const KEEP = 10;

/** The whole sound of a file at 48 kHz (its own channels). */
export function decodeWhole(url: string): Promise<AudioBuffer> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("تعذّر تحميل الملف.");
      const data = await r.arrayBuffer();
      const ctx = new OfflineAudioContext(1, 1, 48000);
      return await ctx.decodeAudioData(data);
    })();
    p.catch(() => cache.delete(url));
    cache.set(url, p);
    while (cache.size > KEEP) cache.delete(cache.keys().next().value!);
  }
  return p;
}

/** `[from, to)` seconds of a decoded sound, mixed to mono at `rate`. */
export async function sliceMono(buf: AudioBuffer, from: number, to: number, rate: number) {
  const len = Math.max(1, Math.round((to - from) * rate));
  const ctx = new OfflineAudioContext(1, len, rate);
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.connect(ctx.destination);
  node.start(0, Math.max(0, from), Math.max(0, to - from));
  return ctx.startRendering();
}

/** A WAV file (16-bit, the file's own channels up to two) of `[fromMs, toMs)` of a file's sound: «احفظ الصوت». */
export async function soundFile(url: string, fromMs: number, toMs: number) {
  const buf = await decodeWhole(url);
  const rate = buf.sampleRate;
  const a = Math.max(0, Math.floor((fromMs / 1000) * rate));
  const b = Math.min(buf.length, Math.ceil((toMs / 1000) * rate));
  const n = Math.max(0, b - a);
  const chans = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i));
  const ch = chans.length;
  const v = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + n * ch * 2, true);
  text(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = a; i < b; i++)
    for (const d of chans) {
      const x = Math.max(-1, Math.min(1, d[i]));
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
      o += 2;
    }
  return new Blob([v.buffer], { type: "audio/wav" });
}
