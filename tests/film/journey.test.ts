import { describe, expect, it } from "vitest";
import { CLAUDE_MODELS } from "@config/claude-models";
import { DEFAULT_FILM_JOURNEY, FILM_JOURNEYS, MIXED_TASK_MODEL, isFilmJourney, journeyModelId, journeyModelKey, journeysUpTo, scriptTask, type FilmTask } from "@config/film-journey";
import { currentClaude, currentJourney, forTask, keepClaude, withClaude, withFilmJourney } from "@/lib/film/claude-model";

const id = (key: string) => CLAUDE_MODELS.find((m) => m.key === key)!.id;
const TASKS = Object.keys(MIXED_TASK_MODEL) as FilmTask[];

describe("«اختر رحلتك»: the three journeys", () => {
  it("the mixed journey is the recommended one, shown first, and a new film starts with it", () => {
    expect(FILM_JOURNEYS.map((j) => j.key)).toEqual(["mixed", "opus", "haiku"]);
    expect(FILM_JOURNEYS.filter((j) => j.recommended).map((j) => j.key)).toEqual(["mixed"]);
    expect(DEFAULT_FILM_JOURNEY).toBe("mixed");
    expect(isFilmJourney("mixed")).toBe(true);
    expect(isFilmJourney("sonnet")).toBe(false);
  });

  it("the pages never say the maker's or the model's name", () => {
    for (const j of FILM_JOURNEYS) expect(`${j.name} ${j.tagline} ${j.advice}`).not.toMatch(/claude|opus|sonnet|haiku|anthropic|هايكو|أوبس|سونيت|كلاود/i);
  });

  it("a journey of one mind answers every task with it", () => {
    for (const t of TASKS) {
      expect(journeyModelKey("opus", t)).toBe("opus");
      expect(journeyModelKey("haiku", t)).toBe("haiku");
    }
  });

  it("the mixed journey keeps the film's own writing on «الأصيل» and the light work on lighter minds", () => {
    for (const t of ["script.screenplay", "sheets.prompt", "director.shots"] as FilmTask[]) expect(journeyModelKey("mixed", t)).toBe("opus");
    for (const t of ["script.understanding", "sheets.understand_edit", "voice.describe"] as FilmTask[]) expect(journeyModelKey("mixed", t)).toBe("haiku");
    // never the dearest mind, and something really is saved
    expect(TASKS.some((t) => MIXED_TASK_MODEL[t] === "fable")).toBe(false);
    expect(TASKS.filter((t) => MIXED_TASK_MODEL[t] !== "opus").length).toBeGreaterThan(5);
    // outside a task the mixed journey's main mind is «الأصيل»
    expect(journeyModelKey("mixed")).toBe("opus");
  });

  it("a code's ceiling caps every mind of a journey, and hides the journey it cannot serve", () => {
    expect(journeyModelId("opus", "director.shots", "sonnet")).toBe(id("sonnet"));
    expect(journeyModelId("mixed", "director.shots", "haiku")).toBe(id("haiku"));
    expect(journeyModelId("mixed", "voice.describe", "sonnet")).toBe(id("haiku"));
    expect(journeysUpTo("sonnet").map((j) => j.key)).toEqual(["mixed", "haiku"]);
    expect(journeysUpTo(null).length).toBe(3);
    expect(journeysUpTo("opus").length).toBe(3);
  });
});

describe("the screenwriter's reply is named before it is written", () => {
  const v = (kind: string, n: number) => ({ kind, created_at: `2026-11-22T10:0${n}:00Z` });
  it("the story's first reply is the understanding", () => {
    expect(scriptTask("نوع العمل: مشهد…", [])).toBe("script.understanding");
  });
  it("«اعتمد» asks for what follows the latest deliverable", () => {
    expect(scriptTask("اعتمد", [v("understanding", 1)])).toBe("script.questions");
    expect(scriptTask("اعتمد", [v("understanding", 1), v("questions", 2), v("screenplay", 3)])).toBe("script.handoff");
  });
  it("the answers ask for the story and the screenplay", () => {
    expect(scriptTask("إجاباتي:\n1. نعم", [v("understanding", 1), v("questions", 2)])).toBe("script.screenplay");
  });
  it("an edit rewrites the latest deliverable — and once a screenplay exists it is always the screenplay's", () => {
    expect(scriptTask("تعديل:\nالبطل اسمه علي", [v("understanding", 1)])).toBe("script.understanding");
    expect(scriptTask("تعديل:\nغيّر السؤال", [v("understanding", 1), v("questions", 2)])).toBe("script.questions");
    expect(scriptTask("تعديل:\nقصّر المشهد الثاني", [v("understanding", 1), v("questions", 2), v("screenplay", 3), v("handoff", 4)])).toBe("script.screenplay");
  });
  it("the order the rows arrive in does not matter", () => {
    expect(scriptTask("اعتمد", [v("screenplay", 3), v("understanding", 1), v("questions", 2)])).toBe("script.handoff");
  });
});

describe("a request inside a journey", () => {
  it("each task is answered by its own mind, and the journey's main mind comes back after it", async () => {
    await withFilmJourney("mixed", null, async () => {
      expect(currentJourney()).toBe("mixed");
      expect(currentClaude().key).toBe("opus");
      await forTask("script.understanding", async () => expect(currentClaude().key).toBe("haiku"));
      await forTask("director.understanding", async () => expect(currentClaude().key).toBe("sonnet"));
      await forTask("director.shots", async () => expect(currentClaude().key).toBe("opus"));
      expect(currentClaude().key).toBe("opus");
    });
    await withFilmJourney("haiku", null, async () => {
      expect(currentClaude().key).toBe("haiku");
      await forTask("director.shots", async () => expect(currentClaude().key).toBe("haiku"));
    });
  });

  it("a project without a journey answers with the person's own pick, whatever the task", async () => {
    await withClaude(id("sonnet"), async () => {
      expect(currentJourney()).toBeNull();
      await forTask("director.shots", async () => expect(currentClaude().key).toBe("sonnet"));
      await forTask("voice.describe", async () => expect(currentClaude().key).toBe("sonnet"));
    });
  });

  it("work handed to the background keeps the request's model and journey", async () => {
    let later: (() => Promise<void>) | null = null;
    await withFilmJourney("mixed", "sonnet", async () => {
      later = keepClaude(async () => {
        expect(currentJourney()).toBe("mixed");
        // the ceiling of the person's code still holds in the background
        await forTask("director.shots", async () => expect(currentClaude().key).toBe("sonnet"));
        await forTask("voice.describe", async () => expect(currentClaude().key).toBe("haiku"));
      });
    });
    expect(currentJourney()).toBeNull();
    await later!();
    // and outside a journey: the person's pick
    let plain: (() => Promise<void>) | null = null;
    await withClaude(id("haiku"), async () => {
      plain = keepClaude(async () => {
        expect(currentJourney()).toBeNull();
        expect(currentClaude().key).toBe("haiku");
      });
    });
    await plain!();
  });
});
