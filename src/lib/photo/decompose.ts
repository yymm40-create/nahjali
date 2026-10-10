// «فكّك عناصر الصورة» — a flat picture (a poster, a card, a product shot, a thumbnail) read as the pieces it is MADE
// of, and each piece the person picks lifted out as its own layer: a picture or a logo becomes a cut-out with a
// transparent background, and WORDS BECOME REAL TEXT (the site's own Arabic fonts), so they are retyped, recoloured
// and moved instead of being pixels. What is lifted out is also wiped from the base, so moving an element does not
// leave its twin underneath. The person chooses which pieces — nothing is lifted without being asked for.
//
// How it is done here (the same idea as the «Layer Decomposition» tools, with this site's own providers): Claude reads
// the picture and lists its pieces with their places, their words and an English name for each; then SAM 3 (on fal,
// the same account the editor's «ماسك ذكي» uses) draws the exact outline of every picked piece, sharp cuts it out and
// patches the hole it left. Server only; the reading needs ANTHROPIC_API_KEY and the cutting FAL_KEY.

import { randomUUID } from "crypto";
import sharp from "sharp";
import { UserError } from "@/lib/api";
import { refundCoins, reserveCoins, settleCoins } from "@/lib/coins";
import { callClaudeJson, claudeCost, isLeader } from "@/lib/film/anthropic";
import { falFile, falReady, falRun } from "@/lib/jawad/server/providers/fal";
import { PHOTO } from "@config/photo";
import { addFile, fileBytes, type PhotoFile } from "./files";
import { getProject, saveProject } from "./projects";
import { readDoc, type Op } from "./doc";
import { FILL_USD, RETEXT_USD, predictFill, renderWords, repairReady } from "./repair";
import { fontIds } from "./persona";

/** What one piece of a flat picture is. */
export type PieceKind = "text" | "picture" | "logo" | "shape";

export interface Piece {
  /** short id inside this reading («p1») */
  id: string;
  kind: PieceKind;
  /** what the person reads in the list («العنوان», «صورة المنتج») */
  name: string;
  /** an English noun phrase for the outline finder («the red sports car», «the circular logo») */
  what: string;
  /** where it sits, as percentages of the picture (x and y are its CENTRE) */
  box: { x: number; y: number; w: number; h: number };
  /** the words themselves, when it is text (they become a real text layer) */
  text?: string;
  /** its main colour as #rrggbb (a text layer's colour) */
  color?: string;
  align?: "right" | "center" | "left";
}

/** The reading of a picture: its pieces, back to front, and what the reading cost. */
export interface Reading {
  pieces: Piece[];
  usd: number;
}

/** What one picked piece costs us at the outline finder (the person pays it with the site's margin). */
export const PIECE_USD = 0.02;
/** At most this many pieces in one reading, and in one cut. */
export const MAX_PIECES = 12;
/** The side the picture is read at (a bigger one costs tokens and changes nothing in the reading). */
const READ_SIDE = 1400;

export const decomposeReady = () => falReady();

const SYSTEM = `You read a FLAT, FINISHED picture (a poster, an invitation, a card, a product shot, a thumbnail, a social post) and list the SEPARATE PIECES it is made of, so an editor can lift each one out as its own layer.

Rules:
- List only pieces a person would want to move, retype or replace on their own: each block of WORDS (a headline, a line of body text, a price, a name, a date — one piece per block that is read as one, never one piece per letter or word), each PICTURE or photographed subject, each LOGO or badge, and a decorative SHAPE only when it carries meaning (a coloured bar behind a title, a frame). Never the background itself, never a gradient, never noise.
- Order them BACK TO FRONT: what sits behind first, what sits on top last.
- "box" is where the piece sits as PERCENTAGES of the whole picture, and x/y are its CENTRE: x and y 0–100, w and h 1–100. Be tight around the piece, not around its region.
- "kind": "text" for words, "picture" for a photograph or an illustration, "logo" for a mark or a badge, "shape" for a meaningful block of colour.
- For TEXT: "text" is the words EXACTLY as they are written in the picture (keep the language, the diacritics and the line breaks as \\n), "color" its main colour as #rrggbb, "align" how the block is aligned ("right" for Arabic unless it is clearly centred).
- For everything else: "what" is a SHORT ENGLISH NOUN PHRASE that names that one thing in the picture ("the red sports car", "the man in a white robe", "the circular gold logo") — it is given to an outline finder, so it must name the thing, not its place.
- "name" is two or three ARABIC words the person will read in a list.
- At most ${MAX_PIECES} pieces. If the picture is a single photograph with nothing laid over it, return the subject alone (or no pieces at all).`;

const SCHEMA = {
  type: "object",
  required: ["pieces"],
  additionalProperties: false,
  properties: {
    pieces: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "name", "what", "x", "y", "w", "h"],
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["text", "picture", "logo", "shape"] },
          name: { type: "string", description: "اسم عربي قصير يقرؤه العميل" },
          what: { type: "string", description: "English noun phrase naming this one thing (empty for text)" },
          x: { type: "number", description: "centre x, 0-100" },
          y: { type: "number", description: "centre y, 0-100" },
          w: { type: "number", description: "width, 1-100" },
          h: { type: "number", description: "height, 1-100" },
          text: { type: "string", description: "the words exactly as written (text only, else empty)" },
          color: { type: "string", description: "#rrggbb (text only, else empty)" },
          align: { type: "string", enum: ["right", "center", "left", ""] },
        },
      },
    },
  },
} as const;

type Raw = { pieces: { kind: PieceKind; name: string; what: string; x: number; y: number; w: number; h: number; text?: string; color?: string; align?: string }[] };

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toUpperCase() : "");

/** Claude's reading, checked: sane boxes, words kept, an English name for everything that must be cut out. */
export function readPieces(raw: unknown): Piece[] {
  const given = (raw as Raw | null)?.pieces;
  const list = (Array.isArray(given) ? given : []).slice(0, MAX_PIECES);
  const out: Piece[] = [];
  for (const [i, p] of list.entries()) {
    const kind: PieceKind = p.kind === "text" || p.kind === "picture" || p.kind === "logo" || p.kind === "shape" ? p.kind : "picture";
    const text = typeof p.text === "string" ? p.text.replace(/\r/g, "").slice(0, 600).trim() : "";
    const what = typeof p.what === "string" ? p.what.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    // a word piece with no words, or a picture piece with nothing to find, cannot be lifted out
    if (kind === "text" ? !text : !what) continue;
    const w = clamp(p.w, 1, 100, 20);
    const h = clamp(p.h, 1, 100, 20);
    out.push({
      id: `p${i + 1}`,
      kind,
      name: (typeof p.name === "string" ? p.name.trim().slice(0, 40) : "") || (kind === "text" ? "كلام" : "عنصر"),
      what,
      box: { x: clamp(p.x, 0, 100, 50), y: clamp(p.y, 0, 100, 50), w, h },
      ...(text ? { text } : {}),
      ...(hex(p.color) ? { color: hex(p.color) } : {}),
      ...(p.align === "right" || p.align === "center" || p.align === "left" ? { align: p.align } : {}),
    });
  }
  return out;
}

/** The commands that put one piece on the project: words become real text, a picture becomes a layer of its own. */
export function pieceOps(piece: Piece, fileId: string | null, font: string): Op[] {
  if (piece.kind === "text") {
    // the size of a text layer is a percentage of the canvas's height, and a block of N lines is that much shorter
    const lines = Math.max(1, (piece.text ?? "").split("\n").length);
    return [
      {
        op: "add_text",
        text: piece.text ?? "",
        font,
        size: Math.max(1.2, Math.min(30, Math.round((piece.box.h / lines) * 0.82 * 10) / 10)),
        color: piece.color || "#FFFFFF",
        effect: "none",
        x: piece.box.x,
        y: piece.box.y,
        w: Math.max(10, Math.min(100, Math.round(piece.box.w * 1.1))),
        align: piece.align ?? "right",
      } as Op,
    ];
  }
  if (!fileId) return [];
  return [{ op: "add_image", file: fileId, x: piece.box.x, y: piece.box.y, w: Math.max(2, Math.min(200, piece.box.w)) } as Op];
}

/** A soft-edged white mask of a box, used both to cut a piece out and to wipe the hole it left. */
async function boxMask(W: number, H: number, box: Piece["box"], feather: number): Promise<Buffer> {
  const w = Math.max(2, Math.round((box.w / 100) * W));
  const h = Math.max(2, Math.round((box.h / 100) * H));
  const x = Math.round((box.x / 100) * W - w / 2);
  const y = Math.round((box.y / 100) * H - h / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(Math.min(w, h) * 0.04)}" fill="#fff"/></svg>`;
  const flat = await sharp(Buffer.from(svg)).png().toBuffer();
  return feather > 0 ? sharp(flat).blur(feather).png().toBuffer() : flat;
}

/** SAM 3's outline of one thing in the picture, as a white-on-black mask the size of the picture (null when it found nothing). */
async function outline(pngDataUrl: string, what: string, W: number, H: number): Promise<Buffer | null> {
  const out = await falRun<{ masks?: { url?: string }[] }>(
    "fal-ai/sam-3/image",
    { image_url: pngDataUrl, prompt: what, apply_mask: false, return_multiple_masks: false, output_format: "png" },
    120_000,
  ).catch(() => null);
  const url = out?.masks?.[0]?.url;
  if (!url) return null;
  const bytes = await falFile(url).catch(() => null);
  if (!bytes) return null;
  return sharp(bytes).resize(W, H, { fit: "fill" }).greyscale().png().toBuffer();
}

/** One piece's own picture: the original seen through its outline (or its box), trimmed to what is left. */
async function cutPiece(base: Buffer, mask: Buffer, W: number, H: number): Promise<Buffer> {
  const alpha = await sharp(mask).resize(W, H, { fit: "fill" }).greyscale().toBuffer();
  const cut = await sharp(base).ensureAlpha().joinChannel(alpha, { raw: undefined }).png().toBuffer();
  return sharp(cut).trim({ threshold: 1 }).png().toBuffer();
}

/** The union of the lifted pieces' masks, soft at its edges (what has to be filled in again). */
async function union(masks: Buffer[], W: number, H: number): Promise<Buffer> {
  let out = await sharp(masks[0]).resize(W, H, { fit: "fill" }).greyscale().toBuffer();
  for (const m of masks.slice(1)) {
    const next = await sharp(m).resize(W, H, { fit: "fill" }).greyscale().toBuffer();
    out = await sharp(out).composite([{ input: next, blend: "lighten" }]).greyscale().toBuffer();
  }
  return sharp(out).blur(Math.max(0.5, Math.round(Math.min(W, H) * 0.004))).greyscale().toBuffer();
}

/** The base with the lifted pieces wiped out: their places are covered by a soft, blurred copy of the picture. */
async function patched(base: Buffer, masks: Buffer[], W: number, H: number): Promise<Buffer> {
  if (!masks.length) return base;
  let union = await sharp(masks[0]).resize(W, H, { fit: "fill" }).greyscale().toBuffer();
  for (const m of masks.slice(1)) {
    const next = await sharp(m).resize(W, H, { fit: "fill" }).greyscale().toBuffer();
    union = await sharp(union).composite([{ input: next, blend: "lighten" }]).greyscale().toBuffer();
  }
  union = await sharp(union).blur(Math.max(2, Math.round(Math.min(W, H) * 0.01))).greyscale().toBuffer();
  // what fills the hole: the picture itself, blurred far past any detail, so the patch keeps the place's own colours
  const fill = await sharp(base).blur(Math.max(8, Math.round(Math.min(W, H) * 0.06))).ensureAlpha().joinChannel(union, { raw: undefined }).png().toBuffer();
  return sharp(base).composite([{ input: fill }]).png().toBuffer();
}

/** The picture a reading is made from: the project's base (or a file of it), as a PNG at the reading size. */
async function pictureOf(userId: string, fileId: string): Promise<{ bytes: Buffer; W: number; H: number; b64: string }> {
  const f = await fileBytes(userId, fileId);
  if (!f) throw new UserError("ما لقينا هذي الصورة في المشروع.", 404);
  const img = sharp(f.bytes, { failOn: "none" }).rotate().resize({ width: READ_SIDE, height: READ_SIDE, fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
  const small = await sharp(data).resize({ width: PHOTO.previewSide, height: PHOTO.previewSide, fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  return { bytes: data, W: info.width, H: info.height, b64: small.toString("base64") };
}

/** STEP ONE: what is this picture made of? (Claude reads it; nothing is changed and nothing is cut.) */
export async function lookInside(userId: string, email: string | null, projectId: string, fileId?: string | null): Promise<Reading> {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("تفكيك العناصر غير مفعّل على الخادم.", 503);
  const project = await getProject(userId, projectId);
  if (!project) throw new UserError("ما لقينا هذا المشروع.", 404);
  const doc = readDoc(project.doc);
  const id = (typeof fileId === "string" && fileId) || doc.base?.fileId;
  if (!id) throw new UserError("أضف صورة أساسية أول، بعدها أفكّك عناصرها.", 409);
  const pic = await pictureOf(userId, id);
  const r = await callClaudeJson<Raw>({
    system: SYSTEM,
    turns: [{ role: "user", content: [{ type: "text", text: "اقرأ هذي الصورة وعدّد عناصرها من الخلف للأمام." }, { type: "image64", data: pic.b64, mediaType: "image/jpeg" }] }],
    schema: SCHEMA,
    maxTokens: 4000,
    effort: "medium",
    leader: isLeader(email),
  });
  const usd = claudeCost(r.usage);
  await saveProject(userId, project.id, { addUsd: usd }).catch(() => null);
  return { pieces: readPieces(r.data), usd: Math.round(usd * 10000) / 10000 };
}

/** How the place a piece left is filled again. */
export type Fill = "predict" | "blur" | "none";

export interface Cut {
  ops: Op[];
  files: PhotoFile[];
  /** the new base, when the holes were filled */
  base: PhotoFile | null;
  /** the pieces that could not be found in the picture */
  missed: string[];
  /** how the holes were really filled (a prediction that could not run falls back to the soft patch) */
  filled: Fill;
  usd: number;
}

/**
 * STEP TWO: lift the picked pieces out. Words become real text layers; a picture, a logo or a shape is cut out along
 * SAM 3's outline (its box when the outline cannot be found) and added as its own layer, and the base is replaced by
 * one with their places wiped, so nothing shows twice.
 */
export async function liftOut(userId: string, email: string | null, projectId: string, pieces: Piece[], wipe: Fill = "predict"): Promise<Cut> {
  const picked = pieces.slice(0, MAX_PIECES);
  if (!picked.length) throw new UserError("اختر عنصرًا واحدًا على الأقل.", 400);
  const project = await getProject(userId, projectId);
  if (!project) throw new UserError("ما لقينا هذا المشروع.", 404);
  const doc = readDoc(project.doc);
  const baseId = doc.base?.fileId;
  if (!baseId) throw new UserError("ما فيه صورة أساسية أفكّكها.", 409);
  const cutOut = picked.filter((p) => p.kind !== "text");
  if (cutOut.length && !falReady()) throw new UserError("قص العناصر من الصورة غير مفعّل على الخادم حاليًا (FAL_KEY).", 503);

  const wantPredict = wipe === "predict" && repairReady();
  const usd = cutOut.length * PIECE_USD + (wantPredict ? FILL_USD : 0);
  const job = `piece-${randomUUID()}`;
  if (usd > 0) await reserveCoins({ id: userId, email }, job, usd, "فكّ عناصر الصورة");
  try {
    const pic = await pictureOf(userId, baseId);
    const dataUrl = `data:image/png;base64,${pic.bytes.toString("base64")}`;
    const font = fontIds()[0] ?? "readex";
    const ops: Op[] = [];
    const files: PhotoFile[] = [];
    const masks: Buffer[] = [];
    const missed: string[] = [];

    for (const piece of picked) {
      if (piece.kind === "text") {
        // words need no provider: they come back as real, editable text
        ops.push(...pieceOps(piece, null, font));
        masks.push(await boxMask(pic.W, pic.H, piece.box, Math.max(2, Math.round(Math.min(pic.W, pic.H) * 0.006))));
        continue;
      }
      const found = await outline(dataUrl, piece.what, pic.W, pic.H);
      if (!found) missed.push(piece.name);
      const mask = found ?? (await boxMask(pic.W, pic.H, piece.box, 0));
      const bytes = await cutPiece(pic.bytes, mask, pic.W, pic.H);
      const file = await addFile({ userId, projectId: project.id, bytes, name: piece.name, role: "layer", meta: { piece: piece.id, what: piece.what, from: baseId, outline: !!found } });
      files.push(file);
      ops.push(...pieceOps(piece, file.id, font));
      masks.push(mask);
    }

    let base: PhotoFile | null = null;
    let filled: Fill = "none";
    if (wipe !== "none" && masks.length) {
      const holes = await union(masks, pic.W, pic.H);
      // «يتوقّع الجزء الناقص»: GPT Image 2 draws what was BEHIND the piece, and only the hole's own pixels are taken
      // from its answer — so the rest of the picture is the original, byte for byte
      const predicted = wantPredict ? await predictFill(pic.bytes, holes, pic.W, pic.H) : null;
      filled = predicted ? "predict" : "blur";
      const clean = predicted ?? (await patched(pic.bytes, masks, pic.W, pic.H));
      base = await addFile({ userId, projectId: project.id, bytes: clean, name: predicted ? "الخلفية مكمّلة" : "الخلفية بعد التفكيك", role: "base", meta: { from: baseId, wiped: picked.map((p) => p.id), fill: filled } });
      // the base changes FIRST, so the lifted pieces land over the cleaned picture
      ops.unshift({ op: "use_as_base", file: base.id } as Op);
    }
    const spent = usd - (wantPredict && filled !== "predict" ? FILL_USD : 0);
    if (usd > 0) await settleCoins(job, Math.max(0, spent));
    return { ops, files, base, missed, filled, usd: Math.round(Math.max(0, spent) * 10000) / 10000 };
  } catch (e) {
    if (usd > 0) await refundCoins(job);
    throw e;
  }
}

export interface Retyped {
  ops: Op[];
  /** the new words as a transparent picture, in the original's own typeface */
  file: PhotoFile | null;
  /** the base with the old words taken out */
  base: PhotoFile | null;
  filled: Fill;
  usd: number;
}

/**
 * «شنو تبي تغيّر؟» — a word that is PART of the picture (not a layer) is retyped: the old words are wiped from the
 * base (the prediction fills what was behind them) and the NEW words are drawn in the same typeface, weight, colour
 * and effects (a crop of the original rides along as the reference), then placed in the very same spot. The person's
 * words are drawn as they wrote them, in their own language — nothing is translated or re-spelled.
 */
export async function retype(userId: string, email: string | null, projectId: string, piece: Piece, words: string, fill: Fill = "predict"): Promise<Retyped> {
  const text = words.replace(/\r/g, "").slice(0, 300).trim();
  if (!text) throw new UserError("اكتب الكلام الجديد.", 400);
  if (!repairReady()) throw new UserError("إعادة كتابة الكلام داخل الصورة غير مفعّلة على الخادم (OPENAI_API_KEY).", 503);
  const project = await getProject(userId, projectId);
  if (!project) throw new UserError("ما لقينا هذا المشروع.", 404);
  const doc = readDoc(project.doc);
  const baseId = doc.base?.fileId;
  if (!baseId) throw new UserError("ما فيه صورة أساسية.", 409);

  const usd = RETEXT_USD + (fill === "predict" ? FILL_USD : 0);
  const job = `retext-${randomUUID()}`;
  await reserveCoins({ id: userId, email }, job, usd, "إعادة كتابة كلام في الصورة");
  try {
    const pic = await pictureOf(userId, baseId);
    // the original words, cropped a little wider than their box, are the typeface's reference
    const pad = 0.04;
    const box = piece.box;
    const left = Math.max(0, Math.round(((box.x - box.w / 2) / 100 - pad) * pic.W));
    const top = Math.max(0, Math.round(((box.y - box.h / 2) / 100 - pad) * pic.H));
    const right = Math.min(pic.W, Math.round(((box.x + box.w / 2) / 100 + pad) * pic.W));
    const bottom = Math.min(pic.H, Math.round(((box.y + box.h / 2) / 100 + pad) * pic.H));
    const crop = await sharp(pic.bytes).extract({ left, top, width: Math.max(8, right - left), height: Math.max(8, bottom - top) }).png().toBuffer();

    const drawn = await renderWords(crop, text);
    if (!drawn) throw new UserError("ما قدرت أرسم الكلام الجديد بنفس الخط؛ جرّب مرة ثانية.", 502);
    const file = await addFile({ userId, projectId: project.id, bytes: drawn, name: `كلام: ${text.slice(0, 24)}`, role: "layer", meta: { retype: piece.id, words: text, from: baseId } });

    const ops: Op[] = [];
    let base: PhotoFile | null = null;
    let filled: Fill = "none";
    if (fill !== "none") {
      const mask = await boxMask(pic.W, pic.H, box, Math.max(2, Math.round(Math.min(pic.W, pic.H) * 0.006)));
      const holes = await union([mask], pic.W, pic.H);
      const predicted = fill === "predict" ? await predictFill(pic.bytes, holes, pic.W, pic.H) : null;
      filled = predicted ? "predict" : "blur";
      const clean = predicted ?? (await patched(pic.bytes, [mask], pic.W, pic.H));
      base = await addFile({ userId, projectId: project.id, bytes: clean, name: "الخلفية بعد شيل الكلام", role: "base", meta: { from: baseId, retype: piece.id, fill: filled } });
      ops.push({ op: "use_as_base", file: base.id } as Op);
    }
    ops.push({ op: "add_image", file: file.id, x: box.x, y: box.y, w: Math.max(2, Math.min(200, box.w)) } as Op);
    const spent = usd - (fill === "predict" && filled !== "predict" ? FILL_USD : 0);
    await settleCoins(job, Math.max(0, spent));
    return { ops, file, base, filled, usd: Math.round(Math.max(0, spent) * 10000) / 10000 };
  } catch (e) {
    await refundCoins(job);
    throw e;
  }
}
