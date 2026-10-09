// «صانع المحتوى» — one message in a conversation: the persona (the owner's edit or the template), the platform's
// rules and tools, the closest worked examples, the project's record, the person's attachments (pictures seen),
// then «محمد باقر»'s structured answer: the reply, the record, and — on an explicit request — a carousel to produce
// (made by GPT Image 2 in the produce step) or a package handed to «حيدرة» (an edit room opened in «حيدرة كت»).
// Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { createEditorProject, requireEditorProject } from "@/lib/editor/server";
import { appendChat } from "@/lib/editor/chat";
import { CONTENT, isCarouselAspect, womanCheck, type CarouselAspect } from "@config/content";
import { contentExamplesBrief, nearestContentExamples } from "@config/content-examples";
import { nearestTemplateExamples, templateExamplesBrief } from "@config/content-template-examples";
import { findTemplate } from "@config/content-templates";
import { findStyle } from "@config/film-styles";
import { cleanHistory, forModel, getChat, readMedia, readQuestions, saveChat, type Attachment, type MediaItem, type PendingProduce, type Turn } from "./chats";
import { attachmentsOf, uploadLinks } from "./files";
import { catalogBlock, chosenBlock, chosenIds, getPersona, systemText } from "./persona";
import { stripMarks } from "./marks";
import { lastSlidesAt } from "./produce";
import { randomUUID } from "crypto";

const db = () => createAdminClient();

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "questions", "record", "produce", "generate", "handoff"],
  properties: {
    reply: { type: "string", description: "ردّك للعميل بالعربية الفصحى (ماركداون خفيف)." },
    questions: {
      type: "array",
      description: "الأسئلة القابلة للضغط (حتى ٦). فارغة إذا لم يكن في ردّك سؤال أو قرار أو خطوة تالية.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "kind", "options", "multi"],
        properties: {
          label: { type: "string", description: "نص السؤال القصير" },
          kind: { type: "string", enum: ["choice", "templates", "styles"], description: "choice: خيارات نصية؛ templates: معرض قوالب الكاروسيل؛ styles: معرض الستايلات الكرتونية الـ٢٤" },
          options: { type: "array", items: { type: "string" }, description: "إجابات قصيرة (٢–٧) لـ choice، وفارغة للمعرضين" },
          multi: { type: "boolean", description: "يجوز اختيار أكثر من إجابة" },
        },
      },
    },
    record: { type: "string", description: "سجل المشروع كاملًا ومحدّثًا، أو فارغًا إذا لم يتغير." },
    produce: {
      type: "object",
      additionalProperties: false,
      required: ["on", "mode", "aspect", "template_id", "style_id", "slides"],
      description: "إنتاج كاروسيل بـ GPT Image 2، فقط بعد طلب صريح. on=false بدون إنتاج.",
      properties: {
        on: { type: "boolean" },
        mode: { type: "string", enum: ["all", "fix"], description: "all: كاروسيل جديد؛ fix: إعادة رسم شرائح بعينها من آخر كاروسيل" },
        aspect: { type: "string", enum: ["1:1", "2:3", "9:16", "16:9"] },
        template_id: { type: "string", description: "معرّف القالب الذي اختاره العميل، أو فارغ" },
        style_id: { type: "string", description: "معرّف الستايل الكرتوني الذي اختاره العميل، أو فارغ" },
        slides: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["n", "text", "prompt"],
            properties: {
              n: { type: "integer", description: "رقم الشريحة من 1" },
              text: { type: "string", description: "النص المعتمد الظاهر على الشريحة كما هو" },
              prompt: { type: "string", description: "توجيه الصورة بالإنجليزية: نظام التصميم المشترك كاملًا ثم ما يخص هذه الشريحة، والنص العربي حرفيًا بين علامتي اقتباس مزدوجتين" },
            },
          },
        },
      },
    },
    generate: {
      type: "object",
      additionalProperties: false,
      required: ["on", "items"],
      description: "طلب صور أو فيديوهات منفردة (غلاف، لقطة مساندة، مشهد، مقطع) تُسلَّم إلى جواد ليولّدها، فقط بعد طلب صريح. on=false بدون طلب. لا تستخدمه للكاروسيل.",
      properties: {
        on: { type: "boolean" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "name", "prompt", "aspect", "quality", "resolution", "seconds", "with_sound", "refs"],
            properties: {
              kind: { type: "string", enum: ["image", "video"] },
              name: { type: "string", description: "اسم قصير بالعربية للعنصر" },
              prompt: { type: "string", description: "التوجيه الكامل بالإنجليزية (الصورة: GPT Image 2؛ الفيديو: Seedance)، والنص العربي إن ظهر حرفيًا بين علامتي اقتباس" },
              aspect: { type: "string", enum: ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "21:9"], description: "للصورة: 1:1 و16:9 و9:16 و3:2 و2:3 فقط" },
              quality: { type: "string", enum: ["low", "medium", "high"], description: "للصورة فقط (high للنصوص العربية)؛ للفيديو اكتب high" },
              resolution: { type: "string", enum: ["std", "hi", "480p", "720p", "1080p"], description: "للصورة std أو hi؛ للفيديو 480p أو 720p أو 1080p" },
              seconds: { type: "integer", description: "للفيديو فقط: من 4 إلى 15؛ للصورة اكتب 0" },
              with_sound: { type: "boolean", description: "للفيديو: بصوت مولَّد" },
              refs: { type: "array", items: { type: "string" }, description: "معرّفات (id) ملفات العميل المرفقة المراد استخدامها كمراجع بصرية، أو فارغة" },
            },
          },
        },
      },
    },
    handoff: {
      type: "object",
      additionalProperties: false,
      required: ["on", "title", "shape", "package"],
      description: "تسليم ريل منتج أو موشن جرافيكس إلى حيدرة، فقط بعد طلب صريح. on=false بدون تسليم.",
      properties: {
        on: { type: "boolean" },
        title: { type: "string", description: "اسم المشروع (قصير)" },
        shape: { type: "string", enum: ["9:16", "16:9"] },
        package: { type: "string", description: "الحزمة الكاملة المكتفية بذاتها بالعربية (المرحلة الخامسة)" },
      },
    },
  },
} as const;

interface Answer {
  reply: string;
  questions: unknown;
  record: string;
  produce: { on: boolean; mode: string; aspect: string; template_id: string; style_id: string; slides: { n: number; text: string; prompt: string }[] };
  generate?: { on: boolean; items: { kind: string; name: string; prompt: string; aspect: string; quality: string; resolution: string; seconds: number; with_sound: boolean; refs: string[] }[] };
  handoff: { on: boolean; title: string; shape: string; package: string };
}

export interface Reply {
  chatId: string;
  text: string;
  questions: Turn["questions"] | null;
  usd: number;
  /** slides are waiting to be made (the page calls the produce step) */
  pending: { total: number; mode: "all" | "fix"; todo: number[] } | null;
  editor: { id: string; title: string } | null;
  /** pictures or videos were handed to جواد (the page calls the media step) */
  media: MediaItem[] | null;
}

const KIND_AR = { image: "صورة", video: "فيديو", audio: "صوت" } as const;

/** What an answer of his looked like to the person beyond its words: the buttons he offered and the carousel's state. */
function assistantNote(t: Turn): string {
  const parts: string[] = [];
  if (t.questions?.length) {
    parts.push(`[الأسئلة التي عُرضت للعميل كأزرار: ${t.questions.map((q, i) => `${i + 1}) ${q.label}${q.kind === "templates" ? " (معرض القوالب)" : q.kind === "styles" ? " (معرض الستايلات الكرتونية)" : `: ${q.options.join(" | ")}`}`).join("؛ ")}]`);
  }
  const s = t.slides;
  if (s) {
    const lines = [`[حالة الإنتاج من الموقع — كاروسيل ${s.aspect}: شرائح مصنوعة ${s.items.map((x) => x.n).join(",") || "لا شيء"}${s.todo.length ? `؛ قيد الرسم ${s.todo.join(",")}` : ""}${s.failed.length ? `؛ لم تُصنع ${s.failed.map((f) => `${f.n} (${f.reason})`).join(", ")}` : ""}]`];
    if (s.report) lines.push(s.report);
    parts.push(lines.join("\n"));
  }
  if (t.media) {
    const ST = { todo: "بانتظار جواد", running: "جواد يولّدها", done: "جاهزة", failed: "فشلت" } as const;
    parts.push(`[طلبات سلّمتها لجواد (هو من يولّد، وتظهر أيضًا في «أعمالي»): ${t.media.items.map((x, i) => `${i + 1}) ${x.kind === "video" ? "فيديو" : "صورة"} «${x.name}» — ${ST[x.state]}${x.error ? ` (${x.error})` : ""}${x.desk ? ` — ${x.desk.generator}${x.desk.free ? "" : ` ${x.desk.coins} عملة`}` : ""}`).join("؛ ")}]`);
  }
  if (t.editor) parts.push(`[فتح الموقع غرفة مونتاج «${t.editor.title}» في حيدرة كت وسلّمها الحزمة]`);
  return parts.length ? `${t.text}\n\n${parts.join("\n")}` : t.text;
}

/** A turn as Claude gets it: the text, the pictures attached (seen), the other files named. */
function toClaudeTurn(t: Turn, links: Map<string, string>): ClaudeTurn {
  if (t.role === "assistant") return { role: "assistant", content: assistantNote(t) };
  if (!t.files?.length) return { role: t.role, content: t.text };
  const parts: ClaudePart[] = [];
  const named = t.files.map((f) => `- ${KIND_AR[f.kind]}: «${f.name}»${f.durationMs ? ` (${Math.round(f.durationMs / 1000)} ث)` : ""} [id ${f.id}]`).join("\n");
  parts.push({ type: "text", text: `${t.text}\n\nالملفات المرفقة مع هذه الرسالة:\n${named}` });
  for (const f of t.files) {
    const url = f.kind === "image" ? links.get(f.id) : undefined;
    if (url) parts.push({ type: "image", url });
  }
  return { role: t.role, content: parts };
}

/** The person says something in a conversation (a new one when `chatId` is null). */
export async function say(userId: string, chatId: string | null, message: string, attachmentIds: unknown): Promise<Reply> {
  const said = message.trim().slice(0, CONTENT.messageMax);
  const { list: files } = await attachmentsOf(userId, attachmentIds);
  if (!said && !files.length) throw new Error("empty message");
  const before = chatId ? await getChat(userId, chatId) : null;
  if (chatId && !before) throw new Error("chat not found");
  const history = cleanHistory([...(before?.messages ?? []), { role: "user", text: said || "(ملفات مرفقة)", files: files.length ? files : undefined }]);
  const turns = forModel(history);
  // pictures of this conversation, by short-lived link, so he can look at them
  const links = await uploadLinks(userId, turns.flatMap((t) => (t.files ?? []).filter((f) => f.kind === "image").map((f) => f.id)));
  const persona = await getPersona();
  // what the person picked in the galleries (all their messages), and the closest worked examples
  const ids = chosenIds(history.filter((t) => t.role === "user").map((t) => t.text));
  const ask = stripMarks(said || turns.find((t) => t.role === "user")?.text || "");
  const parts = [
    catalogBlock(),
    chosenBlock(ids),
    contentExamplesBrief(nearestContentExamples(ask, 3)),
    ids.template || /كاروسيل|شرائح|carousel/i.test(ask + (before?.record ?? "")) ? templateExamplesBrief(nearestTemplateExamples(ask, ids.template && ids.template !== "none" ? ids.template : null, 2)) : "",
  ].filter(Boolean);
  const system = systemText(persona.text, parts, before?.record ?? "");
  const r = await callClaudeJson<Answer>({ system, turns: turns.map((t) => toClaudeTurn(t, links)), schema: ANSWER_SCHEMA, maxTokens: CONTENT.maxTokens, effort: "medium" });
  const a = r.data;
  let usd = claudeCost(r.usage);
  const questions = readQuestions(a.questions);
  const reply: Turn = { role: "assistant", text: a.reply.trim() || "…", ...(questions ? { questions } : {}) };
  const messages = [...history, reply];
  const at = messages.length - 1;

  // a carousel to make: kept with the conversation; the page asks for the produce step right after
  let pending: PendingProduce | null = null;
  if (a.produce?.on && Array.isArray(a.produce.slides) && a.produce.slides.length) {
    const aspect: CarouselAspect = isCarouselAspect(a.produce.aspect) ? a.produce.aspect : "1:1";
    const slides = a.produce.slides
      .filter((s) => s && typeof s.prompt === "string" && s.prompt.trim())
      .slice(0, CONTENT.maxSlides)
      .map((s, i) => ({ n: Number(s.n) || i + 1, text: String(s.text ?? "").slice(0, 2000), prompt: s.prompt.trim().slice(0, 4000) }))
      .sort((x, y) => x.n - y.n);
    const templateId = a.produce.template_id && findTemplate(a.produce.template_id) ? a.produce.template_id : "";
    const styleId = a.produce.style_id && findStyle(a.produce.style_id) ? a.produce.style_id : "";
    // the site's rule holds in the pictures: a woman only in a plain fully black abaya, face and hands only
    const bad = slides.filter((s) => womanCheck(s.prompt) === "violation");
    const fixAt = a.produce.mode === "fix" ? lastSlidesAt({ messages: history }) : -1;
    if (bad.length) {
      reply.text += `\n\n⚠️ لم يُنتج الكاروسيل: توجيه الشريحة ${bad.map((s) => s.n).join("، ")} يرسم امرأة بوصف غير مسموح. المسموح فقط: امرأة بعباية سوداء ساترة لكامل الجسم، سادة بلا أي زينة، ولا يظهر منها إلا الوجه والكفان (ويجب أن يُكتب هذا الوصف في التوجيه). اطلب مني تعديل هذه الشرائح ثم الإنتاج من جديد.`;
    } else if (slides.length && fixAt >= 0) {
      // draw these slides again in the carousel that exists
      const block = history[fixAt].slides!;
      pending = { id: randomUUID(), aspect: block.aspect, slides, at: fixAt, styleId: styleId || block.styleId, templateId: templateId || block.templateId, mode: "fix", made: [], failed: [], carry: block.failed.filter((f) => !slides.some((x) => x.n === f.n)) };
      messages[fixAt] = { ...history[fixAt], slides: { ...block, todo: slides.map((x) => x.n), failed: pending.carry, running: true, report: undefined } };
    } else if (slides.length) {
      pending = { id: randomUUID(), aspect, slides, at, styleId, templateId, mode: "all", made: [], failed: [], carry: [] };
      reply.slides = { aspect, items: [], todo: slides.map((x) => x.n), failed: [], running: true, total: slides.length, styleId, templateId };
    }
  }

  // pictures and videos for جواد: the requests are kept with the answer; the page asks for the media step right after
  let media: MediaItem[] | null = null;
  if (a.generate?.on && Array.isArray(a.generate.items) && a.generate.items.length) {
    const mine = new Set(history.flatMap((t) => (t.files ?? []).map((f) => f.id)));
    const items = readMedia(
      a.generate.items.slice(0, 6).map((x) => ({
        id: randomUUID().slice(0, 8),
        kind: x.kind,
        name: x.name,
        prompt: typeof x.prompt === "string" ? x.prompt.trim() : "",
        aspect: x.aspect,
        quality: x.kind === "image" ? x.quality : undefined,
        resolution: x.resolution,
        seconds: x.kind === "video" ? x.seconds : undefined,
        withSound: x.kind === "video" ? x.with_sound : undefined,
        refs: (Array.isArray(x.refs) ? x.refs : []).filter((r) => mine.has(r)),
        state: "todo",
      })),
    ).filter((x) => x.prompt);
    const bad = items.filter((x) => womanCheck(x.prompt) === "violation");
    if (bad.length) {
      reply.text += `\n\n⚠️ لم أسلّم الطلب لجواد: توجيه «${bad.map((x) => x.name || x.kind).join("، ")}» يرسم امرأة بوصف غير مسموح. المسموح فقط: امرأة بعباية سوداء ساترة لكامل الجسم، سادة بلا أي زينة، ولا يظهر منها إلا الوجه والكفان. اطلب مني تعديله ثم أسلّمه من جديد.`;
    } else if (items.length) {
      reply.media = { items };
      media = items;
    }
  }

  // a package for «حيدرة»: an edit room in «حيدرة كت», the package first in its conversation, the files in its library
  let editor: { id: string; title: string } | null = null;
  if (a.handoff?.on && typeof a.handoff.package === "string" && a.handoff.package.trim()) {
    try {
      editor = await openEditRoom(userId, a.handoff, history);
      reply.editor = editor;
      reply.text += `\n\n🎬 فتحت غرفة مونتاج باسم «${editor.title}» في «حيدرة كت»، ووضعت الحزمة الكاملة أول المحادثة مع حيدرة، ونقلت ملفاتك المرفقة إلى مكتبتها.`;
    } catch (e) {
      console.error("content handoff", e);
      reply.text += `\n\n⚠️ لم أتمكن من فتح غرفة المونتاج في «حيدرة كت» الآن (${e instanceof UserError ? e.message : "خطأ في الخادم"}). الحزمة جاهزة أعلاه؛ اطلب التسليم مرة ثانية بعد قليل.`;
    }
  }

  const id = await saveChat(userId, chatId, { messages, record: a.record?.trim() ? a.record.trim() : undefined, pending, addUsd: usd });
  usd = Math.round(usd * 10000) / 10000;
  return { chatId: id, text: reply.text, questions: questions ?? null, usd, pending: pending ? { total: pending.slides.length, mode: pending.mode, todo: pending.slides.map((x) => x.n) } : null, editor, media };
}

/**
 * The edit room: a new project in «حيدرة كت» named after the package, the package as its handoff and first message,
 * and the person's attachments of this conversation in its library (the files stay where they are).
 */
async function openEditRoom(userId: string, h: Answer["handoff"], history: Turn[]) {
  const title = String(h.title ?? "").trim().slice(0, 100) || "مشروع من صانع المحتوى";
  const kind = h.shape === "16:9" ? "horizontal" : "reel";
  const id = await createEditorProject(userId, { title, kind });
  const p = await requireEditorProject(id, userId);
  const pkg = h.package.trim().slice(0, 7900);
  // the handoff is what حيدرة reads first at every answer; the message is what the person sees
  const { error } = await db().from("editor_chats").upsert({ project_id: p.id, user_id: p.user_id, messages: [], handoff: `من محمد باقر (صانع المحتوى) — حزمة المشروع الكاملة:\n${pkg}`, chats: 1, updated_at: new Date().toISOString() });
  if (error) console.error("content handoff chat", error.message);
  // the files the person attached in this conversation (the latest of each), pointed at from the room's library
  const seen = new Map<string, Attachment>();
  for (const t of history) for (const f of t.files ?? []) seen.set(f.id, f);
  if (seen.size) {
    const { data } = await db().from("jawad_uploads").select("id,kind,storage_path,file_name,mime,bytes,width,height,duration_ms").in("id", [...seen.keys()]).eq("user_id", userId).eq("status", "ready");
    const rows = (data ?? []).map((u) => ({
      project_id: p.id,
      user_id: p.user_id,
      kind: u.kind,
      bucket: "jawad",
      path: u.storage_path,
      name: String(u.file_name ?? "").slice(0, 200) || KIND_AR[u.kind as keyof typeof KIND_AR],
      mime: u.mime ?? (u.kind === "video" ? "video/mp4" : u.kind === "audio" ? "audio/mpeg" : "image/png"),
      bytes: u.bytes ?? 0,
      duration_ms: u.duration_ms,
      width: u.width,
      height: u.height,
      origin: "jawad",
      status: "ready",
      meta: { hasAudio: u.kind !== "image", fromContent: true },
    }));
    if (rows.length) {
      const { error: e } = await db().from("editor_assets").insert(rows);
      if (e) console.error("content handoff assets", e.message);
    }
  }
  await appendChat(p, [{ role: "assistant", text: `📨 محمد باقر سلّمني حزمة «${title}» كاملة: الهدف والجمهور، السكربت المعتمد، المشاهد والنصوص الظاهرة، قرارات الصوت والموسيقى، والقيود${seen.size ? `، ومعها ${seen.size} ملفات في المكتبة` : ""}. قول لي «ابدأ» وأنفّذها، أو اسألني عن أي جزء منها.` }]).catch(() => {});
  return { id: p.id, title };
}
