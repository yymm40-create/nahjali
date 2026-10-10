// The sections a person sees in JAWAD AI (the top bar and the home's cards): the registry's, with «صانع الألعاب»,
// «صانع المحتوى», «المصمم الذكي» and «زهراء» following their own switches (/admin/games, /admin/content, /admin/designer,
// /admin/photo). A section someone may not open is left out; the owner sees one that is "owner only" as not enabled. Server only.

import { contentAllowed, getVisibility as contentVisibility } from "@/lib/content/access";
import { designerAllowed, getVisibility as designerVisibility } from "@/lib/designer/access";
import { gamesAllowed, getVisibility } from "@/lib/games/access";
import { photoAllowed, getVisibility as photoVisibility } from "@/lib/photo/access";
import type { Runtime } from "./runtime";

export async function barSections(rt: Runtime, user: { email?: string | null } | null, owner: boolean): Promise<Runtime["sections"]> {
  const [gamesOk, gamesVis, contentOk, contentVis, designerOk, designerVis, photoOk, photoVis] = await Promise.all([
    user ? gamesAllowed(user.email) : false,
    owner ? getVisibility() : "all",
    user ? contentAllowed(user.email) : false,
    owner ? contentVisibility() : "all",
    user ? designerAllowed(user.email) : false,
    owner ? designerVisibility() : "all",
    user ? photoAllowed(user.email) : false,
    owner ? photoVisibility() : "all",
  ]);
  return rt.sections
    .filter((s) => (s.implementation !== "games" || gamesOk) && (s.implementation !== "content" || contentOk) && (s.implementation !== "designer" || designerOk) && (s.implementation !== "photo" || photoOk))
    .map((s) => (s.implementation === "games" ? { ...s, enabled: gamesVis !== "owner" } : s.implementation === "content" ? { ...s, enabled: contentVis !== "owner" } : s.implementation === "designer" ? { ...s, enabled: designerVis !== "owner" } : s.implementation === "photo" ? { ...s, enabled: photoVis !== "owner" } : s));
}
