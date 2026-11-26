import Link from "next/link";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";

/** «تطوّر وازدهر» from the home of «لأجل المهدي» and its «المزيد» menu. */
export default function GrowCard() {
  return (
    <Link href="/mahdi/grow" className="m-card flex items-center gap-4 p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--m-gold) 22%, var(--m-surface-solid))", boxShadow: "inset 0 0 0 2px var(--m-gold)", color: "var(--m-ink)" }} aria-hidden="true">
        <Icon name="sprout" size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="m-eyebrow block">{t.grow.card}</span>
        <span className="block font-semibold">{t.grow.cardLine}</span>
      </span>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
