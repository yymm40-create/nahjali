// «تتبّع الوجه» (motion element): the face read off the video under the element, for the element's own seconds, and
// turned from the source picture's fractions into the frame's (through the video clip's fit, place and size), so the
// brackets sit on the face as it is seen. MediaPipe in the browser (face.ts): nothing uploaded, nothing paid.

import { clipEnd, type Clip, type Timeline } from "@/lib/editor/model";
import type { FaceSample } from "@/lib/editor/motion-elements";
import { faceTrack } from "./face";
import { baseSize } from "./render";
import type { EditorAsset } from "./types";

/** About five looks a second, between 4 and 120 of them. */
const PER_MS = 200;

/** The video clip drawn under `el` at its seconds (the top one), or null. */
export function videoUnder(tl: Timeline, el: Clip, assets: Map<string, EditorAsset>): Clip | null {
  const at = tl.tracks.findIndex((t) => t.clips.some((c) => c.id === el.id));
  const s = el.start;
  const e = clipEnd(el);
  for (const tr of tl.tracks.slice(0, Math.max(0, at)).reverse()) {
    if (tr.kind !== "video" || tr.hidden || tr.role) continue;
    const c = tr.clips.find((c) => !!c.assetId && !c.text && !c.motion && c.start < e && clipEnd(c) > s && assets.get(c.assetId!)?.kind === "video");
    if (c) return c;
  }
  return null;
}

/** The face over the element's time (its own clock: ms from its start, its trimmed head included). */
export async function readFaceTrack(tl: Timeline, el: Clip, assets: Map<string, EditorAsset>): Promise<FaceSample[]> {
  const v = videoUnder(tl, el, assets) ?? null;
  const a = v?.assetId ? assets.get(v.assetId) : null;
  if (!v || !a?.url) throw new Error("ما فيه فيديو تحت هذا العنصر نقرأ منه الوجه.");
  const from = Math.max(el.start, v.start);
  const to = Math.min(clipEnd(el), clipEnd(v));
  const srcFrom = v.in + (from - v.start) * v.speed;
  const srcTo = v.in + (to - v.start) * v.speed;
  const n = Math.max(4, Math.min(120, Math.round((to - from) / PER_MS)));
  const r = await faceTrack(a.url, srcFrom, srcTo, n);
  if (!r.samples.length) throw new Error("ما لقينا وجه في الفيديو بهذي الثواني.");
  const W = tl.width;
  const H = tl.height;
  const b = baseSize(v.fit, r.width, r.height, W, H);
  const w = b.w * v.transform.scale;
  const h = b.h * v.transform.scale;
  const left = v.transform.x * W - w / 2;
  const top = v.transform.y * H - h / 2;
  return r.samples.map((s) => {
    const timeline = v.start + (s.ms - v.in) / v.speed;
    return {
      t: Math.max(0, Math.round(el.in + (timeline - el.start))),
      x: (left + s.face.x * w) / W,
      y: (top + s.face.y * h) / H,
      w: (s.face.w * w) / W,
      h: (s.face.h * h) / H,
    };
  });
}
