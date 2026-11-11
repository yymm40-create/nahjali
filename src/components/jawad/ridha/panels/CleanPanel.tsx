"use client";

// «الرضا فويس» — professional cleaning. First the recording is measured («افحص»): noise, hum, room, hiss, tone.
// Then one button runs the engineer's chain with the settings those measurements call for, for the kind of
// recording chosen (a podcast is not cleaned like a choir). Every step can also be set by hand, or run alone.

import { useState } from "react";
import { chainById } from "@config/ridha";
import { advise, nudgeBands, USES, type Advice, type Use } from "@/lib/ridha/advise";
import { aiDenoise, cleanVoice, cutRumble, deEss, detectHum, gate, noiseProfile, reduceNoise, reduceReverb, removeClicks, removeHum, type CleanOptions } from "@/lib/ridha/dsp/clean";
import { listenTo, TILT_BANDS, type Listening } from "@/lib/ridha/dsp/listen";
import { normalizeLoudness } from "@/lib/ridha/dsp/loudness";
import { SR } from "@/lib/ridha/model";
import { setChain } from "@/lib/ridha/ops";
import { useStudio } from "../ctx";
import { Btn, Empty, Slider } from "../ui";

const MANUAL: CleanOptions = { noise: 0.6, ai: false, rumbleHz: 80, hum: true, clicks: true, deEss: 0.5, reverb: 0, gate: false };

export default function CleanPanel() {
  const st = useStudio();
  const { clip } = st;
  const [use, setUse] = useState<Use>("podcast");
  const [heard, setHeard] = useState<{ id: string; h: Listening } | null>(null);
  const [opts, setOpts] = useState<CleanOptions>(MANUAL);
  const [manual, setManual] = useState(false);
  const [alsoChain, setAlsoChain] = useState(true);
  const [report, setReport] = useState<string[]>([]);

  if (!clip) return <Empty icon="" title="اختر مقطعًا لتنظيفه">اضغط على التسجيل في الخط الزمني، ثم ارجع هنا.</Empty>;
  const h = heard?.id === clip.assetId + clip.offset + clip.dur ? heard.h : null;
  const advice: Advice | null = h ? advise(h, use) : null;
  const active = manual || !advice ? opts : advice.clean;

  const measure = async () => {
    const sound = st.clipSound(clip);
    if (!sound) return null;
    const res = await st.work("فحص التسجيل", async (say) => {
      say(0.2, "قياس الضجيج والنغمة والغرفة");
      return listenTo(sound, SR);
    });
    if (res) {
      setHeard({ id: clip.assetId + clip.offset + clip.dur, h: res });
      setManual(false);
    }
    return res;
  };

  const run = async () => {
    const sound = st.clipSound(clip);
    if (!sound) return;
    const m = h ?? (await measure());
    if (!m) return;
    const adv = advise(m, use);
    const o = manual ? opts : adv.clean;
    const res = await st.work("تنظيف احترافي", async (say) => {
      const out: Float32Array[] = [];
      const steps: string[] = [];
      for (let c = 0; c < sound.length; c++) {
        const r = await cleanVoice(sound[c], SR, o, (p, what) => say((c + p) / sound.length, what));
        out.push(r.out);
        if (c === 0) steps.push(...r.report.steps);
      }
      const leveled = normalizeLoudness(out, SR, adv.level);
      if (Number.isFinite(leveled.before)) steps.push(`ضبط الجهارة من ${leveled.before.toFixed(1)} إلى ${adv.level} LUFS`);
      return { out: leveled.channels, steps };
    });
    if (!res) return;
    st.applyToClip(clip, res.out, "تنظيف");
    if (alsoChain) {
      const preset = chainById(adv.chain);
      if (preset) {
        const fx = preset.build().map((f) => (f.kind === "eq" && f.bands ? { ...f, bands: nudgeBands(f.bands, adv.eq) } : f));
        st.store.set((p) => setChain(p, clip.trackId, fx, preset.sends));
        res.steps.push(`سلسلة «${preset.name}» على المسار بإكولايزر مضبوط على قياسات هذا التسجيل`);
      }
    }
    setReport(res.steps);
    setHeard(null);
  };

  /** One tool alone, on every channel of the clip. */
  const single = (label: string, f: (x: Float32Array, say: (p: number) => void) => Promise<Float32Array> | Float32Array) => async () => {
    const sound = st.clipSound(clip);
    if (!sound) return;
    const out = await st.work(label, async (say) => {
      const res: Float32Array[] = [];
      for (let c = 0; c < sound.length; c++) res.push(await f(sound[c], (p) => say((c + p) / sound.length)));
      return res;
    });
    if (out) st.applyToClip(clip, out, label);
  };

  return (
    <div className="rv-clean">
      <div className="rv-clean-main">
        <div className="rv-panel-head">
          <b>نوع التسجيل</b>
          <span className="rv-muted">كل نوع له طريقة تنظيف وإكولايزر</span>
        </div>
        <div className="rv-uses">
          {USES.map((u) => (
            <button key={u.id} type="button" className={`rv-card${use === u.id ? " on" : ""}`} onClick={() => setUse(u.id)}>
              <i>{u.icon}</i>
              <b>{u.name}</b>
              <small>{u.hint}</small>
            </button>
          ))}
        </div>
        <div className="rv-clean-go">
          <Btn kind="main" onClick={() => void run()}>تنظيف احترافي للمقطع</Btn>
          <Btn onClick={() => void measure()}>افحص أولًا</Btn>
          <label className="rv-check">
            <input type="checkbox" checked={alsoChain} onChange={(e) => setAlsoChain(e.target.checked)} />
            وركّب الإكولايزر والكمبريسور المناسبين على المسار
          </label>
        </div>
        {report.length ? (
          <div className="rv-report">
            <b>ما تم:</b>
            <ol>{report.map((s) => <li key={s}>{s}</li>)}</ol>
          </div>
        ) : null}
        {h && advice ? (
          <div className="rv-heard">
            <div className="rv-stats" dir="ltr">
              <span><b>{h.noiseDb ?? "؟"}</b>dB noise</span>
              <span><b>{Number.isFinite(h.lufs) ? h.lufs : "—"}</b>LUFS</span>
              <span><b>{h.peak}</b>dB peak</span>
              <span><b>{h.ringMs}</b>ms room</span>
              <span><b>{h.hum || "—"}</b>Hz hum</span>
              <span><b>{h.sibilance}</b>dB «س»</span>
            </div>
            <div className="rv-tilt" dir="ltr" title="توزيع الطاقة على الترددات مقارنة بوسط الصوت">
              {h.tilt.map((v, i) => (
                <span key={TILT_BANDS[i]}>
                  <i style={{ height: `${Math.max(4, Math.min(100, (v + 50) * 2))}%` }} />
                  <small>{TILT_BANDS[i]}</small>
                </span>
              ))}
            </div>
            <ul className="rv-notes">{advice.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        ) : null}
      </div>

      <aside className="rv-clean-side">
        <div className="rv-panel-head">
          <b>بيدك</b>
          <label className="rv-check">
            <input type="checkbox" checked={manual} onChange={(e) => (setManual(e.target.checked), e.target.checked && advice && setOpts(advice.clean))} />
            أنا أحدد الإعدادات
          </label>
        </div>
        <fieldset disabled={!manual} className="rv-clean-opts">
          <Slider label="تخفيض الضجيج" value={active.noise} min={0} max={1} onChange={(v) => setOpts({ ...active, noise: v })} />
          <Slider label="قص الهدير تحت" value={active.rumbleHz} min={0} max={200} step={5} unit="Hz" onChange={(v) => setOpts({ ...active, rumbleHz: v })} />
          <Slider label="دي-إسر (س، ش)" value={active.deEss} min={0} max={1} onChange={(v) => setOpts({ ...active, deEss: v })} />
          <Slider label="تخفيف صدى الغرفة" value={active.reverb} min={0} max={1} onChange={(v) => setOpts({ ...active, reverb: v })} />
          <label className="rv-check"><input type="checkbox" checked={active.ai} onChange={(e) => setOpts({ ...active, ai: e.target.checked })} />شبكة عصبية للضجيج المتغيّر (للكلام فقط)</label>
          <label className="rv-check"><input type="checkbox" checked={active.hum} onChange={(e) => setOpts({ ...active, hum: e.target.checked })} />طنين الكهرباء</label>
          <label className="rv-check"><input type="checkbox" checked={active.clicks} onChange={(e) => setOpts({ ...active, clicks: e.target.checked })} />طقطقة الفم</label>
          <label className="rv-check"><input type="checkbox" checked={active.gate} onChange={(e) => setOpts({ ...active, gate: e.target.checked })} />إسكات الفراغات</label>
        </fieldset>
        <div className="rv-panel-head"><b>أداة واحدة فقط</b></div>
        <div className="rv-pills">
          <button type="button" onClick={single("تخفيض الضجيج", async (x, say) => reduceNoise(x, await noiseProfile(x), active.noise || 0.6, -18, say))}>ضجيج ثابت</button>
          <button type="button" onClick={single("إزالة الضجيج (شبكة عصبية)", (x, say) => aiDenoise(x, 1, say))}>ضجيج متغيّر</button>
          <button type="button" onClick={single("قص الهدير", (x) => cutRumble(x, SR, active.rumbleHz || 80))}>هدير</button>
          <button type="button" onClick={single("إزالة الطنين", (x) => { const hz = detectHum(x, SR); return hz ? removeHum(x, SR, hz) : x; })}>طنين</button>
          <button type="button" onClick={single("إزالة الطقطقة", (x) => removeClicks(x, SR).out)}>طقطقة</button>
          <button type="button" onClick={single("دي-إسر", (x) => deEss(x, SR, 6000, -30, active.deEss || 0.5))}>س / ش</button>
          <button type="button" onClick={single("تخفيف صدى الغرفة", (x, say) => reduceReverb(x, active.reverb || 0.5, say))}>صدى الغرفة</button>
          <button type="button" onClick={single("بوابة ضجيج", (x) => gate(x, SR))}>الفراغات</button>
        </div>
      </aside>
    </div>
  );
}
