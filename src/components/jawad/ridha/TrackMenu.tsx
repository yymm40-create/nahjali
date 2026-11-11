"use client";

// «الرضا فويس» — a track's settings, opened from the «⋯» on its header: what is set once and then left alone
// (channels, place, output, colour, order) lives here, so the header itself stays to the few controls that are
// touched all the time — name, mute, solo, record, level, effects.

import { useEffect, useRef } from "react";
import { TRACK_COLORS, type Track } from "@/lib/ridha/model";
import { addGroup, moveTrack, patchTrack, removeTrack, setGroup } from "@/lib/ridha/ops";
import { useStudio } from "./ctx";
import { Seg, Slider } from "./ui";

export default function TrackMenu({ track: t, at, onClose }: { track: Track; at: { x: number; y: number }; onClose(): void }) {
  const st = useStudio();
  const { project: p, store } = st;
  const box = useRef<HTMLDivElement>(null);
  const groups = p.tracks.filter((x) => x.kind === "group");
  const i = p.tracks.findIndex((x) => x.id === t.id);
  const set = (patch: Partial<Track>, merge?: string) => store.set((q) => patchTrack(q, t.id, patch), merge ? { merge: `${merge}${t.id}` } : {});

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const lone = t.kind !== "group" && p.tracks.filter((x) => x.kind !== "group").length <= 1;
  return (
    <div ref={box} className="rv-pop rv-trackmenu" style={{ left: at.x, top: Math.min(at.y, window.innerHeight - 430) }} dir="rtl" role="dialog" aria-label={`إعدادات ${t.name}`}>
      <b className="rv-pop-title">{t.kind === "group" ? "قروب" : "مسار"}: {t.name}</b>
      <label className="rv-pop-row">
        <span>القنوات</span>
        <Seg small value={t.stereo === false ? "mono" : "stereo"} options={[{ value: "mono", label: "مونو", title: "قناة واحدة: للصوت البشري" }, { value: "stereo", label: "ستيريو", title: "قناتان: للموسيقى والتسجيل الستيريو" }]} onChange={(v) => set({ stereo: v === "stereo" })} />
      </label>
      <label className="rv-pop-row">
        <span>المكان</span>
        <Seg small value={t.space.on ? "3d" : "pan"} options={[{ value: "pan", label: "يمين / يسار" }, { value: "3d", label: "3D", title: "حول المستمع في الفراغ (بالسماعات)" }]} onChange={(v) => set({ space: { ...t.space, on: v === "3d" } })} />
      </label>
      {t.space.on ? (
        <>
          <Slider label="حول المستمع" value={t.space.az} min={-180} max={180} step={1} unit="°" def={0} onChange={(v) => set({ space: { ...t.space, az: v } }, "az")} />
          <Slider label="فوق الرأس" value={t.space.el} min={-40} max={80} step={1} unit="°" def={0} onChange={(v) => set({ space: { ...t.space, el: v } }, "el")} />
          <Slider label="البعد" value={t.space.dist} min={0.6} max={5} step={0.1} unit="m" def={1.5} onChange={(v) => set({ space: { ...t.space, dist: v } }, "ds")} />
        </>
      ) : (
        <Slider label={t.pan === 0 ? "وسط" : t.pan < 0 ? "يسار" : "يمين"} value={t.pan} min={-1} max={1} step={0.02} def={0} onChange={(v) => set({ pan: Math.abs(v) < 0.04 ? 0 : v }, "p")} />
      )}
      <Slider label="إرسال للريفيرب" value={t.sendReverb} min={0} max={1} def={0} onChange={(v) => set({ sendReverb: v }, "sr")} />
      <Slider label="إرسال للصدى" value={t.sendDelay} min={0} max={1} def={0} onChange={(v) => set({ sendDelay: v }, "sd")} />
      {t.kind !== "group" ? (
        <label className="rv-pop-row">
          <span>القروب</span>
          <select value={t.group ?? ""} onChange={(e) => store.set((q) => (e.target.value === "+" ? addGroup(q, [t.id]).project : setGroup(q, t.id, e.target.value || null)))}>
            <option value="">بدون قروب</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value="+">＋ قروب جديد لهذا المسار</option>
          </select>
        </label>
      ) : null}
      <label className="rv-pop-row">
        <span>اللون</span>
        <span className="rv-swatches">
          {TRACK_COLORS.map((c) => <button key={c} type="button" className={t.color === c ? "on" : ""} style={{ background: c }} onClick={() => set({ color: c })} aria-label={`لون ${c}`} />)}
        </span>
      </label>
      <div className="rv-pop-actions">
        <button type="button" disabled={i === 0} onClick={() => store.set((q) => moveTrack(q, t.id, -1))}>▲ للأعلى</button>
        <button type="button" disabled={i === p.tracks.length - 1} onClick={() => store.set((q) => moveTrack(q, t.id, 1))}>▼ للأسفل</button>
        <button type="button" className="danger" disabled={lone} onClick={() => {
          if (p.clips.some((c) => c.trackId === t.id) && !window.confirm("حذف المسار مع كل مقاطعه؟")) return;
          store.set((q) => removeTrack(q, t.id));
          onClose();
        }}>{t.kind === "group" ? "حذف القروب" : "حذف المسار"}</button>
      </div>
    </div>
  );
}
