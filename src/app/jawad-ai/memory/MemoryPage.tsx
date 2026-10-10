"use client";

import { useEffect, useState } from "react";

interface Mem { enabled: boolean; notes: string; updatedAt: string | null; ready: boolean; max: number }

export default function MemoryPage() {
  const [m, setM] = useState<Mem | null>(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    fetch("/api/memory", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: Mem) => {
        if (!on) return;
        setM(j);
        setText(j.notes ?? "");
      })
      .catch(() => on && setMsg({ t: "تعذّر التحميل.", bad: true }));
    return () => {
      on = false;
    };
  }, []);

  const save = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "تعذّر الحفظ.");
      setM((x) => (x ? { ...x, ...j } : x));
      setText(j.notes ?? "");
      setMsg({ t: done });
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : "تعذّر الحفظ.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8" dir="rtl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">🧠 ذاكرتي</h1>
        <p className="text-sm text-jw-muted">هذا اللي تعرفه عنك روبوتات الجواد (جواد، حيدرة، محمد باقر، كاظم، قنبر، والذكاء الإسلامي): مشاريعك وأفكارك وأسلوبك، عشان تفهمك وتتوقع اللي تبيه بدون ما تعيد. تتحدّث لحالها بعد كل محادثة، وأنت تقدر تعدّلها أو تمسحها أو تطفيها.</p>
      </header>
      {!m ? (
        <p className="text-sm text-jw-muted">{msg?.t ?? "جاري التحميل…"}</p>
      ) : !m.ready ? (
        <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm">الذاكرة ما تجهّزت بعد في الموقع. ارجع لها بعد شوي.</p>
      ) : (
        <>
          <section className="jw-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <b>{m.enabled ? "✅ الذاكرة شغّالة" : "⏸️ الذاكرة طافية"}</b>
              <p className="text-xs text-jw-muted">{m.enabled ? "الروبوتات تقرأها وتحدّثها. لمحادثة وحدة بدونها: زر 🧠 فوق ← «محادثة بدون ذاكرة»." : "ما تُقرأ ولا تتعلّم في أي محادثة لين تشغّلها."}</p>
            </div>
            <button type="button" className={`jw-btn ${m.enabled ? "" : "jw-btn-primary"}`} disabled={busy} onClick={() => void save({ enabled: !m.enabled }, m.enabled ? "طفّيت الذاكرة" : "شغّلت الذاكرة")}>
              {m.enabled ? "اطفها" : "شغّلها"}
            </button>
          </section>
          <section className="jw-panel space-y-2 p-4">
            <b>وش تعرف عنك</b>
            <textarea className="jw-textarea min-h-64 w-full text-sm leading-7" dir="auto" value={text} maxLength={m.max} onChange={(e) => setText(e.target.value)} placeholder="فاضية للحين. تمتلي لحالها من محادثاتك، أو اكتب هنا اللي تبي الروبوتات تعرفه عنك (مثل: عندي قناة لطميات اسمها…، أحب الألوان الداكنة…)." />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="jw-btn jw-btn-primary" disabled={busy || text === m.notes} onClick={() => void save({ notes: text }, "انحفظت ✅")}>احفظ</button>
              <button type="button" className="jw-btn jw-btn-quiet text-jw-danger" disabled={busy || !m.notes} onClick={() => confirm("نمسح كل اللي تتذكره عنك؟") && void save({ clear: true }, "انمسحت")}>امسح الذاكرة</button>
              <span className="text-xs text-jw-muted">{text.length}/{m.max}{m.updatedAt ? ` · آخر تحديث ${new Date(m.updatedAt).toLocaleString("ar-SA")}` : ""}</span>
            </div>
            <p className="text-[11px] text-jw-muted">ما تنحفظ فيها كلمات سر ولا أرقام حسابات ولا بيانات حساسة. وتقدر تقول لأي روبوت «انسَ كذا» أو «تذكّر كذا».</p>
          </section>
          {msg && <p className={`text-sm ${msg.bad ? "text-jw-danger" : "text-jw-accent"}`}>{msg.t}</p>}
        </>
      )}
    </div>
  );
}
