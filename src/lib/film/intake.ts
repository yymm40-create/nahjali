import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, type ClaudePart } from "./anthropic";
import { storyLink, storyPdf, storyUpload, isYoutubeLink } from "./story-link";
import { LESSON_INTAKE_RULES, lessonFormat, type LessonFormat } from "@config/film-lesson";
import { listenToFiles, listenToLinks } from "@/lib/link-listen";
import { isUuid, uploadViews, type UploadRow } from "@/lib/jawad/server/uploads";
import { getOwnedProject } from "./access";
import { requireSeries } from "./series";

const db = () => createAdminClient();
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const KINDS = ["scene", "film", "series", "lesson"] as const;
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
  /** «🎓 درس لطلابك» (config/film-lesson.ts): the lesson's plan — only a lesson has it, and it marks the project as one */
  lesson?: LessonPlan | null;
}

/** A lesson's plan as سجاد understood it: its one question, its points in order, the students, and its visual shape. */
export interface LessonPlan {
  format: LessonFormat;
  question: string;
  points: string[];
  audience: string;
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
  /** the Claude model the person chose (config/claude-models.ts) */
  model?: unknown;
  /** the story given as a YouTube link (lib/film/story-link): the person's upload of the video's frames, when the page
   * could download it */
  youtube?: { sheetId?: unknown } | null;
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

/** A lesson's gate: the same reply, plus the lesson's plan. */
const LESSON_SCHEMA = {
  ...SCHEMA,
  required: [...SCHEMA.required, "lesson"],
  properties: {
    ...SCHEMA.properties,
    lesson: {
      type: "object",
      additionalProperties: false,
      required: ["format", "question", "points", "audience"],
      properties: { format: { type: "string", enum: ["story", "model", "hypermotion"] }, question: string, points: { type: "array", items: string }, audience: string },
    },
  },
} as const;

/** A lesson plan as stored (null when there is none, or it is not one). */
export function normalizeLessonPlan(value: unknown): LessonPlan | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const format = lessonFormat(raw.format)?.id ?? "story";
  return {
    format,
    question: text(raw.question, 300),
    points: (Array.isArray(raw.points) ? raw.points : []).map((p) => text(p, 400)).filter(Boolean).slice(0, 8),
    audience: text(raw.audience, 200),
  };
}

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
    ...(normalizeLessonPlan(raw.lesson) ? { lesson: normalizeLessonPlan(raw.lesson) } : {}),
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
  const context = await existingContext(user.id, targetType, targetId);
  const answers = body.answers && typeof body.answers === "object" ? JSON.stringify(body.answers).slice(0, 8000) : "{}";
  const previous = body.previous && typeof body.previous === "object" ? JSON.stringify(body.previous).slice(0, 16000) : "{}";
  const lesson = kind === "lesson";
  const prompt = `نوع العمل: ${kind === "scene" ? "مشهد قصير مستقل" : kind === "film" ? "فيلم سينمائي كامل" : lesson ? "درس تعليمي لطلاب" : "مسلسل كامل"}
العنوان المبدئي: ${text(body.title, 80)}
فكرة المستخدم/قصته: ${text(body.story, 20000)}
الثوابت التي كتبها: ${text(body.fixedFacts, 5000)}
المدة المقترحة: ${text(body.targetDurationSec, 20) || "غير محددة"}
إجابات المستخدم على أسئلتك السابقة: ${answers}
فهمك السابق الذي يجب تحديثه بدل البدء من الصفر: ${previous}
${context ? `\n${context}` : ""}${lesson ? `\n\n${LESSON_INTAKE_RULES}` : ""}`;

  // one plain call: the rules are the (cached) system, the reply's shape is enforced by the schema. The Managed Agent path
  // added the whole prompt + schema to a session that kept every earlier pass, was priced as Opus whatever the person
  // chose, and on a failure paid twice
  // «🔗 رابط يوتيوب»: the video is looked at (its frames, downloaded by the page) and heard (its words), and the film is
  // built on it with the person's note — what he understood is shown for confirmation before anything is written
  const video = await watchLink(user.id, text(body.story, 20000), body.youtube);
  // «📄 ملف PDF»: the lesson's file itself, read by Claude (its pages, text and pictures)
  const pdf = await readPdf(user.id, text(body.story, 20000));
  const content: ClaudePart[] = [{ type: "text", text: prompt }];
  if (video) {
    content.push({ type: "text", text: video.text });
    if (video.sheetUrl) content.push({ type: "image", url: video.sheetUrl });
  }
  if (pdf) content.push({ type: "text", text: pdf.text }, { type: "doc", url: pdf.url, name: pdf.name });
  const r = await callClaudeJson<JourneyIntake>({ system: INTAKE_RULES, turns: [{ role: "user", content: video || pdf ? content : prompt }], schema: lesson ? LESSON_SCHEMA : SCHEMA, maxTokens: 12000, effort: "medium" });
  const intake = normalizeJourneyIntake(r.data);
  // a lesson always carries its plan (it marks the project as a lesson); anything else never does
  if (lesson) intake.lesson = intake.lesson ?? normalizeLessonPlan({});
  else delete intake.lesson;
  return { intake, usd: claudeCost(r.usage) + (video?.usd ?? 0) };
}

/**
 * «📄 ملف PDF» (the lesson path): the person's uploaded PDF and his note, for Claude to read as a document. null when the
 * story is not a PDF; a PDF way with no file yet is the person's to finish.
 */
async function readPdf(userId: string, story: string): Promise<{ text: string; url: string; name: string } | null> {
  const given = storyPdf(story);
  if (!given) return null;
  if (!given.pdf) throw new UserError("ارفع ملف الدرس (PDF) أول، وبعدها خل سجاد يفهمه.", 400);
  const file = await ownUpload(userId, given.pdf.fileId, "doc");
  if (!file) throw new UserError("ملف الدرس ما انلقى (ربما انحذف). ارفعه من جديد.", 400);
  const text = [
    "## الدرس ملف PDF",
    `المعلم ما كتب الدرس: أرفق ملفه («${given.pdf.name || file.name}») وتحته توضيحه: ${given.note ? `«${given.note}»` : "(ما كتب توضيح — افهم الدرس من الملف واختر أنت)"}.`,
    "الملف مرفق بعد هذا النص: اقرأه كله (نصه وصوره وجداوله) وابنِ فهمك عليه بأمانة. لا تنسخ اسم الملف ولا رقمه في concept.",
  ].join("\n\n");
  return { text, url: file.url, name: given.pdf.name || file.name };
}

/** One of the person's own uploads (owned, ready, of this kind), with a short-lived link. */
async function ownUpload(userId: string, id: unknown, kind: "image" | "video" | "doc") {
  if (!isUuid(id)) return null;
  const { data } = await db().from("jawad_uploads").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!data || (data as UploadRow).kind !== kind) return null;
  const view = (await uploadViews([data as UploadRow]))[0];
  return view?.url ? { url: view.url, name: view.fileName || (kind === "doc" ? "ملف" : "فيديو") } : null;
}

/**
 * The story given as a video — a YouTube link or the person's own upload (lib/film/story-link): its words (heard through
 * the link or the stored file, kept by the video's id so a re-check reads them back free) and its frames (the person's
 * upload of the frame sheet the page made), with what سجاد must do with them. null when the story was written.
 */
async function watchLink(userId: string, story: string, youtube: JourneyIntakeBody["youtube"]): Promise<{ text: string; sheetUrl: string | null; usd: number } | null> {
  const link = storyLink(story);
  const upload = link ? null : storyUpload(story);
  if (!link && !upload) return null;
  if (link && !isYoutubeLink(link.url)) throw new UserError("حط رابط فيديو يوتيوب صحيح. المتاح الحين روابط يوتيوب بس.", 400);
  if (upload && !upload.video) throw new UserError("ارفع الفيديو أول، وبعدها خل سجاد يفهمه.", 400);
  const note = (link ?? upload)!.note;
  const sheetId = link ? (youtube && typeof youtube === "object" ? youtube.sheetId : null) : upload!.video!.sheetId;
  const [heard, sheet] = await Promise.all([
    (async () => {
      if (link) return listenToLinks(link.url, [], { budgetMs: 90_000 });
      const video = await ownUpload(userId, upload!.video!.videoId, "video");
      if (!video) throw new UserError("الفيديو المرفوع ما انلقى (ربما انحذف). ارفعه من جديد.", 400);
      return listenToFiles([{ id: upload!.video!.videoId, kind: "video", name: video.name, url: video.url }], [], { budgetMs: 90_000 });
    })().catch((e) => {
      if (e instanceof UserError) throw e;
      return null;
    }),
    ownUpload(userId, sheetId, "image").catch(() => null),
  ]);
  const sheetUrl = sheet?.url ?? null;
  const what = link ? `رابط فيديو يوتيوب (${link.url})` : `فيديو رفعه من جهازه («${upload!.video!.name}»)`;
  const text = [
    "## القصة فيديو",
    `المستخدم ما كتب قصة: أعطاك ${what} لتبني فيلمه عليه، وتحته توضيحه: ${note ? `«${note}»` : "(ما كتب توضيح — اسأله وش يبي منه: نفس القصة، أو فكرتها بس، أو ستايلها وحركة كاميرتها)"}.`,
    sheetUrl
      ? "الصورة المرفقة لقطات من الفيديو نفسه مرتبة بالوقت (الوقت مكتوب على كل لقطة). شفها وحلل منها: الشخصيات وشكلها ولبسها، المكان، الستايل البصري (واقعي/كرتون/أنمي…)، الإضاءة والألوان، حركة الكاميرا وتقطيع اللقطات، وتسلسل الأحداث."
      : "صور الفيديو ما انشافت: اشتغل من كلامه (وعنوانه إن وجد)، وقل في understanding إنك ما شفت الصورة، ولا تخترع وصف مشاهد.",
    heard?.block || "كلام الفيديو ما انسمع.",
    "المطلوب: understanding تشرح للمستخدم ببساطة وش فهمت من الفيديو (القصة وتسلسلها، الشخصيات، المكان، الستايل، الكاميرا) وكيف بتبني فيلمه عليه حسب توضيحه — هذا اللي بيأكده قبل ما يبدأ السيناريست. concept قصة كاملة مبنية على الفيديو وتوضيحه (لا تنسخ الرابط ولا أرقام الملفات فيها). title عنوان مناسب لو العنوان المبدئي فاضي. لا تخترع تفاصيل ما في الفيديو ولا التوضيح، واسأل عن الناقص في questions.",
  ].join("\n\n");
  return { text, sheetUrl, usd: heard?.usd ?? 0 };
}

/** سجاد's rules at the journey's gate (the same every pass, so they are read from the cache). */
const INTAKE_RULES = `أنت سجاد في بوابة الرحلة السينمائية الجديدة. مهمتك الآن الفهم والتحقق فقط، لا تبدأ كتابة السيناريو ولا تولّد صورًا أو فيديو. لا تخمّن، وافصل الأسئلة المانعة عن الفهم المؤكد.

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
- fixedFacts للقرارات التي يجب ألا تتغير فقط.`;

export function journeyIntakeText(intake: JourneyIntake) {
  const parts = [`فهم سجاد المعتمد للرحلة الجديدة:\n${intake.understanding}`, `الصياغة المعتمدة:\n${intake.concept}`];
  if (intake.lesson) {
    const l = intake.lesson;
    const f = lessonFormat(l.format);
    parts.push(
      [
        "خطة الدرس المعتمدة:",
        `- الشكل: ${f ? `${f.ar} (${f.id})` : l.format}`,
        "- الستايل: الانحراف الأسلوبي (ثابت)",
        l.question ? `- سؤال الدرس: ${l.question}` : "",
        l.audience ? `- الطلاب: ${l.audience}` : "",
        l.points.length ? `- النقاط بالترتيب:\n${l.points.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}` : "",
      ].filter(Boolean).join("\n"),
    );
  }
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
