import { UserError } from "@/lib/api";
import { managedAgentTurn } from "@/lib/managed-agent";
import { createDirectorChat, getDirectorChat, saveDirectorChat, saveHandoff, type DirectorTurn } from "./chats";

export async function prepareDirectorHandoff(userId: string, chatId: string) {
  const chat = await getDirectorChat(userId, chatId);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const result = await managedAgentTurn({
    userId,
    contextType: "director",
    contextKey: chat.id,
    title: chat.title,
    content: [{ type: "text", text: "جهّز الآن تسليمًا ذاتيًا كاملًا قبل ضغط السياق. اكتب ملخصًا عمليًا ودقيقًا يحفظ: هدف المشروع، القرارات المعتمدة، المراجع، الشخصيات والاستمرارية، اللقطات والتوليدات وإعداد كل واحد، ما تم، ما بقي، وما يجب ألا يتغير. لا تنفذ توليدًا. أعد نص التسليم فقط ليُرسل إلى نسخة جديدة منك." }],
    timeoutMs: 280_000,
  });
  const handoff = result.text.trim().slice(0, 50000);
  await saveHandoff(userId, chat.id, handoff);
  return { handoff, context: chat.context };
}

export async function continueDirectorHandoff(userId: string, chatId: string) {
  const parent = await getDirectorChat(userId, chatId);
  if (!parent) throw new UserError("ما لقينا هذي المحادثة.", 404);
  if (!parent.handoff.trim()) throw new UserError("جهّز التسليم أولًا.", 409);
  const bridge: DirectorTurn = { role: "user", text: `تسليم من محادثتك السابقة لنفس المشروع:\n\n${parent.handoff}` };
  const childId = await createDirectorChat(userId, [bridge], parent.id);
  const result = await managedAgentTurn({
    userId,
    contextType: "director",
    contextKey: childId,
    title: `${parent.title} — متابعة`,
    content: [{ type: "text", text: `${bridge.text}\n\nاستلم هذا التسليم باعتباره الحالة المعتمدة للمشروع. أكّد باختصار أنك استلمته، اذكر الخطوة التالية فقط، ولا تغيّر أي قرار ولا تولّد شيئًا دون موافقة.` }],
    timeoutMs: 280_000,
  });
  const assistant: DirectorTurn = { role: "assistant", text: result.text.trim().slice(0, 50000) };
  await saveDirectorChat(userId, childId, [bridge, assistant], result.usd);
  const child = await getDirectorChat(userId, childId);
  return { chat: child };
}

/** The conversation reached its limit: it writes its own handoff and a new conversation takes it over, in one step. */
export async function autoDirectorHandoff(userId: string, chatId: string) {
  await prepareDirectorHandoff(userId, chatId);
  return continueDirectorHandoff(userId, chatId);
}
