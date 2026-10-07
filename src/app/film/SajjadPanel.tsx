"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";

type Msg = { role: "user" | "sajjad"; text: string; at: string; username?: string | null; questions?: { question: string; options: string[] }[]; changes?: string[] };
type Plan = { note: string; episodes: { number: number; title: string; summary: string; scenes: { title: string; brief: string; assignee: string }[] }[] };

/** Opens سجاد from anywhere on the page, optionally with a message ready to send. */
export function openSajjad(text?: string) {
  window.dispatchEvent(new CustomEvent("sajjad:open", { detail: { text } }));
}

/**
 * «سجاد»: the consultant, a tap away on every page of a film or a series. He already knows the whole work (even for
 * someone who never talked to him), answers anything, asks what's still needed (tap a suggested answer, or write your
 * own), and — for whoever may develop the series — writes the description, adds characters and places, and proposes
 * a plan that waits for «طبّق الخطة».
 */
export default function SajjadPanel({ kind, id }: { kind: "film" | "series"; id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<{ text?: string }>).detail?.text;
      setOpen(true);
      if (t) setText(t);
    };
    window.addEventListener("sajjad:open", on);
    return () => window.removeEventListener("sajjad:open", on);
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    let live = true;
    api<{ messages: Msg[]; canEdit: boolean; plan: Plan | null }>(`/api/film/sajjad?kind=${kind}&id=${id}`)
      .then((r) => {
        if (!live) return;
        setMessages(r.messages);
        setCanEdit(r.canEdit);
        setPlan(r.plan);
        setLoaded(true);
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [open, loaded, kind, id]);

  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length, busy]);

  const send = async (t: string) => {
    const body = t.trim();
    if (!body || busy) return;
    setBusy(true);
    setError("");
    setMessages((m) => [...m, { role: "user", text: body, at: new Date().toISOString() }]);
    setText("");
    setAnswers({});
    try {
      const r = await postJson<{ message: Msg; changes: string[]; plan: Plan | null }>("/api/film/sajjad", { kind, id, text: body });
      setMessages((m) => [...m, r.message]);
      if (r.plan) setPlan(r.plan);
      if (r.changes.length) router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => m.slice(0, -1));
      setText(body);
    } finally {
      setBusy(false);
    }
  };
  const planAction = async (action: "apply_plan" | "drop_plan") => {
    setBusy(true);
    setError("");
    try {
      const r = await postJson<{ episodes?: number; scenes?: number }>(`/api/film/series/${id}`, { action });
      setPlan(null);
      if (action === "apply_plan") setMessages((m) => [...m, { role: "sajjad", text: `طبّقت الخطة ✅ أضفت ${r.episodes ?? 0} حلقات و${r.scenes ?? 0} مشاهد.`, at: new Date().toISOString() }]);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const last = messages.at(-1);
  const questions = last?.role === "sajjad" ? (last.questions ?? []) : [];
  const answerAll = () => send(questions.map((q, i) => `${q.question}\n← ${answers[i]?.trim() || "(ما قررت بعد)"}`).join("\n\n"));

  return (
    <>
      <button type="button" className="sajjad-fab" onClick={() => setOpen(true)} aria-label="اسأل سجاد">
        <span className="sajjad-face" aria-hidden>🧑‍🏫</span>
        <span>سجاد</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[300] flex justify-end bg-black/30 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <aside className="sajjad-panel flex h-full w-full max-w-md flex-col" onClick={(e) => e.stopPropagation()} aria-label="سجاد">
            <header className="flex items-center gap-3 border-b border-black/10 p-4">
              <span className="sajjad-face text-3xl" aria-hidden>🧑‍🏫</span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black">سجاد</p>
                <p className="truncate text-xs font-bold text-muted">مستشارك: فاهم {kind === "series" ? "المسلسل كله" : "القصة كلها"}، اسأله أي شي</p>
              </div>
              <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" onClick={() => setOpen(false)}>إغلاق</button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!loaded && !error && <p className="text-sm font-bold text-muted">سجاد يقرا كل شي…</p>}
              {loaded && !messages.length && (
                <div className="space-y-2 rounded-2xl bg-white/70 p-3 text-sm font-bold leading-7">
                  <p>هلا! أنا سجاد 👋 فاهم {kind === "series" ? "المسلسل وشخصياته وحلقاته ومشاهده" : "القصة والسيناريو وكل اللي صار"}، واللي ما تقرر بعد أقول لك.</p>
                  {kind === "series" && canEdit && <p>تقدر تكتب لي وصف المسلسل وأسألك اللي ناقص، أو تطلب مني أقترح شخصيات وبيئات، أو أرتّب لك الحلقات والمشاهد ومين يسوي إيش.</p>}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[92%] space-y-1 rounded-2xl p-3 text-sm leading-7 ${m.role === "user" ? "ms-auto bg-[#0b1d47] text-white" : "me-auto bg-white shadow-sm"}`}>
                  {m.role === "user" && m.username && <p className="text-[11px] font-extrabold opacity-70" dir="ltr">@{m.username}</p>}
                  <p className="whitespace-pre-wrap font-bold">{m.text}</p>
                  {m.changes?.length ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {m.changes.map((c) => (
                        <span key={c} className="rounded-full bg-[#e2a72c]/20 px-2 py-0.5 text-[11px] font-extrabold">{c}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {busy && <p className="me-auto rounded-2xl bg-white p-3 text-sm font-bold text-muted shadow-sm">سجاد يفكّر…</p>}

              {questions.length > 0 && !busy && (
                <div className="space-y-3 rounded-2xl border-2 border-[#e2a72c] bg-white/80 p-3">
                  <p className="text-xs font-extrabold text-muted">جاوب اللي تعرفه، واللي ما تعرفه خلّه (ترجع له متى ما تبي):</p>
                  {questions.map((q, i) => (
                    <div key={i} className="space-y-1.5">
                      <p className="text-sm font-extrabold">{q.question}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map((o) => (
                          <button key={o} type="button" className={`rounded-full border px-3 py-1 text-xs font-bold ${answers[i] === o ? "border-[#1f63f0] bg-[#1f63f0] text-white" : "border-black/15 bg-white"}`} onClick={() => setAnswers({ ...answers, [i]: answers[i] === o ? "" : o })}>
                            {o}
                          </button>
                        ))}
                      </div>
                      <input className="field text-sm" placeholder="أو اكتب جوابك" value={q.options.includes(answers[i] ?? "") ? "" : (answers[i] ?? "")} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} />
                    </div>
                  ))}
                  <button type="button" className="btn btn-primary min-h-10 w-full text-sm" disabled={!Object.values(answers).some((a) => a?.trim())} onClick={answerAll}>أرسل أجوبتي</button>
                </div>
              )}

              {plan && canEdit && (
                <div className="space-y-2 rounded-2xl border-2 border-[#1f63f0] bg-white p-3 text-sm">
                  <p className="font-black">📋 الخطة المقترحة</p>
                  {plan.note && <p className="font-bold text-muted">{plan.note}</p>}
                  <ol className="space-y-2">
                    {plan.episodes.map((e) => (
                      <li key={e.number} className="rounded-xl bg-[#eef3ff] p-2">
                        <p className="font-extrabold">الحلقة {e.number}{e.title ? ` · ${e.title}` : ""}</p>
                        {e.summary && <p className="text-xs font-bold text-muted">{e.summary}</p>}
                        <ul className="mt-1 space-y-0.5 text-xs font-bold">
                          {e.scenes.map((s, k) => (
                            <li key={k}>• {s.title}{s.assignee ? <> · <bdi dir="ltr">@{s.assignee.replace(/^@/, "")}</bdi></> : null}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-primary min-h-10 flex-1 text-sm" disabled={busy} onClick={() => planAction("apply_plan")}>طبّق الخطة ✅</button>
                    <button type="button" className="btn btn-ghost min-h-10 px-3 text-sm" disabled={busy} onClick={() => planAction("drop_plan")}>ما أبيها</button>
                  </div>
                </div>
              )}
              {error && <p className="error-box text-sm">{error}</p>}
              <div ref={end} />
            </div>

            <form
              className="flex gap-2 border-t border-black/10 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <textarea
                className="field min-h-12 flex-1 resize-none text-sm"
                rows={2}
                maxLength={6000}
                placeholder={kind === "series" && canEdit ? "اكتب وصف المسلسل، أو اسأل، أو اطلب: «اقترح الشخصيات» «رتّب الحلقات والمشاهد ووزّع الشغل»" : "اسأل سجاد أي شي عن الشغل…"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
              />
              <button className="btn btn-primary min-h-12 px-4" disabled={busy || !text.trim()}>أرسل</button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
