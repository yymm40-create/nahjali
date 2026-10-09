import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { templateImages } from "@/lib/content/templates";
import { CAROUSEL_TEMPLATES, structureName } from "@config/content-templates";
import { FILM_STYLES, styleImage } from "@config/film-styles";

export const dynamic = "force-dynamic";

/**
 * «صانع المحتوى» · the two galleries a person picks from: the carousel templates (each with the one picture the owner had
 * drawn for it, the same for everyone; a template without one shows its palette) and the 24 cartoon styles (their
 * pictures from the course guide).
 */
export const GET = handle(async () => {
  await requireContentUser();
  const images = await templateImages().catch(() => ({}) as Record<string, string>);
  return NextResponse.json(
    {
      templates: CAROUSEL_TEMPLATES.map((t) => ({ id: t.id, group: t.group, name: t.name, description: t.description, bestFor: t.bestFor, structures: t.structures.map(structureName), palettes: t.palettes, image: images[t.id] ?? null })),
      styles: FILM_STYLES.map((s) => ({ id: s.id, group: s.group, name: s.name, description: s.description, bestFor: s.bestFor, image: styleImage(s.id) })),
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
});
