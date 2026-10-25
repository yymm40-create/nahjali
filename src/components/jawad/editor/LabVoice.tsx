"use client";

// «🎙️ بصوتي» in «مختبر الموشن»: the person reads the narration حيدرا ماكس wrote, in their own voice (recorded here or a
// file of theirs) — Claude Code cleans it (its silences, hum and level, the same program-and-review as «بصمة صوتك»),
// and the page measures WHEN each line is said, so the motion is built on the words. Nothing else touches the voice:
// no text-to-speech, no clone; it is the person's own recording in the film.

import { useEffect, useRef, useState } from "react";
import { cleanVoice, decodeMono } from "@/components/claude-code/clean-voice";
import { voiceLines, type VoiceLine } from "@/lib/editor/scene/voice-lines";

export interface LabVoiceTake {
  blob: Blob;
  url: string;
  seconds: number;
  lines: VoiceLine[];
  /** what Claude Code said about the cleaning */
  note: string;
}

export default function LabVoice({ script, model, value, onChange, disabled }: { script: string[]; model: string; value: LabVoiceTake | null; onChange: (v: LabVoiceTake | null) => void; disabled?: boolean }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [clean, setClean] = useState(true);
  const [secs, setSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!rec) return;
    const from = Date.now();
    const t = setInterval(() => setSecs((Date.now() - from) / 1000), 200);
    return () => clearInterval(t);
  }, [rec]);
  useEffect(() => () => abort.current?.abort(), []);

  /** The take → cleaned by Claude Code (when ticked) → the lines' times measured from it. */
  const takeIn = async (raw: Blob) => {
    setError("");
    abort.current = new AbortController();
    try {
      let blob = raw, note = "";
      if (clean) {
        try {
          const r = await cleanVoice({ blob: raw, model, from: "editor", purpose: "the narration of a motion-graphics piece: it must stay natural and clear, long pauses shortened to a breath (the motion is timed to it afterwards)", onStep: setStep, signal: abort.current.signal });
          blob = r.blob;
          note = r.line;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") throw e;
          note = `ما نظّفه حيدرا ماكس (${e instanceof Error ? e.message : e}) — استخدمت تسجيلك كما هو.`;
        }
      }
      setStep("أقيس متى تنقال كل جملة…");
      const { samples, rate } = await decodeMono(blob);
      const lines = voiceLines(samples, rate, script);
      if (!lines.length) throw new Error("ما سمعت كلام واضح في التسجيل. قرّب المايك وسجّل من جديد.");
      if (value) URL.revokeObjectURL(value.url);
      onChange({ blob, url: URL.createObjectURL(blob), seconds: samples.length / rate, lines, note });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStep("");
    }
  };

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void takeIn(new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
      };
      r.start(250);
      setSecs(0);
      setRec(r);
    } catch {
      setError("ما قدرنا نفتح المايك. اسمح للموقع يستخدمه، أو ارفع تسجيلك كملف.");
    }
  };
  const stop = () => {
    rec?.stop();
    setRec(null);
  };

  const busy = Boolean(step) || disabled;
  return (
    <div className="mlab-card flex flex-col gap-3">
      <h3 className="!text-lg">🎙️ صوتك: اقرأ النص وسجّله</h3>
      {script.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {script.map((l, i) => {
            const got = value?.lines[i];
            return (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-white/5 p-2 text-[1.05rem] leading-8">
                <b className="tabular-nums text-sm opacity-70">{i + 1}</b>
                <span className="flex-1">{l}</span>
                {got && <span className="mlab-tip tabular-nums" dir="ltr">{got.from.toFixed(1)}–{got.to.toFixed(1)}s</span>}
              </li>
            );
          })}
        </ol>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={clean} onChange={(e) => setClean(e.target.checked)} disabled={busy || Boolean(rec)} />
        <span><b>🧑‍💻 حيدرا ماكس ينظّف التسجيل</b> <span className="mlab-tip">(السكتات الطويلة، الطنين، توزين الصوت) قبل ما يبني عليه</span></span>
      </label>
      <div className="flex flex-wrap gap-2">
        {rec ? (
          <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base" onClick={stop}>
            ⏹️ وقّف التسجيل · <span className="tabular-nums">{secs.toFixed(0)}</span> ث
          </button>
        ) : (
          <button type="button" className="jw-btn jw-btn-primary !min-h-12 !text-base" disabled={busy} onClick={start}>
            🎙️ {value ? "سجّل من جديد" : "ابدأ التسجيل"}
          </button>
        )}
        <label className={`jw-btn !min-h-12 cursor-pointer ${busy || rec ? "pointer-events-none opacity-60" : ""}`}>
          📁 ارفع تسجيلك
          <input type="file" accept="audio/*,.m4a,.mp3,.wav" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void takeIn(f); }} />
        </label>
        {value && !busy && !rec && (
          <button type="button" className="jw-btn !min-h-12" onClick={() => onChange(null)}>
            احذفه
          </button>
        )}
      </div>
      {step && (
        <p className="m-0 flex items-center gap-2 font-bold" role="status">
          <span className="jw-spinner" aria-hidden /> {step}
          <button type="button" className="jw-btn !min-h-8 !px-3 text-sm" onClick={() => abort.current?.abort()}>إلغاء</button>
        </p>
      )}
      {value && !step && (
        <div className="flex flex-col gap-1.5">
          <audio controls src={value.url} className="w-full" />
          <p className="mlab-tip m-0 whitespace-pre-line">✓ {value.seconds.toFixed(1)} ث · {value.lines.length} جملة على وقتها{value.note ? `\n${value.note}` : ""}</p>
        </div>
      )}
      {error && <p className="mlab-error m-0">{error}</p>}
      <p className="mlab-tip m-0">صوتك نفسه يدخل الفيلم، ما فيه صوت مولّد ولا نسخة من صوتك. وحيدرا ماكس يبني الحركة على كلامك: كل فكرة تطلع وقت ما تقولها.</p>
    </div>
  );
}
