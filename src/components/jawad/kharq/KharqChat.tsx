"use client";

// «محمد الخارق» — the conversation: it looks like any chat the person knows (a side list, a box to write in, answers
// that stream out as words), and the whole ROCTCF engine behind it never shows. What it adds is the delivery: an
// answer may come with questions as buttons, a text or a message to copy, a table, a PDF the site builds, and a
// picture or a video with its PRICE and a confirm button — nothing is generated until that button is pressed.
// The look is kharq.css; this file holds the behaviour.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Coined from "@/components/Coined";
import ClaudeModelPicker from "@/components/robots/ClaudeModelPicker";
import MicButton from "@/components/robots/MicButton";
import { useClaudeModel } from "@/components/robots/claude-model";
import QuickReplies from "@/components/jawad/QuickReplies";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import { api, postJson } from "@/lib/fetch";
import { coinStr } from "@config/coins";
import { findRoad, KHARQ, KHARQ_STARTS } from "@config/kharq";

interface FileView { id: string; kind: "image" | "video" | "audio" | "doc"; name: string; durationMs: number | null; url?: string | null }
interface Question { label: string; options: string[]; multi: boolean }
interface MediaAsk {
  id: string;
  kind: "image" | "video";
  name: string;
  aspect: string;
  seconds: number;
  coins: number | null;
  jobId?: string;
  state?: "running" | "done" | "failed";
  status?: string;
  fileId?: string;
  error?: string;
}
interface Deliver { kind: string; title: string; text: string; table: { columns: string[]; rows: string[][] } | null; media: MediaAsk[] }
interface Msg { role: "user" | "assistant"; text: string; files?: FileView[]; questions?: Question[]; deliver?: Deliver; suggest?: string[]; error?: boolean }
interface ChatItem { id: string; title: string }

const KIND_IC: Record<FileView["kind"], string> = { image: "🖼️", video: "🎬", audio: "🎵", doc: "📄" };

/** The answer's light markdown (headings, lists, bold, code, rules) as elements. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <b key={i}>{p.slice(2, -2)}</b> : /^`[^`]+`$/.test(p) ? <code key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>));
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(<Tag key={out.length}>{list.items.map((x, i) => <li key={i}>{inline(x)}</li>)}</Tag>);
    list = null;
  };
  for (const line of text.split("\n")) {
    const li = /^\s*(?:([-•*])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      const ordered = Boolean(li[2]);
      if (list && list.ordered !== ordered) flush();
      (list ??= { ordered, items: [] }).items.push(li[3]);
      continue;
    }
    flush();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) out.push(h[1].length <= 2 ? <h3 key={out.length}>{inline(h[2])}</h3> : <h4 key={out.length}>{inline(h[2])}</h4>);
    else if (/^\s*(-{3,}|_{3,})\s*$/.test(line)) out.push(<hr key={out.length} />);
    else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

function Copy({ text, label = "📋 انسخ" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="kh-mini"
      onClick={() =>
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          })
          .catch(() => null)
      }
    >
      {done ? "انسخ ✓" : label}
    </button>
  );
}

const tableText = (t: { columns: string[]; rows: string[][] }) => [t.columns.join("\t"), ...t.rows.map((r) => r.join("\t"))].join("\n");

export default function KharqChat({ name, loginHref }: { name: string; loginHref: string | null }) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState<FileView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [claude] = useClaudeModel();

  const refresh = useCallback(async () => {
    if (loginHref) return;
    try {
      setChats((await api<{ chats: ChatItem[] }>("/api/kharq/chats")).chats);
    } catch { /* the list is a convenience */ }
  }, [loginHref]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (msgs.length || busy) end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const fresh = () => { setChatId(null); setMsgs([]); setLinks({}); setPicked({}); setPending([]); setSide(false); };

  async function open(id: string) {
    setSide(false);
    try {
      const r = await api<{ chat: { id: string; messages: Msg[] }; links: Record<string, string> }>(`/api/kharq/chats?id=${id}`);
      setChatId(r.chat.id);
      setMsgs(r.chat.messages);
      setLinks(r.links ?? {});
      setPicked({});
      setPending([]);
    } catch (e) {
      setMsgs([{ role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح المحادثة.", error: true }]);
    }
  }

  async function remove(id: string) {
    if (!confirm("نحذف هذي المحادثة؟")) return;
    await fetch(`/api/kharq/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === chatId) fresh();
    void refresh();
  }

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 12 - pending.length)) {
        try {
          const probe = await probeFile(file);
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

  async function send(text = q) {
    const message = text.trim();
    if ((!message && !pending.length) || busy || uploading) return;
    const files = pending;
    setQ("");
    setPending([]);
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: message || "(ملفات مرفقة)", files: files.length ? files : undefined }]);
    try {
      const r = await postJson<{ chatId: string; turn: Msg }>("/api/kharq/chat", { chatId, message, model: claude.id, attachments: files.map((f) => f.id) });
      setChatId(r.chatId);
      setMsgs((m) => [...m, r.turn]);
      void refresh();
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر الرد.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  /** The chosen answers of one question go into the box as one line (many when it allows many). */
  function pick(at: number, qi: number, option: string, multi: boolean) {
    const key = `${at}-${qi}`;
    if (!multi) {
      setPicked((p) => ({ ...p, [key]: [option] }));
      void send(option);
      return;
    }
    setPicked((p) => {
      const have = p[key] ?? [];
      return { ...p, [key]: have.includes(option) ? have.filter((o) => o !== option) : [...have, option] };
    });
  }

  /** One answer's media: the person's yes, then the follow-up until it is ready. */
  const setAsk = (ask: MediaAsk) =>
    setMsgs((m) => m.map((t) => (t.deliver ? { ...t, deliver: { ...t.deliver, media: t.deliver.media.map((x) => (x.id === ask.id ? ask : x)) } } : t)));

  async function make(ask: MediaAsk) {
    if (!chatId || working) return;
    setWorking(ask.id);
    try {
      const r = await postJson<{ ask: MediaAsk; link: string | null }>("/api/kharq/make", { chatId, askId: ask.id });
      setAsk(r.ask);
      if (r.ask.fileId && r.link) setLinks((l) => ({ ...l, [r.ask.fileId!]: r.link! }));
      if (r.ask.state === "running") void watch(r.ask);
    } catch (e) {
      setAsk({ ...ask, state: "failed", error: e instanceof Error ? e.message : "تعذّر التوليد." });
    } finally {
      setWorking(null);
    }
  }

  const watch = useCallback(
    async (ask: MediaAsk) => {
      if (!chatId) return;
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 6000));
        try {
          const r = await postJson<{ ask: MediaAsk; link: string | null }>("/api/kharq/make", { chatId, askId: ask.id, step: "follow" });
          setAsk(r.ask);
          if (r.ask.fileId && r.link) setLinks((l) => ({ ...l, [r.ask.fileId!]: r.link! }));
          if (r.ask.state !== "running") return;
        } catch { /* a hiccup: asked again next round */ }
      }
    },
    [chatId],
  );

  async function savePdf(at: number, title: string) {
    if (!chatId || working) return;
    setWorking(`pdf-${at}`);
    try {
      const res = await fetch("/api/kharq/pdf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId, turn: at }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "تعذّر بناء الملف.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "ملف").replace(/[\\/:*?"<>|]+/g, " ").trim()}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر بناء الملف.", error: true }]);
    } finally {
      setWorking(null);
    }
  }

  function Delivery({ d, at }: { d: Deliver; at: number }) {
    const words = d.kind === "text" || d.kind === "message" || d.kind === "pdf";
    return (
      <div className="kh-deliver">
        <div className="kh-dhead">
          <b>{d.kind === "pdf" ? "📄" : d.kind === "table" ? "📊" : d.kind === "media" ? "🎨" : d.kind === "message" ? "✉️" : "📝"} {d.title || "المطلوب"}</b>
          <span className="kh-dacts">
            {words && d.text && <Copy text={d.text} label={d.kind === "message" ? "📋 انسخ الرسالة" : "📋 انسخ"} />}
            {d.kind === "pdf" && d.text && (
              <button type="button" className="kh-mini hot" disabled={working === `pdf-${at}`} onClick={() => void savePdf(at, d.title)}>
                {working === `pdf-${at}` ? "يبني الملف…" : "⬇️ حمّل PDF"}
              </button>
            )}
            {d.table && <Copy text={tableText(d.table)} label="📋 انسخ الجدول" />}
          </span>
        </div>
        {words && d.text && <div className="kh-dbody"><Rich text={d.text} /></div>}
        {d.table && (
          <div className="kh-tablewrap">
            <table className="kh-table">
              <thead><tr>{d.table.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody>{d.table.rows.map((r, i) => <tr key={i}>{d.table!.columns.map((_, k) => <td key={k}>{r[k] ?? ""}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        {d.media.map((m) => {
          const url = m.fileId ? links[m.fileId] : null;
          return (
            <div key={m.id} className="kh-media">
              <div className="kh-mhead">
                <b>{m.kind === "video" ? "🎬" : "🖼️"} {m.name}</b>
                <small>{m.aspect}{m.kind === "video" ? ` · ${m.seconds} ث` : ""}</small>
              </div>
              {m.state === "done" && url ? (
                m.kind === "video" ? (
                  <video className="kh-mfile" src={url} controls playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- a picture جواد just made, by short-lived signed link
                  <img className="kh-mfile" src={url} alt={m.name} />
                )
              ) : m.state === "running" ? (
                <p className="kh-mnote">⏳ {m.status || "قيد التوليد"}… الفيديو يأخذ دقائق، وتقدر تكمل كلامك وهو يشتغل.</p>
              ) : m.state === "failed" ? (
                <p className="kh-mnote err">⚠️ {m.error || "فشل التوليد."}</p>
              ) : m.state === "done" ? (
                <p className="kh-mnote">✅ انتهى، وتلقاه في «أعمالي».</p>
              ) : (
                <>
                  <p className="kh-mnote">
                    {m.coins === null ? "ما قدرنا نحسب السعر الحين." : m.coins === 0 ? "بلا رصيد (حسابك مفتوح)." : <>السعر: <Coined text={coinStr(m.coins)} size={13} /> من محفظتك.</>} ما ينصنع شي إلا بضغطتك.
                  </p>
                  <div className="kh-dacts">
                    <button type="button" className="kh-mini hot" disabled={!!working} onClick={() => void make(m)}>
                      {working === m.id ? "يرسل لجواد…" : m.kind === "video" ? "✅ وافقت، صوّر الفيديو" : "✅ وافقت، اصنع الصورة"}
                    </button>
                  </div>
                </>
              )}
              {m.state === "done" && url && (
                <div className="kh-dacts"><a className="kh-mini" href={url} download target="_blank" rel="noopener">⬇️ حمّل</a></div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="kh">
      <div className="kh-glow" aria-hidden />
      <div className="kh-wrap">
        <aside className={`kh-side ${side ? "open" : ""}`}>
          <button className="kh-new" onClick={fresh}>＋ محادثة جديدة</button>
          <div className="kh-chats">
            {chats.map((c) => (
              <div key={c.id} className="kh-chat-item" aria-current={c.id === chatId} role="button" tabIndex={0} onClick={() => void open(c.id)} onKeyDown={(e) => e.key === "Enter" && void open(c.id)}>
                <span>{c.title}</span>
                <button className="kh-mini" aria-label="احذف" onClick={(e) => { e.stopPropagation(); void remove(c.id); }}>✕</button>
              </div>
            ))}
            {!loginHref && chats.length === 0 && <p className="kh-dim">محادثاتك تظهر هنا.</p>}
          </div>
          <Link href="/jawad-ai" className="kh-mini kh-home">← الرئيسية</Link>
        </aside>

        <section className="kh-main">
          <header className="kh-head">
            <button className="kh-burger kh-mini" onClick={() => setSide((s) => !s)} aria-label="المحادثات">☰</button>
            <div className={`kh-orb ${busy ? "think" : ""}`} aria-hidden><i /><i /><i /></div>
            <div>
              <div className="kh-title">{name}</div>
              <div className="kh-dim">أي شيء تبيه — نبدأ من الصفر، وتطلع وفي يدك الشيء نفسه.</div>
            </div>
          </header>

          <div className="kh-feed">
            {loginHref ? (
              <div className="kh-msg bot">
                <p>سجّل دخولك عشان تتكلم مع {KHARQ.persona}.</p>
                <div className="kh-dacts"><Link className="kh-mini hot" href={loginHref}>تسجيل الدخول</Link></div>
              </div>
            ) : msgs.length === 0 ? (
              <>
                <div className="kh-msg bot">
                  <h3>هلا، أنا {KHARQ.persona}</h3>
                  <p>قل لي وش تبي تحقّق — أي موضوع، وأي حجم. أسألك الأسئلة المهمة بس (بخيارات تضغطها)، وأول ما أفهم بالضبط وش تريد، أسلّمك الشيء نفسه: كلام، رسالة، جدول، ملف PDF، صور، أو فيديو.</p>
                </div>
                <div className="kh-starts">
                  {KHARQ_STARTS.map((s, i) => (
                    <button key={s.t} type="button" className="kh-card" style={{ animationDelay: `${i * 80}ms` }} onClick={() => void send(s.m)}>
                      <span className="ic">{s.ic}</span>
                      <b>{s.t}</b>
                      <small>{s.d}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              msgs.map((m, i) => {
                const last = i === msgs.length - 1 && !busy;
                return (
                  <div key={i} className={`kh-msg ${m.role === "user" ? "user" : "bot"} ${m.error ? "err" : ""}`}>
                    {m.role === "user" ? <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p> : <Rich text={m.text} />}
                    {m.files?.length ? (
                      <div className="kh-files">
                        {m.files.map((f) => <span key={f.id} className="kh-file">{KIND_IC[f.kind]} {f.name}</span>)}
                      </div>
                    ) : null}
                    {m.deliver && <Delivery d={m.deliver} at={i} />}
                    {m.suggest?.length ? (
                      <div className="kh-roads">
                        {m.suggest.map((id) => {
                          const r = findRoad(id);
                          return r ? <Link key={id} className="kh-road" href={r.href}>↗ {r.name}<small>{r.why}</small></Link> : null;
                        })}
                      </div>
                    ) : null}
                    {m.questions?.map((qq, qi) => {
                      const key = `${i}-${qi}`;
                      const chosen = picked[key] ?? [];
                      return (
                        <div key={qi} className="kh-q">
                          <p className="kh-qlabel">{qq.label}{qq.multi ? " (تقدر تختار أكثر من واحد)" : ""}</p>
                          {qq.multi ? (
                            <>
                              <div className="kh-opts" role="group" aria-label={qq.label}>
                                {qq.options.map((o) => (
                                  <button key={o} type="button" className={`kh-opt ${chosen.includes(o) ? "on" : ""}`} disabled={busy || !last} onClick={() => pick(i, qi, o, true)}>{o}</button>
                                ))}
                                <button type="button" className="kh-opt kh-opt-write" disabled={busy || !last} onClick={() => box.current?.focus()}>✍️ اكتب إجابة مختلفة</button>
                              </div>
                              {chosen.length > 0 && last && (
                                <button type="button" className="kh-mini hot" disabled={busy} onClick={() => void send(chosen.join("، "))}>أرسل المختار ({chosen.length})</button>
                              )}
                            </>
                          ) : (
                            <QuickReplies cls="kh" options={qq.options} disabled={busy || !last} onPick={(o) => pick(i, qi, o, false)} onWrite={() => box.current?.focus()} />
                          )}
                        </div>
                      );
                    })}
                    {m.role === "assistant" && !m.error && m.text.length > 120 && (
                      <div className="kh-dacts"><Copy text={m.text} /></div>
                    )}
                  </div>
                );
              })
            )}
            {busy && (
              <div className="kh-think">
                <span className="kh-dots"><span /><span /><span /></span>
                {KHARQ.persona} يفكر ويجمع المطلوب…
              </div>
            )}
            <div ref={end} />
          </div>

          {!loginHref && (
            <>
              {pending.length > 0 && (
                <div className="kh-files kh-pending">
                  {pending.map((f) => (
                    <span key={f.id} className="kh-file">
                      {KIND_IC[f.kind]} {f.name}
                      <button type="button" className="kh-mini" aria-label="أزل" onClick={() => setPending((p) => p.filter((x) => x.id !== f.id))}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="kh-claude">
                <ClaudeModelPicker disabled={busy} />
                <p className="kh-dim" style={{ margin: "4px 0 0" }}>هذا الفرع يفكّر بأقصى جهد في كل ردّ؛ وللمشاريع الضخمة اختر «العبقري» أو «الأصيل».</p>
              </div>
              <form className="kh-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <input ref={picker} type="file" multiple hidden accept="image/*,video/*,audio/*,.pdf" onChange={(e) => void attach(e.target.files)} />
                <button type="button" className="kh-mini kh-attach" aria-label="أرفق ملفات" title="أرفق صورًا أو ملفات PDF أو فيديو أو صوتًا" disabled={uploading || busy} onClick={() => picker.current?.click()}>{uploading ? "…" : "📎"}</button>
                <MicButton onText={(t) => setQ((v) => (v.trim() ? `${v.trim()} ${t}` : t))} disabled={busy || uploading} className="kh-mini kh-attach" />
                <textarea
                  ref={box}
                  className="kh-input"
                  dir="auto"
                  rows={1}
                  value={q}
                  maxLength={KHARQ.messageMax}
                  placeholder={`اكتب لـ${KHARQ.persona}…`}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
                />
                <button className="kh-send" disabled={busy || uploading || (!q.trim() && !pending.length)}>{busy ? "…" : "أرسل"}</button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
