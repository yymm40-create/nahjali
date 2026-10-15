// «Claude Code» for a voice recording — what the page measures of a recording before and after the cleaning program,
// so Claude can judge it (he cannot hear: he reads these numbers and looks at the waveform picture). The same frame
// levels as the sandbox kit's K.A (src/lib/claude-code/compute.ts). Pure: arrays in, numbers out.

export interface VoiceStats {
  seconds: number;
  /** time with clear speech in it */
  speechSeconds: number;
  /** pauses of ≥ 0.6 s and the longest one */
  longPauses: number;
  longestPauseMs: number;
  /** silence before the first word and after the last */
  leadMs: number;
  tailMs: number;
  peakDb: number;
  speechDb: number;
  noiseFloorDb: number;
  /** speech level minus the room: how clean the voice stands */
  snrDb: number;
  /** share of samples at or past ±0.99 */
  clippedPct: number;
  humHz: 0 | 50 | 60;
  dc: number;
}

const db = (x: number) => (x > 1e-9 ? 20 * Math.log10(x) : -180);
const r1 = (x: number) => Math.round(x * 10) / 10;

export function frameLevels(s: Float32Array, rate: number, ms = 10): number[] {
  const n = Math.max(1, Math.round((rate * ms) / 1000));
  const out: number[] = [];
  for (let i = 0; i < s.length; i += n) {
    let e = 0;
    const m = Math.min(s.length, i + n);
    for (let j = i; j < m; j++) e += s[j] * s[j];
    out.push(db(Math.sqrt(e / Math.max(1, m - i))));
  }
  return out;
}

const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : -180;
};

function goertzel(s: Float32Array, rate: number, hz: number) {
  const n = Math.min(s.length, rate * 8);
  const k = 2 * Math.cos((2 * Math.PI * hz) / rate);
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const c = s[i] + k * a - b;
    b = a;
    a = c;
  }
  return (a * a + b * b - k * a * b) / Math.max(1, n);
}

export function voiceStats(s: Float32Array, rate: number): VoiceStats {
  const f = frameLevels(s, rate, 10);
  const floor = pct(f, 0.1);
  const speech = f.map((d) => d > floor + 15);
  const loud = f.filter((d, i) => speech[i]);
  const speechDb = loud.length ? 10 * Math.log10(loud.reduce((e, d) => e + 10 ** (d / 10), 0) / loud.length) : pct(f, 0.9);
  const quiet = f.map((d) => d < floor + 8);
  let longPauses = 0, longest = 0, run = 0;
  const first = speech.indexOf(true), last = speech.lastIndexOf(true);
  for (let i = Math.max(0, first); i <= last && first >= 0; i++) {
    if (quiet[i]) run++;
    else {
      if (run * 10 >= 600) longPauses++;
      longest = Math.max(longest, run * 10);
      run = 0;
    }
  }
  let peak = 0, clipped = 0, sum = 0;
  for (let i = 0; i < s.length; i++) {
    const v = Math.abs(s[i]);
    if (v > peak) peak = v;
    if (v >= 0.99) clipped++;
    sum += s[i];
  }
  const ref = (goertzel(s, rate, 70) + goertzel(s, rate, 85) + goertzel(s, rate, 40)) / 3 || 1e-12;
  const h50 = goertzel(s, rate, 50) + goertzel(s, rate, 100) + goertzel(s, rate, 150);
  const h60 = goertzel(s, rate, 60) + goertzel(s, rate, 120) + goertzel(s, rate, 180);
  return {
    seconds: r1(s.length / rate),
    speechSeconds: r1(loud.length / 100),
    longPauses,
    longestPauseMs: longest,
    leadMs: first < 0 ? Math.round((s.length / rate) * 1000) : first * 10,
    tailMs: last < 0 ? 0 : (f.length - 1 - last) * 10,
    peakDb: r1(db(peak)),
    speechDb: r1(speechDb),
    noiseFloorDb: r1(floor),
    snrDb: r1(speechDb - floor),
    clippedPct: Math.round((clipped / Math.max(1, s.length)) * 10000) / 100,
    humHz: h50 > h60 && h50 > ref * 30 ? 50 : h60 > ref * 30 ? 60 : 0,
    dc: Math.round((sum / Math.max(1, s.length)) * 10000) / 10000,
  };
}

/** The stats as one line for Claude. */
export const statsLine = (v: VoiceStats) =>
  `length ${v.seconds} s (speech ${v.speechSeconds} s) · pauses ≥ 0.6 s: ${v.longPauses} (longest ${v.longestPauseMs} ms) · silence before ${v.leadMs} ms / after ${v.tailMs} ms · speech level ${v.speechDb} dBFS · peak ${v.peakDb} dBFS · room/noise floor ${v.noiseFloorDb} dBFS (voice ${v.snrDb} dB above it) · clipped ${v.clippedPct}% · mains hum ${v.humHz ? `${v.humHz} Hz` : "none"} · DC ${v.dc}`;
