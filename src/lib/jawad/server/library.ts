// «الجواد الذكي!» | JAWAD AI — «المكتبة» (an add-on): who has it, and the characters and places kept in it. Server only.
// (The voices of the library live in voices.ts; they need the add-on too.)
//
//   add  ─► the person's own picture (an upload) or one of their results, kept under a name.
//   make ─► a GPT Image 2 job from a description, charged like any generation; when it succeeds its picture is kept
//           under the name asked for (runJob calls keepMadeItem).
//   use  ─► an item is a reference like any other (its upload), mentioned by «@name».

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIBRARY_KINDS, LIBRARY_LIMIT, LIBRARY_NOTE_MAX, libraryImagePrompt, librarySettings, type LibraryKind } from "@config/jawad/library";
import { cleanRefName, looksLikeRef, sameName } from "../mentions";
import { libraryAccess, missing, requireLibrary, type LibraryAccess } from "./library-access";
import { JAWAD_BUCKET, loadRuntime } from "./runtime";
import { isUuid, uploadFromOutput, uploadViews, type UploadRow } from "./uploads";
import { createJob, type CreateResult, type JobRow } from "./jobs";

const db = () => createAdminClient();
const IMAGE_GENERATOR = "openai-gpt-image-2";

export { libraryAccess, requireLibrary, type LibraryAccess };
// ───────────────────────────── characters and places ─────────────────────────────

interface ItemRow {
  id: string;
  user_id: string;
  kind: LibraryKind;
  name: string;
  note: string;
  upload_id: string;
  origin: "made" | "own";
  job_id: string | null;
  created_at: string;
}

export interface LibraryItemView {
  id: string;
  kind: LibraryKind;
  name: string;
  note: string;
  origin: "made" | "own";
  uploadId: string;
  url: string | null;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

async function rows(userId: string) {
  const { data, error } = await db().from("jawad_library").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (missing(error)) return null;
  if (error) throw error;
  return (data ?? []) as ItemRow[];
}

/** The person's characters and places, with their pictures (short-lived links). */
export async function listLibrary(userId: string, owner: boolean): Promise<{ access: LibraryAccess; items: LibraryItemView[] }> {
  const access = await libraryAccess(userId, owner);
  const list = access.migrated ? await rows(userId) : null;
  if (!list) return { access: { ...access, migrated: false }, items: [] };
  const { data: ups } = list.length ? await db().from("jawad_uploads").select("*").in("id", list.map((r) => r.upload_id)) : { data: [] };
  const views = new Map((await uploadViews((ups ?? []) as UploadRow[])).map((v) => [v.id, v]));
  const items = list.flatMap((r) => {
    const v = views.get(r.upload_id);
    return v ? [{ id: r.id, kind: r.kind, name: r.name, note: r.note, origin: r.origin, uploadId: r.upload_id, url: v.url, mime: v.mime, bytes: v.bytes, width: v.width, height: v.height, createdAt: r.created_at }] : [];
  });
  return { access, items };
}

const kindOf = (v: unknown): LibraryKind => {
  if (!LIBRARY_KINDS.includes(v as LibraryKind)) throw new UserError("اختر: شخصية أو مكان.", 400);
  return v as LibraryKind;
};
const noteOf = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, LIBRARY_NOTE_MAX) : "");

/** A free name for a new item: the person's (checked), never one like «image1» that means a numbered reference. */
async function freeName(userId: string, raw: unknown, list?: ItemRow[]) {
  const name = cleanRefName(raw);
  if (!name) throw new UserError("الاسم: حروف أو أرقام أو _ أو - بلا مسافات (حتى ٢٤ حرفًا)، وتمنشنه به: @الاسم", 400);
  if (looksLikeRef(name)) throw new UserError("هذا الاسم محجوز للمراجع المرقّمة (image1…)؛ اختر اسمًا آخر.", 400);
  const all = list ?? (await rows(userId)) ?? [];
  if (all.some((r) => sameName(r.name, name))) throw new UserError(`عندك في المكتبة «@${name}» من قبل؛ اختر اسمًا آخر.`, 409);
  if (all.length >= LIBRARY_LIMIT) throw new UserError(`مكتبتك فيها ${LIBRARY_LIMIT} عنصرًا (الحد). احذف واحدًا لتضيف غيره.`, 409);
  return name;
}

async function insert(row: Omit<ItemRow, "id" | "created_at">) {
  const { data, error } = await db().from("jawad_library").insert(row).select("*").single();
  if (error?.code === "23505") throw new UserError(`عندك في المكتبة «@${row.name}» من قبل؛ اختر اسمًا آخر.`, 409);
  if (error) throw error;
  return data as ItemRow;
}

/** Keeps the person's own picture (an upload of theirs) or one of their results under a name. */
export async function addOwnItem(user: { id: string }, owner: boolean, b: { kind?: unknown; name?: unknown; note?: unknown; uploadId?: unknown; outputId?: unknown }) {
  await requireLibrary(user.id, owner);
  const kind = kindOf(b.kind);
  const name = await freeName(user.id, b.name);
  let uploadId: string;
  if (b.outputId !== undefined) uploadId = (await uploadFromOutput(user.id, b.outputId)).id;
  else if (isUuid(b.uploadId)) uploadId = b.uploadId;
  else throw new UserError("اختر صورة.", 400);
  const { data: up } = await db().from("jawad_uploads").select("*").eq("id", uploadId).eq("user_id", user.id).maybeSingle();
  const u = up as UploadRow | null;
  if (!u || u.kind !== "image" || u.status !== "ready") throw new UserError("اختر صورة (PNG أو JPG أو WEBP) اكتمل رفعها.", 400);
  await insert({ user_id: user.id, kind, name, note: noteOf(b.note), upload_id: uploadId, origin: "own", job_id: null });
  return (await listLibrary(user.id, owner)).items.find((i) => sameName(i.name, name))!;
}

/**
 * Makes a character or place from a description: a GPT Image 2 job (priced and charged like any image, with the
 * same price confirmation), whose picture is kept under the name when it succeeds.
 */
export async function makeItem(user: { id: string; email?: string | null }, owner: boolean, b: { key?: unknown; kind?: unknown; name?: unknown; note?: unknown; expectedCoins?: unknown }, origin: string): Promise<CreateResult> {
  await requireLibrary(user.id, owner);
  const kind = kindOf(b.kind);
  const name = await freeName(user.id, b.name);
  const note = noteOf(b.note);
  if (note.length < 10) throw new UserError("صف الشكل في ١٠ أحرف على الأقل.", 400);
  const rt = await loadRuntime();
  const g = rt.generators.find((x) => x.id === IMAGE_GENERATOR);
  if (!g) throw new UserError("صناعة الصور غير متاحة حاليًا.", 403);
  return createJob(
    user,
    owner,
    {
      idempotencyKey: b.key,
      sectionId: g.sectionId,
      generatorId: IMAGE_GENERATOR,
      refStyle: "none",
      settings: librarySettings(kind),
      prompt: libraryImagePrompt(kind, note),
      instructions: "",
      refs: [],
      expectedCoins: b.expectedCoins,
    },
    origin,
    { library: { kind, name, note } },
  );
}

/** After a library job succeeded: its picture is kept under the name asked for (a taken name gets a number). */
export async function keepMadeItem(job: JobRow) {
  const want = job.inputs.library;
  if (!want) return;
  const { data: out } = await db().from("jawad_outputs").select("id").eq("job_id", job.id).order("idx").limit(1).maybeSingle();
  if (!out) return;
  const up = await uploadFromOutput(job.user_id, out.id);
  if (up.status !== "ready") throw new Error(`library copy: ${up.error}`);
  const list = (await rows(job.user_id)) ?? [];
  let name = want.name;
  for (let i = 2; list.some((r) => sameName(r.name, name)); i++) name = `${want.name.slice(0, 21)}_${i}`;
  await insert({ user_id: job.user_id, kind: want.kind, name, note: want.note, upload_id: up.id, origin: "made", job_id: job.id });
}

export async function renameItem(userId: string, id: unknown, raw: unknown) {
  if (!isUuid(id)) throw new UserError("طلب غير صحيح.", 400);
  const list = (await rows(userId)) ?? [];
  const row = list.find((r) => r.id === id);
  if (!row) throw new UserError("ما لقينا هذا العنصر.", 404);
  const name = await freeName(userId, raw, list.filter((r) => r.id !== id));
  const { error } = await db().from("jawad_library").update({ name }).eq("id", id).eq("user_id", userId);
  if (error?.code === "23505") throw new UserError(`عندك في المكتبة «@${name}» من قبل.`, 409);
  if (error) throw error;
}

/** Removes an item and its picture (works already made keep their own copies). */
export async function deleteItem(userId: string, id: unknown) {
  if (!isUuid(id)) throw new UserError("طلب غير صحيح.", 400);
  const { data } = await db().from("jawad_library").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  const row = data as ItemRow | null;
  if (!row) throw new UserError("ما لقينا هذا العنصر.", 404);
  await db().from("jawad_library").delete().eq("id", row.id);
  const { data: up } = await db().from("jawad_uploads").select("storage_path").eq("id", row.upload_id).maybeSingle();
  // The picture goes too, unless a generation still running uses it
  const { data: open } = await db().from("jawad_jobs").select("id").eq("user_id", userId).in("status", ["queued", "submitting", "running", "saving"]).contains("refs", [{ uploadId: row.upload_id }]).limit(1);
  if (up && !open?.length) {
    await db().storage.from(JAWAD_BUCKET).remove([up.storage_path as string]);
    await db().from("jawad_uploads").delete().eq("id", row.upload_id);
  }
}
