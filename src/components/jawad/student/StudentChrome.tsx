"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Dialog from "@/components/jawad/Dialog";
import { post } from "./client";
import { ErrorLine } from "./ui";

const KEY = "st-visitor";

/** A random id for this browser (counts visitors who did not sign in); nothing personal. */
function visitorId() {
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return "anonymous-visitor";
  }
}

/** «الطالب الذكي» on every page: counts the visit (for the owner's statistics) and the floating «رأيك» button. */
export default function StudentChrome() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jawad/student/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitor: visitorId(), path }), keepalive: true }).catch(() => {});
  }, [path]);

  const send = async () => {
    setState("sending");
    setError(null);
    try {
      const el = document.querySelector<HTMLElement>("[data-st-stage]");
      await post("/api/jawad/student/feedback", { rating, message, stage: el?.dataset.stStage ?? "home", projectId: el?.dataset.stProject ?? null });
      setState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("idle");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (state === "sent") {
            setState("idle");
            setRating(0);
            setMessage("");
          }
        }}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 font-bold text-white shadow-xl transition-transform hover:-translate-y-0.5 active:scale-95"
        style={{ background: "linear-gradient(120deg,#7c3aed,#db2777 55%,#f97316)" }}
      >
        💬 رأيك
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="رأيك يهمنا">
        {state === "sent" ? (
          <div className="space-y-2 p-6 text-center">
            <p className="text-4xl">💛</p>
            <p className="text-lg font-bold">شكرًا لك! رأيك وصلنا ويساعدنا نطوّر «الطالب الذكي».</p>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <p className="text-sm text-jw-muted">الفرع تحت التجربة، وملاحظاتك تفرق معنا كثير: وش عجبك؟ وش ما اشتغل؟ وش تتمنى نضيف؟</p>
            <div className="flex justify-center gap-1" role="radiogroup" aria-label="التقييم">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} من ٥`} onClick={() => setRating(n)} className={`text-3xl transition-transform active:scale-90 ${n <= rating ? "" : "opacity-30 grayscale"}`}>
                  ⭐
                </button>
              ))}
            </div>
            <textarea className="jw-textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب ملاحظتك هنا…" aria-label="ملاحظتك" />
            <ErrorLine error={error} />
            <button type="button" className="jw-btn jw-btn-primary w-full" onClick={send} disabled={state === "sending" || (!rating && !message.trim())}>
              {state === "sending" ? <span className="jw-spinner !border-white/40 !border-t-white" aria-hidden /> : null}
              أرسل رأيك
            </button>
          </div>
        )}
      </Dialog>
    </>
  );
}
