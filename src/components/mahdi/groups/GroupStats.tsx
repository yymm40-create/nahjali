"use client";

// «الإحصائيات» of a group: every member's commitment to the group's program (today, week, month, streak), a member's
// own page, and two to four of them compared — lines over 12 weeks, bars per habit and per project, 30 days of cells,
// and a ring each. A member who may not see everyone sees their own.

import { useEffect, useMemo, useState } from "react";
import { fmtDate, fmtNum, fmtPct, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import Avatar from "../Avatar";
import { GroupedBars, HeatRows, Legend, MultiLine, Ring, SERIES, type Series } from "./charts";

interface Stat {
  key: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  mine: boolean;
  today: number | null;
  week: number | null;
  month: number | null;
  streak: number;
  best: number;
  achieved: number;
  required: number;
  habits: Record<string, number | null>;
  projects: Record<string, number | null>;
  weeks: { start: string; score: number | null }[];
  days: { date: string; score: number | null }[];
}
interface Data {
  ready: boolean;
  all: boolean;
  projects: { id: string; name: string; icon: string; color: string }[];
  habits: { id: string; projectId: string; name: string; icon: string }[];
  members: Stat[];
}
type Sort = "month" | "week" | "today" | "streak";

const s = t.groups.stats;
const name = (m: Stat) => m.displayName || m.username;

export default function GroupStats({ groupId, reload }: { groupId: string; reload: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<Sort>("month");
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    mahdiFetch<Data>(`/api/mahdi/groups/${groupId}/stats`)
      .then((d) => live && (setData(d), setError("")))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [groupId, reload]);

  const sorted = useMemo(() => {
    const v = (m: Stat) => (sort === "streak" ? m.streak : (m[sort] ?? -1));
    return [...(data?.members ?? [])].sort((a, b) => v(b) - v(a));
  }, [data, sort]);

  if (error) return <p className="m-card p-5 text-center">{error}</p>;
  if (!data) return <p className="m-muted">{t.common.loading}</p>;
  if (!data.ready) return <p className="m-note">{t.groups.program.notReady}</p>;
  if (!data.habits.length) return <p className="m-card p-5 text-center m-muted">{s.empty}</p>;

  const toggle = (key: string) =>
    setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : list.length >= 4 ? list : [...list, key]));
  const chosen = picked.map((k) => data.members.find((m) => m.key === k)).filter((m): m is Stat => Boolean(m));
  const single = !data.all ? data.members[0] : open ? data.members.find((m) => m.key === open) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{s.title}</h2>
        <p className="text-sm m-muted">{data.all ? s.hint : s.mineOnly}</p>
      </header>

      {single && <MemberDetail data={data} m={single} onClose={data.all ? () => setOpen(null) : undefined} />}

      {data.all && !single && (
        <>
          <section className="space-y-3" aria-labelledby="st-all">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="st-all" className="flex-1 font-semibold">{s.all}</h3>
              <span className="text-sm m-muted">{s.sortBy}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={s.sortBy}>
                {(["month", "week", "today", "streak"] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={sort === k} className="m-option min-h-9 px-2.5 text-xs font-semibold" onClick={() => setSort(k)}>
                    {s[k]}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm m-muted">{s.compareHint}</p>
            {/* the table: every number, so nothing rests on colour alone */}
            <div className="m-card overflow-x-auto">
              <table className="m-num w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="text-xs m-muted">
                    <th className="w-10 p-2" scope="col"><span className="sr-only">{s.compare}</span></th>
                    <th className="p-2 text-start" scope="col">{s.member}</th>
                    <th className="p-2" scope="col">{s.today}</th>
                    <th className="p-2" scope="col">{s.week}</th>
                    <th className="p-2" scope="col">{s.month}</th>
                    <th className="p-2" scope="col">{s.streak}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((m) => {
                    const at = picked.indexOf(m.key);
                    return (
                      <tr key={m.key} className="border-t" style={{ borderColor: "var(--m-line)" }}>
                        <td className="p-2 text-center">
                          <input type="checkbox" className="size-4 accent-current" checked={at >= 0} disabled={at < 0 && picked.length >= 4} onChange={() => toggle(m.key)} aria-label={`${s.compare}: ${name(m)}`} />
                        </td>
                        <td className="p-2">
                          <button type="button" className="flex min-w-0 items-center gap-2 text-start" onClick={() => setOpen(m.key)}>
                            {at >= 0 && <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: SERIES[at] }} aria-hidden="true" />}
                            <Avatar profile={m} size={28} />
                            <span className="truncate font-semibold underline-offset-2 hover:underline">{t.mawla(name(m))}{m.mine && ` · ${t.leaderboard.you}`}</span>
                          </button>
                        </td>
                        <td className="p-2 text-center">{fmtPct(m.today)}</td>
                        <td className="p-2 text-center">{fmtPct(m.week)}</td>
                        <td className="p-2 text-center font-semibold">{fmtPct(m.month)}</td>
                        <td className="p-2 text-center">{fmtNum(m.streak)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {chosen.length === 1 && <p className="m-note text-sm">{s.pickMore}</p>}
          {chosen.length >= 2 && <Compare data={data} members={chosen} />}
        </>
      )}
    </div>
  );
}

function habitLabel(h: Data["habits"][number]) {
  return `${h.icon ? `${h.icon} ` : ""}${h.name}`;
}

/** Two to four members side by side. */
function Compare({ data, members }: { data: Data; members: Stat[] }) {
  const series: Series[] = members.map((m, k) => ({ key: m.key, name: name(m), color: SERIES[k] }));
  const weeks = members[0].weeks.map((w, i) => ({ label: fmtDate(w.start), values: members.map((m) => m.weeks[i]?.score ?? null) }));
  return (
    <section className="space-y-5" aria-labelledby="st-cmp">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="st-cmp" className="flex-1 text-lg font-semibold">{s.compareTitle}</h3>
        <Legend series={series} />
      </div>

      <div className="m-card space-y-3 p-4">
        <h4 className="font-semibold">{s.cardsChart}</h4>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {members.map((m, k) => (
            <li key={m.key} className="flex flex-col items-center gap-1 text-center">
              <Ring value={m.week} color={SERIES[k]} />
              <span className="w-full truncate text-sm font-semibold">{name(m)}</span>
              <span className="m-num text-xs m-muted">{s.month} {fmtPct(m.month)} · {s.streak} {fmtNum(m.streak)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="m-card space-y-3 p-4">
        <h4 className="font-semibold">{s.weeksChart}</h4>
        <MultiLine series={series} points={weeks} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="m-card space-y-3 p-4">
          <h4 className="font-semibold">{s.habitsChart}</h4>
          <GroupedBars series={series} rows={data.habits.map((h) => ({ key: h.id, label: habitLabel(h), values: members.map((m) => m.habits[h.id] ?? null) }))} />
        </div>
        <div className="m-card space-y-3 p-4">
          <h4 className="font-semibold">{s.projectsChart}</h4>
          <GroupedBars series={series} rows={data.projects.map((p) => ({ key: p.id, label: `${p.icon ? `${p.icon} ` : ""}${p.name}`, values: members.map((m) => m.projects[p.id] ?? null) }))} />
        </div>
      </div>

      <div className="m-card space-y-3 p-4">
        <h4 className="font-semibold">{s.daysChart}</h4>
        <HeatRows rows={members.map((m) => ({ key: m.key, name: name(m), days: m.days }))} />
        <HeatLegend />
      </div>
    </section>
  );
}

/** One member's page: their numbers, their weeks, each habit, and their last 30 days. */
function MemberDetail({ data, m, onClose }: { data: Data; m: Stat; onClose?: () => void }) {
  const one: Series[] = [{ key: m.key, name: name(m), color: "var(--m-gold)" }];
  return (
    <section className="space-y-4" aria-labelledby="st-one">
      <div className="flex items-center gap-3">
        <Avatar profile={m} size={44} />
        <div className="min-w-0 flex-1">
          <h3 id="st-one" className="truncate text-lg font-semibold">{t.mawla(name(m))}</h3>
          <p className="m-num text-sm m-muted">{s.goals(m.achieved, m.required)}</p>
        </div>
        {onClose && <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={onClose}>{s.close}</button>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["today", "week", "month"] as const).map((k) => (
          <div key={k} className="m-card p-3 text-center">
            <p className="text-xs m-muted">{s[k]}</p>
            <p className="m-num text-2xl font-bold">{fmtPct(m[k])}</p>
          </div>
        ))}
        <div className="m-card p-3 text-center">
          <p className="text-xs m-muted">{s.streak}</p>
          <p className="m-num text-2xl font-bold">{fmtNum(m.streak)}</p>
          <p className="m-num text-[11px] m-muted">{s.best(m.best)}</p>
        </div>
      </div>
      <div className="m-card space-y-3 p-4">
        <h4 className="font-semibold">{s.weeksChart}</h4>
        <MultiLine series={one} points={m.weeks.map((w) => ({ label: fmtDate(w.start), values: [w.score] }))} />
      </div>
      <div className="m-card space-y-3 p-4">
        <h4 className="font-semibold">{s.habitsChart}</h4>
        <GroupedBars series={one} rows={data.habits.map((h) => ({ key: h.id, label: habitLabel(h), values: [m.habits[h.id] ?? null] }))} />
      </div>
      <div className="m-card space-y-3 p-4">
        <h4 className="font-semibold">{s.daysChart}</h4>
        <HeatRows rows={[{ key: m.key, name: name(m), days: m.days }]} />
        <HeatLegend />
      </div>
    </section>
  );
}

function HeatLegend() {
  return (
    <p className="flex flex-wrap items-center gap-2 text-[11px] m-muted">
      <span className="inline-block size-3 rounded-[3px]" style={{ background: "var(--m-track)" }} aria-hidden="true" /> {s.legendEmpty}
      <span className="ms-3">{s.legendLow}</span>
      {[0.1, 0.5, 1].map((v) => (
        <span key={v} className="inline-block size-3 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--m-gold) ${Math.round(15 + v * 85)}%, var(--m-track))` }} aria-hidden="true" />
      ))}
      <span>{s.legendHigh}</span>
    </p>
  );
}
