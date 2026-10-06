// «حيدر كات» — a clip's sound work, done once in this browser and kept for the preview and the export alike:
// noise taken out (RNNoise, on the device), the voice's pitch moved without changing its length, then the voice
// enhancer and the effect as Web Audio nodes rendered offline (so an echo or a hall rings the same everywhere).

import { hasSoundFx, type Clip, type SoundFx } from "@/lib/editor/model";
import { decodeWhole } from "./audio";
import { stretch } from "./stretch";

export const RATE = 48000;
/** RNNoise hands each frame back two frames (20 ms) later; the output is moved back by that much. */
const RN_DELAY = 960;
/** Longer clips are left as recorded (the work is kept in memory). */
export const FX_MAX_MS = 20 * 60_000;

interface Denoiser {
  frameSize: number;
  createDenoiseState(): { processFrame(f: Float32Array): number; destroy(): void };
}
let rn: Promise<Denoiser> | null = null;
const loadRn = () => (rn ??= import("@shiguredo/rnnoise-wasm").then((m) => m.Rnnoise.load() as Promise<Denoiser>));

const breathe = () => new Promise((r) => setTimeout(r, 0));

/** Noise taken out of a 48 kHz mono sound; `amount` 0–1 blends with the original (1 = all cleaned). */
export async function denoise(x: Float32Array, amount: number, load: () => Promise<Denoiser> = loadRn) {
  const r = await load();
  const N = r.frameSize;
  const st = r.createDenoiseState();
  const out = new Float32Array(x.length);
  const f = new Float32Array(N);
  try {
    for (let i = 0, n = 0; i < x.length + RN_DELAY; i += N, n++) {
      for (let j = 0; j < N; j++) f[j] = i + j < x.length ? x[i + j] * 32768 : 0;
      st.processFrame(f);
      for (let j = 0; j < N; j++) {
        const k = i + j - RN_DELAY;
        if (k >= 0 && k < x.length) out[k] = amount * (f[j] / 32768) + (1 - amount) * x[k];
      }
      // the page stays responsive on long clips
      if (n % 1500 === 1499) await breathe();
    }
  } finally {
    st.destroy();
  }
  return out;
}

/** The voice higher or lower by `semis` semitones, the same length (stretched, then played faster or slower). */
export function shiftPitch(x: Float32Array, semis: number) {
  if (!semis) return x;
  const r = 2 ** (semis / 12);
  const longer = stretch([x], 0, 1 / r, Math.round(x.length * r))[0];
  const out = new Float32Array(x.length);
  for (let i = 0; i < out.length; i++) {
    const p = i * r;
    const k = Math.floor(p);
    const t = p - k;
    out[i] = (longer[k] ?? 0) * (1 - t) + (longer[k + 1] ?? 0) * t;
  }
  return out;
}

/** A tiny repeatable random (the same hall every time, in the preview and the file). */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A room's echo pattern: decaying noise, a little different in each ear. */
function impulse(ctx: BaseAudioContext, seconds: number, decay: number, preDelay = 0) {
  const len = Math.round((seconds + preDelay) * ctx.sampleRate);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  const skip = Math.round(preDelay * ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const rand = seeded(1234 + ch * 77);
    const d = ir.getChannelData(ch);
    for (let i = skip; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - (i - skip) / (len - skip), decay);
  }
  return ir;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7, gain = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

function shaper(ctx: BaseAudioContext, curve: (x: number) => number) {
  const s = ctx.createWaveShaper();
  const c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) c[i] = curve((i / (c.length - 1)) * 2 - 1);
  s.curve = c;
  return s;
}

function gainNode(ctx: BaseAudioContext, v: number) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

/** An echo: a delay fed back into itself, a little darker each time. */
function echoLoop(ctx: BaseAudioContext, from: AudioNode, to: AudioNode, seconds: number, feedback: number) {
  const d = ctx.createDelay(2);
  d.delayTime.value = seconds;
  const fb = gainNode(ctx, feedback);
  const dark = filter(ctx, "lowpass", 4000);
  from.connect(d);
  d.connect(dark).connect(fb).connect(d);
  d.connect(to);
}

/** Chains `nodes` from `from` and returns the last. */
function chain(from: AudioNode, ...nodes: AudioNode[]) {
  let n = from;
  for (const x of nodes) n = n.connect(x);
  return n;
}

/** The effect's nodes between `input` and `output` (wet only). Oscillators start at 0 (offline rendering). */
function effect(ctx: BaseAudioContext, kind: NonNullable<SoundFx["effect"]>, input: AudioNode, output: AudioNode) {
  switch (kind) {
    case "echo":
      echoLoop(ctx, input, output, 0.3, 0.4);
      break;
    case "reverb": {
      const c = ctx.createConvolver();
      c.buffer = impulse(ctx, 1.5, 3, 0.02);
      chain(input, c, output);
      break;
    }
    case "stadium": {
      const c = ctx.createConvolver();
      c.buffer = impulse(ctx, 4, 2, 0.06);
      chain(input, c, output);
      const slap = ctx.createDelay(1);
      slap.delayTime.value = 0.12;
      chain(input, slap, gainNode(ctx, 0.3), output);
      break;
    }
    case "cave": {
      const c = ctx.createConvolver();
      c.buffer = impulse(ctx, 3, 1.5, 0.03);
      chain(input, c, filter(ctx, "lowpass", 3000), output);
      echoLoop(ctx, input, output, 0.25, 0.3);
      break;
    }
    case "radio": {
      const comp = ctx.createDynamicsCompressor();
      comp.ratio.value = 8;
      comp.threshold.value = -30;
      chain(input, filter(ctx, "highpass", 500), filter(ctx, "lowpass", 3500, 1), shaper(ctx, (x) => Math.tanh(3 * x)), comp, gainNode(ctx, 0.9), output);
      break;
    }
    case "phone":
      chain(input, filter(ctx, "highpass", 300), filter(ctx, "highpass", 300), filter(ctx, "lowpass", 3400), filter(ctx, "lowpass", 3400), shaper(ctx, (x) => Math.tanh(1.5 * x)), gainNode(ctx, 1.2), output);
      break;
    case "megaphone": {
      const k = 50;
      const out = chain(input, filter(ctx, "highpass", 800), filter(ctx, "peaking", 2000, 1.5, 8), filter(ctx, "lowpass", 4000), shaper(ctx, (x) => ((1 + k) * x) / (1 + k * Math.abs(x))), gainNode(ctx, 0.5));
      out.connect(output);
      const d = ctx.createDelay(1);
      d.delayTime.value = 0.015;
      chain(out, d, gainNode(ctx, 0.2), output);
      break;
    }
    case "underwater": {
      const lp = filter(ctx, "lowpass", 500, 4);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.5;
      const depth = gainNode(ctx, 150);
      lfo.connect(depth).connect(lp.frequency);
      lfo.start(0);
      chain(input, lp, gainNode(ctx, 1.4), output);
      break;
    }
    case "robot": {
      const ring = gainNode(ctx, 0);
      const osc = ctx.createOscillator();
      osc.frequency.value = 50;
      osc.connect(ring.gain);
      osc.start(0);
      const mixed = chain(input, ring, gainNode(ctx, 1.6));
      mixed.connect(output);
      // a short metallic comb
      const d = ctx.createDelay(1);
      d.delayTime.value = 0.01;
      const fb = gainNode(ctx, 0.6);
      mixed.connect(d);
      d.connect(fb).connect(d);
      chain(d, gainNode(ctx, 0.4), output);
      break;
    }
  }
}

/** The voice enhancer and the effect, from `input` to `output` (dry/wet by the clip's mix). */
export function soundChain(ctx: BaseAudioContext, fx: SoundFx, input: AudioNode, output: AudioNode) {
  let node: AudioNode = input;
  if (fx.enhance) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.15;
    // rumble out, less mud, more presence, softer «s», evened out and brought back up
    node = chain(node, filter(ctx, "highpass", 80), filter(ctx, "peaking", 300, 0.9, -3), filter(ctx, "peaking", 3000, 0.9, 3), filter(ctx, "peaking", 6500, 2, -4), comp, gainNode(ctx, 1.5));
  }
  if (!fx.effect) {
    node.connect(output);
    return;
  }
  node.connect(gainNode(ctx, 1 - fx.mix)).connect(output);
  const wet = gainNode(ctx, fx.mix);
  wet.connect(output);
  effect(ctx, fx.effect, node, wet);
}

const cache = new Map<string, Promise<AudioBuffer>>();
const KEEP = 8;
export const soundKey = (url: string, c: Pick<Clip, "in" | "out" | "sound">) => JSON.stringify([url, c.in, c.out, c.sound]);

/**
 * The clip's worked sound for its part of the file (`in` to `out`, source time), 48 kHz stereo. Kept for the
 * session: the preview and the export use the same one.
 */
export function clipSound(url: string, c: Pick<Clip, "in" | "out" | "sound">): Promise<AudioBuffer> {
  const key = soundKey(url, c);
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const fx = c.sound;
      if (!fx || !hasSoundFx(c)) throw new Error("no sound work");
      if (c.out - c.in > FX_MAX_MS) throw new Error("too long");
      const whole = await decodeWhole(url);
      const a = Math.max(0, Math.floor((c.in / 1000) * whole.sampleRate));
      const b = Math.min(whole.length, Math.ceil((c.out / 1000) * whole.sampleRate));
      if (b <= a) throw new Error("empty");
      const chans = Array.from({ length: Math.min(2, whole.numberOfChannels) }, (_, i) => whole.getChannelData(i).subarray(a, b));
      let parts: Float32Array[];
      if (fx.clean > 0 || fx.pitch) {
        // the voice work is on one channel (a voice is one source)
        let m = new Float32Array(b - a);
        for (const ch of chans) for (let i = 0; i < m.length; i++) m[i] += ch[i] / chans.length;
        if (fx.clean > 0) m = await denoise(m, fx.clean);
        if (fx.pitch) m = shiftPitch(m, fx.pitch) as Float32Array<ArrayBuffer>;
        parts = [m];
      } else parts = chans;
      const ctx = new OfflineAudioContext(2, b - a, whole.sampleRate);
      const buf = ctx.createBuffer(parts.length, b - a, whole.sampleRate);
      parts.forEach((d, i) => buf.copyToChannel(d as Float32Array<ArrayBuffer>, i));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      soundChain(ctx, fx, src, ctx.destination);
      src.start(0);
      return ctx.startRendering();
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    while (cache.size > KEEP) cache.delete(cache.keys().next().value!);
  }
  return p;
}
