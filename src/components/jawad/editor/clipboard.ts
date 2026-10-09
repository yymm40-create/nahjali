// The editor's clipboard (in this tab): clips copied with the track they were on, and the clip whose looks were
// copied (for «لصق السمات»). Kept outside React so it survives switching projects in the same tab.

import type { Grade } from "@/lib/editor/grade";
import type { Clip, Timeline } from "@/lib/editor/model";

export interface Copied {
  clips: { clip: Clip; trackId: string }[];
}

let copied: Copied | null = null;

/** The selected clips (in time order) copied. */
export function copyClips(tl: Timeline, ids: string[]): number {
  const clips = tl.tracks.flatMap((t) => t.clips.filter((c) => ids.includes(c.id)).map((c) => ({ clip: structuredClone(c), trackId: t.id })));
  if (!clips.length) return 0;
  copied = { clips: clips.sort((a, b) => a.clip.start - b.clip.start) };
  return clips.length;
}

export const pasteable = () => copied;

/** What «لصق السمات» can carry from the first copied clip. */
export const ATTRS = {
  grades: "التلوين",
  fx: "المؤثرات",
  transform: "الحركة والحجم",
  crop: "القص",
  blend: "وضع الدمج",
  key: "الكي",
  anim: "الدخول والخروج",
  sound: "الصوت",
  bg: "الخلفية",
} as const;
export type Attr = keyof typeof ATTRS;

// the colour grading copied from a clip (the colour page's «انسخ التلوين»), to paste onto one clip or many
let copiedGrade: { grades: Grade[]; from: string } | null = null;
export function copyGrade(grades: Grade[], from: string) {
  copiedGrade = { grades: structuredClone(grades), from };
}
export const pasteableGrade = () => copiedGrade;
