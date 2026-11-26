"use client";

import { useState, useSyncExternalStore } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "../Icon";
import { FeedbackSheet } from "../Feedback";
import { useMahdi } from "../Provider";

const S = t.support;
const noop = () => () => {};
/** The site's address as the browser sees it (empty while rendering on the server). */
const useOrigin = () => useSyncExternalStore(noop, () => location.origin, () => "");

/** «ادعم التطبيق»: sharing the app (their own invitation link) and rating it (the «شاركنا رأيك» stars) — no money (the owner). */
export default function SupportView() {
  const { state, toast } = useMahdi();
  const [rating, setRating] = useState(false);
  const origin = useOrigin();
  const username = state.snap.username;
  // their invitation link: it opens an invitation for visitors (and counts who came through them), the app for members
  const link = origin ? (username ? `${origin}/mahdi/join/${encodeURIComponent(username)}` : `${origin}/mahdi`) : "";

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
          <span className="m-soft grid size-11 shrink-0 place-items-center" style={{ color: "var(--m-gold-text)" }} aria-hidden="true">
            <Icon name="star" size={22} />
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
