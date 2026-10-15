// «Claude Code» in the image studio — keeping the picture the person's browser rendered from Claude's program as an
// ordinary work of «أعمالي» (a job that is done the moment it is saved, with its one output), so it can be downloaded,
// reused, edited or sent on like any picture. Its price was the Claude usage, taken turn by turn; the job costs nothing
// more. Server only.

import sharp from "sharp";
import { UserError } from "@/lib/api";
import { can, permForGenerator } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatorById } from "@config/jawad/generators";
import { pictureSize } from "@/lib/claude-code/picture-rubric";
import { loadRuntime, JAWAD_BUCKET } from "./runtime";
import { storage } from "@/lib/storage";
import { jobViews } from "./works";
import type { JobRow } from "./jobs";

const db = () => createAdminClient();
export const CLAUDE_CODE_GENERATOR = "claude-code";
export const CLAUDE_CODE_NAME = "Claude Code";

/** May this person use «Claude Code» pictures? The same door as the studio's pictures. */
export async function canDraw(email: string | null | undefined) {
  const def = generatorById("openai-gpt-image-2");
  return Boolean(def && (await can(email, permForGenerator(def))));
}

export async function savePicture(user: { id: string; email?: string | null }, b: Record<string, unknown>) {
  if (!(await canDraw(user.email))) throw new UserError("صناعة الصور مقفلة لحسابك حاليًا.", 403);
  const key = String(b.idempotencyKey ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  const existing = await db().from("jawad_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", key).maybeSingle();
  if (existing.data) return { job: (await jobViews([existing.data as JobRow]))[0] };
  const data = typeof b.png === "string" ? b.png.replace(/^data:image\/png;base64,/, "") : "";
  if (!data || data.length > 14_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw new UserError("ما وصلت الصورة.", 400);
  const png = Buffer.from(data, "base64");
  const meta = await sharp(png).metadata().catch(() => null);
  if (meta?.format !== "png" || !meta.width || !meta.height) throw new UserError("الصورة مو صالحة.", 400);
  const [w, h] = pictureSize(b.aspect);
  if (Math.abs(meta.width / meta.height - w / h) > 0.02) throw new UserError("مقاس الصورة ما يطابق النسبة.", 400);
  const rt = await loadRuntime();
  const section = rt.sections.find((s) => s.id === b.sectionId && s.output === "image") ?? rt.sections.find((s) => s.output === "image");
  if (!section) throw new UserError("قسم الصور غير متاح.", 503);
  const prompt = String(b.prompt ?? "").slice(0, 40_000);
  const now = new Date().toISOString();
  const { data: job, error } = await db()
    .from("jawad_jobs")
    .insert({
      user_id: user.id,
      idempotency_key: key,
      section_id: section.id,
      generator_id: CLAUDE_CODE_GENERATOR,
      provider: "anthropic",
      model_id: String(b.model ?? "claude").slice(0, 80),
      mode: "code",
      output_kind: "image",
      prompt,
      inputs: { settings: { aspect: String(b.aspect ?? "1:1") }, ...(typeof b.styleId === "string" && b.styleId ? { styleId: b.styleId } : {}), claudeCode: { rounds: Math.round(Number(b.rounds) || 0), scores: b.scores ?? null } },
      refs: [],
      price_coins: 0,
      price_breakdown: [{ label: "Claude Code · حسب استخدام Claude", centi: 0 }],
      charged: false,
      charge_state: "none",
      status: "saving",
      submit_state: "accepted",
      submitted_at: now,
    })
    .select("*")
    .single();
  if (error || !job) throw new UserError("ما قدرنا نحفظ الصورة في أعمالك.", 500);
  const path = `${user.id}/outputs/${job.id}/0.png`;
  const up = await storage.from(JAWAD_BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
  if (up.error) {
    await db().from("jawad_jobs").update({ status: "failed", error_message: "ما انحفظت الصورة.", finished_at: now }).eq("id", job.id);
    throw new UserError("ما قدرنا نحفظ الصورة.", 500);
  }
  await db().from("jawad_outputs").upsert({ job_id: job.id, user_id: user.id, kind: "image", idx: 0, storage_path: path, mime: "image/png", bytes: png.length, width: meta.width, height: meta.height, duration_ms: null }, { onConflict: "job_id,idx" });
  const { data: done } = await db().from("jawad_jobs").update({ status: "succeeded", progress: 100, finished_at: new Date().toISOString() }).eq("id", job.id).select("*").single();
  return { job: (await jobViews([(done ?? job) as JobRow]))[0] };
}
