// «الرضا فويس» — the scales it tunes to and listens for: the western ones and the Arabic maqamat with their
// quarter tones (a step is written in cents: 100 = a semitone, 50 = a quarter tone), and the key finder.

import { hzToMidi, type PitchTrack } from "./pitch";
import { FFT, hann } from "./fft";

export interface Scale {
  id: string;
  name: string;
  family: "western" | "maqam" | "free";
  /** the scale's notes above its tonic, in cents */
  cents: number[];
}

export const SCALES: Scale[] = [
  { id: "chromatic", name: "كروماتيك (كل أنصاف النغمات)", family: "free", cents: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100] },
  { id: "major", name: "ماجور (عجم)", family: "western", cents: [0, 200, 400, 500, 700, 900, 1100] },
  { id: "minor", name: "مينور (نهاوند طبيعي)", family: "western", cents: [0, 200, 300, 500, 700, 800, 1000] },
  { id: "harmonic", name: "مينور هارموني (نهاوند)", family: "western", cents: [0, 200, 300, 500, 700, 800, 1100] },
  { id: "kurd", name: "كرد", family: "maqam", cents: [0, 100, 300, 500, 700, 800, 1000] },
  { id: "hijaz", name: "حجاز", family: "maqam", cents: [0, 100, 400, 500, 700, 800, 1000] },
  { id: "bayati", name: "بيات", family: "maqam", cents: [0, 150, 300, 500, 700, 800, 1000] },
  { id: "rast", name: "رست", family: "maqam", cents: [0, 200, 350, 500, 700, 900, 1050] },
  { id: "saba", name: "صبا", family: "maqam", cents: [0, 150, 300, 400, 700, 800, 1000] },
  { id: "sikah", name: "سيكاه", family: "maqam", cents: [0, 150, 350, 550, 700, 850, 1050] },
];
export const scaleById = (id: string) => SCALES.find((s) => s.id === id) ?? SCALES[0];
export const hasQuarterTones = (s: Scale) => s.cents.some((c) => c % 100 !== 0);

/** The twelve tonics as people say them here, from C. */
export const NOTE_NAMES = ["دو", "دو♯", "ري", "مي♭", "مي", "فا", "فا♯", "صول", "لا♭", "لا", "سي♭", "سي"];
export const NOTE_LATIN = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
/** A note's name from its MIDI number («لا 3», with ½ when it sits on a quarter tone). */
export function noteLabel(midi: number): string {
  const q = Math.round(midi * 2) / 2;
  const whole = Math.floor(q);
  const name = NOTE_NAMES[((whole % 12) + 12) % 12];
  return `${name}${q !== whole ? "½" : ""} ${Math.floor(whole / 12) - 1}`;
}

/** The scale's note nearest to `midi` (a fractional MIDI number), with its place in the scale. */
export function snap(midi: number, tonic: number, scale: Scale): { midi: number; degree: number; octave: number } {
  const rel = (midi - tonic) * 100;
  const octave = Math.floor(rel / 1200);
  const within = rel - octave * 1200;
  let best = 0, bestD = Infinity, bestOct = octave;
  for (let i = 0; i <= scale.cents.length; i++) {
    // the tonic an octave up is a candidate too (a note just under it belongs to it)
    const c = i === scale.cents.length ? 1200 : scale.cents[i];
    const d = Math.abs(within - c);
    if (d < bestD) {
      bestD = d;
      best = i === scale.cents.length ? 0 : i;
      bestOct = i === scale.cents.length ? octave + 1 : octave;
    }
  }
  return { midi: tonic + bestOct * 12 + scale.cents[best] / 100, degree: best, octave: bestOct };
}

/** The note `steps` scale steps above (or below) a scale note. */
export function stepFrom(at: { degree: number; octave: number }, steps: number, tonic: number, scale: Scale): number {
  const n = scale.cents.length;
  const total = at.degree + steps;
  const octave = at.octave + Math.floor(total / n);
  const degree = ((total % n) + n) % n;
  return tonic + octave * 12 + scale.cents[degree] / 100;
}

export interface KeyGuess {
  /** the tonic's pitch class, 0 = C … 11 = B (a half for a quarter-tone tonic) */
  tonic: number;
  scale: Scale;
  /** 0–1: how much better it fits than a scale picked blindly */
  confidence: number;
  label: string;
}

const label = (tonic: number, scale: Scale) => `${NOTE_NAMES[Math.floor(tonic) % 12]}${tonic % 1 ? "½" : ""} · ${scale.name}`;

/**
 * The key of a sung line, from its pitch track: how long the voice sat on each quarter tone, matched against every
 * scale on every tonic. The tonic and the fifth weigh most, a note outside the scale counts against it, and the
 * note the line comes to rest on at its end is a strong word for the tonic (the «قرار»).
 */
export function detectKey(t: PitchTrack, scales: Scale[] = SCALES.filter((s) => s.family !== "free")): KeyGuess[] {
  // only steady moments count: a glide between two notes says nothing about the scale
  const steady: number[] = [];
  for (let i = 0; i < t.f0.length; i++) {
    if (!t.f0[i]) continue;
    const m = hzToMidi(t.f0[i]);
    const prev = i > 0 && t.f0[i - 1] ? hzToMidi(t.f0[i - 1]) : m;
    if (Math.abs(m - prev) <= 0.35) steady.push(m);
  }
  if (steady.length < 20) return [];
  // A singer without an instrument drifts: the whole line may sit some cents off concert pitch. How far off is read
  // against the quarter-tone grid — which leaves two readings (30 cents flat, or 20 sharp of the quarter tone below);
  // both are tried, and the one that needs the smaller excuse wins: less drift, a tonic on a plain note.
  let sx = 0, sy = 0;
  for (const m of steady) {
    const a = (2 * Math.PI * ((m * 100) % 50)) / 50;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  const drift = (Math.atan2(sy, sx) / (2 * Math.PI)) * 50;
  const out: KeyGuess[] = [];
  for (const off of [drift, drift > 0 ? drift - 50 : drift + 50]) {
    const hist = new Float32Array(24);
    for (const m of steady) hist[((Math.round((m - off / 100) * 2) % 24) + 24) % 24]++;
    // the resting note («القرار»): the commonest quarter tone in the last second and a half of singing
    const rest = new Float32Array(24);
    for (const m of steady.slice(-150)) rest[((Math.round((m - off / 100) * 2) % 24) + 24) % 24]++;
    let restBin = 0;
    for (let b = 1; b < 24; b++) if (rest[b] > rest[restBin]) restBin = b;
    // a singer's note spills into its neighbours: each bin lends a little to the quarter tones beside it
    const h = new Float32Array(24);
    for (let b = 0; b < 24; b++) h[b] = (hist[b] + 0.35 * (hist[(b + 1) % 24] + hist[(b + 23) % 24])) / steady.length;
    for (const scale of scales) {
      const quarter = hasQuarterTones(scale);
      for (let tb = 0; tb < 24; tb += quarter ? 1 : 2) {
        const w = new Float32Array(24).fill(-0.9);
        scale.cents.forEach((c, i) => {
          w[(tb + c / 50) % 24] = i === 0 ? 2 : c === 700 ? 1.5 : c === 500 || i === 2 ? 1.2 : 1;
        });
        let s = 0;
        for (let b = 0; b < 24; b++) s += h[b] * w[b];
        if (restBin === tb) s += 0.35;
        s -= 0.004 * Math.abs(off) + (tb % 2 ? 0.15 : 0);
        out.push({ tonic: tb / 2, scale, confidence: s, label: label(tb / 2, scale) });
      }
    }
  }
  out.sort((a, b) => b.confidence - a.confidence);
  // one answer per scale kind, then how far ahead each is of the field
  const mean = out.reduce((a, g) => a + g.confidence, 0) / out.length;
  const top = out[0].confidence;
  const seen = new Set<string>();
  const picked = out.filter((g) => (seen.has(g.scale.id) ? false : (seen.add(g.scale.id), true))).slice(0, 6);
  return picked.map((g) => ({ ...g, confidence: Math.max(0, Math.min(1, (g.confidence - mean) / (top - mean + 1e-9))) }));
}

// Krumhansl–Kessler profiles: how much each step of a major or minor key is heard in music written in it
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** The key of a piece of music (many notes at once): the energy of each of the twelve notes, against the major and minor profiles. */
export function detectMusicKey(x: Float32Array, sr: number): KeyGuess[] {
  const N = 8192;
  if (x.length < N) return [];
  const fft = new FFT(N);
  const w = hann(N);
  const re = new Float32Array(N), im = new Float32Array(N);
  const chroma = new Float32Array(12);
  const lo = Math.ceil((55 * N) / sr), hi = Math.floor((2000 * N) / sr);
  const hop = Math.max(N, Math.floor((x.length - N) / 400));
  for (let at = 0; at + N <= x.length; at += hop) {
    for (let i = 0; i < N; i++) {
      re[i] = x[at + i] * w[i];
      im[i] = 0;
    }
    fft.forward(re, im);
    for (let b = lo; b <= hi; b++) {
      const pc = ((Math.round(hzToMidi((b * sr) / N)) % 12) + 12) % 12;
      chroma[pc] += Math.hypot(re[b], im[b]);
    }
  }
  const corr = (p: number[], shift: number) => {
    let mc = 0, mp = 0;
    for (let i = 0; i < 12; i++) {
      mc += chroma[i] / 12;
      mp += p[i] / 12;
    }
    let num = 0, dc = 0, dp = 0;
    for (let i = 0; i < 12; i++) {
      const a = chroma[(i + shift) % 12] - mc, b = p[i] - mp;
      num += a * b;
      dc += a * a;
      dp += b * b;
    }
    return num / Math.sqrt(dc * dp + 1e-12);
  };
  const out: KeyGuess[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    out.push({ tonic, scale: scaleById("major"), confidence: corr(KK_MAJOR, tonic), label: label(tonic, scaleById("major")) });
    out.push({ tonic, scale: scaleById("minor"), confidence: corr(KK_MINOR, tonic), label: label(tonic, scaleById("minor")) });
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, 4).map((g) => ({ ...g, confidence: Math.max(0, Math.min(1, g.confidence)) }));
}
