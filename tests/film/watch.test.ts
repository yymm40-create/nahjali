import { describe, expect, it } from "vitest";
import { mergeAlerts, openAlerts, readWatch, type ContinuityAlert } from "@/lib/film/watch";

const alert = (id: string, sceneId: string, status: ContinuityAlert["status"] = "open"): ContinuityAlert => ({ id, sceneId, where: "x", severity: "medium", title: id, text: "", fix: "", status, at: "" });

describe("«رقابة الاستمرارية»: سجاد's alerts between scenes", () => {
  it("reads a missing or broken column as empty", () => {
    expect(readWatch(null)).toEqual({ alerts: [], checked: {} });
    expect(readWatch({ alerts: [{ id: "a", sceneId: "s", title: "t", status: "weird", severity: "huge" }] }).alerts[0]).toMatchObject({ status: "open", severity: "medium" });
  });
  it("new alerts of a scene replace its open ones and keep what was handled", () => {
    const w = { alerts: [alert("a", "s1"), alert("b", "s1", "done"), alert("c", "s2")] };
    const m = mergeAlerts(w, "s1", [alert("d", "s1")], "now");
    expect(m.alerts.map((a) => a.id)).toEqual(["b", "c", "d"]);
    expect(m.checked).toEqual({ s1: "now" });
    expect(openAlerts(m).map((a) => a.id)).toEqual(["c", "d"]);
    expect(openAlerts(m, "s2").map((a) => a.id)).toEqual(["c"]);
  });
});
