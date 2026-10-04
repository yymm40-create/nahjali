"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Icon from "./Icon";

export interface BarSection {
  id: string;
  name: string;
  icon: string;
  path: string;
  /** Hidden from users (the owner still sees it, marked). */
  hidden?: boolean;
}

/**
 * The slim sections bar, built from the central registry: any enabled section appears here by itself.
 * Scrolls sideways (touch drag, wheel, keyboard); arrows / Home / End move between tabs.
 */
export default function SectionsBar({ sections }: { sections: BarSection[] }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  const activeId = sections.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))?.id;

  // Keep the active tab in view
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const tabs = [...(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-tab]") ?? [])];
    const i = tabs.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    // Right-to-left: the left arrow goes to the next tab
    const step: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1 };
    let to = -1;
    if (e.key in step) to = (i + step[e.key] + tabs.length) % tabs.length;
    if (e.key === "Home") to = 0;
    if (e.key === "End") to = tabs.length - 1;
    if (to >= 0) {
      e.preventDefault();
      tabs[to].focus();
      tabs[to].scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  // Desktop mouse wheel scrolls the bar sideways
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = listRef.current;
    if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) el.scrollLeft -= e.deltaY;
  }

  return (
    <nav aria-label="أقسام JAWAD AI" className="border-b border-jw-line bg-jw-bg/85 backdrop-blur">
      <div ref={listRef} className="jw-tabs mx-auto flex h-[var(--jw-bar-h)] max-w-[1600px] items-stretch gap-1 overflow-x-auto px-3 sm:px-5" onKeyDown={onKeyDown} onWheel={onWheel}>
        {sections.map((s) => {
          const active = s.id === activeId;
          return (
            <Link
              key={s.id}
              href={s.path}
              data-tab
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 snap-start items-center gap-2 px-3 text-sm transition-colors ${active ? "text-jw-ink" : "text-jw-muted hover:text-jw-ink"}`}
            >
              <Icon name={s.icon} size={16} className={active ? "text-jw-accent" : ""} />
              <span className="font-medium">{s.name}</span>
              {s.hidden && <Icon name="lock" size={12} className="text-jw-faint" />}
              <span aria-hidden className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${active ? "bg-jw-accent" : "bg-transparent"}`} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
