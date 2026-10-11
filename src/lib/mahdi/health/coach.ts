// «عباس سبع القنطرة» in the side chat of «الصحة العلوية»: he answers, explains, and CHANGES the person's choices and plan
// directly — the answers of the wizard (body, goals, place, days…), the nutrition targets, and the exercises of the
// table — and can move the page to a step. What he may change is closed: the doctor's ok and the pregnancy warning
// signs are only ever ticked by the person, a deficit in pregnancy is impossible (the engine never makes one), and
// in pregnancy only pregnancy-safe exercises are accepted. Pure: the prompt, the schema, and applying his actions.

import { RESEARCH, REF } from "@config/mahdi/health-research";
import {
  EXERCISES,
  FOCUS,
  GOALS,
  LABELS,
  WEEKDAYS,
  cleanPlan,
  cleanProfile,
  dose,
  exerciseById,
  gentle,
  makePlan,
  placeOk,
  type HealthPlan,
  type HealthProfile,
} from "./plan";

export const COACH = {
  name: "عباس سبع القنطرة",
  /** the light, fast model (like سلمان): free for the person, limited per address (src/lib/rate-limit.ts) */
  model: "claude-haiku-5-5",
  keepTurns: 14,
  maxChars: 1500,
} as const;

export const COACH_SCREENS = ["track", "about", "goal", "train", "mode", "plan", "habits"] as const;
const PROFILE_FIELDS = ["track", "sex", "age", "heightCm", "weightKg", "activity", "goals", "stage", "pregWeek", "babyMonths", "wasActive", "level", "place", "days", "minutes", "meals"] as const;
const FOOD_FIELDS = ["kcal", "proteinG", "waterCups", "produce", "steps"] as const;

export const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "profile", "food", "edits", "go", "choices"],
  properties: {
    reply: { type: "string", description: "What عباس says, in Gulf Arabic: short, warm, a coach." },
    profile: {
      type: "array",
      description: "Answers of the wizard to change (empty when none). goals and days are comma lists.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value"],
        properties: { field: { type: "string", enum: [...PROFILE_FIELDS] }, value: { type: "string" } },
      },
    },
    food: {
      type: "array",
      description: "Nutrition targets to set (empty when none).",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value"],
        properties: { field: { type: "string", enum: [...FOOD_FIELDS] }, value: { type: "number" } },
      },
    },
    edits: {
      type: "array",
      description: "Changes to the training table (empty when none). weekday 0=Sunday…6=Saturday.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "weekday", "exId", "newExId", "sets"],
        properties: {
          op: { type: "string", enum: ["swap", "remove", "add", "sets"] },
          weekday: { type: "integer" },
          exId: { type: "string", description: "the exercise in the day (swap/remove/sets), or the one to add" },
          newExId: { type: "string", description: "swap only: the replacement; otherwise empty" },
          sets: { type: "integer", description: "sets only (1–10); otherwise 0" },
        },
      },
    },
    go: { type: "string", enum: ["", ...COACH_SCREENS], description: "Move the page to this step, or empty." },
    choices: { type: "array", maxItems: 4, items: { type: "string" }, description: "Up to 4 short replies the person can tap." },
  },
} as const;

export interface CoachAnswer {
  reply: string;
  profile: { field: string; value: string }[];
  food: { field: string; value: number }[];
  edits: { op: string; weekday: number; exId: string; newExId: string; sets: number }[];
  go: string;
  choices: string[];
}

export interface CoachTurn {
  role: "user" | "assistant";
  text: string;
}

export function cleanCoachTurns(raw: unknown): CoachTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: CoachTurn[] = [];
  for (const t of raw.slice(-COACH.keepTurns)) {
    if (!t || typeof t !== "object") continue;
    const r = (t as Record<string, unknown>).role;
    const text = String((t as Record<string, unknown>).text ?? "").trim().slice(0, COACH.maxChars);
    if ((r === "user" || r === "assistant") && text) out.push({ role: r, text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

const research = RESEARCH.map((s) => `## ${s.title} (${s.for})\n${s.points.map((p) => `- ${p.text}`).join("\n")}`).join("\n");
const catalogue = EXERCISES.map((e) => `${e.id} | ${e.name} | ${e.muscle} | ${[e.gym && "gym", e.home && "homegym", e.body && "noequipment"].filter(Boolean).join("/")}${e.preg ? " | pregnancy-safe" : ""}`).join("\n");

export const COACH_TASK = `You are «${COACH.name}» 🦁, the robot coach of «الصحة العلوية» (the gym and nutrition branch of the app «لأجل المهدي»). You speak Gulf Arabic, as a man, warm and motivating like a good coach, short (2–5 lines). Address a woman in the feminine.

WHAT YOU DO: you help the person through the branch: explain anything they did not understand, ask what you need to know about them, and CHANGE their choices and plan directly through the JSON fields — never tell them "go and change it yourself" when you can do it:
- "profile": the wizard's answers. Fields: track (gym|food|both), sex (male|female), age, heightCm, weightKg (before pregnancy when pregnant), activity (${Object.keys(REF.activity).join("|")}), goals (comma list of ${GOALS.join("|")} — several allowed), stage (none|pregnant|postpartum|breastfeeding; women only), pregWeek, babyMonths, wasActive (true|false), level (beginner|intermediate|advanced), place (gym = a full gym · home = a home gym with dumbbells/bench/bands/pull-up bar · body = no equipment at all), days (comma list of weekdays 0=Sunday…6=Saturday), minutes (session length), meals. Changing them rebuilds the plan from the research.
- "food": the nutrition targets the person keeps (kcal, proteinG, waterCups, produce, steps). Only within the research's safe ranges.
- "edits": the training table: swap an exercise for another, remove one, add one, or change its sets. Use ONLY ids from the catalogue below that fit the person's place; in pregnancy and the first 3 months after birth ONLY pregnancy-safe ones.
- "go": move the page to a step (track, about, goal, train, mode, plan, habits).
- "choices": up to 4 short replies to tap.
When you change something, say in the reply what you changed. When the person only asks, change nothing (empty arrays).

SAFETY (always): you are not a doctor. Anyone with a health problem, an injury, a chronic disease, pregnancy complications, or in doubt: tell them to check with their doctor first — and remind them you can make mistakes. Never a calorie deficit in pregnancy or for someone under 18, never under ${REF.kcalFloor.female} kcal for a woman or ${REF.kcalFloor.male} for a man. You can NOT tick the doctor's ok or the pregnancy warning signs: the person ticks those themselves in the «تمرينك» step. No supplements beyond what the research says, no medicines. Pain in the chest, dizziness, bleeding in pregnancy → stop and see a doctor now.
Never name the AI model or its maker. You know the branch only; for the rest of «لأجل المهدي» answer briefly.

THE RESEARCH YOU STAND ON:
${research}

EXERCISE CATALOGUE (id | name | muscle | where | safety):
${catalogue}

TRAINING FOCUSES: ${Object.entries(FOCUS).map(([k, v]) => `${k}=${v.name}`).join(", ")}. WEEKDAYS: ${WEEKDAYS.map((d, i) => `${i}=${d}`).join(", ")}.`;

/** The person's current state, sent after the task. */
export function coachState(profile: HealthProfile, plan: HealthPlan | null, screen: string): string {
  const w = plan?.workout;
  const table = w?.blocked
    ? `BLOCKED: ${w.blocked}`
    : (w?.days ?? []).map((d) => `${d.weekday} ${WEEKDAYS[d.weekday]} (${FOCUS[d.focus].name}): ${d.items.map((i) => `${i.exId} ${i.sets}x${i.reps}`).join(", ")}${d.cardioMin ? ` + ${d.cardioMin}min cardio` : ""}`).join("\n");
  return `NOW — page step: ${screen || "home"}
PROFILE: ${JSON.stringify({ ...profile, goals: profile.goals.join(","), days: profile.days.join(",") })}
(place: ${LABELS.place[profile.place]})
PLAN: ${plan ? `mode ${plan.mode}; food ${JSON.stringify(plan.food)}\nTABLE:\n${table || "(none)"}` : "not made yet"}`;
}

/** Applies what عباس decided to the profile and the plan; anything outside the rules is dropped. */
export function applyCoach(profile: HealthProfile, plan: HealthPlan | null, a: Partial<CoachAnswer>): { profile: HealthProfile; plan: HealthPlan | null; go: string; changed: boolean } {
  let changed = false;
  let p = profile;
  const sets: Record<string, unknown> = {};
  for (const { field, value } of a.profile ?? []) {
    if (!(PROFILE_FIELDS as readonly string[]).includes(field)) continue;
    const v = String(value).trim();
    if (field === "goals" || field === "days") sets[field] = v.split(/[,،\s]+/).filter(Boolean).map((x) => (field === "days" ? Number(x) : x));
    else if (field === "wasActive") sets[field] = v === "true";
    else if (["age", "heightCm", "weightKg", "pregWeek", "babyMonths", "minutes", "meals"].includes(field)) sets[field] = Number(v);
    else sets[field] = v;
  }
  if (Object.keys(sets).length) {
    // the doctor's ok and the warning signs stay as the person ticked them
    p = cleanProfile({ ...profile, ...sets, clearance: profile.clearance, redFlags: profile.redFlags });
    changed = JSON.stringify(p) !== JSON.stringify(profile);
  }
  let next = plan;
  if (next && changed) next = makePlan(p, next.mode);

  if (next?.food && a.food?.length) {
    const food = { ...next.food };
    for (const { field, value } of a.food) if ((FOOD_FIELDS as readonly string[]).includes(field) && Number.isFinite(Number(value))) food[field as (typeof FOOD_FIELDS)[number]] = Number(value);
    // the engine's own bounds, and the floors: never under the safe minimum
    const floor = REF.kcalFloor[p.sex];
    if (food.kcal < floor) food.kcal = floor;
    const clean = cleanPlan({ ...next, food });
    if (clean?.food) {
      next = { ...next, food: clean.food };
      changed = true;
    }
  }

  const w = next?.workout;
  if (next && w && !w.blocked && a.edits?.length) {
    const ok = (id: string) => {
      const e = exerciseById(id);
      return !!e && placeOk(e, p.place) && (!gentle(p) || e.preg);
    };
    let days = w.days;
    for (const e of a.edits) {
      const day = days.find((d) => d.weekday === e.weekday);
      if (!day) continue;
      let items = day.items;
      if (e.op === "remove") items = items.filter((i) => i.exId !== e.exId);
      else if (e.op === "sets") items = items.map((i) => (i.exId === e.exId ? { ...i, sets: Math.min(10, Math.max(1, Math.round(e.sets))) } : i));
      else if (e.op === "add" && ok(e.exId) && !items.some((i) => i.exId === e.exId)) items = [...items, { exId: e.exId, ...dose(exerciseById(e.exId)!, p) }];
      else if (e.op === "swap" && ok(e.newExId) && !items.some((i) => i.exId === e.newExId))
        items = items.map((i) => (i.exId === e.exId ? { exId: e.newExId, ...dose(exerciseById(e.newExId)!, p) } : i));
      if (items !== day.items) {
        days = days.map((d) => (d.weekday === day.weekday ? { ...d, items } : d));
        changed = true;
      }
    }
    next = { ...next, workout: { ...w, days } };
  }
  const go = (COACH_SCREENS as readonly string[]).includes(a.go ?? "") ? (a.go as string) : "";
  return { profile: p, plan: next ? { ...next, profile: p } : next, go, changed };
}
