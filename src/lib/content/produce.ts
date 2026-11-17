// «صانع المحتوى» — the produce step: the slides of a carousel «محمد باقر» ordered, made the way the person picked:
// «حيدرا ماكس» in code in the person's browser, slide by slide (the exact Arabic writing, the shapes, the layout; a slide
// that needs a painted picture gets it FIRST from جواد with GPT Image 2 — with no writing in it — and he places it);
// or GPT Image 2's picture as the whole slide with «حيدرا ماكس» only writing on it (the part below the «حيدرا ماكس» line
// is those two); or GPT Image 2 drawing each whole slide with its writing, then a check of its Arabic:
//
// It works a few slides at a time (the page calls it again until nothing is left), so each call finishes well inside
// the server's time limit and the page can show the slides as they arrive:
//   - the first slide is drawn alone, then it is the visual reference of all the others (three at a time);
//   - a slide that the provider refuses for a moment (busy, a cut connection) is tried again after a pause;
//   - every picture is checked right after it is drawn (src/lib/content/verify.ts): Arabic spelling, joined letters,
//     direction, cropping, extra words. A picture with a problem is drawn again once with the problem written into
//     the prompt; if it is still wrong it is kept and flagged;
//   - what could not be made is kept with its prompt, so the person can ask for it again (one slide, or all of them);
//   - at the end a report says what the check found, and «محمد باقر» reads it in his next answer.
// Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { deskImage, deskReference, DeskError, type DeskOutput, type DeskReceipt, type DeskWho } from "./jawad";
import { ARABIC_TEXT_RULES } from "@config/content-templates";
import { carouselStyleBlock, carouselStyleForCode, COLOURS_ARE_THE_CLIENTS, findCarouselStyle, NO_REALISTIC_WOMEN, withoutColours } from "@config/content-carousel-styles";
import { findContentFont, FONT_PIN, fontBlock } from "@config/content-fonts";
import { findPalette, paletteBlock } from "@config/content-palettes";
import { NO_TEXT_RULE } from "@config/designer";
import { findStyle } from "@config/film-styles";
import { findMotionCarouselStyle, motionStyleForCode } from "@config/content-motion-carousel";
import { chatSound, sliceNote, splitSound } from "./sound";
import { falFile, falReady, falRun, falUrl } from "@/lib/jawad/server/providers/fal";
import { getChat, saveChat, type Chat, type PendingProduce, type Slide, type SlideFailure, type SlidesBlock } from "./chats";
import { drawnPng } from "@/lib/jawad/server/uploads";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { addProduced, addProducedFromOutput, addProducedVideo, attachmentsOf, deleteProduced, producedBytes, producedLinks, producedRow, slidePicture, uploadLinks } from "./files";
import { checkSlide, fixNote, showsRealWoman, WOMAN_PROBLEM, type SlideCheck } from "./verify";

/** GPT Image 2 for the slides: the standard sizes (a 1:1 slide is 1024×1024), high quality for readable Arabic. */
export const IMAGE_MODEL = "gpt-image-2-2026-04-21";
export const IMAGE_TIER = "std" as const;
/** GPT Image 2 at its medium quality and standard size by default (the owner, 17 Nov 2026: «التلقائي الجودة المتوسطة والعادية») */
export const IMAGE_QUALITY = "medium" as const;
/** Slides asked of جواد at once in one call (after the first): his desk keeps three jobs going at most. */
const CHUNK = 2;
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
  /** «Claude Code»: the next slide for the page to draw in code (then it sends the picture back) */
  code?: CodeSlide;
  /** the pictures stage: being painted, or waiting for the person's approval */
  phase?: "pictures" | "approve";
  /** slides set aside after running past the time (they come back last) */
  deferred?: number[];
  /** a motion carousel (the page shows its own progress words in every stage) */
  motion?: true;
}

/** One slide «حيدرا ماكس» draws in the person's browser: its full brief (the exact writing in it), shape, references,
 * and the photos to place in it as they are (its painted picture first). */
export interface CodeSlide {
  n: number;
  prompt: string;
  aspect: string;
  refs: string[];
  photos: string[];
  /** the look of the carousel's style, for his «الستايل» */
  style?: string;
  /** GPT Image 2's picture is the whole slide: he only writes on it */
  mix?: boolean;
  /** a motion carousel's slide: he writes it as a moving scene of `seconds`, and the page renders it to MP4 */
  motion?: { seconds: number; style: string; first: boolean; total: number; voice?: { url: string; from: number; to: number } };
  /** stage 1 of a motion carousel: draw this slide as a STILL (the final frame of its motion), at the motion size */
  stage?: "still";
  /** set aside once (it ran past the time): this time with lighter thinking */
  light?: true;
  /** this slide's program kept before (it already ran): the page goes on from it without writing again */
  program?: { code: string; fonts: { head: string; body: string }; size: [number, number] };
  /** stage 2: the approved still's program, which he animates (instead of writing the slide from zero) */
  still?: { code: string; fonts: { head: string; body: string } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The pause before a slide is tried again after a moment's refusal (the tests make it short). */
export const tuning = { pauseMs: 6000 };

/** A refusal for a moment (busy, a cut connection, a server hiccup) — worth trying again; a policy refusal is not. */
export function isTransient(e: unknown): boolean {
  if (e instanceof DeskError) return e.transient;
  return /timeout|ECONN|socket|fetch failed/i.test(e instanceof Error ? e.message : String(e));
}

// a slide refused for a short wallet says it was the balance AT THAT MOMENT (the list stays on the page after a
// top-up, beside the new balance in the header), and that «أعد المحاولة» draws it now
export const reasonOf = (e: unknown) =>
  e instanceof DeskError
    ? e.detail === "UserError 402"
      ? `${e.reason.replace(/^خلص رصيدك:\s*/, "وقت الرسم ما كفى الرصيد: ").replace(/\s*اشحن بمقدارها بس أو اختر باقة\.?$/, "")}. إذا شحنت بعدها، اضغط «أعد المحاولة».`
      : e.reason
    : "صار خطأ غير متوقع أثناء الرسم.";
const detailOf = (e: unknown) => (e instanceof DeskError ? e.detail || e.reason : e instanceof Error ? e.message : String(e)).slice(0, 300);

/** The full prompt of one slide: where it stands, the design (Baqir's), the style (verbatim), the slide, the rules. */
export function slidePrompt(o: { n: number; total: number; prompt: string; styleId: string; carouselId?: string; fontId?: string; paletteId?: string; withRef: boolean; userRefs?: number; fix?: string }): string {
  const style = o.styleId ? findStyle(o.styleId) : null;
  const car = o.carouselId ? findCarouselStyle(o.carouselId) : null;
  const font = o.fontId ? findContentFont(o.fontId) : null;
  const pal = o.paletteId ? findPalette(o.paletteId) : null;
  return [
    o.withRef
      ? o.n === 1
        ? `Slide 1 of ${o.total} of a carousel, drawn again. The reference picture is the earlier version of this slide: keep its design system exactly (colours, typography, margins, grid, logo placement, decorative elements) and fix the listed problems.`
        : `Slide ${o.n} of ${o.total} of one carousel. The reference picture is slide 1: match its design system EXACTLY — the same colours, typography, margins, layout grid, logo placement and decorative elements — so the carousel reads as one set. Only the content changes.`
      : `Slide ${o.n} of ${o.total} of a carousel (the first: it sets the design system every other slide will copy).`,
    o.userRefs ? `The client's own attached picture${o.userRefs > 1 ? "s are" : " is"} also given as reference${o.userRefs > 1 ? "s" : ""} (named ref1${o.userRefs > 1 ? "…" : ""}): use ${o.userRefs > 1 ? "them" : "it"} where the slide's brief asks (a logo, a photo, a product), exactly as ${o.userRefs > 1 ? "they are" : "it is"}, without redrawing or altering ${o.userRefs > 1 ? "them" : "it"}.` : "",
    car ? carouselStyleBlock(car, !!pal) : "",
    pal ? paletteBlock(pal) : "",
    font ? fontBlock(font) : "",
    style ? `ILLUSTRATION STYLE (verbatim; applies to every drawn character, object and scene — not to the lettering layout): ${style.text}` : "",
    o.prompt,
    ARABIC_TEXT_RULES,
    NO_REALISTIC_WOMEN,
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
async function makeSlide(c: { userId: string; chatId: string; owner: boolean; t0: number; total: number; who: DeskWho }, p: PendingProduce, s: PendingProduce["slides"][number], ref: string | null, mine: string[]): Promise<SlideResult> {
  const left = () => HARD_MS - (Date.now() - c.t0);
  let usd = 0;
  let fix = "";
  let lastErr: unknown = null;
  let bad: { png: Buffer; out: DeskOutput; receipt: DeskReceipt; check: SlideCheck } | null = null;
  let redrawn = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1 && (Date.now() - c.t0 > SOFT_MS || left() < MIN_TRY_MS + 20_000)) break;
    let png: Buffer;
    let out: DeskOutput;
    let receipt: DeskReceipt;
    try {
      const r = await deskImage(c.who, {
        key: `c-${randomUUID().replace(/-/g, "")}`,
        kind: "image",
        prompt: slidePrompt({ n: s.n, total: c.total, prompt: s.prompt, styleId: p.styleId, carouselId: p.carouselId, fontId: p.fontId, paletteId: p.paletteId, withRef: !!ref, userRefs: mine.length, fix }),
        aspect: p.aspect,
        resolution: IMAGE_TIER,
        quality: IMAGE_QUALITY,
        refs: [...(ref ? [{ uploadId: ref, name: "slide1" }] : []), ...mine.map((uploadId, i) => ({ uploadId, name: `ref${i + 1}` }))],
      });
      png = r.bytes;
      out = r.out;
      receipt = r.receipt;
    } catch (e) {
      lastErr = e;
      console.error("content slide", s.n, "attempt", attempt, e instanceof DeskError ? e.detail : e);
      if (isTransient(e) && attempt < MAX_ATTEMPTS && left() > MIN_TRY_MS + 30_000) {
        await sleep(Math.min(tuning.pauseMs * attempt, 12_000));
        continue;
      }
      break;
    }

    const check = await checkSlide(png, s.text);
    usd += check.usd;
    if (check.ok) {
      const file = await store(c, p, s, out, receipt, check.checked ? undefined : UNCHECKED);
      return { made: { n: s.n, fileId: file.id, name: file.name, text: s.text, ...(redrawn ? { fixed: true } : {}), ...(check.checked ? {} : { flag: UNCHECKED }) }, usd };
    }
    bad = { png, out, receipt, check };
    fix = fixNote(check, s.text);
    redrawn = true;
  }

  // a realistic adult woman is never handed over, however the rest came out
  if (bad?.check.problems.includes(WOMAN_PROBLEM)) return { failed: { n: s.n, reason: `${WOMAN_PROBLEM}. غيّر وصف الشريحة ثم أعد المحاولة.`, text: s.text, prompt: s.prompt }, usd };
  if (bad) {
    // still wrong after the tries: a text problem is kept and said plainly
    const flag = bad.check.problems.join("، ").slice(0, 300) || "خطأ في الكتابة";
    const file = await store(c, p, s, bad.out, bad.receipt, flag);
    return { made: { n: s.n, fileId: file.id, name: file.name, text: s.text, flag }, usd };
  }
  return { failed: { n: s.n, reason: reasonOf(lastErr), ...(c.owner ? { detail: detailOf(lastErr) } : {}), text: s.text, prompt: s.prompt }, usd };
}

async function store(c: { userId: string; chatId: string }, p: PendingProduce, s: PendingProduce["slides"][number], out: DeskOutput, receipt: DeskReceipt, flag?: string) {
  return addProducedFromOutput({
    userId: c.userId,
    chatId: c.chatId,
    out,
    name: `slide-${String(s.n).padStart(2, "0")}`,
    meta: { slide: s.n, aspect: p.aspect, text: s.text, prompt: s.prompt, styleId: p.styleId, templateId: p.templateId, batch: p.id, ...(p.refs?.length ? { refs: p.refs } : {}), desk: receipt, ...(flag ? { flag } : {}) },
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
  const madeArts: Record<string, string> = {};
  for (const n of [...new Set(wanted)].sort((a, b) => a - b)) {
    const f = block.failed.find((x) => x.n === n);
    if (f) {
      slides.push({ n, text: f.text, prompt: f.prompt });
      continue;
    }
    const item = block.items.find((x) => x.n === n);
    const row = item ? await producedRow(userId, item.fileId) : null;
    const prompt = typeof row?.meta.prompt === "string" ? row.meta.prompt : "";
    const picture = typeof row?.meta.picture === "string" ? row.meta.picture : "";
    if (item && prompt) slides.push({ n, text: item.text, prompt, ...(picture ? { picture } : {}) });
    // a made motion slide drawn again keeps the picture it was drawn over (approved already): only its motion is made again
    const batch = typeof row?.meta.batch === "string" ? row.meta.batch : "";
    const art = item && prompt && block.motion && batch ? await slidePicture(userId, chat.id, n, batch) : null;
    if (art) madeArts[String(n)] = art;
  }
  if (!slides.length) throw new UserError("ما لقينا شرائح نعيد رسمها.", 409);
  // the attached pictures the carousel was made with go again with the slides drawn again
  let refs: string[] = [];
  for (const it of block.items) {
    const meta = (await producedRow(userId, it.fileId))?.meta.refs;
    if (Array.isArray(meta) && meta.length) {
      refs = meta.filter((r): r is string => typeof r === "string");
      break;
    }
  }
  // a slide that failed AFTER its picture was painted and approved (its program would not run) keeps that picture: it
  // stands in the slide's place in the carousel («picture-…» / «element-…»). Trying the slide again painted a NEW picture
  // (paid again, and not the one the person approved) and asked for the approval a second time
  const arts: Record<string, string> = { ...madeArts };
  for (const sl of slides) {
    const it = block.items.find((x) => x.n === sl.n);
    if (it && /^(picture|element)-/.test(it.name) && block.failed.some((f) => f.n === sl.n)) arts[String(sl.n)] = it.fileId;
  }
  const keptArts = Object.keys(arts).length > 0;
  const pending: PendingProduce = {
    ...(refs.length ? { refs } : {}),
    ...(keptArts ? { arts } : {}),
    // every slide tried again has its approved picture: no second approval
    ...(keptArts && slides.every((sl) => arts[String(sl.n)]) ? { picturesOk: true } : {}),
    id: randomUUID(),
    aspect: block.aspect,
    slides,
    at,
    styleId: block.styleId,
    templateId: block.templateId,
    mode: "fix",
    ...(block.maker === "code" ? { maker: "code" as const } : {}),
    ...(block.mix ? { mix: true } : {}),
    ...(block.carouselId ? { carouselId: block.carouselId } : {}),
    ...(block.fontId ? { fontId: block.fontId } : {}),
    ...(block.paletteId ? { paletteId: block.paletteId } : {}),
    ...(block.motion ? { motion: block.motion } : {}),
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
export async function produce(userId: string, chatId: string, o: { retry?: number[] | "failed"; owner?: boolean; email?: string | null; origin?: string; approvePictures?: boolean; redoPicture?: { n: number; note: string }; deferSlide?: number; exclude?: number[] } = {}): Promise<Produced> {
  let chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  if (o.retry && (o.retry === "failed" || o.retry.length)) chat = await planRetry(userId, chat, o.retry);
  const p = chat.pending;
  if (!p) throw new UserError("ما فيه كاروسيل ينتظر الإنتاج في هذي المحادثة.", 409);

  const t0 = Date.now();
  const messages = [...chat.messages];
  const at = Math.min(p.at, messages.length - 1);
  const base = new Map((messages[at]?.slides?.items ?? []).map((s) => [s.n, s]));
  const who: DeskWho = { id: userId, email: o.email, owner: await unlimitedFor(o.email), origin: o.origin ?? "" };
  const c = { userId, chatId, owner: !!o.owner, who, t0, total: p.mode === "all" ? p.slides.length : Math.max(base.size, ...p.slides.map((s) => s.n)) };
  const finish = (results: SlideResult[], phase?: "pictures" | "approve") => settle({ userId, chatId, chat: chat!, p, messages, at, base }, results, phase);
  const done = new Set([...p.made.map((s) => s.n), ...p.failed.map((f) => f.n)]);
  const todo = p.slides.filter((s) => !done.has(s.n)).sort((a, b) => a.n - b.n);

  // «Claude Code»: nothing is drawn here — the page gets the next slide's brief, draws it, and sends it back
  if (p.maker === "code") {
    // STAGE 0, the pictures first: GPT Image 2 paints every slide that has a picture, then they wait for the person's approval
    if (o.approvePictures) p.picturesOk = true;
    const withPicture = todo.filter((s) => !!pictureBrief(p, s).brief);
    if (!p.picturesOk && withPicture.length) {
      // a picture the person asked to redraw (with what to change)
      if (o.redoPicture) {
        const s = withPicture.find((x) => x.n === o.redoPicture!.n);
        const old = s ? p.arts?.[String(s.n)] : null;
        if (s && old) {
          const rest = { ...(p.arts ?? {}) };
          delete rest[String(s.n)];
          p.arts = rest;
          await deleteProduced(userId, old).catch(() => undefined);
          const note = o.redoPicture.note.trim().slice(0, 600);
          if (note) s.picture = `${s.picture ?? pictureFrom(s.prompt)}\n\nCHANGE THE PERSON ASKED FOR (follow it): ${note}`;
        }
      }
      const missing = withPicture.filter((s) => !p.arts?.[String(s.n)]).sort((a, b) => a.n - b.n);
      if (missing.length) {
        // slide 1 first (it sets the look), then a few side by side
        const batch = missing[0].n === 1 && !p.arts?.["1"] ? [missing[0]] : missing.slice(0, CHUNK);
        const results: SlideResult[] = await Promise.all(
          batch.map(async (s) => {
            try {
              await paintArt(userId, chatId, messages, p, s, who);
              return { usd: 0 };
            } catch (e) {
              return { failed: { n: s.n, reason: e instanceof UserError ? e.message : "ما قدر جواد يرسم صورة الشريحة الحين.", text: s.text, prompt: s.prompt }, usd: 0 };
            }
          }),
        );
        const stillMissing = withPicture.some((s) => !p.arts?.[String(s.n)] && !results.some((r) => r.failed?.n === s.n));
        return finish(results, stillMissing ? "pictures" : "approve");
      }
      return finish([], "approve");
    }
    // a slide whose work ran past the time is set aside: the others go first, it comes back last with lighter thinking
    if (o.deferSlide && todo.some((s) => s.n === o.deferSlide) && !(p.deferred ?? []).includes(o.deferSlide)) p.deferred = [...(p.deferred ?? []), o.deferSlide];
    const later = new Set(p.deferred ?? []);
    // the slides other workers of the page are drawing right now (up to three side by side) are not handed out again
    const taken = new Set(o.exclude ?? []);
    const order = (list: typeof todo) => [...list.filter((s) => !later.has(s.n)), ...list.filter((s) => later.has(s.n))];
    // a motion carousel in two stages: every waiting slide's still first (slide 1 first), then each still is animated
    // no separate still design: the approved picture IS the still, he writes each moving slide ONCE over it (the owner,
    // 17 Nov 2026: «خلاص صورة مستوية ليش اكتب كودها؟»; stills kept from before still animate)
    const needStill: typeof todo = [];
    // a slide whose still is still being drawn is never animated before it
    const rest = order(todo.filter((s) => !taken.has(s.n)));
    const next = needStill.length ? (needStill.find((s) => s.n === 1 && !later.has(1)) ?? needStill[0]) : (rest.find((s) => s.n === 1 && !later.has(1)) ?? rest[0]);
    const state = await finish([]);
    const slide1 = p.made.find((s) => s.n === 1) ?? p.stills?.["1"]?.slide ?? base.get(1) ?? null;
    if (!next) return state;
    const code = await codeSlide(userId, chatId, messages, p, next, c.total, slide1, who, needStill.length ? "still" : "motion");
    return { ...state, code: later.has(next.n) ? { ...code, light: true as const } : code };
  }

  // the reference of every slide: slide 1 (made now, or the one that stands)
  const ref1 = p.made.find((s) => s.n === 1) ?? base.get(1);
  const refBytes = ref1 ? await producedBytes(userId, ref1.fileId) : null;
  // slide 1 is handed to جواد with each request as a stored reference of the person's (once for the call)
  // and the person's own attached pictures go to جواد with every slide
  const { list: mineList } = await attachmentsOf(userId, p.refs ?? []);
  const mine = mineList.filter((a) => a.kind === "image").map((a) => a.id);
  let ref: string | null = null;
  if (refBytes) {
    try {
      ref = await deskReference(userId, refBytes, `slide1-${p.id.slice(0, 8)}`);
    } catch (e) {
      throw new UserError(e instanceof DeskError ? e.reason : "ما قدرنا نجهّز الشريحة الأولى كمرجع.", 502);
    }
  }
  const first = todo.find((s) => s.n === 1);
  const batch = !refBytes && first ? [first] : todo.slice(0, CHUNK);

  return finish(await Promise.all(batch.map((s) => makeSlide(c, p, s, ref, mine))));
}

/** What is made and what failed is put in the carousel and saved; the state the page shows is returned. */
async function settle(o: { userId: string; chatId: string; chat: Chat; p: PendingProduce; messages: Chat["messages"]; at: number; base: Map<number, Slide> }, results: SlideResult[], phase?: "pictures" | "approve"): Promise<Produced> {
  const { userId, chatId, p, messages, at, base } = o;
  let usd = 0;
  for (const r of results) {
    usd += r.usd;
    if (r.made) {
      p.made.push(r.made);
      // the slide it replaced goes away (the new one is already stored) — but never the picture it was drawn over, which
      // stood in its place while it was made: that picture is what drawing the slide again keeps (it was deleted, so a
      // redraw found no picture and painted a new one, 17 Nov 2026)
      const old = base.get(r.made.n);
      const isArt = !!old && (/^(picture|element)-/.test(old.name) || Object.values(p.arts ?? {}).includes(old.fileId));
      if (old && p.mode === "fix" && !isArt) {
        await deleteProduced(userId, old.fileId);
        if (old.video) await deleteProduced(userId, old.video);
      }
    }
    if (r.failed) p.failed.push(r.failed);
  }

  const items = new Map(base);
  // the pictures painted first show in the slides' places until «حيدرا ماكس» designs them
  for (const [k, fileId] of Object.entries(p.arts ?? {})) {
    const s = p.slides.find((x) => x.n === Number(k));
    if (s && !p.stills?.[k] && !p.made.some((m) => m.n === s.n)) items.set(s.n, { n: s.n, fileId, name: `picture-${k.padStart(2, "0")}`, text: s.text });
  }
  // a two-stage motion carousel: the stills show while their motion is being made
  for (const st of Object.values(p.stills ?? {})) items.set(st.slide.n, st.slide);
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
    running: left.length > 0 && phase !== "approve",
    total: p.mode === "all" ? p.slides.length : sorted.length,
    ...(p.deferred?.length && left.length ? { deferred: p.deferred.filter((n) => left.includes(n)) } : {}),
    ...(phase && left.length ? { phase } : {}),
    styleId: p.styleId,
    templateId: p.templateId,
    ...(p.maker === "code" ? { maker: "code" as const } : {}),
    ...(p.mix ? { mix: true } : {}),
    ...(p.carouselId ? { carouselId: p.carouselId } : {}),
    ...(p.fontId ? { fontId: p.fontId } : {}),
    ...(p.paletteId ? { paletteId: p.paletteId } : {}),
    ...(p.motion ? { motion: p.motion } : {}),
    ...(old?.report && left.length ? { report: old.report } : {}),
  };
  let report: string | null = null;
  if (!left.length) {
    report = buildReport({ made: p.made, failed: p.failed, unchecked: p.made.filter((s) => s.flag === UNCHECKED).length });
    block.report = report;
  }
  if (messages[at]) messages[at] = { ...messages[at], slides: block };
  await saveChat(userId, chatId, { messages, pending: left.length ? p : null, addUsd: usd });

  return { chatId, aspect: p.aspect, slides: sorted, todo: left, failed: block.failed, running: left.length > 0 && phase !== "approve", total: block.total, report, usd: Math.round(usd * 10000) / 10000, ...(phase && left.length ? { phase } : {}), ...(block.deferred?.length ? { deferred: block.deferred } : {}), ...(p.motion ? { motion: true } : {}) };
}

// ───────── «Claude Code»: the slides drawn in code in the person's browser ─────────

/** What «حيدرا ماكس» is told about the painted picture he places in a slide (it is photo1). */
const ART_NOTE = 'photo1 is the PICTURE painted for this slide by GPT Image 2 (it has no writing in it): place it as the slide asks (crop it with K.picture, frame it, grade it to the carousel\'s palette) and set EVERY word yourself in code. Never paint text into it or redraw it.';
/** The third way: the picture IS the slide, and he only writes on it. */
const MIX_NOTE = 'photo1 is the WHOLE SLIDE, painted by GPT Image 2 with no writing in it: draw it full-bleed filling the frame with K.picture, untouched. Your only job is the Arabic writing: set EVERY word exactly as given, in the calm area the picture leaves, large and perfectly readable (add a soft gradient scrim behind the words only if the picture is too busy there). Add no other shapes, icons or drawings.';

/** A motion slide's painted picture: the scene he moves (push, parallax, light) and writes over. */
const PICTURE_NOTE = "photo1 is this slide's PICTURE, painted by GPT Image 2 with no writing in it: make it the moving heart of the slide (full-bleed or framed, with a slow camera push, a parallax drift, a light sweep, graded to the carousel's look) and set EVERY word yourself in code over its calm area. Never paint text into it.";
/** A motion slide's element: a cut-out on a transparent background, moved over the background he draws. */
const ELEMENT_NOTE = "photo1 is this slide's ELEMENT, painted by GPT Image 2 and cut out of its background (a transparent PNG): draw the slide's background yourself in code, then bring the element in with motion (a soft pop, a slide, a float) with a soft contact shadow, and set EVERY word yourself in code. Never redraw or distort the element.";
/** What a picture for an element asks of GPT Image 2: one clear object, alone, on a plain background, so it cuts out clean. */
const ELEMENT_RULE = "ONE single clear subject (a product, a character, an object or an icon), whole and centred with space around it, alone on a plain flat light-grey background with no shadow, no floor, no scene and no other object, so it can be cut out cleanly.";

/** The subject of a picture cut out of its background (BiRefNet on fal, trimmed to its own box), or null when it can't be. */
async function cutOut(bytes: Buffer): Promise<{ bytes: Buffer; width: number; height: number } | null> {
  if (!falReady()) return null;
  try {
    const sharp = (await import("sharp")).default;
    const out = await falRun<Record<string, unknown>>("fal-ai/birefnet/v2", { image_url: `data:image/png;base64,${(await sharp(bytes).png().toBuffer()).toString("base64")}`, model: "General Use (Heavy)", operating_resolution: "1024x1024", output_format: "png", refine_foreground: true }, 150_000);
    const url = falUrl(out, "image");
    if (!url) return null;
    const trimmed = await sharp(await falFile(url)).trim().png().toBuffer();
    const m = await sharp(trimmed).metadata();
    return m.width && m.height ? { bytes: trimmed, width: m.width, height: m.height } : null;
  } catch (e) {
    console.error("content element cut-out", e);
    return null;
  }
}

/** A slide that must have a painted picture and got no brief for one: the slide's own brief, with its writing taken out. */
const pictureFrom = (prompt: string) => `The full picture of this slide, with calm empty areas where text will be added later: ${prompt.replace(/"[^"]*"/g, "").replace(/\s+/g, " ").trim()}`;

/** The brief of one slide for «حيدرا ماكس»: the slide's full prompt (its exact writing), the shape, slide 1 and the
 * person's pictures as references — and its painted picture, made now by GPT Image 2 (no writing) when it needs one. */
/** What a slide's picture is painted from (GPT Image 2, no writing), or "" when the slide has none; and whether it is an element. */
function pictureBrief(p: PendingProduce, s: PendingProduce["slides"][number]): { brief: string; element: boolean } {
  const car = p.carouselId ? findCarouselStyle(p.carouselId) : null;
  // the third way paints every slide; so does a realistic style with no pictures of the person's: realistic things are never drawn in code
  const hasOwn = (p.refs?.length ?? 0) > 0;
  // a motion carousel paints only by the way the person picked (cheapest first): «حيدرا ماكس» alone draws everything in code
  // (a realistic style with none of the person's pictures still gets its picture painted: realistic things are never drawn in code)
  const route = p.motion?.route === "code" && car?.photoIdea && !hasOwn ? "picture" : p.motion?.route;
  const brief = route === "code" ? "" : route ? (s.picture ?? pictureFrom(s.prompt)) : (s.picture ?? (p.mix || (car?.photoIdea && !hasOwn) ? pictureFrom(s.prompt) : ""));
  return { brief, element: route === "elements" };
}

/** Paints slide `s`'s picture with GPT Image 2 (kept in p.arts, saved with the carousel); null when the slide has none. */
async function paintArt(userId: string, chatId: string, messages: Chat["messages"], p: PendingProduce, s: PendingProduce["slides"][number], who: DeskWho): Promise<string | null> {
  let art = p.arts?.[String(s.n)] ?? null;
  if (art) return art;
  const { brief, element } = pictureBrief(p, s);
  if (!brief) return null;
  const car = p.carouselId ? findCarouselStyle(p.carouselId) : null;
  const pal = p.paletteId ? findPalette(p.paletteId) : null;
  {
    // the person's own pictures guide the painting (a product, a logo's colours); it never carries any writing
    const { list } = await attachmentsOf(userId, p.refs ?? []);
    const refs = list.filter((a) => a.kind === "image").slice(0, 6).map((a, i) => ({ uploadId: a.id, name: `ref${i + 1}` }));
    const style = p.styleId ? findStyle(p.styleId) : null;
    try {
      const paint = (extra: string) => deskImage(who, { key: `c-${randomUUID().replace(/-/g, "")}`, kind: "image", prompt: [brief, element ? ELEMENT_RULE : "", pal ? paletteBlock(pal) : "", car ? `LOOK OF THE CAROUSEL (for the picture only): ${pal ? `${withoutColours(car.look)} ${COLOURS_ARE_THE_CLIENTS}` : car.look}` : "", style ? `ILLUSTRATION STYLE (verbatim): ${style.text}` : "", NO_REALISTIC_WOMEN, extra, NO_TEXT_RULE].filter(Boolean).join("\n\n"), aspect: p.aspect, resolution: IMAGE_TIER, quality: IMAGE_QUALITY, refs });
      let r = await paint("");
      // a picture that came out with a realistic adult woman is painted once more; a second one stops the slide
      if ((await showsRealWoman(r.bytes)).woman) {
        r = await paint("The previous attempt showed a realistic adult woman, which is forbidden: show no woman at all.");
        if ((await showsRealWoman(r.bytes)).woman) throw new UserError(`${WOMAN_PROBLEM}. غيّر وصف صورة الشريحة ${s.n} وجرّب مرة ثانية.`, 422);
      }
      const file = await addProducedFromOutput({ userId, chatId, out: r.out, name: `picture-${String(s.n).padStart(2, "0")}`, meta: { slide: s.n, picture: brief, aspect: p.aspect, batch: p.id, desk: r.receipt } });
      art = file.id;
      // an element: cut out of its plain background (a transparent PNG he moves over the background he draws)
      if (element) {
        const cut = await cutOut(r.bytes);
        if (cut) art = (await addProduced({ userId, chatId, bytes: cut.bytes, name: `element-${String(s.n).padStart(2, "0")}`, width: cut.width, height: cut.height, meta: { slide: s.n, picture: brief, batch: p.id, cutout: file.id } })).id;
      }
      p.arts = { ...(p.arts ?? {}), [String(s.n)]: art };
      // kept with the carousel (the messages as this call just saved them), so it is painted once
      await saveChat(userId, chatId, { messages, pending: p });
    } catch (e) {
      if (e instanceof UserError) throw e;
      console.error("content slide picture", e instanceof DeskError ? e.detail : e);
      throw new UserError(e instanceof DeskError ? e.reason : "ما قدر جواد يرسم صورة الشريحة الحين؛ جرّب مرة ثانية.", 502);
    }
  }
  return art;
}

async function codeSlide(userId: string, chatId: string, messages: Chat["messages"], p: PendingProduce, s: PendingProduce["slides"][number], total: number, slide1: Slide | null, who: DeskWho, stage: "still" | "motion" = "motion"): Promise<CodeSlide> {
  const car = p.carouselId ? findCarouselStyle(p.carouselId) : null;
  const font = p.fontId ? findContentFont(p.fontId) : null;
  const pal = p.paletteId ? findPalette(p.paletteId) : null;
  const { element } = pictureBrief(p, s);
  const art = await paintArt(userId, chatId, messages, p, s, who);
  const links = await producedLinks(userId, chatId);
  const refs: string[] = [];
  if (slide1 && s.n !== 1) {
    const url = links.get(slide1.fileId);
    if (url) refs.push(url);
  }
  const artUrl = art ? (links.get(art) ?? null) : null;
  // the person's own pictures guided the painting of this slide's picture (they are IN it already): a motion slide with
  // its painted picture does not hand them to «حيدرا ماكس» a second time, to be read for nothing
  const { list } = artUrl && p.motion ? { list: [] } : await attachmentsOf(userId, p.refs ?? []);
  const mine = [...(await uploadLinks(userId, list.filter((a) => a.kind === "image").map((a) => a.id))).values()];
  refs.push(...mine);
  const prompt = slidePrompt({ n: s.n, total, prompt: s.prompt, styleId: p.styleId, carouselId: p.carouselId, fontId: p.fontId, paletteId: p.paletteId, withRef: refs.length > mine.length, userRefs: mine.length });
  const motion: CodeSlide["motion"] | null = p.motion && stage === "motion" ? { seconds: p.motion.seconds, style: motionStyleForCode(p.motion.styleId === "own" ? null : findMotionCarouselStyle(p.motion.styleId), p.motion.own ?? ""), first: s.n === 1, total } : null;
  // the person's own sound under the carousel: this slide's part of it (as long as its part, moving on its phrases)
  let soundNote = "";
  if (motion) {
    if (p.sound === undefined) {
      const snd = await chatSound(userId, messages).catch(() => null);
      p.sound = snd ? { uploadId: snd.uploadId, speech: snd.phrases.length > 0, slices: splitSound(snd, total, p.motion!.seconds) } : false;
      await saveChat(userId, chatId, { messages, pending: p });
    }
    // the slide's own part of the sound: by its place in the WHOLE carousel (slides drawn again are only some of them:
    // their place among those gave slide 3, drawn again alone, the first part of the sound)
    const at = p.mode === "fix" ? s.n - 1 : p.slides.findIndex((x) => x.n === s.n);
    const slice = p.sound ? (p.sound.slices[Math.max(0, Math.min(p.sound.slices.length - 1, at))] ?? null) : null;
    const link = slice && p.sound ? (await uploadLinks(userId, [p.sound.uploadId])).get(p.sound.uploadId) : null;
    if (slice && link && p.sound) {
      motion.seconds = Math.max(1, Math.round((slice.to - slice.from) * 100) / 100);
      motion.voice = { url: link, from: slice.from, to: slice.to };
      soundNote = sliceNote(slice, p.sound.speech);
    }
  }
  const body = artUrl ? `${prompt}\n\n${motion ? (element ? ELEMENT_NOTE : PICTURE_NOTE) : p.mix ? MIX_NOTE : ART_NOTE}` : prompt;
  // a program kept before a refresh (it already ran): the page goes on from it
  const kept = motion ? await keptProgram(p.programs?.[String(s.n)]) : null;
  // stage 2: the approved still he animates
  const still = motion && !kept ? await stillProgram(p.stills?.[String(s.n)]?.program) : null;
  return {
    n: s.n,
    prompt: soundNote ? `${body}\n\n${soundNote}` : body,
    ...(p.motion && stage === "still" ? { stage: "still" as const } : {}),
    ...(still ? { still } : {}),
    ...(kept ? { program: kept } : {}),
    aspect: p.aspect,
    refs: refs.slice(0, 4),
    photos: artUrl ? [artUrl] : [],
    ...(car || font || pal ? { style: [font ? `${FONT_PIN(font.id)} ${fontBlock(font)}` : "", pal ? paletteBlock(pal) : "", car ? carouselStyleForCode(car, !!pal) : ""].filter(Boolean).join("\n") } : {}),
    ...(p.mix ? { mix: true } : {}),
    ...(motion ? { motion } : {}),
  };
}

/**
 * A slide the page could not draw (his answer ran out of time, the scene would not run…): it is recorded as failed and the
 * carousel goes on to the next slide — each slide on its own (the owner, 16 Nov 2026: «خل يقسم الشغلة يشتغل كل سلايدة
 * بروحها»; one heavy cover slide used to stop the whole carousel). «أعد المحاولة» draws the failed ones again.
 */
export async function codeSlideFailed(userId: string, chatId: string, b: { n?: unknown; codeFailed?: unknown }): Promise<Produced> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p || p.maker !== "code") throw new UserError("ما فيه كاروسيل ينتظر حيدرا ماكس في هذي المحادثة.", 409);
  const s = p.slides.find((x) => x.n === Number(b.n));
  if (!s || p.made.some((x) => x.n === s.n) || p.failed.some((x) => x.n === s.n)) throw new UserError("هذي الشريحة مو بانتظار الرسم.", 409);
  const why = String(b.codeFailed ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || "ما انرسمت";
  const messages = [...chat.messages];
  const at = Math.min(p.at, messages.length - 1);
  const base = new Map((messages[at]?.slides?.items ?? []).map((x) => [x.n, x]));
  return settle({ userId, chatId, chat, p, messages, at, base }, [{ failed: { n: s.n, reason: why, text: s.text, prompt: s.prompt }, usd: 0 }]);
}

const stillPath = (userId: string, chatId: string, pid: string, n: number) => `content-stills/${userId}/${chatId}/${pid}-${n}.json`;
const programPath = (userId: string, chatId: string, pid: string, n: number) => `content-programs/${userId}/${chatId}/${pid}-${n}.json`;

async function keptProgram(path: string | undefined): Promise<CodeSlide["program"] | null> {
  if (!path) return null;
  try {
    const { data } = await storage.from(JAWAD_BUCKET).download(path);
    if (!data) return null;
    const j = JSON.parse(await data.text()) as { code?: unknown; fonts?: { head?: unknown; body?: unknown }; size?: unknown };
    const size = Array.isArray(j.size) && j.size.length === 2 ? ([Number(j.size[0]), Number(j.size[1])] as [number, number]) : null;
    if (typeof j.code !== "string" || !j.code.trim() || !size || !size[0] || !size[1]) return null;
    return { code: j.code, fonts: { head: String(j.fonts?.head ?? ""), body: String(j.fonts?.body ?? "") }, size };
  } catch {
    return null;
  }
}

/** A motion slide's program that runs, kept on the server (a refresh of the page goes on from it). */
export async function saveSlideProgram(userId: string, chatId: string, b: { n?: unknown; code?: unknown; fonts?: unknown; size?: unknown }): Promise<{ ok: boolean }> {
  const chat = await getChat(userId, chatId);
  const p = chat?.pending;
  const n = Number(b.n);
  if (!chat || !p || p.maker !== "code" || !p.slides.some((s) => s.n === n) || typeof b.code !== "string" || !b.code.trim()) return { ok: false };
  const path = programPath(userId, chatId, p.id, n);
  const fonts = (b.fonts && typeof b.fonts === "object" ? b.fonts : {}) as { head?: unknown; body?: unknown };
  const size = Array.isArray(b.size) ? b.size.slice(0, 2).map(Number) : [];
  await storage.from(JAWAD_BUCKET).upload(path, Buffer.from(JSON.stringify({ code: b.code.slice(0, 160_000), fonts: { head: String(fonts.head ?? ""), body: String(fonts.body ?? "") }, size })), { contentType: "application/json", upsert: true });
  p.programs = { ...(p.programs ?? {}), [String(n)]: path };
  await saveChat(userId, chatId, { messages: chat.messages, pending: p });
  return { ok: true };
}

/** A kept still program (stage 1 of a motion carousel), or null. */
async function stillProgram(path: string | undefined): Promise<CodeSlide["still"] | null> {
  if (!path) return null;
  try {
    const { data } = await storage.from(JAWAD_BUCKET).download(path);
    if (!data) return null;
    const j = JSON.parse(await data.text()) as { code?: unknown; fonts?: { head?: unknown; body?: unknown } };
    if (typeof j.code !== "string" || !j.code.trim()) return null;
    return { code: j.code, fonts: { head: String(j.fonts?.head ?? ""), body: String(j.fonts?.body ?? "") } };
  } catch {
    return null;
  }
}

/**
 * Stage 1 of a motion carousel: the still the page drew (its PNG and its program) is kept and shown; the slide stays
 * waiting for its motion (stage 2).
 */
async function keepStill(userId: string, chatId: string, chat: Chat, p: PendingProduce, s: PendingProduce["slides"][number], bytes: Buffer, meta: { width: number; height: number }, b: { program?: unknown; fonts?: unknown }): Promise<Produced> {
  const file = await addProduced({ userId, chatId, bytes, name: `still-${String(s.n).padStart(2, "0")}`, width: meta.width, height: meta.height, meta: { slide: s.n, aspect: p.aspect, text: s.text, batch: p.id, maker: "code", stage: "still" } });
  const code = typeof b.program === "string" ? b.program.slice(0, 160_000) : "";
  let path = "";
  if (code.trim()) {
    path = stillPath(userId, chatId, p.id, s.n);
    const fonts = (b.fonts && typeof b.fonts === "object" ? b.fonts : {}) as { head?: unknown; body?: unknown };
    await storage.from(JAWAD_BUCKET).upload(path, Buffer.from(JSON.stringify({ code, fonts: { head: String(fonts.head ?? ""), body: String(fonts.body ?? "") } })), { contentType: "application/json", upsert: true });
  }
  p.stills = { ...(p.stills ?? {}), [String(s.n)]: { slide: { n: s.n, fileId: file.id, name: file.name, text: s.text }, program: path } };
  const messages = [...chat.messages];
  const at = Math.min(p.at, messages.length - 1);
  const base = new Map((messages[at]?.slides?.items ?? []).map((x) => [x.n, x]));
  return settle({ userId, chatId, chat, p, messages, at, base }, []);
}

/** The PNG the page drew from «حيدرا ماكس»'s program becomes slide `n` of the carousel being made. */
export async function produceFromCode(userId: string, chatId: string, b: { n?: unknown; png?: unknown; pngUpload?: unknown; rounds?: unknown; scores?: unknown; video?: unknown; stage?: unknown; program?: unknown; fonts?: unknown }): Promise<Produced> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p || p.maker !== "code") throw new UserError("ما فيه كاروسيل ينتظر حيدرا ماكس في هذي المحادثة.", 409);
  const s = p.slides.find((x) => x.n === Number(b.n));
  if (!s || p.made.some((x) => x.n === s.n) || p.failed.some((x) => x.n === s.n)) throw new UserError("هذي الشريحة مو بانتظار الرسم.", 409);
  const bytes = await drawnPng(userId, b, 16_000_000);
  if (!bytes) throw new UserError("ما وصلت صورة الشريحة.", 400);
  const sharp = (await import("sharp")).default;
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (meta?.format !== "png" || !meta.width || !meta.height) throw new UserError("صورة الشريحة مو صالحة.", 400);
  // the rule holds for what was placed in the slide too (a person's attached picture). A slide with none of the person's
  // pictures holds only what «حيدرا ماكس» drew in code and its painted picture, which was looked at when it was painted:
  // looking at the same picture a second time bought nothing
  const seen = (p.refs?.length ?? 0) > 0 ? await showsRealWoman(bytes) : { woman: false, usd: 0 };
  if (seen.woman) {
    const messages = [...chat.messages];
    const at = Math.min(p.at, messages.length - 1);
    const base = new Map((messages[at]?.slides?.items ?? []).map((x) => [x.n, x]));
    return settle({ userId, chatId, chat, p, messages, at, base }, [{ failed: { n: s.n, reason: `${WOMAN_PROBLEM}. غيّر الصورة أو وصفها ثم أعد المحاولة.`, text: s.text, prompt: s.prompt }, usd: seen.usd }]);
  }
  // stage 1 of a motion carousel: the still is kept, and the slide waits for its motion
  if (p.motion && b.stage === "still") return keepStill(userId, chatId, chat, p, s, bytes, { width: meta.width, height: meta.height }, b);
  // a motion carousel's slide comes with its MP4 (put up by the page as the person's upload, then recorded here)
  const video = p.motion ? await producedVideo(userId, chatId, b.video, s.n, p.id) : null;
  const file = await addProduced({
    userId,
    chatId,
    bytes,
    name: `slide-${String(s.n).padStart(2, "0")}`,
    width: meta.width,
    height: meta.height,
    meta: { slide: s.n, aspect: p.aspect, text: s.text, prompt: s.prompt, styleId: p.styleId, templateId: p.templateId, batch: p.id, ...(p.refs?.length ? { refs: p.refs } : {}), ...(s.picture ? { picture: s.picture } : {}), maker: "code", claudeCode: { rounds: Math.round(Number(b.rounds) || 0), scores: b.scores ?? null } },
  });
  const messages = [...chat.messages];
  const at = Math.min(p.at, messages.length - 1);
  const base = new Map((messages[at]?.slides?.items ?? []).map((x) => [x.n, x]));
  return settle({ userId, chatId, chat, p, messages, at, base }, [{ made: { n: s.n, fileId: file.id, name: file.name, text: s.text, ...(video ? { video } : {}) }, usd: seen.usd }]);
}

/** The MP4 the page rendered of a motion slide (the person's ready video upload), recorded as the conversation's file. */
async function producedVideo(userId: string, chatId: string, uploadId: unknown, n: number, batch: string): Promise<string> {
  const { rows } = await attachmentsOf(userId, [uploadId]);
  const up = rows[0];
  if (!up || up.kind !== "video") throw new UserError("ما وصل فيديو الشريحة؛ أعد المحاولة.", 400);
  return addProducedVideo({ userId, chatId, path: up.storage_path, bytes: Number(up.bytes) || 0, name: `slide-${String(n).padStart(2, "0")}`, meta: { slide: n, batch, uploadId: up.id, maker: "code", motion: true } });
}
