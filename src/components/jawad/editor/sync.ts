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

export interface SyncPlan {
  cmds: Command[];
  /** what happened to each clip, in words, to show the person */
  notes: string[];
  moved: number;
}

/**
 * Lines the chosen clips up by their sound: the one that starts first stays, the others move so that what they hear lands on what it
 * hears. A clip whose sound does not clearly match is left where it is, and said so.
 */
export async function planSync(tl: Timeline, ids: string[], assets: Map<string, EditorAsset>, onStep?: (text: string) => void): Promise<SyncPlan> {
  const picked = ids
    .map((id) => findClip(tl, id))
    .filter((f): f is NonNullable<typeof f> => !!f && !!f.clip.assetId && !f.clip.text && !f.clip.seq)
    .filter((f) => {
      const a = assets.get(f.clip.assetId!);
      return !!a && a.kind !== "image" && (a.kind === "audio" || a.hasAudio) && !!a.url;
    });
  if (picked.length < 2) return { cmds: [], notes: ["اختر مقطعين على الأقل فيهم صوت (اضغط على الأول، ثم Shift واضغط على الباقي)."], moved: 0 };
  picked.sort((x, y) => x.clip.start - y.clip.start || tl.tracks.indexOf(x.track) - tl.tracks.indexOf(y.track));
  const anchor = picked[0];
  const name = (f: (typeof picked)[number]) => assets.get(f.clip.assetId!)?.name || "مقطع";
  onStep?.(`أقرأ صوت «${name(anchor)}»…`);
  const monoA = await monoOf(anchor.clip.assetId!, assets.get(anchor.clip.assetId!)!.url!);
  if (!monoA) return { cmds: [], notes: [`ما قدرت أقرأ صوت «${name(anchor)}».`], moved: 0 };

  const notes: string[] = [];
  const plan: { f: (typeof picked)[number]; start: number }[] = [];
  for (const f of picked.slice(1)) {
    onStep?.(`أطابق «${name(f)}»…`);
    if (f.clip.assetId === anchor.clip.assetId) {
      notes.push(`«${name(f)}» نفس ملف المقطع الأول؛ ما فيه شي يتزامن.`);
      continue;
    }
    const mono = await monoOf(f.clip.assetId!, assets.get(f.clip.assetId!)!.url!);
    if (!mono) {
      notes.push(`ما قدرت أقرأ صوت «${name(f)}».`);
      continue;
    }
    // let the browser breathe between the heavy steps
    await new Promise((r) => setTimeout(r, 0));
    const found = findLag(monoA, mono, SYNC_RATE);
    if (found.confidence === "none") {
      notes.push(`«${name(f)}» ما يشبه صوته صوت «${name(anchor)}» بما يكفي (يمكن ما سُجّلا في نفس اللحظة، أو الصوت ضعيف). تركته مكانه.`);
      continue;
    }
    const start = syncedStart(anchor.clip, f.clip, Math.round(found.lag * 1000));
    plan.push({ f, start });
    if (found.confidence === "low") notes.push(`«${name(f)}»: التطابق متوسط الثقة؛ راجعه بالسماع.`);
  }
  if (!plan.length) return { cmds: [], notes, moved: 0 };

  // nothing may start before the project does: everything moves later together
  const min = Math.min(...plan.map((p) => p.start), anchor.clip.start);
  const shift = min < 0 ? -min : 0;
  const magnetic = (f: (typeof picked)[number]) => tl.magnetic && mainTrack(tl)?.id === f.track.id;
  if (shift && magnetic(anchor)) {
    return { cmds: [], notes: [...notes, "المقطع الثاني يحتاج يبدأ قبل بداية المشروع. حرّك المقطع الأول لقدّام (أو انقله لمسار فوق الرئيسي) وأعد المزامنة."], moved: 0 };
  }
  const cmds: Command[] = [];
  if (shift) cmds.push({ type: "move_clip", clipId: anchor.clip.id, trackId: anchor.track.id, start: anchor.clip.start + shift });
  for (const p of plan) {
    // the main track packs its clips edge to edge: a clip meant to sit at its own moment goes to a track of its own
    cmds.push({ type: "move_clip", clipId: p.f.clip.id, trackId: magnetic(p.f) ? "new" : p.f.track.id, start: p.start + shift });
  }
  const names = plan.map((p) => `«${name(p.f)}»`).join("، ");
  notes.unshift(`زامنت ${names} على صوت «${name(anchor)}».`);
  return { cmds, notes, moved: plan.length };
}
