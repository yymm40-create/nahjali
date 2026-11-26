"use client";

// «الختمة العلوية» · the one Quran reader. «ختمتي», the free reading and a group's portion all open the same screen: a
// slim bar (where you are, the time pill, «Aa»), the page of the Quran on a solid reading surface, the reader's own
// actions under it, and the way to the portion before and after. While it is open the tab bar steps away. Its settings
// (letter size, the reading surface, the reading time's habit) live in one sheet opened by «Aa».

import Link from "next/link";
import { useState } from "react";
import { minutesText, stepSize, wholeMinutes, QURAN_SIZE, type ReadSurface } from "@/lib/mahdi/khatma/reader";
import type { Division } from "@/lib/mahdi/khatma/portions";
import { t } from "@/lib/mahdi/i18n";
import Icon from "../Icon";
import Sheet from "../Sheet";
import { QuranPage, QuranSource, usePortionWords } from "./QuranText";
import ReaderClock, { TimeHabitLink, useReaderState, useReadingClock } from "./ReaderClock";
import { useReaderPrefs, useReadingMode } from "./useReaderPrefs";

export interface ReaderLink {
  href: string;
  label: string;
}

export default function QuranReader({
  division,
  n,
  eyebrow,
  children,
  prev,
  next,
  nextPrimary = false,
}: {
  /** the portion to show (undefined while what it belongs to is still loading) */
  division: Division | undefined;
  n: number;
  /** where this reading belongs: «ختمتي» · «قراءة حرة · صفحة 12 من 604» · «ختمة المجموعة» */
  eyebrow: string;
  /** the reader's own actions under the page («قرأته ✓»…) */
  children?: React.ReactNode;
  /** like turning the mushaf's pages: the one before on the right, the next on the left */
  prev?: ReaderLink | null;
  next?: ReaderLink | null;
  nextPrimary?: boolean;
}) {
  const { words, error } = usePortionWords(division, n);
  const prefs = useReaderPrefs();
  useReadingMode(prefs.surface);
  const rs = useReaderState();
  const clock = useReadingClock(rs);
  const [settings, setSettings] = useState(false);

  return (
    <div className="space-y-4">
      <div className="m-reader-bar">
        <div className="min-w-0 flex-1">
          <p className="m-eyebrow truncate">{eyebrow}</p>
          <p className="truncate font-semibold">{words?.title ?? " "}</p>
        </div>
        <ReaderClock clock={clock} />
        <button type="button" className="m-icon-btn m-aa-btn" onClick={() => setSettings(true)} aria-label="إعدادات القراءة: حجم الخط والسطح ووقت القراءة" aria-haspopup="dialog">
          Aa
        </button>
      </div>

      {error && !words ? (
        <div className="m-card m-empty" role="alert">
          <span className="m-empty-ic"><Icon name="book" /></span>
          <p>{error}</p>
        </div>
      ) : !words ? (
        <div className="space-y-3" aria-busy="true" aria-label={t.khatma.loadingText}>
          <div className="m-skel h-6 w-40" />
          <div className="m-skel h-[60vh]" />
        </div>
      ) : (
        <>
          <p className="m-num text-sm m-muted">{words.range}</p>
          <QuranPage words={words} size={prefs.size} onSize={prefs.setSize} />
          {children && <div className="m-card space-y-2 p-4">{children}</div>}
          {(prev || next) && (
            <nav className="grid grid-cols-2 gap-2" aria-label="التنقل">
              {prev ? (
                <Link href={prev.href} className="m-btn m-btn-ghost m-btn-sm">
                  <Icon name="chevronRight" size={16} /> {prev.label}
                </Link>
              ) : <span />}
              {next ? (
                <Link href={next.href} className={`m-btn m-btn-sm ${nextPrimary ? "m-btn-primary" : "m-btn-ghost"}`}>
                  {next.label} <Icon name="chevronLeft" size={16} />
                </Link>
              ) : <span />}
            </nav>
          )}
          <QuranSource words={words} />
        </>
      )}

      <Sheet open={settings} onClose={() => setSettings(false)} title="إعدادات القراءة">
        <div className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="m-label">حجم الخط</legend>
            <div className="flex items-center gap-3">
              <button type="button" className="m-icon-btn m-btn-ghost" aria-label="أصغر" disabled={prefs.size <= QURAN_SIZE.min} onClick={() => prefs.setSize(stepSize(prefs.size, -1))}>
                <Icon name="minus" size={18} />
              </button>
              <p className="flex-1 truncate text-center" style={{ fontFamily: "var(--font-quran), var(--font-amiri), serif", fontSize: `${Math.min(prefs.size, 2.2)}rem`, lineHeight: 1.8 }} aria-hidden="true">
                بِسْمِ ٱللَّهِ
              </p>
              <button type="button" className="m-icon-btn m-btn-ghost" aria-label="أكبر" disabled={prefs.size >= QURAN_SIZE.max} onClick={() => prefs.setSize(stepSize(prefs.size, 1))}>
                <Icon name="plus" size={18} />
              </button>
            </div>
            <p className="m-hint">وتقدر تكبّره وتصغّره بأصبعين على الصفحة.</p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="m-label">سطح القراءة</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="سطح القراءة">
              {(
                [
                  ["day", "النهار", "sun", "صفحة فاتحة صافية"],
                  ["night", "قراءة الليل", "moon", "أدفى شوي، يريّح العين"],
                ] as [ReadSurface, string, "sun" | "moon", string][]
              ).map(([key, label, icon, hint]) => (
                <button key={key} type="button" role="radio" aria-checked={prefs.surface === key} className="m-option flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-sm font-semibold" onClick={() => prefs.setSurface(key)}>
                  <Icon name={icon} size={20} />
                  {label}
                  <span className="text-xs font-normal m-muted">{hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <section className="space-y-2" aria-labelledby="reader-time">
            <h3 id="reader-time" className="m-label">وقت القراءة</h3>
            <p className="m-num text-sm m-muted">
              هالجلسة {minutesText(wholeMinutes(clock.session))} · اليوم {minutesText(wholeMinutes(clock.today))}
              {!clock.running && " · العدّاد موقوف"}
            </p>
            <button type="button" className="m-btn m-btn-ghost m-btn-sm" onClick={clock.toggle}>
              <Icon name={clock.running ? "pause" : "play"} size={16} /> {clock.running ? "أوقف العدّاد" : "كمّل العدّاد"}
            </button>
            {rs.state && !rs.state.ready && <p className="m-hint">وقتك ما ينحفظ لين تتفعّل تحديثات القاعدة.</p>}
            {rs.state && <TimeHabitLink reader={rs.state} inline onChange={(id) => rs.setHabit(id)} />}
          </section>
        </div>
      </Sheet>
    </div>
  );
}
