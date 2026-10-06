// «حيدر كات» — the catalogue's fonts, fetched the first time a text uses them (or the picker shows them) and
// added to the page under their own name, so the preview's canvas and the export draw with them.

import { FONT_BY_ID, fontFile } from "@/lib/editor/fonts";
import type { Timeline } from "@/lib/editor/model";

const loading = new Map<string, Promise<boolean>>();

/** The CSS family a catalogue font is added under (never clashing with the page's own fonts). */
export const familyOf = (id: string) => `jw-${id}`;

/** Loads a catalogue font at (the file nearest) a weight; true when it is ready (the page's own fonts always are). */
export function loadFont(id: string, weight = 400): Promise<boolean> {
  const f = FONT_BY_ID.get(id);
  if (!f || typeof FontFace === "undefined") return Promise.resolve(true);
  const file = fontFile(f, weight);
  const key = `${id}:${file.weight}`;
  let p = loading.get(key);
  if (!p) {
    p = new FontFace(familyOf(id), `url(${file.url})`, { weight: String(file.weight), display: "swap" })
      .load()
      .then((face) => {
        document.fonts.add(face);
        return true;
      })
      .catch(() => {
        loading.delete(key);
        return false;
      });
    loading.set(key, p);
  }
  return p;
}

/** Every catalogue font the timeline's texts use (before drawing them, and before an export). */
export function loadFontsOf(tl: Timeline) {
  const want = new Set<string>();
  for (const t of tl.tracks) for (const c of t.clips) if (c.text && FONT_BY_ID.has(c.text.font)) want.add(`${c.text.font}|${c.text.weight}`);
  return Promise.all([...want].map((k) => loadFont(k.split("|")[0], Number(k.split("|")[1]))));
}
