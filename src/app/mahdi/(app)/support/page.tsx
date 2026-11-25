import SupportView from "@/components/mahdi/support/SupportView";
import { t } from "@/lib/mahdi/i18n";

export const metadata = { title: t.support.title };

/** «ادعم التطبيق»: support «لأجل المهدي» by sharing and rating it — no money is taken from the app. */
export default function SupportPage() {
  return <SupportView />;
}
