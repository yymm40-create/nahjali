// «المصمم الذكي» — the produce step: the artwork of a design «كاظم» ordered. He does not draw it himself: the request
// is handed to جواد's desk (src/lib/content/jawad.ts), who makes it with GPT Image 2 as an ordinary JAWAD AI job (so
// it is also in «أعمالي»), with the site's rule that the picture carries NO TEXT (the words are real layers). The
// picture is checked right after (Claude reads it: any text that slipped in); text in it is drawn again once
// with the problem written into the prompt. Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { deskImage, DeskError, type DeskWho } from "@/lib/content/jawad";
import { checkSlide } from "@/lib/content/verify";
import { NO_TEXT_RULE } from "@config/designer";
import { getChat, saveChat, type Chat, type PendingDesign } from "./chats";
import { addFileFromOutput, attachmentsOf } from "./files";
import type { Design } from "./layers";

/** GPT Image 2 for the artwork: the high tier (the design is exported at this size), high quality. */
export const IMAGE_TIER = "hi" as const;
export const IMAGE_QUALITY = "high" as const;
const MAX_ATTEMPTS = 2;

/** The full prompt of the artwork: what كاظم wrote, how the references are used, the no-text rule, the fix. */
export function artworkPrompt(o: { prompt: string; refs: number; fix?: string }): string {
  return [
    "Artwork for a designed graphic (a card, a poster or a thumbnail). The typography will be added later as separate text layers, so this picture is the background art only.",
    o.refs ? `The client's own attached picture${o.refs > 1 ? "s are" : " is"} given as reference${o.refs > 1 ? "s" : ""} (named ref1${o.refs > 1 ? "…" : ""}): use ${o.refs > 1 ? "them" : "it"} as the brief says (a photo of a person to place, a template whose look to follow, a logo), keeping a person's face and identity exactly as in the photo.` : "",
    o.prompt,
    NO_TEXT_RULE,
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
  const at = Math.min(p.at, chat.messages.length - 1);
  const base = chat.messages[at]?.design;
  if (!base) throw new UserError("ما لقينا التصميم في المحادثة.", 409);
  const who: DeskWho = { id: userId, email: o.email, owner: await unlimitedFor(o.email), origin: o.origin ?? "" };
  const { list } = await attachmentsOf(userId, p.refs);
  const refs = list.filter((a) => a.kind === "image").map((a, i) => ({ uploadId: a.id, name: `ref${i + 1}` }));

  let usd = 0;
  let fix = "";
  let flag = "";
  let design: Design | null = null;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const r = await deskImage(who, { key: `d-${randomUUID().replace(/-/g, "")}`, kind: "image", prompt: artworkPrompt({ prompt: p.artwork, refs: refs.length, fix }), aspect: p.aspect, resolution: IMAGE_TIER, quality: IMAGE_QUALITY, refs });
      // the check: no text should be on the picture (expected text is empty, so any word is "extra")
      const check = await checkSlide(r.bytes, "");
      usd += check.usd;
      const bad = check.checked && check.problems.length > 0;
      if (bad && attempt < MAX_ATTEMPTS) {
        fix = `The previous attempt had these problems — fix every one of them: ${check.problems.join("; ") || "text was drawn"}. Remove every trace of letters, words or writing; keep the surfaces where text would go clean.`;
        continue;
      }
      flag = bad ? check.problems.join("، ").slice(0, 300) : "";
      const file = await addFileFromOutput({ userId, chatId, out: r.out, name: `artwork-${p.id}`, meta: { prompt: p.artwork, aspect: p.aspect, kind: p.kind, refs: p.refs, desk: r.receipt, ...(flag ? { flag } : {}) } });
      design = { ...base, artwork: file.id, width: r.out.width ?? base.width, height: r.out.height ?? base.height, layers: base.layers.length ? base.layers : p.layers, state: "ready", ...(flag ? { flag } : {}) };
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
  const pending: PendingDesign = { id: d.id, at, kind: prompt.kind, aspect: d.aspect, artwork: prompt.artwork, refs: prompt.refs, layers: d.layers, keep: null };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design: { ...d, state: "drawing", error: undefined, detail: undefined, flag: undefined } };
  await saveChat(userId, chat.id, { messages, pending });
}

/** The prompt a design was (or is to be) drawn with: the pending order, else what its artwork's record keeps. */
async function lastPrompt(chat: Chat, at: number): Promise<{ artwork: string; refs: string[]; kind: PendingDesign["kind"] } | null> {
  if (chat.pending && chat.pending.at === at && chat.pending.artwork) return { artwork: chat.pending.artwork, refs: chat.pending.refs, kind: chat.pending.kind };
  const d = chat.messages[at].design;
  if (!d?.artwork) return null;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().from("designer_files").select("meta").eq("id", d.artwork).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  if (typeof meta.prompt !== "string" || !meta.prompt) return null;
  return { artwork: meta.prompt, refs: Array.isArray(meta.refs) ? meta.refs.filter((r): r is string => typeof r === "string") : [], kind: (typeof meta.kind === "string" ? meta.kind : "other") as PendingDesign["kind"] };
}
