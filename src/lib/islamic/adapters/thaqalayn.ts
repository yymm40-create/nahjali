// «الثقلين» (thaqalayn.com, CC BY 4.0): the Arabic pages of its sitemaps — the chapters of the hadith books (every
// hadith of a chapter on one page), the duas and ziyarat, the surahs, and the commentary. Read page by page.

import { ISLAMIC } from "@config/islamic";
import { mainText, pageTitle } from "../text";
import { get, pool, sitemapUrls, type ReadDoc, type Reader, type ReadStep } from "./types";

/** The sitemaps read, in this order (their Arabic entries only): the hadith chapters — by far the largest — last. */
const MAPS = ["duas", "surahs", "commentary-0", "commentary-1", "commentary-2", "chapters"];
const PER_STEP = 40;

const kindOf = (url: string) => (url.includes("/duas/") ? "dua" : url.includes("/chapter/") ? "hadith-chapter" : url.includes("/quran/") ? "quran" : url.includes("/commentary/") ? "commentary" : "page");

export const thaqalayn: Reader = {
  async step(_source, cursor, deadline): Promise<ReadStep> {
    let map = Number(cursor.map ?? 0);
    let at = Number(cursor.at ?? 0);
    const docs: ReadDoc[] = [];
    while (map < MAPS.length && Date.now() < deadline) {
      const xml = await get(`https://thaqalayn.com/sitemap/${MAPS[map]}.xml`, "application/xml,text/xml");
      // a sitemap that isn't there (commentary-1…) is simply skipped
      const urls = xml ? sitemapUrls(xml).filter((u) => u.includes("/ar/")) : [];
      if (at >= urls.length) {
        map++;
        at = 0;
        continue;
      }
      const batch = urls.slice(at, at + PER_STEP);
      const read = await pool(batch, ISLAMIC.crawlConcurrency, async (url) => {
        const html = await get(url);
        if (!html) return null;
        const text = mainText(html);
        if (text.length < 80) return null;
        const title = pageTitle(html).replace(/\s*\|\s*الثقلين\s*$/, "");
        return { url, kind: kindOf(url), title, text, meta: { site: "thaqalayn", licence: "CC BY 4.0" } } as ReadDoc;
      });
      docs.push(...read.filter((d): d is ReadDoc => d !== null));
      at += batch.length;
    }
    const done = map >= MAPS.length;
    return { docs, cursor: { map, at }, done, stage: done ? "اكتمل" : `${MAPS[map]} — ${at}` };
  },
};
