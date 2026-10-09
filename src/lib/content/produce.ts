// «صانع المحتوى» — the produce step: draws the slides of a carousel «محمد باقر» ordered, with GPT Image 2.
//
// It works a few slides at a time (the page calls it again until nothing is left), so each call finishes well inside
// the server's time limit and the page can show the slides as they arrive:
//   - the first slide is drawn alone, then it is the visual reference of all the others (three at a time);
//   - a slide that the provider refuses for a moment (busy, a cut connection) is tried again after a pause;
//   - every picture is checked right after it is drawn (src/lib/content/verify.ts): Arabic spelling, joined letters,
//     direction, cropping, extra words, and the dress rule if a woman is drawn. A picture with a problem is drawn
//     again once with the problem written into the prompt; if it is still wrong it is kept and flagged (a woman in a
//     wrong dress is never kept);
//   - what could not be made is kept with its prompt, so the person can ask for it again (one slide, or all of them);
//   - at the end a report says what the check found, and «محمد باقر» reads it in his next answer.
// Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { ProviderError, providerUserId } from "@/lib/jawad/server/providers/common";
import { GPT_IMAGE_2_SIZES } from "@config/jawad/generators";
import { WOMAN_WORDING } from "@config/content";
import { ARABIC_TEXT_RULES } from "@config/content-templates";
import { findStyle } from "@config/film-styles";
import { getChat, saveChat, type Chat, type PendingProduce, type Slide, type SlideFailure, type SlidesBlock } from "./chats";
import { addProduced, deleteProduced, producedBytes, producedRow } from "./files";
import { checkSlide, fixNote, type SlideCheck } from "./verify";

/** GPT Image 2 for the slides: the standard sizes (a 1:1 slide is 1024×1024), high quality for readable Arabic. */
export const IMAGE_MODEL = "gpt-image-2-2026-04-21";
export const IMAGE_TIER = "std" as const;
export const IMAGE_QUALITY = "high" as const;
/** Slides drawn at once in one call (after the first). */
const CHUNK = 3;
/** The server's limit is 300 s: a call never works past HARD (a try and its check included), and starts no new try after SOFT. */
const HARD_MS = 250_000;
const SOFT_MS = 130_000;
const MAX_ATTEMPTS = 3;
const MIN_TRY_MS = 50_000;

/** What the report says of a slide whose check could not run. */
export const UNCHECKED = "تعذّر الفحص الآلي";

export interface Produced {
  chatId: string;
  aspect: string;
  slides: Slide[];
  todo: number[];
  failed: SlideFailure[];
  running: boolean;
  total: number;
  report: string | null;
  usd: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The pause before a slide is tried again after a moment's refusal (the tests make it short). */
export const tuning = { pauseMs: 6000 };

/** A refusal for a moment (busy, a cut connection, a server hiccup) — worth trying again; a policy refusal is not. */
export function isTransient(e: unknown): boolean {
  if (e instanceof ProviderError) return e.outcome === "unknown" || /^(429|408|5\d\d)\b|rate.?limit|overload|timeout|temporar/i.test(e.detail);
  return /timeout|ECONN|socket|fetch failed/i.test(e instanceof Error ? e.message : String(e));
}

const reasonOf = (e: unknown) => (e instanceof ProviderError ? e.userMessage : "صار خطأ غير متوقع أثناء الرسم.");
const detailOf = (e: unknown) => (e instanceof ProviderError ? e.detail : e instanceof Error ? e.message : String(e)).slice(0, 300);

/** The full prompt of one slide: where it stands, the design (Baqir's), the style (verbatim), the slide, the rules. */
export function slidePrompt(o: { n: number; total: number; prompt: string; styleId: string; withRef: boolean; fix?: string }): string {
  const style = o.styleId ? findStyle(o.styleId) : null;
  return [
    o.withRef
      ? o.n === 1
        ? `Slide 1 of ${o.total} of a carousel, drawn again. The reference picture is the earlier version of this slide: keep its design system exactly (colours, typography, margins, grid, logo placement, decorative elements) and fix the listed problems.`
        : `Slide ${o.n} of ${o.total} of one carousel. The reference picture is slide 1: match its design system EXACTLY — the same colours, typography, margins, layout grid, logo placement and decorative elements — so the carousel reads as one set. Only the content changes.`
      : `Slide ${o.n} of ${o.total} of a carousel (the first: it sets the design system every other slide will copy).`,
    style ? `ILLUSTRATION STYLE (verbatim; applies to every drawn character, object and scene — not to the lettering layout): ${style.text}` : "",
    o.prompt,
    ARABIC_TEXT_RULES,
    `If any woman appears: ${WOMAN_WORDING} Otherwise draw no woman at all.`,
    o.fix ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** What the person is told after the check (also what «محمد باقر» reads in his next answer). */
export function buildReport(o: { made: Slide[]; failed: SlideFailure[]; unchecked: number }): string {
  const sound = o.made.filter((s) => !s.flag);
  const fixed = o.made.filter((s) => s.fixed);
  const flagged = o.made.filter((s) => s.flag && s.flag !== UNCHECKED);
  const lines = [`🔎 فحص ما بعد الرسم (آلي بالذكاء الاصطناعي: يقرأ كل شريحة ويطابق نصها بالنص المعتمد؛ لا يغني عن مراجعتك بعينك قبل النشر):`];
  if (o.made.length) lines.push(`✅ سليمة: ${sound.length} من ${o.made.length} شريحة (الإملاء، اتصال الحروف، الاتجاه من اليمين لليسار، القص، الكلمات الزائدة).`);
  if (fixed.length) lines.push(`🔁 أُعيد رسم ${fixed.length} ${fixed.length === 1 ? "شريحة" : "شرائح"} تلقائيًا بعد أن وُجد فيها خطأ، وصارت سليمة (${fixed.map((s) => s.n).join("، ")}).`);
  if (flagged.length) lines.push(`⚠️ فيها ملاحظة بعد المحاولات: ${flagged.map((s) => `الشريحة ${s.n} (${s.flag})`).join("، ")}. اطلب إعادة رسمها بالرقم.`);
  if (o.unchecked) lines.push(`ℹ️ تعذّر الفحص الآلي لـ ${o.unchecked} ${o.unchecked === 1 ? "شريحة" : "شرائح"}، فراجعها بعينك.`);
  if (o.failed.length) lines.push(`❌ لم تُصنع: ${o.failed.map((f) => `الشريحة ${f.n} (${f.reason})`).join("، ")}. زر «أعد المحاولة» يرسمها من جديد.`);
  return lines.join("\n");
}

interface SlideResult {
  made?: Slide;
  failed?: SlideFailure;
  usd: number;
}

/** Draws one slide until it is made, flagged, or given up. */
async function makeSlide(c: { userId: string; chatId: string; owner: boolean; t0: number; total: number }, p: PendingProduce, s: PendingProduce["slides"][number], ref: Buffer | null): Promise<SlideResult> {
  const size = GPT_IMAGE_2_SIZES[IMAGE_TIER][p.aspect];
  const user = providerUserId(c.userId);
  const left = () => HARD_MS - (Date.now() - c.t0);
  let usd = 0;
  let fix = "";
  let lastErr: unknown = null;
  let bad: { png: Buffer; check: SlideCheck } | null = null;
  let redrawn = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1 && (Date.now() - c.t0 > SOFT_MS || left() < MIN_TRY_MS + 20_000)) break;
    let png: Buffer;
    try {
      const r = await openaiImage({
        model: IMAGE_MODEL,
        prompt: slidePrompt({ n: s.n, total: c.total, prompt: s.prompt, styleId: p.styleId, withRef: !!ref, fix }),
        aspect: p.aspect,
        resolution: IMAGE_TIER,
        quality: IMAGE_QUALITY,
        count: 1,
        references: ref ? [{ bytes: ref, mime: "image/png" }] : [],
        user,
        timeoutMs: Math.max(MIN_TRY_MS, Math.min(150_000, left() - 25_000)),
      });
      usd += r.costUsd ?? 0;
      png = r.images[0];
    } catch (e) {
      lastErr = e;
      console.error("content slide", s.n, "attempt", attempt, e instanceof ProviderError ? e.detail : e);
      if (isTransient(e) && attempt < MAX_ATTEMPTS && left() > MIN_TRY_MS + 30_000) {
        await sleep(Math.min(tuning.pauseMs * attempt, 12_000));
        continue;
      }
      break;
    }

    const check = await checkSlide(png, s.text);
    usd += check.usd;
    if (check.ok) {
      const file = await store(c, p, s, png, size, check.checked ? undefined : UNCHECKED);
      return { made: { n: s.n, fileId: file.id, name: file.name, text: s.text, ...(redrawn ? { fixed: true } : {}), ...(check.checked ? {} : { flag: UNCHECKED }) }, usd };
    }
    bad = { png, check };
    fix = fixNote(check, s.text);
    redrawn = true;
  }

  if (bad) {
    // still wrong after the tries: a woman in a wrong dress is never kept; a text problem is kept and said plainly
    if (bad.check.woman === "violation") {
      return { failed: { n: s.n, reason: "الصورة خالفت قاعدة اللباس بعد المحاولات فاستُبعدت", text: s.text, prompt: s.prompt }, usd };
    }
    const flag = bad.check.problems.join("، ").slice(0, 300) || "خطأ في الكتابة";
    const file = await store(c, p, s, bad.png, size, flag);
    return { made: { n: s.n, fileId: file.id, name: file.name, text: s.text, flag }, usd };
  }
  return { failed: { n: s.n, reason: reasonOf(lastErr), ...(c.owner ? { detail: detailOf(lastErr) } : {}), text: s.text, prompt: s.prompt }, usd };
}

async function store(c: { userId: string; chatId: string }, p: PendingProduce, s: PendingProduce["slides"][number], png: Buffer, size: [number, number], flag?: string) {
  return addProduced({
    userId: c.userId,
    chatId: c.chatId,
    bytes: png,
    name: `slide-${String(s.n).padStart(2, "0")}`,
    width: size[0],
    height: size[1],
    meta: { slide: s.n, aspect: p.aspect, text: s.text, prompt: s.prompt, styleId: p.styleId, templateId: p.templateId, batch: p.id, ...(flag ? { flag } : {}) },
  });
}

/** The index of the last answer that carries a carousel (where a fix or a retry goes). */
export const lastSlidesAt = (chat: Pick<Chat, "messages">) => chat.messages.map((m) => !!m.slides).lastIndexOf(true);

/** Starts drawing again the slides asked for (the failed ones, or any made one), in the carousel that exists. */
async function planRetry(userId: string, chat: Chat, ns: number[] | "failed"): Promise<Chat> {
  const at = lastSlidesAt(chat);
  const block = chat.messages[at]?.slides;
  if (at < 0 || !block) throw new UserError("ما فيه كاروسيل في هذي المحادثة نعيد رسم شرائحه.", 409);
  const wanted = ns === "failed" ? block.failed.map((f) => f.n) : ns;
  const slides: PendingProduce["slides"] = [];
  for (const n of [...new Set(wanted)].sort((a, b) => a - b)) {
    const f = block.failed.find((x) => x.n === n);
    if (f) {
      slides.push({ n, text: f.text, prompt: f.prompt });
      continue;
    }
    const item = block.items.find((x) => x.n === n);
    const row = item ? await producedRow(userId, item.fileId) : null;
    const prompt = typeof row?.meta.prompt === "string" ? row.meta.prompt : "";
    if (item && prompt) slides.push({ n, text: item.text, prompt });
  }
  if (!slides.length) throw new UserError("ما لقينا شرائح نعيد رسمها.", 409);
  const pending: PendingProduce = {
    id: randomUUID(),
    aspect: block.aspect,
    slides,
    at,
    styleId: block.styleId,
    templateId: block.templateId,
    mode: "fix",
    made: [],
    failed: [],
    carry: block.failed.filter((f) => !slides.some((s) => s.n === f.n)),
  };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], slides: { ...block, todo: slides.map((s) => s.n), failed: pending.carry, running: true, report: undefined } };
  await saveChat(userId, chat.id, { messages, pending });
  return { ...chat, messages, pending };
}

/**
 * One call of the produce step: draws the next few slides, saves what exists, and says what is left. `retry` first
 * plans the drawing again of the given slides (or «failed»: all that failed) of the last carousel.
 */
export async function produce(userId: string, chatId: string, o: { retry?: number[] | "failed"; owner?: boolean } = {}): Promise<Produced> {
  let chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  if (o.retry && (o.retry === "failed" || o.retry.length)) chat = await planRetry(userId, chat, o.retry);
  const p = chat.pending;
  if (!p) throw new UserError("ما فيه كاروسيل ينتظر الإنتاج في هذي المحادثة.", 409);
  if (!process.env.OPENAI_API_KEY) throw new UserError("صناعة الصور غير مفعّلة على الخادم.", 503);

  const t0 = Date.now();
  const messages = [...chat.messages];
  const at = Math.min(p.at, messages.length - 1);
  const base = new Map((messages[at]?.slides?.items ?? []).map((s) => [s.n, s]));
  const c = { userId, chatId, owner: !!o.owner, t0, total: p.mode === "all" ? p.slides.length : Math.max(base.size, ...p.slides.map((s) => s.n)) };
  const done = new Set([...p.made.map((s) => s.n), ...p.failed.map((f) => f.n)]);
  const todo = p.slides.filter((s) => !done.has(s.n)).sort((a, b) => a.n - b.n);

  // the reference of every slide: slide 1 (made now, or the one that stands)
  const ref1 = p.made.find((s) => s.n === 1) ?? base.get(1);
  const ref = ref1 ? await producedBytes(userId, ref1.fileId) : null;
  const first = todo.find((s) => s.n === 1);
  const batch = !ref && first ? [first] : todo.slice(0, CHUNK);

  let usd = 0;
  const results = await Promise.all(batch.map((s) => makeSlide(c, p, s, ref)));
  for (const r of results) {
    usd += r.usd;
    if (r.made) {
      p.made.push(r.made);
      // the slide it replaced goes away (the new one is already stored)
      const old = base.get(r.made.n);
      if (old && p.mode === "fix") await deleteProduced(userId, old.fileId);
    }
    if (r.failed) p.failed.push(r.failed);
  }

  const items = new Map(base);
  for (const s of p.made) items.set(s.n, s);
  const doneNow = new Set([...p.made.map((s) => s.n), ...p.failed.map((f) => f.n)]);
  const left = p.slides.filter((s) => !doneNow.has(s.n)).map((s) => s.n);
  const sorted = [...items.values()].sort((a, b) => a.n - b.n);
  const old = messages[at]?.slides;
  const block: SlidesBlock = {
    aspect: p.aspect,
    items: sorted,
    todo: left,
    failed: [...p.carry, ...p.failed],
    running: left.length > 0,
    total: p.mode === "all" ? p.slides.length : sorted.length,
    styleId: p.styleId,
    templateId: p.templateId,
    ...(old?.report && left.length ? { report: old.report } : {}),
  };
  let report: string | null = null;
  if (!left.length) {
    report = buildReport({ made: p.made, failed: p.failed, unchecked: p.made.filter((s) => s.flag === UNCHECKED).length });
    block.report = report;
  }
  if (messages[at]) messages[at] = { ...messages[at], slides: block };
  await saveChat(userId, chatId, { messages, pending: left.length ? p : null, addUsd: usd });

  return { chatId, aspect: p.aspect, slides: sorted, todo: left, failed: block.failed, running: left.length > 0, total: block.total, report, usd: Math.round(usd * 10000) / 10000 };
}
