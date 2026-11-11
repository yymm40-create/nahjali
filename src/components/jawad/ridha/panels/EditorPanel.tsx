"use client";

// «الرضا فويس» — the clip editor (the «waveform view»): the selected clip large, as a wave or as a spectrum over
// time; a stretch of it selected by dragging; and the edits that work on that stretch or on the whole clip — cut,
// keep, silence, fade, reverse, level, loudness, speed and key.

import { useEffect, useMemo, useRef, useState } from "react";
import { dbToGain } from "@/lib/ridha/dsp/biquad";
import { FFT, hann } from "@/lib/ridha/dsp/fft";
import { loudness, normalizeLoudness, normalizePeak, peakDb } from "@/lib/ridha/dsp/loudness";
import { changeSpeed, shiftAll } from "@/lib/ridha/dsp/stretch";
import { drawWave, makePeaks } from "@/lib/ridha/dsp/wav";
import { clockLabel, SR } from "@/lib/ridha/model";
import { patchClip } from "@/lib/ridha/ops";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg, Slider } from "../ui";

type View = "wave" | "spec";

export default function EditorPanel() {
  const st = useStudio();
  const { clip, store, engine } = st;
  const [view, setView] = useState<View>("wave");
  const [range, setRange] = useState<[number, number] | null>(null);
  const [speed, setSpeed] = useState(100);
  const [semis, setSemis] = useState(0);
  const [w, setW] = useState(600);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const H = 190;
  const sound = useMemo(() => (clip ? st.clipSound(clip) : null), [clip, st]);
  // the clip's outline is worked out once, not at every redraw of a selection being dragged
  const peaks = useMemo(() => (sound ? makePeaks(sound) : null), [sound]);
  const clipId = clip?.id;
  const [seenClip, setSeenClip] = useState(clipId);
  if (seenClip !== clipId) {
    // another clip: the old selection means nothing on it
    setSeenClip(clipId);
    setRange(null);
  }

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [clipId]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !sound) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, H);
    const x = sound[0];
    const n = x.length;
    if (view === "wave") {
      // every column the exact extremes of its samples, each channel in its own row
      if (!peaks) return;
      const rowH = H / sound.length;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (let row = 0; row < sound.length; row++) {
        g.fillStyle = "rgba(255,255,255,0.1)";
        g.fillRect(0, Math.round((rowH * row + rowH / 2) * dpr), w * dpr, 1);
        g.fillStyle = g.strokeStyle = "#3fc7b7";
        drawWave(g, peaks, sound, row, SR, { x: 0, y: (rowH * row + 3) * dpr, w: w * dpr, h: (rowH - 6) * dpr }, 0, (w * dpr) / (n / SR), () => 1);
      }
      g.restore();
    } else {
      // the spectrum over time: low notes at the bottom, loud = bright
      const N = 1024;
      const fft = new FFT(N);
      const win = hann(N);
      const re = new Float32Array(N), im = new Float32Array(N);
      const img = g.createImageData(Math.round(w * dpr), Math.round(H * dpr));
      const cols = img.width, rows = img.height;
      for (let cx = 0; cx < cols; cx++) {
        const at = Math.floor((cx / cols) * Math.max(1, n - N));
        for (let i = 0; i < N; i++) {
          re[i] = (x[at + i] ?? 0) * win[i];
          im[i] = 0;
        }
        fft.forward(re, im);
        for (let ry = 0; ry < rows; ry++) {
          const f = 40 * (16000 / 40) ** (1 - ry / rows);
          const bin = Math.min(N / 2 - 1, Math.max(1, Math.round((f * N) / SR)));
          const db = 20 * Math.log10(Math.hypot(re[bin], im[bin]) / (N / 4) + 1e-7);
          const v = Math.max(0, Math.min(1, (db + 90) / 80));
          const o = (ry * cols + cx) * 4;
          // night → turquoise → gold → white
          img.data[o] = Math.round(255 * Math.max(0, Math.min(1, v * 2.4 - 1.1)));
          img.data[o + 1] = Math.round(255 * Math.max(0, Math.min(1, v * 1.5 - 0.15)));
          img.data[o + 2] = Math.round(255 * Math.max(0.06, Math.min(1, v < 0.6 ? v * 1.4 : 1.5 - v)));
          img.data[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    }
    if (range) {
      const a = (range[0] / (n / SR)) * w, b = (range[1] / (n / SR)) * w;
      g.fillStyle = "rgba(233,185,73,0.22)";
      g.fillRect(a, 0, b - a, H);
      g.fillStyle = "#e9b949";
      g.fillRect(a, 0, 1.5, H);
      g.fillRect(b - 1.5, 0, 1.5, H);
    }
  }, [sound, peaks, view, w, range]);

  if (!clip || !sound) return <Empty icon="" title="اختر مقطعًا">اضغط على مقطع في الخط الزمني (أو نقرتين عليه) ليفتح هنا للتحرير الدقيق.</Empty>;

  const dur = sound[0].length / SR;
  const [a, b] = range ?? [0, dur];
  const ia = Math.round(a * SR), ib = Math.round(b * SR);
  const whole = !range;
  const scope = whole ? "كل المقطع" : `${clockLabel(a)} ← ${clockLabel(b)}`;

  /** Rewrites the clip's sound through `f` (given a copy of every channel). */
  const edit = (label: string, f: (chs: Float32Array[]) => Float32Array[]) => {
    const out = f(sound.map((c) => c.slice()));
    st.applyToClip(clip, out, label);
    setRange(null);
  };
  const onRange = (label: string, f: (seg: Float32Array[]) => Float32Array[]) =>
    edit(label, (chs) => {
      const seg = f(chs.map((c) => c.slice(ia, ib)));
      return chs.map((c, i) => {
        const out = new Float32Array(ia + seg[i].length + (c.length - ib));
        out.set(c.subarray(0, ia), 0);
        out.set(seg[i], ia);
        out.set(c.subarray(ib), ia + seg[i].length);
        return out;
      });
    });
  const ramp = (inward: boolean) => onRange(inward ? "دخول تدريجي" : "خروج تدريجي", (seg) => seg.map((c) => {
    for (let i = 0; i < c.length; i++) {
      const t = i / Math.max(1, c.length - 1);
      c[i] *= inward ? 0.5 - 0.5 * Math.cos(Math.PI * t) : 0.5 + 0.5 * Math.cos(Math.PI * t);
    }
    return c;
  }));
  const gainBy = (db: number) => onRange(`${db > 0 ? "رفع" : "خفض"} ${Math.abs(db)} dB`, (seg) => seg.map((c) => c.map((v) => v * dbToGain(db))));

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const t0 = ((e.clientX - r.left) / r.width) * dur;
    el.setPointerCapture(e.pointerId);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const t = Math.max(0, Math.min(dur, ((ev.clientX - r.left) / r.width) * dur));
      if (Math.abs(t - t0) * (r.width / dur) > 4) {
        moved = true;
        setRange([Math.min(t0, t), Math.max(t0, t)]);
      }
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      if (!moved) {
        setRange(null);
        engine.seek(clip.start + t0);
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const lufs = loudness(sound, SR);
  return (
    <div className="rv-editor">
      <div className="rv-panel-head">
        <input className="rv-clipname" value={clip.name} onChange={(e) => store.set((p) => patchClip(p, clip.id, { name: e.target.value }), { merge: `cn${clip.id}` })} aria-label="اسم المقطع" />
        <Seg small value={view} options={[{ value: "wave", label: "موجة" }, { value: "spec", label: "طيف" }]} onChange={setView} />
        <span className="rv-muted" dir="ltr">{clockLabel(dur)} · {Number.isFinite(lufs) ? `${lufs.toFixed(1)} LUFS` : "صمت"} · {Number.isFinite(peakDb(sound)) ? `${peakDb(sound).toFixed(1)} dB peak` : ""}</span>
        <span className="rv-grow" />
        <span className="rv-scope">يعمل على: <b>{scope}</b></span>
        <Btn small onClick={() => engine.listen(sound.map((c) => c.slice(ia, ib)))}>▶ اسمع {whole ? "المقطع" : "المحدد"}</Btn>
        <Btn small kind="ghost" onClick={() => engine.hush()}>■</Btn>
      </div>
      <div className="rv-editor-wave" ref={box} dir="ltr">
        <canvas ref={canvas} style={{ width: w, height: H }} onPointerDown={onDown} />
      </div>
      <div className="rv-editor-tools">
        <div className="rv-toolgroup">
          <span>تحرير</span>
          <Btn small disabled={whole} onClick={() => onRange("حذف المحدد", (seg) => seg.map(() => new Float32Array(0)))}>احذف المحدد</Btn>
          <Btn small disabled={whole} onClick={() => edit("إبقاء المحدد فقط", (chs) => chs.map((c) => c.slice(ia, ib)))}>⤢ أبقِ المحدد فقط</Btn>
          <Btn small disabled={whole} onClick={() => onRange("إسكات", (seg) => seg.map((c) => c.fill(0)))}>أسكته</Btn>
          <Btn small onClick={() => onRange("عكس", (seg) => seg.map((c) => c.reverse()))}>⇋ اعكس</Btn>
        </div>
        <div className="rv-toolgroup">
          <span>تدرّج ومستوى</span>
          <Btn small onClick={() => ramp(true)}>◢ دخول</Btn>
          <Btn small onClick={() => ramp(false)}>◣ خروج</Btn>
          <Btn small onClick={() => gainBy(3)}>＋3 dB</Btn>
          <Btn small onClick={() => gainBy(-3)}>−3 dB</Btn>
          <Btn small onClick={() => edit("تطبيع القمة −1 dB", (chs) => normalizePeak(chs, -1))} title="يرفع أعلى قمة إلى −1 dB">قمة −1</Btn>
        </div>
        <div className="rv-toolgroup">
          <span>الجهارة (LUFS)</span>
          <Btn small onClick={() => edit("جهارة −16 LUFS", (chs) => normalizeLoudness(chs, SR, -16).channels)} title="بودكاست وكلام">−16 بودكاست</Btn>
          <Btn small onClick={() => edit("جهارة −14 LUFS", (chs) => normalizeLoudness(chs, SR, -14).channels)} title="يوتيوب وسبوتيفاي وإنستقرام">−14 منصات</Btn>
          <Btn small onClick={() => edit("جهارة −23 LUFS", (chs) => normalizeLoudness(chs, SR, -23).channels)} title="معيار البث التلفزيوني">−23 بث</Btn>
        </div>
        <div className="rv-toolgroup rv-toolgroup-wide">
          <span>السرعة والطبقة (للمقطع كله، يصلح للموسيقى)</span>
          <Slider label="السرعة" value={speed} min={50} max={200} step={1} unit="%" def={100} onChange={setSpeed} />
          <Btn small disabled={speed === 100} onClick={() => void st.work("تغيير السرعة", async () => (st.applyToClip(clip, changeSpeed(sound, speed / 100, SR), `سرعة ${speed}%`), setSpeed(100)))}>طبّق السرعة</Btn>
          <Slider label="الطبقة" value={semis} min={-12} max={12} step={0.5} unit="نصف نغمة" def={0} onChange={setSemis} />
          <Btn small disabled={semis === 0} onClick={() => void st.work("تغيير الطبقة", async () => (st.applyToClip(clip, shiftAll(sound, semis, SR), `طبقة ${semis > 0 ? "+" : ""}${semis}`), setSemis(0)))}>طبّق الطبقة</Btn>
        </div>
        <div className="rv-toolgroup">
          <span>القنوات: هذا المقطع {sound.length > 1 ? "ستيريو" : "مونو"}</span>
          <Btn small disabled={sound.length < 2} onClick={() => edit("تحويل إلى مونو", (chs) => [chs[0].map((v, i) => (v + chs[1][i]) / 2)])} title="يجمع اليمين واليسار في قناة واحدة">إلى مونو</Btn>
          <Btn small disabled={sound.length < 2} onClick={() => edit("القناة اليسرى فقط", (chs) => [chs[0]])}>اليسرى فقط</Btn>
          <Btn small disabled={sound.length < 2} onClick={() => edit("القناة اليمنى فقط", (chs) => [chs[1]])}>اليمنى فقط</Btn>
          <Btn small disabled={sound.length < 2} onClick={() => edit("تبديل اليمين واليسار", (chs) => [chs[1], chs[0]])}>بدّل الجهتين</Btn>
          <Btn small disabled={sound.length > 1} onClick={() => edit("تحويل إلى ستيريو", (chs) => [chs[0], chs[0].slice()])} title="نفس الصوت في القناتين (لمؤثرات تحتاج ملفًا ستيريو)">إلى ستيريو</Btn>
        </div>
        <div className="rv-toolgroup">
          <span>مستوى المقطع في المكس</span>
          <Slider label="المستوى" value={clip.gain} min={-24} max={12} step={0.5} unit="dB" def={0} onChange={(v) => store.set((p) => patchClip(p, clip.id, { gain: v }), { merge: `cg${clip.id}` })} />
        </div>
      </div>
    </div>
  );
}
