import Link from "next/link";
import { t } from "@/lib/mahdi/i18n";
import Icon from "./Icon";
import Robot from "./Robot";

export const SHEIKH_PATH = "/mahdi/sheikh";

const S = t.sheikh;

/**
 * A way into «اسأل الشيخ»: a one-line card on the reading and the more pages; with `home`, the bigger card on the home
 * screen (the owner, 22 November 2026: «خله يظهر فالصفحة الرئيسية للكل — اسأل سؤالك») — the robot, the name, a short
 * line and «اسأل سؤالك». Shown to everyone, never one of the cards the person arranges or turns off.
 */
export default function SheikhLink({ home = false }: { home?: boolean }) {
  if (home) {
    return (
      <Link href={SHEIKH_PATH} className="m-card flex items-center gap-4 p-4">
        <span className="m-soft grid size-16 shrink-0 place-items-center rounded-2xl">
          <Robot size={56} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{S.title}</span>
          <span className="m-hint block leading-relaxed">{S.homeHint}</span>
          <span className="m-btn m-btn-primary m-btn-sm mt-2">{S.ask}</span>
        </span>
      </Link>
    );
  }
  return (
    <Link href={SHEIKH_PATH} className="m-card flex items-center gap-3 p-4 font-semibold">
      <span className="text-2xl" aria-hidden="true">📜</span>
      <span className="flex-1">{S.card}</span>
      <Icon name="chevronLeft" size={18} />
    </Link>
  );
}
