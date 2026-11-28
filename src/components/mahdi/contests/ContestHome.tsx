"use client";

// «مسابقة الثبات» on the home: the contests I am in (with a new message from the organiser), and an open one shown to everyone
// (only the site's owner opens a contest to all) until I join it or close the card. Nothing shows before SQL 0137.

import Link from "next/link";
import { useEffect, useState } from "react";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import type { ContestPhase } from "@/lib/mahdi/contests";
import Icon from "../Icon";

interface Card {
  id: string;
  title: string;
  prize: string;
  phase: ContestPhase;
  threshold: number;
  unread: boolean;
}
const HIDE = "mahdi-contest-hidden";

const hidden = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HIDE) ?? "[]") as string[];
  } catch {
    return [];
  }
};

export default function ContestHome() {
  const [cards, setCards] = useState<{ mine: Card[]; open: Card[] } | null>(null);

  useEffect(() => {
    let live = true;
    mahdiFetch<{ joined: Card[]; open: Card[] }>("/api/mahdi/contests")
      .then((d) => {
        if (!live) return;
        const away = hidden();
        setCards({ mine: d.joined.filter((c) => c.phase !== "over" || c.unread), open: d.open.filter((c) => !away.includes(c.id)).slice(0, 1) });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!cards || (!cards.mine.length && !cards.open.length)) return null;
  const close = (id: string) => {
    try {
      localStorage.setItem(HIDE, JSON.stringify([...hidden(), id].slice(-30)));
    } catch {}
    setCards((c) => c && { ...c, open: c.open.filter((x) => x.id !== id) });
  };

  return (
    <div className="space-y-3">
      {cards.mine.map((c) => (
        <Link key={c.id} href={`/mahdi/contests/${c.id}${c.unread ? "?chat=1" : ""}`} className="m-card flex items-center gap-3 p-4">
          <Icon name="trophy" size={22} className="m-gold shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{c.title}</span>
            <span className="m-muted block text-sm">{c.unread ? "وصلتك رسالة من المنظم" : c.phase === "upcoming" ? "تبدأ قريب: جهّز عاداتك" : `شوف نسبتك (المطلوب ${c.threshold}٪)`}</span>
          </span>
          {c.unread && <span className="m-chip m-chip-gold text-xs">جديد</span>}
        </Link>
      ))}
      {cards.open.map((c) => (
        <section key={c.id} className="m-card flex flex-col gap-3 p-4" aria-label="مسابقة مفتوحة">
          <div className="flex items-start gap-3">
            <Icon name="trophy" size={22} className="m-gold mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">مسابقة مفتوحة: {c.title}</p>
              <p className="m-muted text-sm">{c.prize ? `الجائزة: ${c.prize}` : `الفوز لمن يوصل ${c.threshold}٪ في عباداته`}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/mahdi/contests/${c.id}`} className="m-btn m-btn-primary m-btn-sm">شوفها وانضم</Link>
            <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => close(c.id)}>مو الحين</button>
          </div>
        </section>
      ))}
    </div>
  );
}
