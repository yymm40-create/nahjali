import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessMode, limitRows, LIMITS, SECTIONS_ACCESS, ACCESS_MODES, type AccessSection, type LimitKey } from "@/lib/film/limits";
import { coinsRequired } from "@/lib/coins";
import { dailyTrialLimit } from "@config/pricing";
import { isAdmin } from "@config/site";
import UserPermissions from "./UserPermissions";

export const metadata = { title: "صلاحيات مستخدم · لوحة التحكم" };
export const dynamic = "force-dynamic";

const runningUntil = (v: string | null | undefined) => (v && new Date(v).getTime() > Date.now() ? v : null);
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }) : "—");

/** One person: what they've used, and every permission the owner can give or take, on one page. */
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error || !data.user) notFound();
  const u = data.user;
  const email = (u.email ?? "").toLowerCase();

  const count = async (table: string, col = "user_id") => {
    const { count: n, error: e } = await db.from(table).select("*", { count: "exact", head: true }).eq(col, id);
    return e ? null : (n ?? 0);
  };
  const [rows, wallet, invited, coinsOn, usage, ...modes] = await Promise.all([
    limitRows(),
    db.from("smart_coin_wallets").select("balance,library_until").eq("user_id", id).maybeSingle().then((r) => r.data as { balance: number; library_until: string | null } | null),
    db.from("film_allowed_emails").select("email").eq("email", email).maybeSingle().then((r) => !!r.data),
    coinsRequired().catch(() => false),
    Promise.all([
      count("jawad_jobs"),
      count("editor_projects"),
      count("student_projects"),
      count("film_projects"),
      count("orders"),
      count("mahdi_logs"),
    ]),
    ...(Object.keys(SECTIONS_ACCESS) as AccessSection[]).map((s) => accessMode(s).catch(() => SECTIONS_ACCESS[s].default)),
  ]);
  const own = rows.filter((r) => r.scope === "email" && r.target === email);
  const all = rows.filter((r) => r.scope === "all");
  const sections = (Object.keys(SECTIONS_ACCESS) as AccessSection[]).map((s, i) => {
    const r = own.find((x) => x.key === `allow_${s}`);
    return { key: s, label: SECTIONS_ACCESS[s].label, siteMode: ACCESS_MODES[modes[i]].label, value: (r === undefined ? null : r.value > 0 ? 1 : 0) as 0 | 1 | null };
  });
  const limits = (Object.keys(LIMITS) as LimitKey[])
    .filter((k) => LIMITS[k].perUser)
    .map((k) => ({
      key: k,
      label: LIMITS[k].label,
      hint: LIMITS[k].hint,
      site: all.find((r) => r.key === k)?.value ?? LIMITS[k].default,
      own: own.find((r) => r.key === k)?.value ?? null,
    }));
  const custom = Number(u.app_metadata?.daily_trials) || null;
  const owner = isAdmin(email);
  const [jobs, editor, student, film, orders, mahdi] = usage;
  const name = String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? "") || email.split("@")[0];

  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="text-sm font-bold text-muted hover:underline">
        → كل المستخدمين
      </Link>
      <header className="card flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-3xl" aria-hidden>
          👤
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="display text-3xl" dir="auto">
            {name}
            {owner && <span className="chip ms-2 bg-gold align-middle text-sm text-on-gold">صاحب المنصة</span>}
          </h1>
          <p className="font-bold text-muted" dir="ltr">
            {email}
          </p>
          <p className="text-sm font-bold text-muted">
            سجّل {fmt(u.created_at)} · آخر دخول {fmt(u.last_sign_in_at)}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["✨", "توليدات الجواد", jobs],
            ["✂️", "مشاريع حيدرة كت", editor],
            ["🎒", "الطالب الذكي", student],
            ["🎬", "أفلام", film],
            ["📖", "طلبات الكتيب", orders],
            ["🌙", "تسجيلات المهدي", mahdi],
          ] as [string, string, number | null][]
        ).map(([icon, label, v]) => (
          <div key={label} className="card p-3">
            <p className="text-xs font-bold text-muted">
              {icon} {label}
            </p>
            <p className="display text-2xl">{v === null ? "—" : v.toLocaleString("en")}</p>
          </div>
        ))}
      </section>

      {owner ? (
        <p className="card p-5 font-bold">هذا حسابك (صاحب المنصة): كل شي مفتوح لك بلا حدود، فما يحتاج صلاحيات.</p>
      ) : (
        <UserPermissions
          email={email}
          sections={sections}
          limits={limits}
          balance={wallet?.balance ?? 0}
          libraryUntil={runningUntil(wallet?.library_until)}
          coinsOn={coinsOn}
          filmInvited={invited}
          trials={{ custom, effective: dailyTrialLimit(u) }}
          overrides={own.length}
        />
      )}
    </div>
  );
}
