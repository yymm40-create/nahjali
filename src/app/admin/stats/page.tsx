import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadStats, RANGES, type Range } from "@/lib/stats";
import Riyal from "@/components/Riyal";
import { isAdmin } from "@config/site";
import { PAGE_NAMES } from "@config/stats";

export const metadata = { title: "الإحصائيات | لوحة التحكم" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const when = (iso: string) => new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" });
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}٪` : "—");
const wa = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "966")}`;

function Num({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-bold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Owner only: who came, what they made, and who started buying and did not finish. */
export default async function StatsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const user = await requireUser("/admin/stats");
  if (!isAdmin(user.email)) notFound();
  const asked = (await searchParams).r;
  const r = (RANGES.find((x) => x.id === asked)?.id ?? "today") as Range;
  const s = await loadStats(r);

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">📊 الإحصائيات</h1>
        <nav className="flex flex-wrap gap-2" aria-label="الفترة">
          {RANGES.map((x) => (
            <Link key={x.id} href={`/admin/stats?r=${x.id}`} className={`chip ${x.id === r ? "!border-teal !bg-teal/10 font-extrabold" : ""}`} aria-current={x.id === r}>
              {x.label}
            </Link>
          ))}
        </nav>
      </div>

      {!s.visitsReady && <p className="error-box">عدّ الزوار يحتاج تشغيل ملف قاعدة البيانات 0051_site_visits.sql أول. باقي الأرقام تحت شغّالة.</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Num label="👀 الزوار" value={s.visitors} hint={`${s.views} فتحة صفحة · ${s.signedVisitors} منهم مسجّلين`} />
        <Num label="🆕 حسابات جديدة" value={s.newUsers.length} />
        <Num label="✨ ناس ولّدوا" value={s.makers} hint={`${s.gens.ok} توليد ناجح · ${s.gens.failed} فشل`} />
        <Num label="💰 انصرف من الرصيد على التوليد" value={<Riyal halalas={s.gens.coins} size={22} />} />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🛒 الشراء: مين دخل، مين بدأ، مين كمّل</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-start text-muted">
                <th className="p-2 text-start">الصفحة</th>
                <th className="p-2">دخلوا الصفحة</th>
                <th className="p-2">ضغطوا «ادفع» (بدأوا)</th>
                <th className="p-2">ضغطوا «تم التحويل»</th>
                <th className="p-2">أكّدت أنت</th>
                <th className="p-2">المبلغ المؤكّد</th>
              </tr>
            </thead>
            <tbody>
              {s.funnels.map((f) => (
                <tr key={f.label} className="border-t border-line text-center tabular-nums">
                  <td className="p-2 text-start font-extrabold">{f.label}</td>
                  <td className="p-2">{s.visitsReady ? f.visitors : "—"}</td>
                  <td className="p-2">{f.started} <span className="text-xs text-muted">{s.visitsReady ? pct(f.started, f.visitors) : ""}</span></td>
                  <td className="p-2">{f.transferred} <span className="text-xs text-muted">{pct(f.transferred, f.started)}</span></td>
                  <td className="p-2">{f.confirmed}</td>
                  <td className="p-2"><Riyal halalas={f.sar * 100} size={14} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">«دخلوا الصفحة» تنعدّ من بعد تشغيل 0051. الفرق بين «دخلوا» و«بدأوا» = اللي شافوا الصفحة وطلعوا؛ الفرق بين «بدأوا» و«تم التحويل» = اللي وصلوا لبيانات التحويل وما كمّلوا (أسماؤهم تحت).</p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">⏳ بدأوا الشراء وما كمّلوا ({s.unfinished.length})</h2>
        {!s.unfinished.length ? (
          <p className="text-sm text-muted">ما فيه أحد في هالفترة.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {s.unfinished.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>{o.name || "بدون اسم"}</b> · {o.what} · <Riyal halalas={o.sar * 100} size={13} />
                  <span className="block text-xs text-muted" dir="ltr" style={{ textAlign: "right" }}>{o.email} · {when(o.at)}</span>
                </span>
                {o.phone && (
                  <a className="chip" href={wa(o.phone)} target="_blank" rel="noopener" dir="ltr">💬 {o.phone}</a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🎨 وش استخدموا (حسب القسم)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-muted">
                <th className="p-2 text-start">القسم</th>
                <th className="p-2">ناجح</th>
                <th className="p-2">فشل</th>
                <th className="p-2">عدد الناس</th>
                <th className="p-2">انصرف</th>
              </tr>
            </thead>
            <tbody>
              {s.bySection.map((x) => (
                <tr key={x.name} className="border-t border-line text-center tabular-nums">
                  <td className="p-2 text-start font-bold">{x.name}</td>
                  <td className="p-2">{x.ok}</td>
                  <td className="p-2">{x.failed}</td>
                  <td className="p-2">{x.people}</td>
                  <td className="p-2"><Riyal halalas={x.coins} size={13} /></td>
                </tr>
              ))}
              {!s.bySection.length && (
                <tr>
                  <td className="p-2 text-muted" colSpan={5}>ما فيه توليد في هالفترة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-bold">حسب المولد ({s.byGenerator.length})</summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {s.byGenerator.map((g) => (
              <li key={g.name} className="flex justify-between gap-2 py-1.5 tabular-nums">
                <span dir="auto">{g.name} <span className="text-xs text-muted">· {g.section}</span></span>
                <span>{g.ok} ✓ · {g.failed} ✗ · <Riyal halalas={g.coins} size={12} /></span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-2 p-4">
          <h2 className="text-xl font-extrabold">📄 الصفحات اللي انفتحت</h2>
          {!s.pages.length ? (
            <p className="text-sm text-muted">{s.visitsReady ? "ما فيه زيارات في هالفترة." : "تحتاج 0051."}</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {s.pages.slice(0, 30).map((p) => (
                <li key={p.path} className="flex justify-between gap-2 py-1.5 tabular-nums">
                  <span>{PAGE_NAMES[p.path] ?? <span dir="ltr">{p.path}</span>}</span>
                  <span>{p.visitors} زائر · {p.views} فتحة</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card space-y-2 p-4">
          <h2 className="text-xl font-extrabold">🆕 آخر الحسابات الجديدة</h2>
          {!s.newUsers.length ? (
            <p className="text-sm text-muted">ما فيه حسابات جديدة في هالفترة.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {s.newUsers.slice(0, 50).map((u) => (
                <li key={u.email + u.at} className="flex justify-between gap-2 py-1.5">
                  <span dir="ltr">{u.email}</span>
                  <span className="text-xs text-muted">{when(u.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
