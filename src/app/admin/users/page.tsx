import Link from "next/link";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { accessList } from "@/lib/access";
import { PERMS } from "@config/access";
import { isAdmin } from "@config/site";

export const metadata = { title: "المستخدمون والصلاحيات · لوحة التحكم" };
export const dynamic = "force-dynamic";

const PER_PAGE = 50;
const timeNow = () => Date.now();
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium" }) : "—");

/** Everyone on the site: search, and each person's permissions one click away. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; filter?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const filter = sp.filter ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const db = createAdminClient();
  const [all, allowed] = await Promise.all([listAllUsers(), accessList()]);
  const overrides = new Map(allowed.map((r) => [r.email, r.perms]));

  let list = all
    .map((u) => ({ id: u.id, email: (u.email ?? "").toLowerCase(), name: String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? ""), created: u.created_at, last: u.last_sign_in_at ?? null }))
    .filter((u) => !q || u.email.includes(q) || u.name.toLowerCase().includes(q));
  if (filter === "custom") list = list.filter((u) => overrides.has(u.email));
  if (filter === "active") list = list.filter((u) => u.last && timeNow() - new Date(u.last).getTime() < 7 * 24 * 3600_000);
  list.sort((a, b) => (a.created < b.created ? 1 : -1));
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const { data: wallets } = shown.length ? await db.from("smart_coin_wallets").select("user_id,balance,library_until").in("user_id", shown.map((u) => u.id)) : { data: [] };
  const wallet = new Map(((wallets ?? []) as { user_id: string; balance: number; library_until: string | null }[]).map((w) => [w.user_id, w]));
  const link = (o: Record<string, string | number>) => `/admin/users?${new URLSearchParams(Object.entries({ q, filter, page, ...o }).filter(([, v]) => v !== "" && v !== "all").map(([k, v]) => [k, String(v)]))}`;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="display text-4xl">👥 المستخدمون والصلاحيات</h1>
        <p className="font-bold text-muted">{all.length.toLocaleString("en")} مستخدم. اضغط على أي شخص تشوف وتغيّر كل صلاحياته.</p>
      </header>

      <form className="flex flex-wrap gap-2" action="/admin/users">
        <input name="q" defaultValue={q} placeholder="ابحث بالإيميل أو الاسم" className="field min-w-0 flex-1" dir="auto" />
        <select name="filter" defaultValue={filter} className="field w-auto">
          <option value="all">الكل</option>
          <option value="custom">اللي في قائمة السماح</option>
          <option value="active">دخلوا هالأسبوع</option>
        </select>
        <button className="btn btn-primary min-h-12 px-5">ابحث</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-start text-muted">
              <th className="p-3 text-start">الشخص</th>
              <th className="p-3 text-start">سجّل</th>
              <th className="p-3 text-start">آخر دخول</th>
              <th className="p-3 text-start">النقود</th>
              <th className="p-3 text-start">صلاحيات خاصة</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const w = wallet.get(u.id);
              const own = overrides.get(u.email);
              const library = w?.library_until && new Date(w.library_until).getTime() > timeNow();
              return (
                <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                  <td className="p-3">
                    <Link href={`/admin/users/${u.id}`} className="block font-extrabold hover:underline" dir="auto">
                      {u.name || u.email.split("@")[0]}
                      {isAdmin(u.email) && <span className="chip ms-2 bg-gold text-xs text-on-gold">صاحب المنصة</span>}
                    </Link>
                    <span className="text-xs text-muted" dir="ltr">
                      {u.email}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-muted">{fmt(u.created)}</td>
                  <td className="p-3 font-bold text-muted">{fmt(u.last)}</td>
                  <td className="p-3 font-bold">
                    {isAdmin(u.email) ? "∞" : (w?.balance ?? 0).toLocaleString("en")}
                    {library && <span className="chip ms-1 text-xs">📚 المكتبة</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {own ? (
                        <span className="chip bg-teal text-xs text-white" title={PERMS.filter((x) => own.includes(x.key)).map((x) => x.label).join(" · ")}>
                          ✓ مسموح · {own.length}/{PERMS.length}
                        </span>
                      ) : (
                        <span className="chip text-xs opacity-70">مقفل</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-end">
                    <Link href={`/admin/users/${u.id}`} className="btn btn-ghost min-h-10 px-3 text-sm">
                      الصلاحيات ←
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center font-bold text-muted">
                  ما لقينا أحد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 font-bold">
          {page > 1 && <Link href={link({ page: page - 1 })} className="btn btn-ghost min-h-10 px-4">→ السابق</Link>}
          <span className="text-muted">
            {page} من {pages}
          </span>
          {page < pages && <Link href={link({ page: page + 1 })} className="btn btn-ghost min-h-10 px-4">التالي ←</Link>}
        </nav>
      )}
    </div>
  );
}
