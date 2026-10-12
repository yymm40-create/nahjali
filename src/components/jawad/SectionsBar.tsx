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
  { href: "/jawad-ai/library", icon: "layers", name: "المكتبة" },
  { href: "/jawad-ai/learn", icon: "book", name: "دروسي" },
  { href: "/jawad-ai/coins", icon: "wallet", name: "رصيدي" },
];

/**
 * The sections, in a side menu: a «☰» button in the header opens a drawer from the side with every enabled
 * section (built from the central registry) and the person's own pages. Closes on a choice, Escape or outside.
 */
export default function SectionsBar({ sections }: { sections: BarSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const activeId = sections.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))?.id;
  useEffect(() => {
    queueMicrotask(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const drawer = (
    <div className="fixed inset-0 z-[90] flex" dir="rtl" role="dialog" aria-label="أقسام JAWAD AI" onClick={() => setOpen(false)}>
      <nav className="jw-panel flex h-full w-[min(300px,85vw)] flex-col overflow-y-auto rounded-none border-s border-jw-line p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between px-1">
          <b className="text-sm">الأقسام</b>
          <button type="button" className="jw-btn jw-btn-quiet !min-h-8 !px-2" onClick={() => setOpen(false)} aria-label="إغلاق">
            <Icon name="x" size={16} />
          </button>
        </div>
        <ul className="space-y-1">
          {sections.map((s) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <Link href={s.path} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? "bg-jw-accent/15 font-bold text-jw-ink" : "text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink"}`}>
                  <Icon name={s.icon} size={18} className={active ? "text-jw-accent" : ""} />
                  <span className="flex-1">{s.name}</span>
                  {s.hidden && <Icon name="lock" size={12} className="text-jw-faint" />}
                </Link>
              </li>
            );
          })}
        </ul>
        <hr className="my-3 border-jw-line" />
        <ul className="space-y-1">
          {MORE.map((m) => (
            <li key={m.href}>
              <Link href={m.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-jw-muted hover:bg-jw-surface-2 hover:text-jw-ink">
                <Icon name={m.icon} size={18} />
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
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
