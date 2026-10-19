"use client";

// «🧑‍💻 Claude Code» in the image studio: next to the picture generators, a picture DRAWN IN CODE — Claude writes the
// program, it is rendered here, he looks at it and rewrites it until every score passes, and it lands in «أعمالي».
// Exact Arabic writing, crisp shapes and real fonts (no picture model is involved). Paid by Claude's real use.

import { useRef, useState } from "react";
import { useClaudeModel } from "@/components/robots/claude-model";
import Icon from "@/components/jawad/Icon";
import { PICTURE_RUBRIC } from "@/lib/claude-code/picture-rubric";
import { drawWithCode, PHOTOS_MAX, PHOTOS_PER_ROUND, savePicture, smallJpeg, type DrawStep } from "./draw";

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2)}`);

export default function ClaudeCodeCard<J>({ prompt, aspect, styleId, styleText, refUrls, sectionId, disabledReason, onSaved }: {
  prompt: string;
  aspect: string;
  styleId: string;
  styleText: string;
  refUrls: string[];
  sectionId: string;
  /** why it can't start now (not signed in, the platform closed…) */
  disabledReason: string | null;
  onSaved: (job: J) => void;
}) {
  const [claude] = useClaudeModel();
  const [step, setStep] = useState<DrawStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ verdict: string; scores: Record<string, number>; pass: boolean } | null>(null);
  const [error, setError] = useState("");
  /** the attached pictures go INTO the picture as they are (people's photos, a logo), not only as references for the look */
  const [place, setPlace] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function start() {
    if (busy) return;
    if (prompt.trim().length < 2) return setError("اكتب وش تبي في الصورة أول.");
    setBusy(true);
    setError("");
    setDone(null);
    abort.current = new AbortController();
    const key = uid();
    try {
      const references = place ? [] : (await Promise.all(refUrls.slice(0, 4).map(smallJpeg))).filter((x): x is string => !!x);
      const r = await drawWithCode({ prompt, aspect, style: styleText, references, photos: place ? refUrls.slice(0, PHOTOS_MAX) : [], model: claude.id, signal: abort.current.signal, onStep: setStep });
      setStep({ text: "أحفظ الصورة في أعمالك…", preview: step?.preview });
      const saved = await savePicture<{ job: J }>({ idempotencyKey: key, png: r.png, prompt, aspect, sectionId, styleId, model: claude.id, rounds: r.rounds, scores: r.scores });
      onSaved(saved.job);
      setDone({ verdict: r.verdict, scores: r.scores, pass: r.pass });
      setStep(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الرسم.");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <section className="space-y-2 rounded-xl border border-jw-line bg-jw-surface-2 p-3" aria-label="Claude Code">
      <div className="flex items-start gap-2">
        <span className="text-xl" aria-hidden>🧑‍💻</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Claude Code <span className="text-xs font-normal text-jw-muted">· يرسم الصورة بالكود</span></p>
          <p className="text-xs text-jw-muted">بدل مولّد الصور: Claude يكتب برنامج الصورة، يرسمها هنا، يشوفها ويقيّمها ويعيد كتابتها لين تنجح. الكتابة العربية تطلع حرفيًا، والأشكال حادة بأي مقاس. السعر حسب استخدام Claude.</p>
        </div>
      </div>
      {step && (
        <div className="space-y-2" role="status" aria-live="polite">
          {step.preview && (
            // eslint-disable-next-line @next/next/no-img-element -- a picture made in this page
            <img src={step.preview} alt="الصورة الحالية" className="max-h-56 w-full rounded-lg object-contain" />
          )}
          <p className="flex items-center gap-2 text-xs"><span className="jw-spinner" />{step.text}</p>
        </div>
      )}
      {done && (
        <div className="space-y-1 text-xs">
          <p>{done.pass ? "✅" : "⚠️"} {done.verdict}</p>
          <p className="text-jw-muted">{PICTURE_RUBRIC.map((r) => `${r.ar} ${done.scores[r.id] ?? "—"}`).join(" · ")}</p>
          <p className="text-jw-muted">انحفظت في «أعمالي».</p>
        </div>
      )}
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" className="mt-0.5" checked={place} disabled={busy} onChange={(e) => setPlace(e.target.checked)} />
        <span>
          📷 حط الصور المرفقة داخل التصميم كما هي (صور أشخاص مثل الخطيب أو الرادود، أو شعار)
          <span className="block text-jw-faint">{refUrls.length ? `الوجه ينحط بالضبط بدون إعادة رسم (${Math.min(refUrls.length, PHOTOS_MAX)} صورة${refUrls.length > PHOTOS_PER_ROUND ? "، على جولتين" : ""}).` : `أرفق الصور من خانة «المراجع» فوق، حتى ${PHOTOS_PER_ROUND} صور في الجولة وحتى ${PHOTOS_MAX} على جولتين.`}</span>
        </span>
      </label>
      {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="jw-btn flex-1" disabled={busy || !!disabledReason} onClick={() => void start()} title={disabledReason ?? undefined}>
          {busy ? <span className="jw-spinner" /> : <Icon name="sparkles" size={16} />} ارسم بـ Claude Code
        </button>
        {busy && <button type="button" className="jw-btn" onClick={() => abort.current?.abort()}>⏹️ وقّف</button>}
      </div>
      {disabledReason && !busy && <p className="text-[11px] text-jw-faint">{disabledReason}</p>}
    </section>
  );
}
