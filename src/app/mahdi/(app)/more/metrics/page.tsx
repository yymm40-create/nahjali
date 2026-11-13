"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtNum, fmtPct, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Icon from "@/components/mahdi/Icon";

interface Cohort { week: string; size: number; size_d1: number; size_d7: number; size_d30: number; d1: number; d7: number; d30: number }
interface Metrics {
  ready: boolean;
  funnel?: { signed_up: number; made_habit: number; first_check: number; first_check_first_session: number };
  active?: { day: number; week: number; month: number };
  cohorts?: Cohort[];
  areas?: { area: string; users7: number; users30: number }[];
  daily?: { day: string; users: number }[];
  since?: string | null;
}

const m = t.metrics;
const share = (n: number, of: number) => (of > 0 ? fmtPct(n / of) : m.notYet);

/** The owner's usage numbers: signup to first «تم», coming back by signup week, and the sections in use. */
export default function MetricsPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    mahdiFetch<Metrics>("/api/mahdi/metrics").then(setData).catch((e: Error) => setErr(e.message));
  }, []);

  const head = (
    <header className="flex items-center gap-3">
      <Link href="/mahdi/more" aria-label={t.common.back} className="m-btn m-btn-ghost m-btn-sm">
        <Icon name="chevronRight" size={18} />
      </Link>
      <div>
        <h1 className="m-display text-2xl">{m.title}</h1>
        <p className="m-muted text-sm">{m.hint}</p>
      </div>
    </header>
  );
  if (err) return <div className="space-y-4">{head}<p className="m-note">{err}</p></div>;
  if (!data) return <div className="space-y-4">{head}<p className="m-muted">{m.loading}</p></div>;
  if (!data.ready) return <div className="space-y-4">{head}<p className="m-note">{m.notReady}</p></div>;

  const f = data.funnel!;
  const steps: [string, number][] = [[m.signedUp, f.signed_up], [m.madeHabit, f.made_habit], [m.firstCheck, f.first_check], [m.firstSession, f.first_check_first_session]];
  const maxDaily = Math.max(1, ...(data.daily ?? []).map((d) => d.users));

  return (
    <div className="space-y-6">
      {head}
      {data.since && <p className="m-muted text-xs">{m.since(data.since)}</p>}

      <section className="m-card space-y-3 p-4">
        <h2 className="font-semibold">{m.funnel}</h2>
        {steps.map(([label, n]) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="m-num">{fmtNum(n)} · {share(n, f.signed_up)}</span>
            </div>
            <div className="m-bar"><span style={{ width: `${f.signed_up ? (n / f.signed_up) * 100 : 0}%` }} /></div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-3 gap-3" aria-label={m.active}>
        {([[m.today, data.active!.day], [m.week, data.active!.week], [m.month, data.active!.month]] as const).map(([l, n]) => (
          <div key={l} className="m-card p-3 text-center">
            <p className="m-eyebrow">{l}</p>
            <p className="m-num text-xl font-semibold">{fmtNum(n)}</p>
          </div>
        ))}
      </section>

      <section className="m-card space-y-2 p-4">
        <h2 className="font-semibold">{m.daily}</h2>
        <div className="flex h-24 items-end gap-0.5" dir="ltr">
          {(data.daily ?? []).map((d) => (
            <span key={d.day} title={`${d.day}: ${d.users}`} className="flex-1 rounded-t" style={{ height: `${(d.users / maxDaily) * 100}%`, background: "var(--m-accent, currentColor)", opacity: 0.8 }} />
          ))}
        </div>
      </section>

      <section className="m-card overflow-x-auto p-4">
        <h2 className="mb-2 font-semibold">{m.cohorts}</h2>
        <table className="w-full text-sm">
          <thead className="m-muted">
            <tr><th className="text-start">{m.weekOf}</th><th>{m.size}</th><th>{m.d1}</th><th>{m.d7}</th><th>{m.d30}</th></tr>
          </thead>
          <tbody className="m-num">
            {(data.cohorts ?? []).map((c) => (
              <tr key={c.week}>
                <td className="text-start">{c.week}</td>
                <td className="text-center">{fmtNum(c.size)}</td>
                <td className="text-center">{share(c.d1, c.size_d1)}</td>
                <td className="text-center">{share(c.d7, c.size_d7)}</td>
                <td className="text-center">{share(c.d30, c.size_d30)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="m-card overflow-x-auto p-4">
        <h2 className="mb-2 font-semibold">{m.areas}</h2>
        <table className="w-full text-sm">
          <thead className="m-muted"><tr><th className="text-start">{m.area}</th><th>{m.users7}</th><th>{m.users30}</th></tr></thead>
          <tbody className="m-num">
            {(data.areas ?? []).map((a) => (
              <tr key={a.area}>
                <td className="text-start">{m.areaNames[a.area] ?? a.area}</td>
                <td className="text-center">{fmtNum(a.users7)}</td>
                <td className="text-center">{fmtNum(a.users30)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
