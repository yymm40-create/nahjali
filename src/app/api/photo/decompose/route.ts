import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { decomposeReady, liftOut, lookInside, readPieces, MAX_PIECES, type Piece } from "@/lib/photo/decompose";
import { getProject, saveProject } from "@/lib/photo/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «زهراء فوتو ماستر» · «🧩 فكّك عناصر الصورة» in two steps:
 * - { projectId, step: "read", file? } → { pieces, ready }: what the picture is made of (nothing changed).
 * - { projectId, step: "lift", pieces: [...], wipe? } → { ops, files, base, missed }: the picked pieces lifted out as
 *   their own layers (words as real text), and a base with their places wiped. The page applies the ops.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const b = (await req.json().catch(() => ({}))) as { projectId?: unknown; step?: unknown; file?: unknown; pieces?: unknown; wipe?: unknown };
  if (typeof b.projectId !== "string" || !UUID.test(b.projectId)) throw new UserError("مشروع غير صحيح.", 400);

  if (b.step === "read") {
    const r = await lookInside(user.id, user.email ?? null, b.projectId, typeof b.file === "string" ? b.file : null);
    return NextResponse.json({ pieces: r.pieces, usd: r.usd, ready: decomposeReady() });
  }

  if (b.step !== "lift") throw new UserError("خطوة غير معروفة.", 400);
  // the page sends back the pieces of the reading the person ticked; they are checked here again, as any input is
  const picked: Piece[] = readPieces({ pieces: Array.isArray(b.pieces) ? b.pieces.slice(0, MAX_PIECES).map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const box = (o.box ?? {}) as Record<string, unknown>;
    return { ...o, x: box.x ?? o.x, y: box.y ?? o.y, w: box.w ?? o.w, h: box.h ?? o.h };
  }) : [] });
  if (!picked.length) throw new UserError("اختر عنصرًا واحدًا على الأقل.", 400);
  const cut = await liftOut(user.id, user.email ?? null, b.projectId, picked, b.wipe !== false);

  const project = await getProject(user.id, b.projectId);
  if (project) {
    const names = picked.map((p) => p.name).join("، ");
    const text = `🧩 فكّكت العناصر: ${names}${cut.missed.length ? ` — ما لقيت ${cut.missed.join("، ")} في الصورة، فحطّيتها بحدود مستطيلها.` : ""} كل عنصر صار طبقة بروحه، والكلام صار نصًا حقيقيًا تعدّله.`;
    await saveProject(user.id, project.id, { messages: [...project.messages, { role: "assistant" as const, text, note: true }].slice(-200) }).catch(() => null);
  }
  return NextResponse.json({
    ops: cut.ops,
    files: cut.files.map((f) => ({ id: f.id, name: f.name, role: f.role, width: f.width, height: f.height })),
    base: cut.base ? { id: cut.base.id, name: cut.base.name, role: cut.base.role, width: cut.base.width, height: cut.base.height } : null,
    missed: cut.missed,
    usd: cut.usd,
  });
});
