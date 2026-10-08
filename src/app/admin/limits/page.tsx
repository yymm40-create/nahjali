import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { LIMITS, type LimitRow } from "@/lib/film/limits";
import { isAdmin } from "@config/site";
import LimitsAdmin from "./LimitsAdmin";
import CoinsAdmin from "./CoinsAdmin";
import { coinsRequired } from "@/lib/coins";

export const metadata = { title: "النقود والأسعار | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owners only: coins and «حيدرة كت»'s prices. */
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
        <h1 className="display text-4xl">النقود والأسعار</h1>
        <p className="text-sm font-bold text-muted">
          النقود الذكية وأسعار حيدرة كت. مين يدخل وش (مجانًا بلا حدود): من <Link href="/admin/access" className="underline">🔐 السماح</Link>.
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
      <LimitsAdmin limits={Object.entries(LIMITS).map(([key, l]) => ({ key, label: l.label, hint: l.hint, def: l.default, perUser: l.perUser }))} rows={rows} />
    </div>
  );
}
