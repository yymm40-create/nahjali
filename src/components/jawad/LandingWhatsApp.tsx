"use client";

// «💬 اسأل على واتساب» — the visitor's way to a human before paying: a small pill fixed at the bottom start of the front page
// (src/components/jawad/Landing.tsx). It steps aside while the hero's buttons are in its corner (a 360px phone), and a tap is a
// Lead for the ad pixels (src/lib/track.ts, a no-op without a pixel).

import { useEffect, useState } from "react";
import { track } from "@/lib/track";

export default function LandingWhatsApp({ href }: { href: string }) {
  // hidden until the page knows the hero's buttons are not under it (no flash over them on a small phone)
  const [hide, setHide] = useState(true);
  useEffect(() => {
    const actions = document.querySelector(".ld-actions");
    if (!actions || typeof IntersectionObserver === "undefined") {
      // nothing to step aside for: shown on the next frame
      const t = requestAnimationFrame(() => setHide(false));
      return () => cancelAnimationFrame(t);
    }
    // only the bottom slice of the screen counts: the pill gives way while the buttons are in it, not while they are anywhere on screen
    const io = new IntersectionObserver(([e]) => setHide(e.isIntersecting), { rootMargin: "-85% 0px 0px 0px" });
    io.observe(actions);
    return () => io.disconnect();
  }, []);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={`ld-wa${hide ? " hide" : ""}`}
      aria-hidden={hide}
      tabIndex={hide ? -1 : 0}
      onClick={() => track("Lead", { content_name: "whatsapp-landing" })}
    >
      💬 اسأل على واتساب
    </a>
  );
}
