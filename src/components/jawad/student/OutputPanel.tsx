"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/jawad/Icon";
import { DENSITIES, DESIGNED_KINDS, OUTPUT_STATUS, QUESTION_TYPES, emptyWish, type Design, type DesignWish, type OutputKind } from "@config/jawad/student";
import type { AudioPlan, Doc, DocPlan, QuizPlan, SlidePlan } from "@/lib/jawad/student/model";
import type { OutputView } from "./client";
import { AudioPlanEditor, DocPlanEditor, QuizPlanEditor, SlideMapEditor } from "./PlanEditors";
import { defaults, DesignStep, Questions } from "./Questions";
import { AudioResult, DocView, FileLinks, PdfFrame, QuizPlay, SlidesFonts, TranscriptView } from "./Results";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, Gate, JobStatus, PaidButton, Seg, useAsync } from "./ui";
import Riyal from "@/components/Riyal";

type S = Record<string, unknown>;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
/** JSON with sorted keys: the database returns the same settings with its keys in another order. */
const stable = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as S)[k])}`).join(",")}}` : JSON.stringify(v) ?? "null";

/** The design an output was made with, as the design step's answers (so going back starts from what it is now). */
function wishOf(d: unknown): DesignWish {
  const x = d as Design | undefined;
  if (!x?.main) return emptyWish();
  return { style: x.main, ideas: x.custom?.description ?? "", heading: x.fonts?.heading ?? "", body: x.fonts?.body ?? "", frame: x.frame !== false };
}

/**
 * «ارجع وغيّر»: back to an output's questions and design (also once it is made). Saving plans and makes it again from
 * the start with the new answers; its files stay until the new ones are ready.
 */
function Remake({ p, o, onDone, onClose }: { p: ProjectHook; o: OutputView; onDone: () => void; onClose: () => void }) {
  const kind = o.kind as OutputKind;
  const [s, setS] = useState<S>(() => ({ ...defaults(kind, p.state.project.level), ...o.settings }));
  const [wish, setWish] = useState<DesignWish>(() => wishOf(o.settings.design));
  const [extra, setExtra] = useState(str(o.settings.extra));
  const { busy, error, run } = useAsync();
  const designed = DESIGNED_KINDS.includes(o.kind);
  return (
    <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <h3 className="font-bold">↩ ارجع وغيّر «{o.title}»</h3>
      <Questions kind={kind} s={s} set={(patch) => setS({ ...s, ...patch })} chosen={p.state.outputs.map((x) => x.kind as OutputKind)} prices={p.state.prices} />
      {designed && (
        <div className="space-y-2">
          <b className="block">🎨 التصميم</b>
          <DesignStep wish={wish} set={setWish} />
        </div>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-semibold">طلبات خاصة (لها الأولوية)</span>
        <textarea className="jw-textarea" rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} />
      </label>
      <ErrorLine error={error} />
      <p className="text-xs text-jw-faint">ينصنع من جديد بإعداداتك الجديدة، ويُخصم بسعره. ملفاتك الحالية تبقى لين تجهز الجديدة.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="jw-btn jw-btn-primary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const { design: _d, ...rest } = s;
              void _d;
              // a recording reads another output: the question names its kind, the server wants that output
              if (o.kind === "audio" && rest.source !== "text" && rest.source !== "custom") {
                const dep = p.state.outputs.find((x) => x.kind === rest.source || x.id === rest.source);
                rest.source = dep ? dep.id : "text";
              }
              await p.actOutput(o.id, { action: "settings", settings: { ...rest, extra }, ...(designed ? { design: wish } : {}) });
              onDone();
            })
          }
        >
          <Icon name="sparkles" size={16} /> احفظ وأعد الصنع
        </button>
        <button type="button" className="jw-btn" disabled={busy} onClick={onClose}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

/** One output, from its settings to its approved files. */
export default function OutputPanel({ p, o, onRemade }: { p: ProjectHook; o: OutputView; onRemade?: () => void }) {
  const { jobs, segments, sources, outputs, research } = p.state;
  const job = jobs.find((j) => j.outputId === o.id);
  const running = jobs.some((j) => j.status === "queued" || j.status === "running");
  const mine = job && (job.status === "queued" || job.status === "running");
  const [settings, setSettings] = useState<S>(o.settings);
  // saved settings from the server (cleaned and clamped there) replace the local copy; a poll with the same settings doesn't
  const [serverSettings, setServerSettings] = useState(() => stable(o.settings));
  if (serverSettings !== stable(o.settings)) {
    setServerSettings(stable(o.settings));
    setSettings(o.settings);
  }
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
  const settingsDirty = stable(settings) !== stable(o.settings);
  const planDirty = JSON.stringify(plan) !== JSON.stringify(o.plan);
  const labels = new Map(segments.map((s) => [s.sid, s.label]));
  const images = sources.filter((s) => s.kind === "image" && s.status === "ready").map((s, i) => ({ id: s.id, name: s.name || `صورة ${i + 1}` }));
  const designed = o.kind === "book" || o.kind === "slides";
  const editingSettings = ["settings", "waiting", "plan_review", "ready", "trial_offer", "trial_review", "failed"].includes(o.status) && !mine;
  const researchContent = research?.approved ? research.content : null;
  const [back, setBack] = useState(false);

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
      {o.kind !== "transcript" && !mine && !running && (back ? (
        <Remake p={p} o={o} onClose={() => setBack(false)} onDone={() => { setBack(false); onRemade?.(); }} />
      ) : (
        <button type="button" className="jw-btn" onClick={() => setBack(true)}>
          ↩ ارجع وغيّر الأسئلة والتصميم
        </button>
      ))}
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
            {/* the design and fonts are Claude's choice (design-pick.ts), never asked */}
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
              onEdit={(note) => <PaidButton label="أرسل التعديل" what="يعيد صادق الخطة مع تعديلك." disabled={running} run={(b) => act({ action: "plan", note, kind: "edit", ...b })} />}
              onOther={(note) => <PaidButton label="أرسل الطلب" what="يعيد صادق الخطة مع طلبك الجديد." disabled={running} run={(b) => act({ action: "plan", note, kind: "other", ...b })} />}
            />
          )}
        </div>
      )}

      {/* ───────── trial ───────── */}
      {o.status === "trial_offer" && !mine && (
        <div className="jw-panel space-y-3 border-jw-line-strong p-4">
          <h3 className="font-semibold">نسخة تجريبية قبل التصنيع الكامل؟</h3>
          <p className="text-sm text-jw-muted">
            {o.kind === "book" ? "يُكتب الفصل الأول ويُطبع مع الغلاف بالخطوط والتصميم الذي اخترته" : o.settings.render === "image" ? "تُرسم أول ٣ شرائح كصور بـ GPT Image 2 وتُجمع في PDF" : "تُصنع أول ٣ شرائح بملف PPTX وPDF"}، لترى الخط والتصميم على مادتك الحقيقية. النسخة التجريبية مدفوعة، ومبلغها يُخصم من سعر النسخة النهائية إذا أكملت.
          </p>
          <div className="flex flex-wrap gap-2">
            <PaidButton label="ابدأ التصنيع الكامل" what="إنشاء الناتج كاملًا على الخطة المعتمدة." disabled={running || settingsDirty} run={(b) => act({ action: "final", ...b })} />
            <PaidButton label="نسخة تجريبية أولًا" primary={false} what="نسخة تجريبية موسومة «نسخة تجريبية»." disabled={running || settingsDirty} run={(b) => act({ action: "trial", ...b })} />
          </div>
        </div>
      )}
      {o.status === "trial_review" && !mine && (
        <div className="space-y-3">
          <h3 className="font-semibold">النسخة التجريبية</h3>
          <PdfFrame o={o} name="trial_pdf" />
          <FileLinks o={o} only={(f) => f.startsWith("trial_")} />
          {o.kind === "slides" && o.settings.render !== "image" && <SlidesFonts design={o.settings.design} />}
          <div className="jw-panel space-y-2 p-4">
            <p className="text-sm text-jw-muted">
              بعد الاعتماد يُصنع الناتج كاملًا بنفس التصميم{o.trialCoins ? <>، ويُخصم <Riyal halalas={o.trialCoins} size={13} /> (مبلغ التجربة) من سعره</> : ""}. للتعديل: غيّر الخط أو التصميم من الإعدادات واحفظ ثم اصنع نسخة تجريبية جديدة، أو عدّل الخطة.
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
          {(() => {
            // the page count the student asked for, and what the PDF came out at
            const want = Number(o.settings.pages) || 0;
            const got = Number((o.content as { pages?: number } | null)?.pages) || 0;
            if (!want || !got) return null;
            return <p className={`text-sm ${got === want ? "text-jw-ok" : "text-jw-warn"}`}>{got === want ? `✓ ${got.toLocaleString("ar")} صفحة بالضبط مثل ما طلبت` : `طلع ${got.toLocaleString("ar")} صفحة (طلبت ${want.toLocaleString("ar")}) — هذا أقرب ما وصل له بدون ما يحذف من المادة. اطلب تعديل لو تبيه أقصر أو أطول.`}</p>;
          })()}
          {o.kind === "book" && <PdfFrame o={o} name="pdf" />}
          {o.kind === "slides" && (
            <>
              {((o.content as { overflow?: number[] } | null)?.overflow ?? []).length > 0 && (
                <p className="text-sm text-jw-warn">شرائح نصها أطول من مساحتها حتى بعد تصغير الخط: {(o.content as { overflow: number[] }).overflow.join("، ")}. وزّعها على شرائح أكثر من الخريطة.</p>
              )}
              <PdfFrame o={o} name="pdf" />
              {o.settings.render !== "image" && <SlidesFonts design={o.settings.design} />}
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
          {["summary", "explain", "transcript", "book", "quiz"].includes(o.kind) && o.content !== null && <PicturesPanel o={o} act={act} running={running} />}

          {o.status === "review" ? (
            <Gate
              next={outputs.some((x) => x.dependsOn === o.id) ? "يُعتمد الناتج، ويبدأ ما يعتمد عليه (مثل الصوت الذي يقرؤه)." : "يُعتمد الناتج ويبقى في المادة."}
              onApprove={() => act({ action: "approve" })}
              editHint={o.kind === "slides" || o.kind === "audio" ? "ما الذي تريد تعديله؟ (يعدّل صادق الخطة لتعتمدها من جديد)" : "ما الذي تريد تعديله؟ يُعدَّل موضعيًا دون إعادة اختراع المحتوى."}
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
  const pictures = o.kind === "slides" && o.settings.render === "image" ? (o.plan as SlidePlan | null) : null;
  const [chapter, setChapter] = useState(-1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pictures && (
        <select className="jw-select w-auto" value={chapter} onChange={(e) => setChapter(Number(e.target.value))} aria-label="الشريحة المعنية">
          <option value={-1}>تعديل خريطة الشرائح كلها</option>
          {pictures.slides.map((sl, i) => (
            <option key={i} value={i}>
              أعد رسم الشريحة {i + 1}: {sl.title}
            </option>
          ))}
        </select>
      )}
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
      <PaidButton label="أرسل" what={pictures && chapter >= 0 ? "تُرسم هذه الشريحة من جديد مع طلبك، وبقية الشرائح كما هي." : doc && chapter >= 0 ? "تعديل هذا الفصل فقط، وبقية الناتج كما هي." : "تعديل الناتج حسب طلبك."} disabled={running} run={(b) => act({ action: "request", note, kind, chapter, ...b })} />
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
          <div className="space-y-2 sm:col-span-2">
            <span className="jw-label">طريقة صنع الشرائح</span>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                aria-pressed={s.render === "image"}
                onClick={() => set({ render: "image" })}
                className={`relative overflow-hidden rounded-2xl p-4 text-start text-white transition-transform hover:-translate-y-0.5 ${s.render === "image" ? "ring-4 ring-pink-300" : "opacity-90"}`}
                style={{ background: "linear-gradient(135deg,#7c3aed,#db2777 55%,#f97316)" }}
              >
                <span className="absolute top-3 left-3 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold">الأفضل ✨</span>
                <span className="block text-2xl" aria-hidden>
                  🪄
                </span>
                <b className="block text-lg">صناعة بـ GPT Image 2</b>
                <span className="block text-sm text-white/90">كل شريحة تُرسم كلوحة فنية كاملة بأسلوبك — أجمل وأفخم بكثير من الصناعة العادية، وتُجمع في PDF. تكلفتها أعلى.</span>
              </button>
              <button
                type="button"
                aria-pressed={s.render !== "image"}
                onClick={() => set({ render: "editable" })}
                className={`rounded-2xl border bg-white p-4 text-start transition-transform hover:-translate-y-0.5 ${s.render !== "image" ? "border-jw-accent ring-4 ring-violet-200" : "border-jw-line"}`}
              >
                <span className="block text-2xl" aria-hidden>
                  🧩
                </span>
                <b className="block text-lg">الصناعة العادية</b>
                <span className="block text-sm text-jw-muted">شرائح PPTX تقدر تعدّل نصها بنفسك، مع نسخة PDF. أرخص.</span>
              </button>
            </div>
            {s.render === "image" && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-jw-surface-2 p-3 text-sm">
                <span>جودة الرسم:</span>
                <Seg label="جودة الرسم" value={str(s.imageQuality, "high") as "high"} options={[{ id: "high", label: "عالية" }, { id: "medium", label: "متوسطة (أرخص)" }]} onChange={(imageQuality) => set({ imageQuality })} />
                <span className="w-full text-xs text-jw-faint">قد تظهر نسبة خطأ بسيطة في بعض الكلمات، وتقدر تطلب إعادة رسم أي شريحة لوحدها.</span>
              </div>
            )}
          </div>
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
    fetch("/api/jawad/student/voices")
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

/** Any finished written output as designed pages drawn by GPT Image 2, put together as a PDF. */
function PicturesPanel({ o, act, running }: { o: OutputView; act: (b: S) => Promise<unknown>; running: boolean }) {
  const [quality, setQuality] = useState<"high" | "medium">("high");
  const [page, setPage] = useState(0);
  const [note, setNote] = useState("");
  const pics = (o.content as { pictures?: { pages: { title: string; rendered: unknown }[] } } | null)?.pictures;
  const has = o.files.includes("pictures_pdf");
  return (
    <div className="space-y-3 overflow-hidden rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#db2777 55%,#f97316)" }}>
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>
          🪄
        </span>
        <div>
          <b className="block text-lg">{has ? "صفحاتك المصممة بـ GPT Image 2" : "حوّلها إلى صفحات مصممة بـ GPT Image 2"}</b>
          <p className="text-sm text-white/90">كل صفحة تُرسم كلوحة دراسية جميلة بأسلوبك — أجمل وأفخم بكثير، وتكلفتها أعلى. قد تظهر نسبة خطأ بسيطة في بعض الكلمات.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/15 p-2 text-sm">
        <span>الجودة:</span>
        {(["high", "medium"] as const).map((q) => (
          <button key={q} type="button" aria-pressed={quality === q} onClick={() => setQuality(q)} className={`rounded-full px-3 py-1 ${quality === q ? "bg-white text-pink-600" : "bg-white/20"}`}>
            {q === "high" ? "عالية" : "متوسطة (أرخص)"}
          </button>
        ))}
        <PaidButton label={has ? "حدّث الصفحات" : "ارسمها الآن"} what={`رسم صفحات «${o.title}» بـ GPT Image 2 ثم جمعها في PDF. الصفحات التي لم تتغير لا تُرسم من جديد.`} disabled={running} run={(b) => act({ action: "pictures", quality, ...b })} />
      </div>
      {has && (
        <div className="space-y-2 rounded-xl bg-white p-2 text-jw-ink">
          <PdfFrame o={o} name="pictures_pdf" />
          <FileLinks o={o} only={(f) => f === "pictures_pdf"} />
          {pics && pics.pages.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select className="jw-select w-auto" value={page} onChange={(e) => setPage(Number(e.target.value))} aria-label="الصفحة">
                {pics.pages.map((pg, i) => (
                  <option key={i} value={i}>
                    أعد رسم الصفحة {i + 1}: {pg.title}
                  </option>
                ))}
              </select>
              <input className="jw-input w-auto flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظتك على هذه الصفحة (اختياري)" />
              <PaidButton label="أعد رسمها" primary={false} what="تُرسم هذه الصفحة وحدها من جديد، وبقية الصفحات كما هي." disabled={running} run={(b) => act({ action: "pictures", quality, page, note, ...b })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
