"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Robot from "./Robot";
import Sheet from "./Sheet";

const A = t.assistant;
const MAX = 2000;
const when = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

interface Msg {
  id: string;
  fromTeam: boolean;
  body: string;
  createdAt: string;
}

/** «المساعد»: the person's conversation with the team. Answers are written by a person, never automatically. */
export default function AssistantSheet({ open, onClose, onRead }: { open: boolean; onClose: () => void; onRead: () => void }) {
  const { toast } = useMahdi();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [ready, setReady] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    mahdiFetch<{ ready: boolean; messages: Msg[] }>("/api/mahdi/assistant")
      .then((r) => {
        if (!live) return;
        setReady(r.ready);
        setMessages(r.messages);
        setError("");
        onRead();
      })
      .catch((e) => live && setError((e as Error).message || A.loadError));
    return () => {
      live = false;
    };
  }, [open, onRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    if (body.length > MAX) return setError(A.tooLong(MAX));
    setBusy(true);
    setError("");
    try {
      const r = await mahdiFetch<{ message: Msg }>("/api/mahdi/assistant", { method: "POST", json: { body } });
      setMessages((m) => [...(m ?? []), r.message]);
      setText("");
      toast(A.sent);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title={A.title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="m-soft grid size-16 shrink-0 place-items-center">
            <Robot size={52} />
          </span>
          <p className="m-muted text-sm leading-relaxed">{A.intro}</p>
        </div>

        {!ready ? (
          <p className="m-note">{A.notReady}</p>
        ) : (
          <>
            <ol className="max-h-[40dvh] space-y-2 overflow-y-auto" aria-live="polite">
              {messages === null && !error && <li className="m-muted py-2 text-sm">{t.common.loading}</li>}
              {messages?.length === 0 && <li className="m-muted py-2 text-sm">{A.empty}</li>}
              {messages?.map((m) => (
                <li key={m.id} className={`max-w-[85%] space-y-1 rounded-2xl px-3 py-2 ${m.fromTeam ? "m-soft" : "ms-auto"}`} style={m.fromTeam ? undefined : { background: "color-mix(in srgb, var(--m-gold) 16%, var(--m-surface-2))" }}>
                  <p className="whitespace-pre-line text-[0.95rem]" dir="auto">{m.body}</p>
                  <p className="m-muted text-[11px]">
                    {m.fromTeam ? A.team : A.you} · <span className="m-num">{when.format(new Date(m.createdAt))}</span>
                  </p>
                </li>
              ))}
              <div ref={endRef} />
            </ol>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label className="sr-only" htmlFor="m-assistant-text">{A.placeholder}</label>
              <textarea
                id="m-assistant-text"
                className="m-field min-h-24"
                rows={3}
                maxLength={MAX}
                dir="auto"
                placeholder={A.placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button type="submit" className="m-btn m-btn-primary w-full" disabled={busy || !text.trim()}>
                <Icon name="send" size={18} /> {busy ? A.sending : A.send}
              </button>
            </form>
          </>
        )}
        {error && <p role="alert" className="m-error text-sm">{error}</p>}
      </div>
    </Sheet>
  );
}
