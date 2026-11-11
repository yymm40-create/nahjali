// «الرضا فويس» — every edit of a project as a pure step: the project goes in, a new project comes out (so each
// one is undone with a single ⌘Z and tested without a browser).

import { makeFx, makeTrack, uid, type Clip, type Fx, type FxKind, type Project, type Track } from "./model";

const MIN = 0.02;

export const trackOf = (p: Project, id: string) => p.tracks.find((t) => t.id === id) ?? null;
export const clipOf = (p: Project, id: string) => p.clips.find((c) => c.id === id) ?? null;
const mapTrack = (p: Project, id: string, f: (t: Track) => Track): Project => ({ ...p, tracks: p.tracks.map((t) => (t.id === id ? f(t) : t)) });
const mapClip = (p: Project, id: string, f: (c: Clip) => Clip): Project => ({ ...p, clips: p.clips.map((c) => (c.id === id ? f(c) : c)) });

export const patchTrack = (p: Project, id: string, patch: Partial<Track>) => mapTrack(p, id, (t) => ({ ...t, ...patch }));
export const patchClip = (p: Project, id: string, patch: Partial<Clip>) => mapClip(p, id, (c) => ({ ...c, ...patch }));

export function addTrack(p: Project, name?: string, over: Partial<Track> = {}): { project: Project; track: Track } {
  const track = makeTrack(name ?? `صوت ${p.tracks.length + 1}`, p.tracks.length, over);
  return { project: { ...p, tracks: [...p.tracks, track] }, track };
}

export function removeTrack(p: Project, id: string): Project {
  if (p.tracks.filter((t) => t.kind !== "group").length <= 1 && trackOf(p, id)?.kind !== "group") return p;
  // a removed group lets its members go: they play straight to the master again
  return { ...p, tracks: p.tracks.filter((t) => t.id !== id).map((t) => (t.group === id ? { ...t, group: undefined } : t)), clips: p.clips.filter((c) => c.trackId !== id) };
}

/** Members sit right under their group, in the order they had. */
function tidyGroups(tracks: Track[]): Track[] {
  const out: Track[] = [];
  for (const t of tracks) {
    if (t.group && tracks.some((g) => g.id === t.group && g.kind === "group")) continue;
    out.push(t.group ? { ...t, group: undefined } : t);
    if (t.kind === "group") out.push(...tracks.filter((m) => m.group === t.id));
  }
  return out;
}

/** A new group track holding the given tracks: they now play through it, and its effects shape them all together. */
export function addGroup(p: Project, memberIds: string[], name?: string): { project: Project; track: Track } {
  const n = p.tracks.filter((t) => t.kind === "group").length + 1;
  const track = makeTrack(name ?? `قروب ${n}`, p.tracks.length, { kind: "group", color: "#e9b949" });
  const members = new Set(memberIds.filter((id) => trackOf(p, id) && trackOf(p, id)!.kind !== "group"));
  const first = p.tracks.findIndex((t) => members.has(t.id));
  const tracks = p.tracks.map((t) => (members.has(t.id) ? { ...t, group: track.id } : t));
  tracks.splice(first < 0 ? tracks.length : first, 0, track);
  return { project: { ...p, tracks: tidyGroups(tracks) }, track };
}

/** A track put into a group (or taken out with null). Groups do not nest. */
export function setGroup(p: Project, id: string, groupId: string | null): Project {
  const t = trackOf(p, id);
  if (!t || t.kind === "group") return p;
  if (groupId && trackOf(p, groupId)?.kind !== "group") return p;
  return { ...p, tracks: tidyGroups(p.tracks.map((x) => (x.id === id ? { ...x, group: groupId ?? undefined } : x))) };
}

export function moveTrack(p: Project, id: string, dir: -1 | 1): Project {
  const i = p.tracks.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= p.tracks.length) return p;
  const tracks = p.tracks.slice();
  [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  return { ...p, tracks: tidyGroups(tracks) };
}

/** Only one track is armed at a time: the microphone records one voice. */
export const armTrack = (p: Project, id: string): Project => ({ ...p, tracks: p.tracks.map((t) => ({ ...t, arm: t.id === id && t.kind !== "group" ? !t.arm : false })) });

export function addClip(p: Project, c: Omit<Clip, "id" | "gain" | "fadeIn" | "fadeOut" | "muted" | "offset"> & Partial<Clip>): { project: Project; clip: Clip } {
  const clip: Clip = { id: uid(), gain: 0, fadeIn: 0, fadeOut: 0, muted: false, offset: 0, ...c };
  return { project: { ...p, clips: [...p.clips, clip] }, clip };
}

/**
 * A new recording laid on a track. Whatever it lands on top of becomes a set of takes with it: the new take plays,
 * the older ones wait muted, and the person picks between them later.
 */
export function addRecording(p: Project, trackId: string, assetId: string, start: number, dur: number, name: string): { project: Project; clip: Clip } {
  const under = p.clips.filter((c) => c.trackId === trackId && c.start < start + dur - 0.05 && c.start + c.dur > start + 0.05);
  const take = under.find((c) => c.take)?.take ?? (under.length ? uid() : undefined);
  const ids = new Set(under.map((c) => c.id));
  const base: Project = { ...p, clips: p.clips.map((c) => (ids.has(c.id) ? { ...c, take, muted: true } : c)) };
  return addClip(base, { trackId, assetId, start, dur, name, take });
}

/** The takes that belong with a clip (itself included), oldest first. */
export const takesOf = (p: Project, c: Clip) => (c.take ? p.clips.filter((x) => x.take === c.take) : [c]);

/** This take plays; the others of its set wait. */
export function chooseTake(p: Project, clipId: string): Project {
  const c = clipOf(p, clipId);
  if (!c?.take) return p;
  return { ...p, clips: p.clips.map((x) => (x.take === c.take ? { ...x, muted: x.id !== clipId } : x)) };
}

/**
 * Cuts the clip in two at timeline second `t`. A clip that has takes is cut together with them (each side becomes
 * its own set), so the best take can be chosen phrase by phrase — comping.
 */
export function splitClip(p: Project, clipId: string, t: number): Project {
  const c = clipOf(p, clipId);
  if (!c || t <= c.start + MIN || t >= c.start + c.dur - MIN) return p;
  const group = c.take ? p.clips.filter((x) => x.take === c.take && t > x.start + MIN && t < x.start + x.dur - MIN) : [c];
  const ids = new Set(group.map((x) => x.id));
  const right = c.take ? uid() : undefined;
  const out: Clip[] = [];
  for (const x of p.clips) {
    if (!ids.has(x.id)) {
      out.push(x);
      continue;
    }
    const cut = t - x.start;
    out.push({ ...x, dur: cut, fadeOut: 0 });
    out.push({ ...x, id: uid(), start: t, offset: x.offset + cut, dur: x.dur - cut, fadeIn: 0, take: right });
  }
  return { ...p, clips: out };
}

export const deleteClips = (p: Project, ids: string[]): Project => ({ ...p, clips: p.clips.filter((c) => !ids.includes(c.id)) });

export function duplicateClips(p: Project, ids: string[]): { project: Project; ids: string[] } {
  const made: Clip[] = [];
  for (const c of p.clips) if (ids.includes(c.id)) made.push({ ...c, id: uid(), start: c.start + c.dur, take: undefined, muted: false });
  return { project: { ...p, clips: [...p.clips, ...made] }, ids: made.map((c) => c.id) };
}

/** A clip moved to a new start (and, when given, another track). */
export function moveClip(p: Project, id: string, start: number, trackId?: string): Project {
  return mapClip(p, id, (c) => ({ ...c, start: Math.max(0, start), trackId: trackId && p.tracks.some((t) => t.id === trackId) ? trackId : c.trackId }));
}

/** A clip's left or right edge dragged to timeline second `t`; it cannot grow past the recording it shows. */
export function trimClip(p: Project, id: string, edge: "left" | "right", t: number, assetDur: number): Project {
  return mapClip(p, id, (c) => {
    if (edge === "left") {
      const end = c.start + c.dur;
      const start = Math.max(c.start - c.offset, Math.min(t, end - MIN), 0);
      return { ...c, start, offset: c.offset + (start - c.start), dur: end - start, fadeIn: Math.min(c.fadeIn, end - start) };
    }
    const end = Math.min(c.start + (assetDur - c.offset), Math.max(t, c.start + MIN));
    return { ...c, dur: end - c.start, fadeOut: Math.min(c.fadeOut, end - c.start) };
  });
}

/** A clip pointed at a new (processed) recording of the same passage. */
export function replaceSound(p: Project, clipId: string, assetId: string, dur: number, offset = 0): Project {
  return mapClip(p, clipId, (c) => ({ ...c, assetId, offset, dur, fadeIn: Math.min(c.fadeIn, dur), fadeOut: Math.min(c.fadeOut, dur) }));
}

export function setFades(p: Project, id: string, fadeIn: number, fadeOut: number): Project {
  return mapClip(p, id, (c) => {
    const fi = Math.max(0, Math.min(fadeIn, c.dur));
    return { ...c, fadeIn: fi, fadeOut: Math.max(0, Math.min(fadeOut, c.dur - fi)) };
  });
}

// ── effects: on a track, or on the master when trackId is "master" ──

const fxOf = (p: Project, where: string): Fx[] => (where === "master" ? p.master.fx : trackOf(p, where)?.fx ?? []);
const withFx = (p: Project, where: string, fx: Fx[]): Project => (where === "master" ? { ...p, master: { ...p.master, fx } } : patchTrack(p, where, { fx }));

export function addFx(p: Project, where: string, kind: FxKind, params: Record<string, number> = {}): { project: Project; fx: Fx } {
  const fx = makeFx(kind, params);
  return { project: withFx(p, where, [...fxOf(p, where), fx]), fx };
}
export const removeFx = (p: Project, where: string, id: string) => withFx(p, where, fxOf(p, where).filter((f) => f.id !== id));
export const patchFx = (p: Project, where: string, id: string, patch: Partial<Fx>) => withFx(p, where, fxOf(p, where).map((f) => (f.id === id ? { ...f, ...patch } : f)));
export const setFxParam = (p: Project, where: string, id: string, key: string, value: number) =>
  withFx(p, where, fxOf(p, where).map((f) => (f.id === id ? { ...f, p: { ...f.p, [key]: value } } : f)));
export function moveFx(p: Project, where: string, id: string, dir: -1 | 1): Project {
  const list = fxOf(p, where).slice();
  const i = list.findIndex((f) => f.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return p;
  [list[i], list[j]] = [list[j], list[i]];
  return withFx(p, where, list);
}
/** A whole ready chain put on a track in place of what was there. */
export const setChain = (p: Project, where: string, fx: Fx[], sends?: { reverb: number; delay: number }): Project => {
  const q = withFx(p, where, fx);
  return sends && where !== "master" ? patchTrack(q, where, { sendReverb: sends.reverb, sendDelay: sends.delay }) : q;
};

export function addMarker(p: Project, time: number, name?: string): Project {
  const markers = [...p.markers, { id: uid(), time, name: name ?? `علامة ${p.markers.length + 1}` }].sort((a, b) => a.time - b.time);
  return { ...p, markers };
}
export const removeMarker = (p: Project, id: string): Project => ({ ...p, markers: p.markers.filter((m) => m.id !== id) });

/** Every recording a project still points at. */
export const usedSounds = (p: Project) => new Set(p.clips.map((c) => c.assetId));
