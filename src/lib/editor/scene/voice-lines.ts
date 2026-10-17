// «مختبر الموشن» · «🎙️ بصوتي»: WHEN each line of the person's recording is said, measured by the page from the sound
// itself (no transcription, no other service): the speech is found from the recording's own levels, its phrases are
// the stretches between pauses, and they are matched to the script's lines in order (the closest phrases joined, or
// the longest split, until there is one per line). Pure: samples in, times out.

import { frameLevels } from "@/lib/claude-code/voice-measure";

export interface VoiceLine {
  text: string;
  from: number;
  to: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** The stretches with speech in them, in seconds (pauses shorter than `gap` s don't cut a phrase). */
export function speechSpans(s: Float32Array, rate: number, gap = 0.22): [number, number][] {
  const ms = 20;
  const f = frameLevels(s, rate, ms);
  if (!f.length) return [];
  const sorted = [...f].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const loud = sorted[Math.floor(sorted.length * 0.95)];
  // speech: well above the room, and not far under the loudest of the recording
  const thr = Math.max(floor + 10, loud - 30);
  const spans: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= f.length; i++) {
    const on = i < f.length && f[i] > thr;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      spans.push([(start * ms) / 1000, (i * ms) / 1000]);
      start = -1;
    }
  }
  const merged: [number, number][] = [];
  for (const sp of spans) {
    const last = merged.at(-1);
    if (last && sp[0] - last[1] < gap) last[1] = sp[1];
    else merged.push([...sp]);
  }
  // a click or a breath alone is not a phrase
  return merged.filter(([a, b]) => b - a >= 0.12);
}

/** The phrases matched to `count` lines in order: the nearest phrases joined, or the longest halved, until they fit. */
export function fitSpans(spans: [number, number][], count: number): [number, number][] {
  const out = spans.map((s) => [...s] as [number, number]);
  if (!out.length || count < 1) return out;
  while (out.length > count) {
    let k = 0;
    for (let i = 1; i < out.length - 1; i++) if (out[i + 1][0] - out[i][1] < out[k + 1][0] - out[k][1]) k = i;
    out.splice(k, 2, [out[k][0], out[k + 1][1]]);
  }
  while (out.length < count) {
    let k = 0;
    for (let i = 1; i < out.length; i++) if (out[i][1] - out[i][0] > out[k][1] - out[k][0]) k = i;
    const [a, b] = out[k];
    const m = (a + b) / 2;
    out.splice(k, 1, [a, m], [m, b]);
  }
  return out;
}

/** The script's lines with the time each is said in the recording (or the phrases alone when there is no script). */
export function voiceLines(s: Float32Array, rate: number, script: string[]): VoiceLine[] {
  const spans = speechSpans(s, rate);
  const lines = script.map((t) => t.trim()).filter(Boolean);
  if (!lines.length) return spans.map(([a, b]) => ({ text: "", from: r2(a), to: r2(b) }));
  if (!spans.length) return [];
  return fitSpans(spans, lines.length).map(([a, b], i) => ({ text: lines[i], from: r2(a), to: r2(b) }));
}
