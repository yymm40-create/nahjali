"use client";

// «حيدر كات» — the preview's touch layer. A tap picks the clip under the finger (nothing there: play/pause).
// The selected clip gets a box: drag it to move, a corner to resize, the knob on top to turn; two fingers resize and
// turn at once. It snaps to the middle of the frame (a guide line shows) and to straight angles. With motion points,
// the change goes into the point at the playhead.

import { useEffect, useRef, useState } from "react";
import { duration, findClip, type Clip, type Timeline, type Transform } from "@/lib/editor/model";
import type { Run } from "./Inspector";
import { clipBox, layersAt } from "./render";
import type { PlayerLike } from "./Timeline";
import type { EditorAsset } from "./types";

type Mode = "move" | "scale" | "rotate" | "pinch";
interface Drag {
  id: number;
  mode: Mode;
  clip: Clip;
  at: number;
  t0: Transform;
  /** the box's centre on screen */
  cx: number;
  cy: number;
  x0: number;
  y0: number;
  /** pinch: the two fingers' distance and angle when it started */
  d0: number;
  a0: number;
  mx0: number;
  my0: number;
}

const deg = (r: number) => (r * 180) / Math.PI;

export default function Handles({
  tl,
  canvas,
  selected,
  onSelect,
  assets,
  run,
  readOnly,
  player,
  onTap,
}: {
  tl: Timeline;
  canvas: HTMLCanvasElement | null;
  selected: string[];
  onSelect: (ids: string[]) => void;
  assets: Map<string, EditorAsset>;
  run: Run;
  readOnly: boolean;
  player: (PlayerLike & { toggle(): void }) | null;
  onTap?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [now, setNow] = useState({ ms: 0, playing: false });
  const [guides, setGuides] = useState({ v: false, h: false });
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const tap = useRef<{ x: number; y: number } | null>(null);
  const seq = useRef(0);

  // follow the canvas's place on the page
  useEffect(() => {
    if (!canvas) return;
    const measure = () => {
      const p = canvas.offsetParent as HTMLElement | null;
      if (!p) return;
      setRect({ left: canvas.offsetLeft, top: canvas.offsetTop, width: canvas.offsetWidth, height: canvas.offsetHeight });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    const t = setTimeout(measure, 0);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [canvas]);

  useEffect(() => {
    if (!player) return;
    const t = setTimeout(() => setNow({ ms: player.ms, playing: player.playing }), 0);
    const off = player.subscribe((ms, playing) => {
      // while playing, the box hides (and nothing re-renders 60 times a second)
      if (playing) setNow((n) => (n.playing ? n : { ms, playing }));
      else setNow({ ms, playing });
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, [player]);

  if (!rect) return null;
  const k = rect.width / tl.width;
  // at the very end the last frame is on screen (as the player shows it)
  const ms = Math.min(now.ms, Math.max(0, duration(tl) - 1));
  const sizeOf = (c: Clip) => {
    const a = c.assetId ? assets.get(c.assetId) : null;
    return c.text ? null : { width: a?.width || tl.width, height: a?.height || tl.height };
  };
  const visible = layersAt(tl, ms).flatMap((l) => ("clip" in l ? [l] : []));
  const sel = selected.length === 1 ? visible.find((l) => l.clip.id === selected[0]) : undefined;
  const found = sel ? findClip(tl, sel.clip.id) : null;
  const box = sel && !now.playing ? clipBox(tl, sel.clip, sel.ms, sizeOf(sel.clip)) : null;
  const editable = !!found && !readOnly && !found.track.locked;
  const knobBelow = !!box && (box.cy - box.h / 2) * k < 40;

  const apply = (d: Drag, p: Partial<Transform>) => {
    const key = `${d.clip.id}:drag:${d.id}`;
    if (d.clip.keys.length) run({ type: "set_key", clipId: d.clip.id, at: d.at, transform: p }, { coalesce: key });
    else run({ type: "update_clip", clipId: d.clip.id, patch: { transform: p } }, { coalesce: key });
  };

  /** Which clip is under a point of the preview (the top one), with its box tilted as drawn. */
  const hit = (px: number, py: number) => {
    for (const l of [...visible].reverse()) {
      const b = clipBox(tl, l.clip, l.ms, sizeOf(l.clip));
      if (!b) continue;
      const r = (-b.rotate * Math.PI) / 180;
      const dx = px - b.cx;
      const dy = py - b.cy;
      const x = dx * Math.cos(r) - dy * Math.sin(r);
      const y = dx * Math.sin(r) + dy * Math.cos(r);
      if (Math.abs(x) <= b.w / 2 && Math.abs(y) <= b.h / 2) return l.clip.id;
    }
    return null;
  };

  const begin = (e: React.PointerEvent, mode: Mode) => {
    if (!sel || !box || !editable) return;
    e.stopPropagation();
    root.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = root.current!.getBoundingClientRect();
    const base = { clip: sel.clip, at: sel.ms, t0: box.t, cx: r.left + box.cx * k, cy: r.top + box.cy * k, x0: e.clientX, y0: e.clientY, d0: 0, a0: 0, mx0: 0, my0: 0 };
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      drag.current = { ...base, id: ++seq.current, mode: "pinch", d0: Math.hypot(p2.x - p1.x, p2.y - p1.y), a0: Math.atan2(p2.y - p1.y, p2.x - p1.x), mx0: (p1.x + p2.x) / 2, my0: (p1.y + p2.y) / 2 };
    } else drag.current = { ...base, id: ++seq.current, mode };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pinch") {
      const [p1, p2] = [...pointers.current.values()];
      if (!p2) return;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      apply(d, {
        scale: Math.max(0.05, Math.min(10, d.t0.scale * (dist / (d.d0 || 1)))),
        rotate: Math.round(d.t0.rotate + deg(ang - d.a0)),
        x: d.t0.x + (mx - d.mx0) / rect.width,
        y: d.t0.y + (my - d.my0) / rect.height,
      });
      return;
    }
    if (d.mode === "move") {
      let x = d.t0.x + (e.clientX - d.x0) / rect.width;
      let y = d.t0.y + (e.clientY - d.y0) / rect.height;
      const v = Math.abs(x - 0.5) < 0.015;
      const h = Math.abs(y - 0.5) < 0.015;
      if (v) x = 0.5;
      if (h) y = 0.5;
      setGuides((g) => (g.v === v && g.h === h ? g : { v, h }));
      apply(d, { x, y });
    } else if (d.mode === "scale") {
      const d0 = Math.hypot(d.x0 - d.cx, d.y0 - d.cy) || 1;
      const d1 = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
      apply(d, { scale: Math.max(0.05, Math.min(10, d.t0.scale * (d1 / d0))) });
    } else {
      const a0 = Math.atan2(d.y0 - d.cy, d.x0 - d.cx);
      const a1 = Math.atan2(e.clientY - d.cy, e.clientX - d.cx);
      let r = d.t0.rotate + deg(a1 - a0);
      r = ((((r + 180) % 360) + 360) % 360) - 180;
      const snap = Math.round(r / 45) * 45;
      if (Math.abs(r - snap) < 4) r = snap;
      apply(d, { rotate: Math.round(r) });
    }
  };

  const end = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      drag.current = null;
      setGuides({ v: false, h: false });
    } else if (drag.current?.mode === "pinch") drag.current = null;
  };

  // a tap: pick the clip under it, or play/pause on an empty spot
  const down = (e: React.PointerEvent) => {
    // a second finger while the first holds the box: resize and turn with both
    if (drag.current) return begin(e, "move");
    tap.current = { x: e.clientX, y: e.clientY };
  };
  const up = (e: React.PointerEvent) => {
    const t = tap.current;
    tap.current = null;
    end(e);
    if (!t || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 6) return;
    const r = root.current!.getBoundingClientRect();
    const id = now.playing ? null : hit((e.clientX - r.left) / k, (e.clientY - r.top) / k);
    if (id && !selected.includes(id)) onSelect([id]);
    else if (!id) {
      onTap?.();
      player?.toggle();
    }
  };

  const handle = "absolute h-4 w-4 rounded-full border-2 border-jw-accent bg-white shadow sm:h-3 sm:w-3";
  return (
    <div
      ref={root}
      className="absolute select-none"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, touchAction: box && editable ? "none" : "manipulation" }}
      onPointerDown={down}
      onPointerMove={onMove}
      onPointerUp={up}
      onPointerCancel={end}
      aria-hidden
    >
      {guides.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-jw-accent/80" />}
      {guides.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-jw-accent/80" />}
      {box && (
        <div
          className={`absolute border-[1.5px] ${editable ? "cursor-move border-jw-accent" : "border-dashed border-white/60"}`}
          style={{
            left: `${(box.cx / tl.width) * 100}%`,
            top: `${(box.cy / tl.height) * 100}%`,
            width: `${(box.w / tl.width) * 100}%`,
            height: `${(box.h / tl.height) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${box.rotate}deg)`,
            touchAction: "none",
          }}
          onPointerDown={(e) => begin(e, "move")}
        >
          {editable && (
            <>
              {[
                ["-left-2 -top-2", "nwse-resize"],
                ["-right-2 -top-2", "nesw-resize"],
                ["-left-2 -bottom-2", "nesw-resize"],
                ["-right-2 -bottom-2", "nwse-resize"],
              ].map(([pos, cursor]) => (
                <span key={pos} className={`${handle} ${pos}`} style={{ cursor }} onPointerDown={(e) => begin(e, "scale")} />
              ))}
              {/* the turning knob: above the box, or under it when the box reaches the top of the frame */}
              <span className={`absolute left-1/2 h-5 w-px -translate-x-1/2 bg-jw-accent ${knobBelow ? "-bottom-7" : "-top-7"}`} />
              <span className={`${handle} ${knobBelow ? "-bottom-9" : "-top-9"} left-1/2 -translate-x-1/2 cursor-grab`} onPointerDown={(e) => begin(e, "rotate")} title="تدوير" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
