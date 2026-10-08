// «صانع المحتوى» — one message in a conversation: the persona (the owner's edit or the template), the platform's
// rules and tools, the closest worked examples, the project's record, the person's attachments (pictures seen),
// then «محمد باقر»'s structured answer: the reply, the record, and — on an explicit request — a carousel to produce
// (made by GPT Image 2 in the produce step) or a package handed to «حيدرة» (an edit room opened in «حيدرة كت»).
// Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { ProviderError, providerUserId } from "@/lib/jawad/server/providers/common";
import { createEditorProject, requireEditorProject } from "@/lib/editor/server";
import { appendChat } from "@/lib/editor/chat";
import { GPT_IMAGE_2_SIZES } from "@config/jawad/generators";
import { CONTENT, isCarouselAspect, type CarouselAspect } from "@config/content";
import { contentExamplesBrief, nearestContentExamples } from "@config/content-examples";
import { drawsRealWoman } from "@config/jawad/assistant";
import { cleanHistory, forModel, getChat, saveChat, type Attachment, type PendingProduce, type Slide, type Turn } from "./chats";
import { addProduced, attachmentsOf, producedBytes, uploadLinks } from "./files";
import { getPersona, systemText } from "./persona";

const db = () => createAdminClient();

/** GPT Image 2 for the slides: the standard sizes (a 1:1 slide is 1024×1024), high quality for readable Arabic. */
const IMAGE_MODEL = "gpt-image-2-2026-04-21";
const IMAGE_TIER = "std" as const;
const IMAGE_QUALITY = "high" as const;
/** Slides made at once after the first (the first is everyone's reference). */
const PARALLEL = 4;

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "record", "produce", "handoff"],
  properties: {
    reply: { type: "string", description: "ردّك للعميل بالعربية الفصحى (ماركداون خفيف)." },
    record: { type: "string", description: "سجل المشروع كاملًا ومحدّثًا، أو فارغًا إذا لم يتغير." },
    produce: {
      type: "object",
      additionalProperties: false,
      required: ["on", "aspect", "slides"],
      description: "إنتاج كاروسيل بـ GPT Image 2، فقط بعد طلب صريح. on=false بدون إنتاج.",
      properties: {
        on: { type: "boolean" },
        aspect: { type: "string", enum: ["1:1", "2:3", "9:16", "16:9"] },
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
  record: string;
  produce: { on: boolean; aspect: string; slides: { n: number; text: string; prompt: string }[] };
  handoff: { on: boolean; title: string; shape: string; package: string };
}

export interface Reply {
  chatId: string;
  text: string;
  usd: number;
  /** slides are waiting to be made (the page calls the produce step) */
  pending: boolean;
  editor: { id: string; title: string } | null;
}

const KIND_AR = { image: "صورة", video: "فيديو", audio: "صوت" } as const;

/** A turn as Claude gets it: the text, the pictures attached (seen), the other files named. */
function toClaudeTurn(t: Turn, links: Map<string, string>): ClaudeTurn {
  if (t.role === "assistant" || !t.files?.length) return { role: t.role, content: t.text };
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
  const examples = contentExamplesBrief(nearestContentExamples(said || turns.find((t) => t.role === "user")?.text || "", 3));
  const system = systemText(persona.text, examples, before?.record ?? "");
  const r = await callClaudeJson<Answer>({ system, turns: turns.map((t) => toClaudeTurn(t, links)), schema: ANSWER_SCHEMA, maxTokens: CONTENT.maxTokens, effort: "medium" });
  const a = r.data;
  let usd = claudeCost(r.usage);
  const reply: Turn = { role: "assistant", text: a.reply.trim() || "…" };
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
    // the site's rule holds in the pictures too
    const bad = slides.filter((s) => drawsRealWoman(s.prompt));
    if (bad.length) {
      reply.text += `\n\n⚠️ لم يُنتج الكاروسيل: توجيه الشريحة ${bad.map((s) => s.n).join("، ")} يرسم امرأة حقيقية، وهذا ممنوع في الموقع. اطلب تعديل هذه الشرائح ثم الإنتاج من جديد.`;
    } else if (slides.length) pending = { aspect, slides, at };
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
  return { chatId: id, text: reply.text, usd, pending: !!pending, editor };
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

export interface Produced {
  chatId: string;
  slides: Slide[];
  failed: number;
  usd: number;
}

/**
 * The produce step: makes the pending carousel's slides with GPT Image 2 — the first slide alone, then the others
 * with the first as their visual reference — stores them, attaches them to the announcing message, and clears the
 * pending request. A slide that fails is counted, the rest still come.
 */
export async function produce(userId: string, chatId: string): Promise<Produced> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p) throw new UserError("ما فيه كاروسيل ينتظر الإنتاج في هذي المحادثة.", 409);
  if (!process.env.OPENAI_API_KEY) throw new UserError("صناعة الصور غير مفعّلة على الخادم.", 503);
  const size = GPT_IMAGE_2_SIZES[IMAGE_TIER][p.aspect];
  const user = providerUserId(userId);
  let usd = 0;
  let failed = 0;
  const made: Slide[] = [];
  const guide = (s: PendingProduce["slides"][number], withRef: boolean) =>
    [
      withRef ? `Slide ${s.n} of a carousel. The reference picture is slide 1: match its design system EXACTLY — the same colours, typography, margins, layout grid, logo placement and decorative elements — so the carousel reads as one set. Only the content changes.` : `Slide ${s.n} of a carousel (the first: it sets the design system every other slide will copy).`,
      s.prompt,
      "Arabic text must be written right-to-left, spelled exactly as given, fully readable, never cropped; no other text on the picture. Flat, print-quality, high contrast. No real women or girls anywhere.",
    ].join("\n\n");

  const one = async (s: PendingProduce["slides"][number], refs: { bytes: Buffer; mime: string }[]) => {
    try {
      const r = await openaiImage({ model: IMAGE_MODEL, prompt: guide(s, refs.length > 0), aspect: p.aspect, resolution: IMAGE_TIER, quality: IMAGE_QUALITY, count: 1, references: refs, user });
      usd += r.costUsd ?? 0;
      const file = await addProduced({ userId, chatId, bytes: r.images[0], name: `slide-${String(s.n).padStart(2, "0")}`, width: size[0], height: size[1], meta: { slide: s.n, aspect: p.aspect, text: s.text } });
      made.push({ n: s.n, fileId: file.id, name: file.name, text: s.text });
      return r.images[0];
    } catch (e) {
      failed++;
      console.error("content slide", s.n, e instanceof ProviderError ? e.detail : e);
      return null;
    }
  };

  const [first, ...rest] = p.slides;
  const ref = await one(first, []);
  const refs = ref ? [{ bytes: ref, mime: "image/png" }] : [];
  const queue = [...rest];
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (queue.length) await one(queue.shift()!, refs);
  }));
  made.sort((x, y) => x.n - y.n);

  // attached to the message that announced them (or the last answer), and the request cleared
  const fresh = await getChat(userId, chatId);
  const messages = fresh?.messages ?? chat.messages;
  const at = Math.min(p.at, messages.length - 1);
  const target = messages[at]?.role === "assistant" ? at : messages.map((m) => m.role).lastIndexOf("assistant");
  if (target >= 0) messages[target] = { ...messages[target], slides: { aspect: p.aspect, items: made, failed } };
  await saveChat(userId, chatId, { messages, pending: null, addUsd: usd });
  return { chatId, slides: made, failed, usd: Math.round(usd * 10000) / 10000 };
}

/** The bytes of a slide of the person's (used by the download link check). */
export const slideBytes = producedBytes;
