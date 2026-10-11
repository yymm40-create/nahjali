import { NextResponse } from "next/server";
import { callClaudeJson, claudeWhy, isLeader } from "@/lib/film/anthropic";
import { withClaude } from "@/lib/film/claude-model";
import { applyCoach, cleanCoachTurns, COACH, COACH_SCHEMA, COACH_TASK, coachState, type CoachAnswer } from "@/lib/mahdi/health/coach";
import { cleanPlan, cleanProfile } from "@/lib/mahdi/health/plan";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * «عباس سبع القنطرة»: one turn of the side chat of «الصحة العلوية». Body: { messages, profile, plan, screen }.
 * He answers and may change the person's answers, nutrition targets and training table; the changes are applied here
 * by the rules (src/lib/mahdi/health/coach.ts) and the page takes the new profile and plan as they come back.
 * Free for the person (the light model, limited per address like سلمان).
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const b = await readJson(req, 256 * 1024);
  const turns = cleanCoachTurns(b.messages);
  if (!turns.length || turns[turns.length - 1].role !== "user") throw new UserError("اكتب سؤالك.", 400);
  const profile = cleanProfile(b.profile);
  const plan = b.plan ? cleanPlan(b.plan) : null;
  const screen = typeof b.screen === "string" ? b.screen.slice(0, 20) : "";
  try {
    const r = await withClaude(COACH.model, () =>
      callClaudeJson<CoachAnswer>({
        system: `${COACH_TASK}\n\n${coachState(profile, plan, screen)}`,
        turns: turns.map((t) => ({ role: t.role, content: t.text })),
        schema: COACH_SCHEMA,
        maxTokens: 6000,
        effort: "low",
        leader: isLeader(user.email),
      }),
    );
    const done = applyCoach(profile, plan, r.data);
    return NextResponse.json({
      reply: String(r.data.reply ?? "").trim().slice(0, 2500) || "ما فهمت عليك، تعيدها بطريقة ثانية؟",
      choices: (Array.isArray(r.data.choices) ? r.data.choices : []).map((c) => String(c).slice(0, 80)).filter(Boolean).slice(0, 4),
      profile: done.profile,
      plan: done.plan,
      go: done.go,
      changed: done.changed,
    });
  } catch (e) {
    console.error("coach", e);
    throw new UserError(claudeWhy(e, "عباس مشغول شوي، جرّب بعد لحظات.", user.email), 503);
  }
});
