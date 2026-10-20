"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import ConfirmSheet from "@/components/mahdi/ConfirmSheet";
import Icon from "@/components/mahdi/Icon";
import PartPicker, { partText, type Part } from "@/components/mahdi/khatma/PartPicker";
import { useMyKhatma, type MyKhatma } from "@/components/mahdi/khatma/useMyKhatma";
import FreeReading from "@/components/mahdi/khatma/FreeReading";
import { TimeHabitLink, useReaderState } from "@/components/mahdi/khatma/ReaderClock";
import { useReadOrder } from "@/components/mahdi/khatma/useReadOrder";
import { dailyCount, isCarried, khatmaStats, unitText } from "@/lib/mahdi/khatma/mine";
import { minutesText, portionsBefore, unreadOf, wholeMinutes } from "@/lib/mahdi/khatma/reader";
import { DIVISION_LABEL, fullRange, isFull, portionQuarters, portionSummary, portionTitle, rangeSize, type Division, type PortionRange } from "@/lib/mahdi/khatma/portions";

const PACES = [
  { days: 1, note: "اليوم" },
  { days: 7, note: "في أسبوع" },
  { days: 10, note: "في ١٠ أيام" },
  { days: 15, note: "في نص شهر" },
  { days: 30, note: "في شهر" },
  { days: 60, note: "في شهرين" },
];
const dayText = (d: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const GREEN = "#22c55e";
/** What is sent for a stretch: nothing for the whole Quran. */
const rangeBody = (p: Part) => (isFull(p.unit, p.range) ? { unit: p.unit, rangeFrom: null, rangeTo: null } : { unit: p.unit, rangeFrom: p.range.from, rangeTo: p.range.to });

/**
 * «الختمة العلوية» · «ختمتي»: my own khatma — the whole Quran or a stretch of it, in pages, juz, hizb, half or quarter
 * hizb — its settings on top, where I am, today's portion, the map, and the habit it fills.
 */
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
      <FreeReading compact />
      <ReadingTime />
      <History items={[...(cur && cur.status !== "open" ? [cur] : []), ...(data.history ?? [])]} />
    </div>
  );
}

type K = ReturnType<typeof useMyKhatma>;

/** The pace: finish in N days, with today's portion shown for each choice. */
function Pace({ days, setDays, total, unit }: { days: number; setDays: (d: number) => void; total: number; unit: Division }) {
  const [custom, setCustom] = useState(!PACES.some((p) => p.days === days));
  return (
    <fieldset className="space-y-2">
      <legend className="m-label">متى تبي تخلّصه؟</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
        {PACES.map((p) => (
          <button key={p.days} type="button" role="radio" aria-checked={!custom && days === p.days} className="m-option min-h-14 px-2 text-sm" onClick={() => (setCustom(false), setDays(p.days))}>
            <span className="block font-semibold">{p.note}</span>
            <span className="m-num block text-xs m-muted">{unitText(unit, dailyCount(total, p.days))} باليوم</span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
        عدد أيام آخر
        {custom && <input type="number" min={1} max={365} className="m-field m-num w-24" value={days} onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} aria-label="عدد الأيام" />}
      </label>
      <p className="m-num text-sm">وردك اليومي: <strong>{unitText(unit, dailyCount(total, days))}</strong></p>
    </fieldset>
  );
}

function Dedication({ to, setTo, soul, setSoul, optional }: { to: string; setTo: (v: string) => void; soul: string; setSoul: (v: string) => void; optional?: boolean }) {
  return (
    <>
      <label className="block">
        <span className="m-label">{t.khatma.dedicatedTo}{optional ? " (اختياري)" : ""}</span>
        <input className="m-field" maxLength={120} value={to} onChange={(e) => setTo(e.target.value)} placeholder={t.khatma.dedicatedToPlaceholder} />
      </label>
      <label className="block">
        <span className="m-label">{t.khatma.forSoulOf}{optional ? " (اختياري)" : ""}</span>
        <input className="m-field" maxLength={120} value={soul} onChange={(e) => setSoul(e.target.value)} placeholder={t.khatma.forSoulOfPlaceholder} />
      </label>
    </>
  );
}

function Start({ k, last }: { k: K; last: MyKhatma | null }) {
  const [part, setPart] = useState<Part>({ unit: last?.unit ?? "quarter", range: last?.unit ? fullRange(last.unit) : fullRange("quarter") });
  const [days, setDays] = useState(last?.days ?? 30);
  const [to, setTo] = useState(last?.dedicatedTo ?? "");
  const [soul, setSoul] = useState(last?.forSoulOf ?? "");
  const [reached, setReached] = useState(0);
  // a different stretch or cut starts from its beginning
  const pickPart = (p: Part) => (setPart(p), setReached(0));
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
          <p className="text-sm m-muted">القرآن كاملًا أو جزء معيّن منه، بالصفحات أو الأجزاء أو الأحزاب أو أنصافها أو أرباعها. تتابع وين وصلت، وكل نصيب تقرؤه ينضاف لعادتك في «لأجل المهدي».</p>
        </div>
        <PartPicker value={part} onChange={pickPart} />
        <ReachedPicker unit={part.unit} range={part.range} value={reached} onChange={setReached} />
        <Pace days={days} setDays={setDays} total={rangeSize(part.range) - Math.max(0, reached - part.range.from)} unit={part.unit} />
        <Dedication to={to} setTo={setTo} soul={soul} setSoul={setSoul} optional />
        <button
          type="button"
          className="m-btn m-btn-primary w-full"
          disabled={k.busy}
          onClick={async () => {
            const r = await k.post({ action: "start", ...rangeBody(part), days, dedicatedTo: to, forSoulOf: soul }, "بسم الله، بدأت ختمتك.");
            // where they had reached: everything before it counts as read
            if (r && reached > 0) await k.carry(portionsBefore(part.range, reached));
          }}
        >
          📖 ابدأ
        </button>
      </div>
    </section>
  );
}

function Open({ k }: { k: K }) {
  const cur = k.data!.current!;
  const today = k.data!.today;
  const s = useMemo(() => khatmaStats(cur.reads, cur.startedOn, cur.days, today, cur.range), [cur, today]);
  const readSet = useMemo(() => new Set(cur.reads.map((r) => r.quarter)), [cur.reads]);
  const [stop, setStop] = useState(false);
  const [order, setOrder] = useReadOrder();
  const [openAny, setOpenAny] = useState("");
  const [reached, setReached] = useState(0);
  const [edit, setEdit] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const carriedSet = useMemo(() => new Set(cur.reads.filter((r) => isCarried(r, cur.startedOn)).map((r) => r.quarter)), [cur]);
  const pickedUnread = [...picked].filter((n) => !readSet.has(n));
  const pickedRead = [...picked].filter((n) => readSet.has(n));
  const pct = Math.round((s.read / s.total) * 100);
  const next = s.next ? portionSummary(cur.unit, s.next) : null;
  const u = cur.unit;
  return (
    <>
      <Settings k={k} onStop={() => setStop(true)} />

      <section className="m-card space-y-3 p-5">
        <div className="flex items-center gap-4">
          <Ring pct={pct} />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-semibold">الختمة رقم {cur.number} · {partText({ unit: u, range: cur.range })}</p>
            <p className="m-num text-sm m-muted">قرأت {s.read} من {s.total} {DIVISION_LABEL[u].one}</p>
            <p className="m-num text-sm m-muted">بدأتها {dayText(cur.startedOn)} · تخلّصها {dayText(s.finishBy)}</p>
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
          <span className="m-num text-sm">{s.todayCount} / {s.perDay} {DIVISION_LABEL[u].one}</span>
        </div>
        <span className="block h-2.5 overflow-hidden rounded-full" style={{ background: "var(--m-track)" }}>
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (s.todayCount / s.perDay) * 100)}%`, background: GREEN }} />
        </span>
        <p className="text-sm m-muted">
          {s.todayLeft === 0 ? "✅ خلّصت وردك اليوم. تقبّل الله." : `باقي لك اليوم ${unitText(u, s.todayLeft)}.`}
          {s.behind > 0 ? ` متأخر عن خطتك ${unitText(u, s.behind)}.` : s.ahead > 0 ? ` متقدّم على خطتك ${unitText(u, s.ahead)} 🌟` : ""}
          {s.streak > 1 ? ` · ${s.streak} أيام ورا بعض 🔥` : ""}
        </p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="طريقة القراءة">
          <button type="button" role="radio" aria-checked={order === "order"} className="m-option min-h-11 px-2 text-sm font-semibold" onClick={() => setOrder("order")}>بالترتيب</button>
          <button type="button" role="radio" aria-checked={order === "free"} className="m-option min-h-11 px-2 text-sm font-semibold" onClick={() => setOrder("free")}>أقرأ من أي مكان</button>
        </div>
        {order === "free" ? (
          <div className="space-y-2">
            <p className="text-xs m-muted">مب شرط بالترتيب: اختر أي {DIVISION_LABEL[u].one} ما قرأته وافتحه، وبعد ما تخلّصه «والتالي» يكمّل لك من عنده.</p>
            <div className="flex gap-2">
              <select className="m-field flex-1" value={openAny} onChange={(e) => setOpenAny(e.target.value)} aria-label="اختر وين تقرأ">
                <option value="">اختر وين تقرأ…</option>
                {Array.from({ length: cur.range.to - cur.range.from + 1 }, (_, i) => cur.range.from + i).filter((n) => !readSet.has(n)).map((n) => (
                  <option key={n} value={n}>{portionTitle(u, n)} · {portionSummary(u, n).range}</option>
                ))}
              </select>
              <Link href={openAny ? `/mahdi/khatma/read/${openAny}` : "#"} aria-disabled={!openAny} className={`m-btn m-btn-primary ${openAny ? "" : "pointer-events-none opacity-50"}`}>افتح</Link>
            </div>
          </div>
        ) : (
          <>
            {next && s.next && (
              <Link href={`/mahdi/khatma/read/${s.next}`} className="m-btn m-btn-primary w-full">
                📖 كمّل القراءة: {portionTitle(u, s.next)}
              </Link>
            )}
            {next && <p className="m-num text-center text-xs m-muted">{next.opening ? `يبدأ بـ «${next.opening}» · ` : ""}{next.range}</p>}
          </>
        )}
      </section>

      <HabitLink k={k} />

      <section className="m-card space-y-3 p-4" aria-labelledby="reached">
        <div>
          <h2 id="reached" className="font-semibold">📍 وين وصلت؟</h2>
          <p className="text-sm m-muted">إذا كنت خلّصت جزء من القرآن قبل، حدّد وين وصلت أو اللي خلّصته، فينحسب مقروء من غير ما يدخل في ورد اليوم ولا عادتك.{s.carried > 0 ? ` (حاليًا ${s.carried} ${DIVISION_LABEL[u].one} مسجّلة خلّصتها قبل)` : ""}</p>
        </div>
        <ReachedPicker unit={u} range={cur.range} value={reached} onChange={setReached} />
        <button
          type="button"
          className="m-btn m-btn-primary w-full"
          disabled={k.busy || reached === 0 || unreadOf(portionsBefore(cur.range, reached), readSet).length === 0}
          onClick={async () => {
            await k.carry(unreadOf(portionsBefore(cur.range, reached), readSet));
            setReached(0);
          }}
        >
          خلّصت كل اللي قبله
        </button>
        <button type="button" className="m-btn m-btn-ghost w-full" aria-pressed={edit} onClick={() => (setEdit((v) => !v), setPicked(new Set()))}>
          {edit ? "إغلاق التحديد" : `✋ أو حدّد ${DIVISION_LABEL[u].many} اللي خلّصتها على الخريطة`}
        </button>
      </section>

      <KhatmaMap unit={u} range={cur.range} read={readSet} carried={carriedSet} next={s.next} edit={edit} picked={picked} onPick={(n) => setPicked((p) => { const x = new Set(p); if (x.has(n)) x.delete(n); else x.add(n); return x; })} />
      {edit && (
        <div className="m-card sticky bottom-24 z-10 space-y-2 p-3 lg:bottom-4">
          <p className="m-num text-sm">محدّد {picked.size}</p>
          <button
            type="button"
            className="m-btn m-btn-primary w-full"
            disabled={k.busy || pickedUnread.length === 0}
            onClick={async () => {
              await k.carry(pickedUnread);
              setPicked(new Set());
            }}
          >
            سجّل اللي ما قرأته منها: خلّصتها ({pickedUnread.length})
          </button>
          <button
            type="button"
            className="m-btn m-btn-ghost w-full"
            disabled={k.busy || pickedRead.length === 0}
            onClick={async () => {
              await k.unreadMany(pickedRead);
              setPicked(new Set());
            }}
          >
            أرجع المقروء منها غير مقروء ({pickedRead.length})
          </button>
        </div>
      )}

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

/** Every portion of the khatma as a square under its juz (green = read, the gold border = where to go on). */
function KhatmaMap({ unit, range, read, carried, next, edit, picked, onPick }: { unit: Division; range: PortionRange; read: Set<number>; carried: Set<number>; next: number | null; edit: boolean; picked: Set<number>; onPick: (n: number) => void }) {
  const groups = useMemo(() => {
    const byJuz = new Map<number, number[]>();
    for (let n = range.from; n <= range.to; n++) {
      const juz = unit === "juz" ? 0 : Math.ceil(portionQuarters(unit, n).fromQ / 8);
      byJuz.set(juz, [...(byJuz.get(juz) ?? []), n]);
    }
    return [...byJuz];
  }, [unit, range]);
  const labelled = unit === "juz" || unit === "page";
  return (
    <section className="space-y-2" aria-labelledby="map">
      <h2 id="map" className="text-lg font-semibold">خريطة الختمة</h2>
      <p className="text-sm m-muted">كل مربع {DIVISION_LABEL[unit].one}؛ الأخضر قرأته (الباهت اللي خلّصته قبل). {edit ? "اضغط على اللي تبي تحدّده." : "اضغط على أي واحد تفتحه."}</p>
      <ol className="grid gap-1.5">
        {groups.map(([juz, ns]) => (
          <li key={juz} className="flex items-start gap-2">
            {juz > 0 && <span className="m-num w-16 shrink-0 pt-1.5 text-xs font-semibold">الجزء {juz}</span>}
            <span className="flex flex-1 flex-wrap gap-1">
              {ns.map((n) => {
                const style = {
                  background: read.has(n) ? GREEN : "var(--m-surface-2)",
                  color: read.has(n) ? "#fff" : undefined,
                  opacity: carried.has(n) && !picked.has(n) ? 0.65 : 1,
                  borderColor: picked.has(n) ? "var(--m-ink)" : n === next ? "var(--m-gold)" : read.has(n) ? GREEN : "var(--m-line)",
                  borderWidth: picked.has(n) || n === next ? 2 : 1,
                  boxShadow: picked.has(n) ? "0 0 0 2px color-mix(in srgb, var(--m-gold) 60%, transparent)" : undefined,
                } as React.CSSProperties;
                const cls = `m-num grid h-7 place-items-center rounded-md border text-[10px] ${labelled ? "min-w-8 px-1" : "w-7"}`;
                const label = `${portionTitle(unit, n)}${read.has(n) ? (carried.has(n) ? " · خلّصتها قبل" : " · قرأته") : ""}`;
                return edit ? (
                  <button key={n} type="button" aria-pressed={picked.has(n)} aria-label={label} title={label} className={cls} style={style} onClick={() => onPick(n)}>
                    {labelled ? n : picked.has(n) ? "✓" : ""}
                  </button>
                ) : (
                  <Link key={n} href={`/mahdi/khatma/read/${n}`} aria-label={label} title={label} className={cls} style={style}>
                    {labelled ? n : ""}
                  </Link>
                );
              })}
            </span>
            <span className="m-num w-10 shrink-0 pt-1.5 text-end text-[11px] m-muted">{ns.filter((n) => read.has(n)).length}/{ns.length}</span>
          </li>
        ))}
      </ol>
    </section>
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
  const one = DIVISION_LABEL[cur.unit].one;
  const perDay = dailyCount(rangeSize(cur.range), cur.days);
  if (k.habit) {
    return (
      <section className="m-card flex flex-wrap items-center gap-3 p-4">
        <span className="text-2xl" aria-hidden>{k.habit.icon || "✅"}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">مربوطة بعادة «{k.habit.name}»</span>
          <span className="block text-sm m-muted">كل {one} تقرؤه هنا يضيف ١ على العادة في يومه (والعادة اللي تنحسب «تم/لا» تصير تمّت).</span>
        </span>
        <button type="button" className="m-btn m-btn-quiet m-btn-sm" disabled={k.busy} onClick={() => void k.post({ action: "link", habitId: null }, "انفكّ الربط.")}>فك الربط</button>
      </section>
    );
  }
  return (
    <section className="m-card space-y-3 p-4">
      <div>
        <h2 className="font-semibold">🔗 اربطها بعاداتك</h2>
        <p className="text-sm m-muted">كل {one} تقرؤه ينسجل في العادة وحده، فتشوف وردك مع عاداتك اليومية وتقييمك.</p>
      </div>
      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--m-line)" }}>
        <p className="text-sm font-semibold">عادة جديدة «ورد الختمة العلوية» 📖</p>
        <p className="m-num text-xs m-muted">يوميًا، هدفها {perDay} {DIVISION_LABEL[cur.unit].unit} ({unitText(cur.unit, perDay)}).</p>
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

/** The open khatma's settings, on top so they are easy to change: what it covers, the pace, the dedication. */
function Settings({ k, onStop }: { k: K; onStop: () => void }) {
  const cur = k.data!.current!;
  const [part, setPart] = useState<Part>({ unit: cur.unit, range: cur.range });
  const [days, setDays] = useState(cur.days);
  const [to, setTo] = useState(cur.dedicatedTo);
  const [soul, setSoul] = useState(cur.forSoulOf);
  // the way it is cut stays once something is read in it (what was read is counted in its own portions)
  const lockUnit = cur.reads.length > 0;
  return (
    <details className="m-card p-4">
      <summary className="cursor-pointer font-semibold">⚙️ إعدادات ختمتي</summary>
      <p className="mt-1 text-xs m-muted">وش تقرأ، متى تخلّصه، والإهداء.</p>
      <form
        className="mt-3 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void k.post({ action: "update", ...rangeBody(part), days, dedicatedTo: to, forSoulOf: soul }, "انحفظ ✓");
        }}
      >
        <PartPicker value={part} onChange={setPart} lockUnit={lockUnit} />
        {lockUnit && <p className="text-xs m-muted">بديت تقرأ، فالتقسيم ثابت لهذه الختمة؛ تقدر تغيّر الجزء اللي تقرؤه. لتقسيم ثاني أنهِها وابدأ ختمة جديدة.</p>}
        <Pace days={days} setDays={setDays} total={rangeSize(part.range)} unit={part.unit} />
        <Dedication to={to} setTo={setTo} soul={soul} setSoul={setSoul} />
        <button className="m-btn m-btn-primary w-full" disabled={k.busy}>{t.common.save}</button>
        <button type="button" className="m-btn m-btn-danger w-full" onClick={onStop}>أنهِ هذه الختمة</button>
      </form>
    </details>
  );
}

/** «وين وصلت؟»: where the person is in the stretch (everything before it is already finished). 0 = from the start. */
function ReachedPicker({ unit, range, value, onChange }: { unit: Division; range: PortionRange; value: number; onChange: (n: number) => void }) {
  const options = useMemo(() => Array.from({ length: range.to - range.from }, (_, i) => range.from + 1 + i), [range]);
  const label = (n: number) => {
    const s = portionSummary(unit, n);
    return `${portionTitle(unit, n)} — ${s.opening ? `«${s.opening}» · ` : ""}${s.range}`;
  };
  return (
    <label className="block space-y-1">
      <span className="m-label">📍 وين وصلت في القرآن؟</span>
      <select className="m-field" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="وين وصلت">
        <option value={0}>من البداية (ما خلّصت شي)</option>
        {options.map((n) => <option key={n} value={n}>وصلت إلى {label(n)}</option>)}
      </select>
      {value > 0 && <span className="m-hint block">كل اللي قبله يُحسب مقروء، وما ينحسب في ورد اليوم ولا في عادتك.</span>}
    </label>
  );
}

/** The time read today, and the habit it fills. */
function ReadingTime() {
  const { state, setHabit } = useReaderState();
  if (!state) return null;
  return (
    <section className="m-card space-y-2 p-4" aria-labelledby="read-time">
      <h2 id="read-time" className="font-semibold">⏱ وقت القراءة</h2>
      <p className="m-num text-sm m-muted">قرأت اليوم {minutesText(wholeMinutes(state.todaySeconds))}. العدّاد يشتغل فوق القارئ، ويحسب وقتك وأنت فاتح الصفحة.</p>
      <TimeHabitLink reader={state} onChange={(id) => void setHabit(id)} />
    </section>
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
            <span className="m-muted">· {partText({ unit: h.unit, range: h.range })}</span>
            <span className="m-muted">· {h.status === "done" ? `✅ خلّصتها ${h.finishedOn ? dayText(h.finishedOn) : ""}` : h.status === "stopped" ? "انتهت قبل ما تكتمل" : "مفتوحة"}</span>
            <span className="m-muted">· بدأتها {dayText(h.startedOn)}</span>
            {(h.dedicatedTo || h.forSoulOf) && <span className="w-full m-muted">{[h.dedicatedTo && `${t.khatma.dedicatedTo}: ${h.dedicatedTo}`, h.forSoulOf && `${t.khatma.forSoulOf}: ${h.forSoulOf}`].filter(Boolean).join(" · ")}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
