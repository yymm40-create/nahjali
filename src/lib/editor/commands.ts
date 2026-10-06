// «الممنتج الذكي» — every change to a timeline is one of these commands: the buttons, the keyboard, Claude (phase 5)
// and plugins all send the same JSON, so whatever one can do, the others can too, and each is checked the same way.
// Pure: `apply` never changes the timeline it gets.

import {
  clipEnd,
  clipLength,
  DEFAULT_TEXT,
  DEFAULT_TRANSFORM,
  findClip,
  formatTime,
  LIMITS,
  mainTrack,
  newId,
  pack,
  RATIOS,
  sourceTime,
  STILL_MS,
  type AssetInfo,
  type Clip,
  type Ratio,
  type TextStyle,
  type Timeline,
  type Track,
  type TrackKind,
  type Transform,
} from "./model";

export type ClipPatch = Partial<Pick<Clip, "volume" | "fit" | "speed">> & { transform?: Partial<Transform>; text?: Partial<TextStyle> };

export type Command =
  | { type: "add_clip"; assetId: string; trackId?: string; at?: number }
  | { type: "add_text"; at: number; body?: string; duration?: number }
  /** `trackId: "new"` puts it on a new track of its kind (above the pictures, or a new sound track) */
  | { type: "move_clip"; clipId: string; trackId: string; start: number }
  /** moves one edge of a clip to timeline time `to` */
  | { type: "trim_clip"; clipId: string; edge: "start" | "end"; to: number }
  /** cuts the given clips (or every clip under `at` on unlocked tracks) in two at `at` */
  | { type: "split"; at: number; clipIds?: string[] }
  /** ripple: what came after moves back to fill the gap; lift: the gap stays */
  | { type: "delete"; clipIds: string[]; ripple: boolean }
  | { type: "duplicate"; clipId: string }
  | { type: "update_clip"; clipId: string; patch: ClipPatch }
  | { type: "add_track"; kind: TrackKind }
  | { type: "update_track"; trackId: string; patch: Partial<Pick<Track, "muted" | "hidden" | "locked" | "name">> }
  | { type: "remove_track"; trackId: string }
  | { type: "set_ratio"; ratio: Ratio }
  | { type: "set_background"; color: string }
  | { type: "set_magnetic"; on: boolean }
  /** puts the main track's clips one after another from 0 (used by «ركّب النسخة الأولى» too) */
  | { type: "close_gaps"; trackId?: string };

export class CommandError extends Error {}

export interface Applied {
  timeline: Timeline;
  /** a short Arabic name for the history list («قص عند ٠:٠٣») */
  label: string;
  /** clips to select afterwards */
  select?: string[];
}

const fail = (m: string): never => {
  throw new CommandError(m);
};

const KIND_TRACK = { video: "video", image: "video", audio: "audio" } as const;
const TRACK_NAME: Record<TrackKind, string> = { video: "فوق الرئيسي", audio: "صوت", text: "نص" };

const clipKind = (c: Clip, assets: Map<string, AssetInfo>): "video" | "image" | "audio" | "text" =>
  c.text ? "text" : (assets.get(c.assetId ?? "")?.kind ?? "video");
const trackFor = (c: Clip, assets: Map<string, AssetInfo>): TrackKind => {
  const k = clipKind(c, assets);
  return k === "text" ? "text" : KIND_TRACK[k];
};
/** The longest a clip may run (its source, at its speed); stills and text have no end. */
const sourceMax = (c: Clip, assets: Map<string, AssetInfo>) => {
  const a = c.assetId ? assets.get(c.assetId) : null;
  return a && a.kind !== "image" && a.durationMs ? a.durationMs : Infinity;
};
const isStill = (c: Clip, assets: Map<string, AssetInfo>) => c.text != null || assets.get(c.assetId ?? "")?.kind === "image";

function editable(t: Timeline, trackId: string) {
  const track = t.tracks.find((x) => x.id === trackId) ?? fail("ما لقينا هذا المسار.");
  if (track.locked) fail(`المسار «${track.name}» مقفول؛ افتح القفل أول.`);
  return track;
}
function owned(t: Timeline, clipId: string) {
  const f = findClip(t, clipId) ?? fail("ما لقينا هذا المقطع.");
  if (f.track.locked) fail(`المسار «${f.track.name}» مقفول؛ افتح القفل أول.`);
  return f;
}
const magnet = (t: Timeline, track: Track) => t.magnetic && mainTrack(t)?.id === track.id;
/** After any change to a track: the main track packs (when magnetic), the others stay sorted. */
function tidy(t: Timeline, track: Track) {
  track.clips = magnet(t, track) ? pack(track.clips) : track.clips.sort((a, b) => a.start - b.start);
}

/**
 * Puts `c` on a free-placement track: if it lands inside a clip it moves to that clip's end, and clips after it are
 * pushed later just enough (nothing is ever covered or lost).
 */
function place(track: Track, c: Clip) {
  const others = track.clips.filter((x) => x.id !== c.id).sort((a, b) => a.start - b.start);
  c.start = Math.max(0, Math.round(c.start));
  for (const o of others) if (o.start < c.start && clipEnd(o) > c.start) c.start = clipEnd(o);
  let end = clipEnd(c);
  for (const o of others) {
    if (o.start < c.start) continue;
    if (o.start < end) o.start = end;
    end = Math.max(end, clipEnd(o));
  }
  track.clips = [...others, c].sort((a, b) => a.start - b.start);
}

/** Inserts `c` on the magnetic main track before the first clip whose middle is after `at`. */
function insertMain(track: Track, c: Clip, at: number) {
  const others = track.clips.filter((x) => x.id !== c.id).sort((a, b) => a.start - b.start);
  const i = others.findIndex((o) => o.start + clipLength(o) / 2 > at);
  others.splice(i < 0 ? others.length : i, 0, c);
  track.clips = pack(others, true);
}

function newTrack(t: Timeline, kind: TrackKind): Track {
  if (t.tracks.length >= LIMITS.tracks) fail("وصلت لأكثر عدد من المسارات.");
  const n = t.tracks.filter((x) => x.kind === kind).length + 1;
  const track: Track = { id: newId("t"), kind, name: `${TRACK_NAME[kind]} ${n}`, muted: false, hidden: false, locked: false, clips: [] };
  // pictures go right above the other pictures (under the text); text and sound at the end
  if (kind === "video") {
    const last = t.tracks.map((x) => x.kind).lastIndexOf("video");
    t.tracks.splice(last + 1, 0, track);
  } else t.tracks.push(track);
  return track;
}

const free = (track: Track, from: number, to: number) => track.clips.every((c) => clipEnd(c) <= from || c.start >= to);
const countClips = (t: Timeline) => t.tracks.reduce((n, x) => n + x.clips.length, 0);

/** Applies one command; throws CommandError with an Arabic message when it can't. */
export function apply(timeline: Timeline, cmd: Command, assets: Map<string, AssetInfo>): Applied {
  const t = structuredClone(timeline);
  switch (cmd.type) {
    case "add_clip": {
      const a = assets.get(cmd.assetId) ?? fail("هذا الملف مو في مكتبة المشروع.");
      if (countClips(t) >= LIMITS.clips) fail("وصلت لأكثر عدد من المقاطع في مشروع واحد.");
      const kind = KIND_TRACK[a.kind];
      const len = a.kind === "image" ? STILL_MS : Math.max(LIMITS.minClipMs, a.durationMs ?? 5000);
      const c: Clip = { id: newId("c"), assetId: a.id, start: 0, in: 0, out: len, speed: 1, volume: 1, fit: "cover", transform: { ...DEFAULT_TRANSFORM }, text: null };
      let track = cmd.trackId ? editable(t, cmd.trackId) : null;
      if (track && track.kind !== kind) fail(kind === "audio" ? "الصوت يروح في مسار صوت." : "الصور والفيديو تروح في مسار صورة.");
      const main = mainTrack(t)!;
      if (!track) {
        if (kind === "video") track = main.locked ? newTrack(t, "video") : main;
        else {
          const at = cmd.at ?? 0;
          track = t.tracks.find((x) => x.kind === "audio" && !x.locked && free(x, at, at + len)) ?? newTrack(t, "audio");
        }
      }
      if (magnet(t, track)) insertMain(track, c, cmd.at ?? Infinity);
      else {
        c.start = cmd.at ?? (track === main ? track.clips.reduce((m, x) => Math.max(m, clipEnd(x)), 0) : 0);
        place(track, c);
      }
      return { timeline: t, label: a.kind === "audio" ? "أضفت صوتًا" : a.kind === "image" ? "أضفت صورة" : "أضفت مقطعًا", select: [c.id] };
    }

    case "add_text": {
      if (countClips(t) >= LIMITS.clips) fail("وصلت لأكثر عدد من المقاطع في مشروع واحد.");
      const len = Math.max(LIMITS.minClipMs, Math.round(cmd.duration ?? STILL_MS));
      const at = Math.max(0, Math.round(cmd.at));
      const track = t.tracks.find((x) => x.kind === "text" && !x.locked && free(x, at, at + len)) ?? newTrack(t, "text");
      const c: Clip = {
        id: newId("c"),
        assetId: null,
        start: at,
        in: 0,
        out: len,
        speed: 1,
        volume: 1,
        fit: "contain",
        transform: { ...DEFAULT_TRANSFORM, y: 0.78 },
        text: { ...DEFAULT_TEXT, body: (cmd.body ?? DEFAULT_TEXT.body).slice(0, LIMITS.text) },
      };
      place(track, c);
      return { timeline: t, label: "أضفت نصًا", select: [c.id] };
    }

    case "move_clip": {
      const { track: from, clip } = owned(t, cmd.clipId);
      const to = cmd.trackId === "new" ? newTrack(t, trackFor(clip, assets)) : editable(t, cmd.trackId);
      if (to.kind !== trackFor(clip, assets)) fail(to.kind === "audio" ? "هذا المسار للصوت فقط." : to.kind === "text" ? "هذا المسار للنصوص فقط." : "هذا المسار للصور والفيديو.");
      from.clips = from.clips.filter((c) => c.id !== clip.id);
      if (from !== to) tidy(t, from);
      if (magnet(t, to)) insertMain(to, clip, cmd.start);
      else {
        clip.start = cmd.start;
        place(to, clip);
      }
      return { timeline: t, label: "حرّكت مقطعًا", select: [clip.id] };
    }

    case "trim_clip": {
      const { track, clip, index } = owned(t, cmd.clipId);
      const speed = clip.speed || 1;
      const min = LIMITS.minClipMs * speed;
      const prevEnd = magnet(t, track) ? 0 : index > 0 ? clipEnd(track.clips[index - 1]) : 0;
      const nextStart = magnet(t, track) ? Infinity : (track.clips[index + 1]?.start ?? Infinity);
      if (cmd.edge === "end") {
        const want = clip.in + (Math.min(cmd.to, nextStart) - clip.start) * speed;
        clip.out = Math.round(Math.min(sourceMax(clip, assets), Math.max(clip.in + min, want)));
      } else if (isStill(clip, assets)) {
        // a picture or a text has no "source start": its left edge just makes it longer or shorter
        const end = clipEnd(clip);
        const start = Math.min(end - LIMITS.minClipMs, Math.max(prevEnd, Math.round(cmd.to)));
        clip.out = clip.in + (end - start) * speed;
        clip.start = start;
      } else {
        const end = clipEnd(clip);
        const lo = Math.max(prevEnd, clip.start - clip.in / speed);
        const start = Math.min(end - LIMITS.minClipMs, Math.max(lo, Math.round(cmd.to)));
        clip.in = Math.round(Math.max(0, clip.in + (start - clip.start) * speed));
        clip.start = start;
      }
      tidy(t, track);
      return { timeline: t, label: cmd.edge === "end" ? "قصّرت نهاية مقطع" : "قصّرت بداية مقطع", select: [clip.id] };
    }

    case "split": {
      const at = Math.round(cmd.at);
      const wanted = cmd.clipIds?.length ? new Set(cmd.clipIds) : null;
      const made: string[] = [];
      for (const track of t.tracks) {
        if (track.locked) continue;
        const next: Clip[] = [];
        for (const c of track.clips) {
          next.push(c);
          if (wanted && !wanted.has(c.id)) continue;
          if (at - c.start < LIMITS.minClipMs || clipEnd(c) - at < LIMITS.minClipMs) continue;
          const cut = Math.round(sourceTime(c, at));
          const right: Clip = { ...structuredClone(c), id: newId("c"), start: at, in: cut };
          c.out = cut;
          next.push(right);
          made.push(right.id);
        }
        track.clips = next;
      }
      if (!made.length) fail(wanted ? "حط مؤشر الوقت داخل المقطع المحدد (مو على طرفه) ثم قص." : "ما فيه مقطع تحت مؤشر الوقت لقصّه.");
      if (countClips(t) > LIMITS.clips) fail("وصلت لأكثر عدد من المقاطع في مشروع واحد.");
      return { timeline: t, label: `قص عند ${formatTime(at)}`, select: made };
    }

    case "delete": {
      const ids = new Set(cmd.clipIds);
      if (!ids.size) fail("اختر مقطعًا أول.");
      let n = 0;
      for (const track of t.tracks) {
        const gone = track.clips.filter((c) => ids.has(c.id));
        if (!gone.length) continue;
        if (track.locked) fail(`المسار «${track.name}» مقفول؛ افتح القفل أول.`);
        track.clips = track.clips.filter((c) => !ids.has(c.id));
        n += gone.length;
        if (cmd.ripple && !magnet(t, track)) {
          // later clips on this track move back by what was removed before them
          for (const g of gone.sort((a, b) => b.start - a.start)) {
            const len = clipLength(g);
            for (const c of track.clips) if (c.start >= clipEnd(g)) c.start -= len;
          }
          track.clips = track.clips.sort((a, b) => a.start - b.start);
        }
        tidy(t, track);
      }
      if (!n) fail("ما لقينا المقاطع المحددة.");
      return { timeline: t, label: n > 1 ? `حذفت ${n} مقاطع` : "حذفت مقطعًا", select: [] };
    }

    case "duplicate": {
      const { track, clip } = owned(t, cmd.clipId);
      if (countClips(t) >= LIMITS.clips) fail("وصلت لأكثر عدد من المقاطع في مشروع واحد.");
      const copy: Clip = { ...structuredClone(clip), id: newId("c"), start: clipEnd(clip) };
      if (magnet(t, track)) insertMain(track, copy, clipEnd(clip));
      else place(track, copy);
      return { timeline: t, label: "كرّرت مقطعًا", select: [copy.id] };
    }

    case "update_clip": {
      const { track, clip } = owned(t, cmd.clipId);
      const p = cmd.patch;
      if (p.volume != null) clip.volume = Math.min(2, Math.max(0, Number(p.volume) || 0));
      if (p.fit) clip.fit = p.fit === "contain" ? "contain" : "cover";
      if (p.speed != null) {
        // the clip keeps its source part; its length on the timeline follows the speed
        clip.speed = Math.min(10, Math.max(0.1, Number(p.speed) || 1));
      }
      if (p.transform) clip.transform = { ...clip.transform, ...Object.fromEntries(Object.entries(p.transform).filter(([, v]) => Number.isFinite(v))) };
      if (p.text && clip.text) {
        clip.text = { ...clip.text, ...p.text };
        clip.text.body = String(clip.text.body ?? "").slice(0, LIMITS.text);
      }
      if (p.speed != null) {
        if (magnet(t, track)) tidy(t, track);
        else place(track, clip);
      }
      return { timeline: t, label: p.text ? "عدّلت النص" : p.volume != null ? "غيّرت مستوى الصوت" : p.speed != null ? "غيّرت السرعة" : "عدّلت مقطعًا", select: [clip.id] };
    }

    case "add_track": {
      const track = newTrack(t, cmd.kind);
      return { timeline: t, label: `أضفت مسار ${TRACK_NAME[cmd.kind]}`, select: [track.id] };
    }

    case "update_track": {
      const track = t.tracks.find((x) => x.id === cmd.trackId) ?? fail("ما لقينا هذا المسار.");
      const p = cmd.patch;
      if (p.muted != null) track.muted = !!p.muted;
      if (p.hidden != null) track.hidden = !!p.hidden;
      if (p.locked != null) track.locked = !!p.locked;
      if (p.name != null) track.name = String(p.name).slice(0, 40);
      const label = p.locked != null ? (track.locked ? "قفلت مسارًا" : "فتحت مسارًا") : p.muted != null ? (track.muted ? "كتمت مسارًا" : "شغّلت صوت مسار") : p.hidden != null ? (track.hidden ? "أخفيت مسارًا" : "أظهرت مسارًا") : "سمّيت مسارًا";
      return { timeline: t, label };
    }

    case "remove_track": {
      const track = editable(t, cmd.trackId);
      if (mainTrack(t)?.id === track.id) fail("المسار الرئيسي ما ينحذف.");
      t.tracks = t.tracks.filter((x) => x.id !== track.id);
      return { timeline: t, label: "حذفت مسارًا" };
    }

    case "set_ratio": {
      const r = RATIOS[cmd.ratio] ?? fail("مقاس غير معروف.");
      t.width = r.width;
      t.height = r.height;
      return { timeline: t, label: `المقاس ${cmd.ratio}` };
    }

    case "set_background": {
      if (!/^#[0-9a-f]{6}$/i.test(cmd.color)) fail("لون غير صحيح.");
      t.background = cmd.color;
      return { timeline: t, label: "غيّرت لون الخلفية" };
    }

    case "set_magnetic": {
      t.magnetic = cmd.on;
      const main = mainTrack(t);
      if (main && cmd.on) main.clips = pack(main.clips);
      return { timeline: t, label: cmd.on ? "شغّلت المغناطيس" : "أطفأت المغناطيس" };
    }

    case "close_gaps": {
      const track = cmd.trackId ? editable(t, cmd.trackId) : (mainTrack(t) ?? fail("ما فيه مسار رئيسي."));
      track.clips = pack(track.clips);
      return { timeline: t, label: "سكّرت الفراغات" };
    }
  }
  return fail("أمر غير معروف.");
}

/** Applies several commands in order as one change (one undo step); stops at the first that can't be done. */
export function applyAll(timeline: Timeline, cmds: Command[], assets: Map<string, AssetInfo>, label?: string): Applied {
  let t = timeline;
  let last: Applied | null = null;
  for (const c of cmds) {
    last = apply(t, c, assets);
    t = last.timeline;
  }
  return { timeline: t, label: label ?? last?.label ?? "", select: last?.select };
}
