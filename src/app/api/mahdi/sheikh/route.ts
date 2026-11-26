import { NextResponse } from "next/server";
import { isLeader } from "@/lib/film/anthropic";
import { cleanQuestion, renewText, sheikhLeft, sheikhRenewAt, SHEIKH_DAILY, SHEIKH_QUESTION_MAX, type SheikhEvent, type SheikhMode } from "@/lib/mahdi/sheikh";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { askedTimes, askSheikh, clearChat, myChat, reportAnswer, SheikhStopped, sheikhView } from "@/lib/mahdi/server/sheikh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "private, no-store" };
const OWNER = { quick: 999, deep: 999 };
const NO_RENEW = { quick: null, deep: null };

/** What is left of the day's questions of each kind, and when the next one of each comes back (within 24 hours). */
async function allowance(userId: string, owner: boolean) {
  if (owner) return { left: OWNER, renew: NO_RENEW, times: { quick: [] as string[], deep: [] as string[] } };
  const times = await askedTimes(userId);
  return {
    left: { quick: sheikhLeft("quick", times.quick), deep: sheikhLeft("deep", times.deep) },
    renew: { quick: sheikhRenewAt(times.quick), deep: sheikhRenewAt(times.deep) },
    times,
  };
}

/** «الشيخ الذكي»: my conversation, how many questions of each kind are left today and when the next comes back. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const rows = await myChat(user.id);
  if (!rows) return NextResponse.json({ ready: false, messages: [] }, { headers: NO_STORE });
  const owner = isLeader(user.email);
  // the owner sees what each answer cost (USD at list prices), to measure the sheikh
  const messages = rows.map((r) => (owner ? { ...sheikhView(r), usd: Number(r.usd) || 0 } : sheikhView(r)));
  const { left, renew } = await allowance(user.id, owner);
  return NextResponse.json({ ready: true, messages, left, renew }, { headers: NO_STORE });
});

/**
 * `{ question, mode }` → asks (the question and the answer come back); with `stream: true` the answer is sent while it
 * is written, one JSON event per line (SheikhEvent), and closing the request («وقّف») stops the sheikh: nothing is
 * saved and the question doesn't count. `{ id, report }` → «في خطأ؟» on an answer.
 */
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
  const { left, renew } = await allowance(user.id, owner);
  if (left[mode] <= 0) {
    const back = renewText(renew[mode]) ?? "يتجدد لك سؤال خلال 24 ساعة";
    throw new UserError(mode === "quick" ? `خلصت أسئلتك لليوم (${SHEIKH_DAILY.quick})، ${back}.` : `خلص البحث الشامل لليوم (${SHEIKH_DAILY.deep})، جرّب «سؤال سريع». ${back}.`, 429);
  }
  const after = (): Record<SheikhMode, number> => (owner ? OWNER : { ...left, [mode]: left[mode] - 1 });
  // the next one to come back, counting this question too (asked now: it comes back in 24 hours)
  const renewAfter = () => (owner ? NO_RENEW : { ...renew, [mode]: renew[mode] ?? Date.now() + 24 * 3600_000 });

  if (b.stream !== true) {
    const rows = await askSheikh(user.id, mode, question);
    return NextResponse.json({ messages: rows.map(sheikhView), left: after(), renew: renewAfter() });
  }

  const stop = new AbortController();
  req.signal?.addEventListener("abort", () => stop.abort(), { once: true });
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      let open = true;
      const send = (e: SheikhEvent) => {
        if (!open) return;
        try {
          ctrl.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        const rows = await askSheikh(user.id, mode, question, { onEvent: send, signal: stop.signal });
        send({ t: "done", messages: rows.map(sheikhView), left: after(), renew: renewAfter() });
      } catch (e) {
        if (!(e instanceof SheikhStopped)) send({ t: "error", message: e instanceof UserError ? e.message : "ما قدر الشيخ يجاوب الحين، جرّب بعد شوي." });
      }
      open = false;
      try {
        ctrl.close();
      } catch {
        /* already closed by the page */
      }
    },
    cancel() {
      stop.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
});

/** «امسح المحادثة». */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  await clearChat(user.id);
  return NextResponse.json({ ok: true });
});
