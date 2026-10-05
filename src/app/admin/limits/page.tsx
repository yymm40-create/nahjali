import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { ACCESS_MODES, accessMode, LIMITS, SECTIONS_ACCESS, type AccessSection, type LimitRow } from "@/lib/film/limits";
import { isAdmin } from "@config/site";
import LimitsAdmin from "./LimitsAdmin";
import CoinsAdmin from "./CoinsAdmin";
import { coinsRequired } from "@/lib/coins";

export const metadata = { title: "التحكم بالموارد والمحاولات | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: the film maker's limits — for everyone, per email, and later per plan. */
export default async function LimitsPage() {
  const user = await requireUser("/admin/limits");
  if (!isAdmin(user.email)) notFound();
  const { data, error } = await createAdminClient().from("film_limits").select("scope,target,key,value");
  const rows = (data ?? []) as LimitRow[];
  // «النقود الذكية»: the charging switch and the largest balances
  const db = createAdminClient();
  const [wallets, people, required] = await Promise.all([
    db.from("smart_coin_wallets").select("user_id,balance").order("balance", { ascending: false }).limit(10),
    listAllUsers().then((users) => ({ data: { users } })),
    coinsRequired(),
  ]);
  const emailOf = new Map((people.data?.users ?? []).map((u) => [u.id, u.email ?? u.id]));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
        <h1 className="display text-4xl">التحكم بالموارد والمحاولات</h1>
        <p className="text-sm font-bold text-muted">
          مين يقدر يدخل كل قسم، وحدود صناعة الأفلام. لكل شخص: إعداده بإيميله إن وُجد، وإلا إعداد الجميع، وإلا الافتراضي. أنت ما عليك أي حد.
        </p>
      </header>
      {error && (
        <p className="error-box">
          جدول الحدود ما انضاف للحين، فالحدود الافتراضية هي اللي شغالة. شغّل الملف <span dir="ltr">supabase/migrations/0014_film_limits.sql</span> في SQL Editor في Supabase، وبعدها تقدر تعدّل من هنا.
        </p>
      )}
      <CoinsAdmin
        required={required}
        ready={!wallets.error}
        top={(wallets.data ?? []).map((w) => ({ email: emailOf.get(w.user_id) ?? w.user_id, balance: w.balance }))}
      />
      <LimitsAdmin
        sections={await Promise.all(
          (Object.keys(SECTIONS_ACCESS) as AccessSection[]).map(async (key) => ({
            key,
            label: SECTIONS_ACCESS[key].label,
            modes: SECTIONS_ACCESS[key].modes.map((m) => ({ code: ACCESS_MODES[m].code, label: ACCESS_MODES[m].label })),
            current: ACCESS_MODES[await accessMode(key, rows)].code,
          })),
        )}
        limits={Object.entries(LIMITS).map(([key, l]) => ({ key, label: l.label, hint: l.hint, def: l.default, perUser: l.perUser }))}
        rows={rows}
      />
    </div>
  );
}
