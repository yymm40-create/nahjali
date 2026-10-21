// «🎬 مختبر الموشن» · the pictures SHOWN INSIDE a piece that the person does not have (a product, an object, a person or
// character, an illustration seen as a picture): حيدرة names them in the plan and جواد makes each one with GPT Image 2 —
// WITHOUT any writing in it — at the studio's price; it lands in the project's library and the scene draws it like any
// picture the person gave. The motion and its whole foundation (backgrounds, worlds, type, shapes, transitions) are
// always code (the owner's order): GPT Image 2 only paints those pictures.

import { randomUUID } from "node:crypto";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { deskImage, DeskError, type DeskWho } from "@/lib/content/jawad";
import { NO_TEXT_RULE } from "@config/designer";
import { addFile } from "@/lib/editor/generate";
import { stillOpen, type EditorProject } from "@/lib/editor/server";
import type { Who } from "@/lib/editor/pricing";

const ASPECTS = new Set(["1:1", "9:16", "16:9", "4:5", "3:4", "4:3", "2:3", "3:2"]);
const text = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** `{ prompt, name, aspect }` → one picture made by GPT Image 2 for the piece, in the library (the receipt says what it cost). */
export async function labPicture(p: EditorProject, who: Who, b: Record<string, unknown>, origin: string) {
  stillOpen(p);
  const prompt = text(b.prompt, 3000);
  if (prompt.length < 8) throw new UserError("وصف الصورة ناقص.", 400);
  const name = text(b.name, 80) || "صورة للموشن";
  const aspect = ASPECTS.has(String(b.aspect)) ? String(b.aspect) : p.timeline.height > p.timeline.width ? "9:16" : "16:9";
  const desk: DeskWho = { id: who.id, email: who.email, owner: who.owner || (await unlimitedFor(who.email)), origin };
  // the same request (the page sends it again after a cut line) is the same job: never paid twice
  const key = `lab-${text(b.key, 60).replace(/[^A-Za-z0-9_-]/g, "") || randomUUID().replace(/-/g, "").slice(0, 24)}`;
  try {
    const r = await deskImage(desk, { key, kind: "image", generatorId: "openai-gpt-image-2", prompt: `${prompt}\n\n${NO_TEXT_RULE}`, aspect, quality: "high", resolution: "std" });
    const ext = r.out.mime.includes("png") ? "png" : r.out.mime.includes("webp") ? "webp" : "jpg";
    const asset = await addFile(p, { bytes: r.bytes, mime: r.out.mime, ext, kind: "image", name, width: r.out.width, height: r.out.height, meta: { fromLab: true, prompt: prompt.slice(0, 600) } });
    return { asset, coins: r.receipt.coins ?? 0, free: Boolean(r.receipt.free) };
  } catch (e) {
    if (e instanceof DeskError) throw new UserError(e.message, 502);
    throw e;
  }
}
