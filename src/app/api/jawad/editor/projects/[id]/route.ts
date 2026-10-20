import { checkUpscale, startUpscale } from "@/lib/editor/upscale";
import { labMatte } from "@/lib/editor/matte";
import { readLabSource, saveLabSource } from "@/lib/editor/lab-source";
import { NextResponse } from "next/server";
import { handOff, loadChat } from "@/lib/editor/chat";
import { claudeCharged } from "@/lib/editor/pricing";
import { approveFixesConfirm, approveFixesUrl, linkForFix } from "@/lib/editor/smart";
import { handle, UserError } from "@/lib/api";
import { requireEditorApiUser } from "@/lib/jawad/server/access";
import { can } from "@/lib/access";
import type { Command } from "@/lib/editor/commands";
import { importSfx } from "@/lib/editor/sfx-library";
import { keyCheck } from "@/lib/editor/key-check";
import { labChat, labPlan, labReview, labWrite } from "@/lib/editor/scene/director";
import { labResponse } from "@/lib/editor/scene/response";
import { codeEditReview, codeEditWrite, codeGradeReview, codeGradeWrite } from "@/lib/editor/claude-code";
import {
  addLocalAsset,
  assetViewsById,
  stillOpen,
  confirmAsset,
  deleteAsset,
  deleteProject,
  history,
  importAssets,
  markExported,
  projectState,
  requireEditorProject,
  editorTeamSeries,
  runCommands,
  saveTimeline,
  signAssetUpload,
  signExportUpload,
  partUrls,
  uploadedParts,
  completeUpload,
} from "@/lib/editor/server";
import { align, signSpeechUpload, transcribe, voiceIn, voiceOut } from "@/lib/editor/speech";
import { voiceprint } from "@/lib/editor/voiceprint";
import { makeHook, makeMusic, makeSfx, separate } from "@/lib/editor/generate";
import { assist, gradeCheck } from "@/lib/editor/assistant";
import { diagnose } from "@/lib/editor/diagnose";
import { isAdmin } from "@config/site";
import { planSeedanceExtend, startMake } from "@/lib/editor/make-any";
import { smartMask } from "@/lib/editor/smart-mask";

// listening to a long clip can take a while
// حيدرة's long answers (a big timeline, a few correction rounds) may run as long as the platform allows
export const maxDuration = 800;

type Ctx = { params: Promise<{ id: string }> };
const noStore = { headers: { "Cache-Control": "no-store" } };

/** «حيدرة كت» · a project: its timeline, version and library (with short-lived links). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { user } = await requireEditorApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  return NextResponse.json(await projectState(p), noStore);
});

/** Saves the timeline: `{ timeline, version, label, title? }` → `{ ok, version }` (409-style `ok: false` with the newer one). */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { user } = await requireEditorApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(await saveTimeline(p, { ...b, actor: "user" }));
});

const AI_ACTIONS = new Set(["lab_plan", "lab_write", "lab_review", "lab_matte", "lab_chat", "upscale", "transcribe", "align", "voice_in", "voice_out", "voiceprint", "make_hook", "make_sfx", "make_music", "separate", "make_start", "extend_plan", "smart_mask", "diagnose", "grade_check", "assistant", "handoff"]);

/** `{ action, … }`: upload (sign/confirm), add_local (the desktop program's files), delete_asset, import, export_sign, exported, commands, history. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { user, owner } = await requireEditorApiUser();
  const p = await requireEditorProject((await ctx.params).id, user.id);
  // a team series' edit: what is made in it is paid from its «نقود الفريق الذكي»
  const who = { id: user.id, email: user.email, owner, team: (await editorTeamSeries(p))?.id ?? null };
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // the AI («حيدرة» and all it makes) is its own right on the dashboard's list
  if (AI_ACTIONS.has(String(b.action)) && !(await can(user.email, "editor_ai"))) throw new UserError("حيدرة (الذكاء الاصطناعي) مقفل لحسابك حاليًا.", 403);
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
    case "add_local":
      return NextResponse.json({ asset: await addLocalAsset(p, b) });
    case "confirm_upload":
      return NextResponse.json({ asset: await confirmAsset(p, b) });
    case "delete_asset":
      await deleteAsset(p, b.id);
      return NextResponse.json({ ok: true });
    case "import":
      return NextResponse.json({ assets: await importAssets(p, b) });
    // «مكتبة المؤثرات»: ready sound effects put in the project (free; the shared files are only pointed at)
    case "import_sfx":
      stillOpen(p);
      return NextResponse.json({ assets: await assetViewsById(p.id, await importSfx(p, b)) });
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
      return NextResponse.json(await transcribe(p, who, b));
    case "align":
      return NextResponse.json(await align(p, who, b));
    // talking with حيدرة: what was said → text, and the reply → sound
    case "voice_in":
      return NextResponse.json(await voiceIn(p, who, b));
    case "voice_out":
      return NextResponse.json(await voiceOut(p, who, b));
    // «بصمة صوتك» from the edit: a recording of the person's own voice → a voice of their library
    case "voiceprint":
      return NextResponse.json({ voice: await voiceprint(p, user, owner, b) });
    case "make_hook":
      return NextResponse.json({ asset: await makeHook(p, who, b) });
    case "make_sfx":
      return NextResponse.json({ asset: await makeSfx(p, who, b) });
    case "make_music":
      return NextResponse.json({ asset: await makeMusic(p, who, b) });
    case "separate":
      return NextResponse.json(await separate(p, who, b));
    // «رفع الدقة»: a video sent to be upscaled (720p/1080p → 4K) and asked about until its new file is ready
    case "upscale":
      return NextResponse.json(await startUpscale(p, who, b));
    case "upscale_check":
      return NextResponse.json(await checkUpscale(p, b));
    // «اصنع لي…» from حيدرة: a priced plan started as a JAWAD AI job
    case "make_start":
      return NextResponse.json(await startMake(user, owner, b, new URL(req.url).origin, who.team));
    // Seedance only: continue a selected clip from its first/last boundary frame.
    case "extend_plan":
      return NextResponse.json(await planSeedanceExtend(who, b));
    // «ماسك ذكي»: what to select, found in a few moments of a clip
    case "smart_mask":
      return NextResponse.json(await smartMask(p, who, b));
    case "diagnose":
      // the site's owner only (a free guest is «unlimited» too, but never sees the site's insides)
      return NextResponse.json(await diagnose(p, { id: user.id, email: user.email, owner: isAdmin(user.email) }, b));
    // حيدرة checks a colour change it made (pictures and scopes), and corrects it until it is right
    case "grade_check":
      return NextResponse.json(await gradeCheck(p, who, b, new URL(req.url).origin));
    // «🤖 حيدرة يضبط الكي»: he looks at the frame, the matte and the result, and corrects the key's settings
    case "key_check":
      return NextResponse.json(await keyCheck(p, who, b));
    // «🎬 مختبر الموشن»: حيدرة plans, writes and reviews a motion piece made in code (the browser renders it)
    case "lab_source_save":
      return NextResponse.json(await saveLabSource(p, b));
    case "lab_source_get":
      return NextResponse.json(await readLabSource(p, b), noStore);
    case "lab_matte":
      return NextResponse.json(await labMatte(p, who, b), noStore);
    // the lab's Claude steps read against the request's own clock (the platform ends it at maxDuration)
    case "lab_plan":
      b.__at = Date.now();
      return b.stream ? labResponse(() => labPlan(p, who, b)) : NextResponse.json(await labPlan(p, who, b));
    case "lab_chat":
      b.__at = Date.now();
      return b.stream ? labResponse(() => labChat(p, who, b)) : NextResponse.json(await labChat(p, who, b));
    case "lab_write":
      b.__at = Date.now();
      return b.stream ? labResponse(() => labWrite(p, who, b)) : NextResponse.json(await labWrite(p, who, b));
    case "lab_review":
      b.__at = Date.now();
      return b.stream ? labResponse(() => labReview(p, who, b)) : NextResponse.json(await labReview(p, who, b));
    // «Claude Code»: حيدرة executes cuts, arrangement and colour as programs the browser runs (write · fix · review)
    case "code_edit_write":
      return NextResponse.json(await codeEditWrite(p, who, b));
    case "code_edit_review":
      return NextResponse.json(await codeEditReview(p, who, b));
    case "code_grade_write":
      return NextResponse.json(await codeGradeWrite(p, who, b));
    case "code_grade_review":
      return NextResponse.json(await codeGradeReview(p, who, b));
    case "assistant":
      return NextResponse.json(await claudeCharged(who, b.model, "محادثة حيدرة", () => assist(p, who, b, new URL(req.url).origin), (r) => r.usd, { said: String(b.message ?? ""), reply: (r) => r.reply }));
    case "fix_link":
      return NextResponse.json({ asset: await linkForFix(p, user, b) });
    // حيدرة approved the smart edits of a film video: the exported version goes to سجاد (upload, then confirm)
    case "fix_approve_url":
      return NextResponse.json(await approveFixesUrl(p, user, b));
    case "fix_approve_confirm":
      return NextResponse.json(await approveFixesConfirm(p, user, b));
    case "chat":
      return NextResponse.json(await loadChat(p), noStore);
    case "handoff":
      return NextResponse.json(await handOff(p, who, b));
    case "history":
      return NextResponse.json({ history: await history(p.id) }, noStore);
  }
  throw new UserError("طلب غير معروف.", 400);
});

/** Deletes the project and every file it uploaded. */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { user } = await requireEditorApiUser();
  await deleteProject(await requireEditorProject((await ctx.params).id, user.id));
  return NextResponse.json({ ok: true });
});
