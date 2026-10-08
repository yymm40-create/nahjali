"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";

interface Game { id: string; name: string; genre: string; players: string; notes: string; status: "approved" | "draft" }
interface Run { id: string; label: string; mode: "quick" | "deep"; total: number; done: number; failed: number; passed: number; errors: number; avg: number; usd: number; byKind: Record<string, { n: number; avg: number }>; fixes: string[] }
interface Data { visibility: "owner" | "codes" | "all"; persona: { text: string; edited: boolean }; games: Game[]; count: number; runs: Run[]; estimate: { quick: number; deep: number } }
interface Worst { idx: number; scenario: { kind: string; message: string }; transcript: { role: string; text: string }[]; verdict: { score: number; bad: string; fix: string } | null; error: string | null }

const KIND: Record<string, string> = { research: "بحث", develop: "تطوير", ideate: "أفكار", trap: "فخاخ" };
const URL = "/api/games/admin";

/** The owner's view of «صانع الألعاب»: the persona's template, the library, the tests. */
export default function GamesAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [paste, setPaste] = useState("");
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
      const r = await postJson<{ added?: number; updated?: number }>(URL, body);
      setMsg(r.added !== undefined ? `${done}: ${r.added} جديدة، ${r.updated} تحدّثت` : done);
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
      setBad(w.worst.filter((x) => x.verdict && x.verdict.score < 7 || x.error));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "وقف الاختبار.");
    } finally {
      setRunning(null);
    }
  }

  if (!d) return <p className="text-sm font-bold text-muted">{err ?? "جاري التحميل…"}</p>;
  const drafts = d.games.filter((g) => g.status === "draft");

  return (
    <div className="space-y-6">
      {(err || msg) && <p className={`text-sm font-bold ${err ? "text-red-600" : "text-teal"}`}>{err ?? msg}</p>}

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">👁️ مين يشوف القسم؟</h2>
        <div className="flex flex-wrap gap-2">
          {([["owner", "أنا بس"], ["codes", "اللي عندهم صلاحية «صانع الألعاب» (إيميل أو كود)"], ["all", "كل اللي يدخلون الموقع"]] as const).map(([v, t]) => (
            <button key={v} aria-pressed={d.visibility === v} className={`rounded-full border px-4 py-2 text-sm font-bold ${d.visibility === v ? "border-teal bg-teal/15 text-teal" : "border-line text-muted"}`} onClick={() => act({ action: "visibility", value: v }, "انحفظ")}>
              {d.visibility === v ? "✓ " : ""}{t}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🧠 قالب «قنبر» {d.persona.edited ? "(معدّل)" : "(الافتراضي)"}</h2>
        <p className="text-sm font-bold text-muted">هذا النص اللي يتصرف على أساسه. قواعد المنصة (بدون أسماء نماذج، بدون ادعاء تدريب) تنضاف بعده دائمًا حتى لو عدّلته.</p>
        <textarea className="field min-h-72 w-full font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => act({ action: "persona_save", text }, "انحفظ القالب")}>احفظ القالب</button>
          {d.persona.edited && <button className="btn btn-ghost" onClick={() => confirm("نرجع للقالب الافتراضي؟") && act({ action: "persona_reset" }, "رجع الافتراضي").then(() => setText(""))}>رجّعه للافتراضي</button>}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">📚 مكتبة الألعاب ({d.count})</h2>
        <p className="text-sm font-bold text-muted">«قنبر» يقرأ من هنا لما العميل يذكر لعبة بالاسم. الصق ألعابك: كل سطر لعبة بصيغة «الاسم | النوع | عدد اللاعبين | ملاحظاتك». المعتمد بس يُقرأ.</p>
        <textarea className="field min-h-32 w-full text-sm" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"ماينكرافت | ساندبوكس | 1-100 | عالم مفتوح من مكعبات…\nهولو نايت | ميتروڤانيا | 1 | …"} />
        <button className="btn btn-primary" disabled={!paste.trim()} onClick={async () => { await act({ action: "games_add", text: paste }, "انضافت"); setPaste(""); }}>أضف للمكتبة</button>
        {drafts.length > 0 && <p className="text-sm font-bold">مسودات تنتظر اعتمادك: {drafts.length}</p>}
        <ul className="max-h-96 space-y-1 overflow-y-auto">
          {d.games.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 text-sm">
              <b className="min-w-0 flex-1 truncate">{g.name}</b>
              <span className="text-xs text-muted">{g.genre}</span>
              {g.status === "draft" ? <button className="text-xs font-bold text-teal underline" onClick={() => act({ action: "games_update", id: g.id, status: "approved" }, "اعتُمدت")}>اعتمد</button> : <span className="text-xs text-teal">معتمدة</span>}
              <button className="text-xs text-red-600 underline" onClick={() => confirm(`نحذف «${g.name}»؟`) && act({ action: "games_remove", id: g.id }, "انحذفت")}>احذف</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🧪 الاختبارات</h2>
        <p className="text-sm font-bold text-muted">تشغّل محادثات تجريبية في البحث والتطوير والأفكار والفخاخ (لعبة مختلقة، معلومة تحتاج تدقيق، محاولة تغيير قواعده)، ومحكّم يقيّم كل محادثة. السريع: رد واحد. العميق: رد ثم متابعة. تقدر توقف في أي وقت.</p>
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
                {b.transcript.map((t, i) => <p key={i} className="mt-1 whitespace-pre-wrap text-xs"><b>{t.role === "user" ? "العميل" : "قنبر"}:</b> {t.text}</p>)}
              </details>
            ))}
          </div>
        )}
        <ul className="space-y-2">
          {d.runs.map((r) => (
            <li key={r.id} className="space-y-1 rounded-xl border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <b className="flex-1">{r.label || "تشغيل"} · {r.mode === "deep" ? "عميق" : "سريع"}</b>
                <span>معدل {r.avg}/10</span><span>نجح {r.passed}</span><span>رسب {r.failed}</span>{r.errors > 0 && <span className="text-red-600">أخطاء {r.errors}</span>}<span>${r.usd}</span>
                <button className="text-xs text-red-600 underline" onClick={() => confirm("نحذف هذا التشغيل؟") && act({ action: "test_delete", id: r.id }, "انحذف")}>احذف</button>
              </div>
              <p className="text-xs text-muted">{Object.entries(r.byKind).map(([k, v]) => `${KIND[k] ?? k}: ${v.avg} (${v.n})`).join(" · ")}</p>
              {r.fixes.length > 0 && <ul className="list-disc ps-5 text-xs">{r.fixes.map((f) => <li key={f}>{f}</li>)}</ul>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
