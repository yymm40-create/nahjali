"use client";

// «دورة الجواد الذكي» for every visitor: a button at the top («🎓 الدورة») and a window that opens by itself once with every
// new version of the site, with the course's promise and the price in force, and one button that takes them to subscribe
// (/jawad-ai/course). Shown to everyone (signed in or not), and not on the course page itself.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Coined from "@/components/Coined";
import { COURSE, countdown, type Phase } from "@config/course";
import "./share-reward.css";

interface Promo {
  headline: string;
  subhead: string;
  phase: Phase;
  offer: { label: string; price: number; was: number; saving: number; bonus: number } | null;
  endsAt: number | null;
  now: number;
}

const seenKey = (version: string) => `jw-course-seen:${version}`;

export default function CoursePromo({ version }: { version: string }) {
  const path = usePathname();
  const [p, setP] = useState<Promo | null>(null);
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const onCourse = path === COURSE.base || path.startsWith(`${COURSE.base}/`);

  useEffect(() => {
    let live = true;
    fetch("/api/course/promo", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: Promo) => {
        if (!live || !j || typeof j.headline !== "string") return;
        setP(j);
        if (j.endsAt) setLeft(j.endsAt - j.now);
        let seen = true;
        try {
          seen = localStorage.getItem(seenKey(version)) === "1";
        } catch { /* private window: not shown by itself */ }
        if (!seen) setOpen(true);
      })
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [version]);

  // the count down to the price's end
  useEffect(() => {
    if (!open || left === null || left <= 0) return;
    const t = setInterval(() => setLeft((x) => (x === null ? x : Math.max(0, x - 1000))), 1000);
    return () => clearInterval(t);
  }, [open, left === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(seenKey(version), "1");
    } catch { /* fine */ }
  };

  if (!p) return null;
  const soon = p.phase === "soon";

  return (
    <>
      {!onCourse && (
        <Link href={COURSE.base} className="sr-pill inline-flex h-9 min-h-9 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold sm:px-3" title={COURSE.name}>
          🎓<span className="hidden sm:inline">&nbsp;الدورة</span>
        </Link>
      )}
      {open && !onCourse && typeof document !== "undefined" && createPortal(
        <div className="sr-back" role="dialog" aria-modal="true" aria-label={COURSE.name} dir="rtl" onClick={close}>
          <div className="sr-card" onClick={(e) => e.stopPropagation()}>
            <span className="sr-shine" aria-hidden />
            <button type="button" className="sr-x" onClick={close} aria-label="أغلق">✕</button>

            <div className="sr-head">
              <span className="sr-ribbon">🎬 {COURSE.name} · ٣ أيام</span>
              <div className="sr-trophy" aria-hidden>🎓</div>
              <h2>{p.headline}</h2>
              {p.offer ? (
                <div className="sr-prize">
                  <span>{p.offer.label}</span>
                  <b><Coined text={`¤${p.offer.price}`} size={30} /></b>
                  <span>
                    {p.offer.was > p.offer.price && <s><Coined text={`¤${p.offer.was}`} size={14} /></s>}
                    {p.offer.saving > 0 && <> · خصم {p.offer.saving}٪</>}
                  </span>
                </div>
              ) : (
                <p>{soon ? "الدورة قريبًا، تابع الصفحة." : ""}</p>
              )}
              <p>{p.subhead}</p>
              {left !== null && left > 0 && p.offer && <p className="sr-small">⏳ هذا السعر ينتهي بعد {countdown(left)}</p>}
            </div>

            <Link href={COURSE.base} className="sr-go" onClick={close}>{soon ? "شوف الدورة" : "اشترك الآن"}</Link>
            <p className="sr-small">🔒 تحويل بنكي · ♾️ وصول مدى الحياة · 💬 مجموعة واتساب خاصة</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
