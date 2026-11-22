"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { plainAnswer } from "@/lib/mahdi/sheikh";
import { riyadhDay, type SheikhLogQuestion, type SheikhLogStats } from "@/lib/mahdi/sheikh-log";
import Icon from "@/components/mahdi/Icon";

interface Log {
  ready: boolean;
  questions?: SheikhLogQuestion[];
  stats?: SheikhLogStats;
}

const L = t.sheikhLog;
const usd = (n: number) => `$${n < 0.1 ? n.toFixed(4) : n.toFixed(2)}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("ar-u-nu-latn", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });

/** The owner's log of «الشيخ الذكي»: every question people asked (not his own) with its answer, and the numbers — nobody named. */
export default function SheikhQuestionsPage() {
  const [data, setData] = useState<Log | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    mahdiFetch<Log>("/api/mahdi/sheikh/questions").then(setData).catch((e: Error) => setErr(e.message));
  }, []);

  const list = useMemo(() => {
    const words = q.trim();
    return (data?.questions ?? []).filter((x) => !words || x.question.includes(words) || (x.answer ?? "").includes(words));
  }, [data, q]);

  const head = (
    <header className="flex items-center gap-3">
      <Link href="/mahdi/more" aria-label={t.common.back} className="m-btn m-btn-ghost m-btn-sm">
        <Icon name="chevronRight" size={18} />
      </Link>
      <div>
        <h1 className="m-display text-2xl">{L.title}</h1>
        <p className="m-muted text-sm">{L.hint}</p>
      </div>
    </header>
  );
  if (err) return <div className="space-y-4">{head}<p className="m-note">{err}</p></div>;
  if (!data) return <div className="space-y-4">{head}<p className="m-muted">{L.loading}</p></div>;
  if (!data.ready) return <div className="space-y-4">{head}<p className="m-note">{L.notReady}</p></div>;
  const s = data.stats!;
  if (!s.questions) return <div className="space-y-4">{head}<p className="m-muted">{L.empty}</p></div>;
  const maxDay = Math.max(1, ...s.days.map((d) => d.questions));
  const tiles: [string, string, string?][] = [
    [L.questions, fmtNum(s.questions)],
    [L.people, fmtNum(s.people), L.cameBack(s.cameBack)],
    [`${L.quick} / ${L.deep}`, `${fmtNum(s.quick)} / ${fmtNum(s.deep)}`],
    [L.avgTime, `${s.avgSecs.quick === null ? "—" : L.secs(Math.round(s.avgSecs.quick))} / ${s.avgSecs.deep === null ? "—" : L.secs(Math.round(s.avgSecs.deep))}`, `${L.quick} / ${L.deep}`],
    [L.cost, usd(s.usd)],
    [L.avgCost, `${s.avgUsd.quick === null ? "—" : usd(s.avgUsd.quick)} / ${s.avgUsd.deep === null ? "—" : usd(s.avgUsd.deep)}`, `${L.quick} / ${L.deep}`],
    [L.noSources, fmtNum(s.noSources), `${L.noAnswer}: ${fmtNum(s.noAnswer)}`],
    [L.reports, fmtNum(s.reports)],
  ];

  return (
    <div className="space-y-6">
      {head}

      <section className="grid grid-cols-2 gap-3">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="m-card p-3">
            <p className="m-eyebrow">{label}</p>
            <p className="m-num text-xl font-semibold" dir="ltr" style={{ textAlign: "right" }}>{value}</p>
            {sub && <p className="m-muted text-xs">{sub}</p>}
          </div>
        ))}
      </section>

      <section className="m-card space-y-2 p-4">
        <h2 className="font-semibold">{L.perDay}</h2>
        {s.days.slice(-14).map((d) => (
          <div key={d.day} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="m-num">{d.day}</span>
              <span className="m-muted">{L.dayLine(d.questions, d.people)}</span>
            </div>
            <div className="m-bar"><span style={{ width: `${(d.questions / maxDay) * 100}%` }} /></div>
          </div>
        ))}
      </section>

      {s.top.length > 0 && (
        <section className="m-card space-y-2 p-4">
          <h2 className="font-semibold">{L.top}</h2>
          {s.top.map((g) => (
            <div key={g.question} className="flex items-start justify-between gap-3 text-sm">
              <span className="flex-1">{g.question}</span>
              <span className="m-muted shrink-0 text-xs">{L.times(g.times, g.people)}</span>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">{L.all} ({fmtNum(list.length)})</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input className="m-field min-h-11 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} aria-label={L.search} />
        </div>
        {list.length === 0 && <p className="m-muted text-sm">{L.none}</p>}
        {list.map((x) => {
          const key = `${x.at}-${x.person}`;
          const shown = open === key;
          return (
            <article key={key} className="m-card space-y-2 p-4">
              <div className="m-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-semibold">{L.person(x.person)}</span>
                <span className="m-num">{riyadhDay(x.at)} · {time(x.at)}</span>
                <span>{x.mode === "deep" ? L.deep : L.quick}</span>
                {x.secs !== null && <span>{L.secs(x.secs)}</span>}
                <span className="m-num" dir="ltr">{usd(x.usd)}</span>
                <span>{L.sources(x.sources)}</span>
              </div>
              <p className="font-semibold">{x.question}</p>
              {x.report && <p className="m-note text-sm">{L.report} {x.report}</p>}
              <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setOpen(shown ? null : key)}>
                {shown ? L.hideAnswer : L.showAnswer}
              </button>
              {shown && <p className="whitespace-pre-wrap text-sm leading-7">{x.answer === null ? L.noAnswerYet : plainAnswer(x.answer).replace(/\*\*/g, "")}</p>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
