import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { withClaude } from "@/lib/film/claude-model";
import { latestScriptJob, scriptAction, type ScriptAction } from "@/lib/film/script";

// The assistant's reply is written in the background (after()), within this route's time limit
export const maxDuration = 800;

/** User actions with the screenwriter: start · approve · answers · revise · retry. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id, "screenwriter");
  const body = (await req.json().catch(() => ({}))) as ScriptAction;
  const jobId = await withClaude((body as { model?: unknown }).model, () => scriptAction(project, user, body));
  return NextResponse.json({ jobId });
});

/** Polled while the screenwriter is writing. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  await getOwnedProject(id, user.id);
  const job = await latestScriptJob(id);
  return NextResponse.json(
    { status: job?.status ?? null, error: job?.status === "failed" ? job.error : null },
    { headers: { "Cache-Control": "no-store" } },
  );
});
