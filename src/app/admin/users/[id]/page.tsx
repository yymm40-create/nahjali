import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPerm, type Perm } from "@config/access";
import { coinsRequired } from "@/lib/coins";
import { isAdmin } from "@config/site";
import UserPermissions from "./UserPermissions";
import Riyal from "@/components/Riyal";
import { userSpend } from "@/lib/spend";
import { TOUR_ASK } from "@config/jawad/tour";

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
  const [perms, wallet, coinsOn, usage, spend, likes] = await Promise.all([
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
    userSpend(id),
    db.from("jawad_settings").select("value").eq("key", `interests:${id}`).maybeSingle().then((r) => (r.data?.value ?? null) as { answers?: Record<string, string[]>; words?: string; at?: string } | null),
  ]);
  const spent = spend.lines.reduce((s, x) => s + x.halalas, 0);
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

      <section className="card space-y-3 p-5">
        <h2 className="display text-2xl">💸 في شنو صرف فلوسه · <Riyal halalas={spent} size={16} /></h2>
        {spend.branches.length ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {spend.branches.map((b) => (
              <li key={b.branch} className="chip">
                {b.branch}: <Riyal halalas={b.halalas} size={12} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-bold text-muted">ما صرف شي بعد.</p>
        )}
        {!!spend.lines.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="p-2 text-start">العملية</th>
                  <th className="p-2 text-start">الفرع</th>
                  <th className="p-2 text-start">المصروف</th>
                  <th className="p-2 text-start">كم مرة</th>
                  <th className="p-2 text-start">آخر مرة</th>
                </tr>
              </thead>
              <tbody>
                {spend.lines.map((l) => (
                  <tr key={l.label} className="border-t border-line">
                    <td className="p-2 font-bold" dir="auto">{l.label}</td>
                    <td className="p-2">{l.branch}</td>
                    <td className="p-2"><Riyal halalas={l.halalas} size={12} /></td>
                    <td className="p-2">{l.times.toLocaleString("en")}</td>
                    <td className="p-2 text-muted">{fmt(l.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="display text-2xl">✨ وش يحب (من أسئلة جواد)</h2>
        {likes ? (
          <>
            {TOUR_ASK.questions.map((q) => (likes.answers?.[q.id]?.length ? (
              <p key={q.id} className="text-sm"><b>{q.q}</b> {likes.answers[q.id]!.join("، ")}</p>
            ) : null))}
            {likes.words && <p className="text-sm"><b>بكلماته:</b> <span dir="auto">{likes.words}</span></p>}
            <p className="text-xs text-muted">جاوب {fmt(likes.at)}</p>
          </>
        ) : (
          <p className="font-bold text-muted">ما جاوب على أسئلة جواد بعد.</p>
        )}
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
