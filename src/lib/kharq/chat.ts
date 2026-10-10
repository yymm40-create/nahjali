// «محمد الخارق» — one message in a conversation: the persona (the owner's edit or the template), the platform's rules,
// the site's branches and his own internal ROCTCF template, then his structured answer: the reply, the clickable
// questions, the updated template (kept, never shown), what he delivered, and the branch he pointed to.
//
// A picture or a video in a delivery is only a PROPOSAL here: its price is worked out and shown, and nothing is
// generated until the person presses the confirm button (src/lib/kharq/make.ts). Server only.

import { UserError } from "@/lib/api";
import { callClaudeJson, claudeCost, isLeader, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { unlimitedFor } from "@/lib/access";
import { deskQuote } from "@/lib/content/jawad";
import { DELIVER_KINDS, KHARQ, KHARQ_STAGES, ROAD_IDS, type KharqStage } from "@config/kharq";
import { cleanHistory, forModel, getChat, readDeliver, readQuestions, saveChat, type Attachment, type Deliver, type Turn } from "./chats";
import { attachmentsOf, uploadLinks } from "./files";
import { getPersona, systemText } from "./persona";

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "questions", "brief", "stage", "deliver", "suggest"],
  properties: {
    reply: { type: "string", description: "كلامك للعميل (ماركداون خفيف). قصير في مرحلة الأسئلة، ويقدّم المخرج بسطرين عند التسليم." },
    questions: {
      type: "array",
      description: "الأسئلة المهمة كخيارات يضغطها العميل (حتى ٦). فارغة إذا ما في سؤال في ردّك.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "options", "multi"],
        properties: {
          label: { type: "string", description: "نص السؤال، قرار واحد واضح" },
          options: { type: "array", items: { type: "string" }, description: "من خيارين إلى أربعة خيارات فعلية متمايزة؛ اكتب «ترشيحي» بجانب الأنسب مع سبب مختصر. لا تكتب خيار «أخرى»: الموقع يضيفه." },
          multi: { type: "boolean", description: "يجوز اختيار أكثر من إجابة" },
        },
      },
    },
    brief: { type: "string", description: "قالب ROCTCF الداخلي لهذا المشروع كاملًا ومحدّثًا (العميل لا يراه)، أو فارغًا إذا لم يتغير. مكتفٍ بذاته: القرارات مكتوبة فيه لا مُشار إليها." },
    stage: { type: "string", enum: [...KHARQ_STAGES], description: "discover: أجمع المتطلبات · ready: المتطلبات كافية والقالب مكتوب · making: أنفّذ وأسلّم · done: اكتمل المطلوب" },
    deliver: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "text", "table", "media"],
      description: "الشيء نفسه في يد العميل. kind=none بلا تسليم.",
      properties: {
        kind: { type: "string", enum: DELIVER_KINDS.map((d) => d.id), description: "none · text: نص · message: رسالة جاهزة للإرسال · table: جدول · pdf: ملف يبنيه الموقع من نصك · media: صور أو فيديو" },
        title: { type: "string", description: "اسم المخرج (قصير)" },
        text: { type: "string", description: "النص أو الرسالة كما هي؛ ولـ pdf متن الملف بماركداون (# عنوان، ## فرع، - نقاط، **عريض**، | جداول |). فارغ لغير ذلك." },
        table: {
          type: "object",
          additionalProperties: false,
          required: ["columns", "rows"],
          description: "لـ table فقط: صف العناوين ثم الصفوف. لغير الجدول اتركهما فارغتين.",
          properties: {
            columns: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } },
          },
        },
        media: {
          type: "array",
          description: "لـ media فقط: الصور والفيديوهات المطلوبة (حتى ٤). الموقع يعرض سعر كل واحد وزر تأكيد، ولا يولّد شيئًا قبل موافقة العميل.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "name", "prompt", "aspect", "quality", "resolution", "seconds", "with_sound"],
            properties: {
              kind: { type: "string", enum: ["image", "video"] },
              name: { type: "string", description: "اسم قصير بالعربية" },
              prompt: { type: "string", description: "التوجيه الكامل بالإنجليزية، والنص العربي إن ظهر في الصورة حرفيًا بين علامتي اقتباس مزدوجتين" },
              aspect: { type: "string", enum: ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "21:9"], description: "للصورة: 1:1 و16:9 و9:16 و3:2 و2:3 فقط" },
              quality: { type: "string", enum: ["low", "medium", "high"], description: "للصورة (high للنصوص العربية)؛ للفيديو اكتب high" },
              resolution: { type: "string", enum: ["std", "hi", "480p", "720p", "1080p"], description: "للصورة std أو hi؛ للفيديو 480p أو 720p أو 1080p" },
              seconds: { type: "integer", description: "للفيديو: من ٤ إلى ١٥؛ للصورة اكتب 0" },
              with_sound: { type: "boolean", description: "للفيديو: بصوته المولّد" },
            },
          },
        },
      },
    },
    suggest: { type: "array", items: { type: "string", enum: [...ROAD_IDS] }, description: "معرّفات فروع الموقع التي تنفع العميل أكثر منك في هذا المطلوب (حتى ٤)، أو فارغة. اذكر سببها بسطر في ردّك." },
  },
} as const;

interface Answer {
  reply?: unknown;
  questions?: unknown;
  brief?: unknown;
  stage?: unknown;
  deliver?: unknown;
  suggest?: unknown;
}

const KIND_AR: Record<Attachment["kind"], string> = { image: "صورة", video: "مقطع", audio: "صوت", doc: "ملف PDF" };

/** One turn of the conversation as he receives it: the words, and the attachments he can look at or read. */
function turnFor(t: Turn, links: Map<string, string>): ClaudeTurn {
  const said = t.role === "assistant" ? assistantText(t) : t.text;
  if (!t.files?.length) return { role: t.role, content: said };
  const parts: ClaudePart[] = [];
  const named = t.files.map((f) => `- ${KIND_AR[f.kind]}: «${f.name}»${f.durationMs ? ` (${Math.round(f.durationMs / 1000)} ث)` : ""} [id ${f.id}]`).join("\n");
  parts.push({ type: "text", text: `${said}\n\nالملفات المرفقة مع هذه الرسالة:\n${named}` });
  for (const f of t.files) {
    const url = links.get(f.id);
    if (!url) continue;
    // a picture is looked at; a PDF is READ (its own pages, by link); a video or a sound is only named
    if (f.kind === "image") parts.push({ type: "image", url });
    else if (f.kind === "doc") parts.push({ type: "doc", url, name: f.name });
  }
  return { role: t.role, content: parts };
}

/** What he said, with what he delivered written back into it (so he knows what is already in the person's hands). */
function assistantText(t: Turn): string {
  const d = t.deliver;
  if (!d) return t.text;
  const parts = [t.text, `— سلّمتَ في هذه الرسالة (${d.kind}): «${d.title}»`];
  if (d.text) parts.push(d.text);
  if (d.table) parts.push([d.table.columns.join(" | "), ...d.table.rows.map((r) => r.join(" | "))].join("\n"));
  if (d.media.length) parts.push(d.media.map((m) => `• ${m.kind === "video" ? "فيديو" : "صورة"} «${m.name}» — ${m.state === "done" ? "ولّدها جواد بعد موافقة العميل" : m.state === "failed" ? `فشل التوليد: ${m.error ?? ""}` : m.state === "running" ? "قيد التوليد" : "معروضة عليه بسعرها، ما وافق عليها بعد"}`).join("\n"));
  return parts.filter(Boolean).join("\n\n").slice(0, KHARQ.textMax);
}

/**
 * Each proposed picture or video gets the price the person is shown before any confirm button appears. Nothing is made
 * here: a quote asks جواد the price and he answers without starting a job. Whoever makes for free is quoted 0.
 */
async function priced(deliver: Deliver, who: { id: string; email: string | null; owner: boolean; origin: string }): Promise<Deliver> {
  if (!deliver.media.length) return deliver;
  if (who.owner) return { ...deliver, media: deliver.media.map((m) => ({ ...m, coins: 0 })) };
  const media = await Promise.all(
    deliver.media.map(async (m) => ({
      ...m,
      coins: await deskQuote(who, {
        kind: m.kind,
        prompt: m.prompt,
        aspect: m.aspect,
        quality: m.quality,
        resolution: m.resolution,
        ...(m.kind === "video" ? { seconds: m.seconds, withSound: m.withSound } : {}),
      }),
    })),
  );
  return { ...deliver, media };
}

export interface Reply {
  chatId: string;
  turn: Turn;
  stage: KharqStage;
  usd: number;
}

/**
 * The person says something (a new conversation when `chatId` is null), with files they attached. His answer is kept
 * with the conversation and returned — without his internal template, which never leaves the server.
 */
export async function say(o: { userId: string; chatId: string | null; message: string; email: string | null; attachments?: unknown; origin: string }): Promise<Reply> {
  const said = o.message.trim().slice(0, KHARQ.messageMax);
  const files = await attachmentsOf(o.userId, o.attachments);
  if (!said && !files.length) throw new UserError("اكتب رسالتك.");
  const before = o.chatId ? await getChat(o.userId, o.chatId) : null;
  if (o.chatId && !before) throw new Error("chat not found");

  const history = cleanHistory([...(before?.messages ?? []), { role: "user", text: said || "(ملفات مرفقة)", files: files.length ? files : undefined }]);
  const turns = forModel(history);
  const links = await uploadLinks(o.userId, turns.flatMap((t) => (t.files ?? []).filter((f) => f.kind === "image" || f.kind === "doc").map((f) => f.id)));
  const persona = await getPersona();

  const { data, usage } = await callClaudeJson<Answer>({
    system: systemText(persona.text, before?.brief ?? ""),
    turns: turns.map((t) => turnFor(t, links)),
    schema: ANSWER_SCHEMA,
    maxTokens: KHARQ.maxTokens,
    // the owner asked for the strongest minds on this branch: it thinks hard every turn
    effort: "high",
    leader: isLeader(o.email),
    timeoutMs: 170_000,
  });
  const usd = claudeCost(usage);

  const text = typeof data.reply === "string" ? data.reply.trim() : "";
  const deliverRaw = readDeliver(data.deliver);
  const deliver = deliverRaw ? await priced(deliverRaw, { id: o.userId, email: o.email, owner: await unlimitedFor(o.email), origin: o.origin }) : undefined;
  const suggest = (Array.isArray(data.suggest) ? data.suggest : []).filter((s): s is string => typeof s === "string" && (ROAD_IDS as readonly string[]).includes(s)).slice(0, 4);
  if (!text && !deliver) throw new Error("Claude gave an empty answer");

  const turn: Turn = {
    role: "assistant",
    text: text || `جاهز: «${deliver!.title || "المطلوب"}».`,
    ...(readQuestions(data.questions) ? { questions: readQuestions(data.questions) } : {}),
    ...(deliver ? { deliver } : {}),
    ...(suggest.length ? { suggest: [...new Set(suggest)] } : {}),
  };
  const stage: KharqStage = (KHARQ_STAGES as readonly string[]).includes(String(data.stage)) ? (data.stage as KharqStage) : (before?.stage ?? "discover");
  const brief = typeof data.brief === "string" && data.brief.trim() ? data.brief.trim() : (before?.brief ?? "");

  const chatId = await saveChat(o.userId, o.chatId, [...history, turn], usd, { brief, stage });
  return { chatId, turn, stage, usd };
}
