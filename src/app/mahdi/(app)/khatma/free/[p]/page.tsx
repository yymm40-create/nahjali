"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import Icon from "@/components/mahdi/Icon";
import QuranText, { QuranSource, usePortionWords } from "@/components/mahdi/khatma/QuranText";
import ReaderClock from "@/components/mahdi/khatma/ReaderClock";
import { FREE_KEY } from "@/components/mahdi/khatma/FreeReading";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { t } from "@/lib/mahdi/i18n";
import { portionCount } from "@/lib/mahdi/khatma/portions";

/**
 * «قراءة حرة»: the Quran page by page, wherever the person is, with no khatma behind it. The page they stop at is kept
 * (on the device and on the account), so «كمّل من صفحة ٧٧» takes them back; the clock at the top counts the time.
 */
export default function FreeReader() {
  const p = Number(useParams<{ p: string }>().p);
  const valid = Number.isInteger(p) && p >= 1 && p <= portionCount("page");
  const { words, error } = usePortionWords(valid ? "page" : undefined, p);
  useEffect(() => {
    if (!valid) return;
    try {
      localStorage.setItem(FREE_KEY, String(p));
    } catch {}
    // kept on the account a moment after they settle on a page (not for every page turned)
    const id = setTimeout(() => void mahdiFetch("/api/mahdi/khatma/reader", { method: "POST", json: { action: "page", page: p } }).catch(() => null), 1500);
    return () => clearTimeout(id);
  }, [p, valid]);

  if (!valid) return <p className="m-card p-5 text-center">{t.errors.notFound}</p>;
  return (
    <div className="space-y-5">
      <Link href="/mahdi/khatma/free" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> قراءة حرة
      </Link>
      <ReaderClock extra={`قراءة حرة · صفحة ${p} من ${portionCount("page")}`} />
      {error && !words ? (
        <p className="m-card p-5 text-center">{error}</p>
      ) : !words ? (
        <p className="m-muted">{t.khatma.loadingText}</p>
      ) : (
        <>
          <QuranText words={words} eyebrow="الختمة العلوية · قراءة حرة" />
          {/* like turning the mushaf's pages: the one before on the right, the next on the left */}
          <nav className="grid grid-cols-2 gap-2" aria-label="التنقل">
            {p > 1 ? (
              <Link href={`/mahdi/khatma/free/${p - 1}`} className="m-btn m-btn-ghost m-btn-sm">
                <Icon name="chevronRight" size={16} /> صفحة {p - 1}
              </Link>
            ) : <span />}
            {p < portionCount("page") ? (
              <Link href={`/mahdi/khatma/free/${p + 1}`} className="m-btn m-btn-primary m-btn-sm">
                صفحة {p + 1} <Icon name="chevronLeft" size={16} />
              </Link>
            ) : <span />}
          </nav>
          <QuranSource words={words} />
        </>
      )}
    </div>
  );
}
