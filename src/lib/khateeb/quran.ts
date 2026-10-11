// «الخطيب الذكي» — the Quran's own words for a verse. The model proposes a verse by its SURAH and AYAH numbers only; its
// words are always fetched here (never written from the model's memory), so the sermon quotes the Quran as it is.
// Source: api.alquran.cloud (the Uthmani text). Server only.

import { SERMON_MAX_AYAT } from "@config/jawad/khateeb";

const API = "https://api.alquran.cloud/v1";

export interface Surah {
  number: number;
  name: string;
  ayat: number;
}

let surahs: Surah[] | null = null;

const get = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(20_000), headers: { accept: "application/json" } });
  const body = (await res.json().catch(() => null)) as { code?: number; data?: T } | null;
  if (!res.ok || !body || body.code !== 200 || body.data === undefined) throw new Error(`Quran API ${res.status}`);
  return body.data;
};

/** The 114 surahs (name and number of verses), kept for the life of the server. */
export async function listSurahs(): Promise<Surah[]> {
  if (surahs) return surahs;
  const data = await get<{ number: number; name: string; numberOfAyahs: number }[]>("/surah");
  surahs = data.map((s) => ({ number: s.number, name: s.name.replace(/^سُورَةُ\s*/u, "").replace(/^سورة\s*/u, "").trim(), ayat: s.numberOfAyahs }));
  return surahs;
}

const toAr = (n: number) => n.toLocaleString("ar-EG", { useGrouping: false });

/** A verse passage checked against the real surah: its numbers fixed to what exists, its words and its reference as the Quran has them. */
export async function passage(surah: number, from: number, to: number): Promise<{ surah: number; from: number; to: number; ref: string; text: string } | null> {
  const list = await listSurahs();
  const s = list.find((x) => x.number === Math.round(surah));
  if (!s) return null;
  const a = Math.round(from);
  if (!Number.isInteger(a) || a < 1 || a > s.ayat) return null;
  const b = Math.min(s.ayat, Math.max(a, Math.round(to) || a), a + SERMON_MAX_AYAT - 1);
  const parts: string[] = [];
  for (let n = a; n <= b; n++) {
    const d = await get<{ text: string }>(`/ayah/${s.number}:${n}/quran-uthmani`);
    // the first verse of a surah carries the Basmala in front of it in this text: it is not part of the verse
    const t = n === 1 && s.number !== 1 && s.number !== 9 ? d.text.replace(/^بِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَٰنِ\s+ٱلرَّحِيمِ\s*/u, "") : d.text;
    parts.push(`${t.trim()} ﴿${toAr(n)}﴾`);
  }
  return { surah: s.number, from: a, to: b, ref: `سورة ${s.name}: ${a === b ? toAr(a) : `${toAr(a)}–${toAr(b)}`}`, text: parts.join(" ") };
}

/** The whole surah's verses as plain text, one per line (to find where a tafsir passage begins). */
export async function surahText(surah: number): Promise<string[]> {
  const d = await get<{ ayahs: { text: string }[] }>(`/surah/${Math.round(surah)}/quran-simple`);
  return d.ayahs.map((x) => x.text);
}

export interface Verse {
  surah: number;
  ayah: number;
  text: string;
}

let whole: Verse[] | null = null;

/** The whole Quran, verse by verse in order (the plain text; kept for the life of the server). */
export async function allVerses(): Promise<Verse[]> {
  if (whole) return whole;
  const d = await get<{ surahs: { number: number; ayahs: { numberInSurah: number; text: string }[] }[] }>("/quran/quran-simple");
  whole = d.surahs.flatMap((s) => s.ayahs.map((a) => ({ surah: s.number, ayah: a.numberInSurah, text: a.text })));
  return whole;
}
