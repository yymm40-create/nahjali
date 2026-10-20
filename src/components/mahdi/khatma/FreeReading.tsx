"use client";

// «قراءة حرة»: where to open the Quran with no khatma behind it — the page they stopped at, a surah, a juz, or a page
// number. Used by its own page and as a card on «ختمتي».

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { arabicDigits, portionCount, portionSummary } from "@/lib/mahdi/khatma/portions";
import { SURA_NAMES } from "@/lib/mahdi/khatma/quran-map";
import { firstPage, pageOfVerse } from "@/lib/mahdi/khatma/reader";
import { useReaderState } from "./ReaderClock";

export const FREE_KEY = "mahdi-free-page";

const never = () => () => {};
const localPage = () => {
  try {
    const v = Number(localStorage.getItem(FREE_KEY));
    return Number.isInteger(v) && v >= 1 && v <= 604 ? v : null;
  } catch {
    return null;
  }
};

/** The page the person stopped at: the account's, else this device's (read after the page is on screen). */
export function useFreePage() {
  const { state } = useReaderState();
  const local = useSyncExternalStore(never, localPage, () => null);
  return state?.freePage ?? local;
}

const openingOf = (page: number) => {
  try {
    return portionSummary("page", page).range;
  } catch {
    return "";
  }
};

export default function FreeReading({ compact = false }: { compact?: boolean }) {
  const last = useFreePage();
  const [sura, setSura] = useState(1);
  const [juz, setJuz] = useState(1);
  const [page, setPage] = useState("");
  const pageNo = Math.max(1, Math.min(604, Number(page.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))) || 0));
  return (
    <section className="m-card space-y-3 p-4" aria-labelledby="free-read">
      <div>
        <h2 id="free-read" className="font-semibold">📖 قراءة حرة</h2>
        <p className="text-sm m-muted">اقرأ من أي مكان بدون ختمة: تختار وين أنت، والعدّاد فوق يحسب وقتك وينضاف لعادة القراءة إذا ربطتها.</p>
      </div>
      {last && (
        <Link href={`/mahdi/khatma/free/${last}`} className="m-btn m-btn-primary w-full">
          كمّل من صفحة {arabicDigits(last)}
          <span className="m-num text-xs opacity-80">{openingOf(last)}</span>
        </Link>
      )}
      {!compact && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="m-label">سورة</span>
            <span className="flex gap-2">
              <select className="m-field flex-1" value={sura} onChange={(e) => setSura(Number(e.target.value))}>
                {SURA_NAMES.map((n, i) => <option key={n} value={i + 1}>{i + 1}. {n}</option>)}
              </select>
              <Link href={`/mahdi/khatma/free/${pageOfVerse([sura, 1])}`} className="m-btn m-btn-ghost">افتح</Link>
            </span>
          </label>
          <label className="block space-y-1">
            <span className="m-label">جزء</span>
            <span className="flex gap-2">
              <select className="m-field flex-1" value={juz} onChange={(e) => setJuz(Number(e.target.value))}>
                {Array.from({ length: portionCount("juz") }, (_, i) => <option key={i} value={i + 1}>الجزء {i + 1}</option>)}
              </select>
              <Link href={`/mahdi/khatma/free/${firstPage("juz", juz)}`} className="m-btn m-btn-ghost">افتح</Link>
            </span>
          </label>
          <label className="block space-y-1">
            <span className="m-label">رقم الصفحة (١–٦٠٤)</span>
            <span className="flex gap-2">
              <input className="m-field m-num flex-1" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} placeholder="مثلًا ٥٠" />
              <Link href={`/mahdi/khatma/free/${pageNo || 1}`} className={`m-btn m-btn-ghost ${pageNo ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!pageNo}>افتح</Link>
            </span>
          </label>
        </div>
      )}
      {compact && (
        <Link href="/mahdi/khatma/free" className="m-btn m-btn-ghost w-full">اختر وين تقرأ</Link>
      )}
    </section>
  );
}
