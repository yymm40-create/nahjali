// Where what Claude (or a button) made goes on the timeline: a hook picture over the video with a pop, music under it
// (eased in and out, ducking under talking), a clip's split sound on three sound tracks in step with it (the clip
// itself goes quiet). Pure: the editor's own commands, one undo.

import type { Command } from "./commands";
import type { Clip } from "./model";

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
