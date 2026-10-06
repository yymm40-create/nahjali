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
  COLOR_PRESETS,
  NEUTRAL_COLOR,
  TRANSITION_MS,
  TRANSITIONS,
  transformAt,
  type AssetInfo,
  type Clip,
  type ColorGrade,
  type Ratio,
  type TextStyle,
  type Timeline,
  type Track,
  type TrackKind,
  type Transform,
  type TransitionKind,
  type Backdrop,
  type SoundFx,
  type Anim,
  type ClipFx,
  readAnim,
  readFx,
  TRACK_COLORS,
  NO_SOUND_FX,
  readSound,
  DEFAULT_BACKDROP,
  type Word,
  type CaptionStyle,
  CAPTION_STYLES,
  FIX_TRACK,
  readFix,
  type Fix,
  type TrackRole,
} from "./model";

export type ClipPatch = Partial<Pick<Clip, "volume" | "fit" | "speed" | "fadeIn" | "fadeOut" | "shape" | "own">> & {
  /** a red piece's note, kind of edit and job (merged) */
  fix?: Partial<Fix>;
  transform?: Partial<Transform>;
  text?: Partial<TextStyle>;
  /** null = back to the original colours */
  color?: Partial<ColorGrade> | null;
  /** null = a plain cut */
  transition?: { kind: TransitionKind; ms?: number } | null;
  /** null = the whole picture as filmed */
  bg?: Partial<Backdrop> | null;
  /** null = the sound as recorded */
  sound?: Partial<SoundFx> | null;
  /** null = no entrance or exit */
  anim?: Partial<Anim> | null;
  /** the clip's effects, all of them (replaces the list; [] = none) */
  fx?: ClipFx[];
};

/** What every new clip starts with (besides its media and timing). */
const CLIP_DEFAULTS = { keys: [], color: null, transition: null, fadeIn: 0, fadeOut: 0, shape: "rect" as const, words: [], bg: null, own: false, sound: null, anim: null, fx: [] as ClipFx[], fix: null };

export type Command =
  /** `trackId: "new"` puts it on a new track of its kind */
  | { type: "add_clip"; assetId: string; trackId?: string; at?: number }
  /** a video's sound on its own sound track, in step with it (the video goes quiet) */
  | { type: "extract_audio"; clipId: string }
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
  /** `role`: the red track of pieces to fix, or the green one of what was made («التعديل الذكي») */
  | { type: "add_track"; kind: TrackKind; role?: TrackRole }
  | { type: "update_track"; trackId: string; patch: Partial<Pick<Track, "muted" | "hidden" | "locked" | "name" | "duck" | "color">> }
  /** a motion point at timeline time `at` with this look (one already there is replaced) */
  | { type: "set_key"; clipId: string; at: number; transform: Partial<Transform> }
  | { type: "remove_key"; clipId: string; at: number }
  | { type: "clear_keys"; clipId: string }
  /** beat marks the cuts snap to: `add` (merged) or `replace`; `clear` removes them all */
  | { type: "set_markers"; markers: number[]; mode: "add" | "replace" | "clear" }
  /** a caption track: one text clip per phrase (words timed from each clip's start), in one look */
  | { type: "add_captions"; items: { start: number; end: number; body: string; words?: Word[] }[]; style: CaptionStyle; name?: string }
  /** one look for every text clip of a track (re-styling captions); captions set apart («own») keep theirs unless `all` */
  | { type: "style_track"; trackId: string; text: Partial<TextStyle>; y?: number; all?: boolean }
  /** the same transition at every cut of a track */
  | { type: "transition_all"; trackId?: string; kind: TransitionKind | null; ms?: number }
  | { type: "remove_track"; trackId: string }
  | { type: "set_ratio"; ratio: Ratio }
  | { type: "set_background"; color: string }
  | { type: "set_magnetic"; on: boolean }
  /** puts the main track's clips one after another from 0 (used by «ركّب النسخة الأولى» too) */
  | { type: "close_gaps"; trackId?: string }
  /**
   * Cuts timeline spans out of every track at once and closes them (silences, a part to drop, «خلّه ٣٠ ثانية»):
   * picture and sound stay in sync, and no clip id needs to be known.
   */
  | { type: "remove_ranges"; ranges: [number, number][] }
  /** «التعديل الذكي»: a piece lifted straight up onto the red track, in the very same place (to be made again) */
  | { type: "lift_fix"; clipId: string }
  /**
   * «التعديل الذكي»: what was made for a red piece, on the green track at the same place and of the same length.
   * `offset` is where in the new video the piece's own first moment is (ms).
   */
  | { type: "place_fixed"; clipId: string; assetId: string; offset: number };

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
  const track: Track = { id: newId("t"), kind, name: `${TRACK_NAME[kind]} ${n}`, muted: false, hidden: false, locked: false, duck: false, clips: [] };
  // pictures go right above the other pictures (under the text); text and sound at the end
  if (kind === "video") {
    const last = t.tracks.map((x) => x.kind).lastIndexOf("video");
    t.tracks.splice(last + 1, 0, track);
  } else t.tracks.push(track);
  return track;
}

/** The red (to fix) or green (made) track, made when missing: green always right above red, both above the rest. */
function roleTrack(t: Timeline, role: TrackRole): Track {
  const have = t.tracks.find((x) => x.role === role);
  if (have) return have;
  const track = newTrack(t, "video");
  Object.assign(track, { name: FIX_TRACK[role].name, color: FIX_TRACK[role].color, role });
  const green = t.tracks.find((x) => x.role === "fixed");
  if (role === "fix" && green) {
    t.tracks = t.tracks.filter((x) => x !== track);
    t.tracks.splice(t.tracks.indexOf(green), 0, track);
  }
  return track;
}
const FRESH_FIX: Fix = { note: "", mode: "parts", job: null, from: null, state: "draft" };

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
      const c: Clip = { id: newId("c"), assetId: a.id, start: 0, in: 0, out: len, speed: 1, volume: 1, fit: "cover", transform: { ...DEFAULT_TRANSFORM }, text: null, ...CLIP_DEFAULTS, keys: [] };
      let track = cmd.trackId === "new" ? newTrack(t, kind) : cmd.trackId ? editable(t, cmd.trackId) : null;
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
        ...CLIP_DEFAULTS,
        keys: [],
        text: { ...DEFAULT_TEXT, body: (cmd.body ?? DEFAULT_TEXT.body).slice(0, LIMITS.text) },
      };
      place(track, c);
      return { timeline: t, label: "أضفت نصًا", select: [c.id] };
    }

    case "move_clip": {
      const { track: from, clip } = owned(t, cmd.clipId);
      // a video's sound taken out (on a sound track) moves as sound
      const kind = from.kind === "audio" ? "audio" : trackFor(clip, assets);
      const to = cmd.trackId === "new" ? newTrack(t, kind) : editable(t, cmd.trackId);
      if (to.kind !== kind) fail(to.kind === "audio" ? "هذا المسار للصوت فقط." : to.kind === "text" ? "هذا المسار للنصوص فقط." : "هذا المسار للصور والفيديو.");
      if (to.role === "fix") {
        // a piece on the red track stays exactly where it was in time
        if (from !== to && !free(to, clip.start, clipEnd(clip))) fail("فيه جزء ثاني بنفس المكان على المسار الأحمر.");
        if (magnet(t, from)) t.magnetic = false;
        clip.fix ??= { ...FRESH_FIX };
        from.clips = from.clips.filter((c) => c.id !== clip.id);
        to.clips = [...to.clips.filter((c) => c.id !== clip.id), clip].sort((a, b) => a.start - b.start);
        if (from !== to) tidy(t, from);
        return { timeline: t, label: "رفعت جزءًا للتعديل", select: [clip.id] };
      }
      clip.fix = null;
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
        // caption words stay on their moment on the timeline
        if (clip.words.length) clip.words = clip.words.map((w) => ({ ...w, s: w.s + clip.start - start, e: w.e + clip.start - start }));
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
          const right: Clip = { ...structuredClone(c), id: newId("c"), start: at, in: cut, fadeIn: 0 };
          if (right.fix) right.fix = { ...right.fix, job: null, from: null, state: "draft" };
          if (c.words.length) {
            // a caption keeps each word on the side it is said; the text follows the words
            const rel = at - c.start;
            right.words = c.words.filter((w) => w.s >= rel).map((w) => ({ ...w, s: w.s - rel, e: w.e - rel }));
            c.words = c.words.filter((w) => w.s < rel);
            if (c.text && right.text) {
              c.text = { ...c.text, body: c.words.map((w) => w.w).join(" ") || c.text.body };
              right.text = { ...right.text, body: right.words.map((w) => w.w).join(" ") || right.text.body };
            }
          }
          // the cut is a plain one; what came after the clip now comes after its right part
          c.out = cut;
          c.transition = null;
          c.fadeOut = 0;
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
      if (p.fadeIn != null) clip.fadeIn = Math.round(Math.min(clipLength(clip), Math.max(0, Number(p.fadeIn) || 0)));
      if (p.fadeOut != null) clip.fadeOut = Math.round(Math.min(clipLength(clip), Math.max(0, Number(p.fadeOut) || 0)));
      if (p.shape) clip.shape = p.shape === "circle" ? "circle" : p.shape === "rounded" ? "rounded" : "rect";
      if (p.sound !== undefined) {
        const a = clip.assetId ? assets.get(clip.assetId) : null;
        if (!a || a.kind === "image" || a.hasAudio === false) fail("تحسين الصوت والمؤثرات للمقاطع اللي فيها صوت.");
        clip.sound = p.sound === null ? null : readSound({ ...(clip.sound ?? NO_SOUND_FX), ...p.sound });
      }
      if (p.fx !== undefined) {
        const a = clip.assetId ? assets.get(clip.assetId) : null;
        if (clip.text || track.kind !== "video" || !a || a.kind === "audio") fail("المؤثرات للصور والفيديو.");
        const list = readFx(p.fx);
        if (Array.isArray(p.fx) && p.fx.length && !list.length) fail("مؤثر غير معروف.");
        clip.fx = list;
      }
      if (p.anim !== undefined) {
        if (track.kind === "audio") fail("الدخول والخروج للنصوص والصور والفيديو.");
        clip.anim = p.anim === null ? null : readAnim({ ...(clip.anim ?? {}), ...p.anim }, !!clip.text);
      }
      if (p.fix) {
        if (track.role !== "fix") fail("الملاحظات للأجزاء اللي على المسار الأحمر.");
        clip.fix = readFix({ ...(clip.fix ?? FRESH_FIX), ...p.fix });
      }
      if (p.own != null) {
        if (!clip.text) fail("الفصل للكابشن والنصوص فقط.");
        clip.own = !!p.own;
      }
      if (p.color !== undefined) {
        if (clip.text || track.kind === "audio") fail("الألوان للصور والفيديو فقط.");
        const next = p.color === null ? null : { ...(clip.color ?? NEUTRAL_COLOR), ...p.color };
        if (next && !(next.preset in COLOR_PRESETS)) next.preset = "none";
        clip.color = next;
      }
      if (p.bg !== undefined) {
        if (clip.text || track.kind !== "video") fail("عزل الشخص للصور والفيديو فقط.");
        if (p.bg === null) clip.bg = null;
        else {
          const next = { ...(clip.bg ?? DEFAULT_BACKDROP), ...p.bg };
          clip.bg = {
            mode: next.mode === "remove" || next.mode === "color" ? next.mode : "blur",
            color: /^#[0-9a-f]{6}$/i.test(next.color) ? next.color : DEFAULT_BACKDROP.color,
            blur: Math.round(Math.min(100, Math.max(1, Number(next.blur) || DEFAULT_BACKDROP.blur))),
          };
        }
      }
      if (p.transition !== undefined) {
        if (track.kind === "audio") fail("الانتقالات للصور والفيديو والنص.");
        if (p.transition && !(p.transition.kind in TRANSITIONS)) fail("انتقال غير معروف.");
        clip.transition = p.transition
          ? { kind: p.transition.kind, ms: Math.round(Math.min(TRANSITION_MS.max, Math.max(TRANSITION_MS.min, Number(p.transition.ms ?? clip.transition?.ms ?? TRANSITION_MS.default)))) }
          : null;
      }
      if (p.text && clip.text) {
        const before = clip.text.body;
        clip.text = { ...clip.text, ...p.text };
        clip.text.body = String(clip.text.body ?? "").slice(0, LIMITS.text);
        // a caption's words keep their timing when the words are corrected one for one; otherwise it becomes plain text
        if (clip.words.length && clip.text.body !== before) {
          const tokens = clip.text.body.split(/\s+/).filter(Boolean);
          clip.words = tokens.length === clip.words.length ? clip.words.map((w, i) => ({ ...w, w: tokens[i] })) : [];
        }
      }
      if (p.speed != null) {
        if (magnet(t, track)) tidy(t, track);
        else place(track, clip);
      }
      const label = p.text
        ? "عدّلت النص"
        : p.volume != null
          ? "غيّرت مستوى الصوت"
          : p.speed != null
            ? "غيّرت السرعة"
            : p.color !== undefined
              ? "غيّرت الألوان"
              : p.bg !== undefined
                ? p.bg
                  ? "غيّرت الخلفية"
                  : "رجّعت الخلفية الأصلية"
              : p.transition !== undefined
                ? p.transition
                  ? `انتقال ${TRANSITIONS[p.transition.kind].label}`
                  : "شلت الانتقال"
                : p.fadeIn != null || p.fadeOut != null
                  ? "تلاشي الصوت"
                  : "عدّلت مقطعًا";
      return { timeline: t, label, select: [clip.id] };
    }

    case "set_key": {
      const { clip } = owned(t, cmd.clipId);
      if (clip.keys.length >= LIMITS.keys) fail("وصلت لأكثر عدد من نقاط الحركة لهذا المقطع.");
      const at = Math.min(clipEnd(clip), Math.max(clip.start, cmd.at));
      const st = Math.round(sourceTime(clip, at));
      // the first point keeps how the clip looked until now
      const base = transformAt(clip, at);
      const clean = Object.fromEntries(Object.entries(cmd.transform ?? {}).filter(([, v]) => Number.isFinite(v)));
      const m = { ...base, ...clean };
      const key = { t: st, x: m.x, y: m.y, scale: m.scale, rotate: m.rotate, opacity: m.opacity };
      clip.keys = [...clip.keys.filter((k) => Math.abs(k.t - st) > 15), key].sort((a, b) => a.t - b.t);
      clip.transform = { x: key.x, y: key.y, scale: key.scale, rotate: key.rotate, opacity: key.opacity };
      return { timeline: t, label: "نقطة حركة", select: [clip.id] };
    }

    case "remove_key": {
      const { clip } = owned(t, cmd.clipId);
      const st = sourceTime(clip, cmd.at);
      const before = clip.keys.length;
      clip.keys = clip.keys.filter((k) => Math.abs(k.t - st) > 40);
      if (clip.keys.length === before) fail("ما فيه نقطة حركة عند المؤشر.");
      return { timeline: t, label: "شلت نقطة حركة", select: [clip.id] };
    }

    case "clear_keys": {
      const { clip } = owned(t, cmd.clipId);
      clip.keys = [];
      return { timeline: t, label: "شلت الحركة", select: [clip.id] };
    }

    case "set_markers": {
      const clean = (cmd.markers ?? []).map((m) => Math.round(Number(m))).filter((m) => Number.isFinite(m) && m >= 0 && m <= LIMITS.maxMs);
      const all = cmd.mode === "clear" ? [] : cmd.mode === "replace" ? clean : [...t.markers, ...clean];
      t.markers = [...new Set(all)].sort((a, b) => a - b).slice(0, LIMITS.markers);
      return { timeline: t, label: cmd.mode === "clear" ? "شلت علامات الإيقاع" : `علامات الإيقاع (${t.markers.length})` };
    }

    case "add_captions": {
      const look = CAPTION_STYLES[cmd.style] ?? CAPTION_STYLES.karaoke;
      const items = (cmd.items ?? []).filter((it) => String(it.body ?? "").trim() && it.end > it.start);
      if (!items.length) fail("ما فيه كلام نحطه كابشن.");
      if (countClips(t) + items.length > LIMITS.clips) fail("الكابشن أكثر من المسموح في مشروع واحد؛ قسّم المشروع.");
      const tall = t.height > t.width;
      // another caption already on screen at the same moments: this one goes a line higher
      const from = Math.min(...items.map((it) => it.start));
      const to = Math.max(...items.map((it) => it.end));
      const below = t.tracks.filter((x) => x.kind === "text" && x.clips.some((c) => c.start < to && clipEnd(c) > from)).length;
      const y = Math.max(0.12, (tall ? 0.74 : 0.85) - below * (tall ? 0.18 : 0.16));
      const track = newTrack(t, "text");
      track.name = (cmd.name ?? "كابشن").slice(0, 40);
      track.clips = items.map((it) => {
        const start = Math.max(0, Math.round(it.start));
        const len = Math.max(LIMITS.minClipMs, Math.round(it.end - start));
        return {
          id: newId("c"),
          assetId: null,
          start,
          in: 0,
          out: len,
          speed: 1,
          volume: 1,
          fit: "contain" as const,
          transform: { ...DEFAULT_TRANSFORM, y },
          text: { ...DEFAULT_TEXT, ...look.style, body: String(it.body).slice(0, LIMITS.text) },
          ...CLIP_DEFAULTS,
          keys: [],
          words: (it.words ?? []).slice(0, LIMITS.words).map((w) => ({ s: Math.max(0, Math.round(w.s)), e: Math.max(0, Math.round(w.e)), w: String(w.w).slice(0, 60) })),
        };
      });
      // phrases never overlap on one track
      let end = 0;
      track.clips = track.clips
        .sort((a, b) => a.start - b.start)
        .filter((c) => {
          if (c.start < end) {
            const cut = end - c.start;
            if (clipLength(c) - cut < LIMITS.minClipMs) return false;
            c.start = end;
            c.out -= cut;
            c.words = c.words.map((w) => ({ ...w, s: Math.max(0, w.s - cut), e: Math.max(0, w.e - cut) }));
          }
          end = clipEnd(c);
          return true;
        });
      return { timeline: t, label: `كابشن (${track.clips.length} جملة)`, select: [] };
    }

    case "style_track": {
      const track = editable(t, cmd.trackId);
      if (track.kind !== "text") fail("هذا للمسارات النصية.");
      const clean = { ...cmd.text };
      delete clean.body;
      for (const c of track.clips) {
        if (!c.text || (c.own && !cmd.all)) continue;
        c.text = { ...c.text, ...clean };
        if (cmd.y != null && Number.isFinite(cmd.y)) c.transform = { ...c.transform, y: cmd.y };
      }
      return { timeline: t, label: "غيّرت شكل الكابشن" };
    }

    case "transition_all": {
      const track = cmd.trackId ? editable(t, cmd.trackId) : (mainTrack(t) ?? fail("ما فيه مسار رئيسي."));
      if (cmd.kind && !(cmd.kind in TRANSITIONS)) fail("انتقال غير معروف.");
      let n = 0;
      for (let i = 0; i + 1 < track.clips.length; i++) {
        const a = track.clips[i];
        if (track.clips[i + 1].start !== clipEnd(a)) continue;
        a.transition = cmd.kind ? { kind: cmd.kind, ms: Math.round(Math.min(TRANSITION_MS.max, Math.max(TRANSITION_MS.min, cmd.ms ?? TRANSITION_MS.default))) } : null;
        n++;
      }
      if (!n) fail("ما فيه مقاطع متلاصقة في هذا المسار.");
      return { timeline: t, label: cmd.kind ? `انتقال ${TRANSITIONS[cmd.kind].label} لكل القصات` : "شلت كل الانتقالات" };
    }

    case "extract_audio": {
      const { track, clip } = owned(t, cmd.clipId);
      const a = clip.assetId ? assets.get(clip.assetId) : null;
      if (!a || a.kind !== "video" || track.kind === "audio") fail("اختر مقطع فيديو أول.");
      if (a!.hasAudio === false) fail("هذا الفيديو ما فيه صوت.");
      if (clip.volume === 0) fail("صوت هذا المقطع مطلّع أو مكتوم من قبل.");
      if (countClips(t) >= LIMITS.clips) fail("وصلت لأكثر عدد من المقاطع في مشروع واحد.");
      const end = clipEnd(clip);
      const sound: Clip = {
        ...structuredClone(clip),
        id: newId("c"),
        transform: { ...DEFAULT_TRANSFORM },
        keys: [],
        color: null,
        transition: null,
        bg: null,
        anim: null,
        fx: [],
        shape: "rect",
      };
      const dest = t.tracks.find((x) => x.kind === "audio" && !x.locked && free(x, clip.start, end)) ?? newTrack(t, "audio");
      dest.clips = [...dest.clips, sound].sort((x, y) => x.start - y.start);
      clip.volume = 0;
      clip.sound = null;
      clip.fadeIn = 0;
      clip.fadeOut = 0;
      return { timeline: t, label: "طلّعت الصوت من الفيديو", select: [sound.id] };
    }

    case "add_track": {
      if (cmd.role === "fix" || cmd.role === "fixed") {
        if (t.tracks.some((x) => x.role === cmd.role)) fail("المسار موجود من قبل.");
        const track = roleTrack(t, cmd.role);
        return { timeline: t, label: `أضفت مسار «${track.name}»`, select: [track.id] };
      }
      const track = newTrack(t, cmd.kind);
      return { timeline: t, label: `أضفت مسار ${TRACK_NAME[cmd.kind]}`, select: [track.id] };
    }

    case "update_track": {
      // a track, or the track of a clip (a clip just made, as "$N")
      const track = t.tracks.find((x) => x.id === cmd.trackId) ?? findClip(t, cmd.trackId)?.track ?? fail("ما لقينا هذا المسار.");
      const p = cmd.patch;
      if (p.muted != null) track.muted = !!p.muted;
      if (p.hidden != null) track.hidden = !!p.hidden;
      if (p.locked != null) track.locked = !!p.locked;
      if (p.name != null) track.name = String(p.name).slice(0, 40);
      if (p.color !== undefined) {
        if (p.color !== null && !TRACK_COLORS.includes(p.color)) fail("لون غير معروف.");
        track.color = p.color;
      }
      if (p.duck != null) {
        if (track.kind !== "audio") fail("الخفض التلقائي لمسارات الصوت.");
        track.duck = !!p.duck;
      }
      const label = p.duck != null ? (track.duck ? "خفض تلقائي وقت الكلام" : "أطفأت الخفض التلقائي") : p.locked != null ? (track.locked ? "قفلت مسارًا" : "فتحت مسارًا") : p.muted != null ? (track.muted ? "كتمت مسارًا" : "شغّلت صوت مسار") : p.hidden != null ? (track.hidden ? "أخفيت مسارًا" : "أظهرت مسارًا") : p.color !== undefined ? "لوّنت مسارًا" : "سمّيت مسارًا";
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

    case "lift_fix": {
      const { track: from, clip } = owned(t, cmd.clipId);
      const a = clip.assetId ? assets.get(clip.assetId) : null;
      if (from.kind !== "video" || !a || a.kind !== "video") fail("ارفع جزءًا من فيديو.");
      if (from.role === "fix") fail("هذا الجزء على المسار الأحمر من قبل.");
      const red = roleTrack(t, "fix");
      if (red.locked) fail(`المسار «${red.name}» مقفول؛ افتح القفل أول.`);
      if (!free(red, clip.start, clipEnd(clip))) fail("فيه جزء ثاني بنفس المكان على المسار الأحمر.");
      // the main track must not close the gap the piece leaves behind
      if (magnet(t, from)) t.magnetic = false;
      from.clips = from.clips.filter((c) => c.id !== clip.id);
      tidy(t, from);
      clip.fix = { ...FRESH_FIX };
      clip.transition = null;
      red.clips = [...red.clips, clip].sort((x, y) => x.start - y.start);
      return { timeline: t, label: "رفعت جزءًا للمسار الأحمر", select: [clip.id] };
    }

    case "place_fixed": {
      const { track: red, clip } = findClip(t, cmd.clipId) ?? fail("ما لقينا الجزء.");
      if (red.role !== "fix") fail("هذا الجزء مو على المسار الأحمر.");
      const a = assets.get(cmd.assetId) ?? fail("ما لقينا الملف.");
      if (a.kind !== "video") fail("التعديل لازم يكون فيديو.");
      const green = roleTrack(t, "fixed");
      const len = clip.out - clip.in;
      const max = a.durationMs ?? len;
      const inMs = Math.round(Math.max(0, Math.min(Number(cmd.offset) || 0, max - LIMITS.minClipMs)));
      const made: Clip = {
        ...structuredClone(clip),
        id: newId("c"),
        assetId: a.id,
        in: inMs,
        out: Math.round(Math.min(max, inMs + len)),
        fix: null,
        transition: null,
      };
      const end = clipEnd(made);
      // a newer result replaces what was made for the same place
      green.clips = [...green.clips.filter((c) => clipEnd(c) <= made.start || c.start >= end), made].sort((x, y) => x.start - y.start);
      clip.fix = { ...(clip.fix ?? FRESH_FIX), state: "done" };
      // the original piece stays under it, quiet
      red.muted = true;
      if (countClips(t) > LIMITS.clips) fail("وصلت لأكثر عدد من المقاطع في مشروع واحد.");
      return { timeline: t, label: "حطّيت التعديل على المسار الأخضر", select: [made.id] };
    }

    case "set_magnetic": {
      t.magnetic = cmd.on;
      const main = mainTrack(t);
      if (main && cmd.on) main.clips = pack(main.clips);
      return { timeline: t, label: cmd.on ? "شغّلت المغناطيس" : "أطفأت المغناطيس" };
    }

    case "remove_ranges": {
      // the spans, merged, from the end backwards (so earlier spans keep their times)
      const spans = (cmd.ranges ?? [])
        .map(([a, b]) => [Math.max(0, Math.round(Math.min(a, b))), Math.round(Math.max(a, b))] as [number, number])
        .filter(([a, b]) => b - a >= 20)
        .sort((x, y) => x[0] - y[0])
        .reduce<[number, number][]>((m, r) => {
          const last = m[m.length - 1];
          if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
          else m.push([r[0], r[1]]);
          return m;
        }, [])
        .reverse();
      if (!spans.length) fail("ما فيه أجزاء نشيلها.");
      let removed = 0;
      for (const [a, b] of spans) {
        for (const track of t.tracks) {
          const hit = track.clips.some((c) => c.start < b && clipEnd(c) > a);
          if (track.locked && (hit || track.clips.some((c) => c.start >= b))) fail(`المسار «${track.name}» مقفول؛ افتح القفل أول.`);
          const next: Clip[] = [];
          for (const c of track.clips) {
            const e = clipEnd(c);
            if (e <= a) next.push(c);
            else if (c.start >= b) next.push({ ...c, start: c.start - (b - a) });
            else next.push(...cutOut(c, a, b, assets));
          }
          track.clips = next.filter((c) => clipLength(c) >= LIMITS.minClipMs).sort((x, y) => x.start - y.start);
          if (magnet(t, track)) track.clips = pack(track.clips);
        }
        removed += b - a;
      }
      return { timeline: t, label: `شلت ${formatTime(removed)} (${spans.length} جزء)` };
    }

    case "close_gaps": {
      const track = cmd.trackId ? editable(t, cmd.trackId) : (mainTrack(t) ?? fail("ما فيه مسار رئيسي."));
      track.clips = pack(track.clips);
      return { timeline: t, label: "سكّرت الفراغات" };
    }
  }
  return fail("أمر غير معروف.");
}

/** The part of a clip outside [a, b) as one or two clips (the right one moved back to `a`). */
function cutOut(c: Clip, a: number, b: number, assets: Map<string, AssetInfo>): Clip[] {
  const out: Clip[] = [];
  const e = clipEnd(c);
  const still = isStill(c, assets);
  if (c.start < a) {
    const left = { ...structuredClone(c), out: still ? c.in + (a - c.start) * c.speed : Math.round(sourceTime(c, a)), transition: null, fadeOut: 0 };
    left.words = left.words.filter((w) => w.s < a - c.start);
    out.push(left);
  }
  if (e > b) {
    const shift = b - c.start;
    const right = { ...structuredClone(c), id: c.start < a ? newId("c") : c.id, start: a, fadeIn: 0 };
    if (still) right.out = c.in + (e - b) * c.speed;
    else right.in = Math.round(sourceTime(c, b));
    right.words = right.words.filter((w) => w.s >= shift).map((w) => ({ ...w, s: w.s - shift, e: w.e - shift }));
    out.push(right);
  }
  return out;
}

/** Applies several commands in order as one change (one undo step); stops at the first that can't be done. */
export function applyAll(timeline: Timeline, cmds: Command[], assets: Map<string, AssetInfo>, label?: string): Applied {
  let t = timeline;
  let last: Applied | null = null;
  // "$2" in a later command means the clip the 2nd command made (for scripts written before the ids exist)
  const made = new Map<string, string>();
  const resolve = (v: unknown): unknown =>
    typeof v === "string" && /^\$\d+$/.test(v) ? (made.get(v) ?? v) : Array.isArray(v) ? v.map(resolve) : v;
  for (const [i, raw] of cmds.entries()) {
    const c = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, k === "clipId" || k === "clipIds" || k === "trackId" ? resolve(v) : v])) as Command;
    const r = apply(t, c, assets);
    last = r;
    t = r.timeline;
    if (r.select?.[0]) made.set(`$${i + 1}`, r.select[0]);
  }
  return { timeline: t, label: label ?? last?.label ?? "", select: last?.select };
}
