"use client";

// «أولوياتي» of past days: a priority isn't lost when its day ends. For a stretch of days (the last week in «حاسبوا
// أنفسكم», a week or a month report, one past day) it shows how many were done of how many, and each day with what was
// done ✓ and what was not ✗. Read through the person's own session (/api/mahdi/tasks?priorities=1).

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, type ISODate } from "@/lib/mahdi/engine";
import { fmtDate, fmtNum, fmtPct, fmtRelativeDay, t, weekdayName } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { summarizePriorities } from "@/lib/mahdi/priorities";
import type { DayTask } from "@/lib/mahdi/types";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import { usePriorityDone } from "./usePriorityDone";

type Load = { state: "loading" } | { state: "off" } | { state: "error" } | { state: "ready"; tasks: DayTask[] };

/** The priorities of `from`..`to` from the server (kept per range while the page is open). */
function usePriorities(from: ISODate, to: ISODate): Load {
  const key = `${from}:${to}`;
  const [res, setRes] = useState<{ key: string; load: Load }>({ key: "", load: { state: "loading" } });
  useEffect(() => {
    let live = true;
    mahdiFetch<{ ready: boolean; priorities: DayTask[] }>(`/api/mahdi/tasks?priorities=1&from=${from}&to=${to}`)
      .then((r) => live && setRes({ key, load: r.ready ? { state: "ready", tasks: r.priorities } : { state: "off" } }))
      .catch(() => live && setRes({ key, load: { state: "error" } }));
    return () => {
      live = false;
    };
  }, [from, to, key]);
  return res.key === key ? res.load : { state: "loading" };
}

/**
 * The statistic and the days. `from`..`to` inclusive; days after today are never asked. One day (`from === to`) shows its
 * list straight away.
 */
export default function PriorityHistory({ from, to, title, hint }: { from: ISODate; to: ISODate; title?: string; hint?: string }) {
  const { state } = useMahdi();
  const end = to < state.today ? to : state.today;
  const load = usePriorities(from, end);
  const { isDone } = usePriorityDone();
  const sum = useMemo(() => (load.state === "ready" ? summarizePriorities(load.tasks, isDone) : null), [load, isDone]);
  const oneDay = from === end;
  const [open, setOpen] = useState<ISODate | null>(null);

  if (end < from) return null;
  return (
    <section className="m-card space-y-3 p-5" aria-labelledby={`ph-${from}-${end}`}>
      <div className="flex items-center gap-2">
        <Icon name="sparkle" size={20} className="m-gold" />
        <h2 id={`ph-${from}-${end}`} className="flex-1 font-semibold">
          {title ?? t.priorityHistory.title}
        </h2>
        {sum && sum.total > 0 && <span className="m-num text-sm font-semibold m-gold">{fmtPct(sum.share)}</span>}
      </div>
      {hint && <p className="text-xs m-muted">{hint}</p>}

      {load.state === "loading" && <p className="text-sm m-muted">{t.common.loading}</p>}
      {load.state === "off" && <p className="text-sm m-muted">{t.priorities.notReady}</p>}
      {load.state === "error" && <p className="text-sm m-muted">{t.priorityHistory.error}</p>}
      {sum && sum.total === 0 && <p className="text-sm m-muted">{oneDay ? t.priorityHistory.noneDay : t.priorityHistory.none}</p>}

      {sum && sum.total > 0 && (
        <>
          {/* the statistic */}
          <div className="space-y-1.5">
            <p className="m-num font-semibold">{t.priorityHistory.done(sum.done, sum.total)}</p>
            <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--m-surface-2)" }} role="img" aria-label={t.priorityHistory.done(sum.done, sum.total)}>
              <div className="h-full rounded-full" style={{ width: `${Math.round((sum.share ?? 0) * 100)}%`, background: "var(--m-gold)" }} />
            </div>
            {!oneDay && (
              <p className="m-num text-xs m-muted">
                {t.priorityHistory.notDone(sum.total - sum.done)} · {t.priorityHistory.fullDays(sum.fullDays, sum.days.length)}
              </p>
            )}
          </div>

          {/* each day: done ✓ and not done ✗ */}
          {oneDay ? (
            <Items items={sum.days[0].items} />
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>
              {sum.days.map((d) => {
                const isOpen = open === d.date;
                return (
                  <li key={d.date} className="py-1.5">
                    <button type="button" className="flex w-full items-center gap-3 py-1 text-start" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.date)}>
                      <span className="w-24 shrink-0">
                        <span className="block text-sm font-semibold">{weekdayName(d.date)}</span>
                        <span className="m-num block text-xs m-muted">{fmtDate(d.date)}</span>
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--m-surface-2)" }}>
                        <span className="block h-full rounded-full" style={{ width: `${Math.round((d.done / d.total) * 100)}%`, background: d.done === d.total ? "var(--m-gold)" : "var(--m-gold-2, var(--m-gold))" }} />
                      </span>
                      <span className="m-num w-12 shrink-0 text-end text-sm font-semibold">
                        {fmtNum(d.done)}/{fmtNum(d.total)}
                      </span>
                      <Icon name={isOpen ? "chevronUp" : "chevronDown"} size={16} className="m-muted shrink-0" />
                    </button>
                    {isOpen && (
                      <div className="pb-2 ps-1">
                        <Items items={d.items} />
                        <Link href={`/mahdi/day/${d.date}`} className="mt-1 inline-block text-xs font-semibold m-gold">
                          {t.priorityHistory.openDay} ←
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Items({ items }: { items: { id: string; title: string; done: boolean; habitId: string | null }[] }) {
  const done = items.filter((i) => i.done), left = items.filter((i) => !i.done);
  return (
    <div className="space-y-2">
      {done.length > 0 && (
        <div>
          <p className="text-xs font-semibold m-muted">{t.priorityHistory.doneList}</p>
          <ul className="mt-1 space-y-1">
            {done.map((i) => (
              <li key={i.id} className="flex items-start gap-2 text-sm">
                <span className="m-gold font-bold" aria-hidden="true">✓</span>
                <span className="min-w-0 flex-1">{i.title}{i.habitId && <span className="m-muted"> ↺</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {left.length > 0 && (
        <div>
          <p className="text-xs font-semibold m-muted">{t.priorityHistory.leftList}</p>
          <ul className="mt-1 space-y-1">
            {left.map((i) => (
              <li key={i.id} className="flex items-start gap-2 text-sm">
                <span className="font-bold" style={{ color: "var(--m-error)" }} aria-hidden="true">✗</span>
                <span className="min-w-0 flex-1 m-muted">{i.title}{i.habitId && <span> ↺</span>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Under today's priorities on the home: «أمس: خلّصت 2 من 3» and the way to the past days. Nothing when yesterday had none. */
export function YesterdayPriorities() {
  const { state } = useMahdi();
  const y = addDays(state.today, -1);
  const load = usePriorities(y, y);
  const { isDone } = usePriorityDone();
  if (load.state !== "ready") return null;
  const sum = summarizePriorities(load.tasks, isDone);
  if (!sum.total) return null;
  return (
    <Link href="/mahdi/progress#priorities" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--m-surface-2)" }}>
      <span className="flex-1">
        {t.priorityHistory.yesterday(fmtRelativeDay(y, state.today), sum.done, sum.total)}
      </span>
      <span className="m-gold font-semibold">{t.priorityHistory.seeDays} ←</span>
    </Link>
  );
}
