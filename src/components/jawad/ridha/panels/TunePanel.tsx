"use client";

// «الرضا فويس» — the tuner: finds the key (or the maqam) of a sung clip, draws what was sung against the notes of
// the scale, and pulls the voice onto them — softly (natural), or at once (the hard robotic effect). The same page
// raises or lowers the whole voice («ترفيع الطبقة») keeping its length and its character.

import { useEffect, useMemo, useRef, useState } from "react";
import { hzToMidi, pitchStats } from "@/lib/ridha/dsp/pitch";
import { psolaShift } from "@/lib/ridha/dsp/psola";
import { detectKey, noteLabel, NOTE_LATIN, NOTE_NAMES, restingNotes, scaleById, SCALES, type KeyGuess } from "@/lib/ridha/dsp/scales";
import { planTune } from "@/lib/ridha/dsp/tune";
import { SR } from "@/lib/ridha/model";
import { hear, type Heard } from "../analysis";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg, Slider } from "../ui";

const SPEEDS = [
  { value: 140, label: "طبيعي", title: "يصل للنغمة بنعومة ويحافظ على الاهتزاز" },
  { value: 50, label: "واضح", title: "تصحيح مسموع ومرتب" },
  { value: 0, label: "روبوت", title: "القفز الفوري بين النغمات (تأثير الأوتوتيون المعروف)" },
];

export default function TunePanel() {
  const st = useStudio();
  const { clip, project, store } = st;
  const [heard, setHeard] = useState<{ id: string; h: Heard; guesses: KeyGuess[] } | null>(null);
  const [strength, setStrength] = useState(0.85);
  const [speed, setSpeed] = useState(140);
  const [transpose, setTranspose] = useState(0);
  const [semis, setSemis] = useState(2);
  const [formant, setFormant] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const H = 170;
  const id = clip ? `${clip.assetId}:${clip.offset}:${clip.dur}` : "";
  const h = heard?.id === id ? heard : null;
  const key = project.key ?? { tonic: 0, scale: "chromatic" };
  const scale = scaleById(key.scale);
  const setKey = (k: { tonic: number; scale: string }) => store.set((p) => ({ ...p, key: k }), { undo: false });
  // where the phrases come to rest: the general rest first, the partial ones after
  const rests = useMemo(() => (h ? restingNotes(h.h.track).slice(0, 5) : []), [h]);
  const plan = useMemo(() => (h ? planTune(h.h.track, { tonic: key.tonic, scale, strength, speedMs: speed, transpose }) : null), [h, key.tonic, scale, strength, speed, transpose]);
  const stats = useMemo(() => (h ? pitchStats(h.h.track) : null), [h]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [h?.id]);

  // the sung line (turquoise) against the corrected one (gold), over the lines of the scale's notes
  useEffect(() => {
    const c = canvas.current;
    if (!c || !plan || !stats) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, H);
    const lo = Math.floor(stats.low + Math.min(0, transpose)) - 2, hi = Math.ceil(stats.high + Math.max(0, transpose)) + 2;
    const y = (m: number) => H - ((m - lo) / (hi - lo)) * H;
    g.font = "10px system-ui";
    g.textBaseline = "middle";
    for (let oct = Math.floor((lo - key.tonic) / 12) - 1; oct <= Math.ceil((hi - key.tonic) / 12); oct++) {
      for (const cents of scale.cents) {
        const m = key.tonic + oct * 12 + cents / 100;
        if (m < lo || m > hi) continue;
        g.fillStyle = cents === 0 ? "rgba(233,185,73,0.35)" : "rgba(255,255,255,0.09)";
        g.fillRect(0, Math.round(y(m)), w, 1);
        g.fillStyle = "rgba(163,171,185,0.7)";
        if ((hi - lo) < 26 || cents === 0) g.fillText(noteLabel(m), 4, y(m) - 6);
      }
    }
    const n = plan.sung.length;
    const line = (arr: Float32Array, color: string, width: number) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      let pen = false;
      for (let i = 0; i < n; i++) {
        if (!arr[i]) {
          pen = false;
          continue;
        }
        const x = (i / n) * w;
        if (pen) g.lineTo(x, y(arr[i]));
        else g.moveTo(x, y(arr[i]));
        pen = true;
      }
      g.stroke();
    };
    line(plan.sung, "rgba(47,214,195,0.75)", 1.4);
    line(plan.tuned, "#e9b949", 2);
  }, [plan, stats, w, key.tonic, scale, transpose]);

  if (!clip) return <Empty icon="" title="اختر مقطع صوت مغنّى">الأوتوتيون واكتشاف النغمة يعملان على مقطع فيه صوت واحد (بدون موسيقى).</Empty>;

  const listen = async () => {
    const sound = st.clipSound(clip);
    if (!sound) return null;
    const res = await st.work("سماع النغمات", (say) => hear(clip, sound, (p) => say(p * 0.95, "تتبّع النغمة")));
    if (!res) return null;
    const guesses = detectKey(res.track);
    setHeard({ id, h: res, guesses });
    if (guesses[0] && !project.key) setKey({ tonic: guesses[0].tonic, scale: guesses[0].scale.id });
    if (!guesses.length) st.toast("ما لقيت نغمات كافية في هذا المقطع (صمت أو كلام أو موسيقى كثيفة).");
    return res;
  };

  /** The voice through psola with a ratio per reading, on every channel. */
  const render = async (label: string, ratio: (f: number) => number, fm = 1, keep = false) => {
    const sound = st.clipSound(clip);
    if (!sound) return;
    const base = h?.h ?? (await listen());
    if (!base) return;
    const out = await st.work(label, async () => sound.map((ch) => psolaShift(ch, base.track, ratio, fm, base.marks)));
    if (!out) return;
    if (keep) st.applyToClip(clip, out, label);
    else st.engine.listen(out);
  };
  const tune = (keep: boolean) => {
    if (!plan) return void listen();
    void render("أوتوتيون", (f) => plan.ratio[f], 1, keep);
  };

  return (
    <div className="rv-tune">
      <div className="rv-tune-main">
        <div className="rv-panel-head">
          <b>النغمة</b>
          <Btn small kind="main" onClick={() => void listen()}>اكتشف النغمة</Btn>
          <label className="rv-inline" title="النغمة اللي يستقر عليها اللحن في نهايات جمله — اسمها عند المهندسين «طبقة الاستقرار»">
            طبقة الاستقرار
            <select value={key.tonic} onChange={(e) => setKey({ ...key, tonic: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, i) => i / 2).map((t) => (
                <option key={t} value={t}>{NOTE_NAMES[Math.floor(t)]}{t % 1 ? "½" : ""} ({NOTE_LATIN[Math.floor(t)]}{t % 1 ? "+" : ""})</option>
              ))}
            </select>
          </label>
          <label className="rv-inline">
            السلّم
            <select value={key.scale} onChange={(e) => setKey({ ...key, scale: e.target.value })}>
              {SCALES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {stats && stats.voiced > 0 ? <span className="rv-muted">المدى: {noteLabel(stats.low)} ← {noteLabel(stats.high)}</span> : null}
        </div>
        {h?.guesses.length ? (
          <div className="rv-pills">
            <span className="rv-muted">الأقرب:</span>
            {h.guesses.map((g) => (
              <button key={g.label} type="button" className={g.tonic === key.tonic && g.scale.id === key.scale ? "on" : ""} onClick={() => setKey({ tonic: g.tonic, scale: g.scale.id })} title={`الثقة ${Math.round(g.confidence * 100)}%`}>
                {g.label} <small dir="ltr">{Math.round(g.confidence * 100)}%</small>
              </button>
            ))}
          </div>
        ) : null}
        {rests.length ? (
          <div className="rv-pills rv-rests">
            <span className="rv-muted">تقف الجمل على:</span>
            {rests.map((r, i) => (
              <span key={r.pc} className={i === 0 ? "on" : ""} title={i === 0 ? "الاستقرار العام: عليه تنتهي أغلب الجمل، وهو اللي يسمّي المقام" : "استقرار جزئي في وسط اللحن"}>
                {NOTE_NAMES[Math.floor(r.pc)]}{r.pc % 1 ? "½" : ""} <small>×{r.phrases}</small>{i === 0 ? <small> · استقرار عام</small> : null}
              </span>
            ))}
          </div>
        ) : null}
        <div className="rv-tune-graph" ref={box} dir="ltr">
          {h ? <canvas ref={canvas} style={{ width: w, height: H }} /> : <Empty icon="" title="اضغط «اكتشف النغمة»">يرسم لك ما غنّيته (فيروزي) وما سيصير بعد التصحيح (ذهبي) على خطوط السلّم.</Empty>}
        </div>
        <div className="rv-tune-controls">
          <Slider label="قوة التصحيح" value={strength} min={0} max={1} def={0.85} onChange={setStrength} />
          <label className="rv-slider">
            <span className="rv-slider-top"><span>سرعة الوصول للنغمة</span></span>
            <Seg value={speed} options={SPEEDS} onChange={setSpeed} />
          </label>
          <Slider label="نقل اللحن كله" value={transpose} min={-12} max={12} step={1} unit="نصف نغمة" def={0} onChange={setTranspose} />
          <div className="rv-row">
            <Btn onClick={() => tune(false)}>▶ معاينة</Btn>
            <Btn kind="main" onClick={() => tune(true)}>طبّق الأوتوتيون</Btn>
            <Btn kind="ghost" onClick={() => st.engine.hush()}>■</Btn>
          </div>
        </div>
      </div>

      <aside className="rv-tune-side">
        <div className="rv-panel-head"><b>ترفيع الطبقة</b></div>
        <p className="rv-muted">يرفع أو ينزّل الصوت كله بدون ما يتغير طوله ولا شخصية صاحبه. (للموسيقى استخدم «الطبقة» في المحرر.)</p>
        <Slider label="الطبقة" value={semis} min={-12} max={12} step={0.5} unit="نصف نغمة" def={0} onChange={setSemis} />
        <div className="rv-pills">
          {[-12, -5, -2, -1, 1, 2, 3, 5, 7, 12].map((v) => (
            <button key={v} type="button" className={semis === v ? "on" : ""} onClick={() => setSemis(v)} dir="ltr">{v > 0 ? `+${v}` : v}</button>
          ))}
        </div>
        <Slider label="حجم الحنجرة" value={formant} min={0.8} max={1.25} step={0.01} def={1} onChange={setFormant} />
        <span className="rv-muted">أقل من 1 = صوت أضخم · أكثر = أرفع</span>
        <div className="rv-row">
          <Btn onClick={() => void render("ترفيع الطبقة", () => 2 ** (semis / 12), formant)}>▶ معاينة</Btn>
          <Btn kind="main" disabled={semis === 0 && formant === 1} onClick={() => void render(`طبقة ${semis > 0 ? "+" : ""}${semis}`, () => 2 ** (semis / 12), formant, true)}>طبّق</Btn>
        </div>
        {stats && stats.voiced > 0 ? <span className="rv-muted">بعد الترفيع: {noteLabel(hzToMidi(440 * 2 ** ((stats.low + semis - 69) / 12)))} ← {noteLabel(stats.high + semis)}</span> : null}
        <span className="rv-muted">المعاينة والتطبيق للمقطع المحدد: {clip.name} · {(clip.dur).toFixed(1)} ث · {SR / 1000} kHz</span>
      </aside>
    </div>
  );
}
