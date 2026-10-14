import { UserError } from "@/lib/api";
import { managedAgentTurn, managedJson } from "@/lib/managed-agent";
import { attachmentsOf, uploadLinks } from "@/lib/kharq/files";
import { createDirectorChat, getDirectorChat, readMedia, readQuestions, saveDirectorChat, type DirectorTurn } from "./chats";

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

const contentFor = async (userId: string, message: string, files: Awaited<ReturnType<typeof attachmentsOf>>) => {
  const links = await uploadLinks(userId, files.map((file) => file.id));
  const content: ({ type: "text"; text: string } | { type: "image"; source: { type: "url"; url: string } } | { type: "document"; source: { type: "url"; url: string }; title?: string })[] = [
    { type: "text", text: `${message || "حلّل الملفات المرفقة."}\n\n${contract}` },
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
  const files = await attachmentsOf(input.userId, input.attachments);
  let chat = input.chatId ? await getDirectorChat(input.userId, input.chatId) : null;
  if (input.chatId && !chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const userTurn: DirectorTurn = { role: "user", text: input.message, ...(files.length ? { files } : {}) };
  const chatId = chat?.id ?? await createDirectorChat(input.userId, [userTurn]);
  const result = await managedAgentTurn({
    userId: input.userId,
    contextType: "director",
    contextKey: chatId,
    title: chat?.title ?? (input.message.slice(0, 160) || "مشروع إخراج جديد"),
    content: await contentFor(input.userId, input.message, files),
    timeoutMs: 280_000,
  });
  let parsed: AgentReply;
  try {
    parsed = managedJson<AgentReply>(result.text);
  } catch {
    parsed = { text: result.text, questions: [], media: [] };
  }
  const text = typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim().slice(0, 50000) : result.text.slice(0, 50000);
  const assistant: DirectorTurn = { role: "assistant", text, ...(readQuestions(parsed.questions) ? { questions: readQuestions(parsed.questions) } : {}), ...(readMedia(parsed.media) ? { media: readMedia(parsed.media) } : {}) };
  const messages = [...(chat?.messages ?? [userTurn]), ...(chat ? [userTurn] : []), assistant];
  await saveDirectorChat(input.userId, chatId, messages, result.usd);
  chat = await getDirectorChat(input.userId, chatId);
  return { chatId, message: assistant, context: chat?.context };
}
