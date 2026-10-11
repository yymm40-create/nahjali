// «الخطيب الذكي» — what every page of the branch does first: the link's word must be the owner's (else a plain 404, as if
// there were nothing here), then the password must have been given on this device, then the person signs in. Server only.

import { notFound } from "next/navigation";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { cleanSlug, KHATEEB } from "@config/jawad/khateeb";
import { doorOpen, loadSettings } from "./gate";

/** `gate: true` = the page is the password's (nothing else may be shown); else the signed-in person. */
export async function enterKhateeb(slug: string, path = ""): Promise<{ gate: true } | { gate: false; user: NonNullable<Awaited<ReturnType<typeof requireJawadUser>>["user"]>; owner: boolean }> {
  const s = await loadSettings();
  if (!s.slug || s.slug !== cleanSlug(slug)) notFound();
  if (!(await doorOpen(slug))) return { gate: true };
  const { user, owner } = await requireJawadUser(`${KHATEEB.base}/${slug}${path}`);
  return { gate: false, user, owner };
}
