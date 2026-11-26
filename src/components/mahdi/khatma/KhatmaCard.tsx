import Link from "next/link";
import Icon from "../Icon";

/** «الختمة العلوية» from the home of «لأجل المهدي» and its «المزيد» menu. */
export default function KhatmaCard() {
  return (
    <Link href="/mahdi/khatma" className="m-card flex items-center gap-4 p-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--m-gold) 22%, var(--m-surface-solid))", boxShadow: "inset 0 0 0 2px var(--m-gold)", color: "var(--m-ink)" }} aria-hidden="true">
        <Icon name="book" size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="m-eyebrow block">الختمة العلوية</span>
        <span className="block font-semibold">ختمتك للقرآن ربعًا ربعًا: تتابع وين وصلت، ويدخل وردك في عاداتك</span>
      </span>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
