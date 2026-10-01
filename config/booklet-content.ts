// Religious texts printed (small and simple) on booklet pages. Edit freely.
// Quran verses are written without the surah name, as requested.

export const PAGE_QUOTES = {
  prayers: {
    text: "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا",
    kind: "quran",
  },
  nightPrayer: {
    text: "إِنَّ نَاشِئَةَ اللَّيْلِ هِيَ أَشَدُّ وَطْئًا وَأَقْوَمُ قِيلًا",
    kind: "quran",
  },
  mahdi: {
    text: "رُوي عن الحسين بن علي بن أبي طالب (عليه السلام): «منّا اثنا عشر مهديًّا، أوّلهم أمير المؤمنين علي بن أبي طالب، وآخرهم التاسع من ولدي، وهو الإمام القائم بالحق، يُحيي الله به الأرض بعد موتها، ويُظهر به دين الحق على الدين كلّه ولو كره المشركون، له غيبة يرتدّ فيها أقوام ويثبت فيها على الدين آخرون».",
    kind: "hadith",
  },
} as const;
