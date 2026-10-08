// The general reader, for any site the owner adds: its sitemap when it has one, else the links of its pages from the
// address given, staying on the same host, up to ISLAMIC.sitePages pages. Pages drawn in the browser only (no text in
// the HTML) come out empty — such a site needs a reader of its own.

import { ISLAMIC } from "@config/islamic";
import { hostOf, mainText, pageTitle } from "../text";
import { get, pool, sitemapUrls, type ReadDoc, type Reader, type ReadStep } from "./types";

const PER_STEP = 30;
const SKIP = /\.(png|jpe?g|gif|svg|webp|pdf|zip|mp3|mp4|css|js|ico|woff2?)(\?|$)|\/(wp-admin|wp-json|feed|tag|login|cart|search)\b|[?#]/i;

async function sitemapAll(root: string): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [`${root}/sitemap.xml`, `${root}/sitemap_index.xml`, `${root}/sitemap-index.xml`];
  while (queue.length && out.length < ISLAMIC.sitePages * 3 && seen.size < 40) {
    const u = queue.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    const xml = await get(u, "application/xml,text/xml");
    if (!xml || !/<(urlset|sitemapindex)/i.test(xml)) continue;
    for (const loc of sitemapUrls(xml)) {
      if (/\.xml(\.gz)?$/i.test(loc)) queue.push(loc);
      else out.push(loc);
    }
  }
  return out;
}

export const site: Reader = {
  async step(source, cursor, deadline): Promise<ReadStep> {
    const host = hostOf(source.url);
    const root = `https://${new URL(source.url).hostname}`;
    let queue = (cursor.queue as string[] | undefined) ?? [];
    const seen = new Set<string>((cursor.seen as string[] | undefined) ?? []);
    let count = Number(cursor.count ?? 0);
    const docs: ReadDoc[] = [];
    if (!cursor.started) {
      const fromMap = (await sitemapAll(root)).filter((u) => hostOf(u) === host);
      queue = fromMap.length ? fromMap : [source.url];
      cursor = { started: true };
    }
    while (queue.length && count < ISLAMIC.sitePages && Date.now() < deadline) {
      const batch: string[] = [];
      while (queue.length && batch.length < PER_STEP) {
        const u = queue.shift()!;
        const clean = u.split("#")[0];
        if (seen.has(clean) || hostOf(clean) !== host || SKIP.test(clean)) continue;
        seen.add(clean);
        batch.push(clean);
      }
      const read = await pool(batch, ISLAMIC.crawlConcurrency, async (url) => {
        const html = await get(url);
        if (!html) return null;
        // links the page points to, on the same host, for later
        const links = [...html.matchAll(/href="([^"#?]+)"/g)].map((m) => {
          try {
            return new URL(m[1], url).toString();
          } catch {
            return "";
          }
        });
        return { url, html, links };
      });
      for (const r of read) {
        if (!r) continue;
        count++;
        const text = mainText(r.html);
        if (text.length >= 200) docs.push({ url: r.url, kind: "page", title: pageTitle(r.html), text, meta: { site: host } });
        for (const l of r.links) if (l && hostOf(l) === host && !seen.has(l) && !SKIP.test(l) && queue.length < ISLAMIC.sitePages * 4) queue.push(l);
      }
    }
    const done = !queue.length || count >= ISLAMIC.sitePages;
    return { docs, cursor: { started: true, queue: queue.slice(0, ISLAMIC.sitePages * 4), seen: [...seen].slice(-ISLAMIC.sitePages * 5), count }, done, stage: done ? "اكتمل" : `${count} صفحة، باقي ${queue.length}` };
  },
};
