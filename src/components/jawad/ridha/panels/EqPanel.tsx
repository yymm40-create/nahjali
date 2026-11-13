"use client";

// «الرضا فويس» — the equalizer: the track's live spectrum behind, the curve in front, and a dot per band to drag
// (sideways = which frequency, up and down = how much, the wheel = how narrow). Ready curves along the top.

import { useCallback, useEffect, useRef, useState } from "react";
import { EQ_PRESETS } from "@config/ridha";
import { defaultBands, SR, type EqBand, type Fx } from "@/lib/ridha/model";
import { addFx, patchFx } from "@/lib/ridha/ops";
import { applyBand } from "../engine";
import { useStudio } from "../ctx";
import { Btn, Empty, Seg, Slider } from "../ui";
import { TargetPicker, useTarget } from "./FxPanel";

const FMIN = 20, FMAX = 20000, DB = 18;
const BAND_COLORS = ["#ff8a6b", "#e9b949", "#b6e35a", "#2fd6c3", "#5db8ff", "#8f8cff", "#f27fc4", "#c9a37a"];
const TYPE_NAMES: Record<EqBand["type"], string> = { highpass: "قص الواطي", lowshelf: "رف واطي", peaking: "جرس", highshelf: "رف عالي", lowpass: "قص العالي" };

let scratch: OfflineAudioContext | null = null;
/** The curve of a set of bands at `freqs`, in dB — asked of the browser's own filters, so it is exactly what is heard. */
function curveOf(bands: EqBand[], freqs: Float32Array<ArrayBuffer>): Float32Array {
  scratch ??= new OfflineAudioContext(1, 1, SR);
  const total = new Float32Array(freqs.length);
  const mag = new Float32Array(freqs.length), phase = new Float32Array(freqs.length);
  for (const b of bands) {
    if (!b.on) continue;
    const node = scratch.createBiquadFilter();
    applyBand(scratch, node, b);
    node.getFrequencyResponse(freqs, mag, phase);
    for (let i = 0; i < freqs.length; i++) total[i] += 20 * Math.log10(Math.max(mag[i], 1e-6));
  }
  return total;
}

export default function EqPanel() {
  const st = useStudio();
  const { store, engine } = st;
  const { where, fx } = useTarget();
  const eq = fx.find((f) => f.kind === "eq") ?? null;
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 220 });
  const [sel, setSel] = useState(2);
  const eqRef = useRef<Fx | null>(eq);
  useEffect(() => {
    eqRef.current = eq;
  }, [eq]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [eq?.id]);

  const fx2x = useCallback((f: number) => (Math.log(f / FMIN) / Math.log(FMAX / FMIN)) * size.w, [size.w]);
  const x2f = useCallback((x: number) => FMIN * (FMAX / FMIN) ** (x / size.w), [size.w]);
  const db2y = useCallback((d: number) => size.h / 2 - (d / DB) * (size.h / 2 - 14), [size.h]);
  const y2db = useCallback((y: number) => ((size.h / 2 - y) / (size.h / 2 - 14)) * DB, [size.h]);

  // the picture is redrawn every frame: the spectrum moves under a curve that only changes when a band does
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const g = c.getContext("2d")!;
    const freqs = new Float32Array(Math.max(2, Math.round(size.w / 2)));
    for (let i = 0; i < freqs.length; i++) freqs[i] = x2f((i / (freqs.length - 1)) * size.w);
    const spec = new Float32Array(2048);
    const smooth = new Float32Array(freqs.length).fill(-120);
    let raf = 0;
    const draw = () => {
      const cur = eqRef.current;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size.w, size.h);
      g.font = "10px ui-monospace, Menlo, monospace";
      g.textBaseline = "top";
      for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
        g.fillStyle = "rgba(255,255,255,0.06)";
        g.fillRect(Math.round(fx2x(f)), 0, 1, size.h);
        g.fillStyle = "rgba(163,171,185,0.6)";
        g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), fx2x(f) + 3, size.h - 13);
      }
      for (const d of [-12, -6, 0, 6, 12]) {
        g.fillStyle = d === 0 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)";
        g.fillRect(0, Math.round(db2y(d)), size.w, 1);
        g.fillStyle = "rgba(163,171,185,0.5)";
        g.fillText(`${d > 0 ? "+" : ""}${d}`, 4, db2y(d) + 2);
      }
      // the sound right now
      const n = engine.spectrum(spec, where === "master" ? undefined : where);
      if (n) {
        g.beginPath();
        g.moveTo(0, size.h);
        for (let i = 0; i < freqs.length; i++) {
          const bin = Math.min(n - 1, Math.max(1, Math.round((freqs[i] / (SR / 2)) * n)));
          const v = Number.isFinite(spec[bin]) ? spec[bin] : -120;
          smooth[i] = v > smooth[i] ? v : smooth[i] * 0.9 + v * 0.1;
          // a tilt of 3 dB an octave, as analysers show it: a natural voice reads level instead of falling
          const tilted = smooth[i] + 3 * Math.log2(freqs[i] / 1000);
          g.lineTo((i / (freqs.length - 1)) * size.w, size.h - Math.max(0, Math.min(1, (tilted + 95) / 80)) * size.h);
        }
        g.lineTo(size.w, size.h);
        g.closePath();
        g.fillStyle = "rgba(47,214,195,0.13)";
        g.fill();
      }
      if (cur?.bands) {
        const curve = curveOf(cur.on ? cur.bands : [], freqs as Float32Array<ArrayBuffer>);
        g.beginPath();
        for (let i = 0; i < freqs.length; i++) {
          const x = (i / (freqs.length - 1)) * size.w, y = db2y(Math.max(-DB * 1.4, Math.min(DB * 1.4, curve[i])));
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.strokeStyle = cur.on ? "#e9b949" : "rgba(233,185,73,0.3)";
        g.lineWidth = 2.2;
        g.stroke();
        g.lineTo(size.w, db2y(0));
        g.lineTo(0, db2y(0));
        g.closePath();
        g.fillStyle = "rgba(233,185,73,0.08)";
        g.fill();
        cur.bands.forEach((b, i) => {
          const x = fx2x(b.freq), y = db2y(b.type === "highpass" || b.type === "lowpass" ? 0 : b.gain);
          g.beginPath();
          g.arc(x, y, i === sel ? 9 : 7, 0, 7);
          g.fillStyle = b.on ? BAND_COLORS[i] : "rgba(120,130,145,0.5)";
          g.globalAlpha = b.on ? 1 : 0.6;
          g.fill();
          g.globalAlpha = 1;
          if (i === sel) {
            g.lineWidth = 2;
            g.strokeStyle = "#fff";
            g.stroke();
          }
          g.fillStyle = "#0b1016";
          g.font = "700 9px system-ui";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(String(i + 1), x, y + 0.5);
          g.textAlign = "start";
          g.textBaseline = "top";
          g.font = "10px ui-monospace, Menlo, monospace";
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, engine, where, sel, fx2x, x2f, db2y]);

  const setBand = useCallback((i: number, patch: Partial<EqBand>, merge = true) => {
    const cur = eqRef.current;
    if (!cur?.bands) return;
    const bands = cur.bands.map((b, k) => (k === i ? { ...b, ...patch } : b));
    store.set((p) => patchFx(p, where, cur.id, { bands }), merge ? { merge: `eq${cur.id}-${i}` } : {});
  }, [store, where]);

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!eq?.bands) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = 22;
    eq.bands.forEach((b, i) => {
      const d = Math.hypot(fx2x(b.freq) - x, db2y(b.type === "highpass" || b.type === "lowpass" ? 0 : b.gain) - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) return;
    setSel(best);
    el.setPointerCapture(e.pointerId);
    const band = eq.bands[best];
    const move = (ev: PointerEvent) => {
      const f = Math.max(FMIN, Math.min(FMAX, x2f(ev.clientX - r.left)));
      const pass = band.type === "highpass" || band.type === "lowpass";
      setBand(best, { on: true, freq: Math.round(f), ...(pass ? {} : { gain: Math.round(Math.max(-DB, Math.min(DB, y2db(ev.clientY - r.top))) * 10) / 10 }) });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  if (!where) return <Empty icon="" title="اختر مسارًا" />;
  if (!eq) {
    return (
      <div className="rv-eq-empty">
        <TargetPicker />
        <Empty icon="" title="ما على هذا المسار إكولايزر بعد">يشكّل نبرة الصوت: يقص الهدير، يشيل الطين، ويرفع الوضوح.</Empty>
        <Btn kind="main" onClick={() => store.set((p) => addFx(p, where, "eq").project)}>＋ أضف إكولايزر</Btn>
      </div>
    );
  }
  const b = eq.bands?.[sel] ?? eq.bands?.[0];
  const pass = b?.type === "highpass" || b?.type === "lowpass";
  return (
    <div className="rv-eq">
      <div className="rv-panel-head">
        <button type="button" className={`rv-power${eq.on ? " on" : ""}`} onClick={() => store.set((p) => patchFx(p, where, eq.id, { on: !eq.on }))} aria-label="تشغيل الإكولايزر" title="قبل / بعد" />
        <b>الإكولايزر</b>
        <TargetPicker />
        <div className="rv-pills rv-pills-scroll">
          {EQ_PRESETS.map((pr) => (
            <button key={pr.name} type="button" title={pr.hint} onClick={() => {
              const base = defaultBands();
              store.set((p) => patchFx(p, where, eq.id, { on: true, bands: base.map((d, i) => ({ ...d, ...(pr.bands[i] ?? {}) })) }));
            }}>{pr.name}</button>
          ))}
        </div>
      </div>
      <div className="rv-eq-graph" ref={box} dir="ltr">
        <canvas ref={canvas} style={{ width: size.w, height: size.h }} onPointerDown={onDown} onDoubleClick={() => b && setBand(sel, { on: !b.on }, false)} onWheel={(e) => b && setBand(sel, { q: Math.max(0.2, Math.min(12, b.q * Math.exp(-e.deltaY * 0.002))) })} />
      </div>
      {b ? (
        <div className="rv-eq-band">
          <span className="rv-eq-dot" style={{ background: BAND_COLORS[sel] }}>{sel + 1}</span>
          <Seg small value={b.on ? "on" : "off"} options={[{ value: "on", label: "شغّال" }, { value: "off", label: "مطفأ" }]} onChange={(v) => setBand(sel, { on: v === "on" }, false)} />
          <span className="rv-muted">{TYPE_NAMES[b.type]}</span>
          <Slider label="التردد" value={b.freq} min={FMIN} max={FMAX} step={1} unit="Hz" log onChange={(v) => setBand(sel, { freq: v, on: true })} />
          {pass ? null : <Slider label="المقدار" value={b.gain} min={-DB} max={DB} step={0.1} unit="dB" def={0} onChange={(v) => setBand(sel, { gain: v, on: true })} />}
          <Slider label={pass ? "حدّة الانحدار" : "العرض (Q)"} value={b.q} min={0.2} max={12} step={0.01} log def={1.2} onChange={(v) => setBand(sel, { q: v })} />
          <span className="rv-muted rv-eq-tip">اسحب النقاط على الرسم · نقرتان تطفئ النقطة · العجلة تغيّر العرض</span>
        </div>
      ) : null}
    </div>
  );
}
