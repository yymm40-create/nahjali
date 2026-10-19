"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import Sheet from "@/components/mahdi/Sheet";
import { useMahdi } from "@/components/mahdi/Provider";
import {
  DIVISION_LABEL,
  DIVISIONS,
  khatmaEnd,
  nightName,
  nightText,
  portionQuarters,
  portionSummary,
  portionTitle,
  type Division,
  type PortionState,
} from "@/lib/mahdi/khatma/portions";

interface Settings {
  division: Division;
  weeks: number;
  endDow: number;
  endHour: number;
  timeZone: string;
  noRepeat: number;
  active: boolean;
}
interface Khatma {
  id: string;
  number: number;
  division: Division;
  startsAt: string;
  endsAt: string;
  status: "open" | "done" | "closed";
  finishedAt: string | null;
  overdue: boolean;
  dedicatedTo: string;
  forSoulOf: string;
  done: number;
  reading: number;
  total: number;
}
interface View {
  group: { id: string; name: string; isLeader: boolean };
  ready: boolean;
  settings?: Settings | null;
  khatma?: Khatma | null;
  portions?: PortionState[];
  readers?: { portion: number; name: string; status: "reading" | "done"; claimedAt: string }[];
  history?: { number: number; status: string; division: Division; done: number; total: number; dedicatedTo: string; forSoulOf: string; endsAt: string }[];
}

/** The colours of a portion: green read, yellow being read, grey read before (locked), the gold line free. */
const STATE_STYLE: Record<Exclude<PortionState, "taken">, React.CSSProperties> = {
  free: { borderColor: "var(--m-line)", background: "var(--m-surface-2)" },
  reading: { borderColor: "#eab308", background: "color-mix(in srgb, #eab308 22%, var(--m-surface-2))" },
  done: { borderColor: "#22c55e", background: "color-mix(in srgb, #22c55e 24%, var(--m-surface-2))" },
  blocked: { borderColor: "var(--m-line)", background: "var(--m-track)", opacity: 0.5, filter: "grayscale(1)", cursor: "not-allowed" },
};

const HOURS = [18, 19, 20, 21, 22, 23];
const hourText = (h: number) => new Intl.DateTimeFormat("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, h)));

/** One group's «الختمة العلوية»: the portions to take, mine, the dedication, and the leader's tools. */
export default function KhatmaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useMahdi();
  const [data, setData] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const [stop, setStop] = useState(false);

  useEffect(() => {
    let live = true;
    mahdiFetch<View>(`/api/mahdi/khatma/${id}`)
      .then((d) => live && (setData(d), setError("")))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [id, reload]);

  async function act(body: object, done: string) {
    setBusy(true);
    try {
      await mahdiFetch(`/api/mahdi/khatma/${id}`, { method: "POST", json: body });
      toast(done);
      setReload((n) => n + 1);
      return true;
    } catch (e) {
      toast((e as Error).message);
      setReload((n) => n + 1);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="m-card space-y-4 p-6 text-center">
        <p>{error}</p>
        <Link href="/mahdi/khatma" className="m-btn m-btn-ghost">{t.khatma.title}</Link>
      </div>
    );
  }
  if (!data) return <p className="m-muted">{t.common.loading}</p>;
  const { group, settings, khatma } = data;
  const tz = settings?.timeZone ?? "Asia/Riyadh";
  const portions = data.portions ?? [];
  const mine = portions.map((s, i) => ({ s, n: i + 1 })).filter((p) => p.s === "reading" || p.s === "done");

  return (
    <div className="space-y-6">
      <Link href={`/mahdi/groups/${id}`} className="m-btn m-btn-quiet m-btn-sm -ms-3">
        <Icon name="chevronRight" size={18} /> {group.name}
      </Link>
      <header className="space-y-1">
        <p className="m-eyebrow">{t.khatma.title}</p>
        <h1 className="m-display text-3xl">{khatma ? t.khatma.number(khatma.number) : t.khatma.title}</h1>
        {khatma && (
          <p className="m-num text-sm m-muted">
            {DIVISION_LABEL[khatma.division].all} · {khatma.status === "open" && !khatma.overdue ? t.khatma.endsAt(nightText(khatma.endsAt, tz)) : t.khatma.endedAt(nightText(khatma.endsAt, tz))}
          </p>
        )}
      </header>

      {!data.ready ? (
        <p className="m-note">{t.khatma.tablesNotReady}</p>
      ) : !settings || (!khatma && !group.isLeader) ? (
        group.isLeader ? <SettingsForm busy={busy} act={act} /> : <p className="m-card p-5 text-center m-muted">{t.khatma.notStartedMember}</p>
      ) : (
        <>
          {khatma && <Progress k={khatma} />}
          {khatma && (khatma.dedicatedTo || khatma.forSoulOf) && (
            <section className="m-card space-y-1 p-4 text-center">
              {khatma.dedicatedTo && <p><span className="m-muted">{t.khatma.dedicatedTo}:</span> <strong>{khatma.dedicatedTo}</strong></p>}
              {khatma.forSoulOf && <p><span className="m-muted">{t.khatma.forSoulOf}:</span> <strong>{khatma.forSoulOf}</strong></p>}
            </section>
          )}

          {!settings.active && <p className="m-note">{t.khatma.stopped}</p>}

          {khatma?.status === "done" && (
            <section className="m-card space-y-3 p-4 text-center">
              <p className="text-lg font-semibold">✅ {t.khatma.doneTitle}</p>
              {settings.active && <p className="text-sm m-muted">{t.khatma.doneNext(nightText(khatma.endsAt, tz))}</p>}
              {group.isLeader && settings.active && (
                <button type="button" className="m-btn m-btn-primary" disabled={busy} onClick={() => act({ action: "next" }, t.khatma.started)}>{t.khatma.startNext}</button>
              )}
            </section>
          )}

          {khatma?.overdue && (
            <section className="m-card space-y-3 p-4">
              <p className="font-semibold">⏳ {t.khatma.overdueTitle}</p>
              <p className="text-sm m-muted">{group.isLeader ? t.khatma.overdueLeader : t.khatma.overdueMember}</p>
              {group.isLeader && (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 7].map((d) => (
                    <button key={d} type="button" className="m-btn m-btn-ghost m-btn-sm" disabled={busy} onClick={() => act({ action: "extend", days: d }, t.khatma.extended)}>{t.khatma.extend(d)}</button>
                  ))}
                  <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy} onClick={() => act({ action: "next" }, t.khatma.started)}>{t.khatma.closeNow}</button>
                </div>
              )}
            </section>
          )}

          {khatma && mine.length > 0 && (
            <section className="space-y-2" aria-labelledby="mine">
              <h2 id="mine" className="text-lg font-semibold">أنصبتي</h2>
              <ul className="space-y-2">
                {mine.map(({ s, n }) => (
                  <li key={n}>
                    <Link href={`/mahdi/khatma/${id}/read/${n}`} className="m-card flex items-center gap-3 border-2 p-3" style={STATE_STYLE[s as "reading" | "done"]}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{portionTitle(khatma.division, n)}</span>
                        <span className="m-num block text-sm m-muted">{portionSummary(khatma.division, n).range} · {s === "done" ? t.khatma.legendDone : t.khatma.legendReading}</span>
                      </span>
                      <span className="m-btn m-btn-ghost m-btn-sm">{t.khatma.read}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {khatma && (
            <section className="space-y-3" aria-labelledby="grid">
              <h2 id="grid" className="text-lg font-semibold">{DIVISION_LABEL[khatma.division].all}</h2>
              <p className="text-sm m-muted">{t.khatma.gridHint}</p>
              <Legend />
              <Grid division={khatma.division} states={portions} onPick={(n) => setPick(n)} open={khatma.status === "open"} noRepeat={settings.noRepeat} />
            </section>
          )}

          {group.isLeader && khatma && (
            <Dedication key={`${khatma.id}:${khatma.dedicatedTo}:${khatma.forSoulOf}`} k={khatma} busy={busy} act={act} />
          )}

          {group.isLeader && data.readers && data.readers.length > 0 && khatma && (
            <section className="m-card space-y-2 p-4">
              <h3 className="font-semibold">{t.khatma.readersTitle}</h3>
              <ul className="divide-y text-sm" style={{ borderColor: "var(--m-line)" }}>
                {data.readers.map((r) => (
                  <li key={r.portion} className="flex items-center gap-2 py-2">
                    <span className="inline-block size-3 shrink-0 rounded-full" style={{ background: r.status === "done" ? "#22c55e" : "#eab308" }} />
                    <span className="min-w-0 flex-1">{portionTitle(khatma.division, r.portion)} · <strong>{t.mawla(r.name)}</strong></span>
                    {r.status === "reading" && khatma.status === "open" && (
                      <button type="button" className="m-btn m-btn-quiet m-btn-sm" disabled={busy} onClick={() => act({ action: "free", portion: r.portion }, t.khatma.freed)}>{t.khatma.free}</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {group.isLeader && (
            <details className="m-card p-4">
              <summary className="cursor-pointer font-semibold">{t.khatma.settings}</summary>
              <div className="mt-3 space-y-3">
                <SettingsForm busy={busy} act={act} current={settings} lockedDivision={Boolean(khatma && khatma.status === "open" && (khatma.done || khatma.reading))} />
                {settings.active && (
                  <button type="button" className="m-btn m-btn-danger w-full" onClick={() => setStop(true)}>{t.khatma.stop}</button>
                )}
              </div>
            </details>
          )}

          {(data.history?.length ?? 0) > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">{t.khatma.historyTitle}</h2>
              <ul className="m-card divide-y text-sm" style={{ borderColor: "var(--m-line)" }}>
                {data.history!.map((h) => (
                  <li key={h.number} className="m-num flex flex-wrap items-center gap-2 px-4 py-3">
                    <span className="font-semibold">{t.khatma.number(h.number)}</span>
                    <span className="m-muted">· {h.status === "done" ? `✅ ${t.khatma.historyDone}` : t.khatma.historyClosed(h.done, h.total)}</span>
                    {(h.dedicatedTo || h.forSoulOf) && <span className="w-full m-muted">{[h.dedicatedTo && `${t.khatma.dedicatedTo}: ${h.dedicatedTo}`, h.forSoulOf && `${t.khatma.forSoulOf}: ${h.forSoulOf}`].filter(Boolean).join(" · ")}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {khatma && pick !== null && (
        <Sheet open onClose={() => setPick(null)} title={portionTitle(khatma.division, pick)}>
          <PortionCard division={khatma.division} n={pick} />
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="m-btn m-btn-primary w-full"
              disabled={busy}
              onClick={async () => {
                const n = pick;
                if (await act({ action: "claim", portion: n }, t.khatma.claimed)) {
                  setPick(null);
                  router.push(`/mahdi/khatma/${id}/read/${n}`);
                }
              }}
            >
              {t.khatma.claim}
            </button>
            <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => setPick(null)}>{t.common.cancel}</button>
          </div>
        </Sheet>
      )}

      <ConfirmSheet open={stop} onClose={() => setStop(false)} title={t.khatma.stopTitle} body={t.khatma.stopBody} confirmLabel={t.khatma.stop} onConfirm={async () => void (await act({ action: "stop" }, t.khatma.stoppedDone))} />
    </div>
  );
}

function Progress({ k }: { k: Khatma }) {
  const pct = (x: number) => `${(x / k.total) * 100}%`;
  return (
    <section className="m-card space-y-2 p-4">
      <p className="m-num flex justify-between text-sm">
        <span className="font-semibold">{t.khatma.progress(k.done, k.total)}</span>
        <span className="m-muted">{t.khatma.legendReading}: {fmtNum(k.reading)}</span>
      </p>
      <span className="flex h-2.5 overflow-hidden rounded-full" style={{ background: "var(--m-track)" }} role="img" aria-label={t.khatma.progress(k.done, k.total)}>
        <span style={{ width: pct(k.done), background: "#22c55e" }} />
        <span style={{ width: pct(k.reading), background: "#eab308" }} />
      </span>
    </section>
  );
}

function Legend() {
  const items: [Exclude<PortionState, "taken">, string][] = [["free", t.khatma.legendFree], ["reading", t.khatma.legendReading], ["done", t.khatma.legendDone], ["blocked", t.khatma.legendBlocked]];
  return (
    <ul className="flex flex-wrap gap-3 text-xs">
      {items.map(([s, label]) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="inline-block size-4 rounded border-2" style={STATE_STYLE[s]} />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** The portions, grouped under their juz (for a hizb or smaller); what someone else took is not shown. */
function Grid({ division, states, onPick, open, noRepeat }: { division: Division; states: PortionState[]; onPick: (n: number) => void; open: boolean; noRepeat: number }) {
  const { id } = useParams<{ id: string }>();
  const groups = useMemo(() => {
    const per = states.length / 30;
    if (division === "juz") return [{ juz: 0, items: states.map((s, i) => ({ s, n: i + 1 })) }];
    return Array.from({ length: 30 }, (_, j) => ({ juz: j + 1, items: states.slice(j * per, (j + 1) * per).map((s, i) => ({ s, n: j * per + i + 1 })) }));
  }, [division, states]);
  const visible = states.filter((s) => s !== "taken").length;
  if (!visible) return <p className="m-card p-5 text-center m-muted">{t.khatma.noneFree}</p>;
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const items = g.items.filter((x) => x.s !== "taken");
        if (!items.length) return null;
        return (
          <div key={g.juz} className="space-y-2">
            {g.juz > 0 && <h3 className="m-num text-sm font-semibold m-muted">الجزء {g.juz}</h3>}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {items.map(({ s, n }) => {
                const { opening, range } = portionSummary(division, n);
                const body = (
                  <>
                    <span className="block text-sm font-semibold">{portionTitle(division, n)}</span>
                    <span className="block truncate text-xs m-muted" dir="rtl">{opening}</span>
                    <span className="m-num block text-[11px] m-muted">{range}</span>
                  </>
                );
                const cls = "block w-full rounded-xl border-2 p-2.5 text-start transition-transform active:scale-[.98]";
                return (
                  <li key={n}>
                    {s === "reading" || s === "done" ? (
                      <Link href={`/mahdi/khatma/${id}/read/${n}`} className={cls} style={STATE_STYLE[s]}>{body}</Link>
                    ) : (
                      <button
                        type="button"
                        className={cls}
                        style={STATE_STYLE[s as "free" | "blocked"]}
                        disabled={s === "blocked" || !open}
                        aria-disabled={s === "blocked" || !open}
                        title={s === "blocked" ? t.khatma.blockedNote(noRepeat) : undefined}
                        onClick={() => onPick(n)}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PortionCard({ division, n }: { division: Division; n: number }) {
  const { range, opening } = portionSummary(division, n);
  const q = portionQuarters(division, n);
  return (
    <div className="space-y-2 text-center">
      <p className="text-2xl leading-loose" style={{ fontFamily: "var(--font-quran), serif" }}>{opening}…</p>
      <p className="m-num text-sm m-muted">{range}</p>
      <p className="m-num text-xs m-muted">{q.toQ - q.fromQ + 1 === 1 ? "ربع حزب" : `${q.toQ - q.fromQ + 1} أرباع`}</p>
    </div>
  );
}

function Dedication({ k, busy, act }: { k: Khatma; busy: boolean; act: (b: object, done: string) => Promise<boolean> }) {
  const [to, setTo] = useState(k.dedicatedTo);
  const [soul, setSoul] = useState(k.forSoulOf);
  return (
    <form
      className="m-card space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void act({ action: "dedicate", dedicatedTo: to, forSoulOf: soul }, t.khatma.dedicated);
      }}
    >
      <h3 className="font-semibold">{t.khatma.dedicationTitle}</h3>
      <p className="text-sm m-muted">{t.khatma.dedicationHint}</p>
      <label className="block">
        <span className="m-label">{t.khatma.dedicatedTo}</span>
        <input className="m-field" maxLength={120} value={to} onChange={(e) => setTo(e.target.value)} placeholder={t.khatma.dedicatedToPlaceholder} />
      </label>
      <label className="block">
        <span className="m-label">{t.khatma.forSoulOf}</span>
        <input className="m-field" maxLength={120} value={soul} onChange={(e) => setSoul(e.target.value)} placeholder={t.khatma.forSoulOfPlaceholder} />
      </label>
      <button className="m-btn m-btn-ghost w-full" disabled={busy || (to === k.dedicatedTo && soul === k.forSoulOf)}>{t.common.save}</button>
    </form>
  );
}

function SettingsForm({ busy, act, current, lockedDivision = false }: { busy: boolean; act: (b: object, done: string) => Promise<boolean>; current?: Settings; lockedDivision?: boolean }) {
  const tz = useMemo(() => current?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Riyadh", [current]);
  const [division, setDivision] = useState<Division>(current?.division ?? "hizb");
  const [weeks, setWeeks] = useState(current?.weeks ?? 1);
  const [endDow, setEndDow] = useState(current?.endDow ?? 4);
  const [endHour, setEndHour] = useState(current?.endHour ?? 21);
  const [noRepeat, setNoRepeat] = useState(current?.noRepeat ?? 3);
  const firstEnd = useMemo(() => {
    try {
      return nightText(khatmaEnd(new Date(), { weeks, endDow, endHour, timeZone: tz }), tz);
    } catch {
      return "";
    }
  }, [weeks, endDow, endHour, tz]);
  // the night it ends: «ليلة السبت» … «ليلة الجمعة» (the evening before that day)
  const nights = [4, 5, 6, 0, 1, 2, 3];
  return (
    <form
      className={current ? "space-y-4" : "m-card space-y-4 p-4"}
      onSubmit={(e) => {
        e.preventDefault();
        void act({ action: "setup", division, weeks, endDow, endHour, noRepeat, timeZone: tz }, current?.active ? t.khatma.saved : t.khatma.started);
      }}
    >
      {!current && <h2 className="text-lg font-semibold">{t.khatma.setupTitle}</h2>}
      <fieldset className="space-y-2">
        <legend className="m-label">{t.khatma.division}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {DIVISIONS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={division === d} className="m-option min-h-11 px-3 text-sm font-semibold" onClick={() => setDivision(d)}>
              {DIVISION_LABEL[d].all}
            </button>
          ))}
        </div>
        {lockedDivision && current && division !== current.division && <p className="text-xs m-muted">{t.khatma.divisionLater}</p>}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="m-label">{t.khatma.every}</legend>
        <div className="grid grid-cols-4 gap-2" role="radiogroup">
          {[1, 2, 3, 4].map((w) => (
            <button key={w} type="button" role="radio" aria-checked={weeks === w} className="m-option min-h-10 px-2 text-sm font-semibold" onClick={() => setWeeks(w)}>{t.khatma.weeks(w)}</button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="m-label">{t.khatma.night}</span>
          <select className="m-field" value={endDow} onChange={(e) => setEndDow(Number(e.target.value))}>
            {nights.map((d) => <option key={d} value={d}>{nightName(d, 21)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="m-label">{t.khatma.hour}</span>
          <select className="m-field m-num" value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
            {(HOURS.includes(endHour) ? HOURS : [...HOURS, endHour]).map((h) => <option key={h} value={h}>{hourText(h)}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="m-label">{t.khatma.noRepeat}</span>
        <select className="m-field" value={noRepeat} onChange={(e) => setNoRepeat(Number(e.target.value))}>
          {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{t.khatma.noRepeatN(n)}</option>)}
        </select>
      </label>
      {!current && firstEnd && <p className="m-num text-sm m-muted">{t.khatma.firstEnds(firstEnd)}</p>}
      <button className="m-btn m-btn-primary w-full" disabled={busy}>{current?.active ? t.khatma.save : t.khatma.start}</button>
    </form>
  );
}
