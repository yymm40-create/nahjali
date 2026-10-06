"use client";

// «حيدرة كت» — the timeline. Time runs left → right even in Arabic (like every editor), so this part is dir="ltr".
// Mouse: drag a clip to move it (to another track too), its edges to trim, the ruler to scrub; Ctrl+wheel zooms.
// Touch (CapCut's way): a tap selects, a selected clip drags, its big handles trim, two fingers zoom, one finger scrolls.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clipEnd, clipLength, duration, formatTime, mainTrack, trackEnd, TRACK_COLORS, TRANSITIONS, type Clip, type Timeline as TL, type Track } from "@/lib/editor/model";
import type { Command } from "@/lib/editor/commands";
import Icon from "../Icon";
import type { EditorAsset } from "./types";

export interface PlayerLike {
  readonly ms: number;
  readonly playing: boolean;
  seek(ms: number): void;
  pause(): void;
  subscribe(fn: (ms: number, playing: boolean) => void): () => void;
}

interface Props {
  tl: TL;
  assets: Map<string, EditorAsset>;
  thumbs: Record<string, string | null>;
  selected: string[];
  onSelect: (ids: string[]) => void;
  run: (cmd: Command | Command[], opts?: { label?: string; coalesce?: string }) => void;
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
}

/** What the library puts on a drag (the asset's id). */
export const ASSET_DRAG = "application/x-jawad-asset";
const MEDIA_FILE = /\.(mp4|mov|m4v|webm|mkv|mp3|m4a|aac|wav|ogg|opus|flac|png|jpe?g|webp|gif|heic|avif)$/i;

type Mode = "move" | "start" | "end";
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
  /** the other selected clips, moving with it by the same time (they keep their tracks) */
  group: { id: string; trackId: string; start: number }[];
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

const MIN_PPS = 1;
const MAX_PPS = 400;
const RULER = 26;
const RULER_PHONE = 18;
const SNAP_PX = 8;

/** A clip on a sound track is sound, even when it comes from a video (its sound taken out). */
const kindOf = (c: Clip, assets: Map<string, EditorAsset>, onSound = false) => (c.text ? "text" : onSound ? "audio" : (assets.get(c.assetId ?? "")?.kind ?? "video"));
const fits = (track: Track, c: Clip, assets: Map<string, EditorAsset>, onSound: boolean) => {
  const k = kindOf(c, assets, onSound);
  return track.kind === (k === "image" ? "video" : k);
};

/** Ruler steps that keep labels ~80px apart at any zoom. */
function rulerStep(pps: number) {
  const steps = [100, 200, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000];
  return steps.find((s) => (s * pps) / 1000 >= 80) ?? 600_000;
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
const PRO_TONE = { video: "#4f5bd5", image: "#b9822f", audio: "#2f8a5c", text: "#a3478f" } as const;

export default function Timeline({ tl, assets, thumbs, waves, selected, onSelect, run, player, compact, readOnly, onEmpty, onTransition, onDropFiles, onDropAsset, look = "classic" }: Props) {
  const pro = look === "pro";
  // track labels like V1, V2, A1, T1 (bottom-up for pictures, top-down for sound)
  const labels = new Map<string, string>();
  for (const kind of ["video", "audio", "text"] as const) tl.tracks.filter((t) => t.kind === kind).forEach((t, i) => labels.set(t.id, `${kind === "video" ? "V" : kind === "audio" ? "A" : "T"}${i + 1}`));
  // a phone (CapCut's way): no track heads, the playhead fixed in the middle and the clips slide under it; half a screen
  // of room on each side lets the very start and the end reach it
  const HEAD = compact ? 0 : 144;
  const scroller = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);
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
  const anchor = useRef<{ ms: number; x: number } | null>(null);
  const fitted = useRef(false);
  const total = duration(tl);
  const main = mainTrack(tl);

  // tracks as people expect them: the top layer first, the main track under the pictures, sound at the bottom
  const ordered = useMemo(() => {
    const visual = tl.tracks.filter((t) => t.kind !== "audio").reverse();
    return [...visual, ...tl.tracks.filter((t) => t.kind === "audio")];
  }, [tl.tracks]);
  const height = (t: Track) => (t.id === main?.id ? (compact ? 56 : 60) : t.kind === "audio" ? (compact ? 30 : 38) : compact ? 30 : 44);

  const lanePx = (ms: number) => (ms * pps) / 1000;
  const contentW = compact ? X0 + lanePx(total) + pad + 56 : HEAD + lanePx(total + 15_000) + 80;

  // ---------- zoom ----------
  const zoomTo = useCallback(
    (next: number, at?: { ms: number; x: number }) => {
      const el = scroller.current;
      const z = Math.min(MAX_PPS, Math.max(MIN_PPS, next));
      if (el) {
        const x = at?.x ?? el.clientWidth / 2;
        const ms = at?.ms ?? ((el.scrollLeft + x - X0) * 1000) / pps;
        anchor.current = { ms, x };
      }
      setPps(z);
    },
    [pps, X0],
  );
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a) return;
    anchor.current = null;
    const x = X0 + (a.ms * pps) / 1000 - a.x;
    wantScroll.current = x;
    el.scrollLeft = x;
  }, [pps, X0]);
  const fit = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    if (compact) {
      // a phone: the whole thing on the screen when it is short, about a screen for every 8 seconds otherwise
      anchor.current = { ms: player?.ms ?? 0, x: el.clientWidth / 2 };
      setPps(Math.min(80, Math.max(24, total ? ((el.clientWidth - 40) * 1000) / total : 48)));
      return;
    }
    const w = el.clientWidth - HEAD - 40;
    anchor.current = { ms: 0, x: HEAD };
    setPps(Math.min(MAX_PPS, Math.max(MIN_PPS, total ? (w * 1000) / total : 40)));
  }, [total, HEAD, compact, player]);
  // the first time there is something on the timeline, show all of it
  useEffect(() => {
    if (fitted.current || !total) return;
    fitted.current = true;
    const t = setTimeout(fit, 0);
    return () => clearTimeout(t);
  }, [total, fit]);

  // Ctrl/⌘ + wheel (and a trackpad pinch) zooms around the pointer; two fingers on a phone too
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      zoomTo(pps * Math.exp(-e.deltaY * 0.01), { ms: ((el.scrollLeft + x - X0) * 1000) / pps, x });
    };
    let pinch: { d: number; pps: number; ms: number; x: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const r = el.getBoundingClientRect();
      const x = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      // (a phone keeps the moment under the fixed playhead where it is)
      pinch = compact ? { d: dist(e.touches), pps, ms: player?.ms ?? 0, x: el.clientWidth / 2 } : { d: dist(e.touches), pps, ms: ((el.scrollLeft + x - X0) * 1000) / pps, x };
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
  }, [pps, zoomTo, X0, compact, player]);

  // ---------- the playhead follows the player (drawn directly: 60 times a second without re-rendering) ----------
  useEffect(() => {
    if (!player) return;
    const place = (ms: number, playing: boolean) => {
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
      if (el && (x < el.scrollLeft + HEAD || x > el.scrollLeft + el.clientWidth - 24)) el.scrollLeft = x - HEAD - (el.clientWidth - HEAD) * (playing ? 0.15 : 0.4);
    };
    place(player.ms, false);
    return player.subscribe(place);
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
  const snap = (ms: number, ignore: string) => {
    const tol = (SNAP_PX * 1000) / pps;
    const own = ignore ? findOwn(ignore) : null;
    let best = ms;
    let gap = tol;
    for (const p of [...snapPoints, player?.ms ?? -1]) {
      if (own && (p === own.start || p === clipEnd(own))) continue;
      const d = Math.abs(p - ms);
      if (d < gap) {
        gap = d;
        best = p;
      }
    }
    return best;
  };
  const findOwn = (id: string) => {
    for (const t of tl.tracks) for (const c of t.clips) if (c.id === id) return c;
    return null;
  };

  // ---------- clips: select, move, trim ----------
  const begin = (e: React.PointerEvent, track: Track, c: Clip, mode: Mode) => {
    if (readOnly || e.button > 0) return;
    e.stopPropagation();
    const touch = e.pointerType === "touch";
    const isSel = selected.includes(c.id);
    const add = e.shiftKey || e.metaKey || e.ctrlKey;
    // on a phone an unselected clip only gets selected (its touch scrolls the timeline)
    if (touch && !isSel && mode === "move") return;
    // Shift/Ctrl/Cmd on a selected clip takes it out of the selection
    if (isSel && add && mode === "move") return onSelect(selected.filter((id) => id !== c.id));
    const sel = isSel ? selected : add ? [...selected, c.id] : [c.id];
    if (!isSel) onSelect(sel);
    if (track.locked) return;
    const group =
      mode === "move"
        ? tl.tracks.flatMap((t) => (t.locked ? [] : t.clips.filter((x) => x.id !== c.id && sel.includes(x.id)).map((x) => ({ id: x.id, trackId: t.id, start: x.start }))))
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
      lo: media != null ? Math.max(0, c.start - c.in / c.speed) : 0,
      hi: media != null ? c.start + (media - c.in) / c.speed : Infinity,
      ghostStart: c.start,
      ghostEnd: clipEnd(c),
      ghostTrack: track.id,
      group,
    };
    dragRef.current = d;
    setDrag(d);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.hypot(dx, e.clientY - d.y0) < 4) return;
    const dms = (dx * 1000) / pps;
    const next = { ...d, moved: true };
    if (d.mode === "move") {
      const len = d.end - d.start;
      let s = Math.max(0, d.start + dms);
      const sStart = snap(s, d.id);
      const sEnd = snap(s + len, d.id);
      if (sStart !== s) s = sStart;
      else if (sEnd !== s + len) s = sEnd - len;
      // with others: none of them goes before 0
      const earliest = Math.min(d.start, ...d.group.map((g) => g.start));
      next.ghostStart = Math.max(d.start - earliest, Math.round(s));
      next.ghostEnd = next.ghostStart + len;
      if (d.group.length) {
        next.ghostTrack = d.trackId;
        dragRef.current = next;
        setDrag(next);
        return;
      }
      // which track is under the finger; above the pictures (or under the sound) makes a new one
      const clip = findOwn(d.id)!;
      const onSound = tl.tracks.find((t) => t.id === d.trackId)?.kind === "audio";
      let target = d.trackId;
      let found = false;
      for (const t of ordered) {
        const r = rows.current.get(t.id)?.getBoundingClientRect();
        if (r && e.clientY >= r.top && e.clientY < r.bottom) {
          found = true;
          if (fits(t, clip, assets, onSound) && !t.locked) target = t.id;
        }
      }
      if (!found) {
        const first = rows.current.get(ordered[0]?.id ?? "")?.getBoundingClientRect();
        const last = rows.current.get(ordered.at(-1)?.id ?? "")?.getBoundingClientRect();
        const k = kindOf(clip, assets, onSound);
        if (first && e.clientY < first.top && k !== "audio") target = "new";
        if (last && e.clientY > last.bottom && k === "audio") target = "new";
      }
      next.ghostTrack = target;
    } else if (d.mode === "start") {
      const s = Math.min(d.end - 100, Math.max(d.lo, snap(d.start + dms, d.id)));
      next.ghostStart = Math.round(s);
    } else {
      const en = Math.max(d.start + 100, Math.min(d.hi, snap(d.end + dms, d.id)));
      next.ghostEnd = Math.round(en);
    }
    dragRef.current = next;
    setDrag(next);
  };

  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointer !== e.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    // a plain click on one of several selected clips leaves only it selected
    if (!d.moved) {
      // a plain click leaves only this clip selected (and brings its settings up again)
      if (!(e.shiftKey || e.metaKey || e.ctrlKey)) onSelect([d.id]);
      return;
    }
    if (d.mode === "move") {
      if (d.ghostTrack === d.trackId && d.ghostStart === d.start) return;
      if (d.group.length) {
        // all by the same time; the ones ahead first so none lands on another that hasn't moved yet
        const dt = d.ghostStart - d.start;
        const all = [{ id: d.id, trackId: d.trackId, start: d.start }, ...d.group].sort((a, b) => (dt > 0 ? b.start - a.start : a.start - b.start));
        run(all.map((g) => ({ type: "move_clip" as const, clipId: g.id, trackId: g.trackId, start: Math.max(0, g.start + dt) })));
        onSelect(all.map((g) => g.id));
        return;
      }
      run({ type: "move_clip", clipId: d.id, trackId: d.ghostTrack, start: d.ghostStart });
    } else if (d.mode === "start") run({ type: "trim_clip", clipId: d.id, edge: "start", to: d.ghostStart });
    else run({ type: "trim_clip", clipId: d.id, edge: "end", to: d.ghostEnd });
  };

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
    const tone = pro ? "" : k === "audio" ? "bg-emerald-600/80" : k === "text" ? "bg-violet-600/85" : k === "image" ? "bg-sky-700/80" : "bg-zinc-700";
    // the track's own colour (if the person gave it one): the clip's fill on «بريمير», a tint on «عادي»
    const paint = track.color ?? (pro ? PRO_TONE[k as keyof typeof PRO_TONE] ?? PRO_TONE.video : null);
    const missing = a && (a.status !== "ready" || !a.url);
    const handle = compact ? 18 : 10;
    return (
      <div
        key={c.id + (ghost ? "g" : "")}
        role="button"
        tabIndex={-1}
        aria-label={c.text ? `نص: ${c.text.body}` : (a?.name ?? "مقطع")}
        aria-pressed={sel}
        className={`absolute top-1 bottom-1 overflow-hidden text-[11px] text-white ${pro ? "rounded-[3px] border border-black/50" : "rounded-md shadow"} ${tone} ${sel ? (pro ? "z-10 outline outline-2 outline-white" : "z-10 ring-2 ring-jw-accent") : pro ? "" : "ring-1 ring-black/40"} ${(d?.moved && d.mode === "move") || along ? "opacity-80" : ""} ${missing ? "outline-2 outline-dashed outline-jw-danger" : ""}`}
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
        <span className={`pointer-events-none absolute inset-x-0 top-0 truncate px-1.5 py-0.5 font-medium ${pro ? "h-[14px] bg-black/35 py-0 text-[10px] leading-[14px]" : "bg-gradient-to-b from-black/60 to-transparent"}`} dir="auto">
          {c.text ? c.text.body : compact ? formatTime(clipLength(c)) : (a?.name ?? "")} {c.speed !== 1 && <b>×{c.speed}</b>}
        </span>
        {!compact && lanePx(end - start) > 60 && (
          <span className="pointer-events-none absolute bottom-0 left-1 text-[10px] text-white/80">{formatTime(clipLength(c))}</span>
        )}
        {/* motion points */}
        {c.keys.map((key) => {
          const x = lanePx(c.start + (key.t - c.in) / c.speed - start);
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
        {(c.color || c.fadeIn > 0 || c.fadeOut > 0) && (
          <span className="pointer-events-none absolute right-1 top-0.5 text-[9px] text-white/90">{c.color ? "🎨" : ""}{c.fadeIn > 0 || c.fadeOut > 0 ? "◢" : ""}</span>
        )}
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

  return (
    <div dir="ltr" data-no-press className="relative flex h-full min-h-0 flex-col bg-jw-bg-2">
      <div ref={scroller} className="jw-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain" style={{ touchAction: "pan-x pan-y" }} onDragOver={dragOver} onDragLeave={dragLeave} onDrop={drop}>
        <div ref={content} className="relative" style={{ width: contentW, minHeight: "100%" }}>
          {/* ruler */}
          <div className="sticky top-0 z-20 flex" style={{ height: compact ? RULER_PHONE : RULER }}>
            {!compact && <div className="sticky left-0 z-30 flex items-center gap-0.5 border-b border-e border-jw-line bg-jw-surface px-1" style={{ width: HEAD, minWidth: HEAD }}>
              <button type="button" className="grid h-6 w-6 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={() => zoomTo(pps / 1.6)} aria-label="تصغير" title="تصغير">
                <Icon name="zoomOut" size={14} />
              </button>
              {!compact && (
                <button type="button" className="grid h-6 w-6 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={fit} aria-label="اعرض الكل" title="اعرض الكل">
                  <Icon name="expand" size={13} />
                </button>
              )}
              <button type="button" className="grid h-6 w-6 place-items-center rounded text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink" onClick={() => zoomTo(pps * 1.6)} aria-label="تكبير" title="تكبير">
                <Icon name="zoomIn" size={14} />
              </button>
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
              {/* beat marks */}
              {tl.markers.map((m) => (
                <span key={`m${m}`} className="pointer-events-none absolute bottom-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-jw-warn" style={{ left: X0 - HEAD + lanePx(m) }} />
              ))}
            </div>
          </div>

          {/* tracks */}
          {ordered.map((track) => {
            const isMain = track.id === main?.id;
            const target = moving && moving.ghostTrack === track.id && moving.trackId !== track.id;
            return (
              <div
                key={track.id}
                data-track={track.kind}
                ref={(el) => {
                  if (el) rows.current.set(track.id, el);
                  else rows.current.delete(track.id);
                }}
                className={`flex border-b border-jw-line ${pro ? (ordered.indexOf(track) % 2 ? "bg-black/[0.06]" : "bg-black/[0.02]") : isMain ? "bg-jw-surface-2/40" : ""} ${target || dropAt?.trackId === track.id ? "bg-jw-accent/10" : ""}`}
                style={{ height: height(track) }}
              >
                {!compact && <TrackHead track={track} isMain={isMain} width={HEAD} compact={compact} readOnly={readOnly} run={run} label={pro ? labels.get(track.id) : undefined} />}
                <div className="relative flex-1" onPointerDown={laneDown} onPointerMove={laneMove} onPointerUp={laneUp} onPointerCancel={() => setBox(null)}>
                  {/* a phone: «+» after the last clip adds more (CapCut's way) */}
                  {compact && isMain && !readOnly && total > 0 && (
                    <button type="button" className="absolute top-1 bottom-1 grid w-11 place-items-center rounded-md border border-jw-line bg-jw-surface text-jw-ink shadow" style={{ left: X0 + lanePx(trackEnd(track)) + 6 }} onClick={onEmpty} aria-label="أضف مقطع" title="أضف مقطع">
                      <Icon name="plus" size={18} strokeWidth={2.5} />
                    </button>
                  )}
                  {track.clips.map((c) => (moving?.id === c.id && moving.ghostTrack !== track.id ? null : clipView(track, c)))}
                  {/* a clip being dragged here from another track */}
                  {moving && moving.ghostTrack === track.id && moving.trackId !== track.id && (() => {
                    const c = findOwn(moving.id);
                    return c ? clipView(track, c, true) : null;
                  })()}
                  {track.hidden && <span className="pointer-events-none absolute inset-0 bg-black/40" />}
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
          {dropAt && (
            <div className="pointer-events-none absolute bottom-0 z-30 w-0.5 bg-jw-accent shadow-[0_0_10px_var(--jw-accent)]" style={{ top: RULER, left: X0 + lanePx(dropAt.ms) }}>
              <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-jw-accent px-1.5 py-0.5 text-[10px] text-jw-on-accent" dir="rtl">
                اترك هنا · {formatTime(dropAt.ms)}
              </span>
            </div>
          )}
          {box && Math.hypot(box.x1 - box.x0, box.y1 - box.y0) >= 4 && (
            <div
              className="pointer-events-none absolute z-40 rounded-sm border border-jw-accent bg-jw-accent/15"
              style={{ left: Math.min(box.x0, box.x1), top: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) }}
            />
          )}
          {moving?.ghostTrack === "new" && (
            <div className="pointer-events-none absolute inset-x-0 z-20 border-2 border-dashed border-jw-accent bg-jw-accent/10 text-center text-xs text-jw-accent" style={{ top: RULER, height: 30 }}>
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

function TrackHead({ track, isMain, width, compact, readOnly, run, label }: { track: Track; isMain: boolean; width: number; compact: boolean; readOnly: boolean; run: Props["run"]; label?: string }) {
  // the colours open over the editor (the timeline's own box would cut them off)
  const [painting, setPainting] = useState<{ x: number; y: number } | null>(null);
  const toggle = (patch: Partial<Pick<Track, "muted" | "hidden" | "locked">>) => run({ type: "update_track", trackId: track.id, patch });
  const btn = "grid h-6 w-6 place-items-center rounded hover:bg-jw-surface-3";
  const icon = track.kind === "audio" ? "music" : track.kind === "text" ? "type" : isMain ? "film" : "layers";
  return (
    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-0.5 border-e border-jw-line bg-jw-surface px-1 text-jw-muted" style={{ width, minWidth: width }} dir="rtl">
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
        {track.kind !== "text" && (
          <button type="button" disabled={readOnly} className={`${btn} ${track.muted ? "text-jw-danger" : ""}`} onClick={() => toggle({ muted: !track.muted })} aria-label={track.muted ? "شغّل الصوت" : "اكتم"} title={track.muted ? "شغّل الصوت" : "اكتم"}>
            <Icon name={track.muted ? "volumeOff" : "volume"} size={13} />
          </button>
        )}
        {track.kind !== "audio" && !compact && (
          <button type="button" disabled={readOnly} className={`${btn} ${track.hidden ? "text-jw-warn" : ""}`} onClick={() => toggle({ hidden: !track.hidden })} aria-label={track.hidden ? "أظهر" : "أخفِ"} title={track.hidden ? "أظهر" : "أخفِ"}>
            <Icon name={track.hidden ? "eyeOff" : "eye"} size={13} />
          </button>
        )}
        <button type="button" disabled={readOnly} className={`${btn} ${track.locked ? "text-jw-accent" : ""}`} onClick={() => toggle({ locked: !track.locked })} aria-label={track.locked ? "افتح القفل" : "اقفل المسار"} title={track.locked ? "افتح القفل" : "اقفل المسار"}>
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
