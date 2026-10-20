// «مختبر الموشن»: the scene a finished film was made from, kept WITH the film's file in the library (its plan, its
// program, its editable texts and colours, the pictures and the video it used) — so the film on the timeline stays
// editable: its texts and colours change in place (rendered again), or it goes back to the lab's conversation.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { stillOpen, type AssetRow, type EditorProject } from "./server";

/** The most a kept scene may weigh (the program alone may be up to 140k characters). */
export const LAB_SOURCE_MAX = 400_000;

const db = () => createAdminClient();

async function row(p: EditorProject, id: unknown) {
  const { data } = await db().from("editor_assets").select("*").eq("id", String(id ?? "")).eq("project_id", p.id).maybeSingle();
  const r = data as AssetRow | null;
  if (!r || r.kind !== "video") throw new UserError("ما لقينا مقطع الموشن.", 404);
  return r;
}

/** `{ assetId, source }`: the scene kept with its film. */
export async function saveLabSource(p: EditorProject, b: { assetId?: unknown; source?: unknown }) {
  stillOpen(p);
  const r = await row(p, b.assetId);
  const s = b.source;
  if (!s || typeof s !== "object" || typeof (s as { code?: unknown }).code !== "string") throw new UserError("ما وصل المشهد.", 400);
  const text = JSON.stringify(s);
  if (text.length > LAB_SOURCE_MAX) throw new UserError("المشهد أكبر من اللي ينحفظ مع المقطع.", 400);
  await db().from("editor_assets").update({ meta: { ...(r.meta ?? {}), lab: JSON.parse(text) } }).eq("id", r.id);
  return { ok: true };
}

/** `{ assetId }` → the scene kept with the film (null when it was not made in the lab). */
export async function readLabSource(p: EditorProject, b: { assetId?: unknown }) {
  const r = await row(p, b.assetId);
  return { source: (r.meta?.lab ?? null) as Record<string, unknown> | null };
}
