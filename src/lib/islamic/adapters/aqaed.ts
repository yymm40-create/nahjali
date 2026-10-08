// «مركز الأبحاث العقائدية» (aqaed.net): its questions and answers, the articles and interviews of those guided to the
// school, and their biographies — through the site's JSON API (the pages are drawn in the browser).

import { htmlToText } from "../text";
import { getJson, type ReadDoc, type Reader, type ReadStep } from "./types";

const API = "https://dashboard.aqaed.net/api/v1";
const PER_PAGE = 40;

/** The archives read, in order: the API path, the page on the site, how to turn one item into a document. */
const ARCHIVES: { key: string; path: string; page: (id: number) => string; kind: string; doc: (x: Record<string, unknown>) => { title: string; text: string; meta: Record<string, unknown> } | null }[] = [
  {
    key: "qa",
    path: "archiveQuestionAnswer",
    page: (id) => `https://aqaed.net/qa/${id}`,
    kind: "qa",
    doc: (x) => {
      const q = htmlToText(String(x.question ?? ""));
      const a = htmlToText(String(x.answer ?? ""));
      if (!a) return null;
      return { title: String(x.title ?? ""), text: `السؤال: ${q}\n\nالجواب: ${a}${x.footnote ? `\n\nالهوامش: ${htmlToText(String(x.footnote))}` : ""}`, meta: { category: (x.category as { title?: string } | null)?.title ?? "" } };
    },
  },
  {
    key: "articles",
    path: "archiveArticles",
    page: (id) => `https://aqaed.net/guided-contribute/${id}`,
    kind: "article",
    doc: (x) => {
      const body = htmlToText(String(x.body ?? ""));
      return body.length > 80 ? { title: String(x.title ?? ""), text: body, meta: {} } : null;
    },
  },
  {
    key: "sayings",
    path: "archiveMoghablats",
    page: (id) => `https://aqaed.net/guided-sayings/${id}`,
    kind: "interview",
    doc: (x) => {
      const body = htmlToText(String(x.body ?? ""));
      return body.length > 80 ? { title: String(x.title ?? ""), text: body, meta: {} } : null;
    },
  },
  {
    key: "guided",
    path: "archiveMustabasreen",
    page: (id) => `https://aqaed.net/guided/${id}`,
    kind: "biography",
    doc: (x) => {
      const body = htmlToText(String(x.biography ?? x.old_biography ?? ""));
      return body.length > 80 ? { title: String(x.name ?? ""), text: body, meta: { country: x.country_astbasar ?? "", previousReligion: x.previous_religion ?? "" } } : null;
    },
  },
];

export const aqaed: Reader = {
  async step(_source, cursor, deadline): Promise<ReadStep> {
    let ai = Number(cursor.archive ?? 0);
    let page = Number(cursor.page ?? 1);
    const docs: ReadDoc[] = [];
    while (ai < ARCHIVES.length && Date.now() < deadline) {
      const arc = ARCHIVES[ai];
      const r = await getJson<{ data?: Record<string, unknown>[]; meta?: { last_page?: number } }>(`${API}/${arc.path}/${PER_PAGE}?page=${page}`);
      const items = r?.data ?? [];
      for (const x of items) {
        const id = Number(x.id);
        if (!id) continue;
        const d = arc.doc(x);
        if (d) docs.push({ url: arc.page(id), kind: arc.kind, title: d.title, text: d.text, meta: { site: "aqaed", ...d.meta } });
      }
      const last = Number(r?.meta?.last_page ?? 0);
      if (!items.length || (last && page >= last)) {
        ai++;
        page = 1;
      } else page++;
    }
    const done = ai >= ARCHIVES.length;
    return { docs, cursor: { archive: ai, page }, done, stage: done ? "اكتمل" : `${ARCHIVES[ai].key} — الصفحة ${page}` };
  },
};
