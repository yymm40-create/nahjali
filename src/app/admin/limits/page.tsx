import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS, type LimitRow } from "@/lib/film/limits";
import { isAdmin } from "@config/site";
import LimitsAdmin from "./LimitsAdmin";

export const metadata = { title: "التحكم بالموارد والمحاولات | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: the film maker's limits — for everyone, per email, and later per plan. */
export default async function LimitsPage() {
  const user = await requireUser("/admin/limits");
  if (!isAdmin(user.email)) notFound();
  const { data, error } = await createAdminClient().from("film_limits").select("scope,target,key,value");
  const rows = (data ?? []) as LimitRow[];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
        <h1 className="display text-4xl">التحكم بالموارد والمحاولات</h1>
        <p className="text-sm font-bold text-muted">
          حدود صناعة الأفلام. لكل شخص: حدّه بإيميله إن وُجد، وإلا حد الجميع، وإلا الافتراضي. أنت ما عليك أي حد.
        </p>
      </header>
      {error && (
        <p className="error-box">
          جدول الحدود ما انضاف للحين، فالحدود الافتراضية هي اللي شغالة. شغّل الملف <span dir="ltr">supabase/migrations/0014_film_limits.sql</span> في SQL Editor في Supabase، وبعدها تقدر تعدّل من هنا.
        </p>
      )}
      <LimitsAdmin
        limits={Object.entries(LIMITS).map(([key, l]) => ({ key, label: l.label, hint: l.hint, def: l.default, perUser: l.perUser }))}
        rows={rows}
      />
    </div>
  );
}
