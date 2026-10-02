import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCaps, riyadhDayStart, riyadhMonthStart, rowCost } from "@/lib/film/usage";
import { isAdmin } from "@config/site";
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

  const [caps, invited, usage, projects, jobs, storage] = await Promise.all([
    getCaps(),
    db.from("film_allowed_emails").select("email,created_at").order("created_at"),
    db.from("film_usage").select("user_id,service,state,estimated_cost_usd,actual_cost_usd,created_at").gte("created_at", riyadhMonthStart().toISOString()),
    db.from("film_projects").select("id", { count: "exact", head: true }),
    db.from("film_jobs").select("status"),
    db.from("film_assets").select("bytes"),
  ]);

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
    ["صرف اليوم", usd(todaySpent), `الحد ${usd(caps.daily_site_cap_usd)}`],
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

      <FilmAdminTools
        invited={(invited.data ?? []).map((r) => r.email)}
        daily={caps.daily_site_cap_usd}
        monthly={caps.monthly_user_cap_usd}
      />
    </div>
  );
}
