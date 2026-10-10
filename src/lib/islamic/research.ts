// «الذكاء الإسلامي» — the deep research: before answering, Claude searches the library itself, round after round,
// like a researcher: it breaks the question into what has to be found, searches thaqalayn (the narrations, the duas,
// the Quran and its commentary — the primary source) with the words the books use, reads what comes back, searches
// again where something is missing (another wording, a chapter's title, a narrator, a book), and only then the
// complements (almojib, aqaed) for what explains or completes. Every passage it found is kept, numbered once, and
// the answer is written from them. The library only: nothing from the web, nothing from memory. Server only.

import { claudeFetch, claudeCost, isLeader, siteSystem, withModel, type ClaudeUsage } from "@/lib/film/anthropic";
import { currentClaude } from "@/lib/film/claude-model";
import { searchScoped, type Passage } from "./library";
import { isPrimary, KIND_LABEL } from "./text";

/** Rounds of searching at most, searches in all, and passages kept for the answer. */
export const RESEARCH = { rounds: 6, searches: 18, keep: 30 } as const;

const TOOL = {
  name: "search_library",
  description:
    "Searches the platform's indexed Islamic library and returns numbered passages. scope \"primary\" = thaqalayn (the hadith books' narrations, the duas and ziyarat, the Quran, tafsir) — THE MAIN SOURCE, search it first and most; scope \"complements\" = almojib and aqaed (answers, articles, rulings) — only to explain or complete what the narrations say. Write the query in classical Arabic as the books word it (a few telling words: the key term, its root, the subject, a chapter title, a narrator or a book), not as a sentence.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["query", "scope"],
    properties: {
      query: { type: "string", description: "3–8 classical Arabic words" },
      scope: { type: "string", enum: ["primary", "complements"] },
    },
  },
};

const SYSTEM = `أنت باحث في مكتبة «الذكاء الإسلامي». مهمتك الآن جمع المادة لا كتابة الجواب: ابحث بأداة search_library حتى تجمع ما يكفي للجواب عن سؤال السائل.
- فكّك السؤال أولًا إلى ما يجب العثور عليه (الروايات في المسألة، معانيها، ما يعارضها أو يقيدها، وأقوال العلماء فيها).
- الثقلين (scope="primary") هو المصدر الأساسي: ابدأ به، وأكثر البحث فيه، بألفاظ الكتب لا بلفظ السائل: المصطلح، وأصل الكلمة، ومرادفاتها، وعنوان الباب المتوقع، واسم الراوي أو الكتاب.
- اقرأ ما يرجع؛ إن كان ناقصًا فابحث مرة أخرى بصيغة أخرى، أو في باب قريب، أو عن رواية ذُكرت في مقطع.
- المتممات (scope="complements": المجيب ومركز الأبحاث العقائدية) بعد الثقلين فقط، لما يشرح الروايات أو يكمّلها.
- اجعل كل جولة بحثين إلى أربعة معًا. لا تكرر بحثًا بنفس الكلمات.
- حين يكفي ما جمعت (أو لا يبقى ما يُبحث عنه) فتوقّف واكتب ملاحظاتك للكاتب في فقرة قصيرة: ما الذي وُجد وبأي أرقام، وما الذي لم يوجد، وأي تعارض بين المقاطع.
- لا تجب عن السؤال من حفظك، ولا تذكر رواية لم ترجعها الأداة.`;

export interface Found {
  passages: Passage[];
  notes: string;
  searches: { query: string; scope: string; hits: number }[];
  usd: number;
}

const label = (p: Passage) => `${isPrimary(p.url) ? "أساسي — الثقلين" : "متمم"} · ${KIND_LABEL[p.kind] ?? p.kind} · ${p.source_name} · ${p.title || p.kind}`;

/** Searches the library round after round for one question (with the conversation before it) and keeps what it finds. */
export async function research(question: string, context: string, email: string | null): Promise<Found> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = currentClaude();
  const kept: Passage[] = [];
  const byChunk = new Map<number, number>();
  const searches: Found["searches"] = [];
  let usd = 0;
  let notes = "";
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: `${context ? `سياق المحادثة قبل السؤال:\n${context}\n\n` : ""}سؤال السائل: ${question}` },
  ];

  // Every round sends the same system and tools: the model's earlier thinking is sent back with its replies and is
  // only valid in the same conversation (dropping the tool in the last round made the API refuse it as «bound to a
  // different conversation»). The last round is told in words to stop searching instead.
  const ask = () =>
    claudeFetch(
      `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`,
      {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 8000,
          system: siteSystem(SYSTEM, true, isLeader(email)),
          tools: [TOOL],
          messages,
          ...(model.effort ? { output_config: { effort: "medium" } } : {}),
        }),
      },
      undefined,
      240_000,
    );

  for (let round = 0; round < RESEARCH.rounds; round++) {
    const last = round === RESEARCH.rounds - 1 || searches.length >= RESEARCH.searches;
    const { body } = await ask().catch(async (e) => {
      // a thinking block the API won't take back (another model answered a round, for one): the earlier replies go
      // back without their thinking, and the research goes on
      if (!/signature|thinking/i.test(e instanceof Error ? e.message : String(e))) throw e;
      for (const m of messages) if (m.role === "assistant" && Array.isArray(m.content)) m.content = (m.content as { type: string }[]).filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking");
      return ask();
    });
    usd += claudeCost(withModel(body.usage as ClaudeUsage, body.model, model));
    const content = (body.content ?? []) as { type: string; id?: string; name?: string; input?: { query?: string; scope?: string }; text?: string }[];
    const text = content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    const calls = content.filter((b) => b.type === "tool_use" && b.name === TOOL.name);
    if (last || body.stop_reason !== "tool_use" || !calls.length) {
      notes = text;
      break;
    }
    messages.push({ role: "assistant", content });
    const results = await Promise.all(
      calls.map(async (c) => {
        const query = String(c.input?.query ?? "").slice(0, 200);
        const scope = c.input?.scope === "complements" ? "complements" : "primary";
        if (searches.length >= RESEARCH.searches) return { id: c.id!, text: "انتهى عدد البحوث المسموح؛ اكتب ملاحظاتك الآن." };
        const found = await searchScoped(query, scope, 8).catch((e) => {
          console.error("islamic research search", e);
          return [] as Passage[];
        });
        searches.push({ query, scope, hits: found.length });
        const lines = found.map((p) => {
          let n = byChunk.get(p.chunk_id);
          if (n === undefined && kept.length < RESEARCH.keep) {
            kept.push(p);
            n = kept.length;
            byChunk.set(p.chunk_id, n);
          }
          return n === undefined ? "" : `[${n}] (${label(p)})\n${p.text}`;
        }).filter(Boolean);
        return { id: c.id!, text: lines.length ? lines.join("\n\n────\n\n") : "لا شيء بهذه الكلمات؛ جرّب ألفاظًا أخرى أو المصدر الآخر." };
      }),
    );
    const next = round + 1 === RESEARCH.rounds - 1 || searches.length >= RESEARCH.searches;
    messages.push({
      role: "user",
      content: [
        ...results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.text })),
        ...(next ? [{ type: "text", text: "هذه آخر جولة: لا تبحث مرة ثانية، اكتب ملاحظاتك الآن مما وجدته." }] : []),
      ],
    });
  }

  // the writer gets them with the same numbers the researcher saw (the primary source is searched first)
  return { passages: kept, notes, searches, usd };
}
