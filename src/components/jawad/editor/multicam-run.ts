// «بدّل الكاميرات تلقائياً» in the browser: each synced camera's own sound read here (the same reader as «زامن الصوت»,
// nothing uploaded, nothing paid), optionally its faces (MediaPipe, face.ts), and the shots worked out by
// lib/editor/multicam.ts — given back as one «multicam» command for the caller to run as one undo.

import type { Command } from "@/lib/editor/commands";
import { clipEnd, type Clip, type Timeline, type Track } from "@/lib/editor/model";
import { chooseShots, facesOf, levelsOf, MULTICAM, shareOf, type CamInput, type Shot } from "@/lib/editor/multicam";
import { faceFrames } from "./face";
import { monoOf, SYNC_RATE } from "./sync";
import type { EditorAsset } from "./types";

export interface Camera {
  clip: Clip;
  track: Track;
  asset: EditorAsset;
}

const isCam = (t: Track, c: Clip, assets: Map<string, EditorAsset>): EditorAsset | null => {
  if (t.kind !== "video" || t.role || c.text || c.seq || c.motion || c.angle || !c.assetId) return null;
  const a = assets.get(c.assetId);
  return a && a.kind === "video" && a.status === "ready" && a.url ? a : null;
};

/**
 * The cameras to switch between: the selected video clips (two or more); else the cameras of an earlier switch (their
 * «angles» tracks, to run it again); else (`loose`, حيدرا ماكس asked without naming them) every video clip with sound
 * that runs at the same time as one on another track for most of its length.
 */
export function multicamCameras(tl: Timeline, assets: Map<string, EditorAsset>, selected: string[] = [], loose = false): Camera[] {
  const all: Camera[] = tl.tracks.flatMap((track) => track.clips.flatMap((clip) => {
    const asset = isCam(track, clip, assets);
    return asset ? [{ clip, track, asset }] : [];
  }));
  const shared = (a: Camera, b: Camera) => Math.min(clipEnd(a.clip), clipEnd(b.clip)) - Math.max(a.clip.start, b.clip.start);
  const overlaps = (a: Camera, b: Camera) => a.track !== b.track && shared(a, b) >= 0.5 * Math.min(clipEnd(a.clip) - a.clip.start, clipEnd(b.clip) - b.clip.start);
  // the selected ones that run at the same time as another selected one (two clips one after the other aren't cameras)
  const picked = all.filter((c) => selected.includes(c.clip.id));
  const together = picked.filter((c) => picked.some((o) => overlaps(c, o)));
  if (together.length >= 2) return together.slice(0, MULTICAM.maxCams);
  const angles = all.filter((c) => c.track.angles);
  if (angles.length >= 2) return angles.slice(0, MULTICAM.maxCams);
  if (!loose) return [];
  return all.filter((c) => !c.track.hidden && c.asset.hasAudio && all.some((o) => o.asset.hasAudio && overlaps(c, o))).slice(0, MULTICAM.maxCams);
}

/** "keep" when other sound (a separate microphone, extracted sound) plays over the cameras' time; else "follow". */
export function defaultSound(tl: Timeline, cams: Camera[], assets: Map<string, EditorAsset>): "keep" | "follow" {
  if (!cams.length) return "follow";
  const from = Math.min(...cams.map((c) => c.clip.start));
  const to = Math.max(...cams.map((c) => clipEnd(c.clip)));
  const ids = new Set(cams.map((c) => c.clip.id));
  const heard = tl.tracks.some((t) => t.kind === "audio" && !t.muted && t.clips.some((c) => !ids.has(c.id) && c.volume > 0 && c.start < to && clipEnd(c) > from && assets.get(c.assetId ?? "")?.kind !== "image"));
  return heard ? "keep" : "follow";
}

export interface MulticamPlan {
  command: Command;
  shots: Shot[];
  /** said to the person: how much each camera got, cameras that couldn't be heard */
  notes: string[];
}

/**
 * Reads the cameras and works out the cuts. `onStep` says where it is (text, 0–1); `signal` stops it between two
 * readings (an AbortError).
 */
export async function planMulticam(
  cams: Camera[],
  o: { minShotMs: number; wide: string | null; faces: boolean; sound: "follow" | "keep" | string },
  onStep: (text: string, p: number) => void,
  signal?: AbortSignal,
): Promise<MulticamPlan> {
  if (cams.length < 2) throw new Error("يحتاج كاميرتين على الأقل متزامنة (اضغط «🎯 زامن الصوت» أول).");
  const stop = () => {
    if (signal?.aborted) throw new DOMException("أوقفت.", "AbortError");
  };
  const step = MULTICAM.stepMs;
  const from = Math.min(...cams.map((c) => c.clip.start));
  const to = Math.max(...cams.map((c) => clipEnd(c.clip)));
  const steps = Math.ceil((to - from) / step);
  const stages = cams.length * (o.faces ? 2 : 1);
  let done = 0;
  const notes: string[] = [];
  const input: CamInput[] = [];
  for (const [k, c] of cams.entries()) {
    stop();
    const name = c.asset.name || `كاميرا ${k + 1}`;
    onStep(`أسمع «${name}»…`, done / stages);
    let levels: (number | null)[] = new Array(steps).fill(null);
    const mono = c.asset.hasAudio ? await monoOf(c.asset.id, c.asset.url!) : null;
    if (mono) levels = levelsOf(mono, SYNC_RATE, c.clip, from, steps, step);
    else notes.push(`«${name}» ما فيها صوت نسمعه؛ تنعرض كواسعة أو لما ما فيه غيرها.`);
    done++;
    let faces: (boolean | null)[] | undefined;
    if (o.faces) {
      stop();
      const looks = Math.min(600, Math.max(4, Math.ceil((c.clip.out - c.clip.in) / 500)));
      const r = await faceFrames(c.asset.url!, c.clip.in, c.clip.out, looks, { signal, onProgress: (p) => onStep(`أشوف الوجوه في «${name}» ${Math.round(p * 100)}٪`, (done + p) / stages) }).catch((e) => {
        if ((e as Error)?.name === "AbortError") throw e;
        notes.push(`ما قدرت أقرأ الوجوه في «${name}»؛ اعتمدت على الصوت.`);
        return null;
      });
      if (r) faces = facesOf(r.frames.map((f) => ({ ms: f.ms, face: f.faces.length > 0 })), c.clip, from, steps, step);
      done++;
    }
    input.push({ start: c.clip.start, end: clipEnd(c.clip), levels, ...(faces ? { faces } : {}) });
    // let the page breathe between the heavy steps
    await new Promise((r) => setTimeout(r, 0));
  }
  stop();
  const wide = o.wide ? cams.findIndex((c) => c.clip.id === o.wide) : -1;
  const shots = chooseShots(input, from, to, { minShotMs: o.minShotMs, wide: wide >= 0 ? wide : null });
  if (!shots.length) throw new Error("ما طلعت لقطات؛ تأكد إن الكاميرات متزامنة ومتداخلة بالوقت.");
  const sound = o.sound === "keep" || o.sound === "follow" ? o.sound : Math.max(0, cams.findIndex((c) => c.clip.id === o.sound));
  const share = shareOf(shots, cams.length);
  notes.unshift(`${shots.length} لقطة: ${cams.map((c, k) => `${c.asset.name || `كاميرا ${k + 1}`} ${Math.round(share[k] * 100)}٪`).join("، ")}.`);
  onStep("خلصنا", 1);
  return { command: { type: "multicam", cams: cams.map((c) => c.clip.id), shots, wide: wide >= 0 ? wide : null, sound }, shots, notes };
}
