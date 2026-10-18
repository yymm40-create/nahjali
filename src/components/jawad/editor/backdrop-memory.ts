// «ذاكرة الخلفية» — the background and the colour key are the person's own settings, tuned by hand. Before حيدرة (or one
// of his programs) applies anything, each video clip's backdrop (bg + key) is remembered on this device; if a clip's
// background ever comes out broken, «↩️ رجّع الخلفية لما كانت» in its backdrop tab puts back the last state that differs
// from the one it has now. Browser only; a convenience (storage may be blocked: then nothing is remembered).

import type { Backdrop, Clip, Timeline } from "@/lib/editor/model";

type State = { bg: Backdrop | null; key: Clip["key"] };
const KEEP = 6;
const keyOf = (clipId: string) => `jw-bgmem-${clipId}`;
const same = (a: State, b: State) => JSON.stringify(a) === JSON.stringify(b);
const stateOf = (c: Clip): State => ({ bg: c.bg ?? null, key: c.key ?? null });

function read(clipId: string): State[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyOf(clipId)) ?? "[]");
    return Array.isArray(v) ? (v as State[]) : [];
  } catch {
    return [];
  }
}

/** Remembers every video clip's backdrop as it is now (only when it differs from the last one remembered). */
export function rememberBackdrops(tl: Timeline) {
  try {
    for (const t of tl.tracks) {
      if (t.kind !== "video") continue;
      for (const c of t.clips) {
        const now = stateOf(c);
        const list = read(c.id);
        if (list.length && same(list[list.length - 1], now)) continue;
        localStorage.setItem(keyOf(c.id), JSON.stringify([...list, now].slice(-KEEP)));
      }
    }
  } catch {
    /* storage blocked: nothing remembered */
  }
}

/** The last remembered backdrop of this clip that is not the one it has now (null when there is none). */
export function lastBackdrop(c: Clip): State | null {
  const now = stateOf(c);
  const list = read(c.id);
  for (let i = list.length - 1; i >= 0; i--) if (!same(list[i], now)) return list[i];
  return null;
}
