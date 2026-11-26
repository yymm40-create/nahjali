import Icon from "./Icon";
import { TB } from "@config/tables-booklet";

/** «كتيب الجداول الذكي» from «لأجل المهدي»: the booklet is made in JAWAD AI (a full page load: another site's look). */
export default function BookletCard() {
  return (
    <a href={TB.base} className="m-card flex items-center gap-4 p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--m-gold) 22%, var(--m-surface-solid))", boxShadow: "inset 0 0 0 2px var(--m-gold)", color: "var(--m-ink)" }} aria-hidden="true">
        <Icon name="book" size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="m-eyebrow block">{TB.name}</span>
        <span className="block font-semibold">كتيب جداول مطبوع لطفلك أو لك، بصورته كشخصية كرتونية</span>
      </span>
      <Icon name="chevronLeft" size={18} />
    </a>
  );
}
