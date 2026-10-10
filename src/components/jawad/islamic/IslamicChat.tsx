"use client";

// «الذكاء الإسلامي» — the conversation: a question, the answer with its sources (numbered, each a link to the page it
// came from, the primary source thaqalayn marked apart from the complements), and the questions after it in the same
// thread. Three ways to answer (تلقائي / الرواية فقط / بحث وتحليل), and the conversations remembered on the server.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/jawad/Icon";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import MicButton from "@/components/robots/MicButton";
import { useClaudeModel } from "@/components/robots/claude-model";
import { post } from "@/components/jawad/student/client";
import type { Answer } from "@/lib/islamic/ask";
import { MODE_LABEL, type IslamicMode } from "@/lib/islamic/text";

interface Msg {
  role: "user" | "assistant";
  text: string;
  mode?: IslamicMode;
  sources?: Answer["sources"];
  found?: boolean;
  searches?: Answer["searches"];
}
interface ChatItem { id: string; title: string }

const MODES: { id: IslamicMode; ic: string; hint: string }[] = [
  { id: "auto", ic: "✨", hint: "جواب مباشر من المكتبة" },
  { id: "narration", ic: "📜", hint: "نص الروايات من الثقلين فقط، بلا تحليل" },
  { id: "research", ic: "🔎", hint: "يبحث في الثقلين جولة بعد جولة ثم يحلل ويخرج بنتيجة (دقائق)" },
];

/** The answer's light markdown (paragraphs, **bold**, « » quotes, lists, [n] citations) as elements. */
function Rich({ text, sources }: { text: string; sources?: Answer["sources"] }) {
  const line = (s: string, k: number) => {
    const parts = s.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((p, i) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={i}>{p.slice(2, -2)}</b>;
      const m = /^\[(\d+)\]$/.exec(p);
      if (m) {
        const src = sources?.find((x) => x.n === Number(m[1]));
        return src ? (
          <a key={i} href={src.url} target="_blank" rel="noreferrer" className="mx-0.5 rounded bg-jw-accent/15 px-1 text-xs font-bold text-jw-accent no-underline" title={`${src.source} — ${src.title}`}>
            {m[1]}
          </a>
        ) : (
          <span key={i}>{p}</span>
        );
      }
      return <span key={i}>{p}</span>;
    });
    return <span key={k}>{parts}</span>;
  };
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 leading-8">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const h = /^#{2,4}\s+(.*)$/.exec(lines[0]);
        if (h)
          return (
            <div key={i} className="space-y-1">
              <h3 className="pt-1 text-base font-bold text-jw-accent">{line(h[1], 0)}</h3>
              {lines.slice(1).length > 0 && <p>{lines.slice(1).map((l, k) => <span key={k}>{line(l, k)}{k < lines.length - 2 && <br />}</span>)}</p>}
            </div>
          );
        if (lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 ps-6">
              {lines.map((l, k) => (
                <li key={k}>{line(l.replace(/^\s*([-•*]|\d+[.)])\s+/, ""), k)}</li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {lines.map((l, k) => (
              <span key={k}>
                {line(l, k)}
                {k < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function IslamicChat({ name, loginHref }: { name: string; loginHref: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<IslamicMode>("auto");
  const [busy, setBusy] = useState<IslamicMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [memory, setMemory] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const [claude] = useClaudeModel();

  const refresh = useCallback(async () => {
    if (loginHref) return;
    try {
      const r = await fetch("/api/islamic/chats", { cache: "no-store" }).then((x) => x.json());
      setChats(r.chats ?? []);
      setMemory(r.memory !== false);
    } catch { /* the list is a convenience */ }
  }, [loginHref]);
  useEffect(() => {
    if (loginHref) return;
    let live = true;
    fetch("/api/islamic/chats", { cache: "no-store" })
      .then((x) => x.json())
      .then((r) => {
        if (!live) return;
        setChats(r.chats ?? []);
        setMemory(r.memory !== false);
      })
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [loginHref]);

  const open = async (id: string) => {
    setError(null);
    try {
      const r = await fetch(`/api/islamic/chats?id=${id}`, { cache: "no-store" }).then((x) => x.json());
      if (r.chat) {
        setChatId(r.chat.id);
        setMsgs(r.chat.messages);
      }
    } catch {
      setError("تعذّر فتح المحادثة.");
    }
  };
  const fresh = () => { setChatId(null); setMsgs([]); setError(null); };
  const remove = async (id: string) => {
    if (!confirm("نحذف هذي المحادثة؟")) return;
    await fetch(`/api/islamic/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === chatId) fresh();
    void refresh();
  };

  const send = async (text = q, how: IslamicMode = mode) => {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question, mode: how }]);
    setQ("");
    setBusy(how);
    try {
      const r = await post<Answer & { chatId: string | null }>("/api/islamic/ask", { question, history, chatId, mode: how, model: claude.id });
      setMsgs((m) => [...m, { role: "assistant", text: r.answer, mode: r.mode, sources: r.sources, found: r.found, searches: r.searches }]);
      if (r.chatId) setChatId(r.chatId);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMsgs((m) => m.slice(0, -1));
      setQ(question);
    } finally {
      setBusy(null);
    }
  };
  const lastQuestion = [...msgs].reverse().find((m) => m.role === "user")?.text ?? "";
  const lastAnswer = msgs.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2 text-center">
        <span className="text-5xl" aria-hidden>
          🕌
        </span>
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="text-sm text-jw-muted">يجيب من المصادر التي غُذّي بها، الثقلين أولًا ثم المتممات، ويذكر لك المصدر في كل جواب. وما لم يجده يقول لك إنه لم يجده.</p>
      </header>

      {loginHref ? (
        <div className="jw-panel p-6 text-center">
          <Link href={loginHref} className="jw-btn jw-btn-primary">
            سجّل دخولك لتسأل
          </Link>
        </div>
      ) : (
        <>
          {(chats.length > 0 || !memory) && (
            <details className="jw-panel p-3 text-sm" open={false}>
              <summary className="cursor-pointer font-semibold">🗂️ محادثاتي ({chats.length}){chatId ? " · أنت في محادثة محفوظة" : ""}</summary>
              {!memory && <p className="mt-2 text-jw-warn">الذاكرة ما تفعّلت بعد: شغّل ملف SQL رقم 0052 في Supabase، وبعدها تنحفظ المحادثات.</p>}
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {chats.map((c) => (
                  <li key={c.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${c.id === chatId ? "bg-jw-accent/15" : "hover:bg-jw-surface-2"}`}>
                    <button type="button" className="min-w-0 flex-1 truncate text-start" onClick={() => void open(c.id)}>{c.title}</button>
                    <button type="button" className="text-xs text-jw-danger" aria-label="احذف" onClick={() => void remove(c.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="space-y-4">
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ms-auto max-w-[90%] rounded-2xl rounded-ee-sm bg-jw-accent/15 px-4 py-3">
                  {m.mode && m.mode !== "auto" && <span className="mb-1 block text-xs font-semibold text-jw-accent">{MODES.find((x) => x.id === m.mode)?.ic} {MODE_LABEL[m.mode]}</span>}
                  {m.text}
                </div>
              ) : (
                <article key={i} className="jw-panel space-y-3 p-4">
                  {m.found === false && <p className="text-sm font-semibold text-jw-warn">⚠ ما وُجد جواب كافٍ في المصادر المتاحة.</p>}
                  <Rich text={m.text} sources={m.sources} />
                  {m.sources && m.sources.length > 0 && (
                    <ol className="space-y-1 border-t border-jw-line pt-3 text-sm">
                      {m.sources.map((s) => (
                        <li key={s.n} className="flex gap-2">
                          <span className="shrink-0 font-bold text-jw-accent">[{s.n}]</span>
                          <span className={`shrink-0 rounded px-1 text-[10px] font-bold ${s.primary ? "bg-jw-accent/20 text-jw-accent" : "bg-jw-surface-2 text-jw-muted"}`}>{s.primary ? "أساسي" : "متمم"}</span>
                          <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 truncate underline">
                            {s.title}
                          </a>
                          <span className="shrink-0 text-jw-muted">— {s.source}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {m.searches && m.searches.length > 0 && (
                    <details className="text-xs text-jw-muted">
                      <summary className="cursor-pointer">🔎 كيف بحث ({m.searches.length} بحث)</summary>
                      <ul className="mt-1 space-y-0.5">
                        {m.searches.map((s, k) => <li key={k}>{s.scope === "primary" ? "الثقلين" : "المتممات"}: «{s.query}» — {s.hits} مقطع</li>)}
                      </ul>
                    </details>
                  )}
                  {i === lastAnswer && !busy && lastQuestion && (
                    <div className="flex flex-wrap gap-2 border-t border-jw-line pt-3">
                      {m.mode !== "narration" && <button type="button" className="jw-chip text-xs" onClick={() => void send(lastQuestion, "narration")}>📜 أبي الرواية فقط</button>}
                      {m.mode !== "research" && <button type="button" className="jw-chip text-xs" onClick={() => void send(lastQuestion, "research")}>🔎 سوّ بحث وتحليل عميق</button>}
                    </div>
                  )}
                </article>
              ),
            )}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-jw-muted" role="status">
                <span className="jw-spinner" aria-hidden /> {busy === "research" ? "يبحث في الثقلين جولة بعد جولة ثم في المتممات، ويحلل… قد يأخذ دقائق، لا تقفل الصفحة." : busy === "narration" ? "يبحث عن الروايات في الثقلين…" : "يبحث في المكتبة ويكتب الجواب…"}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-lg border border-jw-danger/40 bg-jw-danger/10 px-3 py-2 text-sm text-jw-danger">
                {error}
              </p>
            )}
            <div ref={end} />
          </div>
          <ClaudeModelPicker className="sticky bottom-[8.5rem]" disabled={!!busy} />
          <div className="sticky bottom-[5.25rem] flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="وش تبي؟">
            {MODES.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={mode === x.id} title={x.hint} disabled={!!busy} className={`jw-chip text-xs ${mode === x.id ? "!border-jw-accent !bg-jw-accent/15 font-bold" : ""}`} onClick={() => setMode(x.id)}>
                {x.ic} {MODE_LABEL[x.id]}
              </button>
            ))}
          </div>
          <form
            className="sticky bottom-4 flex items-end gap-2 rounded-2xl border border-jw-line bg-jw-surface p-2 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <MicButton onText={(t) => setQ((v) => (v.trim() ? `${v.trim()} ${t}` : t))} disabled={!!busy} />
            <textarea
              className="jw-textarea min-h-12 flex-1 resize-none !border-0 !bg-transparent"
              rows={1}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={mode === "research" ? "اكتب موضوع البحث…" : mode === "narration" ? "عن أي رواية تبحث؟" : "اكتب سؤالك…"}
              aria-label="سؤالك"
            />
            <button type="submit" className="jw-btn jw-btn-primary jw-btn-icon" disabled={!!busy || !q.trim()} aria-label="أرسل">
              <Icon name="sparkles" size={18} />
            </button>
          </form>
          {msgs.length > 0 && (
            <button type="button" className="jw-btn jw-btn-quiet mx-auto block text-sm" onClick={fresh}>
              محادثة جديدة
            </button>
          )}
        </>
      )}
    </div>
  );
}
