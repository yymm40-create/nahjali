"use client";

// «صانع المحتوى» — the desk and the conversation with «محمد باقر»: chats on the side, cards to start from, the
// messages with the person's attachments, the carousel's slides as they are made (each downloadable), and the edit
// rooms he opens in «حيدرة كت». The look is content.css; this file holds the behaviour.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { api, postJson } from "@/lib/fetch";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";

interface FileView { id: string; kind: "image" | "video" | "audio"; name: string; durationMs: number | null; url?: string | null }
interface SlideView { n: number; fileId: string; name: string; text: string; url: string | null; download: string | null }
interface Msg {
  role: "user" | "assistant";
  text: string;
  files?: FileView[];
  slides?: { aspect: string; items: SlideView[]; failed: number };
  editor?: { id: string; title: string };
  error?: boolean;
}
interface ChatItem { id: string; title: string }

const STARTS = [
  { ic: "🖼️", t: "كاروسيل", d: "من فكرة أو نص إلى شرائح جاهزة بالصور", m: "أبي كاروسيل. اسألني عن اللي تحتاجه عشان نبدأ.", c: "#f6b73c" },
  { ic: "🎬", t: "سكربت ريل", d: "هوك قوي ونص منطوق وتوجيهات تصوير", m: "أبي سكربت ريل. اسألني عن اللي تحتاجه.", c: "#ff7a59" },
  { ic: "✂️", t: "ريل منتج", d: "من مقاطعي إلى ريل جاهز مع حيدرة", m: "أبي ريل منتج من مقاطعي. اسألني عن اللي تحتاجه، وبرفع لك الملفات هنا.", c: "#35c4b5" },
  { ic: "✨", t: "موشن جرافيكس", d: "مشاهد وحركة وصوت، ينفّذها حيدرة", m: "أبي موشن جرافيكس. اسألني عن اللي تحتاجه.", c: "#a78bfa" },
  { ic: "🔁", t: "أعد توظيف محتوى", d: "محتوى واحد إلى عدة مخرجات مترابطة", m: "عندي محتوى وأبي أعيد توظيفه في أكثر من مخرج. اسألني عن اللي تحتاجه.", c: "#fbbf24" },
];

const KIND_IC = { image: "🖼️", video: "🎞️", audio: "🎧" } as const;

/** The answer's light markdown (headings, lists, tables, bold, rules) as elements. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <b key={i}>{p.slice(2, -2)}</b> : /^`[^`]+`$/.test(p) ? <code key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>));
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
      out.push(
        <table key={out.length}>
          <thead><tr>{head.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>,
      );
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
    if (h) out.push(h[1].length <= 2 ? <h3 key={out.length}>{inline(h[2])}</h3> : h[1].length === 3 ? <h4 key={out.length}>{inline(h[2])}</h4> : <h5 key={out.length}>{inline(h[2])}</h5>);
    else if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) out.push(<hr key={out.length} />);
    else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <>{out}</>;
}

const FLOATERS: { s: number; c: string; t: number; d: number; top: string; left: string }[] = [
  { s: 76, c: "#f6b73c", t: 18, d: 30, top: "10%", left: "5%" },
  { s: 48, c: "#35c4b5", t: 14, d: 46, top: "60%", left: "3%" },
  { s: 60, c: "#ff7a59", t: 22, d: 24, top: "18%", left: "90%" },
  { s: 40, c: "#a78bfa", t: 12, d: 52, top: "72%", left: "92%" },
];

export default function ContentChat({ name, persona, loginHref }: { name: string; persona: string; loginHref: string | null }) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"" | "writing" | "producing">("");
  const [side, setSide] = useState(false);
  const [pending, setPending] = useState<FileView[]>([]);
  const [uploading, setUploading] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (loginHref) return;
    try {
      setChats((await api<{ chats: ChatItem[] }>("/api/content/chats")).chats);
    } catch { /* the list is a convenience */ }
  }, [loginHref]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const move = (e: React.PointerEvent) => {
    const r = root.current;
    if (!r || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    r.style.setProperty("--mx", String((e.clientX / window.innerWidth - 0.5) * 2));
    r.style.setProperty("--my", String((e.clientY / window.innerHeight - 0.5) * 2));
  };

  /** The produce step: the slides come back and sit on the last answer. */
  const produceNow = useCallback(async (id: string) => {
    setBusy("producing");
    try {
      const r = await postJson<{ slides: SlideView[]; failed: number }>("/api/content/produce", { chatId: id });
      setMsgs((m) => {
        const i = m.map((x) => x.role).lastIndexOf("assistant");
        if (i < 0) return m;
        const copy = [...m];
        copy[i] = { ...copy[i], slides: { aspect: "", items: r.slides, failed: r.failed } };
        return copy;
      });
      if (r.failed) setMsgs((m) => [...m, { role: "assistant", text: `⚠️ ${r.failed} من الشرائح ما انصنعت. اطلب إعادة إنتاجها بالرقم.`, error: true }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر إنتاج الشرائح.", error: true }]);
    } finally {
      setBusy("");
    }
  }, []);

  async function open(id: string) {
    setSide(false);
    try {
      const r = await api<{ chat: { id: string; messages: Msg[]; pending: boolean } }>(`/api/content/chats?id=${id}`);
      setChatId(r.chat.id);
      setMsgs(r.chat.messages);
      // a carousel ordered before the page was left: made now
      if (r.chat.pending) void produceNow(r.chat.id);
    } catch (e) {
      setMsgs([{ role: "assistant", text: e instanceof Error ? e.message : "تعذّر فتح المحادثة.", error: true }]);
    }
  }
  const fresh = () => { setChatId(null); setMsgs([]); setPending([]); setSide(false); };

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
    setBusy("writing");
    setMsgs((m) => [...m, { role: "user", text: message || "(ملفات مرفقة)", files: files.length ? files : undefined }]);
    try {
      const r = await postJson<{ chatId: string; text: string; pending: boolean; editor: { id: string; title: string } | null }>("/api/content/chat", { chatId, message, attachments: files.map((f) => f.id) });
      setChatId(r.chatId);
      setMsgs((m) => [...m, { role: "assistant", text: r.text, editor: r.editor ?? undefined }]);
      void refresh();
      if (r.pending) await produceNow(r.chatId);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر الرد.", error: true }]);
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    if (!confirm("نحذف هذي المحادثة وصورها؟")) return;
    await fetch(`/api/content/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === chatId) fresh();
    void refresh();
  }

  const downloadAll = (items: SlideView[]) => {
    items.forEach((s, i) => {
      if (!s.download) return;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = s.download!;
        a.download = `${s.name}.png`;
        a.click();
      }, i * 400);
    });
  };

  return (
    <div className="ct" ref={root} onPointerMove={move}>
      <div className="ct-scene" aria-hidden>
        {FLOATERS.map((f, i) => (
          <div key={i} className="ct-float" style={{ top: f.top, left: f.left, ["--depth" as string]: `${f.d}px` }}>
            <div className="ct-sheet" style={{ "--s": `${f.s}px`, "--c": f.c, "--t": `${f.t}s` } as CSSProperties} />
          </div>
        ))}
      </div>

      <div className="ct-wrap">
        <aside className={`ct-side ct-glass ${side ? "open" : ""}`}>
          <button className="ct-send" style={{ minWidth: 0, width: "100%" }} onClick={fresh}>＋ محادثة جديدة</button>
          <div className="ct-chats">
            {chats.map((c) => (
              <div key={c.id} className="ct-chat-item" aria-current={c.id === chatId} onClick={() => open(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(c.id)}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <button className="ct-mini" aria-label="احذف" onClick={(e) => { e.stopPropagation(); void remove(c.id); }}>✕</button>
              </div>
            ))}
            {!loginHref && chats.length === 0 && <p style={{ color: "#b8ad9c", fontSize: 13 }}>محادثاتك تظهر هنا.</p>}
          </div>
          <Link href="/jawad-ai" className="ct-mini" style={{ textAlign: "center" }}>← الرئيسية</Link>
        </aside>

        <section className="ct-main ct-glass">
          <header className="ct-head">
            <button className="ct-burger ct-mini" onClick={() => setSide((s) => !s)} aria-label="المحادثات">☰</button>
            <div className="ct-scene-pen"><div className={`ct-pen ${busy ? "writing" : ""}`} /></div>
            <div>
              <div className="ct-title">{name}</div>
              <div style={{ color: "#b8ad9c", fontSize: 12 }}>تكلّم مع {persona}</div>
            </div>
          </header>

          <div className="ct-feed">
            {loginHref ? (
              <div className="ct-msg bot">
                <p>سجّل دخولك عشان تتكلم مع {persona}.</p>
                <div className="ct-actions"><Link className="ct-mini" href={loginHref}>تسجيل الدخول</Link></div>
              </div>
            ) : msgs.length === 0 ? (
              <>
                <div className="ct-msg bot">
                  <h3>أهلًا، أنا {persona} ✍️</h3>
                  <p>أرافقك من الفكرة أو النص إلى محتوى جاهز: كاروسيل بالصور، سكربت ريل، ريل منتج أو موشن جرافيكس مع حيدرة، وعناوين وكابشن. اختر نقطة بداية أو اكتب لي مباشرة، وارفق ملفاتك بزر 📎.</p>
                </div>
                <div className="ct-start">
                  {STARTS.map((s, i) => (
                    <button key={s.t} className="ct-card" style={{ ["--c" as string]: s.c, animationDelay: `${i * 90}ms` }} onClick={() => send(s.m)}>
                      <span className="ic">{s.ic}</span>
                      <b>{s.t}</b>
                      <small>{s.d}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={`ct-msg ${m.role === "user" ? "user" : "bot"} ${m.error ? "err" : ""}`}>
                  {m.role === "user" ? <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p> : <Rich text={m.text} />}
                  {m.files && m.files.length > 0 && (
                    <div className="ct-files">
                      {m.files.map((f) => (
                        <span key={f.id} className="ct-file">
                          {f.kind === "image" && f.url ? <img src={f.url} alt="" /> : <span>{KIND_IC[f.kind]}</span>}
                          {f.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.slides && m.slides.items.length > 0 && (
                    <>
                      <div className="ct-slides">
                        {m.slides.items.map((s) => (
                          <figure key={s.fileId} className="ct-slide">
                            {s.url && <img src={s.url} alt={s.text} loading="lazy" />}
                            <span className="n">{s.n}</span>
                            {s.download && <a href={s.download} download={`${s.name}.png`}>⬇️ حمّل</a>}
                          </figure>
                        ))}
                      </div>
                      <div className="ct-actions">
                        <button className="ct-mini" onClick={() => downloadAll(m.slides!.items)}>⬇️ حمّل كل الشرائح ({m.slides.items.length})</button>
                        {m.slides.failed > 0 && <span style={{ color: "#fca5a5", fontSize: 12 }}>{m.slides.failed} ما انصنعت</span>}
                      </div>
                    </>
                  )}
                  {m.editor && (
                    <div className="ct-actions">
                      <Link className="ct-mini" href={`/jawad-ai/editor/${m.editor.id}`}>🎬 افتح غرفة المونتاج «{m.editor.title}» مع حيدرة</Link>
                    </div>
                  )}
                  {m.role === "assistant" && !m.error && (
                    <div className="ct-actions"><button className="ct-mini" onClick={() => navigator.clipboard?.writeText(m.text).catch(() => null)}>انسخ</button></div>
                  )}
                </div>
              ))
            )}
            {busy && (
              <div className="ct-think">
                <span className="ct-dots"><span /><span /><span /></span>
                {busy === "producing" ? "GPT Image 2 يرسم الشرائح… (من دقيقة إلى ٤ دقائق)" : `${persona} يكتب…`}
              </div>
            )}
            <div ref={end} />
          </div>

          {!loginHref && (
            <form className="ct-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              {pending.length > 0 && (
                <div className="ct-pending">
                  {pending.map((f) => (
                    <span key={f.id} className="ct-file">
                      {f.kind === "image" && f.url ? <img src={f.url} alt="" /> : <span>{KIND_IC[f.kind]}</span>}
                      {f.name}
                      <button type="button" aria-label="أزل" onClick={() => setPending((p) => p.filter((x) => x.id !== f.id))}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="ct-compose-row">
                <input ref={picker} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav" onChange={(e) => void attach(e.target.files)} />
                <button type="button" className="ct-attach" aria-label="أرفق ملفات" title="أرفق صور أو فيديو أو صوت" disabled={uploading || !!busy} onClick={() => picker.current?.click()}>{uploading ? "…" : "📎"}</button>
                <textarea
                  className="ct-input"
                  dir="auto"
                  rows={1}
                  value={q}
                  maxLength={8000}
                  placeholder={`اكتب لـ${persona}…`}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
                />
                <button className="ct-send" disabled={!!busy || uploading || (!q.trim() && !pending.length)}>{busy ? "…" : "أرسل"}</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
