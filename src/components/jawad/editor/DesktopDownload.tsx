"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../Icon";

import { DOWNLOADS } from "@config/downloads";

const MAC = DOWNLOADS.mac;
const WIN = DOWNLOADS.windows;

type Os = "mac" | "win" | "other";

/** The download page: the right file for this computer first, both always there, and the first-open steps. */
export default function DesktopDownload() {
  const [os, setOs] = useState<Os>("other");
  useEffect(() => {
    const t = setTimeout(() => {
      const ua = navigator.userAgent;
      setOs(/Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua) ? "mac" : /Windows/.test(ua) ? "win" : "other");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const card = (k: Exclude<Os, "other">) => {
    const mac = k === "mac";
    return (
      <a
        key={k}
        href={mac ? MAC : WIN}
        className={`jw-panel flex items-center gap-4 p-4 transition hover:border-jw-accent ${os === k ? "border-jw-accent ring-2 ring-jw-accent/40" : ""}`}
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-jw-accent text-jw-on-accent">
          <Icon name="download" size={26} />
        </span>
        <span className="min-w-0">
          <b className="block text-lg">{mac ? "نزّل للماك" : "نزّل للويندوز"}</b>
          <span className="block text-xs text-jw-muted">{mac ? "macOS · أجهزة Apple silicon و Intel · ملف .dmg" : "Windows 10 و 11 · ملف .exe"}</span>
          {os === k && <span className="mt-1 inline-block rounded-full bg-jw-accent/15 px-2 py-0.5 text-[11px] font-bold text-jw-accent">هذا جهازك</span>}
        </span>
      </a>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6">
      <Link href="/jawad-ai/editor" className="jw-btn jw-btn-quiet text-xs">
        <span aria-hidden>→</span> حيدرة كت
      </Link>
      <header className="flex items-center gap-3">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-jw-accent text-jw-on-accent shadow-lg shadow-jw-accent/30">
          <Icon name="scissors" size={30} />
        </span>
        <div>
          <h1 className="text-2xl font-black">الجواد AI للكمبيوتر</h1>
          <p className="text-sm text-jw-muted">برنامج للماك والويندوز: ملفاتك تبقى في جهازك بدون رفع.</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">{(os === "win" ? (["win", "mac"] as const) : (["mac", "win"] as const)).map(card)}</div>

      <section className="jw-panel space-y-2 p-4 text-sm">
        <h2 className="font-bold">وش الفرق عن الموقع؟</h2>
        <ul className="list-disc space-y-1 ps-5 text-jw-muted">
          <li>
            <b className="text-jw-ink">بدون رفع:</b> اسحب الفيديو من الفايندر أو من الملفات للبرنامج وينزل في التايملاين على طول، حتى لو حجمه ١٠ جيجا. الملف يبقى في جهازك.
          </li>
          <li>
            <b className="text-jw-ink">كل شي على جهازك:</b> المعاينة والقص والتصدير، والفيديو المصدّر ينحفظ في المكان اللي تختاره.
          </li>
          <li>
            <b className="text-jw-ink">حسابك نفسه:</b> مشاريعك ومساعدك حيدرة معك. البرنامج يحتاج الإنترنت لحسابك ولحيدرة بس (نص التايملاين صغير، مو الفيديوهات).
          </li>
          <li>
            <b className="text-jw-ink">يتحدّث لحاله:</b> أي تحديث نسويه يوصلك أول ما تفتح البرنامج.
          </li>
        </ul>
      </section>

      <section className="jw-panel space-y-2 p-4 text-sm">
        <h2 className="font-bold">أول مرة تفتحه</h2>
        <p className="text-jw-muted">البرنامج جديد وما عليه بعد شهادة أبل ومايكروسوفت، فالجهاز يسألك أول مرة:</p>
        <p>
          <b>الماك:</b> افتح ملف ‎.dmg واسحب «الجواد AI» لمجلد التطبيقات وافتحه. لو طلع «لم يُفتح JawadAI» اضغط <b>تم</b> (مو سلة المهملات)، بعدين: إعدادات النظام ←
          الخصوصية والأمان ← انزل لتحت ← <b>افتح على أي حال</b> ← كلمة سر الماك ← <b>افتح</b>. مرة وحدة بس.
        </p>
        <p>
          <b>الويندوز:</b> شغّل ملف ‎.exe. لو طلعت رسالة «Windows protected your PC» اضغط <b>More info</b> ← <b>Run anyway</b>.
        </p>
      </section>
    </div>
  );
}
