import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { FONTS } from "@config/jawad/student";

export const dynamic = "force-static";

/** «المصمم الذكي» · the site's Arabic fonts for the layers editor (files served by /api/jawad/student/fonts/<id>). */
export const GET = handle(async () =>
  NextResponse.json({ fonts: FONTS.map((f) => ({ id: f.id, family: f.family, label: f.label, role: f.role, files: f.files.map((x, i) => ({ url: `/api/jawad/student/fonts/${f.id}?i=${i}`, weight: x.weight })) })) }, { headers: { "Cache-Control": "public, max-age=3600" } }),
);
