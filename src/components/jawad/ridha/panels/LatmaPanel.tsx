"use client";

// «الرضا فويس» — «تركيب اللطمة» (the idea of the sound engineer علي البقال): a mourning qasida recorded live in a majlis
// has the crowd's own latm under it, uneven and far from the microphone. The person picks that recording, and the
// latma they want on it — a single strike or a recorded pattern, from a file or from a clip already in the project —
// and the studio hears WHERE the crowd struck, beat by beat (drifting and speeding up as a crowd does), lays the
// chosen latma on exactly those beats, and hands back two tracks: the majlis's voices, and the latma it laid. Heard
// together before it is kept; both tracks are exported in one press. All on the device.

import { useState } from "react";
import { hearCrowd, layLatma, struckBeats, type CrowdBeats, type LayOptions } from "@/lib/ridha/dsp/beats";
import { SR, type Clip } from "@/lib/ridha/model";
import { addClip, addTrack, clipOf } from "@/lib/ridha/ops";
import { decodeFile, putSound } from "../engine";
import { encodeAudio } from "../encode";
import { downloadBlob } from "../store";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg, Slider } from "../ui";

// the latma picked from a file outlives the window being closed
let picked: { name: string; channels: Float32Array[] } | null = null;

export default function LatmaPanel() {
  const st = useStudio();
  const { clip, project, store } = st;
  const [heard, setHeard] = useState<{ key: string; c: CrowdBeats } | null>(null);
  const [latma, setLatma] = useState(picked);
  const [fromClip, setFromClip] = useState("");
  const [opts, setOpts] = useState<LayOptions>({ every: 1, phase: 0, nudgeMs: 0, gainDb: 0 });
  const [onlyStruck, setOnlyStruck] = useState(true);
  const [made, setMade] = useState<{ majlis: string; laid: string } | null>(null);

  if (!clip) return <Empty icon="" title="اختر تسجيل المجلس">اضغط على مقطع القصيدة المسجّلة في المجلس (فيه لطم الجمهور)، ثم ارجع هنا.</Empty>;
  const key = `${clip.assetId}:${clip.offset}:${clip.dur}`;
  const crowd = heard?.key === key ? heard.c : null;
  const beats = crowd ? (onlyStruck ? struckBeats(crowd) : crowd.beats) : [];
  const others = project.clips.filter((c) => c.id !== clip.id && c.dur < 60);
  const source = fromClip ? clipOf(project, fromClip) : null;

  const listenCrowd = async () => {
    const sound = st.clipSound(clip);
    if (!sound) return null;
    const c = await st.work("سماع لطم الجمهور", async (say) => {
      say(0.2, "أين يلطم الناس، ضربة ضربة");
      return hearCrowd(sound, SR);
    });
    if (!c) return null;
    if (c.beats.length < 4) {
      st.toast("ما سمعت لطمًا واضحًا في هذا التسجيل.");
      return null;
    }
    setHeard({ key, c });
    return c;
  };

  const pickFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,video/mp4,.wav,.mp3,.m4a,.aac,.ogg,.flac,.opus";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ch = await st.work("قراءة اللطمة", () => decodeFile(file));
      if (!ch) return;
      if (ch[0].length / SR > 60) return st.toast("ملف اللطمة أطول من دقيقة: اختر لطمة واحدة أو نمطًا قصيرًا.");
      picked = { name: file.name.replace(/\.[^.]+$/, ""), channels: ch };
      setLatma(picked);
      setFromClip("");
    };
    input.click();
  };

  /** The latma's sound: the chosen clip's, or the file's. */
  const latmaSound = (): Float32Array[] | null => (source ? st.clipSound(source) : latma?.channels ?? null);

  const lay = async () => {
    const sound = st.clipSound(clip);
    const lat = latmaSound();
    if (!sound) return null;
    if (!lat) {
      st.toast("اختر اللطمة أولًا: من ملف أو من مقطع في المشروع.");
      return null;
    }
    const c = crowd ?? (await listenCrowd());
    if (!c) return null;
    const list = onlyStruck ? struckBeats(c) : c.beats;
    return st.work("تركيب اللطمة", async (say) => {
      say(0.4, `على ${list.length} ضربة`);
      return { sound, laid: layLatma(sound[0].length, SR, list, lat, opts) };
    });
  };

  const preview = async () => {
    const r = await lay();
    if (!r) return;
    // the majlis and the laid latma together, as they will sound
    const len = r.sound[0].length;
    const mix = [0, 1].map((c) => {
      const m = new Float32Array(len);
      const a = r.sound[Math.min(c, r.sound.length - 1)], b = r.laid.channels[Math.min(c, r.laid.channels.length - 1)];
      for (let i = 0; i < len; i++) m[i] = a[i] * 0.8 + b[i];
      return m;
    });
    st.engine.listen(mix);
  };

  const keep = async () => {
    const r = await lay();
    if (!r) return;
    const name = source?.name ?? latma?.name ?? "لطمة";
    const s = putSound(r.laid.channels, `لطمة مركّبة · ${name}`);
    store.set((p) => {
      const t = addTrack(p, "لطمة مركّبة", { stereo: r.laid.channels.length > 1, color: "#ff8a6b" });
      const made2 = addClip(t.project, { trackId: t.track.id, assetId: s.id, start: clip.start, dur: r.laid.channels[0].length / SR, name: `لطمة · ${name}` });
      setMade({ majlis: clip.id, laid: made2.clip.id });
      return made2.project;
    });
    st.toast(`انركّبت اللطمة على ${r.laid.placed} ضربة في مسار جديد «لطمة مركّبة» — التراجع بـ ⌘Z`);
  };

  /** The two tracks as two WAV files in one zip: the majlis's voices, and the latma laid on them. */
  const exportTwo = async () => {
    if (!made) return;
    const majlis = clipOf(project, made.majlis), laid = clipOf(project, made.laid);
    if (!majlis || !laid) return st.toast("المسارين تغيّروا: ركّب اللطمة من جديد ثم صدّر.");
    const zip = await st.work("تصدير التراكين", async (say) => {
      const { default: JSZip } = await import("jszip");
      const z = new JSZip();
      const pairs: [string, Clip][] = [["01 أصوات المجلس", majlis], ["02 اللطمة المركبة", laid]];
      for (let i = 0; i < pairs.length; i++) {
        say(i / 2, pairs[i][0]);
        const s = st.clipSound(pairs[i][1]);
        if (s) z.file(`${pairs[i][0]}.wav`, await (await encodeAudio(s, SR, "wav", { depth: 24 })).arrayBuffer());
      }
      return z.generateAsync({ type: "blob", compression: "STORE" });
    });
    if (zip) downloadBlob(zip, `${(project.name || "المجلس").replace(/[\\/:*?"<>|]/g, " ")} - تراكين.zip`);
  };

  const dur = clip.dur;
  return (
    <div className="rv-latma">
      <section>
        <div className="rv-panel-head">
          <b>تركيب اللطمة على تسجيل المجلس</b>
          <span className="rv-muted">على: «{clip.name}»</span>
        </div>
        <p className="rv-muted">يسمع وين لطم الجمهور ضربة ضربة (حتى لو أسرع أو أبطأ)، ويركّب اللطمة اللي تختارها على نفس الأماكن بالضبط، ويطلع لك تراكين: أصوات المجلس، واللطمة المركّبة.</p>
        <div className="rv-clean-go">
          <Btn onClick={() => void listenCrowd()}>اسمع لطم الجمهور</Btn>
          {crowd ? <span className="rv-muted">السرعة ≈ {Math.round(crowd.bpm)} ضربة بالدقيقة · {beats.length} ضربة</span> : null}
        </div>
        {crowd ? (
          <div className="rv-beatline" dir="ltr" title="أماكن الضربات على طول التسجيل">
            {beats.filter((_, i) => i % Math.max(1, Math.ceil(beats.length / 400)) === 0).map((t) => <i key={t} style={{ left: `${(t / dur) * 100}%` }} />)}
          </div>
        ) : null}
        <label className="rv-check"><input type="checkbox" checked={onlyStruck} onChange={() => setOnlyStruck(!onlyStruck)} />فقط حيث يلطم الجمهور (الأبيات بدون لطم تبقى فاضية)</label>
        <label className="rv-slider"><span className="rv-slider-top"><span>تنزل اللطمة على</span></span>
          <Seg small value={`${opts.every}:${opts.phase}`} options={[{ value: "1:0", label: "كل ضربة" }, { value: "2:0", label: "ضربة وضربة (الأولى)" }, { value: "2:1", label: "ضربة وضربة (الثانية)" }]} onChange={(v) => {
            const [e, ph] = v.split(":").map(Number);
            setOpts({ ...opts, every: e as 1 | 2, phase: ph });
          }} />
        </label>
        <Slider label="تقديم أو تأخير" value={opts.nudgeMs} min={-80} max={80} step={2} unit="ms" def={0} onChange={(v) => setOpts({ ...opts, nudgeMs: v })} />
        <Slider label="مستوى اللطمة" value={opts.gainDb} min={-18} max={6} step={0.5} unit="dB" def={0} onChange={(v) => setOpts({ ...opts, gainDb: v })} />
        <div className="rv-clean-go">
          <Btn onClick={() => void preview()}>▶ اسمعها مع المجلس</Btn>
          <Btn kind="ghost" onClick={() => st.engine.hush()}>■</Btn>
          <Btn kind="main" onClick={() => void keep()}>ركّبها في مسار جديد</Btn>
          {made ? <Btn kind="gold" onClick={() => void exportTwo()}>صدّر التراكين</Btn> : null}
        </div>
      </section>
      <aside>
        <div className="rv-panel-head"><b>اللطمة</b></div>
        <span className="rv-muted">لطمة واحدة (ضربة) تنزل على كل ضربة. أو نمط مسجّل (مثل لطمتين وسكتة): ضرباته تنزل بالترتيب وينضبط على سرعة الجمهور.</span>
        <Btn onClick={pickFile}>{latma && !source ? "غيّر ملف اللطمة" : "اختر ملف اللطمة"}</Btn>
        {latma && !source ? <b className="rv-master-ref" title={latma.name}>{latma.name}</b> : null}
        {others.length ? (
          <label className="rv-pop-row"><span>أو من مقطع</span>
            <select value={fromClip} onChange={(e) => setFromClip(e.target.value)}>
              <option value="">—</option>
              {others.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.dur.toFixed(1)} ث)</option>)}
            </select>
          </label>
        ) : null}
        <span className="rv-muted">أفضل نتيجة: لطمة نظيفة مسجّلة قريب من المايك، وتسجيل مجلس اللطم فيه مسموع.</span>
      </aside>
    </div>
  );
}
