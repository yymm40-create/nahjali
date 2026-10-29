"use client";

// «لأجل المهدي» — «آية اليوم ورواية اليوم»: one verse and one narration for today, shown as they were copied with their
// reference and a link to the page they were copied from. No explanation is written beside them (the owner's rule).

import { useState } from "react";
import { ayahRef, dailyFor, riwayaRef } from "@/lib/mahdi/daily";
import { useMahdi } from "./Provider";
import Icon from "./Icon";

export default function DailyCard() {
  const { state } = useMahdi();
  const entry = dailyFor(state.today);
  const [copied, setCopied] = useState(false);
  if (!entry) return null;
  const { ayah, riwaya } = entry;

  const copy = async () => {
    const text = `آية اليوم\n${ayah.text_ar}\n(${ayahRef(ayah)})\n\nرواية اليوم\n${riwaya.text_ar}\n${riwaya.speaker}\n${riwayaRef(riwaya)}\n${riwaya.source_url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <section className="m-card m-widget space-y-4" aria-label="آية ورواية اليوم">
      <div>
        <span className="m-eyebrow flex items-center gap-2">
          <Icon name="book" size={16} className="m-gold" />
          آية اليوم
        </span>
        <p className="mt-2 text-center leading-[2.1]" style={{ fontFamily: "var(--font-quran), var(--font-amiri), serif", fontSize: "1.35rem" }}>
          {ayah.text_ar}
        </p>
        <p className="m-muted mt-1 text-center text-sm">{ayahRef(ayah)}</p>
      </div>

      <hr className="m-0 border-0 border-t" style={{ borderColor: "color-mix(in srgb, var(--m-gold) 30%, transparent)" }} />

      <div>
        <span className="m-eyebrow flex items-center gap-2">
          <Icon name="quote" size={16} className="m-gold" />
          رواية اليوم
        </span>
        <p className="mt-2 font-semibold leading-loose">{riwaya.text_ar}</p>
        <p className="m-muted mt-2 text-sm leading-relaxed">{riwaya.speaker}</p>
        <p className="m-muted text-sm leading-relaxed">{riwayaRef(riwaya)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <a href={riwaya.source_url} target="_blank" rel="noopener noreferrer" className="m-gold underline underline-offset-4">
            المصدر في الثقلين
          </a>
          <button type="button" onClick={copy} className="m-gold underline underline-offset-4">
            {copied ? "تم النسخ" : "انسخ الآية والرواية"}
          </button>
        </div>
      </div>
    </section>
  );
}
