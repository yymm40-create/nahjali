// «الرضا فويس» — «معايرة التأخير», the listening half: beeps were played at known moments and the microphone
// recorded the room; where does each beep arrive in the recording? The distance from when it was played to when it
// is heard is the round trip of that output and that microphone (a few ms on wires, a quarter of a second on
// Bluetooth headphones).

import { biquad, filter } from "./biquad";

export const BEEP_HZ = 2000;

/**
 * The round trip in ms, or null when the beeps were not heard clearly. `startTime` is the clock time of the
 * recording's first sample and `beeps` the clock times the beeps were played at (same clock, seconds); beeps must be
 * at least `gap` seconds apart, which is also the longest delay that can be told.
 */
export function roundTrip(rec: Float32Array, sr: number, startTime: number, beeps: number[], gap: number): number | null {
  // only the beep's own band is looked at, as loudness over time
  const band = filter(rec, biquad("bandpass", sr, BEEP_HZ, 4));
  const env = new Float32Array(rec.length);
  const fall = Math.exp(-1 / (sr * 0.001));
  let e = 0;
  for (let i = 0; i < rec.length; i++) {
    e = Math.max(Math.abs(band[i]), e * fall);
    env[i] = e;
  }
  const noise = Float32Array.from(env).sort()[rec.length >> 1] + 1e-6;
  const delays: number[] = [];
  for (const at of beeps) {
    const from = Math.round((at - startTime) * sr);
    const to = Math.min(rec.length, from + Math.round((gap - 0.01) * sr));
    if (from < 0 || from >= rec.length) continue;
    let top = 0;
    for (let i = from; i < to; i++) if (env[i] > top) top = env[i];
    if (top < noise * 8) continue;
    // the beep arrives where the level first climbs to half of its peak
    let i = from;
    while (i < to && env[i] < top * 0.5) i++;
    delays.push(((i - from) / sr) * 1000);
  }
  if (delays.length < 3) return null;
  delays.sort((p, q) => p - q);
  const mid = delays[delays.length >> 1];
  // the beeps must agree with each other: scattered arrivals are echoes or other sounds, not a measurement
  if (delays.filter((d) => Math.abs(d - mid) < 12).length < 3) return null;
  return Math.round(mid);
}
