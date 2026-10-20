"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { t } from "@/lib/mahdi/i18n";
import Icon from "@/components/mahdi/Icon";
import QuranText, { QuranSource, usePortionWords } from "@/components/mahdi/khatma/QuranText";
import ReaderClock from "@/components/mahdi/khatma/ReaderClock";
import { useMyKhatma } from "@/components/mahdi/khatma/useMyKhatma";
import { khatmaStats, nextPortion, unitText } from "@/lib/mahdi/khatma/mine";
import { fullRange, inRange, portionCount, portionTitle } from "@/lib/mahdi/khatma/portions";

/**
 * «ختمتي»: one portion of my khatma (a page, juz, hizb, half or quarter hizb — the khatma's own division) in the
 * mushaf's script, «قرأته ✓ والتالي» (fills the linked habit), and the way to the one before and after.
 */
export default function MyKhatmaReader() {
  const q = Number(useParams<{ q: string }>().q);
  const router = useRouter();
  const k = useMyKhatma();
  const cur = k.data?.current;
  // a khatma ended or not started reads by quarters, the whole Quran
  const unit = cur?.status === "open" ? cur.unit : (cur?.unit ?? "quarter");
  const range = cur?.status === "open" ? cur.range : fullRange(unit);
  const valid = Number.isInteger(q) && q >= 1 && q <= portionCount(unit);
  const { words, error } = usePortionWords(k.data && valid ? unit : undefined, q);
  const open = cur?.status === "open";
  const read = cur?.reads.find((r) => r.quarter === q);
  // the khatma's own line on the clock at the top: how much is read, and today's portion
  const stats = open && cur && k.data ? khatmaStats(cur.reads, cur.startedOn, cur.days, k.data.today, cur.range) : null;
  const extra = stats ? `ختمتي: قرأت ${stats.read} من ${stats.total} · ورد اليوم ${stats.todayCount}/${stats.perDay}${stats.todayLeft ? ` (باقي ${unitText(unit, stats.todayLeft)})` : " ✅"}` : undefined;

  async function markRead(goOn: boolean) {
    const r = await k.read([q]);
    if (!r || r.finished) return router.push("/mahdi/khatma");
    if (goOn) {
      const next = nextPortion([...(cur?.reads.map((x) => x.quarter) ?? []), q], range);
      router.push(next ? `/mahdi/khatma/read/${next}` : "/mahdi/khatma");
    }
  }

  if (k.data && !valid) return <p className="m-card p-5 text-center">{t.errors.notFound}</p>;
  return (
    <div className="space-y-5">
      <Link href="/mahdi/khatma" className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> ختمتي
      </Link>
      <ReaderClock extra={extra} />
      {error && !words ? (
        <p className="m-card p-5 text-center">{error}</p>
      ) : !words ? (
        <p className="m-muted">{t.khatma.loadingText}</p>
      ) : (
        <>
          <QuranText words={words} eyebrow="الختمة العلوية · ختمتي" />
          <div className="m-card space-y-2 p-4">
            {!k.data ? null : !open ? (
              <p className="text-center text-sm m-muted">
                ابدأ ختمتك من <Link href="/mahdi/khatma" className="underline">«ختمتي»</Link> عشان ينحسب لك اللي تقرؤه.
              </p>
            ) : !inRange(range, q) ? (
              <p className="text-center text-sm m-muted">هذا خارج الجزء اللي حددته لختمتك.</p>
            ) : read ? (
              <>
                <p className="text-center font-semibold" style={{ color: "#22c55e" }}>✅ قرأته</p>
                <button type="button" className="m-btn m-btn-quiet w-full" disabled={k.busy} onClick={() => void k.unread(q)}>ما قرأته (تراجع)</button>
              </>
            ) : (
              <>
                <button type="button" className="m-btn m-btn-primary w-full" disabled={k.busy} onClick={() => void markRead(true)}>قرأته ✓ والتالي</button>
                <button type="button" className="m-btn m-btn-ghost w-full" disabled={k.busy} onClick={() => void markRead(false)}>قرأته ✓</button>
                {k.habit && <p className="text-center text-xs m-muted">ينضاف على عادة «{k.habit.name}».</p>}
              </>
            )}
          </div>
          {/* like turning the mushaf's pages: the one before on the right, the next on the left */}
          <nav className="grid grid-cols-2 gap-2" aria-label="التنقل">
            {q > range.from ? (
              <Link href={`/mahdi/khatma/read/${q - 1}`} className="m-btn m-btn-ghost m-btn-sm">
                <Icon name="chevronRight" size={16} /> {portionTitle(unit, q - 1)}
              </Link>
            ) : <span />}
            {q < range.to ? (
              <Link href={`/mahdi/khatma/read/${q + 1}`} className="m-btn m-btn-ghost m-btn-sm">
                {portionTitle(unit, q + 1)} <Icon name="chevronLeft" size={16} />
              </Link>
            ) : <span />}
          </nav>
          <QuranSource words={words} />
        </>
      )}
    </div>
  );
}
