"use client";

// «محادثة مع صادق» — an output of «الطالب الذكي» that is a conversation kept with the material: the student asks,
// discusses, is quizzed or prepared, and صادق searches the web when asked (its links under the answer).

import { useBranch } from "./branch";
import { useEffect, useRef, useState } from "react";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import { useClaudeModel } from "@/components/robots/claude-model";
import type { OutputView } from "./client";
import type { ProjectHook } from "./StudentProject";
import RobotFace from "@/components/RobotFace";
import { KIND_LOOK, Tile } from "./look";
import { download, MergedNote, type MergedView } from "./MergePdf";
import { outputName } from "@config/jawad/student";
import type { Offer } from "@/lib/jawad/student/offer";

interface Msg { role: "user" | "assistant"; text: string; at?: string; sources?: string[]; error?: boolean; offer?: Offer }

const STARTERS = [
  "اشرح لي الموضوع باختصار",
  "وش أهم ٥ أفكار لازم أعرفها؟",
  "اسألني أسئلة وصحّح لي",
  "ابحث لي عن معلومات إضافية في الموضوع مع المصادر",
  "ناقشني: وش أقوى رأي مخالف؟",
  "جهّزني قبل الدرس",
  "سوّ لي ملخص ورقة وحدة",
  "سوّ لي اختبار على المادة",
];

const messagesOf = (o: OutputView): Msg[] => {
  const m = (o.content as { messages?: Msg[] } | null)?.messages;
  return Array.isArray(m) ? m : [];
};

export default function SadiqChat({ p, o, onMake }: { p: ProjectHook; o: OutputView; onMake?: () => void }) {
  const { assistant: A, face } = useBranch();
  const [model] = useClaudeModel();
  const [list, setList] = useState<Msg[]>(() => messagesOf(o));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [making, setMaking] = useState<number | null>(null);
  const [merged, setMerged] = useState<MergedView | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [list.length, busy]);

  const send = async (text: string) => {
    const said = text.trim();
    if (!said || busy) return;
    setDraft("");
    setList((l) => [...l, { role: "user", text: said }]);
    setBusy(true);
    try {
      const r = (await p.actOutput(o.id, { action: "chat", message: said, model: model.id })) as { messages?: Msg[] } | undefined;
      if (r?.messages) setList(r.messages);
    } catch (e) {
      setList((l) => [...l, { role: "assistant", text: e instanceof Error ? e.message : `${A} ما قدر يرد الحين؛ جرّب بعد شوي.`, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  // the card under his message: «نفّذ» makes what he offered (the page then runs it all, like «ابدأ»), or «لا شكرًا»
  const decide = async (index: number, dismiss: boolean) => {
    if (making !== null) return;
    setMaking(index);
    const mark = (state: "made" | "dismissed" | "open") => setList((l) => l.map((m, i) => (i === index && m.offer ? { ...m, offer: { ...m.offer, state } } : m)));
    mark(dismiss ? "dismissed" : "made");
    try {
      const r = (await p.actOutput(o.id, { action: "chat_make", index, dismiss })) as { made?: string[]; merged?: MergedView | null } | undefined;
      if (r?.merged) {
        setMerged(r.merged);
        download(r.merged.url);
      }
      if (r?.made?.length) onMake?.();
    } catch (e) {
      mark("open");
      setList((l) => [...l, { role: "assistant", text: e instanceof Error ? e.message : `${A} ما قدر ينفّذ الحين؛ جرّب بعد شوي.`, error: true }]);
    } finally {
      setMaking(null);
    }
  };

  return (
    <section className="jw-panel min-w-0 space-y-3 p-4" aria-labelledby={`o-${o.id}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`o-${o.id}`} className="text-lg font-bold">💬 {o.title}</h2>
        <ClaudeModelPicker disabled={busy} />
      </header>
      <p className="text-xs text-jw-muted">ناقش {A} في مادتك: يشرح، يلخّص، يسألك، يجهّزك للدرس أو للمناظرة، ويبحث لك في الويب لو طلبت. وهو نفسه {A} اللي مشى معك من البداية: قله «سوّ لي ملخص» أو «سوّ اختبار» أو «ادمج كل شي في PDF» وهو يقترح ويصنع بعد ما تضغط «نفّذ». المحادثة محفوظة هنا مع مادتك.</p>

      {merged && <MergedNote m={merged} />}

      <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-xl border border-jw-line bg-white/60 p-3">
        {!list.length && <p className="py-6 text-center text-sm text-jw-faint">ابدأ بسؤال أو اختر واحد من تحت 👇</p>}
        {list.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-7 ${m.role === "user" ? "bg-violet-100" : m.error ? "bg-red-50 text-jw-danger" : "border border-jw-line bg-white"}`}>
              {m.role === "assistant" && !m.error && <b className="mb-1 flex items-center gap-1 text-xs text-violet-700"><RobotFace id={face} size={20} /> {A}</b>}
              {m.text}
              {m.offer && (
                <span className="mt-3 block space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-start">
                  {m.offer.items.map((it) => (
                    <span key={it.kind} className="flex items-start gap-2">
                      <Tile emoji={KIND_LOOK[it.kind]?.emoji ?? "✨"} grad={KIND_LOOK[it.kind]?.grad ?? ""} size={30} />
                      <span className="min-w-0">
                        <b className="block text-sm">{outputName(it.kind)}</b>
                        {it.note && <span className="block text-xs text-jw-muted">{it.note}</span>}
                      </span>
                    </span>
                  ))}
                  {m.offer.merge && <b className="block text-sm">📎 ادمج النواتج الجاهزة في PDF واحد</b>}
                  {m.offer.state === "open" && (
                    <span className="flex flex-wrap gap-2">
                      <button type="button" className="jw-btn jw-btn-primary !min-h-9" disabled={making !== null || busy} onClick={() => void decide(i, false)}>
                        {making === i ? <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden /> : null} نفّذ
                      </button>
                      <button type="button" className="jw-btn !min-h-9" disabled={making !== null || busy} onClick={() => void decide(i, true)}>
                        لا شكرًا
                      </button>
                    </span>
                  )}
                  {m.offer.state === "made" && <span className="block text-xs text-jw-ok">✅ تم — {m.offer.items.length ? `${A} يصنعها الحين، تابعها فوق في النواتج` : "نزّلته لك"}</span>}
                  {m.offer.state === "dismissed" && <span className="block text-xs text-jw-faint">تركناها.</span>}
                </span>
              )}
              {!!m.sources?.length && (
                <span className="mt-2 block space-y-0.5 border-t border-jw-line pt-1 text-xs">
                  {m.sources.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="block truncate text-violet-700 underline" dir="ltr">
                      {u}
                    </a>
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-end text-xs text-jw-muted">{A} يكتب… <span className="jw-spinner" /></p>}
        <div ref={end} />
      </div>

      {!list.length && (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button key={s} type="button" className="jw-chip text-xs" disabled={busy} onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="flex items-end gap-2" onSubmit={(e) => (e.preventDefault(), void send(draft))}>
        <textarea
          ref={box}
          className="jw-input min-h-[44px] flex-1 resize-none"
          rows={2}
          maxLength={4000}
          placeholder={`اكتب ل${A}… (اطلب «ابحث» لو تبيه يبحث في الويب)`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        <button type="submit" className="jw-btn jw-btn-primary" disabled={busy || !draft.trim()}>
          إرسال
        </button>
      </form>
    </section>
  );
}
