import type { AssetInfo, Timeline } from "@/lib/editor/model";

export const video = (id: string, durationMs: number, hasAudio = true): AssetInfo => ({ id, kind: "video", durationMs, width: 1920, height: 1080, hasAudio });
export const sound = (id: string, durationMs: number): AssetInfo => ({ id, kind: "audio", durationMs, width: null, height: null, hasAudio: true });
export const image = (id: string): AssetInfo => ({ id, kind: "image", durationMs: null, width: 1000, height: 1000 });
export const lib = (...a: AssetInfo[]) => new Map(a.map((x) => [x.id, x]));

export const main = (t: Timeline) => t.tracks.find((x) => x.kind === "video")!;
export const spans = (t: Timeline, kind = "video") =>
  t.tracks.find((x) => x.kind === kind)!.clips.map((c) => [c.assetId ?? c.text?.body, c.start, c.start + Math.round((c.out - c.in) / c.speed)]);
