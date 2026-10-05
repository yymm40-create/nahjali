"use client";

import { useEffect, useRef, useState } from "react";
import SmartCoin from "@/components/SmartCoin";
import { generatorById } from "@config/jawad/generators";
import type { JobView, OutputView } from "@/lib/jawad/labels";
import { cutRange, EDIT_LIMITS, frameTimes, type EditMode, type EditRange } from "@/lib/jawad/smart-edit";
import Dialog from "../Dialog";
import Icon from "../Icon";
import { grabFrames } from "./frames";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const fmt = (s: number) => (Number.isFinite(s) ? s.toFixed(1) : "—");

const CHOICES: Record<"video" | "image", { mode: EditMode; title: string; text: string; icon: string }[]> = {
  video: [
    { mode: "whole", title: "أعد المقطع كاملًا", text: "يكتب «المخرج الخارق» برومبتًا جديدًا يصلح الأخطاء ويحافظ على ما نجح، ثم يولَّد المقطع كله من جديد بنفس الإعدادات والمراجع.", icon: "retry" },
    { mode: "parts", title: "أعد الجزء الذي لم ينجح فقط", text: "يولَّد الجزء المحدد وحده، ويبدأ وينتهي بنفس لقطتي الأصل عند نقطتي القص، لتركّبه مكانه بقصّ نظيف.", icon: "frames" },
  ],
  image: [
    { mode: "same", title: "عدّل نفس الصورة", text: "تُرسل صورتك نفسها للمولد مع تعديلاتك، ويبقى كل ما لم تطلب تغييره كما هو.", icon: "wand" },
    { mode: "full", title: "أعد الصورة كاملة", text: "يكتب Claude برومبتًا جديدًا من برومبتك السابق وتعديلاتك، وتُصنع الصورة من جديد.", icon: "retry" },
  ],
};

/** «التعديل الذكي» of a finished video or image: pick the kind of edit, write what to fix, see the price, generate. */
export default function SmartEdit({ job, open, onClose, onCreated }: { job: JobView; open: boolean; onClose: () => void; onCreated: (j: JobView, balance: number | null) => void }) {
  const kind = job.outputKind === "video" ? "video" : "image";
  const def = generatorById(job.generatorId);
  const durOpt = def?.options.find((o) => o.key === "duration" && o.kind === "int") as { min?: number; max?: number } | undefined;
  const [outIdx, setOutIdx] = useState(0);
  const out: OutputView | undefined = job.outputs[outIdx];
  const videoSec = (out?.durationMs ?? Number(job.settings.duration) * 1000) / 1000;
  const [mode, setMode] = useState<EditMode | null>(null);
  const [notes, setNotes] = useState("");
  const [ranges, setRanges] = useState<EditRange[]>([]);
  const [quote, setQuote] = useState<{ coins: number; lines: { label: string; centi: number }[] } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const key = useRef<string | null>(null);
  const player = useRef<HTMLVideoElement>(null);

  const part = mode === "parts" ? (ranges[0] ?? null) : null;
  const cut = part && Number.isFinite(part.from) && Number.isFinite(part.to) ? cutRange(part.from, part.to, videoSec, durOpt?.min ?? 4, durOpt?.max ?? 15) : null;
  const rangesOk = mode !== "parts" || Boolean(cut);
  const body = { jobId: job.id, outputId: out?.id, mode, notes, ranges };
  const quoteKey = JSON.stringify([out?.id, mode, ranges.map((r) => [r.from, r.to])]);

  // The price (again whenever the kind of edit or the marked times change)
  useEffect(() => {
    if (!open || !mode || !rangesOk) return;
    let live = true;
    const t = setTimeout(async () => {
      const res = await fetch("/api/jawad/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, quote: true, notes: "" }) }).catch(() => null);
      const r = res ? await res.json().catch(() => ({})) : {};
      if (!live) return;
      if (res?.ok) {
        setQuote({ coins: r.coins, lines: r.lines });
        setQuoteError("");
      } else {
        setQuote(null);
        setQuoteError(r.error ?? "تعذّر حساب السعر.");
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quoteKey, rangesOk]);

  const reset = () => {
    setMode(null);
    setNotes("");
    setRanges([]);
    setQuote(null);
    setError("");
    setBusy(null);
    key.current = null;
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };
  const choose = (m: EditMode) => {
    setMode(m);
    setRanges(m === "parts" ? [{ from: 0, to: Math.min(videoSec, durOpt?.min ?? 4), note: "" }] : []);
    setQuote(null);
    setError("");
  };
  const setRange = (i: number, patch: Partial<EditRange>) => setRanges((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const now = () => Math.round((player.current?.currentTime ?? 0) * 10) / 10;

  async function generate() {
    if (!mode || !out?.url || !quote) return;
    if (notes.trim().length < 3 && !ranges.some((r) => r.note.trim().length >= 3)) return setError("اكتب الأخطاء والتعديل المطلوب.");
    setError("");
    key.current ??= uid();
    const send: Record<string, unknown> = { ...body, idempotencyKey: key.current, expectedCoins: quote.coins };
    try {
      if (kind === "video") {
        setBusy("يجهّز لقطات المقطع…");
        const times = frameTimes(videoSec, ranges, cut);
        const small = await grabFrames(out.url, times, EDIT_LIMITS.frameWidth, 0.72);
        send.frames = times.map((t, i) => ({ t, data: small[i] }));
        if (mode === "parts" && cut) {
          const [first, last] = await grabFrames(out.url, [cut.start, cut.end], null, 0.92);
          send.cutFrames = { first, last };
        }
      }
    } catch {
      setBusy(null);
      return setError("تعذّر قراءة لقطات المقطع في المتصفح؛ جرّب مرة ثانية.");
    }
    setBusy("يرسل التعديل…");
    const res = await fetch("/api/jawad/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(send) }).catch(() => null);
    const r = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (res?.ok && r.job) {
      reset();
      onCreated(r.job as JobView, (r.balance as number | null) ?? null);
      return;
    }
    if (res?.status === 409 && r.code === "price_changed") {
      setQuote({ coins: r.coins, lines: r.lines });
      return setError(`تغيّر السعر إلى ${r.coins} نقدة. اضغط «توليد التعديل» مرة ثانية للتأكيد.`);
    }
    if (res) key.current = null;
    setError(r.error ?? "تعذّر بدء التعديل؛ جرّب مرة ثانية (لن يتكرر الخصم).");
  }

  return (
    <Dialog open={open} onClose={close} title="التعديل الذكي" wide>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-jw-line bg-black">
            {out?.url && kind === "video" ? (
              <video ref={player} src={out.url} crossOrigin="anonymous" controls playsInline preload="metadata" className="max-h-[50dvh] w-full object-contain" />
            ) : out?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={out.url} alt="" className="max-h-[50dvh] w-full object-contain" />
            ) : (
              <p className="p-6 text-center text-sm text-jw-muted">الملف غير متاح</p>
            )}
          </div>
          {job.outputs.length > 1 && (
            <div className="flex gap-2" role="radiogroup" aria-label="أي صورة تعدّل؟">
              {job.outputs.map((o, i) => (
                <button key={o.id} type="button" role="radio" aria-checked={i === outIdx} onClick={() => setOutIdx(i)} className={`size-14 overflow-hidden rounded-md border-2 ${i === outIdx ? "border-jw-accent" : "border-jw-line"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {o.url && <img src={o.url} alt={`الصورة ${i + 1}`} className="size-full object-cover" />}
                </button>
              ))}
            </div>
          )}
          {kind === "video" && <p className="text-[11px] text-jw-muted">شغّل المقطع وأوقفه عند الخطأ، ثم استخدم «من هنا» و«إلى هنا» لتحديد الثواني.</p>}
        </div>

        <div className="space-y-3">
          {!mode ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">وش تبي تعيد؟</p>
              {CHOICES[kind].map((c) => (
                <button key={c.mode} type="button" onClick={() => choose(c.mode)} className="flex w-full items-start gap-3 rounded-xl border border-jw-line bg-jw-bg-2 p-3 text-start transition hover:border-jw-accent">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-jw-accent-soft text-jw-accent"><Icon name={c.icon} size={18} /></span>
                  <span>
                    <span className="block text-sm font-semibold">{c.title}</span>
                    <span className="block text-xs text-jw-muted">{c.text}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <button type="button" className="flex items-center gap-1 text-xs text-jw-muted hover:text-jw-ink" onClick={() => !busy && setMode(null)}>
                <Icon name="retry" size={12} /> {CHOICES[kind].find((c) => c.mode === mode)?.title} · غيّر
              </button>

              {kind === "video" && (
                <div className="space-y-2">
                  {ranges.map((r, i) => (
                    <div key={i} className="space-y-1.5 rounded-lg border border-jw-line bg-jw-bg-2 p-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold">{mode === "parts" ? "الجزء الذي لم ينجح" : `جزء ${i + 1}`}</span>
                        <label className="flex items-center gap-1">
                          من
                          <input type="number" min={0} max={videoSec} step={0.1} dir="ltr" className="jw-input !min-h-8 w-20 !px-2 !py-1 text-xs" value={Number.isFinite(r.from) ? r.from : ""} onChange={(e) => setRange(i, { from: Number(e.target.value) })} />
                        </label>
                        <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-[11px]" onClick={() => setRange(i, { from: now() })}>من هنا</button>
                        <label className="flex items-center gap-1">
                          إلى
                          <input type="number" min={0} max={videoSec} step={0.1} dir="ltr" className="jw-input !min-h-8 w-20 !px-2 !py-1 text-xs" value={Number.isFinite(r.to) ? r.to : ""} onChange={(e) => setRange(i, { to: Number(e.target.value) })} />
                        </label>
                        <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-[11px]" onClick={() => setRange(i, { to: now() })}>إلى هنا</button>
                        <span className="text-jw-faint">ثانية</span>
                        {mode === "whole" && (
                          <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon !min-h-8 ms-auto" aria-label="احذف الجزء" onClick={() => setRanges((rs) => rs.filter((_, j) => j !== i))}>
                            <Icon name="x" size={14} />
                          </button>
                        )}
                      </div>
                      <input className="jw-input !min-h-9 text-xs" maxLength={EDIT_LIMITS.noteMax} placeholder="وش الخطأ في هذا الجزء؟ (اختياري)" value={r.note} onChange={(e) => setRange(i, { note: e.target.value })} />
                    </div>
                  ))}
                  {mode === "whole" && ranges.length < EDIT_LIMITS.rangesMax && (
                    <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs" onClick={() => setRanges((rs) => [...rs, { from: now(), to: Math.min(videoSec, now() + 1), note: "" }])}>
                      <Icon name="plus" size={14} /> حدّد ثواني فيها خطأ (اختياري)
                    </button>
                  )}
                  {mode === "parts" &&
                    (cut ? (
                      <p className="rounded-lg bg-jw-accent-soft px-2.5 py-2 text-xs">
                        يُعاد الجزء من <b dir="ltr">{fmt(cut.start)}</b> إلى <b dir="ltr">{fmt(cut.end)}</b> ثانية ({cut.seconds} ث{cut.seconds > (part ? part.to - part.from : 0) + 0.05 ? ` — أقل مدة يولّدها ${def?.name ?? "المولد"} ${durOpt?.min ?? 4} ث` : ""})، ويبدأ وينتهي بنفس لقطتي الأصل؛ ركّبه مكان هذا الجزء.
                      </p>
                    ) : (
                      <p className="text-xs text-jw-danger">حدّد جزءًا صحيحًا داخل مدة المقطع ({fmt(videoSec)} ث).</p>
                    ))}
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-sm font-semibold">{kind === "video" ? "الأخطاء والتعديل المطلوب" : "التعديلات المطلوبة بدقة"}</span>
                <textarea
                  className="jw-textarea min-h-28 text-sm"
                  maxLength={EDIT_LIMITS.notesMax}
                  dir="auto"
                  placeholder={
                    kind === "video"
                      ? "مثال: في الثانية 3 تتشوّه يد البطل، وحركة الكاميرا سريعة في آخر المقطع. أبي الحركة أهدأ والإضاءة أدفأ."
                      : "اكتب بدقة: وش تغيّر، وفين في الصورة، وكيف… مثال: غيّر لون الثوب للأبيض، وصحّح الكتابة على اللوحة لتصير «نهج علي»."
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>

              <div className="space-y-1 rounded-lg border border-jw-line p-2.5 text-xs" aria-live="polite">
                {quote ? (
                  <>
                    {quote.lines.map((l, i) => (
                      <p key={i} className="flex justify-between gap-2 text-jw-muted">
                        <span>{l.label}</span>
                        <span dir="ltr" className="tabular-nums">{(l.centi / 100).toFixed(2)}</span>
                      </p>
                    ))}
                    <p className="flex justify-between gap-2 border-t border-jw-line pt-1 font-semibold">
                      <span>المجموع</span>
                      <span dir="ltr" className="flex items-center gap-1 tabular-nums"><SmartCoin size={12} /> {quote.coins}</span>
                    </p>
                    <p className="text-[11px] text-jw-faint">{kind === "video" ? "يكتب Claude البرومبت الجديد بمهارة «المخرج الخارق» من برومبتك السابق ولقطات المقطع وتعديلاتك." : "يكتب Claude البرومبت الجديد من برومبتك السابق والصورة وتعديلاتك."} إذا تعذّر التعديل تُعاد نقودك كاملة.</p>
                  </>
                ) : (
                  <p className="text-jw-muted">{quoteError || (rangesOk ? "يحسب السعر…" : "حدّد الجزء أولًا.")}</p>
                )}
              </div>

              {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="jw-btn" disabled={Boolean(busy)} onClick={close}>إلغاء</button>
                <button type="button" className="jw-btn jw-btn-primary" disabled={!quote || Boolean(busy) || !rangesOk || !out?.url} onClick={generate}>
                  {busy ? (
                    <>
                      <span className="jw-spinner" aria-hidden /> {busy}
                    </>
                  ) : (
                    <>
                      <Icon name="wand" size={16} /> توليد التعديل
                      {quote && (
                        <span className="flex items-center gap-1 rounded-full bg-black/25 px-1.5 py-0.5 text-xs tabular-nums" dir="ltr">
                          <SmartCoin size={12} /> {quote.coins}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
