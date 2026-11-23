"use client";

// «حيدرة كت» — the timeline. Time runs left → right even in Arabic (like every editor), so this part is dir="ltr".
// Mouse: drag a clip to move it (to another track too), its edges to trim, the ruler to scrub; Ctrl+wheel zooms.
// Touch (CapCut's way): a tap selects, a selected clip drags, its big handles trim, two fingers zoom, one finger scrolls.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clipEnd, clipLength, duration, formatTime, mainTrack, timelineTime, trackEnd, TRACK_COLORS, TRANSITIONS, type Clip, type Timeline as TL, type Track, type TrackFolder } from "@/lib/editor/model";
import type { Command } from "@/lib/editor/commands";
import { freeSlot, groupSnap, movedLabel, nearestPoint, trackShift } from "@/lib/editor/snap";
import { liveTracks } from "@/lib/editor/cover";
import Icon from "../Icon";
import type { EditorAsset } from "./types";
import type { SyncFlag } from "./sync";

export interface PlayerLike {
  readonly ms: number;
  readonly playing: boolean;
  seek(ms: number): void;
  pause(): void;
  subscribe(fn: (ms: number, playing: boolean) => void): () => void;
}

/** The window event the editor's zoom keys send: detail "in" | "out" | "fit". */
export const TL_ZOOM = "jw:tl-zoom";

interface Props {
  tl: TL;
  assets: Map<string, EditorAsset>;
  thumbs: Record<string, string | null>;
  selected: string[];
  onSelect: (ids: string[]) => void;
  /** align every selected video/audio clip against the first selected clip */
  onSync?: (ids: string[]) => void;
  syncing?: boolean;
  run: (cmd: Command | Command[], opts?: { label?: string; coalesce?: string }) => void;
  /** a right-click (two fingers on a Mac) on a clip or an empty spot */
  onMenu?: (m: { x: number; y: number; clipId: string | null; ms: number; trackId: string | null }) => void;
  player: PlayerLike | null;
  compact: boolean;
  readOnly: boolean;
  onEmpty: () => void;
  /** the waveform pictures of the sound files */
  waves: Record<string, string | null>;
  /** a cut's transition button: opens the outgoing clip's «انتقال» */
  onTransition: (clipId: string) => void;
  /** files dragged in from the computer (Finder, Explorer) and let go at a moment, over a track (or none) */
  onDropFiles: (files: File[], at: number, trackId: string | null) => void;
  /** a file dragged from the project's library */
  onDropAsset: (assetId: string, at: number, trackId: string | null) => void;
  /** «عادي» (pictures along the clips) or «بريمير» (solid coloured clips, named tracks, timecode) */
  look?: "classic" | "pro";
  /** «منطقة التصدير» (In → Out), shown on the ruler */
  range?: { from: number; to: number } | null;
  /** «تعليقات المراجعة»: the client's comments on the ruler (a press opens one); `lost`: on its version's own time */
  notes?: { id: number; at: number; how: "same" | "moved" | "lost"; done: boolean; text: string }[];
  onNote?: (id: number) => void;
  /** «زامن الصوت»: the clips it could not line up (red) or lined up with medium confidence (amber) */
  flags?: Record<string, SyncFlag>;
  onFlags?: (next: Record<string, SyncFlag>) => void;
  /** the timeline takes the whole editor (the button in its corner; Esc leaves) */
  full?: boolean;
  onFull?: () => void;
}

/** What the library puts on a drag (the asset's id). */
export const ASSET_DRAG = "application/x-jawad-asset";
const MEDIA_FILE = /\.(mp4|mov|m4v|webm|mkv|mp3|m4a|aac|wav|ogg|opus|flac|png|jpe?g|webp|gif|heic|avif)$/i;

type Mode = "move" | "start" | "end";
/** The keys a pointer event carries. */
type Mods = { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean };
/** ⌘ (Mac), Ctrl (Windows) or Alt (Premiere's own) held: a drag copies instead of moving. */
const copyKey = (e: Mods) => !!(e.metaKey || e.ctrlKey || e.altKey);

interface Drag {
  id: string;
  mode: Mode;
  pointer: number;
  x0: number;
  y0: number;
  moved: boolean;
  trackId: string;
  start: number;
  end: number;
  /** the earliest start / latest end the clip's source allows */
  lo: number;
  hi: number;
  ghostStart: number;
  ghostEnd: number;
  ghostTrack: string;
  /** the moment the clip is stuck to (another clip's edge, the playhead, a beat), for the guide line */
  snapAt: number | null;
  /** the other selected clips, moving with it by the same time (and by the same number of tracks, each among its own kind) */
  group: { id: string; trackId: string; start: number; end: number }[];
  /** the top (px in the scrolled content) of the row the clip is over, for the «+2.4 ث» badge */
  top: number;
  /** where each of the others is headed (clip id → track id), when the drag crossed to another track */
  groupTrack: Record<string, string>;
  /** ⌘ / Ctrl / Alt held while dragging: a copy goes where it is dropped and the clip stays (Premiere's Alt-drag) */
  copy?: boolean;
  /** ⌘ / Ctrl / Shift pressed on a clip already selected: a plain click (no drag) takes it out of the selection */
  toggleOff?: boolean;
}

/** A box being drawn over the empty timeline to select every clip it touches (in the content's pixels). */
interface Box {
  pointer: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** what was selected before, kept when Shift/Ctrl/Cmd is held */
  base: string[];
}

/** the zoom's range in pixels per second: from a 4-hour film on one screen (0.02) to single frames (1500) */
export const MIN_PPS = 0.02;
export const MAX_PPS = 1500;
/** «تكبير طولي»: how tall the tracks are drawn, from half to three times the usual */
export const MIN_VZ = 0.5;
export const MAX_VZ = 3;
const VZ_KEY = "editor-tl-vz";
/** the widest the timeline's content is ever drawn (px): past this browsers misplace what is inside */
const MAX_CONTENT_PX = 8_000_000;
/** a folder's own row */
const FOLDER_H = 24;
/** the room above the tracks (drop a clip there: a new track) and under them */
const GAP_TOP = 26;
const GAP_BOTTOM = 56;
const RULER = 26;
const RULER_PHONE = 18;
const SNAP_PX = 10;

/** A clip on a sound track is sound, even when it comes from a video (its sound taken out). */
const kindOf = (c: Clip, assets: Map<string, EditorAsset>, onSound = false) => (c.text ? "text" : onSound ? "audio" : (assets.get(c.assetId ?? "")?.kind ?? "video"));
const fits = (track: Track, c: Clip, assets: Map<string, EditorAsset>, onSound: boolean) => {
  const k = kindOf(c, assets, onSound);
  return track.kind === (k === "image" ? "video" : k);
};

/** Ruler steps that keep labels ~80px apart at any zoom. */
function rulerStep(pps: number) {
  const steps = [40, 100, 200, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 1_200_000, 1_800_000, 3_600_000, 7_200_000];
  return steps.find((s) => (s * pps) / 1000 >= 80) ?? 7_200_000;
}

const TRACK_KINDS: { kind: Track["kind"]; label: string; icon: "layers" | "music" | "type" }[] = [
  { kind: "video", label: "فيديو وصور", icon: "layers" },
  { kind: "audio", label: "صوت", icon: "music" },
  { kind: "text", label: "نص وكابشن", icon: "type" },
];

/** A timecode HH:MM:SS:FF (the «بريمير» timeline). */
export const timecode = (ms: number, fps: number) => {
  const f = Math.floor(((ms % 1000) / 1000) * fps);
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(f)}`;
};
const PRO_TONE = { video: "#2f4f6e", image: "#3a5470", audio: "#2f6b4f", text: "#7346b0" } as const;

export default function Timeline({ tl, assets, thumbs, waves, selected, onSelect, onSync, syncing = false, run, player, compact, readOnly, onEmpty, onTransition, onDropFiles, onDropAsset, onMenu, look = "classic", range, notes, onNote, flags, onFlags, full = false, onFull }: Props) {
  const pro = look === "pro";
  // track labels like V1, V2, A1, T1 (bottom-up for pictures, top-down for sound)
  const labels = new Map<string, string>();
  for (const kind of ["video", "audio", "text"] as const) tl.tracks.filter((t) => t.kind === kind).forEach((t, i) => labels.set(t.id, `${kind === "video" ? "V" : kind === "audio" ? "A" : "T"}${i + 1}`));
  // a phone (CapCut's way): no track heads, the playhead fixed in the middle and the clips slide under it; half a screen
  // of room on each side lets the very start and the end reach it
  const HEAD = compact ? 0 : 204;
  const scroller = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !compact) return;
    const measure = () => setPad(Math.round(el.clientWidth / 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);
  /** where moment 0 sits in the scrolled content */
  const X0 = compact ? pad : HEAD;
  // what this component scrolled to itself (the player moving), so that scroll isn't taken for the person's finger
  const wantScroll = useRef<number | null>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const content = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState(40);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // a zoom asked for and not drawn yet: the moment `ms` goes under screen x at `pps`
  const anchor = useRef<{ ms: number; x: number; pps: number } | null>(null);
  // the zoom the page shows right now (set with the scroll, so the two always belong together)
  const shown = useRef(40);
  const [, redraw] = useState(0);
  const fitted = useRef(false);
  const total = duration(tl);
  const main = mainTrack(tl);

  // tracks as people expect them: the top layer first, the main track under the pictures, sound at the bottom
  const ordered = useMemo(() => {
    const visual = tl.tracks.filter((t) => t.kind !== "audio").reverse();
    return [...visual, ...tl.tracks.filter((t) => t.kind === "audio")];
  }, [tl.tracks]);
  // «تكبير طولي»: the tracks taller or shorter (kept on this device), so many tracks fit or one shows its waveform big
  const [vz, setVz] = useState(1);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(VZ_KEY));
      if (v >= MIN_VZ && v <= MAX_VZ) {
        const t = setTimeout(() => setVz(v), 0);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);
  const zoomTall = useCallback((next: number) => {
    const v = Math.round(Math.min(MAX_VZ, Math.max(MIN_VZ, next)) * 100) / 100;
    setVz(v);
    try {
      localStorage.setItem(VZ_KEY, String(v));
    } catch {}
  }, []);
  // a computer: tall enough that a clip's picture or waveform shows under its name
  const height = (t: Track) => Math.max(16, Math.round((t.id === main?.id ? (compact ? 56 : 74) : t.kind === "audio" ? (compact ? 30 : 52) : t.kind === "text" ? (compact ? 30 : 40) : compact ? 30 : 56) * (compact ? 1 : vz)));
  // «S» / «H» worked out: which tracks are really seen and heard now (the rows of the others are dimmed)
  const quiet = useMemo(() => new Set(liveTracks(tl.tracks).filter((t) => (t.kind === "audio" ? t.muted : t.hidden)).map((t) => t.id)), [tl.tracks]);
  // «مجلدات المسارات»: a folder's row where its first track stands, its tracks under it (none when it is folded)
  const display = useMemo(() => {
    const out: ({ folder: TrackFolder; tracks: Track[]; track?: undefined } | { track: Track; folder: TrackFolder | null })[] = [];
    const done = new Set<string>();
    for (const t of ordered) {
      const f = t.folder ? ((tl.folders ?? []).find((x) => x.id === t.folder) ?? null) : null;
      if (!f) {
        out.push({ track: t, folder: null });
        continue;
      }
      if (done.has(f.id)) continue;
      done.add(f.id);
      const members = ordered.filter((x) => x.folder === f.id);
      out.push({ folder: f, tracks: members });
      if (!f.closed) for (const m of members) out.push({ track: m, folder: f });
    }
    return out;
  }, [ordered, tl.folders]);

  // Where a zoom put the view, to the fraction of a pixel. The browser keeps whole pixels, and a zoom used to start
  // from that rounded place: every step multiplied the lost fraction, so over a long zoom (a pinch is dozens of small
  // steps) what was under the pointer slid away, off the screen. While the person has not scrolled since, the next
  // step starts from the exact place instead.
  const exactLeft = useRef<number | null>(null);
  const leftNow = useCallback(() => {
    const el = scroller.current;
    if (!el) return 0;
    const e = exactLeft.current;
    return e != null && Math.abs(el.scrollLeft - e) <= 1 ? e : el.scrollLeft;
  }, []);
  const lanePx = (ms: number) => (ms * pps) / 1000;
  const contentW = compact ? X0 + lanePx(total) + pad + 56 : HEAD + lanePx(total + 15_000) + 80;

  // ---------- zoom ----------
  // A zoom never reads the zoom of the render it was written in: steps come faster than the page redraws (a wheel, a
  // pinch), and a step that mixed the old zoom with the new scroll place sent the view somewhere else. Every step
  // starts from the zoom asked for last (drawn or not) and from the moment that is under the pointer in it.
  const ppsNow = useCallback(() => anchor.current?.pps ?? shown.current, []);
  /** the moment (ms) under screen x (px from the scroller's left) */
  const msUnder = useCallback(
    (x: number) => {
      const a = anchor.current;
      return a ? a.ms + ((x - a.x) * 1000) / a.pps : ((leftNow() + x - X0) * 1000) / shown.current;
    },
    [leftNow, X0],
  );
  const zoomTo = useCallback(
    (next: number, at?: { ms: number; x: number }) => {
      const el = scroller.current;
      // never so far in that the content is wider than a browser draws right (a long film stops a little before single frames)
      const z = Math.min(MAX_PPS, (MAX_CONTENT_PX * 1000) / (total + 15_000), Math.max(MIN_PPS, next));
      if (el) {
        const x = at?.x ?? el.clientWidth / 2;
        anchor.current = { ms: at?.ms ?? msUnder(x), x, pps: z };
      }
      setPps(z);
      // (drawn again even when the zoom is the same, at its limit: the place asked for is always applied)
      redraw((n) => n + 1);
    },
    [total, msUnder],
  );
  useLayoutEffect(() => {
    shown.current = pps;
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a) return;
    if (a.pps !== pps) return; // a newer step is on its way
    anchor.current = null;
    const x = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, X0 + (a.ms * pps) / 1000 - a.x));
    wantScroll.current = x;
    exactLeft.current = x;
    el.scrollLeft = x;
  });
  const fit = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    if (compact) {
      // a phone: the whole thing on the screen when it is short, about a screen for every 8 seconds otherwise
      zoomTo(Math.min(80, Math.max(24, total ? ((el.clientWidth - 40) * 1000) / total : 48)), { ms: player?.ms ?? 0, x: el.clientWidth / 2 });
      return;
    }
    const w = el.clientWidth - HEAD - 40;
    zoomTo(total ? (w * 1000) / total : 40, { ms: 0, x: HEAD });
  }, [total, HEAD, compact, player, zoomTo]);
  // the first time there is something on the timeline, show all of it
  useEffect(() => {
    if (fitted.current || !total) return;
    fitted.current = true;
    const t = setTimeout(fit, 0);
    return () => clearTimeout(t);
  }, [total, fit]);

  // the zoom keys («⌨️ الاختصارات»: = / − / \ or Ctrl+= …), around the playhead
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<"in" | "out" | "fit">).detail;
      if (d === "fit") return fit();
      const el = scroller.current;
      const ms = player?.ms ?? 0;
      const x = el ? Math.min(el.clientWidth - 20, Math.max(20, X0 + (ms * shown.current) / 1000 - leftNow())) : 0;
      zoomTo(d === "in" ? ppsNow() * 1.6 : ppsNow() / 1.6, el ? { ms, x } : undefined);
    };
    window.addEventListener(TL_ZOOM, on);
    return () => window.removeEventListener(TL_ZOOM, on);
  }, [zoomTo, fit, X0, player, ppsNow, leftNow]);

  // Ctrl/⌘ + wheel (and a trackpad pinch) zooms around the pointer; two fingers on a phone too
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      // ⌥ + wheel: the tracks taller or shorter («تكبير طولي»)
      if (e.altKey && !e.ctrlKey && !e.metaKey && !compact) {
        e.preventDefault();
        return zoomTall(vz * Math.exp(-(e.deltaY || e.deltaX) * 0.004));
      }
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      zoomTo(ppsNow() * Math.exp(-e.deltaY * 0.01), { ms: msUnder(x), x });
    };
    let pinch: { d: number; pps: number; ms: number; x: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const r = el.getBoundingClientRect();
      const x = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      // (a phone keeps the moment under the fixed playhead where it is)
      pinch = compact ? { d: dist(e.touches), pps: ppsNow(), ms: player?.ms ?? 0, x: el.clientWidth / 2 } : { d: dist(e.touches), pps: ppsNow(), ms: msUnder(x), x };
    };
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      zoomTo(pinch.pps * (dist(e.touches) / pinch.d), { ms: pinch.ms, x: pinch.x });
    };
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
    };
  }, [zoomTo, compact, player, vz, zoomTall, ppsNow, msUnder]);

  // ---------- the playhead follows the player (drawn directly: 60 times a second without re-rendering) ----------
  useEffect(() => {
    if (!player) return;
    // `follow`: the view goes with the playhead (the player moved it). A zoom only redraws it where it is: the view
    // stays on what the person zoomed on — it used to jump back to the playhead, taking the clips under the pointer
    // off the screen
    const place = (ms: number, playing: boolean, follow = true) => {
      const el = scroller.current;
      if (compact) {
        // the playhead stays put; the timeline slides so this moment is under it
        if (!el) return;
        const x = (ms * pps) / 1000;
        if (Math.abs(el.scrollLeft - x) < 0.5) return;
        wantScroll.current = x;
        el.scrollLeft = x;
        return;
      }
      const x = HEAD + (ms * pps) / 1000;
      if (playhead.current) playhead.current.style.transform = `translateX(${x}px)`;
      // the playhead never leaves the view (playing, a jump to the start or end, a click in the library)
      if (follow && el && (x < el.scrollLeft + HEAD || x > el.scrollLeft + el.clientWidth - 24)) el.scrollLeft = x - HEAD - (el.clientWidth - HEAD) * (playing ? 0.15 : 0.4);
    };
    place(player.ms, false, false);
    return player.subscribe((ms, playing) => place(ms, playing));
  }, [player, pps, HEAD, compact]);

  // a phone: a swipe on the timeline scrubs the picture (and pauses it); the moment under the playhead is what plays
  useEffect(() => {
    const el = scroller.current;
    if (!el || !compact || !player) return;
    let raf = 0;
    const onScroll = () => {
      const want = wantScroll.current;
      if (want != null && Math.abs(el.scrollLeft - want) < 1) {
        wantScroll.current = null;
        return;
      }
      wantScroll.current = null;
      if (player.playing) player.pause();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => player.seek(Math.max(0, Math.min(total, (el.scrollLeft * 1000) / pps))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [compact, player, pps, total]);

  const msAt = (clientX: number) => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    return Math.max(0, ((clientX - r.left + el.scrollLeft - X0) * 1000) / pps);
  };

  // ---------- scrubbing on the ruler ----------
  const scrub = (e: React.PointerEvent) => {
    if (!player) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    player.seek(Math.min(total, msAt(e.clientX)));
  };
  const scrubMove = (e: React.PointerEvent) => {
    if (player && e.currentTarget.hasPointerCapture(e.pointerId)) player.seek(Math.min(total, msAt(e.clientX)));
  };

  // ---------- snapping ----------
  const snapPoints = useMemo(() => {
    const pts = [0];
    for (const t of tl.tracks) for (const c of t.clips) pts.push(c.start, clipEnd(c));
    // beat marks too: cuts and moves land on the beat
    pts.push(...tl.markers);
    return pts;
  }, [tl.tracks, tl.markers]);
  /** the magnet point near `ms` (the other clips' edges, the playhead, beats), or null */
  const snapTo = (ms: number, ignore: string): number | null => {
    const own = ignore ? findOwn(ignore) : null;
    return nearestPoint([...snapPoints, player?.ms ?? -1], ms, (SNAP_PX * 1000) / pps, own ? [own.start, clipEnd(own)] : []);
  };
  const snap = (ms: number, ignore: string) => snapTo(ms, ignore) ?? ms;
  /** what a drag can stick to: the edges of every clip that is not moving, the playhead, the beats, the start */
  const restPoints = (movingIds: Set<string>) => {
    const pts = [0, player?.ms ?? -1, ...tl.markers];
    for (const t of tl.tracks) for (const c of t.clips) if (!movingIds.has(c.id)) pts.push(c.start, clipEnd(c));
    return pts;
  };
  const findOwn = (id: string) => {
    for (const t of tl.tracks) for (const c of t.clips) if (c.id === id) return c;
    return null;
  };

  // ---------- clips: select, move, trim ----------
  // (the window-level listeners of a drag call the latest versions of these, not the ones of the render it began in)
  const handlers = useRef<{ onMove: (e: Mods & { pointerId: number; clientX: number; clientY: number }) => void; onUp: (e: Mods & { pointerId: number; shiftKey: boolean }) => void }>({ onMove: () => {}, onUp: () => {} });
  const begin = (e: React.PointerEvent, track: Track, c: Clip, mode: Mode) => {
    if (readOnly || e.button > 0) return;
    e.stopPropagation();
    const touch = e.pointerType === "touch";
    const isSel = selected.includes(c.id);
    const add = e.shiftKey || e.metaKey || e.ctrlKey;
    // Explicit multi-select mode makes batch actions possible on touch screens without a modifier key.
    if (selectionMode) {
      onSelect(isSel ? selected.filter((id) => id !== c.id) : [...selected, c.id]);
      return;
    }
    // on a phone an unselected clip only gets selected (its touch scrolls the timeline)
    if (touch && !isSel && mode === "move") return;
    // Shift/Ctrl/Cmd on a selected clip takes it out of the selection — when it is a click; dragged with ⌘/Ctrl it is
    // copied instead (decided when the pointer lets go)
    const toggleOff = isSel && add && mode === "move";
    if (toggleOff && e.shiftKey) return onSelect(selected.filter((id) => id !== c.id));
    const sel = isSel ? selected : add ? [...selected, c.id] : [c.id];
    if (!isSel) onSelect(sel);
    if (track.locked) return;
    // ⌘/Ctrl/Alt on a clip not yet selected and dragged: only that clip is copied (it can go to another track)
    const solo = !isSel && copyKey(e);
    const group =
      mode === "move" && !solo
        ? tl.tracks.flatMap((t) => (t.locked ? [] : t.clips.filter((x) => x.id !== c.id && sel.includes(x.id)).map((x) => ({ id: x.id, trackId: t.id, start: x.start, end: clipEnd(x) }))))
        : [];
    e.currentTarget.setPointerCapture(e.pointerId);
    const a = c.assetId ? assets.get(c.assetId) : null;
    const media = a && a.kind !== "image" && a.durationMs ? a.durationMs : null;
    const d: Drag = {
      id: c.id,
      mode,
      pointer: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
      trackId: track.id,
      start: c.start,
      end: clipEnd(c),
      lo: media != null ? Math.max(0, timelineTime(c, 0)) : 0,
      hi: media != null ? timelineTime(c, media) : Infinity,
      ghostStart: c.start,
      ghostEnd: clipEnd(c),
      ghostTrack: track.id,
      snapAt: null,
      top: rows.current.get(track.id)?.offsetTop ?? 0,
      group,
      groupTrack: {},
      copy: mode === "move" && copyKey(e),
      toggleOff,
    };
    dragRef.current = d;
    setDrag(d);
    // the drag follows the pointer anywhere on the page: the clip's own element goes away when it crosses to another
    // track (and the pointer may leave the little ghost), which used to stop the move half-way
    const pid = e.pointerId;
    const end = () => {
      window.removeEventListener("pointermove", mv, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
    };
    const mv = (ev: PointerEvent) => handlers.current.onMove(ev);
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      end();
      handlers.current.onUp(ev);
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      end();
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", mv, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
  };

  const onMove = (e: Mods & { pointerId: number; clientX: number; clientY: number }) => {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.hypot(dx, e.clientY - d.y0) < 4) return;
    const dms = (dx * 1000) / pps;
    const next = { ...d, moved: true, copy: d.mode === "move" && copyKey(e) };
    if (d.mode === "move") {
      const len = d.end - d.start;
      let s = Math.max(0, d.start + dms);
      // stuck to another clip's edge, the playhead or a beat when it comes near (the guide line shows where) — by any
      // edge of any clip being moved, not only the one under the pointer
      const hit = groupSnap(restPoints(new Set([d.id, ...d.group.map((g) => g.id)])), [d.start, d.end, ...d.group.flatMap((g) => [g.start, g.end])], s - d.start, (SNAP_PX * 1000) / pps);
      if (hit) s = d.start + hit.dt;
      // with others: none of them goes before 0
      const earliest = Math.min(d.start, ...d.group.map((g) => g.start));
      next.ghostStart = Math.max(d.start - earliest, Math.round(s));
      next.ghostEnd = next.ghostStart + len;
      next.snapAt = hit && next.ghostStart === Math.round(s) ? hit.at : null;
      // which track is under the finger; above the pictures (or under the sound) makes a new one. Over a row the clip
      // can't go on (a text track between, the sound) it stays on the last row it could be on, instead of jumping back
      const clip = findOwn(d.id)!;
      const fromTrack = tl.tracks.find((t) => t.id === d.trackId);
      const onSound = fromTrack?.kind === "audio";
      let target = d.ghostTrack === "new" ? d.trackId : d.ghostTrack;
      let found = false;
      for (const t of ordered) {
        const r = rows.current.get(t.id)?.getBoundingClientRect();
        if (r && e.clientY >= r.top && e.clientY < r.bottom) {
          found = true;
          if (fits(t, clip, assets, onSound) && !t.locked) target = t.id;
        }
      }
      if (d.group.length) {
        // a selection: all of them cross by the same number of tracks, each among the tracks of its kind (the ones of
        // another kind — a video's sound under it — keep their tracks)
        const lanes = tl.tracks.filter((t) => t.id === d.trackId || (fromTrack && t.kind === fromTrack.kind && !t.locked && !t.role && !t.angles && !!t.motion === !!fromTrack.motion));
        const lane = (id: string) => lanes.findIndex((t) => t.id === id);
        const mine = d.group.filter((g) => lane(g.trackId) >= 0);
        const shift = lane(target) < 0 ? 0 : trackShift(lanes.length, lane(d.trackId), lane(target), mine.map((g) => lane(g.trackId)));
        next.ghostTrack = lanes[lane(d.trackId) + shift]?.id ?? d.trackId;
        next.groupTrack = shift ? Object.fromEntries(mine.map((g) => [g.id, lanes[lane(g.trackId) + shift].id])) : {};
        next.top = rows.current.get(next.ghostTrack)?.offsetTop ?? d.top;
        dragRef.current = next;
        setDrag(next);
        return;
      }
      if (!found) {
        const first = rows.current.get(ordered[0]?.id ?? "")?.getBoundingClientRect();
        const last = rows.current.get(ordered.at(-1)?.id ?? "")?.getBoundingClientRect();
        const k = kindOf(clip, assets, onSound);
        if (first && e.clientY < first.top && k !== "audio") target = "new";
        else if (last && e.clientY > last.bottom && k === "audio") target = "new";
      }
      next.ghostTrack = target;
      // a taken spot: the clip sits at the nearest free one (against its neighbour) — what the ghost shows is where it lands
      const dest = tl.tracks.find((t) => t.id === target);
      if (dest && !(tl.magnetic && mainTrack(tl)?.id === dest.id)) {
        const others = dest.clips.filter((x) => x.id !== d.id).map((x) => ({ start: x.start, end: clipEnd(x) }));
        const at = freeSlot(others, next.ghostStart, len);
        if (at !== next.ghostStart) {
          next.ghostStart = at;
          next.ghostEnd = at + len;
          next.snapAt = others.some((o) => o.end === at) ? at : at + len;
        }
      }
    } else if (d.mode === "start") {
      const hit = snapTo(d.start + dms, d.id);
      const s = Math.min(d.end - 100, Math.max(d.lo, hit ?? d.start + dms));
      next.ghostStart = Math.round(s);
      next.snapAt = hit != null && Math.round(s) === hit ? hit : null;
    } else {
      const hit = snapTo(d.end + dms, d.id);
      const en = Math.max(d.start + 100, Math.min(d.hi, hit ?? d.end + dms));
      next.ghostEnd = Math.round(en);
      next.snapAt = hit != null && Math.round(en) === hit ? hit : null;
    }
    next.top = rows.current.get(next.ghostTrack === "new" ? (ordered[0]?.id ?? "") : next.ghostTrack)?.offsetTop ?? d.top;
    dragRef.current = next;
    setDrag(next);
  };

  const onUp = (e: Mods & { pointerId: number; shiftKey: boolean }) => {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    // a plain click on one of several selected clips leaves only it selected
    if (!d.moved) {
      if (d.toggleOff) onSelect(selected.filter((id) => id !== d.id));
      // a plain click leaves only this clip selected (and brings its settings up again)
      else if (!(e.shiftKey || e.metaKey || e.ctrlKey)) onSelect([d.id]);
      return;
    }
    if (d.mode === "move" && (copyKey(e) || d.copy)) {
      // ⌘/Ctrl/Alt + drag: copies where they were dropped; the clips themselves stay where they were
      const dt = d.ghostStart - d.start;
      const all = [{ id: d.id, trackId: d.ghostTrack, start: d.start }, ...d.group.map((g) => ({ ...g, trackId: d.groupTrack[g.id] ?? g.trackId }))];
      run(all.map((g) => ({ type: "copy_clip" as const, clipId: g.id, trackId: g.trackId, start: Math.max(0, g.start + dt) })), { label: all.length > 1 ? `نسخت ${all.length} مقاطع` : "نسخت مقطعًا" });
      return;
    }
    if (d.mode === "move") {
      if (d.ghostTrack === d.trackId && d.ghostStart === d.start) return;
      // moved by hand: its «ما تزامن» mark has done its job
      const movedIds = [d.id, ...d.group.map((g) => g.id)];
      if (flags && onFlags && movedIds.some((id) => flags[id])) onFlags(Object.fromEntries(Object.entries(flags).filter(([id]) => !movedIds.includes(id))));
      if (d.group.length) {
        // all by the same time and the same number of tracks, in one step
        const dt = d.ghostStart - d.start;
        const all = [{ id: d.id, trackId: d.ghostTrack, start: d.start }, ...d.group.map((g) => ({ ...g, trackId: d.groupTrack[g.id] ?? g.trackId }))];
        run({ type: "move_clips", moves: all.map((g) => ({ clipId: g.id, trackId: g.trackId, start: Math.max(0, g.start + dt) })) });
        onSelect(all.map((g) => g.id));
        return;
      }
      run({ type: "move_clip", clipId: d.id, trackId: d.ghostTrack, start: d.ghostStart });
    } else if (d.mode === "start") run({ type: "trim_clip", clipId: d.id, edge: "start", to: d.ghostStart });
    else run({ type: "trim_clip", clipId: d.id, edge: "end", to: d.ghostEnd });
  };

  useEffect(() => {
    handlers.current = { onMove, onUp };
  });

  // a tap on a clip selects it (touch: the timeline may have scrolled instead, then nothing happens)
  const tap = useRef<{ id: string; x: number; y: number } | null>(null);
  const tapDown = (e: React.PointerEvent, c: Clip) => {
    if (e.pointerType === "touch") tap.current = { id: c.id, x: e.clientX, y: e.clientY };
  };
  const tapUp = (e: React.PointerEvent) => {
    const t = tap.current;
    tap.current = null;
    if (!t || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8) return;
    if (!selected.includes(t.id)) onSelect([t.id]);
  };

  // an empty spot: unselect and move the playhead there
  const laneTap = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  /** a point of the screen in the scrolled content's pixels */
  const contentAt = (clientX: number, clientY: number) => {
    const r = content.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };
  /** every clip the box touches (unlocked tracks) */
  const inBox = (b: Box) => {
    const top = Math.min(b.y0, b.y1);
    const bottom = Math.max(b.y0, b.y1);
    const lo = ((Math.min(b.x0, b.x1) - X0) * 1000) / pps;
    const hi = ((Math.max(b.x0, b.x1) - X0) * 1000) / pps;
    const box0 = content.current!.getBoundingClientRect().top;
    const ids: string[] = [];
    for (const t of ordered) {
      const r = rows.current.get(t.id)?.getBoundingClientRect();
      if (!r || t.locked || r.bottom - box0 < top || r.top - box0 > bottom) continue;
      for (const c of t.clips) if (c.start < hi && clipEnd(c) > lo) ids.push(c.id);
    }
    return ids;
  };
  const laneDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.pointerType === "touch") laneTap.current = { x: e.clientX, y: e.clientY };
    else if (e.button === 0) {
      // a computer: drag over the empty timeline to select with a box; a plain click unselects and moves the playhead
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = contentAt(e.clientX, e.clientY);
      setBox({ pointer: e.pointerId, x0: p.x, y0: p.y, x1: p.x, y1: p.y, base: e.shiftKey || e.metaKey || e.ctrlKey ? selected : [] });
    }
  };
  const laneMove = (e: React.PointerEvent) => {
    if (!box || box.pointer !== e.pointerId) return;
    const p = contentAt(e.clientX, e.clientY);
    const next = { ...box, x1: p.x, y1: p.y };
    setBox(next);
    if (Math.hypot(next.x1 - next.x0, next.y1 - next.y0) >= 4) onSelect([...new Set([...next.base, ...inBox(next)])]);
  };
  const laneUp = (e: React.PointerEvent) => {
    if (box && box.pointer === e.pointerId) {
      setBox(null);
      if (Math.hypot(box.x1 - box.x0, box.y1 - box.y0) < 4) {
        if (!box.base.length) onSelect([]);
        player?.seek(Math.min(total, msAt(e.clientX)));
      }
      return;
    }
    const t = laneTap.current;
    laneTap.current = null;
    if (!t || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8) return;
    onSelect([]);
    if (!compact) player?.seek(Math.min(total, msAt(e.clientX)));
  };

  // ---------- files dropped from the computer or the library ----------
  const [dropAt, setDropAt] = useState<{ ms: number; trackId: string | null } | null>(null);
  const [adding, setAdding] = useState(false);
  /** «مجلدات المسارات»: the menu of the folder button (`trackId: null`) or of a right-click on a track's head */
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; trackId: string | null } | null>(null);
  const carries = (e: React.DragEvent) => !readOnly && (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes(ASSET_DRAG));
  const dropPoint = (e: React.DragEvent) => {
    let trackId: string | null = null;
    for (const t of ordered) {
      const r = rows.current.get(t.id)?.getBoundingClientRect();
      if (r && e.clientY >= r.top && e.clientY < r.bottom) trackId = t.id;
    }
    return { ms: Math.round(snap(msAt(e.clientX), "")), trackId };
  };
  const dragOver = (e: React.DragEvent) => {
    if (!carries(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const p = dropPoint(e);
    if (p.ms !== dropAt?.ms || p.trackId !== dropAt?.trackId) setDropAt(p);
  };
  const dragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null);
  };
  const drop = (e: React.DragEvent) => {
    if (!carries(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDropAt(null);
    const p = dropPoint(e);
    const id = e.dataTransfer.getData(ASSET_DRAG);
    if (id) return onDropAsset(id, p.ms, p.trackId);
    const files = Array.from(e.dataTransfer.files).filter((f) => /^(video|audio|image)\//.test(f.type) || MEDIA_FILE.test(f.name));
    if (files.length) onDropFiles(files, p.ms, p.trackId);
  };

  // ---------- drawing ----------
  const step = rulerStep(pps);
  const ticks: number[] = [];
  for (let ms = 0; ms <= total + 15_000; ms += step) ticks.push(ms);

  const clipView = (track: Track, c: Clip, ghost = false) => {
    const k = kindOf(c, assets, track.kind === "audio");
    const a = c.assetId ? assets.get(c.assetId) : null;
    const sel = selected.includes(c.id);
    const d = drag?.id === c.id ? drag : null;
    // one of the others moving with the dragged clip
    const along = !d && drag?.moved && drag.mode === "move" && drag.group.some((g) => g.id === c.id) ? drag.ghostStart - drag.start : 0;
    const start = d && d.moved ? d.ghostStart : c.start + along;
    const end = d && d.moved ? (d.mode === "move" ? d.ghostEnd : d.mode === "start" ? d.end : d.ghostEnd) : clipEnd(c) + along;
    const thumb = a ? thumbs[a.id] : null;
    const wave = a && k === "audio" ? waves[a.id] : null;
    // the whole file's waveform, stretched so this clip shows its own part of it
    const fullPx = a?.durationMs ? lanePx(a.durationMs / c.speed) : 0;
    // «Nest»: a timeline used as one clip
    const nestName = c.seq ? (tl.seqs?.find((x) => x.id === c.seq)?.name ?? "تسلسل") : null;
    const tone = c.seq ? "bg-teal-700/90" : pro ? "" : k === "audio" ? "bg-emerald-600/80" : k === "text" ? "bg-violet-600/85" : k === "image" ? "bg-sky-700/80" : "bg-zinc-700";
    // the track's own colour (if the person gave it one): the clip's fill on «بريمير», a tint on «عادي»
    const paint = track.color ?? (pro ? PRO_TONE[k as keyof typeof PRO_TONE] ?? PRO_TONE.video : null);
    const missing = a && (a.status !== "ready" || !a.url);
    // «التلوين» (the colour page, and what حيدرا ماكس grades): a clip that has grading layers on shows it, like the simple filter does
    const graded = c.grades.filter((g) => g.on).length;
    // «زامن الصوت» left it where it was (red) or is not sure of it (amber)
    const flag = ghost ? undefined : flags?.[c.id];
    const handle = compact ? 18 : 10;
    return (
      <div
        key={c.id + (ghost ? "g" : "")}
        data-clip={c.id}
        role="button"
        tabIndex={-1}
        aria-label={c.text ? `نص: ${c.text.body}` : nestName ? `متداخل: ${nestName}` : (a?.name ?? "مقطع")}
        aria-pressed={sel}
        className={`absolute top-1 bottom-1 overflow-hidden text-[11px] text-white ${pro ? "rounded-[3px] border border-black/50" : "rounded-md shadow"} ${tone} ${sel ? (pro ? "z-10 outline outline-2 outline-white" : "z-10 ring-2 ring-jw-accent") : pro ? "" : "ring-1 ring-black/40"} ${(d?.moved && d.mode === "move") || along ? "opacity-80" : ""} ${missing ? "outline-2 outline-dashed outline-jw-danger" : ""} ${flag ? (flag.level === "bad" ? "outline outline-2 outline-red-500" : "outline outline-2 outline-amber-400") : ""}`}
        title={flag ? `${flag.level === "bad" ? "ما تزامن" : "راجعه"}: ${flag.why}` : undefined}
        style={{
          left: X0 - HEAD + lanePx(start),
          width: Math.max(4, lanePx(end - start)),
          touchAction: sel ? "none" : "pan-x pan-y",
          cursor: readOnly || track.locked ? "default" : "grab",
          backgroundColor: paint ?? undefined,
          // «بريمير»: one picture at the clip's head; «عادي»: pictures all along
          backgroundImage: pro ? (thumb && k !== "audio" ? `url(${thumb})` : wave ? `url(${wave})` : undefined) : thumb && k !== "audio" ? `url(${thumb})` : wave ? `url(${wave})` : k === "audio" ? "repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 2px, transparent 2px 5px)" : undefined,
          backgroundSize: thumb && k !== "audio" ? (pro ? "auto calc(100% - 14px)" : "auto 100%") : wave && fullPx ? `${fullPx}px ${pro ? "62%" : "70%"}` : k === "audio" ? "auto 60%" : undefined,
          backgroundRepeat: pro || wave ? "no-repeat" : "repeat-x",
          backgroundPosition: wave && fullPx ? `${-lanePx(c.in / c.speed) - (d && d.moved && d.mode === "start" ? lanePx(d.ghostStart - c.start) : 0)}px ${pro ? "85%" : "60%"}` : pro && thumb ? "0 14px" : k === "audio" ? "0 50%" : undefined,
        }}
        onPointerDown={(e) => {
          tapDown(e, c);
          begin(e, track, c, "move");
        }}
        onDoubleClick={() => c.seq && !readOnly && run({ type: "seq_open", id: c.seq })}
        onContextMenu={(e) => {
          if (!onMenu || ghost) return;
          e.preventDefault();
          e.stopPropagation();
          if (!selected.includes(c.id)) onSelect([c.id]);
          onMenu({ x: e.clientX, y: e.clientY, clipId: c.id, ms: msAt(e.clientX), trackId: track.id });
        }}
        onPointerMove={onMove}
        onPointerUp={(e) => {
          onUp(e);
          tapUp(e);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          tap.current = null;
          setDrag(null);
        }}
      >
        {!pro && track.color && <span className="pointer-events-none absolute inset-0 border-s-4" style={{ borderColor: track.color, background: `${track.color}33` }} />}
        {flag && (
          <>
            <span className={`pointer-events-none absolute inset-0 ${flag.level === "bad" ? "bg-red-600/55" : "bg-amber-400/30"}`} />
            <span className={`pointer-events-none absolute bottom-0.5 left-1 z-[1] whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-bold ${flag.level === "bad" ? "bg-red-600 text-white" : "bg-amber-400 text-black"}`} dir="rtl">
              {flag.level === "bad" ? "✕ ما تزامن" : "؟ راجعه"}
            </span>
          </>
        )}
        <span className={`pointer-events-none absolute truncate font-medium ${pro ? "inset-x-0 top-0 h-[14px] bg-black/35 px-1.5 py-0 text-[10px] leading-[14px]" : compact ? "inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-1.5 py-0.5" : `start-1 top-1 max-w-[calc(100%-8px)] rounded bg-black/55 px-1.5 text-[10px] leading-4 backdrop-blur-[2px] ${lanePx(end - start) < 36 ? "hidden" : ""}`}`} dir="auto">
          {c.text ? c.text.body : nestName ? `🎞 ${nestName}` : compact ? formatTime(clipLength(c)) : (a?.name ?? "")} {c.ramp ? <b title="منحنى السرعة">↝</b> : c.speed !== 1 && <b>×{c.speed}</b>}
        </span>
        {!compact && lanePx(end - start) > 60 && (
          <span className="pointer-events-none absolute bottom-0 left-1 text-[10px] text-white/80">{formatTime(clipLength(c))}</span>
        )}
        {/* motion points */}
        {c.keys.map((key) => {
          const x = lanePx(timelineTime(c, key.t) - start);
          return x >= 0 && x <= lanePx(end - start) ? (
            <span key={key.t} className="pointer-events-none absolute bottom-0.5 h-2 w-2 -translate-x-1/2 rotate-45 border border-black/50 bg-jw-warn" style={{ left: x }} />
          ) : null;
        })}
        {/* «التعديل الذكي»: where a red piece is (waiting for its note, being made, made, failed) */}
        {c.fix && track.role === "fix" && (
          <span className={`pointer-events-none absolute bottom-0.5 right-1 z-[1] flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-bold ${c.fix.state === "sending" ? "animate-pulse bg-sky-400 text-black" : c.fix.state === "making" ? "animate-pulse bg-amber-400 text-black" : c.fix.state === "done" ? "bg-emerald-500 text-white" : c.fix.state === "failed" ? "bg-red-600 text-white" : "bg-black/60 text-white"}`}>
            {c.fix.state === "sending" ? "⏫ يرسل" : c.fix.state === "making" ? "⏳ يُصنع" : c.fix.state === "done" ? "✓ على الأخضر" : c.fix.state === "failed" ? "✕ ما نجح" : c.fix.note ? "✎ جاهز للإرسال" : "✎ اكتب الملاحظة"}
          </span>
        )}
        {(c.color || graded > 0 || c.fadeIn > 0 || c.fadeOut > 0) && (
          <span className="pointer-events-none absolute right-1 top-0.5 text-[9px] text-white/90">{c.color || graded ? "🎨" : ""}{graded > 1 ? <b>×{graded}</b> : null}{c.fadeIn > 0 || c.fadeOut > 0 ? "◢" : ""}</span>
        )}
        {graded > 0 && <span aria-label={`تلوين: ${graded} طبقة`} className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-orange-400 via-pink-400 to-sky-400" />}
        {sel && !readOnly && !track.locked && (
          <>
            <span
              aria-label="قص البداية"
              className="absolute inset-y-0 left-0 grid cursor-ew-resize place-items-center bg-jw-accent text-jw-on-accent"
              style={{ width: handle, touchAction: "none" }}
              onPointerDown={(e) => begin(e, track, c, "start")}
              onPointerMove={onMove}
              onPointerUp={onUp}
            >
              <span className="h-4 w-0.5 rounded bg-current" />
            </span>
            <span
              aria-label="قص النهاية"
              className="absolute inset-y-0 right-0 grid cursor-ew-resize place-items-center bg-jw-accent text-jw-on-accent"
              style={{ width: handle, touchAction: "none" }}
              onPointerDown={(e) => begin(e, track, c, "end")}
              onPointerMove={onMove}
              onPointerUp={onUp}
            >
              <span className="h-4 w-0.5 rounded bg-current" />
            </span>
          </>
        )}
      </div>
    );
  };

  const moving = drag?.moved && drag.mode === "move" ? drag : null;
  // while dragging: how far it went («+2.4 ث») next to the clip, and the guide line where it is stuck to something
  const dragging = drag?.moved ? drag : null;
  const rulerH = compact ? RULER_PHONE : RULER;
  /** the track a clip is drawn on right now: its own, or the one a drag is taking it to */
  const ghostOf = (clipId: string, own: string) => (moving ? (clipId === moving.id ? moving.ghostTrack : (moving.groupTrack[clipId] ?? own)) : own);
  /** the clips a drag is bringing to this track from another one */
  const arriving = (trackId: string) => (moving ? [{ id: moving.id, from: moving.trackId }, ...moving.group.map((g) => ({ id: g.id, from: g.trackId }))].filter((m) => m.from !== trackId && ghostOf(m.id, m.from) === trackId) : []);
  // the marked clips that are still on the timeline
  const marked = flags ? tl.tracks.flatMap((t) => t.clips.filter((c) => flags[c.id]).map((c) => ({ id: c.id, level: flags[c.id].level }))) : [];
  const badIds = marked.filter((m) => m.level === "bad").map((m) => m.id);
  const flagChip =
    marked.length > 0 && onFlags ? (
      <span className="flex items-center gap-1 rounded-full border border-red-500/60 bg-jw-surface px-2 py-0.5 text-[11px] shadow" dir="rtl">
        {badIds.length > 0 && (
          <button type="button" className="font-bold text-red-500 hover:underline" onClick={() => onSelect(badIds)} title="حدّد المقاطع اللي ما تزامنت">
            🔴 {badIds.length} ما تزامنت · حدّدها
          </button>
        )}
        {marked.length > badIds.length && (
          <button type="button" className="font-bold text-amber-500 hover:underline" onClick={() => onSelect(marked.filter((m) => m.level === "weak").map((m) => m.id))} title="حدّد المقاطع اللي تطابقها متوسط الثقة">
            🟡 {marked.length - badIds.length} للمراجعة
          </button>
        )}
        <button type="button" className="text-jw-muted hover:text-jw-ink" onClick={() => onFlags({})} title="امسح علامات المزامنة" aria-label="امسح علامات المزامنة">
          ✕
        </button>
      </span>
    ) : null;
  // «مجلدات المسارات»: what the folder button and a right-click on a track's head offer
  const folders = tl.folders ?? [];
  const loose = (kind: Track["kind"]) => tl.tracks.filter((t) => t.kind === kind && t.id !== main?.id && !t.folder);
  const selTracks = tl.tracks.filter((t) => t.id !== main?.id && t.clips.some((c) => selected.includes(c.id)));
  const folderItems = (trackId: string | null): { label: string; on: () => void }[] => {
    const track = trackId ? tl.tracks.find((t) => t.id === trackId) : null;
    if (track) {
      return [
        ...folders.filter((f) => f.id !== track.folder).map((f) => ({ label: `📁 انقله إلى «${f.name}»`, on: () => run({ type: "folder_tracks", trackIds: [track.id], folderId: f.id }) })),
        { label: "📁 مجلد جديد من هذا المسار", on: () => run({ type: "folder_tracks", trackIds: [track.id] }) },
        ...(track.folder ? [{ label: "↩ طلّعه من المجلد", on: () => run({ type: "folder_tracks", trackIds: [track.id], folderId: null }) }] : []),
      ];
    }
    return [
      ...(loose("video").length > 1 ? [{ label: `📁 مسارات الفيديو في مجلد (${loose("video").length})`, on: () => run({ type: "folder_tracks", trackIds: loose("video").map((t) => t.id), name: "الفيديو" }) }] : []),
      ...(loose("audio").length > 1 ? [{ label: `📁 مسارات الصوت في مجلد (${loose("audio").length})`, on: () => run({ type: "folder_tracks", trackIds: loose("audio").map((t) => t.id), name: "الصوت" }) }] : []),
      ...(loose("text").length > 1 ? [{ label: `📁 مسارات النصوص في مجلد (${loose("text").length})`, on: () => run({ type: "folder_tracks", trackIds: loose("text").map((t) => t.id), name: "النصوص" }) }] : []),
      ...(selTracks.length ? [{ label: `📁 مسارات المقاطع المحددة في مجلد (${selTracks.length})`, on: () => run({ type: "folder_tracks", trackIds: selTracks.map((t) => t.id) }) }] : []),
      ...(folders.some((f) => !f.closed) ? [{ label: "▸ اطوِ كل المجلدات", on: () => run(folders.filter((f) => !f.closed).map((f) => ({ type: "update_folder" as const, folderId: f.id, patch: { closed: true } })), { label: "طويت كل المجلدات" }) }] : []),
      ...(folders.some((f) => f.closed) ? [{ label: "▾ افتح كل المجلدات", on: () => run(folders.filter((f) => f.closed).map((f) => ({ type: "update_folder" as const, folderId: f.id, patch: { closed: false } })), { label: "فتحت كل المجلدات" }) }] : []),
    ];
  };
  const dragBadge = dragging
    ? dragging.mode === "move"
      ? { ms: dragging.ghostStart - dragging.start, at: dragging.ghostStart, note: `${dragging.copy ? "⧉ نسخة · " : ""}عند ${formatTime(dragging.ghostStart, true)}` }
      : dragging.mode === "start"
        ? { ms: dragging.ghostStart - dragging.start, at: dragging.ghostStart, note: `الطول ${formatTime(dragging.end - dragging.ghostStart, true)}` }
        : { ms: dragging.ghostEnd - dragging.end, at: dragging.ghostEnd, note: `الطول ${formatTime(dragging.ghostEnd - dragging.start, true)}` }
    : null;

  return (
    <div dir="ltr" data-no-press className="relative flex h-full min-h-0 flex-col bg-jw-bg-2">
      {compact && !readOnly && (
        <div className="absolute right-2 top-2 z-40 flex max-w-[calc(100%-1rem)] gap-1" dir="rtl">
          <button type="button" className={`jw-btn ${selectionMode ? "jw-btn-primary" : "jw-3d"} !min-h-8 !px-2.5 !py-1 text-[11px] shadow`} onClick={() => setSelectionMode((v) => !v)} aria-pressed={selectionMode}>
            {selectionMode ? "✓ اختر المقاطع" : "تحديد عدة مقاطع"}
          </button>
          {selectionMode && selected.length > 1 && onSync && (
            <button type="button" className="jw-btn jw-btn-primary !min-h-8 !px-2.5 !py-1 text-[11px] shadow" disabled={syncing} onClick={() => onSync(selected)}>
              {syncing ? "أزامن…" : `🎯 زامن ${selected.length} مقاطع`}
            </button>
          )}
          {flagChip}
        </div>
      )}
      {!compact && flagChip && <div className="absolute right-3 z-40" style={{ top: RULER + 3 }}>{flagChip}</div>}
      <div ref={scroller} className="jw-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain" style={{ touchAction: "pan-x pan-y" }} onDragOver={dragOver} onDragLeave={dragLeave} onDrop={drop}>
        <div ref={content} className="relative" style={{ width: contentW, minWidth: "100%", minHeight: "100%" }}>
          {/* ruler */}
          <div className="sticky top-0 z-20 flex" style={{ height: compact ? RULER_PHONE : RULER }}>
            {!compact && <div className="sticky left-0 z-30 flex items-center gap-0.5 border-b border-e border-jw-line bg-jw-surface px-1" style={{ width: HEAD, minWidth: HEAD }}>
              <button type="button" className="grid h-6 w-6 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={() => zoomTo(ppsNow() / 1.6)} aria-label="تصغير" title="تصغير">
                <Icon name="zoomOut" size={14} />
              </button>
              {!compact && (
                <button type="button" className="grid h-6 w-6 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={fit} aria-label="اعرض الكل" title="اعرض الكل">
                  <Icon name="expand" size={13} />
                </button>
              )}
              <button type="button" className="grid h-6 w-6 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={() => zoomTo(ppsNow() * 1.6)} aria-label="تكبير" title="تكبير">
                <Icon name="zoomIn" size={14} />
              </button>
              {/* the zoom as a slider (on a log scale: from hours on one screen to single frames) */}
              <input
                type="range"
                className="h-1 w-12 min-w-0 flex-1 cursor-pointer accent-[var(--jw-accent)]"
                min={0}
                max={1000}
                value={Math.round((Math.log(pps / MIN_PPS) / Math.log(MAX_PPS / MIN_PPS)) * 1000)}
                onChange={(e) => zoomTo(MIN_PPS * Math.pow(MAX_PPS / MIN_PPS, Number(e.target.value) / 1000))}
                aria-label="تكبير التايملاين"
                title="كبّر أو صغّر التايملاين (من ساعات في الشاشة لين الفريم)"
              />
              {!readOnly && (
                <button type="button" className={`grid h-6 w-6 place-items-center rounded hover:bg-jw-surface-2 hover:text-jw-ink ${adding ? "bg-jw-accent/15 text-jw-accent" : "text-jw-muted"}`} onClick={() => setAdding((v) => !v)} aria-label="أضف مسار" title="أضف مسار" aria-expanded={adding}>
                  <Icon name="plus" size={14} />
                </button>
              )}
              {adding && (
                <div className="absolute left-1 top-full z-40 mt-1 w-44 space-y-0.5 rounded-xl border border-jw-line bg-jw-surface p-1.5 shadow-xl" dir="rtl" role="menu" aria-label="نوع المسار الجديد">
                  <p className="px-1.5 pb-1 text-[11px] text-jw-muted">وش نوع المسار الجديد؟</p>
                  {TRACK_KINDS.map((k) => (
                    <button
                      key={k.kind}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs hover:bg-jw-surface-2"
                      onClick={() => {
                        setAdding(false);
                        run({ type: "add_track", kind: k.kind });
                      }}
                    >
                      <Icon name={k.icon} size={14} /> {k.label}
                    </button>
                  ))}
                </div>
              )}
            </div>}
            <div className={`relative flex-1 border-b border-jw-line bg-jw-surface ${compact ? "" : "cursor-col-resize"}`} style={{ touchAction: compact ? "pan-x pan-y" : "none" }} onPointerDown={compact ? undefined : scrub} onPointerMove={compact ? undefined : scrubMove}>
              {ticks.map((ms) => (
                <span key={ms} className={compact ? "absolute top-0 h-full -translate-x-1/2 text-center text-[9px] leading-[18px] text-jw-faint" : "absolute top-0 h-full border-l border-jw-line-strong ps-1 text-[10px] leading-[26px] text-jw-faint"} style={{ left: X0 - HEAD + lanePx(ms) }}>
                  {pro ? timecode(ms, tl.fps) : formatTime(ms, step < 1000)}
                </span>
              ))}
              {compact && ticks.map((ms) => <span key={`d${ms}`} className="absolute top-[7px] h-1 w-1 -translate-x-1/2 rounded-full bg-jw-faint/60" style={{ left: X0 + lanePx(ms + step / 2) }} />)}
              {range && range.to > range.from && (
                <span className="pointer-events-none absolute bottom-0 top-0 z-[1] border-x-2 border-jw-accent bg-jw-accent/20" style={{ left: X0 - HEAD + lanePx(range.from), width: Math.max(2, lanePx(range.to - range.from)) }} title="منطقة التصدير" />
              )}
              {/* beat marks */}
              {tl.markers.map((m) => (
                <span key={`m${m}`} className="pointer-events-none absolute bottom-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-jw-warn" style={{ left: X0 - HEAD + lanePx(m) }} />
              ))}
              {/* «تعليقات المراجعة»: a speech mark per comment (dashed: the project changed, it sits on its version's time) */}
              {notes?.map((n) => (
                <button
                  key={`r${n.id}`}
                  type="button"
                  className={`absolute top-0.5 z-[2] grid h-3.5 w-3.5 -translate-x-1/2 place-items-center rounded-[4px_4px_4px_0] text-[8px] leading-none text-black ${n.done ? "bg-emerald-400/70" : "bg-amber-300"} ${n.how === "lost" ? "outline-dashed outline-1 outline-jw-ink/70" : ""}`}
                  style={{ left: X0 - HEAD + lanePx(n.at) }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onNote?.(n.id)}
                  title={`${n.text}${n.how === "lost" ? " (تغيّر المشروع: وقته في النسخة)" : ""}`}
                  aria-label={`تعليق المراجعة: ${n.text}`}
                >
                  💬
                </button>
              ))}
            </div>
          </div>

          {/* room above the tracks: drop a clip here to make a new track */}
          {!compact && (
            <div className="flex" style={{ height: GAP_TOP }}>
              <div className="sticky left-0 z-10 flex shrink-0 items-center gap-0.5 border-e border-jw-line bg-jw-surface px-1" style={{ width: HEAD, minWidth: HEAD }}>
                <button type="button" className="grid h-6 w-6 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={() => zoomTall(vz / 1.25)} disabled={vz <= MIN_VZ} aria-label="قصّر المسارات" title="قصّر المسارات (⌥ + العجلة)">
                  <Icon name="chevronUp" size={13} />
                </button>
                <input
                  type="range"
                  className="h-1 w-10 min-w-0 flex-1 cursor-pointer accent-[var(--jw-accent)]"
                  min={MIN_VZ * 100}
                  max={MAX_VZ * 100}
                  value={Math.round(vz * 100)}
                  onChange={(e) => zoomTall(Number(e.target.value) / 100)}
                  onDoubleClick={() => zoomTall(1)}
                  aria-label="ارتفاع المسارات"
                  title="تكبير طولي: طوّل المسارات أو قصّرها (⌥ + العجلة · ضغطتين: الأصلي)"
                />
                <button type="button" className="grid h-6 w-6 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={() => zoomTall(vz * 1.25)} disabled={vz >= MAX_VZ} aria-label="طوّل المسارات" title="طوّل المسارات (⌥ + العجلة)">
                  <Icon name="chevronDown" size={13} />
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    className={`grid h-6 w-6 place-items-center rounded hover:bg-jw-surface-2 hover:text-jw-ink ${folderMenu && !folderMenu.trackId ? "bg-jw-accent/15 text-jw-accent" : "text-jw-muted"}`}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setFolderMenu((v) => (v ? null : { x: r.left, y: r.bottom + 4, trackId: null }));
                    }}
                    aria-label="مجلدات المسارات"
                    title="مجلدات المسارات: ضم المسارات في مجلد ينطوي وينفتح"
                    aria-expanded={!!folderMenu}
                  >
                    <Icon name="folder" size={13} />
                  </button>
                )}
                {onFull && (
                  <button type="button" className={`grid h-6 w-6 place-items-center rounded hover:bg-jw-surface-2 hover:text-jw-ink ${full ? "bg-jw-accent/15 text-jw-accent" : "text-jw-muted"}`} onClick={onFull} aria-pressed={full} aria-label={full ? "رجّع التايملاين لحجمه" : "التايملاين على الشاشة كاملة"} title={full ? "رجّع التايملاين لحجمه (Esc)" : "التايملاين على الشاشة كاملة"}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={full ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"} />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex-1 border-b border-dashed border-jw-line/70" aria-hidden />
            </div>
          )}
          {folderMenu &&
            createPortal(
              <>
                <div className="fixed inset-0 z-[79]" onPointerDown={() => setFolderMenu(null)} onContextMenu={(e) => (e.preventDefault(), setFolderMenu(null))} />
                <div role="menu" aria-label="مجلدات المسارات" dir="rtl" className="fixed z-[80] w-64 space-y-0.5 rounded-xl border border-jw-line bg-jw-surface p-1.5 shadow-xl" style={{ left: Math.min(folderMenu.x, window.innerWidth - 270), top: Math.min(folderMenu.y, window.innerHeight - 220) }}>
                  {folderItems(folderMenu.trackId).length === 0 && <p className="px-2 py-1.5 text-[11px] text-jw-muted">المجلد يحتاج مسارين أو أكثر من نفس النوع (غير الرئيسي)، أو حدّد مقاطع وضم مساراتها.</p>}
                  {folderItems(folderMenu.trackId).map((it) => (
                    <button key={it.label} type="button" role="menuitem" className="flex w-full items-center rounded-lg px-2 py-1.5 text-start text-xs hover:bg-jw-surface-2" onClick={() => (setFolderMenu(null), it.on())}>
                      {it.label}
                    </button>
                  ))}
                </div>
              </>,
              document.querySelector("[data-ed-theme]") ?? document.body,
            )}
          {/* tracks */}
          {display.map((row) => {
            if (!row.track) {
              const f = row.folder;
              const all = (k: "muted" | "hidden" | "locked") => row.tracks.filter((t) => (k === "muted" ? t.kind !== "text" : k === "hidden" ? t.kind !== "audio" : true));
              const on = (k: "muted" | "hidden" | "locked") => all(k).length > 0 && all(k).every((t) => t[k]);
              const flip = (k: "muted" | "hidden" | "locked") => run({ type: "update_tracks", trackIds: all(k).map((t) => t.id), patch: { [k]: !on(k) } });
              const fbtn = "grid h-5 w-5 place-items-center rounded hover:bg-jw-surface-3";
              const fold = () => run({ type: "update_folder", folderId: f.id, patch: { closed: !f.closed } });
              return (
                <div key={`f${f.id}`} data-folder={f.id} className="flex border-b border-jw-line bg-jw-accent/[0.07]" style={{ height: FOLDER_H }}>
                  {!compact && (
                    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-0.5 border-e border-jw-line bg-jw-surface px-1 text-jw-muted" style={{ width: HEAD, minWidth: HEAD, boxShadow: "inset 3px 0 0 var(--jw-accent)" }} dir="rtl">
                      <button type="button" className={`${fbtn} text-jw-ink`} onClick={fold} aria-expanded={!f.closed} aria-label={f.closed ? `افتح المجلد ${f.name}` : `اطوِ المجلد ${f.name}`} title={f.closed ? "افتح المجلد" : "اطوِ المجلد"}>
                        <Icon name={f.closed ? "chevronLeft" : "chevronDown"} size={13} />
                      </button>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-1 text-start text-[11px] font-bold text-jw-ink"
                        onClick={fold}
                        onDoubleClick={() => {
                          if (readOnly) return;
                          const name = window.prompt("اسم المجلد", f.name);
                          if (name?.trim()) run({ type: "update_folder", folderId: f.id, patch: { name } });
                        }}
                        title={`${f.name} · ${row.tracks.length} مسارات (ضغطتين: غيّر الاسم)`}
                      >
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 font-normal text-jw-muted">{row.tracks.length}</span>
                      </button>
                      {all("muted").length > 0 && (
                        <button type="button" disabled={readOnly} className={`${fbtn} ${on("muted") ? "text-jw-danger" : ""}`} onClick={() => flip("muted")} aria-label={on("muted") ? "شغّل صوت المجلد" : "اكتم المجلد"} title={on("muted") ? "شغّل صوت كل مسارات المجلد" : "اكتم كل مسارات المجلد"}>
                          <Icon name={on("muted") ? "volumeOff" : "volume"} size={12} />
                        </button>
                      )}
                      {all("hidden").length > 0 && (
                        <button type="button" disabled={readOnly} className={`${fbtn} ${on("hidden") ? "text-jw-warn" : ""}`} onClick={() => flip("hidden")} aria-label={on("hidden") ? "أظهر المجلد" : "أخفِ المجلد"} title={on("hidden") ? "أظهر كل مسارات المجلد" : "أخفِ كل مسارات المجلد"}>
                          <Icon name={on("hidden") ? "eyeOff" : "eye"} size={12} />
                        </button>
                      )}
                      <button type="button" disabled={readOnly} className={`${fbtn} ${on("locked") ? "text-jw-accent" : ""}`} onClick={() => flip("locked")} aria-label={on("locked") ? "افتح قفل المجلد" : "اقفل المجلد"} title={on("locked") ? "افتح قفل كل مسارات المجلد" : "اقفل كل مسارات المجلد"}>
                        <Icon name={on("locked") ? "lock" : "unlock"} size={12} />
                      </button>
                      {!readOnly && (
                        <button type="button" className={fbtn} onClick={() => run({ type: "remove_folder", folderId: f.id })} aria-label="فك المجلد" title="فك المجلد (مساراته تبقى)">
                          <Icon name="x" size={12} />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="relative flex-1" onPointerDown={laneDown} onPointerMove={laneMove} onPointerUp={laneUp} onPointerCancel={() => setBox(null)}>
                    {compact && (
                      <button type="button" className="sticky left-1 top-0 z-10 mt-0.5 flex h-5 items-center gap-1 rounded-full border border-jw-line bg-jw-surface px-2 text-[10px] font-bold shadow" onClick={fold} aria-expanded={!f.closed} dir="rtl">
                        <Icon name="folder" size={11} /> {f.name} · {row.tracks.length} <Icon name={f.closed ? "chevronLeft" : "chevronDown"} size={11} />
                      </button>
                    )}
                    {/* folded: where its tracks have clips, as one thin strip */}
                    {f.closed &&
                      row.tracks.flatMap((t) =>
                        t.clips.map((c) => (
                          <span key={c.id} className={`pointer-events-none absolute bottom-1 top-1 rounded-sm ${t.kind === "audio" ? "bg-emerald-500/40" : t.kind === "text" ? "bg-violet-500/40" : "bg-sky-500/40"} ${flags?.[c.id]?.level === "bad" ? "!bg-red-600/80" : ""}`} style={{ left: X0 - HEAD + lanePx(c.start), width: Math.max(2, lanePx(clipEnd(c) - c.start)) }} />
                        )),
                      )}
                  </div>
                </div>
              );
            }
            const track = row.track;
            const isMain = track.id === main?.id;
            const target = moving && arriving(track.id).length > 0;
            return (
              <div
                key={track.id}
                data-track={track.kind}
                data-track-id={track.id}
                ref={(el) => {
                  if (el) rows.current.set(track.id, el);
                  else rows.current.delete(track.id);
                }}
                className={`flex border-b border-jw-line ${pro ? (ordered.indexOf(track) % 2 ? "bg-black/[0.06]" : "bg-black/[0.02]") : isMain ? "bg-jw-surface-2/40" : ""} ${target || dropAt?.trackId === track.id ? "bg-jw-accent/10" : ""}`}
                style={{ height: height(track) }}
              >
                {!compact && (
                  <TrackHead
                    track={track}
                    tracks={tl.tracks}
                    inFolder={!!row.folder}
                    isMain={isMain}
                    width={HEAD}
                    compact={compact}
                    readOnly={readOnly}
                    run={run}
                    label={pro ? labels.get(track.id) : undefined}
                    onMenu={readOnly || isMain ? undefined : (x, y) => setFolderMenu({ x, y, trackId: track.id })}
                  />
                )}
                <div
                  className="relative flex-1"
                  onPointerDown={laneDown}
                  onPointerMove={laneMove}
                  onPointerUp={laneUp}
                  onPointerCancel={() => setBox(null)}
                  onContextMenu={(e) => {
                    if (!onMenu || e.target !== e.currentTarget) return;
                    e.preventDefault();
                    onMenu({ x: e.clientX, y: e.clientY, clipId: null, ms: msAt(e.clientX), trackId: track.id });
                  }}
                >
                  {/* a phone: «+» after the last clip adds more (CapCut's way) */}
                  {compact && isMain && !readOnly && total > 0 && (
                    <button type="button" className="absolute top-1 bottom-1 grid w-11 place-items-center rounded-md border border-jw-line bg-jw-surface text-jw-ink shadow" style={{ left: X0 + lanePx(trackEnd(track)) + 6 }} onClick={onEmpty} aria-label="أضف مقطع" title="أضف مقطع">
                      <Icon name="plus" size={18} strokeWidth={2.5} />
                    </button>
                  )}
                  {track.clips.map((c) => (ghostOf(c.id, track.id) !== track.id ? null : clipView(track, c)))}
                  {/* the clips being dragged here from another track */}
                  {arriving(track.id).map((m) => {
                    const c = findOwn(m.id);
                    return c ? clipView(track, c, true) : null;
                  })}
                  {quiet.has(track.id) && <span className={`pointer-events-none absolute inset-0 ${track.off ? "bg-black/60" : "bg-black/40"}`} />}
                  {/* the cuts between touching clips: their transition, or a button to add one */}
                  {track.kind !== "audio" &&
                    !drag?.moved &&
                    track.clips.map((c, i) => {
                      const n = track.clips[i + 1];
                      if (!n || n.start !== clipEnd(c) || (!c.transition && !isMain)) return null;
                      return (
                        <button
                          key={`tr${c.id}`}
                          type="button"
                          disabled={readOnly || track.locked}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => onTransition(c.id)}
                          className={`absolute -top-0.5 z-20 grid -translate-x-1/2 place-items-center rounded-b-md border text-[10px] font-bold shadow ${c.transition ? "h-4 min-w-4 border-jw-accent bg-jw-accent px-0.5 text-jw-on-accent" : "h-3.5 w-3.5 border-white/50 bg-black/70 text-white opacity-70 hover:opacity-100"}`}
                          style={{ left: X0 - HEAD + lanePx(n.start) }}
                          aria-label={c.transition ? `انتقال: ${TRANSITIONS[c.transition.kind].label}` : "أضف انتقال"}
                          title={c.transition ? `انتقال: ${TRANSITIONS[c.transition.kind].label}` : "أضف انتقال"}
                        >
                          {c.transition ? TRANSITIONS[c.transition.kind].icon : "+"}
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
          {/* room under the tracks */}
          {!compact && (
            <div className="flex" style={{ height: GAP_BOTTOM }} aria-hidden>
              <div className="sticky left-0 z-10 shrink-0 border-e border-jw-line bg-jw-surface" style={{ width: HEAD, minWidth: HEAD }} />
              <div className="flex-1" />
            </div>
          )}
          {dropAt && (
            <div className="pointer-events-none absolute bottom-0 z-30 w-0.5 bg-jw-accent shadow-[0_0_10px_var(--jw-accent)]" style={{ top: RULER, left: X0 + lanePx(dropAt.ms) }}>
              <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-jw-accent px-1.5 py-0.5 text-[10px] text-jw-on-accent" dir="rtl">
                اترك هنا · {formatTime(dropAt.ms)}
              </span>
            </div>
          )}
          {dragging && dragging.snapAt != null && (
            <div className="pointer-events-none absolute bottom-0 z-30 w-0.5 bg-amber-400 shadow-[0_0_8px_#fbbf24]" style={{ top: rulerH, left: X0 + lanePx(dragging.snapAt) }}>
              <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black" dir="rtl">
                🧲 ملتصق
              </span>
            </div>
          )}
          {dragging && dragBadge && (
            <div
              className="pointer-events-none absolute z-40 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-xs font-bold text-white shadow-lg"
              style={{ left: X0 + lanePx(dragBadge.at), top: Math.max(rulerH, dragging.top - 20) }}
              dir="rtl"
              aria-live="off"
            >
              <span dir="ltr" className="tabular-nums text-amber-300">{movedLabel(dragBadge.ms)}</span>
              <span className="ms-2 font-normal text-white/80">{dragBadge.note}</span>
            </div>
          )}
          {box && Math.hypot(box.x1 - box.x0, box.y1 - box.y0) >= 4 && (
            <div
              className="pointer-events-none absolute z-40 rounded-sm border border-jw-accent bg-jw-accent/15"
              style={{ left: Math.min(box.x0, box.x1), top: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) }}
            />
          )}
          {moving?.ghostTrack === "new" && (
            <div className="pointer-events-none absolute inset-x-0 z-20 border-2 border-dashed border-jw-accent bg-jw-accent/10 text-center text-xs text-jw-accent" style={{ top: RULER, height: compact ? 30 : GAP_TOP }}>
              اترك هنا: مسار جديد
            </div>
          )}

          {/* playhead (a computer: it moves; a phone: it stays in the middle, below) */}
          {!compact && (
            <div ref={playhead} className="pointer-events-none absolute bottom-0 top-0 z-30 w-0" style={{ transform: `translateX(${HEAD}px)` }}>
              <div className="absolute -left-[6px] top-0 h-3 w-3 rotate-45 rounded-sm bg-jw-accent" />
              <div className="absolute -left-px top-0 h-full w-0.5 bg-jw-accent shadow-[0_0_6px_var(--jw-accent)]" />
            </div>
          )}
        </div>
      </div>
      {compact && (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-0" aria-hidden>
          <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-jw-ink" />
          <div className="absolute -left-px top-0 h-full w-0.5 rounded-full bg-jw-ink shadow-[0_0_4px_rgba(0,0,0,.5)]" />
        </div>
      )}

      {!total && !readOnly && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-4" dir="rtl">
          <button type="button" className="jw-btn jw-btn-primary pointer-events-auto" onClick={onEmpty}>
            <Icon name="upload" size={16} /> أضف فيديو أو صورة أو صوت لتبدأ
          </button>
        </div>
      )}
    </div>
  );
}

function TrackHead({ track, tracks, inFolder, isMain, width, compact, readOnly, run, label, onMenu }: { track: Track; tracks: Track[]; inFolder: boolean; isMain: boolean; width: number; compact: boolean; readOnly: boolean; run: Props["run"]; label?: string; onMenu?: (x: number, y: number) => void }) {
  // the colours open over the editor (the timeline's own box would cut them off)
  const [painting, setPainting] = useState<{ x: number; y: number } | null>(null);
  // ⌥ (Alt) held: the same switch on EVERY track that has it (all eyes shut or open, all sound off or on, all locks)
  const toggle = (patch: Partial<Pick<Track, "muted" | "hidden" | "locked" | "off">>, all = false) => (all ? run({ type: "update_tracks", trackIds: tracks.map((t) => t.id), patch }) : run({ type: "update_track", trackId: track.id, patch }));
  const ALL = " (⌥ + ضغطة: كل المسارات)";
  // «S»: pictures are soloed among pictures and sound among sound. ⌥: this one and no other of its sort
  const solo = (only: boolean) => {
    const mates = tracks.filter((t) => t.kind === track.kind && t.id !== track.id && t.solo).map((t) => t.id);
    if (only && mates.length) run([{ type: "update_tracks", trackIds: mates, patch: { solo: false } }, { type: "update_track", trackId: track.id, patch: { solo: true } }], { label: `سولو: «${track.name}» بروحه` });
    else run({ type: "update_track", trackId: track.id, patch: { solo: only ? true : !track.solo } });
  };
  const btn = "grid h-6 w-6 place-items-center rounded hover:bg-jw-surface-3";
  const icon = track.kind === "audio" ? "music" : track.motion ? "sparkles" : track.kind === "text" ? "type" : isMain ? "film" : "layers";
  return (
    <div
      className="sticky left-0 z-10 flex shrink-0 items-center gap-0.5 border-e border-jw-line bg-jw-surface px-1 text-jw-muted"
      style={{ width, minWidth: width, boxShadow: inFolder ? "inset 3px 0 0 color-mix(in srgb, var(--jw-accent) 55%, transparent)" : undefined }}
      dir="rtl"
      onContextMenu={(e) => {
        if (!onMenu) return;
        e.preventDefault();
        onMenu(e.clientX, e.clientY);
      }}
    >
      {!compact && (
        <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[11px]" title={track.name}>
          {label ? (
            <b className="grid h-5 min-w-7 place-items-center rounded-sm px-1 text-[10px] text-white" style={{ background: track.color ?? "#5b6170" }} dir="ltr">
              {label}
            </b>
          ) : (
            <Icon name={icon} size={13} />
          )}
          <span className="truncate">{isMain ? "الرئيسي" : track.name}</span>
        </span>
      )}
      <div className={`relative flex ${compact ? "flex-col" : ""} items-center`}>
        {!compact && !readOnly && (
          <button
            type="button"
            className={btn}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPainting((v) => (v ? null : { x: r.left, y: r.bottom + 4 }));
            }}
            aria-label="لون المسار"
            title="لون المسار"
            aria-expanded={!!painting}
          >
            <span className="h-3 w-3 rounded-full border border-black/20" style={{ background: track.color ?? "transparent" }} />
          </button>
        )}
        {painting &&
          createPortal(
          <div role="menu" aria-label="ألوان المسار" dir="rtl" className="fixed z-[80] grid w-44 grid-cols-5 gap-1.5 rounded-xl border border-jw-line bg-jw-surface p-2 shadow-xl" style={{ left: painting.x, top: Math.min(painting.y, window.innerHeight - 170) }}>
            {TRACK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="menuitemradio"
                aria-checked={track.color === c}
                aria-label={c}
                className={`h-6 w-6 rounded-full border-2 ${track.color === c ? "border-jw-ink" : "border-white"}`}
                style={{ background: c }}
                onClick={() => {
                  setPainting(null);
                  run({ type: "update_track", trackId: track.id, patch: { color: c } });
                }}
              />
            ))}
            <button type="button" role="menuitemradio" aria-checked={!track.color} className="col-span-5 rounded-lg border border-jw-line py-1 text-[11px] text-jw-muted hover:text-jw-ink" onClick={() => { setPainting(null); run({ type: "update_track", trackId: track.id, patch: { color: null } }); }}>
              بدون لون
            </button>
          </div>,
          document.querySelector("[data-ed-theme]") ?? document.body,
          )}
        {/* «S»: this one alone among its sort (pictures, or sound); ⌥: only this one. «H»: off for now, as if not there */}
        {track.kind !== "text" && (
          <button
            type="button"
            disabled={readOnly}
            className={`grid h-5 w-4 place-items-center rounded text-[10px] font-black leading-none ${track.solo ? "bg-amber-400 text-black" : "hover:bg-jw-surface-3"}`}
            onClick={(e) => solo(e.altKey)}
            aria-pressed={!!track.solo}
            aria-label={track.solo ? `شيل السولو عن ${track.name}` : `سولو ${track.name}`}
            title={`S · سولو: ${track.kind === "audio" ? "هذا الصوت بروحه (باقي الأصوات تسكت)" : "هذا الفيديو بروحه (باقي مسارات الفيديو تختفي)"} · ⌥ + ضغطة: هذا بس`}
          >
            S
          </button>
        )}
        <button
          type="button"
          disabled={readOnly}
          className={`grid h-5 w-4 place-items-center rounded text-[10px] font-black leading-none ${track.off ? "bg-red-600 text-white" : "hover:bg-jw-surface-3"}`}
          onClick={(e) => toggle({ off: !track.off }, e.altKey)}
          aria-pressed={!!track.off}
          aria-label={track.off ? `شغّل ${track.name}` : `طفّي ${track.name} مؤقتًا`}
          title={`H · ${track.off ? "شغّل المسار" : "طفّي المسار مؤقتًا: ما ينشاف ولا ينسمع ولا يثقّل"}${ALL}`}
        >
          H
        </button>
        {track.kind !== "text" && (
          <button type="button" disabled={readOnly} className={`${btn} ${track.muted ? "text-jw-danger" : ""}`} onClick={(e) => toggle({ muted: !track.muted }, e.altKey)} aria-label={track.muted ? "شغّل الصوت" : "اكتم"} title={(track.muted ? "شغّل الصوت" : "اكتم") + ALL}>
            <Icon name={track.muted ? "volumeOff" : "volume"} size={13} />
          </button>
        )}
        {track.kind !== "audio" && !compact && (
          <button type="button" disabled={readOnly} className={`${btn} ${track.hidden ? "text-jw-warn" : ""}`} onClick={(e) => toggle({ hidden: !track.hidden }, e.altKey)} aria-label={track.hidden ? "أظهر" : "أخفِ"} title={(track.hidden ? "أظهر" : "أخفِ") + ALL}>
            <Icon name={track.hidden ? "eyeOff" : "eye"} size={13} />
          </button>
        )}
        <button type="button" disabled={readOnly} className={`${btn} ${track.locked ? "text-jw-accent" : ""}`} onClick={(e) => toggle({ locked: !track.locked }, e.altKey)} aria-label={track.locked ? "افتح القفل" : "اقفل المسار"} title={(track.locked ? "افتح القفل" : "اقفل المسار") + ALL}>
          <Icon name={track.locked ? "lock" : "unlock"} size={13} />
        </button>
        {!isMain && !compact && !readOnly && track.clips.length === 0 && (
          <button type="button" className={btn} onClick={() => run({ type: "remove_track", trackId: track.id })} aria-label="احذف المسار" title="احذف المسار">
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
