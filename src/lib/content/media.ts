// «صانع المحتوى» — the media step: the pictures and videos «محمد باقر» asked for outside a carousel (a cover, a b-roll
// clip, a scene). He never makes them himself: each one is a request handed to جواد's desk (src/lib/content/jawad.ts),
// who picks the generator, prices it and makes it as an ordinary JAWAD AI job (so it is also in «أعمالي»). A picture is
// made inside the call; a video takes minutes, so it is started and the page asks again until جواد has it ready.
// Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { getChat, saveChat, type MediaItem, type Turn } from "./chats";
import { addProducedFromOutput, attachmentsOf, deleteProduced } from "./files";
import { deskCheck, deskImage, deskVideo, DeskError, type DeskReceipt, type DeskWho } from "./jawad";

/** Pictures made at once in one call (a picture takes up to about a minute; the server's limit is 300 s). */
const IMAGES_PER_CALL = 2;
const MAX_TRIES = 3;

export const lastMediaAt = (chat: { messages: Turn[] }) => chat.messages.map((m) => !!m.media).lastIndexOf(true);

export interface MediaStep {
  chatId: string;
  items: MediaItem[];
  running: boolean;
  usd: number;
}

const deskOf = (r: DeskReceipt): MediaItem["desk"] => ({ generator: r.generator, coins: r.coins, free: r.free, settings: r.settings as Record<string, unknown> });
const key = () => `m-${randomUUID().replace(/-/g, "")}`;

async function refsOf(userId: string, item: MediaItem) {
  if (!item.refs.length) return [];
  const { list } = await attachmentsOf(userId, item.refs);
  // everything the person attached can go to جواد: a picture generator takes pictures only; a video generator also takes
  // video and sound references (جواد's registry checks the counts and lengths and answers if it cannot use them)
  const seen = { image: 0, video: 0, audio: 0 };
  return list
    .filter((a) => item.kind === "video" || a.kind === "image")
    .map((a) => ({ uploadId: a.id, name: `${a.kind}${++seen[a.kind]}` }));
}

function fail(item: MediaItem, e: unknown, owner: boolean) {
  const d = e instanceof DeskError ? e : null;
  item.state = "failed";
  item.error = d ? d.reason : "صار خطأ غير متوقع.";
  item.transient = d?.transient ?? false;
  if (owner) item.detail = (d ? d.detail || d.reason : e instanceof Error ? e.message : String(e)).slice(0, 300);
  else delete item.detail;
}

async function makeImage(c: { userId: string; chatId: string; who: DeskWho; owner: boolean }, item: MediaItem): Promise<number> {
  const usd = 0;
  item.state = "running";
  item.tries = (item.tries ?? 0) + 1;
  try {
    const r = await deskImage(c.who, { key: key(), kind: "image", prompt: item.prompt, aspect: item.aspect, quality: item.quality, resolution: item.resolution, refs: await refsOf(c.userId, item) });
    item.desk = deskOf(r.receipt);
    item.jobId = r.receipt.jobId;
    const file = await addProducedFromOutput({ userId: c.userId, chatId: c.chatId, out: r.out, name: item.name || "image", meta: { media: item.id, prompt: item.prompt, desk: r.receipt } });
    item.fileId = file.id;
    item.state = "done";
    delete item.error;
    delete item.detail;
  } catch (e) {
    console.error("content media image", item.id, e instanceof DeskError ? e.detail : e);
    fail(item, e, c.owner);
  }
  return usd;
}

async function startVideo(c: { who: DeskWho; owner: boolean; userId: string }, item: MediaItem) {
  item.tries = (item.tries ?? 0) + 1;
  try {
    const receipt = await deskVideo(c.who, { key: key(), kind: "video", prompt: item.prompt, aspect: item.aspect, resolution: item.resolution, seconds: item.seconds, withSound: item.withSound, refs: await refsOf(c.userId, item) });
    item.desk = deskOf(receipt);
    item.jobId = receipt.jobId;
    item.state = "running";
    delete item.error;
    delete item.detail;
  } catch (e) {
    console.error("content media video", item.id, e instanceof DeskError ? e.detail : e);
    fail(item, e, c.owner);
  }
}

async function followVideo(c: { userId: string; chatId: string; owner: boolean }, item: MediaItem) {
  if (!item.jobId) return fail(item, new DeskError("ضاع رقم الطلب عند جواد."), c.owner);
  const st = await deskCheck(c.userId, item.jobId);
  if (st.state === "running") return;
  if (st.state === "failed") return fail(item, st.error, c.owner);
  try {
    const file = await addProducedFromOutput({ userId: c.userId, chatId: c.chatId, out: st.out, name: item.name || "video", meta: { media: item.id, prompt: item.prompt, jobId: item.jobId } });
    item.fileId = file.id;
    item.state = "done";
  } catch (e) {
    fail(item, e, c.owner);
  }
}

/**
 * One call of the media step: starts what is waiting (pictures are made now, videos are started), follows the videos
 * جواد is making, and says what is left. `retry` first puts the given items (or all that failed) back to waiting.
 */
export async function stepMedia(userId: string, chatId: string, o: { retry?: string[] | "failed"; owner?: boolean; email?: string | null; origin?: string } = {}): Promise<MediaStep> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const at = lastMediaAt(chat);
  if (at < 0) throw new UserError("ما فيه صور أو فيديوهات تنتظر في هذي المحادثة.", 409);
  const messages = [...chat.messages];
  const items = messages[at].media!.items.map((x) => ({ ...x }));
  if (o.retry) {
    for (const it of items) {
      if (it.state === "failed" && (o.retry === "failed" || o.retry.includes(it.id))) {
        const old = it.fileId;
        it.state = "todo";
        delete it.error;
        delete it.detail;
        delete it.jobId;
        delete it.fileId;
        it.tries = 0;
        if (old) await deleteProduced(userId, old);
      }
    }
  }
  const c = { userId, chatId, owner: !!o.owner, who: { id: userId, email: o.email, owner: await unlimitedFor(o.email), origin: o.origin ?? "" } as DeskWho };
  let usd = 0;

  // the videos جواد is making
  await Promise.all(items.filter((x) => x.state === "running" && x.kind === "video").map((x) => followVideo(c, x)));
  // the ones waiting: videos are started, a few pictures are made now; a refusal for a moment is tried again by itself
  const retryable = (x: MediaItem) => x.state === "failed" && x.transient && (x.tries ?? 0) < MAX_TRIES;
  const waiting = items.filter((x) => x.state === "todo" || retryable(x));
  await Promise.all(waiting.filter((x) => x.kind === "video").map((x) => startVideo(c, x)));
  const pics = waiting.filter((x) => x.kind === "image").slice(0, IMAGES_PER_CALL);
  for (const r of await Promise.all(pics.map((x) => makeImage(c, x)))) usd += r;

  const running = items.some((x) => x.state === "todo" || x.state === "running" || retryable(x));
  messages[at] = { ...messages[at], media: { items } };
  await saveChat(userId, chatId, { messages, addUsd: usd });
  return { chatId, items, running, usd: Math.round(usd * 10000) / 10000 };
}
