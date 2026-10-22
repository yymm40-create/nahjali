import type { MetadataRoute } from "next";
import { SITE_URL } from "@config/site";

/** /sitemap.xml: the public pages (the games people make travel by their own links and are not listed). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }[] = [
    { path: "/jawad-ai", changeFrequency: "daily", priority: 1 },
    { path: "/jawad-ai/credits", changeFrequency: "weekly", priority: 0.9 },
    { path: "/jawad-ai/offers", changeFrequency: "weekly", priority: 0.8 },
    { path: "/jawad-ai/course", changeFrequency: "weekly", priority: 0.7 },
    { path: "/jawad-ai/games", changeFrequency: "weekly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  ];
  return pages.map((p) => ({ url: `${SITE_URL}${p.path}`, changeFrequency: p.changeFrequency, priority: p.priority }));
}
