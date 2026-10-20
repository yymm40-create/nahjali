// «المصمم الذكي» — the produce step: the artwork of a design «كاظم» ordered. He does not draw it himself: the request
// is handed to جواد's desk (src/lib/content/jawad.ts), who makes it with GPT Image 2 as an ordinary JAWAD AI job (so
// it is also in «أعمالي»). By default the finished picture includes its typography; editable text layers and a
// text-free picture remain explicit alternatives. The picture is checked right after and redrawn once when the
// requested typography is wrong (or when unwanted text appears in a text-free mode). Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { deskImage, DeskError, type DeskWho } from "@/lib/content/jawad";
import { checkSlide } from "@/lib/content/verify";
import { BAKED_TEXT_RULE, NO_TEXT_RULE, type DesignerTextMode } from "@config/designer";
import { getChat, saveChat, type Chat, type PendingDesign } from "./chats";
import { addFile, addFileFromOutput, attachmentsOf, uploadLinks } from "./files";
import { readLayers, type Design } from "./layers";

/** GPT Image 2 for the artwork: the high tier (the design is exported at this size), high quality. */
export const IMAGE_TIER = "hi" as const;
export const IMAGE_QUALITY = "high" as const;
const MAX_ATTEMPTS = 2;

/** The full prompt of the artwork: what كاظم wrote, how references and typography are used, and any retry fix. */
export function artworkPrompt(o: { prompt: string; refs: number; textMode?: DesignerTextMode; layers?: Design["layers"]; fix?: string }): string {
  const mode = o.textMode ?? "layers";
  const text = (o.layers ?? []).filter((l) => l.kind === "text");
  const typography = text.map((l, i) => `${i + 1}. exact text: "${l.text.replace(/\n/g, " / ")}"; role ${l.role}; position around (${Math.round(l.x)}%, ${Math.round(l.y)}%); width ${Math.round(l.w)}%; colour ${l.color}; ${l.align} aligned; visual size ${l.size}% of canvas height`).join("\n");
  return [
    mode === "baked" ? "A complete finished graphic design (card, poster or thumbnail), including its final typography." : "Artwork for a designed graphic (a card, a poster or a thumbnail). The typography will be added later, so this picture is the background art only.",
    o.refs ? `The client's own attached picture${o.refs > 1 ? "s are" : " is"} given as reference${o.refs > 1 ? "s" : ""} (named ref1${o.refs > 1 ? "…" : ""}): use ${o.refs > 1 ? "them" : "it"} as the brief says (a photo of a person to place, a template whose look to follow, a logo), keeping a person's face and identity exactly as in the photo.` : "",
    o.prompt,
    mode === "baked" ? `${BAKED_TEXT_RULE}\n\nTYPOGRAPHY TO RENDER:\n${typography}` : NO_TEXT_RULE,
    o.fix ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface Produced {
  chatId: string;
  design: Design;
  usd: number;
}

const reasonOf = (e: unknown) => (e instanceof DeskError ? e.reason : "صار خطأ غير متوقع أثناء الرسم.");
const detailOf = (e: unknown) => (e instanceof DeskError ? e.detail || e.reason : e instanceof Error ? e.message : String(e)).slice(0, 300);

/**
 * One call of the produce step: draws the artwork of the pending design (once, or once more if the check found
 * text in it), stores it, and writes the design's state into its message.
 */
export async function produce(userId: string, chatId: string, o: { owner?: boolean; email?: string | null; origin?: string } = {}): Promise<Produced> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p) throw new UserError("ما فيه تصميم ينتظر الرسم في هذي المحادثة.", 409);
  if (p.maker === "code") throw new UserError("هذا التصميم يرسمه حيدرا ماكس في صفحتك.", 409);
  const at = Math.min(p.at, chat.messages.length - 1);
  const base = chat.messages[at]?.design;
  if (!base) throw new UserError("ما لقينا التصميم في المحادثة.", 409);
  const who: DeskWho = { id: userId, email: o.email, owner: await unlimitedFor(o.email), origin: o.origin ?? "" };
  const { list } = await attachmentsOf(userId, p.refs);
  // GPT Image 2 takes six references at most (the photos to place come first)
  const refs = list.filter((a) => a.kind === "image").slice(0, 6).map((a, i) => ({ uploadId: a.id, name: `ref${i + 1}` }));

  let usd = 0;
  let fix = "";
  let flag = "";
  let design: Design | null = null;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const r = await deskImage(who, { key: `d-${randomUUID().replace(/-/g, "")}`, kind: "image", prompt: artworkPrompt({ prompt: p.artwork, refs: refs.length, textMode: p.textMode, layers: p.layers, fix }), aspect: p.aspect, resolution: IMAGE_TIER, quality: IMAGE_QUALITY, refs });
      const expected = p.textMode === "baked" ? p.layers.filter((l) => l.kind === "text").map((l) => l.text).join("\n") : "";
      const check = await checkSlide(r.bytes, expected);
      usd += check.usd;
      const bad = check.checked && check.problems.length > 0;
      if (bad && attempt < MAX_ATTEMPTS) {
        fix = p.textMode === "baked"
          ? `The previous attempt had these typography problems — fix every one of them while keeping the design: ${check.problems.join("; ")}. Copy the supplied text exactly.`
          : `The previous attempt had these problems — fix every one of them: ${check.problems.join("; ") || "text was drawn"}. Remove every trace of letters, words or writing; keep the surfaces where text would go clean.`;
        continue;
      }
      flag = bad ? check.problems.join("، ").slice(0, 300) : "";
      const file = await addFileFromOutput({ userId, chatId, out: r.out, name: `artwork-${p.id}`, meta: { prompt: p.artwork, aspect: p.aspect, kind: p.kind, textMode: p.textMode, textPlan: p.layers, refs: p.refs, desk: r.receipt, ...(flag ? { flag } : {}) } });
      design = { ...base, artwork: file.id, width: r.out.width ?? base.width, height: r.out.height ?? base.height, textMode: p.textMode, layers: p.textMode === "layers" ? p.layers : [], state: "ready", ...(flag ? { flag } : {}) };
      break;
    } catch (e) {
      lastErr = e;
      console.error("designer artwork attempt", attempt, e instanceof DeskError ? e.detail : e);
      break;
    }
  }
  if (!design) design = { ...base, state: "failed", error: reasonOf(lastErr), ...(o.owner ? { detail: detailOf(lastErr) } : {}) };

  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design };
  await saveChat(userId, chatId, { messages, pending: null, addUsd: usd });
  return { chatId, design, usd: Math.round(usd * 10000) / 10000 };
}

/** Puts a failed design back to be drawn again (the same prompt and layers). */
export async function retry(userId: string, chat: Chat): Promise<void> {
  const at = chat.messages.map((m) => !!m.design).lastIndexOf(true);
  const d = chat.messages[at]?.design;
  if (at < 0 || !d) throw new UserError("ما فيه تصميم نعيد رسمه.", 409);
  const prompt = await lastPrompt(chat, at);
  if (!prompt) throw new UserError("ما لقينا توجيه الرسم لإعادته.", 409);
  const pending: PendingDesign = { id: d.id, at, kind: prompt.kind, aspect: d.aspect, textMode: prompt.textMode, artwork: prompt.artwork, refs: prompt.refs, layers: prompt.layers, keep: null, ...(prompt.maker === "code" ? { maker: "code" as const } : {}), ...(prompt.place?.length ? { place: prompt.place } : {}) };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design: { ...d, state: "drawing", error: undefined, detail: undefined, flag: undefined } };
  await saveChat(userId, chat.id, { messages, pending });
}

/** The prompt a design was (or is to be) drawn with: the pending order, else what its artwork's record keeps. */
async function lastPrompt(chat: Chat, at: number): Promise<{ artwork: string; refs: string[]; kind: PendingDesign["kind"]; textMode: PendingDesign["textMode"]; layers: PendingDesign["layers"]; maker?: PendingDesign["maker"]; place?: string[] } | null> {
  if (chat.pending && chat.pending.at === at && chat.pending.artwork) return { artwork: chat.pending.artwork, refs: chat.pending.refs, kind: chat.pending.kind, textMode: chat.pending.textMode, layers: chat.pending.layers, maker: chat.pending.maker, place: chat.pending.place };
  const d = chat.messages[at].design;
  if (!d?.artwork) return null;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().from("designer_files").select("meta").eq("id", d.artwork).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  if (typeof meta.prompt !== "string" || !meta.prompt) return null;
  return {
    artwork: meta.prompt,
    refs: Array.isArray(meta.refs) ? meta.refs.filter((r): r is string => typeof r === "string") : [],
    kind: (typeof meta.kind === "string" ? meta.kind : "other") as PendingDesign["kind"],
    textMode: meta.textMode === "baked" || meta.textMode === "blank" ? meta.textMode : "layers",
    layers: readLayers(meta.textPlan ?? d.layers),
    ...(meta.maker === "code" ? { maker: "code" as const } : {}),
    ...(Array.isArray(meta.place) && meta.place.length ? { place: meta.place.filter((r): r is string => typeof r === "string") } : {}),
  };
}

// ───────── «Claude Code»: the design drawn in code in the person's browser ─────────

/** What the page needs to draw the pending design in code: the full brief (with the exact writing), its shape and references. */
export async function codeBrief(userId: string, chatId: string) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p || p.maker !== "code") return null;
  const { list } = await attachmentsOf(userId, p.refs);
  const links = await uploadLinks(userId, list.filter((a) => a.kind === "image").map((a) => a.id));
  // the photos to put in the design go into the scene as they are; the other pictures are references for the look
  const place = new Set(p.place ?? []);
  const photos = [...links].filter(([id]) => place.has(id)).map(([, url]) => url).slice(0, 20);
  const urls = [...links].filter(([id]) => !place.has(id)).map(([, url]) => url);
  return { prompt: artworkPrompt({ prompt: p.artwork, refs: urls.length, textMode: "baked", layers: p.layers }), aspect: p.aspect, refs: urls.slice(0, 4), photos };
}

/** The PNG the page drew from Claude Code's program becomes the pending design's artwork. */
export async function produceFromCode(userId: string, chatId: string, b: { png?: unknown; rounds?: unknown; scores?: unknown }): Promise<Produced> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p || p.maker !== "code") throw new UserError("ما فيه تصميم ينتظر حيدرا ماكس في هذي المحادثة.", 409);
  const at = Math.min(p.at, chat.messages.length - 1);
  const base = chat.messages[at]?.design;
  if (!base) throw new UserError("ما لقينا التصميم في المحادثة.", 409);
  const data = typeof b.png === "string" ? b.png.replace(/^data:image\/png;base64,/, "") : "";
  if (!data || data.length > 16_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw new UserError("ما وصلت صورة التصميم.", 400);
  const bytes = Buffer.from(data, "base64");
  const sharp = (await import("sharp")).default;
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (meta?.format !== "png" || !meta.width || !meta.height) throw new UserError("صورة التصميم مو صالحة.", 400);
  const file = await addFile({ userId, chatId, bytes, name: `artwork-${p.id}`, role: "artwork", width: meta.width, height: meta.height, meta: { prompt: p.artwork, aspect: p.aspect, kind: p.kind, textMode: "baked", textPlan: p.layers, refs: p.refs, ...(p.place?.length ? { place: p.place } : {}), maker: "code", claudeCode: { rounds: Math.round(Number(b.rounds) || 0), scores: b.scores ?? null } } });
  const design: Design = { ...base, artwork: file.id, width: meta.width, height: meta.height, textMode: "baked", layers: [], state: "ready" };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design };
  await saveChat(userId, chatId, { messages, pending: null });
  return { chatId, design, usd: 0 };
}
