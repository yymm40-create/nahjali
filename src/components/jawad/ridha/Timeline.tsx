"use client";

// «الرضا فويس» — the project's middle: the track list (name, mute, solo, record, mono/stereo, a level meter) and
// the event display drawn on one canvas, under a ruler in bars and time. Time runs left to right (as on every
// mixing desk), whatever the page's direction. With the arrow tool, events are dragged, trimmed from their edges and
// faded from their top corners; the scissors cut where they are pressed, the eraser deletes, the mute tool silences.
// The ruler seeks and draws the cycle.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { addGroup, armTrack, addTrack, deleteClips, moveClip, moveTrack, patchClip, patchTrack, removeTrack, setFades, setGroup, splitClip, trimClip } from "@/lib/ridha/ops";
import { barSec, beatSec, clockLabel, projectEnd, snapTime, SR, type Clip, type Project } from "@/lib/ridha/model";
import { getSound, soundDur } from "./engine";
import { useStudio } from "./ctx";
import { meterPos } from "./ui";

export const TRACK_H = 60;
const EDGE = 6;

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

export default function Timeline({ onImport, recStart, apiRef, tool }: { onImport(files: File[], trackId: string | null, at: number): void; recStart: number | null; apiRef: React.MutableRefObject<TimelineApi | null>; tool: Tool }) {
  const st = useStudio();
  const { project: p, engine, store } = st;
  const [pps, setPps] = useState(70);
  const [scroll, setScroll] = useState(0);
  const [width, setWidth] = useState(800);
  const lanes = useRef<HTMLCanvasElement>(null);
  const ruler = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const rhead = useRef<HTMLDivElement>(null);
  const recBox = useRef<HTMLDivElement>(null);
  const hbar = useRef<HTMLDivElement>(null);
  const heads = useRef<HTMLDivElement>(null);
  const view = useRef({ pps, scroll, width });
  const pRef = useRef(p);
  // handlers and the frame loop read the latest view and project from here
  useLayoutEffect(() => {
    view.current = { pps, scroll, width };
    pRef.current = p;
  });

  const groups = p.tracks.filter((t) => t.kind === "group");
  const total = Math.max(projectEnd(p) + 20, (width / pps) * 1.5, 60);
  const height = Math.max(p.tracks.length * TRACK_H + 60, 160);
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
    const next = Math.max(6, Math.min(1600, v.pps * factor));
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
      g.fillStyle = t.id === st.selTrack ? "#33363c" : t.kind === "group" ? "#2e2f2c" : i % 2 ? "#292b2f" : "#2c2e32";
      g.fillRect(0, i * TRACK_H, width, TRACK_H - 1);
      g.fillStyle = "#1b1c1f";
      g.fillRect(0, (i + 1) * TRACK_H - 1, width, 1);
      if (t.kind === "group") {
        // a group holds no events: its lane says what it does
        g.fillStyle = "rgba(224,176,64,0.7)";
        g.font = "11px system-ui, sans-serif";
        g.textBaseline = "middle";
        g.direction = "rtl";
        g.textAlign = "left";
        const n = p.tracks.filter((x) => x.group === t.id).length;
        g.fillText(n ? `قروب — ${n} مسارات تمر من هنا؛ مؤثراته وفيدره عليها كلها` : "قروب فاضي — أدخل المسارات فيه من «الخرج» في الإنسبكتور", 12, i * TRACK_H + TRACK_H / 2);
        g.direction = "ltr";
      }
    });
    drawGrid(g, p, pps, scroll, width, p.tracks.length * TRACK_H);
    if (p.loop.on) {
      const a = (p.loop.start - scroll) * pps, b = (p.loop.end - scroll) * pps;
      g.fillStyle = "rgba(122,134,255,0.07)";
      g.fillRect(a, 0, b - a, height);
    }
    // waiting takes first (underneath), then what plays, then what is selected
    const order = [...p.clips].sort((a, b) => Number(b.muted) - Number(a.muted) || Number(st.selClips.includes(a.id)) - Number(st.selClips.includes(b.id)));
    for (const clip of order) {
      const ti = p.tracks.findIndex((t) => t.id === clip.trackId);
      if (ti < 0) continue;
      drawClip(g, clip, p.tracks[ti].color, ti, pps, scroll, width, st.selClips.includes(clip.id));
    }
    for (const m of p.markers) {
      g.fillStyle = "rgba(224,176,64,0.55)";
      g.fillRect((m.time - scroll) * pps, 0, 1, height);
    }
  }, [p, pps, scroll, width, height, st.selClips, st.selTrack]);

  useEffect(() => {
    const c = ruler.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(26 * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, 26);
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
          rb.style.top = `${Math.max(0, ti) * TRACK_H + 1}px`;
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

  const hit = useCallback((x: number, y: number): Hit | null => {
    const q = pRef.current;
    const ti = Math.floor(y / TRACK_H);
    const track = q.tracks[ti];
    if (!track) return null;
    const inTrack = q.clips.filter((c) => c.trackId === track.id).sort((a, b) => Number(a.muted) - Number(b.muted));
    for (const clip of inTrack) {
      const a = X(clip.start), b = X(clip.start + clip.dur);
      if (x < a - 2 || x > b + 2) continue;
      const top = y - ti * TRACK_H < 16;
      const wide = b - a > 30;
      if (top && wide && x < a + Math.max(12, clip.fadeIn * view.current.pps + 7)) return { clip, zone: "fadeIn" };
      if (top && wide && x > b - Math.max(12, clip.fadeOut * view.current.pps + 7)) return { clip, zone: "fadeOut" };
      if (x < a + EDGE && wide) return { clip, zone: "left" };
      if (x > b - EDGE && wide) return { clip, zone: "right" };
      return { clip, zone: "body" };
    }
    return null;
  }, [X]);

  const onLaneDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x0 = e.clientX - r.left, y0 = e.clientY - r.top;
    const h = hit(x0, y0);
    const track = p.tracks[Math.floor(y0 / TRACK_H)];
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
    let moved = false;
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
          const dTrack = Math.round(dy / TRACK_H);
          let out = q;
          for (const [id, c] of starts) {
            const ti = base.tracks.findIndex((tr) => tr.id === c.trackId);
            const target = base.tracks[Math.max(0, Math.min(base.tracks.length - 1, ti + dTrack))];
            out = moveClip(out, id, c.start + delta, target?.kind === "group" ? c.trackId : target?.id);
          }
          return out;
        }, { merge: gesture });
      };
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        if (!moved && !many) st.select([h.clip.id], h.clip.trackId);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      return;
    }
    // empty lane: a press seeks and selects the track; a drag slides the view
    const s0 = view.current.scroll;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - r.left - x0;
      if (!moved && Math.abs(dx) < 5) return;
      moved = true;
      setScroll(Math.max(0, s0 - dx / view.current.pps));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      if (!moved) {
        st.select([], track?.id ?? st.selTrack);
        engine.seek(snapTime(pRef.current, Tm(x0), view.current.pps));
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
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
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      if (!moved) engine.seek(t0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

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
    e.preventDefault();
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("audio/") || f.type.startsWith("video/") || /\.(wav|mp3|m4a|aac|ogg|flac|opus|webm|mp4|mov)$/i.test(f.name));
    if (!files.length) return;
    const r = lanes.current!.getBoundingClientRect();
    const track = p.tracks[Math.floor((e.clientY - r.top) / TRACK_H)];
    onImport(files, track && track.kind !== "group" ? track.id : null, Math.max(0, snapTime(p, Tm(e.clientX - r.left), pps)));
  };

  const confirmDelete = (id: string) => !p.clips.some((c) => c.trackId === id) || window.confirm("حذف المسار مع كل مقاطعه؟");
  const tb = (cls: string, on: boolean, label: string, title: string, onClick: () => void) => (
    <button type="button" className={`rv-tb ${cls}${on ? " on" : ""}`} title={title} onClick={onClick}>{label}</button>
  );

  return (
    <div className="rv-tl" dir="ltr">
      <div className="rv-tl-corner" dir="rtl">
        <button type="button" className="rv-chip" onClick={() => store.set((q) => addTrack(q, undefined, { stereo: false }).project)} title="مسار صوت مونو جديد (غيّره لستيريو من زر ○)">＋ مسار</button>
        <button type="button" className="rv-chip" onClick={() => store.set((q) => {
          // the selected track and the tracks of the selected events go into the new group
          const members = [...new Set([st.selTrack, ...q.clips.filter((c) => st.selClips.includes(c.id)).map((c) => c.trackId)])];
          const made = addGroup(q, members);
          st.select(st.selClips, made.track.id);
          return made.project;
        })} title="قروب: مسار تمر منه مسارات أخرى، فتأخذ كلها مؤثراته وفيدره">＋ قروب</button>
        <span className="rv-tl-zoom" dir="ltr">
          <button type="button" onClick={() => zoomAt(1 / 1.4)} title="تصغير (G)">−</button>
          <button type="button" onClick={fit} title="كل المشروع في الشاشة">⤢</button>
          <button type="button" onClick={() => zoomAt(1.4)} title="تكبير (H)">＋</button>
        </span>
      </div>
      <div className="rv-tl-rulerwrap">
        <canvas ref={ruler} className="rv-tl-ruler" style={{ width, height: 26 }} onPointerDown={onRulerDown} onDoubleClick={() => store.set((q) => ({ ...q, loop: { ...q.loop, on: !q.loop.on } }), { undo: false })} />
        <div ref={rhead} className="rv-playhead-top" />
      </div>
      <div className="rv-tl-body">
        <div className="rv-tl-heads" dir="rtl" ref={heads}>
          {p.tracks.map((t, i) => (
            <div key={t.id} className={`rv-th${t.id === st.selTrack ? " sel" : ""}${t.kind === "group" ? " group" : ""}${t.group ? " child" : ""}`} style={{ height: TRACK_H, ["--c" as string]: t.color }} onPointerDown={() => st.select(st.selClips, t.id)}>
              <span className="rv-th-color" />
              <div className="rv-th-main">
                <div className="rv-th-row">
                  <span className="rv-th-num">{t.kind === "group" ? "▾" : i + 1}</span>
                  <input className="rv-th-name" value={t.name} onChange={(e) => store.set((q) => patchTrack(q, t.id, { name: e.target.value }), { merge: `n${t.id}` })} aria-label="اسم المسار" />
                  <span className="rv-th-tools">
                    {t.kind === "group" ? null : t.group ? (
                      <button type="button" onClick={() => store.set((q) => setGroup(q, t.id, null))} title="أخرجه من القروب">⤴</button>
                    ) : groups.length ? (
                      <button type="button" onClick={() => store.set((q) => setGroup(q, t.id, nearestGroup(q, t.id)))} title="أدخله في القروب">⤵</button>
                    ) : null}
                    <button type="button" onClick={() => store.set((q) => moveTrack(q, t.id, -1))} disabled={i === 0} title="للأعلى">▲</button>
                    <button type="button" onClick={() => store.set((q) => moveTrack(q, t.id, 1))} disabled={i === p.tracks.length - 1} title="للأسفل">▼</button>
                    <button type="button" onClick={() => (confirmDelete(t.id) ? store.set((q) => removeTrack(q, t.id)) : null)} disabled={t.kind !== "group" && p.tracks.filter((x) => x.kind !== "group").length <= 1} title={t.kind === "group" ? "حذف القروب (مساراته تبقى)" : "حذف المسار"}>✕</button>
                  </span>
                </div>
                <div className="rv-th-row rv-th-btns" dir="ltr">
                  {tb("m", t.mute, "M", "كتم", () => store.set((q) => patchTrack(q, t.id, { mute: !t.mute })))}
                  {tb("s", t.solo, "S", "منفرد", () => store.set((q) => patchTrack(q, t.id, { solo: !t.solo })))}
                  {t.kind === "group" ? null : tb("r", t.arm, "●", "جاهز للتسجيل: يسجّل هنا والمسارات الثانية تشتغل", () => store.set((q) => armTrack(q, t.id), { undo: false }))}
                  {tb("w", t.stereo !== false, t.stereo === false ? "○" : "◎", t.stereo === false ? "مونو — اضغط ليصير ستيريو" : "ستيريو — اضغط ليصير مونو", () => store.set((q) => patchTrack(q, t.id, { stereo: t.stereo === false })))}
                  {tb("e", false, "e", "إعدادات القناة: المؤثرات والإكولايزر", () => {
                    st.select(st.selClips, t.id);
                    st.openPanel("fx");
                  })}
                  <input className="rv-th-gain" type="range" min={-40} max={6} step={0.5} value={Math.max(-40, t.gain)} onChange={(e) => store.set((q) => patchTrack(q, t.id, { gain: Number(e.target.value) }), { merge: `g${t.id}` })} onDoubleClick={() => store.set((q) => patchTrack(q, t.id, { gain: 0 }))} title={`المستوى ${t.gain.toFixed(1)} dB`} aria-label="مستوى المسار" />
                </div>
              </div>
              <span className="rv-th-meter"><i data-m={t.id} data-arm={t.arm ? "1" : undefined} /></span>
            </div>
          ))}
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
          <div ref={recBox} className="rv-recbox" style={{ height: TRACK_H - 3 }} />
          <div ref={head} className="rv-playhead" style={{ height }} />
          {!p.clips.length ? (
            <div className="rv-tl-hint" dir="rtl">
              <b>المشروع فاضي</b>
              <span>اضغط ● في شريط النقل تحت للتسجيل على المسار الجاهز، أو اسحب ملف صوت وأفلته هنا</span>
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
    </div>
  );
}

/** The group a track joins from its header button: the nearest one above it, else the first. */
function nearestGroup(p: Project, id: string): string | null {
  const i = p.tracks.findIndex((t) => t.id === id);
  for (let k = i - 1; k >= 0; k--) if (p.tracks[k].kind === "group") return p.tracks[k].id;
  return p.tracks.find((t) => t.kind === "group")?.id ?? null;
}

function gridStep(p: Project, pps: number): { minor: number; major: number } {
  const beat = beatSec(p), bar = barSec(p);
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
    g.fillStyle = isMajor ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.2)";
    g.fillRect(x, 0, 1, h);
  }
}

function drawRuler(g: CanvasRenderingContext2D, p: Project, pps: number, scroll: number, w: number) {
  const { minor, major } = gridStep(p, pps);
  const bar = barSec(p);
  if (p.loop.end > p.loop.start) {
    // the cycle: the stretch between the left and right locators
    const a = (p.loop.start - scroll) * pps, b = (p.loop.end - scroll) * pps;
    g.fillStyle = p.loop.on ? "rgba(122,134,255,0.55)" : "rgba(122,134,255,0.18)";
    g.fillRect(a, 0, b - a, 26);
  }
  g.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  g.textBaseline = "top";
  const from = Math.floor(scroll / minor) * minor;
  for (let t = from; (t - scroll) * pps < w; t += minor) {
    const x = Math.round((t - scroll) * pps);
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    g.fillStyle = isMajor ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)";
    g.fillRect(x, isMajor ? 0 : 19, 1, 26);
    if (isMajor) {
      g.fillStyle = "#d5d8dd";
      g.fillText(String(Math.round(t / bar) + 1), x + 4, 3);
      g.fillStyle = "rgba(160,166,175,0.75)";
      g.fillText(clockLabel(t, false), x + 4, 14);
    }
  }
  for (const m of p.markers) {
    const x = (m.time - scroll) * pps;
    g.fillStyle = "#e0b040";
    g.fillRect(x, 0, 2, 26);
    g.fillRect(x, 0, 7, 7);
  }
}

/** An event, as the program draws it: a flat block in its track's colour, the wave dark on it; selected, it turns dark with the wave in colour. */
function drawClip(g: CanvasRenderingContext2D, c: Clip, color: string, ti: number, pps: number, scroll: number, w: number, selected: boolean) {
  const x0 = (c.start - scroll) * pps, x1 = (c.start + c.dur - scroll) * pps;
  if (x1 < 0 || x0 > w) return;
  const y = ti * TRACK_H + 1, h = TRACK_H - 3;
  const a = Math.max(-2, x0), b = Math.min(w + 2, x1);
  g.save();
  g.globalAlpha = c.muted ? 0.32 : 1;
  g.beginPath();
  g.rect(a, y, Math.max(2, b - a), h);
  g.fillStyle = selected ? "#15171a" : hexA(color, 0.78);
  g.fill();
  g.clip();
  const s = getSound(c.assetId);
  if (s) {
    const stereo = s.channels.length > 1;
    const gain = 10 ** (c.gain / 20);
    g.fillStyle = selected ? color : "rgba(10,12,15,0.72)";
    const spp = SR / pps;
    // a stereo event shows its two channels, one over the other
    const rows = stereo ? 2 : 1;
    const top0 = y + 13, rowH = (h - 13) / rows;
    for (let row = 0; row < rows; row++) {
      const ch = s.channels[row];
      const mid = top0 + rowH * row + rowH / 2, amp = rowH / 2 - 1;
      for (let x = Math.max(0, Math.floor(a)); x < Math.min(w, b); x++) {
        const t = (x - x0) / pps + c.offset;
        let lo = 0, hi = 0;
        if (stereo || spp < s.peaks.block) {
          const i0 = Math.floor(t * SR), i1 = Math.min(ch.length, Math.ceil(i0 + spp) + 1);
          const step = Math.max(1, Math.floor((i1 - i0) / 64));
          lo = 1;
          hi = -1;
          for (let i = Math.max(0, i0); i < i1; i += step) {
            if (ch[i] < lo) lo = ch[i];
            if (ch[i] > hi) hi = ch[i];
          }
          if (lo > hi) lo = hi = 0;
        } else {
          const b0 = Math.floor((t * SR) / s.peaks.block), b1 = Math.min(s.peaks.min.length, Math.ceil((t * SR + spp) / s.peaks.block));
          for (let i = Math.max(0, b0); i < b1; i++) {
            if (s.peaks.min[i] < lo) lo = s.peaks.min[i];
            if (s.peaks.max[i] > hi) hi = s.peaks.max[i];
          }
        }
        const topY = mid - Math.min(1, hi * gain) * amp, bot = mid - Math.max(-1, lo * gain) * amp;
        g.fillRect(x, topY, 1, Math.max(1, bot - topY));
      }
      if (row === 0 && stereo) {
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(a, top0 + rowH, b - a, 1);
        g.fillStyle = selected ? color : "rgba(10,12,15,0.72)";
      }
    }
  }
  // fades, drawn as the darkened corners they silence
  g.fillStyle = "rgba(0,0,0,0.5)";
  if (c.fadeIn > 0) {
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x0 + c.fadeIn * pps, y);
    g.lineTo(x0, y + h);
    g.closePath();
    g.fill();
  }
  if (c.fadeOut > 0) {
    g.beginPath();
    g.moveTo(x1, y);
    g.lineTo(x1 - c.fadeOut * pps, y);
    g.lineTo(x1, y + h);
    g.closePath();
    g.fill();
  }
  if (b - a > 34) {
    g.fillStyle = selected ? hexA(color, 0.9) : "rgba(0,0,0,0.32)";
    g.fillRect(a, y, b - a, 12);
    g.fillStyle = selected ? "#0c0e11" : "#f2f4f7";
    g.font = "10.5px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.direction = "rtl";
    g.textAlign = "left";
    g.fillText(`${c.take ? "◈ " : ""}${c.name}`, Math.max(a, 0) + 5, y + 6.5, b - Math.max(a, 0) - 10);
    if (selected) {
      // the fade handles at the top corners
      g.fillStyle = "#ffffff";
      g.fillRect(x0 + c.fadeIn * pps + 1, y + 1, 5, 5);
      g.fillRect(x1 - c.fadeOut * pps - 6, y + 1, 5, 5);
    }
  }
  g.restore();
  g.strokeStyle = selected ? "#ffffff" : "rgba(0,0,0,0.55)";
  g.lineWidth = 1;
  g.strokeRect(Math.round(a) + 0.5, y + 0.5, Math.max(2, Math.round(b - a) - 1), h - 1);
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
