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
import { emptyImage, type DocPlan, type SermonPoem, type SermonTopic } from "./model";
import { hasReference, searchRef, type RefPage } from "@/lib/khateeb/reference";
import { norm } from "@/lib/khateeb/tafsir";

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

// ───────────────────────────── the poetry (the method's step 4) ─────────────────────────────

const strs = { type: "array", items: str };
const KEYWORDS_SCHEMA = { type: "object", properties: { keywords: strs }, required: ["keywords"], additionalProperties: false };
const PICK_SCHEMA = {
  type: "object",
  properties: { items: { type: "array", items: { type: "object", properties: { tag: str, text: str, poet: str, why: str }, required: ["tag", "text", "poet", "why"], additionalProperties: false } } },
  required: ["items"],
  additionalProperties: false,
};

/** What lines may cost at most (a few words to search with, then the best pages read and lines picked). */
export const poemsCeilingUsd = () => claudeCeilingUsd(50_000, 5000) + claudeCeilingUsd(1000, 800);

/** The lines of `text` that are really on the page (compared without marks and alef spellings); the others are dropped. */
export function onPage(text: string, page: { text: string }): string {
  const here = norm(page.text);
  const whole = norm(text);
  if (whole && here.includes(whole)) return text.trim();
  return text
    .split("\n")
    .filter((l) => {
      const n = norm(l);
      return n.length >= 6 && here.includes(n);
    })
    .join("\n")
    .trim();
}

/** The method's step 4 from the owner's reference: words are searched for, the best pages read, and lines picked that are really on them. */
async function poemsStep(job: Job): Promise<StepResult> {
  const o = await getOutput(job.user_id, job.output_id!);
  const plan = o.plan as DocPlan | null;
  const sp = plan?.sermon;
  const topic = sp && sp.chosen >= 0 ? sp.topics[sp.chosen] : null;
  if (!plan || !sp || !topic) throw new Error("اختر موضوع الخطبة أول.");
  if (!(await hasReference())) throw new Error("ما فيه مرجع أشعار جاهز: ارفعه واقرأه من لوحة الجواد (الخطيب الذكي).");
  const ask = String(job.input.ask ?? "").trim().slice(0, 500);
  const purpose = [String(o.settings.poemsFor ?? "").trim(), ask].filter(Boolean).join("؛ ");
  const c = await loadCtx(job.user_id, o.project_id);
  const theme = `the sermon's pivot idea: ${topic.title}\nits treatment: ${topic.idea}\nthe takhallus point: ${topic.kooriz}\nthe key verse: ${topic.verse.ref}\nthe poetry asked for: ${purpose || "(none said: lines that serve the idea)"}`;

  const kw = await askJson<{ keywords: string[] }>({
    system: "You help find lines of Arabic poetry in a reference by searching its text. Give 8–12 single Arabic words (roots or common forms, no particles, no phrases) that would appear in verses on this theme: the idea itself, its opposite, and the images the classical poets used for it. Words only.",
    parts: [{ type: "text", text: theme }],
    schema: KEYWORDS_SCHEMA,
    maxTokens: 600,
    effort: "low",
  });
  const pages = (await searchRef(kw.data.keywords, 10)).filter((p) => p.text.trim());
  if (!pages.length) throw new Error("ما لقينا في المرجع أبياتًا قريبة من هذا الموضوع. جرّب غرضًا ثانيًا (مثل: الصبر، العلم) أو أضف أبياتك بنفسك.");

  const tagged = pages.map((p, i) => ({ tag: `P${i + 1}`, p }));
  const r = await askJson<{ items: { tag: string; text: string; poet: string; why: string }[] }>({
    system: `You choose lines of poetry for a sermon from the pages of a reference book. Pick at most 8 passages (each 1–4 verses) that really serve the theme. Copy each passage WORD FOR WORD from its page, with its diacritics as printed — never change, complete, fix or invent a word; a line you cannot copy exactly is not picked. "tag" is the page's tag; "poet" is the poet's name ONLY when the page prints it (else an empty string); "why" is one short line in Arabic on how it serves the sermon. Prefer fewer, strong lines over many.\n${scopeRules(c)}`,
    parts: [{ type: "text", text: `THE THEME:\n${theme}\n\nTHE PAGES:\n${tagged.map(({ tag, p }) => `<page tag="${tag}">\n${p.text.slice(0, 6000)}\n</page>`).join("\n")}` }],
    schema: PICK_SCHEMA,
    maxTokens: 6000,
    effort: "low",
  });

  const poems: SermonPoem[] = [];
  const seen = new Set<string>();
  for (const it of r.data.items.slice(0, 8)) {
    const page: RefPage | undefined = tagged.find((t) => t.tag === it.tag)?.p;
    if (!page) continue;
    const text = onPage(it.text, page);
    const key = norm(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    poems.push({ text, poet: it.poet.trim().slice(0, 100), page: page.label, ref: page.title, why: it.why.trim().slice(0, 300) });
  }
  if (!poems.length) throw new Error("الأبيات اللي اختارها الشيخ ما طابقت نص المرجع حرفيًا فما اعتمدناها. جرّب مرة ثانية، أو أضف أبياتك بنفسك.");

  const usd = kw.usd + r.usd;
  const fresh = (await getOutput(job.user_id, job.output_id!)).plan as DocPlan;
  if (!fresh.sermon || fresh.sermon.chosen !== sp.chosen) return { done: true, usd, stage: "تغيّر الموضوع أثناء الجلب" };
  const next: DocPlan = { ...fresh, sermon: { ...fresh.sermon, poems } };
  await saveOutput(o.id, { plan: next, plan_approved: false, error: null }, { kind: "plan_edit", snapshot: next, userId: o.user_id });
  return { done: true, usd, stage: "الأبيات جاهزة" };
}

export const poemsHandler: Handler = {
  label: "اختيار الأبيات من المرجع",
  step: poemsStep,
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
    sp?.poems?.length
      ? `LINES FROM THE OWNER'S REFERENCE, checked word for word against their pages — the preacher approved them (step 4). Use them where they serve, each in a "quote" block with its text EXACTLY as given and its title = the poet when named, then the reference and its page exactly as written under the line (المرجع: …، ص…), so that the page number is printed in the finished sermon:\n${sp.poems.map((p, k) => `${k + 1}. ${p.text}\n   ${p.poet ? `الشاعر: ${p.poet} · ` : ""}المرجع: ${p.ref}، ص${p.page}${p.why ? ` · ${p.why}` : ""}`).join("\n")}\nUse no line from outside these, the preacher's own lines below, and the owner's collection in the rules.${poems ? `\nthe preacher's own lines, to be used as written, with their poet when he gives one:\n${poems}` : ""}`
      : poemsFor || poems
        ? `POETRY (step 4)${poemsFor ? `, the purpose asked for: ${poemsFor}` : ""}:${poems ? `\nthe preacher's own lines, to be used as written, with their poet when he gives one:\n${poems}` : ""}\nUse only these lines, and the owner's collection in the rules; if none suits, use no poetry — never make up a line or put a line in a poet's name from memory.`
        : "POETRY: use only lines from the owner's collection in the rules, when one suits; never make up a line or put a line in a poet's name from memory.",
    part ? `THIS PART — ${part.title}: ${part.role}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
