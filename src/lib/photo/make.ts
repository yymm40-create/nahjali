// «زهراء فوتو ماستر» — what she asks of جواد: a new picture from a description, a cut-out of a subject (its background
// removed, a transparent picture), or an edit of the base picture by a description. She never calls a provider herself:
// the request is handed to جواد's desk (src/lib/content/jawad.ts), who makes it as an ordinary JAWAD AI job (so a picture is
// also in «أعمالي», follows the site's prices and refunds on failure), and executes it at once. The result is kept as a file
// of the project; the page places it where she asked. Server only.

import { randomUUID } from "crypto";
import sharp from "sharp";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { refundCoins, reserveCoins, settleCoins } from "@/lib/coins";
import { deskImage, deskReference, DeskError, type DeskWho } from "@/lib/content/jawad";
import { checkSlide } from "@/lib/content/verify";
import { falFile, falReady, falRun, falUrl } from "@/lib/jawad/server/providers/fal";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { storage } from "@/lib/storage";
import { NO_TEXT_RULE } from "@config/designer";
import { readDoc } from "./doc";
import { addFile, fileBytes, type PhotoFile } from "./files";
import { getProject } from "./projects";
import type { JawadAsk } from "./chat";

const CUTOUT_MODEL = "fal-ai/birefnet/v2";
const MAX_ATTEMPTS = 2;
/** What a cut-out costs us (the provider's price); the person pays it with the site's margin, unless they pay nothing. */
export const CUTOUT_USD = 0.02;

export const cutoutReady = () => falReady();

const rules = (edit: boolean) =>
  [
    edit ? "Edit the attached picture (given as reference ref1) exactly as described, keeping everything that is not mentioned the same." : "A picture for a graphic project. Any typography will be added later as separate text layers.",
    NO_TEXT_RULE,
    "No real women or girls anywhere in the picture.",
  ].join("\n\n");

export interface Made {
  file: PhotoFile;
  usd: number;
  free: boolean;
  coins: number;
}

/** Runs one request of «زهراء» for a project of the person's. */
export async function make(userId: string, email: string | null, projectId: string, ask: JawadAsk, origin: string): Promise<Made> {
  const project = await getProject(userId, projectId);
  if (!project) throw new UserError("ما لقينا هذا المشروع.", 404);
  const doc = readDoc(project.doc);
  if (ask.kind === "cutout") {
    const job = `cut-${randomUUID()}`;
    await reserveCoins({ id: userId, email }, job, CUTOUT_USD, "قص الخلفية");
    try {
      const made = await cutout(userId, project.id, doc.base?.fileId ?? null, doc.layers.find((l) => l.id === ask.source && l.kind === "image"), ask);
      await settleCoins(job, CUTOUT_USD);
      return made;
    } catch (e) {
      await refundCoins(job);
      throw e;
    }
  }

  const who: DeskWho = { id: userId, email, owner: await unlimitedFor(email), origin };
  const refs: { uploadId: string; name: string }[] = [];
  if (ask.kind === "edit") {
    const baseId = doc.base?.fileId;
    const base = baseId ? await fileBytes(userId, baseId) : null;
    if (!base) throw new UserError("ما فيه صورة أساسية أعدّلها.", 409);
    refs.push({ uploadId: await deskReference(userId, base.bytes, `photo-${projectId.slice(0, 6)}`), name: "ref1" });
  }
  const aspect = ask.aspect === "auto" ? (doc.width / doc.height > 1.3 ? "16:9" : doc.width / doc.height < 0.75 ? "2:3" : "1:1") : ask.aspect;
  let fix = "";
  let usd = 0;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const r = await deskImage(who, { key: `p-${randomUUID().replace(/-/g, "")}`, kind: "image", prompt: [rules(ask.kind === "edit"), ask.prompt, fix].filter(Boolean).join("\n\n"), aspect, resolution: "hi", quality: "high", refs });
      const check = await checkSlide(r.bytes, "");
      usd += check.usd;
      const bad = check.checked && (check.problems.length > 0 || check.woman === "violation");
      if (bad && check.woman === "violation") {
        if (attempt < MAX_ATTEMPTS) {
          fix = "The previous attempt drew a woman, which is forbidden: draw it again with no women or girls at all.";
          continue;
        }
        throw new DeskError("الصورة خالفت قاعدة الموقع (امرأة واقعية) بعد المحاولتين فاستُبعدت.", "woman violation");
      }
      if (bad && attempt < MAX_ATTEMPTS) {
        fix = `The previous attempt had these problems — fix every one: ${check.problems.join("; ")}. Remove every trace of letters, words or writing.`;
        continue;
      }
      const file = await addFile({ userId, projectId: project.id, bytes: r.bytes, name: ask.kind === "edit" ? "تعديل جواد" : "من جواد", role: "made", meta: { prompt: ask.prompt, kind: ask.kind, desk: r.receipt } });
      return { file, usd, free: r.receipt.free, coins: r.receipt.coins };
    } catch (e) {
      lastErr = e;
      break;
    }
  }
  if (lastErr instanceof DeskError) throw new UserError(lastErr.reason, 502);
  console.error("photo make", lastErr);
  throw new UserError("تعذّر على جواد الصنع الحين؛ جرّب مرة ثانية.", 502);
}

/** The subject of a picture cut out on a transparent background (the base picture, or a picture layer). */
async function cutout(userId: string, projectId: string, baseId: string | null, layer: { kind: string; fileId?: string } | undefined, ask: JawadAsk): Promise<Made> {
  if (!falReady()) throw new UserError("قص الخلفية غير مفعّل على الخادم حاليًا (FAL_KEY).", 503);
  const fileId = ask.source === "base" || !layer ? baseId : (layer as { fileId?: string }).fileId ?? null;
  const src = fileId ? await fileBytes(userId, fileId) : null;
  if (!src) throw new UserError("ما لقينا الصورة اللي أقصّ منها.", 404);
  const { data: signed } = await storage.from("jawad").createSignedUrl(src.path, 1800);
  if (!signed?.signedUrl) throw new UserError("ما قدرنا نجهّز الصورة للقص.", 500);
  let cut: Buffer;
  try {
    const out = await falRun<Record<string, unknown>>(CUTOUT_MODEL, { image_url: signed.signedUrl, model: "General Use (Heavy)", operating_resolution: "1024x1024", output_format: "png", refine_foreground: true });
    const url = falUrl(out, "image");
    if (!url) throw new ProviderError("rejected", "ما رجع القص بنتيجة.", `keys ${Object.keys(out).join(",")}`);
    cut = await falFile(url);
  } catch (e) {
    throw new UserError(e instanceof ProviderError ? e.userMessage : "تعذّر قص الخلفية الحين؛ جرّب مرة ثانية.", 502);
  }
  // trimmed to the subject's own box, so its size and place mean the subject
  const trimmed = await sharp(cut).trim().png().toBuffer();
  const file = await addFile({ userId, projectId, bytes: trimmed, name: "عنصر مقصوص", role: "made", meta: { from: fileId, cutout: true } });
  return { file, usd: 0, free: true, coins: 0 };
}
