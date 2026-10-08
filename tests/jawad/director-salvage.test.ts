import { describe, expect, it } from "vitest";
import { directorProblems, salvageDirector } from "@/lib/jawad/director";

describe("«المخرج الخارق»: an answer still off after the retries is repaired, not refused", () => {
  it("turns the skill's labels into the references' names and drops @ from unknown ones", () => {
    const out = salvageDirector({ en: "<<<video_1>>> continues; @image7 holds the cup", zh: "<<<video_1>>> 继续" }, ["before", "hero"]);
    expect(out).toEqual({ en: "@before continues; image7 holds the cup", zh: "@before 继续" });
    expect(directorProblems(out!, ["before", "hero"]).filter((p) => /names|not one of/.test(p))).toEqual([]);
  });
  it("keeps a long prompt (the length guide is not worth a failed edit) and gives up only on an empty one", () => {
    const long = "word ".repeat(400);
    expect(salvageDirector({ en: long, zh: "" }, [])).toEqual({ en: long.trim(), zh: long.trim() });
    expect(salvageDirector({ en: " ", zh: "" }, [])).toBeNull();
  });
});
