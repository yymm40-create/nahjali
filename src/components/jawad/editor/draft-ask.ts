// Opening «من فكرة لمسودة» from anywhere (the launcher's start kit, حيدرا ماكس's request, the rail, the menus): a window
// event the panel listens to, so the asking side needs no wiring through the editor.

import type { DraftLang } from "@/lib/editor/draft";
import type { Ratio } from "@/lib/editor/model";

export const DRAFT_EVENT = "jw:draft";

export interface DraftAsk {
  /** the idea or script written already (the launcher, or the words said to حيدرا ماكس) */
  idea?: string;
  seconds?: number;
  ratio?: Ratio;
  lang?: DraftLang;
}

export function askDraft(a: DraftAsk = {}) {
  window.dispatchEvent(new CustomEvent<DraftAsk>(DRAFT_EVENT, { detail: a }));
}
