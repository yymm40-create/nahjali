"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { t } from "@/lib/mahdi/i18n";
import Icon from "@/components/mahdi/Icon";
import QuranReader from "@/components/mahdi/khatma/QuranReader";
import { useReadOrder } from "@/components/mahdi/khatma/useReadOrder";
import { useMyKhatma } from "@/components/mahdi/khatma/useMyKhatma";
import { khatmaStats, nextAfter, nextPortion, unitText } from "@/lib/mahdi/khatma/mine";
import { fullRange, inRange, portionCount, portionTitle } from "@/lib/mahdi/khatma/portions";

/**
 * «ختمتي»: one portion of my khatma (a page, juz, hizb, half or quarter hizb — the khatma's own division) in the one
 * Quran reader, «قرأته ✓ والتالي» (fills the linked habit), today's portion, and the way to the one before and after.
 */
export default function MyKhatmaReader() {
  const q = Number(useParams<{ q: string }>().q);
  const router = useRouter();
  const k = useMyKhatma();
  const [order] = useReadOrder();
  const cur = k.data?.current;
  // a khatma ended or not started reads by quarters, the whole Quran
  const unit = cur?.status === "open" ? cur.unit : (cur?.unit ?? "quarter");
  const range = cur?.status === "open" ? cur.range : fullRange(unit);
  const valid = Number.isInteger(q) && q >= 1 && q <= portionCount(unit);
  const open = cur?.status === "open";
  const read = cur?.reads.find((r) => r.quarter === q);
  // today's portion (spread again by itself over the days left when a day was missed)
  const stats = open && cur && k.data ? khatmaStats(cur.reads, cur.startedOn, cur.days, k.data.today, cur.range) : null;

  async function markRead(goOn: boolean) {
    const r = await k.read([q]);
    if (!r || r.finished) return router.push("/mahdi/khatma");
    if (goOn) {
      const done = [...(cur?.reads.map((x) => x.quarter) ?? []), q];
      // in order: after the furthest read; reading wherever they like: the next unread after this one
      const next = order === "free" ? nextAfter(done, range, q) : nextPortion(done, range);
      router.push(next ? `/mahdi/khatma/read/${next}` : "/mahdi/khatma");
    }
  }

  if (k.data && !valid) return <p className="m-card p-5 text-center">{t.errors.notFound}</p>;
  return (
    <QuranReader
      division={k.data && valid ? unit : undefined}
      n={q}
      eyebrow="ختمتي"
      prev={q > range.from ? { href: `/mahdi/khatma/read/${q - 1}`, label: portionTitle(unit, q - 1) } : null}
      next={q < range.to ? { href: `/mahdi/khatma/read/${q + 1}`, label: portionTitle(unit, q + 1) } : null}
    >
      {!k.data ? null : !open ? (
        <p className="text-center text-sm m-muted">
          ابدأ ختمتك من <Link href="/mahdi/khatma" className="underline">«ختمتي»</Link> عشان ينحسب لك اللي تقرؤه.
        </p>
      ) : !inRange(range, q) ? (
        <p className="text-center text-sm m-muted">هذا خارج الجزء اللي حددته لختمتك.</p>
      ) : read ? (
        <>
          <p className="flex items-center justify-center gap-2 font-semibold" style={{ color: "var(--m-success)" }}>
            <Icon name="check" size={18} /> قرأته
          </p>
          <button type="button" className="m-btn m-btn-quiet w-full" disabled={k.busy} onClick={() => void k.unread(q)}>ما قرأته (تراجع)</button>
        </>
      ) : (
        <>
          <button type="button" className="m-btn m-btn-primary w-full" disabled={k.busy} onClick={() => void markRead(true)}>
            قرأته <Icon name="check" size={16} className="m-ico" strokeWidth={2.4} /> والتالي
          </button>
          <button type="button" className="m-btn m-btn-ghost w-full" disabled={k.busy} onClick={() => void markRead(false)}>
            قرأته <Icon name="check" size={16} className="m-ico" strokeWidth={2.4} />
          </button>
          {k.habit && <p className="text-center text-xs m-muted">ينضاف على عادة «{k.habit.name}».</p>}
        </>
      )}
      {stats && (
        <p className="m-num text-center text-xs m-muted">
          ورد اليوم {stats.todayCount}/{stats.perDay}
          {stats.todayLeft ? ` · باقي ${unitText(unit, stats.todayLeft)}` : " · خلّصته، تقبّل الله"} · قرأت {stats.read} من {stats.total}
        </p>
      )}
    </QuranReader>
  );
}
