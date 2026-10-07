import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPerm, type Perm } from "@config/access";
import { coinsRequired } from "@/lib/coins";
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
  const [perms, wallet, coinsOn, usage] = await Promise.all([
    db.from("site_access").select("perms").eq("email", email).maybeSingle().then((r) => (r.data ? ((r.data.perms as string[]) ?? []).filter(isPerm) : null) as Perm[] | null),
    db.from("smart_coin_wallets").select("balance,library_until").eq("user_id", id).maybeSingle().then((r) => r.data as { balance: number; library_until: string | null } | null),
    coinsRequired().catch(() => false),
    Promise.all([
      count("jawad_jobs"),
      count("editor_projects"),
      count("student_projects"),
      count("film_projects"),
      count("orders"),
      count("mahdi_logs"),
    ]),
  ]);
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
          perms={perms}
          balance={wallet?.balance ?? 0}
          libraryUntil={runningUntil(wallet?.library_until)}
          coinsOn={coinsOn}
        />
      )}
    </div>
  );
}
