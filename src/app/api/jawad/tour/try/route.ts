import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { providerUserId } from "@/lib/jawad/server/providers/common";
import { TOUR_TRY_MAX } from "@config/jawad/tour";

export const maxDuration = 180;

/**
 * «الجولة التعريفية» · the first image, free once per account: GPT Image 2, standard size, square. A row
 * «tour-try:<user id>» in jawad_settings is written first (its key is unique); a failed image gives the try back.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as { prompt?: unknown };
  const prompt = String(b.prompt ?? "").trim().slice(0, TOUR_TRY_MAX);
  if (prompt.length < 8) throw new UserError("اكتب وصفًا أوضح للصورة (جملة على الأقل).");
  const db = createAdminClient();
  const key = `tour-try:${user.id}`;
  const { error } = await db.from("jawad_settings").insert({ key, value: { prompt }, updated_by: "tour" });
  if (error) throw new UserError("استخدمت تجربتك المجانية من قبل. تقدر تكمل من «صناعة الصور».", 409);
  try {
    const r = await openaiImage({ model: "gpt-image-2-2026-04-21", prompt, aspect: "1:1", resolution: "std", quality: "medium", count: 1, references: [], user: providerUserId(user.id), timeoutMs: 150_000 });
    const png = r.images[0];
    if (!png) throw new Error("no image");
    return NextResponse.json({ image: `data:image/png;base64,${png.toString("base64")}` });
  } catch (e) {
    console.error("tour try", user.id, e);
    await db.from("jawad_settings").delete().eq("key", key);
    throw new UserError("ما اكتملت الصورة هذه المرة، ولم تُحسب عليك التجربة. حاول مرة ثانية.", 502);
  }
});
