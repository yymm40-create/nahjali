import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import type { Command } from "@/lib/editor/commands";
import {
  confirmAsset,
  deleteAsset,
  deleteProject,
  history,
  importAssets,
  markExported,
  projectState,
  requireEditorProject,
  runCommands,
  saveTimeline,
  signAssetUpload,
  signExportUpload,
} from "@/lib/editor/server";

type Ctx = { params: Promise<{ id: string }> };
const noStore = { headers: { "Cache-Control": "no-store" } };

/** «الممنتج الذكي» · a project: its timeline, version and library (with short-lived links). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { user } = await requireStudentApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  return NextResponse.json(await projectState(p), noStore);
});

/** Saves the timeline: `{ timeline, version, label, title? }` → `{ ok, version }` (409-style `ok: false` with the newer one). */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { user } = await requireStudentApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(await saveTimeline(p, { ...b, actor: "user" }));
});

/** `{ action, … }`: upload (sign/confirm), delete_asset, import, export_sign, exported, commands, history. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { user } = await requireStudentApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "sign_upload":
      return NextResponse.json(await signAssetUpload(p, b));
    case "confirm_upload":
      return NextResponse.json({ asset: await confirmAsset(p, b) });
    case "delete_asset":
      await deleteAsset(p, b.id);
      return NextResponse.json({ ok: true });
    case "import":
      return NextResponse.json({ assets: await importAssets(p, b) });
    case "export_sign":
      return NextResponse.json(await signExportUpload(p));
    case "exported":
      return NextResponse.json(await markExported(p, b));
    case "commands": {
      const cmds = Array.isArray(b.commands) ? (b.commands.slice(0, 200) as Command[]) : [];
      if (!cmds.length) throw new UserError("ما فيه أوامر.", 400);
      return NextResponse.json(await runCommands(p, cmds, "user"));
    }
    case "history":
      return NextResponse.json({ history: await history(p.id) }, noStore);
  }
  throw new UserError("طلب غير معروف.", 400);
});

/** Deletes the project and every file it uploaded. */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { user } = await requireStudentApiUser();
  await deleteProject(await requireEditorProject((await ctx.params).id, user.id));
  return NextResponse.json({ ok: true });
});
