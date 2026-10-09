// «المصمم الذكي» — one message in a conversation: the persona (the owner's edit or the template), the platform's
// rules and tools, the fonts, the style library, the project's record, the person's attachments (pictures seen),
// then «كاظم»'s structured answer: the reply, the questions, the record, and — on an explicit request — a design to
// produce (the artwork drawn text-free by GPT Image 2 through جواد's desk, the words as real text layers) or a
// picture to split into layers. Server only.

import { randomUUID } from "crypto";
import { callClaudeJson, claudeCost, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { DESIGNER, DESIGN_ASPECTS, isDesignAspect, isDesignKind, type DesignAspect, type DesignKind } from "@config/designer";
import { findKindStyle } from "@config/designer-library";
import { drawsRealWoman } from "@config/jawad/assistant";
import { cleanHistory, forModel, getChat, lastDesignAt, readQuestions, saveChat, type Attachment, type PendingDesign, type Turn } from "./chats";
import { attachmentsOf, uploadLinks } from "./files";
import { layersNote, readLayers, sizeOf, type Design } from "./layers";
import { getPersona, systemText } from "./persona";

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "questions", "record", "produce", "split"],
  properties: {
    reply: { type: "string", description: "ردّك للعميل بالعربية (ماركداون خفيف)." },
    questions: {
      type: "array",
      description: "الأسئلة القابلة للضغط (حتى ٥). فارغة إذا لم يكن في ردّك سؤال أو قرار.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "kind", "options", "multi"],
        properties: {
          label: { type: "string", description: "نص السؤال القصير" },
          kind: { type: "string", enum: ["choice", "source", "directions", "fonts"], description: "choice: خيارات نصية؛ source: بطاقات مصدر التصميم الأربع؛ directions: ٣ اتجاهات من المكتبة؛ fonts: معرض الخطوط" },
          options: { type: "array", items: { type: "string" }, description: "إجابات قصيرة (٢–٦) لـ choice، و٣ أسطر لـ directions، وفارغة لـ source وfonts" },
          multi: { type: "boolean", description: "يجوز اختيار أكثر من إجابة (choice فقط)" },
        },
      },
    },
    record: { type: "string", description: "سجل المشروع كاملًا ومحدّثًا، أو فارغًا إذا لم يتغير." },
    produce: {
      type: "object",
      additionalProperties: false,
      required: ["on", "kind", "aspect", "artwork", "refs", "layers"],
      description: "طلب التصميم، فقط بعد طلب صريح. on=false بدون إنتاج.",
      properties: {
        on: { type: "boolean" },
        kind: { type: "string", enum: ["wedding", "husseini_joy", "husseini_mourning", "newborn", "thumbnail", "latmiya", "other"] },
        aspect: { type: "string", enum: ["1:1", "2:3", "9:16", "16:9", "3:2"] },
        artwork: { type: "string", description: "توجيه العمل الفني بالإنجليزية بلا أي نص، أو فارغ لإبقاء الصورة الحالية وتبديل الطبقات فقط" },
        refs: { type: "array", items: { type: "string" }, description: "معرّفات (id) صور العميل المرفقة المسلَّمة مرجعًا للرسم، أو فارغة" },
        layers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["role", "text", "font", "size", "color", "x", "y", "w", "align", "effect", "effect_color", "weight"],
            properties: {
              role: { type: "string", enum: ["title", "subtitle", "body", "names", "date", "place", "badge", "caption"] },
              text: { type: "string" },
              font: { type: "string", description: "معرّف خط من القائمة" },
              size: { type: "number", description: "ارتفاع الحرف بالمئة من ارتفاع التصميم" },
              color: { type: "string", description: "#RRGGBB" },
              x: { type: "number", description: "مركز الطبقة بالمئة من العرض" },
              y: { type: "number", description: "مركز الطبقة بالمئة من الارتفاع" },
              w: { type: "number", description: "عرض الصندوق بالمئة من العرض" },
              align: { type: "string", enum: ["center", "right", "left"] },
              effect: { type: "string", enum: ["none", "outline", "shadow", "glow", "pill"] },
              effect_color: { type: "string", description: "#RRGGBB أو فارغ" },
              weight: { type: "integer", enum: [400, 700] },
            },
          },
        },
      },
    },
    split: {
      type: "object",
      additionalProperties: false,
      required: ["on", "ref"],
      description: "تفكيك صورة مرفقة إلى طبقات (الشخص أو العنصر مقصوصًا فوق الصورة الأصلية). on=false بدون.",
      properties: { on: { type: "boolean" }, ref: { type: "string", description: "معرّف (id) الصورة المرفقة" } },
    },
  },
} as const;

interface Answer {
  reply: string;
  questions: unknown;
  record: string;
  produce: { on: boolean; kind: string; aspect: string; artwork: string; refs: string[]; layers: unknown[] };
  split: { on: boolean; ref: string };
}

export interface Reply {
  chatId: string;
  text: string;
  questions: Turn["questions"] | null;
  usd: number;
  /** a design is waiting to be drawn (the page calls the produce step) */
  pending: boolean;
  /** a picture is to be split into layers (the page calls the split step with this upload id) */
  split: string | null;
}

const KIND_AR = { image: "صورة", video: "فيديو", audio: "صوت" } as const;

/** What an answer of his looked like to the person beyond its words: the buttons he offered and the design's state. */
function assistantNote(t: Turn): string {
  const parts: string[] = [];
  if (t.questions?.length) {
    parts.push(`[الأسئلة التي عُرضت للعميل كأزرار: ${t.questions.map((q, i) => `${i + 1}) ${q.label}${q.kind === "source" ? " (بطاقات المصدر)" : q.kind === "fonts" ? " (معرض الخطوط)" : `: ${q.options.join(" | ")}`}`).join("؛ ")}]`);
  }
  const d = t.design;
  if (d) {
    const ST = { drawing: "جواد يرسم الصورة", ready: "جاهز في محرر الطبقات", failed: `تعذّر (${d.error ?? ""})` } as const;
    parts.push(`[حالة التصميم من الموقع — ${d.aspect} ${d.width}×${d.height}: ${ST[d.state]}${d.flag ? `؛ ملاحظة الفحص: ${d.flag}` : ""}${d.final ? "؛ العميل حفظ PNG نهائيًا" : ""}. الطبقات الآن (بعد تعديلات العميل إن وُجدت): ${layersNote(d)}]`);
  }
  return parts.length ? `${t.text}\n\n${parts.join("\n")}` : t.text;
}

/** A turn as Claude gets it: the text, the pictures attached (seen), the other files named. */
function toClaudeTurn(t: Turn, links: Map<string, string>): ClaudeTurn {
  if (t.role === "assistant") return { role: "assistant", content: assistantNote(t) };
  if (!t.files?.length) return { role: t.role, content: t.text };
  const parts: ClaudePart[] = [];
  const named = t.files.map((f) => `- ${KIND_AR[f.kind]}: «${f.name}» [id ${f.id}]`).join("\n");
  parts.push({ type: "text", text: `${t.text}\n\nالملفات المرفقة مع هذه الرسالة:\n${named}` });
  for (const f of t.files) {
    const url = f.kind === "image" ? links.get(f.id) : undefined;
    if (url) parts.push({ type: "image", url });
  }
  return { role: t.role, content: parts };
}

/** The person says something in a conversation (a new one when `chatId` is null). */
export async function say(userId: string, chatId: string | null, message: string, attachmentIds: unknown): Promise<Reply> {
  const said = message.trim().slice(0, DESIGNER.messageMax);
  const { list: files } = await attachmentsOf(userId, attachmentIds);
  if (!said && !files.length) throw new Error("empty message");
  const before = chatId ? await getChat(userId, chatId) : null;
  if (chatId && !before) throw new Error("chat not found");
  const history = cleanHistory([...(before?.messages ?? []), { role: "user", text: said || "(صور مرفقة)", files: files.length ? files : undefined }]);
  const turns = forModel(history);
  // pictures of this conversation, by short-lived link, so he can look at them (a template to copy, a photo)
  const links = await uploadLinks(userId, turns.flatMap((t) => (t.files ?? []).filter((f) => f.kind === "image").map((f) => f.id)));
  const persona = await getPersona();
  const system = systemText(persona.text, [], before?.record ?? "");
  const r = await callClaudeJson<Answer>({ system, turns: turns.map((t) => toClaudeTurn(t, links)), schema: ANSWER_SCHEMA, maxTokens: DESIGNER.maxTokens, effort: "medium" });
  const a = r.data;
  let usd = claudeCost(r.usage);
  const questions = readQuestions(a.questions);
  const reply: Turn = { role: "assistant", text: a.reply.trim() || "…", ...(questions ? { questions } : {}) };
  const messages = [...history, reply];
  const at = messages.length - 1;

  // a design to make: kept with the conversation; the page asks for the produce step right after
  let pending: PendingDesign | null = null;
  const mine = new Set(history.flatMap((t) => (t.files ?? []).filter((f) => f.kind === "image").map((f) => f.id)));
  if (a.produce?.on) {
    const kind: DesignKind = isDesignKind(a.produce.kind) ? a.produce.kind : "other";
    const style = findKindStyle(kind);
    const aspect: DesignAspect = isDesignAspect(a.produce.aspect) ? a.produce.aspect : ((style?.aspects[0] as DesignAspect | undefined) ?? "1:1");
    const artwork = String(a.produce.artwork ?? "").trim().slice(0, 6000);
    const layers = readLayers(a.produce.layers, style?.directions[0]?.fonts.body ?? "readex");
    const refs = (Array.isArray(a.produce.refs) ? a.produce.refs : []).filter((x) => mine.has(x)).slice(0, 6);
    const prevAt = lastDesignAt(history);
    const prev = prevAt >= 0 ? history[prevAt].design : undefined;
    const keep = !artwork && prev?.artwork && prev.state === "ready" ? prev.artwork : null;
    if (artwork && drawsRealWoman(artwork)) {
      reply.text += "\n\n⚠️ لم أرسل الرسم لجواد: توجيه الصورة يرسم امرأة واقعية، وهذا ممنوع في الموقع. أعيد صياغته بلا أشخاص من النساء ثم أنفّذ؛ قل لي «صمّم» من جديد.";
    } else if (!artwork && !keep) {
      reply.text += "\n\n⚠️ لم أجد صورة قائمة أبقيها ولا توجيهًا جديدًا للرسم؛ اطلب التصميم من جديد.";
    } else if (!layers.length) {
      reply.text += "\n\n⚠️ لم تُحدَّد طبقات نص للتصميم؛ أعطني النصوص كما تريدها ثم اطلب التصميم من جديد.";
    } else {
      const size = keep && prev ? { width: prev.width, height: prev.height } : sizeOf(aspect);
      const design: Design = { id: randomUUID().slice(0, 8), aspect: keep && prev ? prev.aspect : aspect, ...size, artwork: keep, layers, state: keep ? "ready" : "drawing" };
      reply.design = design;
      if (!keep) pending = { id: design.id, at, kind, aspect, artwork, refs, layers, keep: null };
      else reply.text += "\n\n🧩 أبقيت الصورة ووضعت الطبقات الجديدة في محرر الطبقات.";
    }
  }

  // a picture to split: the page asks for the split step with the upload's id
  let split: string | null = null;
  if (a.split?.on && typeof a.split.ref === "string" && mine.has(a.split.ref)) {
    split = a.split.ref;
    const prevAt = lastDesignAt(history);
    const prev = prevAt >= 0 ? history[prevAt].design : undefined;
    // the split makes its own design: the original picture as the artwork, the cut-out as a layer (filled by the split step)
    const aspect: DesignAspect = prev?.aspect ?? "1:1";
    reply.design = { id: randomUUID().slice(0, 8), aspect, ...sizeOf(aspect), artwork: null, layers: [], state: "drawing" };
  }

  const id = await saveChat(userId, chatId, { messages, record: a.record?.trim() ? a.record.trim() : undefined, pending, addUsd: usd });
  usd = Math.round(usd * 10000) / 10000;
  return { chatId: id, text: reply.text, questions: questions ?? null, usd, pending: !!pending, split };
}

/** The aspects as the page lists them (label and pixels). */
export const aspectList = () => Object.entries(DESIGN_ASPECTS).map(([id, a]) => ({ id, label: a.label, px: a.px }));
export type { Attachment };
