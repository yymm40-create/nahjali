// «📣 إعلان» (config/film-ad.ts): the brand's pictures and the reference ad of an ad project, on the server.
// The brand's pictures are the project's own references («مراجع» on the project page: film assets with no map item),
// each marked with what it is (meta.brand: logo / product / colors / other); the reference ad's frame sheet is one more
// such picture (meta.ad_reference). Both are copied in from the person's uploads when the ad is made (the new project
// page uploads them before there is a project), or uploaded straight to the project's «مراجع».

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { isUuid } from "@/lib/jawad/server/uploads";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { addMessage } from "./conversation";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmProject } from "./types";
import { normalizeAdPlan, readBrand, type AdPlan } from "./intake";
import { AD_BRIEF, AD_BRAND_ROLES, AD_CONVERT_NOTE, adBrandLines, adBrandRole, adSheetsNote, type AdBrandPicture, type AdBrandRole } from "@config/film-ad";

const db = () => createAdminClient();
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** The brand's pictures of a project (in the order they were given) and its reference ad's frame sheets. */
export async function projectBrand(projectId: string): Promise<{ brand: (AdBrandPicture & { assetId: string })[]; frames: string[] }> {
  const { data } = await db()
    .from("film_assets")
    .select("id,file_name,meta,status,ref_key,kind,created_at")
    .eq("project_id", projectId)
    .eq("kind", "upload")
    .eq("ref_key", "")
    .neq("status", "rejected")
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Pick<FilmAsset, "id" | "file_name" | "meta">[];
  const brand = rows.flatMap((r) => {
    const role = adBrandRole(r.meta?.brand);
    return role ? [{ role: role.id, name: String(r.file_name ?? "").replace(/^brand-[a-z]+-\d+\.\w+$/, ""), assetId: r.id }] : [];
  });
  // grouped by role (logo, product, colours, others), each group in the order given
  brand.sort((a, b) => AD_BRAND_ROLES.findIndex((r) => r.id === a.role) - AD_BRAND_ROLES.findIndex((r) => r.id === b.role));
  return { brand, frames: rows.filter((r) => r.meta?.ad_reference).map((r) => r.id) };
}

/** The brand's pictures as text with their marks (empty without any). */
export async function brandText(projectId: string) {
  return adBrandLines((await projectBrand(projectId)).brand);
}

/** One of the person's ready image uploads, copied into the project's references with what it is. */
async function copyUpload(project: FilmProject, userId: string, fileId: string, meta: Record<string, unknown>, label: string) {
  const { data: row } = await db().from("jawad_uploads").select("*").eq("id", fileId).eq("user_id", userId).maybeSingle();
  if (!row || row.kind !== "image" || row.status !== "ready" || !row.storage_path) return null;
  const mime = String(row.mime ?? "");
  const ext = EXT[mime];
  if (!ext) return null;
  const { data: blob, error: dl } = await storage.from(JAWAD_BUCKET).download(row.storage_path);
  if (dl || !blob) throw new UserError("تعذّر نسخ صور البراند للمشروع؛ جرّب مرة ثانية.", 502);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const path = `${projectDir(project)}/uploads/${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const up = await storage.from(FILM_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await db()
    .from("film_assets")
    .insert({ project_id: project.id, kind: "upload", storage_path: path, file_name: String(row.file_name ?? "").slice(0, 120) || `${label}.${ext}`, mime, bytes: bytes.length, status: "uploaded", meta })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * A new ad: the brand's pictures given on the new project page (the person's uploads) and the reference ad's frame
 * sheet become the project's references. A picture that is no longer there is skipped.
 */
export async function keepAdPictures(project: FilmProject, userId: string, brand: unknown, referenceSheetId: unknown) {
  for (const b of readBrand(brand)) await copyUpload(project, userId, b.fileId, { brand: b.role }, `brand-${b.role}`);
  if (isUuid(referenceSheetId)) await copyUpload(project, userId, String(referenceSheetId), { ad_reference: true }, "ad-reference");
}

/** A role for a picture uploaded to the project's «مراجع» of an ad (none: an ordinary reference). */
export const brandMeta = (role: unknown): Record<string, unknown> => (adBrandRole(role) ? { brand: adBrandRole(role)!.id as AdBrandRole } : {});

/**
 * The sheet map of an ad: one of the brand's pictures taken as a map item's picture, as it is (copied in as the item's
 * own upload, like «📚 من المسلسل»), so the real logo or product goes to every generation as a reference.
 */
export async function takeBrandPicture(project: FilmProject, sheetId: string, assetId: unknown) {
  if (!/^[A-Z]{3}-\d{2}$/.test(sheetId) || !isUuid(assetId)) throw new UserError("طلب غير صحيح.", 400);
  const { data: a } = await db().from("film_assets").select("id,storage_path,mime,meta,file_name,ref_key,kind").eq("id", String(assetId)).eq("project_id", project.id).maybeSingle();
  if (!a?.storage_path || a.kind !== "upload" || a.ref_key !== "" || !adBrandRole(a.meta?.brand)) throw new UserError("صورة البراند ما انلقت. ارفعها من جديد في «مراجع».", 404);
  const ext = EXT[String(a.mime ?? "")] ?? "png";
  const name = `upload-${sheetId}-${Date.now()}.${ext}`;
  const path = `${projectDir(project)}/sheets/${name}`;
  const copied = await storage.from(FILM_BUCKET).copy(a.storage_path, path);
  if (copied.error) throw new UserError("ما قدرنا ننسخ الصورة؛ جرّب مرة ثانية.", 502);
  await db().from("film_assets").update({ status: "rejected" }).eq("project_id", project.id).eq("kind", "upload").eq("ref_key", sheetId);
  const { error } = await db().from("film_assets").insert({
    project_id: project.id, kind: "upload", ref_key: sheetId, storage_path: path, file_name: name, mime: a.mime ?? "image/png", status: "uploaded", meta: { brand: a.meta.brand, brand_asset: a.id },
  });
  if (error) throw error;
}

/** The ad plan a project carries (null: not an ad). */
export function adPlanOf(project: Pick<FilmProject, "intake">): AdPlan | null {
  const intake = project.intake && typeof project.intake === "object" ? (project.intake as { ad?: unknown }) : null;
  return intake?.ad ? normalizeAdPlan(intake.ad) : null;
}

/**
 * «📣 خلّه إعلان»: a project made before (a scene or a film, before the director starts) becomes an ad — its intake
 * carries the ad plan (kept, or empty), with the reference ad's reading when one is given. The step working now reads
 * it with the person's next message there: the screenwriter the ad's rules, the brand's pictures and the reference's
 * style; the sheet maker (already started) the brand's pictures and where they go on the map. Nothing is deleted.
 */
export async function makeAd(project: FilmProject, o: { imitate?: string; reference?: string; frames?: { userId: string; sheetId: unknown } }) {
  if (project.series_id) throw new UserError("مشاهد المسلسل ما تتحول لإعلان.", 400);
  if (project.stage !== "screenwriter" && project.stage !== "sheets") throw new UserError("التحويل لإعلان قبل ما يبدأ المخرج بس.", 409);
  const intake = project.intake && typeof project.intake === "object" ? (project.intake as Record<string, unknown>) : {};
  if (intake.lesson) throw new UserError("هذا درس، ما يتحول لإعلان.", 400);
  const was = adPlanOf(project);
  const plan: AdPlan = { ...(was ?? normalizeAdPlan({})!), ...(o.imitate ? { imitate: o.imitate, reference: o.reference ?? "" } : {}) };
  const { error } = await db().from("film_projects").update({ intake: { ...intake, ad: plan } }).eq("id", project.id);
  if (error) throw new UserError("ما قدرنا نحفظ التحويل؛ جرّب مرة ثانية.", 502);
  if (o.frames && isUuid(o.frames.sheetId)) {
    // a new reference replaces the old one
    await db().from("film_assets").update({ status: "rejected" }).eq("project_id", project.id).eq("kind", "upload").eq("ref_key", "").contains("meta", { ad_reference: true });
    await copyUpload(project, o.frames.userId, String(o.frames.sheetId), { ad_reference: true }, "ad-reference");
  }
  // the step working now reads it with the person's next message there (a step not started yet gets it when it starts)
  const stage = project.stage;
  const { count } = await db().from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("stage", stage);
  if (!count) return plan;
  if (stage === "screenwriter") {
    const style = o.imitate ? `أسلوب الإعلان المرجعي (${plan.reference || "أعطاه صاحب البراند"}) اللي ننقله:\n${plan.imitate}` : "";
    // already an ad: only the new reference is said
    const parts = was ? [style] : [AD_CONVERT_NOTE, AD_BRIEF.split("\n").filter((l) => !l.includes("المرحلة")).join("\n"), await brandText(project.id), style];
    if (parts.some(Boolean)) await addMessage(project.id, stage, parts.filter(Boolean).join("\n\n"));
  } else if (!was) {
    // the sheet maker: the brand's pictures and where they go (the reference ad is the director's)
    await addMessage(project.id, stage, `${AD_CONVERT_NOTE.replace("كمّل من حيث وصلت بنفس الشغل", "كمّل من حيث وصلت بنفس الشغل (إذا الخريطة انعرضت، عدّلها بس إذا طلبت)")}\n\n${adSheetsNote(await brandText(project.id))}`);
  }
  return plan;
}

/**
 * A brand picture added to an ad whose screenwriter or sheet maker is already working: he gets it with the person's next
 * message (a step not started yet gets every brand picture when it starts).
 */
export async function tellOfBrand(project: FilmProject, assetId: string, role: AdBrandRole, name: string) {
  const stage = project.stage;
  if ((stage !== "screenwriter" && stage !== "sheets") || !adPlanOf(project)) return;
  const { count } = await db().from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("stage", stage);
  if (!count) return;
  await addMessage(project.id, stage, `صورة براند جديدة رفعها صاحب الإعلان:\n${adBrandLines([{ role, name, assetId }]).split("\n").slice(1).join("\n")}`);
}
