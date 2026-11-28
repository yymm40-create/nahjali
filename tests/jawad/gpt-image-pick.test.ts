// «نسخة GPT Image» across the site (the owner, 28 November 2026): GPT Image 2, or GPT Image 2.6 Sunburst / Flare — the
// person's pick, kept on the account, followed by the film maker, the smart student and حيدرة كت, with «لامحدود» counted
// on the version picked.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GPT_IMAGE_PICKS, gptImageGenerator, gptImageModel, gptImageName, isGptImagePick, GPT_IMAGE_2_MODEL } from "@config/jawad/gpt-image";
import { GPT_IMAGE_26_ID, GPT_IMAGE_2_ID } from "@config/jawad/generators";

const read = (p: string) => readFileSync(p, "utf8");

describe("the picks", () => {
  it("three choices, each its own model; GPT Image 2 when none", () => {
    expect(GPT_IMAGE_PICKS.map((p) => p.value)).toEqual(["2", "sunburst", "flare"]);
    expect(gptImageModel("sunburst")).toBe("gpt-image-2.6-sunburst");
    expect(gptImageModel("flare")).toBe("gpt-image-2.6-flare");
    expect(gptImageModel("2")).toBe(GPT_IMAGE_2_MODEL);
    expect(gptImageModel(null, "gpt-image-2")).toBe("gpt-image-2");
    expect(isGptImagePick("flare")).toBe(true);
    expect(isGptImagePick("2.6")).toBe(false);
    expect(gptImageName("flare")).toBe("GPT Image 2.6 Flare");
  });

  it("«لامحدود» is counted on the version's own pass", () => {
    expect(gptImageGenerator("2")).toBe(GPT_IMAGE_2_ID);
    expect(gptImageGenerator("sunburst")).toBe(GPT_IMAGE_26_ID);
    expect(gptImageGenerator("flare")).toBe(GPT_IMAGE_26_ID);
  });
});

describe("followed wherever the person paints", () => {
  it("the film maker, the smart student and حيدرة كت", () => {
    const sheets = read("src/lib/film/sheets.ts");
    expect(sheets).toContain("o.gpt = await gptImagePickOf(user.id)");
    expect(sheets).toContain("model: gptImageModel(o.gpt, FILM_IMAGE_MODEL)");
    expect(sheets).toContain("generatorId: gptImageGenerator(o.gpt)");
    expect(read("src/lib/film/series-cast.ts")).toContain("gptImagePickOf(series.user_id)");
    for (const f of ["src/lib/jawad/student/outputs.ts", "src/lib/jawad/student/pictures.ts", "src/lib/jawad/student/slide-images.ts", "src/lib/jawad/student/mindmap-make.ts"]) expect(read(f), f).toContain("gptImagePickOf(o.user_id)");
    expect(read("src/lib/jawad/student/outputs.ts")).toContain("takeUnlimitedFast(o.user_id, gptImageGenerator(pick)");
    expect(read("src/lib/editor/generate.ts")).toContain("takeUnlimitedFast(who.id, gptImageGenerator(pick)");
    expect(read("src/lib/editor/scene/pictures.ts")).toContain("generatorId: gptImageGenerator(pick)");
  });

  it("the picker is on the account page, the film's sheets and the student's page", () => {
    for (const f of ["src/app/jawad-ai/account/page.tsx", "src/app/film/[id]/sheets/SheetsWorkspace.tsx", "src/components/jawad/student/StudentHome.tsx"]) expect(read(f), f).toContain("<GptImagePicker");
    expect(read("src/app/api/jawad/gpt-image/route.ts")).toContain("unlimitedStatus(user.id)");
  });
});
