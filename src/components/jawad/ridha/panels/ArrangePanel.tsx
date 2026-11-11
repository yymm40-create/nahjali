"use client";

// «الرضا فويس» — the quick arrangement. The person records a plain guide with their own voice, optionally gives a
// similar qasida as a reference, says whether it is a mourning or a celebration piece, and gets — in seconds, with
// nothing spent — a rhythm (chest beat or clap), a floor on the guide's key, the voice chain and the room of that
// kind. Everything it makes stays editable here: the rhythm step by step, the floor's notes and colour.

import { useState } from "react";
import { chainById } from "@config/ridha";
import { MEASURED } from "@config/ridha-training";
import { listenTo, type Listening } from "@/lib/ridha/dsp/listen";
import { PAD_KINDS, renderPad, renderRhythm, rhythmById, RHYTHMS, VOICES, type PadSpec, type RhythmSpec } from "@/lib/ridha/dsp/rhythm";
import { NOTE_NAMES, scaleById } from "@/lib/ridha/dsp/scales";
import { barSec, projectEnd, SR, type Project } from "@/lib/ridha/model";
import { addClip, addTrack, clipOf, replaceSound, setChain } from "@/lib/ridha/ops";
import { decodeFile, putSound } from "../engine";
import { useStudio } from "../ctx";
import { Btn, Seg, Slider } from "../ui";

type Kind = "aza" | "mawlid";
/** The floor's root: the tonic in the octave under a man's voice (E2…E3). */
const padRoot = (tonic: number) => (Math.floor(tonic) >= 4 ? 36 : 48) + Math.floor(tonic);
/** A tempo brought into the range a kind lives in, by doubling or halving. */
const fold = (bpm: number, lo: number, hi: number) => {
  let b = bpm;
  while (b < lo) b *= 2;
  while (b > hi) b /= 2;
  return Math.round(b);
};

export default function ArrangePanel() {
  const st = useStudio();
  const { project, store, clip } = st;
  const [kind, setKind] = useState<Kind>("aza");
  const [ref, setRef] = useState<{ name: string; h: Listening } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const rhythm = project.arr?.rhythm ?? null;
  const pad = project.arr?.pad ?? null;
  const spec: RhythmSpec = rhythm?.spec ?? rhythmById(kind === "aza" ? "latma-4" : "clap-332").spec;
  const padSpec: PadSpec = pad?.spec ?? { root: padRoot(project.key?.tonic ?? 9), kind: kind === "aza" ? "choir" : "strings", notes: 2, bright: 0.4 };
  const length = Math.max(projectEnd(project), 8);

  const pickRef = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,video/mp4,.mp3,.wav,.m4a";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const h = await st.work("سماع القصيدة المرجعية", async (say) => {
        say(0.15, "قراءة الملف");
        const ch = await decodeFile(f);
        say(0.45, "قياس الإيقاع والسرعة والصدى");
        return listenTo(ch, SR, { voice: false });
      });
      if (h) setRef({ name: f.name, h });
    };
    input.click();
  };

  /** Renders the rhythm into its clip (a new track the first time). */
  const putRhythm = (p: Project, s: RhythmSpec, bars: number, bpm: number): Project => {
    const chs = renderRhythm(s, bpm, bars, SR);
    const sound = putSound(chs, `إيقاع · ${rhythmById(s.pattern).name}`);
    const dur = chs[0].length / SR;
    const old = p.arr?.rhythm && clipOf(p, p.arr.rhythm.clipId);
    if (old) return { ...replaceSound(p, old.id, sound.id, dur), arr: { ...p.arr, rhythm: { spec: s, bars, clipId: old.id } } };
    const made = addTrack(p, "الإيقاع", { color: "#ff8a6b", gain: -7, sendReverb: 0.18 });
    const c = addClip(made.project, { trackId: made.track.id, assetId: sound.id, start: 0, dur, name: rhythmById(s.pattern).name });
    return { ...c.project, arr: { ...p.arr, rhythm: { spec: s, bars, clipId: c.clip.id } } };
  };
  const putPad = (p: Project, s: PadSpec, seconds: number): Project => {
    const chs = renderPad(s, seconds, SR);
    const sound = putSound(chs, "أرضية");
    const old = p.arr?.pad && clipOf(p, p.arr.pad.clipId);
    if (old) return { ...replaceSound(p, old.id, sound.id, seconds), arr: { ...p.arr, pad: { spec: s, clipId: old.id } } };
    const made = addTrack(p, "الأرضية", { color: "#8f8cff", gain: -15, sendReverb: 0.35 });
    const c = addClip(made.project, { trackId: made.track.id, assetId: sound.id, start: 0, dur: seconds, name: "أرضية" });
    return { ...c.project, arr: { ...p.arr, pad: { spec: s, clipId: c.clip.id } } };
  };

  const arrange = async () => {
    if (!clip) return st.toast("اختر مقطع القايد (تسجيلك) من الخط الزمني أولًا.");
    const sound = st.clipSound(clip);
    if (!sound) return;
    const res = await st.work("توزيع سريع", async (say) => {
      say(0.1, "سماع القايد: نغمته وسرعته");
      const g = await listenTo(sound, SR);
      const said: string[] = [];
      const range = kind === "aza" ? [56, 126] : [MEASURED.mawlid.bpm[0] - 4, MEASURED.mawlid.bpm[1] + 6];
      const fallback = kind === "aza" ? 70 : MEASURED.mawlid.bpmMedian;
      // tempo: the reference's when one was given and it has a clear beat; else the guide's own pulse; else the kind's usual
      let bpm = fallback;
      if (ref && ref.h.beatStrength > 0.12) {
        bpm = fold(ref.h.bpm, range[0], range[1]);
        said.push(`السرعة ${bpm} من القصيدة المرجعية.`);
      } else if (g.beatStrength > 0.3) {
        bpm = fold(g.bpm, range[0], range[1]);
        said.push(`السرعة ${bpm} من نبض القايد نفسه (عدّلها لو ما طابقت).`);
      } else said.push(`ما لقيت نبضًا ثابتًا في القايد: بدأت بـ ${bpm} (المعتاد في ${kind === "aza" ? "العزاء الهادئ" : "المواليد"}) — عدّل السرعة من فوق.`);
      // rhythm: the reference's shape when it belongs to this kind; else the kind's most common
      let pattern = kind === "aza" ? (bpm >= 100 ? "karachi" : "latma-4") : "clap-332";
      if (ref && rhythmById(ref.h.rhythm).kind === kind && ref.h.rhythmFit > 0.45) {
        pattern = ref.h.rhythm;
        said.push(`الإيقاع «${rhythmById(pattern).name}»: أقرب نمط لما في المرجع.`);
      } else said.push(`الإيقاع «${rhythmById(pattern).name}»: الأشيع في ${kind === "aza" ? "إصدارات العزاء" : "المواليد"}.`);
      // the key the person already chose (or confirmed in the tuner) stands; only an unset key is read from the guide
      const key = project.key ?? (g.key && g.voiced > 0.2 ? { tonic: g.key.tonic, scale: g.key.scale.id } : null);
      if (key) said.push(`النغمة ${NOTE_NAMES[Math.floor(key.tonic)]}${key.tonic % 1 ? "½" : ""} · ${scaleById(key.scale).name}${project.key ? " (كما اخترتها)" : ""}: الأرضية على القرار وخامسته.`);
      else said.push("ما قدرت أحدد النغمة من القايد: الأرضية على «لا» — غيّر القرار من لوحة الأوتوتيون ثم حدّث الأرضية.");
      // the room: as long as the reference rings, or the kind's measured usual
      const preset = chainById(kind === "aza" ? "radood" : "mawlid")!;
      const ring = ref?.h.ringMs || MEASURED[kind].ringMs;
      const decay = Math.round(Math.max(1.2, Math.min(5.5, ring / 180)) * 10) / 10;
      said.push(`القاعة ${decay} ثانية (${ref ? "بقياس المرجع" : kind === "aza" ? "ذيل طويل كإصدارات العزاء" : "غرفة قصيرة كالمواليد"}).`);
      say(0.6, "عزف الإيقاع والأرضية");
      await new Promise((r) => setTimeout(r, 0));
      const total = Math.max(clip.start + clip.dur, 8);
      const bars = Math.ceil(total / ((60 / bpm) * 4));
      store.set((p) => {
        let q: Project = { ...p, bpm, beats: 4, key: key ?? p.key, reverb: { ...p.reverb, ...preset.room, decay } };
        q = setChain(q, clip.trackId, preset.build(), preset.sends);
        q = putRhythm(q, { ...rhythmById(pattern).spec }, bars, bpm);
        q = putPad(q, { root: padRoot(key?.tonic ?? 9), kind: kind === "aza" ? "choir" : "strings", notes: 2, bright: kind === "aza" ? 0.3 : 0.55 }, bars * (60 / bpm) * 4 + 2);
        return q;
      });
      said.push(`سلسلة «${preset.name}» على مسار القايد.`);
      return said;
    });
    if (res) setNotes(res);
  };

  const updateRhythm = (s: RhythmSpec, merge?: string) => {
    const bars = rhythm?.bars ?? Math.ceil(length / barSec({ bpm: project.bpm, beats: 4 }));
    store.set((p) => putRhythm(p, s, bars, p.bpm), merge ? { merge } : {});
  };
  const updatePad = (s: PadSpec, merge?: string) => store.set((p) => putPad(p, s, Math.max(length, 8) + 2), merge ? { merge } : {});
  const cycle = (v: number) => (v === 0 ? 0.6 : v < 0.9 ? 1 : 0);

  return (
    <div className="rv-arr">
      <div className="rv-arr-quick">
        <div className="rv-panel-head">
          <b>التوزيع السريع</b>
          <Seg small value={kind} options={[{ value: "aza", label: "عزاء" }, { value: "mawlid", label: "مولد وفرح" }]} onChange={setKind} />
        </div>
        <ol className="rv-steps">
          <li className={clip ? "ok" : ""}><b>القايد:</b> {clip ? clip.name : "سجّل صوتك عادي (الأفضل على المترونوم) واختر المقطع"}</li>
          <li className={ref ? "ok" : ""}>
            <b>قصيدة مشابهة (اختياري):</b> {ref ? `${ref.name} — ${Math.round(ref.h.bpm)} bpm · ${rhythmById(ref.h.rhythm).name} · صدى ${ref.h.ringMs} مللي ثانية` : "ملف صوت لقصيدة قريبة من اللي تبيه"}
            <Btn small onClick={pickRef}>{ref ? "غيّر" : "＋ اختر ملف"}</Btn>
          </li>
        </ol>
        <Btn kind="main" onClick={() => void arrange()}>وزّع لي</Btn>
        {notes.length ? <ul className="rv-notes">{notes.map((n) => <li key={n}>{n}</li>)}</ul> : <p className="rv-muted">يقيس نغمة القايد وسرعته، ويأخذ من المرجع سرعته وشكل إيقاعه وطول صداه، ثم يبني إيقاعًا وأرضية وسلسلة صوت — وكل شيء يبقى قابلًا للتعديل هنا وفي المسارات.</p>}
      </div>

      <div className="rv-arr-rhythm">
        <div className="rv-panel-head">
          <b>الإيقاع</b>
          <select value={spec.pattern} onChange={(e) => updateRhythm({ ...rhythmById(e.target.value).spec })} aria-label="نمط الإيقاع">
            <optgroup label="عزاء (لطم)">{RHYTHMS.filter((r) => r.kind === "aza").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
            <optgroup label="مواليد وأفراح (صفقة)">{RHYTHMS.filter((r) => r.kind === "mawlid").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
          </select>
          <span className="rv-muted">{rhythmById(spec.pattern).hint} · {rhythmById(spec.pattern).bpm.join("–")} bpm</span>
          <span className="rv-grow" />
          {rhythm ? null : <Btn small kind="main" onClick={() => updateRhythm(spec)}>＋ أضف الإيقاع</Btn>}
        </div>
        <div className="rv-grid" dir="ltr" style={{ ["--steps" as string]: spec.steps }}>
          {VOICES.map((v) => (
            <div key={v.id} className="rv-grid-row">
              <span dir="rtl" title={v.hint}>{v.name}</span>
              {spec.lanes[v.id].map((val, i) => (
                <button key={i} type="button" className={`${val >= 0.9 ? "hi" : val > 0 ? "lo" : ""}${i % (spec.steps === 12 ? 6 : 4) === 0 ? " beat" : ""}`} onClick={() => updateRhythm({ ...spec, lanes: { ...spec.lanes, [v.id]: spec.lanes[v.id].map((x, k) => (k === i ? cycle(x) : x)) } })} aria-label={`${v.name} ${i + 1}`} />
              ))}
            </div>
          ))}
        </div>
        <div className="rv-params">
          <Slider label="عدد الناس" value={spec.crowd} min={0} max={1} onChange={(x) => updateRhythm({ ...spec, crowd: x }, "crowd")} />
          <Slider label="تمايل" value={spec.swing} min={0} max={0.5} onChange={(x) => updateRhythm({ ...spec, swing: x }, "swing")} />
          <Slider label="تسارع الختام" value={spec.rush} min={0} max={30} step={1} unit="bpm" onChange={(x) => updateRhythm({ ...spec, rush: x }, "rush")} />
          <span className="rv-muted">السرعة من فوق ({Math.round(project.bpm)} BPM) — بعد تغييرها اضغط:</span>
          <Btn small onClick={() => updateRhythm(spec)}>↻ حدّث الإيقاع</Btn>
        </div>
      </div>

      <div className="rv-arr-pad">
        <div className="rv-panel-head">
          <b>الأرضية</b>
          {pad ? null : <Btn small kind="main" onClick={() => updatePad(padSpec)}>＋ أضف أرضية</Btn>}
        </div>
        <Seg small value={padSpec.kind} options={PAD_KINDS.map((k) => ({ value: k.id, label: k.name, title: k.hint }))} onChange={(k) => updatePad({ ...padSpec, kind: k })} />
        <label className="rv-inline">
          القرار
          <select value={((padSpec.root % 12) + 12) % 12} onChange={(e) => updatePad({ ...padSpec, root: padRoot(Number(e.target.value)) })}>
            {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
        </label>
        <Seg small value={padSpec.notes} options={[{ value: 1, label: "القرار" }, { value: 2, label: "＋ الخامسة" }, { value: 3, label: "＋ الجواب" }]} onChange={(n) => updatePad({ ...padSpec, notes: n as 1 | 2 | 3 })} />
        <Slider label="اللمعة" value={padSpec.bright} min={0} max={1} onChange={(x) => updatePad({ ...padSpec, bright: x }, "bright")} />
        <span className="rv-muted">مستواها من فيدر مسارها في الميكسر (تجلس تحت الصوت بـ 14–20 dB).</span>
      </div>
    </div>
  );
}
