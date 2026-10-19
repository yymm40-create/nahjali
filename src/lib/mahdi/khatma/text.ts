// SERVER ONLY. «الختمة العلوية»: the words of a portion, taken verse by verse from the Tanzil Uthmani text kept in
// assets/quran (verbatim, with its pause marks and rub signs; its source must be named with a link to tanzil.net).
import quran from "../../../../assets/quran/quran-uthmani.json";
import { portionVerses, type Division } from "./portions";
import { SURA_NAMES } from "./quran-map";

interface Sura {
  name: string;
  bismillah: string | null;
  ayat: string[];
}
const SURAS = (quran as { suras: Sura[] }).suras;

export const QURAN_SOURCE = { name: "Tanzil Project", url: "https://tanzil.net", version: "Tanzil Quran Text (Uthmani, Version 1.1)" };

export interface PortionText {
  suras: { sura: number; name: string; bismillah: string | null; ayat: { n: number; text: string }[] }[];
}

/**
 * Every verse of a portion, grouped by surah. A surah that begins inside it carries its «بسم الله» line (the Fatiha's is
 * its first verse, al-Tawba has none) exactly as the source gives it.
 */
export function portionText(d: Division, n: number): PortionText {
  const { from, to } = portionVerses(d, n);
  const out: PortionText["suras"] = [];
  for (let s = from[0]; s <= to[0]; s++) {
    const sura = SURAS[s - 1];
    const first = s === from[0] ? from[1] : 1;
    const last = s === to[0] ? to[1] : sura.ayat.length;
    out.push({
      sura: s,
      name: SURA_NAMES[s - 1],
      bismillah: first === 1 ? sura.bismillah : null,
      ayat: sura.ayat.slice(first - 1, last).map((text, i) => ({ n: first + i, text })),
    });
  }
  return { suras: out };
}
