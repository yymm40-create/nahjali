/**
 * Frames of a video at given times, as JPEG data URLs, taken in the browser. `size` limits the width (or, with
 * `by: "side"`, the longest side); null keeps the video's own size. `onFrame` reports how many are done.
 */
export async function grabFrames(url: string, times: number[], size: number | null, quality: number, o: { by?: "width" | "side"; onFrame?: (done: number) => void } = {}) {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error("load"));
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const out: string[] = [];
  for (const t of times) {
    await new Promise<void>((res, rej) => {
      v.onseeked = () => res();
      v.onerror = () => rej(new Error("seek"));
      v.currentTime = Math.max(0, Math.min(t, v.duration - 0.04));
    });
    const scale = size ? Math.min(1, size / (o.by === "side" ? Math.max(v.videoWidth, v.videoHeight) : v.videoWidth)) : 1;
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    out.push(canvas.toDataURL("image/jpeg", quality));
    o.onFrame?.(out.length);
  }
  v.removeAttribute("src");
  v.load();
  return out;
}

/** WAV (16-bit mono) as a data URL. */
function wavUrl(samples: Float32Array, rate: number) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/**
 * The video's sound in the given ranges (seconds), each as a WAV data URL (mono, 24 kHz), or null when the range is
 * shorter than `minSec` or the video has no sound. For «التعديل الذكي»: the sound right before and after a cut.
 */
export async function grabSounds(url: string, ranges: { from: number; to: number }[], minSec = 2): Promise<(string | null)[]> {
  try {
    const data = await (await fetch(url)).arrayBuffer();
    const AC = window.OfflineAudioContext;
    const decoded = await new AC(1, 1, 24000).decodeAudioData(data);
    return await Promise.all(
      ranges.map(async (r) => {
        const from = Math.max(0, r.from);
        const to = Math.min(decoded.duration, r.to);
        if (to - from < minSec) return null;
        // mixed to mono at 24 kHz
        const ctx = new AC(1, Math.ceil((to - from) * 24000), 24000);
        const src = ctx.createBufferSource();
        src.buffer = decoded;
        src.connect(ctx.destination);
        src.start(0, from, to - from);
        const out = (await ctx.startRendering()).getChannelData(0);
        // silence carries nothing
        if (!out.some((x) => Math.abs(x) > 0.002)) return null;
        return wavUrl(out, 24000);
      }),
    );
  } catch {
    return ranges.map(() => null);
  }
}
