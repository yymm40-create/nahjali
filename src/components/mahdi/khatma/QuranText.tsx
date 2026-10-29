"use client";

// «الختمة العلوية»: the words of one portion in the mushaf's script (Amiri Quran, loaded by the khatma's layout), with
// the surah headings, «بسم الله» where a surah begins, the verse numbers, the letter size kept on the device, and the
// source named with its link (Tanzil's terms). Used by «ختمتي» and by the group khatma.

import { useEffect, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import Icon from "@/components/mahdi/Icon";
import { arabicDigits, portionCount, type Division } from "@/lib/mahdi/khatma/portions";

export interface PortionWords {
  title: string;
  range: string;
  suras: { sura: number; name: string; bismillah: string | null; ayat: { n: number; text: string }[] }[];
  source: { name: string; url: string; version: string };
}

/** Fetches a portion's words (the same for everyone, cached). */
export function usePortionWords(division: Division | undefined, n: number) {
  const [words, setWords] = useState<{ key: string; data: PortionWords } | null>(null);
  const [error, setError] = useState("");
  const key = `${division}:${n}`;
  useEffect(() => {
    if (!division || !Number.isInteger(n) || n < 1 || n > portionCount(division)) return;
    let live = true;
    fetch(`/api/mahdi/khatma/text?d=${division}&n=${n}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x: PortionWords) => live && (setWords({ key: `${division}:${n}`, data: x }), setError("")))
      .catch(() => live && setError(t.khatma.textError));
    return () => {
      live = false;
    };
  }, [division, n]);
  return { words: words?.key === key ? words.data : null, error };
}

const SIZE_KEY = "mahdi-quran-size";
const SIZES = [1.25, 1.45, 1.65, 1.9, 2.2];

export default function QuranText({ words, eyebrow }: { words: PortionWords; eyebrow?: string }) {
  // the reader's letter size, kept on the device (the words only show after loading, so the first paint matches)
  const [size, setSize] = useState(() => {
    try {
      const kept = typeof window === "undefined" ? null : localStorage.getItem(SIZE_KEY);
      const s = kept === null ? NaN : Number(kept);
      return Number.isInteger(s) && s >= 0 && s < SIZES.length ? s : 2;
    } catch {
      return 2;
    }
  });
  function resize(d: number) {
    const s = Math.max(0, Math.min(SIZES.length - 1, size + d));
    setSize(s);
    try {
      localStorage.setItem(SIZE_KEY, String(s));
    } catch {}
  }
  const font = { fontFamily: "var(--font-quran), var(--font-amiri), serif", fontSize: `${SIZES[size]}rem` };
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-eyebrow">{eyebrow ?? t.khatma.title}</p>
          <h1 className="m-display text-2xl">{words.title}</h1>
          <p className="m-num text-sm m-muted">{words.range}</p>
        </div>
        <div className="flex items-center gap-1" aria-label="حجم الخط">
          <button type="button" className="m-icon-btn m-btn-ghost" aria-label="تصغير الخط" disabled={size === 0} onClick={() => resize(-1)}>
            <Icon name="minus" size={16} />
          </button>
          <button type="button" className="m-icon-btn m-btn-ghost" aria-label="تكبير الخط" disabled={size === SIZES.length - 1} onClick={() => resize(1)}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </header>

      <article className="m-card space-y-6 px-4 py-6 sm:px-8" lang="ar" dir="rtl">
        {words.suras.map((s) => (
          <section key={s.sura} className="space-y-3">
            {s.ayat[0]?.n === 1 && (
              <h2 className="rounded-xl border-2 py-2 text-center" style={{ borderColor: "var(--m-gold)", fontFamily: "var(--font-quran), var(--font-amiri), serif", fontSize: "1.4rem" }}>
                سُورَةُ {s.name}
              </h2>
            )}
            {s.bismillah && s.sura !== 1 && <p className="text-center" style={{ ...font, lineHeight: 2.4 }}>{s.bismillah}</p>}
            <p className="text-justify" style={{ ...font, lineHeight: 2.5 }}>
              {s.ayat.map((a) => (
                <span key={a.n}>
                  {a.text} <span style={{ color: "var(--m-gold)", whiteSpace: "nowrap" }}>﴿{arabicDigits(a.n)}﴾</span>{" "}
                </span>
              ))}
            </p>
          </section>
        ))}
      </article>
    </>
  );
}

export function QuranSource({ words }: { words: PortionWords }) {
  return (
    <p className="text-center text-xs m-muted">
      {t.khatma.source} — <a href={words.source.url} target="_blank" rel="noopener noreferrer" className="underline" dir="ltr">tanzil.net</a>
    </p>
  );
}
