import SupportView from "@/components/mahdi/support/SupportView";
import { t } from "@/lib/mahdi/i18n";
import { SUPPORT_DEFAULT } from "@/lib/mahdi/support";
import { parseAmount } from "@/lib/pay-link";

export const metadata = { title: t.support.title };

/**
 * «ادعم التطبيق»: support «لأجل المهدي» with an amount the person chooses, or by sharing and rating it. Opens on ?amount=…
 * (where «رجوع» of the payment page comes back with the amount chosen), else on the default amount.
 */
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ amount?: string }> }) {
  const { amount } = await searchParams;
  return <SupportView initial={parseAmount(amount ?? "") ?? SUPPORT_DEFAULT} />;
}
