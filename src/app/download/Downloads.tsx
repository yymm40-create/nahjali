"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DOWNLOADS } from "@config/downloads";

type Os = "mac" | "windows" | "android" | "ios" | "other";

const detect = (): Os => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Mac OS X|Macintosh/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  return "other";
};

interface Item {
  os: Exclude<Os, "other">;
  icon: string;
  title: string;
  what: string;
  note: string;
  href: string | null;
  button: string;
}

const ITEMS: Item[] = [
  {
    os: "android",
    icon: "🤖",
    title: "أندرويد",
    what: "تطبيق نهج علي كامل: الكتيب، الجواد الذكي، الطالب الذكي، وحيدرة كت.",
    note: "بعد التحميل افتح الملف، ولو سألك اسمح بالتثبيت من المتصفح.",
    href: DOWNLOADS.play ?? DOWNLOADS.android,
    button: DOWNLOADS.play ? "حمّل من Google Play" : "حمّل التطبيق",
  },
  {
    os: "ios",
    icon: "🍏",
    title: "آيفون وآيباد",
    what: "تطبيق نهج علي كامل، قريبًا في App Store إن شاء الله.",
    note: "لين ذاك الوقت: افتح الموقع في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية»، ويصير عندك مثل التطبيق.",
    href: DOWNLOADS.ios,
    button: DOWNLOADS.ios ? "حمّل من App Store" : "قريبًا",
  },
  {
    os: "mac",
    icon: "💻",
    title: "ماك",
    what: "برنامج حيدرة كت للمونتاج: اسحب الفيديو من جهازك وينزل على طول بدون رفع.",
    note: "لأجهزة Apple silicon و Intel. أول فتح: اضغط «تم»، بعدين إعدادات النظام ← الخصوصية والأمان ← «افتح على أي حال».",
    href: DOWNLOADS.mac,
    button: "حمّل للماك",
  },
  {
    os: "windows",
    icon: "🪟",
    title: "ويندوز",
    what: "برنامج حيدرة كت للمونتاج: اسحب الفيديو من جهازك وينزل على طول بدون رفع.",
    note: "ويندوز 10 و 11. لو طلعت «Windows protected your PC» اضغط More info ← Run anyway.",
    href: DOWNLOADS.windows,
    button: "حمّل للويندوز",
  },
];

export default function Downloads() {
  const [os, setOs] = useState<Os>("other");
  useEffect(() => {
    const t = setTimeout(() => setOs(detect()), 0);
    return () => clearTimeout(t);
  }, []);
  // this device's first
  const list = [...ITEMS].sort((a, b) => Number(b.os === os) - Number(a.os === os));

  return (
    <div className="mt-6 space-y-6">
      <header className="space-y-3 text-center">
        <Image src="/brand/logo.png" alt="" width={104} height={118} className="mx-auto h-28 w-auto drop-shadow-lg" priority />
        <h1 className="display text-4xl">حمّل نهج علي</h1>
        <p className="text-lg font-bold text-muted">على جوالك وعلى كمبيوترك، بنفس حسابك وأعمالك.</p>
      </header>

      <ul className="space-y-4">
        {list.map((it) => {
          const mine = it.os === os;
          return (
            <li key={it.os} className={`card space-y-3 p-5 ${mine ? "ring-4 ring-gold/50" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="text-4xl" aria-hidden>
                  {it.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold">
                    {it.title}
                    {mine && <span className="chip bg-teal text-xs text-white">جهازك</span>}
                  </h2>
                  <p className="font-bold text-muted">{it.what}</p>
                </div>
              </div>
              {it.href ? (
                <a href={it.href} className={`btn w-full ${mine ? "btn-primary" : "btn-ghost"}`}>
                  ⬇️ {it.button}
                </a>
              ) : (
                <span className="btn btn-ghost w-full cursor-default opacity-60">{it.button}</span>
              )}
              <p className="text-sm font-bold text-muted">{it.note}</p>
            </li>
          );
        })}
      </ul>

      <section className="card space-y-2 p-5 text-center">
        <h2 className="text-xl font-extrabold">أو استخدمه من المتصفح مباشرة</h2>
        <p className="font-bold text-muted">كل شي يشتغل من الموقع بدون تحميل.</p>
        <Link href="/" className="btn btn-secondary w-full">
          افتح نهج علي
        </Link>
      </section>
    </div>
  );
}
