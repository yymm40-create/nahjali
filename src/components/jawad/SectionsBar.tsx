"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export interface BarSection {
  id: string;
  name: string;
  icon: string;
  path: string;
  /** Hidden from users (the owner still sees it, marked). */
  hidden?: boolean;
}

const MORE = [
  { href: "/jawad-ai", icon: "grid", name: "الرئيسية" },
  { href: "/jawad-ai/library", icon: "layers", name: "المكتبة" },
  { href: "/jawad-ai/learn", icon: "book", name: "دروسي" },
  { href: "/jawad-ai/coins", icon: "wallet", name: "رصيدي" },
];

/**
 * The sections, in a side menu: a «☰» button in the header opens a drawer from the side with every enabled
 * section (built from the central registry) and the person's own pages. Closes on a choice, Escape or outside.
 */
export default function SectionsBar({ sections, siteSections = [] }: { sections: BarSection[]; siteSections?: BarSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"cards" | "list">("cards");
  const activeId = sections.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))?.id;
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (localStorage.getItem("jw-menu-view") === "list") setView("list");
      } catch {}
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const drawer = (
    <div className="site-menu-backdrop fixed inset-0 z-[90] flex" dir="rtl" role="dialog" aria-label="قائمة الموقع" onClick={() => setOpen(false)}>
      <nav className={`site-menu-drawer jw-panel flex h-full flex-col overflow-y-auto rounded-none border-s border-jw-line p-4 shadow-2xl ${view === "cards" ? "is-cards w-[min(680px,94vw)]" : "w-[min(350px,90vw)]"}`} onClick={(e) => e.stopPropagation()}>
        <span className="site-menu-orbit" aria-hidden><i /><i /><i /></span>
        <div className="site-menu-heading mb-4 flex items-center justify-between rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="site-menu-mark"><Icon name="robot" size={22} /></span>
            <span><span className="site-menu-chip">AI CREATIVE HUB</span><b className="mt-1 block text-sm">مركز الجواد الذكي</b><span className="text-[11px]">أدواتك الإبداعية في مكان واحد</span></span>
          </div>
          <button type="button" className="site-menu-close jw-btn jw-btn-quiet !min-h-8 !px-2" onClick={() => setOpen(false)} aria-label="إغلاق">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="site-menu-view mb-4 grid grid-cols-2 rounded-xl border border-jw-line bg-jw-bg/60 p-1" aria-label="طريقة عرض القائمة">
          {([['cards', 'بطاقات كبيرة', 'grid'], ['list', 'قائمة جانبية', 'menu']] as const).map(([id, label, icon]) => (
            <button key={id} type="button" className={view === id ? "is-active" : ""} aria-pressed={view === id} onClick={() => { setView(id); try { localStorage.setItem("jw-menu-view", id); } catch {} }}>
              <Icon name={icon} size={16} /> {label}
            </button>
          ))}
        </div>
        <p className="site-menu-label mb-2 px-3 text-[11px] font-bold">منصات وأدوات الذكاء الاصطناعي</p>
        <ul className="site-menu-items">
          {sections.map((s) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <Link href={s.path} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`site-menu-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? "bg-jw-accent/15 font-bold text-jw-ink" : "text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink"}`}>
                  <span className="site-menu-icon"><Icon name={s.icon} size={18} /></span>
                  <span className="flex-1">{s.name}</span>
                  {s.hidden && <Icon name="lock" size={12} className="text-jw-faint" />}
                  {!s.hidden && <Icon name="chevronLeft" size={14} className="site-menu-arrow" />}
                </Link>
              </li>
            );
          })}
        </ul>
        {siteSections.length > 0 && <>
          <p className="mb-2 mt-5 px-3 text-[11px] font-bold text-jw-faint">مواقع نهج علي</p>
          <ul className="site-menu-items">
            {siteSections.map((section) => {
              const active = pathname === section.path || pathname.startsWith(`${section.path}/`);
              return <li key={section.id}><Link href={section.path} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`site-menu-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? "bg-jw-accent/15 font-bold text-jw-ink" : "text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink"}`}><span className="site-menu-icon text-base" aria-hidden>{section.icon}</span><span className="flex-1">{section.name}</span><Icon name="chevronLeft" size={14} className="site-menu-arrow" /></Link></li>;
            })}
          </ul>
        </>}
        <hr className="my-3 border-jw-line" />
        <ul className="site-menu-items site-menu-personal">
          {MORE.map((m) => (
            <li key={m.href}>
              <Link href={m.href} onClick={() => setOpen(false)} className="site-menu-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink">
                <span className="site-menu-icon"><Icon name={m.icon} size={18} /></span>
                <span className="flex-1">{m.name}</span>
                <Icon name="chevronLeft" size={14} className="site-menu-arrow" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="site-menu-signal mt-auto pt-5" aria-hidden><span /><b>النظام جاهز للإبداع</b><small>AI ONLINE</small></div>
      </nav>
      <span className="flex-1 bg-black/50" aria-hidden />
    </div>
  );

  const current = sections.find((s) => s.id === activeId);
  return (
    <>
      <button type="button" className="jw-btn jw-btn-quiet !min-h-9 gap-1.5 !px-2" onClick={() => setOpen(true)} aria-expanded={open} aria-label="القائمة: الأقسام">
        <Icon name="menu" size={20} />
        {current && <span className="hidden text-sm sm:inline">{current.name}</span>}
      </button>
      {open && ready && createPortal(drawer, document.body)}
    </>
  );
}
