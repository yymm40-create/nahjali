// «الرضا فويس» — what «الرضا ماكس» can DO. He answers with a list of small commands; each is checked here (unknown
// commands and out-of-range numbers never reach the project), the ones that change the mixer are applied to the
// project at once as ONE undo step, and the ones that rewrite a clip's sound (cleaning, tuning, loudness) are handed
// back as jobs for the studio to run on the device. Also here: the studio written out as text, which is all he sees.

import { chainById, CHAIN_PRESETS } from "@config/ridha";
import { USES, type Use } from "./advise";
import type { CleanOptions } from "./dsp/clean";
import type { Listening } from "./dsp/listen";
import { NOTE_NAMES, scaleById, SCALES } from "./dsp/scales";
import { FX_ORDER, FX_SPECS, makeFx, type Clip, type EqBand, type FxKind, type Project, type Track } from "./model";
import { patchFx, patchTrack, removeFx, setChain, trackOf } from "./ops";

export type ClipJob =
  | { do: "clean"; use: Use; options: Partial<CleanOptions>; level: number | null }
  | { do: "tune"; strength: number; speedMs: number; transpose: number }
  | { do: "loudness"; lufs: number };

const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** The command strings parsed; what is not a JSON object with a «do» is dropped. */
export function readActions(raw: unknown): Record<string, unknown>[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: Record<string, unknown>[] = [];
  for (const item of list.slice(0, 24)) {
    try {
      const v = typeof item === "string" ? JSON.parse(item) : item;
      if (v && typeof v === "object" && typeof (v as { do?: unknown }).do === "string") out.push(v as Record<string, unknown>);
    } catch {
      /* not a command: skipped */
    }
  }
  return out;
}

/** The track a command names: «selected», «master», an id, or its name. */
function whereOf(p: Project, ref: unknown, selTrack: string): string | null {
  const r = String(ref ?? "selected").trim();
  if (r === "master") return "master";
  if (r === "selected" || !r) return selTrack === "master" || trackOf(p, selTrack) ? selTrack : p.tracks[0]?.id ?? null;
  return p.tracks.find((t) => t.id === r)?.id ?? p.tracks.find((t) => t.name.trim() === r)?.id ?? null;
}
const nameOf = (p: Project, where: string) => (where === "master" ? "الماستر" : trackOf(p, where)?.name ?? "");
const fxOf = (p: Project, where: string) => (where === "master" ? p.master.fx : trackOf(p, where)?.fx ?? []);
const withFx = (p: Project, where: string, fx: ReturnType<typeof fxOf>): Project => (where === "master" ? { ...p, master: { ...p.master, fx } } : patchTrack(p, where, { fx }));

/**
 * The commands applied. `done` says in Arabic what happened (shown under his reply), `skipped` what could not be
 * done and why, `jobs` the clip work left for the studio.
 */
export function applyActions(p: Project, actions: Record<string, unknown>[], selTrack: string): { project: Project; done: string[]; skipped: string[]; jobs: ClipJob[] } {
  let q = p;
  const done: string[] = [], skipped: string[] = [], jobs: ClipJob[] = [];
  for (const a of actions) {
    const kind = String(a.do);
    const where = whereOf(q, a.track, selTrack);
    const need = () => {
      if (!where) skipped.push(`${kind}: ما لقيت المسار «${String(a.track)}»`);
      return where;
    };
    if (kind === "chain") {
      const w = need();
      const c = chainById(String(a.preset));
      if (!w) continue;
      if (!c) {
        skipped.push(`chain: ما في سلسلة باسم «${String(a.preset)}»`);
        continue;
      }
      q = setChain(q, w, c.build(), c.sends);
      if (c.room && a.room !== false) q = { ...q, reverb: { ...q.reverb, ...c.room } };
      done.push(`سلسلة «${c.name}» على ${nameOf(q, w)}`);
    } else if (kind === "fx") {
      const w = need();
      const k = String(a.kind) as FxKind;
      if (!w) continue;
      if (!FX_ORDER.includes(k) || k === "eq") {
        skipped.push(`fx: مؤثر غير معروف «${String(a.kind)}»`);
        continue;
      }
      const spec = FX_SPECS[k];
      const params: Record<string, number> = {};
      for (const s of spec.params) {
        const v = num((a.params as Record<string, unknown> | undefined)?.[s.key], s.min, s.max);
        if (v != null) params[s.key] = v;
      }
      const have = fxOf(q, w).find((f) => f.kind === k);
      if (have) q = patchFx(q, w, have.id, { on: bool(a.on) ?? true, p: { ...have.p, ...params } });
      else q = withFx(q, w, [...fxOf(q, w), { ...makeFx(k, params), on: bool(a.on) ?? true }]);
      done.push(`${have ? "ضبط" : "إضافة"} ${spec.name} على ${nameOf(q, w)}`);
    } else if (kind === "remove_fx") {
      const w = need();
      if (!w) continue;
      const have = fxOf(q, w).find((f) => f.kind === String(a.kind));
      if (have) {
        q = removeFx(q, w, have.id);
        done.push(`حذف ${FX_SPECS[have.kind].name} من ${nameOf(q, w)}`);
      }
    } else if (kind === "eq") {
      const w = need();
      if (!w) continue;
      let eq = fxOf(q, w).find((f) => f.kind === "eq");
      if (!eq) {
        eq = makeFx("eq");
        q = withFx(q, w, [eq, ...fxOf(q, w)]);
      }
      const bands = (eq.bands ?? []).map((b) => ({ ...b }));
      for (const raw of Array.isArray(a.bands) ? a.bands.slice(0, 8) : []) {
        const b = raw as Record<string, unknown>;
        const i = num(b.i, 0, 7);
        if (i == null || !bands[Math.round(i)]) continue;
        const band: EqBand = bands[Math.round(i)];
        band.on = bool(b.on) ?? true;
        band.freq = num(b.freq, 20, 20000) ?? band.freq;
        band.gain = num(b.gain, -18, 18) ?? band.gain;
        band.q = num(b.q, 0.2, 12) ?? band.q;
      }
      q = patchFx(q, w, eq.id, { on: true, bands });
      done.push(`ضبط الإكولايزر على ${nameOf(q, w)}`);
    } else if (kind === "track") {
      const w = need();
      if (!w || w === "master") continue;
      const patch: Partial<Track> = {};
      const g = num(a.gain, -60, 6), pan = num(a.pan, -1, 1), sr = num(a.sendReverb, 0, 1), sd = num(a.sendDelay, 0, 1);
      if (g != null) patch.gain = g;
      if (pan != null) patch.pan = pan;
      if (sr != null) patch.sendReverb = sr;
      if (sd != null) patch.sendDelay = sd;
      if (bool(a.stereo) != null) patch.stereo = bool(a.stereo)!;
      if (bool(a.mute) != null) patch.mute = bool(a.mute)!;
      if (bool(a.solo) != null) patch.solo = bool(a.solo)!;
      if (!Object.keys(patch).length) continue;
      q = patchTrack(q, w, patch);
      done.push(`ضبط مسار ${nameOf(q, w)}`);
    } else if (kind === "room" || kind === "echo") {
      const bus = kind === "room" ? "reverb" : "delay";
      const next = { ...q[bus] };
      const ranges: Record<string, [number, number]> = kind === "room" ? { decay: [0.2, 9], predelay: [0, 150], damp: [800, 16000], level: [0, 1.5] } : { time: [20, 1500], feedback: [0, 0.92], damp: [500, 16000], level: [0, 1.5] };
      for (const [k, [lo, hi]] of Object.entries(ranges)) {
        const v = num(a[k], lo, hi);
        if (v != null) next[k] = v;
      }
      q = { ...q, [bus]: next };
      done.push(kind === "room" ? "ضبط الريفيرب المشترك" : "ضبط الصدى المشترك");
    } else if (kind === "master") {
      const g = num(a.gain, -40, 6);
      if (g == null) continue;
      q = { ...q, master: { ...q.master, gain: g } };
      done.push("ضبط مستوى الماستر");
    } else if (kind === "key") {
      const tonic = num(a.tonic, 0, 11.5);
      if (tonic == null || !SCALES.some((s) => s.id === a.scale)) {
        skipped.push("key: نغمة أو سلّم غير صحيح");
        continue;
      }
      q = { ...q, key: { tonic: Math.round(tonic * 2) / 2, scale: String(a.scale) } };
      done.push(`النغمة: ${NOTE_NAMES[Math.floor(q.key!.tonic)]} · ${scaleById(q.key!.scale).name}`);
    } else if (kind === "tempo") {
      const bpm = num(a.bpm, 30, 240);
      if (bpm == null) continue;
      q = { ...q, bpm };
      done.push(`السرعة ${Math.round(bpm)}`);
    } else if (kind === "clean") {
      const use = USES.find((u) => u.id === a.use)?.id ?? "solo";
      const o: Partial<CleanOptions> = {};
      const n = num(a.noise, 0, 1), de = num(a.deEss, 0, 1), rv = num(a.reverb, 0, 1), ru = num(a.rumbleHz, 0, 200);
      if (n != null) o.noise = n;
      if (de != null) o.deEss = de;
      if (rv != null) o.reverb = rv;
      if (ru != null) o.rumbleHz = ru;
      for (const k of ["ai", "hum", "clicks", "gate"] as const) if (bool(a[k]) != null) o[k] = bool(a[k])!;
      jobs.push({ do: "clean", use, options: o, level: num(a.level, -30, -8) });
    } else if (kind === "tune") {
      jobs.push({ do: "tune", strength: num(a.strength, 0, 1) ?? 0.85, speedMs: num(a.speedMs, 0, 400) ?? 120, transpose: Math.round(num(a.transpose, -12, 12) ?? 0) });
    } else if (kind === "loudness") {
      const l = num(a.lufs, -30, -8);
      if (l != null) jobs.push({ do: "loudness", lufs: l });
    } else skipped.push(`أمر غير معروف: ${kind}`);
  }
  return { project: q, done, skipped, jobs };
}

/** The studio as he reads it: every track with its settings and effects, the shared buses, and the selected clip's measurements. */
export function describeStudio(p: Project, selTrack: string, clip: Clip | null, heard: Listening | null): string {
  const fxLine = (t: { fx: Track["fx"] }) =>
    t.fx.length
      ? t.fx
          .map((f) => {
            const head = `${f.kind}${f.on ? "" : "(off)"}`;
            if (f.kind === "eq") return `${head}[${(f.bands ?? []).map((b, i) => (b.on ? `${i}:${b.type} ${Math.round(b.freq)}Hz${b.type === "highpass" || b.type === "lowpass" ? "" : ` ${b.gain}dB`} q${b.q}` : null)).filter(Boolean).join("; ")}]`;
            return `${head}{${Object.entries(f.p).map(([k, v]) => `${k}:${Math.round(v * 100) / 100}`).join(",")}}`;
          })
          .join(" → ")
      : "none";
  const lines: string[] = [];
  lines.push(`project: bpm ${Math.round(p.bpm)}, key ${p.key ? `${p.key.tonic} ${p.key.scale}` : "not set"}; shared reverb decay ${p.reverb.decay}s predelay ${p.reverb.predelay}ms damp ${p.reverb.damp}Hz level ${p.reverb.level}; shared echo ${p.delay.time}ms feedback ${p.delay.feedback} level ${p.delay.level}; master ${p.master.gain}dB fx: ${fxLine(p.master)}`);
  for (const t of p.tracks) {
    const clips = p.clips.filter((c) => c.trackId === t.id);
    lines.push(
      `track id=${t.id} name="${t.name}"${t.id === selTrack ? " [SELECTED]" : ""} ${t.kind === "group" ? "GROUP" : t.stereo === false ? "mono" : "stereo"}${t.group ? ` in-group=${t.group}` : ""} gain ${t.gain}dB pan ${t.pan}${t.space.on ? " 3D" : ""}${t.mute ? " MUTED" : ""}${t.solo ? " SOLO" : ""} sendReverb ${t.sendReverb} sendDelay ${t.sendDelay} clips ${clips.length} fx: ${fxLine(t)}`,
    );
  }
  if (selTrack === "master") lines.push("the MASTER is selected");
  if (clip) {
    lines.push(`selected clip: "${clip.name}" on track ${clip.trackId}, ${clip.dur.toFixed(1)}s, gain ${clip.gain}dB`);
    if (heard) {
      lines.push(
        `measurements of the selected clip: loudness ${heard.lufs} LUFS, peak ${heard.peak} dB, crest ${heard.crest} dB, noise floor ${heard.noiseDb ?? "unknown (no pauses)"} dB, mains hum ${heard.hum || "none"}, room ring ${heard.ringMs} ms, sibilance ${heard.sibilance} dB, sung share ${heard.voiced}, key ${heard.key ? heard.key.label : "unknown"}, tempo ${Math.round(heard.bpm)} (beat strength ${heard.beatStrength.toFixed(2)}), spectral balance vs 500Hz–2kHz [<60, 60–120, 120–250, 250–500, 500–2k, 2–4k, 4–8k, 8–16k] = [${heard.tilt.join(", ")}] dB`,
      );
    } else lines.push("the selected clip has not been measured");
  } else lines.push("no clip is selected");
  return lines.join("\n");
}

/** The names he may use in commands, as one constant text (part of his cached instructions). */
export const ACTIONS_DOC = `ACTIONS — return them in "actions", each as ONE JSON object written as a string. "track" is a track id from the studio state, or "selected", or "master". Only these exist:
{"do":"chain","track":"selected","preset":"<id>"} — a whole ready chain replaces the track's effects (and sets the shared room for it). ids: ${CHAIN_PRESETS.map((c) => `${c.id} (${c.name})`).join(", ")}.
{"do":"fx","track":"selected","kind":"<kind>","params":{...},"on":true} — adds the effect, or updates the first of that kind. kinds and params: ${FX_ORDER.filter((k) => k !== "eq").map((k) => `${k}{${FX_SPECS[k].params.map((s) => `${s.key} ${s.min}..${s.max}${s.unit ? s.unit : ""}`).join(", ")}}`).join("; ")}.
{"do":"remove_fx","track":"selected","kind":"<kind>"}
{"do":"eq","track":"selected","bands":[{"i":2,"freq":280,"gain":-3,"q":1.2,"on":true}]} — the equalizer's eight bands by index: 0 low cut (highpass; set on:true and freq), 1 low shelf, 2–5 bells, 6 high shelf, 7 high cut (lowpass). Only the bands you list change. Gains −18..18 dB.
{"do":"track","track":"<id>","gain":-3,"pan":0,"stereo":false,"mute":false,"solo":false,"sendReverb":0.3,"sendDelay":0.1} — any of these.
{"do":"room","decay":3.2,"predelay":45,"damp":5200,"level":0.8} — the shared reverb every track sends to. {"do":"echo","time":310,"feedback":0.25,"damp":3200,"level":0.7} — the shared echo.
{"do":"master","gain":-1}
{"do":"key","tonic":2,"scale":"bayati"} — tonic in semitones from C (0..11, a half for a quarter tone); scales: ${SCALES.map((s) => s.id).join(", ")}. {"do":"tempo","bpm":72}
{"do":"clean","use":"podcast","noise":0.6,"ai":true,"rumbleHz":80,"hum":true,"clicks":true,"deEss":0.5,"reverb":0.3,"gate":false,"level":-16} — cleans the SELECTED CLIP on the device; "use" is one of ${USES.map((u) => u.id).join(", ")}; every number you leave out is decided by the studio from the measurements. Needs a selected clip.
{"do":"tune","strength":0.85,"speedMs":120,"transpose":0} — auto-tunes the SELECTED CLIP to the project's key (set the key first if it is not set). {"do":"loudness","lufs":-16} — brings the SELECTED CLIP to a loudness.`;
