"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";

type Action = { kind: "rewind" | "revise_script" | "revise_sheets" | "revise_director" | "fixed_facts"; to?: string; text?: string; sceneId?: string; effect: string; blocked?: string };
type Msg = { role: "user" | "sajjad"; text: string; at: string; username?: string | null; questions?: { question: string; options: string[] }[]; changes?: string[]; pending?: Action[]; applied?: string[] };
const ACTION_LABEL: Record<Action["kind"], string> = { rewind: "↩️ رجوع لنقطة", revise_script: "✍️ توجيه السيناريست", revise_sheets: "🎨 توجيه صانع الشيت", revise_director: "🎥 توجيه المخرج", fixed_facts: "📌 قاعدة ثابتة" };
type Plan = { note: string; episodes: { number: number; title: string; summary: string; scenes: { title: string; brief: string; assignee: string }[] }[] };
type Finding = { id: string; title: string; text: string; sources: string[]; status: "pending" | "approved" | "dropped"; scope: string };
type Research = { asked?: "yes" | "no"; items: Finding[] };

/** The opening when the person said yes to research at the start: سجاد asks for the scope (no cost until they send). */
const RESEARCH_HELLO = "قلت لي تبيني أبحث لتطوير القصة 🔎 حدّد لي نطاق البحث: وش أبحث عنه بالضبط؟ (الزمن والمكان، أحداث حقيقية، عادات، كيف يصير شي معيّن…) أو اكتب «ابحث» وأنا أختار النطاق من القصة. النتائج تجيك كروت، تعتمد اللي يعجبك وتحذف الباقي.";

const host = (s: string) => {
  try {
    return new URL(s).hostname.replace(/^www\./, "");
  } catch {
    return s.slice(0, 40);
  }
};

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
  const [research, setResearch] = useState<Research>({ items: [] });
  const [canDecide, setCanDecide] = useState(false);
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
    // just made with «نعم، ابحث»: سجاد opens by himself and asks for the scope
    const wantsResearch = new URLSearchParams(window.location.search).get("research") === "1";
    if (wantsResearch) {
      window.history.replaceState(null, "", window.location.pathname);
      const t = setTimeout(() => {
        setOpen(true);
        setText("ابحث لي عن: ");
      }, 0);
      return () => {
        clearTimeout(t);
        window.removeEventListener("sajjad:open", on);
      };
    }
    return () => window.removeEventListener("sajjad:open", on);
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    let live = true;
    api<{ messages: Msg[]; canEdit: boolean; plan: Plan | null; research?: Research; canDecide?: boolean }>(`/api/film/sajjad?kind=${kind}&id=${id}`)
      .then((r) => {
        if (!live) return;
        const first = !r.messages.length && r.research?.asked === "yes";
        setMessages(first ? [{ role: "sajjad", text: RESEARCH_HELLO, at: new Date().toISOString() }] : r.messages);
        setCanEdit(r.canEdit);
        setPlan(r.plan);
        setResearch(r.research ?? { items: [] });
        setCanDecide(Boolean(r.canDecide));
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
      const r = await postJson<{ message: Msg; changes: string[]; plan: Plan | null; research: Research | null }>("/api/film/sajjad", { kind, id, text: body });
      setMessages((m) => [...m, r.message]);
      if (r.plan) setPlan(r.plan);
      if (r.research) setResearch(r.research);
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
  // «اعتمد» / «احذف» on سجاد's findings: the approved ones enter the work (the screenwriter reads them)
  const decide = async (approve: string[], drop: string[]) => {
    setBusy(true);
    setError("");
    try {
      const r = await postJson<{ research: Research }>("/api/film/sajjad", { kind, id, action: "research", approve, drop });
      setResearch(r.research);
      if (approve.length) router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // «تدخّل سجاد»: his last proposal still waiting for «طبّق»
  const proposal = messages.findLast((m) => m.role === "sajjad" && m.pending?.length)?.pending ?? null;
  const decideAction = async (apply: boolean) => {
    setBusy(true);
    setError("");
    try {
      if (apply) {
        const r = await postJson<{ message: Msg }>("/api/film/sajjad", { kind, id, action: "apply" });
        setMessages((m) => [...m.map((x) => (x.pending ? { ...x, pending: undefined, applied: r.message.changes } : x)), r.message]);
        router.refresh();
      } else {
        await postJson("/api/film/sajjad", { kind, id, action: "drop" });
        setMessages((m) => m.map((x) => (x.pending ? { ...x, pending: undefined, applied: ["ما طُبّق"] } : x)));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pending = research.items.filter((f) => f.status === "pending");
  const approved = research.items.filter((f) => f.status === "approved").length;
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

              {proposal && !busy && (
                <div className="space-y-2 rounded-2xl border-2 border-[#dc2626] bg-white p-3 text-sm" aria-label="تدخّل سجاد">
                  <p className="font-black">🛠️ سجاد يبي يتدخّل — هذا اللي بيصير لو طبّقت:</p>
                  <ol className="space-y-2">
                    {proposal.map((a, i) => (
                      <li key={i} className={`rounded-xl p-2 ${a.blocked ? "bg-black/5 opacity-70" : "bg-[#fff1f2]"}`}>
                        <p className="font-extrabold">{ACTION_LABEL[a.kind]}{a.to ? ` · ${a.to === "screenwriter" ? "السيناريست" : a.to === "sheets" ? "صانع الشيت" : "المخرج"}` : ""}</p>
                        {a.text && <p className="whitespace-pre-wrap text-xs font-bold text-muted">«{a.text}»</p>}
                        {a.effect && <p className="text-xs font-extrabold leading-6">⚠️ {a.effect}</p>}
                        {a.blocked && <p className="text-xs font-extrabold text-[#dc2626]">⏭️ ما ينطبق: {a.blocked}</p>}
                      </li>
                    ))}
                  </ol>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-primary min-h-10 flex-1 text-sm" disabled={busy || proposal.every((a) => a.blocked)} onClick={() => decideAction(true)}>طبّق ✅</button>
                    <button type="button" className="btn btn-ghost min-h-10 px-3 text-sm" disabled={busy} onClick={() => decideAction(false)}>لا، خلّه</button>
                  </div>
                </div>
              )}

              {pending.length > 0 && (
                <div className="space-y-2 rounded-2xl border-2 border-[#16a34a] bg-white p-3 text-sm" aria-label="نتائج بحث سجاد">
                  <p className="font-black">🔎 نتائج البحث ({pending.length})</p>
                  <p className="text-xs font-bold text-muted">{canDecide ? "اعتمد اللي يفيد القصة وهو يدخل في الشغل (السيناريست يقراه)، واحذف الباقي." : "اعتمادها لقائد المسلسل أو اللي عنده صلاحية «📖»."}</p>
                  {pending.map((f) => (
                    <article key={f.id} className="space-y-1 rounded-xl bg-[#f0fdf4] p-2">
                      <p className="font-extrabold">{f.title}</p>
                      <p className="whitespace-pre-wrap text-xs font-bold leading-6">{f.text}</p>
                      {f.sources.length > 0 && (
                        <p className="truncate text-[11px] font-bold text-muted" dir="ltr">
                          {f.sources.slice(0, 3).map((s, i) => (
                            <a key={s} href={s} target="_blank" rel="noreferrer" className="underline">
                              {i ? " · " : ""}{host(s)}
                            </a>
                          ))}
                        </p>
                      )}
                      {canDecide && (
                        <div className="flex gap-2 pt-1">
                          <button type="button" className="btn btn-primary min-h-9 flex-1 text-xs" disabled={busy} onClick={() => decide([f.id], [])}>اعتمده ✅</button>
                          <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" disabled={busy} onClick={() => decide([], [f.id])}>احذفه</button>
                        </div>
                      )}
                    </article>
                  ))}
                  {canDecide && pending.length > 1 && (
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-secondary min-h-9 flex-1 text-xs" disabled={busy} onClick={() => decide(pending.map((f) => f.id), [])}>اعتمد الكل</button>
                      <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" disabled={busy} onClick={() => decide([], pending.map((f) => f.id))}>احذف الكل</button>
                    </div>
                  )}
                </div>
              )}
              {approved > 0 && !pending.length && loaded && <p className="text-center text-[11px] font-extrabold text-[#16a34a]">✅ {approved} نتائج بحث معتمدة داخلة في الشغل</p>}

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
                placeholder={kind === "series" && canEdit ? "اكتب وصف المسلسل، أو اسأل، أو اطلب: «اقترح الشخصيات» «ابحث لي عن…» «رتّب الحلقات والمشاهد ووزّع الشغل»" : "اسأل سجاد، أو «ابحث لي عن…»، أو اطلب تغييرًا: «غيّر نهاية القصة» «رجّعنا للسيناريست» «خل المقطع GEN-03 ليلًا»"}
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
