/* eslint-disable @next/next/no-img-element */
"use client";

// «المصمم الذكي» — the studio and the conversation with «كاظم»: chats on the side, cards to start from (the kinds of
// design), his questions as buttons (and the source cards, the directions, the font gallery), the messages with the
// person's attachments, the design drawn by جواد appearing in the layers editor where every word is edited, and the
// final PNG saved. The look is designer.css.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import MicButton from "@/components/robots/MicButton";
import { useClaudeModel } from "@/components/robots/claude-model";
import { useRouter } from "next/navigation";
import { api, postJson } from "@/lib/fetch";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import QuickReplies, { Swatches } from "@/components/jawad/QuickReplies";
import { answerLine, DELEGATE_LINE } from "@/lib/content/marks";
import { DESIGN_KINDS, DESIGN_SOURCES } from "@config/designer";
import type { Layer } from "@/lib/designer/layers";
import LayerEditor, { loadFont, type DesignView, type FontDef } from "./LayerEditor";

interface FileView { id: string; kind: "image" | "video" | "audio"; name: string; durationMs: number | null; url?: string | null }
interface Question { label: string; kind: "choice" | "source" | "directions" | "fonts"; options: string[]; multi: boolean }
interface Msg { role: "user" | "assistant"; text: string; files?: FileView[]; questions?: Question[]; design?: DesignView; error?: boolean }
interface ChatItem { id: string; title: string }

const STARTS = DESIGN_KINDS.filter((k) => k.id !== "other").map((k) => ({ ic: k.icon, t: k.name, m: `أبي ${k.name}. اسألني عن اللي تحتاجه.` }));
const COLORS = ["#2f74ff", "#ff6b8a", "#ffb347", "#5ad7a3", "#a78bfa", "#38bdf8"];

/** The answer's light markdown (headings, lists, tables, bold, rules; colours as swatches) as elements. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <b key={i}>{p.slice(2, -2)}</b> : /^`[^`]+`$/.test(p) ? <code key={i}>{p.slice(1, -1)}</code> : <Swatches key={i} text={p} cls="dz" />));
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let table: string[][] | null = null;
  const flush = () => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      out.push(<Tag key={out.length}>{list.items.map((x, i) => <li key={i}>{inline(x)}</li>)}</Tag>);
      list = null;
    }
    if (table) {
      const [head, ...rows] = table;
      out.push(<table key={out.length}><thead><tr>{head.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table>);
      table = null;
    }
  };
  for (const line of text.split("\n")) {
    const tr = /^\s*\|(.+)\|\s*$/.exec(line);
    if (tr) {
      const cells = tr[1].split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (list) flush();
      (table ??= []).push(cells);
      continue;
    }
    const li = /^\s*(?:([-•*])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      const ordered = Boolean(li[2]);
      if (table || (list && list.ordered !== ordered)) flush();
      (list ??= { ordered, items: [] }).items.push(li[3]);
      continue;
    }
    flush();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) out.push(h[1].length <= 2 ? <h3 key={out.length}>{inline(h[2])}</h3> : <h4 key={out.length}>{inline(h[2])}</h4>);
    else if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) out.push(<hr key={out.length} />);
    else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

/** The questions of an answer as buttons: a plain one sends on a press; a batch collects the answers first. */
export function Questions({ questions, fonts, disabled, onSend, onWrite }: { questions: Question[]; fonts: FontDef[]; disabled: boolean; onSend: (text: string) => void; onWrite: () => void }) {
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [other, setOther] = useState<Record<number, string>>({});
  const [openOther, setOpenOther] = useState<Record<number, boolean>>({});

  if (questions.length === 1 && questions[0].kind === "choice" && !questions[0].multi) {
    return <QuickReplies cls="dz" options={questions[0].options} disabled={disabled} onPick={(o) => onSend(o)} onWrite={onWrite} />;
  }
  const toggle = (qi: number, o: string, multi: boolean) =>
    setPicked((p) => {
      const cur = p[qi] ?? [];
      return { ...p, [qi]: cur.includes(o) ? cur.filter((x) => x !== o) : multi ? [...cur, o] : [o] };
    });
  const answerOf = (qi: number): string | null => {
    const q = questions[qi];
    const a = [...(picked[qi] ?? []), ...(other[qi]?.trim() ? [other[qi].trim()] : [])];
    return a.length ? answerLine(q.label, a) : null;
  };
  const answered = questions.map((_, i) => answerOf(i)).filter((x): x is string => !!x);
  const send = (delegate: boolean) => onSend([...answered, ...(delegate ? [DELEGATE_LINE] : [])].join("\n"));

  return (
    <div className="dz-qs">
      {questions.map((q, qi) => (
        <div key={qi} className="dz-q">
          <b>{qi + 1}) {q.label}{q.multi ? " (يجوز أكثر من خيار)" : ""}</b>
          {q.kind === "source" ? (
            <div className="dz-sources">
              {DESIGN_SOURCES.map((s, i) => (
                <button key={s.id} type="button" className="dz-source" style={{ ["--c" as string]: COLORS[i] }} aria-pressed={(picked[qi] ?? []).includes(s.name)} disabled={disabled} onClick={() => toggle(qi, s.name, false)}>
                  <span className="ic">{s.icon}</span><b>{s.name}</b><small>{s.hint}</small>
                </button>
              ))}
            </div>
          ) : q.kind === "fonts" ? (
            <div className="dz-fonts">
              {fonts.map((f) => (
                <button key={f.id} type="button" className="dz-fontcard" style={{ fontFamily: `"${f.family}", sans-serif` }} aria-pressed={(picked[qi] ?? []).includes(`«${f.label}» (${f.id})`)} disabled={disabled} onMouseEnter={() => void loadFont(f)} onClick={() => { void loadFont(f); toggle(qi, `«${f.label}» (${f.id})`, false); }}>
                  <span className="sample">بسم الله الرحمن الرحيم</span>
                  <small>{f.label}</small>
                </button>
              ))}
              <button type="button" className="dz-opt dz-opt-write" aria-pressed={(picked[qi] ?? []).includes("أنت اختر")} disabled={disabled} onClick={() => toggle(qi, "أنت اختر", false)}>🎲 أنت اختر الخط</button>
            </div>
          ) : (
            <div className="dz-opts">
              {q.options.map((o) => (
                <button key={o} type="button" className={`dz-opt ${q.kind === "directions" ? "dir" : ""}`} aria-pressed={(picked[qi] ?? []).includes(o)} disabled={disabled} onClick={() => toggle(qi, o, q.multi)}>
                  <Swatches text={o} cls="dz" />
                </button>
              ))}
              <button type="button" className="dz-opt dz-opt-write" aria-pressed={!!openOther[qi]} disabled={disabled} onClick={() => setOpenOther((s) => ({ ...s, [qi]: !s[qi] }))}>✍️ غير ذلك</button>
              {openOther[qi] && <input className="dz-inline" dir="auto" value={other[qi] ?? ""} placeholder="اكتب إجابتك" onChange={(e) => setOther((s) => ({ ...s, [qi]: e.target.value.slice(0, 300) }))} />}
            </div>
          )}
        </div>
      ))}
      <div className="dz-actions">
        <button type="button" className="dz-send" disabled={disabled || answered.length === 0} onClick={() => send(false)}>أرسل الإجابات ✅</button>
        <button type="button" className="dz-opt" disabled={disabled} onClick={() => send(true)}>🎲 اختر أنت لكل ما لم أحدده</button>
        <button type="button" className="dz-opt dz-opt-write" disabled={disabled} onClick={onWrite}>✍️ اكتب إجابة مختلفة</button>
      </div>
    </div>
  );
}

export default function DesignerChat({ name, persona, loginHref, owner, photo, initialChat }: { name: string; persona: string; loginHref: string | null; owner?: boolean; photo?: boolean; initialChat?: string | null }) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"" | "writing" | "drawing" | "splitting">("");
  const [saving, setSaving] = useState(false);
  const [side, setSide] = useState(false);
  const [pending, setPending] = useState<FileView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fonts, setFonts] = useState<FontDef[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (loginHref) return;
    try {
      setChats((await api<{ chats: ChatItem[] }>("/api/designer/chats")).chats);
    } catch { /* the list is a convenience */ }
  }, [loginHref]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (loginHref) return;
    let on = true;
    api<{ fonts: FontDef[] }>("/api/designer/fonts").then((r) => { if (on) setFonts(r.fonts); }).catch(() => null);
    return () => { on = false; };
  }, [loginHref]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);

  const move = (e: React.PointerEvent) => {
    const r = root.current;
    if (!r || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    r.style.setProperty("--mx", String((e.clientX / window.innerWidth - 0.5) * 2));
    r.style.setProperty("--my", String((e.clientY / window.innerHeight - 0.5) * 2));
  };

  /** The last answer that carries a design gets this block. */
  const putDesign = (fn: (old: DesignView | undefined) => DesignView | undefined) =>
    setMsgs((m) => {
      const i = m.map((x) => !!x.design).lastIndexOf(true);
      if (i < 0) return m;
      const copy = [...m];
      copy[i] = { ...copy[i], design: fn(copy[i].design) };
      return copy;
    });

  /** The produce step: جواد draws the artwork (one call, about a minute), then the editor opens. */
  const runProduce = useCallback(async (id: string, retry = false) => {
    setBusy("drawing");
    try {
      const r = await postJson<{ design: DesignView }>("/api/designer/produce", { chatId: id, ...(retry ? { retry: true } : {}) });
      putDesign(() => r.design);
    } catch (e) {
      putDesign((old) => (old ? { ...old, state: "failed", error: e instanceof Error ? e.message : "تعذّر الرسم." } : old));
    } finally {
      setBusy("");
    }
  }, []);

  /** The split step: the subject cut out of the person's picture, over the picture itself. */
  const runSplit = useCallback(async (id: string, uploadId: string) => {
    setBusy("splitting");
    try {
      const r = await postJson<{ design: DesignView }>("/api/designer/split", { chatId: id, uploadId });
      putDesign(() => r.design);
    } catch (e) {
      putDesign((old) => (old ? { ...old, state: "failed", error: e instanceof Error ? e.message : "تعذّر التفكيك." } : old));
    } finally {
      setBusy("");
    }
  }, []);

  async function open(id: string) {
    setSide(false);
    try {
      const r = await api<{ chat: { id: string; messages: Msg[]; pending: boolean } }>(`/api/designer/chats?id=${id}`);
      setChatId(r.chat.id);
      setMsgs(r.chat.messages);
      if (r.chat.pending) void runProduce(r.chat.id);
    } catch (e) {
      setMsgs([{ role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح المحادثة.", error: true }]);
    }
  }
  const fresh = () => { setChatId(null); setMsgs([]); setPending([]); setSide(false); };

  // coming back from «زهراء فوتو ماستر» (or a link): open that conversation
  const opened = useRef(false);
  useEffect(() => {
    if (initialChat && !loginHref && !opened.current) { opened.current = true; void open(initialChat); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChat, loginHref]);

  /** Sends the last design to «زهراء» to be edited (she can send it back). */
  async function toZahraa() {
    if (!chatId) return;
    setBusy("writing");
    try {
      const r = await postJson<{ id: string }>("/api/photo/projects", { from: "designer", chatId });
      router.push(`/jawad-ai/photo/${r.id}`);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح التصميم عند زهراء.", error: true }]);
      setBusy("");
    }
  }

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 8 - pending.length)) {
        try {
          const probe = await probeFile(file, "image");
          const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: probe.kind, mime: probe.mime, bytes: file.size, fileName: file.name });
          await putWithProgress(signed.signedUrl, file, probe.mime, () => {});
          const conf = await postJson<{ upload: { id: string; status: string; error: string | null; url: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
          if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر فحص الملف.");
          setPending((p) => [...p, { id: conf.upload.id, kind: probe.kind, name: file.name, durationMs: probe.durationMs, url: conf.upload.url }]);
        } catch (e) {
          setMsgs((m) => [...m, { role: "assistant", text: `${file.name}: ${e instanceof Error ? e.message : "تعذّر الرفع."}`, error: true }]);
        }
      }
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
    }
  }

  const [claude] = useClaudeModel();

  async function send(text = q) {
    const message = text.trim();
    if ((!message && !pending.length) || busy || uploading) return;
    const files = pending;
    setQ("");
    setPending([]);
    setBusy("writing");
    setMsgs((m) => [...m, { role: "user", text: message || "(صور مرفقة)", files: files.length ? files : undefined }]);
    let produceId: string | null = null;
    let splitOf: string | null = null;
    try {
      const r = await postJson<{ chatId: string; text: string; questions: Question[] | null; pending: boolean; split: string | null }>("/api/designer/chat", { chatId, message, attachments: files.map((f) => f.id), model: claude.id });
      setChatId(r.chatId);
      // the design's state and layers are read back fresh (the answer may have opened a design)
      const full = await api<{ chat: { messages: Msg[] } }>(`/api/designer/chats?id=${r.chatId}`).catch(() => null);
      if (full) setMsgs(full.chat.messages);
      else setMsgs((m) => [...m, { role: "assistant", text: r.text, questions: r.questions ?? undefined }]);
      void refresh();
      if (r.pending) produceId = r.chatId;
      else if (r.split) { produceId = r.chatId; splitOf = r.split; }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر الرد.", error: true }]);
    } finally {
      setBusy("");
    }
    if (produceId && splitOf) await runSplit(produceId, splitOf);
    else if (produceId) await runProduce(produceId);
  }

  async function remove(id: string) {
    if (!confirm("نحذف هذي المحادثة وتصاميمها؟")) return;
    await fetch(`/api/designer/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === chatId) fresh();
    void refresh();
  }

  /** The person's edits of the layers: shown at once, saved a moment later. */
  const changeLayers = (layers: Layer[]) => {
    putDesign((old) => (old ? { ...old, layers: layers.map((l) => ({ ...l, url: l.kind === "image" ? (old.layers.find((x) => x.id === l.id) as { url?: string | null } | undefined)?.url ?? null : undefined })) as DesignView["layers"] } : old));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { if (chatId) void fetch("/api/designer/chats", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, layers }) }).catch(() => null); }, 800);
  };

  const saveFinal = async (blob: Blob) => {
    if (!chatId) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("chatId", chatId);
      fd.append("file", blob, "design.png");
      const r = await api<{ fileId: string; url: string | null }>("/api/designer/final", { method: "POST", body: fd });
      putDesign((old) => (old ? { ...old, final: r.fileId, finalUrl: r.url } : old));
      setMsgs((m) => [...m, { role: "assistant", text: "💾 انحفظ التصميم النهائي PNG. تقدر تحمّله من زر «آخر نسخة محفوظة»، وتعدّل وتحفظ مرة ثانية متى ما تبي." }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر الحفظ.", error: true }]);
    } finally {
      setSaving(false);
    }
  };

  const lastAssistant = msgs.map((x) => x.role).lastIndexOf("assistant");
  const lastDesign = msgs.map((x) => !!x.design).lastIndexOf(true);

  return (
    <div className="dz" ref={root} onPointerMove={move}>
      <div className="dz-scene" aria-hidden>
        {COLORS.map((c, i) => (
          <div key={i} className="dz-blob" style={{ ["--c" as string]: c, ["--i" as string]: i } as CSSProperties} />
        ))}
      </div>

      <div className="dz-wrap">
        <aside className={`dz-side dz-glass ${side ? "open" : ""}`}>
          <button className="dz-send" style={{ width: "100%" }} onClick={fresh}>＋ تصميم جديد</button>
          <div className="dz-chats">
            {chats.map((c) => (
              <div key={c.id} className="dz-chat-item" aria-current={c.id === chatId} onClick={() => open(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(c.id)}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <button className="dz-mini" aria-label="احذف" onClick={(e) => { e.stopPropagation(); void remove(c.id); }}>✕</button>
              </div>
            ))}
            {!loginHref && chats.length === 0 && <p className="dz-muted">تصاميمك تظهر هنا.</p>}
          </div>
          <Link href="/jawad-ai" className="dz-mini" style={{ textAlign: "center" }}>← الرئيسية</Link>
        </aside>

        <section className="dz-main dz-glass">
          <header className="dz-head">
            <button className="dz-burger dz-mini" onClick={() => setSide((s) => !s)} aria-label="المحادثات">☰</button>
            <div className={`dz-brush ${busy ? "busy" : ""}`} aria-hidden><span /></div>
            <div>
              <div className="dz-title">{name}</div>
              <div className="dz-muted" style={{ fontSize: 12 }}>تكلّم مع {persona} · الصورة بلا كتابة، والكلمات طبقات تعدّلها</div>
            </div>
          </header>

          <div className="dz-feed">
            {loginHref ? (
              <div className="dz-msg bot">
                <p>سجّل دخولك عشان تتكلم مع {persona}.</p>
                <div className="dz-actions"><Link className="dz-mini" href={loginHref}>تسجيل الدخول</Link></div>
              </div>
            ) : msgs.length === 0 ? (
              <>
                <div className="dz-msg bot">
                  <h3>أهلًا، أنا {persona} 🎨</h3>
                  <p>قل لي وش تبي تصمّم، واختر: أنسخ لك قالبًا جاهزًا (أرفقه بـ 📎)، أو من قوالبنا، أو من الصفر، أو خليط. أسألك اللي يفرق بس، وأصمّم لك صورة نظيفة وكل كلمة فيها طبقة تعدّلها بيدك.</p>
                </div>
                <div className="dz-start">
                  {STARTS.map((s, i) => (
                    <button key={s.t} className="dz-card" style={{ ["--c" as string]: COLORS[i % COLORS.length], animationDelay: `${i * 70}ms` }} onClick={() => send(s.m)}>
                      <span className="ic">{s.ic}</span>
                      <b>{s.t}</b>
                    </button>
                  ))}
                  <button className="dz-card" style={{ ["--c" as string]: "#94a3b8" }} onClick={() => send("أبي تصميم من نوع آخر. اسألني عنه.")}>
                    <span className="ic">🎨</span>
                    <b>تصميم آخر</b>
                  </button>
                </div>
              </>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`dz-msg ${m.role === "user" ? "user" : "bot"} ${m.error ? "err" : ""} ${m.design ? "wide" : ""}`}>
                  {m.role === "user" ? <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p> : <Rich text={m.text} />}
                  {m.files && m.files.length > 0 && (
                    <div className="dz-files">
                      {m.files.map((f) => <span key={f.id} className="dz-file">{f.url ? <img src={f.url} alt="" /> : "🖼️"} {f.name}</span>)}
                    </div>
                  )}
                  {m.design && (
                    <div className="dz-design">
                      {m.design.state === "drawing" && (
                        <div className="dz-progress" role="status" aria-live="polite">
                          <span className="dz-spin" aria-hidden />
                          <div>
                            <b>{busy === "splitting" ? "نفكّك الصورة إلى طبقات…" : "جواد يرسم الصورة بـ GPT Image 2…"}</b>
                            <small>{busy === "splitting" ? "نقصّ العنصر الرئيسي بخلفية شفافة ونضعه فوق الصورة الأصلية (نحو نصف دقيقة)." : "صورة بلا كتابة، تأخذ نحو دقيقة، ثم يفتح محرر الطبقات. لا تقفل الصفحة."}</small>
                          </div>
                        </div>
                      )}
                      {m.design.state === "failed" && (
                        <div className="dz-failed">
                          ❌ {m.design.error ?? "تعذّر الرسم."}
                          {owner && m.design.detail && <small dir="ltr"> {m.design.detail}</small>}
                          {chatId && i === lastDesign && <button type="button" className="dz-mini" disabled={!!busy} onClick={() => chatId && void runProduce(chatId, true)}>أعد المحاولة</button>}
                        </div>
                      )}
                      {m.design.state === "ready" && (
                        <>
                          {m.design.flag && <p className="dz-flag">⚠️ ملاحظة الفحص الآلي على الصورة: {m.design.flag}. تقدر تعيد رسمها.</p>}
                          {i === lastDesign ? (
                            <>
                              <LayerEditor design={m.design} fonts={fonts} onChange={changeLayers} onSave={saveFinal} saving={saving} busy={!!busy} onRedraw={() => chatId && void runProduce(chatId, true)} />
                              {photo && <button type="button" className="dz-opt" disabled={!!busy} onClick={() => void toZahraa()} title="تنتقل الصورة والنصوص وسجل المشروع إلى زهراء، وتقدر ترجعها لي بعد التعديل">🪄 عدّل في زهراء فوتو ماستر</button>}
                            </>
                          ) : (
                            <p className="dz-muted">تصميم سابق في هذه المحادثة (المحرر يفتح على آخر تصميم).</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {i === lastAssistant && !busy && !loginHref && m.questions?.length ? (
                    <Questions key={`q${i}-${msgs.length}`} questions={m.questions} fonts={fonts} disabled={!!busy} onSend={(t) => void send(t)} onWrite={() => box.current?.focus()} />
                  ) : null}
                </div>
              ))
            )}
            {busy === "writing" && (
              <div className="dz-think"><span className="dz-dots"><span /><span /><span /></span>{persona} يكتب…</div>
            )}
            <div ref={end} />
          </div>

          {!loginHref && (
            <form className="dz-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              {pending.length > 0 && (
                <div className="dz-files">
                  {pending.map((f) => (
                    <span key={f.id} className="dz-file">{f.url ? <img src={f.url} alt="" /> : "🖼️"} {f.name}<button type="button" aria-label="أزل" onClick={() => setPending((p) => p.filter((x) => x.id !== f.id))}>✕</button></span>
                  ))}
                </div>
              )}
              <ClaudeModelPicker className="dz-claude" disabled={!!busy} />
              <div className="dz-compose-row">
                <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => void attach(e.target.files)} />
                <button type="button" className="dz-attach" aria-label="أرفق صور" title="أرفق قالبًا أو صورة" disabled={uploading || !!busy} onClick={() => picker.current?.click()}>{uploading ? "…" : "📎"}</button>
                <MicButton onText={(t) => setQ((v) => (v.trim() ? `${v.trim()} ${t}` : t))} disabled={!!busy || uploading} className="dz-attach" />
                <textarea ref={box} className="dz-input" dir="auto" rows={1} value={q} maxLength={6000} placeholder={busy === "drawing" ? "الصورة قيد الرسم…" : `اكتب لـ${persona}…`} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
                <button className="dz-send" disabled={!!busy || uploading || (!q.trim() && !pending.length)}>{busy ? "…" : "أرسل"}</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
