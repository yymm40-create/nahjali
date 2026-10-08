"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The dashboard's sections, by branch. */
const GROUPS: { title: string; items: { href: string; icon: string; label: string; exact?: boolean }[] }[] = [
  {
    title: "عام",
    items: [
      { href: "/admin", icon: "🏠", label: "نظرة عامة", exact: true },
      { href: "/admin/access", icon: "🔐", label: "السماح والكود السري" },
      { href: "/admin/notes", icon: "📝", label: "الملاحظات" },
      { href: "/admin/users", icon: "👥", label: "المستخدمون" },
      { href: "/admin/limits", icon: "🎚️", label: "النقود والأسعار" },
      { href: "/admin/pricing", icon: "🧮", label: "الأسعار والأرباح" },
    ],
  },
  {
    title: "الجواد للذكاء الاصطناعي",
    items: [
      { href: "/jawad-ai/admin", icon: "✨", label: "إدارة JAWAD AI" },
      { href: "/jawad-ai/admin/sections", icon: "🧩", label: "أقسام الجواد" },
      { href: "/jawad-ai/admin/generators", icon: "⚙️", label: "المولدات" },
      { href: "/jawad-ai/admin/prices", icon: "💰", label: "أسعار المولدات" },
      { href: "/jawad-ai/admin/ads", icon: "📣", label: "الإعلانات" },
      { href: "/jawad-ai/admin/brand", icon: "🎨", label: "الشعار واللون" },
      { href: "/jawad-ai/admin/jobs", icon: "🧾", label: "المهام والصرف" },
      { href: "/jawad-ai/admin/student", icon: "🎒", label: "الطالب الذكي" },
      { href: "/admin/islamic", icon: "🕌", label: "الذكاء الإسلامي" },
      { href: "/admin/film", icon: "🎬", label: "صانع الأفلام الذكي" },
      { href: "/admin/booklet", icon: "📖", label: "كتيب نهج علي" },
    ],
  },
  {
    title: "لأجل المهدي",
    items: [
      { href: "/admin/mahdi", icon: "🌙", label: "المحتوى والبلاغات" },
      { href: "/admin/mahdi/assistant", icon: "💬", label: "رسائل المساعد" },
      { href: "/admin/mahdi/users", icon: "📊", label: "استخدام المهدي" },
    ],
  },
  {
    title: "النظام",
    items: [{ href: "/admin/storage", icon: "📦", label: "التخزين" }],
  },
];

/** The dashboard's menu: a column at the side on a computer, a row to swipe on a phone. */
export default function AdminNav() {
  const path = usePathname();
  const on = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="أقسام لوحة التحكم" className="min-w-0 lg:sticky lg:top-24 lg:w-64 lg:shrink-0 lg:self-start">
      {/* a phone: one row to swipe */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:hidden">
        {GROUPS.flatMap((g) => g.items).map((it) => (
          <Link key={it.href} href={it.href} className={`chip shrink-0 whitespace-nowrap ${on(it.href, it.exact) ? "bg-gold text-on-gold" : ""}`}>
            {it.icon} {it.label}
          </Link>
        ))}
      </div>
      {/* a computer: the groups */}
      <div className="card hidden space-y-4 p-3 lg:block">
        {GROUPS.map((g) => (
          <div key={g.title} className="space-y-1">
            <p className="px-2 text-xs font-extrabold text-muted">{g.title}</p>
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on(it.href, it.exact) ? "page" : undefined}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-bold ${on(it.href, it.exact) ? "bg-gold/20 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
              >
                <span aria-hidden>{it.icon}</span>
                {it.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
