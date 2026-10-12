"use client";

// «دورة الجواد الذكي» for every visitor: a button at the top («🎓 الدورة») and a window that opens by itself once with every
// new version of the site, with the course's promise and the price in force, and one button that takes them to subscribe
// (/jawad-ai/course). Shown to everyone (signed in or not), and not on the course page itself.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Coined from "@/components/Coined";
import { COURSE, countdown, hasLifetimeAccess, PRODUCT_ACCESS, type Phase, type Product } from "@config/course";
import "./share-reward.css";

interface Promo {
  headline: string;
  subhead: string;
  phase: Phase;
  offer: { product: Product; label: string; price: number; was: number; saving: number; bonus: number } | null;
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
          <div className="sr-card sr-course-card" onClick={(e) => e.stopPropagation()}>
            <span className="sr-shine" aria-hidden />
            <button type="button" className="sr-x" onClick={close} aria-label="أغلق">✕</button>

            <div className="sr-head sr-course-head">
              <span className="sr-ribbon">🎬 صناعة الفيلم السينمائي</span>
              <p className="sr-course-date">🗓️ {COURSE.schedule.short}</p>
              <div className="sr-course-icon" aria-hidden>🎓</div>
              <h2>{p.headline}</h2>
              {p.offer ? (
                <div className="sr-prize sr-course-offer">
                  <div className="sr-course-offer-copy">
                    <strong>{p.offer.label}</strong>
                    <span>{PRODUCT_ACCESS[p.offer.product]}</span>
                  </div>
                  <div className="sr-course-price">
                    <b><Coined text={`¤${p.offer.price}`} size={28} /></b>
                    {(p.offer.was > p.offer.price || p.offer.saving > 0) && <small>
                      {p.offer.was > p.offer.price && <s><Coined text={`¤${p.offer.was}`} size={13} /></s>}
                      {p.offer.saving > 0 && <> خصم {p.offer.saving}٪</>}
                    </small>}
                  </div>
                </div>
              ) : (
                <p>{soon ? "الدورة قريبًا، تابع الصفحة." : ""}</p>
              )}
              <p className="sr-course-summary">{p.subhead}</p>
              {left !== null && left > 0 && p.offer && <p className="sr-course-timer">⏳ هذا السعر ينتهي بعد <b dir="ltr">{countdown(left)}</b></p>}
            </div>

            <Link href={COURSE.base} className="sr-go" onClick={close}>{soon ? "شوف الدورة" : "اشترك الآن"}</Link>
            <ul className="sr-course-trust" aria-label="مزايا العرض">
              <li>🔒 تحويل بنكي</li>
              {p.offer && hasLifetimeAccess(p.offer.product) && <li>♾️ المسجلة مدى الحياة</li>}
              {p.offer?.product === "live" && <li>🎥 حضور مباشر</li>}
              <li>💬 مجموعة خاصة</li>
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
