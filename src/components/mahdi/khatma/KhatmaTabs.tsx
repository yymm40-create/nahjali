"use client";

// «الختمة العلوية» as a branch of its own: its name, and two places — «ختمتي» (my own khatma, tied to my habits) and
// «ختمات المجموعات» (the weekly khatma of my private groups). Hidden while reading, so the page is only the Quran.

import Link from "next/link";
import { usePathname } from "next/navigation";

const UUID = /^\/mahdi\/khatma\/[0-9a-f-]{36}/;

export default function KhatmaTabs() {
  const path = usePathname() ?? "";
  if (path.includes("/read/") || path.includes("/free/")) return null;
  const groups = path.startsWith("/mahdi/khatma/groups") || UUID.test(path);
  return (
    <div className="mb-5 space-y-3">
      <p className="m-eyebrow">لأجل المهدي</p>
      <p className="m-display text-3xl">الختمة العلوية</p>
      <nav className="grid grid-cols-2 gap-2" aria-label="الختمة العلوية">
        <Link href="/mahdi/khatma" className="m-option grid min-h-11 place-items-center px-3 text-sm font-semibold" aria-current={!groups ? "page" : undefined} aria-pressed={!groups}>
          📖 ختمتي
        </Link>
        <Link href="/mahdi/khatma/groups" className="m-option grid min-h-11 place-items-center px-3 text-sm font-semibold" aria-current={groups ? "page" : undefined} aria-pressed={groups}>
          👥 ختمات المجموعات
        </Link>
      </nav>
    </div>
  );
}
