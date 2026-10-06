// «التقطيع الذكي»: where a long video changes shot (a cut to another camera, another place, another scene), from small
// frames sampled across it. Pure: the page samples the frames (scene-detect.ts), this finds the changes.
//
// Each frame becomes a feature: a coarse colour histogram (what is in the picture) and a small brightness grid (where
// it is). A shot change is a jump in both, much bigger than the usual change between neighbouring samples (motion,
// a pan, someone walking past), so the threshold adapts to the clip: a jump has to stand out from its surroundings.

export const FEATURE_GRID = 8;
const BINS = 8; // per channel

/** The feature of one frame (RGBA pixels of a small image). */
export function frameFeature(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Float32Array {
  const hist = new Float32Array(BINS * 3);
  const grid = new Float32Array(FEATURE_GRID * FEATURE_GRID);
  const counts = new Float32Array(FEATURE_GRID * FEATURE_GRID);
  const n = width * height;
  for (let y = 0; y < height; y++) {
    const gy = Math.min(FEATURE_GRID - 1, Math.floor((y / height) * FEATURE_GRID));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      hist[(r * BINS) >> 8]++;
      hist[BINS + ((g * BINS) >> 8)]++;
      hist[2 * BINS + ((b * BINS) >> 8)]++;
      const cell = gy * FEATURE_GRID + Math.min(FEATURE_GRID - 1, Math.floor((x / width) * FEATURE_GRID));
      grid[cell] += 0.299 * r + 0.587 * g + 0.114 * b;
      counts[cell]++;
    }
  }
  const out = new Float32Array(hist.length + grid.length);
  for (let i = 0; i < hist.length; i++) out[i] = hist[i] / n;
  for (let i = 0; i < grid.length; i++) out[hist.length + i] = counts[i] ? grid[i] / counts[i] / 255 : 0;
  return out;
}

/** How different two frames are, 0 (the same) to about 1 (nothing alike). */
export function frameDistance(a: Float32Array, b: Float32Array) {
  const h = BINS * 3;
  let hist = 0;
  for (let i = 0; i < h; i++) hist += Math.abs(a[i] - b[i]);
  hist /= 6; // each channel's histogram differs by at most 2
  let grid = 0;
  for (let i = h; i < a.length; i++) grid += Math.abs(a[i] - b[i]);
  grid /= a.length - h;
  return 0.55 * hist + 0.45 * grid;
}

export type Sensitivity = "low" | "normal" | "high";
const SETTINGS: Record<Sensitivity, { floor: number; ratio: number }> = {
  // only clear changes of camera or place
  low: { floor: 0.22, ratio: 4.5 },
  normal: { floor: 0.15, ratio: 3.2 },
  // also quicker or softer changes
  high: { floor: 0.09, ratio: 2.2 },
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/**
 * The shot changes among frames sampled at `times` (seconds, rising): the moment between the two samples where the
 * picture jumps. A change needs a jump above a floor and well above the clip's usual change around it, and comes at
 * least `minGap` seconds after the previous one (a flash or a glitch is not a new shot).
 */
export function findCuts(times: number[], feats: Float32Array[], sensitivity: Sensitivity = "normal", minGap = 1): { at: number; before: number; after: number; strength: number }[] {
  const { floor, ratio } = SETTINGS[sensitivity];
  const d = feats.slice(1).map((f, i) => frameDistance(feats[i], f));
  const out: { at: number; before: number; after: number; strength: number }[] = [];
  for (let i = 0; i < d.length; i++) {
    // the usual change around it (the jump itself left out)
    const around = [...d.slice(Math.max(0, i - 8), i), ...d.slice(i + 1, i + 9)];
    const usual = Math.max(0.01, median(around));
    if (d[i] < floor || d[i] < usual * ratio) continue;
    // the strongest jump of a short run (a cut spread over two samples)
    if (i > 0 && d[i - 1] > d[i]) continue;
    if (i + 1 < d.length && d[i + 1] > d[i]) continue;
    const at = (times[i] + times[i + 1]) / 2;
    const last = out[out.length - 1];
    if (last && at - last.at < minGap) {
      if (d[i] > last.strength) out[out.length - 1] = { at, before: times[i], after: times[i + 1], strength: d[i] };
      continue;
    }
    out.push({ at, before: times[i], after: times[i + 1], strength: d[i] });
  }
  return out;
}

/** The exact moment of a change, from frames sampled densely between its two samples: just before the biggest jump. */
export function sharpenCut(times: number[], feats: Float32Array[]): number | null {
  let best = -1;
  let at: number | null = null;
  for (let i = 1; i < feats.length; i++) {
    const d = frameDistance(feats[i - 1], feats[i]);
    if (d > best) {
      best = d;
      at = times[i];
    }
  }
  return at;
}

/** Where a clip is cut on the timeline for changes found in its source (seconds), inside the clip and not at its edges. */
export function cutsOnTimeline(clip: { start: number; in: number; out: number; speed: number }, sourceSec: number[], edgeMs = 300) {
  return [...new Set(
    sourceSec
      .map((s) => s * 1000)
      .filter((ms) => ms > clip.in + edgeMs && ms < clip.out - edgeMs)
      .map((ms) => Math.round(clip.start + (ms - clip.in) / (clip.speed || 1))),
  )].sort((a, b) => a - b);
}
