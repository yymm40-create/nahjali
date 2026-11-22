import { NextResponse } from "next/server";
import { isLeader } from "@/lib/film/anthropic";
import { cleanQuestion, sheikhLeft, SHEIKH_DAILY, SHEIKH_QUESTION_MAX } from "@/lib/mahdi/sheikh";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { askedTimes, askSheikh, clearChat, myChat, reportAnswer, sheikhView } from "@/lib/mahdi/server/sheikh";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const NO_STORE = { "Cache-Control": "private, no-store" };
const OWNER_LEFT = 999;

/** «الشيخ الذكي»: my conversation and how many questions are left today. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const rows = await myChat(user.id);
  if (!rows) return NextResponse.json({ ready: false, messages: [] }, { headers: NO_STORE });
  const left = isLeader(user.email) ? OWNER_LEFT : sheikhLeft(await askedTimes(user.id));
  return NextResponse.json({ ready: true, messages: rows.map(sheikhView), left }, { headers: NO_STORE });
});

/** `{ question }` → asks (the question and the answer come back); `{ id, report }` → «في خطأ؟» on an answer. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const b = await readJson(req);
  if (typeof b.id === "string" && typeof b.report === "string") {
    const text = b.report.trim();
    if (text.length < 3) throw new UserError("اكتب وش الخطأ اللي لاحظته.", 400);
    return NextResponse.json({ message: sheikhView(await reportAnswer(user.id, b.id, text)) });
  }
  const question = cleanQuestion(b.question);
  if (!question) throw new UserError(`اكتب سؤالك (إلى ${SHEIKH_QUESTION_MAX} حرف).`, 400);
  const owner = isLeader(user.email);
  const left = owner ? OWNER_LEFT : sheikhLeft(await askedTimes(user.id));
  if (left <= 0) throw new UserError(`خلصت أسئلتك لليوم (${SHEIKH_DAILY})، ترجع بكرة إن شاء الله.`, 429);
  const rows = await askSheikh(user.id, question);
  return NextResponse.json({ messages: rows.map(sheikhView), left: owner ? OWNER_LEFT : left - 1 });
});

/** «امسح المحادثة». */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  await clearChat(user.id);
  return NextResponse.json({ ok: true });
});
