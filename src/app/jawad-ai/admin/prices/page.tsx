import PricesAdmin from "@/components/jawad/admin/PricesAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { GENERATORS } from "@config/jawad/generators";
import { fmtSar, getPricing } from "@config/coins";
import { loadPricing } from "@/lib/coins";
import { requireJawadOwnerPage } from "@/lib/jawad/server/access";

export const metadata = { title: "الأسعار" };

const fmt = (c: number | null) => (c == null ? "الافتراضي" : `${(c / 10000).toFixed(2)}`);

export default async function PricesPage() {
  await requireJawadOwnerPage("/jawad-ai/admin/prices");
  await loadPricing(true);
  const p = getPricing();
  const db = createAdminClient();
  const [{ data: rules }, { data: log }] = await Promise.all([
    db.from("jawad_price_rules").select("generator_id,price_key,centicoins"),
    db.from("jawad_price_log").select("*").order("changed_at", { ascending: false }).limit(100),
  ]);
  const over = new Map(((rules ?? []) as { generator_id: string; price_key: string; centicoins: number }[]).map((r) => [`${r.generator_id}|${r.price_key}`, r.centicoins]));
  return (
    <div className="space-y-6">
      <p className="text-sm text-jw-muted">
        كل بند هنا هو <b>التكلفة علينا بالريال</b> (من سعر المزوّد الموثّق على الدولار = {p.usdToSar} ريال). ما يدفعه العميل يُحسب من مجموع التكلفة: يُقرَّب للأعلى إلى {fmtSar(p.stepHalalas)} ريال، ثم يُضاف الربح {p.marginPct}٪ (مقرّبًا كذلك)، وبجنبه السعر المشطوب بربح {p.wasMarginPct}٪. النسب والتقريب من «النقود والأسعار» في لوحة التحكم.
        السعر يُحسب في الخادم لكل طلب ويُحفظ مع المهمة؛ إذا تغيّر بعد فتح المستخدم للصفحة يُطلب منه تأكيد المبلغ الجديد قبل أي خصم.
      </p>
      <PricesAdmin
        groups={GENERATORS.map((g) => ({
          id: g.id,
          name: g.name,
          keys: g.priceKeys.map((k) => ({ key: k.key, label: k.label, basis: k.basis, defaultCenti: k.defaultCenti, overrideCenti: over.get(`${g.id}|${k.key}`) ?? null })),
        }))}
      />
      <section className="jw-panel p-4">
        <h2 className="mb-3 font-semibold">سجل التغييرات</h2>
        {!log?.length ? (
          <p className="text-sm text-jw-muted">لا توجد تغييرات بعد.</p>
        ) : (
          <div className="jw-scroll overflow-x-auto">
            <table className="w-full min-w-[560px] text-start text-xs">
              <thead className="text-jw-muted">
                <tr>
                  <th className="py-2 text-start font-medium">الوقت</th>
                  <th className="py-2 text-start font-medium">المولد</th>
                  <th className="py-2 text-start font-medium">البند</th>
                  <th className="py-2 text-start font-medium">من</th>
                  <th className="py-2 text-start font-medium">إلى</th>
                  <th className="py-2 text-start font-medium">بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.id} className="border-t border-jw-line">
                    <td className="py-2">{new Date(r.changed_at).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="py-2" dir="ltr">{GENERATORS.find((g) => g.id === r.generator_id)?.name ?? r.generator_id}</td>
                    <td className="py-2" dir="ltr">{r.price_key}</td>
                    <td className="py-2 tabular-nums">{fmt(r.old_centicoins)}</td>
                    <td className="py-2 tabular-nums">{fmt(r.new_centicoins)}</td>
                    <td className="py-2" dir="ltr">{r.changed_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
