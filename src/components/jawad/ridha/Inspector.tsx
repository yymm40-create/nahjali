"use client";

// «الرضا فويس» — the inspector: everything about the SELECTED track in one column beside the track list, in
// sections that fold — its channels (mono or stereo), level and place, where it is routed, its insert effects, its
// sends and its equalizer. (The lower zone has the full panels; this is the track at a glance, as in Cubase.)

import { CHAIN_PRESETS } from "@config/ridha";
import { FX_ORDER, FX_SPECS, TRACK_COLORS, type FxKind } from "@/lib/ridha/model";
import { addFx, addGroup, armTrack, patchFx, patchTrack, removeFx, setChain, setGroup } from "@/lib/ridha/ops";
import { useStudio } from "./ctx";
import { Seg, Slider } from "./ui";

export default function Inspector() {
  const st = useStudio();
  const { project: p, store } = st;
  const master = st.selTrack === "master";
  const t = master ? null : st.track;
  const where = master ? "master" : t?.id ?? "";
  const fx = master ? p.master.fx : t?.fx ?? [];
  const groups = p.tracks.filter((x) => x.kind === "group");
  if (!master && !t) return <aside className="rv-insp" />;

  const set = (patch: Parameters<typeof patchTrack>[2], merge?: string) => t && store.set((q) => patchTrack(q, t.id, patch), merge ? { merge: `${merge}${t.id}` } : {});

  return (
    <aside className="rv-insp" aria-label="الإنسبكتور">
      <div className="rv-insp-head" style={{ ["--c" as string]: master ? "#e0b040" : t!.color }}>
        {master ? <b>الماستر</b> : <input value={t!.name} onChange={(e) => set({ name: e.target.value }, "n")} aria-label="اسم المسار" />}
        <span>{master ? "المجموع" : t!.kind === "group" ? "قروب" : t!.stereo === false ? "مونو" : "ستيريو"}</span>
      </div>

      {t ? (
        <details open className="rv-insp-sec">
          <summary>المسار</summary>
          {t.kind === "group" ? (
            <p className="rv-muted">قروب: {p.tracks.filter((x) => x.group === t.id).length} مسارات تمر منه. مؤثراته وفيدره تشكّلها كلها.</p>
          ) : null}
          <label className="rv-insp-row">
            <span>القنوات</span>
            <Seg small value={t.stereo === false ? "mono" : "stereo"} options={[{ value: "mono", label: "مونو", title: "قناة واحدة: للصوت البشري — يُجمع يمينه ويساره ويُوضع بالبان" }, { value: "stereo", label: "ستيريو", title: "قناتان: للموسيقى والتسجيل الستيريو" }]} onChange={(v) => set({ stereo: v === "stereo" })} />
          </label>
          {t.kind !== "group" ? (
            <label className="rv-insp-row">
              <span>التسجيل</span>
              <button type="button" className={`rv-tb r${t.arm ? " on" : ""}`} onClick={() => store.set((q) => armTrack(q, t.id), { undo: false })} title="جاهز للتسجيل: يسجّل هنا والمسارات الثانية تشتغل">●</button>
              <i className="rv-muted">{t.arm ? `يسجّل ${t.stereo === false ? "مونو" : "ستيريو"}` : "غير جاهز"}</i>
            </label>
          ) : null}
          <Slider label="المستوى" value={t.gain} min={-60} max={6} step={0.1} unit="dB" def={0} onChange={(v) => set({ gain: v }, "g")} />
          {t.space.on ? (
            <>
              <Slider label="حول المستمع" value={t.space.az} min={-180} max={180} step={1} unit="°" def={0} onChange={(v) => set({ space: { ...t.space, az: v } }, "az")} />
              <Slider label="فوق الرأس" value={t.space.el} min={-40} max={80} step={1} unit="°" def={0} onChange={(v) => set({ space: { ...t.space, el: v } }, "el")} />
              <Slider label="البعد" value={t.space.dist} min={0.6} max={5} step={0.1} unit="m" def={1.5} onChange={(v) => set({ space: { ...t.space, dist: v } }, "ds")} />
            </>
          ) : (
            <Slider label={t.pan === 0 ? "البان: وسط" : t.pan < 0 ? "البان: يسار" : "البان: يمين"} value={t.pan} min={-1} max={1} step={0.02} def={0} onChange={(v) => set({ pan: Math.abs(v) < 0.04 ? 0 : v }, "p")} />
          )}
          <label className="rv-insp-row">
            <span>المكان</span>
            <Seg small value={t.space.on ? "3d" : "pan"} options={[{ value: "pan", label: "يمين/يسار" }, { value: "3d", label: "3D", title: "حول المستمع في الفراغ (بالسماعات)" }]} onChange={(v) => set({ space: { ...t.space, on: v === "3d" } })} />
          </label>
          {t.kind !== "group" ? (
            <label className="rv-insp-row">
              <span>الخرج</span>
              <select value={t.group ?? ""} onChange={(e) => store.set((q) => (e.target.value === "+" ? addGroup(q, [t.id]).project : setGroup(q, t.id, e.target.value || null)))}>
                <option value="">الماستر</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                <option value="+">＋ قروب جديد</option>
              </select>
            </label>
          ) : null}
          <label className="rv-insp-row">
            <span>اللون</span>
            <span className="rv-swatches">
              {TRACK_COLORS.map((c) => <button key={c} type="button" className={t.color === c ? "on" : ""} style={{ background: c }} onClick={() => set({ color: c })} aria-label={`لون ${c}`} />)}
            </span>
          </label>
        </details>
      ) : null}

      <details open className="rv-insp-sec">
        <summary>المؤثرات (Inserts)</summary>
        {fx.map((f) => (
          <div key={f.id} className={`rv-slot${f.on ? "" : " off"}`}>
            <button type="button" className={`rv-power${f.on ? " on" : ""}`} onClick={() => store.set((q) => patchFx(q, where, f.id, { on: !f.on }))} aria-label="تشغيل المؤثر" />
            <button type="button" className="rv-slot-name" onClick={() => st.openPanel(f.kind === "eq" ? "eq" : "fx")}>{FX_SPECS[f.kind].name}</button>
            <button type="button" className="rv-mini" onClick={() => store.set((q) => removeFx(q, where, f.id))} title="حذف">✕</button>
          </div>
        ))}
        <select className="rv-slot-add" value="" onChange={(e) => e.target.value && store.set((q) => addFx(q, where, e.target.value as FxKind).project)} aria-label="أضف مؤثرًا">
          <option value="">＋ مؤثر…</option>
          {FX_ORDER.map((k) => <option key={k} value={k}>{FX_SPECS[k].name}</option>)}
        </select>
        {!master ? (
          <select className="rv-slot-add" value="" onChange={(e) => {
            const c = CHAIN_PRESETS.find((x) => x.id === e.target.value);
            if (c) store.set((q) => setChain(q, where, c.build(), c.sends));
          }} aria-label="سلسلة جاهزة">
            <option value="">سلسلة جاهزة…</option>
            {CHAIN_PRESETS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : null}
      </details>

      {t ? (
        <details open className="rv-insp-sec">
          <summary>الإرسال (Sends)</summary>
          <Slider label="ريفيرب مشترك" value={t.sendReverb} min={0} max={1} def={0} onChange={(v) => set({ sendReverb: v }, "sr")} />
          <Slider label="صدى مشترك" value={t.sendDelay} min={0} max={1} def={0} onChange={(v) => set({ sendDelay: v }, "sd")} />
        </details>
      ) : (
        <details open className="rv-insp-sec">
          <summary>الخرج</summary>
          <Slider label="مستوى الماستر" value={p.master.gain} min={-40} max={6} step={0.1} unit="dB" def={0} onChange={(v) => store.set((q) => ({ ...q, master: { ...q.master, gain: v } }), { merge: "mg" })} />
        </details>
      )}
    </aside>
  );
}
