// «حيدرة كت» — what the sound of a file looks like: loudness every 10 ms (decoded once in the browser, kept for
// the session), drawn as the timeline's waveforms and used to find the beat of a song.

import { ALL_FORMATS, AudioBufferSink, Input, UrlSource } from "mediabunny";
import { decodeWhole } from "./audio";

export const PEAK_RATE = 100; // values per second

const cache = new Map<string, Promise<Uint8Array | null>>();
let queue: Promise<unknown> = Promise.resolve();

/** Loudness (0–255) every 10 ms of a file's sound; one file at a time so the page stays smooth. */
export function peaksOf(id: string, url: string | null): Promise<Uint8Array | null> {
  if (!url) return Promise.resolve(null);
  let p = cache.get(id);
  if (!p) {
    p = queue.then(() => decode(url)).catch(() => null);
    queue = p;
    cache.set(id, p);
  }
  return p;
}

async function decode(url: string) {
  const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack().catch(() => null);
    if (!track || !(await track.canDecode().catch(() => false))) return fromWhole(url);
    const dur = await input.computeDuration();
    const out = new Uint8Array(Math.max(1, Math.ceil(dur * PEAK_RATE)));
    for await (const wb of new AudioBufferSink(track).buffers()) {
      const b = wb.buffer;
      const per = b.sampleRate / PEAK_RATE;
      const chs = Array.from({ length: Math.min(2, b.numberOfChannels) }, (_, i) => b.getChannelData(i));
      const base = wb.timestamp * PEAK_RATE;
      for (let i = 0; i < b.length; i += 4) {
        const k = Math.floor(base + i / per);
        if (k < 0 || k >= out.length) continue;
        let v = 0;
        for (const ch of chs) v = Math.max(v, Math.abs(ch[i]));
        const q = Math.min(255, Math.round(v * 255));
        if (q > out[k]) out[k] = q;
      }
    }
    return out;
  } finally {
    input.dispose();
  }
}

/** The same from the Web Audio API (browsers whose WebCodecs can't read this sound). */
async function fromWhole(url: string) {
  const b = await decodeWhole(url).catch(() => null);
  if (!b) return null;
  const out = new Uint8Array(Math.max(1, Math.ceil(b.duration * PEAK_RATE)));
  const per = b.sampleRate / PEAK_RATE;
  const chs = Array.from({ length: Math.min(2, b.numberOfChannels) }, (_, i) => b.getChannelData(i));
  for (let i = 0; i < b.length; i += 4) {
    const k = Math.floor(i / per);
    let v = 0;
    for (const ch of chs) v = Math.max(v, Math.abs(ch[i]));
    const q = Math.min(255, Math.round(v * 255));
    if (q > out[k]) out[k] = q;
  }
  return out;
}

const images = new Map<string, string>();

/** The whole file's waveform as a picture (stretched under each clip by the timeline). */
export function waveImage(id: string, peaks: Uint8Array, color = "rgba(255,255,255,0.75)") {
  const had = images.get(id);
  if (had) return had;
  const w = Math.min(peaks.length, 8000);
  const h = 48;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  const per = peaks.length / w;
  for (let x = 0; x < w; x++) {
    let v = 0;
    const k0 = Math.floor(x * per);
    const k1 = Math.max(k0 + 1, Math.floor((x + 1) * per));
    for (let k = k0; k < k1; k++) v = Math.max(v, peaks[k] ?? 0);
    // a gentle curve so quiet speech still shows
    const bar = Math.max(1, Math.sqrt(v / 255) * h * 0.95);
    g.fillRect(x, (h - bar) / 2, 1, bar);
  }
  const url = c.toDataURL("image/png");
  images.set(id, url);
  return url;
}

/**
 * The beat of the sound between `fromMs` and `toMs` (source time): its tempo and every beat's moment. Onsets (sudden
 * rises in loudness) are matched against tempos from 70 to 180 per minute; the best tempo's best phase gives the grid.
 */
export function detectBeats(peaks: Uint8Array, fromMs: number, toMs: number) {
  const a = Math.max(1, Math.floor((fromMs / 1000) * PEAK_RATE));
  const b = Math.min(peaks.length, Math.ceil((toMs / 1000) * PEAK_RATE));
  if (b - a < PEAK_RATE * 4) return null;
  const onset = new Float32Array(b - a);
  for (let i = a; i < b; i++) onset[i - a] = Math.max(0, peaks[i] - peaks[i - 1]);
  // a light smoothing
  for (let i = onset.length - 1; i > 1; i--) onset[i] = (onset[i] + onset[i - 1] * 0.5 + onset[i - 2] * 0.25) / 1.75;
  const minLag = Math.floor((60 / 180) * PEAK_RATE);
  const maxLag = Math.ceil((60 / 70) * PEAK_RATE);
  const scores = new Float64Array(maxLag + 2);
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let sc = 0;
    for (let i = lag; i < onset.length; i++) sc += onset[i] * onset[i - lag];
    // a slight preference for the common 90–130 range
    const bpm = (60 * PEAK_RATE) / lag;
    scores[lag] = sc * (1 + 0.1 * Math.exp(-(((bpm - 110) / 40) ** 2)));
    if (lag <= maxLag && scores[lag] > scores[bestLag]) bestLag = lag;
  }
  if (!bestLag || scores[bestLag] <= 0) return null;
  // a comb of teeth every `period` steps: the best phase and how much of the onsets it catches
  const comb = (period: number) => {
    let best = { phase: 0, score: -1 };
    for (let ph = 0; ph < period; ph += 0.5) {
      let sc = 0;
      for (let x = ph; x < onset.length; x += period) sc += onset[Math.round(x)] ?? 0;
      if (sc > best.score) best = { phase: ph, score: sc };
    }
    return best;
  };
  // the exact tempo between whole steps (a long song stays on beat)
  let period = bestLag;
  let fit = comb(period);
  for (let p = bestLag - 0.6; p <= bestLag + 0.6; p += 0.02) {
    const c = comb(p);
    if (c.score > fit.score) {
      fit = c;
      period = p;
    }
  }
  // twice as fast when the extra teeth land on beats too (a fast song otherwise reads as half its tempo)
  if (period / 2 >= (60 / 200) * PEAK_RATE) {
    const half = comb(period / 2);
    if (half.score > fit.score * 1.5) {
      period /= 2;
      fit = half;
    }
  }
  const beats: number[] = [];
  for (let x = fit.phase; x < onset.length; x += period) beats.push(Math.round(((a + x) / PEAK_RATE) * 1000));
  return { bpm: Math.round((60 * PEAK_RATE) / period), beats };
}
