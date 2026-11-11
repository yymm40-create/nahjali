"use client";

// «الرضا فويس» — the mixing desk: a strip per track (fader, pan or 3D, sends, mute and solo, its meter), the two
// shared effect returns, and the master with its loudness reading.

import { useEffect, useRef } from "react";
import { FX_SPECS } from "@/lib/ridha/model";
import { addGroup, patchTrack, setGroup } from "@/lib/ridha/ops";
import { useStudio } from "../ctx";
import { Fader, meterPos, Slider } from "../ui";

export default function MixerPanel() {
  const st = useStudio();
  const { project: p, store, engine } = st;
  const root = useRef<HTMLDivElement>(null);
  const lufs = useRef<HTMLElement>(null);
  const peakHold = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    let hold = 0, holdAt = 0, frame = 0;
    const tick = () => {
      const [l, r] = engine.masterPeaks();
      for (const el of root.current?.querySelectorAll<HTMLElement>("[data-m]") ?? []) {
        const id = el.dataset.m!;
        const peak = id === "__L" ? l : id === "__R" ? r : engine.trackPeak(id);
        const prev = Number(el.dataset.v || 0);
        const now = Math.max(meterPos(peak), prev - 0.025);
        el.dataset.v = String(now);
        el.style.transform = `scaleY(${now})`;
        el.classList.toggle("hot", peak > 0.98);
      }
      const top = Math.max(l, r);
      if (top > hold || performance.now() - holdAt > 2500) {
        hold = top;
        holdAt = performance.now();
        if (peakHold.current) {
          peakHold.current.textContent = top > 0.0005 ? `${(20 * Math.log10(top)).toFixed(1)} dB` : "—";
          peakHold.current.classList.toggle("hot", top > 0.98);
        }
      }
      if (frame++ % 8 === 0 && lufs.current) {
        const v = engine.shortTermLufs();
        lufs.current.textContent = Number.isFinite(v) && v > -70 ? v.toFixed(1) : "—";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const bus = (key: "reverb" | "delay", k: string, v: number) => store.set((q) => ({ ...q, [key]: { ...q[key], [k]: v } }), { merge: `bus-${key}-${k}` });

  return (
    <div className="rv-mixer" dir="ltr" ref={root}>
      {p.tracks.map((t) => (
        <div key={t.id} className={`rv-strip${t.id === st.selTrack ? " sel" : ""}${t.kind === "group" ? " rv-strip-group" : ""}${t.group ? " rv-strip-child" : ""}`} style={{ ["--c" as string]: t.color }} onPointerDown={() => st.select(st.selClips, t.id)} dir="rtl">
          <div className="rv-strip-name" title={t.name}>{t.kind === "group" ? "" : ""}{t.name}</div>
          {t.kind === "group" ? (
            <span className="rv-strip-route">{p.tracks.filter((x) => x.group === t.id).length} مسارات ← الماستر</span>
          ) : (
            <select className="rv-strip-route" value={t.group ?? ""} aria-label="وجهة المسار" title="المسار يمر من قروب (يأخذ مؤثراته) أو يروح للماستر مباشرة" onChange={(e) => store.set((q) => {
              if (e.target.value === "+") return addGroup(q, [t.id]).project;
              return setGroup(q, t.id, e.target.value || null);
            })}>
              <option value="">← الماستر</option>
              {p.tracks.filter((x) => x.kind === "group").map((gr) => <option key={gr.id} value={gr.id}>← {gr.name}</option>)}
              <option value="+">＋ قروب جديد</option>
            </select>
          )}
          <button type="button" className="rv-strip-fx" onClick={() => (st.select(st.selClips, t.id), st.openPanel("fx"))} title="مؤثرات المسار">
            {t.fx.length ? t.fx.map((f) => <i key={f.id} className={f.on ? "" : "off"}>{FX_SPECS[f.kind].name}</i>) : <span>＋ مؤثرات</span>}
          </button>
          <div className="rv-strip-sends">
            <Slider label="ريفيرب" value={t.sendReverb} min={0} max={1} def={0} onChange={(v) => store.set((q) => patchTrack(q, t.id, { sendReverb: v }), { merge: `sr${t.id}` })} />
            <Slider label="صدى" value={t.sendDelay} min={0} max={1} def={0} onChange={(v) => store.set((q) => patchTrack(q, t.id, { sendDelay: v }), { merge: `sd${t.id}` })} />
          </div>
          {t.space.on ? (
            <button type="button" className="rv-strip-3d on" onClick={() => store.set((q) => patchTrack(q, t.id, { space: { ...t.space, on: false } }))} title="موضوع في الفراغ 3D — اضغط للرجوع ليمين/يسار">{Math.round(t.space.az)}°</button>
          ) : (
            <Slider label={t.pan === 0 ? "وسط" : t.pan < 0 ? "يسار" : "يمين"} value={t.pan} min={-1} max={1} step={0.02} def={0} onChange={(v) => store.set((q) => patchTrack(q, t.id, { pan: Math.abs(v) < 0.04 ? 0 : v }), { merge: `p${t.id}` })} />
          )}
          <div className="rv-strip-body">
            <div className="rv-vmeter"><i data-m={t.id} /></div>
            <Fader value={t.gain} onChange={(v) => store.set((q) => patchTrack(q, t.id, { gain: v }), { merge: `f${t.id}` })} />
          </div>
          <div className="rv-strip-db" dir="ltr">{t.gain <= -60 ? "−∞" : `${t.gain > 0 ? "+" : ""}${t.gain.toFixed(1)}`}</div>
          <div className="rv-strip-btns">
            <button type="button" className={`rv-tb m${t.mute ? " on" : ""}`} onClick={() => store.set((q) => patchTrack(q, t.id, { mute: !t.mute }))}>M</button>
            <button type="button" className={`rv-tb s${t.solo ? " on" : ""}`} onClick={() => store.set((q) => patchTrack(q, t.id, { solo: !t.solo }))}>S</button>
          </div>
        </div>
      ))}

      <div className="rv-strip rv-strip-bus" dir="rtl">
        <div className="rv-strip-name">ريفيرب مشترك</div>
        <Slider label="طول الذيل" value={p.reverb.decay} min={0.2} max={9} step={0.05} unit="s" log def={2.4} onChange={(v) => bus("reverb", "decay", v)} />
        <Slider label="قبل الصدى" value={p.reverb.predelay} min={0} max={150} step={1} unit="ms" def={25} onChange={(v) => bus("reverb", "predelay", v)} />
        <Slider label="دفء الذيل" value={p.reverb.damp} min={800} max={16000} step={50} unit="Hz" log def={6000} onChange={(v) => bus("reverb", "damp", v)} />
        <Slider label="الرجوع" value={p.reverb.level} min={0} max={1.5} def={0.8} onChange={(v) => bus("reverb", "level", v)} />
      </div>
      <div className="rv-strip rv-strip-bus" dir="rtl">
        <div className="rv-strip-name">صدى مشترك</div>
        <Slider label="الزمن" value={p.delay.time} min={20} max={1500} step={1} unit="ms" log def={340} onChange={(v) => bus("delay", "time", v)} />
        <Slider label="التكرار" value={p.delay.feedback} min={0} max={0.92} def={0.32} onChange={(v) => bus("delay", "feedback", v)} />
        <Slider label="تعتيم" value={p.delay.damp} min={500} max={16000} step={50} unit="Hz" log def={4500} onChange={(v) => bus("delay", "damp", v)} />
        <Slider label="الرجوع" value={p.delay.level} min={0} max={1.5} def={0.7} onChange={(v) => bus("delay", "level", v)} />
      </div>

      <div className="rv-strip rv-strip-master" dir="rtl">
        <div className="rv-strip-name">الماستر</div>
        <button type="button" className="rv-strip-fx" onClick={() => (st.select(st.selClips, "master"), st.openPanel("fx"))}>
          {p.master.fx.length ? p.master.fx.map((f) => <i key={f.id} className={f.on ? "" : "off"}>{FX_SPECS[f.kind].name}</i>) : <span>＋ مؤثرات</span>}
        </button>
        <div className="rv-lufs">
          <b ref={lufs} dir="ltr">—</b>
          <span>LUFS (٣ ثوانٍ)</span>
          <em ref={peakHold} dir="ltr">—</em>
        </div>
        <div className="rv-strip-body">
          <div className="rv-vmeter"><i data-m="__L" /></div>
          <div className="rv-vmeter"><i data-m="__R" /></div>
          <Fader value={p.master.gain} min={-40} onChange={(v) => store.set((q) => ({ ...q, master: { ...q.master, gain: v } }), { merge: "mg" })} />
        </div>
        <div className="rv-strip-db" dir="ltr">{`${p.master.gain > 0 ? "+" : ""}${p.master.gain.toFixed(1)}`}</div>
      </div>
    </div>
  );
}
