"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

const F = t.feedback;
const KINDS = Object.keys(F.kinds) as (keyof typeof F.kinds)[];

/** The «شاركنا رأيك» form in a sheet. `place` tells the owner where it was sent from. */
export function FeedbackSheet({ open, onClose, place, intro }: { open: boolean; onClose: (sent: boolean) => void; place: string; intro?: string }) {
  const { toast } = useMahdi();
  const [rating, setRating] = useState<number | null>(null);
  const [kind, setKind] = useState<keyof typeof F.kinds>("general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (rating === null && !message.trim()) return setError(F.needSomething);
    setBusy(true);
    setError("");
    try {
      await mahdiFetch("/api/mahdi/feedback", { method: "POST", json: { rating, kind, message, place } });
      toast(F.thanks);
      setRating(null);
      setKind("general");
      setMessage("");
      onClose(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={() => onClose(false)} title={intro ? F.promptTitle : F.title}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {intro && <p className="m-muted">{intro}</p>}
        <fieldset>
          <legend className="m-label">{F.rating}</legend>
          <div role="radiogroup" className="grid grid-cols-5 gap-2">
            {F.stars.map((label, i) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={rating === i + 1}
                aria-label={label}
                className="m-option grid min-h-16 place-items-center gap-0.5 px-1 py-2"
                onClick={() => setRating(rating === i + 1 ? null : i + 1)}
              >
                <span className="text-2xl leading-none" aria-hidden="true" style={{ filter: rating !== null && i + 1 <= rating ? undefined : "grayscale(1) opacity(0.45)" }}>
                  ⭐
                </span>
                <span className="text-[0.7rem] font-semibold leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="m-label">{F.kind}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className="m-option min-h-11 px-3 text-sm font-semibold" onClick={() => setKind(k)}>
                {F.kinds[k]}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="m-label">{F.message}</span>
          <textarea className="m-field min-h-28" dir="auto" maxLength={1000} placeholder={F.messagePlaceholder} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <p className="m-hint">{F.note}</p>
        {error && <p className="m-error" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button className="m-btn m-btn-primary flex-1" disabled={busy}>
            {F.send}
          </button>
          {intro && (
            <button type="button" className="m-btn m-btn-quiet" onClick={() => onClose(false)}>
              {F.later}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

/** A small «شاركنا رأيك» card placed at the end of several screens. */
export function FeedbackCard({ place, className = "" }: { place: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`m-card flex w-full items-center gap-3 p-4 text-start ${className}`} onClick={() => setOpen(true)}>
        <span className="m-soft grid size-11 shrink-0 place-items-center">
          <Icon name="chat" className="m-gold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{F.cta}</span>
          <span className="m-hint block">{F.ctaHint}</span>
        </span>
        <Icon name="chevronLeft" size={18} />
      </button>
      <FeedbackSheet open={open} onClose={() => setOpen(false)} place={place} />
    </>
  );
}

// Asked at most once per app visit, even when moving between screens; about every other visit at all
let askedThisVisit = false;
const skipThisVisit = typeof window !== "undefined" && Math.random() < 0.5;

/**
 * The occasional popup «كيف تجربتك؟». Only on the home screen, a few seconds after it opens, about every other visit,
 * and only when the server says it is time (account a few days old, no recent answer or «ليس الآن»).
 */
export function FeedbackPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname !== "/mahdi" || askedThisVisit || skipThisVisit) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    mahdiFetch<{ prompt: boolean }>("/api/mahdi/feedback")
      .then(({ prompt }) => {
        if (!prompt || !alive) return;
        timer = setTimeout(() => {
          // Never on top of another open sheet
          if (askedThisVisit || location.pathname !== "/mahdi" || document.querySelector("dialog[open]")) return;
          askedThisVisit = true;
          setOpen(true);
        }, 8000);
      })
      .catch(() => {});
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <FeedbackSheet
      open={open}
      place="popup"
      intro={F.promptBody}
      onClose={(sent) => {
        setOpen(false);
        if (!sent) mahdiFetch("/api/mahdi/feedback", { method: "POST", json: { dismiss: true } }).catch(() => {});
      }}
    />
  );
}
