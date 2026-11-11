import { describe, expect, it } from "vitest";
import { FFT, stftGain } from "@/lib/ridha/dsp/fft";
import { biquad, filter, responseDb } from "@/lib/ridha/dsp/biquad";
import { hzToMidi, midiToHz, trackPitch, pitchStats, type PitchTrack } from "@/lib/ridha/dsp/pitch";
import { detectKey, scaleById, snap, stepFrom } from "@/lib/ridha/dsp/scales";
import { pitchMarks, psolaShift } from "@/lib/ridha/dsp/psola";
import { harmonyWhen, planHarmony, planTune } from "@/lib/ridha/dsp/tune";
import { changeSpeed, shiftAll } from "@/lib/ridha/dsp/stretch";
import { cleanVoice, deEss, detectHum, gate, noiseProfile, reduceNoise, reduceReverb, removeClicks, removeHum } from "@/lib/ridha/dsp/clean";
import { limit, loudness, normalizeLoudness, peakDb } from "@/lib/ridha/dsp/loudness";
import { encodeWav, makePeaks, rangeOf } from "@/lib/ridha/dsp/wav";

const SR = 48000;
/** A voice-like tone: a fundamental with falling overtones, its note given per sample in Hz. */
function voice(seconds: number, hz: (t: number) => number, amp = 0.3) {
  const x = new Float32Array(Math.round(seconds * SR));
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    ph += (2 * Math.PI * hz(i / SR)) / SR;
    x[i] = amp * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph) + 0.15 * Math.sin(4 * ph));
  }
  return x;
}
const rms = (x: Float32Array, a = 0, b = x.length) => {
  let s = 0;
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return Math.sqrt(s / (b - a));
};
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
const noise = (n: number, amp: number) => Float32Array.from({ length: n }, () => rand() * amp);
/** The middle note a track reads, in MIDI. */
const midNote = async (x: Float32Array) => pitchStats(await trackPitch(x, SR)).median;

describe("الرضا فويس: the transform and the filters", () => {
  it("returns the signal after forward and inverse", () => {
    const fft = new FFT(1024);
    const re = Float32Array.from({ length: 1024 }, () => rand()), im = new Float32Array(1024);
    const orig = re.slice();
    fft.forward(re, im);
    fft.inverse(re, im);
    for (let i = 0; i < 1024; i++) expect(re[i]).toBeCloseTo(orig[i], 4);
  });
  it("rebuilds the very sound when every gain is one", async () => {
    const x = voice(0.5, () => 220);
    const y = await stftGain(x, 2048, () => {});
    for (let i = 3000; i < x.length - 3000; i += 97) expect(y[i]).toBeCloseTo(x[i], 4);
  });
  it("a high-pass passes the top and stops the bottom", () => {
    const c = biquad("highpass", SR, 1000);
    expect(responseDb(c, SR, 8000)).toBeGreaterThan(-0.5);
    expect(responseDb(c, SR, 100)).toBeLessThan(-35);
    expect(rms(filter(voice(0.3, () => 60), c))).toBeLessThan(0.02);
  });
});

describe("الرضا فويس: hearing the note", () => {
  it("reads a steady note within a few cents, and silence as no note", async () => {
    for (const hz of [98, 220, 440, 660]) {
      const t = await trackPitch(voice(0.6, () => hz), SR);
      const mid = t.f0[Math.floor(t.f0.length / 2)];
      expect(Math.abs(1200 * Math.log2(mid / hz))).toBeLessThan(6);
    }
    const quiet = await trackPitch(new Float32Array(SR / 2), SR);
    expect(quiet.f0.every((v) => v === 0)).toBe(true);
  });
  it("snaps to a scale, quarter tones included", () => {
    const rast = scaleById("rast");
    // 3.4 semitones above the tonic sits nearest rast's half-flat third (3.5)
    expect(snap(60 + 3.4, 60, rast).midi).toBeCloseTo(63.5);
    expect(snap(60 + 11.8, 60, scaleById("major")).midi).toBeCloseTo(72);
    const at = snap(64, 60, scaleById("major"));
    expect(stepFrom(at, 2, 60, scaleById("major"))).toBeCloseTo(67);
    expect(stepFrom(at, -3, 60, scaleById("major"))).toBeCloseTo(59);
  });
  it("finds the key of a sung line", async () => {
    // D bayati: D E-half-flat F G A, resting on D
    const notes = [62, 63.5, 65, 67, 69, 67, 65, 63.5, 62, 65, 63.5, 62, 62];
    const x = voice(notes.length * 0.3, (t) => midiToHz(notes[Math.min(notes.length - 1, Math.floor(t / 0.3))]));
    const guesses = detectKey(await trackPitch(x, SR));
    expect(guesses[0].scale.id).toBe("bayati");
    expect(guesses[0].tonic).toBe(2);
    // the same line sung 30 cents flat (no instrument to hold the pitch) is still D bayati, not a quarter tone lower
    const flat = voice(notes.length * 0.3, (t) => midiToHz(notes[Math.min(notes.length - 1, Math.floor(t / 0.3))] - 0.3));
    expect(detectKey(await trackPitch(flat, SR))[0]).toMatchObject({ tonic: 2, scale: { id: "bayati" } });
    // and a maqam that truly rests on a half-flat keeps its quarter-tone tonic: sikah on E half-flat
    const sikah = [63.5, 65, 67, 69, 67, 65, 63.5, 63.5];
    const sk = voice(sikah.length * 0.3, (t) => midiToHz(sikah[Math.min(sikah.length - 1, Math.floor(t / 0.3))]));
    expect(detectKey(await trackPitch(sk, SR))[0].tonic % 1).toBe(0.5);
  });
});

describe("الرضا فويس: moving the note", () => {
  it("leaves the sound untouched at a ratio of one", async () => {
    const x = voice(0.6, () => 200);
    const t = await trackPitch(x, SR);
    const y = psolaShift(x, t, () => 1);
    for (let i = 2000; i < x.length - 2000; i += 53) expect(y[i]).toBeCloseTo(x[i], 3);
  });
  it("raises and lowers a voice by the asked interval, keeping its length and loudness", async () => {
    const x = voice(0.8, () => 200);
    const t = await trackPitch(x, SR);
    for (const semis of [4, -5, 12]) {
      const y = psolaShift(x, t, () => 2 ** (semis / 12));
      expect(y.length).toBe(x.length);
      expect((await midNote(y)) - hzToMidi(200)).toBeCloseTo(semis, 0);
      expect(rms(y, 8000, y.length - 8000) / rms(x, 8000, x.length - 8000)).toBeGreaterThan(0.5);
      expect(rms(y, 8000, y.length - 8000) / rms(x, 8000, x.length - 8000)).toBeLessThan(2);
    }
  });
  it("auto-tune pulls a flat note onto the scale", async () => {
    // 40 cents under A3, in A minor
    const x = voice(0.8, () => midiToHz(57 - 0.4));
    const t = await trackPitch(x, SR);
    const plan = planTune(t, { tonic: 9, scale: scaleById("minor"), strength: 1, speedMs: 0, transpose: 0 });
    const y = psolaShift(x, t, (f) => plan.ratio[f]);
    expect(Math.abs((await midNote(y)) - 57)).toBeLessThan(0.08);
    // half strength goes half the way
    const half = planTune(t, { tonic: 9, scale: scaleById("minor"), strength: 0.5, speedMs: 0, transpose: 0 });
    expect(Math.abs((await midNote(psolaShift(x, t, (f) => half.ratio[f]))) - (57 - 0.2))).toBeLessThan(0.08);
  });
  it("a slow auto-tune keeps the vibrato, a hard one flattens it", async () => {
    const x = voice(1.2, (t) => midiToHz(57 - 0.3 + 0.5 * Math.sin(2 * Math.PI * 5.5 * t)));
    const t = await trackPitch(x, SR);
    const spread = (p: Float32Array) => {
      const v = Array.from(p.slice(30, p.length - 30)).filter(Boolean);
      return Math.max(...v) - Math.min(...v);
    };
    const hard = planTune(t, { tonic: 9, scale: scaleById("minor"), strength: 1, speedMs: 0, transpose: 0 });
    const slow = planTune(t, { tonic: 9, scale: scaleById("minor"), strength: 1, speedMs: 250, transpose: 0 });
    expect(spread(hard.tuned)).toBeLessThan(0.05);
    expect(spread(slow.tuned)).toBeGreaterThan(0.5);
  });
  it("a harmony voice sings the scale's third above", async () => {
    const x = voice(0.8, () => midiToHz(60));
    const t = await trackPitch(x, SR);
    const r = planHarmony(t, { tonic: 0, scale: scaleById("major"), steps: 2, octaves: 0, detuneCents: 0 });
    expect((await midNote(psolaShift(x, t, (f) => r[f]))) - 60).toBeCloseTo(4, 0);
    const minor = planHarmony(t, { tonic: 0, scale: scaleById("minor"), steps: 2, octaves: 0, detuneCents: 0 });
    expect((await midNote(psolaShift(x, t, (f) => minor[f]))) - 60).toBeCloseTo(3, 0);
  });
  it("shifts a whole recording and changes its speed", async () => {
    const x = voice(1, () => 220);
    const up = shiftAll([x], 3, SR)[0];
    expect(up.length).toBe(x.length);
    expect((await midNote(up)) - hzToMidi(220)).toBeCloseTo(3, 0);
    const fast = changeSpeed([x], 1.25, SR)[0];
    expect(fast.length).toBe(Math.round(x.length / 1.25));
    expect((await midNote(fast)) - hzToMidi(220)).toBeCloseTo(0, 0);
  });
});

describe("الرضا فويس: cleaning", () => {
  it("takes the hiss down and leaves the voice", async () => {
    const n = SR * 2;
    const x = new Float32Array(n);
    const hiss = noise(n, 0.02);
    const v = voice(1, () => 180);
    // a second of room alone, then a second of voice over the room
    for (let i = 0; i < n; i++) x[i] = hiss[i] + (i >= SR ? v[i - SR] : 0);
    const y = await reduceNoise(x, await noiseProfile(x), 0.7);
    expect(rms(y, 4000, SR - 4000)).toBeLessThan(rms(x, 4000, SR - 4000) * 0.35);
    expect(rms(y, SR + 4000, n - 4000)).toBeGreaterThan(rms(v) * 0.85);
  });
  it("finds mains hum and notches it out", () => {
    const n = SR * 2;
    const x = noise(n, 0.01);
    for (let i = 0; i < n; i++) x[i] += 0.05 * Math.sin((2 * Math.PI * 50 * i) / SR) + 0.02 * Math.sin((2 * Math.PI * 100 * i) / SR);
    expect(detectHum(x, SR)).toBe(50);
    expect(detectHum(noise(n, 0.02), SR)).toBe(0);
    expect(rms(removeHum(x, SR, 50), SR, n)).toBeLessThan(rms(x, SR, n) * 0.4);
  });
  it("redraws a click and leaves clean sound alone", () => {
    const x = voice(0.5, () => 150);
    const clean = removeClicks(x, SR);
    expect(clean.fixed).toBe(0);
    const y = x.slice();
    y[12000] += 0.9;
    y[12001] -= 0.8;
    const r = removeClicks(y, SR);
    expect(r.fixed).toBe(1);
    expect(Math.abs(r.out[12000] - x[12000])).toBeLessThan(0.1);
  });
  it("turns down hiss-range bursts only, and a gate lowers the gaps", () => {
    const x = voice(0.5, () => 200, 0.2);
    const sss = new Float32Array(x.length);
    for (let i = 0; i < sss.length; i++) sss[i] = 0.3 * Math.sin((2 * Math.PI * 8000 * i) / SR);
    expect(rms(deEss(sss, SR), 6000, sss.length - 6000)).toBeLessThan(rms(sss) * 0.6);
    expect(rms(deEss(x, SR), 6000, x.length - 6000)).toBeGreaterThan(rms(x) * 0.95);
    const g = new Float32Array(SR);
    g.set(x.subarray(0, SR / 4), 0);
    for (let i = SR / 2; i < SR; i++) g[i] = rand() * 0.001;
    const out = gate(g, SR);
    expect(rms(out, SR * 0.8, SR)).toBeLessThan(rms(g, SR * 0.8, SR) * 0.2);
    expect(rms(out, 2000, SR / 4 - 2000)).toBeGreaterThan(rms(g, 2000, SR / 4 - 2000) * 0.95);
  });
  it("lowers a room's ring after a note without eating the note while it is held", async () => {
    // a second of held voice, then its ring dying away over half a second (a room answering)
    const n = SR * 2;
    const x = new Float32Array(n);
    const v = voice(2, () => 200);
    for (let i = 0; i < n; i++) x[i] = v[i] * (i < SR ? 1 : Math.exp(-(i - SR) / (SR * 0.12)));
    const y = await reduceReverb(x, 0.6);
    // the held part keeps its level (within 2 dB)…
    expect(rms(y, 14400, 43200) / rms(x, 14400, 43200)).toBeGreaterThan(0.8);
    // …and the ring is pulled down well below what it was
    expect(rms(y, 55200, 72000) / rms(x, 55200, 72000)).toBeLessThan(0.55);
  });
  it("runs the whole professional chain and says what it did", async () => {
    const n = SR * 2;
    const x = noise(n, 0.015);
    const v = voice(1, () => 170);
    for (let i = 0; i < n; i++) x[i] += (i >= SR ? v[i - SR] : 0) + 0.04 * Math.sin((2 * Math.PI * 60 * i) / SR) + 0.02 * Math.sin((2 * Math.PI * 120 * i) / SR);
    const { out, report } = await cleanVoice(x, SR, { noise: 0.7, ai: false, rumbleHz: 80, hum: true, clicks: true, deEss: 0.5, reverb: 0, gate: false });
    expect(report.hum).toBe(60);
    expect(report.steps.length).toBeGreaterThanOrEqual(3);
    expect(rms(out, 6000, SR - 6000)).toBeLessThan(rms(x, 6000, SR - 6000) * 0.3);
    expect(out.length).toBe(n);
  });
});

describe("الرضا فويس: loudness and files", () => {
  it("measures a full-scale 1 kHz tone at about −3 LUFS and brings a sound to a target", () => {
    const tone = Float32Array.from({ length: SR * 3 }, (_, i) => Math.sin((2 * Math.PI * 997 * i) / SR));
    expect(loudness([tone], SR)).toBeCloseTo(-3.01, 0);
    expect(loudness([new Float32Array(SR)], SR)).toBe(-Infinity);
    const quiet = tone.map((v) => v * 0.02);
    const n = normalizeLoudness([quiet], SR, -16);
    expect(loudness(n.channels, SR)).toBeCloseTo(-16, 0);
    expect(peakDb(n.channels)).toBeLessThanOrEqual(-0.99);
  });
  it("the limiter holds every peak under the ceiling", () => {
    const x = voice(0.5, () => 120, 0.9);
    expect(peakDb([x])).toBeGreaterThan(0);
    expect(peakDb(limit([x], SR, -1))).toBeLessThanOrEqual(-0.99);
  });
  it("writes a WAV with the right header and outlines a sound", async () => {
    const x = voice(0.1, () => 300);
    for (const depth of [16, 24, 32] as const) {
      const blob = encodeWav([x, x], SR, depth);
      expect(blob.size).toBe(44 + x.length * 2 * (depth / 8));
      const v = new DataView(await blob.arrayBuffer());
      expect(v.getUint32(24, true)).toBe(SR);
      expect(v.getUint16(22, true)).toBe(2);
      expect(v.getUint16(34, true)).toBe(depth);
    }
    const p = makePeaks([x]);
    expect(p.levels[0].max[0].length).toBe(Math.ceil(x.length / 32));
    expect(Math.max(...p.levels[1].max[0])).toBeGreaterThan(0.3);
  });
  it("answers the exact extremes of any stretch of a sound, however long or short, per channel", () => {
    const n = SR * 3 + 1234;
    const a = noise(n, 0.5), b = noise(n, 0.2);
    // one sample that a careless outline would miss
    a[70001] = 0.97;
    b[12345] = -0.91;
    const p = makePeaks([a, b]);
    const out = new Float32Array(2);
    const brute = (x: Float32Array, from: number, to: number) => {
      let lo = Infinity, hi = -Infinity;
      for (let i = from; i < to; i++) {
        if (x[i] < lo) lo = x[i];
        if (x[i] > hi) hi = x[i];
      }
      return [lo, hi];
    };
    for (const [from, to] of [[0, n], [1, 2], [31, 33], [69990, 70010], [70001, 70002], [100, 100000], [12000, 12400], [4097, 131071], [n - 5, n]]) {
      for (const c of [0, 1]) {
        const want = brute(c ? b : a, from, to);
        rangeOf(p, [a, b], c, from, to, out);
        expect([out[0], out[1]]).toEqual(want);
      }
    }
    expect(rangeOf(p, [a, b], 0, 69000, 71000, out)[1]).toBeCloseTo(0.97);
    expect(rangeOf(p, [a, b], 1, 0, 50000, out)[0]).toBeCloseTo(-0.91);
    expect(Array.from(rangeOf(p, [a, b], 0, 500, 500, out))).toEqual([0, 0]);
  });
});

import { renderPad, renderRhythm, RHYTHMS, rhythmById } from "@/lib/ridha/dsp/rhythm";
import { listenTo } from "@/lib/ridha/dsp/listen";

describe("الرضا فويس: rhythm, floor and listening", () => {
  it("renders every ready rhythm, the same sound each time", () => {
    for (const r of RHYTHMS) {
      const [L, R] = renderRhythm(r.spec, r.bpm[0], 2, SR);
      expect(L.length).toBe(R.length);
      expect(rms(L)).toBeGreaterThan(0.005);
      expect(Math.max(...L.subarray(0, 20000).map(Math.abs))).toBeLessThan(4);
    }
    const a = renderRhythm(rhythmById("latma-2").spec, 70, 1, SR)[0], b = renderRhythm(rhythmById("latma-2").spec, 70, 1, SR)[0];
    expect(Array.from(a.subarray(0, 500))).toEqual(Array.from(b.subarray(0, 500)));
  }, 30_000);
  it("hears back the tempo and the rhythm it rendered", async () => {
    const heard = await listenTo(renderRhythm(rhythmById("clap-332").spec, 90, 12, SR), SR, { voice: false });
    expect(Math.min(Math.abs(heard.bpm - 90), Math.abs(heard.bpm - 180), Math.abs(heard.bpm - 45))).toBeLessThan(2);
    expect(heard.rhythm).toBe("clap-332");
    const lat = await listenTo(renderRhythm(rhythmById("latma-4").spec, 72, 12, SR), SR, { voice: false });
    expect(Math.min(Math.abs(lat.bpm - 72), Math.abs(lat.bpm - 144))).toBeLessThan(2);
    expect(["latma-4", "latma-2", "latma-3"]).toContain(lat.rhythm);
  }, 30_000);
  it("holds a pad on its root and fifth, in stereo, without clipping", async () => {
    const [L, R] = renderPad({ root: 45, kind: "choir", notes: 2, bright: 0.4 }, 4, SR);
    expect(L.length).toBe(4 * SR);
    expect(peakDb([L])).toBeLessThan(0);
    expect(rms(L, SR, 3 * SR)).toBeGreaterThan(0.01);
    expect(Math.abs(L[SR * 2] - R[SR * 2])).toBeGreaterThan(0);
    expect(Math.abs(L[10])).toBeLessThan(0.001);
  });
  it("measures a voice: its key, its noise, its level", async () => {
    const notes = [57, 59, 60, 62, 64, 62, 60, 59, 57, 57];
    const v = voice(notes.length * 0.4, (t) => midiToHz(notes[Math.min(notes.length - 1, Math.floor(t / 0.4))]));
    const x = v.map((s) => s + rand() * 0.003);
    const heard = await listenTo([x], SR);
    expect(heard.voiced).toBeGreaterThan(0.6);
    expect(heard.key?.tonic).toBe(9);
    expect(heard.lufs).toBeGreaterThan(-25);
    expect(heard.lufs).toBeLessThan(-8);
    expect(heard.hum).toBe(0);
    expect(heard.tilt.length).toBe(8);
    // sung without a pause: no floor to read. With a second of room after it: the room's level is the floor.
    expect(heard.noiseDb).toBeNull();
    const withPause = new Float32Array(x.length + SR);
    withPause.set(x);
    for (let i = x.length; i < withPause.length; i++) withPause[i] = rand() * 0.003;
    const floor = (await listenTo([withPause], SR)).noiseDb!;
    expect(floor).toBeLessThan(-50);
    expect(floor).toBeGreaterThan(-62);
  });
});

import { advise, nudgeBands } from "@/lib/ridha/advise";
import { harmonyTips, singHarmony, suggestHarmony, voice as hv, wildHarmony } from "@/lib/ridha/harmony";
import { addGroup, addRecording, addTrack, chooseTake, moveTrack, removeTrack, setGroup, splitClip, takesOf, trimClip, addFx, moveFx, usedSounds } from "@/lib/ridha/ops";
import { audible, defaultBands, groupOf, makeProject, snapTime, barsLabel } from "@/lib/ridha/model";
import { CHAIN_PRESETS, EQ_PRESETS } from "@config/ridha";
import { RIDHA_TRAINING } from "@config/ridha-training";

describe("الرضا فويس: the project and the advice", () => {
  it("stacks takes, cuts them together and picks one per phrase", () => {
    let p = makeProject("t");
    const tid = p.tracks[0].id;
    p = addRecording(p, tid, "a", 0, 8, "one").project;
    const second = addRecording(p, tid, "b", 0, 8, "two");
    p = second.project;
    expect(p.clips.filter((c) => !c.muted).map((c) => c.assetId)).toEqual(["b"]);
    expect(takesOf(p, second.clip).length).toBe(2);
    p = splitClip(p, second.clip.id, 4);
    expect(p.clips.length).toBe(4);
    const leftA = p.clips.find((c) => c.assetId === "a" && c.start === 0)!;
    p = chooseTake(p, leftA.id);
    // the first phrase from take one, the second still from take two
    expect(p.clips.filter((c) => !c.muted).map((c) => `${c.assetId}@${c.start}`).sort()).toEqual(["a@0", "b@4"]);
    const right = p.clips.find((c) => c.assetId === "b" && c.start === 4)!;
    expect(right.offset).toBe(4);
    expect(usedSounds(p).size).toBe(2);
  });
  it("trims inside the recording, snaps to the grid and names positions", () => {
    let p = makeProject("t");
    const c = addRecording(p, p.tracks[0].id, "a", 2, 4, "x").clip;
    p = addRecording(p, p.tracks[0].id, "a", 2, 4, "x").project;
    const id = p.clips[0].id;
    p = trimClip(p, id, "left", 3, 4);
    expect(p.clips[0]).toMatchObject({ start: 3, offset: 1, dur: 3 });
    p = trimClip(p, id, "right", 99, 4);
    expect(p.clips[0].dur).toBe(3);
    p = trimClip(p, id, "left", -5, 4);
    expect(p.clips[0]).toMatchObject({ start: 2, offset: 0 });
    expect(c.dur).toBe(4);
    const q = { ...makeProject("g"), bpm: 120 };
    expect(snapTime(q, 0.74, 200)).toBeCloseTo(0.75);
    expect(snapTime(q, 0.74, 70)).toBeCloseTo(0.5);
    expect(barsLabel(q, 2.25)).toBe("2.1.3");
    const two = addTrack(q);
    let r = addFx(two.project, two.track.id, "comp").project;
    const added = addFx(r, two.track.id, "reverb");
    r = moveFx(added.project, two.track.id, added.fx.id, -1);
    expect(r.tracks[1].fx.map((f) => f.kind)).toEqual(["reverb", "comp"]);
  });
  it("advises by what was measured and what the recording is for", () => {
    const base = { seconds: 60, bpm: 0, beatStrength: 0, rhythm: "latma-4", rhythmFit: 0, lowSteps: [], highSteps: [], key: null, lufs: -24, peak: -6, crest: 14, tilt: [-42, -24, -8, 3.5, 0, -15, -22, -30], ringMs: 520, noiseDb: -42, hum: 50 as const, voiced: 0.6, sibilance: -4 };
    const pod = advise(base, "podcast");
    expect(pod.clean).toMatchObject({ ai: true, hum: true, gate: true });
    expect(pod.clean.noise).toBeGreaterThan(0.8);
    expect(pod.clean.reverb).toBeGreaterThan(0.5);
    expect(pod.clean.deEss).toBeGreaterThan(0.6);
    expect(pod.level).toBe(-16);
    // boxy (250–500 six dB over the reference) and dull: the mud band is cut, presence and air are lifted
    expect(pod.eq[2]).toBeLessThan(0);
    expect(pod.eq[4]).toBeGreaterThan(0);
    const sung = advise(base, "aza");
    // singing: never the speech network, never a gate, a gentler hand
    expect(sung.clean).toMatchObject({ ai: false, gate: false });
    expect(sung.clean.noise).toBeLessThanOrEqual(0.6);
    expect(sung.clean.reverb).toBeLessThan(pod.clean.reverb);
    expect(sung.chain).toBe("radood");
    const quiet = advise({ ...base, noiseDb: -72, hum: 0, ringMs: 150, sibilance: -15, tilt: [-42, -24, -8, -2.5, 0, -9, -16, -26] }, "solo");
    expect(quiet.clean.noise).toBeLessThan(0.2);
    expect(Object.keys(quiet.eq).length).toBe(0);
    // a take with no pause in it: the floor cannot be read, and the advice says so instead of inventing a number
    expect(advise({ ...base, noiseDb: null }, "solo").notes[0]).toContain("بلا فواصل");
    const bands = nudgeBands(defaultBands(), { 2: -3 });
    expect(bands[2].gain).toBe(-3);
  });
  it("orders harmony ideas by the scale: thirds for western keys, unison and octaves for quarter-tone maqamat", () => {
    const range = { low: 50, high: 62, median: 56 };
    const western = suggestHarmony(range, scaleById("minor"));
    expect(western[0].id).toBe("duo");
    expect(western[0].experimental).toBeFalsy();
    const maqam = suggestHarmony(range, scaleById("bayati"));
    expect(maqam[0].id).toBe("unison");
    expect(maqam.find((i) => i.id === "duo")?.experimental).toBe(true);
    // a high voice gets its third underneath
    expect(suggestHarmony({ low: 60, high: 74, median: 67 }, scaleById("major"))[0].voices[0].steps).toBeLessThan(0);
  });
  it("every ready chain and curve is well formed, and the training names what it was measured on", () => {
    for (const c of CHAIN_PRESETS) {
      const fx = c.build();
      expect(fx.length).toBeGreaterThan(0);
      expect(new Set(fx.map((f) => f.id)).size).toBe(fx.length);
      for (const f of fx) if (f.kind === "eq") expect(f.bands?.length).toBe(8);
      // a second build shares no ids with the first (two tracks can carry the same chain)
      expect(c.build()[0].id).not.toBe(fx[0].id);
    }
    for (const e of EQ_PRESETS) expect(e.bands.length).toBe(8);
    expect(RIDHA_TRAINING).toContain("RNNoise");
    expect(RIDHA_TRAINING).not.toMatch(/\$\{/);
  });
});

import { BEEP_HZ, roundTrip } from "@/lib/ridha/dsp/latency";
import { FORMATS } from "@/components/jawad/ridha/encode";

describe("الرضا فويس: latency and formats", () => {
  /** A room recording in which each played beep is heard `delayMs` later, over some hiss. */
  const heard = (delayMs: number, beeps: number[], level = 0.2, hiss = 0.004) => {
    const rec = noise(Math.round(SR * (beeps[beeps.length - 1] + 1.2)), hiss);
    for (const at of beeps) {
      const from = Math.round((at + delayMs / 1000) * SR);
      for (let i = 0; i < SR * 0.008 && from + i < rec.length; i++) rec[from + i] += level * Math.sin((2 * Math.PI * BEEP_HZ * i) / SR);
    }
    return rec;
  };
  const beeps = [0.35, 1.05, 1.75, 2.45, 3.15];
  it("measures the round trip of wired sound and of Bluetooth headphones to the millisecond", () => {
    for (const ms of [12, 187, 264, 410]) expect(Math.abs(roundTrip(heard(ms, beeps), SR, 0, beeps, 0.7)! - ms)).toBeLessThanOrEqual(2);
    // the recording started a little before the clock's zero: the same answer
    expect(Math.abs(roundTrip(heard(187, beeps.map((b) => b + 0.5)), SR, -0.5, beeps, 0.7)! - 187)).toBeLessThanOrEqual(2);
  });
  it("gives no number when the beeps were not heard", () => {
    expect(roundTrip(noise(SR * 4, 0.01), SR, 0, beeps, 0.7)).toBeNull();
    expect(roundTrip(heard(200, beeps, 0.004, 0.01), SR, 0, beeps, 0.7)).toBeNull();
    expect(roundTrip(heard(200, beeps.slice(0, 2)), SR, 0, beeps, 0.7)).toBeNull();
  });
  it("offers WAV first and always, then the compressed formats", () => {
    expect(FORMATS[0]).toMatchObject({ id: "wav", codec: null });
    expect(FORMATS.map((f) => f.ext)).toEqual(["wav", "mp3", "m4a", "flac", "ogg"]);
  });
});

describe("الرضا فويس: the harmony generator and track groups", () => {
  // C major: do re mi sol, each held, with a pause before a second phrase
  const melody = (t: number) => midiToHz([60, 62, 64, 67, 64, 62, 60, 60][Math.min(7, Math.floor(t / 0.4))]);
  it("moves a voice four ways: with the melody, onto the chord only, calmly, or not at all", async () => {
    const x = voice(3.2, melody);
    const t = await trackPitch(x, SR);
    const base = { tonic: 0, scale: scaleById("major"), octaves: 0, detuneCents: 0, tight: 1 };
    const notes = (r: Float32Array) => {
      const out = new Set<number>();
      // read where the voice has settled (between two notes it slides, as a singer does)
      for (let i = 10; i < r.length - 10; i++) {
        if (!t.f0[i] || !t.f0[i - 8]) continue;
        const now = hzToMidi(t.f0[i]) + 12 * Math.log2(r[i]), before = hzToMidi(t.f0[i - 8]) + 12 * Math.log2(r[i - 8]);
        if (Math.abs(now - before) < 0.05) out.add(Math.round(now));
      }
      return [...out].sort((a, b) => a - b);
    };
    // a third above, walking: mi fa sol si
    expect(notes(planHarmony(t, { ...base, steps: 2, motion: "parallel" }))).toEqual(expect.arrayContaining([64, 65, 67, 71]));
    // the same part kept on the chord of C: only do, mi and sol are ever sung
    for (const n of notes(planHarmony(t, { ...base, steps: 2, motion: "chord" }))) expect([0, 4, 7]).toContain(((n % 12) + 12) % 12);
    // a held tonic an octave below the middle of the line: one note, whatever the melody does
    expect(notes(planHarmony(t, { ...base, steps: 0, octaves: -1, motion: "pedal", pedalStep: 0 }))).toEqual([48]);
    expect(notes(planHarmony(t, { ...base, steps: 0, motion: "pedal", pedalStep: 4 }))).toEqual([67]);
    // the calm voice sings fewer different notes than the walking one
    expect(notes(planHarmony(t, { ...base, steps: 2, motion: "lazy" })).length).toBeLessThan(notes(planHarmony(t, { ...base, steps: 2, motion: "parallel" })).length);
  });
  it("lets a voice sing only at the ends of phrases or on held notes", async () => {
    // a phrase, half a second of silence, another phrase
    const x = new Float32Array(SR * 4);
    x.set(voice(1.6, melody), 0);
    x.set(voice(1.6, () => 330), Math.round(SR * 2.2));
    const t = await trackPitch(x, SR);
    const fps = SR / t.hop;
    const ends = harmonyWhen(t, "ends");
    expect(ends[Math.round(0.3 * fps)]).toBe(0);
    expect(ends[Math.round(1.45 * fps)]).toBe(1);
    expect(ends[Math.round(2.4 * fps)]).toBe(0);
    expect(ends[Math.round(3.6 * fps)]).toBe(1);
    expect(harmonyWhen(t, "always").every((v) => v === 1)).toBe(true);
    // the second phrase is one long held note: «long» is open there and shut in the moving first phrase's opening
    const long = harmonyWhen(t, "long");
    expect(long[Math.round(3.2 * fps)]).toBe(1);
    expect(long[Math.round(0.05 * fps)]).toBe(0);
    const y = singHarmony(x, t, pitchMarks(x, t), { tonic: 0, scale: scaleById("major") }, hv("t", 2, 0, 0, { when: "ends" }));
    expect(rms(y, Math.round(0.1 * SR), Math.round(0.6 * SR))).toBeLessThan(0.002);
    expect(rms(y, Math.round(1.2 * SR), Math.round(1.5 * SR))).toBeGreaterThan(0.05);
  });
  it("grows a stack with the madness level, to sixteen voices at most, and never forces thirds on a quarter-tone maqam", () => {
    const range = { low: 50, high: 62, median: 56 };
    const sizes = [1, 2, 3, 4, 5].map((l) => wildHarmony(l, range, scaleById("minor"), 1).voices.length);
    expect(sizes[0]).toBe(1);
    for (let i = 1; i < 5; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    expect(sizes[4]).toBeGreaterThanOrEqual(12);
    expect(sizes[4]).toBeLessThanOrEqual(16);
    for (let seed = 1; seed < 6; seed++) {
      const maqam = wildHarmony(5, range, scaleById("rast"), seed);
      expect(maqam.voices.some((x) => x.motion !== "pedal" && [2, 5, 6].includes(Math.abs(x.steps)))).toBe(false);
      expect(maqam.voices.some((x) => x.motion === "pedal")).toBe(true);
    }
    // the same seed gives the same stack; another seed may differ
    expect(wildHarmony(4, range, scaleById("major"), 3)).toEqual(wildHarmony(4, range, scaleById("major"), 3));
    const ideas = suggestHarmony(range, scaleById("bayati"));
    expect(ideas.slice(0, 3).map((i) => i.id)).toEqual(["unison", "ison", "octaves"]);
    expect(ideas.length).toBeGreaterThanOrEqual(14);
    expect(harmonyTips(ideas[0], scaleById("bayati"))[0]).toContain("أرباع");
    expect(harmonyTips(wildHarmony(5, range, scaleById("major"), 1), scaleById("major")).length).toBeGreaterThanOrEqual(5);
  });
  it("groups tracks: members sit under their group, play through it, and follow its solo and mute", () => {
    let p = makeProject("g");
    const a = p.tracks[0].id;
    const b = addTrack(p);
    p = b.project;
    const c = addTrack(p);
    p = c.project;
    const g = addGroup(p, [b.track.id, c.track.id], "الكورال");
    p = g.project;
    expect(p.tracks.map((t) => t.name)).toEqual(["صوت 1", "الكورال", "صوت 2", "صوت 3"]);
    expect(groupOf(p, p.tracks[2])?.id).toBe(g.track.id);
    // moving a member up cannot take it out from under its group
    p = moveTrack(p, c.track.id, -1);
    expect(p.tracks[1].kind).toBe("group");
    expect(p.tracks.slice(2).every((t) => t.group === g.track.id)).toBe(true);
    // a lone track joins, then leaves
    p = setGroup(p, a, g.track.id);
    expect(p.tracks.map((t) => t.id).indexOf(a)).toBeGreaterThan(p.tracks.findIndex((t) => t.kind === "group"));
    p = setGroup(p, a, null);
    expect(p.tracks.find((t) => t.id === a)!.group).toBeUndefined();
    // a group cannot go inside a group
    expect(setGroup(p, g.track.id, g.track.id)).toBe(p);
    // solo: the group alone lets its members through; a member alone keeps its group open and silences its siblings
    const soloG = { ...p, tracks: p.tracks.map((t) => ({ ...t, solo: t.id === g.track.id })) };
    expect(soloG.tracks.map((t) => audible(soloG, t))).toEqual(soloG.tracks.map((t) => t.id !== a));
    const soloB = { ...p, tracks: p.tracks.map((t) => ({ ...t, solo: t.id === b.track.id })) };
    expect(soloB.tracks.filter((t) => audible(soloB, t)).map((t) => t.id).sort()).toEqual([b.track.id, g.track.id].sort());
    // removing the group frees its members and keeps their clips
    const freed = removeTrack(addRecording(p, b.track.id, "s", 0, 2, "x").project, g.track.id);
    expect(freed.tracks.some((t) => t.group)).toBe(false);
    expect(freed.clips.length).toBe(1);
  });
});

import { ACTIONS_DOC, applyActions, describeStudio, readActions } from "@/lib/ridha/actions";
import { RIDHA_MAX_SYSTEM } from "@config/ridha-max";

describe("الرضا ماكس: his commands", () => {
  const start = () => {
    const p = makeProject("m");
    return { p, tid: p.tracks[0].id };
  };
  it("reads only well-formed commands", () => {
    expect(readActions(['{"do":"tempo","bpm":72}', "not json", '{"no":"do"}', '["x"]', 5, { do: "master", gain: -2 }]).map((a) => a.do)).toEqual(["tempo", "master"]);
    expect(readActions("nope")).toEqual([]);
  });
  it("applies mixer commands to the named track, clamps every number, and reports what it did", () => {
    const { p, tid } = start();
    const r = applyActions(p, readActions([
      '{"do":"chain","track":"selected","preset":"podcast"}',
      '{"do":"fx","track":"' + tid + '","kind":"comp","params":{"threshold":-200,"ratio":3,"bogus":9}}',
      '{"do":"eq","track":"selected","bands":[{"i":0,"freq":95,"on":true},{"i":2,"gain":-40},{"i":99,"gain":3}]}',
      '{"do":"track","track":"صوت 1","gain":50,"sendReverb":0.3,"stereo":true}',
      '{"do":"room","decay":3.2,"predelay":900}',
      '{"do":"key","tonic":2,"scale":"bayati"}',
      '{"do":"tempo","bpm":72}',
      '{"do":"master","gain":-1}',
    ]), tid);
    const t = r.project.tracks[0];
    expect(t.fx.map((f) => f.kind)).toEqual(["eq", "gate", "comp", "deess", "limiter"]);
    const comp = t.fx.find((f) => f.kind === "comp")!;
    expect(comp.p.threshold).toBe(-60);
    expect(comp.p.ratio).toBe(3);
    expect(comp.p.bogus).toBeUndefined();
    const bands = t.fx[0].bands!;
    expect(bands[0]).toMatchObject({ on: true, freq: 95 });
    expect(bands[2].gain).toBe(-18);
    expect(t).toMatchObject({ gain: 6, sendReverb: 0.3, stereo: true });
    expect(r.project.reverb).toMatchObject({ decay: 3.2, predelay: 150 });
    expect(r.project.key).toEqual({ tonic: 2, scale: "bayati" });
    expect(r.project.bpm).toBe(72);
    expect(r.project.master.gain).toBe(-1);
    expect(r.done.length).toBe(8);
    expect(r.skipped).toEqual([]);
    // the project he was given is untouched: the whole answer is one undo step
    expect(p.tracks[0].fx).toEqual([]);
  });
  it("refuses what it does not know and hands clip work back as jobs", () => {
    const { p, tid } = start();
    const r = applyActions(p, readActions([
      '{"do":"chain","preset":"nope"}',
      '{"do":"fx","kind":"laser"}',
      '{"do":"track","track":"ghost","gain":0}',
      '{"do":"format_disk"}',
      '{"do":"clean","use":"podcast","noise":3,"gate":true}',
      '{"do":"tune","strength":0.7}',
      '{"do":"loudness","lufs":-16}',
    ]), tid);
    expect(r.project).toBe(p);
    expect(r.skipped.length).toBe(4);
    expect(r.jobs).toEqual([
      { do: "clean", use: "podcast", options: { noise: 1, gate: true }, level: null },
      { do: "tune", strength: 0.7, speedMs: 120, transpose: 0 },
      { do: "loudness", lufs: -16 },
    ]);
  });
  it("writes the studio out for him, and his instructions name every command and the training", () => {
    const { p, tid } = start();
    const withFx = applyActions(p, readActions(['{"do":"chain","preset":"radood"}']), tid).project;
    const text = describeStudio(withFx, tid, null, null);
    expect(text).toContain(`track id=${tid}`);
    expect(text).toContain("[SELECTED]");
    expect(text).toContain("comp{");
    expect(text).toContain("no clip is selected");
    for (const cmd of ["chain", "fx", "remove_fx", "eq", "track", "room", "echo", "master", "key", "tempo", "clean", "tune", "loudness"]) expect(ACTIONS_DOC).toContain(`"do":"${cmd}"`);
    expect(RIDHA_MAX_SYSTEM).toContain("الرضا ماكس");
    expect(RIDHA_MAX_SYSTEM).toContain("<training>");
    expect(RIDHA_MAX_SYSTEM).not.toMatch(/\$\{|undefined/);
  });
});

import { changeVoice, holdPitch, middleHz, VOICE_CHARACTERS } from "@/lib/ridha/dsp/voice";

describe("الرضا فويس: changing the voice", () => {
  /** A man speaking: three «words» whose note moves, each dying away into a faint, breathy end. */
  const man = () => {
    const x = new Float32Array(SR * 3);
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR, w = t % 1;
      const hz = 118 + 14 * Math.sin(2 * Math.PI * 0.8 * t);
      ph += (2 * Math.PI * hz) / SR;
      // strong for half a second, then a long faint tail (the part a note-finder gives up on)
      const level = w < 0.5 ? 0.3 : 0.3 * Math.exp(-(w - 0.5) / 0.09);
      x[i] = level * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph) + 0.15 * Math.sin(4 * ph)) + rand() * 0.0006;
    }
    return x;
  };
  /** How much of a sound sits at one exact frequency (a narrow probe). */
  const at = (x: Float32Array, hz: number, a: number, b: number) => {
    let re = 0, im = 0;
    for (let i = a; i < b; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - a)) / (b - a));
      re += x[i] * w * Math.cos((2 * Math.PI * hz * i) / SR);
      im += x[i] * w * Math.sin((2 * Math.PI * hz * i) / SR);
    }
    return Math.hypot(re, im) / (b - a);
  };
  it("lands every realistic character in its own range, from this speaker's own middle, at the same length and level", async () => {
    const x = man();
    const from = middleHz(await trackPitch(x, SR));
    expect(Math.abs(from - 118)).toBeLessThan(8);
    for (const id of ["child", "woman", "elder", "deep"]) {
      const c = VOICE_CHARACTERS.find((v) => v.id === id)!;
      const y = await changeVoice(x, SR, c);
      expect(y.length).toBe(x.length);
      const got = middleHz(await trackPitch(y, SR, { fmax: 1100 }));
      const want = c.targetHz ?? from * c.ratio!;
      expect(Math.abs(12 * Math.log2(got / want)), `${id}: ${got.toFixed(0)} Hz, wanted ${want.toFixed(0)}`).toBeLessThan(1.2);
      expect(rms(y) / rms(x)).toBeGreaterThan(0.7);
      expect(rms(y) / rms(x)).toBeLessThan(1.4);
      for (let i = 0; i < y.length; i += 997) expect(Number.isFinite(y[i])).toBe(true);
    }
  }, 60_000);
  it("leaves none of the original voice behind, even in the faint ends of words", async () => {
    const x = man();
    const y = await changeVoice(x, SR, VOICE_CHARACTERS.find((v) => v.id === "woman")!);
    // the faint tail of the first word (0.62–0.80 s): how much is still at the man's own note there?
    const a = Math.round(0.62 * SR), b = Math.round(0.8 * SR);
    const hz = 118 + 14 * Math.sin(2 * Math.PI * 0.8 * 0.71);
    const before = at(x, hz, a, b) + at(x, 2 * hz, a, b);
    const after = at(y, hz, a, b) + at(y, 2 * hz, a, b);
    expect(after / before).toBeLessThan(0.25);
    // and the tail is still there — moved, not deleted
    expect(rms(y, a, b)).toBeGreaterThan(rms(x, a, b) * 0.3);
  }, 60_000);
  it("carries the note over the gaps a note-finder leaves in voice, but not over a hiss", async () => {
    const x = man();
    const found = await trackPitch(x, SR);
    const held = holdPitch(x, found);
    const voiced = (t: PitchTrack) => t.f0.reduce((n, v) => n + (v ? 1 : 0), 0);
    expect(voiced(held)).toBeGreaterThanOrEqual(voiced(found));
    // a pure «س»: nothing to hold
    const sss = new Float32Array(SR);
    for (let i = 0; i < sss.length; i++) sss[i] = rand() * 0.2;
    const hiss = filter(sss, biquad("highpass", SR, 5000));
    const t2 = await trackPitch(hiss, SR);
    expect(voiced(holdPitch(hiss, t2))).toBe(voiced(t2));
  });
});

import { buildChoir } from "@/lib/ridha/choir";
import { CHOIRS, CHOIR_TONES } from "@config/ridha-choirs";

describe("الرضا فويس: choirs", () => {
  it("lays every choir out as mono parts inside one group, each with its instruction, place, level and tone", () => {
    for (const kind of CHOIRS) {
      const base = makeProject("c");
      const made = buildChoir(base, kind);
      const group = made.project.tracks.find((t) => t.id === made.groupId)!;
      const parts = made.project.tracks.filter((t) => t.group === made.groupId);
      expect(group.kind).toBe("group");
      expect(parts.length, kind.id).toBe(kind.parts.length);
      expect(parts.length).toBeGreaterThanOrEqual(3);
      // the parts sit right under their group, in order
      const gi = made.project.tracks.indexOf(group);
      expect(made.project.tracks.slice(gi + 1, gi + 1 + parts.length).map((t) => t.name)).toEqual(kind.parts.map((x) => x.name));
      parts.forEach((t, i) => {
        expect(t.stereo).toBe(false);
        expect(t.note).toBe(kind.parts[i].sing);
        expect(t.note!.length).toBeGreaterThan(8);
        expect(t.pan).toBe(kind.parts[i].pan);
        expect(t.gain).toBeLessThan(0);
        expect(t.fx[0].kind).toBe("eq");
        expect(t.fx[0].bands![0].on).toBe(true);
      });
      // only the first part is ready to record; the group carries the glue and the reverb
      expect(made.project.tracks.filter((t) => t.arm).map((t) => t.id)).toEqual([made.first]);
      expect(group.fx.some((f) => f.kind === "comp")).toBe(true);
      expect(group.sendReverb).toBe(kind.reverb);
      // spread across the stereo field, not piled in the middle
      const pans = parts.map((t) => t.pan);
      expect(Math.max(...pans) - Math.min(...pans)).toBeGreaterThanOrEqual(0.6);
      // what was in the project stays
      expect(made.project.tracks[0].id).toBe(base.tracks[0].id);
    }
    for (const tone of Object.values(CHOIR_TONES)) expect(tone.length).toBeLessThanOrEqual(8);
    expect(new Set(CHOIRS.map((c) => c.id)).size).toBe(CHOIRS.length);
  });
});

describe("الرضا فويس: the level tools, the punch and the master", () => {
  // a quiet phrase, a second of room hiss, a loud phrase
  const talk = () => {
    const x = new Float32Array(3 * SR);
    x.set(voice(1, () => 180, 0.04), 0);
    x.set(voice(1, () => 200, 0.32), 2 * SR);
    for (let i = 0; i < x.length; i++) x[i] += rand() * 0.0006;
    return x;
  };

  it("finds where somebody speaks and the silences between", async () => {
    const { findSound, gapsOf } = await import("@/lib/ridha/dsp/level");
    const regions = findSound([talk()], SR, { minSilence: 0.4, relDb: -36 });
    expect(regions).toHaveLength(2);
    expect(regions[0].a).toBeLessThan(0.05);
    expect(regions[0].b).toBeGreaterThan(0.95);
    expect(regions[0].b).toBeLessThan(1.25);
    expect(regions[1].a).toBeGreaterThan(1.75);
    expect(regions[1].a).toBeLessThan(2.05);
    const gaps = gapsOf(regions, 3);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].b - gaps[0].a).toBeGreaterThan(0.6);
    // a pause shorter than the limit stays inside the phrase
    expect(findSound([talk()], SR, { minSilence: 1.5, relDb: -36 })).toHaveLength(1);
  });

  it("rides a voice's level: the quiet phrase comes up, the loud one down, the silence stays silent", async () => {
    const { rideLevel } = await import("@/lib/ridha/dsp/level");
    const x = talk();
    const { channels, report } = rideLevel([x], SR, { range: 8, speed: 0.2 });
    const y = channels[0];
    const quiet = rms(y, Math.round(0.3 * SR), Math.round(0.7 * SR)) / rms(x, Math.round(0.3 * SR), Math.round(0.7 * SR));
    const loud = rms(y, Math.round(2.3 * SR), Math.round(2.7 * SR)) / rms(x, Math.round(2.3 * SR), Math.round(2.7 * SR));
    expect(quiet).toBeGreaterThan(1.5);
    expect(loud).toBeLessThan(0.7);
    expect(report.after).toBeLessThan(report.before - 6);
    expect(report.up).toBeLessThanOrEqual(8.01);
    expect(report.down).toBeLessThanOrEqual(8.01);
    // the hiss between the phrases is not pumped past what the phrases themselves got
    expect(rms(y, Math.round(1.4 * SR), Math.round(1.6 * SR))).toBeLessThan(rms(x, Math.round(1.4 * SR), Math.round(1.6 * SR)) * 2.6);
    // silence in, the same silence out
    const hush = new Float32Array(SR);
    expect(rideLevel([hush], SR).channels[0]).toBe(hush);
  });

  it("dips music under a voice and brings it back", async () => {
    const { duckGain, applyGain } = await import("@/lib/ridha/dsp/level");
    const g = duckGain(5 * SR, SR, [{ a: 1.5, b: 2.5 }], { depthDb: -12, down: 0.3, hold: 0.5, up: 0.8 });
    expect(g[0]).toBeCloseTo(1, 5);
    expect(g[Math.round(1.1 * SR)]).toBeCloseTo(1, 5);
    expect(g[Math.round(1.35 * SR)]).toBeLessThan(1);
    expect(g[Math.round(1.35 * SR)]).toBeGreaterThan(0.26);
    expect(g[Math.round(1.5 * SR)]).toBeCloseTo(10 ** (-12 / 20), 3);
    expect(g[Math.round(2.9 * SR)]).toBeCloseTo(10 ** (-12 / 20), 3);
    expect(g[Math.round(3.4 * SR)]).toBeGreaterThan(0.3);
    expect(g[Math.round(4 * SR)]).toBeCloseTo(1, 5);
    const music = new Float32Array(5 * SR).fill(0.5);
    expect(applyGain([music], g)[0][2 * SR]).toBeCloseTo(0.5 * 10 ** (-12 / 20), 3);
  });

  it("cuts a clip down to its phrases, in place or pulled together", async () => {
    const { makeProject } = await import("@/lib/ridha/model");
    const { addClip, stripSilence } = await import("@/lib/ridha/ops");
    const base = makeProject("t");
    const tid = base.tracks[0].id;
    const a = addClip(base, { trackId: tid, assetId: "s", start: 10, dur: 3, name: "كلام" });
    const b = addClip(a.project, { trackId: tid, assetId: "s2", start: 14, dur: 2, name: "بعده" });
    const regions = [{ a: 0, b: 1 }, { a: 2, b: 3 }];
    const kept = stripSilence(b.project, a.clip.id, regions);
    expect(kept.ids).toHaveLength(2);
    const [p1, p2] = kept.ids.map((id) => kept.project.clips.find((c) => c.id === id)!);
    expect([p1.start, p1.offset, p1.dur]).toEqual([10, 0, 1]);
    expect([p2.start, p2.offset, p2.dur]).toEqual([12, 2, 1]);
    expect(kept.project.clips.find((c) => c.id === b.clip.id)!.start).toBe(14);
    const closed = stripSilence(b.project, a.clip.id, regions, true, 0.2);
    const q2 = closed.project.clips.find((c) => c.id === closed.ids[1])!;
    expect(q2.start).toBeCloseTo(11.2, 6);
    // what follows on the track moves earlier by what was removed
    expect(closed.project.clips.find((c) => c.id === b.clip.id)!.start).toBeCloseTo(14 - 0.8, 6);
    expect(stripSilence(b.project, a.clip.id, []).project).toBe(b.project);
  });

  it("punches a new take into a stretch and leaves the rest of the old one playing", async () => {
    const { makeProject } = await import("@/lib/ridha/model");
    const { addClip, punchRecording, takesOf } = await import("@/lib/ridha/ops");
    const base = makeProject("t");
    const tid = base.tracks[0].id;
    const old = addClip(base, { trackId: tid, assetId: "old", start: 0, dur: 10, name: "قديم" });
    const r = punchRecording(old.project, tid, "new", 4, 6, "جديد");
    const clips = r.project.clips.filter((c) => c.trackId === tid).sort((x, y) => x.start - y.start || Number(x.muted) - Number(y.muted));
    expect(clips).toHaveLength(4);
    const playing = clips.filter((c) => !c.muted).map((c) => [c.assetId, c.start, c.dur]);
    expect(playing).toEqual([["old", 0, 4], ["new", 4, 2], ["old", 6, 4]]);
    const waiting = clips.find((c) => c.muted)!;
    expect([waiting.assetId, waiting.start, waiting.dur, waiting.offset]).toEqual(["old", 4, 2, 4]);
    // the old middle and the new take are takes of each other
    expect(takesOf(r.project, r.clip).map((c) => c.assetId).sort()).toEqual(["new", "old"]);
  });

  it("builds a master by style and strength, and matches a reference's tone", async () => {
    const { buildMaster, MASTER_STYLES, matchTone, toneOf, TONE_FREQS } = await import("@/lib/ridha/master");
    for (const s of MASTER_STYLES) {
      const fx = buildMaster(s.id, 3);
      expect(fx[0].kind).toBe("eq");
      expect(fx[fx.length - 1].kind).toBe("limiter");
      expect(fx.some((f) => f.kind === "comp")).toBe(true);
      expect(fx[0].bands!.slice(1, 7).map((b) => b.freq)).toEqual(TONE_FREQS);
    }
    const soft = buildMaster("loud", 1), hard = buildMaster("loud", 5);
    const lim = (fx: typeof soft) => fx[fx.length - 1].p.threshold;
    expect(lim(hard)).toBeLessThan(lim(soft) - 3);
    expect(Math.abs(hard[0].bands![6].gain)).toBeGreaterThan(Math.abs(soft[0].bands![6].gain));
    // a matched reference is added on top of the style
    const plain = buildMaster("balanced", 3), matched = buildMaster("balanced", 3, [0, 0, 0, 0, 0, 3]);
    expect(matched[0].bands![6].gain - plain[0].bands![6].gain).toBeCloseTo(3, 5);

    const noise = new Float32Array(4 * SR);
    for (let i = 0; i < noise.length; i++) noise[i] = rand() * 0.2;
    const bright = filter(noise, biquad("highshelf", SR, 7000, 0.7, 8));
    const same = matchTone(toneOf([noise], SR), toneOf([noise], SR));
    expect(same.every((g) => g === 0)).toBe(true);
    const need = matchTone(toneOf([noise], SR), toneOf([bright], SR), 1, 9);
    expect(need[5]).toBeGreaterThan(4);
    expect(need[5] - need[1]).toBeGreaterThan(5);
    // the other way round the top comes down
    expect(matchTone(toneOf([bright], SR), toneOf([noise], SR), 1, 9)[5]).toBeLessThan(-4);
  });
});
