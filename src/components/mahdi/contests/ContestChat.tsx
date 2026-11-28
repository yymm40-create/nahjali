"use client";

// «مسابقة الثبات» · a participant's conversation with the organiser, inside the app (no phone numbers). The organiser opens
// one per participant; a participant has one. New messages also arrive as a notification.

import { useCallback, useEffect, useRef, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { CONTEST_MESSAGE_MAX } from "@/lib/mahdi/contests";
import Icon from "../Icon";
import { useMahdi } from "../Provider";

interface Message {
  id: number;
  mine: boolean;
  body: string;
  at: string;
}

const time = (iso: string) => new Date(iso).toLocaleString("ar", { weekday: "short", hour: "numeric", minute: "2-digit" });

export default function ContestChat({ contestId, entry, other, onRead }: { contestId: string; entry: string | "me"; other: string; onRead?: () => void }) {
  const { toast } = useMahdi();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(
    () =>
      mahdiFetch<{ messages: Message[] }>(`/api/mahdi/contests/${contestId}?chat=${entry}`)
        .then((r) => {
          setMessages(r.messages);
          onRead?.();
        })
        .catch(() => setMessages((m) => m ?? [])),
    [contestId, entry, onRead],
  );

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [messages?.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await mahdiFetch(`/api/mahdi/contests/${contestId}`, { method: "POST", json: { action: "send", body, ...(entry === "me" ? {} : { entry }) } });
      setText("");
      await load();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="m-card space-y-3 p-4" aria-label={`المحادثة مع ${other}`}>
      <p className="font-semibold">
        <Icon name="chat" size={18} className="m-gold inline" /> المحادثة مع {other}
      </p>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {messages === null ? (
          <p className="m-muted text-sm">لحظة…</p>
        ) : messages.length === 0 ? (
          <p className="m-muted text-sm">ما في رسائل للحين. اكتب أول رسالة.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "m-chip-gold" : "m-surface-2"}`} style={m.mine ? undefined : { background: "var(--m-surface-2)" }}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="m-muted mt-1 text-[11px]">{time(m.at)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={end} />
      </div>
      <div className="flex items-end gap-2">
        <textarea
          className="m-field min-h-12 flex-1"
          value={text}
          maxLength={CONTEST_MESSAGE_MAX}
          placeholder="اكتب رسالتك…"
          onChange={(e) => setText(e.target.value)}
          aria-label="رسالتك"
        />
        <button type="button" className="m-btn m-btn-primary" disabled={busy || !text.trim()} onClick={send} aria-label="أرسل">
          <Icon name="send" size={18} />
        </button>
      </div>
    </section>
  );
}
