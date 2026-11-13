// «الرضا فويس» — what has already been heard is not heard twice: a clip's pitch track (and the pulses the voice
// tools cut it into) is kept while the studio is open, for the tuner, the key finder and the harmony voices alike.

import { pitchMarks } from "@/lib/ridha/dsp/psola";
import { trackPitch, type PitchTrack } from "@/lib/ridha/dsp/pitch";
import { SR, type Clip } from "@/lib/ridha/model";

export interface Heard {
  mono: Float32Array;
  track: PitchTrack;
  marks: Float64Array;
}
const cache = new Map<string, Heard>();
const keyOf = (c: Clip) => `${c.assetId}:${c.offset.toFixed(4)}:${c.dur.toFixed(4)}`;

export const toMono = (channels: Float32Array[]) => {
  if (channels.length === 1) return channels[0];
  const m = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < m.length; i++) m[i] += ch[i] / channels.length;
  return m;
};

export async function hear(c: Clip, channels: Float32Array[], onProgress?: (p: number) => void): Promise<Heard> {
  const k = keyOf(c);
  const hit = cache.get(k);
  if (hit) return hit;
  const mono = toMono(channels);
  const track = await trackPitch(mono, SR, { onProgress });
  const heard = { mono, track, marks: pitchMarks(mono, track) };
  if (cache.size > 6) cache.delete(cache.keys().next().value!);
  cache.set(k, heard);
  return heard;
}
