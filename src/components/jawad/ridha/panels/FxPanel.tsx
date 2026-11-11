"use client";

// «الرضا فويس» — the effects of a track (or of the master): the ready chains on one side («التأثيرات الجاهزة»: one
// press builds the whole chain, nothing spent), the rack itself on the other — each effect switched, reordered,
// opened to its knobs and its own ready sounds.

import { useState } from "react";
import { CHAIN_PRESETS, FX_PRESETS, type ChainPreset } from "@config/ridha";
import { FX_ORDER, FX_SPECS, type FxKind } from "@/lib/ridha/model";
import { addFx, moveFx, patchFx, removeFx, setChain, setFxParam } from "@/lib/ridha/ops";
import { useStudio } from "../ctx";
import { Btn, Empty, ParamControl } from "../ui";

/** The track the effect panels work on: the selected one, or the master when «master» was chosen. */
export function useTarget() {
  const st = useStudio();
  const where = st.selTrack === "master" ? "master" : st.track?.id ?? "";
  const fx = where === "master" ? st.project.master.fx : st.track?.fx ?? [];
  const name = where === "master" ? "الماستر" : st.track?.name ?? "";
  return { where, fx, name };
}

export function TargetPicker() {
  const st = useStudio();
  const cur = st.selTrack === "master" ? "master" : st.track?.id ?? "";
  return (
    <label className="rv-target">
      <span>على:</span>
      <select value={cur} onChange={(e) => st.select(st.selClips, e.target.value)}>
        {st.project.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        <option value="master">الماستر (المجموع)</option>
      </select>
    </label>
  );
}

export default function FxPanel() {
  const st = useStudio();
  const { store } = st;
  const { where, fx } = useTarget();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const groups = [...new Set(CHAIN_PRESETS.map((c) => c.group))];

  const apply = (c: ChainPreset) => {
    store.set((p) => {
      let q = setChain(p, where, c.build(), c.sends);
      // the room the chain was tuned for: taken when nothing else in the project has claimed the shared reverb yet
      if (c.room && !p.tracks.some((t) => t.id !== where && t.sendReverb > 0)) q = { ...q, reverb: { ...q.reverb, ...c.room } };
      return q;
    });
    setOpenId(null);
    st.toast(`«${c.name}» على ${where === "master" ? "الماستر" : st.track?.name ?? ""} — عدّل أي مؤثر من السلسلة`);
  };

  if (!where) return <Empty icon="" title="اختر مسارًا" />;
  return (
    <div className="rv-fx">
      <aside className="rv-fx-ready">
        <div className="rv-panel-head">
          <b>تأثيرات جاهزة</b>
          <TargetPicker />
        </div>
        {groups.map((g) => (
          <div key={g} className="rv-fx-group">
            <span>{g}</span>
            <div>
              {CHAIN_PRESETS.filter((c) => c.group === g).map((c) => (
                <button key={c.id} type="button" className="rv-card" onClick={() => apply(c)} title={c.hint}>
                  <i>{c.icon}</i>
                  <b>{c.name}</b>
                  <small>{c.hint}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <div className="rv-rack">
        <div className="rv-panel-head">
          <b>سلسلة المؤثرات</b>
          <span className="rv-muted">الصوت يمر عليها بالترتيب من فوق لتحت</span>
          <span className="rv-grow" />
          {fx.length ? <Btn small kind="ghost" onClick={() => store.set((p) => setChain(p, where, []))}>تفريغ</Btn> : null}
          <Btn small kind="main" onClick={() => setAdding(!adding)}>＋ مؤثر</Btn>
        </div>
        {adding ? (
          <div className="rv-fx-add">
            {FX_ORDER.map((k: FxKind) => (
              <button key={k} type="button" onClick={() => {
                store.set((p) => {
                  const r = addFx(p, where, k);
                  setOpenId(r.fx.id);
                  return r.project;
                });
                setAdding(false);
              }} title={FX_SPECS[k].hint}>
                <i>{FX_SPECS[k].icon}</i>
                {FX_SPECS[k].name}
              </button>
            ))}
          </div>
        ) : null}
        {!fx.length && !adding ? <Empty icon="" title="السلسلة فاضية">اختر تأثيرًا جاهزًا من اليمين، أو أضف مؤثرًا واحدًا.</Empty> : null}
        {fx.map((f, i) => {
          const spec = FX_SPECS[f.kind];
          const isOpen = openId === f.id;
          return (
            <div key={f.id} className={`rv-fxrow${f.on ? "" : " off"}${isOpen ? " open" : ""}`}>
              <div className="rv-fxrow-head">
                <button type="button" className={`rv-power${f.on ? " on" : ""}`} onClick={() => store.set((p) => patchFx(p, where, f.id, { on: !f.on }))} title={f.on ? "إيقاف" : "تشغيل"} aria-label="تشغيل المؤثر" />
                <button type="button" className="rv-fxrow-name" onClick={() => (f.kind === "eq" ? st.openPanel("eq") : setOpenId(isOpen ? null : f.id))}>
                  <i>{spec.icon}</i>
                  <b>{spec.name}</b>
                  <small>{f.kind === "eq" ? "افتح لوحة الإكولايزر" : spec.hint}</small>
                </button>
                <button type="button" className="rv-mini" onClick={() => store.set((p) => moveFx(p, where, f.id, -1))} disabled={i === 0} title="قدّم">▲</button>
                <button type="button" className="rv-mini" onClick={() => store.set((p) => moveFx(p, where, f.id, 1))} disabled={i === fx.length - 1} title="أخّر">▼</button>
                <button type="button" className="rv-mini" onClick={() => store.set((p) => removeFx(p, where, f.id))} title="حذف">✕</button>
              </div>
              {isOpen && f.kind !== "eq" ? (
                <div className="rv-fxrow-body">
                  {FX_PRESETS[f.kind]?.length ? (
                    <div className="rv-pills">
                      {FX_PRESETS[f.kind]!.map((pr) => (
                        <button key={pr.name} type="button" onClick={() => store.set((p) => patchFx(p, where, f.id, { p: { ...f.p, ...pr.p } }))}>{pr.name}</button>
                      ))}
                    </div>
                  ) : null}
                  <div className="rv-params">
                    {spec.params.map((s) => (
                      <ParamControl key={s.key} spec={s} value={f.p[s.key] ?? s.def} onChange={(v) => store.set((p) => setFxParam(p, where, f.id, s.key, v), { merge: `${f.id}-${s.key}` })} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
