"use client";

// «الرضا فويس» — «معايرة التأخير». When someone records over a playing track, what they sing arrives late by the
// time sound takes to leave the device and come back in — a few milliseconds on wires, a quarter of a second on
// Bluetooth headphones. That delay is taken off every recording. The browser reports an estimate; this dialog
// MEASURES it (beeps played and heard back) and remembers the answer on the device.

import { useState } from "react";
import type { Engine } from "./engine";
import { Btn, Slider } from "./ui";

const KEY = "ridha:latency";
export function loadLatency(): { roundTrip: number | null; trim: number } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { roundTrip?: unknown; trim?: unknown };
    return { roundTrip: typeof v.roundTrip === "number" ? v.roundTrip : null, trim: typeof v.trim === "number" ? v.trim : 0 };
  } catch {
    return { roundTrip: null, trim: 0 };
  }
}
const save = (roundTrip: number | null, trim: number) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ roundTrip, trim }));
  } catch {}
};

export default function LatencyDialog({ engine, onClose }: { engine: Engine; onClose(): void }) {
  const [measured, setMeasured] = useState(engine.roundTripMs);
  const [trim, setTrim] = useState(engine.latencyTrimMs);
  const [state, setState] = useState<"idle" | "busy" | "failed" | "denied">("idle");
  const [reported, setReported] = useState(() => engine.reportedLatencyMs());

  const apply = (m: number | null, t: number) => {
    engine.setLatency(m, t);
    setMeasured(m);
    setTrim(t);
    save(m, t);
  };
  const measure = async () => {
    setState("busy");
    try {
      const ms = await engine.measureLatency();
      setReported(engine.reportedLatencyMs());
      if (ms == null) return setState("failed");
      apply(ms, trim);
      setState("idle");
    } catch {
      setState("denied");
    }
  };
  const used = (measured ?? reported) + trim;

  return (
    <div className="rv-dialog" role="dialog" aria-label="معايرة التأخير" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rv-dialog-card">
        <h3>معايرة التأخير</h3>
        <p>لما تسجّل على مسار والمسارات الثانية تشتغل، صوتك يوصل متأخرًا بقدر ما يأخذه الصوت في الطريق للسماعة ومنها للمايك. البرنامج يطرح هذا التأخير من كل تسجيل فيجلس صوتك في مكانه بالضبط.</p>
        <div className="rv-bigstat" dir="ltr">
          <div><b>{reported} ms</b><span dir="rtl">تقدير المتصفح</span></div>
          <div className="gold"><b>{measured != null ? `${measured} ms` : "—"}</b><span dir="rtl">القياس الفعلي</span></div>
          <div><b>{used} ms</b><span dir="rtl">المستخدم الآن</span></div>
        </div>
        <ol>
          <li><b>سماعة بلوتوث:</b> قرّب إحدى السماعتين من مايك الجهاز (والأفضل تسجّل بمايك الجهاز أو مايك سلكي لا بمايك السماعة).</li>
          <li><b>سماعة سلكية أو سماعات خارجية:</b> قرّبها من المايك أو ارفع الصوت.</li>
          <li>اضغط «قِس الآن»: تسمع خمس صفارات قصيرة خلال أربع ثوانٍ.</li>
        </ol>
        <div className="rv-row">
          <Btn kind="main" disabled={state === "busy"} onClick={() => void measure()}>{state === "busy" ? "يقيس… خلّ المكان هادئ" : "قِس الآن"}</Btn>
          {measured != null ? <Btn kind="ghost" onClick={() => apply(null, trim)}>امسح القياس</Btn> : null}
        </div>
        {state === "failed" ? <p style={{ color: "var(--rv-rec)" }}>ما سمعت الصفارات بوضوح. قرّب السماعة أكثر من المايك، ارفع صوت الجهاز، وجرّب مرة ثانية.</p> : null}
        {state === "denied" ? <p style={{ color: "var(--rv-rec)" }}>تعذّر فتح المايكروفون. اسمح له من إعدادات الصفحة.</p> : null}
        <Slider label="تعديل يدوي دقيق (لو حسّيت التسجيل سابق أو متأخر)" value={trim} min={-150} max={300} step={1} unit="ms" def={0} onChange={(v) => apply(measured, v)} wide />
        <p>القياس يُحفظ على هذا الجهاز. لو غيّرت السماعة (من سلكية لبلوتوث مثلًا) أعد القياس.</p>
        <div className="rv-row" style={{ justifyContent: "flex-end" }}>
          <Btn onClick={onClose}>تم</Btn>
        </div>
      </div>
    </div>
  );
}
