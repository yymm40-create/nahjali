"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/jawad/Icon";
import { DENSITIES, OUTPUT_STATUS, QUESTION_TYPES, type Design } from "@config/jawad/student";
import type { AudioPlan, Doc, DocPlan, QuizPlan, SlidePlan } from "@/lib/jawad/student/model";
import type { OutputView } from "./client";
import DesignPicker, { DesignPreview } from "./DesignPicker";
import { AudioPlanEditor, DocPlanEditor, QuizPlanEditor, SlideMapEditor } from "./PlanEditors";
import { AudioResult, DocView, FileLinks, PdfFrame, QuizPlay, SlidesFonts, TranscriptView } from "./Results";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, Gate, JobStatus, PaidButton, Seg, useAsync } from "./ui";

type S = Record<string, unknown>;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

/** One output, from its settings to its approved files. */
export default function OutputPanel({ p, o }: { p: ProjectHook; o: OutputView }) {
  const { jobs, segments, sources, outputs, research } = p.state;
  const job = jobs.find((j) => j.outputId === o.id);
  const running = jobs.some((j) => j.status === "queued" || j.status === "running");
  const mine = job && (job.status === "queued" || job.status === "running");
  const [settings, setSettings] = useState<S>(o.settings);
  const [plan, setPlan] = useState<unknown>(o.plan);
  // a new plan from the server (made, revised or saved) replaces the local copy
  const [serverPlan, setServerPlan] = useState<unknown>(o.plan);
  if (serverPlan !== o.plan) {
    setServerPlan(o.plan);
    setPlan(o.plan);
  }
  const { busy, error, run } = useAsync();
  const act = (body: S) => p.actOutput(o.id, body);
  const set = (patch: S) => setSettings({ ...settings, ...patch });
  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(o.settings);
  const planDirty = JSON.stringify(plan) !== JSON.stringify(o.plan);
  const labels = new Map(segments.map((s) => [s.sid, s.label]));
  const images = sources.filter((s) => s.kind === "image" && s.status === "ready").map((s, i) => ({ id: s.id, name: s.name || `صورة ${i + 1}` }));
  const sample = segments.find((s) => s.text.length > 80)?.text.slice(0, 260) ?? "";
  const designed = o.kind === "book" || o.kind === "slides";
  const editingSettings = ["settings", "waiting", "plan_review", "ready", "trial_offer", "trial_review", "failed"].includes(o.status) && !mine;
  const researchContent = research?.approved ? research.content : null;

  return (
    <section className="jw-panel min-w-0 space-y-4 p-4" aria-labelledby={`o-${o.id}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`o-${o.id}`} className="text-lg font-bold">
          {o.title}
        </h2>
        <span className={`jw-chip ${o.status === "done" ? "!text-jw-ok" : ""}`}>{OUTPUT_STATUS[o.status] ?? o.status}</span>
      </header>
      {o.stale && (
        <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm">
          <Icon name="alert" size={14} className="me-1 inline text-jw-warn" />
          تغيّر النص أو الفهم أو حدود المصدر بعد بناء هذا الناتج. أعد إعداد الخطة واعتمدها قبل استخدامه أو إعادة توليده.
        </p>
      )}
      {o.status === "waiting" && <p className="text-sm text-jw-warn">هذا الصوت يقرأ ناتجًا آخر: يبدأ بعد اعتماد ذلك الناتج.</p>}
      <ErrorLine error={o.error && o.status !== "done" ? o.error : null} />
      {mine && <JobStatus job={job} />}
      {job?.status === "failed" && !mine && <ErrorLine error={job.error} />}

      {/* ───────── settings ───────── */}
      {o.kind !== "transcript" && editingSettings && (
        <details open={o.status === "settings" || o.status === "failed"} className="space-y-3">
          <summary className="cursor-pointer font-semibold">الإعدادات {settingsDirty && <span className="text-xs text-jw-warn">(غير محفوظة)</span>}</summary>
          <div className="space-y-3 pt-2">
            <KindSettings o={o} s={settings} set={set} outputs={outputs} />
            {(designed || o.kind === "summary" || o.kind === "explain" || o.kind === "quiz") && (
              <details open={designed} className="rounded-lg border border-jw-line p-3">
                <summary className="cursor-pointer font-semibold">التصميم والخطوط{!designed ? " (لملف PDF)" : ""}</summary>
                <div className="pt-3">
                  <DesignPicker value={settings.design as Design | undefined} onChange={(design) => set({ design })} kind={o.kind === "slides" ? "slides" : designed ? "book" : "doc"} sample={sample} />
                  {designed && <CustomStyle o={o} act={act} running={running} onUse={(design) => set({ design })} sample={sample} />}
                </div>
              </details>
            )}
            <ErrorLine error={error} />
            <button type="button" className="jw-btn jw-btn-primary" disabled={!settingsDirty || busy} onClick={() => run(() => act({ action: "settings", settings }))}>
              <Icon name="check" size={16} /> احفظ الإعدادات
            </button>
            {o.plan !== null && settingsDirty && <p className="text-xs text-jw-faint">بعد تغيير الإعدادات أعد إعداد الخطة لتُبنى عليها.</p>}
          </div>
        </details>
      )}

      {/* ───────── start ───────── */}
      {o.kind === "transcript" && !o.files.length && !mine && (
        <div className="space-y-2">
          <p className="text-sm text-jw-muted">التفريغ هو النص الذي راجعته واعتمدته، كاملًا وبلا إعادة صياغة، مع إظهار تصحيحاتك، للنسخ والتنزيل (PDF بخط نسخ وTXT).</p>
          <PaidButton label="أنشئ التفريغ" what="تجميع النص المعتمد في ملف PDF وTXT." disabled={running} run={(b) => act({ action: "final", ...b })} />
        </div>
      )}
      {o.kind !== "transcript" && (o.status === "settings" || (o.status === "failed" && !o.plan)) && !settingsDirty && (
        <PaidButton
          label={o.kind === "audio" ? "جهّز نص القراءة" : o.kind === "slides" ? "اعرض خريطة الشرائح" : o.kind === "quiz" ? "اعرض توزيع الأسئلة" : "اعرض الخطة"}
          what={o.kind === "audio" ? "تجهيز النص للقراءة وإضافة التشكيل حيث يلزم، لتراجعه قبل إرساله إلى ElevenLabs." : "إعداد خطة الناتج لتراجعها وتعدّلها قبل التصنيع."}
          disabled={running}
          run={(b) => act({ action: "plan", ...b })}
        />
      )}

      {/* ───────── plan review ───────── */}
      {plan !== null && ["plan_review", "ready", "trial_offer", "trial_review", "failed"].includes(o.status) && !mine && (
        <div className="space-y-3">
          <h3 className="font-semibold">{o.kind === "slides" ? "خريطة الشرائح" : o.kind === "quiz" ? "توزيع الأسئلة" : o.kind === "audio" ? "نص القراءة" : "الخطة والفهرس"}</h3>
          {(o.kind === "summary" || o.kind === "explain" || o.kind === "book") && <DocPlanEditor plan={plan as DocPlan} onChange={setPlan} labels={labels} images={images} withImages={o.kind === "book"} />}
          {o.kind === "slides" && <SlideMapEditor plan={plan as SlidePlan} onChange={setPlan} images={images} />}
          {o.kind === "quiz" && <QuizPlanEditor plan={plan as QuizPlan} onChange={setPlan} wanted={Number(o.settings.count) || 10} customType={str(o.settings.customType)} />}
          {o.kind === "audio" && <AudioPlanEditor plan={plan as AudioPlan} onChange={setPlan} />}
          {planDirty && (
            <button type="button" className="jw-btn" disabled={busy} onClick={() => run(() => act({ action: "plan_save", plan }))}>
              احفظ تعديلاتك على الخطة
            </button>
          )}
          {o.status === "plan_review" && (
            <Gate
              next={designed ? "يُعرض عليك خيار نسخة تجريبية مدفوعة ترى فيها الخط والتصميم، أو المتابعة مباشرة للتصنيع الكامل." : o.kind === "audio" ? "يُرسل النص كما يظهر هنا إلى ElevenLabs." : "يُكتب الناتج كاملًا على هذه الخطة."}
              disabled={planDirty}
              onApprove={() => act({ action: "plan_approve" })}
              editHint="اكتب التعديل الذي تريده على الخطة (أو عدّلها يدويًا أعلاه):"
              onEdit={(note) => <PaidButton label="أرسل التعديل" what="يعيد المساعد الخطة مع تعديلك." disabled={running} run={(b) => act({ action: "plan", note, kind: "edit", ...b })} />}
              onOther={(note) => <PaidButton label="أرسل الطلب" what="يعيد المساعد الخطة مع طلبك الجديد." disabled={running} run={(b) => act({ action: "plan", note, kind: "other", ...b })} />}
            />
          )}
        </div>
      )}

      {/* ───────── trial ───────── */}
      {o.status === "trial_offer" && !mine && (
        <div className="jw-panel space-y-3 border-jw-line-strong p-4">
          <h3 className="font-semibold">نسخة تجريبية قبل التصنيع الكامل؟</h3>
          <p className="text-sm text-jw-muted">
            {o.kind === "book" ? "يُكتب الفصل الأول ويُطبع مع الغلاف بالخطوط والتصميم الذي اخترته" : "تُصنع أول ٣ شرائح بملف PPTX وPDF"}، لترى الخط والتصميم على مادتك الحقيقية. النسخة التجريبية مدفوعة، ومبلغها يُخصم من سعر النسخة النهائية إذا أكملت.
          </p>
          <div className="flex flex-wrap gap-2">
            <PaidButton label="اصنع نسخة تجريبية" what="نسخة تجريبية موسومة «نسخة تجريبية»." disabled={running || settingsDirty} run={(b) => act({ action: "trial", ...b })} />
            <button type="button" className="jw-btn" disabled={busy} onClick={() => run(() => act({ action: "skip_trial" }))}>
              تخطَّ التجربة
            </button>
          </div>
        </div>
      )}
      {o.status === "trial_review" && !mine && (
        <div className="space-y-3">
          <h3 className="font-semibold">النسخة التجريبية</h3>
          <PdfFrame o={o} name="trial_pdf" />
          <FileLinks o={o} only={(f) => f.startsWith("trial_")} />
          {o.kind === "slides" && <SlidesFonts design={o.settings.design} />}
          <div className="jw-panel space-y-2 p-4">
            <p className="text-sm text-jw-muted">
              بعد الاعتماد يُصنع الناتج كاملًا بنفس التصميم{o.trialCoins ? `، ويُخصم ${o.trialCoins} نقدة (مبلغ التجربة) من سعره` : ""}. للتعديل: غيّر الخط أو التصميم من الإعدادات واحفظ ثم اصنع نسخة تجريبية جديدة، أو عدّل الخطة.
            </p>
            <div className="flex flex-wrap gap-2">
              <PaidButton label="اعتمد وأكمل التصنيع" what="التصنيع الكامل." disabled={running || settingsDirty} run={(b) => act({ action: "final", ...b })} />
              <PaidButton label="نسخة تجريبية جديدة" primary={false} what="نسخة تجريبية بالإعدادات الحالية." disabled={running || settingsDirty} run={(b) => act({ action: "trial", ...b })} />
            </div>
          </div>
        </div>
      )}
      {o.status === "ready" && !mine && (
        <PaidButton label={o.kind === "audio" ? "ولّد الصوت" : "ابدأ التصنيع"} what={o.kind === "audio" ? "إرسال النص المعتمد إلى ElevenLabs مقطعًا مقطعًا." : "إنشاء الناتج كاملًا على الخطة المعتمدة."} disabled={running} run={(b) => act({ action: "final", ...b })} />
      )}

      {/* ───────── result ───────── */}
      {["review", "done"].includes(o.status) && !mine && (
        <div className="space-y-4">
          <FileLinks o={o} />
          {o.kind === "book" && <PdfFrame o={o} name="pdf" />}
          {o.kind === "slides" && (
            <>
              {((o.content as { overflow?: number[] } | null)?.overflow ?? []).length > 0 && (
                <p className="text-sm text-jw-warn">شرائح نصها أطول من مساحتها حتى بعد تصغير الخط: {(o.content as { overflow: number[] }).overflow.join("، ")}. وزّعها على شرائح أكثر من الخريطة.</p>
              )}
              <PdfFrame o={o} name="pdf" />
              <SlidesFonts design={o.settings.design} />
            </>
          )}
          {(o.kind === "summary" || o.kind === "explain") && o.content !== null && <DocView doc={o.content as Doc} research={researchContent} />}
          {o.kind === "book" && o.content !== null && (
            <details>
              <summary className="cursor-pointer text-sm text-jw-muted">نص الكتاب (للنسخ وطلب تعديل فصل)</summary>
              <DocView doc={o.content as Doc} research={researchContent} />
            </details>
          )}
          {o.kind === "transcript" && o.content !== null && <TranscriptView content={o.content as { title: string; segments: { label: string; raw: string; text: string }[] }} />}
          {o.kind === "audio" && (
            <>
              <AudioResult o={o} />
              {((o.content as { failedParts?: number } | null)?.failedParts ?? 0) > 0 && (
                <PaidButton label="أعد المقاطع المتعثرة فقط" what="المقاطع الناجحة محفوظة ولا تُعاد ولا تُحتسب مرة ثانية." disabled={running} run={(b) => act({ action: "audio_retry", ...b })} />
              )}
            </>
          )}
          {o.kind === "quiz" && o.settings.usage !== "sheet" && <QuizPlay o={o} />}

          {o.status === "review" ? (
            <Gate
              next={outputs.some((x) => x.dependsOn === o.id) ? "يُعتمد الناتج، ويبدأ ما يعتمد عليه (مثل الصوت الذي يقرؤه)." : "يُعتمد الناتج ويبقى في المادة."}
              onApprove={() => act({ action: "approve" })}
              editHint={o.kind === "slides" || o.kind === "audio" ? "ما الذي تريد تعديله؟ (يعدّل المساعد الخطة لتعتمدها من جديد)" : "ما الذي تريد تعديله؟ يُعدَّل موضعيًا دون إعادة اختراع المحتوى."}
              onEdit={(note) => <RequestButton o={o} note={note} kind="edit" act={act} running={running} />}
              onOther={(note) => <RequestButton o={o} note={note} kind="other" act={act} running={running} />}
            />
          ) : (
            <p className="text-sm text-jw-ok">
              <Icon name="check" size={14} className="inline" /> معتمد.{" "}
              <button type="button" className="underline" onClick={() => run(() => act({ action: "reopen" }))}>
                أعد فتحه للتعديل
              </button>
            </p>
          )}
        </div>
      )}
      {o.requests.length > 0 && (
        <details className="text-xs text-jw-muted">
          <summary className="cursor-pointer">طلباتك على هذا الناتج ({o.requests.length})</summary>
          <ul className="mt-1 list-inside list-disc">
            {o.requests.map((r, i) => (
              <li key={i}>
                {r.kind === "edit" ? "تعديل" : "أمر آخر"}: {r.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function RequestButton({ o, note, kind, act, running }: { o: OutputView; note: string; kind: "edit" | "other"; act: (b: S) => Promise<unknown>; running: boolean }) {
  const doc = o.kind === "summary" || o.kind === "explain" || o.kind === "book" ? (o.content as Doc | null) : null;
  const [chapter, setChapter] = useState(-1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {doc && (
        <select className="jw-select w-auto" value={chapter} onChange={(e) => setChapter(Number(e.target.value))} aria-label="الجزء المعني">
          <option value={-1}>كل الفصول</option>
          {doc.chapters.map((c, i) => (
            <option key={i} value={i}>
              الفصل {i + 1}: {c.title}
            </option>
          ))}
        </select>
      )}
      <PaidButton label="أرسل" what={doc && chapter >= 0 ? "تعديل هذا الفصل فقط، وبقية الناتج كما هي." : "تعديل الناتج حسب طلبك."} disabled={running} run={(b) => act({ action: "request", note, kind, chapter, ...b })} />
    </div>
  );
}

function CustomStyle({ o, act, running, onUse, sample }: { o: OutputView; act: (b: S) => Promise<unknown>; running: boolean; onUse: (d: Design) => void; sample: string }) {
  const [desc, setDesc] = useState("");
  const draft = o.settings._styleDraft as Design | null | undefined;
  return (
    <div className="mt-4 space-y-2 border-t border-jw-line pt-3">
      <h4 className="text-sm font-semibold">أو صف أسلوبك الخاص</h4>
      <textarea className="jw-textarea text-sm" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثال: ألوان هادئة كحلي وبيج، طابع أكاديمي، بطاقات قليلة، مساحات واسعة، خط عناوين قوي" />
      {desc.trim().length >= 10 && <PaidButton label="حلّل وصفي" primary={false} what="يحلل المساعد وصفك إلى ألوان وخطوط وبنية وخامات وكثافة لتعتمده." disabled={running} run={(b) => act({ action: "style_analyze", description: desc, ...b })} />}
      {draft?.custom && (
        <div className="space-y-2 rounded-lg bg-jw-surface-2 p-3">
          <p className="text-sm">{draft.custom.notes}</p>
          <div className="flex gap-1" aria-hidden>
            {Object.values(draft.custom.colors).map((c, i) => (
              <span key={i} className="size-5 rounded-full border border-black/10" style={{ background: c }} />
            ))}
          </div>
          <DesignPreview design={draft} sample={sample} height={240} />
          <div className="flex gap-2">
            <button type="button" className="jw-btn jw-btn-primary" onClick={() => onUse(draft)}>
              اعتمد هذا الفهم لأسلوبي
            </button>
          </div>
          <p className="text-xs text-jw-faint">بعد اعتماده احفظ الإعدادات. للتعديل غيّر الوصف وحلّله من جديد.</p>
        </div>
      )}
    </div>
  );
}

function Field({ s, set, k, label, ph, area }: { s: S; set: (p: S) => void; k: string; label: string; ph?: string; area?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="jw-label">{label}</span>
      {area ? <textarea className="jw-textarea" rows={2} value={str(s[k])} onChange={(e) => set({ [k]: e.target.value })} placeholder={ph} /> : <input className="jw-input" value={str(s[k])} onChange={(e) => set({ [k]: e.target.value })} placeholder={ph} />}
    </label>
  );
}

function KindSettings({ o, s, set, outputs }: { o: OutputView; s: S; set: (p: S) => void; outputs: OutputView[] }) {
  const density = (
    <div className="space-y-1">
      <span className="jw-label">كثافة النص</span>
      <Seg label="كثافة النص" value={str(s.density, "medium") as "medium"} options={DENSITIES} onChange={(density) => set({ density })} />
    </div>
  );

  switch (o.kind) {
    case "summary":
    case "explain":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field s={s} set={set} k="purpose" label="هدف الاستخدام" ph="مراجعة قبل الاختبار، شرح لزميل…" />
          <Field s={s} set={set} k="tone" label="اللغة أو النبرة (اختياري)" ph="فصحى مبسطة، رسمية…" />
          <Field s={s} set={set} k="length" label="الطول التقريبي (اختياري)" ph="صفحة، ٣ صفحات…" />
          <Field s={s} set={set} k="audience" label="الجمهور (إن اختلف)" />
          <div className="sm:col-span-2">{density}</div>
          <div className="sm:col-span-2">
            <Field s={s} set={set} k="extra" label="ملاحظات أخرى" area />
          </div>
        </div>
      );
    case "book":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <span className="jw-label">طريقة الكتابة</span>
            <Seg
              label="طريقة الكتابة"
              value={str(s.writing, "explain") as "explain"}
              options={[
                { id: "explain", label: "كتاب شرح" },
                { id: "summary", label: "كتاب ملخص" },
                { id: "verbatim", label: "نقل النص الأصلي كاملًا" },
              ]}
              onChange={(writing) => set({ writing })}
            />
            {s.writing === "verbatim" && <p className="text-xs text-jw-faint">يُنقل النص المعتمد كاملًا بلا اختصار، والتصميم يخدمه.</p>}
          </div>
          <Field s={s} set={set} k="title" label="عنوان الكتاب" />
          <Field s={s} set={set} k="purpose" label="الغرض" ph="مذاكرة، طباعة للفصل…" />
          <Field s={s} set={set} k="audience" label="الجمهور (إن اختلف)" />
          <Field s={s} set={set} k="cover" label="الغلاف" ph="ما تريد على الغلاف" />
          <div className="space-y-1">
            <span className="jw-label">مقاس الصفحة</span>
            <Seg label="المقاس" value={str(s.page, "A4") as "A4"} options={[{ id: "A4", label: "A4" }, { id: "A5", label: "A5" }]} onChange={(page) => set({ page })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.numbered !== false} onChange={(e) => set({ numbered: e.target.checked })} /> ترقيم الصفحات
          </label>
          {density}
          <Field s={s} set={set} k="visuals" label="العناصر البصرية" ph="جداول مقارنة، بطاقات، صور توضيحية…" />
          <div className="sm:col-span-2">
            <Field s={s} set={set} k="extra" label="ملاحظات أخرى (الألوان، التخطيط…)" area />
          </div>
        </div>
      );
    case "slides":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field s={s} set={set} k="audience" label="الجمهور" ph="زملاء الصف، لجنة تقييم…" />
          <Field s={s} set={set} k="purpose" label="الغرض" ph="عرض بحث، مراجعة، شرح درس…" />
          <label className="block text-sm">
            <span className="jw-label">عدد الشرائح (٠ = حسب المادة)</span>
            <input type="number" min={0} className="jw-input" value={Number(s.count) || 0} onChange={(e) => set({ count: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          <div className="space-y-1">
            <span className="jw-label">نسبة الأبعاد</span>
            <Seg label="نسبة الأبعاد" value={str(s.aspect, "16:9") as "16:9"} options={[{ id: "16:9", label: "16:9" }, { id: "4:3", label: "4:3" }]} onChange={(aspect) => set({ aspect })} />
          </div>
          {density}
          <div className="space-y-1">
            <span className="jw-label">الشرح</span>
            <Seg
              label="الشرح"
              value={str(s.notesMode, "slide") as "slide"}
              options={[
                { id: "slide", label: "على الشريحة" },
                { id: "notes", label: "في ملاحظات المحاضر" },
                { id: "both", label: "الاثنان" },
              ]}
              onChange={(notesMode) => set({ notesMode })}
            />
          </div>
          <div className="sm:col-span-2">
            <Field s={s} set={set} k="extra" label="ملاحظات أخرى" area />
          </div>
        </div>
      );
    case "audio": {
      const texts = outputs.filter((x) => x.kind === "summary" || x.kind === "explain" || x.kind === "book");
      return <AudioSettings s={s} set={set} texts={texts} />;
    }
    case "quiz":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <span className="jw-label">الصعوبة</span>
            <Seg
              label="الصعوبة"
              value={str(s.difficulty, "medium") as "medium"}
              options={[
                { id: "easy", label: "سهل" },
                { id: "medium", label: "متوسط" },
                { id: "hard", label: "صعب" },
                { id: "custom", label: "وصف خاص" },
              ]}
              onChange={(difficulty) => set({ difficulty })}
            />
            {s.difficulty === "custom" && <Field s={s} set={set} k="difficultyNote" label="صف الصعوبة" />}
          </div>
          <label className="block text-sm">
            <span className="jw-label">عدد الأسئلة</span>
            <input type="number" min={1} className="jw-input" value={Number(s.count) || 10} onChange={(e) => set({ count: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
          <div className="space-y-1">
            <span className="jw-label">طريقة الاستخدام</span>
            <Seg
              label="الاستخدام"
              value={str(s.usage, "both") as "both"}
              options={[
                { id: "interactive", label: "تفاعلي" },
                { id: "sheet", label: "ورقة للتحميل" },
                { id: "both", label: "كلاهما" },
              ]}
              onChange={(usage) => set({ usage })}
            />
          </div>
          <fieldset className="space-y-1 sm:col-span-2">
            <legend className="jw-label">أنواع الأسئلة</legend>
            <div className="flex flex-wrap gap-3">
              {QUESTION_TYPES.map((t) => {
                const list = (s.types as string[] | undefined) ?? ["mcq"];
                return (
                  <label key={t.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={list.includes(t.id)} onChange={(e) => set({ types: e.target.checked ? [...list, t.id] : list.filter((x) => x !== t.id) })} />
                    {t.label}
                  </label>
                );
              })}
            </div>
            <Field s={s} set={set} k="customType" label="نوع آخر تكتبه بنفسك (اختياري)" ph="مثال: أكمل الفراغ" />
          </fieldset>
        </div>
      );
    default:
      return null;
  }
}

function AudioSettings({ s, set, texts }: { s: S; set: (p: S) => void; texts: OutputView[] }) {
  const [voices, setVoices] = useState<{ value: string; name: string; description: string }[] | null>(null);
  useEffect(() => {
    fetch("/api/jawad/voices")
      .then((r) => r.json())
      .then((j: { mine?: { value: string; name: string; description: string }[]; ready?: { value: string; name: string; description: string }[] }) => setVoices([...(j.mine ?? []), ...(j.ready ?? [])]))
      .catch(() => setVoices([]));
  }, []);
  const src = str(s.source, "text");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">
        <span className="jw-label">ما النص الذي يُقرأ؟</span>
        <select className="jw-select" value={src} onChange={(e) => set({ source: e.target.value })}>
          <option value="text">النص الأصلي المعتمد</option>
          {texts.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} {t.status === "done" ? "" : "(يبدأ بعد اعتماده)"}
            </option>
          ))}
          <option value="custom">نص آخر أكتبه</option>
        </select>
      </label>
      {src === "custom" && (
        <label className="block text-sm sm:col-span-2">
          <span className="jw-label">النص</span>
          <textarea className="jw-textarea" rows={5} value={str(s.customText)} onChange={(e) => set({ customText: e.target.value })} />
        </label>
      )}
      <div className="space-y-1">
        <span className="jw-label">الملفات</span>
        <Seg
          label="الملفات"
          value={str(s.mode, "single") as "single"}
          options={[
            { id: "single", label: "ملف واحد" },
            { id: "multi", label: "ملف لكل قسم" },
          ]}
          onChange={(mode) => set({ mode })}
        />
        <p className="text-xs text-jw-faint">الملفات المتعددة مرتبة ومرقمة بحسب أقسام المادة أو فصول النص المختار.</p>
      </div>
      <label className="block text-sm">
        <span className="jw-label">الصوت</span>
        <select className="jw-select" value={str(s.voice, "p:JBFqnCBsd6RMkjVDRZzb")} onChange={(e) => set({ voice: e.target.value })}>
          {voices === null && <option>…</option>}
          {(voices ?? []).map((v) => (
            <option key={v.value} value={v.value}>
              {v.name}
              {v.description ? ` — ${v.description.slice(0, 40)}` : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-jw-warn sm:col-span-2">
        <Icon name="alert" size={12} className="me-1 inline" />
        قد يخطئ التشكيل أو النطق، خاصة في الأسماء والمصطلحات. ستراجع النص المعد للقراءة بتشكيله قبل الإرسال.
      </p>
    </div>
  );
}
