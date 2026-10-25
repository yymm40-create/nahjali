import { describe, expect, it } from "vitest";
import { gymHabitWrites } from "@/lib/mahdi/health/tracker";

const sets = { bench: [{ w: 60, reps: 8 }, { w: 60, reps: 8 }, { w: 60, reps: 0 }], row: [{ w: 40, reps: 10 }] } as never;
const map = (w: { key: string; value: number }[]) => Object.fromEntries(w.map((x) => [x.key, x.value]));

describe("«الصحة العلوية» → habits: they follow what was really trained", () => {
  it("finishing credits the session trained, the week, and each exercise by the sets done", () => {
    expect(map(gymHabitWrites({ done: true, session: 3, sets }))).toEqual({ "day-3": 1, weekly: 1, "ex-bench": 2, "ex-row": 1 });
  });
  it("taking it back clears the same, even when another session was picked after finishing", () => {
    const m = map(gymHabitWrites({ done: false, session: 5, recorded: 3, sets }));
    expect(m).toEqual({ "day-5": 0, "day-3": 0, weekly: 0, "ex-bench": 0, "ex-row": 0 });
  });
  it("without a session (a plan with no calendar day) only the week and the exercises move", () => {
    expect(map(gymHabitWrites({ done: true, session: null, sets: {} }))).toEqual({ weekly: 1 });
  });
});
