"use client";

// «الرضا فويس» — changing the voice on the device (free): ready characters built from the voice's own pulses — a
// bigger or smaller throat, a higher or lower note, or the hard robotic tune — with the two sliders open for
// anything in between.

import { useState } from "react";
import { psolaShift } from "@/lib/ridha/dsp/psola";
import { scaleById } from "@/lib/ridha/dsp/scales";
import { planTune } from "@/lib/ridha/dsp/tune";
import { hear } from "../analysis";
import { useStudio } from "../ctx";
import { Btn, Empty, Slider } from "../ui";

const CHARACTERS: { id: string; name: string; icon: string; hint: string; semis: number; formant: number; robot?: boolean }[] = [
  { id: "deep", name: "أضخم وأوقر", icon: "", hint: "نفس الطبقة تقريبًا بحنجرة أكبر", semis: -1.5, formant: 0.9 },
  { id: "elder", name: "شيخ كبير", icon: "", hint: "أوطى وأثقل", semis: -3, formant: 0.88 },
  { id: "giant", name: "عملاق", icon: "", hint: "واطي جدًا وضخم", semis: -7, formant: 0.8 },
  { id: "young", name: "شاب", icon: "", hint: "أعلى شعرة وأخف", semis: 2, formant: 1.06 },
  { id: "woman", name: "نسائي", icon: "", hint: "أعلى بحنجرة أصغر", semis: 6, formant: 1.17 },
  { id: "child", name: "طفل", icon: "", hint: "عالٍ وصغير", semis: 9, formant: 1.3 },
  { id: "thin", name: "أرفع بنفس الطبقة", icon: "", hint: "حنجرة أصغر فقط", semis: 0, formant: 1.12 },
  { id: "robot", name: "روبوت", icon: "", hint: "قفز فوري بين النغمات", semis: 0, formant: 1, robot: true },
];

export default function VoicePanel() {
  const st = useStudio();
  const { clip } = st;
  const [semis, setSemis] = useState(0);
  const [formant, setFormant] = useState(1);
  const [robot, setRobot] = useState(false);
  const [picked, setPicked] = useState("");

  if (!clip) return <Empty icon="" title="اختر مقطع صوت">تغيير الصوت يعمل على مقطع فيه صوت واحد واضح.</Empty>;

  const run = async (keep: boolean) => {
    const sound = st.clipSound(clip);
    if (!sound) return;
    const base = await st.work("سماع الصوت", (say) => hear(clip, sound, (p) => say(p, "تتبّع النغمة")));
    if (!base) return;
    const out = await st.work("تغيير الصوت", async () => {
      const plan = robot ? planTune(base.track, { tonic: 0, scale: scaleById("chromatic"), strength: 1, speedMs: 0, transpose: semis }) : null;
      return sound.map((ch) => psolaShift(ch, base.track, plan ? (f) => plan.ratio[f] : () => 2 ** (semis / 12), formant, base.marks));
    });
    if (!out) return;
    if (keep) st.applyToClip(clip, out, `صوت: ${CHARACTERS.find((c) => c.id === picked)?.name ?? "مخصص"}`);
    else st.engine.listen(out);
  };

  return (
    <div className="rv-voice">
      <div className="rv-voice-chars">
        <div className="rv-panel-head">
          <b>شخصيات جاهزة</b>
          <span className="rv-muted">على الجهاز، بدون أي تكلفة</span>
        </div>
        <div className="rv-uses">
          {CHARACTERS.map((c) => (
            <button key={c.id} type="button" className={`rv-card${picked === c.id ? " on" : ""}`} onClick={() => (setPicked(c.id), setSemis(c.semis), setFormant(c.formant), setRobot(!!c.robot))}>
              <i>{c.icon}</i>
              <b>{c.name}</b>
              <small>{c.hint}</small>
            </button>
          ))}
        </div>
      </div>
      <aside className="rv-voice-side">
        <div className="rv-panel-head"><b>بيدك</b></div>
        <Slider label="الطبقة" value={semis} min={-12} max={12} step={0.5} unit="نصف نغمة" def={0} onChange={(v) => (setSemis(v), setPicked(""))} />
        <Slider label="حجم الحنجرة" value={formant} min={0.75} max={1.35} step={0.01} def={1} onChange={(v) => (setFormant(v), setPicked(""))} />
        <label className="rv-check"><input type="checkbox" checked={robot} onChange={(e) => (setRobot(e.target.checked), setPicked(""))} />نغمات مقفولة (روبوت)</label>
        <div className="rv-row">
          <Btn onClick={() => void run(false)}>▶ معاينة</Btn>
          <Btn kind="ghost" onClick={() => st.engine.hush()}>■</Btn>
          <Btn kind="main" disabled={semis === 0 && formant === 1 && !robot} onClick={() => void run(true)}>طبّق على المقطع</Btn>
        </div>
        <span className="rv-muted">يغيّر الطبقة والحنجرة من نبضات صوتك نفسه، فيبقى الكلام والتوقيت كما هما.</span>
      </aside>
    </div>
  );
}
