"use client";

// «الرضا فويس» — changing who is speaking, on the device (free). The realistic characters are recipes worked out
// against the speaker's OWN voice — where its middle should land, how much smaller or larger the throat, how lively
// the melody, how steady, how airy — so a child sounds like a child whether the speaker is deep or light. By hand:
// the same knobs. And the robot, which is not meant to be real.

import { useState } from "react";
import { psolaShift } from "@/lib/ridha/dsp/psola";
import { scaleById } from "@/lib/ridha/dsp/scales";
import { planTune } from "@/lib/ridha/dsp/tune";
import { changeVoice, VOICE_CHARACTERS, type VoiceShape } from "@/lib/ridha/dsp/voice";
import { SR } from "@/lib/ridha/model";
import { hear } from "../analysis";
import { useStudio } from "../ctx";
import { Btn, Empty, Slider } from "../ui";

export default function VoicePanel() {
  const st = useStudio();
  const { clip } = st;
  const [picked, setPicked] = useState("woman");
  const [semis, setSemis] = useState(0);
  const [formant, setFormant] = useState(1);
  const [breath, setBreath] = useState(0);
  const [range, setRange] = useState(1);

  if (!clip) return <Empty icon="" title="اختر مقطع صوت">تغيير الصوت يعمل على مقطع فيه صوت واحد واضح (بدون موسيقى).</Empty>;

  const character = VOICE_CHARACTERS.find((c) => c.id === picked) ?? null;
  const custom: VoiceShape = { ratio: 2 ** (semis / 12), formant, breath, range };
  const label = picked === "robot" ? "روبوت" : character?.name ?? "مخصص";

  const run = async (keep: boolean) => {
    const sound = st.clipSound(clip);
    if (!sound) return;
    const out = await st.work(`تغيير الصوت: ${label}`, async (say) => {
      if (picked === "robot") {
        // not a person: every note locked to the nearest semitone, at once
        const base = await hear(clip, sound, (p) => say(p * 0.8, "تتبّع النغمة"));
        const plan = planTune(base.track, { tonic: 0, scale: scaleById("chromatic"), strength: 1, speedMs: 0, transpose: 0 });
        return sound.map((ch) => psolaShift(ch, base.track, (f) => plan.ratio[f], 1, base.marks));
      }
      const res: Float32Array[] = [];
      for (let c = 0; c < sound.length; c++) res.push(await changeVoice(sound[c], SR, character ?? custom, (p, what) => say((c + p) / sound.length, what)));
      return res;
    });
    if (!out) return;
    if (keep) st.applyToClip(clip, out, `صوت: ${label}`);
    else st.engine.listen(out);
  };

  return (
    <div className="rv-voice">
      <div className="rv-voice-chars">
        <div className="rv-panel-head">
          <b>شخصيات</b>
          <span className="rv-muted">تنضبط على طبقة صوتك أنت · على الجهاز، بدون تكلفة</span>
        </div>
        <div className="rv-uses">
          {VOICE_CHARACTERS.map((c) => (
            <button key={c.id} type="button" className={`rv-card${picked === c.id ? " on" : ""}`} onClick={() => setPicked(c.id)}>
              <b>{c.name}</b>
              <small>{c.hint}</small>
            </button>
          ))}
          <button type="button" className={`rv-card${picked === "robot" ? " on" : ""}`} onClick={() => setPicked("robot")}>
            <b>روبوت</b>
            <small>قفز فوري بين النغمات (غير واقعي بقصد)</small>
          </button>
          <button type="button" className={`rv-card${picked === "custom" ? " on" : ""}`} onClick={() => setPicked("custom")}>
            <b>بيدي</b>
            <small>أحدد الطبقة والحنجرة بنفسي</small>
          </button>
        </div>
        <div className="rv-clean-go">
          <Btn onClick={() => void run(false)}>▶ معاينة</Btn>
          <Btn kind="ghost" onClick={() => st.engine.hush()}>■</Btn>
          <Btn kind="main" onClick={() => void run(true)}>طبّق على المقطع</Btn>
          <span className="rv-muted">المعاينة ما تغيّر شيء في المشروع.</span>
        </div>
        <p className="rv-muted">يُنقل الصوت كله أولًا بمقدار حجم الحنجرة (فما يبقى من صوتك الأصلي شيء في الخلفية)، ثم تُنقل الطبقة وحدها. أفضل نتيجة مع تسجيل نظيف قريب من المايك؛ نظّف المقطع أولًا لو فيه ضجيج أو صدى.</p>
      </div>
      <aside className="rv-voice-side">
        <div className="rv-panel-head"><b>بيدي</b></div>
        <fieldset disabled={picked !== "custom"} className="rv-clean-opts">
          <Slider label="الطبقة" value={semis} min={-12} max={14} step={0.5} unit="نصف نغمة" def={0} onChange={setSemis} />
          <Slider label="حجم الحنجرة" value={formant} min={0.75} max={1.35} step={0.01} def={1} onChange={setFormant} />
          <Slider label="حيوية لحن الكلام" value={range} min={0.7} max={1.4} step={0.01} def={1} onChange={setRange} />
          <Slider label="نَفَس في الصوت" value={breath} min={0} max={0.15} step={0.005} def={0} onChange={setBreath} />
        </fieldset>
        <span className="rv-muted">حنجرة أقل من 1 = جسم أكبر · أكثر = أصغر. اختر «بيدي» لتشتغل هذه المفاتيح.</span>
      </aside>
    </div>
  );
}
