// «المصمم الذكي» — the produce step: «حيدرا ماكس» designs EVERY design in code, in the person's browser (the exact
// Arabic writing in the site's fonts, the shapes, the layout, the person's own photos placed unchanged), looks at it and
// rewrites it until it passes. When the design needs a painted picture (a scene, a realistic background, an
// illustration), جواد paints it FIRST with GPT Image 2 — WITHOUT any writing in it — and «حيدرا ماكس» places it and
// sets every word over it. Nothing else draws a design (the owner's order: حيدرا ماكس + GPT Image 2, no third way).
// Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { deskImage, deskReference, DeskError, type DeskWho } from "@/lib/content/jawad";
import { BAKED_TEXT_RULE, NO_TEXT_RULE, type DesignerTextMode } from "@config/designer";
import { getChat, saveChat, type Chat, type PendingDesign } from "./chats";
import { drawnPng } from "@/lib/jawad/server/uploads";
import { addFile, addFileFromOutput, attachmentsOf, fileBytes, fileLinks, uploadLinks } from "./files";
import { readLayers, type Design } from "./layers";
import { editOf, photoKeys, readProgram, type DesignEdit } from "./program";
import { findContentFont, FONT_PIN, fontBlock } from "@config/content-fonts";
import { darkToLight, findPalette } from "@config/content-palettes";
import { baseUrl, isMajlisMaker, readOrder, templateById, viewUrl, type MajlisMaker, type MajlisOrder } from "@config/designer-majlis";
import { GPT_IMAGE_26_ID } from "@config/jawad/generators";
import { isAdmin } from "@config/site";
import { MAJLIS_FONTS, majlisGptPrompt, majlisPhotos, majlisProgram } from "./majlis";
import { cutPeople } from "./majlis-cut";

/** GPT Image 2 for the artwork: the high tier (the design is exported at this size), high quality. */
export const IMAGE_TIER = "hi" as const;
export const IMAGE_QUALITY = "high" as const;

/** The full prompt of the artwork: what كاظم wrote, how references and typography are used, and any retry fix. */
export function artworkPrompt(o: { prompt: string; refs: number; textMode?: DesignerTextMode; layers?: Design["layers"]; fix?: string }): string {
  const mode = o.textMode ?? "layers";
  const text = (o.layers ?? []).filter((l) => l.kind === "text");
  const typography = text.map((l, i) => `${i + 1}. exact text: "${l.text.replace(/\n/g, " / ")}"; role ${l.role}; font ${l.font}; position around (${Math.round(l.x)}%, ${Math.round(l.y)}%); width ${Math.round(l.w)}%; colour ${l.color}; ${l.align} aligned; visual size ${l.size}% of canvas height`).join("\n");
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

/**
 * The design being drawn could not be made (the picture GPT Image 2 paints, «حيدرا ماكس» in the page, or a split):
 * it is kept as failed, so a reload shows «أعد المحاولة» instead of a design drawing for ever. The order waiting to
 * be drawn stays, so the retry draws the same design.
 */
export async function failDesign(userId: string, chatId: string, error: string, detail?: string): Promise<void> {
  const chat = await getChat(userId, chatId);
  if (!chat) return;
  const at = chat.messages.map((m) => !!m.design).lastIndexOf(true);
  const d = chat.messages[at]?.design;
  if (at < 0 || !d || d.state === "ready") return;
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design: { ...d, state: "failed", error: error.slice(0, 300) || "تعذّر الرسم.", ...(detail ? { detail: detail.slice(0, 400) } : {}) } };
  await saveChat(userId, chatId, { messages });
}

/** Puts a failed design back to be drawn again (the same prompt and layers). */
export async function retry(userId: string, chat: Chat): Promise<void> {
  const at = chat.messages.map((m) => !!m.design).lastIndexOf(true);
  const d = chat.messages[at]?.design;
  if (at < 0 || !d) throw new UserError("ما فيه تصميم نعيد رسمه.", 409);
  const prompt = await lastPrompt(chat, at);
  if (!prompt) throw new UserError("ما لقينا توجيه الرسم لإعادته.", 409);
  // a change to a design drawn before stays a change (a patch on that design's program) when it is drawn again
  const base = chat.pending?.at === at ? chat.pending.base : undefined;
  const look = chat.pending?.at === at ? { fontId: chat.pending.fontId, paletteId: chat.pending.paletteId } : { fontId: prompt.fontId, paletteId: prompt.paletteId };
  // a ready majlis design stays the design the person picked (its template, details, photos and background choice)
  const pending: PendingDesign = { id: d.id, at, kind: prompt.kind, aspect: d.aspect, textMode: "baked", artwork: prompt.artwork, refs: prompt.refs, layers: prompt.layers, keep: null, maker: "code", ...(prompt.place?.length ? { place: prompt.place } : {}), ...(d.art ? { art: d.art } : prompt.picture ? { picture: prompt.picture } : {}), ...(base ? { base } : {}), ...(look.fontId ? { fontId: look.fontId } : {}), ...(look.paletteId ? { paletteId: look.paletteId } : {}), ...(prompt.majlis ? { majlis: prompt.majlis, ...(prompt.majlisMaker ? { majlisMaker: prompt.majlisMaker } : {}) } : {}) };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design: { ...d, state: "drawing", error: undefined, detail: undefined, flag: undefined } };
  await saveChat(userId, chat.id, { messages, pending });
}

/** The prompt a design was (or is to be) drawn with: the pending order, else what its artwork's record keeps. */
async function lastPrompt(chat: Chat, at: number): Promise<{ artwork: string; refs: string[]; kind: PendingDesign["kind"]; textMode: PendingDesign["textMode"]; layers: PendingDesign["layers"]; maker?: PendingDesign["maker"]; place?: string[]; picture?: string; fontId?: string; paletteId?: string; majlis?: MajlisOrder; majlisMaker?: MajlisMaker } | null> {
  if (chat.pending && chat.pending.at === at && chat.pending.artwork) return { artwork: chat.pending.artwork, refs: chat.pending.refs, kind: chat.pending.kind, textMode: chat.pending.textMode, layers: chat.pending.layers, maker: chat.pending.maker, place: chat.pending.place, picture: chat.pending.picture, majlis: chat.pending.majlis, majlisMaker: chat.pending.majlisMaker };
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
    ...(typeof meta.fontId === "string" && meta.fontId ? { fontId: meta.fontId } : {}),
    ...(typeof meta.paletteId === "string" && meta.paletteId ? { paletteId: meta.paletteId } : {}),
    ...(readOrder(meta.majlis) ? { majlis: readOrder(meta.majlis)!, ...(isMajlisMaker(meta.maker) ? { majlisMaker: meta.maker } : {}) } : {}),
  };
}

// ───────── «حيدرا ماكس»: the design drawn in code in the person's browser ─────────

/**
 * The font and colours the person picked, as «صانع المحتوى» hands them to «حيدرا ماكس»: the font pinned (every word is
 * set in its real file) and a palette of the 100 replacing the direction's colours. Empty when nothing was picked.
 */
export function pickedLook(p: { fontId?: string; paletteId?: string }): string {
  const font = p.fontId ? findContentFont(p.fontId) : null;
  const pal = p.paletteId ? findPalette(p.paletteId) : null;
  const colours = pal ? (() => {
    const [dark, d2, l2, light] = darkToLight(pal);
    return `CLIENT COLOURS («${pal.name}», picked from the palette gallery; they replace the direction's colours, keep everything else of the design): use only these four, by their codes: ${dark} · ${d2} · ${l2} · ${light} (darkest to lightest). The darkest or the lightest is the background, its opposite the writing, the other two the main colour and the highlight, always with contrast that reads.`;
  })() : "";
  return [font ? `${FONT_PIN(font.id)} ${fontBlock(font).replace("Keep it in every slide.", "Every word of the design is set in it.")}` : "", colours].filter(Boolean).join("\n");
}

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
  if (p.majlis) return majlisBrief(userId, chat, o.origin ?? "", isAdmin(o.email));
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
  // the photos to put in the design go into the scene as they are, always in the same order (photo1… — a change patches
  // a program that names them by number); the other pictures are references for the look
  const artUrl = art ? ((await fileLinks(userId, chatId)).get(art) ?? null) : null;
  const keys = photoKeys({ art: artUrl ? art : null, refs: images.map((a) => a.id), place: p.place }).filter((k) => k === art || links.has(k));
  const photos = keys.map((k) => (k === art ? artUrl! : links.get(k)!));
  const urls = [...links].filter(([id]) => !place.has(id)).map(([, url]) => url);
  const prompt = artworkPrompt({ prompt: p.artwork, refs: urls.length, textMode: "baked", layers: p.layers });
  const look = pickedLook(p);
  const brief = { prompt: `${artUrl ? `${prompt}\n\n${ART_NOTE}` : prompt}${look ? `\n\n${look}` : ""}`, aspect: p.aspect, refs: urls.slice(0, 4), photos, picture: Boolean(artUrl), style: look };
  // a change to a design drawn before: its program, to patch
  const edit = p.base ? await editFor(userId, chat, p, keys) : null;
  return edit ? { ...brief, edit } : brief;
}

/**
 * A ready majlis design made by GPT Image 2.6 (Sunburst / Flare) or GPT Image 2: the picked design (its empty version)
 * is rebuilt with the people as references and the exact words, and becomes the pending design's artwork.
 */
export async function majlisGpt(userId: string, chatId: string, o: { email?: string | null; origin: string }): Promise<Produced> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  const maker = p?.majlisMaker;
  if (!p?.majlis || !maker || maker === "code") throw new UserError("ما فيه تصميم ينتظر الرسم في هذي المحادثة.", 409);
  const t = templateById(p.majlis.templateId);
  if (!t) throw new UserError("ما لقينا التصميم المختار.", 409);
  const at = Math.min(p.at, chat.messages.length - 1);
  const base = chat.messages[at]?.design;
  if (!base) throw new UserError("ما لقينا التصميم في المحادثة.", 409);
  try {
    const who: DeskWho = { id: userId, email: o.email, owner: await unlimitedFor(o.email), origin: o.origin };
    const edit = p.majlisEdit;
    let prompt: string, refs: { uploadId: string; name: string }[];
    if (edit) {
      // a change: the picture made before is ref1, and only what the person asked changes
      const prev = await fileBytes(userId, edit.prev);
      if (!prev) throw new UserError("ما لقينا التصميم اللي تبي تعدّله.", 409);
      const ref1 = await deskReference(userId, prev, `majlis-edit-${t.id}`);
      refs = [{ uploadId: ref1, name: "ref1" }];
      prompt = `Edit the attached design ref1. Change ONLY this, exactly as asked (the person's words, in Arabic): «${edit.said}». Keep everything else EXACTLY as it is in ref1: the layout, the people and their faces, every other word, the colours, the light. Every Arabic word stays written exactly, letters joined right to left; no new words unless asked.`;
    } else {
      const res = await fetch(o.origin + baseUrl(t.id));
      if (!res.ok) throw new UserError("ما قدرنا نفتح التصميم المختار.", 502);
      const ref1 = await deskReference(userId, Buffer.from(await res.arrayBuffer()), `majlis-${t.id}`);
      refs = [{ uploadId: ref1, name: "ref1" }, ...p.majlis.people.map((x, i) => ({ uploadId: x.photo, name: `ref${i + 2}` }))];
      prompt = majlisGptPrompt(t, p.majlis);
    }
    const r = await deskImage(who, { key: `mj-${randomUUID().replace(/-/g, "")}`, kind: "image", generatorId: maker === "gpt2" ? "openai-gpt-image-2" : GPT_IMAGE_26_ID, ...(maker === "gpt2" ? {} : { variant: maker }), prompt, aspect: "2:3", resolution: IMAGE_TIER, quality: IMAGE_QUALITY, refs });
    const file = await addFileFromOutput({ userId, chatId, out: r.out, name: `artwork-${p.id}`, meta: { prompt: p.artwork, aspect: t.aspect, kind: p.kind, textMode: "baked", refs: p.refs, maker, majlis: p.majlis, desk: r.receipt } });
    const design: Design = { ...base, artwork: file.id, width: r.out.width ?? base.width, height: r.out.height ?? base.height, textMode: "baked", layers: [], state: "ready", error: undefined, detail: undefined, majlis: t.id };
    const messages = [...chat.messages];
    messages[at] = { ...messages[at], design };
    await saveChat(userId, chatId, { messages, pending: null });
    return { chatId, design, usd: 0 };
  } catch (e) {
    if (e instanceof DeskError) {
      console.error("designer majlis gpt", e.detail);
      throw new UserError(e.reason, 502);
    }
    throw e;
  }
}

/**
 * A ready majlis design: the template's own program («حيدرا ماكس»'s engine draws it exactly as picked), its empty
 * design, its frames' mask and the person's photos to place, and the picked design to compare with.
 */
async function majlisBrief(userId: string, chat: Chat, origin: string, owner: boolean) {
  let p = chat.pending!;
  // the person chose to remove the photos' background: «حيدرا ماكس» cuts each person out first (once)
  // (when the server's cut can't be reached, «حيدرا ماكس» cuts them in the page instead: `cutHere`)
  let cutHere = false;
  if (p.majlis!.cut && !p.majlis!.cutDone) {
    try {
      const cut = await cutPeople(userId, p.majlis!.people.map((x) => x.photo), owner);
      const majlis = { ...p.majlis!, cutDone: true, people: p.majlis!.people.map((x, i) => ({ ...x, photo: cut[i] })) };
      p = { ...p, refs: cut, place: cut, majlis };
      await saveChat(userId, chat.id, { messages: chat.messages, pending: p });
    } catch (e) {
      if (!(e instanceof UserError) || e.status === 409) throw e;
      console.error("majlis cut on the server failed; the page cuts", e.message);
      cutHere = true;
    }
  }
  const o = p.majlis!;
  const t = templateById(o.templateId);
  if (!t) throw new UserError("ما لقينا التصميم المختار.", 409);
  const ids = [...o.people.map((x) => x.photo), ...(o.logo ? [o.logo] : [])].filter(Boolean);
  const links = await uploadLinks(userId, ids);
  const ph = majlisPhotos(t, o, (id) => links.get(id) ?? null, origin);
  if (ph.ids.people.some((x) => !x)) throw new UserError("ما قدرنا نفتح صور الأشخاص؛ ارفعها مرة ثانية.", 409);
  // a change: the program drawn before is patched by «حيدرا ماكس» (the same photos, in the same order)
  const code = p.majlisEdit?.code ?? majlisProgram(t, o, ph.ids);
  // each person's photo: cut around his face for a frame, or (a design with people) put with his face where the man's was
  const faces = t.slots.map((s, i) => ({ photo: Number(ph.ids.people[i]!.slice(5)), aspect: (s.r[2] * t.size[0]) / (s.r[3] * t.size[1]), cut: o.cut, ...(s.shape === "person" && s.face ? { place: s.face } : {}) }));
  return { prompt: p.artwork, aspect: t.aspect, refs: [origin + viewUrl(t.id)], photos: ph.urls, picture: false, style: "", template: { code, fonts: { head: MAJLIS_FONTS.head, body: MAJLIS_FONTS.body }, extra: { lalezar: MAJLIS_FONTS.lalezar }, faces, ...(cutHere ? { cutHere: true } : {}), ...(p.majlisEdit?.code ? { change: { said: p.majlisEdit.said, brief: p.artwork, fonts: p.majlisEdit.fonts ?? { head: MAJLIS_FONTS.head, body: MAJLIS_FONTS.body } } } : {}) } };
}

/**
 * A change to a design drawn before: that design's program (kept in its artwork's record) to patch, with the brief it
 * was drawn from and the person's words; null when it has no program kept or draws another frame (drawn from zero).
 */
async function editFor(userId: string, chat: Chat, p: PendingDesign, keys: string[]): Promise<DesignEdit | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().from("designer_files").select("meta").eq("id", p.base!).eq("user_id", userId).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  if (!meta.program) return null;
  // the brief as it was drawn (its exact writing included), and what the person said to change it
  const brief = typeof meta.prompt === "string" ? artworkPrompt({ prompt: meta.prompt, refs: 0, textMode: "baked", layers: readLayers(meta.textPlan) }) : "";
  const said = chat.messages.slice(0, p.at).findLast((m) => m.role === "user")?.text ?? "";
  const edit = editOf({ program: meta.program, aspect: p.aspect, brief, said, photos: keys });
  // another font picked: the writing is set again from zero in it (a patch keeps the program's own fonts)
  if (edit && p.fontId && edit.fonts.head !== p.fontId) return null;
  return edit;
}

/** The PNG the page drew from «حيدرا ماكس»'s program becomes the pending design's artwork. */
export async function produceFromCode(userId: string, chatId: string, b: { png?: unknown; pngUpload?: unknown; rounds?: unknown; scores?: unknown; program?: unknown; edited?: unknown }): Promise<Produced> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new Error("chat not found");
  const p = chat.pending;
  if (!p) throw new UserError("ما فيه تصميم ينتظر حيدرا ماكس في هذي المحادثة.", 409);
  const at = Math.min(p.at, chat.messages.length - 1);
  const base = chat.messages[at]?.design;
  if (!base) throw new UserError("ما لقينا التصميم في المحادثة.", 409);
  const bytes = await drawnPng(userId, b, 16_000_000);
  if (!bytes) throw new UserError("ما وصلت صورة التصميم.", 400);
  const sharp = (await import("sharp")).default;
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (meta?.format !== "png" || !meta.width || !meta.height) throw new UserError("صورة التصميم مو صالحة.", 400);
  // the program it was drawn from is kept with it (when it drew exactly this picture), so a change patches it later
  const program = readProgram(b.program, [meta.width, meta.height]);
  const file = await addFile({ userId, chatId, bytes, name: `artwork-${p.id}`, role: "artwork", width: meta.width, height: meta.height, meta: { prompt: p.artwork, aspect: p.aspect, kind: p.kind, textMode: "baked", textPlan: p.layers, refs: p.refs, ...(p.place?.length ? { place: p.place } : {}), ...(p.picture ? { picture: p.picture } : {}), ...(p.art ? { art: p.art } : {}), ...(p.fontId ? { fontId: p.fontId } : {}), ...(p.paletteId ? { paletteId: p.paletteId } : {}), ...(p.majlis ? { majlis: p.majlis } : {}), maker: "code", claudeCode: { rounds: Math.round(Number(b.rounds) || 0), scores: b.scores ?? null, ...(b.edited === true ? { edited: true } : {}) }, ...(program ? { program: { ...program, photos: photoKeys(p) } } : {}) } });
  const design: Design = { ...base, artwork: file.id, width: meta.width, height: meta.height, textMode: "baked", layers: [], state: "ready", ...(p.art ? { art: p.art } : {}), ...(p.majlis ? { majlis: p.majlis.templateId } : {}) };
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design };
  await saveChat(userId, chatId, { messages, pending: null });
  return { chatId, design, usd: 0 };
}
