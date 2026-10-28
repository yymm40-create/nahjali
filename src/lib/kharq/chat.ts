// «محمد الخارق» — one message in a conversation: the persona (the owner's edit or the template), the platform's rules,
// the site's branches and his own internal ROCTCF template, then his structured answer: the reply, the clickable
// questions, the updated template (kept, never shown), what he delivered, and the branch he pointed to.
//
// A picture or a video in a delivery is only a PROPOSAL here: its price is worked out and shown, and nothing is
// generated until the person presses the confirm button (src/lib/kharq/make.ts). Server only.

import { remember, withNote } from "@/lib/robot-handoff";
import { UserError } from "@/lib/api";
import { callClaudeJson, claudeCost, isLeader, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { unlimitedFor } from "@/lib/access";
import { deskQuote } from "@/lib/content/jawad";
import { AGENT_IDS, DELIVER_KINDS, findAgent, KHARQ, KHARQ_STAGES, ROAD_IDS, type KharqStage } from "@config/kharq";
import { cleanHistory, consultRoundsSinceUser, getChat, pendingConsult, readConsult, readDeliver, readQuestions, saveChat, type Attachment, type Chat, type Deliver, type Turn } from "./chats";
import { runConsults, type Consult } from "./agents";
import { attachmentsOf, uploadLinks } from "./files";
import { getPersona, systemText } from "./persona";

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "questions", "brief", "stage", "deliver", "suggest", "consult"],
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
        kind: { type: "string", enum: DELIVER_KINDS.map((d) => d.id), description: "none · text: نص · message: رسالة جاهزة للإرسال · table: جدول · pdf: ملف يبنيه الموقع من نصك · media: صور أو فيديو · code: صفحة تشتغل (ملف HTML كامل في text)" },
        title: { type: "string", description: "اسم المخرج (قصير)" },
        text: { type: "string", description: "النص أو الرسالة كما هي؛ ولـ pdf متن الملف بماركداون (# عنوان، ## فرع، - نقاط، **عريض**، | جداول |)؛ ولـ code ملف HTML واحد كامل يبدأ بـ <!doctype html> (CSS وJS داخله، بلا روابط خارجية ولا طلبات شبكة). فارغ لغير ذلك." },
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
    consult: {
      type: "array",
      description: "وكلاء فريقك الذين تستشيرهم الآن في الخلفية (حتى ٣)، أو فارغة. أجوبتهم ترجع لك في نفس المحادثة وتكمل بعدها؛ لا تسلّم في هذا الرد شيئًا يعتمد عليهم.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["agent", "task"],
        properties: {
          agent: { type: "string", enum: [...AGENT_IDS] },
          task: { type: "string", description: "المهمة كاملة مكتفية بذاتها: المطلوب منه بالضبط، وقرارات العميل التي تهمه، وشكل الجواب الذي تحتاجه." },
        },
      },
    },
  },
} as const;

interface Answer {
  reply?: unknown;
  questions?: unknown;
  brief?: unknown;
  stage?: unknown;
  deliver?: unknown;
  suggest?: unknown;
  consult?: unknown;
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
export function assistantText(t: Turn): string {
  const parts = [t.text];
  // what his team answered: he reads it back on every turn after (the person sees only that he asked)
  for (const c of t.consult ?? []) {
    const name = findAgent(c.agent)?.name ?? c.agent;
    parts.push(c.state === "done" ? `— جواب «${name}» على مهمتك («${c.task.slice(0, 300)}»):\n${c.answer ?? ""}` : c.state === "failed" ? `— «${name}» ما قدر يجاوب على مهمتك.` : `— سألتَ «${name}» وما رجع جوابه بعد.`);
  }
  const d = t.deliver;
  if (!d) return parts.filter(Boolean).join("\n\n");
  parts.push(`— سلّمتَ في هذه الرسالة (${d.kind}): «${d.title}»`);
  if (d.text) parts.push(d.text);
  if (d.table) parts.push([d.table.columns.join(" | "), ...d.table.rows.map((r) => r.join(" | "))].join("\n"));
  if (d.media.length) parts.push(d.media.map((m) => `• ${m.kind === "video" ? "فيديو" : "صورة"} «${m.name}» — ${m.state === "done" ? "ولّدها جواد بعد موافقة العميل" : m.state === "failed" ? `فشل التوليد: ${m.error ?? ""}` : m.state === "running" ? "قيد التوليد" : "معروضة عليه بسعرها، ما وافق عليها بعد"}`).join("\n"));
  return parts.filter(Boolean).join("\n\n").slice(0, d.kind === "code" ? KHARQ.codeMax : KHARQ.textMax);
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

/** A line added to his system text this turn: the person's own switch, and where his team stands. */
export function turnNotes(o: { auto: boolean; rounds: number; continuing: boolean }): string {
  return [
    o.auto
      ? "«التوليد التلقائي» مفعّل عند العميل: هو موافق مسبقًا على الصور والفيديو اللي تقترحها في «deliver»، فتنصنع في الخلفية بلا زر وبسعرها من محفظته. اقترح فقط ما يحتاجه المطلوب فعلًا."
      : "«التوليد التلقائي» مطفأ: كل صورة أو فيديو تقترحه يظهر للعميل بسعره وزر تأكيد.",
    o.continuing ? "رجعت لك أجوبة فريقك (مكتوبة في ردّك السابق). ابنِ عليها الآن وكمّل للعميل بصوتك أنت: سلّم أو اسأل؛ لا تنسخ أجوبتهم كما هي إلا إذا كانت هي المخرج." : "",
    o.rounds >= KHARQ.consultRounds ? "استشرت فريقك بما يكفي لهذه الرسالة: لا تستشر أحدًا الآن (consult فارغة)، وجاوب أنت." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** He answers the conversation as it stands (a new message from the person, or his team's answers come back). */
async function answer(o: { userId: string; email: string | null; origin: string; chatId: string | null; before: Chat | null; history: Turn[]; auto: boolean; continuing: boolean }): Promise<Reply> {
  const rounds = consultRoundsSinceUser(o.history);
  // a long conversation: his own handoff of everything before, then the latest turns (lib/robot-handoff)
  const mem = await remember({ key: `kharq:${o.chatId ?? ""}`, userId: o.userId, robot: `${KHARQ.persona} (الفرع الخارق)`, turns: o.history, window: KHARQ.historyTurns });
  const turns = mem.kept.map((t) => ({ ...t }));
  // the answer after his team came back: the conversation ends with his own words, so the person's place is kept by a
  // short line from the site (never stored)
  const sent = o.continuing ? [...turns, { role: "user" as const, text: "(رجعت أجوبة فريقك. كمّل.)" }] : turns;
  const links = await uploadLinks(o.userId, sent.flatMap((t) => (t.files ?? []).filter((f) => f.kind === "image" || f.kind === "doc").map((f) => f.id)));
  const persona = await getPersona();

  const { data, usage } = await callClaudeJson<Answer>({
    system: systemText(persona.text, o.before?.brief ?? "", turnNotes({ auto: o.auto, rounds, continuing: o.continuing })),
    turns: [...mem.lead, ...sent.map((t) => turnFor(t, links))],
    schema: ANSWER_SCHEMA,
    maxTokens: KHARQ.maxTokens,
    // the owner asked for the strongest minds on this branch: it thinks hard every turn
    effort: "high",
    leader: isLeader(o.email),
    timeoutMs: 170_000,
  });
  const usd = claudeCost(usage) + mem.usd;

  const text = withNote(typeof data.reply === "string" ? data.reply.trim() : "", mem.fresh && typeof data.reply === "string" && !!data.reply.trim());
  const deliverRaw = readDeliver(data.deliver);
  const deliver = deliverRaw ? await priced(deliverRaw, { id: o.userId, email: o.email, owner: await unlimitedFor(o.email), origin: o.origin }) : undefined;
  const suggest = (Array.isArray(data.suggest) ? data.suggest : []).filter((s): s is string => typeof s === "string" && (ROAD_IDS as readonly string[]).includes(s)).slice(0, 4);
  const consult = rounds >= KHARQ.consultRounds ? undefined : readConsult((Array.isArray(data.consult) ? data.consult : []).map((c) => ({ ...(c as object), state: "pending" })));
  if (!text && !deliver && !consult) throw new Error("Claude gave an empty answer");

  const turn: Turn = {
    role: "assistant",
    text: text || (consult ? `أسأل ${consult.map((c) => `«${findAgent(c.agent)?.name}»`).join(" و")} وأرجع لك.` : `جاهز: «${deliver!.title || "المطلوب"}».`),
    ...(readQuestions(data.questions) ? { questions: readQuestions(data.questions) } : {}),
    ...(deliver ? { deliver } : {}),
    ...(suggest.length ? { suggest: [...new Set(suggest)] } : {}),
    ...(consult ? { consult } : {}),
  };
  const stage: KharqStage = (KHARQ_STAGES as readonly string[]).includes(String(data.stage)) ? (data.stage as KharqStage) : (o.before?.stage ?? "discover");
  const brief = typeof data.brief === "string" && data.brief.trim() ? data.brief.trim() : (o.before?.brief ?? "");

  const chatId = await saveChat(o.userId, o.chatId, [...o.history, turn], usd, { brief, stage });
  return { chatId, turn, stage, usd };
}

/**
 * The person says something (a new conversation when `chatId` is null), with files they attached. His answer is kept
 * with the conversation and returned — without his internal template, which never leaves the server. `auto` is the
 * person's «توليد تلقائي» switch (the pictures and videos he proposes are made without asking again).
 */
export async function say(o: { userId: string; chatId: string | null; message: string; email: string | null; attachments?: unknown; origin: string; auto?: boolean }): Promise<Reply> {
  const said = o.message.trim().slice(0, KHARQ.messageMax);
  const files = await attachmentsOf(o.userId, o.attachments);
  if (!said && !files.length) throw new UserError("اكتب رسالتك.");
  const before = o.chatId ? await getChat(o.userId, o.chatId) : null;
  if (o.chatId && !before) throw new Error("chat not found");
  // a message while his team was still being asked: their questions are dropped, the person's words come first
  const kept = (before?.messages ?? []).map((t) => (t.consult?.some((c) => c.state === "pending") ? { ...t, consult: t.consult.map((c) => (c.state === "pending" ? { ...c, state: "failed" as const, answer: "انقطعت الاستشارة برسالة جديدة." } : c)) } : t));
  const history = cleanHistory([...kept, { role: "user", text: said || "(ملفات مرفقة)", files: files.length ? files : undefined }]);
  return answer({ userId: o.userId, email: o.email, origin: o.origin, chatId: o.chatId, before, history, auto: o.auto === true, continuing: false });
}

/**
 * His team, in the background: the last answer's consultations are run (each agent with its whole knowledge) and kept
 * with the conversation. The page then asks him to go on (`goOn`). Two steps, so neither waits on the other's clock.
 */
export async function consultTeam(o: { userId: string; chatId: string; email: string | null }): Promise<{ consult: Consult[]; usd: number }> {
  const chat = await getChat(o.userId, o.chatId);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const waiting = pendingConsult(chat);
  if (!waiting) return { consult: chat.messages[chat.messages.length - 1]?.consult ?? [], usd: 0 };
  const recent = chat.messages
    .slice(-8, -1)
    .map((t) => `${t.role === "user" ? "العميل" : "محمد"}: ${t.text.replace(/\s+/g, " ").slice(0, 900)}`)
    .join("\n");
  const { list, usd } = await runConsults(waiting.consult, { userId: o.userId, email: o.email, brief: chat.brief, recent, leader: isLeader(o.email) });
  const messages = chat.messages.map((t, i) => (i === waiting.turn ? { ...t, consult: list } : t));
  await saveChat(o.userId, o.chatId, messages, usd);
  return { consult: list, usd };
}

/** After his team answered: he goes on, as himself, in a new answer. */
export async function goOn(o: { userId: string; chatId: string; email: string | null; origin: string; auto?: boolean }): Promise<Reply> {
  const before = await getChat(o.userId, o.chatId);
  if (!before) throw new Error("chat not found");
  const last = before.messages[before.messages.length - 1];
  if (!last || last.role !== "assistant" || !last.consult?.length) throw new UserError("ما في استشارة ينتظر جوابها.", 409);
  if (last.consult.some((c) => c.state === "pending")) throw new UserError("فريقه ما رجع بعد.", 409);
  return answer({ userId: o.userId, email: o.email, origin: o.origin, chatId: o.chatId, before, history: before.messages, auto: o.auto === true, continuing: true });
}
