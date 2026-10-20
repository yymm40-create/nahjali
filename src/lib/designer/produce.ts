// «المصمم الذكي» — the produce step: «حيدرا ماكس» designs EVERY design in code, in the person's browser (the exact
// Arabic writing in the site's fonts, the shapes, the layout, the person's own photos placed unchanged), looks at it and
// rewrites it until it passes. When the design needs a painted picture (a scene, a realistic background, an
// illustration), جواد paints it FIRST with GPT Image 2 — WITHOUT any writing in it — and «حيدرا ماكس» places it and
// sets every word over it. Nothing else draws a design (the owner's order: حيدرا ماكس + GPT Image 2, no third way).
// Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { deskImage, DeskError, type DeskWho } from "@/lib/content/jawad";
import { BAKED_TEXT_RULE, NO_TEXT_RULE, type DesignerTextMode } from "@config/designer";
import { getChat, saveChat, type Chat, type PendingDesign } from "./chats";
import { addFile, addFileFromOutput, attachmentsOf, fileLinks, uploadLinks } from "./files";
import { readLayers, type Design } from "./layers";
import { COVER_RULES_TEXT } from "@/lib/editor/cover-skill-text";

/** GPT Image 2 for the artwork: the high tier (the design is exported at this size), high quality. */
export const IMAGE_TIER = "hi" as const;
export const IMAGE_QUALITY = "high" as const;

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

/** Puts a failed design back to be drawn again (the same prompt and layers). */
export async function retry(userId: string, chat: Chat): Promise<void> {
  const at = chat.messages.map((m) => !!m.design).lastIndexOf(true);
  const d = chat.messages[at]?.design;
  if (at < 0 || !d) throw new UserError("ما فيه تصميم نعيد رسمه.", 409);
  const prompt = await lastPrompt(chat, at);
  if (!prompt) throw new UserError("ما لقينا توجيه الرسم لإعادته.", 409);
  const pending: PendingDesign = { id: d.id, at, kind: prompt.kind, aspect: d.aspect, textMode: "baked", artwork: prompt.artwork, refs: prompt.refs, layers: prompt.layers, keep: null, maker: "code", ...(prompt.place?.length ? { place: prompt.place } : {}), ...(d.art ? { art: d.art } : prompt.picture ? { picture: prompt.picture } : {}) };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design: { ...d, state: "drawing", error: undefined, detail: undefined, flag: undefined } };
  await saveChat(userId, chat.id, { messages, pending });
}

/** The prompt a design was (or is to be) drawn with: the pending order, else what its artwork's record keeps. */
async function lastPrompt(chat: Chat, at: number): Promise<{ artwork: string; refs: string[]; kind: PendingDesign["kind"]; textMode: PendingDesign["textMode"]; layers: PendingDesign["layers"]; maker?: PendingDesign["maker"]; place?: string[]; picture?: string } | null> {
  if (chat.pending && chat.pending.at === at && chat.pending.artwork) return { artwork: chat.pending.artwork, refs: chat.pending.refs, kind: chat.pending.kind, textMode: chat.pending.textMode, layers: chat.pending.layers, maker: chat.pending.maker, place: chat.pending.place, picture: chat.pending.picture };
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
    ...(typeof meta.picture === "string" && meta.picture ? { picture: meta.picture } : {}),
  };
}

// ───────── «حيدرا ماكس»: the design drawn in code in the person's browser ─────────

/** What «حيدرا ماكس» is told about the painted picture he places (it is photo1). */
const ART_NOTE = 'photo1 is the PICTURE painted for this design by GPT Image 2 (it has no writing in it): use it as the design asks (the background, the scene, the hero illustration) — crop and place it with K.picture, grade or frame it if the design needs, and set EVERY word yourself in code over the calm areas it left for the writing. Never paint text into it or redraw it.';

/**
 * What the page needs to draw the pending design in code: the full brief (with the exact writing), its shape, the
 * references for the look and the photos to place. When the design needs a painted picture and it is not painted yet,
 * جواد paints it now with GPT Image 2 — without any writing — and it becomes the first photo to place.
 */
export async function codeBrief(userId: string, chatId: string, o: { email?: string | null; origin?: string } = {}) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p) return null;
  const { list } = await attachmentsOf(userId, p.refs);
  const images = list.filter((a) => a.kind === "image");
  const place = new Set(p.place ?? []);
  let art = p.art ?? null;
  if (!art && p.picture) {
    const who: DeskWho = { id: userId, email: o.email, owner: await unlimitedFor(o.email), origin: o.origin ?? "" };
    // the person's pictures that are not placed as they are guide the painting (a template's look, a place)
    const refs = images.filter((a) => !place.has(a.id)).slice(0, 6).map((a, i) => ({ uploadId: a.id, name: `ref${i + 1}` }));
    try {
      const r = await deskImage(who, { key: `d-${randomUUID().replace(/-/g, "")}`, kind: "image", prompt: `${p.picture}\n\n${NO_TEXT_RULE}`, aspect: p.aspect, resolution: IMAGE_TIER, quality: IMAGE_QUALITY, refs });
      const file = await addFileFromOutput({ userId, chatId, out: r.out, name: `picture-${p.id}`, meta: { prompt: p.picture, aspect: p.aspect, kind: p.kind, picture: true, desk: r.receipt } });
      art = file.id;
      await saveChat(userId, chatId, { messages: chat.messages, pending: { ...p, art } });
    } catch (e) {
      console.error("designer picture", e instanceof DeskError ? e.detail : e);
      throw new UserError(e instanceof DeskError ? e.reason : "ما قدر جواد يرسم صورة التصميم الحين؛ جرّب مرة ثانية.", 502);
    }
  }
  const links = await uploadLinks(userId, images.map((a) => a.id));
  // the photos to put in the design go into the scene as they are; the other pictures are references for the look
  const artUrl = art ? ((await fileLinks(userId, chatId)).get(art) ?? null) : null;
  const photos = [...(artUrl ? [artUrl] : []), ...[...links].filter(([id]) => place.has(id)).map(([, url]) => url)].slice(0, 20);
  const urls = [...links].filter(([id]) => !place.has(id)).map(([, url]) => url);
  const prompt = artworkPrompt({ prompt: p.artwork, refs: urls.length, textMode: "baked", layers: p.layers });
  // a YouTube thumbnail (a latmiya's too) follows the owner's cover skill: its sizes that read on a phone, word for word
  const cover = p.kind === "thumbnail" || p.kind === "latmiya" ? `\n\nTHE OWNER'S COVER SKILL — its rules file, word for word (this is a YouTube thumbnail: follow its ▶️ part):\n${COVER_RULES_TEXT}` : "";
  return { prompt: `${artUrl ? `${prompt}\n\n${ART_NOTE}` : prompt}${cover}`, aspect: p.aspect, refs: urls.slice(0, 4), photos, picture: Boolean(artUrl) };
}

/** The PNG the page drew from «حيدرا ماكس»'s program becomes the pending design's artwork. */
export async function produceFromCode(userId: string, chatId: string, b: { png?: unknown; rounds?: unknown; scores?: unknown }): Promise<Produced> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p) throw new UserError("ما فيه تصميم ينتظر حيدرا ماكس في هذي المحادثة.", 409);
  const at = Math.min(p.at, chat.messages.length - 1);
  const base = chat.messages[at]?.design;
  if (!base) throw new UserError("ما لقينا التصميم في المحادثة.", 409);
  const data = typeof b.png === "string" ? b.png.replace(/^data:image\/png;base64,/, "") : "";
  if (!data || data.length > 16_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw new UserError("ما وصلت صورة التصميم.", 400);
  const bytes = Buffer.from(data, "base64");
  const sharp = (await import("sharp")).default;
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (meta?.format !== "png" || !meta.width || !meta.height) throw new UserError("صورة التصميم مو صالحة.", 400);
  const file = await addFile({ userId, chatId, bytes, name: `artwork-${p.id}`, role: "artwork", width: meta.width, height: meta.height, meta: { prompt: p.artwork, aspect: p.aspect, kind: p.kind, textMode: "baked", textPlan: p.layers, refs: p.refs, ...(p.place?.length ? { place: p.place } : {}), ...(p.picture ? { picture: p.picture } : {}), ...(p.art ? { art: p.art } : {}), maker: "code", claudeCode: { rounds: Math.round(Number(b.rounds) || 0), scores: b.scores ?? null } } });
  const design: Design = { ...base, artwork: file.id, width: meta.width, height: meta.height, textMode: "baked", layers: [], state: "ready", ...(p.art ? { art: p.art } : {}) };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design };
  await saveChat(userId, chatId, { messages, pending: null });
  return { chatId, design, usd: 0 };
}
