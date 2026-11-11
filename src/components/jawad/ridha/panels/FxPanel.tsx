"use client";

// «الرضا فويس» — the effects of a track (or of the master): the ready chains on one side («التأثيرات الجاهزة»: one
// press builds the whole chain, nothing spent), the rack itself on the other — each effect switched, reordered,
// opened to its knobs and its own ready sounds.

import { useState } from "react";
import { CHAIN_PRESETS, FX_PRESETS, type ChainPreset } from "@config/ridha";
import { FX_ORDER, FX_SPECS, uid, type Fx, type FxKind } from "@/lib/ridha/model";
import { addFx, moveFx, patchFx, removeFx, setChain, setFxParam } from "@/lib/ridha/ops";
import { useStudio } from "../ctx";
import { Btn, Empty, ParamControl } from "../ui";

/** «سلاسلي»: chains the person built and saved under a name, kept on this device for every project. */
interface Mine {
  id: string;
  name: string;
  fx: Fx[];
  sends: { reverb: number; delay: number };
}
const MINE = "ridha.chains";
function loadMine(): Mine[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(MINE) ?? "[]");
    return Array.isArray(v) ? (v as Mine[]).filter((m) => m && typeof m.name === "string" && Array.isArray(m.fx)) : [];
  } catch {
    return [];
  }
}
function saveMine(list: Mine[]) {
  try {
    localStorage.setItem(MINE, JSON.stringify(list));
  } catch {}
}

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
  const [mine, setMine] = useState<Mine[]>(loadMine);
  const keepMine = (list: Mine[]) => {
    setMine(list);
    saveMine(list);
  };
  const saveChain = () => {
    const name = window.prompt("اسم السلسلة (تلقاها بعدين في «سلاسلي» في كل مشاريعك):", st.track && where !== "master" ? st.track.name : "سلسلتي")?.trim();
    if (!name) return;
    const sends = where === "master" || !st.track ? { reverb: 0, delay: 0 } : { reverb: st.track.sendReverb, delay: st.track.sendDelay };
    keepMine([{ id: uid(), name: name.slice(0, 40), fx, sends }, ...mine.filter((m) => m.name !== name)].slice(0, 40));
    st.toast(`انحفظت «${name}» في سلاسلي`);
  };
  const applyMine = (m: Mine) => {
    // fresh ids each time: the same chain can sit on several tracks
    store.set((p) => setChain(p, where, m.fx.map((x) => ({ ...x, id: uid(), p: { ...x.p }, bands: x.bands?.map((b) => ({ ...b })) })), m.sends));
    setOpenId(null);
    st.toast(`«${m.name}» على ${where === "master" ? "الماستر" : st.track?.name ?? ""}`);
  };

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
        {mine.length ? (
          <div className="rv-fx-group rv-fx-mine">
            <span>سلاسلي</span>
            <div>
              {mine.map((m) => (
                <span key={m.id} className="rv-card">
                  <button type="button" onClick={() => applyMine(m)} title="طبّقها على المسار المختار">
                    <b>{m.name}</b>
                    <small>{m.fx.map((x) => FX_SPECS[x.kind]?.name ?? x.kind).join(" · ") || "فاضية"}</small>
                  </button>
                  <button type="button" className="rv-mini" onClick={() => window.confirm(`حذف «${m.name}» من سلاسلي؟`) && keepMine(mine.filter((x) => x.id !== m.id))} title="حذف من سلاسلي" aria-label={`حذف ${m.name}`}>✕</button>
                </span>
              ))}
            </div>
          </div>
        ) : null}
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
          {fx.length ? <Btn small kind="ghost" onClick={saveChain} title="احفظ هذه السلسلة باسم، وتلقاها في «سلاسلي» في كل مشاريعك">احفظها</Btn> : null}
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
