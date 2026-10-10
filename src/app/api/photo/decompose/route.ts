import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requirePhotoUser } from "@/lib/photo/access";
import { decomposeReady, liftOut, lookInside, readPieces, retype, MAX_PIECES, type Fill, type Piece } from "@/lib/photo/decompose";
import { repairReady } from "@/lib/photo/repair";
import { getProject, saveProject } from "@/lib/photo/projects";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/** One piece as the page sends it back (its box may be nested), flattened for the reader's own checks. */
const onePiece = (p: unknown) => {
  const o = (p ?? {}) as Record<string, unknown>;
  const box = (o.box ?? {}) as Record<string, unknown>;
  return { ...o, x: box.x ?? o.x, y: box.y ?? o.y, w: box.w ?? o.w, h: box.h ?? o.h };
};

/**
 * «زهراء فوتو ماستر» · «🧩 فكّك عناصر الصورة» in two steps:
 * - { projectId, step: "read", file? } → { pieces, ready }: what the picture is made of (nothing changed).
 * - { projectId, step: "lift", pieces: [...], fill? } → { ops, files, base, missed, filled }: the picked pieces lifted
 *   out as their own layers (words as real text), and a base whose holes are FILLED BY PREDICTION (GPT Image 2 draws
 *   what was behind, and only the hole's pixels are taken from its answer), or by a soft patch.
 * - { projectId, step: "retext", piece, text, fill? } → { ops, file, base }: a word that is part of the picture is
 *   retyped — the old words wiped, the new ones drawn in the SAME typeface and put in the same place.
 * The page applies the ops either way.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requirePhotoUser();
  const b = (await req.json().catch(() => ({}))) as { projectId?: unknown; step?: unknown; file?: unknown; pieces?: unknown; fill?: unknown; piece?: unknown; text?: unknown };
  if (typeof b.projectId !== "string" || !UUID.test(b.projectId)) throw new UserError("مشروع غير صحيح.", 400);

  const fill: Fill = b.fill === "blur" || b.fill === "none" ? b.fill : "predict";

  if (b.step === "read") {
    const r = await lookInside(user.id, user.email ?? null, b.projectId, typeof b.file === "string" ? b.file : null);
    return NextResponse.json({ pieces: r.pieces, usd: r.usd, ready: decomposeReady(), predicts: repairReady() });
  }

  if (b.step === "retext") {
    const [piece] = readPieces({ pieces: [onePiece(b.piece)] });
    if (!piece) throw new UserError("ما وصلني العنصر اللي أعيد كتابته.", 400);
    const r = await retype(user.id, user.email ?? null, b.projectId, piece, String(b.text ?? ""), fill);
    const project = await getProject(user.id, b.projectId);
    if (project) {
      await saveProject(user.id, project.id, { messages: [...project.messages, { role: "assistant" as const, text: `✏️ غيّرت الكلام في «${piece.name}» إلى «${String(b.text ?? "").slice(0, 60)}» بنفس الخط${r.filled === "predict" ? "، وكمّلت الخلفية مكانه" : ""}.`, note: true }].slice(-200) }).catch(() => null);
    }
    return NextResponse.json({ ops: r.ops, file: r.file, base: r.base, filled: r.filled, usd: r.usd });
  }

  if (b.step !== "lift") throw new UserError("خطوة غير معروفة.", 400);
  // the page sends back the pieces of the reading the person ticked; they are checked here again, as any input is
  const picked: Piece[] = readPieces({ pieces: Array.isArray(b.pieces) ? b.pieces.slice(0, MAX_PIECES).map(onePiece) : [] });
  if (!picked.length) throw new UserError("اختر عنصرًا واحدًا على الأقل.", 400);
  const cut = await liftOut(user.id, user.email ?? null, b.projectId, picked, fill);

  const project = await getProject(user.id, b.projectId);
  if (project) {
    const names = picked.map((p) => p.name).join("، ");
    const text = `🧩 فكّكت العناصر: ${names}${cut.missed.length ? ` — ما لقيت ${cut.missed.join("، ")} في الصورة، فحطّيتها بحدود مستطيلها.` : ""} كل عنصر صار طبقة بروحه، والكلام صار نصًا حقيقيًا تعدّله.`;
    await saveProject(user.id, project.id, { messages: [...project.messages, { role: "assistant" as const, text, note: true }].slice(-200) }).catch(() => null);
  }
  return NextResponse.json({
    filled: cut.filled,
    ops: cut.ops,
    files: cut.files.map((f) => ({ id: f.id, name: f.name, role: f.role, width: f.width, height: f.height })),
    base: cut.base ? { id: cut.base.id, name: cut.base.name, role: cut.base.role, width: cut.base.width, height: cut.base.height } : null,
    missed: cut.missed,
    usd: cut.usd,
  });
});
