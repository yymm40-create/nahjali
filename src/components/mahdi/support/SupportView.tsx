"use client";

import { useState, useSyncExternalStore } from "react";
import SmartCoin from "@/components/SmartCoin";
import { t } from "@/lib/mahdi/i18n";
import { amountLabel, cleanNote, parseAmount, PAY_MAX, PAY_MIN } from "@/lib/pay-link";
import { SUPPORT_AMOUNTS, SUPPORT_REF } from "@/lib/mahdi/support";
import Icon from "../Icon";
import { FeedbackSheet } from "../Feedback";
import { useMahdi } from "../Provider";

const S = t.support;
const noop = () => () => {};
/** The site's address as the browser sees it (empty while rendering on the server). */
const useOrigin = () => useSyncExternalStore(noop, () => location.origin, () => "");

/** An amount as every price of the site shows it: the riyal coin's logo and the number, never a currency word. */
export function Amount({ riyals, size = 16 }: { riyals: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
      <SmartCoin size={size} tone="sky" />
      <span dir="ltr">{amountLabel(riyals)}</span>
    </span>
  );
}

/**
 * «ادعم التطبيق»: an amount the person chooses (quick amounts or their own), paid through the site's free-amount payment link
 * marked «دعم لأجل المهدي» (back to /mahdi/support/done), and the ways without money: share the app (their own invitation link)
 * and rate it (the «شاركنا رأيك» stars).
 */
export default function SupportView({ initial }: { initial: number }) {
  const { state, toast } = useMahdi();
  const [raw, setRaw] = useState(amountLabel(initial));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rating, setRating] = useState(false);
  const amount = parseAmount(raw);
  const quick = (SUPPORT_AMOUNTS as readonly number[]).includes(amount ?? -1);
  const origin = useOrigin();
  const username = state.snap.username;
  // their invitation link: it opens an invitation for visitors (and counts who came through them), the app for members
  const link = origin ? (username ? `${origin}/mahdi/join/${encodeURIComponent(username)}` : `${origin}/mahdi`) : "";

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (amount === null || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount, note: cleanNote(note), for: SUPPORT_REF }) });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || S.payError);
      window.location.assign(j.url);
    } catch (x) {
      setErr(x instanceof Error ? x.message : S.payError);
      setBusy(false);
    }
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: t.brand, text: S.shareText, url: link }).catch(() => {});
      return;
    }
    await navigator.clipboard
      ?.writeText(`${S.shareText}\n${link}`)
      .then(() => toast(S.copied))
      .catch(() => toast(link));
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="m-display text-3xl">{S.title}</h1>
        <p className="m-muted leading-relaxed">{S.intro}</p>
      </header>

      <form className="m-card space-y-4 p-5" onSubmit={pay}>
        <div>
          <h2 className="font-semibold">{S.moneyTitle}</h2>
          <p className="m-hint">{S.moneyHint}</p>
        </div>
        <div role="radiogroup" aria-label={S.amount} className="grid grid-cols-4 gap-2">
          {SUPPORT_AMOUNTS.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={amount === v} className="m-option grid min-h-14 place-items-center px-1 py-2 text-lg font-semibold" onClick={() => setRaw(String(v))}>
              <Amount riyals={v} size={18} />
            </button>
          ))}
        </div>
        <label className="block">
          <span className="m-label">{quick ? S.other : S.amount}</span>
          <span className="flex items-center gap-2">
            <SmartCoin size={22} tone="sky" />
            <input
              className="m-field flex-1 text-lg font-semibold"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              aria-invalid={amount === null}
            />
          </span>
        </label>
        <label className="block">
          <span className="m-label">{S.note}</span>
          <input className="m-field" dir="auto" maxLength={80} value={note} placeholder={S.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
        </label>
        {amount === null && <p className="m-error">{S.badAmount(PAY_MIN, PAY_MAX.toLocaleString("en"))}</p>}
        {err && (
          <p className="m-error" role="alert">
            {err}
          </p>
        )}
        <button className="m-btn m-btn-primary w-full text-lg" disabled={amount === null || busy}>
          {busy ? (
            S.busy
          ) : (
            <>
              <Icon name="star" /> {S.pay} {amount !== null && <Amount riyals={amount} size={18} />}
            </>
          )}
        </button>
        <p className="m-hint flex items-start gap-2">
          <Icon name="lock" size={16} className="mt-0.5 shrink-0" /> {S.safe}
        </p>
      </form>

      <section className="m-card space-y-3 p-5">
        <div>
          <h2 className="font-semibold">{S.freeTitle}</h2>
          <p className="m-hint">{S.freeHint}</p>
        </div>
        <button type="button" className="m-option flex w-full items-center gap-3 p-4 text-start" onClick={share} disabled={!link}>
          <span className="m-soft grid size-11 shrink-0 place-items-center">
            <Icon name="send" className="m-gold" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{S.share}</span>
            <span className="m-hint block">{S.shareHint}</span>
          </span>
          <Icon name="chevronLeft" size={18} />
        </button>
        <button type="button" className="m-option flex w-full items-center gap-3 p-4 text-start" onClick={() => setRating(true)}>
          <span className="m-soft grid size-11 shrink-0 place-items-center text-xl" aria-hidden="true">
            ⭐
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{S.rate}</span>
            <span className="m-hint block">{S.rateHint}</span>
          </span>
          <Icon name="chevronLeft" size={18} />
        </button>
        <p className="pt-1 text-center font-semibold">{S.pray}</p>
      </section>
      <FeedbackSheet open={rating} onClose={() => setRating(false)} place="support" />
    </div>
  );
}
