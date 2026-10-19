"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import { useMyKhatma, type MyKhatma } from "@/components/mahdi/khatma/useMyKhatma";
import { dailyQuarters, khatmaStats, QUARTERS, quartersText } from "@/lib/mahdi/khatma/mine";
import { portionSummary, portionTitle } from "@/lib/mahdi/khatma/portions";

const PACES = [
  { days: 7, note: "في أسبوع" },
  { days: 10, note: "في ١٠ أيام" },
  { days: 15, note: "في نص شهر" },
  { days: 30, note: "في شهر" },
  { days: 60, note: "في شهرين" },
  { days: 120, note: "في ٤ شهور" },
];
const dayText = (d: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const GREEN = "#22c55e";

/** «الختمة العلوية» · «ختمتي»: my own khatma — where I am, today's portion, the whole map, and the habit it fills. */
export default function MyKhatmaPage() {
  const k = useMyKhatma();
  const { data, error } = k;
  if (error && !data) return <p className="m-card p-5 text-center">{error}</p>;
  if (!data) return <p className="m-muted">{t.common.loading}</p>;
  if (!data.ready) return <p className="m-note">{t.khatma.tablesNotReady}</p>;
  const cur = data.current;
  return (
    <div className="space-y-6">
      {cur?.status === "open" ? <Open k={k} /> : <Start k={k} last={cur ?? null} />}
      <History items={[...(cur && cur.status !== "open" ? [cur] : []), ...(data.history ?? [])]} />
    </div>
  );
}

type K = ReturnType<typeof useMyKhatma>;

function Start({ k, last }: { k: K; last: MyKhatma | null }) {
  const [days, setDays] = useState(last?.days ?? 30);
  const [custom, setCustom] = useState(false);
  const [to, setTo] = useState(last?.dedicatedTo ?? "");
  const [soul, setSoul] = useState(last?.forSoulOf ?? "");
  const per = dailyQuarters(days);
  return (
    <section className="space-y-4">
      {last?.status === "done" && (
        <div className="m-card space-y-1 p-5 text-center">
          <p className="text-2xl">🤍</p>
          <p className="text-lg font-semibold">تمّت ختمتك رقم {last.number} بحمد الله</p>
          {last.finishedOn && <p className="text-sm m-muted">ختمتها {dayText(last.finishedOn)}</p>}
        </div>
      )}
      <div className="m-card space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold">{last ? "ابدأ ختمة جديدة" : "ابدأ ختمتك"}</h2>
          <p className="text-sm m-muted">تقرأ القرآن كاملًا ربعًا ربعًا (٢٤٠ ربع حزب) وتتابع وين وصلت، وكل ربع تقرؤه ينضاف لعادتك في «لأجل المهدي».</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="m-label">متى تبي تختم؟</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
            {PACES.map((p) => (
              <button key={p.days} type="button" role="radio" aria-checked={!custom && days === p.days} className="m-option min-h-14 px-2 text-sm" onClick={() => (setCustom(false), setDays(p.days))}>
                <span className="block font-semibold">{p.note}</span>
                <span className="block text-xs m-muted">{quartersText(dailyQuarters(p.days))} باليوم</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
            عدد أيام آخر
            {custom && <input type="number" min={1} max={365} className="m-field m-num w-24" value={days} onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} aria-label="عدد الأيام" />}
          </label>
          <p className="m-num text-sm">وردك اليومي: <strong>{quartersText(per)}</strong> ({per} من ٢٤٠ ربع)</p>
        </fieldset>
        <label className="block">
          <span className="m-label">{t.khatma.dedicatedTo} (اختياري)</span>
          <input className="m-field" maxLength={120} value={to} onChange={(e) => setTo(e.target.value)} placeholder={t.khatma.dedicatedToPlaceholder} />
        </label>
        <label className="block">
          <span className="m-label">{t.khatma.forSoulOf} (اختياري)</span>
          <input className="m-field" maxLength={120} value={soul} onChange={(e) => setSoul(e.target.value)} placeholder={t.khatma.forSoulOfPlaceholder} />
        </label>
        <button type="button" className="m-btn m-btn-primary w-full" disabled={k.busy} onClick={() => void k.post({ action: "start", days, dedicatedTo: to, forSoulOf: soul }, "بسم الله، بدأت ختمتك.")}>
          📖 ابدأ الختمة
        </button>
      </div>
    </section>
  );
}

function Open({ k }: { k: K }) {
  const cur = k.data!.current!;
  const today = k.data!.today;
  const s = useMemo(() => khatmaStats(cur.reads, cur.startedOn, cur.days, today), [cur, today]);
  const readSet = useMemo(() => new Set(cur.reads.map((r) => r.quarter)), [cur.reads]);
  const [stop, setStop] = useState(false);
  const pct = Math.round((s.read / QUARTERS) * 100);
  const next = s.next ? portionSummary("quarter", s.next) : null;
  return (
    <>
      <section className="m-card space-y-3 p-5">
        <div className="flex items-center gap-4">
          <Ring pct={pct} />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-semibold">الختمة رقم {cur.number}</p>
            <p className="m-num text-sm m-muted">قرأت {s.read} من ٢٤٠ ربع{s.read >= 8 ? ` (${Math.floor(s.read / 8)} من ٣٠ جزء)` : ""}</p>
            <p className="m-num text-sm m-muted">بدأتها {dayText(cur.startedOn)} · تختم {dayText(s.finishBy)}</p>
          </div>
        </div>
        {(cur.dedicatedTo || cur.forSoulOf) && (
          <p className="text-center text-sm">
            {cur.dedicatedTo && <span className="block"><span className="m-muted">{t.khatma.dedicatedTo}:</span> <strong>{cur.dedicatedTo}</strong></span>}
            {cur.forSoulOf && <span className="block"><span className="m-muted">{t.khatma.forSoulOf}:</span> <strong>{cur.forSoulOf}</strong></span>}
          </p>
        )}
      </section>

      <section className="m-card space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">ورد اليوم</h2>
          <span className="m-num text-sm">{s.todayCount} / {s.perDay} ربع</span>
        </div>
        <span className="block h-2.5 overflow-hidden rounded-full" style={{ background: "var(--m-track)" }}>
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (s.todayCount / s.perDay) * 100)}%`, background: GREEN }} />
        </span>
        <p className="text-sm m-muted">
          {s.todayLeft === 0 ? "✅ خلّصت وردك اليوم. تقبّل الله." : `باقي لك اليوم ${quartersText(s.todayLeft)}.`}
          {s.behind > 0 ? ` متأخر عن خطتك ${quartersText(s.behind)}.` : s.ahead > 0 ? ` متقدّم على خطتك ${quartersText(s.ahead)} 🌟` : ""}
          {s.streak > 1 ? ` · ${s.streak} أيام ورا بعض 🔥` : ""}
        </p>
        {next && s.next && (
          <Link href={`/mahdi/khatma/read/${s.next}`} className="m-btn m-btn-primary w-full">
            📖 كمّل القراءة: {portionTitle("quarter", s.next)}
          </Link>
        )}
        {next && <p className="m-num text-center text-xs m-muted">يبدأ بـ «{next.opening}» · {next.range}</p>}
      </section>

      <HabitLink k={k} />

      <section className="space-y-2" aria-labelledby="map">
        <h2 id="map" className="text-lg font-semibold">خريطة الختمة</h2>
        <p className="text-sm m-muted">كل مربع ربع حزب؛ الأخضر قرأته. اضغط على أي ربع تفتحه.</p>
        <ol className="grid gap-1.5">
          {Array.from({ length: 30 }, (_, j) => {
            const qs = Array.from({ length: 8 }, (_, i) => j * 8 + i + 1);
            const done = qs.filter((q) => readSet.has(q)).length;
            return (
              <li key={j} className="flex items-center gap-2">
                <span className="m-num w-16 shrink-0 text-xs font-semibold">الجزء {j + 1}</span>
                <span className="grid flex-1 grid-cols-8 gap-1">
                  {qs.map((q) => (
                    <Link
                      key={q}
                      href={`/mahdi/khatma/read/${q}`}
                      aria-label={`${portionTitle("quarter", q)}${readSet.has(q) ? " · قرأته" : ""}`}
                      title={portionTitle("quarter", q)}
                      className="block h-7 rounded-md border"
                      style={{
                        background: readSet.has(q) ? GREEN : "var(--m-surface-2)",
                        borderColor: q === s.next ? "var(--m-gold)" : readSet.has(q) ? GREEN : "var(--m-line)",
                        borderWidth: q === s.next ? 2 : 1,
                      }}
                    />
                  ))}
                </span>
                <span className="m-num w-8 shrink-0 text-end text-[11px] m-muted">{done}/8</span>
              </li>
            );
          })}
        </ol>
      </section>

      <Settings k={k} onStop={() => setStop(true)} />
      <ConfirmSheet
        open={stop}
        onClose={() => setStop(false)}
        title="تنهي هذه الختمة قبل ما تكملها؟"
        body="تنحفظ في سجلك بما قرأت منها، وتقدر تبدأ ختمة جديدة."
        confirmLabel="أنهِ الختمة"
        onConfirm={async () => void (await k.post({ action: "stop" }, "انتهت الختمة."))}
      />
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-20 shrink-0 place-items-center" role="img" aria-label={`${pct}٪ من الختمة`}>
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--m-track)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={GREEN} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className="m-num relative text-lg font-bold">{pct}%</span>
    </span>
  );
}

/** The habit the khatma fills: one made for it («ورد الختمة العلوية»), or one of mine. */
function HabitLink({ k }: { k: K }) {
  const cur = k.data!.current!;
  const habits = k.state.snap.habits.filter((h) => {
    const v = h.versions.at(-1);
    return v && v.state !== "archived";
  });
  const projects = k.state.snap.projects.filter((p) => !p.archivedAt);
  const [pick, setPick] = useState("");
  const [project, setProject] = useState("");
  const [making, setMaking] = useState(false);
  if (k.habit) {
    return (
      <section className="m-card flex flex-wrap items-center gap-3 p-4">
        <span className="text-2xl" aria-hidden>{k.habit.icon || "✅"}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">مربوطة بعادة «{k.habit.name}»</span>
          <span className="block text-sm m-muted">كل ربع تقرؤه هنا يضيف ١ على العادة في يومه (والعادة اللي تنحسب «تم/لا» تصير تمّت).</span>
        </span>
        <button type="button" className="m-btn m-btn-quiet m-btn-sm" disabled={k.busy} onClick={() => void k.post({ action: "link", habitId: null }, "انفكّ الربط.")}>فك الربط</button>
      </section>
    );
  }
  return (
    <section className="m-card space-y-3 p-4">
      <div>
        <h2 className="font-semibold">🔗 اربطها بعاداتك</h2>
        <p className="text-sm m-muted">كل ربع تقرؤه ينسجل في العادة وحده، فتشوف وردك مع عاداتك اليومية وتقييمك.</p>
      </div>
      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--m-line)" }}>
        <p className="text-sm font-semibold">عادة جديدة «ورد الختمة العلوية» 📖</p>
        <p className="m-num text-xs m-muted">يوميًا، هدفها {dailyQuarters(cur.days)} ربع ({quartersText(dailyQuarters(cur.days))}).</p>
        <select className="m-field" value={project} onChange={(e) => setProject(e.target.value)} aria-label="المشروع">
          <option value="">في مشروع جديد «الختمة العلوية»</option>
          {projects.map((p) => <option key={p.id} value={p.id}>في مشروع «{p.name}»</option>)}
        </select>
        <button
          type="button"
          className="m-btn m-btn-primary w-full"
          disabled={k.busy || making}
          onClick={async () => {
            setMaking(true);
            try {
              await k.store.mutate("/api/mahdi/khatma/mine", "POST", { action: "habit_new", ...(project ? { projectId: project } : {}) });
              k.refresh();
            } catch (e) {
              k.toast((e as Error).message);
            }
            setMaking(false);
          }}
        >
          <Icon name="plus" size={18} /> أنشئ العادة واربطها
        </button>
      </div>
      {habits.length > 0 && (
        <div className="flex gap-2">
          <select className="m-field flex-1" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="عادة من عاداتي">
            <option value="">أو اختر عادة من عاداتك…</option>
            {habits.map((h) => <option key={h.id} value={h.id}>{h.icon} {h.name}</option>)}
          </select>
          <button type="button" className="m-btn m-btn-ghost" disabled={!pick || k.busy} onClick={() => void k.post({ action: "link", habitId: pick }, "انربطت ✓")}>اربط</button>
        </div>
      )}
    </section>
  );
}

function Settings({ k, onStop }: { k: K; onStop: () => void }) {
  const cur = k.data!.current!;
  const [days, setDays] = useState(cur.days);
  const [to, setTo] = useState(cur.dedicatedTo);
  const [soul, setSoul] = useState(cur.forSoulOf);
  return (
    <details className="m-card p-4">
      <summary className="cursor-pointer font-semibold">إعدادات ختمتي</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void k.post({ action: "update", days, dedicatedTo: to, forSoulOf: soul }, "انحفظ ✓");
        }}
      >
        <label className="block">
          <span className="m-label">أختمها في (أيام من يوم بدأت)</span>
          <input type="number" min={1} max={365} className="m-field m-num" value={days} onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
          <span className="m-num mt-1 block text-xs m-muted">وردك اليومي يصير {quartersText(dailyQuarters(days))} ({dailyQuarters(days)} ربع)</span>
        </label>
        <label className="block">
          <span className="m-label">{t.khatma.dedicatedTo}</span>
          <input className="m-field" maxLength={120} value={to} onChange={(e) => setTo(e.target.value)} placeholder={t.khatma.dedicatedToPlaceholder} />
        </label>
        <label className="block">
          <span className="m-label">{t.khatma.forSoulOf}</span>
          <input className="m-field" maxLength={120} value={soul} onChange={(e) => setSoul(e.target.value)} placeholder={t.khatma.forSoulOfPlaceholder} />
        </label>
        <button className="m-btn m-btn-ghost w-full" disabled={k.busy}>{t.common.save}</button>
        <button type="button" className="m-btn m-btn-danger w-full" onClick={onStop}>أنهِ هذه الختمة</button>
      </form>
    </details>
  );
}

function History({ items }: { items: MyKhatma[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">ختماتي</h2>
      <ul className="m-card divide-y text-sm" style={{ borderColor: "var(--m-line)" }}>
        {items.map((h) => (
          <li key={h.id} className="m-num flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="font-semibold">الختمة رقم {h.number}</span>
            <span className="m-muted">· {h.status === "done" ? `✅ ختمتها ${h.finishedOn ? dayText(h.finishedOn) : ""}` : h.status === "stopped" ? "انتهت قبل ما تكتمل" : "مفتوحة"}</span>
            <span className="m-muted">· بدأتها {dayText(h.startedOn)}</span>
            {(h.dedicatedTo || h.forSoulOf) && <span className="w-full m-muted">{[h.dedicatedTo && `${t.khatma.dedicatedTo}: ${h.dedicatedTo}`, h.forSoulOf && `${t.khatma.forSoulOf}: ${h.forSoulOf}`].filter(Boolean).join(" · ")}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
