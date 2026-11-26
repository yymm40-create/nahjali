"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import QuranReader from "@/components/mahdi/khatma/QuranReader";
import { FREE_KEY } from "@/components/mahdi/khatma/FreeReading";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { t } from "@/lib/mahdi/i18n";
import { portionCount } from "@/lib/mahdi/khatma/portions";

/**
 * «قراءة حرة»: the Quran page by page, wherever the person is, with no khatma behind it. The page they stop at is kept
 * (on the device and on the account), so «كمّل من صفحة 77» takes them back; the time pill at the top counts the time.
 */
export default function FreeReader() {
  const p = Number(useParams<{ p: string }>().p);
  const pages = portionCount("page");
  const valid = Number.isInteger(p) && p >= 1 && p <= pages;
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
    <QuranReader
      division="page"
      n={p}
      eyebrow={`قراءة حرة · صفحة ${p} من ${pages}`}
      prev={p > 1 ? { href: `/mahdi/khatma/free/${p - 1}`, label: `صفحة ${p - 1}` } : null}
      next={p < pages ? { href: `/mahdi/khatma/free/${p + 1}`, label: `صفحة ${p + 1}` } : null}
      nextPrimary
    />
  );
}
