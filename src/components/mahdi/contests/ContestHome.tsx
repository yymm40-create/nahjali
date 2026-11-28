"use client";

// «مسابقة الثبات» on the home: the contests I am in, with a new message from the organiser. No contest is ever shown to
// people who did not join it (a contest is reached by its link only). Nothing shows before SQL 0137.

import Link from "next/link";
import { useEffect, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { ContestPhase } from "@/lib/mahdi/contests";
import Icon from "../Icon";

interface Card {
  id: string;
  title: string;
  phase: ContestPhase;
  threshold: number;
  unread: boolean;
}

export default function ContestHome() {
  const [mine, setMine] = useState<Card[]>([]);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ joined: Card[] }>("/api/mahdi/contests")
      .then((d) => live && setMine(d.joined.filter((c) => c.phase !== "over" || c.unread)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!mine.length) return null;
  return (
    <div className="space-y-3">
      {mine.map((c) => (
        <Link key={c.id} href={`/mahdi/contests/${c.id}${c.unread ? "?chat=1" : ""}`} className="m-card flex items-center gap-3 p-4">
          <Icon name="trophy" size={22} className="m-gold shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{c.title}</span>
            <span className="m-muted block text-sm">{c.unread ? "وصلتك رسالة من المنظم" : c.phase === "upcoming" ? "تبدأ قريب: جهّز عاداتك" : `شوف نسبتك (المطلوب ${c.threshold}٪)`}</span>
          </span>
          {c.unread && <span className="m-chip m-chip-gold text-xs">جديد</span>}
        </Link>
      ))}
    </div>
  );
}
