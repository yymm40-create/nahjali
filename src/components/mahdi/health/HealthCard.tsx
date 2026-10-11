import Link from "next/link";
import Icon from "../Icon";

/** «الصحة العلوية» from the home of «لأجل المهدي» and its «المزيد» menu. */
export default function HealthCard() {
  return (
    <Link href="/mahdi/health" className="m-card flex items-center gap-4 p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: "linear-gradient(135deg,#1b1f25,#0c0e11)", boxShadow: "inset 0 0 0 2px #c6ff1a" }} aria-hidden="true">
        🏋️
      </span>
      <span className="min-w-0 flex-1">
        <span className="m-eyebrow block">الصحة العلوية</span>
        <span className="block font-semibold">جدول جيم ونظام تغذية من التوصيات العالمية، يدخل في عاداتك</span>
      </span>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
