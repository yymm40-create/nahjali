import Link from "next/link";
import Icon from "@/components/jawad/Icon";
import { createAdminClient } from "@/lib/supabase/admin";
import { adRows } from "@/lib/jawad/server/ads";
import { loadRuntime, PROVIDER_KEYS } from "@/lib/jawad/server/runtime";
import { GENERATORS } from "@config/jawad/generators";

function Row({ ok, label, detail }: { ok: boolean | null; label: string; detail: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 border-b border-jw-line py-3 last:border-0">
      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${ok === null ? "bg-jw-surface-3 text-jw-muted" : ok ? "bg-jw-ok/15 text-jw-ok" : "bg-jw-warn/15 text-jw-warn"}`}>
        <Icon name={ok === null ? "info" : ok ? "check" : "alert"} size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <div className="text-xs text-jw-muted">{detail}</div>
      </div>
    </li>
  );
}

/** Job counts: unfinished now, finished and failed in the last 24 hours. */
async function lastDay() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  return Promise.all([
    db.from("jawad_jobs").select("id", { count: "exact", head: true }).in("status", ["queued", "submitting", "running", "saving"]),
    db.from("jawad_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since),
    db.from("jawad_jobs").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("created_at", since),
  ]);
}

/** Where JAWAD AI stands, and what still needs the owner. */
export default async function JawadAdminHome() {
  const rt = await loadRuntime();
  const ads = await adRows();
  const [open, failed, done] = await lastDay();
  const has = (names: string[]) => names.some((n) => Boolean(process.env[n]));
  // Price units whose provider cost could not be verified, still without the owner's price
  const waiting = GENERATORS.flatMap((g) => g.priceKeys.filter((k) => k.defaultCenti == null && rt.prices[g.id]?.[k.key] == null).map((k) => ({ g, k })));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="jw-panel p-4">
        <h2 className="mb-1 font-semibold">الجاهزية</h2>
        <ul>
          <Row ok={rt.migrated} label="قاعدة البيانات" detail={rt.migrated ? "جداول JAWAD AI موجودة." : <>شغّل الملف <span dir="ltr">supabase/migrations/0017_jawad_ai.sql</span> في Supabase ← SQL Editor.</>} />
          <Row ok={has(PROVIDER_KEYS.openai)} label="مفتاح OpenAI (الصور والصوت)" detail={has(PROVIDER_KEYS.openai) ? "موجود في إعدادات الخادم." : <>أضف <span dir="ltr">OPENAI_API_KEY</span> في Vercel.</>} />
          <Row ok={has(PROVIDER_KEYS["byteplus-modelark"])} label="مفتاح BytePlus ModelArk (الفيديو)" detail={has(PROVIDER_KEYS["byteplus-modelark"]) ? "موجود في إعدادات الخادم." : <>أضف <span dir="ltr">ARK_API_KEY</span> (أو <span dir="ltr">seedance_api</span>) في Vercel.</>} />
          <Row ok={process.env.JAWAD_WEBHOOK_SECRET ? true : null} label="سر إشعارات الفيديو (اختياري)" detail={process.env.JAWAD_WEBHOOK_SECRET ? "مضبوط." : <>يعمل الآن بسرّ مشتق من مفتاح Supabase. يمكنك إضافة <span dir="ltr">JAWAD_WEBHOOK_SECRET</span> مستقلًا.</>} />
          <Row ok={rt.generators.some((g) => g.live)} label="مولدات متاحة للمستخدمين" detail={`${rt.generators.filter((g) => g.live).length} من ${rt.generators.length}. المولدات مخفية افتراضيًا حتى تجربها وتفعّلها.`} />
          <Row ok={ads.some((a) => a.live?.enabled)} label="الإعلانات" detail={`${ads.filter((a) => a.live?.enabled).length} منشور من ${ads.length}.`} />
          <Row ok={!rt.brand.customLogo ? null : true} label="الشعار" detail={rt.brand.customLogo ? "شعار مرفوع من لوحة التحكم." : "الشعار المرفق مع الكود (تقدر تستبدله من «الهوية والشعار»)."} />
        </ul>
      </section>

      <section className="jw-panel p-4">
        <h2 className="mb-1 font-semibold">آخر ٢٤ ساعة</h2>
        <div className="grid grid-cols-3 gap-2 py-2 text-center">
          {[
            ["قيد العمل", open.count ?? 0],
            ["اكتملت", done.count ?? 0],
            ["فشلت", failed.count ?? 0],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-lg bg-jw-surface-2 p-3">
              <p className="text-2xl font-bold tabular-nums">{v}</p>
              <p className="text-xs text-jw-muted">{l}</p>
            </div>
          ))}
        </div>
        <Link href="/jawad-ai/admin/jobs" className="jw-btn mt-2">المهام والسجلات</Link>

        <h2 className="mb-1 mt-6 font-semibold">قرارات تنتظرك</h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-jw-muted">لا شيء.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {waiting.map(({ g, k }) => (
              <li key={`${g.id}-${k.key}`} className="rounded-lg border border-jw-line p-2.5">
                <p><span dir="ltr">{g.name}</span> · {k.label}</p>
                <p className="text-xs text-jw-muted">{k.basis}. هذا الخيار موقوف حتى تحدد سعره من <Link href="/jawad-ai/admin/prices" className="text-jw-accent underline">الأسعار</Link>.</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="jw-panel p-4 lg:col-span-2">
        <h2 className="mb-2 font-semibold">كيف أضيف…</h2>
        <ol className="list-decimal space-y-1.5 ps-5 text-sm text-jw-muted">
          <li><b className="text-jw-ink">الشعار واللون:</b> «الهوية والشعار» ← ارفع صورة PNG/JPG/WEBP مربعة، واختر لون الإبراز.</li>
          <li><b className="text-jw-ink">الإعلانات:</b> «الإعلانات» ← إعلان جديد ← ارفع صورة أو فيديو MP4، اكتب العنوان والرابط، اختر الخانة، فعّله، راجع المعاينة ثم «انشر».</li>
          <li><b className="text-jw-ink">صور المولدات:</b> «المولدات» ← ارفع صورة صنعها المولد نفسه، وعدّل الاسم الظاهر والقسم والترتيب، ثم فعّله بعد تجربته.</li>
          <li><b className="text-jw-ink">الأسعار:</b> «الأسعار» ← لكل بند سعر افتراضي من تكلفة المزوّد الموثّقة؛ اكتب سعرك أو اتركه فارغًا للافتراضي. كل تغيير يُسجَّل.</li>
          <li><b className="text-jw-ink">الأقسام:</b> «الأقسام» ← غيّر الاسم والأيقونة والترتيب والتفعيل، أو أضف قسمًا مربوطًا بمكوّن منفّذ.</li>
          <li><b className="text-jw-ink">مولد جديد:</b> مولد من مزوّد مدعوم بنفس واجهة API يُضاف في <span dir="ltr">config/jawad/generators.ts</span>؛ مزوّد جديد يحتاج برمجة واختبارًا. كتابة اسم مولد هنا لا تجعله يعمل.</li>
        </ol>
      </section>
    </div>
  );
}
