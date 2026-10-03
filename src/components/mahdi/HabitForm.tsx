"use client";

import { useState } from "react";
import { MAHDI_LIMITS, UNIT_CHOICES } from "@config/mahdi";
import type { Freq, Measure } from "@/lib/mahdi/engine";
import { orderedWeekdays, t } from "@/lib/mahdi/i18n";
import { bySort, currentVersion, parseNumberInput } from "@/lib/mahdi/client/derive";
import type { Habit } from "@/lib/mahdi/types";
import Icon from "./Icon";
import IconPicker from "./IconPicker";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

/** Create or edit a habit. The basics come first; category, start date, reminder and notes are under "more". */
export default function HabitForm({
  open,
  onClose,
  habit,
  projectId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  habit?: Habit;
  projectId?: string;
  onSaved?: (id: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={habit ? t.habit.editTitle : t.habit.newTitle} wide>
      {open && <Form habit={habit} projectId={projectId} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

const MEASURES: Measure[] = ["check", "count", "amount"];
const FREQS: Freq[] = ["daily", "days", "weekly", "monthly"];

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="m-icon-btn m-btn-ghost" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${t.habit.minusOne}: ${label}`}>
        <Icon name="minus" />
      </button>
      <input
        className="m-field m-num w-20 text-center text-lg"
        inputMode="numeric"
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = parseNumberInput(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
      />
      <button type="button" className="m-icon-btn m-btn-ghost" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${t.habit.plusOne}: ${label}`}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

function Form({ habit, projectId, onClose, onSaved }: { habit?: Habit; projectId?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const { store, state, toast } = useMahdi();
  const { today } = state;
  const weekStart = state.snap.profile.weekStart;
  const projects = state.snap.projects.filter((p) => !p.archivedAt).sort(bySort);
  const cur = habit ? currentVersion(habit, today) : null;
  const notStarted = Boolean(habit && habit.versions.length === 1 && habit.versions[0].effectiveFrom > today);

  const [name, setName] = useState(habit?.name ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "");
  const [project, setProject] = useState(habit?.projectId ?? projectId ?? projects[0]?.id ?? "");
  const [measure, setMeasure] = useState<Measure>(cur?.measure ?? "check");
  const [freq, setFreq] = useState<Freq>(cur?.freq ?? "daily");
  const [days, setDays] = useState<number[]>(cur?.days.length ? cur.days : []);
  const [count, setCount] = useState(cur && cur.measure !== "amount" ? cur.target : 3);
  const [checkDays, setCheckDays] = useState(cur && cur.measure === "check" && cur.freq !== "daily" && cur.freq !== "days" ? cur.target : 3);
  const [amount, setAmount] = useState(cur?.measure === "amount" ? String(cur.target) : "");
  const [unit, setUnit] = useState(cur?.measure === "amount" ? cur.unit : UNIT_CHOICES[0]);
  const [customUnit, setCustomUnit] = useState(cur?.measure === "amount" && !UNIT_CHOICES.includes(cur.unit) ? cur.unit : "");
  const [more, setMore] = useState(false);
  const [category, setCategory] = useState(habit?.category ?? "");
  const [startDate, setStartDate] = useState(habit?.versions[0]?.effectiveFrom ?? today);
  const [reminder, setReminder] = useState(habit?.reminderTime ?? "");
  const [notes, setNotes] = useState(habit?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const periodic = freq === "weekly" || freq === "monthly";
  const finalUnit = (customUnit || unit).trim();

  function config() {
    if (measure === "check") return { measure, freq, days, target: periodic ? checkDays : 1, unit: "" };
    if (measure === "count") return { measure, freq, days, target: count, unit: "" };
    return { measure, freq, days, target: parseNumberInput(amount), unit: finalUnit };
  }
  const cfg = config();
  const valid =
    name.trim().length > 0 &&
    Boolean(project) &&
    (freq !== "days" || days.length > 0) &&
    (measure !== "amount" || (cfg.target > 0 && finalUnit.length > 0));
  const configChanged =
    habit && cur && (cfg.measure !== cur.measure || cfg.freq !== cur.freq || cfg.target !== cur.target || cfg.unit !== cur.unit || cfg.days.join() !== cur.days.join());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError(freq === "days" && !days.length ? t.habit.pickDays : measure === "amount" && !finalUnit ? t.habit.unitRequired : t.errors.invalid);
      return;
    }
    setBusy(true);
    setError("");
    const details = { name: name.trim(), icon, category, notes, reminderTime: reminder || null };
    try {
      if (habit) {
        await store.mutate(`/api/mahdi/habits/${habit.id}`, "PATCH", {
          ...details,
          ...(project !== habit.projectId ? { projectId: project } : {}),
          ...(configChanged ? { config: cfg } : {}),
        });
        toast(t.common.saved);
        onSaved?.(habit.id);
      } else {
        const res = await store.mutate<{ id: string }>("/api/mahdi/habits", "POST", { ...details, ...cfg, projectId: project, startDate });
        toast(t.common.saved);
        onSaved?.(res.id);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block">
        <span className="m-label">{t.habit.name}</span>
        <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAHDI_LIMITS.habitNameMax} placeholder={t.habit.namePlaceholder} required autoFocus={!habit} />
      </label>

      <IconPicker value={icon} onChange={setIcon} label={t.habit.icon} />

      {projects.length > 1 && (
        <label className="block">
          <span className="m-label">{t.habit.project}</span>
          <select className="m-field" value={project} onChange={(e) => setProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon ? `${p.icon} ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset>
        <legend className="m-label">{t.habit.measureTitle}</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t.habit.measureTitle}>
          {MEASURES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={measure === m} className="m-option p-3 text-start" onClick={() => setMeasure(m)}>
              <span className="block font-semibold">{t.habit.measures[m].label}</span>
              <span className="m-hint block">{t.habit.measures[m].hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="m-label">{t.habit.freqTitle}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t.habit.freqTitle}>
          {FREQS.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={freq === f} className="m-option min-h-12 px-3 font-semibold" onClick={() => setFreq(f)}>
              {t.habit.freqs[f]}
            </button>
          ))}
        </div>
        {freq === "days" && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.habit.freqs.days}>
            {orderedWeekdays(weekStart).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                className="m-option min-h-11 px-3 text-sm font-semibold"
                onClick={() => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))}
              >
                {t.weekdays[d]}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="m-label">{t.habit.target}</legend>
        {measure === "check" && !periodic && <p className="m-hint">{freq === "daily" ? t.habit.checkDailyHint : t.habit.checkDaysHint}</p>}
        {measure === "check" && periodic && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{t.habit.daysPerPeriod(freq as "weekly" | "monthly")}</span>
            <Stepper value={checkDays} onChange={setCheckDays} min={1} max={freq === "weekly" ? 7 : 31} label={t.habit.daysPerPeriod(freq as "weekly" | "monthly")} />
          </div>
        )}
        {measure === "count" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{periodic ? t.habit.timesPerPeriod(freq as "weekly" | "monthly") : t.habit.timesPerDay}</span>
            <Stepper value={count} onChange={setCount} min={1} max={MAHDI_LIMITS.maxCountTarget} label={periodic ? t.habit.timesPerPeriod(freq as "weekly" | "monthly") : t.habit.timesPerDay} />
          </div>
        )}
        {measure === "amount" && (
          <div className="space-y-3">
            <label className="block max-w-48">
              <span className="m-label text-sm">{periodic ? t.habit.amountPerPeriod(freq as "weekly" | "monthly") : t.habit.amountPerDay}</span>
              <input className="m-field m-num text-lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20" />
            </label>
            <div>
              <span className="m-label text-sm">{t.habit.unit}</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.habit.unit}>
                {UNIT_CHOICES.map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={!customUnit && unit === u}
                    className="m-option min-h-10 px-3 text-sm font-semibold"
                    onClick={() => {
                      setUnit(u);
                      setCustomUnit("");
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <label className="mt-2 block max-w-56">
                <span className="sr-only">{t.habit.customUnit}</span>
                <input className="m-field text-sm" value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} maxLength={MAHDI_LIMITS.unitMax} placeholder={`${t.habit.customUnit}: ${t.habit.customUnitPlaceholder}`} />
              </label>
            </div>
          </div>
        )}
        {configChanged && <p className="m-note text-sm">{notStarted ? t.habit.futureStartNote : t.habit.changeNote}</p>}
      </fieldset>

      <div>
        <button type="button" className="m-btn m-btn-quiet -ms-3" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          <Icon name={more ? "chevronUp" : "chevronDown"} size={18} /> {t.habit.more}
        </button>
        {more && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="m-label">
                {t.habit.category} <span className="m-muted font-normal">({t.common.optional})</span>
              </span>
              <input className="m-field" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={MAHDI_LIMITS.categoryMax} placeholder={t.habit.categoryPlaceholder} />
            </label>
            {!habit && (
              <label className="block">
                <span className="m-label">{t.habit.startDate}</span>
                <input type="date" className="m-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </label>
            )}
            <label className="block">
              <span className="m-label">
                {t.habit.reminder} <span className="m-muted font-normal">({t.common.optional})</span>
              </span>
              <input type="time" className="m-field" value={reminder} onChange={(e) => setReminder(e.target.value)} />
              <span className="m-hint mt-1 block">{t.habit.reminderHint}</span>
            </label>
            <label className="block sm:col-span-2">
              <span className="m-label">
                {t.habit.notes} <span className="m-muted font-normal">({t.common.optional})</span>
              </span>
              <textarea className="m-field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={MAHDI_LIMITS.notesMax} />
            </label>
          </div>
        )}
      </div>

      {error && <p className="m-error" role="alert">{error}</p>}
      <button className="m-btn m-btn-primary w-full" disabled={busy || !valid}>
        {busy ? t.common.saving : habit ? t.habit.save : t.habit.create}
      </button>
    </form>
  );
}
