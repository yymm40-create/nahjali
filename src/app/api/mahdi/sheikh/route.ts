import { NextResponse } from "next/server";
import { isLeader } from "@/lib/film/anthropic";
import { cleanQuestion, sheikhLeft, SHEIKH_DAILY, SHEIKH_QUESTION_MAX, type SheikhMode } from "@/lib/mahdi/sheikh";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { askedTimes, askSheikh, clearChat, myChat, reportAnswer, sheikhView } from "@/lib/mahdi/server/sheikh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "private, no-store" };
const OWNER = { quick: 999, deep: 999 };

async function allowance(userId: string, owner: boolean) {
  if (owner) return OWNER;
  const times = await askedTimes(userId);
  return { quick: sheikhLeft("quick", times.quick), deep: sheikhLeft("deep", times.deep) };
}

/** «الشيخ الذكي»: my conversation and how many questions of each kind are left today. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const rows = await myChat(user.id);
  if (!rows) return NextResponse.json({ ready: false, messages: [] }, { headers: NO_STORE });
  return NextResponse.json({ ready: true, messages: rows.map(sheikhView), left: await allowance(user.id, isLeader(user.email)) }, { headers: NO_STORE });
});

/** `{ question, mode }` → asks (the question and the answer come back); `{ id, report }` → «في خطأ؟» on an answer. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const b = await readJson(req);
  if (typeof b.id === "string" && typeof b.report === "string") {
    const text = b.report.trim();
    if (text.length < 3) throw new UserError("اكتب وش الخطأ اللي لاحظته.", 400);
    return NextResponse.json({ message: sheikhView(await reportAnswer(user.id, b.id, text)) });
  }
  const mode: SheikhMode = b.mode === "deep" ? "deep" : "quick";
  const question = cleanQuestion(b.question);
  if (!question) throw new UserError(`اكتب سؤالك (إلى ${SHEIKH_QUESTION_MAX} حرف).`, 400);
  const owner = isLeader(user.email);
  const left = await allowance(user.id, owner);
  if (left[mode] <= 0) throw new UserError(mode === "quick" ? `خلصت أسئلتك لليوم (${SHEIKH_DAILY.quick})، ترجع بكرة إن شاء الله.` : `خلص البحث الشامل لليوم (${SHEIKH_DAILY.deep})، جرّب «سؤال سريع» أو ارجع بكرة.`, 429);
  const rows = await askSheikh(user.id, mode, question);
  return NextResponse.json({ messages: rows.map(sheikhView), left: owner ? OWNER : { ...left, [mode]: left[mode] - 1 } });
});

/** «امسح المحادثة». */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  await clearChat(user.id);
  return NextResponse.json({ ok: true });
});
