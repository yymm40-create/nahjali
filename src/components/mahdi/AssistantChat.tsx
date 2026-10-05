"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

const A = t.assistant;
const MAX = 2000;
const when = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

interface Msg {
  id: string;
  fromTeam: boolean;
  body: string;
  createdAt: string;
}

/**
 * «المساعد»: the person's conversation with the team (answers are written by a person, never automatically). Loaded
 * when shown; reading it marks the team's replies as read (`onRead`).
 */
export default function AssistantChat({ onRead }: { onRead: () => void }) {
  const { toast } = useMahdi();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [ready, setReady] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, [onRead]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {!ready ? (
        <p className="m-note text-sm">{A.notReady}</p>
      ) : (
        <>
          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-0.5" aria-live="polite">
            {messages === null && !error && <li className="m-muted py-2 text-sm">{t.common.loading}</li>}
            {messages?.length === 0 && <li className="m-muted py-2 text-sm leading-relaxed">{A.intro}</li>}
            {messages?.map((m) => (
              <li key={m.id} className={`max-w-[88%] space-y-1 rounded-2xl px-3 py-2 ${m.fromTeam ? "m-soft" : "ms-auto"}`} style={m.fromTeam ? undefined : { background: "color-mix(in srgb, var(--m-gold) 16%, var(--m-surface-2))" }}>
                <p className="whitespace-pre-line text-[0.92rem]" dir="auto">{m.body}</p>
                <p className="m-muted text-[11px]">
                  {m.fromTeam ? A.team : A.you} · <span className="m-num">{when.format(new Date(m.createdAt))}</span>
                </p>
              </li>
            ))}
            <div ref={endRef} />
          </ol>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="m-assistant-text">{A.placeholder}</label>
            <textarea
              id="m-assistant-text"
              className="m-field min-h-11 flex-1 resize-none py-2.5"
              rows={1}
              maxLength={MAX}
              dir="auto"
              placeholder={A.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="submit" className="m-btn m-btn-primary size-11 shrink-0 p-0" disabled={busy || !text.trim()} aria-label={busy ? A.sending : A.send}>
              <Icon name="send" size={18} />
            </button>
          </form>
        </>
      )}
      {error && <p role="alert" className="m-error text-sm">{error}</p>}
    </div>
  );
}
