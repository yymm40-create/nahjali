"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";
import { useMahdi } from "./Provider";

/** Set by the welcome flow for a new account; cleared once the person has picked (or skipped) their look. */
export const NEWCOMER = "mahdi-newcomer";

const F = t.firstSteps;

/**
 * A new account's first two minutes, on the home: the first «تم» with one tap (the habit made in the welcome flow),
 * then — only after it — the invitation to pick the shrine and the look, which the welcome flow no longer asks.
 */
export default function FirstSteps() {
  const { state, store, toast } = useMahdi();
  const [newcomer, setNewcomer] = useState(false);
  useEffect(() => {
    let on = false;
    try {
      on = localStorage.getItem(NEWCOMER) === "1";
    } catch {}
    const id = setTimeout(() => setNewcomer(on), 0);
    return () => clearTimeout(id);
  }, []);
  if (!newcomer) return null;

  const done = () => {
    try {
      localStorage.removeItem(NEWCOMER);
    } catch {}
    setNewcomer(false);
  };
  const ticked = Object.values(state.logs).some((days) => Object.values(days).some((v) => v > 0));
  const habit = state.snap.habits.find((h) => !h.projectId.startsWith("gp:"));

  if (!ticked && habit) {
    const target = habit.versions.at(-1)?.target ?? 1;
    return (
      <section className="m-card m-first space-y-3 p-5" aria-labelledby="first-title">
        <p className="m-eyebrow">{F.eyebrow}</p>
        <h2 id="first-title" className="text-xl font-semibold">{F.tickTitle}</h2>
        <p className="m-muted text-sm">{F.tickHint}</p>
        <button
          type="button"
          className="m-btn m-btn-primary w-full text-lg"
          onClick={() => {
            const prev = store.setLog(habit.id, state.today, target);
            toast(t.habit.logged(habit.name), { label: t.habit.undo, run: () => store.setLog(habit.id, state.today, prev) }, habit.id);
          }}
        >
          <Icon name="check" size={22} /> {F.tickButton(habit.name)}
        </button>
      </section>
    );
  }
  if (!ticked) return null;
  return (
    <section className="m-card space-y-3 p-5" aria-labelledby="first-look">
      <h2 id="first-look" className="text-xl font-semibold">{F.wellDone}</h2>
      <p className="m-muted text-sm">{F.lookHint}</p>
      <div className="flex gap-2">
        <Link href="/mahdi/more#look" className="m-btn m-btn-primary flex-1" onClick={done}>
          {F.lookButton}
        </Link>
        <button type="button" className="m-btn m-btn-quiet" onClick={done}>
          {F.later}
        </button>
      </div>
    </section>
  );
}
