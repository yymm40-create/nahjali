"use client";

// «الختمة العلوية»: the words of one portion in the mushaf's script (Amiri Quran, loaded by the khatma's layout), with
// the surah headings, «بسم الله» where a surah begins, the verse numbers, and the source named with its link (Tanzil's
// terms). Drawn by the one Quran reader (QuranReader).

import { memo, useEffect, useRef, useState } from "react";
import { t } from "@/lib/mahdi/i18n";
import { arabicDigits, portionCount, type Division } from "@/lib/mahdi/khatma/portions";
import { pinchSize } from "@/lib/mahdi/khatma/reader";

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

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;
const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

/**
 * The page of the Quran itself, on the reader's solid surface: the surah headings, «بسم الله» where a surah begins, and
 * the verses with their numbers. Two fingers resize the letters (drawn live through a CSS variable, kept when they let
 * go). Drawn again only when the words or the size change — never for the time pill.
 */
export const QuranPage = memo(function QuranPage({ words, size, onSize }: { words: PortionWords; size: number; onSize: (rem: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const pinch = useRef<{ d: number; size: number; now: number } | null>(null);
  const font: CSSVars = { "--q-size": `${size}rem` };
  const quran = { fontFamily: "var(--font-quran), var(--font-amiri), serif", fontSize: "var(--q-size)" };
  return (
    <article
      ref={ref}
      className="m-reader-page space-y-6 px-4 py-6 sm:px-8"
      lang="ar"
      dir="rtl"
      style={font}
      onTouchStart={(e) => {
        if (e.touches.length === 2) pinch.current = { d: dist(e.touches), size, now: size };
      }}
      onTouchMove={(e) => {
        const p = pinch.current;
        if (!p || e.touches.length !== 2 || !p.d) return;
        p.now = pinchSize(p.size, dist(e.touches) / p.d);
        ref.current?.style.setProperty("--q-size", `${p.now}rem`);
      }}
      onTouchEnd={(e) => {
        const p = pinch.current;
        if (!p || e.touches.length >= 2) return;
        pinch.current = null;
        if (p.now !== p.size) onSize(p.now);
      }}
    >
      {words.suras.map((s) => (
        <section key={s.sura} className="space-y-3">
          {s.ayat[0]?.n === 1 && (
            <h2 className="m-reader-sura py-2 text-center" style={{ fontFamily: "var(--font-quran), var(--font-amiri), serif", fontSize: "1.4rem" }}>
              سُورَةُ {s.name}
            </h2>
          )}
          {s.bismillah && s.sura !== 1 && <p className="text-center" style={{ ...quran, lineHeight: 2.4 }}>{s.bismillah}</p>}
          <p className="text-justify" style={{ ...quran, lineHeight: 2.5 }}>
            {s.ayat.map((a) => (
              <span key={a.n}>
                {a.text} <span className="m-reader-mark">﴿{arabicDigits(a.n)}﴾</span>{" "}
              </span>
            ))}
          </p>
        </section>
      ))}
    </article>
  );
});

export function QuranSource({ words }: { words: PortionWords }) {
  return (
    <p className="text-center text-xs m-muted">
      {t.khatma.source} — <a href={words.source.url} target="_blank" rel="noopener noreferrer" className="underline" dir="ltr">tanzil.net</a>
    </p>
  );
}
