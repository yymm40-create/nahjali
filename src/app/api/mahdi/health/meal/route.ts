import { NextResponse } from "next/server";
import { callClaudeJson, claudeWhy, isLeader } from "@/lib/film/anthropic";
import { withClaude } from "@/lib/film/claude-model";
import { COACH } from "@/lib/mahdi/health/coach";
import { MEAL_SCHEMA, MEAL_TASK, mealsFrom, type ParsedMeal } from "@/lib/mahdi/health/meal-parse";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * «شنو أكلت؟»: what the person wrote they ate → the day's meal items (body `{ text }`), counted from the catalogue.
 * Free for the person (the coach's light model, limited per address).
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const b = await readJson(req, 16 * 1024);
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 800) : "";
  if (!text) throw new UserError("اكتب شنو أكلت.", 400);
  try {
    const r = await withClaude(COACH.model, () =>
      callClaudeJson<{ items: ParsedMeal[] }>({ system: MEAL_TASK, turns: [{ role: "user", content: text }], schema: MEAL_SCHEMA, maxTokens: 2000, effort: "low", leader: isLeader(user.email) }),
    );
    const items = mealsFrom(Array.isArray(r.data.items) ? r.data.items : []);
    if (!items.length) throw new UserError("ما لقيت أكل في كلامك؛ اكتبه مثل: «صحن رز وبيضتين».", 422);
    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof UserError) throw e;
    console.error("meal parse", e);
    throw new UserError(claudeWhy(e, "ما قدرت أحسبها الحين؛ اختر الأكل من القائمة أو جرّب بعد لحظات.", user.email), 503);
  }
});
