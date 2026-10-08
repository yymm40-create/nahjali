// «الذكاء الإسلامي» — «الفهم»: the assistant reads a wide sample of the library and writes, with the places it took
// them from, two files for the owner to approve: the ethics and way of speaking (the persona), and how the sources
// reason (the analysis method). Drafts go to islamic_kv (persona_draft / analysis_draft); «اعتمد» copies a draft
// over the live file the answers use. Server only.

import { ISLAMIC_IDENTITY, ISLAMIC_KV } from "@config/islamic";
import { CLAUDE_MODEL, claudeCost, siteSystem, type ClaudeUsage } from "@/lib/film/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserError } from "@/lib/api";
import { kvAll, kvSet, NOT_READY } from "./library";

/** Chunks read in one training run, spread over the sources and kinds, and how many go into one Claude call. */
const SAMPLE = 72;
const PER_CALL = 18;

interface Chunk {
  id: number;
  text: string;
  title: string;
  kind: string;
  source: string;
  url: string;
}

/** A spread sample: the same share from each enabled source, and within it from each kind, picked at random. */
async function sample(): Promise<Chunk[]> {
  const db = createAdminClient();
  const { data: srcs, error } = await db.from("islamic_sources").select("id,name").eq("enabled", true);
  if (error) throw /relation|Could not find/i.test(error.message) ? new UserError(NOT_READY, 503) : error;
  const out: Chunk[] = [];
  const per = Math.max(8, Math.floor(SAMPLE / Math.max(1, srcs?.length ?? 1)));
  for (const s of (srcs ?? []) as { id: string; name: string }[]) {
    const { data: docs } = await db.from("islamic_docs").select("id,title,kind,url").eq("source_id", s.id).limit(4000);
    const byKind = new Map<string, { id: string; title: string; kind: string; url: string }[]>();
    for (const d of (docs ?? []) as { id: string; title: string; kind: string; url: string }[]) (byKind.get(d.kind) ?? byKind.set(d.kind, []).get(d.kind)!).push(d);
    const kinds = [...byKind.values()];
    if (!kinds.length) continue;
    const picked: { id: string; title: string; kind: string; url: string }[] = [];
    for (let i = 0; picked.length < per && i < per * 4; i++) {
      const list = kinds[i % kinds.length];
      const d = list[Math.floor(Math.random() * list.length)];
      if (d && !picked.some((x) => x.id === d.id)) picked.push(d);
    }
    const { data: chunks } = await db.from("islamic_chunks").select("id,doc_id,text").in("doc_id", picked.map((d) => d.id)).eq("n", 0);
    for (const c of (chunks ?? []) as { id: number; doc_id: string; text: string }[]) {
      const d = picked.find((x) => x.id === c.doc_id)!;
      out.push({ id: c.id, text: c.text.slice(0, 1600), title: d.title, kind: d.kind, source: s.name, url: d.url });
    }
  }
  return out;
}

const OBS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ethics", "speech", "analysis"],
  properties: {
    ethics: { type: "array", items: { type: "object", additionalProperties: false, required: ["point", "from"], properties: { point: { type: "string" }, from: { type: "array", items: { type: "integer" } } } }, description: "الأخلاق والتعامل كما تظهر في هذه النصوص: كيف يُخاطَب السائل، الرفق، التواضع، التعظيم، الصبر… كل نقطة معها أرقام النصوص التي أُخذت منها" },
    speech: { type: "array", items: { type: "object", additionalProperties: false, required: ["point", "from"], properties: { point: { type: "string" }, from: { type: "array", items: { type: "integer" } } } }, description: "طريقة الكلام: الافتتاح والختام، الألقاب والصيغ (الصلاة، عليه السلام…)، طول الجمل، الاقتباس، المفردات المميزة" },
    analysis: { type: "array", items: { type: "object", additionalProperties: false, required: ["point", "from"], properties: { point: { type: "string" }, from: { type: "array", items: { type: "integer" } } } }, description: "طريقة التفكير والاستدلال: ما يُقدَّم على ما، كيف تُوزن الأقوال، كيف يُرجَع إلى القرآن والحديث، كيف تُعالج الشبهة، كيف يُحال إلى المرجع" },
  },
};

const FILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["persona", "analysis"],
  properties: {
    persona: { type: "string", description: "ملف الأخلاق والأسلوب: نص عربي منظم بعناوين قصيرة ونقاط، يُكتب بصيغة الأمر للمساعد («تخاطب السائل بـ…»)، وكل نقطة في آخرها اسم المصدر الذي أُخذت منه بين قوسين. بلا مقدمات." },
    analysis: { type: "string", description: "منهج التحليل: خطوات التفكير التي يمر بها المساعد في كل سؤال قبل الجواب، مستخرجة من النصوص، بصيغة الأمر، وكل خطوة معها اسم المصدر بين قوسين. بلا مقدمات." },
  },
};

async function call<T>(system: string, user: string, schema: object, maxTokens: number): Promise<{ data: T; usd: number }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system: siteSystem(system), messages: [{ role: "user", content: [{ type: "text", text: user }] }], output_config: { effort: "medium", format: { type: "json_schema", schema } } }),
    signal: AbortSignal.timeout(200_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${body?.error?.message ?? "request failed"}`);
  if (body.stop_reason === "refusal") throw new Error("Claude declined this request");
  const raw = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return { data: JSON.parse(raw) as T, usd: claudeCost(body.usage as ClaudeUsage) };
}

const READ_SYSTEM = `${ISLAMIC_IDENTITY}

مهمتك الآن ليست الجواب بل الفهم: تقرأ نصوصًا من مكتبة المصادر وتستخرج منها، بأمانة ومن النصوص نفسها لا من عندك، كيف يتخلّق أصحابها وكيف يتكلمون وكيف يفكرون ويستدلون. اذكر مع كل ملاحظة أرقام النصوص التي أُخذت منها. لا تذكر اسم المذهب. اكتب بالعربية.`;

const MERGE_SYSTEM = `${ISLAMIC_IDENTITY}

مهمتك الآن: أمامك ملاحظات استُخرجت من نصوص المكتبة (الأخلاق، طريقة الكلام، طريقة التحليل)، مع اسم مصدر كل ملاحظة. اجمعها في ملفين يصيران جزءًا من شخصية المساعد في كل جواب: ملف الأخلاق والأسلوب، وملف منهج التحليل. ادمج المكرر، ورتّب تحت عناوين قصيرة، واكتب بصيغة الأمر للمساعد، وأبقِ اسم المصدر في آخر كل نقطة. المساعد يأخذ الأسلوب والخُلق ولا ينتحل شخصية أحد: لا يتكلم بلسان شخص بعينه. لا تذكر اسم المذهب. بلا مقدمات ولا خاتمة.`;

export interface TrainResult {
  chunks: number;
  usd: number;
  persona: string;
  analysis: string;
}

/** One training run: reads the sample, extracts, merges, and saves the drafts for the owner to look at. */
export async function train(): Promise<TrainResult> {
  const chunks = await sample();
  if (chunks.length < 6) throw new UserError("المكتبة ما فيها نصوص كافية بعد. خلّ القراءة تكمل شوي ثم جرّب.");
  let usd = 0;
  const batches: Chunk[][] = [];
  for (let i = 0; i < chunks.length; i += PER_CALL) batches.push(chunks.slice(i, i + PER_CALL));
  const observed = await Promise.all(
    batches.map(async (b) => {
      const text = b.map((c, i) => `[${i + 1}] (${c.source} — ${c.kind} — ${c.title})\n${c.text}`).join("\n\n────\n\n");
      const r = await call<{ ethics: { point: string; from: number[] }[]; speech: { point: string; from: number[] }[]; analysis: { point: string; from: number[] }[] }>(READ_SYSTEM, `النصوص:\n\n${text}`, OBS_SCHEMA, 6000);
      usd += r.usd;
      const name = (n: number) => b[n - 1]?.source ?? "";
      const line = (x: { point: string; from: number[] }) => `- ${x.point} (${[...new Set(x.from.map(name).filter(Boolean))].join("، ") || "المكتبة"})`;
      return { ethics: r.data.ethics.map(line), speech: r.data.speech.map(line), analysis: r.data.analysis.map(line) };
    }),
  );
  const notes = `الأخلاق والتعامل:\n${observed.flatMap((o) => o.ethics).join("\n")}\n\nطريقة الكلام:\n${observed.flatMap((o) => o.speech).join("\n")}\n\nطريقة التحليل والاستدلال:\n${observed.flatMap((o) => o.analysis).join("\n")}`;
  const merged = await call<{ persona: string; analysis: string }>(MERGE_SYSTEM, `الملاحظات المستخرجة:\n\n${notes}`, FILE_SCHEMA, 8000);
  usd += merged.usd;
  const stamp = `\n\n— استُخرج في ${new Date().toISOString().slice(0, 10)} من ${chunks.length} نصًا، بتكلفة $${usd.toFixed(2)}.`;
  await kvSet(ISLAMIC_KV.personaDraft, merged.data.persona.trim() + stamp);
  await kvSet(ISLAMIC_KV.analysisDraft, merged.data.analysis.trim() + stamp);
  return { chunks: chunks.length, usd, persona: merged.data.persona, analysis: merged.data.analysis };
}

/** «اعتمد»: the draft becomes the file the answers use. */
export async function approve(which: "persona" | "analysis") {
  const kv = await kvAll();
  const draft = kv[which === "persona" ? ISLAMIC_KV.personaDraft : ISLAMIC_KV.analysisDraft] ?? "";
  if (!draft.trim()) throw new UserError("ما فيه مسودة بعد: اضغط «استخرج» أولًا.");
  await kvSet(which === "persona" ? ISLAMIC_KV.persona : ISLAMIC_KV.analysis, draft);
}
