import Link from "next/link";
import { t } from "@/lib/mahdi/i18n";
import { SUPPORT_PATH } from "@/lib/mahdi/support";
import Icon from "../Icon";

/** The way into «ادعم التطبيق» on the more page: a warm one-line card with a short hint. */
export default function SupportLink() {
  return (
    <Link href={SUPPORT_PATH} className="m-card flex items-center gap-3 p-4">
      <span className="m-soft grid size-11 shrink-0 place-items-center text-xl" aria-hidden="true">
        💛
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t.support.card}</span>
        <span className="m-hint block">{t.support.cardHint}</span>
      </span>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
