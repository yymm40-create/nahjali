"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Icon from "./Icon";
import type { BarSection } from "./SectionsBar";

const PERSONAL = [
  { id: "library", name: "المكتبة", icon: "layers", path: "/jawad-ai/library" },
  { id: "learn", name: "دوراتي", icon: "book", path: "/jawad-ai/learn" },
  { id: "coins", name: "الرصيد", icon: "wallet", path: "/jawad-ai/coins" },
];

export default function JawadPathRail({ sections, owner }: { sections: BarSection[]; owner: boolean }) {
  const pathname = usePathname();
  const rail = useRef<HTMLElement>(null);
  const items: BarSection[] = [
    { id: "home", name: "الرئيسية", icon: "grid", path: "/jawad-ai", hidden: false },
    ...sections,
    ...PERSONAL.map((item) => ({ ...item, hidden: false })),
    ...(owner ? [{ id: "admin", name: "مركز الإدارة", icon: "settings", path: "/jawad-ai/admin", hidden: false }] : []),
  ];

  useEffect(() => {
    rail.current?.querySelector<HTMLElement>("[aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [pathname]);

  return (
    <nav ref={rail} className="jw-path-rail" aria-label="مسار الجواد السريع">
      <div className="jw-path-rail-inner">
        {items.map((item) => {
          const active = item.path === "/jawad-ai" ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <Link key={item.id} href={item.path} aria-current={active ? "page" : undefined} className="jw-path-item">
              <span className="jw-path-icon"><Icon name={item.icon} size={16} /></span>
              <span>{item.name}</span>
              {item.hidden && <Icon name="lock" size={11} className="text-jw-faint" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
