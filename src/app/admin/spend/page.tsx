import Link from "next/link";
import Riyal from "@/components/Riyal";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteSpend } from "@/lib/spend";
import { TOUR_ASK } from "@config/jawad/tour";
import LiveRefresh from "../LiveRefresh";

export const metadata = { title: "أين تُصرف الفلوس · لوحة التحكم" };
export const dynamic = "force-dynamic";

const RANGES = [
  { id: "all", label: "من البداية", days: null },
  { id: "30", label: "آخر ٣٠ يوم", days: 30 },
  { id: "7", label: "آخر ٧ أيام", days: 7 },
  { id: "1", label: "اليوم", days: 1 },
] as const;

/** The whole site: which branch people spend the most on (smallest first), and what they told جواد they like. */
export default async function SpendPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const range = RANGES.find((x) => x.id === r) ?? RANGES[0];
  const [rows, interests] = await Promise.all([
    siteSpend(range.days),
    createAdminClient().from("jawad_settings").select("value").like("key", "interests:%").limit(20_000).then((x) => (x.data ?? []).map((d) => d.value as { answers?: Record<string, string[]>; words?: string })),
  ]);
  const total = rows.reduce((s, x) => s + x.halalas, 0);
  const counts = TOUR_ASK.questions.map((q) => ({
    q,
    list: q.options.map((o) => ({ o, n: interests.filter((i) => i.answers?.[q.id]?.includes(o)).length })).sort((a, b) => b.n - a.n),
  }));
  const words = interests.map((i) => i.words).filter(Boolean).slice(0, 60);
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="display text-3xl">💸 أين تُصرف الفلوس</h1>
        <p className="font-bold text-muted">صرف الناس في كل فرع من فروع الموقع (بعد المرتجعات)، من الأقل إلى الأكثر.</p>
        <LiveRefresh seconds={30} />
      </header>
      <nav className="flex flex-wrap gap-2">
        {RANGES.map((x) => (
          <Link key={x.id} href={`/admin/spend?r=${x.id}`} className={`chip ${x.id === range.id ? "bg-gold text-on-gold" : ""}`}>
            {x.label}
          </Link>
        ))}
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-start text-muted">
              <th className="p-3 text-start">#</th>
              <th className="p-3 text-start">الفرع</th>
              <th className="p-3 text-start">المصروف</th>
              <th className="p-3 text-start">النسبة</th>
              <th className="p-3 text-start">العمليات</th>
              <th className="p-3 text-start">الأشخاص</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.branch} className="border-t border-line">
                <td className="p-3 font-bold text-muted">{i + 1}</td>
                <td className="p-3 font-bold">{x.branch}</td>
                <td className="p-3"><Riyal halalas={x.halalas} size={13} /></td>
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-2"><span className="block h-full bg-gold" style={{ width: `${total ? (x.halalas / total) * 100 : 0}%` }} /></span>
                    {total ? ((x.halalas / total) * 100).toFixed(1) : 0}٪
                  </span>
                </td>
                <td className="p-3">{x.times.toLocaleString("en")}</td>
                <td className="p-3">{(x.people ?? 0).toLocaleString("en")}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="p-5 text-center text-muted">ما فيه صرف في هذي الفترة.</td>
              </tr>
            )}
          </tbody>
          {!!rows.length && (
            <tfoot>
              <tr className="border-t border-line font-bold">
                <td className="p-3" colSpan={2}>المجموع</td>
                <td className="p-3" colSpan={4}><Riyal halalas={total} size={14} /></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <section className="space-y-3">
        <h2 className="display text-2xl">✨ ما يحبه الناس (من أسئلة جواد في الجولة) · {interests.length} شخص</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {counts.map(({ q, list }) => (
            <div key={q.id} className="card p-4">
              <p className="mb-2 font-bold">{q.q}</p>
              <ul className="space-y-1 text-sm">
                {list.map(({ o, n }) => (
                  <li key={o} className="flex justify-between gap-2">
                    <span>{o}</span>
                    <b>{n}</b>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {!!words.length && (
          <div className="card p-4">
            <p className="mb-2 font-bold">كلماتهم</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {words.map((w, i) => (
                <li key={i} className="chip" dir="auto">{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
