// Copying a clip's colour grading and pasting it onto many clips at once (pure, so it can be tested).

import type { Command } from "./commands";
import type { Grade } from "./grade";
import type { Timeline } from "./model";

/** The clips among `ids` that can take a grading: pictures and videos (and nested sequences) on an unlocked picture track. */
export function gradeable(tl: Timeline, ids: string[], except?: string): string[] {
  const want = new Set(ids);
  return tl.tracks.flatMap((t) => (t.kind === "video" && !t.locked ? t.clips.filter((c) => want.has(c.id) && c.id !== except && !c.text).map((c) => c.id) : []));
}

/** Every gradeable clip of the timeline (the «كل الفيديوهات» target). */
export const allGradeable = (tl: Timeline, except?: string) => gradeable(tl, tl.tracks.flatMap((t) => t.clips.map((c) => c.id)), except);

/** One command per clip: its grading becomes a copy of `grades` (replacing what it had). */
export function pasteGradeCommands(grades: Grade[], ids: string[]): Command[] {
  return ids.map((clipId) => ({ type: "update_clip" as const, clipId, patch: { grades: structuredClone(grades) } }));
}
