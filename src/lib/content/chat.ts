// «صانع المحتوى» — one message in a conversation: the persona (the owner's edit or the template), the platform's
// rules and tools, the closest worked examples, the project's record, the person's attachments (pictures seen),
// then «محمد باقر»'s structured answer: the reply, the record, and — on an explicit request — a carousel to produce
// (made by GPT Image 2 in the produce step) or a package handed to «حيدرا ماكس» (an edit room opened in «حيدرة كت»).
// Server only.

import { remember, withNote } from "@/lib/robot-handoff";
import { isSalesAsk, nearestSalesExamples, SALES_METHOD, salesExamplesBrief } from "@config/content-sales";
import { isMotionCarouselAsk, MOTION_CAROUSEL_GUIDE, slideSeconds } from "@config/content-motion-carousel";
import { isMahdiAsk, MAHDI_BRIEF } from "@config/mahdi/app-knowledge";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLeader, callClaudeJson, claudeCost, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { createEditorProject, requireEditorProject } from "@/lib/editor/server";
import { appendChat } from "@/lib/editor/chat";
import { saveLabChat } from "@/lib/editor/lab-chats";
import { CONTENT, isCarouselAspect, type CarouselAspect } from "@config/content";
import { contentExamplesBrief, nearestContentExamples } from "@config/content-examples";
import { nearestTemplateExamples, templateExamplesBrief } from "@config/content-template-examples";
import { findTemplate } from "@config/content-templates";
import { findCarouselStyle } from "@config/content-carousel-styles";
import { findContentFont } from "@config/content-fonts";
import { findStyle } from "@config/film-styles";
import { cleanHistory, getChat, readMedia, readQuestions, saveChat, type Attachment, type MediaItem, type MotionPlan, type PendingProduce, type Turn } from "./chats";
import { attachmentsOf, uploadLinks } from "./files";
import { catalogBlock, chosenBlock, chosenIds, getPersona, motionCatalogBlock, pathBlock, systemText, turnText } from "./persona";
import { moodOf, motionStyleOf } from "@/lib/editor/motion-styles";
import { readStoryboard } from "@/lib/editor/motion-build";
import { stripMarks } from "./marks";
import { attachedPictures, CAROUSEL_QUESTION, carouselHold, pickedCarousel, pickedFont, pickedKind, pickedMaker, pickedMotionStyle, pickedPalette, pickedPhotos, pickedRoute } from "./maker";
import { lastSlidesAt } from "./produce";
import { listenToLinks } from "@/lib/link-listen";
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
          kind: { type: "string", enum: ["choice", "carousels", "fonts", "templates", "styles", "motion", "moods", "palettes"], description: "choice: خيارات نصية؛ carousels: جدول ستايلات الكاروسيل حسب المجال، وهو أول سؤال في أي كاروسيل؛ fonts: قائمة الخطوط العربية (٥٠ خطًا)، بعد الستايل؛ templates: معرض قوالب الكاروسيل؛ styles: خريطة الستايلات (١٠٠ ستايل في ١٤ عائلة)؛ motion: معرض مهارات الموشن عند حيدرا ماكس؛ moods: معرض مشاعر الموشن؛ palettes: معرض الألوان (١٠٠ لوحة رباعية من Color Hunt)" },
          options: { type: "array", items: { type: "string" }, description: "إجابات قصيرة (٢–٧) لـ choice؛ ولـ carousels معرّفات الستايلات التي ترشحها (حتى ٥) أو فارغة؛ ولـ fonts معرّفات الخطوط التي ترشحها (حتى ٥) أو فارغة؛ وفارغة لبقية المعارض" },
          multi: { type: "boolean", description: "يجوز اختيار أكثر من إجابة" },
        },
      },
    },
    record: { type: "string", description: "سجل المشروع كاملًا ومحدّثًا، أو فارغًا إذا لم يتغير." },
    produce: {
      type: "object",
      additionalProperties: false,
      required: ["on", "mode", "maker", "aspect", "carousel_id", "font_id", "template_id", "style_id", "refs", "slides"],
      description: "إنتاج كاروسيل: العميل يختار من يصمم شرائحه: «حيدرا ماكس» بالكود، أو GPT Image 2 يرسم كل شريحة كاملة بكتابتها، أو GPT Image 2 للصور وحيدرا ماكس للكتابة. فقط بعد طلب صريح واختيار العميل. on=false بدون إنتاج.",
      properties: {
        on: { type: "boolean" },
        mode: { type: "string", enum: ["all", "fix"], description: "all: كاروسيل جديد؛ fix: إعادة رسم شرائح بعينها من آخر كاروسيل" },
        maker: { type: "string", enum: ["code", "gpt", "mix"], description: "من يصمم الشرائح، كما اختاره العميل: code = حيدرا ماكس بالكود؛ gpt = GPT Image 2 يرسم كل شريحة كاملة بكتابتها؛ mix = GPT Image 2 يرسم صورة كل شريحة بلا كتابة وحيدرا ماكس يكتب عليها. في mode=fix يُهمل (تُعاد بطريقة الكاروسيل الأصلي)." },
        aspect: { type: "string", enum: ["1:1", "2:3", "9:16", "16:9"] },
        carousel_id: { type: "string", description: "معرّف ستايل الكاروسيل الذي اختاره العميل من الجدول، أو فارغ إذا طلب شكلًا غير الموجود" },
        font_id: { type: "string", description: "معرّف الخط من قائمة الخطوط: الذي اختاره العميل، أو الذي اخترته أنت إذا ترك لك الاختيار" },
        template_id: { type: "string", description: "معرّف القالب الذي اختاره العميل، أو فارغ" },
        style_id: { type: "string", description: "معرّف الستايل الكرتوني الذي اختاره العميل، أو فارغ" },
        refs: { type: "array", items: { type: "string" }, description: "معرّفات (id) صور العميل المرفقة التي تُسلَّم إلى جواد مع كل شريحة (شعار، صورة، منتج)، أو فارغة" },
        slides: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["n", "text", "prompt", "picture"],
            properties: {
              n: { type: "integer", description: "رقم الشريحة من 1" },
              text: { type: "string", description: "النص المعتمد الظاهر على الشريحة كما هو" },
              prompt: { type: "string", description: "توجيه الشريحة بالإنجليزية: مع maker=code أو mix لـ «حيدرا ماكس»، ومع maker=gpt لـ GPT Image 2 (يرسمها كاملة بكتابتها): ما يخص هذه الشريحة (مع ستايل من الجدول يضيف الموقع وصفه؛ وبدونه نظام التصميم كاملًا)، والنص العربي حرفيًا بين علامتي اقتباس مزدوجتين" },
              picture: { type: "string", description: "في الموشن كاروسيل: مع طريقة «حيدرا ماكس + صورة» توجيه صورة الشريحة كاملة، ومع «عناصر مفرّغة» توجيه عنصر واحد منفرد واضح على خلفية سادة، ومع «بالكود فقط» فارغ؛ وفي الكاروسيل الثابت: مع maker=mix إلزامي لكل شريحة، ومع maker=code إذا احتاجت الشريحة صورة (شخص، منتج، مشهد، رسمة) ما يرسمها الكود زين: توجيهها بالإنجليزية لـ GPT Image 2 بدون أي كتابة فيها أبدًا وبنفس ستايل الكاروسيل؛ وإلا فارغ؛ ومع maker=gpt فارغ دائمًا" },
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
              refs: { type: "array", items: { type: "string" }, description: "معرّفات (id) ملفات العميل المرفقة المراد استخدامها كمراجع بصرية، أو معرّفات الصور اللي ولّدها جواد قبل في هذي المحادثة (تظهر [id …] جنب الصورة الجاهزة) — ضعها دائمًا لما الطلب يكمّل نفس الشخصية أو المشهد عشان تبقى نفسها؛ أو فارغة" },
            },
          },
        },
      },
    },
    handoff: {
      type: "object",
      additionalProperties: false,
      required: ["on", "title", "shape", "package", "storyboard"],
      description: "تسليم ريل منتج أو موشن جرافيكس إلى حيدرا ماكس، فقط بعد طلب صريح. on=false بدون تسليم.",
      properties: {
        on: { type: "boolean" },
        title: { type: "string", description: "اسم المشروع (قصير)" },
        shape: { type: "string", enum: ["9:16", "16:9"] },
        package: { type: "string", description: "الحزمة الكاملة المكتفية بذاتها بالعربية (المرحلة الخامسة)" },
        storyboard: { type: "string", description: "للموشن جرافيكس فقط: لوحة القصة كنص JSON (style وmood وpalette وbeats… كما يقرؤها حيدرا ماكس)؛ الموقع يفحصها ويسلّمها لحيدرا ماكس. فارغ لغير الموشن." },
      },
    },
  },
} as const;

interface Answer {
  reply: string;
  questions: unknown;
  record: string;
  produce: { on: boolean; mode: string; maker?: string; aspect: string; carousel_id?: string; font_id?: string; template_id: string; style_id: string; refs?: string[]; slides: { n: number; text: string; prompt: string; picture?: string }[] };
  generate?: { on: boolean; items: { kind: string; name: string; prompt: string; aspect: string; quality: string; resolution: string; seconds: number; with_sound: boolean; refs: string[] }[] };
  handoff: { on: boolean; title: string; shape: string; package: string; storyboard?: string };
}

export interface Reply {
  chatId: string;
  text: string;
  questions: Turn["questions"] | null;
  usd: number;
  /** slides are waiting to be made (the page calls the produce step) */
  pending: { total: number; mode: "all" | "fix"; todo: number[] } | null;
  editor: { id: string; title: string; lab?: string } | null;
  /** pictures or videos were handed to جواد (the page calls the media step) */
  media: MediaItem[] | null;
  /** what this conversation had taken from the wallet BEFORE this turn (halalas); the route adds this turn's own
   * charge and sends the person the new total */
  spentHalalas: number;
}

const KIND_AR = { image: "صورة", video: "فيديو", audio: "صوت", doc: "ملف PDF" } as const;

/** What an answer of his looked like to the person beyond its words: the buttons he offered and the carousel's state. */
function assistantNote(t: Turn): string {
  const parts: string[] = [];
  if (t.questions?.length) {
    parts.push(`[الأسئلة التي عُرضت للعميل كأزرار: ${t.questions.map((q, i) => `${i + 1}) ${q.label}${q.kind === "carousels" ? " (جدول ستايلات الكاروسيل)" : q.kind === "fonts" ? " (قائمة الخطوط)" : q.kind === "motioncarousels" ? " (جدول ستايلات الحركة)" : q.kind === "templates" ? " (معرض القوالب)" : q.kind === "styles" ? " (معرض الستايلات الكرتونية)" : q.kind === "motion" ? " (معرض مهارات الموشن)" : q.kind === "moods" ? " (معرض مشاعر الموشن)" : q.kind === "palettes" ? " (معرض الألوان)" : `: ${q.options.join(" | ")}`}`).join("؛ ")}]`);
  }
  const s = t.slides;
  if (s) {
    const lines = [`[حالة الإنتاج من الموقع — كاروسيل ${s.aspect}: شرائح مصنوعة ${s.items.map((x) => x.n).join(",") || "لا شيء"}${s.todo.length ? `؛ قيد الرسم ${s.todo.join(",")}` : ""}${s.failed.length ? `؛ لم تُصنع ${s.failed.map((f) => `${f.n} (${f.reason})`).join(", ")}` : ""}]`];
    if (s.report) lines.push(s.report);
    parts.push(lines.join("\n"));
  }
  if (t.media) {
    const ST = { todo: "بانتظار جواد", running: "جواد يولّدها", done: "جاهزة", failed: "فشلت" } as const;
    parts.push(`[طلبات سلّمتها لجواد (هو من يولّد، وتظهر أيضًا في «أعمالي»): ${t.media.items.map((x, i) => `${i + 1}) ${x.kind === "video" ? "فيديو" : "صورة"} «${x.name}» — ${ST[x.state]}${x.error ? ` (${x.error})` : ""}${x.desk ? ` — ${x.desk.generator}${x.desk.free ? "" : ` ${x.desk.coins} عملة`}` : ""}${x.state === "done" && x.fileId ? ` [id ${x.fileId}]` : ""}`).join("؛ ")}]`);
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
    const url = links.get(f.id);
    if (!url) continue;
    // a picture is looked at; a PDF is READ (its own pages, by link), and a video or a sound is only named
    if (f.kind === "image") parts.push({ type: "image", url });
    else if (f.kind === "doc") parts.push({ type: "doc", url, name: f.name });
  }
  return { role: t.role, content: parts };
}

/** «كمّل» and its kin, alone: the person wants what stopped to go on, nothing new. */
export const isContinue = (t: string) => /^(يلا\s+)?(كمل|كمّل|كملي|كمّلي|اكمل|أكمل|تابع|استمر|كمل الرسم|كمّل الرسم|كمل التوليد|كمّل التوليد|continue|go on)[\s.!؟?]*$/i.test(t.trim());

/** The pictures جواد made in this conversation (their file ids): references for the next picture of the same character. */
export const madePictures = (turns: Turn[]) => turns.flatMap((t) => (t.media?.items ?? []).filter((x) => x.kind === "image" && x.state === "done" && x.fileId).map((x) => x.fileId!));

/** The person says something in a conversation (a new one when `chatId` is null). */
export async function say(userId: string, chatId: string | null, message: string, attachmentIds: unknown, email: string | null = null, opts: { verbose?: boolean; from?: number } = {}): Promise<Reply> {
  const said = message.trim().slice(0, CONTENT.messageMax);
  const { list: files } = await attachmentsOf(userId, attachmentIds);
  if (!said && !files.length) throw new Error("empty message");
  const full = chatId ? await getChat(userId, chatId) : null;
  if (chatId && !full) throw new Error("chat not found");
  // an old message of theirs was edited: the talk goes on from there (what came after it is dropped, and so are the pending carousel and the record kept for it: what he decided is in the marks and the messages that stay)
  const cut = full && Number.isInteger(opts.from) && opts.from! >= 0 && opts.from! < full.messages.length && full.messages[opts.from!].role === "user" ? opts.from! : -1;
  const before = full && cut >= 0 ? { ...full, messages: full.messages.slice(0, cut), record: "", pending: null } : full;
  const history = cleanHistory([...(before?.messages ?? []), { role: "user", text: said || "(ملفات مرفقة)", files: files.length ? files : undefined }]);
  // a long conversation: his own handoff of everything before, then the latest turns (lib/robot-handoff)
  const mem = await remember({ key: `content:${chatId ?? ""}`, userId, robot: "محمد باقر (صانع المحتوى)", turns: history, window: CONTENT.historyTurns });
  const turns = mem.kept;
  // pictures of this conversation, by short-lived link, so he can look at them
  const links = await uploadLinks(userId, turns.flatMap((t) => (t.files ?? []).filter((f) => f.kind === "image" || f.kind === "doc").map((f) => f.id)));
  const persona = await getPersona();
  // what the person picked in the galleries (all their messages), and the closest worked examples
  const ids = chosenIds(history.filter((t) => t.role === "user").map((t) => t.text));
  const ask = stripMarks(said || turns.find((t) => t.role === "user")?.text || "");
  // the system stays the SAME every message (persona, rules, the catalogue: cached once); what changes per message —
  // the nearest examples, the chosen blocks, the record — rides at the start of this turn (it re-wrote everything at
  // full price each message when it sat in the system)
  const parts = [
    // the motion skills, feelings and drawing tools: when the work is motion graphics
    ...(ids.motion || ids.mood || ids.path === "motion-graphics" || ids.path === "reel-graphics" || /موشن|motion|انترو|إنترو|تايبوغرافي|إنفوجرافيك|انفوجرافيك/i.test(`${ask} ${before?.record ?? ""}`) ? [motionCatalogBlock()] : []),
    // the motion carousel (Instagram's rules, when it helps, how each slide moves and sounds): when the talk is a carousel or motion
    ...(ids.carousel || ids.path === "motion-carousel" || isMotionCarouselAsk(`${ask} ${before?.record ?? ""}`) ? [MOTION_CAROUSEL_GUIDE] : []),
    // the talk's rules, how edits are read, and the steps of the path the person is on
    pathBlock(ids, !!opts.verbose),
    chosenBlock(ids),
    contentExamplesBrief(nearestContentExamples(ask, 3)),
    // selling: the method (the four steps) and the closest worked sales examples, when that is what the person wants
    ...(isSalesAsk(`${ask} ${before?.record ?? ""}`) ? [SALES_METHOD, salesExamplesBrief(nearestSalesExamples(ask, 3))] : []),
    // the app «لأجل المهدي» (every feature, its audiences, its content rules and ready ideas), when the conversation is about it
    ...(isMahdiAsk(`${history.filter((t) => t.role === "user").map((t) => t.text).join(" ")} ${before?.record ?? ""}`) ? [MAHDI_BRIEF] : []),
    !findCarouselStyle(ids.carousel ?? "") && (ids.template || /كاروسيل|شرائح|carousel/i.test(ask + (before?.record ?? ""))) ? templateExamplesBrief(nearestTemplateExamples(ask, ids.template && ids.template !== "none" ? ids.template : null, 2)) : "",
  ].filter(Boolean);
  // a YouTube / TikTok link in this message (or earlier in the talk): heard by ElevenLabs before he answers, so he
  // works from what is said in it (lib/link-listen)
  const listened = await listenToLinks(said, turns.filter((t) => t.role === "user").slice(0, -1).map((t) => t.text), { budgetMs: 120_000 });
  if (listened.block) parts.unshift(listened.block);
  const system = systemText(persona.text, [catalogBlock()]);
  const turnNote = turnText(parts, before?.record ?? "");
  // a carousel that stopped half way (a wallet ran out, a closed page): «كمّل» goes on drawing it as it was — no new
  // answer, no new plan (a new plan drew the characters again, different, and the person had to explain it all again)
  const unfinished = before?.pending && cut < 0 ? before.pending : null;
  const left = unfinished ? unfinished.slides.map((x) => x.n).filter((n) => !unfinished.made.some((m) => m.n === n) && !unfinished.failed.some((f) => f.n === n)) : [];
  if (unfinished && left.length && !files.length && isContinue(said)) {
    const reply: Turn = { role: "assistant", text: `تمام، أكمل رسم ${left.length === 1 ? `الشريحة ${left[0]}` : `الشرائح الباقية (${left.join("، ")})`} من نفس المكان، بنفس التصميم والشخصيات اللي انرسمت.` };
    const id = await saveChat(userId, chatId, { messages: [...history, reply] });
    return { chatId: id, text: reply.text, questions: null, usd: 0, pending: { total: unfinished.slides.length, mode: "fix", todo: left }, editor: null, media: null, spentHalalas: full?.spentHalalas ?? 0 };
  }
  const waitingNote = !unfinished || !left.length ? "" : (`[كاروسيل ما خلص رسمه: الشرائح ${left.join("، ")} تنتظر بنفس التصميم والشخصيات اللي انرسمت، والموقع يكملها بنفسه بعد ردّك. لا تعيد تخطيط الكاروسيل ولا تغيّر شخصياته أو تصميمه أو نصوصه، ولا تطلب produce جديد، إلا إذا طلب العميل تغييرًا صريحًا.]`);
  const r = await callClaudeJson<Answer>({ system, turnNote: waitingNote ? `${waitingNote}\n\n${turnNote}` : turnNote, turns: [...mem.lead, ...turns.map((t) => toClaudeTurn(t, links))], schema: ANSWER_SCHEMA, maxTokens: CONTENT.maxTokens, effort: "medium", leader: isLeader(email) });
  const a = r.data;
  let usd = claudeCost(r.usage) + mem.usd + listened.usd;
  const questions = readQuestions(a.questions);
  const reply: Turn = { role: "assistant", text: withNote(a.reply.trim() || "…", mem.fresh), ...(questions ? { questions } : {}) };
  const messages = [...history, reply];
  const at = messages.length - 1;

  // a carousel to make: kept with the conversation; the page asks for the produce step right after
  let pending: PendingProduce | null = null;
  if (a.produce?.on && Array.isArray(a.produce.slides) && a.produce.slides.length) {
    const aspect: CarouselAspect = isCarouselAspect(a.produce.aspect) ? a.produce.aspect : "1:1";
    const slides = a.produce.slides
      .filter((s) => s && typeof s.prompt === "string" && s.prompt.trim())
      .slice(0, CONTENT.maxSlides)
      .map((s, i) => ({ n: Number(s.n) || i + 1, text: String(s.text ?? "").replace(/\s*<br\s*\/?>\s*/gi, "\n").slice(0, 2000), prompt: s.prompt.trim().slice(0, 4000), ...(typeof s.picture === "string" && s.picture.trim() ? { picture: s.picture.trim().slice(0, 3000) } : {}) }))
      .sort((x, y) => x.n - y.n);
    const templateId = a.produce.template_id && findTemplate(a.produce.template_id) ? a.produce.template_id : "";
    const styleId = a.produce.style_id && findStyle(a.produce.style_id) ? a.produce.style_id : "";
    const fixAt = a.produce.mode === "fix" ? lastSlidesAt({ messages: history }) : -1;
    // who makes the slides is the person's pick, asked as the last step before a new carousel (the owner's order: «حيدرا ماكس» in code, GPT Image 2 painting each whole slide,
    // or GPT Image 2's pictures with «حيدرا ماكس»'s writing; no default): the server decides from the answer they pressed, not from what the model says. A fix goes back to the way the carousel was made
    const fixed = fixAt >= 0 ? history[fixAt].slides : null;
    const picked = fixed ? (fixed.maker === "code" ? (fixed.mix ? "mix" : "code") : "gpt") : pickedMaker(history);
    // a motion carousel: every slide is «حيدرا ماكس»'s moving scene (its style and way of making as pressed; a fix keeps the carousel's own)
    const motionPick = fixed ? null : pickedKind(history) === "motion" ? pickedMotionStyle(history) : null;
    const route = fixed ? null : pickedRoute(history);
    const motion: MotionPlan | null =
      fixed?.motion ? fixed.motion
      : motionPick && motionPick.id !== "help" && route ? { styleId: motionPick.id, ...(motionPick.own ? { own: motionPick.own } : {}), route, seconds: slideSeconds(motionPick.style) }
      : null;
    const code = motion || picked === "code" ? { maker: "code" as const } : picked === "mix" ? { maker: "code" as const, mix: true } : {};
    const moving = motion ? { motion } : {};
    const hold = fixed ? null : carouselHold(history, slides.length);
    if (slides.length && fixAt >= 0) {
      // draw these slides again in the carousel that exists
      const block = history[fixAt].slides!;
      pending = { id: randomUUID(), aspect: block.aspect, slides, at: fixAt, styleId: styleId || block.styleId, templateId: templateId || block.templateId, ...(block.carouselId ? { carouselId: block.carouselId } : {}), ...(block.fontId ? { fontId: block.fontId } : {}), ...(block.paletteId ? { paletteId: block.paletteId } : {}), mode: "fix", ...code, ...moving, made: [], failed: [], carry: block.failed.filter((f) => !slides.some((x) => x.n === f.n)) };
      messages[fixAt] = { ...history[fixAt], slides: { ...block, todo: slides.map((x) => x.n), failed: pending.carry, running: true, report: undefined } };
    } else if (slides.length && hold) {
      // nothing is made until they choose: the question goes out, and their answer brings the slides back
      // (the table he offered himself, with his recommendations, stands in for the plain one)
      const own = (hold.question.kind === "carousels" || hold.question.kind === "fonts" || hold.question.kind === "motioncarousels") && questions?.some((q) => q.kind === hold.question.kind);
      // the colour step is always the site's own (its first button keeps the style's colours)
      const theirs = (questions ?? []).filter((q) => q.label !== hold.question.label && !(hold.question.kind === "palettes" && q.kind === "palettes"));
      reply.questions = own ? questions : [...theirs, hold.question].slice(-6);
      reply.text += `\n\n${hold.note}`;
    } else if (slides.length) {
      const pick = pickedCarousel(history);
      const carouselId = pick?.style?.id ?? "";
      // the font they picked; "auto" leaves it to the answer's own choice of a font of the list
      const font = pickedFont(history);
      const fontId = font?.font?.id ?? (a.produce.font_id && findContentFont(a.produce.font_id) ? a.produce.font_id : "");
      // the palette that replaces the style's colours (none picked, or "style": the style's own)
      const paletteId = pickedPalette(history)?.palette?.id ?? "";
      const mine = new Set(history.flatMap((t) => (t.files ?? []).filter((f) => f.kind === "image").map((f) => f.id)));
      const named = (Array.isArray(a.produce.refs) ? a.produce.refs : []).filter((r) => mine.has(r));
      // they chose to add their own pictures: those go with the slides even if the answer forgot to name them
      const refs = (named.length || pickedPhotos(history) !== "mine" ? named : attachedPictures(history).map((f) => f.id)).slice(0, 6);
      pending = { id: randomUUID(), aspect, slides, at, styleId, templateId, ...(carouselId ? { carouselId } : {}), ...(fontId ? { fontId } : {}), ...(paletteId ? { paletteId } : {}), ...(refs.length ? { refs } : {}), mode: "all", ...code, ...moving, made: [], failed: [], carry: [] };
      reply.slides = { aspect, items: [], todo: slides.map((x) => x.n), failed: [], running: true, total: slides.length, styleId, templateId, ...(carouselId ? { carouselId } : {}), ...(fontId ? { fontId } : {}), ...(paletteId ? { paletteId } : {}), ...code, ...moving };
    }
  }

  // a carousel asked for and no style picked yet: the table is always among the first questions, whatever the answer offered
  if (!pending && !reply.slides && !pickedCarousel(history) && !reply.questions?.some((q) => q.kind === "carousels") && !history.some((t) => t.questions?.some((q) => q.kind === "carousels")) && /كاروسيل|كاروسل|شرائح|carousel/i.test(said)) {
    reply.questions = [...(reply.questions ?? []).filter((q) => q.kind !== "templates" && q.kind !== "palettes"), CAROUSEL_QUESTION].slice(-6);
  }

  // pictures and videos for جواد: the requests are kept with the answer; the page asks for the media step right after
  let media: MediaItem[] | null = null;
  if (a.generate?.on && Array.isArray(a.generate.items) && a.generate.items.length) {
    // their attachments, and the pictures جواد already made in this conversation (the same character stays the same)
    const mine = new Set([...history.flatMap((t) => (t.files ?? []).map((f) => f.id)), ...madePictures(history)]);
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
    if (items.length) {
      reply.media = { items };
      media = items;
    }
  }

  // a package for «حيدرا ماكس»: an edit room in «حيدرة كت», the package first in its conversation, the files in its library
  let editor: { id: string; title: string; lab?: string } | null = null;
  if (a.handoff?.on && typeof a.handoff.package === "string" && a.handoff.package.trim()) {
    try {
      editor = await openEditRoom(userId, a.handoff, history);
      reply.editor = editor;
      reply.text += editor.lab
        ? `\n\n🎬 فتحت «${editor.title}» في «مختبر الموشن» داخل «حيدرة كت»: محادثة جاهزة فيها الحزمة كاملة، يكتب فيها حيدرا ماكس السيناريو أول ما تفتحها، وتعتمده ويبنيه بالكود قدامك. ونقلت ملفاتك المرفقة إلى مكتبتها.`
        : `\n\n🎬 فتحت غرفة مونتاج باسم «${editor.title}» في «حيدرة كت»، ووضعت الحزمة الكاملة أول المحادثة مع حيدرا ماكس، ونقلت ملفاتك المرفقة إلى مكتبتها.`;
    } catch (e) {
      console.error("content handoff", e);
      reply.text += `\n\n⚠️ لم أتمكن من فتح غرفة المونتاج في «حيدرة كت» الآن (${e instanceof UserError ? e.message : "خطأ في الخادم"}). الحزمة جاهزة أعلاه؛ اطلب التسليم مرة ثانية بعد قليل.`;
    }
  }

  // a reply that orders no new carousel keeps the one still being drawn (and the page goes on drawing it)
  const keep = !pending && unfinished && left.length ? unfinished : null;
  const id = await saveChat(userId, chatId, { messages, record: a.record?.trim() ? a.record.trim() : cut >= 0 ? "" : undefined, pending: keep ? undefined : pending, addUsd: usd });
  usd = Math.round(usd * 10000) / 10000;
  const goOn = pending ? { total: pending.slides.length, mode: pending.mode, todo: pending.slides.map((x) => x.n) } : keep ? { total: keep.slides.length, mode: "fix" as const, todo: left } : null;
  return { chatId: id, text: reply.text, questions: reply.questions ?? null, usd, pending: goOn, editor, media, spentHalalas: full?.spentHalalas ?? 0 };
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
  // a motion piece: the storyboard Baqir wrote, checked by the same reader حيدرا ماكس's engine uses (what it can't read is left out), with the choices the client made
  const sb = typeof h.storyboard === "string" && h.storyboard.trim() ? readStoryboard(h.storyboard) : null;
  const motion = sb
    ? `\n\nلوحة القصة (storyboard) للموشن جرافيكس، فحصها الموقع وهي جاهزة للبناء كما هي (مهارة: ${motionStyleOf(sb.style)?.ar ?? "من اختيارك"}، مزاج: ${moodOf(sb.look?.mood)?.ar ?? "من اختيارك"}): استخدمها في الحقل "motion" كما هي أو عدّل عليها بحسب طلب العميل.\n${JSON.stringify(sb).slice(0, 12000)}\nالخلفيات والأيقونات والمشاهد ترسمها أنت بأدوات المحرر (لا تطلب خلفية من GPT Image 2 إلا إذا طلب العميل صورة صراحةً).`
    : "";
  // the handoff is what حيدرا ماكس reads first at every answer; the message is what the person sees
  const { error } = await db().from("editor_chats").upsert({ project_id: p.id, user_id: p.user_id, messages: [], handoff: `من محمد باقر (صانع المحتوى) — حزمة المشروع الكاملة:\n${pkg}${motion}`, chats: 1, updated_at: new Date().toISOString() });
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
  // a motion piece goes straight to «مختبر الموشن»: a conversation of its own with the package as its brief, which
  // writes the scenario by itself when it is opened (before migration 0087 the package stays with حيدرا ماكس, as before)
  let lab: string | undefined;
  if (sb || /موشن|motion/i.test(pkg)) {
    const r = await saveLabChat(p, userId, { title, state: { brief: pkg.slice(0, 6000), seconds: 15, chat: [{ role: "user", text: `📨 من محمد باقر — «${title}»:\n${pkg.slice(0, 1800)}` }], autoPlan: true } }).catch((e: unknown) => (console.error("content handoff lab", e), null));
    if (r?.id) lab = r.id;
  }
  return { id: p.id, title, ...(lab ? { lab } : {}) };
}
