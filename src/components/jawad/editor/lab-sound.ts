// «مختبر الموشن» — the piece's SOUND, in the browser: the soundtrack the scene wrote in code (sound(K, S)), the
// library's sounds at the scene's cues, the person's own recorded voice (cleaned by Claude Code), and music when asked,
// mixed into one stereo track (the music ducked under the voice, mastered to −14 LUFS with the true peak under −1.5 dBTP) — heard in the preview
// with the picture and muxed INTO the exported video, so the film comes out with its sound.

import { frameLevels } from "@/lib/claude-code/voice-measure";
import { master } from "@/lib/editor/loudness";

export const MIX_RATE = 48000;

async function decode(ctx: BaseAudioContext, src: Blob | string): Promise<AudioBuffer | null> {
  try {
    const buf = typeof src === "string" ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer();
    return await ctx.decodeAudioData(buf);
  } catch {
    return null;
  }
}

export interface MixIn {
  duration: number;
  /** the scene's own soundtrack (sound(K, S)) */
  synth: { L: Float32Array; R: Float32Array } | null;
  /** the library's sounds at the cues: a link for each */
  cues: { url: string; t: number; vol: number }[];
  /** the person's recorded voice (already cleaned), from the start */
  voice: Blob | null;
  /** or the voice in parts, each from its second (the person's clips one after another) */
  voiceParts?: { blob: Blob; at: number }[];
  /** music made for it (a link), when asked */
  music: string | null;
}

/** Everything mixed into one stereo buffer of the piece's length. */
export async function mixSoundtrack(o: MixIn): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(o.duration * MIX_RATE));
  const ctx = new OfflineAudioContext(2, length, MIX_RATE);
  const play = (buf: AudioBuffer, at: number, gain: number | ((g: GainNode) => void)) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    if (typeof gain === "number") g.gain.value = gain;
    else gain(g);
    src.connect(g).connect(ctx.destination);
    src.start(Math.max(0, at));
  };
  let voice = o.voice ? await decode(ctx, o.voice) : null;
  if (!voice && o.voiceParts?.length) {
    // the parts laid on one track of the piece's length (it leads the mix and the music ducks under it, as one voice)
    const joined = ctx.createBuffer(2, length, MIX_RATE);
    for (const part of o.voiceParts) {
      const b = await decode(ctx, part.blob);
      if (!b) continue;
      const from = Math.round(part.at * MIX_RATE);
      for (let c = 0; c < 2; c++) {
        const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
        const n = Math.min(src.length, length - from);
        if (n > 0) joined.getChannelData(c).set(src.subarray(0, n), from);
      }
    }
    voice = joined;
  }
  // under a voice the effects and the music step back
  const under = voice ? 0.6 : 1;
  if (o.synth) {
    const b = ctx.createBuffer(2, o.synth.L.length, MIX_RATE);
    b.copyToChannel(o.synth.L as Float32Array<ArrayBuffer>, 0);
    b.copyToChannel(o.synth.R as Float32Array<ArrayBuffer>, 1);
    play(b, 0, 0.9 * under);
  }
  const files = new Map<string, AudioBuffer | null>();
  for (const c of o.cues) {
    if (!files.has(c.url)) files.set(c.url, await decode(ctx, c.url));
    const b = files.get(c.url);
    if (b) play(b, c.t, c.vol * 0.85 * under);
  }
  if (voice) play(voice, 0, 1);
  if (o.music) {
    const m = await decode(ctx, o.music);
    if (m) {
      const base = voice ? 0.4 : 0.55;
      play(m, 0, (g) => {
        g.gain.value = base;
        if (!voice) return;
        // ducked while the voice speaks (its level every 100 ms), back up in the gaps
        const mono = voice.getChannelData(0);
        const lv = frameLevels(mono, voice.sampleRate, 100);
        const loud = [...lv].sort((a, b) => a - b)[Math.floor(lv.length * 0.95)] ?? -20;
        lv.forEach((db, i) => g.gain.setTargetAtTime(db > loud - 24 ? base * 0.3 : base, i / 10, 0.08));
      });
    }
  }
  const out = await ctx.startRendering();
  // mastered like a reel: −14 LUFS, true peak under −1.5 dBTP (the channels are changed in place)
  master(Array.from({ length: out.numberOfChannels }, (_, c) => out.getChannelData(c)), out.sampleRate);
  return out;
}

/** The mixed sound played with the preview, from any second. */
export class SoundPreview {
  private ctx: AudioContext | null = null;
  private node: AudioBufferSourceNode | null = null;
  play(buf: AudioBuffer, from: number) {
    this.stop();
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    const n = this.ctx.createBufferSource();
    n.buffer = buf;
    n.loop = true;
    n.connect(this.ctx.destination);
    n.start(0, Math.max(0, Math.min(buf.duration - 0.01, from)));
    this.node = n;
  }
  stop() {
    try {
      this.node?.stop();
    } catch {}
    this.node = null;
  }
  close() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** The mixed sound as a WAV (to keep the voice-and-effects track on its own if wanted). */
export function wavOf(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels, n = buf.length, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, t: string) => [...t].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  data.setUint32(4, 36 + n * ch * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, "data");
  data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) data.setInt16(o, Math.max(-1, Math.min(1, chans[c][i])) * 0x7fff, true);
  return new Blob([data.buffer], { type: "audio/wav" });
}
