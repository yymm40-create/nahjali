// «حيدرة كت» — «زامن الصوت», the browser side: reads the sound of the chosen clips' files, finds how they are shifted
// against each other (src/lib/editor/sync.ts) and returns the commands that move them into step. Nothing is uploaded.

import { ALL_FORMATS, AudioBufferSink, Input, UrlSource } from "mediabunny";
import { decodeWhole } from "./audio";
import type { Command } from "@/lib/editor/commands";
import { findClip, mainTrack, type Timeline } from "@/lib/editor/model";
import { findLag, syncedStart } from "@/lib/editor/sync";
import type { EditorAsset } from "./types";

/** Sound is compared at this rate (mono): enough for the voice, light enough for an hour of recording. */
export const SYNC_RATE = 4000;
/** A file longer than this is read only up to here. */
export const SYNC_MAX_SEC = 45 * 60;

const cache = new Map<string, Promise<Float32Array | null>>();

/** The file's sound as mono samples at SYNC_RATE (box-averaged), read in pieces so a long file never sits whole in memory. */
export function monoOf(id: string, url: string): Promise<Float32Array | null> {
  let p = cache.get(id);
  if (!p) {
    p = read(url).catch(() => null);
    cache.set(id, p);
    while (cache.size > 8) cache.delete(cache.keys().next().value!);
  }
  return p;
}

class Mono {
  sum: Float32Array;
  n: Uint16Array;
  constructor(len: number) {
    this.sum = new Float32Array(len);
    this.n = new Uint16Array(len);
  }
  add(b: AudioBuffer, at: number) {
    const chs = Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i));
    const per = b.sampleRate / SYNC_RATE;
    for (let i = 0; i < b.length; i++) {
      const k = Math.floor(at * SYNC_RATE + i / per);
      if (k < 0 || k >= this.sum.length) continue;
      let v = 0;
      for (const ch of chs) v += ch[i];
      this.sum[k] += v / chs.length;
      if (this.n[k] < 65535) this.n[k]++;
    }
  }
  done() {
    for (let k = 0; k < this.sum.length; k++) if (this.n[k]) this.sum[k] /= this.n[k];
    return this.sum;
  }
}

async function read(url: string): Promise<Float32Array | null> {
  const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack().catch(() => null);
    if (track && (await track.canDecode().catch(() => false))) {
      const dur = Math.min(SYNC_MAX_SEC, await input.computeDuration());
      const acc = new Mono(Math.max(1, Math.ceil(dur * SYNC_RATE)));
      for await (const wb of new AudioBufferSink(track).buffers()) {
        if (wb.timestamp > SYNC_MAX_SEC) break;
        acc.add(wb.buffer, wb.timestamp);
      }
      return acc.done();
    }
  } finally {
    input.dispose();
  }
  // a sound this browser's WebCodecs can't read: the Web Audio API reads it whole
  const b = await decodeWhole(url);
  const acc = new Mono(Math.max(1, Math.ceil(Math.min(SYNC_MAX_SEC, b.duration) * SYNC_RATE)));
  acc.add(b, 0);
  return acc.done();
}

/** Why a clip is marked on the timeline after «زامن الصوت»: red = left where it was, amber = moved but worth a listen. */
export interface SyncFlag {
  level: "bad" | "weak";
  why: string;
}

export interface SyncPlan {
  cmds: Command[];
  /** what happened, in words, to show the person */
  notes: string[];
  moved: number;
  /** every clip that was compared (their old marks are replaced by `flags`) */
  tried: string[];
  /** the clips to mark: the ones that did not line up (red) and the ones lined up with medium confidence (amber) */
  flags: Record<string, SyncFlag>;
}

/**
 * Lines the chosen clips up by their sound. The one that starts first stays and the others move so that what they hear
 * lands on what it hears — unless one of them is much longer than it (the whole poem or song under many short camera
 * clips): then that long one is the reference. A clip that does not match the reference is tried against the clips
 * already lined up (two cameras that heard each other but not the master). One that still matches nothing is left where
 * it is and marked.
 */
export async function planSync(tl: Timeline, ids: string[], assets: Map<string, EditorAsset>, onStep?: (text: string) => void): Promise<SyncPlan> {
  const none = (note: string): SyncPlan => ({ cmds: [], notes: [note], moved: 0, tried: [], flags: {} });
  const picked = ids
    .map((id) => findClip(tl, id))
    .filter((f): f is NonNullable<typeof f> => !!f && !!f.clip.assetId && !f.clip.text && !f.clip.seq)
    .filter((f) => {
      const a = assets.get(f.clip.assetId!);
      return !!a && a.kind !== "image" && (a.kind === "audio" || a.hasAudio) && !!a.url;
    });
  if (picked.length < 2) return none("اختر مقطعين على الأقل فيهم صوت (اضغط على الأول، ثم Shift واضغط على الباقي).");
  picked.sort((x, y) => x.clip.start - y.clip.start || tl.tracks.indexOf(x.track) - tl.tracks.indexOf(y.track));
  type Picked = (typeof picked)[number];
  const fileMs = (f: Picked) => assets.get(f.clip.assetId!)?.durationMs ?? 0;
  const name = (f: Picked) => assets.get(f.clip.assetId!)?.name || "مقطع";
  const anchor = pickAnchor(picked.map((f) => ({ id: f.clip.id, fileMs: fileMs(f) })));
  const ref = picked.find((f) => f.clip.id === anchor)!;
  const rest = picked.filter((f) => f !== ref);
  onStep?.(`أقرأ صوت «${name(ref)}»…`);
  const monoRef = await monoOf(ref.clip.assetId!, assets.get(ref.clip.assetId!)!.url!);
  if (!monoRef) return none(`ما قدرت أقرأ صوت «${name(ref)}».`);

  const flags: Record<string, SyncFlag> = {};
  const plan: { f: Picked; start: number; mono: Float32Array }[] = [];
  const later: { f: Picked; mono: Float32Array }[] = [];
  let n = 0;
  for (const f of rest) {
    onStep?.(`أطابق «${name(f)}» (${++n} من ${rest.length})…`);
    if (f.clip.assetId === ref.clip.assetId) {
      flags[f.clip.id] = { level: "bad", why: `نفس ملف «${name(ref)}»؛ ما فيه شي يتزامن.` };
      continue;
    }
    const mono = await monoOf(f.clip.assetId!, assets.get(f.clip.assetId!)!.url!);
    if (!mono) {
      flags[f.clip.id] = { level: "bad", why: "ما قدرت أقرأ صوته." };
      continue;
    }
    // let the browser breathe between the heavy steps
    await new Promise((r) => setTimeout(r, 0));
    const found = findLag(monoRef, mono, SYNC_RATE);
    if (found.confidence === "none") {
      later.push({ f, mono });
      continue;
    }
    plan.push({ f, start: syncedStart(ref.clip, f.clip, Math.round(found.lag * 1000)), mono });
    if (found.confidence === "low") flags[f.clip.id] = { level: "weak", why: "التطابق متوسط الثقة؛ راجعه بالسماع." };
  }
  // a second chance: against the clips already in step (the longest first), a few each
  for (let round = 0; round < 2 && later.length && plan.length; round++) {
    const placed = [...plan].sort((x, y) => y.mono.length - x.mono.length).slice(0, CHAIN_TRIES);
    for (const l of [...later]) {
      onStep?.(`أجرّب «${name(l.f)}» مع المقاطع المتزامنة…`);
      for (const p of placed) {
        if (p.f.clip.assetId === l.f.clip.assetId) continue;
        await new Promise((r) => setTimeout(r, 0));
        const found = findLag(p.mono, l.mono, SYNC_RATE);
        if (found.confidence === "none") continue;
        plan.push({ f: l.f, start: syncedStart({ ...p.f.clip, start: p.start }, l.f.clip, Math.round(found.lag * 1000)), mono: l.mono });
        flags[l.f.clip.id] = { level: "weak", why: `تزامن على صوت «${name(p.f)}» (مو على «${name(ref)}»)؛ راجعه بالسماع.` };
        later.splice(later.indexOf(l), 1);
        break;
      }
    }
  }
  for (const l of later) flags[l.f.clip.id] = { level: "bad", why: `صوته ما يشبه صوت «${name(ref)}» بما يكفي (يمكن ما سُجّل في نفس اللحظة، أو صوته ضعيف).` };

  const tried = rest.map((f) => f.clip.id);
  const bad = Object.values(flags).filter((x) => x.level === "bad").length;
  const weak = Object.values(flags).filter((x) => x.level === "weak").length;
  const tail = [
    ...(weak ? [`${weak} منها تطابقها متوسط الثقة (معلّمة بالأصفر): راجعها بالسماع.`] : []),
    ...(bad ? [`${bad} ما تزامنت وتركتها مكانها، معلّمة بالأحمر (وقّف عليها تشوف السبب).`] : []),
  ];
  if (!plan.length) return { cmds: [], notes: [`ما تزامن شي على صوت «${name(ref)}».`, ...tail], moved: 0, tried, flags };

  // nothing may start before the project does: everything moves later together
  const min = Math.min(...plan.map((p) => p.start), ref.clip.start);
  const shift = min < 0 ? -min : 0;
  const magnetic = (f: Picked) => tl.magnetic && mainTrack(tl)?.id === f.track.id;
  if (shift && magnetic(ref)) {
    return { cmds: [], notes: [`فيه مقطع يحتاج يبدأ قبل بداية المشروع. حرّك «${name(ref)}» لقدّام (أو انقله لمسار فوق الرئيسي) وأعد المزامنة.`], moved: 0, tried: [], flags: {} };
  }
  const cmds: Command[] = [];
  if (shift) cmds.push({ type: "move_clip", clipId: ref.clip.id, trackId: ref.track.id, start: ref.clip.start + shift });
  for (const p of plan) {
    // the main track packs its clips edge to edge: a clip meant to sit at its own moment goes to a track of its own
    cmds.push({ type: "move_clip", clipId: p.f.clip.id, trackId: magnetic(p.f) ? "new" : p.f.track.id, start: p.start + shift });
  }
  return { cmds, notes: [`زامنت ${plan.length} مقطع على صوت «${name(ref)}».`, ...tail], moved: plan.length, tried, flags };
}

/** How many of the clips already in step a clip that missed the reference is tried against. */
const CHAIN_TRIES = 4;

/**
 * Which clip the others line up to: the first (they are given in timeline order), unless another's file is at least
 * one and a half times as long as the first's — the master recording under many short clips — then the longest.
 */
export function pickAnchor(clips: { id: string; fileMs: number }[]): string {
  const first = clips[0];
  const longest = clips.reduce((m, c) => (c.fileMs > m.fileMs ? c : m), first);
  return longest.fileMs >= first.fileMs * 1.5 && longest.fileMs > 0 ? longest.id : first.id;
}
