// «الرضا فويس» — writes a WAV file (16-bit, 24-bit or 32-bit float) and the waveform's outline for drawing.

export type WavDepth = 16 | 24 | 32;

export function encodeWav(channels: Float32Array[], sr: number, depth: WavDepth = 24): Blob {
  const nc = channels.length;
  const len = channels[0]?.length ?? 0;
  const bytes = depth / 8;
  const buf = new ArrayBuffer(44 + len * nc * bytes);
  const v = new DataView(buf);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, 36 + len * nc * bytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, depth === 32 ? 3 : 1, true);
  v.setUint16(22, nc, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * nc * bytes, true);
  v.setUint16(32, nc * bytes, true);
  v.setUint16(34, depth, true);
  text(36, "data");
  v.setUint32(40, len * nc * bytes, true);
  let at = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      if (depth === 32) v.setFloat32(at, channels[c][i], true);
      else if (depth === 16) v.setInt16(at, Math.round(s * 32767), true);
      else {
        const n = Math.round(s * 8388607);
        v.setUint8(at, n & 255);
        v.setUint8(at + 1, (n >> 8) & 255);
        v.setUint8(at + 2, (n >> 16) & 255);
      }
      at += bytes;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** The outline of a sound: the lowest and highest sample of every 256, for drawing it at any zoom. */
export interface Peaks {
  block: number;
  min: Float32Array;
  max: Float32Array;
}
export const PEAK_BLOCK = 256;
export function makePeaks(channels: Float32Array[]): Peaks {
  const len = channels[0]?.length ?? 0;
  const n = Math.ceil(len / PEAK_BLOCK);
  const min = new Float32Array(n), max = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    let lo = 1, hi = -1;
    const end = Math.min(len, (b + 1) * PEAK_BLOCK);
    for (const ch of channels) {
      for (let i = b * PEAK_BLOCK; i < end; i++) {
        if (ch[i] < lo) lo = ch[i];
        if (ch[i] > hi) hi = ch[i];
      }
    }
    min[b] = lo > hi ? 0 : lo;
    max[b] = lo > hi ? 0 : hi;
  }
  return { block: PEAK_BLOCK, min, max };
}
