"use client";

// «الذكاء الإسلامي» — the owner's room: the sources (read, read again, add one, switch one off), the method the
// assistant follows and the persona files, and every answer given (with room for the owner's correction).

import { useCallback, useEffect, useRef, useState } from "react";
import { ISLAMIC_KV } from "@config/islamic";
import type { AnswerRow, Source } from "@/lib/islamic/library";

type View = { sources: Source[]; counts: Record<string, { docs: number; chunks: number }>; kv: Record<string, string>; answers: AnswerRow[]; bytes: number };

async function call<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch("/api/islamic/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "صار خطأ.");
  return j as T;
}

const ADAPTER: Record<string, string> = { thaqalayn: "قارئ الثقلين", almojib: "قارئ المجيب", aqaed: "قارئ مركز الأبحاث", site: "القارئ العام (خريطة الموقع وروابطه)" };

export default function IslamicAdmin() {
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Record<string, string>>({});
  const stop = useRef<Record<string, boolean>>({});
  const [form, setForm] = useState({ name: "", url: "" });
  const [kv, setKv] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [training, setTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/islamic/admin");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "صار خطأ.");
      setV(j as View);
      setKv((j as View).kv);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  // the first load, after the first paint
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /** Reads a source run after run until it reaches the end (or «أوقف»). */
  const read = async (s: Source) => {
    stop.current[s.id] = false;
    setReading((r) => ({ ...r, [s.id]: "بدأ…" }));
    try {
      for (let i = 0; i < 400; i++) {
        if (stop.current[s.id]) break;
        const r = await call<{ saved: number; done: boolean; stage: string; errors: number }>({ action: "read", id: s.id });
        setReading((x) => ({ ...x, [s.id]: `${r.stage} · حُفظ ${r.saved}${r.errors ? ` · أخطاء ${r.errors}` : ""}` }));
        await load();
        if (r.done) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading((x) => {
        const { [s.id]: _gone, ...rest } = x;
        void _gone;
        return rest;
      });
    }
  };

  const runTrain = async () => {
    setTraining(true);
    setTrainMsg(null);
    try {
      const r = await call<{ chunks: number; usd: number }>({ action: "train" });
      setTrainMsg(`✓ قرأ ${r.chunks} نصًا وكتب المسودتين (التكلفة $${r.usd.toFixed(2)}). راجعهم تحت واعتمدهم.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTraining(false);
    }
  };

  const act = async (body: Record<string, unknown>) => {
    try {
      await call(body);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error && !v) return <p className="card p-4 font-bold text-red-700">{error}</p>;
  if (!v) return <p className="text-muted">جارٍ التحميل…</p>;
  const total = v.counts.__all ?? { docs: 0, chunks: 0 };

  return (
    <div className="space-y-8">
      {error && <p className="card p-3 text-sm font-bold text-red-700">{error}</p>}

      {/* ───────── sources ───────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">المصادر</h2>
        <p className="text-sm text-muted">
          المكتبة الآن: <b>{total.docs.toLocaleString("ar")}</b> نص، <b>{total.chunks.toLocaleString("ar")}</b> مقطع للبحث، حجمها في قاعدة البيانات <b>{(v.bytes / 1_048_576).toFixed(0)} MB</b>. «اقرأ» تقرأ الموقع على دفعات وتكمل من وين وقفت، وتقدر توقفها وتكمل بعدين. وإذا شغّلت المؤقّت (ملف SQL رقم 0038) تكمل القراءة لحالها كل ٥ دقايق بدون ما تفتح هذي الصفحة. كتب الحديث كاملة في الثقلين كبيرة (مئات الميجابايت)، وتُقرأ في الأخير.
        </p>
        <ul className="space-y-3">
          {v.sources.map((s) => {
            const c = v.counts[s.id] ?? { docs: 0, chunks: 0 };
            const busy = s.id in reading;
            return (
              <li key={s.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <b className="block">{s.name}</b>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-muted underline">
                      {s.url}
                    </a>
                    <span className="block text-xs text-muted">{ADAPTER[s.adapter] ?? s.adapter}</span>
                  </div>
                  <label className="chip cursor-pointer">
                    <input type="checkbox" checked={s.enabled} onChange={(e) => act({ action: "update", id: s.id, enabled: e.target.checked })} /> يُستخدم في الأجوبة
                  </label>
                </div>
                <p className="text-sm">
                  <b>{c.docs.toLocaleString("ar")}</b> نص محفوظ
                  {s.stats?.lastRunAt && <> · آخر قراءة: {new Date(s.stats.lastRunAt).toLocaleString("ar")}</>}
                  {s.stats?.stage && <> · {s.stats.done ? "✅ اكتملت" : `وقفت عند: ${s.stats.stage}`}</>}
                  {s.stats?.errors ? <span className="text-red-700"> · أخطاء: {s.stats.errors}</span> : null}
                </p>
                {s.stats?.lastError && <p className="text-xs text-red-700">آخر خطأ: {s.stats.lastError}</p>}
                {busy && <p className="text-sm font-bold text-teal">⏳ يقرأ… {reading[s.id]}</p>}
                <div className="flex flex-wrap gap-2">
                  {busy ? (
                    <button type="button" className="btn btn-ghost !min-h-10 !px-4 !text-sm" onClick={() => (stop.current[s.id] = true)}>
                      أوقف بعد هذي الدفعة
                    </button>
                  ) : (
                    <button type="button" className="btn btn-secondary !min-h-10 !px-4 !text-sm" onClick={() => read(s)}>
                      {s.stats?.done ? "اقرأ من جديد (تحديث)" : c.docs ? "كمّل القراءة" : "اقرأ المصدر"}
                    </button>
                  )}
                  {!busy && (c.docs > 0 || (s.stats?.runs ?? 0) > 0) && (
                    <button type="button" className="btn btn-ghost !min-h-10 !px-4 !text-sm" onClick={() => confirm("يحذف كل ما قُرئ من هذا المصدر ويبدأ من الصفر؟") && act({ action: "reset", id: s.id })}>
                      امسح وابدأ من الصفر
                    </button>
                  )}
                  {!busy && s.adapter === "site" && (
                    <button type="button" className="btn btn-ghost !min-h-10 !px-4 !text-sm text-red-700" onClick={() => confirm("يحذف المصدر وكل نصوصه؟") && act({ action: "remove", id: s.id })}>
                      احذف المصدر
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <form
          className="card space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "add", ...form }).then(() => setForm({ name: "", url: "" }));
          }}
        >
          <b>أضف مصدرًا</b>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" placeholder="اسم المصدر" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="اسم المصدر" />
            <input className="field" dir="ltr" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} aria-label="رابط المصدر" required />
          </div>
          <p className="text-xs text-muted">يُقرأ بالقارئ العام: خريطة الموقع إن وُجدت، وإلا روابط صفحاته، حتى {600..toLocaleString("ar")} صفحة. الموقع اللي صفحاته ترسم في المتصفح بس (بدون نص) يحتاج قارئ خاص: قل لي وأبنيه.</p>
          <button type="submit" className="btn btn-primary !min-h-10 !px-5 !text-sm">
            أضف
          </button>
        </form>
      </section>

      {/* ───────── understanding: the persona and analysis files, extracted from the library ───────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">الفهم: استخراج الشخصية من المصادر</h2>
        <div className="card space-y-3 p-4">
          <p className="text-sm text-muted">
            يقرأ عينة واسعة من المكتبة (من كل مصدر ومن كل نوع) ويكتب مسودتين: <b>ملف الأخلاق والأسلوب</b> و<b>منهج التحليل</b>، وكل نقطة معها مصدرها. راجعهم، عدّل ما تبي، ثم «اعتمد» عشان يصيرون جزءًا من كل جواب. تقدر تعيد الاستخراج بعد ما تكبر المكتبة. يأخذ ٢ إلى ٤ دقايق ويكلّف دولار تقريبًا.
          </p>
          <button type="button" className="btn btn-secondary !min-h-10 !px-5 !text-sm" disabled={training} onClick={() => void runTrain()}>
            {training ? "⏳ يقرأ ويستخرج…" : "استخرج من المصادر"}
          </button>
          {trainMsg && <p className="text-sm font-bold text-teal">{trainMsg}</p>}
        </div>
        {(
          [
            [ISLAMIC_KV.personaDraft, ISLAMIC_KV.persona, "persona", "مسودة ملف الأخلاق والأسلوب"],
            [ISLAMIC_KV.analysisDraft, ISLAMIC_KV.analysis, "analysis", "مسودة منهج التحليل"],
          ] as const
        ).map(([draftKey, liveKey, which, label]) => (
          <div key={draftKey} className="card space-y-2 p-4">
            <label className="block">
              <b>{label}</b>
              <span className="block text-xs text-muted">{(v.kv[draftKey] ?? "").trim() ? ((v.kv[liveKey] ?? "") === (v.kv[draftKey] ?? "") ? "✅ معتمدة (هي اللي تشتغل الحين)" : "تنتظر مراجعتك واعتمادك") : "ما فيه مسودة بعد."}</span>
              <textarea className="field mt-2 min-h-40 w-full text-sm" value={kv[draftKey] ?? ""} onChange={(e) => setKv({ ...kv, [draftKey]: e.target.value })} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ghost !min-h-10 !px-4 !text-sm" disabled={(kv[draftKey] ?? "") === (v.kv[draftKey] ?? "")} onClick={() => act({ action: "kv", key: draftKey, value: kv[draftKey] ?? "" })}>
                احفظ تعديلي
              </button>
              <button type="button" className="btn btn-primary !min-h-10 !px-5 !text-sm" disabled={!(v.kv[draftKey] ?? "").trim() || (kv[draftKey] ?? "") !== (v.kv[draftKey] ?? "")} onClick={() => act({ action: "approve", which })}>
                اعتمد — خلّه يشتغل في الأجوبة
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* ───────── the method and the persona files ───────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">المنهج والشخصية (اللي يشتغل الحين)</h2>
        {(
          [
            [ISLAMIC_KV.method, "المنهج", "قواعدك اللي يمشي عليها في كل جواب: من وين الأحكام، وش الممنوع، كيف يتعامل مع السائل… (الهوية الأساسية ثابتة في الكود ولا تحتاج تكتبها)."],
            [ISLAMIC_KV.persona, "ملف الأخلاق والأسلوب", "اللي يتقمصه في كل جواب. يجي من اعتماد المسودة فوق، وتقدر تعدّله هنا مباشرة. فاضي = ما يُطبّق."],
            [ISLAMIC_KV.analysis, "منهج التحليل", "اللي يحلل فيه كل سؤال قبل الجواب. يجي من اعتماد المسودة فوق، وتقدر تعدّله هنا. فاضي = ما يُطبّق."],
          ] as const
        ).map(([key, label, hint]) => (
          <div key={key} className="card space-y-2 p-4">
            <label className="block">
              <b>{label}</b>
              <span className="block text-xs text-muted">{hint}</span>
              <textarea className="field mt-2 min-h-32 w-full" value={kv[key] ?? ""} onChange={(e) => setKv({ ...kv, [key]: e.target.value })} />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-primary !min-h-10 !px-5 !text-sm"
                disabled={(kv[key] ?? "") === (v.kv[key] ?? "")}
                onClick={() => act({ action: "kv", key, value: kv[key] ?? "" }).then(() => setSavedKey(key))}
              >
                احفظ
              </button>
              {savedKey === key && (kv[key] ?? "") === (v.kv[key] ?? "") && <span className="text-sm text-teal">✓ انحفظ</span>}
            </div>
          </div>
        ))}
      </section>

      {/* ───────── answers ───────── */}
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">الأسئلة والأجوبة</h2>
        {v.answers.length === 0 ? (
          <p className="text-sm text-muted">ما فيه أسئلة بعد.</p>
        ) : (
          <ul className="space-y-3">
            {v.answers.map((a) => (
              <li key={a.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>{new Date(a.created_at).toLocaleString("ar")}</span>
                  <span>
                    {a.found ? "✅ لقى جواب" : "⚠ ما لقى"} · ${Number(a.usd).toFixed(3)}
                  </span>
                </div>
                <p className="font-bold">{a.question}</p>
                <details>
                  <summary className="cursor-pointer text-sm text-muted">الجواب والمصادر</summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{a.answer}</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {a.sources.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                          {s.title}
                        </a>{" "}
                        — {s.source}
                      </li>
                    ))}
                  </ul>
                </details>
                <AnswerNote a={a} onSave={(note) => act({ action: "note", id: a.id, note })} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** The owner's correction of an answer (kept with it; the training step reads these later). */
function AnswerNote({ a, onSave }: { a: AnswerRow; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState(a.note);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-xs text-muted">
        تصحيحك (اختياري)
        <textarea className="field mt-1 min-h-10 w-full text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="وش الغلط، ووش الصح؟" />
      </label>
      <button type="button" className="btn btn-ghost !min-h-10 !px-4 !text-sm" disabled={note === a.note} onClick={() => onSave(note)}>
        احفظ التصحيح
      </button>
    </div>
  );
}
