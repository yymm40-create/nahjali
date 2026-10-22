"use client";

import Link from "next/link";
import { track } from "@/lib/track";

/**
 * The two buttons of an offer card: «اطلب على واتساب» (a Lead for the ads, named after the offer) and «شوف القسم». Without the
 * owner's WhatsApp number the first one opens the section itself instead.
 */
export default function OfferButtons({ offerKey, href, wa }: { offerKey: string; href: string; /** the WhatsApp link, the message already written; null when no number is set */ wa: string | null }) {
  return (
    <div className="of-actions">
      {wa ? (
        <a className="ld-cta of-wa" href={wa} target="_blank" rel="noreferrer" onClick={() => track("Lead", { content_name: `offer-${offerKey}` })}>
          💬 اطلب على واتساب
        </a>
      ) : (
        <Link className="ld-cta" href={href}>جرّب الآن ←</Link>
      )}
      <Link className="ld-ghost" href={href}>شوف القسم</Link>
    </div>
  );
}
