"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import RobotFace from "@/components/RobotFace";
import MicButton from "@/components/robots/MicButton";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import { api, postJson } from "@/lib/fetch";
import { JAWAD_ATTACHMENT_LIMIT } from "@config/jawad/limits";

export interface DirectorGenerator {
  id: string;
  name: string;
  kind: "image" | "video";
  resolutions: { value: string; label: string }[];
  aspects: { value: string; label: string }[];
}

interface FileView { id: string; kind: "image" | "video" | "audio" | "doc"; name: string; durationMs: number | null }
interface Question { label: string; options: string[]; multi: boolean }
interface Media {
  id: string; kind: "image" | "video"; name: string; prompt: string; generatorId: string; aspect: string; quality: string; resolution: string; seconds: number; withSound: boolean; coins: number | null;
  jobId?: string; state?: "running" | "done" | "failed"; status?: string; fileId?: string; error?: string;
}
interface Message { role: "user" | "assistant"; text: string; files?: FileView[]; questions?: Question[]; media?: Media[]; error?: boolean }
interface ContextState { level: "safe" | "warning" | "critical"; percent: number; turns: number; chars: number; shouldHandoff: boolean }
interface Chat { id: string; title: string; messages: Message[]; handoff: string; context: ContextState }
interface ChatItem { id: string; title: string; handoffReady?: boolean }
interface MediaSettings { generatorId: string; aspect: string; quality: string; resolution: string; seconds: number; withSound: boolean }

const ICON: Record<FileView["kind"], string> = { image: "🖼️", video: "🎬", audio: "🎵", doc: "📄" };
const starts = [
  { icon: "🎞️", title: "قسّم فكرتي إلى 3 توليدات", text: "حوّل فكرتي إلى ثلاث لقطات سينمائية، ولكل لقطة إعدادات ومدة ومولّد مستقل." },
  { icon: "🎥", title: "أخرج هذا المشهد", text: "أريد إخراج مشهد سينمائي. اسألني فقط عن القرارات التي تؤثر فعلًا على الجودة." },
  { icon: "🧭", title: "راجع الاستمرارية", text: "راجع استمرارية الشخصيات والمكان والكاميرا بين اللقطات قبل أن نقترح أي توليد." },
];

const initialSettings = (media: Media, generators: DirectorGenerator[]): MediaSettings => {
  const available = generators.filter((generator) => generator.kind === media.kind);
  const generator = available.find((item) => item.id === media.generatorId) ?? available[0];
  return {
    generatorId: generator?.id ?? media.generatorId,
    aspect: generator?.aspects.some((item) => item.value === media.aspect) ? media.aspect : generator?.aspects[0]?.value ?? media.aspect,
    quality: media.quality,
    resolution: generator?.resolutions.some((item) => item.value === media.resolution) ? media.resolution : generator?.resolutions.at(-1)?.value ?? media.resolution,
    seconds: media.seconds,
    withSound: media.withSound,
  };
};

export default function DirectorChat({ open, onOpen, onClose, loginHref, generators }: { open: boolean; onOpen: () => void; onClose: () => void; loginHref: string | null; generators: DirectorGenerator[] }) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ContextState | null>(null);
  const [handoff, setHandoff] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, MediaSettings>>({});
  const [working, setWorking] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<FileView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [text, setText] = useState("");
  const [side, setSide] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (loginHref) return;
    const result = await api<{ chats: ChatItem[] }>("/api/jawad/director/chats").catch(() => ({ chats: [] }));
    setChats(result.chats);
  }, [loginHref]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const reset = () => {
    setChatId(null); setMessages([]); setContext(null); setHandoff(""); setLinks({}); setSettings({}); setPending([]); setSide(false);
  };

  const seedSettings = useCallback((items: Message[]) => {
    const next: Record<string, MediaSettings> = {};
    for (const media of items.flatMap((message) => message.media ?? [])) next[media.id] = initialSettings(media, generators);
    setSettings(next);
  }, [generators]);

  async function openChat(id: string) {
    setSide(false);
    try {
      const result = await api<{ chat: Chat; links: Record<string, string> }>(`/api/jawad/director/chats?id=${id}`);
      setChatId(result.chat.id); setMessages(result.chat.messages); setContext(result.chat.context); setHandoff(result.chat.handoff); setLinks(result.links ?? {}); seedSettings(result.chat.messages);
    } catch (error) {
      setMessages([{ role: "assistant", text: error instanceof Error ? error.message : "تعذّر فتح المحادثة.", error: true }]);
    }
  }

  async function deleteChat(id: string) {
    if (!confirm("نحذف مشروع الإخراج هذا؟")) return;
    await fetch(`/api/jawad/director/chats?id=${id}`, { method: "DELETE" });
    if (id === chatId) reset();
    await refresh();
  }

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, JAWAD_ATTACHMENT_LIMIT - pending.length)) {
        const probe = await probeFile(file);
        const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: probe.kind, mime: probe.mime, bytes: file.size, fileName: file.name });
        await putWithProgress(signed.signedUrl, file, probe.mime, () => {});
        const confirmed = await postJson<{ upload: { id: string; status: string; error: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
        if (confirmed.upload.status !== "ready") throw new Error(confirmed.upload.error ?? "تعذّر فحص الملف.");
        setPending((current) => [...current, { id: confirmed.upload.id, kind: probe.kind, name: file.name, durationMs: probe.durationMs }]);
      }
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "تعذّر رفع الملف.", error: true }]);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function send(value = text) {
    const message = value.trim();
    if ((!message && !pending.length) || busy || uploading) return;
    const files = pending;
    setText(""); setPending([]); setBusy(true);
    setMessages((current) => [...current, { role: "user", text: message, ...(files.length ? { files } : {}) }]);
    try {
      const result = await postJson<{ chatId: string; message: Message; context: ContextState }>("/api/jawad/director/chat", { chatId, message, attachments: files.map((file) => file.id) });
      setChatId(result.chatId); setMessages((current) => [...current, result.message]); setContext(result.context);
      if (result.message.media) setSettings((current) => ({ ...current, ...Object.fromEntries(result.message.media!.map((media) => [media.id, initialSettings(media, generators)])) }));
      await refresh();
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "تعذّر الرد.", error: true }]);
    } finally { setBusy(false); }
  }

  const replaceMedia = (value: Media) => setMessages((current) => current.map((message) => message.media ? { ...message, media: message.media.map((media) => media.id === value.id ? value : media) } : message));

  async function make(media: Media) {
    if (!chatId || working[media.id] || media.jobId) return;
    setWorking((current) => ({ ...current, [media.id]: true }));
    try {
      const result = await postJson<{ media: Media; link: string | null }>("/api/jawad/director/make", { chatId, mediaId: media.id, settings: settings[media.id] });
      replaceMedia(result.media);
      if (result.link && result.media.fileId) setLinks((current) => ({ ...current, [result.media.fileId!]: result.link! }));
    } catch (error) {
      replaceMedia({ ...media, state: "failed", error: error instanceof Error ? error.message : "تعذّر التوليد." });
    } finally { setWorking((current) => ({ ...current, [media.id]: false })); }
  }

  async function makeAll(items: Media[]) {
    const ready = items.filter((media) => !media.jobId && !working[media.id]);
    await Promise.all(ready.map(make));
  }

  useEffect(() => {
    const running = messages.flatMap((message) => message.media ?? []).filter((media) => media.state === "running" && media.jobId);
    if (!chatId || !running.length) return;
    const timer = window.setInterval(() => {
      for (const media of running) void postJson<{ media: Media; link: string | null }>("/api/jawad/director/make", { chatId, mediaId: media.id, step: "follow" }).then((result) => {
        replaceMedia(result.media);
        if (result.link && result.media.fileId) setLinks((current) => ({ ...current, [result.media.fileId!]: result.link! }));
      }).catch(() => null);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [chatId, messages]);

  async function prepareHandoff() {
    if (!chatId || handoffBusy) return;
    setHandoffBusy(true);
    try {
      const result = await postJson<{ handoff: string }>("/api/jawad/director/handoff", { chatId, action: "prepare" });
      setHandoff(result.handoff); await refresh();
    } catch (error) { alert(error instanceof Error ? error.message : "تعذّر تجهيز التسليم."); }
    finally { setHandoffBusy(false); }
  }

  async function continueHandoff() {
    if (!chatId || !handoff || handoffBusy) return;
    setHandoffBusy(true);
    try {
      const result = await postJson<{ chat: Chat }>("/api/jawad/director/handoff", { chatId, action: "continue" });
      setChatId(result.chat.id); setMessages(result.chat.messages); setContext(result.chat.context); setHandoff(result.chat.handoff); seedSettings(result.chat.messages); await refresh();
    } catch (error) { alert(error instanceof Error ? error.message : "تعذّر فتح المتابعة."); }
    finally { setHandoffBusy(false); }
  }

  const updateSetting = (media: Media, patch: Partial<MediaSettings>) => setSettings((current) => ({ ...current, [media.id]: { ...(current[media.id] ?? initialSettings(media, generators)), ...patch } }));

  function MediaCard({ media }: { media: Media }) {
    const value = settings[media.id] ?? initialSettings(media, generators);
    const options = generators.filter((generator) => generator.kind === media.kind);
    const generator = options.find((item) => item.id === value.generatorId) ?? options[0];
    const url = media.fileId ? links[media.fileId] : null;
    return <article className="jd-media">
      <div className="jd-media-title"><strong>{media.kind === "video" ? "🎬" : "🖼️"} {media.name}</strong><span>{media.state === "running" ? media.status : media.state === "done" ? "جاهز ✓" : media.state === "failed" ? "تعذّر" : "بانتظار موافقتك"}</span></div>
      {!media.jobId && <div className="jd-settings">
        <label>المولّد<select value={value.generatorId} onChange={(event) => { const next = options.find((item) => item.id === event.target.value); updateSetting(media, { generatorId: event.target.value, resolution: next?.resolutions.at(-1)?.value ?? value.resolution, aspect: next?.aspects[0]?.value ?? value.aspect }); }}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>المقاس<select value={value.aspect} onChange={(event) => updateSetting(media, { aspect: event.target.value })}>{(generator?.aspects.length ? generator.aspects : [{ value: value.aspect, label: value.aspect }]).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>الجودة<select value={value.resolution} onChange={(event) => updateSetting(media, { resolution: event.target.value })}>{(generator?.resolutions.length ? generator.resolutions : [{ value: value.resolution, label: value.resolution }]).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {media.kind === "video" && <><label>الثواني<input type="number" min={4} max={15} value={value.seconds} onChange={(event) => updateSetting(media, { seconds: Number(event.target.value) })} /></label><label className="jd-check"><input type="checkbox" checked={value.withSound} onChange={(event) => updateSetting(media, { withSound: event.target.checked })} /> صوت متزامن</label></>}
      </div>}
      <details><summary>البرومبت النهائي</summary><p className="jd-prompt">{media.prompt}</p></details>
      {media.error && <p className="jd-error">{media.error}</p>}
      {url && (media.kind === "video" ? <video className="jd-output" controls src={url} /> : <Image className="jd-output" src={url} alt={media.name} width={1024} height={1024} unoptimized />)}
      {!media.jobId && <button className="jd-action" disabled={working[media.id]} onClick={() => void make(media)}>{working[media.id] ? "يبدأ…" : `ولّد هذا ${media.kind === "video" ? "المقطع" : "التصميم"}`}</button>}
      {url && <a className="jd-link" href={url} target="_blank" rel="noreferrer" download>تنزيل النتيجة</a>}
    </article>;
  }

  if (!open) return <button type="button" className="jd-launch" onClick={onOpen} aria-label="افتح جواد المخرج"><RobotFace id="director" size={38} /><span><strong>جواد المخرج</strong><small>إخراج خارق</small></span></button>;

  return <div className="jd jd-popup" dir="rtl" role="dialog" aria-modal="true" aria-label="جواد المخرج">
    <div className="jd-stage">
      <aside className={`jd-side ${side ? "open" : ""}`}>
        <button className="jd-new" onClick={reset}>＋ محادثة جديدة</button>
        <div className="jd-chat-list">{chats.map((chat) => <div className="jd-chat-row" data-active={chat.id === chatId} key={chat.id} onClick={() => void openChat(chat.id)}><span>{chat.handoffReady ? "↗ " : ""}{chat.title}</span><button onClick={(event) => { event.stopPropagation(); void deleteChat(chat.id); }}>✕</button></div>)}</div>
        <button type="button" className="jd-back" onClick={onClose}>← ارجع للاستوديو</button>
      </aside>
      <section className="jd-main">
        <header className="jd-head"><button className="jd-menu" onClick={() => setSide((value) => !value)}>☰</button><div className="jd-robot"><RobotFace id="director" size={54} /></div><div><h1>جواد المخرج</h1><p>وكيل الإخراج الخارق — ذاكرة مستقلة لكل محادثة</p></div><div className="jd-head-actions"><span className="jd-agent">DIRECTOR AGENT</span>{chatId && <button onClick={() => void prepareHandoff()} disabled={handoffBusy}>{handoffBusy ? "يجهّز…" : handoff ? "حدّث التسليم" : "جهّز handoff"}</button>}{chatId && handoff && <button className="strong" onClick={() => void continueHandoff()} disabled={handoffBusy}>محادثة جديدة بالتسليم</button>}<button className="jd-close" type="button" onClick={onClose} aria-label="إغلاق جواد المخرج">✕</button></div></header>
        {context?.shouldHandoff && <div className={`jd-context ${context.level}`}><div><strong>{context.level === "critical" ? "تنبيه مهم قبل ضغط السياق" : "اقتربت المحادثة من الحد الآمن"}</strong><p>جهّز تسليمًا الآن؛ سيكتب جواد حالته كاملة ثم يرسلها لنفسه في محادثة جديدة مستقلة.</p></div><div className="jd-meter"><i style={{ width: `${context.percent}%` }} /></div><button onClick={() => void prepareHandoff()} disabled={handoffBusy}>{handoffBusy ? "يجهّز…" : handoff ? "حدّث التسليم" : "جهّز handoff"}</button>{handoff && <button className="strong" onClick={() => void continueHandoff()} disabled={handoffBusy}>أرسل التسليم لمحادثة جديدة</button>}</div>}
        <div className="jd-feed">
          {loginHref ? <div className="jd-message assistant"><p>سجّل الدخول لفتح جواد المخرج وذاكرته المستقلة.</p><Link className="jd-action" href={loginHref}>تسجيل الدخول</Link></div> : messages.length === 0 ? <><div className="jd-welcome"><RobotFace id="director" size={82} /><div><h2>أنا جواد المخرج</h2><p>هذه غرفة إخراج مستقلة عن جواد العام. كل مشروع جديد يبدأ بذاكرة جديدة، وكل لقطة تحمل مولّدها وجودتها ومدتها وصوتها بنفسها.</p></div></div><div className="jd-starts">{starts.map((item) => <button key={item.title} onClick={() => void send(item.text)}><span>{item.icon}</span><strong>{item.title}</strong></button>)}</div></> : messages.map((message, index) => <div className={`jd-message ${message.role} ${message.error ? "error" : ""}`} key={index}><p className="jd-text">{message.text}</p>{message.files?.length ? <div className="jd-files">{message.files.map((file) => <span key={file.id}>{ICON[file.kind]} {file.name}</span>)}</div> : null}{message.questions?.map((question, qIndex) => <div className="jd-question" key={qIndex}><strong>{question.label}</strong><div>{question.options.map((option) => <button key={option} disabled={busy} onClick={() => void send(option)}>{option}</button>)}</div></div>)}{message.media?.length ? <div className="jd-media-grid"><div className="jd-batch-head"><strong>{message.media.length} توليدات مستقلة</strong>{message.media.filter((media) => !media.jobId).length > 1 && <button className="jd-action" onClick={() => void makeAll(message.media!)}>ولّد المجموعة معًا</button>}</div>{message.media.map((media) => <MediaCard key={media.id} media={media} />)}</div> : null}</div>)}
          {busy && <div className="jd-thinking"><RobotFace id="director" size={28} /> جواد المخرج يراجع الرؤية والإعدادات…</div>}<div ref={end} />
        </div>
        {!loginHref && <><div className="jd-pending">{pending.map((file) => <span key={file.id}>{ICON[file.kind]} {file.name}<button onClick={() => setPending((current) => current.filter((item) => item.id !== file.id))}>✕</button></span>)}</div><form className="jd-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}><input ref={fileInput} hidden multiple type="file" accept="image/*,video/*,audio/*,.pdf" onChange={(event) => void attach(event.target.files)} /><button type="button" onClick={() => fileInput.current?.click()} disabled={busy || uploading || pending.length >= JAWAD_ATTACHMENT_LIMIT}>📎</button><MicButton onText={(value) => setText((current) => current ? `${current} ${value}` : value)} disabled={busy || uploading} /><textarea ref={textBox} value={text} onChange={(event) => setText(event.target.value)} maxLength={20000} placeholder="اكتب لجواد المخرج…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} /><button className="send" disabled={busy || uploading || (!text.trim() && !pending.length)}>أرسل</button></form></>}
      </section>
    </div>
  </div>;
}
