"use client";

// «القارئ العلوي» → العادات: a book's own habit. Every book added becomes a habit «قراءة «الكتاب»» (pages a day) unless
// the person says no; each saved session adds its pages to the habit's day, so reaching the book's daily target
// completes the habit. Here: today's pages against the target, the target changed, the habit removed — or made.

import Link from "next/link";
import { useState } from "react";
import { fmtNum, t } from "@/lib/mahdi/i18n";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { parseNumberInput } from "@/lib/mahdi/client/derive";
import type { LibraryEntry, ReadingData } from "@/lib/mahdi/types";
import ConfirmSheet from "./ConfirmSheet";
import Icon from "./Icon";
import { useMahdi } from "./Provider";
import { useReading } from "./useReading";

const H = t.reading.bookHabit;

export default function BookHabitCard({ entry, onFresh }: { entry: LibraryEntry; onFresh: (r: ReadingData) => void }) {
  const { store, toast, state } = useMahdi();
  const { sessionsOf, today } = useReading();
  const { book } = entry;
  const unit = book.unit === "narration" ? H.narrations : H.pages;
  const habit = entry.habitId ? state.snap.habits.find((h) => h.id === entry.habitId) : null;
  const target = entry.dailyTarget ?? 10;
  const read = sessionsOf(book.id).filter((s) => s.date === today && !s.earlier).reduce((n, s) => n + s.pages, 0);
  const [value, setValue] = useState(String(target));
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(action: "habit" | "habit_target" | "habit_off", n?: number) {
    setBusy(true);
    try {
      const r = await mahdiFetch<{ reading: ReadingData }>("/api/mahdi/reading/library", { method: "POST", json: { bookId: book.id, action, target: n } });
      onFresh(r.reading);
      await store.refresh(true); // the habits list on the home
      toast(action === "habit" ? H.made : action === "habit_off" ? H.removed : H.saved);
      setEditing(false);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }
  const number = () => {
    const n = Math.round(parseNumberInput(value));
    return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null;
  };

  if (!entry.habitId) {
    return (
      <section className="m-card space-y-3 p-5" aria-label={H.title}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon name="target" size={18} className="m-gold" /> {H.makeTitle}
        </h2>
        <p className="text-sm m-muted">{H.makeHint}</p>
        <div className="flex items-center gap-2">
          <input className="m-field m-num w-24 text-center" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} aria-label={H.perDay(unit)} />
          <span className="text-sm">{H.perDay(unit)}</span>
        </div>
        <button type="button" className="m-btn m-btn-primary w-full" disabled={busy || !number()} onClick={() => void act("habit", number()!)}>
          {H.make}
        </button>
      </section>
    );
  }

  const share = Math.min(1, read / Math.max(1, target));
  return (
    <section className="m-card space-y-3 p-5" aria-label={H.title}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon name="target" size={18} className="m-gold" /> {H.title}
        </h2>
        {read >= target && <span className="m-chip m-chip-success">{H.doneToday}</span>}
      </div>
      <p className="text-sm">
        {habit ? (
          <Link href={`/mahdi/habits/${habit.id}`} className="font-semibold m-gold">
            {habit.name}
          </Link>
        ) : (
          <span className="font-semibold">{H.title}</span>
        )}{" "}
        <span className="m-muted">{H.linked}</span>
      </p>
      <div className="space-y-1">
        <p className="m-num text-sm font-semibold">{H.today(fmtNum(read), fmtNum(target), unit)}</p>
        <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--m-surface-2)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: "var(--m-gold)" }} />
        </div>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input className="m-field m-num w-24 text-center" inputMode="numeric" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label={H.perDay(unit)} />
          <span className="flex-1 text-sm">{H.perDay(unit)}</span>
          <button type="button" className="m-btn m-btn-primary m-btn-sm" disabled={busy || !number()} onClick={() => void act("habit_target", number()!)}>
            {t.common.save}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => (setValue(String(target)), setEditing(true))}>
            <Icon name="edit" size={16} /> {H.change}
          </button>
          <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setRemoving(true)}>
            {H.remove}
          </button>
        </div>
      )}
      <ConfirmSheet open={removing} onClose={() => setRemoving(false)} title={H.removeTitle} body={H.removeBody} confirmLabel={H.remove} onConfirm={() => act("habit_off")} />
    </section>
  );
}
