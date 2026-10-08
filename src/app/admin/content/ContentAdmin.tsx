"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";

interface Run { id: string; label: string; mode: "quick" | "deep"; total: number; done: number; failed: number; passed: number; errors: number; avg: number; usd: number; byKind: Record<string, { n: number; avg: number }>; fixes: string[] }
interface Data { visibility: "owner" | "codes" | "all"; persona: { text: string; edited: boolean }; runs: Run[]; estimate: { quick: number; deep: number }; kinds: { id: string; name: string; examples: number }[] }
interface Worst { idx: number; scenario: { kind: string; message: string }; transcript: { role: string; text: string }[]; verdict: { score: number; bad: string; fix: string } | null; error: string | null }

const KIND: Record<string, string> = { carousel: "كاروسيل", reel_script: "سكربت ريل", reel_produced: "ريل منتج", motion: "موشن", titles: "عناوين وكابشن", repurpose: "إعادة توظيف", trap: "فخاخ" };
const URL = "/api/content/admin";

/** The owner's view of «صانع المحتوى»: the persona's template, the example bank, the tests. */
export default function ContentAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [count, setCount] = useState("100");
  const [mode, setMode] = useState<"quick" | "deep">("quick");
  const [running, setRunning] = useState<Run | null>(null);
  const [bad, setBad] = useState<Worst[]>([]);
  const stop = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await api<Data>(URL);
      setD(r);
      setText((t) => t || r.persona.text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر التحميل.");
    }
  }, []);
  useEffect(() => {
    let on = true;
    api<Data>(URL).then((r) => { if (on) { setD(r); setText((t) => t || r.persona.text); } }).catch((e) => { if (on) setErr(e instanceof Error ? e.message : "تعذّر التحميل."); });
    return () => { on = false; };
  }, []);

  const act = async (body: Record<string, unknown>, done: string) => {
    setErr(null); setMsg(null);
    try {
      await postJson(URL, body);
      setMsg(done);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر التنفيذ.");
    }
  };

  const n = Math.max(1, Math.min(1000, Number(count) || 0));
  const cost = d ? n * d.estimate[mode] : 0;

  async function start() {
    if (!d || !confirm(`نبدأ ${n} اختبار (${mode === "deep" ? "عميق" : "سريع"})؟ التكلفة التقريبية $${cost.toFixed(0)} وتنصرف من حساب Claude.`)) return;
    stop.current = false; setBad([]); setErr(null);
    try {
      const { id } = await postJson<{ id: string }>(URL, { action: "test_start", count: n, mode, label: `${n} اختبار` });
      let s = await postJson<Run>(URL, { action: "test_step", id });
      setRunning(s);
      while (!stop.current && s.done + s.errors < s.total) {
        s = await postJson<Run>(URL, { action: "test_step", id });
        setRunning(s);
      }
      const w = await api<{ worst: Worst[] }>(`${URL}?run=${id}`);
      setBad(w.worst.filter((x) => (x.verdict && x.verdict.score < 7) || x.error));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "وقف الاختبار.");
    } finally {
      setRunning(null);
    }
  }

  if (!d) return <p className="text-sm font-bold text-muted">{err ?? "جاري التحميل…"}</p>;

  return (
    <div className="space-y-6">
      {(err || msg) && <p className={`text-sm font-bold ${err ? "text-red-600" : "text-teal"}`}>{err ?? msg}</p>}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">👁️ مين يشوف القسم؟</h2>
        <p className="text-sm font-bold text-muted">«الكود السري» الشامل يعطي صلاحية «صانع المحتوى» تلقائيًا، فالخيار الثاني يفتحه لك ولكل من دخل بالكود أو بإيميل مسموح.</p>
        <div className="flex flex-wrap gap-2">
          {([["owner", "أنا بس"], ["codes", "اللي عندهم صلاحية «صانع المحتوى» (الكود السري، إيميل، أو كود)"], ["all", "كل اللي يدخلون الموقع"]] as const).map(([v, t]) => (
            <button key={v} aria-pressed={d.visibility === v} className={`rounded-full border px-4 py-2 text-sm font-bold ${d.visibility === v ? "border-teal bg-teal/15 text-teal" : "border-line text-muted"}`} onClick={() => act({ action: "visibility", value: v }, "انحفظ")}>
              {d.visibility === v ? "✓ " : ""}{t}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🧠 قالب «محمد باقر» {d.persona.edited ? "(معدّل)" : "(الافتراضي: برومبتك حرفيًا)"}</h2>
        <p className="text-sm font-bold text-muted">هذا النص اللي يتصرف على أساسه. قواعد المنصة وربط الأدوات (الإنتاج بـ GPT Image 2 والتسليم لحيدرة) تنضاف بعده دائمًا حتى لو عدّلته.</p>
        <textarea className="field min-h-72 w-full text-sm" value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => act({ action: "persona_save", text }, "انحفظ القالب")}>احفظ القالب</button>
          {d.persona.edited && <button className="btn btn-ghost" onClick={() => confirm("نرجع للقالب الافتراضي؟") && act({ action: "persona_reset" }, "رجع الافتراضي").then(() => setText(""))}>رجّعه للافتراضي</button>}
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-extrabold">📚 بنك الأمثلة</h2>
        <p className="text-sm font-bold text-muted">لكل نوع عمل ألف مثال جاهز (طلب كما يكتبه الناس ← ما يُقرأ منه، وما يُسأل عنه، وهيكل المخرج). في كل رسالة يشوف محمد باقر أقرب ٣ أمثلة لطلب العميل. الأمثلة مبنية في الكود وتُفحص كلها في اختبارات المشروع.</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {d.kinds.map((k) => (
            <li key={k.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm font-bold">{k.name}: <span dir="ltr">{k.examples.toLocaleString("en")}</span></li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🧪 الاختبارات</h2>
        <p className="text-sm font-bold text-muted">تشغّل محادثات تجريبية بالتناوب على الأنواع الستة والفخاخ (إنتاج بلا مواد، هوك مبالغ، محاولة تغيير قواعده، امرأة حقيقية في الصور، طلب خارج التخصص)، ومحكّم يقيّم كل محادثة. السريع: رد واحد. العميق: رد ثم متابعة. ما ينتج صور ولا يفتح غرف مونتاج أثناء الاختبار. تقدر توقف في أي وقت.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-bold text-muted">العدد (1–1000)<input className="field w-28" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} /></label>
          <select className="field w-auto" value={mode} onChange={(e) => setMode(e.target.value as "quick" | "deep")}>
            <option value="quick">سريع (≈ ${d.estimate.quick} للاختبار)</option>
            <option value="deep">عميق (≈ ${d.estimate.deep} للاختبار)</option>
          </select>
          <button className="btn btn-primary" disabled={!!running} onClick={start}>ابدأ (≈ ${cost.toFixed(0)})</button>
          {running && <button className="btn btn-ghost" onClick={() => { stop.current = true; }}>أوقف</button>}
        </div>
        {running && <p className="text-sm font-bold">{running.done + running.errors} من {running.total} · المعدل {running.avg} · صرف ${running.usd}</p>}
        {bad.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-extrabold">أضعف النتائج</h3>
            {bad.map((b) => (
              <details key={b.idx} className="rounded-xl bg-surface-2 p-3 text-sm">
                <summary className="cursor-pointer font-bold">[{KIND[b.scenario.kind] ?? b.scenario.kind}] {b.verdict?.score ?? "خطأ"} · {b.scenario.message.slice(0, 80)}</summary>
                <p className="mt-2">{b.error ?? b.verdict?.bad}</p>
                {b.verdict?.fix && <p className="font-bold text-teal">اقتراح: {b.verdict.fix}</p>}
                {b.transcript.map((t, i) => <p key={i} className="mt-1 whitespace-pre-wrap text-xs"><b>{t.role === "user" ? "العميل" : "محمد باقر"}:</b> {t.text}</p>)}
              </details>
            ))}
          </div>
        )}
        <ul className="space-y-2">
          {d.runs.map((r) => (
            <li key={r.id} className="rounded-xl bg-surface-2 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{r.label} · {r.mode === "deep" ? "عميق" : "سريع"}</b>
                <span>{r.done}/{r.total} · نجح {r.passed} · فشل {r.failed}{r.errors ? ` · أخطاء ${r.errors}` : ""} · المعدل {r.avg} · ${r.usd}</span>
                <button className="text-xs text-red-600 underline" onClick={() => confirm("نحذف هذا التشغيل؟") && act({ action: "test_delete", id: r.id }, "انحذف")}>احذف</button>
              </div>
              <p className="mt-1 text-xs text-muted">{Object.entries(r.byKind).map(([k, v]) => `${KIND[k] ?? k}: ${v.avg} (${v.n})`).join(" · ")}</p>
              {r.fixes.length > 0 && <ul className="mt-1 list-disc ps-5 text-xs">{r.fixes.map((f) => <li key={f}>{f}</li>)}</ul>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
