import type { MetadataRoute } from "next";
import { SITE_URL } from "@config/site";
import { CREATIVE_METHODS } from "@config/jawad/creative";
import { createAdminClient } from "@/lib/supabase/admin";
import { livePages } from "@/lib/jawad/server/model-pages";
import { MODELS_BASE } from "@config/jawad/model-pages";

// rebuilt at most once an hour (a new published course or method appears without a deploy)
export const revalidate = 3600;

type Freq = "daily" | "weekly" | "monthly";

/**
 * /sitemap.xml: the public pages a visitor can open without signing in (SEO audit, 14 November 2026: it listed 11 of
 * them — the studio, the robots' pages, the connector, the gallery, the newer methods and the courses were missing).
 * The games people make travel by their own links and are not listed; pages that send a visitor to sign in are left out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: { path: string; changeFrequency: Freq; priority: number }[] = [
    { path: "/jawad-ai", changeFrequency: "daily", priority: 1 },
    { path: "/jawad-ai/credits", changeFrequency: "weekly", priority: 0.9 },
    { path: "/jawad-ai/images", changeFrequency: "weekly", priority: 0.9 },
    { path: MODELS_BASE, changeFrequency: "weekly", priority: 0.9 },
    { path: "/jawad-ai/content", changeFrequency: "weekly", priority: 0.8 },
    { path: "/jawad-ai/designer", changeFrequency: "weekly", priority: 0.8 },
    { path: "/jawad-ai/editor", changeFrequency: "weekly", priority: 0.8 },
    { path: "/jawad-ai/student", changeFrequency: "weekly", priority: 0.8 },
    { path: "/jawad-ai/games", changeFrequency: "weekly", priority: 0.7 },
    { path: "/jawad-ai/connect", changeFrequency: "monthly", priority: 0.7 },
    { path: "/jawad-ai/offers", changeFrequency: "weekly", priority: 0.7 },
    { path: "/jawad-ai/gallery", changeFrequency: "daily", priority: 0.7 },
    { path: "/jawad-ai/course", changeFrequency: "weekly", priority: 0.7 },
    { path: "/jawad-ai/creative", changeFrequency: "weekly", priority: 0.7 },
    ...CREATIVE_METHODS.map((m) => ({ path: `/jawad-ai/creative/${m.slug}`, changeFrequency: "monthly" as Freq, priority: 0.6 })),
    { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
    { path: "/refund", changeFrequency: "monthly", priority: 0.3 },
  ];
  // every generator live for users has its own page (lib/jawad/server/model-pages)
  try {
    for (const m of await livePages()) pages.push({ path: `${MODELS_BASE}/${m.id}`, changeFrequency: "weekly", priority: 0.8 });
  } catch {
    // no runtime at build time: without them
  }
  // the published courses' own pages (each sells one course); the sitemap never fails on them
  try {
    const { data } = await createAdminClient().from("learn_courses").select("id").eq("published", true);
    for (const c of data ?? []) pages.push({ path: `/jawad-ai/course/${c.id as string}`, changeFrequency: "weekly", priority: 0.7 });
  } catch {
    // no database at build time: the static pages only
  }
  return pages.map((p) => ({ url: `${SITE_URL}${p.path}`, changeFrequency: p.changeFrequency, priority: p.priority }));
}
