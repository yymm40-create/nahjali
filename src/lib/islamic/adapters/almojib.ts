// «المجيب» (almojib.com): questions and the answers of its institutes (each answer names the marja it follows), read
// through the site's own JSON API — the pages themselves are drawn in the browser and hold no text.

import { ISLAMIC } from "@config/islamic";
import { getJson, pool, type ReadDoc, type Reader, type ReadStep } from "./types";

const API = "https://api.almojib.com/api";
const PER_PAGE = 40;

interface Listed {
  question: { id: number; subject?: string | null };
}
interface Complete {
  outcome?: {
    data?: {
      question?: { id: number; subject?: string | null; question?: string | null; category?: { name?: string } | null; tags?: { subject?: { name: string }[] } | null; share_link?: string | null; lang?: string };
      replies?: { reply?: string | null; marjas?: { name: string }[] | null; institute?: { name?: string } | null; status?: { key?: number } }[];
    };
  };
}

export const almojib: Reader = {
  async step(_source, cursor, deadline): Promise<ReadStep> {
    let page = Number(cursor.page ?? 1);
    let last = Number(cursor.last ?? 0);
    const docs: ReadDoc[] = [];
    let done = false;
    while (Date.now() < deadline) {
      const list = await getJson<{ outcome?: { data?: Listed[]; meta?: { last_page?: number } } }>(`${API}/faq/question/recommended?page=${page}&per_page=${PER_PAGE}`);
      const items = list?.outcome?.data ?? [];
      if (list?.outcome?.meta?.last_page) last = Number(list.outcome.meta.last_page);
      if (!items.length) {
        done = true;
        break;
      }
      const read = await pool(items, ISLAMIC.crawlConcurrency, async (it) => {
        const id = it.question?.id;
        if (!id) return null;
        const c = await getJson<Complete>(`${API}/faq/questions/${id}/complete`);
        const q = c?.outcome?.data?.question;
        const replies = (c?.outcome?.data?.replies ?? []).filter((r) => r.reply && r.status?.key !== 0);
        if (!q || !q.question || !replies.length || (q.lang && q.lang !== "ar")) return null;
        const marjas = [...new Set(replies.flatMap((r) => (r.marjas ?? []).map((m) => m.name)))];
        const text = [
          `السؤال${q.subject ? ` (${q.subject})` : ""}: ${q.question.trim()}`,
          ...replies.map((r) => `الجواب${r.marjas?.length ? ` (حسب فتوى ${r.marjas.map((m) => m.name).join("، ")})` : ""}${r.institute?.name ? ` — ${r.institute.name}` : ""}:\n${String(r.reply).trim()}`),
        ].join("\n\n");
        return {
          url: q.share_link || `https://almojib.com/ar/question/${id}`,
          kind: "qa",
          title: q.subject?.trim() || q.question.trim().slice(0, 80),
          text,
          meta: { site: "almojib", category: q.category?.name ?? "", marjas, tags: (q.tags?.subject ?? []).map((t) => t.name) },
        } as ReadDoc;
      });
      docs.push(...read.filter((d): d is ReadDoc => d !== null));
      page++;
      if (last && page > last) {
        done = true;
        break;
      }
    }
    return { docs, cursor: { page, last }, done, stage: done ? "اكتمل" : `الصفحة ${page}${last ? ` من ${last}` : ""}` };
  },
};
