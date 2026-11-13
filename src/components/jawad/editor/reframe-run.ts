// «اتبع الوجه» in the browser: each chosen video clip's faces looked at a few times a second (MediaPipe, face.ts —
// nothing uploaded, nothing paid), turned into a calm camera path (lib/editor/reframe.ts) and given back as commands
// (the clip filling the frame, its motion points), for the caller to run as one undo.

import type { Command } from "@/lib/editor/commands";
import { ratioOf, type Clip, type Timeline } from "@/lib/editor/model";
import { cropPath, looksFor, toKeys } from "@/lib/editor/reframe";
import { faceFrames } from "./face";
import type { EditorAsset } from "./types";

export interface ReframeCandidate {
  clip: Clip;
  asset: EditorAsset;
}

/** The project's shape is one a wide video needs following in (tall, square or 4:5). */
export const reframeShape = (tl: Pick<Timeline, "width" | "height">) => ratioOf(tl) !== "16:9";

/**
 * The video clips that can follow a face: a ready video on a picture track (not the fix tracks, not a nest), whose
 * picture is wider than the frame (so there is room to move across it).
 */
export function reframeCandidates(tl: Timeline, assets: Map<string, EditorAsset>): ReframeCandidate[] {
  const frame = tl.width / tl.height;
  return tl.tracks.flatMap((t) =>
    t.kind !== "video" || t.role || t.locked
      ? []
      : t.clips.flatMap((c) => {
          const a = c.assetId ? assets.get(c.assetId) : null;
          if (!a || a.kind !== "video" || a.status !== "ready" || !a.url || c.text || c.motion || c.seq) return [];
          // a file whose size isn't on record yet is tried (it is measured when it opens)
          if (a.width && a.height && a.width / a.height <= frame * 1.05) return [];
          return [{ clip: c, asset: a }];
        }),
  );
}

export interface ReframeResult {
  commands: Command[];
  /** clips that got a camera path */
  done: number;
  /** files where no face was seen (left as they were) */
  noFace: string[];
}

/**
 * The commands that make each clip follow its face. `onStep` says where it is (text and 0–1 over all the clips);
 * `signal` stops it (an AbortError). The clips are read from `tl` as it is now.
 */
export async function reframeClips(tl: Timeline, picked: ReframeCandidate[], onStep: (text: string, p: number) => void, signal?: AbortSignal): Promise<ReframeResult> {
  const commands: Command[] = [];
  const noFace: string[] = [];
  let done = 0;
  const total = picked.reduce((m, x) => m + looksFor(x.clip.out - x.clip.in), 0) || 1;
  let before = 0;
  for (const [i, { clip, asset }] of picked.entries()) {
    const n = looksFor(clip.out - clip.in);
    const label = picked.length > 1 ? `المقطع ${i + 1} من ${picked.length}` : "المقطع";
    onStep(`${label}: نقرأ الوجه…`, before / total);
    const r = await faceFrames(asset.url!, clip.in, clip.out, n, { signal, onProgress: (p) => onStep(`${label}: نقرأ الوجه ${Math.round(p * 100)}٪`, (before + p * n) / total) });
    before += n;
    if (!r.frames.some((f) => f.faces.length) || !r.width || !r.height) {
      noFace.push(asset.name || "مقطع");
      continue;
    }
    const scale = Math.max(1, clip.transform.scale);
    const path = cropPath(r.frames, { W: tl.width, H: tl.height, sw: r.width, sh: r.height, scale }, clip.transform);
    const keys = toKeys(path, { ...clip.transform, scale });
    if (!keys.length) continue;
    if (clip.fit !== "cover") commands.push({ type: "update_clip", clipId: clip.id, patch: { fit: "cover" } });
    commands.push({ type: "set_keys", clipId: clip.id, keys, label: "اتبع الوجه" });
    done++;
  }
  onStep("خلصنا", 1);
  return { commands, done, noFace };
}

/** The commands still possible on the timeline as it is now (a clip deleted meanwhile is skipped). */
export const stillThere = (tl: Timeline, cmds: Command[]) => cmds.filter((c) => !("clipId" in c) || tl.tracks.some((t) => t.clips.some((x) => x.id === c.clipId)));
