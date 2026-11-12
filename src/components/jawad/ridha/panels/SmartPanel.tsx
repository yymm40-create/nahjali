"use client";

// «الرضا فويس» — three jobs an engineer does by hand for hours, each done in one press on the selected clip:
// «موازنة المستوى» rides the voice's level phrase by phrase (the quiet words come up, the loud ones come down, with
// none of a compressor's squeeze); «حذف السكتات» cuts the clip down to where somebody actually speaks; «الموسيقى
// تحت الكلام» dips a music clip wherever a voice track speaks over it. All on the device, each one undo step.

import { useState } from "react";
import { applyGain, duckGain, findSound, gapsOf, rideLevel, type Region } from "@/lib/ridha/dsp/level";
import { SR } from "@/lib/ridha/model";
import { stripSilence } from "@/lib/ridha/ops";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg, Slider } from "../ui";

export default function SmartPanel() {
  const st = useStudio();
  const { clip, project, store } = st;
  const [range, setRange] = useState(8);
  const [speed, setSpeed] = useState(0.3);
  const [rode, setRode] = useState("");
  const [minSilence, setMinSilence] = useState(0.5);
  const [rel, setRel] = useState(-30);
  const [close, setClose] = useState(false);
  const [found, setFound] = useState<{ key: string; regions: Region[] } | null>(null);
  const [depth, setDepth] = useState(12);
  const [voiceId, setVoiceId] = useState("");

  if (!clip) return <Empty icon="" title="اختر مقطعًا">اضغط على مقطع في المسارات، ثم ارجع هنا.</Empty>;

  // ── riding the level ──
  const ride = async (keep: boolean) => {
    const sound = st.clipSound(clip);
    if (!sound) return;
    const res = await st.work("موازنة المستوى", async (say) => {
      say(0.3, "متابعة مستوى الصوت جملة بجملة");
      return rideLevel(sound, SR, { range, speed });
    });
    if (!res) return;
    const r = res.report;
    setRode(r.before ? `الفرق بين الهادئ والعالي كان ${r.before.toFixed(1)} dB وصار ${r.after.toFixed(1)} dB (رفع حتى ${r.up.toFixed(1)} ونزّل حتى ${r.down.toFixed(1)}).` : "ما لقيت صوتًا واضحًا في المقطع.");
    if (!r.before) return;
    if (keep) st.applyToClip(clip, res.channels, "موازنة المستوى");
    else st.engine.listen(res.channels);
  };

  // ── taking the silences out ──
  const key = `${clip.id}:${clip.assetId}:${clip.offset}:${clip.dur}:${minSilence}:${rel}`;
  const scan = (): Region[] | null => {
    const sound = st.clipSound(clip);
    if (!sound) return null;
    const regions = findSound(sound, SR, { minSilence, relDb: rel });
    setFound({ key, regions });
    return regions;
  };
  const cur = found?.key === key ? found.regions : null;
  const gaps = cur ? gapsOf(cur, clip.dur) : [];
  const gone = gaps.reduce((s, g) => s + (g.b - g.a), 0);
  const strip = () => {
    const regions = cur ?? scan();
    if (!regions) return;
    if (!regions.length) return st.toast("المقطع كله سكوت بهذه الحساسية — خفّف الحساسية.");
    if (!gapsOf(regions, clip.dur).length) return st.toast("ما لقيت سكتات أطول من المدة اللي حددتها.");
    store.set((p) => {
      const r = stripSilence(p, clip.id, regions, close);
      st.select(r.ids);
      return r.project;
    });
    setFound(null);
    st.toast(`انحذفت السكتات (عددها ${gapsOf(regions, clip.dur).length}) — التراجع بـ ⌘Z`);
  };

  // ── music under the voice ──
  const voices = project.tracks.filter((t) => t.id !== clip.trackId && t.kind !== "group" && project.clips.some((c) => c.trackId === t.id && !c.muted && c.start < clip.start + clip.dur && c.start + c.dur > clip.start));
  const voice = voices.find((t) => t.id === voiceId) ?? voices[0] ?? null;
  const duck = async () => {
    const sound = st.clipSound(clip);
    if (!sound || !voice) return;
    const out = await st.work("الموسيقى تحت الكلام", async (say) => {
      say(0.2, `أسمع وين يتكلم «${voice.name}»`);
      const regions: Region[] = [];
      for (const v of project.clips) {
        if (v.trackId !== voice.id || v.muted || v.start >= clip.start + clip.dur || v.start + v.dur <= clip.start) continue;
        const s = st.clipSound(v);
        if (!s) continue;
        // the voice's phrases, moved to seconds from the music clip's own start
        for (const r of findSound(s, SR, { minSilence: 0.5 })) regions.push({ a: r.a + v.start - clip.start, b: r.b + v.start - clip.start });
      }
      if (!regions.length) throw new Error("ما لقيت كلامًا على هذا المسار فوق المقطع.");
      say(0.7, "خفض الموسيقى تحت كل جملة");
      return applyGain(sound, duckGain(sound[0].length, SR, regions, { depthDb: -depth }));
    });
    if (out) st.applyToClip(clip, out, "تحت الكلام");
  };

  return (
    <div className="rv-smart">
      <section>
        <div className="rv-panel-head"><b>موازنة المستوى</b></div>
        <p className="rv-muted">يد مهندس على الفيدر: الكلمات الواطية ترتفع والعالية تنزل، جملة بجملة، بدون ضغط الكمبريسور. للصوت البشري.</p>
        <Slider label="أقصى رفع أو خفض" value={range} min={3} max={12} step={0.5} unit="dB" def={8} onChange={setRange} />
        <label className="rv-slider"><span className="rv-slider-top"><span>يتابع</span></span>
          <Seg small value={speed} options={[{ value: 0.12, label: "كلمة بكلمة" }, { value: 0.3, label: "جملة بجملة" }, { value: 0.7, label: "بهدوء" }]} onChange={setSpeed} />
        </label>
        <div className="rv-clean-go">
          <Btn onClick={() => void ride(false)}>▶ معاينة</Btn>
          <Btn kind="ghost" onClick={() => st.engine.hush()}>■</Btn>
          <Btn kind="main" onClick={() => void ride(true)}>طبّق</Btn>
        </div>
        {rode ? <span className="rv-muted">{rode}</span> : null}
      </section>

      <section>
        <div className="rv-panel-head"><b>حذف السكتات</b></div>
        <p className="rv-muted">يقص المقطع على أماكن الكلام فقط ويشيل الفراغات — للبودكاست والدروس والتعليق.</p>
        <Slider label="السكتة الأطول من" value={minSilence} min={0.2} max={2} step={0.05} unit="s" def={0.5} onChange={setMinSilence} />
        <Slider label="الحساسية (أوطى = يعتبر أكثر كلامًا)" value={rel} min={-45} max={-18} step={1} unit="dB" def={-30} onChange={setRel} />
        <label className="rv-check"><input type="checkbox" checked={close} onChange={() => setClose(!close)} />قرّب الكلام من بعضه (يقصر المقطع)</label>
        <div className="rv-clean-go">
          <Btn onClick={() => void scan()}>افحص</Btn>
          <Btn kind="main" onClick={strip}>احذف السكتات</Btn>
        </div>
        {cur ? <span className="rv-muted">{gaps.length ? `عدد السكتات ${gaps.length}، ومجموعها ${gone.toFixed(1)} ثانية من ${clip.dur.toFixed(1)}.` : "ما في سكتات بهذه الإعدادات."}</span> : null}
      </section>

      <section>
        <div className="rv-panel-head"><b>الموسيقى تحت الكلام</b></div>
        <p className="rv-muted">اختر مقطع الموسيقى أو الأرضية: ينخفض تلقائيًا كل ما تكلم الصوت ويرجع بعده.</p>
        {voices.length ? (
          <>
            <label className="rv-pop-row"><span>الصوت اللي فوقه</span>
              <select value={voice?.id ?? ""} onChange={(e) => setVoiceId(e.target.value)}>
                {voices.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <Slider label="مقدار الخفض" value={depth} min={3} max={24} step={0.5} unit="dB" def={12} onChange={setDepth} />
            <div className="rv-clean-go">
              <Btn kind="main" onClick={() => void duck()}>اخفض «{clip.name.slice(0, 18)}» تحته</Btn>
            </div>
            <span className="rv-muted">إذا حرّكت الكلام بعدها: تراجع (⌘Z) وأعد الخفض.</span>
          </>
        ) : <span className="rv-muted">ما في مسار ثانٍ عليه صوت فوق هذا المقطع. حط الكلام على مسار والموسيقى على مسار، ثم اختر مقطع الموسيقى.</span>}
      </section>
    </div>
  );
}
