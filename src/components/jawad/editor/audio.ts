// «الممنتج الذكي» — sound a browser's WebCodecs can't read (Safari on iPhone and AAC, for one) is decoded whole by the
// Web Audio API instead, which every browser can. Kept per file for the session (a few files at most).

const cache = new Map<string, Promise<AudioBuffer>>();
const KEEP = 4;

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
