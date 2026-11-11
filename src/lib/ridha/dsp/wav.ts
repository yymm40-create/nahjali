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

/**
 * The outline of a sound, exact at every zoom: for each channel, the lowest and highest sample of every block of 32,
 * 256, 2048 and 16384 samples. A pixel column of a drawn wave asks for the true extremes of ALL the samples it
 * covers (rangeOf) — whole blocks are answered from here, the few samples left at the edges are read one by one —
 * so no peak is ever skipped or smeared, whether the column covers ten samples or a minute.
 */
export interface Peaks {
  levels: { block: number; min: Float32Array[]; max: Float32Array[] }[];
}
export const PEAK_BLOCKS = [32, 256, 2048, 16384];

export function makePeaks(channels: Float32Array[]): Peaks {
  const len = channels[0]?.length ?? 0;
  const levels: Peaks["levels"] = [];
  for (let l = 0; l < PEAK_BLOCKS.length; l++) {
    const block = PEAK_BLOCKS[l];
    const n = Math.ceil(len / block);
    const min: Float32Array[] = [], max: Float32Array[] = [];
    for (let c = 0; c < channels.length; c++) {
      const lo = new Float32Array(n), hi = new Float32Array(n);
      if (l === 0) {
        const ch = channels[c];
        for (let b = 0; b < n; b++) {
          let a = Infinity, z = -Infinity;
          const end = Math.min(len, (b + 1) * block);
          for (let i = b * block; i < end; i++) {
            if (ch[i] < a) a = ch[i];
            if (ch[i] > z) z = ch[i];
          }
          lo[b] = a;
          hi[b] = z;
        }
      } else {
        // each coarser level is built from the one under it: eight blocks become one
        const under = levels[l - 1], ratio = block / under.block;
        for (let b = 0; b < n; b++) {
          let a = Infinity, z = -Infinity;
          const end = Math.min(under.min[c].length, (b + 1) * ratio);
          for (let i = b * ratio; i < end; i++) {
            if (under.min[c][i] < a) a = under.min[c][i];
            if (under.max[c][i] > z) z = under.max[c][i];
          }
          lo[b] = a;
          hi[b] = z;
        }
      }
      min.push(lo);
      max.push(hi);
    }
    levels.push({ block, min, max });
  }
  return { levels };
}

/**
 * The exact lowest and highest sample of channel `c` between samples `from` (included) and `to` (excluded), written
 * into `out` as [low, high] ([0, 0] for an empty stretch). Walks the stretch with the biggest aligned blocks that fit.
 */
export function rangeOf(p: Peaks, channels: Float32Array[], c: number, from: number, to: number, out: Float32Array): Float32Array {
  const x = channels[c];
  let lo = Infinity, hi = -Infinity;
  let pos = Math.max(0, Math.floor(from));
  const end = Math.min(x.length, Math.ceil(to));
  while (pos < end) {
    let step = 0;
    for (let l = p.levels.length - 1; l >= 0; l--) {
      const b = p.levels[l].block;
      if (pos % b === 0 && pos + b <= end) {
        const k = pos / b;
        if (p.levels[l].min[c][k] < lo) lo = p.levels[l].min[c][k];
        if (p.levels[l].max[c][k] > hi) hi = p.levels[l].max[c][k];
        step = b;
        break;
      }
    }
    if (!step) {
      if (x[pos] < lo) lo = x[pos];
      if (x[pos] > hi) hi = x[pos];
      step = 1;
    }
    pos += step;
  }
  out[0] = lo <= hi ? lo : 0;
  out[1] = lo <= hi ? hi : 0;
  return out;
}

/**
 * A wave drawn exactly into a rectangle of DEVICE pixels: column by column the true extremes of the samples it
 * covers; and once a sample is wider than a pixel, the samples themselves, joined by a line and (wider still)
 * marked with dots. `level(t)` is the gain at each second of the sound (the clip's level and fades), so the picture
 * is what is heard. `t0` is the sound's second at the rectangle's left edge and `pxPerSec` in device pixels.
 */
export function drawWave(
  g: CanvasRenderingContext2D,
  p: Peaks,
  channels: Float32Array[],
  c: number,
  sr: number,
  rect: { x: number; y: number; w: number; h: number },
  t0: number,
  pxPerSec: number,
  level: (t: number) => number,
) {
  const mid = rect.y + rect.h / 2, amp = rect.h / 2 - 1;
  const perSample = pxPerSec / sr;
  const x = channels[c];
  const clamp = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);
  if (perSample >= 1) {
    // zoomed past one sample a pixel: the samples themselves
    const first = Math.max(0, Math.floor(t0 * sr) - 1), last = Math.min(x.length - 1, Math.ceil((t0 + rect.w / pxPerSec) * sr) + 1);
    g.beginPath();
    for (let i = first; i <= last; i++) {
      const px = rect.x + (i / sr - t0) * pxPerSec, py = mid - clamp(x[i] * level(i / sr)) * amp;
      if (i === first) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.lineWidth = Math.max(1, Math.min(2, perSample / 3));
    g.stroke();
    if (perSample >= 5) {
      const r = Math.min(3, perSample / 3);
      for (let i = first; i <= last; i++) g.fillRect(rect.x + (i / sr - t0) * pxPerSec - r / 2, mid - clamp(x[i] * level(i / sr)) * amp - r / 2, r, r);
    }
    return;
  }
  const out = new Float32Array(2);
  const x0 = Math.max(0, Math.floor(rect.x)), x1 = Math.ceil(rect.x + rect.w);
  let prevLo = 0, prevHi = 0, has = false;
  for (let px = x0; px < x1; px++) {
    const ta = t0 + (px - rect.x) / pxPerSec, tb = t0 + (px + 1 - rect.x) / pxPerSec;
    if (tb <= 0) continue;
    const i0 = Math.floor(ta * sr), i1 = Math.max(i0 + 1, Math.floor(tb * sr));
    if (i0 >= x.length) break;
    rangeOf(p, channels, c, i0, i1, out);
    const k = level((ta + tb) / 2);
    let lo = clamp(out[0] * k), hi = clamp(out[1] * k);
    // a column joins the one before it: a wave is one line, never a row of separate dashes
    if (has) {
      if (lo > prevHi) lo = prevHi;
      if (hi < prevLo) hi = prevLo;
    }
    prevLo = clamp(out[0] * k);
    prevHi = clamp(out[1] * k);
    has = true;
    const top = Math.round(mid - hi * amp), bot = Math.round(mid - lo * amp);
    g.fillRect(px, top, 1, Math.max(1, bot - top));
  }
}
