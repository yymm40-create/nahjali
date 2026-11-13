// «الرضا فويس» — the auto-tune's judgement: for every reading of the voice, which note of the chosen scale it is
// reaching for and how far (and how fast) to pull it there. The pulling itself is psola.ts.

import { hzToMidi, type PitchTrack } from "./pitch";
import { snap, stepFrom, type Scale } from "./scales";

export interface TuneOptions {
  /** the tonic, in semitones from C (a half for a quarter-tone tonic) */
  tonic: number;
  scale: Scale;
  /** 0–1: how much of the distance to the note is corrected */
  strength: number;
  /** how long the voice takes to arrive at the note, in ms: 0 is the hard robotic effect, 80–150 sounds natural */
  speedMs: number;
  /** the whole line moved up or down, in semitones */
  transpose: number;
}

export interface TunePlan {
  /** what was sung, as fractional MIDI notes (0 where nothing is sung) */
  sung: Float32Array;
  /** the scale note each reading is pulled toward */
  target: Float32Array;
  /** what comes out after the pull */
  tuned: Float32Array;
  /** the multiplier psola applies at each reading */
  ratio: Float32Array;
}

/** The note the voice is on at each reading, steadied so a vibrato does not flicker between two neighbours. */
function heldNotes(sung: Float32Array, tonic: number, scale: Scale) {
  const notes: ({ midi: number; degree: number; octave: number } | null)[] = new Array(sung.length).fill(null);
  let cur: { midi: number; degree: number; octave: number } | null = null;
  const win: number[] = [];
  for (let i = 0; i < sung.length; i++) {
    if (!sung[i]) {
      cur = null;
      continue;
    }
    win.length = 0;
    for (let j = i - 3; j <= i + 3; j++) if (j >= 0 && j < sung.length && sung[j]) win.push(sung[j]);
    win.sort((a, b) => a - b);
    const steady = win[win.length >> 1];
    const near = snap(steady, tonic, scale);
    // a new note has to be clearly nearer than the one being held
    if (!cur || Math.abs(steady - cur.midi) - Math.abs(steady - near.midi) > 0.15) cur = near;
    notes[i] = cur;
  }
  return notes;
}

export function planTune(t: PitchTrack, o: TuneOptions): TunePlan {
  const n = t.f0.length;
  const sung = new Float32Array(n), target = new Float32Array(n), tuned = new Float32Array(n), ratio = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) if (t.f0[i]) sung[i] = hzToMidi(t.f0[i]);
  const notes = heldNotes(sung, o.tonic, o.scale);
  const hopMs = (t.hop / t.sr) * 1000;
  const alpha = o.speedMs <= hopMs ? 1 : 1 - Math.exp(-hopMs / o.speedMs);
  let offset = 0;
  let inNote = false;
  for (let i = 0; i < n; i++) {
    const note = notes[i];
    if (!note) {
      inNote = false;
      continue;
    }
    const want = (note.midi - sung[i]) * o.strength;
    // a phrase starts already on its note; after that the pull follows at the chosen speed (a vibrato survives a slow one)
    offset = inNote ? offset + alpha * (want - offset) : want;
    inNote = true;
    target[i] = note.midi + o.transpose;
    tuned[i] = sung[i] + offset + o.transpose;
    ratio[i] = 2 ** ((offset + o.transpose) / 12);
  }
  return { sung, target, tuned, ratio };
}

export type HarmonyMotion = "parallel" | "chord" | "lazy" | "pedal" | "fixed";

export interface HarmonyLine {
  tonic: number;
  scale: Scale;
  /** scale steps from the line: 2 a third above, −2 a third below, 4 a fifth, 5 a sixth, 6 a seventh; 0 unison */
  steps: number;
  octaves: number;
  detuneCents: number;
  /**
   * how the voice moves: «parallel» walks with the melody at its interval; «chord» does the same but lands only on
   * the notes of the key's own chord (1-3-5), so it never rubs; «lazy» stays where it is until the melody has moved
   * well away (the calm inner voice of a choir); «pedal» holds ONE note under everything — the ison of old chant;
   * «fixed» is the way a maqam singer is taught to harmonise (the method of the engineer علي البقال): the line is
   * moved by ONE fixed distance — the distance of `steps` measured from the tonic, a third, a fifth or a seventh —
   * and wherever that lands a note OUTSIDE the scale (which is what makes a harmony «نشاز»), the note is moved one
   * step further, onto the scale's next note in the same direction.
   */
  motion?: HarmonyMotion;
  /** for «pedal»: which step of the scale is held (0 the tonic, 4 its fifth) */
  pedalStep?: number;
  /** 0–1: how exactly the voice sits on its notes. 0 keeps the singer's own bends and vibrato; 1 is a tuned choir. */
  tight?: number;
}

/** The multiplier, at each reading, that turns the sung line into the harmony line. */
export function planHarmony(t: PitchTrack, o: HarmonyLine): Float32Array {
  const n = t.f0.length;
  const sung = new Float32Array(n);
  const all: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!t.f0[i]) continue;
    sung[i] = hzToMidi(t.f0[i]);
    all.push(sung[i]);
  }
  const notes = heldNotes(sung, o.tonic, o.scale);
  const ratio = new Float32Array(n).fill(1);
  const motion = o.motion ?? "parallel";
  const tight = o.tight ?? 0;
  const size = o.scale.cents.length;
  // the key's own chord: the first, third and fifth notes of the scale (for a seven-note scale)
  const chordSteps = size >= 7 ? [0, 2, 4] : [0];
  const onChord = (midi: number) => {
    let best = midi, d = Infinity;
    for (let oct = -4; oct <= 5; oct++) {
      for (const st of chordSteps) {
        const c = o.tonic + oct * 12 + o.scale.cents[st] / 100;
        if (Math.abs(c - midi) < d) {
          d = Math.abs(c - midi);
          best = c;
        }
      }
    }
    return best;
  };
  // the held note of a pedal: its scale step, in the octave nearest the middle of the line (then moved by whole octaves)
  all.sort((p, q) => p - q);
  const middle = all.length ? all[all.length >> 1] : 60;
  const pc = o.tonic + o.scale.cents[Math.min(size - 1, Math.max(0, o.pedalStep ?? 0))] / 100;
  const pedal = pc + 12 * Math.round((middle - pc) / 12) + 12 * o.octaves;

  // «fixed»: the distance, in semitones, of `steps` scale steps counted from the tonic (a kurd third is 3, an ajam
  // third 4), always the same; a note it lands outside the scale is carried one more step in the same direction
  const n7 = o.scale.cents.length;
  const fixedSemis = (Math.floor(o.steps / n7) * 1200 + o.scale.cents[((o.steps % n7) + n7) % n7]) / 100 + 12 * o.octaves;
  const fixedTarget = (from: number) => {
    const raw = from + fixedSemis;
    const near = snap(raw, o.tonic, o.scale);
    if (Math.abs(near.midi - raw) < 0.26) return near.midi;
    const dir = fixedSemis >= 0 ? 1 : -1;
    // the scale's next note beyond the raw one, in the direction the voice was moved
    const beyond = stepFrom(near, (near.midi - raw) * dir > 0 ? 0 : dir, o.tonic, o.scale);
    return beyond;
  };
  let glide = 0, held = 0;
  let inNote = false;
  for (let i = 0; i < n; i++) {
    const note = notes[i];
    if (!note) {
      inNote = false;
      continue;
    }
    const walk = stepFrom(note, o.steps, o.tonic, o.scale) + 12 * o.octaves;
    let target = walk;
    if (motion === "fixed") target = fixedTarget(note.midi);
    else if (motion === "pedal") target = pedal;
    else if (motion === "chord") target = onChord(walk);
    else if (motion === "lazy") {
      // stays put until the melody's own harmony note is more than a whole tone away, or the phrase begins
      if (!inNote || Math.abs(walk - held) > 2.2) held = walk;
      target = held;
    }
    // the voice keeps the singer's own bend around the note, less of it the tighter it is asked to be
    const want = target + (1 - tight) * (sung[i] - note.midi) - sung[i];
    glide = inNote ? glide + 0.35 * (want - glide) : want;
    inNote = true;
    ratio[i] = 2 ** ((glide + o.detuneCents / 100) / 12);
  }
  return ratio;
}

/**
 * Where a harmony voice sings, as a 0–1 level per reading: all the time, only as each phrase comes to its end, or
 * only on the notes the singer holds. (A harmony that rests and comes back on the landing notes leaves the words
 * to the lead.) Edges are faded so nothing switches on.
 */
export function harmonyWhen(t: PitchTrack, when: "always" | "ends" | "long"): Float32Array {
  const n = t.f0.length;
  const level = new Float32Array(n).fill(when === "always" ? 1 : 0);
  if (when === "always") return level;
  const fps = t.sr / t.hop;
  const gap = Math.round(fps * 0.25);
  // phrases: stretches of singing with no silence longer than a quarter second inside them
  let start = -1, last = -1;
  const close = (a: number, b: number) => {
    if (when === "ends") {
      const len = b - a;
      const from = b - Math.max(Math.round(fps * 0.45), Math.round(len * 0.38));
      for (let i = Math.max(a, from); i <= b; i++) level[i] = 1;
    } else {
      // held notes: runs where the pitch stays within a third of a semitone for 350 ms or more
      let s = a;
      for (let i = a + 1; i <= b + 1; i++) {
        const same = i <= b && t.f0[i] && t.f0[s] && Math.abs(12 * Math.log2(t.f0[i] / t.f0[s])) < 0.6;
        if (same) continue;
        if (i - s >= fps * 0.35) for (let k = s + Math.round(fps * 0.12); k < i; k++) level[k] = 1;
        s = i;
      }
    }
  };
  for (let i = 0; i < n; i++) {
    if (!t.f0[i]) continue;
    if (start < 0) start = i;
    else if (i - last > gap) {
      close(start, last);
      start = i;
    }
    last = i;
  }
  if (start >= 0) close(start, last);
  // 80 ms of fade on each side of every opening
  const fade = Math.max(1, Math.round(fps * 0.08));
  const out = new Float32Array(n);
  let run = 0;
  for (let i = 0; i < n; i++) {
    run += level[i] - (i >= fade ? level[i - fade] : 0);
    out[i] = Math.min(1, run / fade);
  }
  return out;
}
