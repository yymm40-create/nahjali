// «الرضا فويس» — a choir laid out in the project: its tracks, each with its part written on it, its place, level
// and tone, inside one group that wears the choir's shared mix. One undo step.

import { chainById } from "@config/ridha";
import { CHOIR_TONES, type ChoirKind } from "@config/ridha-choirs";
import { makeFx, TRACK_COLORS, type Project } from "./model";
import { addGroup, addTrack, patchTrack } from "./ops";

export function buildChoir(p: Project, kind: ChoirKind): { project: Project; groupId: string; first: string } {
  let q = p;
  const ids: string[] = [];
  kind.parts.forEach((part, i) => {
    const made = addTrack(q, part.name, {
      stereo: false, pan: part.pan, gain: part.gain, note: part.sing, color: TRACK_COLORS[(i + 2) % TRACK_COLORS.length],
      fx: [makeFx("eq", {}, CHOIR_TONES[part.tone])],
    });
    q = made.project;
    ids.push(made.track.id);
  });
  const g = addGroup(q, ids, kind.name);
  // the group's own chain: the choir's glue (compressor, a little chorus, width) — its equalizer is left to the parts
  const glue = (chainById("choir")?.build() ?? []).filter((f) => f.kind !== "eq");
  q = patchTrack(g.project, g.track.id, { fx: glue, sendReverb: kind.reverb, note: kind.hint });
  // the room the choir suits, when nothing else in the project has claimed the shared reverb yet
  if (kind.room && !p.tracks.some((t) => t.sendReverb > 0)) q = { ...q, reverb: { ...q.reverb, ...kind.room } };
  // the first part is made ready to record
  q = { ...q, tracks: q.tracks.map((t) => ({ ...t, arm: t.id === ids[0] })) };
  return { project: q, groupId: g.track.id, first: ids[0] };
}
