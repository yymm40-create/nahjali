"use client";

// «المخطط»: the person's events and times, written inside the day squares of the calendar (once, or repeating every
// week / month) and listed for a week. Private, through the person's own session (/api/mahdi/planner).
import { useCallback, useEffect, useState } from "react";
import { addDays, type ISODate } from "@/lib/mahdi/engine";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { fmtDate, fmtDateLong, t, weekdayName } from "@/lib/mahdi/i18n";
import { itemsOn, PLAN_LIMITS, PLAN_REPEATS, timeText, weekDays, type PlanItem, type PlanRepeat } from "@/lib/mahdi/planner";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

export interface PlannerApi {
  items: PlanItem[];
  ready: boolean;
  loaded: boolean;
  add: (item: Omit<PlanItem, "id">) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

export function usePlanner(): PlannerApi {
  const { toast } = useMahdi();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [ready, setReady] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    mahdiFetch<{ ready: boolean; items: PlanItem[] }>("/api/mahdi/planner")
      .then((r) => {
        if (!live) return;
        setReady(r.ready);
        setItems(r.items);
        setLoaded(true);
      })
      .catch(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);
  const add = useCallback(
    async (item: Omit<PlanItem, "id">) => {
      try {
        const r = await mahdiFetch<{ item: PlanItem }>("/api/mahdi/planner", { method: "POST", json: item });
        setItems((all) => [...all, r.item]);
        toast(t.planner.saved);
        return true;
      } catch (e) {
        toast((e as Error).message);
        return false;
      }
    },
    [toast],
  );
  const remove = useCallback(
    async (id: string) => {
      try {
        await mahdiFetch(`/api/mahdi/planner?id=${id}`, { method: "DELETE" });
        setItems((all) => all.filter((x) => x.id !== id));
        toast(t.planner.removed);
      } catch (e) {
        toast((e as Error).message);
      }
    },
    [toast],
  );
  return { items, ready, loaded, add, remove };
}

/** The small text inside a day's square: the first two items, with their time. */
export function SquareText({ items }: { items: PlanItem[] }) {
  if (!items.length) return null;
  return (
    <span className="mt-0.5 block w-full space-y-px overflow-hidden px-0.5 text-[9px] leading-[1.15] opacity-90" aria-hidden="true">
      {items.slice(0, 2).map((i) => (
        <span key={i.id} className="block truncate">
          {i.start ? `${timeText({ start: i.start, end: null })} ` : ""}
          {i.title}
        </span>
      ))}
      {t.planner.inSquare(items.length) && <span className="block">{t.planner.inSquare(items.length)}</span>}
    </span>
  );
}

function PlanRow({ item, onRemove }: { item: PlanItem; onRemove: (id: string) => void }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="m-num w-20 shrink-0 text-xs m-muted">{timeText(item) || t.planner.noTime}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{item.title}</span>
        {item.note && <span className="block text-xs m-muted">{item.note}</span>}
        {item.repeat !== "none" && <span className="block text-xs m-muted">🔁 {t.planner.repeatNote[item.repeat]}</span>}
      </span>
      <button type="button" className="m-icon-btn shrink-0" aria-label={t.planner.remove} title={item.repeat !== "none" ? t.planner.removeSeries : t.planner.remove} onClick={() => onRemove(item.id)}>
        <Icon name="trash" size={16} />
      </button>
    </li>
  );
}

/** What is planned for one day, and the form to add to it. */
export function PlanDay({ day, planner }: { day: ISODate; planner: PlannerApi }) {
  const [adding, setAdding] = useState(false);
  const list = itemsOn(planner.items, day);
  return (
    <section className="space-y-3" aria-label={t.planner.title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">📅 {t.planner.title}</h3>
        {planner.ready && !adding && (
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> {t.planner.add}
          </button>
        )}
      </div>
      {!planner.ready && <p className="text-sm m-muted">{t.planner.off}</p>}
      {list.length === 0 ? <p className="text-sm m-muted">{t.planner.nothing}</p> : <ul className="space-y-2">{list.map((i) => <PlanRow key={i.id} item={i} onRemove={(id) => void planner.remove(id)} />)}</ul>}
      {adding && <PlanForm key={day} day={day} onDone={() => setAdding(false)} planner={planner} />}
    </section>
  );
}

function PlanForm({ day, planner, onDone }: { day: ISODate; planner: PlannerApi; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [repeat, setRepeat] = useState<PlanRepeat>("none");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const ok = await planner.add({ title, day, start: start || null, end: start && end ? end : null, repeat, note: "" });
    setBusy(false);
    if (ok) onDone();
  }
  return (
    <div className="space-y-2 rounded-2xl border p-3" style={{ borderColor: "var(--m-line)" }}>
      <p className="text-xs m-muted">{t.planner.addOn(fmtDateLong(day))}</p>
      <input className="m-field" autoFocus value={title} maxLength={PLAN_LIMITS.titleMax} placeholder={t.planner.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs m-muted">
          {t.planner.from}
          <input type="time" className="m-field" dir="ltr" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs m-muted">
          {t.planner.to}
          <input type="time" className="m-field" dir="ltr" value={end} disabled={!start} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.planner.repeatLabel}>
        <span className="text-xs m-muted">{t.planner.repeatLabel}</span>
        {PLAN_REPEATS.map((r) => (
          <button key={r} type="button" className="m-option px-3 py-1 text-xs" aria-pressed={repeat === r} onClick={() => setRepeat(r)}>
            {t.planner.repeat[r]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="m-btn m-btn-primary flex-1" disabled={!title.trim() || busy} onClick={() => void submit()}>
          {t.planner.save}
        </button>
        <button type="button" className="m-btn m-btn-ghost" onClick={onDone}>
          {t.planner.cancel}
        </button>
      </div>
    </div>
  );
}

/** A week as a list: each day with what is planned in it (a tap on a day opens it). */
export function PlanWeek({ start, planner, today, onPick }: { start: ISODate; planner: PlannerApi; today: ISODate; onPick: (d: ISODate) => void }) {
  return (
    <ul className="space-y-2" aria-label={t.planner.weekOf(fmtDate(start), fmtDate(addDays(start, 6)))}>
      {weekDays(start).map((d) => {
        const list = itemsOn(planner.items, d);
        return (
          <li key={d}>
            <button type="button" className="m-card flex w-full items-start gap-3 p-3 text-start" style={d === today ? { outline: "2px solid var(--m-gold-text)", outlineOffset: 1 } : undefined} onClick={() => onPick(d)}>
              <span className="w-16 shrink-0">
                <span className="block font-semibold">{weekdayName(d)}</span>
                <span className="m-num text-xs m-muted">{fmtDate(d)}</span>
              </span>
              <span className="min-w-0 flex-1 space-y-0.5">
                {list.length === 0 ? (
                  <span className="text-xs m-muted">—</span>
                ) : (
                  list.map((i) => (
                    <span key={i.id} className="block truncate text-sm">
                      <span className="m-num text-xs m-muted">{timeText(i) || t.planner.noTime}</span> {i.title}
                    </span>
                  ))
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
