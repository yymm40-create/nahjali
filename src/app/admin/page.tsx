import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isCoOwner } from "@config/site";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { accessList } from "@/lib/access";
import { coinsRequired } from "@/lib/coins";

export const metadata = { title: "لوحة التحكم | نهج علي" };
export const dynamic = "force-dynamic";

const DAY = 24 * 3600_000;
const timeNow = () => Date.now();

/** How many rows of a table (since a time, when given); null when it can't be read. */
async function count(table: string, since?: string) {
  let q = createAdminClient().from(table).select("*", { count: "exact", head: true });
  if (since) q = q.gte("created_at", since);
  const { count: n, error } = await q;
  return error ? null : (n ?? 0);
}

const n = (v: number | null) => (v === null ? "—" : v.toLocaleString("en"));

/** The dashboard's front: the whole site in one glance, each branch's numbers and where to manage it. */
export default async function AdminHome() {
  const me = await requireUser("/admin");
  const now = timeNow();
  const day = new Date(now - DAY).toISOString();
  const week = new Date(now - 7 * DAY).toISOString();
  const [users, orders, ordersWeek, jobsDay, jobsWeek, editorProjects, studentProjects, filmProjects, mahdiLogsWeek, mahdiAssistant, coinsOn, allowed] = await Promise.all([
    listAllUsers().catch(() => null),
    count("orders"),
    count("orders", week),
    count("jawad_jobs", day),
    count("jawad_jobs", week),
    count("editor_projects"),
    count("student_projects"),
    count("film_projects"),
    count("mahdi_logs", week),
    count("mahdi_assistant_messages", week),
    coinsRequired().catch(() => null),
    accessList(),
  ]);
  const signupsWeek = users ? users.filter((u) => new Date(u.created_at).getTime() > now - 7 * DAY).length : null;
  const activeWeek = users ? users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > now - 7 * DAY).length : null;

  const tiles: [string, string, string][] = [
    ["👥", "المستخدمون", n(users?.length ?? null)],
    ["🆕", "سجّلوا هالأسبوع", n(signupsWeek)],
    ["🟢", "دخلوا هالأسبوع", n(activeWeek)],
    ["✨", "توليدات الجواد (٢٤ ساعة)", n(jobsDay)],
  ];

  const branches: { icon: string; title: string; href: string; stats: [string, string][]; links: [string, string][] }[] = [
    {
      icon: "✨",
      title: "الجواد AI",
      href: "/jawad-ai/admin",
      stats: [
        ["توليدات هالأسبوع", n(jobsWeek)],
        ["مشاريع حيدرة كت", n(editorProjects)],
        ["مشاريع الطالب الذكي", n(studentProjects)],
        ["مشاريع الأفلام", n(filmProjects)],
      ],
      links: [
        ["الأقسام", "/jawad-ai/admin/sections"],
        ["المولدات", "/jawad-ai/admin/generators"],
        ["الأسعار", "/jawad-ai/admin/prices"],
        ["الإعلانات", "/jawad-ai/admin/ads"],
        ["المهام", "/jawad-ai/admin/jobs"],
        ["الفيلم", "/admin/film"],
        ["صانع الألعاب", "/admin/games"],
        ["صانع المحتوى", "/admin/content"],
        ["المصمم الذكي", "/admin/designer"],
        ["زهراء فوتو ماستر", "/admin/photo"],
        ["دورة الجواد", "/admin/course"],
      ],
    },
    {
      icon: "📖",
      title: "كتيب نهج علي",
      href: "/admin/booklet",
      stats: [
        ["كل الطلبات", n(orders)],
        ["طلبات هالأسبوع", n(ordersWeek)],
      ],
      links: [["الأرقام والطلبات", "/admin/booklet"]],
    },
    {
      icon: "🌙",
      title: "لأجل المهدي",
      href: "/admin/mahdi",
      stats: [
        ["تسجيلات العادات (أسبوع)", n(mahdiLogsWeek)],
        ["رسائل المساعد (أسبوع)", n(mahdiAssistant)],
      ],
      links: [
        ["المحتوى والبلاغات", "/admin/mahdi"],
        ["رسائل المساعد", "/admin/mahdi/assistant"],
        ["الاستخدام", "/admin/mahdi/users"],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="display text-4xl">لوحة التحكم</h1>
        <p className="chip w-fit text-xs">{isCoOwner(me.email) ? "👑 رئيس مشارك: كل الصلاحيات، إلا حساب الرئيس" : "👑 الرئيس"}</p>
        <p className="font-bold text-muted">نهج علي كله في مكان واحد: الأرقام الحية، الفروع، والصلاحيات.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([icon, label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-sm font-bold text-muted">
              {icon} {label}
            </p>
            <p className="display text-3xl">{value}</p>
          </div>
        ))}
      </section>

      {/* who can open what, at a glance */}
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">🔐 السماح</h2>
          <Link href="/admin/access" className="btn btn-ghost min-h-10 px-4 text-sm">
            افتح قائمة السماح
          </Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-2xl border border-line p-3">
            <p className="font-extrabold">🌐 الموقع</p>
            <p className="text-sm font-bold text-muted">مقفل إلا «لأجل المهدي» (مفتوح للكل)</p>
          </li>
          <li className="rounded-2xl border border-line p-3">
            <p className="font-extrabold">✅ المسموح لهم</p>
            <p className="text-sm font-bold text-muted">{allowed.length} إيميل + أصحاب الموقع</p>
          </li>
          <li className="rounded-2xl border border-line p-3">
            <p className="font-extrabold">💰 النقود الذكية</p>
            <p className="text-sm font-bold text-muted">{coinsOn === null ? "—" : coinsOn ? "مطلوبة (يُخصم من الرصيد)" : "مو مطلوبة (مجاني)"}</p>
          </li>
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {branches.map((b) => (
          <article key={b.title} className="card flex flex-col gap-3 p-4">
            <Link href={b.href} className="flex items-center gap-2 text-xl font-extrabold hover:underline">
              <span aria-hidden>{b.icon}</span> {b.title}
            </Link>
            <dl className="grid grid-cols-2 gap-2">
              {b.stats.map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-surface-2 p-2.5">
                  <dt className="text-xs font-bold text-muted">{k}</dt>
                  <dd className="display text-2xl">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto flex flex-wrap gap-1.5">
              {b.links.map(([label, href]) => (
                <Link key={href} href={href} className="chip text-xs">
                  {label}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      <Link href="/admin/users" className="card flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
        <span className="text-4xl" aria-hidden>
          👥
        </span>
        <span className="flex-1">
          <b className="block text-xl">المستخدمون والصلاحيات</b>
          <span className="font-bold text-muted">ابحث عن أي شخص: افتح له أو اقفل عليه أي قسم، نقود، المكتبة، الحدود، والمحاولات.</span>
        </span>
        <span aria-hidden className="text-2xl">←</span>
      </Link>
    </div>
  );
}
