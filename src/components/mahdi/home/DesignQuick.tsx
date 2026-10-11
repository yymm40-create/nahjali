"use client";

// «لأجل المهدي» — today's habits to tap, laid out the design's way: tiles, a clean list, Streaks' big round buttons,
// battery cells for the week, one card at a time to swipe, the day's timeline, or quests with experience points.
// Always ONE tap to complete (useHabitTap); an amount opens the number pad.

import Link from "next/link";
import { useState } from "react";
import type { QuickStyle } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import Icon from "../Icon";
import LogSheet from "../LogSheet";
import { useHabitTap, useDay, XP_PER, type DayHabit } from "./useDay";

const WEEKDAYS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];

/** One habit with its tap, drawn by `children` (gets done / tap / label); the number pad comes with it. */
function Tap({ h, date, children }: { h: DayHabit; date: string; children: (x: ReturnType<typeof useHabitTap>) => React.ReactNode }) {
  const x = useHabitTap(h.habit, h.inst, date);
  if (!x.v) return null;
  return (
    <>
      {children(x)}
      <LogSheet open={x.open} onClose={() => x.setOpen(false)} habit={h.habit} version={x.v} inst={h.inst} date={date} commit={x.commit} dayValue={x.dayValue} />
    </>
  );
}

const amount = (h: DayHabit) => (h.inst.target > 1 ? `${h.inst.value}/${h.inst.target}` : "");

export default function DesignQuick({ style }: { style: QuickStyle }) {
  const d = useDay();
  const left = d.habits.filter((h) => h.inst.progress < 1).length;
  if (!d.habits.length) {
    return (
      <section className="m-card m-widget space-y-3">
        <p className="m-widget-title">اضغط وأنجز</p>
        <Link href="/mahdi/projects" className="m-btn m-btn-ghost w-full">
          <Icon name="plus" /> {t.home.emptyHabits}
        </Link>
      </section>
    );
  }
  const head = (
    <div className="flex items-center justify-between gap-2">
      <p className="m-widget-title">
        <Icon name="check" size={18} className="m-gold" /> اضغط وأنجز
      </p>
      <span className="m-chip m-num">{left ? `باقي ${left}` : "كملت كلها 🎉"}</span>
    </div>
  );
  const sorted = [...d.habits].sort((a, b) => Number(a.inst.progress >= 1) - Number(b.inst.progress >= 1));

  switch (style) {
    case "tiles":
      return (
        <section className="m-card m-widget space-y-3">
          {head}
          <div className="m-quick">
            {sorted.map((h) => (
              <Tap key={h.inst.key} h={h} date={d.today}>
                {(x) => (
                  <button type="button" className={`m-quick-btn p-${h.project?.color ?? "gold"}`} data-done={x.done} aria-pressed={x.v?.measure === "check" ? x.done : undefined} aria-label={x.label} onClick={x.tap} onContextMenu={(e) => { e.preventDefault(); x.setOpen(true); }}>
                    <span className="m-quick-ic" aria-hidden="true">{x.done ? "✓" : h.habit.icon || "•"}</span>
                    <span className="line-clamp-2">{h.habit.name}</span>
                    {amount(h) && <span className="m-num text-xs opacity-80">{amount(h)}</span>}
                    {!x.done && h.inst.progress > 0 && <span className="m-quick-fill" style={{ transform: `scaleX(${h.inst.progress})` }} aria-hidden="true" />}
                  </button>
                )}
              </Tap>
            ))}
          </div>
        </section>
      );
    case "list":
      return (
        <section className="m-card m-widget space-y-1">
          {head}
          <ul className="m-qlist">
            {d.habits.map((h) => (
              <Tap key={h.inst.key} h={h} date={d.today}>
                {(x) => (
                  <li>
                    <button type="button" className={`m-qrow p-${h.project?.color ?? "gold"}`} data-done={x.done} aria-pressed={x.v?.measure === "check" ? x.done : undefined} aria-label={x.label} onClick={x.tap}>
                      <span className="m-qbox" aria-hidden="true">{x.done ? "✓" : ""}</span>
                      <span className="min-w-0 flex-1 truncate text-start">{h.habit.icon && <span aria-hidden="true">{h.habit.icon} </span>}{h.habit.name}</span>
                      {amount(h) && <span className="m-num text-xs m-muted">{amount(h)}</span>}
                    </button>
                  </li>
                )}
              </Tap>
            ))}
          </ul>
        </section>
      );
    case "circles":
      return (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {d.habits.map((h) => (
              <Tap key={h.inst.key} h={h} date={d.today}>
                {(x) => (
                  <button type="button" className="m-circle" data-done={x.done} aria-pressed={x.v?.measure === "check" ? x.done : undefined} aria-label={x.label} onClick={x.tap} onContextMenu={(e) => { e.preventDefault(); x.setOpen(true); }}>
                    <span className="m-circle-ring" style={{ "--p": `${Math.min(1, h.inst.progress) * 360}deg` } as React.CSSProperties}>
                      <span className="m-circle-face" aria-hidden="true">{x.done ? "✓" : h.habit.icon || "•"}</span>
                    </span>
                    <b className="text-sm">{h.habit.name}</b>
                    {amount(h) && <span className="m-num text-xs opacity-80">{amount(h)}</span>}
                  </button>
                )}
              </Tap>
            ))}
          </div>
        </section>
      );
    case "cells":
      return (
        <section className="space-y-2">
          {d.habits.map((h) => (
            <Tap key={h.inst.key} h={h} date={d.today}>
              {(x) => (
                <button type="button" className="m-card m-cells w-full p-3 text-start" data-done={x.done} aria-pressed={x.v?.measure === "check" ? x.done : undefined} aria-label={x.label} onClick={x.tap}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{h.habit.icon}</span>
                    <b className="min-w-0 flex-1 truncate text-sm">{h.habit.name}</b>
                    <small className="m-num m-muted">{x.done ? "تم اليوم ✓" : amount(h) || "اضغط"}</small>
                  </span>
                  <span className="mt-2 flex gap-1" aria-hidden="true">
                    {h.week.map((on, k) => (
                      <span key={k} className="flex flex-1 flex-col items-center gap-0.5">
                        <span className="h-2.5 w-full rounded-[3px]" style={{ background: (k === 6 ? x.done : on) ? (k === 6 ? "var(--m-gold-2)" : "var(--m-gold)") : "var(--m-track)" }} />
                        <small className="text-[9px] m-muted">{WEEKDAYS[k]}</small>
                      </span>
                    ))}
                  </span>
                </button>
              )}
            </Tap>
          ))}
        </section>
      );
    case "swipe":
      return <SwipeStack habits={sorted} date={d.today} />;
    case "timeline": {
      const byTime = [...d.habits].sort((a, b) => (a.habit.reminderTime ?? "99").localeCompare(b.habit.reminderTime ?? "99"));
      return (
        <section className="space-y-0">
          {byTime.map((h) => (
            <Tap key={h.inst.key} h={h} date={d.today}>
              {(x) => (
                <div className="flex items-stretch gap-2.5">
                  <small className="m-num w-11 shrink-0 pt-3 m-muted">{h.habit.reminderTime ?? "—"}</small>
                  <span className={`w-1 rounded-full p-${h.project?.color ?? "gold"}`} style={{ background: "var(--pc)", opacity: x.done ? 1 : 0.35 }} />
                  <button type="button" className={`m-tl my-1 flex flex-1 items-center gap-2 p-${h.project?.color ?? "gold"}`} data-done={x.done} aria-pressed={x.v?.measure === "check" ? x.done : undefined} aria-label={x.label} onClick={x.tap}>
                    <b className="min-w-0 flex-1 truncate text-start">{h.habit.icon && <span aria-hidden="true">{h.habit.icon} </span>}{h.habit.name}</b>
                    <span className="m-num text-sm">{x.done ? "✓" : amount(h)}</span>
                  </button>
                </div>
              )}
            </Tap>
          ))}
        </section>
      );
    }
    case "xp":
      return (
        <section className="space-y-2">
          <p className="flex text-sm m-muted">
            <b className="flex-1" style={{ color: "var(--m-ink)" }}>مهام اليوم</b>+{XP_PER} خبرة لكل عادة
          </p>
          {d.habits.map((h) => (
            <Tap key={h.inst.key} h={h} date={d.today}>
              {(x) => (
                <button type="button" className="m-xp flex w-full items-center gap-2 p-2.5" data-done={x.done} aria-pressed={x.v?.measure === "check" ? x.done : undefined} aria-label={x.label} onClick={x.tap}>
                  <span className="m-xp-box" aria-hidden="true">{x.done ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1 truncate text-start">{h.habit.icon} {h.habit.name}</span>
                  <small className="m-num" style={{ color: "var(--m-gold)" }}>+{XP_PER}</small>
                </button>
              )}
            </Tap>
          ))}
        </section>
      );
    default:
      return null;
  }
}

/** «البطاقة اللي تسحبها»: one habit at a time — ✓ completes it, ⏭ leaves it for later; the next card comes up. */
function SwipeStack({ habits, date }: { habits: DayHabit[]; date: string }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const queue = habits.filter((h) => h.inst.progress < 1 && !skipped.includes(h.inst.key));
  const doneN = habits.filter((h) => h.inst.progress >= 1).length;
  const h = queue[0];
  return (
    <section className="space-y-3" aria-label="عاداتك اليوم واحدة واحدة">
      <p className="m-num flex text-sm">
        <b className="flex-1">عاداتك اليوم</b>
        {doneN} من {habits.length}
      </p>
      <div className="flex gap-1">
        {habits.map((x) => (
          <span key={x.inst.key} className="h-1.5 flex-1 rounded-full" style={{ background: x.inst.progress >= 1 ? "var(--m-gold)" : "var(--m-track)" }} />
        ))}
      </div>
      {h ? (
        <Tap key={h.inst.key} h={h} date={date}>
          {(x) => (
            <div className="space-y-4">
              <div className="relative h-72">
                <span className="absolute inset-x-5 top-5 bottom-0 rounded-[28px]" style={{ background: "var(--m-track)", rotate: "-4deg" }} />
                <span className="absolute inset-x-2.5 top-2.5 bottom-0 rounded-[28px]" style={{ background: "var(--m-surface-2)", rotate: "3deg" }} />
                <div className="m-swipe-card absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[28px] p-5 text-center text-white">
                  <span className="text-6xl" aria-hidden="true">{h.habit.icon || "⭐"}</span>
                  <b className="text-2xl">{h.habit.name}</b>
                  {amount(h) && <span className="m-num opacity-90">{amount(h)}</span>}
                </div>
              </div>
              <div className="flex items-center justify-center gap-7">
                <button type="button" className="m-swipe-btn" onClick={() => setSkipped([...skipped, h.inst.key])} aria-label={`بعدين: ${h.habit.name}`}>
                  ⏭️
                </button>
                <button type="button" className="m-swipe-btn m-swipe-ok" onClick={x.tap} aria-label={x.label}>
                  ✓
                </button>
              </div>
            </div>
          )}
        </Tap>
      ) : (
        <div className="m-card space-y-2 p-6 text-center">
          <p className="text-4xl" aria-hidden="true">{doneN === habits.length ? "🎉" : "⏭️"}</p>
          <b>{doneN === habits.length ? "كملت عادات اليوم كلها" : "خلّصت البطاقات"}</b>
          {skipped.length > 0 && (
            <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setSkipped([])}>
              رجّع اللي أجّلتها ({skipped.length})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
