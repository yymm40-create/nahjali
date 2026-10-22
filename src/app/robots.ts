import type { MetadataRoute } from "next";
import { SITE_URL } from "@config/site";

/**
 * /robots.txt: the public pages are open to the search engines (the front page, the shop, the courses, the games maker and
 * the games people share, the legal pages); the dashboard, the API, the sign-in flow and the account pages stay out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/jawad-ai", "/jawad-ai/credits", "/jawad-ai/course", "/jawad-ai/games", "/play/", "/privacy", "/terms"],
      disallow: ["/admin", "/jawad-ai/admin", "/api", "/auth", "/jawad-ai/login", "/jawad-ai/username", "/jawad-ai/account"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
