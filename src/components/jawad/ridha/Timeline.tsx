"use client";

// «الرضا فويس» — the project's middle: the track list (name, mute, solo, record, mono/stereo, a level meter) and
// the event display drawn on one canvas, under a ruler in bars and time. Time runs left to right (as on every
// mixing desk), whatever the page's direction. With the arrow tool, events are dragged, trimmed from their edges and
// faded from their top corners; the scissors cut where they are pressed, the eraser deletes, the mute tool silences.
// The ruler seeks and draws the cycle.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { addGroup, armTrack, addTrack, deleteClips, moveClip, patchClip, patchTrack, setFades, splitClip, trimClip } from "@/lib/ridha/ops";
import { barSec, barsLabel, beatSec, clockLabel, projectEnd, snapTime, SR, type Clip, type Project, type Track } from "@/lib/ridha/model";
import { drawWave, peakOf } from "@/lib/ridha/dsp/wav";
import { getSound, soundDur } from "./engine";
import { useStudio } from "./ctx";
import TrackMenu from "./TrackMenu";
import { meterPos, usePhone } from "./ui";

/** A track row's height: roomy on a desk, tighter on a phone so more tracks fit. */
const ROW = 84, ROW_PHONE = 68;
const EDGE = 6, EDGE_TOUCH = 18;

export type Tool = "select" | "split" | "erase" | "mute";
type Zone = "body" | "left" | "right" | "fadeIn" | "fadeOut";
interface Hit {
  clip: Clip;
  zone: Zone;
}

export interface TimelineApi {
  zoom(factor: number): void;
  fit(): void;
}

export default function Timeline({ onImport, onPick, onRecord, onChoir, recStart, apiRef, tool }: { onImport(files: File[], trackId: string | null, at: number): void; onPick(): void; onRecord(): void; onChoir(): void; recStart: number | null; apiRef: React.MutableRefObject<TimelineApi | null>; tool: Tool }) {
  const st = useStudio();
  const { project: p, engine, store } = st;
  const phone = usePhone();
  const th = phone ? ROW_PHONE : ROW;
  const [pps, setPps] = useState(70);
  const [scroll, setScroll] = useState(0);
  const [width, setWidth] = useState(800);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const lanes = useRef<HTMLCanvasElement>(null);
  const ruler = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const rhead = useRef<HTMLDivElement>(null);
  const recBox = useRef<HTMLDivElement>(null);
  const hbar = useRef<HTMLDivElement>(null);
  const heads = useRef<HTMLDivElement>(null);
  const view = useRef({ pps, scroll, width, th });
  // two fingers on the lanes are zooming: the one-finger gesture under them stands still
  const pinching = useRef(false);
  const pRef = useRef(p);
  // handlers and the frame loop read the latest view and project from here
  useLayoutEffect(() => {
    view.current = { pps, scroll, width, th };
    pRef.current = p;
  });

  const total = Math.max(projectEnd(p) + 20, (width / pps) * 1.5, 60);
  const height = Math.max(p.tracks.length * th + 72, 160);
  const X = useCallback((t: number) => (t - view.current.scroll) * view.current.pps, []);
  const Tm = useCallback((x: number) => x / view.current.pps + view.current.scroll, []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const zoomAt = useCallback((factor: number, atX?: number) => {
    const v = view.current;
    const x = atX ?? v.width / 2;
    const t = x / v.pps + v.scroll;
    // from the whole project on one screen down to four pixels a sample
    const next = Math.max(6, Math.min(SR * 4, v.pps * factor));
    setPps(next);
    setScroll(Math.max(0, t - x / next));
  }, []);
  const fit = useCallback(() => {
    setPps(Math.max(6, (view.current.width - 40) / Math.max(projectEnd(pRef.current), 8)));
    setScroll(0);
  }, []);
  useEffect(() => {
    apiRef.current = { zoom: (f) => zoomAt(f), fit };
  }, [apiRef, zoomAt, fit]);

  // ── drawing ──

  useEffect(() => {
    const c = lanes.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    p.tracks.forEach((t, i) => {
      g.fillStyle = t.id === st.selTrack ? "#1f2126" : "#17181c";
      g.fillRect(0, i * th, width, th - 1);
      g.fillStyle = "#0e0f12";
      g.fillRect(0, (i + 1) * th - 1, width, 1);
      if (t.note && t.kind !== "group" && !p.clips.some((c) => c.trackId === t.id)) {
        // a part not recorded yet: its lane says what to sing on it
        g.fillStyle = "rgba(166,170,178,0.6)";
        g.font = "12px system-ui, sans-serif";
        g.textBaseline = "middle";
        g.direction = "rtl";
        g.textAlign = "left";
        g.fillText(`${t.arm ? "● جاهز للتسجيل — " : ""}${t.note}`, 16, i * th + th / 2, width - 32);
        g.direction = "ltr";
      }
      if (t.kind === "group") {
        // a group holds no clips: its lane says what it does
        g.fillStyle = "rgba(233,185,73,0.06)";
        g.fillRect(0, i * th, width, th - 1);
        g.fillStyle = "rgba(233,185,73,0.75)";
        g.font = "12px system-ui, sans-serif";
        g.textBaseline = "middle";
        g.direction = "rtl";
        g.textAlign = "left";
        const n = p.tracks.filter((x) => x.group === t.id).length;
        g.fillText(n ? `قروب — ${n} مسارات تمر من هنا؛ مؤثراته ومستواه عليها كلها` : "قروب فاضي — أدخل المسارات فيه من «⋯» على رأس المسار", 16, i * th + th / 2, width - 32);
        g.direction = "ltr";
      }
    });
    drawGrid(g, p, pps, scroll, width, p.tracks.length * th);
    if (p.loop.on) {
      const a = (p.loop.start - scroll) * pps, b = (p.loop.end - scroll) * pps;
      g.fillStyle = "rgba(47,214,195,0.05)";
      g.fillRect(a, 0, b - a, height);
    }
    // waiting takes first (underneath), then what plays, then what is selected
    const order = [...p.clips].sort((a, b) => Number(b.muted) - Number(a.muted) || Number(st.selClips.includes(a.id)) - Number(st.selClips.includes(b.id)));
    for (const clip of order) {
      const ti = p.tracks.findIndex((t) => t.id === clip.trackId);
      if (ti < 0) continue;
      drawClip(g, clip, p.tracks[ti].color, ti, th, pps, scroll, width, st.selClips.includes(clip.id));
    }
    for (const m of p.markers) {
      g.fillStyle = "rgba(224,176,64,0.55)";
      g.fillRect((m.time - scroll) * pps, 0, 1, height);
    }
  }, [p, pps, scroll, width, height, th, st.selClips, st.selTrack]);

  useEffect(() => {
    const c = ruler.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(34 * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, 34);
    drawRuler(g, p, pps, scroll, width);
  }, [p, pps, scroll, width]);

  // the cursor, the recording block and the meters move every frame without redrawing anything else
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pos = engine.position();
      const v = view.current;
      const x = (pos - v.scroll) * v.pps;
      const show = x >= -2 && x <= v.width + 2;
      for (const el of [head.current, rhead.current]) {
        if (!el) continue;
        el.style.transform = `translateX(${x}px)`;
        el.style.opacity = show ? "1" : "0";
      }
      if (engine.playing && (x > v.width - 60 || x < 0)) setScroll(Math.max(0, pos - 60 / v.pps));
      const rb = recBox.current;
      if (rb) {
        if (engine.recording && recStart != null) {
          const ti = pRef.current.tracks.findIndex((t) => t.arm);
          rb.style.display = "block";
          rb.style.left = `${(recStart - v.scroll) * v.pps}px`;
          rb.style.width = `${Math.max(2, (pos - recStart) * v.pps)}px`;
          rb.style.top = `${Math.max(0, ti) * v.th + 6}px`;
        } else rb.style.display = "none";
      }
      for (const el of heads.current?.querySelectorAll<HTMLElement>("[data-m]") ?? []) {
        // an armed track shows the microphone while nothing plays: the level is set before recording
        const peak = el.dataset.arm && engine.hasMic && !engine.playing ? engine.micPeak() : engine.trackPeak(el.dataset.m!);
        const prev = Number(el.dataset.v || 0);
        const now = Math.max(meterPos(peak), prev - 0.03);
        el.dataset.v = String(now);
        el.style.transform = `scaleY(${now})`;
        el.classList.toggle("hot", peak > 0.98);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, recStart]);

  // the scrollbar under the events follows the view, and drives it
  useEffect(() => {
    const el = hbar.current;
    if (el && Math.abs(el.scrollLeft - scroll * pps) > 2) el.scrollLeft = scroll * pps;
  }, [scroll, pps]);

  // ── pointer work on the events ──

  /** What is under a point of the lanes. A finger gets wider edges and corners than a mouse. */
  const hit = useCallback((x: number, y: number, touch = false): Hit | null => {
    const q = pRef.current;
    const rowH = view.current.th;
    const ti = Math.floor(y / rowH);
    const track = q.tracks[ti];
    if (!track) return null;
    const inTrack = q.clips.filter((c) => c.trackId === track.id).sort((a, b) => Number(a.muted) - Number(b.muted));
    const edge = touch ? EDGE_TOUCH : EDGE, corner = touch ? 22 : 12;
    for (const clip of inTrack) {
      const a = X(clip.start), b = X(clip.start + clip.dur);
      if (x < a - 2 || x > b + 2) continue;
      const top = y - ti * rowH < 24;
      const wide = b - a > (touch ? 64 : 30);
      if (top && wide && x < a + Math.max(corner, clip.fadeIn * view.current.pps + 7)) return { clip, zone: "fadeIn" };
      if (top && wide && x > b - Math.max(corner, clip.fadeOut * view.current.pps + 7)) return { clip, zone: "fadeOut" };
      if (x < a + edge && wide) return { clip, zone: "left" };
      if (x > b - edge && wide) return { clip, zone: "right" };
      return { clip, zone: "body" };
    }
    return null;
  }, [X]);

  const onLaneDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // a second finger belongs to the zoom, not to a new gesture
    if (e.button !== 0 || pinching.current) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x0 = e.clientX - r.left, y0 = e.clientY - r.top;
    const touch = e.pointerType === "touch";
    const under = hit(x0, y0, touch);
    // a finger on a clip that is not selected yet slides the view (and a tap selects it): nothing moves by accident
    const h = under && touch && tool === "select" && !st.selClips.includes(under.clip.id) ? null : under;
    const track = p.tracks[Math.floor(y0 / th)];
    // the other tools act where they are pressed, once
    if (h && tool !== "select") {
      const at = snapTime(p, Tm(x0), pps);
      if (tool === "split") store.set((q) => splitClip(q, h.clip.id, at));
      else if (tool === "erase") {
        store.set((q) => deleteClips(q, [h.clip.id]));
        st.select(st.selClips.filter((id) => id !== h.clip.id), h.clip.trackId);
      } else store.set((q) => patchClip(q, h.clip.id, { muted: !h.clip.muted }));
      return;
    }
    el.setPointerCapture(e.pointerId);
    const gesture = `g${Date.now()}`;
    let moved = false, pinched = false;
    /** Follows this one pointer until it lifts (`act`) or the browser takes the gesture away (a vertical scroll). */
    const follow = (move: (ev: PointerEvent) => void, act: () => void) => {
      const id = e.pointerId;
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        if (pinching.current) pinched = true;
        else move(ev);
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== id) return;
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", end);
        el.removeEventListener("pointercancel", end);
        if (ev.type === "pointerup" && !pinched && !pinching.current) act();
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
    };
    if (h) {
      const many = e.shiftKey || e.metaKey || e.ctrlKey;
      const sel = many ? (st.selClips.includes(h.clip.id) ? st.selClips : [...st.selClips, h.clip.id]) : st.selClips.includes(h.clip.id) ? st.selClips : [h.clip.id];
      st.select(sel, h.clip.trackId);
      const base = store.get();
      const starts = new Map(base.clips.filter((c) => sel.includes(c.id)).map((c) => [c.id, c]));
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - r.left - x0, dy = ev.clientY - r.top - y0;
        if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 6) return;
        moved = true;
        const v = view.current;
        const t = Tm(ev.clientX - r.left);
        store.set((q) => {
          if (h.zone === "left" || h.zone === "right") return trimClip(q, h.clip.id, h.zone, snapTime(q, t, v.pps), soundDur(h.clip.assetId));
          if (h.zone === "fadeIn") return setFades(q, h.clip.id, Math.max(0, t - h.clip.start), h.clip.fadeOut);
          if (h.zone === "fadeOut") return setFades(q, h.clip.id, h.clip.fadeIn, Math.max(0, h.clip.start + h.clip.dur - t));
          const lead = starts.get(h.clip.id)!;
          const delta = snapTime(q, lead.start + dx / v.pps, v.pps) - lead.start;
          const dTrack = Math.round(dy / v.th);
          let out = q;
          for (const [id, c] of starts) {
            const ti = base.tracks.findIndex((tr) => tr.id === c.trackId);
            const target = base.tracks[Math.max(0, Math.min(base.tracks.length - 1, ti + dTrack))];
            out = moveClip(out, id, c.start + delta, target?.kind === "group" ? c.trackId : target?.id);
          }
          return out;
        }, { merge: gesture });
      };
      follow(move, () => {
        if (!moved && !many) st.select([h.clip.id], h.clip.trackId);
      });
      return;
    }
    // empty lane: a press seeks and selects the track; a drag slides the view
    const s0 = view.current.scroll;
    follow((ev) => {
      const dx = ev.clientX - r.left - x0;
      if (!moved && Math.abs(dx) < 5) return;
      moved = true;
      setScroll(Math.max(0, s0 - dx / view.current.pps));
    }, () => {
      if (moved) return;
      // a tap with a finger on a clip selects it; anywhere else it seeks
      if (under && tool === "select") return st.select([under.clip.id], under.clip.trackId);
      st.select([], track?.id ?? st.selTrack);
      engine.seek(snapTime(pRef.current, Tm(x0), view.current.pps));
    });
  };

  const onLaneMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons) return;
    const r = e.currentTarget.getBoundingClientRect();
    const h = hit(e.clientX - r.left, e.clientY - r.top);
    e.currentTarget.style.cursor = tool !== "select" ? (h ? (tool === "split" ? "col-resize" : "crosshair") : "default") : !h ? "default" : h.zone === "left" || h.zone === "right" ? "ew-resize" : h.zone === "body" ? "grab" : "col-resize";
  };

  const onRulerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x0 = e.clientX - r.left;
    const t0 = snapTime(p, Tm(x0), pps);
    el.setPointerCapture(e.pointerId);
    let moved = false;
    const gesture = `l${Date.now()}`;
    const move = (ev: PointerEvent) => {
      const x = ev.clientX - r.left;
      if (!moved && Math.abs(x - x0) < 5) return;
      moved = true;
      const t = snapTime(pRef.current, Tm(x), view.current.pps);
      store.set((q) => ({ ...q, loop: { on: true, start: Math.min(t0, t), end: Math.max(t0, t) } }), { undo: false, merge: gesture });
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      if (!moved && ev.type === "pointerup") engine.seek(t0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  // two fingers on the lanes: spreading them zooms in where they are, closing them zooms out
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let last = 0;
    const gap = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        pinching.current = true;
        last = gap();
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size !== 2 || last <= 0) return;
      const d = gap();
      if (d < 8 || Math.abs(d - last) < 1) return;
      const [a, b] = [...pts.values()];
      zoomAt(d / last, (a.x + b.x) / 2 - el.getBoundingClientRect().left);
      last = d;
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      last = 0;
      if (!pts.size) pinching.current = false;
    };
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move, true);
    el.addEventListener("pointerup", up, true);
    el.addEventListener("pointercancel", up, true);
    return () => {
      el.removeEventListener("pointerdown", down, true);
      el.removeEventListener("pointermove", move, true);
      el.removeEventListener("pointerup", up, true);
      el.removeEventListener("pointercancel", up, true);
    };
  }, [zoomAt]);

  // wheel: pinch or ⌘/Ctrl zooms where the pointer is; sideways (or Shift) slides; plain vertical scrolls the tracks
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - el.getBoundingClientRect().left);
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault();
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        setScroll((s) => Math.max(0, s + d / view.current.pps));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onDrop = (e: React.DragEvent) => {
    // dropped on the lanes: the file starts where it was let go (and takes that track only if the track is empty)
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("audio/") || f.type.startsWith("video/") || /\.(wav|mp3|m4a|aac|ogg|flac|opus|webm|mp4|mov|aif|aiff)$/i.test(f.name));
    if (!files.length) return;
    e.preventDefault();
    e.stopPropagation();
    const r = lanes.current!.getBoundingClientRect();
    const track = p.tracks[Math.floor((e.clientY - r.top) / th)];
    onImport(files, track && track.kind !== "group" ? track.id : null, Math.max(0, snapTime(p, Tm(e.clientX - r.left), pps)));
  };

  const tb = (cls: string, on: boolean, label: string, title: string, onClick: () => void) => (
    <button type="button" className={`rv-tb ${cls}${on ? " on" : ""}`} title={title} onClick={onClick}>{label}</button>
  );

  return (
    <div className="rv-tl" dir="ltr">
      <div className="rv-tl-corner" dir="rtl">
        <button type="button" className="rv-addtrack" onClick={() => setAdding(!adding)} aria-expanded={adding}>{phone ? "＋ مسار" : "＋ إضافة مسار"}</button>
        {adding ? <div className="rv-scrim" onPointerDown={() => setAdding(false)} /> : null}
        {adding ? (
          <div className="rv-pop rv-addmenu" onPointerLeave={(e) => e.pointerType === "mouse" && setAdding(false)}>
            <button type="button" onClick={() => (store.set((q) => addTrack(q, undefined, { stereo: false }).project), setAdding(false))}><b>مسار صوت</b><small>مونو — للتسجيل بالمايك</small></button>
            <button type="button" onClick={() => (store.set((q) => addTrack(q, `موسيقى ${q.tracks.length + 1}`, { stereo: true }).project), setAdding(false))}><b>مسار ستيريو</b><small>للموسيقى والملفات الستيريو</small></button>
            <button type="button" onClick={() => (onChoir(), setAdding(false))}><b>كورال</b><small>مسارات جاهزة بالأدوار: قرار، وسط، جواب…</small></button>
            <button type="button" onClick={() => (onPick(), setAdding(false))}><b>استيراد ملف</b><small>صوت أو فيديو من جهازك</small></button>
            <button type="button" onClick={() => {
              store.set((q) => {
                // the selected track and the tracks of the selected clips go into the new group
                const members = [...new Set([st.selTrack, ...q.clips.filter((c) => st.selClips.includes(c.id)).map((c) => c.trackId)])];
                const made = addGroup(q, members);
                st.select(st.selClips, made.track.id);
                return made.project;
              });
              setAdding(false);
            }}><b>قروب</b><small>يجمع المسار المحدد: مؤثرات واحدة على الكل</small></button>
          </div>
        ) : null}
      </div>
      <div className="rv-tl-rulerwrap">
        <canvas ref={ruler} className="rv-tl-ruler" style={{ width, height: 34 }} onPointerDown={onRulerDown} onDoubleClick={() => store.set((q) => ({ ...q, loop: { ...q.loop, on: !q.loop.on } }), { undo: false })} />
        <div ref={rhead} className="rv-playhead-top" />
        <span className="rv-tl-zoom">
          <button type="button" onClick={() => zoomAt(1 / 1.4)} title="تصغير (G)">−</button>
          <button type="button" className="fit" onClick={fit} title="كل المشروع في الشاشة">⤢</button>
          <button type="button" onClick={() => zoomAt(1.4)} title="تكبير (H)">＋</button>
        </span>
      </div>
      <div className="rv-tl-body">
        <div className="rv-tl-heads" dir="rtl" ref={heads}>
          {p.tracks.map((t) => phone ? (
            // on a phone the header is the track's face only — its icon, its name, its effects; a tap opens everything else
            <div key={t.id} className={`rv-th rv-th-m${t.id === st.selTrack ? " sel" : ""}${t.kind === "group" ? " group" : ""}${t.mute ? " muted" : ""}`} style={{ height: th, ["--c" as string]: t.color }} role="button" tabIndex={0} aria-label={`المسار ${t.name}: الإعدادات`} onClick={() => {
              st.select(st.selClips, t.id);
              setMenu({ id: t.id, x: 0, y: 0 });
            }}>
              <span className="rv-th-icon" aria-hidden>
                <TrackIcon track={t} />
                {t.arm ? <em className="arm" /> : null}
                {t.solo ? <em className="solo">S</em> : t.mute ? <em className="mute">M</em> : null}
              </span>
              <button type="button" className={`rv-th-fx${t.fx.some((f) => f.on) ? " on" : ""}`} onClick={(e) => {
                e.stopPropagation();
                st.select(st.selClips, t.id);
                st.openPanel("fx");
              }} aria-label="مؤثرات المسار">Fx{t.fx.length ? ` ${t.fx.length}` : ""}</button>
              <span className="rv-th-mname">{t.name}</span>
              <span className="rv-th-meter"><i data-m={t.id} data-arm={t.arm ? "1" : undefined} /></span>
            </div>
          ) : (
            <div key={t.id} className={`rv-th${t.id === st.selTrack ? " sel" : ""}${t.kind === "group" ? " group" : ""}${t.group ? " child" : ""}`} style={{ height: th, ["--c" as string]: t.color }} onPointerDown={() => st.select(st.selClips, t.id)}>
              <span className="rv-th-icon" aria-hidden><TrackIcon track={t} /></span>
              <div className="rv-th-main">
                <div className="rv-th-row">
                  <input className="rv-th-name" value={t.name} onChange={(e) => store.set((q) => patchTrack(q, t.id, { name: e.target.value }), { merge: `n${t.id}` })} aria-label="اسم المسار" />
                  <button type="button" className={`rv-th-fx${t.fx.some((f) => f.on) ? " on" : ""}`} onClick={() => {
                    st.select(st.selClips, t.id);
                    st.openPanel("fx");
                  }} title="مؤثرات المسار">Fx{t.fx.length ? ` ${t.fx.length}` : ""}</button>
                  <button type="button" className="rv-th-more" onClick={(e) => {
                    // the menu opens beside the track list, over the lanes: the track it belongs to stays in view
                    const r = e.currentTarget.getBoundingClientRect();
                    const list = heads.current?.getBoundingClientRect();
                    setMenu(menu?.id === t.id ? null : { id: t.id, x: Math.min((list?.right ?? r.right) + 8, window.innerWidth - 292), y: r.top - 8 });
                  }} title="إعدادات المسار" aria-label="إعدادات المسار">⋯</button>
                </div>
                {t.note && t.kind !== "group" ? <small className="rv-th-note" title={t.note}>{t.note}</small> : null}
                <div className="rv-th-row rv-th-btns" dir="ltr">
                  {tb("m", t.mute, "M", "كتم", () => store.set((q) => patchTrack(q, t.id, { mute: !t.mute })))}
                  {tb("s", t.solo, "S", "منفرد", () => store.set((q) => patchTrack(q, t.id, { solo: !t.solo })))}
                  {t.kind === "group" ? null : tb("r", t.arm, "●", "جاهز للتسجيل: يسجّل هنا والمسارات الثانية تشتغل", () => store.set((q) => armTrack(q, t.id), { undo: false }))}
                  <input className="rv-th-gain" type="range" min={-40} max={6} step={0.5} value={Math.max(-40, t.gain)} onChange={(e) => store.set((q) => patchTrack(q, t.id, { gain: Number(e.target.value) }), { merge: `g${t.id}` })} onDoubleClick={() => store.set((q) => patchTrack(q, t.id, { gain: 0 }))} title={`المستوى ${t.gain.toFixed(1)} dB`} aria-label="مستوى المسار" style={{ ["--fill" as string]: `${((Math.max(-40, t.gain) + 40) / 46) * 100}%` }} />
                </div>
              </div>
              <span className="rv-th-meter"><i data-m={t.id} data-arm={t.arm ? "1" : undefined} /></span>
            </div>
          ))}
          <button type="button" className="rv-th-add" onClick={() => store.set((q) => addTrack(q, undefined, { stereo: false }).project)}>{phone ? "＋" : "＋ مسار جديد"}</button>
        </div>
        <div className="rv-tl-lanes" ref={wrap} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <canvas ref={lanes} style={{ width, height }} onPointerDown={onLaneDown} onPointerMove={onLaneMove} onDoubleClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const h = hit(e.clientX - r.left, e.clientY - r.top);
            if (h && tool === "select") {
              st.select([h.clip.id], h.clip.trackId);
              st.openPanel("editor");
            }
          }} />
          <div ref={recBox} className="rv-recbox" style={{ height: th - 13 }} />
          <div ref={head} className="rv-playhead" style={{ height }} />
          {!p.clips.length ? (
            <div className="rv-tl-hint" dir="rtl">
              <b>ابدأ مشروعك</b>
              <span>سجّل بصوتك على المسار الجاهز، أو اسحب ملف صوت وأفلته هنا</span>
              <div>
                <button type="button" className="rec" onClick={onRecord}>● ابدأ التسجيل</button>
                <button type="button" onClick={onPick}>استيراد ملف</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="rv-tl-hbar" ref={hbar} onScroll={(e) => {
        const s = e.currentTarget.scrollLeft / view.current.pps;
        if (Math.abs(s - view.current.scroll) > 2 / view.current.pps) setScroll(s);
      }}>
        <div style={{ width: total * pps, height: 1 }} />
      </div>
      {menu && p.tracks.some((t) => t.id === menu.id) ? <TrackMenu track={p.tracks.find((t) => t.id === menu.id)!} at={menu} sheet={phone} onClose={() => setMenu(null)} /> : null}
    </div>
  );
}

/** A track's picture: a folder for a group, a microphone for a mono track, notes for a stereo one. */
function TrackIcon({ track: t }: { track: Track }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={t.kind === "group" ? "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" : t.stereo === false ? "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" : "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"} />
    </svg>
  );
}

function gridStep(p: Project, pps: number): { minor: number; major: number } {
  const beat = beatSec(p), bar = barSec(p);
  // deep in: sixteenths of a beat, then tenths of that, down to single milliseconds
  if (pps * beat > 60 * 16) {
    let minor = beat / 16;
    while (pps * minor > 600) minor /= 10;
    return { minor, major: minor * 4 };
  }
  if (pps * beat > 60 * 4) return { minor: beat / 4, major: beat };
  if (pps * beat > 60) return { minor: beat, major: bar };
  if (pps * bar > 50) return { minor: bar, major: bar * 4 };
  if (pps * bar * 4 > 50) return { minor: bar * 4, major: bar * 16 };
  return { minor: bar * 16, major: bar * 64 };
}

function drawGrid(g: CanvasRenderingContext2D, p: Project, pps: number, scroll: number, w: number, h: number) {
  const { minor, major } = gridStep(p, pps);
  const from = Math.floor(scroll / minor) * minor;
  for (let t = from; (t - scroll) * pps < w; t += minor) {
    const x = Math.round((t - scroll) * pps);
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    g.fillStyle = isMajor ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.028)";
    g.fillRect(x, 0, 1, h);
  }
}

function drawRuler(g: CanvasRenderingContext2D, p: Project, pps: number, scroll: number, w: number) {
  const { minor, major } = gridStep(p, pps);
  const bar = barSec(p);
  const H = 34;
  if (p.loop.end > p.loop.start) {
    // the loop: a band along the top of the ruler, bright when it is on
    const a = (p.loop.start - scroll) * pps, b = (p.loop.end - scroll) * pps;
    g.fillStyle = p.loop.on ? "rgba(47,214,195,0.9)" : "rgba(47,214,195,0.25)";
    g.beginPath();
    g.roundRect(a, 2, Math.max(2, b - a), 6, 3);
    g.fill();
  }
  g.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  g.textBaseline = "alphabetic";
  const from = Math.floor(scroll / minor) * minor;
  for (let t = from; (t - scroll) * pps < w; t += minor) {
    const x = Math.round((t - scroll) * pps);
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    g.fillStyle = isMajor ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)";
    g.fillRect(x, isMajor ? 14 : 26, 1, H);
    if (isMajor) {
      g.fillStyle = "#c9cdd3";
      g.fillText(major >= bar ? String(Math.round(t / bar) + 1) : barsLabel(p, t + 1e-9), x + 5, 24);
      g.fillStyle = "rgba(130,136,146,0.9)";
      const label = major >= bar ? String(Math.round(t / bar) + 1) : barsLabel(p, t + 1e-9);
      g.fillText(clockLabel(t, major < 1), x + 9 + g.measureText(label).width, 24);
    }
  }
  for (const m of p.markers) {
    const x = (m.time - scroll) * pps;
    g.fillStyle = "#e9b949";
    g.beginPath();
    g.moveTo(x, 10);
    g.lineTo(x + 8, 10);
    g.lineTo(x + 8, 18);
    g.lineTo(x, 24);
    g.closePath();
    g.fill();
  }
}

/**
 * A clip: a rounded region tinted dark with its track's colour, and the wave drawn on it in that colour at full
 * brightness — the shape of the sound is the first thing seen. Its name sits on a brighter strip along the top.
 * A quiet recording is drawn taller than it is (up to four times) so its shape is never a thin line; the clip's own
 * level and fades still show. Selected, it is brighter, outlined in white and shows its handles; a waiting take is faint.
 */
function drawClip(g: CanvasRenderingContext2D, c: Clip, color: string, ti: number, th: number, pps: number, scroll: number, w: number, selected: boolean) {
  const x0 = (c.start - scroll) * pps, x1 = (c.start + c.dur - scroll) * pps;
  if (x1 < 0 || x0 > w) return;
  const y = ti * th + 6, h = th - 13;
  const a = Math.max(-8, x0), b = Math.min(w + 8, x1);
  const R = Math.min(7, Math.max(2, (b - a) / 2));
  const head = 18;
  g.save();
  g.globalAlpha = c.muted ? 0.4 : 1;
  g.beginPath();
  g.roundRect(a, y, Math.max(3, b - a), h, R);
  g.fillStyle = mix(color, LANE, selected ? 0.4 : 0.27);
  g.fill();
  g.clip();
  g.fillStyle = mix(color, LANE, selected ? 0.72 : 0.5);
  g.fillRect(a, y, Math.max(3, b - a), head);
  const s = getSound(c.assetId);
  if (s) {
    // drawn in the screen's own pixels (sharp on a dense display), every column the exact extremes of its samples,
    // scaled by the clip's level and fades
    const dpr = g.getTransform().a;
    const peak = peakOf(s.peaks);
    const gain = 10 ** (c.gain / 20) * (peak > 0 ? Math.min(4, Math.max(1, 0.92 / peak)) : 1);
    const end = c.offset + c.dur;
    const level = (t: number) => {
      let k = gain;
      if (c.fadeIn > 0 && t - c.offset < c.fadeIn) k *= Math.max(0, (t - c.offset) / c.fadeIn);
      if (c.fadeOut > 0 && end - t < c.fadeOut) k *= Math.max(0, (end - t) / c.fadeOut);
      return k;
    };
    const rows = s.channels.length;
    const top0 = y + head + 1, rowH = (h - head - 3) / rows;
    const left = Math.max(0, a), right = Math.min(w, b);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let row = 0; row < rows; row++) {
      // a stereo clip shows its two channels, one over the other
      g.fillStyle = g.strokeStyle = selected ? mix(color, "#ffffff", 0.82) : color;
      drawWave(g, s.peaks, s.channels, row, SR, { x: left * dpr, y: (top0 + rowH * row) * dpr, w: (right - left) * dpr, h: rowH * dpr }, c.offset + (left - x0) / pps, pps * dpr, level);
      if (row < rows - 1) {
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.fillRect(left * dpr, Math.round((top0 + rowH * (row + 1)) * dpr), (right - left) * dpr, 1);
      }
    }
    g.restore();
  }
  // fades: the wave already follows them; a light line shows the slope
  g.strokeStyle = "rgba(255,255,255,0.6)";
  g.lineWidth = 1.2;
  if (c.fadeIn > 0) {
    g.beginPath();
    g.moveTo(x0, y + h);
    g.lineTo(x0 + c.fadeIn * pps, y + head);
    g.stroke();
  }
  if (c.fadeOut > 0) {
    g.beginPath();
    g.moveTo(x1 - c.fadeOut * pps, y + head);
    g.lineTo(x1, y + h);
    g.stroke();
  }
  if (b - a > 36) {
    g.fillStyle = "rgba(255,255,255,0.94)";
    g.font = "600 11px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.direction = "rtl";
    g.textAlign = "left";
    g.fillText(`${c.take ? "◈ " : ""}${c.name}`, Math.max(a, 0) + 8, y + 10, b - Math.max(a, 0) - 16);
    g.direction = "ltr";
    if (selected) {
      // the fade handles at the top corners, and a grip on each edge for trimming
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x0 + c.fadeIn * pps + 7, y + 9, 3.5, 0, 7);
      g.arc(x1 - c.fadeOut * pps - 7, y + 9, 3.5, 0, 7);
      g.fill();
      const gh = Math.max(10, (h - head) * 0.42), gy = y + head + (h - head - gh) / 2;
      g.beginPath();
      g.roundRect(x0 + 4, gy, 3, gh, 1.5);
      g.roundRect(x1 - 7, gy, 3, gh, 1.5);
      g.fill();
    }
  }
  g.restore();
  // a hairline in the track's colour keeps neighbouring clips apart; white when selected
  g.strokeStyle = selected ? "#ffffff" : hexA(color, c.muted ? 0.35 : 0.85);
  g.lineWidth = selected ? 2 : 1;
  g.beginPath();
  const o = selected ? 1 : 0.5;
  g.roundRect(a + o, y + o, Math.max(3, b - a) - o * 2, h - o * 2, R);
  g.stroke();
}

/** The lanes' own dark, which a clip's tint is mixed into. */
const LANE = "#15161a";

/** Colour `a` mixed into colour `b`: `k` = 1 is all `a`. */
function mix(a: string, b: string, k: number) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((x >> sh) & 255) * k + ((y >> sh) & 255) * (1 - k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
