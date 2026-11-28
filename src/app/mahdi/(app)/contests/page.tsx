"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { addDays, type ISODate } from "@/lib/mahdi/engine";
import type { ContestPhase } from "@/lib/mahdi/contests";
import Icon from "@/components/mahdi/Icon";
import { useMahdi } from "@/components/mahdi/Provider";
import PageHead from "@/components/mahdi/social/PageHead";
import { Empty, ErrorState, Skeleton } from "@/components/mahdi/social/States";

interface Card {
  id: string;
  title: string;
  prize: string;
  startsOn: ISODate;
  endsOn: ISODate;
  threshold: number;
  phase: ContestPhase;
  participants: number;
  unread: boolean;
}
interface Lists {
  owned: Card[];
  joined: Card[];
}

const PHASE: Record<ContestPhase, string> = { upcoming: "تبدأ قريب", live: "شغّالة الحين", over: "خلصت" };
const day = (d: ISODate) => new Date(`${d}T12:00:00Z`).toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function ContestRow({ c }: { c: Card }) {
  return (
    <Link href={`/mahdi/contests/${c.id}`} className="m-card flex items-center gap-3 p-4">
      <Icon name="trophy" size={24} className="m-gold shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {c.title} {c.unread && <span className="m-chip m-chip-gold ms-1 text-xs">رسالة جديدة</span>}
        </p>
        <p className="m-muted text-sm m-num">
          {PHASE[c.phase]} · من {day(c.startsOn)} إلى {day(c.endsOn)} · {c.participants} مشارك
        </p>
        {c.prize && <p className="text-sm">الجائزة: {c.prize}</p>}
      </div>
    </Link>
  );
}

/** The organiser's form: a contest on keeping worship habits, its days, the bar and the prize. */
function NewContest({ today, onDone }: { today: ISODate; onDone: (id: string) => void }) {
  const { toast } = useMahdi();
  const [title, setTitle] = useState("مسابقة الثبات على العبادات");
  const [startsOn, setStartsOn] = useState(addDays(today, 1));
  const [days, setDays] = useState(14);
  const [threshold, setThreshold] = useState(95);
  const [minHabits, setMinHabits] = useState(3);
  const [prize, setPrize] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const r = await mahdiFetch<{ id: string }>("/api/mahdi/contests", { method: "POST", json: { title, startsOn, days, threshold, minHabits, prize, details } });
      onDone(r.id);
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <section className="m-card space-y-4 p-5" aria-labelledby="new-contest">
      <h2 id="new-contest" className="font-semibold">مسابقة جديدة</h2>
      <label className="block space-y-1">
        <span className="m-label">اسم المسابقة</span>
        <input className="m-field" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="m-label">تبدأ يوم</span>
          <input type="date" className="m-field m-num" value={startsOn} min={today} onChange={(e) => setStartsOn(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="m-label">المدة</span>
          <select className="m-field" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 21, 28, 42, 56].map((d) => (
              <option key={d} value={d}>{d === 7 ? "أسبوع" : d === 14 ? "أسبوعين" : `${d / 7} أسابيع`}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="m-label">النسبة المطلوبة للفوز</span>
          <select className="m-field m-num" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
            {[100, 95, 90, 85, 80, 75, 70].map((n) => (
              <option key={n} value={n}>{n}٪ أو أكثر</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="m-label">أقل عدد عادات للمشارك</span>
          <select className="m-field m-num" value={minHabits} onChange={(e) => setMinHabits(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="m-label">الجائزة</span>
        <input className="m-field" value={prize} maxLength={200} placeholder="مثال: قسيمة شراء بقيمة ٥٠ ريال لكل من يوصل النسبة" onChange={(e) => setPrize(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="m-label">الشروط والتفاصيل (اختياري)</span>
        <textarea className="m-field min-h-28" value={details} maxLength={1500} placeholder="مثال: اختر مشاريعك العبادية (الصلاة، القرآن، الأذكار)، والسحب بعد نهاية المسابقة بين اللي وصلوا ٩٥٪." onChange={(e) => setDetails(e.target.value)} />
      </label>
      <p className="m-muted text-sm">
        كل مشارك يختار مشاريعه العبادية من حسابه، والتطبيق يحسب نسبته على يومه هو. أنت تشوف عاداته ونسبتها كل أسبوع، وتسحب الفايزين بعد ما تخلص، وتراسلهم داخل التطبيق.
      </p>
      <button type="button" className="m-btn m-btn-primary" disabled={busy || !title.trim()} onClick={create}>
        أنشئ المسابقة
      </button>
    </section>
  );
}

/** A contest's private code, from its organiser: opens the contest to join it. */
function CodeEntry() {
  const router = useRouter();
  const { toast } = useMahdi();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await mahdiFetch<{ id: string; code: string }>(`/api/mahdi/contests?code=${encodeURIComponent(code)}`);
      router.push(`/mahdi/contests/${r.id}?c=${r.code}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="m-card space-y-2 p-4" aria-labelledby="code-entry">
      <p id="code-entry" className="font-semibold">عندي كود</p>
      <div className="flex gap-2">
        <input
          className="m-field m-num flex-1 text-center tracking-[0.2em]"
          dir="ltr"
          value={code}
          maxLength={12}
          placeholder="ABCD2345"
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && code.trim().length >= 8 && go()}
          aria-label="كود المسابقة"
        />
        <button type="button" className="m-btn m-btn-primary" disabled={busy || code.replace(/[\s-]/g, "").length < 8} onClick={go}>
          ادخل
        </button>
      </div>
    </section>
  );
}

/** «مسابقة الثبات»: the contests I run or joined, and a new one (others are reached by their link only). */
export default function ContestsPage() {
  const { state } = useMahdi();
  const router = useRouter();
  const [data, setData] = useState<Lists | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    () =>
      mahdiFetch<Lists>("/api/mahdi/contests")
        .then((d) => {
          setData(d);
          setError("");
        })
        .catch((e) => setError((e as Error).message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <PageHead title="مسابقة الثبات" sub="تنافس على الثبات في عباداتك أسبوع أو أكثر، والجوائز بالسحب بين اللي يوصلون النسبة.">
        {!creating && (
          <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} /> مسابقة جديدة
          </button>
        )}
      </PageHead>
      <CodeEntry />
      {creating && <NewContest today={state.today} onDone={(id) => router.push(`/mahdi/contests/${id}`)} />}
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <Skeleton kind="cards" count={2} />
      ) : (
        <>
          {data.joined.length > 0 && (
            <section className="space-y-2">
              <h2 className="m-eyebrow">مسابقات دخلتها</h2>
              {data.joined.map((c) => <ContestRow key={c.id} c={c} />)}
            </section>
          )}
          {data.owned.length > 0 && (
            <section className="space-y-2">
              <h2 className="m-eyebrow">مسابقات تنظّمها</h2>
              {data.owned.map((c) => <ContestRow key={c.id} c={c} />)}
            </section>
          )}
          {!data.joined.length && !data.owned.length && !creating && (
            <Empty icon="trophy" title="ما في مسابقات للحين" body="لو عندك رابط مسابقة افتحه أو اكتب كودها فوق، أو أنشئ مسابقة لأهلك وجماعتك.">
              <button type="button" className="m-btn m-btn-primary" onClick={() => setCreating(true)}>أنشئ مسابقة</button>
            </Empty>
          )}
        </>
      )}
    </div>
  );
}
