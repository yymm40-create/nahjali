import { NextResponse } from "next/server";
import { isLeader } from "@/lib/film/anthropic";
import { cleanQuestion, sheikhLeft, type SheikhMode } from "@/lib/mahdi/sheikh";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { askedTimes, askSheikh, myQuestions, refreshQuestion, reportAnswer, sheikhView } from "@/lib/mahdi/server/sheikh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "private, no-store" };

/** What is left of each allowance (the owner has none to count). */
async function allowance(userId: string, owner: boolean) {
  if (owner) return { quick: 99, deep: 99 };
  const times = await askedTimes(userId);
  return { quick: sheikhLeft("quick", times.quick), deep: sheikhLeft("deep", times.deep) };
}

/** «اسأل الشيخ»: my questions (the running ones are looked at again first) and what I may still ask. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const rows = await myQuestions(user.id);
  if (!rows) return NextResponse.json({ ready: false, questions: [] }, { headers: NO_STORE });
  // at most three running questions are asked about per look (each is a few calls to the platform)
  let asked = 0;
  const fresh = [];
  for (const r of rows) {
    if (r.status === "running" && asked < 3) {
      asked++;
      fresh.push(await refreshQuestion(r).catch(() => r));
    } else fresh.push(r);
  }
  return NextResponse.json({ ready: true, questions: fresh.map(sheikhView), left: await allowance(user.id, isLeader(user.email)) }, { headers: NO_STORE });
});

/** `{ question, mode }` → asks; `{ id, report }` → «في خطأ؟» on an answer. */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const b = await readJson(req);
  if (typeof b.id === "string" && typeof b.report === "string") {
    const text = b.report.trim();
    if (text.length < 3) throw new UserError("اكتب وش الخطأ اللي لاحظته.", 400);
    return NextResponse.json({ question: sheikhView(await reportAnswer(user.id, b.id, text)) });
  }
  const mode: SheikhMode = b.mode === "deep" ? "deep" : "quick";
  const question = cleanQuestion(b.question);
  if (!question) throw new UserError("اكتب سؤالك (من ٣ إلى ٨٠٠ حرف).", 400);
  const owner = isLeader(user.email);
  const left = await allowance(user.id, owner);
  if (left[mode] <= 0) throw new UserError(mode === "quick" ? "خلصت أسئلتك السريعة لليوم، ترجع بكرة إن شاء الله." : "خلص البحث الشامل لهذا الأسبوع، يرجع الأسبوع الجاي إن شاء الله.", 429);
  // one question at a time: the agent works on one, the next waits
  const rows = (await myQuestions(user.id, 5)) ?? [];
  if (rows.some((r) => r.status === "running" && Date.now() - Date.parse(r.created_at) < 40 * 60_000)) throw new UserError("الشيخ يبحث في سؤالك السابق، انتظر لين يخلص.", 409);
  const row = await askSheikh(user.id, mode, question);
  return NextResponse.json({ question: sheikhView(row), left: { ...left, [mode]: owner ? 99 : left[mode] - 1 } });
});
