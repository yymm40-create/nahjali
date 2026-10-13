import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost } from "./anthropic";
import { managedAgentConfigured, managedAgentTurn, managedJson } from "@/lib/managed-agent";
import { getOwnedProject } from "./access";
import { requireSeries } from "./series";

const db = () => createAdminClient();
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const KINDS = ["scene", "film", "series"] as const;
export type JourneyKind = (typeof KINDS)[number];

export interface JourneyIntake {
  title: string;
  concept: string;
  understanding: string;
  fixedFacts: string[];
  targetDurationSec: number | null;
  characters: { name: string; description: string }[];
  places: { name: string; description: string }[];
  scenePlan: { number: number; title: string; summary: string; goal: string; transition: string }[];
  episodePlan: { number: number; title: string; summary: string; scenes: string[] }[];
  questions: { id: string; question: string; why: string; options: string[]; required: boolean }[];
}

export interface JourneyIntakeBody {
  draftId?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  kind?: unknown;
  title?: unknown;
  story?: unknown;
  fixedFacts?: unknown;
  targetDurationSec?: unknown;
  answers?: unknown;
  previous?: unknown;
  intake?: unknown;
  action?: unknown;
}

const string = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "concept", "understanding", "fixedFacts", "targetDurationSec", "characters", "places", "scenePlan", "episodePlan", "questions"],
  properties: {
    title: string,
    concept: string,
    understanding: string,
    fixedFacts: { type: "array", items: string },
    targetDurationSec: { anyOf: [{ type: "integer" }, { type: "null" }] },
    characters: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "description"], properties: { name: string, description: string } } },
    places: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "description"], properties: { name: string, description: string } } },
    scenePlan: { type: "array", items: { type: "object", additionalProperties: false, required: ["number", "title", "summary", "goal", "transition"], properties: { number: { type: "integer" }, title: string, summary: string, goal: string, transition: string } } },
    episodePlan: { type: "array", items: { type: "object", additionalProperties: false, required: ["number", "title", "summary", "scenes"], properties: { number: { type: "integer" }, title: string, summary: string, scenes: { type: "array", items: string } } } },
    questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "question", "why", "options", "required"], properties: { id: string, question: string, why: string, options: { type: "array", items: string }, required: { type: "boolean" } } } },
  },
} as const;

const cleanKind = (value: unknown): JourneyKind => (KINDS.includes(value as JourneyKind) ? (value as JourneyKind) : "scene");

export function normalizeJourneyIntake(value: unknown): JourneyIntake {
  if (!value || typeof value !== "object") throw new UserError("فهم سجاد غير مكتمل؛ أعد المحاولة.", 502);
  const raw = value as Partial<JourneyIntake>;
  const rows = <T>(input: unknown, map: (item: Record<string, unknown>, index: number) => T) => (Array.isArray(input) ? input : []).filter((item): item is Record<string, unknown> => !!item && typeof item === "object").slice(0, 60).map(map);
  return {
    title: text(raw.title, 80),
    concept: text(raw.concept, 20000),
    understanding: text(raw.understanding, 5000),
    fixedFacts: (Array.isArray(raw.fixedFacts) ? raw.fixedFacts : []).map((item) => text(item, 500)).filter(Boolean).slice(0, 20),
    targetDurationSec: Number.isInteger(raw.targetDurationSec) && Number(raw.targetDurationSec) > 0 && Number(raw.targetDurationSec) <= 3600 ? Number(raw.targetDurationSec) : null,
    characters: rows(raw.characters, (item) => ({ name: text(item.name, 100), description: text(item.description, 1000) })).filter((item) => item.name),
    places: rows(raw.places, (item) => ({ name: text(item.name, 100), description: text(item.description, 1000) })).filter((item) => item.name),
    scenePlan: rows(raw.scenePlan, (item, index) => ({ number: index + 1, title: text(item.title, 100) || `مشهد ${index + 1}`, summary: text(item.summary, 2000), goal: text(item.goal, 500), transition: text(item.transition, 500) })),
    episodePlan: rows(raw.episodePlan, (item, index) => ({ number: index + 1, title: text(item.title, 100) || `حلقة ${index + 1}`, summary: text(item.summary, 2000), scenes: (Array.isArray(item.scenes) ? item.scenes : []).map((scene) => text(scene, 500)).filter(Boolean).slice(0, 60) })),
    questions: rows(raw.questions, (item, index) => ({ id: text(item.id, 80) || `q${index + 1}`, question: text(item.question, 500), why: text(item.why, 500), options: (Array.isArray(item.options) ? item.options : []).map((option) => text(option, 200)).filter(Boolean).slice(0, 3), required: item.required !== false })).filter((item) => item.question).slice(0, 4),
  };
}

async function existingContext(userId: string, targetType: string, targetId: string) {
  if (!targetId) return "";
  if (targetType === "series") {
    const { series } = await requireSeries(targetId, userId, true);
    const [{ data: episodes }, { data: scenes }] = await Promise.all([
      db().from("film_episodes").select("number,title").eq("series_id", series.id).order("number"),
      db().from("film_projects").select("title,story,scene_number,stage").eq("series_id", series.id).order("scene_number"),
    ]);
    return `مشروع قديم مطلوب تحويله دون حذف شيء:\nالنوع: مسلسل\nالاسم: ${series.title}\nالوصف: ${series.about}\nدليل المسلسل: ${series.bible ?? ""}\nالستايل: ${series.style ?? ""}\nالحلقات: ${JSON.stringify(episodes ?? []).slice(0, 5000)}\nالمشاهد الموجودة: ${JSON.stringify(scenes ?? []).slice(0, 9000)}`;
  }
  const project = await getOwnedProject(targetId, userId, "all");
  if (project.user_id !== userId || project.series_id) throw new UserError("التحويل متاح لصاحب المشروع المستقل فقط.", 403);
  const [{ data: versions }, { count: messages }] = await Promise.all([
    db().from("film_versions").select("stage,kind,status,body").eq("project_id", project.id).order("created_at").limit(30),
    db().from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id),
  ]);
  return `مشروع قديم مطلوب تحويله دون حذف شيء:\nالنوع المسجل: ${(project as { kind?: string }).kind ?? "scene"}\nالعنوان: ${project.title}\nالقصة: ${project.story}\nالثوابت: ${project.fixed_facts}\nالمدة: ${project.target_duration_sec ?? "غير محددة"}\nالمرحلة: ${project.stage}\nبدأ العمل: ${(messages ?? 0) > 0 ? "نعم" : "لا"}\nالمخرجات الموجودة: ${JSON.stringify(versions ?? []).slice(0, 12000)}`;
}

export async function understandJourney(user: { id: string; email?: string | null }, body: JourneyIntakeBody) {
  const kind = cleanKind(body.kind);
  const targetType = body.targetType === "series" ? "series" : body.targetType === "project" ? "project" : "draft";
  const targetId = text(body.targetId, 80);
  const draftId = text(body.draftId, 120) || targetId || crypto.randomUUID();
  const context = await existingContext(user.id, targetType, targetId);
  const answers = body.answers && typeof body.answers === "object" ? JSON.stringify(body.answers).slice(0, 8000) : "{}";
  const previous = body.previous && typeof body.previous === "object" ? JSON.stringify(body.previous).slice(0, 16000) : "{}";
  const prompt = `أنت سجاد في بوابة الرحلة السينمائية الجديدة. مهمتك الآن الفهم والتحقق فقط، لا تبدأ كتابة السيناريو ولا تولّد صورًا أو فيديو.

نوع العمل: ${kind === "scene" ? "مشهد قصير مستقل" : kind === "film" ? "فيلم سينمائي كامل" : "مسلسل كامل"}
العنوان المبدئي: ${text(body.title, 80)}
فكرة المستخدم/قصته: ${text(body.story, 20000)}
الثوابت التي كتبها: ${text(body.fixedFacts, 5000)}
المدة المقترحة: ${text(body.targetDurationSec, 20) || "غير محددة"}
إجابات المستخدم على أسئلتك السابقة: ${answers}
فهمك السابق الذي يجب تحديثه بدل البدء من الصفر: ${previous}
${context ? `\n${context}` : ""}

القواعد:
- حافظ على فكرة المستخدم ونهايته وما أنجزه سابقًا. لا تستبدله ولا تخترع قرارًا.
- اختصر الطريق من دون تخمين: اسأل فقط عن معلومة تؤثر فعلًا على القصة أو الاستمرارية أو الدقة أو تكلفة التنفيذ.
- بحد أقصى 4 أسئلة في المرور، وكل سؤال له 2–3 خيارات قصيرة والموصى به أولًا. إذا كتب المستخدم أنه لا يعرف، اقترح قرارًا واضحًا لكنه يبقى سؤالًا حتى يختاره.
- إذا أجاب عن نقطة، ادمجها ولا تسألها مرة أخرى. إذا لا توجد نقاط مانعة، questions تكون فارغة.
- المشهد القصير: لحظة واحدة ومكان/هدف واضح ونهاية داخل المشهد؛ scenePlan عنصر واحد.
- الفيلم: بداية وتحول وذروة ونهاية، وخريطة مشاهد مترابطة في scenePlan. لا تختصر عدد المشاهد على حساب المنطق أو الجودة.
- المسلسل: عالم وقوس كبير وشخصيات ثابتة، وخطة أولية للحلقات في episodePlan، وكل مشهد لاحق يمر بنفس رحلة المشهد الواحد.
- لا تستخدم أسماء فنانين أحياء كاختصار للستايل.
- understanding ملخص عربي بسيط لما فهمته وما سيُثبّت بعد التأكيد.
- concept صياغة كاملة أمينة تصلح لتسليمها للسيناريست، وليست فكرة جديدة منك.
- fixedFacts للقرارات التي يجب ألا تتغير فقط.

أعد JSON فقط مطابقًا للمخطط:
${JSON.stringify(SCHEMA)}`;

  if (managedAgentConfigured()) {
    try {
      const managed = await managedAgentTurn({ userId: user.id, contextType: "sajjad", contextKey: `intake:${targetType}:${draftId}`.slice(0, 200), title: `سجاد · تجهيز ${kind}`, content: [{ type: "text", text: prompt }], timeoutMs: 115_000 });
      return { intake: normalizeJourneyIntake(managedJson<JourneyIntake>(managed.text)), usd: managed.usd };
    } catch (error) {
      console.error("managed intake fallback", String(error).slice(0, 300));
    }
  }
  const fallback = await callClaudeJson<JourneyIntake>({ system: "أنت سجاد في بوابة رحلة صناعة الأفلام. لا تخمّن، وافصل الأسئلة المانعة عن الفهم المؤكد.", turns: [{ role: "user", content: prompt }], schema: SCHEMA, maxTokens: 12000, effort: "medium" });
  return { intake: normalizeJourneyIntake(fallback.data), usd: claudeCost(fallback.usage) };
}

export function journeyIntakeText(intake: JourneyIntake) {
  const parts = [`فهم سجاد المعتمد للرحلة الجديدة:\n${intake.understanding}`, `الصياغة المعتمدة:\n${intake.concept}`];
  if (intake.fixedFacts.length) parts.push(`ثوابت لا تتغير:\n${intake.fixedFacts.map((fact) => `- ${fact}`).join("\n")}`);
  if (intake.characters.length) parts.push(`الشخصيات:\n${intake.characters.map((item) => `- ${item.name}: ${item.description}`).join("\n")}`);
  if (intake.places.length) parts.push(`البيئات:\n${intake.places.map((item) => `- ${item.name}: ${item.description}`).join("\n")}`);
  if (intake.scenePlan.length) parts.push(`خريطة المشاهد:\n${intake.scenePlan.map((scene) => `${scene.number}. ${scene.title}: ${scene.summary} | الهدف: ${scene.goal} | الانتقال: ${scene.transition}`).join("\n")}`);
  if (intake.episodePlan.length) parts.push(`خريطة الحلقات:\n${intake.episodePlan.map((episode) => `${episode.number}. ${episode.title}: ${episode.summary} | المشاهد: ${episode.scenes.join("، ")}`).join("\n")}`);
  return parts.join("\n\n").slice(0, 20000);
}

export async function confirmJourneyUpgrade(userId: string, body: JourneyIntakeBody) {
  const intake = normalizeJourneyIntake(body.intake);
  if (intake.questions.some((question) => question.required)) throw new UserError("كمّل أسئلة سجاد المانعة قبل التحويل.", 409);
  const targetId = text(body.targetId, 80);
  const targetType = body.targetType === "series" ? "series" : "project";
  if (targetType === "series") {
    const { series } = await requireSeries(targetId, userId, true);
    const pendingPlan = intake.episodePlan.length ? {
      note: "خطة التحويل إلى الرحلة الجديدة التي أكدها المستخدم مع سجاد.",
      episodes: intake.episodePlan.map((episode) => ({ number: episode.number, title: episode.title, summary: episode.summary, scenes: episode.scenes.map((scene) => ({ title: scene.slice(0, 80), brief: scene, assignee: "" })) })),
    } : null;
    const patch: Record<string, unknown> = { workflow_version: 2, intake, ...(pendingPlan ? { pending_plan: pendingPlan } : {}) };
    if (!series.about.trim()) patch.about = intake.concept.slice(0, 4000);
    if (!series.bible?.trim()) patch.bible = journeyIntakeText(intake).slice(0, 30000);
    const { error } = await db().from("film_series").update(patch).eq("id", series.id);
    if (error) throw error;
    if (pendingPlan) {
      const fresh = { ...series, pending_plan: pendingPlan };
      await (await import("./sajjad")).applyPlan(fresh, userId);
    }
    return { ok: true, reviewRequired: false };
  }
  const project = await getOwnedProject(targetId, userId, "all");
  if (project.user_id !== userId || project.series_id) throw new UserError("التحويل متاح لصاحب المشروع المستقل فقط.", 403);
  const { count } = await db().from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id);
  const started = (count ?? 0) > 0;
  const patch: Record<string, unknown> = { workflow_version: 2, intake, kind: cleanKind(body.kind) === "film" ? "film" : "scene" };
  if (!started) {
    patch.title = intake.title || project.title;
    patch.story = intake.concept || project.story;
    patch.fixed_facts = intake.fixedFacts.join("\n").slice(0, 5000) || project.fixed_facts;
    patch.target_duration_sec = intake.targetDurationSec ?? project.target_duration_sec;
  }
  const { error } = await db().from("film_projects").update(patch).eq("id", project.id);
  if (error) throw error;
  if (started) await db().from("film_versions").update({ stale: true }).eq("project_id", project.id).eq("status", "approved");
  return { ok: true, reviewRequired: started };
}
