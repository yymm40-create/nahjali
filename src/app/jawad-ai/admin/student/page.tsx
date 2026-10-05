import { requireJawadOwnerPage } from "@/lib/jawad/server/access";
import { stageName, studentInsights } from "@/lib/jawad/student/insights";
import { outputName, OUTPUT_STATUS } from "@config/jawad/student";

export const dynamic = "force-dynamic";
export const metadata = { title: "إحصائيات الطالب الذكي" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "—");
const stars = (n: number | null) => (n ? "⭐".repeat(n) : "");

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="jw-panel space-y-1 p-4">
      <p className="text-xs text-jw-muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {hint && <p className="text-[11px] text-jw-faint">{hint}</p>}
    </div>
  );
}

/** The owner's view of «الطالب الذكي»: who came, how many today, where each student got to, what they made, feedback. */
export default async function StudentInsightsPage() {
  await requireJawadOwnerPage("/jawad-ai/admin/student");
  const s = await studentInsights();

  return (
    <div className="space-y-8">
      {!s.migrated && (
        <p className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm">
          سجل الزيارات والآراء غير مفعّل: شغّل ملف <span dir="ltr">supabase/migrations/0027_student_insights.sql</span> في Supabase. بقية الأرقام (المواد والنواتج) تظهر من الآن.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">اليوم (بتوقيت السعودية)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="زوار الصفحة" value={s.today.visitors} hint="بحساب أو بدون" />
          <Stat label="دخلوا بإيميلهم" value={s.today.signedIn} />
          <Stat label="مواد جديدة" value={s.today.materials} />
          <Stat label="نواتج اكتملت" value={s.today.outputsMade} />
          <Stat label="آراء وصلت" value={s.today.feedback} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">الإجمالي</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="كل الزوار" value={s.total.visitors} />
          <Stat label="أشخاص بإيميل" value={s.total.people} />
          <Stat label="مواد" value={s.total.materials} />
          <Stat label="نواتج (اكتمل منها)" value={`${s.total.outputs} (${s.total.outputsMade})`} />
          <Stat label="خطوات فشلت" value={s.total.failedJobs} />
          <Stat label="آراء" value={s.total.feedback} />
          <Stat label="متوسط التقييم" value={s.total.avgRating ?? "—"} hint="من ٥" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="jw-panel space-y-3 p-4">
          <h2 className="font-semibold">أين وصلت المواد (المرحلة الحالية لكل مادة)</h2>
          {s.stages.map((st) => {
            const max = Math.max(1, ...s.stages.map((x) => x.count));
            return (
              <div key={st.stage} className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{st.name}</span>
                  <b>{st.count}</b>
                </div>
                <div className="h-2 rounded-full bg-jw-surface-3">
                  <div className="h-full rounded-full bg-jw-accent" style={{ width: `${(st.count / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
          {Object.keys(s.stuck).length > 0 && (
            <div className="border-t border-jw-line pt-3 text-sm">
              <p className="mb-1 text-jw-muted">النواتج التي لم تكتمل، أين توقفت:</p>
              <ul className="space-y-0.5">
                {Object.entries(s.stuck)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => (
                    <li key={k} className="flex justify-between">
                      <span>{k}</span>
                      <b>{n}</b>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
        <div className="jw-panel space-y-2 p-4">
          <h2 className="font-semibold">ماذا صنعوا</h2>
          {s.kinds.length === 0 && <p className="text-sm text-jw-muted">لا نواتج بعد.</p>}
          <table className="w-full text-sm">
            <thead className="text-jw-muted">
              <tr>
                <th className="py-1 text-start">الناتج</th>
                <th>طُلب</th>
                <th>صُنع</th>
                <th>اعتُمد</th>
                <th>جارٍ</th>
                <th>ينتظر</th>
                <th>فشل</th>
                <th>GPT Image 2</th>
              </tr>
            </thead>
            <tbody>
              {s.kinds.map((k) => (
                <tr key={k.kind} className="border-t border-jw-line text-center">
                  <td className="py-1 text-start">{k.name}</td>
                  <td>{k.total}</td>
                  <td>{k.made}</td>
                  <td>{k.done}</td>
                  <td>{k.inProgress}</td>
                  <td>{k.waiting}</td>
                  <td className={k.failed ? "text-jw-danger" : ""}>{k.failed}</td>
                  <td>{k.designed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">الأشخاص ({s.people.length})</h2>
        {s.people.length === 0 && <p className="jw-panel p-4 text-sm text-jw-muted">لم يدخل أحد بإيميله بعد.</p>}
        <div className="space-y-3">
          {s.people.map((p) => (
            <details key={p.userId} className="jw-panel p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                <b dir="ltr" className="text-sm">
                  {p.email}
                </b>
                <span className="text-xs text-jw-muted">
                  {p.projects.length} مادة · {p.projects.reduce((n, x) => n + x.outputs.filter((o) => ["review", "done"].includes(o.status)).length, 0)} ناتج اكتمل · {p.visits} زيارة · آخر نشاط {fmt(p.lastSeen)}
                </span>
                {p.feedback.length > 0 && <span className="jw-chip">💬 {p.feedback.length}</span>}
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-xs text-jw-faint">أول دخول: {fmt(p.firstSeen)}</p>
                {p.projects.map((pr) => (
                  <div key={pr.id} className="rounded-lg bg-jw-surface-2 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{pr.title || "مادة"}</b>
                      <span className="text-xs text-jw-muted">
                        {pr.level || "—"} · {pr.pages} صفحة/جزء · بدأ {fmt(pr.created)} · آخر نشاط {fmt(pr.last)}
                      </span>
                    </div>
                    <p className="mt-1">
                      المرحلة الحالية: <b>{stageName(pr.stage)}</b>
                    </p>
                    {pr.outputs.length > 0 ? (
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {pr.outputs.map((o, i) => (
                          <li key={i} className={`jw-chip ${o.status === "done" ? "!text-jw-ok" : o.status === "failed" ? "!text-jw-danger" : ""}`}>
                            {outputName(o.kind)}: {OUTPUT_STATUS[o.status] ?? o.status}
                            {o.designed ? " · 🪄" : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-jw-faint">لم يختر نواتج بعد.</p>
                    )}
                    {pr.failed.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-jw-danger">
                        {pr.failed.map((f, i) => (
                          <li key={i}>
                            فشل ({f.kind}): {f.error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {p.feedback.map((f, i) => (
                  <blockquote key={i} className="rounded-lg border-s-4 border-jw-accent bg-jw-surface-2 p-3">
                    <span className="text-xs text-jw-muted">
                      {stars(f.rating)} · في مرحلة: {stageName(f.stage)} · {fmt(f.at)}
                    </span>
                    {f.message && <p className="mt-1 whitespace-pre-wrap">{f.message}</p>}
                  </blockquote>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      {s.anonymousFeedback.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">آراء زوار بدون حساب</h2>
          {s.anonymousFeedback.map((f, i) => (
            <blockquote key={i} className="jw-panel p-3 text-sm">
              <span className="text-xs text-jw-muted">
                {stars(f.rating)} · {stageName(f.stage)} · {fmt(f.at)}
              </span>
              {f.message && <p className="mt-1 whitespace-pre-wrap">{f.message}</p>}
            </blockquote>
          ))}
        </section>
      )}
    </div>
  );
}
