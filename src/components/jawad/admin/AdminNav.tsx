"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/jawad-ai/admin", label: "نظرة عامة" },
  { href: "/jawad-ai/admin/brand", label: "الهوية والشعار" },
  { href: "/jawad-ai/admin/ads", label: "الإعلانات" },
  { href: "/jawad-ai/admin/sections", label: "الأقسام" },
  { href: "/jawad-ai/admin/generators", label: "المولدات" },
  { href: "/jawad-ai/admin/prices", label: "الأسعار" },
  { href: "/jawad-ai/admin/jobs", label: "المهام والسجلات" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="أقسام الإدارة" className="jw-tabs -mx-1 flex gap-1 overflow-x-auto pb-1">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${active ? "bg-jw-accent-soft text-jw-ink" : "text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
