import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { make } from "@/lib/photo/make";
import { getProject, saveProject } from "@/lib/photo/projects";
import type { JawadAsk } from "@/lib/photo/chat";
import { drawsRealWoman } from "@config/jawad/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «زهراء فوتو ماستر» · what «زهراء» asked of جواد (a picture, a cut-out, an edit), made at once. Body: { projectId, ask }.
 * Returns { file: {id, name, width, height}, free, coins }: the picture is a file of the project; the page places it.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const b = (await req.json().catch(() => ({}))) as { projectId?: unknown; ask?: Record<string, unknown> };
  if (typeof b.projectId !== "string" || !UUID.test(b.projectId)) throw new UserError("مشروع غير صحيح.", 400);
  const a = b.ask ?? {};
  const kind = a.kind === "cutout" || a.kind === "edit" || a.kind === "generate" ? a.kind : null;
  if (!kind) throw new UserError("طلب غير معروف.", 400);
  const prompt = String(a.prompt ?? "").trim().slice(0, 4000);
  if (kind !== "cutout" && !prompt) throw new UserError("اكتب وصف الصورة.", 400);
  if (kind !== "cutout" && drawsRealWoman(prompt)) throw new UserError("الوصف يرسم امرأة واقعية، وهذا ممنوع في الموقع.", 400);
  const ask: JawadAsk = { kind, prompt, aspect: String(a.aspect || "auto").slice(0, 8), target: a.target === "base" || a.target === "file" ? a.target : "layer", source: String(a.source || "base").slice(0, 60) };
  const made = await make(user.id, user.email ?? null, b.projectId, ask, new URL(req.url).origin);
  const project = await getProject(user.id, b.projectId);
  if (project) {
    const text = kind === "cutout" ? "✂️ جواد جهّز العنصر مقصوصًا بخلفية شفافة." : kind === "edit" ? "🖌️ جواد جهّز النسخة المعدّلة." : "🎨 جواد جهّز الصورة.";
    await saveProject(user.id, project.id, { messages: [...project.messages, { role: "assistant" as const, text, note: true }].slice(-200) });
  }
  return NextResponse.json({ file: { id: made.file.id, name: made.file.name, width: made.file.width, height: made.file.height }, free: made.free, coins: made.coins, ask });
});
