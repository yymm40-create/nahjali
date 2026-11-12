import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadFeatureUse, USE_RANGES, type UseRange } from "@/lib/feature-use";
import { isAdmin } from "@config/site";

export const metadata = { title: "استخدام المزايا | لوحة التحكم" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}٪` : "—");

/** Owner only: which features of the studio and «حيدرة كت» people use, and where they stop. */
export default async function FeatureUsePage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const user = await requireUser("/admin/use");
  if (!isAdmin(user.email)) notFound();
  const asked = (await searchParams).r;
  const r = (USE_RANGES.find((x) => x.id === asked)?.id ?? "7d") as UseRange;
  const u = await loadFeatureUse(r);

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">🧭 استخدام المزايا</h1>
        <nav className="flex flex-wrap gap-2" aria-label="الترتيب والمراحل حسب">
          {USE_RANGES.map((x) => (
            <Link key={x.id} href={`/admin/use?r=${x.id}`} className={`chip ${x.id === r ? "!border-teal !bg-teal/10 font-extrabold" : ""}`} aria-current={x.id === r}>
              {x.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="text-sm text-muted">وش يستخدم الناس في الاستوديو الإبداعي وحيدرة كت، ووين يوقفون. ينعدّ الحساب المسجّل بس، ومرة وحدة لكل ضغطة (بدون أي كلام يكتبونه).</p>

      {!u.ready ? (
        <p className="error-box">عدّ المزايا يحتاج تشغيل ملف قاعدة البيانات 0110_jawad_feature_use.sql أول.</p>
      ) : (
        u.sections.map((s) => {
          const top = s.funnel[0]?.people ?? 0;
          return (
            <section key={s.id} className="card space-y-4 p-4">
              <h2 className="text-xl font-extrabold">{s.label}</h2>

              <div className="space-y-2">
                <h3 className="font-extrabold">🪜 وين يوقفون ({USE_RANGES.find((x) => x.id === r)?.label})</h3>
                <ol className="grid gap-2 sm:grid-cols-5">
                  {s.funnel.map((f, i) => (
                    <li key={f.label} className="rounded-xl border border-line p-3 text-center">
                      <p className="text-xs font-bold text-muted">{i + 1}. {f.label}</p>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums">{f.people}</p>
                      <p className="text-xs text-muted tabular-nums">{i ? `${pct(f.people, s.funnel[i - 1].people)} من اللي قبله` : "شخص"}{i ? ` · ${pct(f.people, top)} من الكل` : ""}</p>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted">كل خانة = عدد الناس اللي سوّوا هالخطوة في الفترة (ولو في يوم ثاني). الفرق بين خانة واللي بعدها = اللي وقفوا عندها.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-muted">
                      <th className="p-2 text-start">الميزة</th>
                      <th className="p-2">استخدام · ٧ أيام</th>
                      <th className="p-2">ناس · ٧ أيام</th>
                      <th className="p-2">استخدام · ٣٠ يوم</th>
                      <th className="p-2">ناس · ٣٠ يوم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((x) => (
                      <tr key={x.id} className={`border-t border-line text-center tabular-nums ${x.uses["30d"] ? "" : "text-muted"}`}>
                        <td className="p-2 text-start font-bold">{x.label}</td>
                        <td className="p-2">{x.uses["7d"] || "—"}</td>
                        <td className="p-2">{x.people["7d"] || "—"}</td>
                        <td className="p-2">{x.uses["30d"] || "—"}</td>
                        <td className="p-2">{x.people["30d"] || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
