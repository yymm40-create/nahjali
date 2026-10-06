// «حيدرة كت» × «التعديل الذكي»: a piece of a JAWAD AI video lifted onto the red track is sent to be made again,
// and what comes back is laid on the green track over it. Shared by the page and the tests.

import type { Clip } from "./model";
import { cutRange } from "@/lib/jawad/smart-edit";

/** The piece's own seconds in its video (what the person marked). */
export const pieceRange = (c: Pick<Clip, "in" | "out">) => ({ from: Math.round(c.in / 100) / 10, to: Math.round(c.out / 100) / 10 });

/**
 * What is made for a piece: «جزئي» = a clip of whole seconds around it (at least the generator's shortest), starting
 * and ending on the original's frames; «كامل» = the whole video again. Null when a part can't be made (video too
 * short, or the piece longer than the generator's longest clip).
 */
export function fixCut(c: Pick<Clip, "in" | "out">, mode: "parts" | "whole", videoSec: number, minSec: number, maxSec: number) {
  if (mode === "whole") return { start: 0, end: videoSec, seconds: videoSec };
  const r = pieceRange(c);
  if (r.to - r.from > maxSec + 1e-9) return null;
  return cutRange(r.from, r.to, videoSec, minSec, maxSec);
}

/** Where in the made video the piece's first moment is (ms): the green clip starts there. */
export function fixedOffset(c: Pick<Clip, "in">, cut: { start: number }) {
  return Math.max(0, Math.round(c.in - cut.start * 1000));
}
