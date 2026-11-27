"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/mahdi/Icon";
import { VOTE_LIMITS, VOTE_LINE, VOTE_PERFORMERS, VOTE_TITLE, type VotePerformer } from "@config/mahdi-vote";

const DONE_KEY = "mahdi-qasida-vote";
const AR_DIGITS = ["١", "٢", "٣"];

/** The form of «تصويت محبوبة الباري»: name (required), one performance (required), «أنا رادود», and «ليش؟» (optional). */
export default function VoteForm() {
  const [name, setName] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [radood, setRadood] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; performer: VotePerformer } | null>(null);
  const opened = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    opened.current = Date.now();
    // voted before on this phone: the thanks again (with the way to vote under another name, a family shares one phone)
    try {
      const saved = JSON.parse(localStorage.getItem(DONE_KEY) ?? "null") as { name?: string; performer?: string } | null;
      const performer = VOTE_PERFORMERS.find((p) => p.id === saved?.performer);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the device after the first paint
      if (saved?.name && performer) setDone({ name: saved.name, performer });
    } catch {}
  }, []);

  const chosen = VOTE_PERFORMERS.find((p) => p.id === pick) ?? null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const clean = name.trim();
    if (!clean) {
      setError("اكتب اسمك أول.");
      nameRef.current?.focus();
      return;
    }
    if (!chosen) {
      setError("اختر الأداء اللي تصوّت له.");
      gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const website = (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
    setBusy(true);
    try {
      const res = await fetch("/api/mahdi/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean, performer: chosen.id, reason: reason.trim(), radood, website, typedMs: Date.now() - opened.current }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; already?: boolean };
      if (!res.ok && !data.already) throw new Error(data.error || "ما انحفظ صوتك؛ جرّب مرة ثانية.");
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify({ name: clean, performer: chosen.id }));
      } catch {}
      setDone({ name: clean, performer: chosen });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ما انحفظ صوتك؛ جرّب مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  function again() {
    try {
      localStorage.removeItem(DONE_KEY);
    } catch {}
    setDone(null);
    setName("");
    setPick(null);
    setRadood(false);
    setReason("");
    opened.current = Date.now();
  }

  return (
    <div className="mahdi-root qv-page" data-mtheme="sun" dir="rtl" lang="ar">
      <main id="m-main" className="qv-main">
        <header className="qv-hero">
          <div className="qv-faces" aria-hidden="true">
            {VOTE_PERFORMERS.map((p, i) => (
              <span key={p.id} className="qv-face" style={{ zIndex: VOTE_PERFORMERS.length - i }}>
                <Image src={p.photo} alt="" width={96} height={120} sizes="44px" />
              </span>
            ))}
          </div>
          <p className="qv-eyebrow">فريق نهج علي · مسابقة الأداء الفردي</p>
          <h1 className="m-display qv-title">{VOTE_TITLE}</h1>
          <p className="qv-line">{VOTE_LINE}</p>
        </header>

        {done ? (
          <Thanks done={done} onAgain={again} />
        ) : (
          <form className="qv-form" onSubmit={submit} noValidate>
            {/* a field only a script fills */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="qv-trap" />

            <section className="qv-step">
              <StepHead n={0} title="اكتب اسمك" />
              <label htmlFor="qv-name" className="sr-only">اسمك</label>
              <input
                id="qv-name"
                ref={nameRef}
                className="m-field qv-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={VOTE_LIMITS.name}
                placeholder="الاسم"
                autoComplete="name"
                required
                aria-required="true"
              />
              <button type="button" role="switch" aria-checked={radood} onClick={() => setRadood((v) => !v)} className="qv-radood" data-on={radood || undefined}>
                <span className="qv-radood-text">
                  <span className="qv-radood-title">أنا رادود</span>
                  <span className="qv-radood-hint">صوت الرادود يُحسب بنقطتين</span>
                </span>
                <span className="qv-switch" aria-hidden="true">
                  <span className="qv-knob" />
                </span>
              </button>
            </section>

            <section className="qv-step" ref={gridRef}>
              <StepHead n={1} title="اختر الأداء" sub="اختيار واحد" />
              <div className="qv-grid" role="radiogroup" aria-label="الأداء اللي تصوّت له">
                {VOTE_PERFORMERS.map((p, i) => {
                  const on = pick === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPick(p.id)}
                      className="qv-card"
                      data-on={on || undefined}
                      data-dim={(pick && !on) || undefined}
                      style={{ animationDelay: `${i * 45}ms` }}
                    >
                      <Image src={p.photo} alt={p.name} width={480} height={600} sizes="(min-width: 640px) 200px, 46vw" className="qv-photo" priority={i < 4} />
                      <span className="qv-shade" aria-hidden="true" />
                      <span className="qv-tick" aria-hidden="true">
                        <Icon name="check" size={18} strokeWidth={2.6} />
                      </span>
                      <span className="qv-name">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="qv-step">
              <StepHead n={2} title="ليش؟" sub="اختياري" />
              <label htmlFor="qv-reason" className="sr-only">ليش اخترته؟</label>
              <textarea
                id="qv-reason"
                className="m-field qv-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={VOTE_LIMITS.reason}
                rows={3}
                placeholder="وش عجبك في أدائه؟"
              />
            </section>

            {/* the send button stays at hand while the list scrolls, and so does what stopped the vote */}
            <div className="qv-bar">
              {error && (
                <p className="m-error qv-bar-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="m-btn m-btn-primary qv-submit" disabled={busy}>
                {busy ? "يرسل…" : chosen ? `صوّت لـ ${chosen.name}` : "صوّت"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function StepHead({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="qv-step-head">
      <span className="qv-step-n" aria-hidden="true">{AR_DIGITS[n]}</span>
      <h2 className="qv-step-title">{title}</h2>
      {sub && <span className="qv-step-sub">{sub}</span>}
    </div>
  );
}

function Thanks({ done, onAgain }: { done: { name: string; performer: VotePerformer }; onAgain: () => void }) {
  return (
    <section className="qv-thanks" aria-live="polite">
      <div className="qv-thanks-photo">
        <Image src={done.performer.photo} alt={done.performer.name} width={480} height={600} sizes="160px" />
        <span className="qv-thanks-tick" aria-hidden="true">
          <Icon name="check" size={22} strokeWidth={2.8} />
        </span>
      </div>
      <h2 className="m-display qv-thanks-title">شكرًا يا {done.name}!</h2>
      <p className="qv-thanks-line">
        وصل صوتك لـ <strong>{done.performer.name}</strong>
      </p>
      <p className="qv-thanks-small">الله يجزاك خير على تشجيعك لفريق نهج علي.</p>
      <button type="button" className="m-btn m-btn-ghost qv-again" onClick={onAgain}>
        تصويت باسم ثاني
      </button>
    </section>
  );
}
