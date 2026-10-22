"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type AdminItem = { href: string; label: string; icon: string };
type AdminGroup = { title: string; icon: string; items: AdminItem[] };
const item = (href: string, label: string, icon: string): AdminItem => ({ href, label, icon });
const GROUPS: AdminGroup[] = [
  { title: "المتابعة", icon: "📊", items: [item("/jawad-ai/admin", "نظرة عامة", "🏠"), item("/jawad-ai/admin/stats", "الإحصائيات", "📈"), item("/jawad-ai/admin/profit", "صافي الربح", "💰"), item("/jawad-ai/admin/spend", "الصرف", "💸"), item("/jawad-ai/admin/jobs", "المهام والسجلات", "🧾")] },
  { title: "المستخدمون والمال", icon: "👥", items: [item("/jawad-ai/admin/users", "المستخدمون", "👥"), item("/jawad-ai/admin/access", "السماح والأكواد", "🔐"), item("/jawad-ai/admin/limits", "النقود والحدود", "🎚️"), item("/jawad-ai/admin/pricing", "حاسبة الأرباح", "🧮"), item("/jawad-ai/admin/credits", "الباقات والشحن", "💳")] },
  { title: "إعدادات الجواد", icon: "✨", items: [item("/jawad-ai/admin/sections", "الأقسام", "🧩"), item("/jawad-ai/admin/generators", "المولدات", "⚙️"), item("/jawad-ai/admin/prices", "أسعار المولدات", "💰"), item("/jawad-ai/admin/voices", "الأصوات", "🎙️"), item("/jawad-ai/admin/brand", "الهوية والشعار", "🎨"), item("/jawad-ai/admin/ads", "الإعلانات", "📣"), item("/jawad-ai/admin/share", "المشاركة والمكافآت", "🎁")] },
  { title: "إدارة الفروع", icon: "🧠", items: [item("/jawad-ai/admin/film", "صانع الأفلام", "🎬"), item("/jawad-ai/admin/student", "الطالب الذكي", "🎒"), item("/jawad-ai/admin/games", "صانع الألعاب", "🎮"), item("/jawad-ai/admin/content", "صانع المحتوى", "✍️"), item("/jawad-ai/admin/designer", "المصمم الذكي", "🖌️"), item("/jawad-ai/admin/photo", "زهراء فوتو ماستر", "📸"), item("/jawad-ai/admin/kharq", "محمد الخارق", "🧠"), item("/jawad-ai/admin/islamic", "الذكاء الإسلامي", "🕌"), item("/jawad-ai/admin/khateeb", "الخطيب الذكي", "🎤")] },
  { title: "الدورات والمحتوى", icon: "🎓", items: [item("/jawad-ai/admin/course", "دورة الجواد", "🎓"), item("/jawad-ai/admin/learn", "المحتوى المحمي", "📺")] },
  { title: "لأجل المهدي والنظام", icon: "🌙", items: [item("/jawad-ai/admin/mahdi", "إدارة لأجل المهدي", "🌙"), item("/jawad-ai/admin/mahdi/assistant", "رسائل المساعد", "💬"), item("/jawad-ai/admin/mahdi/users", "المستخدمون الفعليون", "📊"), item("/jawad-ai/admin/storage", "التخزين", "📦")] },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(pathname === "/jawad-ai/admin");
  const active = (href: string) => href === "/jawad-ai/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const current = GROUPS.flatMap((group) => group.items).find((entry) => active(entry.href));

  return (
    <div className="jw-admin-nav">
      <nav aria-label="المسار السريع للإدارة" className="jw-admin-rail">
        {GROUPS.flatMap((group) => group.items).map(({ href, label, icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}><span aria-hidden>{icon}</span>{label}</Link>
        ))}
      </nav>
      <button type="button" className="jw-admin-menu-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span><b>{current ? `${current.icon} ${current.label}` : "مركز الإدارة"}</b><small>كل الأدوات مرتبة بدون تكرار</small></span>
        <span aria-hidden>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <nav aria-label="كل أقسام الإدارة" className="jw-admin-groups">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2><span aria-hidden>{group.icon}</span>{group.title}</h2>
              <div>
                {group.items.map(({ href, label, icon }) => (
                  <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} onClick={() => setExpanded(false)}><span aria-hidden>{icon}</span><b>{label}</b><em aria-hidden>←</em></Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      )}
    </div>
  );
}
