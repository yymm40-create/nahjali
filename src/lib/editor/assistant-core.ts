// «حيدرة كت» — the pure part of the Claude assistant: what Claude is shown of the project, and the check that
// every command it sends can run (and which one can't). No server imports, so it can be tested on its own.

import { applyAll, CommandError, type Command } from "./commands";
import { clipEnd, clipLength, duration, ratioOf, type AssetInfo, type Timeline } from "./model";

export type Spoken = { s: number; e: number; w: string }[];

export interface ContextAsset {
  id: string;
  kind: "video" | "audio" | "image";
  name: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  status: string;
}

export function context(tl: Timeline, assets: ContextAsset[], transcripts: Map<string, Record<string, Spoken> | undefined>, extra: { playhead?: unknown; selected?: unknown; quiet?: unknown }) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const speech: { clipId: string; phrases: [number, number, string][] }[] = [];
  for (const track of tl.tracks) {
    for (const c of track.clips) {
      const a = c.assetId ? byId.get(c.assetId) : null;
      const kept = a ? transcripts.get(a.id) : undefined;
      // the transcript that covers most of this clip
      const words = kept ? (Object.values(kept).sort((x, y) => y.length - x.length)[0] ?? []) : [];
      const inside = words.filter((w) => w.s >= c.in && w.s < c.out).map((w) => ({ s: Math.round(c.start + (w.s - c.in) / c.speed), e: Math.round(c.start + (w.e - c.in) / c.speed), w: w.w }));
      if (!inside.length) continue;
      const phrases: [number, number, string][] = [];
      for (const w of inside) {
        const last = phrases[phrases.length - 1];
        if (last && w.s - last[1] < 600 && last[2].split(" ").length < 10) {
          last[1] = w.e;
          last[2] += ` ${w.w}`;
        } else phrases.push([w.s, w.e, w.w]);
      }
      speech.push({ clipId: c.id, phrases: phrases.slice(0, 400) });
    }
  }
  return {
    ratio: ratioOf(tl),
    durationMs: duration(tl),
    playheadMs: Number(extra.playhead) || 0,
    selected: Array.isArray(extra.selected) ? extra.selected.slice(0, 50) : [],
    magnetic: tl.magnetic,
    tracks: tl.tracks.map((t) => ({
      id: t.id,
      kind: t.kind,
      name: t.name,
      ...(t.muted ? { muted: true } : {}),
      ...(t.locked ? { locked: true } : {}),
      ...(t.duck ? { duck: true } : {}),
      clips: t.clips.map((c) => ({
        id: c.id,
        ...(c.assetId ? { assetId: c.assetId, name: byId.get(c.assetId)?.name ?? "" } : {}),
        start: c.start,
        end: clipEnd(c),
        len: clipLength(c),
        in: c.in,
        out: c.out,
        ...(c.speed !== 1 ? { speed: c.speed } : {}),
        ...(c.volume !== 1 ? { volume: c.volume } : {}),
        ...(c.text ? { text: c.text.body.slice(0, 120) } : {}),
        ...(c.transition ? { transition: c.transition.kind } : {}),
        ...(c.color ? { color: c.color.preset } : {}),
        ...(c.bg ? { bg: c.bg.mode } : {}),
        ...(c.keys.length ? { motionPoints: c.keys.length } : {}),
      })),
    })),
    library: assets.filter((a) => a.status === "ready").map((a) => ({ id: a.id, kind: a.kind, name: a.name, durationMs: a.durationMs, ...(a.kind === "video" ? { hasSound: a.hasAudio, size: a.width && a.height ? `${a.width}x${a.height}` : undefined } : {}) })),
    quiet: Array.isArray(extra.quiet) ? extra.quiet.slice(0, 200) : [],
    speech,
  };
}

/** Parses Claude's command strings and runs them on a copy: the commands, and the first one that fails (if any). */
export function checkCommands(tl: Timeline, raw: string[], infos: Map<string, AssetInfo>) {
  const cmds: Command[] = [];
  for (const [i, s] of raw.entries()) {
    try {
      const c = JSON.parse(s) as Command;
      if (!c || typeof c !== "object" || typeof c.type !== "string") return { cmds, error: { i, message: "not a command object" } };
      cmds.push(c);
    } catch {
      return { cmds, error: { i, message: "not valid JSON" } };
    }
  }
  for (let k = 1; k <= cmds.length; k++) {
    try {
      applyAll(tl, cmds.slice(0, k), infos);
    } catch (e) {
      if (!(e instanceof CommandError)) return { cmds, error: { i: k - 1, message: "unknown command" } };
      return { cmds, error: { i: k - 1, message: e.message } };
    }
  }
  return { cmds, error: null as null | { i: number; message: string } };
}
