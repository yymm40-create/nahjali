import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { riyadhDayStart, riyadhMonthStart, rowCost } from "@/lib/film/usage";
import { isAdmin } from "@config/site";
import { FILM_STAGES } from "@config/film";
import FilmAdminTools from "./FilmAdminTools";

export const metadata = { title: "فرع الفيلم | لوحة التحكم" };
export const dynamic = "force-dynamic";

const SERVICE_LABELS: Record<string, string> = {
  anthropic: "نصوص Claude",
  openai_image: "صور GPT Image",
  seedance: "فيديو Seedance",
  elevenlabs: "أصوات ElevenLabs",
};
const usd = (n: number) => `$${n.toFixed(2)}`;

export default async function FilmAdminPage() {
  const user = await requireUser("/admin/film");
  if (!isAdmin(user.email)) notFound();
  const db = createAdminClient();

  const [invited, usage, projects, jobs, storage] = await Promise.all([
    db.from("film_allowed_emails").select("email,created_at").order("created_at"),
    db.from("film_usage").select("user_id,service,state,estimated_cost_usd,actual_cost_usd,created_at").gte("created_at", riyadhMonthStart().toISOString()),
    db.from("film_projects").select("id", { count: "exact", head: true }),
    db.from("film_jobs").select("status"),
    db.from("film_assets").select("bytes"),
  ]);

  // Every film project with its maker, stage, pictures, videos and cost
  const [{ data: plist }, { data: alist }, { data: ulist }, people] = await Promise.all([
    db.from("film_projects").select("id,user_id,title,stage,created_at,updated_at").order("updated_at", { ascending: false }),
    db.from("film_assets").select("project_id,kind"),
    db.from("film_usage").select("project_id,state,estimated_cost_usd,actual_cost_usd"),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const emailOf = new Map((people.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const projectRows = (plist ?? []).map((p) => {
    const files = (alist ?? []).filter((a) => a.project_id === p.id);
    return {
      ...p,
      email: emailOf.get(p.user_id) ?? p.user_id,
      images: files.filter((a) => a.kind === "image" || a.kind === "upload").length,
      videos: files.filter((a) => a.kind === "video").length,
      cost: (ulist ?? []).filter((u) => u.project_id === p.id).reduce((s, u) => s + rowCost(u), 0),
    };
  });

  const rows = usage.data ?? [];
  const today = riyadhDayStart().toISOString();
  const todaySpent = rows.filter((r) => r.created_at >= today).reduce((s, r) => s + rowCost(r), 0);
  const monthSpent = rows.reduce((s, r) => s + rowCost(r), 0);
  const byService: Record<string, number> = {};
  for (const r of rows) byService[r.service] = (byService[r.service] ?? 0) + rowCost(r);
  const jobList = jobs.data ?? [];
  const failed = jobList.filter((j) => j.status === "failed").length;
  const storedMb = (storage.data ?? []).reduce((s, a) => s + Number(a.bytes ?? 0), 0) / 1024 / 1024;

  const tiles: [string, string, string?][] = [
    ["صرف اليوم", usd(todaySpent)],
    ["صرف هذا الشهر", usd(monthSpent)],
    ["المشاريع", String(projects.count ?? 0)],
    ["عمليات التوليد", String(jobList.length), `${failed} فشلت (ما انحسبت)`],
    ["المساحة المستخدمة", `${storedMb.toFixed(0)} ميجا`, "الخطة المجانية: ١٠٠٠ ميجا"],
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
        <h1 className="display text-4xl">فرع الفيلم</h1>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card p-4">
            <p className="text-sm font-bold text-muted">{label}</p>
            <p className="display text-3xl" dir="ltr">{value}</p>
            {sub && <p className="text-xs font-bold text-muted">{sub}</p>}
          </div>
        ))}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-extrabold">الصرف هذا الشهر حسب الخدمة</h2>
        {Object.keys(byService).length === 0 && <p className="font-bold text-muted">ما فيه صرف للحين.</p>}
        {Object.entries(byService).map(([s, v]) => (
          <div key={s} className="flex justify-between font-bold">
            <span>{SERVICE_LABELS[s] ?? s}</span>
            <span dir="ltr">{usd(v)}</span>
          </div>
        ))}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-xl font-extrabold">مشاريع الأفلام ({projectRows.length})</h2>
        <p className="text-sm font-bold text-muted">اضغط أي مشروع تشوف كل نص وصورة وفيديو انصنع فيه.</p>
        {projectRows.length === 0 && <p className="font-bold text-muted">ما فيه مشاريع للحين.</p>}
        <ul className="space-y-2">
          {projectRows.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/film/${p.id}`} className="block rounded-2xl border border-line p-3 hover:bg-surface-2">
                <span className="flex justify-between gap-2 font-extrabold">
                  <span>{p.title}</span>
                  <span dir="ltr">{usd(p.cost)}</span>
                </span>
                <span className="block text-xs font-bold text-muted">
                  {p.email} · {FILM_STAGES.find((s) => s.key === p.stage)?.label ?? p.stage} · 🖼️ {p.images} · 🎬 {p.videos}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <FilmAdminTools invited={(invited.data ?? []).map((r) => r.email)} />
    </div>
  );
}
