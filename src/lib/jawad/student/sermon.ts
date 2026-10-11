// «الخطيب الذكي» — «خطبة المنبر» by the owner's method «المرجعية المأمونة»: the material first, then THREE topics each with a key
// verse and a takhallus point (the preacher picks one), then the verse's tafsir from مجمع البيان (the book's own words, put in
// plain words), then the poetry, then the four parts. The steps of the method are the steps here. Server only.

import { SERMON_MAX_AYAT, SERMON_PARTS, readSermonLength } from "@config/jawad/khateeb";
import { findTafsir } from "@/lib/khateeb/tafsir";
import { passage } from "@/lib/khateeb/quran";
import { askJson, claudeCeilingUsd } from "./claude";
import { allText, basedOn, loadCtx, researchText, scopeRules, understandingText, type Ctx } from "./context";
import { getOutput, saveOutput, type Output } from "./db";
import type { Handler, Job, StepResult } from "./jobs";
import { emptyImage, type DocPlan, type SermonTopic } from "./model";

const str = { type: "string" };
const int = { type: "integer" };

const TOPICS_SCHEMA = {
  type: "object",
  properties: {
    title: str,
    subtitle: str,
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: { title: str, idea: str, surah: int, ayahFrom: int, ayahTo: int, kooriz: str },
        required: ["title", "idea", "surah", "ayahFrom", "ayahTo", "kooriz"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "subtitle", "topics"],
  additionalProperties: false,
};

/** The method's step 2: three distinct topics from the material, each with its key verse and its takhallus point. */
export async function sermonPlanStep(o: Output, c: Ctx, base: string, studentFirst: string): Promise<StepResult> {
  const length = readSermonLength(o.settings.length);
  const r = await askJson<{ title: string; subtitle: string; topics: { title: string; idea: string; surah: number; ayahFrom: number; ayahTo: number; kooriz: string }[] }>({
    system: `You are preparing a SERMON for the minbar by the owner's method «المرجعية المأمونة» (in the rules below). This is its STEP 2, the thematic brainstorm and the Quranic link: propose THREE distinct minbar topics that suit the occasion, drawn ONLY from the historical text of the material (never from your own memory of history) — deep ideas joined to the Quran, not a plain retelling.\nFor each topic give: title = the pivot idea (فكرة المحور), short · idea = the subject of its treatment (موضوع المعالجة), 2–3 sentences · surah and ayahFrom/ayahTo = the verse that suits to be its key and its opening: ONLY the surah's number and the verse numbers (at most ${SERMON_MAX_AYAT} verses) — NEVER write the verse's words, the site fetches them from the Quran · kooriz = the takhallus point (نقطة التخلص), 1–2 sentences, that joins the topic to the calamity of martyrdom in the material.\nAlso return the sermon's working title and a one-line subtitle (the occasion). The three topics must differ from each other in idea and in verse. The sermon will be ${length.label} (about ${length.minutes} minutes spoken).\n${studentFirst}\n${scopeRules(c)}`,
    parts: [{ type: "text", text: `${base}\n\nUNDERSTANDING:\n${understandingText(c)}\n\nMATERIAL:\n${allText(c)}\n${researchText(c)}` }],
    schema: TOPICS_SCHEMA,
    effort: "medium",
  });

  // the verses as the Quran has them (a number that is not a verse drops its topic)
  const verses = await Promise.all(r.data.topics.slice(0, 3).map((t) => passage(t.surah, t.ayahFrom, t.ayahTo).catch(() => null)));
  const topics: SermonTopic[] = [];
  r.data.topics.slice(0, 3).forEach((t, i) => {
    const verse = verses[i];
    if (verse) topics.push({ title: t.title.trim(), idea: t.idea.trim(), kooriz: t.kooriz.trim(), verse: { surah: verse.surah, from: verse.from, to: verse.to, ref: verse.ref, text: verse.text } });
  });
  if (!topics.length) throw new Error("ما قدر الشيخ يجهّز مواضيع بآيات صحيحة هالمرة. جرّب «اعرض الخطة» مرة ثانية.");

  const all = [...c.seg.keys()];
  const plan: DocPlan = {
    title: r.data.title.trim() || c.understanding.topic,
    subtitle: r.data.subtitle.trim(),
    // the four parts of the method, in its order and with its names; each draws on the whole material
    chapters: SERMON_PARTS.map((p) => ({ title: p.title, purpose: p.role, segments: all, image: emptyImage() })),
    sermon: { topics, chosen: -1, tafsir: null },
  };
  await saveOutput(o.id, { plan, plan_approved: false, status: "plan_review", content: null, based_on: basedOn(c) }, { kind: "plan", snapshot: plan, userId: o.user_id });
  return { done: true, usd: r.usd, stage: "الخطة جاهزة: اختر موضوع الخطبة" };
}

/** What a tafsir lookup may cost at most (the pages read, then put in plain words). */
export const tafsirCeilingUsd = () => claudeCeilingUsd(40_000, 3000);

const TAFSIR_SCHEMA = { type: "object", properties: { simple: str }, required: ["simple"], additionalProperties: false };

/** The method's step 3: the verse's tafsir from مجمع البيان — its pages found, read and put in plain words, with the pages marked. */
async function tafsirStep(job: Job): Promise<StepResult> {
  const o = await getOutput(job.user_id, job.output_id!);
  const plan = o.plan as DocPlan | null;
  const sp = plan?.sermon;
  const topic = sp && sp.chosen >= 0 ? sp.topics[sp.chosen] : null;
  if (!plan || !sp || !topic) throw new Error("اختر موضوع الخطبة أول.");
  const { verse } = topic;
  const f = await findTafsir(verse.surah, verse.from, verse.text);
  if (!f) throw new Error("ما لقينا صفحات تفسير هذي الآية في مجمع البيان تلقائيًا. الصق المقطع من التفسير بنفسك (من نفس الكتاب أو من الأمثل أو الميزان) تحت.");
  const pages = f.pages.map((p) => `[ص${p.label}]\n${p.text}`).join("\n\n");
  const c = await loadCtx(job.user_id, o.project_id);
  const r = await askJson<{ simple: string }>({
    system: `You put the tafsir of a verse in plain words for a preacher. You are given the pages of «مجمع البيان في تفسير القرآن» by الطبرسي around this verse, each marked with its printed page number [ص…]. Take from them ONLY what the book says about THIS verse: its meaning, the reason of its revelation when the book gives one, and the narrations or sayings the book cites that bear on its message. Then write it in clear, simple modern Arabic: first the verse's central message in two sentences; then the book's points one after another, each ending with its page between brackets like (ص١٥٦), and a short key phrase of the book in quotation marks, copied EXACTLY, where its own wording matters. NEVER add anything that is not in the pages — no explanation of your own, no other tafsir, no narration the pages do not have; if the pages say little about this verse, say so plainly. About 250–450 words. Do not repeat the verse's words at length.\n${scopeRules(c)}`,
    parts: [{ type: "text", text: `THE VERSE (${verse.ref}):\n${verse.text}\n\nTHE PAGES OF مجمع البيان (${f.source}):\n${pages.slice(0, 60_000)}` }],
    schema: TAFSIR_SCHEMA,
    maxTokens: 6000,
    effort: "low",
  });
  const fresh = (await getOutput(job.user_id, job.output_id!)).plan as DocPlan;
  if (!fresh.sermon || fresh.sermon.chosen !== sp.chosen) return { done: true, usd: r.usd, stage: "تغيّر الموضوع أثناء الجلب" };
  const next: DocPlan = { ...fresh, sermon: { ...fresh.sermon, tafsir: { source: f.source, url: f.url, excerpt: pages.slice(0, 60_000), simple: r.data.simple.trim(), manual: false } } };
  await saveOutput(o.id, { plan: next, plan_approved: false, error: null }, { kind: "plan_edit", snapshot: next, userId: o.user_id });
  return { done: true, usd: r.usd, stage: "التفسير جاهز" };
}

export const tafsirHandler: Handler = {
  label: "جلب التفسير",
  step: tafsirStep,
  onFail: async (job, message) => {
    if (job.output_id) await saveOutput(job.output_id, { error: message });
  },
};

/** What the writer of one part is told: the chosen topic, the verse as the Quran has it, the tafsir, the takhallus point, the poetry asked for, and this part's role. */
export function sermonBrief(plan: DocPlan, o: Output, i: number): string {
  const sp = plan.sermon;
  const topic = sp && sp.chosen >= 0 ? sp.topics[sp.chosen] : null;
  const part = SERMON_PARTS[i];
  const s = o.settings;
  const poems = String(s.poems ?? "").trim();
  const poemsFor = String(s.poemsFor ?? "").trim();
  return [
    topic
      ? `THE TOPIC THE PREACHER CHOSE (the whole sermon serves it):\n- pivot idea: ${topic.title}\n- its treatment: ${topic.idea}\n- the takhallus point (الكَوْريز) that joins it to the calamity: ${topic.kooriz}`
      : "",
    topic ? `THE KEY VERSE — verified from the Quran, quote it EXACTLY as it is here, in a "quote" block (title: its reference), and never change a word:\n${topic.verse.text}\n(${topic.verse.ref})` : "",
    sp?.tafsir
      ? `THE TAFSIR OF THE VERSE (${sp.tafsir.source}) — the only source of the verse's meaning; take the verse's message from it, and when you rest on it say so briefly (قال الطبرسي في مجمع البيان …) with its page; never add another interpretation:\n${sp.tafsir.simple}`
      : "NO TAFSIR WAS GIVEN for the verse: say nothing about its meaning beyond its plain wording, and never interpret it from your own knowledge.",
    poemsFor || poems
      ? `POETRY (step 4)${poemsFor ? `, the purpose asked for: ${poemsFor}` : ""}:${poems ? `\nthe preacher's own lines, to be used as written, with their poet when he gives one:\n${poems}` : ""}\nUse only these lines, and the owner's collection in the rules; if none suits, use no poetry — never make up a line or put a line in a poet's name from memory.`
      : "POETRY: use only lines from the owner's collection in the rules, when one suits; never make up a line or put a line in a poet's name from memory.",
    part ? `THIS PART — ${part.title}: ${part.role}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
