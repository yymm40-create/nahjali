// «عباس سبع القنطرة» in the side chat of «الصحة العلوية»: he answers, explains, and CHANGES the person's choices and plan
// directly — the answers of the wizard (body, goals, place, days…), the nutrition targets, and the exercises of the
// table — and can move the page to a step. What he may change is closed: the doctor's ok and the pregnancy warning
// signs are only ever ticked by the person, a deficit in pregnancy is impossible (the engine never makes one), and
// in pregnancy only pregnancy-safe exercises are accepted. Pure: the prompt, the schema, and applying his actions.

import { GUIDE, MUSCLES } from "@config/mahdi/exercise-guide";
import { RESEARCH, REF } from "@config/mahdi/health-research";
import type { DayLog } from "./tracker";
import {
  EXERCISES,
  FOCUS,
  GOALS,
  LABELS,
  buildDayFrom,
  cleanPlan,
  dayFocuses,
  dayLabel,
  focusName,
  cleanProfile,
  dose,
  exerciseById,
  gentle,
  makePlan,
  placeOk,
  type Focus,
  type HealthPlan,
  type HealthProfile,
  type PlanDay,
} from "./plan";

export const COACH = {
  name: "عباس سبع القنطرة",
  /** the light, fast model (like سلمان): free for the person, limited per address (src/lib/rate-limit.ts) */
  model: "claude-haiku-5-5",
  keepTurns: 14,
  maxChars: 1500,
} as const;

export const COACH_SCREENS = ["track", "about", "goal", "train", "mode", "plan", "habits", "today", "progress", "learn"] as const;
const PROFILE_FIELDS = ["track", "sex", "age", "heightCm", "weightKg", "activity", "goals", "stage", "pregWeek", "babyMonths", "wasActive", "level", "place", "splitPreference", "days", "minutes", "meals"] as const;
const FOOD_FIELDS = ["kcal", "proteinG", "waterCups", "produce", "steps"] as const;

export const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "profile", "food", "edits", "go", "restart", "choices"],
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
      description: "Changes to the training table (empty when none). «weekday» is the DAY'S ID in the table (shown as id in TABLE), not a calendar day.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "weekday", "exId", "newExId", "sets", "focuses"],
        properties: {
          op: { type: "string", enum: ["swap", "remove", "add", "sets", "types", "add-day", "remove-day"] },
          weekday: { type: "integer", description: "the day's id; for add-day: -1 (a new id is given)" },
          exId: { type: "string", description: "the exercise in the day (swap/remove/sets), or the one to add; otherwise empty" },
          newExId: { type: "string", description: "swap only: the replacement; otherwise empty" },
          sets: { type: "integer", description: "sets only (1–10); otherwise 0" },
          focuses: { type: "string", description: "types and add-day: comma list of training types for the day (one to three); otherwise empty" },
        },
      },
    },
    go: { type: "string", enum: ["", ...COACH_SCREENS], description: "Move the page to this step or page, or empty." },
    restart: { type: "boolean", description: "Start the setup again from its first question (the answers stay filled in, the person goes through them)." },
    choices: { type: "array", maxItems: 4, items: { type: "string" }, description: "Up to 4 short replies the person can tap." },
  },
} as const;

export interface CoachAnswer {
  reply: string;
  profile: { field: string; value: string }[];
  food: { field: string; value: number }[];
  edits: { op: string; weekday: number; exId: string; newExId: string; sets: number; focuses?: string }[];
  go: string;
  restart: boolean;
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
- "profile": the wizard's answers. Fields: track (gym|food|both), sex (male|female), age, heightCm, weightKg (before pregnancy when pregnant), activity (${Object.keys(REF.activity).join("|")}), goals (comma list of ${GOALS.join("|")} — several allowed), stage (none|pregnant|postpartum|breastfeeding; women only), pregWeek, babyMonths, wasActive (true|false), level (beginner|intermediate|advanced), place (gym = a full gym · home = a home gym with dumbbells/bench/bands/pull-up bar · body = no equipment at all), splitPreference (auto|full|upper-lower|ppl), days (the NUMBER of training days as ids: "0,1,2" = 3 days a week; the plan is NOT tied to the calendar), minutes (session length), meals. Changing them rebuilds the WHOLE plan from the research — to change one day, use "edits" instead.
- "food": the nutrition targets the person keeps (kcal, proteinG, waterCups, produce, steps). Only within the research's safe ranges.
- "edits": the training table, day by day: swap an exercise for another, remove one, add one, change its sets, "types" = set a day's training types (one to three together, e.g. push+legs — the day's exercises are arranged again for them), "add-day" (with its types) and "remove-day" (never the last one). Build the person's whole table with them in the chat when they ask you to arrange it: ask what they want (days, what each day trains, favourite or disliked exercises), then do it. Prefer the famous basics: dumbbell and barbell presses, squats, RDL/deadlift, rows, pulldown/pull-up, curls and pushdowns. Do not choose novelty exercises when a familiar basic fits. If the person says «أبي زيادة», add ONE useful exercise to the requested day/muscle, not several. Use ONLY ids from the catalogue below that fit the person's place; in pregnancy and the first 3 months after birth ONLY pregnancy-safe ones.
- "go": move the person to a step of the setup (track, about, goal, train, mode) or a page of the app: today (the day's workout and food tracker), plan (the table and targets), habits (put the plan into «لأجل المهدي»'s habits), progress (weights, records, sets per muscle, nutrition and body weight over time), learn (the muscles and how to do each exercise).
- "restart": true when the person wants to start over / change everything from the beginning: you set what you already know in "profile" and the setup opens at its first question so they go through it again.
- "choices": up to 4 short replies to tap.
When you change something, say in the reply what you changed. When the person only asks, change nothing (empty arrays).

SAFETY (always): you are not a doctor. Anyone with a health problem, an injury, a chronic disease, pregnancy complications, or in doubt: tell them to check with their doctor first — and remind them you can make mistakes. Never a calorie deficit in pregnancy or for someone under 18, never under ${REF.kcalFloor.female} kcal for a woman or ${REF.kcalFloor.male} for a man. You can NOT tick the doctor's ok or the pregnancy warning signs: the person ticks those themselves in the «تمرينك» step. No supplements beyond what the research says, no medicines. Pain in the chest, dizziness, bleeding in pregnancy → stop and see a doctor now.
Never name the AI model or its maker. You know the branch only; for the rest of «لأجل المهدي» answer briefly.

THE RESEARCH YOU STAND ON:
${research}

EXERCISE CATALOGUE (id | name | muscle | where | safety):
${catalogue}

HOW TO DO EACH EXERCISE (explain from this; muscles by id):
${Object.entries(GUIDE).map(([id, g]) => `${id}: main ${g.primary.join("+")}${g.secondary.length ? `, helping ${g.secondary.join("+")}` : ""} | ${g.steps.join(" ")} | mistakes: ${g.mistakes.join(" ")}`).join("\n")}

THE MUSCLES (explain them in plain words like this):
${MUSCLES.map((m) => `${m.id} = ${m.name} (${m.aka}): ${m.where} ${m.does}`).join("\n")}

THE APP: «الصحة العلوية» is an app of its own inside «لأجل المهدي», with tabs: «اليوم» (log every set as weight × reps, a rest timer, «خلصت تمرين اليوم», cardio, the day's protein/water/produce/calories/steps, a weigh-in), «خطتي» (the table and targets; «أدخلها في عاداتي» makes habits that the tracker then fills by itself), «التقدم» (sets per muscle this week vs 10, strength charts and records per exercise, body weight, nutrition days), «تعلّم» (the body map, every muscle, every exercise's technique page). Use the TRACKER below to coach: praise records, notice skipped muscles or missed protein, suggest the next weights (all sets at the top of the range → a little more weight).

THE TABLE IS A ROTATION, NOT A CALENDAR: its days are «اليوم ١، اليوم ٢…» done in order whenever the person trains (the «اليوم» page suggests the day after the last session, and any day can be picked instead). There is NO compulsory rest day: the person rests whenever it suits them — never insist on fixed weekdays. Each session has a clock (start → «خلصت») so they see how long they trained; weights take decimals like 7.5 kg.

TRAINING TYPES: ${Object.entries(FOCUS).map(([k, v]) => `${k}=${v.name}`).join(", ")}.`;

/** The person's current state, sent after the task. */
export function coachState(profile: HealthProfile, plan: HealthPlan | null, screen: string, recent: DayLog[] = []): string {
  const w = plan?.workout;
  const table = w?.blocked
    ? `BLOCKED: ${w.blocked}`
    : (w?.days ?? []).map((d, i) => `id ${d.weekday} = ${dayLabel(i)} (${dayFocuses(d).join("+")}: ${focusName(d)}): ${d.items.map((x) => `${x.exId} ${x.sets}x${x.reps}`).join(", ")}${d.cardioMin ? ` + ${d.cardioMin}min cardio` : ""}`).join("\n");
  return `NOW — page step: ${screen || "home"}
PROFILE: ${JSON.stringify({ ...profile, goals: profile.goals.join(","), days: profile.days.join(",") })}
(place: ${LABELS.place[profile.place]})
PLAN: ${plan ? `mode ${plan.mode}; food ${JSON.stringify(plan.food)}\nTABLE:\n${table || "(none)"}` : "not made yet"}
TRACKER (last 14 days, what they actually did):
${recent.length ? recent.slice(-14).map((d) => `${d.date}: ${d.done ? "workout done" : ""}${d.planDay !== undefined ? ` (day id ${d.planDay})` : ""}${d.durationMin ? ` ${Math.round(d.durationMin)}min` : ""} ${Object.entries(d.sets).map(([id, ss]) => `${id} ${ss.map((x) => `${x.kg}x${x.reps}`).join("/")}`).join("; ")}${d.cardioMin ? ` cardio ${d.cardioMin}min` : ""} food ${JSON.stringify(d.food)}${d.bodyKg ? ` weight ${d.bodyKg}kg` : ""}${d.measurements ? ` measurements(cm) ${JSON.stringify(d.measurements)}` : ""}`).join("\n") : "(nothing logged yet)"}`;
}

/** Applies what عباس decided to the profile and the plan; anything outside the rules is dropped. */
export function applyCoach(profile: HealthProfile, plan: HealthPlan | null, a: Partial<CoachAnswer>): { profile: HealthProfile; plan: HealthPlan | null; go: string; restart: boolean; changed: boolean } {
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
  // rebuilt from the research; the habits already made from it stay linked
  if (next && changed) next = { ...makePlan(p, next.mode), links: next.links };

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
    const typesOf = (raw: string | undefined): Focus[] => {
      const all = Object.keys(FOCUS) as Focus[];
      const list = [...new Set(String(raw ?? "").split(/[,،+\s]+/).filter((f): f is Focus => all.includes(f as Focus)))];
      // pregnancy and the first months after birth keep the gentle table
      return gentle(p) ? ["gentle"] : list.filter((f) => f !== "gentle").slice(0, 3);
    };
    for (const e of a.edits) {
      if (e.op === "add-day") {
        const id = [0, 1, 2, 3, 4, 5, 6].find((x) => !days.some((d) => d.weekday === x));
        const fs = typesOf(e.focuses);
        if (id === undefined) continue;
        days = [...days, buildDayFrom(p, id, fs.length ? fs : ["full"], 0, days[0]?.cardioMin ?? 0)];
        changed = true;
        continue;
      }
      const day = days.find((d) => d.weekday === e.weekday);
      if (!day) continue;
      if (e.op === "remove-day") {
        if (days.length > 1) {
          days = days.filter((d) => d.weekday !== day.weekday);
          changed = true;
        }
        continue;
      }
      if (e.op === "types") {
        const fs = typesOf(e.focuses);
        if (!fs.length) continue;
        const rebuilt: PlanDay = buildDayFrom(p, day.weekday, fs, day.variant, day.cardioMin);
        days = days.map((d) => (d.weekday === day.weekday ? rebuilt : d));
        changed = true;
        continue;
      }
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
    // the profile's day list follows the table (the rotation)
    next = { ...next, profile: { ...next.profile, days: days.map((d) => d.weekday) }, workout: { ...w, days } };
    p = { ...p, days: days.map((d) => d.weekday) };
  }
  const go = (COACH_SCREENS as readonly string[]).includes(a.go ?? "") ? (a.go as string) : "";
  return { profile: p, plan: next ? { ...next, profile: p } : next, go, restart: a.restart === true, changed };
}
