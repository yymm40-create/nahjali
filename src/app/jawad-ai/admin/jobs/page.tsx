import { fmtSar } from "@config/coins";
import Link from "next/link";
import AdvanceJobsButton from "@/components/jawad/admin/AdvanceJobsButton";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { stageLabel } from "@/lib/jawad/labels";
import type { JobRow } from "@/lib/jawad/server/jobs";
import { generatorById } from "@config/jawad/generators";
import { requireJawadOwnerPage } from "@/lib/jawad/server/access";

export const metadata = { title: "المهام والسجلات" };

const STATUSES = ["all", "open", "failed", "succeeded", "cancelled"] as const;
const when = (iso: string) => new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "medium" });

/** Every job (all users), its errors and events, and JAWAD AI's coin movements. */
export default async function JobsPage({ searchParams }: PageProps<"/jawad-ai/admin/jobs">) {
  await requireJawadOwnerPage("/jawad-ai/admin/jobs");
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? String(sp.status) : "all";
  const db = createAdminClient();
  let q = db.from("jawad_jobs").select("*").order("created_at", { ascending: false }).limit(60);
  if (status === "open") q = q.in("status", ["queued", "submitting", "running", "saving"]);
  else if (status !== "all") q = q.eq("status", status);
  const [{ data: jobsData }, people, { data: ledger }] = await Promise.all([
    q,
    listAllUsers().then((users) => ({ data: { users } })),
    db.from("smart_coin_ledger").select("*").like("label", "JAWAD AI%").order("created_at", { ascending: false }).limit(60),
  ]);
  const jobs = (jobsData ?? []) as JobRow[];
  const { data: events } = jobs.length ? await db.from("jawad_job_events").select("*").in("job_id", jobs.map((j) => j.id)).order("id") : { data: [] };
  const emailOf = new Map((people.data?.users ?? []).map((u) => [u.id, u.email ?? u.id]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="jw-seg" aria-label="الحالة">
          {STATUSES.map((s) => (
            <Link key={s} href={`/jawad-ai/admin/jobs?status=${s}`} aria-current={status === s ? "page" : undefined} className={`rounded-lg border px-3 py-1.5 text-xs ${status === s ? "border-jw-accent bg-jw-accent-soft" : "border-jw-line-strong text-jw-muted"}`}>
              {{ all: "الكل", open: "قيد العمل", failed: "فشلت", succeeded: "اكتملت", cancelled: "أُلغيت" }[s]}
            </Link>
          ))}
        </nav>
        <AdvanceJobsButton />
      </div>

      <section className="space-y-2">
        {jobs.length === 0 && <p className="jw-panel p-6 text-center text-sm text-jw-muted">لا توجد مهام.</p>}
        {jobs.map((j) => (
          <details key={j.id} className="jw-panel p-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <span className={`jw-chip ${j.status === "failed" ? "text-jw-danger" : j.status === "succeeded" ? "text-jw-ok" : ""}`}>{stageLabel(j.status, j.provider_status)}</span>
              <span dir="ltr">{generatorById(j.generator_id)?.name ?? j.generator_id}</span>
              <span className="text-xs text-jw-muted" dir="ltr">{emailOf.get(j.user_id) ?? j.user_id.slice(0, 8)}</span>
              <span className="text-xs text-jw-muted">{when(j.created_at)}</span>
              <span className="ms-auto text-xs tabular-nums">{fmtSar(j.price_coins)} ر.س · {j.charged ? { none: "—", held: "محجوز", settled: "مخصوم", refunded: "مُعاد" }[j.charge_state] : "بلا خصم (المالك)"}</span>
            </summary>
            <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
              <div className="space-y-1">
                <p><span className="text-jw-muted">المعرّف:</span> <span dir="ltr">{j.id}</span></p>
                <p><span className="text-jw-muted">النموذج والوضع:</span> <span dir="ltr">{j.model_id} · {j.mode}</span></p>
                <p><span className="text-jw-muted">مهمة المزوّد:</span> <span dir="ltr">{j.provider_task_id ?? "—"} ({j.submit_state})</span></p>
                <p><span className="text-jw-muted">التكلفة:</span> <span dir="ltr">تقدير ${Number(j.cost_usd_estimate ?? 0).toFixed(4)} · فعلي {j.cost_usd_actual == null ? "—" : `$${Number(j.cost_usd_actual).toFixed(4)}`}</span></p>
                <p className="whitespace-pre-wrap" dir="auto"><span className="text-jw-muted">البرومبت:</span> {j.prompt || "—"}</p>
                {j.inputs.modelPrompt && <p className="whitespace-pre-wrap" dir="auto"><span className="text-jw-muted">كما وصل للمولد:</span> {j.inputs.modelPrompt}</p>}
                {j.refs.length > 0 && <p dir="ltr" style={{ textAlign: "right" }}><span className="text-jw-muted">المراجع:</span> {j.refs.map((r) => `${r.name ? `@${r.name}` : "—"} (${r.kind}/${r.role})`).join(" · ")}</p>}
                <p dir="ltr" className="break-all font-mono text-[11px]" style={{ textAlign: "right" }}>{JSON.stringify(j.inputs.settings)}</p>
                {j.error_message && <p className="text-jw-danger">للمستخدم: {j.error_message}</p>}
                {j.error_detail && <p className="break-all text-jw-warn" dir="ltr" style={{ textAlign: "right" }}>داخلي: {j.error_detail}</p>}
              </div>
              <ol className="space-y-1 border-s border-jw-line ps-3">
                {(events ?? [])
                  .filter((e) => e.job_id === j.id)
                  .map((e) => (
                    <li key={e.id}>
                      <span className="text-jw-muted">{when(e.created_at)}</span> · <span dir="ltr">{e.type}</span> <span dir="ltr" className="text-jw-faint">{JSON.stringify(e.detail)}</span>
                    </li>
                  ))}
              </ol>
            </div>
          </details>
        ))}
      </section>

      <section className="jw-panel p-4">
        <h2 className="mb-3 font-semibold">حركة النقود الذكية في JAWAD AI</h2>
        {!ledger?.length ? (
          <p className="text-sm text-jw-muted">لا توجد حركات بعد.</p>
        ) : (
          <div className="jw-scroll overflow-x-auto">
            <table className="w-full min-w-[520px] text-start text-xs">
              <thead className="text-jw-muted">
                <tr>
                  <th className="py-2 text-start font-medium">الوقت</th>
                  <th className="py-2 text-start font-medium">الحساب</th>
                  <th className="py-2 text-start font-medium">النوع</th>
                  <th className="py-2 text-start font-medium">المبلغ</th>
                  <th className="py-2 text-start font-medium">المهمة</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id} className="border-t border-jw-line">
                    <td className="py-2">{when(r.created_at)}</td>
                    <td className="py-2" dir="ltr">{emailOf.get(r.user_id) ?? r.user_id.slice(0, 8)}</td>
                    <td className="py-2">{{ reserve: "خصم", refund: "استرداد", settle: "تسوية" }[r.reason as string] ?? r.reason}</td>
                    <td className={`py-2 tabular-nums ${r.delta < 0 ? "text-jw-danger" : "text-jw-ok"}`} dir="ltr">{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                    <td className="py-2 font-mono text-[11px]" dir="ltr">{String(r.ref).slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
