// Where what Claude (or a button) made goes on the timeline: a hook picture over the video with a pop, music under it
// (eased in and out, ducking under talking), a clip's split sound on three sound tracks in step with it (the clip
// itself goes quiet). Pure: the editor's own commands, one undo.

import type { Command } from "./commands";
import type { AnimKind, Clip } from "./model";

export function placeHook(assetId: string, at: number, lengthMs: number): Command[] {
  const len = Math.round(Math.min(6000, Math.max(800, lengthMs || 2200)));
  return [
    { type: "add_clip", assetId, trackId: "new", at: Math.max(0, Math.round(at)) },
    { type: "trim_clip", clipId: "$1", edge: "end", to: Math.max(0, Math.round(at)) + len },
    { type: "update_clip", clipId: "$1", patch: { fit: "contain", transform: { scale: 0.86, y: 0.3 }, anim: { in: "pop", inMs: 320, out: "fade", outMs: 250 } } },
  ];
}

export function placeMusic(assetId: string, at: number): Command[] {
  return [
    { type: "add_clip", assetId, trackId: "new", at: Math.max(0, Math.round(at)) },
    { type: "update_clip", clipId: "$1", patch: { volume: 0.6, fadeIn: 800, fadeOut: 2000 } },
    // the music goes quieter by itself under talking
    { type: "update_track", trackId: "$1", patch: { duck: true } },
  ];
}

/** The parts of a clip's sound (talking, music, effects — in that order), each on its own sound track. */
export function placeStems(clip: Pick<Clip, "id" | "start" | "speed">, assetIds: string[]): Command[] {
  const cmds: Command[] = [];
  assetIds.forEach((id, i) => {
    cmds.push({ type: "add_clip", assetId: id, trackId: "new", at: clip.start });
    const ref = `$${cmds.length}`;
    if (clip.speed !== 1) cmds.push({ type: "update_clip", clipId: ref, patch: { speed: clip.speed } });
    if (i === 1) cmds.push({ type: "update_track", trackId: ref, patch: { duck: false } });
  });
  cmds.push({ type: "update_clip", clipId: clip.id, patch: { volume: 0 } });
  return cmds;
}

/**
 * A designed hook («نص الهوك») on the timeline: its picture over the video with the design's entrance and exit, and
 * its two sounds placed so their peaks land on the arrival (the end of the entrance) and on the vanishing (the end).
 */
export function placeHookDesign(
  d: { background: "transparent" | "scene"; inAnim: AnimKind; inMs: number; outAnim: AnimKind; outMs: number; lengthMs: number; sfxIn: { peakMs: number; seconds: number }; sfxOut: { peakMs: number; seconds: number } },
  ids: { image: string; sfxIn: string | null; sfxOut: string | null },
  at: number,
  orientation: "vertical" | "horizontal",
): Command[] {
  const start = Math.max(0, Math.round(at));
  const end = start + Math.round(d.lengthMs);
  const look =
    d.background === "scene"
      ? { fit: "cover" as const, transform: { scale: 1, x: 0.5, y: 0.5 } }
      : orientation === "vertical"
        ? { fit: "contain" as const, transform: { scale: 0.9, x: 0.5, y: 0.36 } }
        : // horizontal: the words take part of the frame, the scene keeps its place
          { fit: "contain" as const, transform: { scale: 0.6, x: 0.5, y: 0.3 } };
  const cmds: Command[] = [
    { type: "add_clip", assetId: ids.image, trackId: "new", at: start },
    { type: "trim_clip", clipId: "$1", edge: "end", to: end },
    { type: "update_clip", clipId: "$1", patch: { ...look, anim: { in: d.inAnim, inMs: d.inMs, out: d.outAnim, outMs: d.outMs } } },
  ];
  const sound = (id: string, peakAt: number, s: { peakMs: number; seconds: number }) => {
    const from = Math.max(0, Math.round(peakAt - s.peakMs));
    cmds.push({ type: "add_clip", assetId: id, trackId: "new", at: from });
    cmds.push({ type: "trim_clip", clipId: `$${cmds.length}`, edge: "end", to: from + Math.round(s.seconds * 1000) });
  };
  if (ids.sfxIn) sound(ids.sfxIn, start + d.inMs, d.sfxIn);
  if (ids.sfxOut) sound(ids.sfxOut, end, d.sfxOut);
  return cmds;
}

/**
 * Something «حيدرة» made with JAWAD AI («اصنع لي…»), once it is in the library: a picture or video over the video
 * (a new track) or into the main track, a sound on a new sound track (music a little lower, ducking under talking).
 */
export function placeMade(kind: "image" | "video" | "speech" | "sfx" | "music", assetId: string, place: "over" | "main" | "audio" | "library", at: number): Command[] {
  if (place === "library") return [];
  const start = Math.max(0, Math.round(at));
  if (kind === "image" || kind === "video") {
    if (place === "main") return [{ type: "add_clip", assetId, at: start }];
    const cmds: Command[] = [{ type: "add_clip", assetId, trackId: "new", at: start }];
    if (kind === "image") cmds.push({ type: "trim_clip", clipId: "$1", edge: "end", to: start + 4000 });
    cmds.push({ type: "update_clip", clipId: "$1", patch: { fit: "cover" } });
    return cmds;
  }
  const cmds: Command[] = [{ type: "add_clip", assetId, trackId: "new", at: start }];
  if (kind === "music") {
    cmds.push({ type: "update_clip", clipId: "$1", patch: { volume: 0.6, fadeIn: 800, fadeOut: 2000 } });
    cmds.push({ type: "update_track", trackId: "$1", patch: { duck: true } });
  }
  return cmds;
}
