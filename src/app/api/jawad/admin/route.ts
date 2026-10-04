import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadOwner } from "@/lib/jawad/server/access";
import {
  createAd,
  deleteAd,
  deleteSection,
  publishAd,
  saveGenerator,
  saveSection,
  setAccent,
  setAdFile,
  setGeneratorSample,
  setLogo,
  setPrice,
  signPublicUpload,
  unpublishAd,
  updateAdDraft,
  type Purpose,
} from "@/lib/jawad/server/admin";
import { advanceOpenJobs } from "@/lib/jawad/server/jobs";

export const maxDuration = 300;

type Body = Record<string, unknown> & { action?: string };

/**
 * Owner only — JAWAD AI settings. One action per request:
 *   sign { purpose: logo|ad_media|ad_poster|sample, target, mime, bytes }   → one-time upload URL (public bucket)
 *   logo { path | null } · accent { accent }
 *   ad_create · ad_update { id, title?, href?, slot?, enabled? } · ad_file { id, which: media|poster, path | null }
 *   ad_publish { id } · ad_unpublish { id } · ad_delete { id }
 *   section_save { id, name, icon, implementation?, sort, enabled, isNew? } · section_delete { id }
 *   generator_save { id, displayName, sectionId, sort, enabled } · generator_sample { id, path | null }
 *   price { generatorId, key, coins | null } (logged)
 *   advance_jobs                                                            → moves every unfinished job forward
 */
export const POST = handle(async (req: Request) => {
  const owner = await requireJawadOwner();
  const by = owner.email ?? owner.id;
  const b = (await req.json().catch(() => ({}))) as Body;
  const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
  const pathOrNull = (k: string) => (b[k] === null ? null : s(k) || null);

  switch (b.action) {
    case "sign":
      return NextResponse.json(await signPublicUpload(s("purpose") as Purpose, s("target").replace(/[^\w-]/g, "").slice(0, 64), s("mime"), Number(b.bytes)));
    case "logo":
      await setLogo(pathOrNull("path"), by);
      break;
    case "accent":
      await setAccent(b.accent, by);
      break;
    case "ad_create":
      return NextResponse.json({ id: await createAd() });
    case "ad_update":
      await updateAdDraft(s("id"), { title: b.title, href: b.href, slot: b.slot, enabled: b.enabled });
      break;
    case "ad_file":
      await setAdFile(s("id"), b.which === "poster" ? "poster" : "media", pathOrNull("path"));
      break;
    case "ad_publish":
      await publishAd(s("id"));
      break;
    case "ad_unpublish":
      await unpublishAd(s("id"));
      break;
    case "ad_delete":
      await deleteAd(s("id"));
      break;
    case "section_save":
      await saveSection({ id: b.id, name: b.name, icon: b.icon, implementation: b.implementation, sort: b.sort, enabled: b.enabled, isNew: b.isNew });
      break;
    case "section_delete":
      await deleteSection(s("id"));
      break;
    case "generator_save":
      await saveGenerator({ id: b.id, displayName: b.displayName, sectionId: b.sectionId, sort: b.sort, enabled: b.enabled });
      break;
    case "generator_sample":
      await setGeneratorSample(s("id"), pathOrNull("path"));
      break;
    case "price":
      await setPrice(s("generatorId"), s("key"), b.coins as unknown, by);
      break;
    case "advance_jobs":
      await advanceOpenJobs(undefined, 50);
      break;
    default:
      throw new UserError("طلب غير معروف.", 400);
  }
  return NextResponse.json({ ok: true });
});
