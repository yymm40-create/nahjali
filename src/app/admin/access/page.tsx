import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessList, codeFromRow } from "@/lib/access";
import { CO_OWNER_EMAILS, OWNER_EMAILS, isAdmin } from "@config/site";
import AccessList from "./AccessList";
import SecretCode from "./SecretCode";
import Codes from "./Codes";

export const metadata = { title: "السماح | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** «السماح»: the site's one list of who may use what. Everyone else finds it all closed, except «لأجل المهدي». */
export default async function AccessPage() {
  const user = await requireUser("/admin/access");
  if (!isAdmin(user.email)) notFound();
  const db = createAdminClient();
  const [{ error }, rows, secret, grants, ownCodes, ownUses] = await Promise.all([
    db.from("site_access").select("email", { head: true, count: "exact" }),
    accessList(),
    db.from("site_secret").select("code,code_id,enabled").eq("id", 1).maybeSingle(),
    db.from("site_code_grants").select("email,code_id,created_at").order("created_at", { ascending: false }).limit(500),
    db.from("site_codes").select("*").order("created_at", { ascending: false }),
    db.from("site_code_uses").select("code_id,email,at").order("at", { ascending: false }).limit(2000),
  ]);
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
        <h1 className="display text-4xl">🔐 السماح</h1>
        <p className="text-sm font-bold text-muted">
          القائمة الوحيدة للموقع: الموقع كله مقفل إلا «لأجل المهدي»، واللي هنا بس يدخلون، كل واحد على الأقسام اللي معلّمة له (✓). اضغط القسم يفتح أو يقفل. والموقع لما يكون مدفوعًا ينخصم من رصيد كل واحد إلا من تعلّمه «♾️ بلا حدود» (أو دخل بالكود السري الشامل، أو بكود معلّم «بلا حدود»).
          «الطالب الذكي» يفتح معه صوره وأصواته، و«صانع الأفلام الذكي» يفتح المشهد القصير والمسلسل الذكي.
        </p>
      </header>
      {error && (
        <p className="error-box">
          جدول السماح ما انضاف للحين، فالموقع مقفل على الكل إلا أصحابه. شغّل الملف <span dir="ltr">supabase/migrations/0035_site_access_and_notes.sql</span> في SQL Editor في Supabase.
        </p>
      )}
      {ownCodes.error ? (
        <p className="error-box">
          جدول الأكواد ما انضاف للحين. شغّل الملف <span dir="ltr">supabase/migrations/0041_access_codes.sql</span> في SQL Editor في Supabase.
        </p>
      ) : (
        <Codes
          codes={(ownCodes.data ?? []).map(codeFromRow)}
          uses={(ownUses.data ?? []).map((u) => ({ codeId: u.code_id as string, email: u.email as string, at: u.at as string }))}
        />
      )}
      {!secret.error && (
        <SecretCode
          code={secret.data?.code ?? ""}
          enabled={Boolean(secret.data?.enabled)}
          users={(grants.data ?? []).map((g) => ({ email: g.email as string, at: g.created_at as string, live: g.code_id === secret.data?.code_id }))}
        />
      )}
      <AccessList
        rows={rows}
        fixed={[...OWNER_EMAILS.map((email) => ({ email, label: "👑 الرئيس: كل شي دائمًا" })), ...CO_OWNER_EMAILS.map((email) => ({ email, label: "🤝 رئيس مشارك: كل شي دائمًا" }))]}
      />
    </div>
  );
}
