// «النسخة الأولى» of a film's edit: the chosen videos in the director's order, cut to the length the director planned
// for each, soft dissolves between scenes, the film's name over the opening, and the sound eased in and out.
// Pure: it returns the commands (later clips are referred to as "$N"), so the same steps run on the server and in
// the tests, and the person can undo them as one change.

import { apply, type Command } from "./commands";
import { clipEnd, RATIOS, ratioOf, type AssetInfo, type Ratio, type Timeline } from "./model";

export interface Shot {
  assetId: string;
  /** the director's planned length (ms); a longer video is cut to it, from its start */
  plannedMs?: number | null;
}

/** A video a little longer than planned keeps its extra (a planned 5 s shot that came out 5.3 s stays whole). */
const SLACK_MS = 600;
const DISSOLVE_MS = 400;
const TITLE_MS = 3000;

export function firstCut(tl: Timeline, shots: Shot[], infos: Map<string, AssetInfo>, o: { title?: string; ratio?: string | null } = {}): Command[] {
  const cmds: Command[] = [];
  let t = tl;
  // each step runs here on the real clip ids, and is kept with "$N" in their place (the server makes fresh ids)
  const real = new Map<string, string>();
  const step = (c: Command) => {
    const ids = "clipId" in c ? { ...c, clipId: real.get(c.clipId) ?? c.clipId } : c;
    const r = apply(t, ids as Command, infos);
    t = r.timeline;
    cmds.push(c);
    const ref = `$${cmds.length}`;
    if (r.select?.[0]) real.set(ref, r.select[0]);
    return { ref, id: r.select?.[0] ?? "" };
  };

  if (o.ratio && o.ratio in RATIOS && ratioOf(t) !== o.ratio) step({ type: "set_ratio", ratio: o.ratio as Ratio });
  const main = t.tracks.find((x) => x.kind === "video");
  const usable = shots.filter((s) => infos.has(s.assetId));
  if (!main || !usable.length) return cmds;

  const placed = usable.map((s) => ({ ...step({ type: "add_clip", assetId: s.assetId, trackId: main.id }), plannedMs: s.plannedMs }));
  const clip = (id: string) => t.tracks.flatMap((x) => x.clips).find((c) => c.id === id);

  // from the last scene back, so a cut never moves a scene still to be cut
  for (const p of [...placed].reverse()) {
    const c = clip(p.id);
    if (!c || !p.plannedMs || infos.get(c.assetId ?? "")?.kind !== "video") continue;
    if (clipEnd(c) - c.start > p.plannedMs + SLACK_MS) step({ type: "trim_clip", clipId: p.ref, edge: "end", to: c.start + p.plannedMs });
  }

  if (placed.length > 1) step({ type: "transition_all", kind: "fade", ms: DISSOLVE_MS, trackId: main.id });

  const first = clip(placed[0].id);
  const last = clip(placed[placed.length - 1].id);
  if (first) step({ type: "update_clip", clipId: placed[0].ref, patch: { fadeIn: 300 } });
  if (last) step({ type: "update_clip", clipId: placed[placed.length - 1].ref, patch: { fadeOut: 900 } });

  const title = o.title?.trim();
  if (title && first) {
    const text = step({ type: "add_text", at: 0, body: title.slice(0, 80), duration: Math.min(TITLE_MS, clipEnd(first) - first.start) });
    step({ type: "update_clip", clipId: text.ref, patch: { text: { font: "kufi", weight: 900, size: 0.09, box: null }, transform: { y: 0.5 } } });
  }
  return cmds;
}
