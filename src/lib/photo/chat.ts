// «زهراء فوتو ماستر» — one message to «زهراء»: the persona (the owner's edit or the template), the platform's rules and tools,
// the fonts, the project's record and where it came from, then the project as it is now (every layer with its id and numbers)
// and a small picture of the canvas so she SEES it. Her answer is structured: a reply, commands for the page, quick
// suggestions, the project's record, and — only when needed — a request for جواد. The commands are tried on the project
// HERE, in order; the ones that work are kept and the first that fails stops the rest and is told to the person. Server only.

import { remember, withNote } from "@/lib/robot-handoff";
import { callClaudeJson, claudeCost, isLeader, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { PHOTO } from "@config/photo";
import { nearestPhotoExamples, photoExamplesBrief } from "@config/photo-training";
import { applyOps, describeDoc, docChanges, readDoc, readOps, type PhotoDoc } from "./doc";
import { projectFiles } from "./files";
import { fontIds, getPersona, systemText } from "./persona";
import { getProject, saveProject, type PhotoTurn, type Source } from "./projects";
import { UserError } from "@/lib/api";

export const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "ops", "suggestions", "record", "jawad", "return_to"],
  properties: {
    reply: { type: "string", description: "ردّك للعميل بالعربية (ماركداون خفيف)، قصير." },
    ops: { type: "array", items: { type: "string", description: "أمر واحد كنص JSON" }, description: "أوامر التعديل بالترتيب (فارغة إن لم يكن هناك تعديل)." },
    suggestions: { type: "array", items: { type: "string" }, description: "حتى ٤ اقتراحات قصيرة قابلة للضغط لما بعد." },
    record: { type: "string", description: "سجل المشروع كاملًا ومحدّثًا، أو فارغًا إذا لم يتغير." },
    jawad: {
      type: "object",
      additionalProperties: false,
      required: ["on", "kind", "prompt", "aspect", "target", "source"],
      description: "طلب لجواد، فقط عند الحاجة. on=false بدون.",
      properties: {
        on: { type: "boolean" },
        kind: { type: "string", enum: ["generate", "cutout", "edit"] },
        prompt: { type: "string", description: "بالإنجليزية، بلا نص مكتوب داخل الصورة" },
        aspect: { type: "string", enum: ["1:1", "2:3", "9:16", "16:9", "3:2", "auto"] },
        target: { type: "string", enum: ["base", "layer", "file"] },
        source: { type: "string", description: "للقص: base أو معرّف طبقة صورة" },
      },
    },
    return_to: { type: "string", enum: ["", "designer"], description: "designer فقط إذا طلب العميل صراحة إرجاع التصميم لكاظم." },
    claude_code: {
      type: "object",
      additionalProperties: false,
      required: ["on", "mode", "prompt"],
      description: "«حيدرا ماكس»: on=true مع mode=\"grade\" حين يطلب العميل لوكًا أو تلوينًا أو تصحيح ألوان (سينمائي، دافئ، فيلم قديم، ألوان مرجع…)؛ أو mode=\"layout\" — الخيار الثاني بجانب أوامرك العادية — حين يطلب العميل تركيبًا أو ترتيبًا أو تصميمًا كاملًا للطبقات: وضع صور (عدة صور أشخاص في إطارات، شبكة صور، صورة بطلة)، تركيب العناصر المفككة من جديد، كتابة نصوص كثيرة أو تغيير النصوص وترتيبها، أو يطلب حيدرا ماكس بالاسم. حيدرا ماكس يكتب برنامجًا يحسب كل موضع ومقاس من حقائق التصميم، يشوف النتيجة ويقيّمها ويعيد كتابته لين تنجح، ثم يطبّقها مرة وحدة. التعديل الصغير الواحد يبقى بأوامرك (ops). on=false غير ذلك.",
      properties: { on: { type: "boolean" }, mode: { type: "string", enum: ["grade", "layout"] }, prompt: { type: "string", description: "grade: اللوك المطلوب بالكلمات (المزاج، المرجع، وما يُحمى كالبشرة). layout: الطلب كاملًا بالكلمات (ما يُوضع وأين، النصوص حرفيًا، الأسلوب، ما لا يُغطّى كالوجوه)" } },
    },
  },
} as const;

interface Answer {
  reply: string;
  ops: string[];
  suggestions: string[];
  record: string;
  jawad: { on: boolean; kind: string; prompt: string; aspect: string; target: string; source: string };
  return_to: string;
  claude_code?: { on: boolean; mode?: string; prompt: string };
}

/** What جواد is asked, after the checks. */
export interface JawadAsk {
  kind: "generate" | "cutout" | "edit";
  prompt: string;
  aspect: string;
  target: "base" | "layer" | "file";
  source: string;
}

export interface Said {
  reply: string;
  doc: PhotoDoc;
  changes: string[];
  suggestions: string[];
  jawad: JawadAsk | null;
  /** «Claude Code»: the look to grade the base picture to, by program (the page runs it) */
  code: { prompt: string; mode: "grade" | "layout" } | null;
  returnTo: boolean;
  usd: number;
  /** the command that stopped the rest, if any */
  stopped: string | null;
}

const sourceBlock = (s: Source | null) =>
  s?.kind === "designer"
    ? "مصدر المشروع: وصل من «كاظم» (المصمم الذكي). الكلمات الظاهرة طبقات نص حقيقية من تصميمه؛ لا تغيّريها إلا بطلب العميل. سجله مع سجل المشروع أدناه. يستطيع العميل إرجاع التصميم لكاظم."
    : s?.kind === "upload"
      ? "مصدر المشروع: صورة رفعها العميل."
      : s?.kind === "work"
        ? "مصدر المشروع: عمل من «أعمالي» صنعه جواد."
        : "مصدر المشروع: لوحة جديدة.";

/** The person says something in a project. `doc` is the canvas as the page has it now (it wins over the saved one). */
export async function say(userId: string, email: string | null, p: { projectId: string; message: string; doc?: unknown; preview?: unknown }): Promise<Said> {
  const message = p.message.trim().slice(0, PHOTO.messageMax);
  if (!message) throw new UserError("اكتب رسالتك.");
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("زهراء غير مفعّلة على الخادم.", 503);
  const project = await getProject(userId, p.projectId);
  if (!project) throw new UserError("ما لقينا هذا المشروع.", 404);
  const before = readDoc(p.doc ?? project.doc);
  const files = await projectFiles(userId, project.id);
  const info = new Map(files.filter((f) => f.width && f.height).map((f) => [f.id, { w: f.width, h: f.height }]));
  const persona = await getPersona();
  const system = systemText(persona.text, [sourceBlock(project.source), photoExamplesBrief(nearestPhotoExamples(message, 3))].filter(Boolean), project.record);

  const preview = typeof p.preview === "string" && p.preview.length < 900_000 && /^[A-Za-z0-9+/]+=*$/.test(p.preview) ? p.preview : null;
  const text = [`حالة اللوحة الآن:\n${describeDoc(before, files.map((f) => ({ id: f.id, name: f.name, w: f.width, h: f.height, role: f.role })))}`, preview ? "(المعاينة مرفقة: هكذا تبدو اللوحة الآن)" : "(لا معاينة)", `رسالة العميل:\n${message}`].join("\n\n");
  const parts: ClaudePart[] = [{ type: "text", text }];
  if (preview) parts.push({ type: "image64", data: preview, mediaType: "image/jpeg" });
  // a long conversation: her own handoff of everything before, then the latest turns (lib/robot-handoff)
  const mem = await remember({ key: `photo:${project.id}`, userId, robot: "زهراء (فوتو ماستر)", turns: project.messages.filter((t) => !t.note), window: PHOTO.historyTurns });
  const history: ClaudeTurn[] = [...mem.lead, ...mem.kept.map((t): ClaudeTurn => ({ role: t.role, content: t.text }))];
  const r = await callClaudeJson<Answer>({ system, turns: [...history, { role: "user", content: parts }], schema: ANSWER_SCHEMA, maxTokens: PHOTO.maxTokens, effort: "medium", leader: isLeader(email) });
  const a = r.data;
  const usd = claudeCost(r.usage) + mem.usd;

  // the commands, tried here on the project
  const parsed = readOps(a.ops);
  const res = applyOps(before, parsed.ops, { files: info, fonts: fontIds() });
  let reply = withNote(a.reply.trim() || "…", mem.fresh);
  let stopped: string | null = null;
  if (parsed.error) {
    stopped = parsed.error;
    reply += `\n\n⚠️ ${parsed.error}`;
  }
  if (res.error) {
    stopped = `الأمر ${res.error.index + 1} (${res.error.op}): ${res.error.message}`;
    reply += `\n\n⚠️ توقفت عند ${stopped}${res.applied ? ` — نفّذت قبله ${res.applied}.` : ""}`;
  }

  // the request for جواد, checked
  let jawad: JawadAsk | null = null;
  const j = a.jawad;
  if (j?.on) {
    const kind = j.kind === "cutout" || j.kind === "edit" ? j.kind : "generate";
    const target = j.target === "base" || j.target === "file" ? j.target : "layer";
    const prompt = String(j.prompt ?? "").trim().slice(0, 4000);
    const source = String(j.source || "base");
    const sourceOk = source === "base" ? !!res.doc.base : res.doc.layers.some((l) => l.id === source && l.kind === "image");
    if (kind !== "cutout" && !prompt) reply += "\n\n⚠️ لم أرسل لجواد: ما فيه وصف للصورة.";
    else if ((kind === "cutout" || kind === "edit") && !sourceOk) reply += "\n\n⚠️ لم أرسل لجواد: ما فيه صورة أقصّ منها أو أعدّلها.";
    else jawad = { kind, prompt, aspect: String(j.aspect || "auto"), target, source };
  }

  const returnTo = a.return_to === "designer" && project.source?.kind === "designer";
  const suggestions = (Array.isArray(a.suggestions) ? a.suggestions : []).map((s) => String(s).trim().slice(0, 100)).filter(Boolean).slice(0, 4);
  const messages: PhotoTurn[] = [...project.messages, { role: "user" as const, text: message }, { role: "assistant" as const, text: reply, ...(suggestions.length ? { suggestions } : {}) }].slice(-2000);
  await saveProject(userId, project.id, { doc: res.doc, messages, ...(a.record?.trim() ? { record: a.record.trim() } : {}), addUsd: usd });
  const codeMode = a.claude_code?.mode === "layout" ? ("layout" as const) : ("grade" as const);
  // colour needs a picture to grade; the design works on any canvas
  const code = a.claude_code?.on && String(a.claude_code.prompt ?? "").trim() && (codeMode === "layout" || res.doc.base) ? { prompt: String(a.claude_code.prompt).trim().slice(0, codeMode === "layout" ? 3000 : 2000), mode: codeMode } : null;
  return { reply, doc: res.doc, changes: docChanges(before, res.doc), suggestions, jawad, code, returnTo, usd: Math.round(usd * 10000) / 10000, stopped };
}
