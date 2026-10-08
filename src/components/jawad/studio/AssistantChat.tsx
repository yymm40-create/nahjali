"use client";

import { useEffect, useRef, useState } from "react";
import { ASSISTANT_LIMITS, ASSISTANT_NAME, type AssistantAnswer, type AssistantDraft, type AssistantSet, type ThumbnailSide } from "@config/jawad/assistant";
import Icon from "../Icon";
import { uploadImage } from "./upload";
import type { UploadView } from "./types";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** What jawad changed in the form, in words. */
  chips?: string[];
  /** The person's pictures sent with this message. */
  pictures?: { url: string | null; name: string }[];
  quick?: string[];
  thumbnail?: { person: string; side: ThumbnailSide };
  /** The first greeting: shown, never sent to Claude. */
  local?: boolean;
  failed?: boolean;
}

interface Pending {
  key: string;
  name: string;
  url: string;
  status: "uploading" | "ready" | "error";
  error?: string;
  view?: UploadView;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const storeKey = (k: string) => `jawad:assistant:v1:${k}`;

const GREETING: Record<"image" | "video" | "audio", { text: string; quick: string[] }> = {
  image: { text: `هلا! أنا ${ASSISTANT_NAME}. كيف أقدر أساعدك؟ أكتب لك البرومبت وأحط المراجع وأختار المولد، وأنت تراجع وتضغط «توليد».`, quick: ["أبي ثامبنيل يوتيوب", "أبي صورة لمنتج", "عندي صورة وأبي أعدّلها"] },
  video: { text: `هلا! أنا ${ASSISTANT_NAME}. قول لي وش الفيديو اللي في بالك، وأجهّز لك البرومبت والمراجع والإعدادات، وأنت تضغط «توليد».`, quick: ["أبي إعلان قصير", "عندي صورة وأبيها تتحرك", "أبي مشهد سينمائي"] },
  audio: { text: `هلا! أنا ${ASSISTANT_NAME}. أكتب لك النص المنطوق، أو وصف المؤثر والموسيقى، وأضبط الإعدادات، وأنت تضغط «توليد».`, quick: ["أبي تعليق صوتي لإعلان", "أبي مؤثر صوتي", "أبي موسيقى خلفية"] },
};

async function post<T>(url: string, data: unknown): Promise<{ ok: boolean; body: T & { error?: string } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as T & { error?: string } };
}

/** «جواد»: the studio's chat. It fills the form (through `onApply`); generating stays the person's button. */
export default function AssistantChat({
  open,
  onOpen,
  onClose,
  section,
  getDraft,
  onApply,
  generatorName,
  onThumbnail,
  canAttach,
  storage,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  section: { id: string; name: string; output: "image" | "video" | "audio" };
  getDraft: () => AssistantDraft;
  /** Puts the changes in the form; the pictures are this message's attachments, in order. Returns the lines to show. */
  onApply: (set: AssistantSet, attachments: UploadView[]) => string[];
  generatorName: (id: string) => string;
  onThumbnail: (t: { person: string; side: ThumbnailSide }) => void;
  canAttach: boolean;
  storage: string;
}) {
  const greet = GREETING[section.output];
  const [msgs, setMsgs] = useState<Msg[]>([{ id: "hello", role: "assistant", text: greet.text, quick: greet.quick, local: true }]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  // The conversation is kept on this device for two days (per person and studio)
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(storeKey(storage));
        const saved = raw ? (JSON.parse(raw) as { at: number; msgs: Msg[] }) : null;
        if (saved?.msgs?.length && Date.now() - saved.at < 2 * 86400_000) setMsgs(saved.msgs);
      } catch {
        // nothing kept
      }
      setLoaded(true);
    });
  }, [storage]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storeKey(storage), JSON.stringify({ at: Date.now(), msgs: msgs.slice(-40) }));
    } catch {
      // storage full or blocked: the conversation just isn't kept
    }
  }, [msgs, loaded, storage]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, open]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  async function attach(files: FileList | null) {
    if (!files) return;
    const room = ASSISTANT_LIMITS.attachments - pending.length;
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const key = uid();
      const url = URL.createObjectURL(file);
      setPending((p) => [...p, { key, name: file.name, url, status: "uploading" }]);
      const patch = (x: Partial<Pending>) => setPending((p) => p.map((i) => (i.key === key ? { ...i, ...x } : i)));
      try {
        patch({ status: "ready", view: await uploadImage(file) });
      } catch (e) {
        patch({ status: "error", error: (e as Error).message });
      }
    }
    if (picker.current) picker.current.value = "";
  }

  function summary(set: AssistantSet, views: UploadView[]) {
    void views;
    const lines: string[] = [];
    if (set.generatorId) lines.push(`المولد: ${generatorName(set.generatorId)}`);
    if (set.prompt) lines.push("كتبت البرومبت");
    if (set.instructions) lines.push("وصف الأداء");
    if (set.settings) lines.push(`الإعدادات: ${Object.entries(set.settings).map(([k, v]) => `${k}=${String(v)}`).join("، ")}`);
    if (set.refStyle) lines.push(set.refStyle === "frames" ? "مراجع: إطار أول/أخير" : set.refStyle === "references" ? "مراجع: صور مرجعية" : "بدون مراجع");
    if (set.addRefs?.length) lines.push(`أضفت مرجع: ${set.addRefs.map((a) => `@${a.name}`).join("، ")}`);
    if (set.editRefs?.length) lines.push(`عدّلت مرجع: ${set.editRefs.map((a) => `@${a.newName ?? a.name}`).join("، ")}`);
    if (set.removeRefs?.length) lines.push(`شلت: ${set.removeRefs.map((n) => `@${n}`).join("، ")}`);
    return lines;
  }

  async function send(raw?: string) {
    const message = (raw ?? text).trim();
    const ready = pending.filter((p) => p.status === "ready" && p.view);
    if ((!message && !ready.length) || busy || pending.some((p) => p.status === "uploading")) return;
    const mine: Msg = { id: uid(), role: "user", text: message || "(صور)", pictures: ready.map((p) => ({ url: p.view!.url, name: p.name })) };
    const history = [...msgs.filter((m) => !m.local && !m.failed), mine].map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, mine]);
    setText("");
    setPending([]);
    setBusy(true);
    try {
      const r = await post<AssistantAnswer>("/api/jawad/assistant", {
        sectionId: section.id,
        messages: history,
        draft: getDraft(),
        attachments: ready.map((p) => ({ uploadId: p.view!.id })),
      });
      if (!r.ok) throw new Error(r.body.error ?? "تعذّر على جواد الرد الآن.");
      const views = ready.map((p) => p.view!);
      const set = r.body.set ?? {};
      const hasChange = Object.keys(set).some((k) => k !== "thumbnail");
      const done = hasChange ? onApply(set, views) : [];
      const chips = hasChange ? summary(set, views) : [];
      void done;
      setMsgs((m) => [...m, { id: uid(), role: "assistant", text: r.body.reply, chips, quick: r.body.quick, thumbnail: set.thumbnail }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: uid(), role: "assistant", text: navigator.onLine ? (e as Error).message : "انقطع الاتصال.", failed: true }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`افتح المساعد ${ASSISTANT_NAME}`}
        className="jw-btn jw-btn-primary fixed bottom-36 left-4 z-30 h-12 gap-2 rounded-full px-4 shadow-xl shadow-black/40 lg:bottom-6 lg:left-auto lg:right-6"
      >
        <Icon name="sparkles" size={18} /> {ASSISTANT_NAME}
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label={`المساعد ${ASSISTANT_NAME}`}
      className="jw-panel fixed inset-x-0 bottom-0 top-[calc(var(--jw-header-h)+var(--jw-bar-h))] z-40 flex flex-col overflow-hidden rounded-none shadow-2xl shadow-black/60 lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-auto lg:h-[min(680px,calc(100dvh-9rem))] lg:w-[420px] lg:rounded-2xl"
    >
      <header className="flex items-center gap-2 border-b border-jw-line px-3 py-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-jw-accent text-[var(--jw-on-accent)]"><Icon name="sparkles" size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{ASSISTANT_NAME}</p>
          <p className="truncate text-[11px] text-jw-muted">مساعد {section.name} · يجهّز الفورم وأنت تضغط «توليد»</p>
        </div>
        <button
          type="button"
          className="jw-btn jw-btn-quiet !min-h-8 !px-2 text-xs"
          onClick={() => {
            setMsgs([{ id: "hello", role: "assistant", text: greet.text, quick: greet.quick, local: true }]);
            setPending([]);
          }}
          title="محادثة جديدة"
        >
          <Icon name="retry" size={14} /> جديدة
        </button>
        <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2" onClick={onClose} aria-label="إغلاق">
          <Icon name="x" size={16} />
        </button>
      </header>

      <div ref={scroller} className="jw-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={m.id} className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-start" : "items-end"}`} data-role={m.role}>
            <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-6 ${m.role === "user" ? "bg-jw-accent text-[var(--jw-on-accent)]" : m.failed ? "border border-jw-danger text-jw-danger" : "bg-jw-surface-2"}`} dir="auto">
              {m.pictures && m.pictures.length > 0 && (
                <span className="mb-1.5 flex flex-wrap gap-1.5">
                  {m.pictures.map((p, k) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    p.url ? <img key={k} src={p.url} alt={p.name} className="size-16 rounded-lg object-cover" /> : <span key={k} className="text-xs">{p.name}</span>
                  ))}
                </span>
              )}
              {m.text}
            </div>
            {m.chips && m.chips.length > 0 && (
              <ul className="flex max-w-[88%] flex-wrap gap-1" aria-label="ما غيّره جواد في الفورم">
                {m.chips.map((c) => (
                  <li key={c} className="flex items-center gap-1 rounded-full border border-jw-line bg-jw-bg-2 px-2 py-0.5 text-[11px] text-jw-muted">
                    <Icon name="check" size={11} /> {c}
                  </li>
                ))}
              </ul>
            )}
            {m.thumbnail && (
              <button type="button" className="jw-btn !min-h-9 gap-1.5 text-xs" onClick={() => onThumbnail(m.thumbnail!)}>
                <Icon name="layers" size={14} /> ركّب الشخص على الصورة بعد التوليد
              </button>
            )}
            {m.quick && m.quick.length > 0 && i === msgs.length - 1 && !busy && (
              <div className="flex max-w-[92%] flex-wrap gap-1.5">
                {m.quick.map((q) => (
                  <button key={q} type="button" className="rounded-full border border-jw-line-strong px-3 py-1 text-xs hover:bg-jw-surface-2" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-jw-muted" role="status">
            <span className="jw-spinner" aria-hidden /> {ASSISTANT_NAME} يكتب…
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-jw-line p-2.5">
        {pending.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {pending.map((p) => (
              <li key={p.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className={`size-14 rounded-lg object-cover ${p.status === "ready" ? "" : "opacity-50"}`} />
                {p.status === "uploading" && <span className="jw-spinner absolute inset-0 m-auto" aria-label="يرفع" />}
                {p.status === "error" && <span className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-jw-danger px-1 text-[9px] text-white" title={p.error}>{p.error}</span>}
                <button type="button" aria-label="شيل الصورة" className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-jw-surface-3" onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))}>
                  <Icon name="x" size={10} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          {canAttach && (
            <>
              <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => attach(e.target.files)} aria-label="أرفق صورة" />
              <button type="button" className="jw-btn !min-h-10 !px-2.5" aria-label="أرفق صورة" disabled={pending.length >= ASSISTANT_LIMITS.attachments} onClick={() => picker.current?.click()}>
                <Icon name="image" size={18} />
              </button>
            </>
          )}
          <textarea
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={ASSISTANT_LIMITS.message}
            placeholder={`اكتب لـ${ASSISTANT_NAME}…`}
            aria-label={`رسالة إلى ${ASSISTANT_NAME}`}
            className="jw-textarea max-h-32 min-h-10 flex-1 resize-none py-2"
            dir="auto"
          />
          <button type="button" className="jw-btn jw-btn-primary !min-h-10 !px-3" aria-label="إرسال" disabled={busy || pending.some((p) => p.status === "uploading") || (!text.trim() && !pending.some((p) => p.status === "ready"))} onClick={() => send()}>
            <Icon name="sparkles" size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
