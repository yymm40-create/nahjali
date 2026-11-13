import { UserError } from "@/lib/api";
import { managedAgentTurn, managedJson } from "@/lib/managed-agent";
import { attachmentsOf, uploadLinks } from "@/lib/kharq/files";
import { createDirectorChat, directorSessionId, getDirectorChat, readMedia, readQuestions, saveDirectorChat, type DirectorChat, type DirectorTurn } from "./chats";

interface AgentReply {
  text?: unknown;
  questions?: unknown;
  media?: unknown;
}

const contract = `
قناة التطبيق التقنية لجواد المخرج:
- أعد الرد كائن JSON صالحًا فقط: {"text":"...","questions":[{"label":"...","options":["..."],"multi":false}],"media":[...]}
- media اختيارية. كل عنصر توليد مستقل تمامًا: {"id":"shot-1","kind":"video|image","name":"...","prompt":"البرومبت النهائي الكامل","generatorId":"معرّف المولد إن كنت تعرفه وإلا اتركه فارغًا","aspect":"16:9","quality":"high","resolution":"1080p","seconds":8,"withSound":true}.
- عند اقتراح 3 توليدات، ضع إعدادات كل واحد داخل عنصره ولا تستخدم إعدادات مشتركة.
- لا تقل إنك ولّدت شيئًا؛ الاقتراح ينتظر موافقة المستخدم من الواجهة.
- text هو ردك العربي الطبيعي. questions وmedia مصفوفتان فارغتان عند عدم الحاجة.
`;

/**
 * Whether this message carries the contract. A managed-agent session keeps every message it was given, so the contract
 * sent once stays in it for the whole conversation; sent with every message it piled up (~600 characters a message,
 * re-read on every later turn). It goes with the message that starts a session — the conversation's first (no session
 * yet) — and with the person's first message after a handoff, whose session began with the handoff text alone.
 */
export function needsContract(session: string | null, chat: Pick<DirectorChat, "parentChatId" | "messages"> | null) {
  if (!session) return true;
  return Boolean(chat?.parentChatId) && chat!.messages.filter((turn) => turn.role === "user").length <= 1;
}

const contentFor = async (userId: string, message: string, files: Awaited<ReturnType<typeof attachmentsOf>>, withContract: boolean) => {
  const links = await uploadLinks(userId, files.map((file) => file.id));
  const content: ({ type: "text"; text: string } | { type: "image"; source: { type: "url"; url: string } } | { type: "document"; source: { type: "url"; url: string }; title?: string })[] = [
    { type: "text", text: `${message || "حلّل الملفات المرفقة."}${withContract ? `\n\n${contract}` : ""}` },
  ];
  for (const file of files) {
    const url = links.get(file.id);
    if (!url) continue;
    if (file.kind === "image") content.push({ type: "image", source: { type: "url", url } });
    else if (file.kind === "doc") content.push({ type: "document", source: { type: "url", url }, title: file.name });
    else content.push({ type: "text", text: `ملف ${file.kind === "video" ? "فيديو" : "صوت"} مرفق: ${file.name}\nرابط مؤقت للفحص عند توفر الأداة: ${url}` });
  }
  return content;
};

export async function directorSay(input: { userId: string; chatId: string | null; message: string; attachments?: unknown }) {
  const started = Date.now();
  const files = await attachmentsOf(input.userId, input.attachments);
  let chat = input.chatId ? await getDirectorChat(input.userId, input.chatId) : null;
  if (input.chatId && !chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const userTurn: DirectorTurn = { role: "user", text: input.message, ...(files.length ? { files } : {}) };
  const session = await directorSessionId(input.userId, chat?.id ?? null);
  const withContract = needsContract(session, chat);
  const chatId = chat?.id ?? await createDirectorChat(input.userId, [userTurn]);
  const turn = { userId: input.userId, contextType: "director" as const, contextKey: chatId, title: chat?.title ?? (input.message.slice(0, 160) || "مشروع إخراج جديد") };
  let result = await managedAgentTurn({ ...turn, content: await contentFor(input.userId, input.message, files, withContract), timeoutMs: 280_000 });
  let usd = result.usd;
  const read = (reply: string): AgentReply | null => {
    try {
      return managedJson<AgentReply>(reply);
    } catch {
      return null;
    }
  };
  let parsed = read(result.text);
  // sent without the contract and not answered in its shape: the session no longer has it (it ended and this message
  // started a new one, or its context was compacted) — it is given again and the same reply asked for in its shape, once,
  // while the request still has time (otherwise the reply is read as plain text, as before)
  const left = 290_000 - (Date.now() - started);
  if (!parsed && !withContract && left > 30_000) {
    const again = await managedAgentTurn({ ...turn, content: [{ type: "text", text: `${contract}\nأعد ردك الأخير على رسالتي السابقة بهذا الشكل فقط، دون تغيير مضمونه.` }], timeoutMs: left - 5_000 }).catch(() => null);
    if (again) {
      usd += again.usd;
      parsed = read(again.text);
      if (parsed) result = again;
    }
  }
  parsed ??= { text: result.text, questions: [], media: [] };
  const text = typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim().slice(0, 50000) : result.text.slice(0, 50000);
  const assistant: DirectorTurn = { role: "assistant", text, ...(readQuestions(parsed.questions) ? { questions: readQuestions(parsed.questions) } : {}), ...(readMedia(parsed.media) ? { media: readMedia(parsed.media) } : {}) };
  const messages = [...(chat?.messages ?? [userTurn]), ...(chat ? [userTurn] : []), assistant];
  await saveDirectorChat(input.userId, chatId, messages, usd);
  chat = await getDirectorChat(input.userId, chatId);
  return { chatId, message: assistant, context: chat?.context };
}
