import { NextResponse } from "next/server";
import { handOff, loadChat } from "@/lib/editor/chat";
import { linkForFix } from "@/lib/editor/smart";
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
  partUrls,
  uploadedParts,
  completeUpload,
} from "@/lib/editor/server";
import { align, signSpeechUpload, transcribe } from "@/lib/editor/speech";
import { makeHook, makeMusic, makeSfx, separate } from "@/lib/editor/generate";
import { assist } from "@/lib/editor/assistant";

// listening to a long clip can take a while
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };
const noStore = { headers: { "Cache-Control": "no-store" } };

/** «حيدر كات» · a project: its timeline, version and library (with short-lived links). */
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
  const { user, owner } = await requireStudentApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "sign_upload":
      return NextResponse.json(await signAssetUpload(p, b));
    // large files, in parts
    case "upload_part_urls":
      return NextResponse.json(await partUrls(p, b));
    case "upload_parts":
      return NextResponse.json(await uploadedParts(p, b), noStore);
    case "upload_complete":
      return NextResponse.json(await completeUpload(p, b));
    case "confirm_upload":
      return NextResponse.json({ asset: await confirmAsset(p, b) });
    case "delete_asset":
      await deleteAsset(p, b.id);
      return NextResponse.json({ ok: true });
    case "import":
      return NextResponse.json({ assets: await importAssets(p, b) });
    case "export_sign":
      return NextResponse.json(await signExportUpload(p, b));
    case "exported":
      return NextResponse.json(await markExported(p, b));
    case "commands": {
      const cmds = Array.isArray(b.commands) ? (b.commands.slice(0, 200) as Command[]) : [];
      if (!cmds.length) throw new UserError("ما فيه أوامر.", 400);
      return NextResponse.json(await runCommands(p, cmds, "user"));
    }
    case "speech_sign":
      return NextResponse.json(await signSpeechUpload(p, b));
    case "transcribe":
      return NextResponse.json(await transcribe(p, { id: user.id, email: user.email, owner }, b));
    case "align":
      return NextResponse.json(await align(p, { id: user.id, email: user.email, owner }, b));
    case "make_hook":
      return NextResponse.json({ asset: await makeHook(p, { id: user.id, email: user.email, owner }, b) });
    case "make_sfx":
      return NextResponse.json({ asset: await makeSfx(p, { id: user.id, email: user.email, owner }, b) });
    case "make_music":
      return NextResponse.json({ asset: await makeMusic(p, { id: user.id, email: user.email, owner }, b) });
    case "separate":
      return NextResponse.json(await separate(p, { id: user.id, email: user.email, owner }, b));
    case "assistant":
      return NextResponse.json(await assist(p, { id: user.id, email: user.email, owner }, b));
    case "fix_link":
      return NextResponse.json({ asset: await linkForFix(p, user, b) });
    case "chat":
      return NextResponse.json(await loadChat(p), noStore);
    case "handoff":
      return NextResponse.json(await handOff(p, { id: user.id, email: user.email, owner }, b));
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
