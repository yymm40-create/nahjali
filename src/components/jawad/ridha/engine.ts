// «الرضا فويس» — the sound engine: builds the mixer out of the browser's audio nodes (a strip per track with its
// effects, the two shared buses, the master), plays the timeline, records the microphone raw, meters everything,
// and renders the very same mixer to a file. One builder (Mix) serves the live desk and the offline render, so what
// is heard is what is exported.

import { dbToGain } from "@/lib/ridha/dsp/biquad";
import { BEEP_HZ, roundTrip } from "@/lib/ridha/dsp/latency";
import { makePeaks, type Peaks } from "@/lib/ridha/dsp/wav";
import { audible, barSec, beatSec, projectEnd, SR, uid, type Clip, type EqBand, type Fx, type Project, type Space3D, type Track } from "@/lib/ridha/model";

const WORKLETS = "/ridha/worklets.js";

// ───────── the recordings («assets»): never edited in place, only replaced by a processed copy ─────────

export interface Sound {
  id: string;
  name: string;
  channels: Float32Array[];
  peaks: Peaks;
}
const sounds = new Map<string, Sound>();
const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

export function putSound(channels: Float32Array[], name: string, id: string = uid()): Sound {
  const s: Sound = { id, name, channels, peaks: makePeaks(channels) };
  sounds.set(id, s);
  return s;
}
export const getSound = (id: string) => sounds.get(id) ?? null;
export const soundDur = (id: string) => (sounds.get(id)?.channels[0]?.length ?? 0) / SR;
export const dropSound = (id: string) => void sounds.delete(id);
export const allSoundIds = () => [...sounds.keys()];

function bufferFor(ctx: BaseAudioContext, id: string): AudioBuffer | null {
  const s = sounds.get(id);
  if (!s || !s.channels[0]?.length) return null;
  let map = buffers.get(ctx);
  if (!map) buffers.set(ctx, (map = new Map()));
  let b = map.get(id);
  if (!b) {
    b = ctx.createBuffer(s.channels.length, s.channels[0].length, SR);
    s.channels.forEach((ch, i) => b!.copyToChannel(ch as Float32Array<ArrayBuffer>, i));
    map.set(id, b);
  }
  return b;
}

/** Any audio file the browser can read, as 48 kHz channels. */
export async function decodeFile(file: Blob): Promise<Float32Array[]> {
  const data = await file.arrayBuffer();
  const probe = new OfflineAudioContext(2, 1, SR);
  const buf = await probe.decodeAudioData(data);
  const out: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) out.push(buf.getChannelData(c).slice());
  // two identical channels are one voice: kept as mono (half the memory, and every voice tool works on it)
  if (out.length === 2) {
    let same = true;
    for (let i = 0; i < out[0].length; i += 97) {
      if (Math.abs(out[0][i] - out[1][i]) > 1e-4) {
        same = false;
        break;
      }
    }
    if (same) out.pop();
  }
  return out;
}

// ───────── effects, as units of audio nodes ─────────

interface Unit {
  input: AudioNode;
  output: AudioNode;
  set(fx: Fx): void;
  dispose(): void;
}

const live = (ctx: BaseAudioContext) => ctx.state === "running" && "outputLatency" in ctx;
function setP(ctx: BaseAudioContext, param: AudioParam, v: number) {
  const x = Math.max(param.minValue, Math.min(param.maxValue, v));
  if (live(ctx)) param.setTargetAtTime(x, ctx.currentTime, 0.02);
  else param.value = x;
}

/** One filter node set as one band of the equalizer. A band switched off passes everything. */
export function applyBand(ctx: BaseAudioContext, node: BiquadFilterNode, b: EqBand) {
  if (!b.on) {
    node.type = "peaking";
    setP(ctx, node.gain, 0);
    return;
  }
  node.type = b.type;
  setP(ctx, node.frequency, b.freq);
  setP(ctx, node.gain, b.gain);
  // the browser reads a pass filter's Q in dB and a bell's as a plain number
  setP(ctx, node.Q, b.type === "highpass" || b.type === "lowpass" ? 20 * Math.log10(Math.max(0.1, b.q)) : b.q);
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A room's answer to a clap, drawn in numbers: a few early reflections, then a tail that fades and darkens. */
function impulse(ctx: BaseAudioContext, decay: number, damp: number): AudioBuffer {
  const len = Math.round(SR * Math.min(10, decay * 1.15 + 0.1));
  const buf = ctx.createBuffer(2, len, SR);
  for (let c = 0; c < 2; c++) {
    const rnd = mulberry(c ? 90210 : 1361);
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      // the tail loses its top as it goes: the cutoff falls to a third by the end
      const cut = damp * (1 - 0.65 * Math.min(1, t / decay));
      const a = Math.exp((-2 * Math.PI * cut) / SR);
      lp = a * lp + (1 - a) * (rnd() * 2 - 1);
      const build = Math.min(1, t / 0.012);
      d[i] = lp * build * Math.exp((-6.91 * t) / decay);
    }
    for (let k = 0; k < 7; k++) {
      const at = Math.round(SR * (0.007 + rnd() * 0.07));
      if (at < len) d[at] += (rnd() > 0.5 ? 1 : -1) * 0.5 * (1 - k / 9);
    }
  }
  return buf;
}

/** How much a quiet sound is lifted by a curve, dB (the curve's slope at zero). */
function distLiftDb(type: number, drive: number): number {
  const k = 1 + drive * 24;
  const slope = type === 0 ? (k * 0.5) / Math.tanh(k * 0.5) : type === 1 ? (k * 0.6) / Math.tanh(k * 0.6) : type === 2 ? Math.max(1, k * 0.6) : type === 3 ? k * 1.6 : 1;
  return 20 * Math.log10(slope);
}

function distCurve(type: number, drive: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  const k = 1 + drive * 24;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    let y: number;
    if (type === 0) y = Math.tanh(k * 0.5 * x) / Math.tanh(k * 0.5);
    else if (type === 1) y = x >= 0 ? Math.tanh(k * 0.6 * x) / Math.tanh(k * 0.6) : (Math.tanh(k * 0.38 * x) / Math.tanh(k * 0.38)) * 0.92;
    else if (type === 2) y = Math.max(-1, Math.min(1, x * k * 0.6));
    else if (type === 3) y = Math.sign(x) * (1 - Math.exp(-Math.abs(x) * k * 1.6));
    else {
      const levels = Math.max(3, Math.round(2 ** (7 - 5.5 * drive)));
      y = Math.round(x * levels) / levels;
    }
    curve[i] = y;
  }
  return curve;
}

/**
 * The gain the browser's compressor adds BY ITSELF, in dB. The node lifts its output so that a full-scale input would
 * come out 60% of the way back to full scale (its own «makeup»); with a low threshold that is +10 dB nobody asked
 * for. The same curve the browsers use (threshold, soft knee, ratio) is followed here so it can be taken back off,
 * and the «تعويض» knob means exactly what it says.
 */
export function autoMakeupDb(threshold: number, knee: number, ratio: number): number {
  const lin = (db: number) => 10 ** (db / 20), db = (v: number) => 20 * Math.log10(v);
  const linT = lin(threshold), kneeT = lin(threshold + knee), slope = 1 / ratio;
  const curve = (x: number, k: number) => (x < linT ? x : linT + (1 - Math.exp(-k * (x - linT))) / k);
  let k = 5;
  if (knee > 0) {
    // the knee's bend is the one whose slope at the knee's end equals the ratio's
    let lo = 0.1, hi = 10000;
    for (let i = 0; i < 15; i++) {
      const x = kneeT, x2 = kneeT * 1.001;
      const s = (db(curve(x2, k)) - db(curve(x, k))) / (db(x2) - db(x));
      if (s < slope) hi = k;
      else lo = k;
      k = Math.sqrt(lo * hi);
    }
  }
  const kneeOut = knee > 0 ? db(curve(kneeT, k)) : threshold;
  const full = 1 < kneeT ? db(curve(1, k)) : kneeOut + slope * (0 - (threshold + knee));
  return -full * 0.6;
}

function makeUnit(ctx: BaseAudioContext, fx: Fx): Unit {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const kill: AudioNode[] = [input, output];
  const oscs: OscillatorNode[] = [];
  const osc = (rate: number) => {
    const o = ctx.createOscillator();
    o.frequency.value = rate;
    o.start();
    oscs.push(o);
    kill.push(o);
    return o;
  };
  const gain = (v = 1) => {
    const g = ctx.createGain();
    g.gain.value = v;
    kill.push(g);
    return g;
  };
  /**
   * Dry and wet paths around a wet chain, mixed by `mix`. An echo or a room is a different sound from the dry one, so
   * the two cross at equal power; a coloured copy of the same sound (distortion, chorus, phaser) adds up with it, so
   * those cross in a straight line — otherwise the half-way point would be 3 dB louder than either end.
   */
  const mixer = (same = false) => {
    const dry = gain(), wet = gain();
    input.connect(dry).connect(output);
    wet.connect(output);
    return {
      wet,
      set(m: number) {
        setP(ctx, dry.gain, same ? 1 - m : Math.cos((m * Math.PI) / 2));
        setP(ctx, wet.gain, same ? m : Math.sin((m * Math.PI) / 2));
      },
    };
  };
  let set: (fx: Fx) => void;

  switch (fx.kind) {
    case "eq": {
      const nodes = (fx.bands ?? []).map(() => ctx.createBiquadFilter());
      kill.push(...nodes);
      let prev: AudioNode = input;
      for (const n of nodes) prev = prev.connect(n);
      prev.connect(output);
      set = (f) => f.bands?.forEach((b, i) => nodes[i] && applyBand(ctx, nodes[i], b));
      break;
    }
    case "comp": {
      const c = ctx.createDynamicsCompressor();
      const make = gain();
      kill.push(c);
      input.connect(c).connect(make).connect(output);
      set = (f) => {
        setP(ctx, c.threshold, f.p.threshold);
        setP(ctx, c.ratio, f.p.ratio);
        setP(ctx, c.attack, f.p.attack / 1000);
        setP(ctx, c.release, f.p.release / 1000);
        setP(ctx, c.knee, f.p.knee);
        setP(ctx, make.gain, dbToGain(f.p.makeup - autoMakeupDb(f.p.threshold, f.p.knee, f.p.ratio)));
      };
      break;
    }
    case "gate":
    case "deess": {
      const node = new AudioWorkletNode(ctx, fx.kind === "gate" ? "ridha-gate" : "ridha-deess", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      kill.push(node);
      input.connect(node).connect(output);
      set = (f) => {
        for (const [k, v] of Object.entries(f.p)) {
          const prm = node.parameters.get(k);
          if (prm) setP(ctx, prm, v);
        }
      };
      break;
    }
    case "dist": {
      const shaper = ctx.createWaveShaper();
      shaper.oversample = "2x";
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      const out = gain();
      kill.push(shaper, tone);
      const m = mixer(true);
      input.connect(shaper).connect(tone).connect(out).connect(m.wet);
      let key = "";
      set = (f) => {
        const k = `${f.p.type}:${f.p.drive}`;
        if (k !== key) {
          shaper.curve = distCurve(Math.round(f.p.type), f.p.drive);
          key = k;
        }
        setP(ctx, tone.frequency, f.p.tone);
        // a driven sound comes out louder: pulled back so the knob changes the colour, not the level
        setP(ctx, out.gain, dbToGain(f.p.out - 0.8 * distLiftDb(Math.round(f.p.type), f.p.drive)));
        m.set(f.p.mix);
      };
      break;
    }
    case "chorus": {
      const m = mixer(true);
      const merge = ctx.createChannelMerger(2);
      kill.push(merge);
      const fb = gain(0);
      const voices = [0, 1].map((i) => {
        const d = ctx.createDelay(0.1);
        const lfo = osc(1);
        const amt = gain(0);
        lfo.connect(amt).connect(d.delayTime);
        input.connect(d);
        d.connect(merge, 0, i);
        d.connect(fb);
        kill.push(d);
        return { d, lfo, amt };
      });
      fb.connect(voices[0].d);
      fb.connect(voices[1].d);
      merge.connect(m.wet);
      set = (f) => {
        voices.forEach((v, i) => {
          setP(ctx, v.d.delayTime, f.p.delay / 1000);
          setP(ctx, v.lfo.frequency, f.p.rate * (i ? 1.13 : 1));
          setP(ctx, v.amt.gain, (f.p.delay / 1000) * 0.45 * f.p.depth);
        });
        setP(ctx, fb.gain, f.p.feedback * 0.5);
        m.set(f.p.mix);
      };
      break;
    }
    case "phaser": {
      const m = mixer(true);
      const stages = [0, 1, 2, 3].map(() => {
        const a = ctx.createBiquadFilter();
        a.type = "allpass";
        a.Q.value = 0.6;
        kill.push(a);
        return a;
      });
      const lfo = osc(0.5);
      const amt = gain(0);
      lfo.connect(amt);
      const fb = gain(0);
      let prev: AudioNode = input;
      stages.forEach((s, i) => {
        s.frequency.value = 500 * (i + 1);
        amt.connect(s.frequency);
        prev = prev.connect(s);
      });
      prev.connect(m.wet);
      prev.connect(fb).connect(stages[0]);
      set = (f) => {
        setP(ctx, lfo.frequency, f.p.rate);
        setP(ctx, amt.gain, 420 * f.p.depth);
        setP(ctx, fb.gain, f.p.feedback);
        m.set(f.p.mix * 0.7);
      };
      break;
    }
    case "tremolo": {
      const g = gain();
      const lfo = osc(5);
      const amt = gain(0);
      lfo.connect(amt).connect(g.gain);
      input.connect(g).connect(output);
      set = (f) => {
        setP(ctx, lfo.frequency, f.p.rate);
        setP(ctx, g.gain, 1 - f.p.depth / 2);
        setP(ctx, amt.gain, f.p.depth / 2);
      };
      break;
    }
    case "delay": {
      const m = mixer();
      const a = ctx.createDelay(2), b = ctx.createDelay(2);
      const lpA = ctx.createBiquadFilter(), lpB = ctx.createBiquadFilter();
      const toB = gain(0), toA = gain(0);
      const panA = ctx.createStereoPanner(), panB = ctx.createStereoPanner();
      kill.push(a, b, lpA, lpB, panA, panB);
      input.connect(a).connect(lpA);
      lpA.connect(panA).connect(m.wet);
      lpA.connect(toB).connect(b).connect(lpB);
      lpB.connect(panB).connect(m.wet);
      lpB.connect(toA).connect(a);
      set = (f) => {
        const t = f.p.time / 1000;
        setP(ctx, a.delayTime, t);
        setP(ctx, b.delayTime, t);
        setP(ctx, lpA.frequency, f.p.damp);
        setP(ctx, lpB.frequency, f.p.damp);
        setP(ctx, toB.gain, f.p.feedback);
        setP(ctx, toA.gain, f.p.feedback);
        setP(ctx, panA.pan, -0.85 * f.p.ping);
        setP(ctx, panB.pan, 0.85 * f.p.ping);
        m.set(f.p.mix);
      };
      break;
    }
    case "reverb": {
      const m = mixer();
      const pre = ctx.createDelay(0.3);
      const conv = ctx.createConvolver();
      const cut = ctx.createBiquadFilter();
      cut.type = "highpass";
      kill.push(pre, conv, cut);
      input.connect(pre).connect(conv).connect(cut).connect(m.wet);
      let key = "";
      set = (f) => {
        const k = `${f.p.decay.toFixed(2)}:${Math.round(f.p.damp / 100)}`;
        if (k !== key) {
          conv.buffer = impulse(ctx, f.p.decay, f.p.damp);
          key = k;
        }
        setP(ctx, pre.delayTime, f.p.predelay / 1000);
        setP(ctx, cut.frequency, f.p.lowcut);
        m.set(f.p.mix);
      };
      break;
    }
    case "width": {
      const mono = gain();
      mono.channelCount = 1;
      mono.channelCountMode = "explicit";
      const merge = ctx.createChannelMerger(2);
      const d = ctx.createDelay(0.05);
      const dryR = gain(), wetR = gain();
      kill.push(merge, d);
      input.connect(mono);
      mono.connect(merge, 0, 0);
      mono.connect(dryR).connect(merge, 0, 1);
      mono.connect(d).connect(wetR).connect(merge, 0, 1);
      merge.connect(output);
      set = (f) => {
        setP(ctx, d.delayTime, f.p.time / 1000);
        setP(ctx, dryR.gain, 1 - f.p.amount);
        setP(ctx, wetR.gain, f.p.amount);
      };
      break;
    }
    case "limiter": {
      const c = ctx.createDynamicsCompressor();
      c.ratio.value = 20;
      c.knee.value = 0;
      c.attack.value = 0.001;
      const make = gain();
      kill.push(c);
      input.connect(c).connect(make).connect(output);
      set = (f) => {
        setP(ctx, c.threshold, f.p.threshold);
        setP(ctx, c.release, f.p.release / 1000);
        // what was held at the threshold is lifted to sit at the ceiling (a lower threshold is a louder result)
        setP(ctx, make.gain, dbToGain(f.p.ceiling - f.p.threshold - autoMakeupDb(f.p.threshold, 0, 20)));
      };
      break;
    }
  }
  set(fx);
  return {
    input,
    output,
    set,
    dispose() {
      for (const o of oscs) {
        try {
          o.stop();
        } catch {}
      }
      for (const n of kill) n.disconnect();
    },
  };
}

/** A chain of effects between two fixed points, rebuilt only when its make-up changes (a knob only moves a value). */
class Chain {
  readonly input: GainNode;
  readonly output: GainNode;
  private units: Unit[] = [];
  private sig = "\0";
  constructor(private ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
  }
  sync(fx: Fx[]) {
    const on = fx.filter((f) => f.on);
    const sig = on.map((f) => `${f.id}:${f.kind}:${f.bands?.length ?? 0}`).join("|");
    if (sig !== this.sig) {
      this.input.disconnect();
      for (const u of this.units) u.dispose();
      this.units = on.map((f) => makeUnit(this.ctx, f));
      let prev: AudioNode = this.input;
      for (const u of this.units) {
        prev.connect(u.input);
        prev = u.output;
      }
      prev.connect(this.output);
      this.sig = sig;
    } else on.forEach((f, i) => this.units[i].set(f));
  }
  dispose() {
    this.input.disconnect();
    this.output.disconnect();
    for (const u of this.units) u.dispose();
  }
}

/** Where a 3D placement puts a voice around the listener (who looks down −z). */
export function spacePosition(s: Space3D): [number, number, number] {
  const az = (s.az * Math.PI) / 180, el = (s.el * Math.PI) / 180;
  return [s.dist * Math.sin(az) * Math.cos(el), s.dist * Math.sin(el), -s.dist * Math.cos(az) * Math.cos(el)];
}

class Strip {
  readonly chain: Chain;
  readonly fader: GainNode;
  readonly pan: StereoPannerNode;
  readonly space: PannerNode;
  readonly post: GainNode;
  /** where the strip leaves for the master — or for its group's strip */
  readonly out: GainNode;
  private dest: AudioNode | null = null;
  readonly sendRev: GainNode;
  readonly sendDel: GainNode;
  readonly meter: AnalyserNode;
  private spaceOn: boolean | null = null;
  constructor(private ctx: BaseAudioContext, mix: Mix) {
    this.chain = new Chain(ctx);
    this.fader = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.space = ctx.createPanner();
    this.space.panningModel = "HRTF";
    this.space.distanceModel = "inverse";
    this.space.refDistance = 1;
    this.space.rolloffFactor = 0.9;
    this.post = ctx.createGain();
    this.out = ctx.createGain();
    this.sendRev = ctx.createGain();
    this.sendDel = ctx.createGain();
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 2048;
    this.meter.smoothingTimeConstant = 0.78;
    this.chain.output.connect(this.fader);
    this.fader.connect(this.meter);
    this.pan.connect(this.post);
    this.space.connect(this.post);
    this.post.connect(this.out);
    this.post.connect(this.sendRev).connect(mix.reverbIn);
    this.post.connect(this.sendDel).connect(mix.delayIn);
  }
  get input() {
    return this.chain.input;
  }
  sync(p: Project, t: Track, mix: Mix) {
    const { ctx } = this;
    // a member of a group plays into the group's strip (through its effects and fader); everything else to the master
    const group = t.group && t.kind !== "group" ? mix.strips.get(t.group) : null;
    const dest = group && group !== this ? group.input : mix.masterIn;
    if (dest !== this.dest) {
      this.out.disconnect();
      this.out.connect(dest);
      this.dest = dest;
    }
    // a mono track folds its sound to one channel at the door; a stereo one takes what comes
    const mono = t.stereo === false;
    if ((this.chain.input.channelCountMode === "explicit") !== mono) {
      this.chain.input.channelCount = mono ? 1 : 2;
      this.chain.input.channelCountMode = mono ? "explicit" : "max";
    }
    this.chain.sync(t.fx);
    setP(ctx, this.fader.gain, audible(p, t) ? dbToGain(t.gain) : 0);
    if (this.spaceOn !== t.space.on) {
      this.fader.disconnect();
      this.fader.connect(this.meter);
      this.fader.connect(t.space.on ? this.space : this.pan);
      this.spaceOn = t.space.on;
    }
    setP(ctx, this.pan.pan, t.pan);
    const [x, y, z] = spacePosition(t.space);
    setP(ctx, this.space.positionX, x);
    setP(ctx, this.space.positionY, y);
    setP(ctx, this.space.positionZ, z);
    setP(ctx, this.sendRev.gain, t.sendReverb);
    setP(ctx, this.sendDel.gain, t.sendDelay);
  }
  dispose() {
    this.chain.dispose();
    for (const n of [this.fader, this.pan, this.space, this.post, this.out, this.sendRev, this.sendDel, this.meter]) n.disconnect();
  }
}

/** The whole mixer for one audio context (the live one, or an offline one being rendered). */
export class Mix {
  readonly masterIn: GainNode;
  readonly reverbIn: GainNode;
  readonly delayIn: GainNode;
  readonly out: GainNode;
  private masterChain: Chain;
  private reverb: Unit;
  private delay: Unit;
  private reverbLevel: GainNode;
  private delayLevel: GainNode;
  readonly strips = new Map<string, Strip>();

  constructor(readonly ctx: BaseAudioContext, p: Project) {
    this.masterIn = ctx.createGain();
    this.reverbIn = ctx.createGain();
    this.delayIn = ctx.createGain();
    this.out = ctx.createGain();
    this.masterChain = new Chain(ctx);
    this.reverb = makeUnit(ctx, this.reverbFx(p));
    this.delay = makeUnit(ctx, this.delayFx(p));
    this.reverbLevel = ctx.createGain();
    this.delayLevel = ctx.createGain();
    this.reverbIn.connect(this.reverb.input);
    this.reverb.output.connect(this.reverbLevel).connect(this.masterIn);
    this.delayIn.connect(this.delay.input);
    this.delay.output.connect(this.delayLevel).connect(this.masterIn);
    this.masterIn.connect(this.masterChain.input);
    this.masterChain.output.connect(this.out);
    this.sync(p);
  }
  private reverbFx = (p: Project): Fx => ({ id: "bus-rev", kind: "reverb", on: true, p: { ...p.reverb, mix: 1 } });
  private delayFx = (p: Project): Fx => ({ id: "bus-del", kind: "delay", on: true, p: { ...p.delay, mix: 1 } });

  sync(p: Project) {
    const { ctx } = this;
    for (const [id, s] of this.strips) {
      if (!p.tracks.some((t) => t.id === id)) {
        s.dispose();
        this.strips.delete(id);
      }
    }
    // every strip exists before any is routed: a member needs its group's strip to play into
    for (const t of p.tracks) if (!this.strips.has(t.id)) this.strips.set(t.id, new Strip(ctx, this));
    for (const t of p.tracks) this.strips.get(t.id)!.sync(p, t, this);
    this.reverb.set(this.reverbFx(p));
    this.delay.set(this.delayFx(p));
    setP(ctx, this.reverbLevel.gain, p.reverb.level);
    setP(ctx, this.delayLevel.gain, p.delay.level);
    this.masterChain.sync(p.master.fx);
    setP(ctx, this.out.gain, dbToGain(p.master.gain));
  }

  /** A clip scheduled into its track: playback from timeline second `from`, which sounds at context time `when0`. */
  schedule(c: Clip, from: number, when0: number): AudioBufferSourceNode | null {
    const strip = this.strips.get(c.trackId);
    const buf = bufferFor(this.ctx, c.assetId);
    const end = c.start + c.dur;
    if (!strip || !buf || c.muted || end <= from + 0.001) return null;
    const into = Math.max(0, from - c.start);
    const T = (t: number) => when0 + (t - from);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    const level = dbToGain(c.gain);
    // every edge gets at least 3 ms of fade: a cut in the middle of a wave would click
    const fin = Math.max(0.003, c.fadeIn), fout = Math.max(0.003, Math.min(c.fadeOut || 0.003, c.dur - fin));
    const now = Math.max(from, c.start);
    if (into < fin) {
      g.gain.setValueAtTime(level * (into / fin), T(now));
      g.gain.linearRampToValueAtTime(level, T(c.start + fin));
    } else g.gain.setValueAtTime(level, T(now));
    const fo = end - fout;
    if (now > fo) g.gain.setValueAtTime(level * ((end - now) / fout), T(now));
    else g.gain.setValueAtTime(level, T(fo));
    g.gain.linearRampToValueAtTime(0, T(end));
    src.connect(g).connect(strip.input);
    src.start(T(now), c.offset + into, c.dur - into);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    return src;
  }

  dispose() {
    for (const s of this.strips.values()) s.dispose();
    this.masterChain.dispose();
    this.reverb.dispose();
    this.delay.dispose();
    for (const n of [this.masterIn, this.reverbIn, this.delayIn, this.out, this.reverbLevel, this.delayLevel]) n.disconnect();
  }
}

/** The project (or one stretch of it, or one track alone) rendered to stereo through the same mixer as the live desk. */
export async function renderProject(p: Project, opts: { from?: number; to?: number; tail?: number; onlyTrack?: string } = {}): Promise<Float32Array[]> {
  const from = opts.from ?? 0;
  const to = opts.to ?? projectEnd(p);
  const wet = p.tracks.some((t) => t.sendReverb > 0 || t.sendDelay > 0 || t.fx.some((f) => f.on && (f.kind === "reverb" || f.kind === "delay")));
  const tail = opts.tail ?? (wet ? Math.min(8, Math.max(p.reverb.decay, 2)) : 0.2);
  const frames = Math.max(1, Math.ceil((to - from + tail) * SR));
  const ctx = new OfflineAudioContext(2, frames, SR);
  await ctx.audioWorklet.addModule(WORKLETS);
  const proj = opts.onlyTrack ? { ...p, tracks: p.tracks.map((t) => ({ ...t, solo: t.id === opts.onlyTrack, mute: false })) } : p;
  const mix = new Mix(ctx, proj);
  mix.out.connect(ctx.destination);
  for (const c of proj.clips) if (c.start < to) mix.schedule(c.start + c.dur > to ? { ...c, dur: to - c.start } : c, from, 0);
  const buf = await ctx.startRendering();
  return [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()];
}

// ───────── the live desk ─────────

export interface Recorded {
  channels: Float32Array[];
  /** where on the timeline the recording starts */
  start: number;
}

export class Engine {
  readonly ctx: AudioContext;
  private mix: Mix | null = null;
  private project: Project | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private startCtx = 0;
  private startPos = 0;
  private pos = 0;
  playing = false;
  recording = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private click: GainNode;
  private outMeter: [AnalyserNode, AnalyserNode];
  private kMeter: [AnalyserNode, AnalyserNode];
  private kRing: { t: number; p: number }[] = [];
  private ready: Promise<void> | null = null;
  private watchers = new Set<() => void>();
  private dying: ReturnType<typeof setTimeout> | null = null;
  private onChange = () => {
    for (const fn of this.watchers) fn();
  };
  /** Told whenever playing, recording or the position jumps. */
  watch(fn: () => void): () => void {
    this.watchers.add(fn);
    return () => void this.watchers.delete(fn);
  }
  /** The studio holds the engine while it is on screen; a moment after it lets go for good, the audio is closed. */
  hold() {
    if (this.dying) clearTimeout(this.dying);
    this.dying = null;
  }
  release() {
    this.dying = setTimeout(() => this.dispose(), 400);
  }

  // the microphone
  private stream: MediaStream | null = null;
  private micStereo = false;
  private micSrc: MediaStreamAudioSourceNode | null = null;
  private recNode: AudioWorkletNode | null = null;
  private micMeter: AnalyserNode | null = null;
  private monitor: GainNode | null = null;
  private chunks: Float32Array[][] = [];
  private recFirst = 0;
  private recWhen = 0;
  private recFrom = 0;
  /** added to the round-trip delay when placing a recording, ms (the person's own fine adjustment) */
  latencyTrimMs = 0;
  /** the round trip measured by «معايرة التأخير», ms; null = trust what the browser reports */
  roundTripMs: number | null = null;
  private audition: AudioBufferSourceNode | null = null;
  private scratch = new Float32Array(2048);

  constructor() {
    this.ctx = new AudioContext({ sampleRate: SR, latencyHint: "interactive" });
    this.click = this.ctx.createGain();
    this.click.gain.value = 0.5;
    this.click.connect(this.ctx.destination);
    const mk = () => {
      const a = this.ctx.createAnalyser();
      a.fftSize = 2048;
      return a;
    };
    this.outMeter = [mk(), mk()];
    this.kMeter = [mk(), mk()];
  }

  /** Wakes the audio (browsers hold it until the person's first press) and loads the sound-thread processors. */
  start(): Promise<void> {
    this.ready ??= this.ctx.audioWorklet.addModule(WORKLETS);
    return Promise.all([this.ready, this.ctx.state === "suspended" ? this.ctx.resume() : null]).then(() => {});
  }

  async setProject(p: Project) {
    await (this.ready ??= this.ctx.audioWorklet.addModule(WORKLETS));
    const structure = (q: Project) => q.clips.map((c) => `${c.id}:${c.trackId}:${c.assetId}:${c.start}:${c.offset}:${c.dur}:${c.gain}:${c.fadeIn}:${c.fadeOut}:${c.muted}`).join("|");
    const changed = !this.project || structure(this.project) !== structure(p);
    this.project = p;
    if (!this.mix) {
      this.mix = new Mix(this.ctx, p);
      // master → the speakers, and beside them the meters (peak per side, and the loudness weighting per side)
      const split = this.ctx.createChannelSplitter(2);
      this.mix.out.connect(this.ctx.destination);
      this.mix.out.connect(split);
      split.connect(this.outMeter[0], 0);
      split.connect(this.outMeter[1], 1);
      const shelf = this.ctx.createBiquadFilter();
      shelf.type = "highshelf";
      shelf.frequency.value = 1500;
      shelf.gain.value = 4;
      const cut = this.ctx.createBiquadFilter();
      cut.type = "highpass";
      cut.frequency.value = 38;
      cut.Q.value = -6;
      const ks = this.ctx.createChannelSplitter(2);
      this.mix.out.connect(shelf).connect(cut).connect(ks);
      ks.connect(this.kMeter[0], 0);
      ks.connect(this.kMeter[1], 1);
    } else this.mix.sync(p);
    // clips moved, cut or replaced while playing: what is scheduled no longer matches, so it is laid out again
    if (changed && this.playing && !this.recording) this.play(this.position());
  }

  position(): number {
    return this.playing ? Math.max(this.startPos, this.startPos + (this.ctx.currentTime - this.startCtx)) : this.pos;
  }

  seek(t: number) {
    const at = Math.max(0, t);
    if (this.playing && !this.recording) this.play(at);
    else if (!this.playing) this.pos = at;
    this.onChange();
  }

  private silence() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources = [];
  }

  play(from = this.pos, when?: number) {
    if (!this.mix || !this.project) return;
    void this.start();
    this.silence();
    const when0 = when ?? this.ctx.currentTime + 0.06;
    for (const c of this.project.clips) {
      const s = this.mix.schedule(c, from, when0);
      if (s) this.sources.push(s);
    }
    this.startCtx = when0;
    this.startPos = from;
    this.playing = true;
    this.nextBeat = Math.ceil(from / beatSec(this.project) - 1e-6);
    this.timer ??= setInterval(() => this.tick(), 20);
    this.onChange();
  }

  stop() {
    if (!this.playing) return;
    this.pos = this.position();
    this.silence();
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.onChange();
  }

  private tick() {
    const p = this.project;
    if (!p || !this.playing) return;
    const pos = this.position();
    if (p.metronome || this.recording) {
      const beat = beatSec(p);
      while (this.nextBeat * beat < pos + 0.12) {
        const t = this.nextBeat * beat;
        if (t >= this.startPos - 1e-6 && (p.metronome || false)) this.tock(this.startCtx + (t - this.startPos), this.nextBeat % p.beats === 0);
        this.nextBeat++;
      }
    }
    if (this.recording) return;
    if (p.loop.on && p.loop.end > p.loop.start + 0.05 && pos >= p.loop.end) this.play(p.loop.start);
    else if (pos > Math.max(projectEnd(p), p.loop.on ? p.loop.end : 0) + 0.6) {
      this.stop();
      this.pos = 0;
      this.onChange();
    }
  }

  private tock(when: number, down: boolean) {
    if (when < this.ctx.currentTime) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = down ? 1760 : 1175;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(down ? 0.9 : 0.5, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g).connect(this.click);
    o.start(when);
    o.stop(when + 0.06);
  }

  // ── the microphone ──

  get hasMic() {
    return !!this.stream;
  }

  /** Asks for the microphone, raw: the browser's own echo canceller, noise remover and auto-level are for calls, not for recording. */
  async openMic(stereo = false): Promise<void> {
    await this.start();
    this.closeMic();
    this.micStereo = stereo;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: stereo ? 2 : 1, sampleRate: SR },
    });
    this.micSrc = this.ctx.createMediaStreamSource(this.stream);
    this.recNode = new AudioWorkletNode(this.ctx, "ridha-recorder", { numberOfInputs: 1, numberOfOutputs: 0, channelCount: stereo ? 2 : 1, channelCountMode: "explicit" });
    this.recNode.port.onmessage = (e: MessageEvent<{ frames: Float32Array[]; time: number }>) => {
      if (!this.chunks.length) this.recFirst = e.data.time;
      this.chunks.push(e.data.frames);
    };
    this.micMeter = this.ctx.createAnalyser();
    this.micMeter.fftSize = 2048;
    this.monitor = this.ctx.createGain();
    this.monitor.gain.value = 0;
    this.micSrc.connect(this.recNode);
    this.micSrc.connect(this.micMeter);
    this.micSrc.connect(this.monitor).connect(this.ctx.destination);
  }

  closeMic() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.micSrc?.disconnect();
    this.recNode?.disconnect();
    this.monitor?.disconnect();
    this.stream = null;
    this.micSrc = null;
    this.recNode = null;
    this.micMeter = null;
    this.monitor = null;
  }

  /** Hear yourself while recording (headphones only: through speakers it feeds back). */
  setMonitor(on: boolean) {
    if (this.monitor) this.monitor.gain.value = on ? 1 : 0;
  }

  /** Starts recording at timeline second `from`; with a count-in, a bar of clicks comes first. Playback runs alongside. */
  async record(from: number, countIn: boolean, stereo = false): Promise<void> {
    if (!this.project) return;
    // a stereo track records two channels (a stereo microphone or interface); a mono track, one
    if (!this.stream || this.micStereo !== stereo) await this.openMic(stereo);
    await this.start();
    this.stop();
    const p = this.project;
    const lead = countIn ? barSec(p) : 0;
    const when0 = this.ctx.currentTime + 0.12 + lead;
    if (countIn) for (let b = 0; b < p.beats; b++) this.tock(when0 - lead + b * beatSec(p), b === 0);
    this.chunks = [];
    this.recWhen = when0;
    this.recFrom = from;
    this.recording = true;
    this.recNode!.port.postMessage({ on: true });
    this.play(from, when0);
  }

  /** Stops and hands back what was recorded, placed where it was sung (the round trip through the sound card taken off). */
  stopRecording(): Recorded | null {
    if (!this.recording) return null;
    this.recNode?.port.postMessage({ on: false });
    this.recording = false;
    this.stop();
    const chunks = this.chunks;
    this.chunks = [];
    if (!chunks.length) return null;
    const total = chunks.reduce((n, c) => n + c[0].length, 0);
    const width = this.micStereo && chunks[0].length > 1 ? 2 : 1;
    const all = Array.from({ length: width }, () => new Float32Array(total));
    let at = 0;
    for (const c of chunks) {
      for (let ch = 0; ch < width; ch++) all[ch].set(c[ch] ?? c[0], at);
      at += c[0].length;
    }
    const latency = (this.roundTripMs ?? this.reportedLatencyMs()) / 1000 + this.latencyTrimMs / 1000;
    // what was captured before the first beat of the take (the count-in, the round trip) is cut away
    const skip = Math.max(0, Math.round((this.recWhen - this.recFirst + latency) * SR));
    if (skip >= total) return null;
    // a «stereo» input whose two sides are the same microphone is one voice: kept as mono
    let same = width === 2;
    for (let i = skip; same && i < total; i += 61) if (Math.abs(all[0][i] - all[1][i]) > 1e-4) same = false;
    return { channels: (same ? [all[0]] : all).map((ch) => ch.slice(skip)), start: this.recFrom };
  }

  /** The measured round trip (null = trust the browser's report) and the hand adjustment, both ms. */
  setLatency(roundTripMs: number | null, trimMs: number) {
    this.roundTripMs = roundTripMs;
    this.latencyTrimMs = trimMs;
  }

  /** The delay the browser itself reports for the way out and the way in, ms. Wired sound is a few ms; Bluetooth is 150–300. */
  reportedLatencyMs(): number {
    const inLat = (this.stream?.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined)?.latency ?? 0;
    return Math.round(((this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0) + inLat) * 1000);
  }

  /**
   * «معايرة التأخير»: five short beeps are played and heard back through the microphone; the time each takes to come
   * back is the true round trip of this output and this microphone (a Bluetooth headphone held to the mic, a
   * speaker in the room). Returns it in ms, or null when the beeps were not heard clearly.
   */
  async measureLatency(): Promise<number | null> {
    if (!this.stream) await this.openMic();
    await this.start();
    this.stop();
    const N = 5, gap = 0.7, listen = 0.9;
    const t0 = this.ctx.currentTime + 0.35;
    for (let k = 0; k < N; k++) {
      const when = t0 + k * gap;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = BEEP_HZ;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.9, when + 0.0005);
      g.gain.setValueAtTime(0.9, when + 0.005);
      g.gain.linearRampToValueAtTime(0, when + 0.008);
      o.connect(g).connect(this.ctx.destination);
      o.start(when);
      o.stop(when + 0.01);
    }
    this.chunks = [];
    this.recNode!.port.postMessage({ on: true });
    await new Promise((r) => setTimeout(r, (0.35 + N * gap + listen) * 1000));
    this.recNode!.port.postMessage({ on: false });
    await new Promise((r) => setTimeout(r, 60));
    const chunks = this.chunks;
    this.chunks = [];
    if (!chunks.length) return null;
    const total = chunks.reduce((n, c) => n + c[0].length, 0);
    const all = new Float32Array(total);
    let at = 0;
    for (const c of chunks) {
      all.set(c[0], at);
      at += c[0].length;
    }
    return roundTrip(all, SR, this.recFirst, Array.from({ length: N }, (_, k) => t0 + k * gap), gap);
  }

  // ── meters ──

  private peakOf(a: AnalyserNode | null | undefined): number {
    if (!a) return 0;
    a.getFloatTimeDomainData(this.scratch as Float32Array<ArrayBuffer>);
    let p = 0;
    for (let i = 0; i < this.scratch.length; i++) {
      const v = Math.abs(this.scratch[i]);
      if (v > p) p = v;
    }
    return p;
  }
  trackPeak = (id: string) => this.peakOf(this.mix?.strips.get(id)?.meter);
  micPeak = () => this.peakOf(this.micMeter);
  masterPeaks = (): [number, number] => [this.peakOf(this.outMeter[0]), this.peakOf(this.outMeter[1])];

  /** Loudness of the last three seconds of the master, LUFS (approximate: the K curve as two simple filters). */
  shortTermLufs(): number {
    let p = 0;
    for (const a of this.kMeter) {
      a.getFloatTimeDomainData(this.scratch as Float32Array<ArrayBuffer>);
      let s = 0;
      for (let i = 0; i < this.scratch.length; i++) s += this.scratch[i] * this.scratch[i];
      p += s / this.scratch.length;
    }
    const now = performance.now();
    this.kRing.push({ t: now, p });
    while (this.kRing.length && now - this.kRing[0].t > 3000) this.kRing.shift();
    const mean = this.kRing.reduce((a, r) => a + r.p, 0) / this.kRing.length;
    return mean > 1e-10 ? -0.691 + 10 * Math.log10(mean) : -Infinity;
  }

  /** A track's spectrum right now (after its effects), in dB per bin; pass the master's with no id. */
  spectrum(into: Float32Array, trackId?: string): number {
    const a = trackId ? this.mix?.strips.get(trackId)?.meter : this.outMeter[0];
    if (!a) return 0;
    a.getFloatFrequencyData(into.subarray(0, a.frequencyBinCount) as Float32Array<ArrayBuffer>);
    return a.frequencyBinCount;
  }

  // ── listening to a result before keeping it ──

  /** Plays raw channels straight to the speakers (a before/after, a harmony idea); stops whatever was auditioning. */
  listen(channels: Float32Array[], onEnd?: () => void) {
    void this.start();
    this.hush();
    const buf = this.ctx.createBuffer(channels.length, channels[0].length, SR);
    channels.forEach((c, i) => buf.copyToChannel(c as Float32Array<ArrayBuffer>, i));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.onended = () => {
      if (this.audition === src) this.audition = null;
      onEnd?.();
    };
    src.start();
    this.audition = src;
  }
  hush() {
    try {
      this.audition?.stop();
    } catch {}
    this.audition = null;
  }

  dispose() {
    this.stop();
    this.hush();
    this.closeMic();
    this.mix?.dispose();
    void this.ctx.close();
  }
}
