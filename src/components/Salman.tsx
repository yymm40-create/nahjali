"use client";

// «سلمان» — the helper on every page: a round button with his name at the bottom of the screen; pressed, a chat opens (a sheet from
// the bottom on a phone, a small window on a computer) where anyone asks anything about the site and gets a short, simple answer with
// buttons to the right pages. The conversation stays while the person moves between pages (kept on this device for the visit).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "./salman.css";

interface Msg {
  role: "user" | "assistant";
  text: string;
  links?: { label: string; href: string }[];
}

const KEY = "jw-salman";
const HELLO: Msg = { role: "assistant", text: "هلا والله 👋 أنا سلمان، مساعدك في الجواد الذكي. اسألني عن أي شي في الموقع ما فهمته، وأشرحه لك ببساطة." };
const QUICK = ["كيف أشحن رصيدي؟", "كيف أسوي صورة؟", "وش الفرق بين الأقسام؟", "كم سعر التوليد؟"];
// pages with their own full-screen tools (the editor's project, a game being played) or their own app (لأجل المهدي) keep the screen to themselves
const HIDDEN = [/^\/mahdi(\/|$)/, /^\/jawad-ai\/editor\/[^/]+/, /^\/play\//];

function load(): Msg[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Msg[] | null;
    return Array.isArray(v) && v.length ? v : [HELLO];
  } catch {
    return [HELLO];
  }
}

export default function Salman() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([HELLO]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      if (msgs.length > 1) sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* private mode: the conversation lives for this page only */
    }
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (HIDDEN.some((r) => r.test(path))) return null;

  // the conversation of this visit comes back when the chat opens
  function show() {
    if (!loaded.current) {
      loaded.current = true;
      const saved = load();
      if (saved.length > 1) setMsgs(saved);
    }
    setOpen(true);
  }

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: question }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/salman", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ page: path, messages: next.filter((m) => m !== HELLO).map(({ role, text: t }) => ({ role, text: t })) }),
      });
      const j = (await res.json().catch(() => ({}))) as { reply?: string; links?: Msg["links"]; error?: string };
      setMsgs((m) => [...m, { role: "assistant", text: res.ok ? (j.reply ?? "…") : (j.error ?? "صار خطأ، جرّب مرة ثانية."), links: res.ok ? j.links : undefined }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "تعذّر الاتصال. تأكد من الإنترنت وجرّب مرة ثانية." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button type="button" className="slm-fab" onClick={show} aria-label="سلمان: اسألني عن الموقع">
          <span className="slm-face" aria-hidden>🤖</span>
          <span className="slm-label">سلمان</span>
        </button>
      )}
      {open && (
        <div className="slm-wrap" role="dialog" aria-modal="false" aria-label="سلمان، مساعد الموقع" dir="rtl">
          <div className="slm-box">
            <header className="slm-head">
              <span className="slm-face sm" aria-hidden>🤖</span>
              <div>
                <b>سلمان</b>
                <small>مساعدك في الموقع · اسأل أي شي</small>
              </div>
              <button type="button" className="slm-x" onClick={() => setOpen(false)} aria-label="إغلاق">✕</button>
            </header>
            <div className="slm-list" ref={list} aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={`slm-msg ${m.role === "user" ? "me" : "him"}`}>
                  <p dir="auto">{m.text}</p>
                  {m.links && m.links.length > 0 && (
                    <div className="slm-links">
                      {m.links.map((l) => (
                        <Link key={l.href + l.label} href={l.href} onClick={() => setOpen(false)}>{l.label} ←</Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="slm-msg him"><p className="slm-typing"><i /><i /><i /></p></div>}
              {msgs.length === 1 && (
                <div className="slm-quick">
                  {QUICK.map((q) => (
                    <button key={q} type="button" onClick={() => void ask(q)}>{q}</button>
                  ))}
                </div>
              )}
            </div>
            <form
              className="slm-form"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(text);
              }}
            >
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب سؤالك هنا…" maxLength={600} aria-label="سؤالك" dir="auto" />
              <button type="submit" disabled={busy || !text.trim()} aria-label="أرسل">➤</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
