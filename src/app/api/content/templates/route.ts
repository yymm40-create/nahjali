import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { templateImages } from "@/lib/content/templates";
import { CAROUSEL_TEMPLATES, structureName } from "@config/content-templates";
import { FILM_STYLES, styleImage } from "@config/film-styles";
import { MOODS, MOTION_STYLES } from "@/lib/editor/motion-styles";
import { previewUri } from "@/lib/editor/motion-preview";

const KIND_AR: Record<string, string> = { title: "عنوان", points: "نقاط", stat: "رقم كبير", quote: "اقتباس", steps: "خطوات", compare: "مقارنة", statement: "جملة", outro: "ختام", kinetic: "كلمات طائرة" };
const PACE_GROUP = { fast: "إيقاع سريع", normal: "إيقاع متوسط", calm: "هادئ وفخم" } as const;
// the previews are drawn once per server (they never change)
let motionGallery: { motion: unknown[]; moods: unknown[] } | null = null;
function motionItems() {
  motionGallery ??= {
    motion: MOTION_STYLES.filter((s) => !s.talk).map((s) => ({ id: s.id, group: PACE_GROUP[s.look.pace ?? "normal"], name: s.ar, icon: s.icon, description: s.hint, bestFor: `لقطاتها: ${s.beats.map((k) => KIND_AR[k] ?? k).join("، ")}`, image: previewUri({ style: s.id }) })),
    moods: MOODS.map((m) => ({ id: m.id, group: "المشاعر", name: m.ar, icon: m.icon, description: m.hint, bestFor: `إيقاع ${PACE_GROUP[m.pace]}`, image: previewUri({ mood: m.id }) })),
  };
  return motionGallery;
}

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
      ...motionItems(),
      styles: FILM_STYLES.map((s) => ({ id: s.id, group: s.group, name: s.name, description: s.description, bestFor: s.bestFor, image: styleImage(s.id) })),
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
});
