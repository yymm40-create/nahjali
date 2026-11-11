"use client";

// «الرضا فويس» — the master in one press: a style, how hard it is pushed, heard at once on the whole mix and
// compared with the mix as it was; and a reference — a song the person admires — whose tone and loudness are measured
// beside the mix's, the difference added to the master's equalizer. What is built is the studio's own effects on the
// master chain, so every knob can still be opened from «المؤثرات».

import { useState } from "react";
import { loudness, peakDb } from "@/lib/ridha/dsp/loudness";
import { buildMaster, MASTER_STYLES, masterStyle, matchTone, TONE_NAMES, toneOf } from "@/lib/ridha/master";
import { makeFx, SR, type Project } from "@/lib/ridha/model";
import { setChain } from "@/lib/ridha/ops";
import { decodeFile, renderProject } from "../engine";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg } from "../ui";

interface Heard {
  tone: number[];
  lufs: number;
  peak: number;
}
// the reference outlives the window being closed (it is a measurement, not part of the project)
let reference: (Heard & { name: string }) | null = null;

const LEVELS = [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v), title: v === 1 ? "لمسة خفيفة" : v === 3 ? "الستايل كما هو" : v === 5 ? "أقصى دفع" : undefined }));

export default function MasterPanel() {
  const st = useStudio();
  const { project, store } = st;
  const m = project.mastering;
  const [ref, setRef] = useState(reference);
  const [mix, setMix] = useState<Heard | null>(null);
  const [level, setLevel] = useState(m?.level ?? 3);

  if (!project.clips.length) return <Empty icon="" title="ما في مكس بعد">سجّل أو استورد صوتًا أولًا، ثم ارجع للماستر.</Empty>;

  const put = (style: string, lv: number, match?: number[], refName?: string) => {
    store.set((p) => ({ ...setChain(p, "master", buildMaster(style, lv, match)), mastering: { style, level: lv, match, ref: match ? refName : undefined } }));
    setMix(null);
  };
  const off = () => {
    // back to what a new project has: only the safety limiter
    store.set((p) => ({ ...setChain(p, "master", [makeFx("limiter", { threshold: -1, ceiling: -1, release: 80 })]), mastering: undefined }));
    setMix(null);
  };
  const bypassed = project.master.fx.length > 0 && project.master.fx.every((f) => !f.on);
  const bypass = (on: boolean) => store.set((p) => ({ ...p, master: { ...p.master, fx: p.master.fx.map((f) => ({ ...f, on: !on })) } }), { undo: false });

  const hear = (channels: Float32Array[]): Heard => ({ tone: toneOf(channels, SR), lufs: loudness(channels, SR), peak: peakDb(channels) });
  /** The mix as it is before the master touches it (what a reference is matched against), or as it leaves the master. */
  const measure = (p: Project, raw: boolean) => renderProject(raw ? { ...p, master: { gain: 0, fx: [] } } : p, { tail: 0.2 });

  const pickRef = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,video/mp4,.wav,.mp3,.m4a,.aac,.ogg,.flac,.opus";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const res = await st.work("سماع المرجع", async (say) => {
        say(0.2, file.name);
        const ch = await decodeFile(file);
        say(0.7, "قياس النبرة والجهارة");
        // the first six minutes are plenty to know a song's balance
        return hear(ch.map((c) => c.subarray(0, Math.min(c.length, SR * 360))));
      });
      if (!res) return;
      reference = { ...res, name: file.name.replace(/\.[^.]+$/, "") };
      setRef(reference);
    };
    input.click();
  };

  const check = async () => {
    const res = await st.work("قياس المكس", async (say) => {
      say(0.2, "تشغيل الميكسر على كل المسارات");
      return hear(await measure(project, false));
    });
    if (res) setMix(res);
  };

  const match = async () => {
    if (!ref) return;
    const res = await st.work("مطابقة المرجع", async (say) => {
      say(0.2, "قياس نبرة مكسك قبل الماستر");
      return matchTone(toneOf(await measure(project, true), SR), ref.tone);
    });
    if (!res) return;
    put(m?.style ?? "balanced", m?.level ?? level, res, ref.name);
    st.toast(`نبرة «${ref.name}» أضيفت لإكولايزر الماستر — التراجع بـ ⌘Z`);
  };

  return (
    <div className="rv-master">
      <div className="rv-master-main">
        <div className="rv-panel-head">
          <b>ماستر بضغطة</b>
          <span className="rv-muted">على المكس كله · تسمعه فورًا · كل شيء على الجهاز</span>
          <span className="rv-grow" />
          {m ? <Seg small value={bypassed ? "off" : "on"} options={[{ value: "off", label: "قبل" }, { value: "on", label: "بعد" }]} onChange={(v) => bypass(v === "off")} /> : null}
        </div>
        <div className="rv-uses">
          {MASTER_STYLES.map((s) => (
            <button key={s.id} type="button" className={`rv-card${m?.style === s.id ? " on" : ""}`} onClick={() => put(s.id, level, m?.match, m?.ref)}>
              <b>{s.name}</b>
              <small>{s.hint}</small>
            </button>
          ))}
        </div>
        <div className="rv-master-level">
          <span>القوة</span>
          <Seg value={level} options={LEVELS} onChange={(v) => {
            setLevel(v);
            if (m) put(m.style, v, m.match, m.ref);
          }} />
          <span className="rv-muted">{m ? `${masterStyle(m.style).name} · ${level === 1 ? "لمسة خفيفة" : level === 5 ? "أقصى دفع" : level === 3 ? "كما هو" : level < 3 ? "أخف" : "أقوى"}` : "اختر ستايل من فوق"}</span>
        </div>
        <div className="rv-clean-go">
          <Btn onClick={() => void check()}>قِس المكس</Btn>
          {m ? <Btn kind="ghost" onClick={off}>شيل الماستر</Btn> : null}
          {mix ? <span className="rv-muted" dir="ltr">{Number.isFinite(mix.lufs) ? mix.lufs.toFixed(1) : "—"} LUFS · {Number.isFinite(mix.peak) ? mix.peak.toFixed(1) : "—"} dB peak</span> : null}
        </div>
        <p className="rv-muted">الماستر ينبني من مؤثرات الاستوديو نفسها (إكولايزر، كمبريسور، ليمتر) على سلسلة الماستر — تفتح أي مؤثر منها وتعدّله من «المؤثرات». والتصدير يضبط الجهارة النهائية للمنصة اللي تختارها.</p>
      </div>
      <aside className="rv-master-side">
        <div className="rv-panel-head"><b>طابق مرجع</b></div>
        <span className="rv-muted">أغنية أو إصدار يعجبك صوته: نقيس نبرته ونقرّب مكسك منها.</span>
        <Btn onClick={pickRef}>{ref ? "غيّر المرجع" : "اختر ملف المرجع"}</Btn>
        {ref ? (
          <>
            <b className="rv-master-ref" title={ref.name}>{ref.name}</b>
            <span className="rv-muted" dir="ltr">{Number.isFinite(ref.lufs) ? ref.lufs.toFixed(1) : "—"} LUFS</span>
            <Btn kind="main" onClick={() => void match()}>طابق نبرته</Btn>
          </>
        ) : null}
        {m?.match ? (
          <div className="rv-tone" dir="ltr">
            {m.match.map((g, i) => (
              <span key={TONE_NAMES[i]} title={`${TONE_NAMES[i]}: ${g > 0 ? "+" : ""}${g} dB`}>
                <i className={g < 0 ? "neg" : ""} style={{ height: `${Math.min(100, (Math.abs(g) / 6) * 100)}%` }} />
                <small>{TONE_NAMES[i]}</small>
                <em>{g > 0 ? "+" : ""}{g}</em>
              </span>
            ))}
          </div>
        ) : null}
        {m?.match ? <Btn small kind="ghost" onClick={() => put(m.style, m.level)}>شيل المطابقة</Btn> : null}
      </aside>
    </div>
  );
}
