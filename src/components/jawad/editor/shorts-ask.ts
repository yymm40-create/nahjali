// Opening «مقاطع قصيرة» / «ابحث في الكلام» from anywhere (the media library's search box, حيدرا ماكس's request): a window
// event the panel listens to, so the asking side needs no wiring through the editor.

export const SHORTS_EVENT = "jw:shorts";

export type ShortsTab = "shorts" | "search";

export interface ShortsAsk {
  tab: ShortsTab;
  /** «مقاطع قصيرة»: the long file to look through, and the length range (seconds) */
  assetId?: string | null;
  min?: number;
  max?: number;
  /** «ابحث في الكلام»: the words to find */
  query?: string;
}

export function askShorts(a: ShortsAsk) {
  window.dispatchEvent(new CustomEvent<ShortsAsk>(SHORTS_EVENT, { detail: a }));
}
