import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadAdminStats, riyadhDay } from "@/lib/admin-stats";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { STYLES, type StyleKey } from "@config/styles";
import { QUALITY_TIERS, type QualityKey } from "@config/pricing";
import { isAdmin } from "@config/site";
import AdminTools from "./AdminTools";

export const metadata = { title: "كتيب نهج علي · لوحة التحكم" };
// Always fresh numbers
export const dynamic = "force-dynamic";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }) : "—";
const pct = (n: number) => `${Math.round(n * 100)}٪`;
const LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(STYLES).map(([k, s]) => [k, s.label])),
  ...Object.fromEntries(Object.entries(QUALITY_TIERS).map(([k, q]) => [k, q.label])),
  boy: "ولد",
  girl: "بنت",
};

export default async function AdminPage() {
  const user = await requireUser("/admin/booklet");
  if (!isAdmin(user.email)) notFound();
  const s = await loadAdminStats();
  const k = s.kpis;

  const tiles: [string, string, string?][] = [
    ["سجّلوا في الموقع", String(k.signups)],
    ["جرّبوا (سوّوا طلب)", String(k.triedUsers), k.signups ? `${pct(k.triedUsers / k.signups)} من المسجّلين` : undefined],
    ["الطلبات", String(k.orders)],
    ["كتيبات جاهزة", String(k.ready), `${pct(k.completion)} من الطلبات`],
    ["متوسط التقييم", k.avgRating ? `${k.avgRating.toFixed(1)} ⭐` : "—", `${k.feedbackCount} تقييم`],
    ["تكلفة التوليد", `$${k.costUsd.toFixed(2)}`, k.costPerBooklet ? `$${k.costPerBooklet.toFixed(2)} للكتيب` : undefined],
  ];
  const funnelMax = Math.max(1, ...s.funnel.map((f) => f.value));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="display text-4xl">📖 كتيب نهج علي</h1>
        <p className="font-bold text-muted">أرقام الكتيب الحية: التسجيل، الطلبات، الجاهز، التقييمات والتكلفة.</p>
      </header>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 gap-3">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card p-4">
            <p className="text-sm font-bold text-muted">{label}</p>
            <p className="display text-3xl">{value}</p>
            {sub && <p className="text-xs font-bold text-muted">{sub}</p>}
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">كم شخص دخل الموقع</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          {(
            [
              ["اليوم", s.logins.today],
              ["أمس", s.logins.yesterday],
              ["٧ أيام", s.logins.week],
              ["٣٠ يوم", s.logins.month],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="rounded-xl bg-surface-2 p-2">
              <p className="display text-2xl">{v}</p>
              <p className="text-xs font-bold text-muted">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-bold text-muted">يُحسب حسب آخر تسجيل دخول لكل شخص (بتوقيت الرياض).</p>
      </section>


      <AdminTools emails={s.users.map((u) => u.email).filter(Boolean)} />

      {/* Funnel: one hue, one series, labelled bars */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">قمع التحويل (عدد الأشخاص)</h2>
        {s.funnel.map((f, i) => (
          <div key={f.label} title={`${f.label}: ${f.value}`} className="space-y-1">
            <div className="flex justify-between text-sm font-bold">
              <span>{f.label}</span>
              <span>
                {f.value}
                {i > 0 && s.funnel[i - 1].value ? <span className="text-muted"> · {pct(f.value / s.funnel[i - 1].value)}</span> : null}
              </span>
            </div>
            <div className="h-3 rounded bg-surface-2">
              <div className="h-3 rounded bg-teal" style={{ width: `${(f.value / funnelMax) * 100}%` }} />
            </div>
          </div>
        ))}
      </section>

      {/* Daily activity: two separate charts (no dual axis) */}
      {(
        [
          ["طلبات آخر ١٤ يوم", s.dailyOrders],
          ["تسجيلات جديدة آخر ١٤ يوم", s.dailySignups],
        ] as const
      ).map(([title, series]) => {
        const max = Math.max(1, ...series.map((d) => d.value));
        return (
          <section key={title} className="card space-y-3 p-4">
            <h2 className="text-xl font-extrabold">{title}</h2>
            <div className="flex h-36 items-end gap-1" dir="ltr">
              {series.map((d) => (
                <div key={d.day} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.value}`}>
                  <span className="text-[10px] font-bold text-muted opacity-0 group-hover:opacity-100">{d.value}</span>
                  <div className="w-full rounded-t bg-gold" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 4 : 1 }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs font-bold text-muted" dir="ltr">
              <span>{series[0].day.slice(5)}</span>
              <span>اليوم</span>
            </div>
          </section>
        );
      })}

      {/* Breakdowns */}
      <section className="grid gap-3">
        {(
          [
            ["الستايلات", s.styles],
            ["ولد / بنت", s.genders],
            ["الجودة", s.qualities],
            ["حالة الطلبات", s.statuses],
          ] as const
        ).map(([title, rows]) => {
          const max = Math.max(1, ...rows.map((r) => r[1]));
          return (
            <div key={title} className="card space-y-2 p-4">
              <h2 className="text-lg font-extrabold">{title}</h2>
              {rows.length === 0 && <p className="text-sm font-bold text-muted">ما فيه بيانات بعد</p>}
              {rows.map(([key, value]) => {
                const label = title === "حالة الطلبات" ? STATUS_LABELS[key as OrderStatus] : (LABELS[key as StyleKey | QualityKey] ?? key);
                return (
                  <div key={key} className="flex items-center gap-3 text-sm font-bold" title={`${label}: ${value}`}>
                    <span className="w-28 shrink-0 truncate">{label}</span>
                    <div className="h-2.5 flex-1 rounded bg-surface-2">
                      <div className="h-2.5 rounded bg-teal" style={{ width: `${(value / max) * 100}%` }} />
                    </div>
                    <span className="w-8 text-end">{value}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      {/* Feedback */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">آراء المستخدمين ({s.feedback.length})</h2>
        {s.feedback.length === 0 && <p className="font-bold text-muted">ما وصل أي رأي للحين.</p>}
        <ul className="space-y-3">
          {s.feedback.map((f) => (
            <li key={f.id} className="rounded-2xl bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
                <span>{"⭐".repeat(f.rating)}</span>
                <span className="text-muted" dir="ltr">{f.email}</span>
              </div>
              {f.message && <p className="mt-1 font-bold">{f.message}</p>}
              <p className="mt-1 text-xs font-bold text-muted">{fmtDate(f.createdAt)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Users */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">المستخدمين ({s.users.length})</h2>
          <a href="/admin/export" className="btn btn-ghost min-h-10 px-4 text-sm">⬇️ تصدير CSV</a>
        </div>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-muted">
              <tr className="text-start">
                <th className="py-2 text-start">الإيميل</th>
                <th className="text-start">الاسم</th>
                <th className="text-start">سجّل</th>
                <th className="text-start">آخر طلب</th>
                <th>طلبات</th>
                <th>جاهزة</th>
              </tr>
            </thead>
            <tbody className="font-bold">
              {s.users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="py-2" dir="ltr">{u.email}</td>
                  <td>{u.name || "—"}</td>
                  <td className="whitespace-nowrap">{riyadhDay(u.createdAt)}</td>
                  <td className="whitespace-nowrap">{u.lastOrderAt ? riyadhDay(u.lastOrderAt) : "—"}</td>
                  <td className="text-center">{u.orders}</td>
                  <td className="text-center">{u.ready}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent orders */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">آخر الطلبات</h2>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 text-start">الطفل</th>
                <th className="text-start">الستايل</th>
                <th className="text-start">الحالة</th>
                <th className="text-start">الإيميل</th>
                <th className="text-start">الوقت</th>
              </tr>
            </thead>
            <tbody className="font-bold">
              {s.recentOrders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="py-2">{o.child_name ?? "—"}</td>
                  <td>{LABELS[o.style] ?? o.style}</td>
                  <td>{STATUS_LABELS[o.status]}</td>
                  <td dir="ltr">{o.email}</td>
                  <td className="whitespace-nowrap">{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
