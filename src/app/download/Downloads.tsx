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
  /** how to install and open it the first time */
  steps?: string[];
  /** a fallback for the Terminal (with a copy button) */
  command?: { intro: string; text: string };
  /** what must be read before opening it, in red */
  warning?: string[];
  /** the instructions as a file */
  guide?: string;
}

const ITEMS: Item[] = [
  {
    os: "android",
    icon: "🤖",
    title: "أندرويد",
    what: "تطبيق الجواد الذكي كامل: الصور والفيديو، الطالب الذكي، وحيدرة كت.",
    note: "بعد التحميل افتح الملف، ولو سألك اسمح بالتثبيت من المتصفح.",
    href: DOWNLOADS.play ?? DOWNLOADS.android,
    button: DOWNLOADS.play ? "حمّل من Google Play" : "حمّل التطبيق",
  },
  {
    os: "ios",
    icon: "🍏",
    title: "آيفون وآيباد",
    what: "تطبيق الجواد الذكي كامل، قريبًا في App Store إن شاء الله.",
    note: "لين ذاك الوقت: افتح الموقع في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية»، ويصير عندك مثل التطبيق.",
    href: DOWNLOADS.ios,
    button: DOWNLOADS.ios ? "حمّل من App Store" : "قريبًا",
  },
  {
    os: "mac",
    icon: "💻",
    title: "ماك",
    what: "برنامج الجواد AI: صور وفيديوهات بالذكاء الاصطناعي، ومعه حيدرة كت للمونتاج (اسحب الفيديو من جهازك وينزل على طول بدون رفع).",
    note: "لأجهزة Apple silicon (M1 وما بعده) وأجهزة Intel.",
    warning: [
      "أول مرة تفتحه بيطلع «لم يُفتح JawadAI». هذا طبيعي.",
      "اضغط «تم». لا تضغط «نقل إلى سلة المهملات».",
      "روح: إعدادات النظام ← الخصوصية والأمان ← انزل لتحت ← «افتح على أي حال» ← كلمة سر الماك ← «افتح».",
    ],
    guide: DOWNLOADS.macGuide,
    href: DOWNLOADS.mac,
    button: "حمّل للماك",
    steps: [
      "افتح الملف اللي نزل (JAWAD-AI-mac.dmg)، واسحب «الجواد AI» لمجلد التطبيقات (Applications).",
      "افتح «الجواد AI» من مجلد التطبيقات.",
      "أول مرة بيطلع لك «لم يُفتح JawadAI»: اضغط «تم». لا تضغط «نقل إلى سلة المهملات».",
      "افتح إعدادات النظام ← الخصوصية والأمان، وانزل لتحت لين تشوف «تم حظر JawadAI».",
      "اضغط «افتح على أي حال»، اكتب كلمة سر الماك، وبعدين «افتح».",
      "خلاص! هذي مرة وحدة بس، وبعدها يفتح عادي كل مرة.",
    ],
    command: {
      intro: "ما طلع لك زر «افتح على أي حال»؟ افتح برنامج Terminal (ابحث عنه بـ Cmd + مسافة)، والصق هذا السطر واضغط Enter، وبعدين افتح البرنامج:",
      text: 'xattr -cr "/Applications/الجواد AI.app" /Applications/*aidara*.app 2>/dev/null; echo تم',
    },
  },
  {
    os: "windows",
    icon: "🪟",
    title: "ويندوز",
    what: "برنامج الجواد AI: صور وفيديوهات بالذكاء الاصطناعي، ومعه حيدرة كت للمونتاج (اسحب الفيديو من جهازك وينزل على طول بدون رفع).",
    note: "ويندوز 10 و 11.",
    href: DOWNLOADS.windows,
    button: "حمّل للويندوز",
    steps: [
      "شغّل الملف اللي نزل (JAWAD-AI-Setup.exe).",
      "لو طلعت «Windows protected your PC»: اضغط More info، بعدين Run anyway.",
      "كمّل التثبيت، وبتلقى «الجواد AI» على سطح المكتب وفي قائمة ابدأ.",
    ],
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
        <Image src="/jawad-ai/logo.png" alt="" width={112} height={112} className="mx-auto h-28 w-auto drop-shadow-lg" priority />
        <h1 className="display text-4xl">حمّل الجواد الذكي</h1>
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
              {it.warning && (
                <div role="note" className="space-y-1.5 rounded-2xl border-2 border-red-600 bg-red-600/10 p-3 text-red-600">
                  <p className="font-extrabold">⚠️ مهم قبل ما تفتحه</p>
                  <ol className="list-decimal space-y-1 ps-5 text-sm font-bold leading-7">
                    {it.warning.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ol>
                </div>
              )}
              {it.guide && (
                <a href={it.guide} download="طريقة فتح الجواد AI على الماك.pdf" className="btn btn-ghost w-full border-2 border-red-600 text-red-600">
                  📄 حمّل ملف التعليمات (PDF)
                </a>
              )}
              <p className="text-sm font-bold text-muted">{it.note}</p>
              {it.steps && (
                <details className="rounded-2xl bg-surface-2 p-3" open={mine}>
                  <summary className="cursor-pointer font-extrabold">طريقة التثبيت وأول فتح</summary>
                  <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm font-bold leading-7">
                    {it.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  {it.command && <Command intro={it.command.intro} text={it.command.text} />}
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <section className="card space-y-2 p-5 text-center">
        <h2 className="text-xl font-extrabold">أو استخدمه من المتصفح مباشرة</h2>
        <p className="font-bold text-muted">كل شي يشتغل من الموقع بدون تحميل.</p>
        <Link href="/" className="btn btn-secondary w-full">
          افتح الجواد الذكي
        </Link>
      </section>
    </div>
  );
}

/** A Terminal line with a copy button. */
function Command({ intro, text }: { intro: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      <p className="text-sm font-bold text-muted">{intro}</p>
      <div className="flex items-stretch gap-2">
        <code dir="ltr" className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs text-page">
          {text}
        </code>
        <button
          type="button"
          className="btn btn-ghost min-h-0 shrink-0 px-3 text-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* the person can select it */
            }
          }}
        >
          {copied ? "✓ تم النسخ" : "انسخ"}
        </button>
      </div>
    </div>
  );
}
