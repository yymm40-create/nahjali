import Icon from "./Icon";
import { TB } from "@config/tables-booklet";

/** «كتيب الجداول الذكي» from «لأجل المهدي»: the booklet is made in JAWAD AI (a full page load: another site's look). */
export default function BookletCard() {
  return (
    <a href={TB.base} className="m-card flex items-center gap-4 p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: "linear-gradient(135deg,#bfe6ff,#7cc4f5)" }} aria-hidden="true">
        📘
      </span>
      <span className="min-w-0 flex-1">
        <span className="m-eyebrow block">{TB.name}</span>
        <span className="block font-semibold">كتيب جداول مطبوع لطفلك أو لك، بصورته كشخصية كرتونية</span>
      </span>
      <Icon name="chevronLeft" size={18} />
    </a>
  );
}
