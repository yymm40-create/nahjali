"use client";

import { useEffect, useState, type ReactNode } from "react";

/** The phone's buy bar: shown only while no other «اشترك» button is on screen (the hero's or the one at the end). */
export default function StickyBuy({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const targets = [...document.querySelectorAll(".ox-hero-buy, .ox-end")];
    if (!targets.length || typeof IntersectionObserver === "undefined") return setShow(true);
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting));
      setShow(![...seen.values()].some(Boolean));
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return <div className={`ox-sticky${show ? " on" : ""}`} aria-hidden={!show}>{children}</div>;
}
