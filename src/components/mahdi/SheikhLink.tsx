import Link from "next/link";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";

export const SHEIKH_PATH = "/mahdi/sheikh";

/** A way into «اسأل الشيخ» from the reading and the more pages. */
export default function SheikhLink() {
  return (
    <Link href={SHEIKH_PATH} className="m-card flex items-center gap-3 p-4 font-semibold">
      <span className="text-2xl" aria-hidden="true">📜</span>
      <span className="flex-1">{t.sheikh.card}</span>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
