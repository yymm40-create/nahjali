"use client";

// «خطبة المنبر» — the plan review of the owner's method «المرجعية المأمونة», step by step: ٢ the three topics (the preacher picks
// one, and may change its words or its verse), ٣ the verse's tafsir from مجمع البيان (the book's own pages put in plain words, or
// pasted by the preacher), ٤ the poetry, ٥ the four parts the sermon is written in.

import { useEffect, useState } from "react";
import { SERMON_PARTS } from "@config/jawad/khateeb";
import { api } from "@/lib/fetch";
import type { DocPlan, SermonPoem, SermonTopic } from "@/lib/jawad/student/model";
import type { OutputView } from "./client";
import { ErrorLine, PaidButton, useAsync } from "./ui";

type Act = (b: Record<string, unknown>) => Promise<unknown>;

function TopicCard({ t, i, chosen, act, busy }: { t: SermonTopic; i: number; chosen: boolean; act: Act; busy: boolean }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ title: t.title, idea: t.idea, kooriz: t.kooriz, surah: String(t.verse.surah), from: String(t.verse.from), to: String(t.verse.to) });
  const { busy: saving, error, run } = useAsync();
  return (
    <li className={`jw-panel space-y-3 p-4 ${chosen ? "!border-jw-accent" : ""}`} aria-current={chosen}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <b className="text-base">
          {(i + 1).toLocaleString("ar")}. {t.title}
        </b>
        {chosen ? <span className="jw-chip !border-jw-accent !bg-jw-accent/15 text-xs font-bold">✓ موضوع خطبتك</span> : null}
      </div>
      <p className="text-sm">{t.idea}</p>
      <div className="rounded-lg bg-jw-surface-2 p-3 text-sm">
        <p className="mb-1 text-xs text-jw-muted">الآية المفتاح · {t.verse.ref}</p>
        <p className="text-lg leading-loose" dir="rtl">{t.verse.text}</p>
      </div>
      <p className="text-sm">
        <b>نقطة التخلص (الكَوْريز):</b> {t.kooriz}
      </p>
      <div className="flex flex-wrap gap-2">
        {!chosen && (
          <button type="button" className="jw-btn jw-btn-primary" disabled={busy} onClick={() => run(() => act({ action: "sermon_choose", index: i }))}>
            اختر هذا الموضوع
          </button>
        )}
        <button type="button" className="jw-btn" onClick={() => setEdit((x) => !x)}>
          {edit ? "أغلق التعديل" : "✏️ عدّل الموضوع أو الآية"}
        </button>
      </div>
      {edit && (
        <div className="space-y-2 rounded-lg border border-jw-line p-3">
          <label className="block space-y-1 text-xs text-jw-muted">فكرة المحور
            <input className="jw-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </label>
          <label className="block space-y-1 text-xs text-jw-muted">موضوع المعالجة
            <textarea className="jw-textarea" rows={3} value={f.idea} onChange={(e) => setF({ ...f, idea: e.target.value })} />
          </label>
          <label className="block space-y-1 text-xs text-jw-muted">نقطة التخلص
            <textarea className="jw-textarea" rows={2} value={f.kooriz} onChange={(e) => setF({ ...f, kooriz: e.target.value })} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            {(["surah", "from", "to"] as const).map((k) => (
              <label key={k} className="space-y-1 text-xs text-jw-muted">
                {k === "surah" ? "رقم السورة" : k === "from" ? "من الآية" : "إلى الآية"}
                <input className="jw-input !w-24" inputMode="numeric" dir="ltr" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/\D/g, "") })} />
              </label>
            ))}
            <button type="button" className="jw-btn jw-btn-primary" disabled={saving || busy} onClick={() => run(async () => { await act({ action: "sermon_edit", index: i, ...f, surah: Number(f.surah), from: Number(f.from), to: Number(f.to) }); setEdit(false); })}>
              احفظ
            </button>
          </div>
          <p className="text-xs text-jw-faint">كلمات الآية تُجلب من القرآن نفسه، وما تُكتب من الذاكرة.</p>
          <ErrorLine error={error} />
        </div>
      )}
      {!edit && <ErrorLine error={error} />}
    </li>
  );
}

interface LibRef {
  id: string;
  title: string;
  kind: "poetry" | "source";
  pages: number;
}

/** The library's references a preacher may choose from (the ones the owner brought in and that are read). */
function useLibrary(): LibRef[] {
  const [refs, setRefs] = useState<LibRef[]>([]);
  useEffect(() => {
    let live = true;
    api<{ refs: LibRef[] }>("/api/khateeb/library")
      .then((r) => live && setRefs(r.refs))
      .catch(() => null);
    return () => {
      live = false;
    };
  }, []);
  return refs;
}

/** Passages taken from the library (word for word, with the page), each removable. */
function Passages({ list, keepAction, act, busy }: { list: SermonPoem[]; keepAction: string; act: Act; busy: boolean }) {
  const { run } = useAsync();
  if (!list.length) return null;
  return (
    <ol className="space-y-2">
      {list.map((p, k) => (
        <li key={`${k}-${p.page}`} className="jw-panel space-y-1 p-3 text-sm">
          {p.poet ? <p className="text-xs font-bold text-jw-muted">{p.poet}</p> : null}
          <p className="whitespace-pre-wrap text-base leading-loose" dir="rtl">{p.text}</p>
          <p className="text-xs text-jw-muted">
            المرجع: {p.ref}، ص{p.page}
            {p.why ? ` · ${p.why}` : ""}
          </p>
          <button type="button" className="jw-btn !min-h-8 text-xs" disabled={busy} onClick={() => run(() => act({ action: keepAction, keep: list.map((_, j) => j).filter((j) => j !== k) }))}>
            شيل هذا
          </button>
        </li>
      ))}
    </ol>
  );
}

export default function SermonPlan({ o, plan, act, running }: { o: OutputView; plan: DocPlan; act: Act; running: boolean }) {
  const sp = plan.sermon;
  const [manual, setManual] = useState({ source: "", url: "", text: "" });
  const [ask, setAsk] = useState("");
  const [askSrc, setAskSrc] = useState("");
  const lib = useLibrary();
  // the references the preacher turned off (all are on until he does)
  const [off, setOff] = useState<string[]>([]);
  const chosen = (kind: LibRef["kind"]) => lib.filter((r) => r.kind === kind && !off.includes(r.id)).map((r) => r.id);
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAsync();
  if (!sp) return <p className="text-sm text-jw-muted">أعد إعداد الخطة لتظهر المواضيع.</p>;
  const topic = sp.chosen >= 0 ? sp.topics[sp.chosen] : null;
  const poemsFor = String(o.settings.poemsFor ?? "").trim();
  const poems = String(o.settings.poems ?? "").trim();

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h4 className="font-semibold">الخطوة ٢ · اختر موضوع الخطبة</h4>
        <p className="text-sm text-jw-muted">ثلاثة مواضيع من المادة، لكل واحد آية مفتاح ونقطة تخلص. اختر الأنسب لجمهورك ومجلسك، وتقدر تعدّل كلماته أو تغيّر آيته.</p>
        <ol className="space-y-3">
          {sp.topics.map((t, i) => (
            <TopicCard key={`${i}-${t.verse.ref}-${t.title}`} t={t} i={i} chosen={i === sp.chosen} act={act} busy={busy || running} />
          ))}
        </ol>
        {!topic && <p className="text-sm font-bold text-jw-warn">اختر موضوعًا عشان تكمل.</p>}
      </section>

      {topic && (
        <section className="space-y-3">
          <h4 className="font-semibold">الخطوة ٣ · تفسير الآية</h4>
          <p className="text-sm text-jw-muted">الشيخ ما يفسّر الآية من عنده: يأخذ المقطع الدال من التفسير ويرتبه بنص سهل، مع المصدر وأرقام الصفحات والرابط.</p>
          {sp.tafsir ? (
            <div className="jw-panel space-y-3 p-4">
              <p className="text-sm">
                <b>المصدر:</b> {sp.tafsir.source}
                {sp.tafsir.url ? (
                  <>
                    {" "}
                    · <a className="underline" href={sp.tafsir.url} target="_blank" rel="noreferrer">افتح الكتاب</a>
                  </>
                ) : null}
                {sp.tafsir.manual ? " · (أدخلته أنت)" : ""}
              </p>
              <div className="whitespace-pre-wrap rounded-lg bg-jw-surface-2 p-3 text-sm leading-loose">{sp.tafsir.simple}</div>
              {!sp.tafsir.manual && (
                <details>
                  <summary className="cursor-pointer text-sm text-jw-muted">النص الأصلي من الكتاب (للتأكد)</summary>
                  <div className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-jw-line p-3 text-xs leading-loose">{sp.tafsir.excerpt}</div>
                </details>
              )}
            </div>
          ) : (
            <p className="text-sm font-bold text-jw-warn">لسا ما جبنا التفسير: اجلبه من مجمع البيان، أو الصق مقطعًا بنفسك.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <PaidButton label={sp.tafsir ? "اجلب التفسير من جديد" : "اجلب التفسير من مجمع البيان"} primary={!sp.tafsir} what="يبحث الشيخ في مجمع البيان للطبرسي (مكتبة أهل البيت) عن تفسير الآية، ويرتبه بنص سهل مع المصدر والصفحات والرابط." disabled={running} run={(b) => act({ action: "sermon_tafsir", ...b })} />
            <button type="button" className="jw-btn" onClick={() => setOpen((x) => !x)}>{open ? "أغلق" : "📋 الصق التفسير بنفسي"}</button>
          </div>
          {open && (
            <div className="space-y-2 rounded-lg border border-jw-line p-3">
              <input className="jw-input" placeholder="المصدر (الكتاب والجزء والصفحة)" value={manual.source} onChange={(e) => setManual({ ...manual, source: e.target.value })} />
              <input className="jw-input" dir="ltr" placeholder="الرابط (اختياري، https://…)" value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} />
              <textarea className="jw-textarea" rows={8} placeholder="الصق مقطع التفسير هنا" value={manual.text} onChange={(e) => setManual({ ...manual, text: e.target.value })} />
              <button type="button" className="jw-btn jw-btn-primary" disabled={busy || running || !manual.text.trim()} onClick={() => run(async () => { await act({ action: "sermon_tafsir_manual", ...manual }); setOpen(false); })}>
                اعتمد هذا التفسير
              </button>
            </div>
          )}
          <ErrorLine error={error} />
        </section>
      )}

      <section className="space-y-3">
        <h4 className="font-semibold">الخطوة ٤ · الشواهد الأدبية</h4>
        <p className="text-sm text-jw-muted">
          {poemsFor || poems
            ? `${poemsFor ? `الغرض: ${poemsFor}. ` : ""}${poems ? "وأبياتك اللي كتبتها تُستخدم كما هي. " : ""}`
            : "ما حددت أبياتًا ولا غرضًا. "}
          تقدر تطلب من الشيخ يستخرج أبياتًا من مرجع الأشعار: يلقاها بنصها الحرفي مع رقم صفحتها، وتنكتب في الخطبة بالصفحة.
        </p>
        {topic && (
          <>
            <Passages list={sp.poems ?? []} keepAction="sermon_poems_keep" act={act} busy={busy || running} />
            <label className="block space-y-1 text-xs text-jw-muted">اطلب أبياتًا عن… (اختياري)
              <input className="jw-input" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="مثال: أبيات في الصبر على البلاء، أو في فضل العلم" />
            </label>
            <PaidButton label={(sp.poems ?? []).length ? "استخرج أبياتًا من جديد" : "استخرج أبياتًا من المرجع"} primary={!(sp.poems ?? []).length} what="يبحث الشيخ في مرجع الأشعار عن أبيات تخدم الموضوع، وينقلها بنصها الحرفي مع رقم الصفحة، وما يعتمد بيت ما لقاه مكتوب في الصفحة." disabled={running} run={(b) => act({ action: "sermon_poems", ask, refIds: chosen("poetry"), ...b })} />
          </>
        )}
      </section>

      {topic && (
        <section className="space-y-3">
          <h4 className="font-semibold">مصادر المكتبة · قصص وحكم وعبر</h4>
          {lib.filter((r) => r.kind === "source").length === 0 ? (
            <p className="text-sm text-jw-muted">ما فيه مصادر جاهزة في المكتبة للحين (صاحب المنصة يضيفها من لوحة الجواد).</p>
          ) : (
            <>
              <p className="text-sm text-jw-muted">اختر المصادر اللي تبيها، والشيخ يحلل من مجموعها ويستخرج المقاطع اللي تخدم موضوعك بنصها الحرفي مع رقم الصفحة، وتنكتب في الخطبة بمصدرها.</p>
              <ul className="space-y-1">
                {lib.filter((r) => r.kind === "source").map((r) => (
                  <li key={r.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!off.includes(r.id)} onChange={(e) => setOff((x) => (e.target.checked ? x.filter((y) => y !== r.id) : [...x, r.id]))} />
                      <span>{r.title}</span>
                      <span className="text-xs text-jw-faint">({r.pages.toLocaleString("ar")} صفحة)</span>
                    </label>
                  </li>
                ))}
              </ul>
              <Passages list={sp.sources ?? []} keepAction="sermon_sources_keep" act={act} busy={busy || running} />
              <label className="block space-y-1 text-xs text-jw-muted">اطلب عن… (اختياري)
                <input className="jw-input" value={askSrc} onChange={(e) => setAskSrc(e.target.value)} placeholder="مثال: قصص في الصبر على المصيبة، أو في بكاء الأئمة" />
              </label>
              <PaidButton label={(sp.sources ?? []).length ? "استخرج من المصادر من جديد" : "استخرج من المصادر المختارة"} primary={!(sp.sources ?? []).length} what="يبحث الشيخ في المصادر المختارة عن قصص وحكم وعبر تخدم الموضوع، وينقلها بنصها الحرفي مع رقم الصفحة، وما يعتمد مقطع ما لقاه مكتوب في صفحته." disabled={running || chosen("source").length === 0} run={(b) => act({ action: "sermon_sources", ask: askSrc, refIds: chosen("source"), ...b })} />
            </>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h4 className="font-semibold">الخطوة ٥ · أجزاء الخطبة</h4>
        <ol className="space-y-1 text-sm">
          {SERMON_PARTS.map((p, i) => (
            <li key={p.id}>
              <b>
                {(i + 1).toLocaleString("ar")}. {p.title}:
              </b>{" "}
              {p.role}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
