import { describe, expect, it } from "vitest";
import { convertSheetPrompt, MORE_STYLIZED, portraitPrompt, type Likeness } from "@config/film-prompts/convert-person";
import { approvedImages, chosenPortraits, MASTER_ID, pendingSheets, portraitKey, type SheetVersion } from "@/lib/film/sheets";
import type { FilmAsset } from "@/lib/film/types";

// the approved example of the method (ufotable style)
const BOY: Likeness = {
  gender: "boy",
  likeness:
    "KEEP his identity fully recognizable as the same boy from the reference photo: a slightly long oval face. He wears the same red football jersey with a dark green V collar, with no logos or badges. Setting: the same old traditional mud-brick courtyard.",
  outfit: "the red football jersey with the dark green V collar",
  lower_body: "below the jersey he wears dark navy sports shorts and white sneakers",
  style_short: "an anime character",
};
const STYLE = "Modern ufotable style anime. Cel-shaded characters with crisp ink outlines, dynamic camera.";

describe("«حوّل شخصية واقعية»: the method's prompts", () => {
  it("the single image: the template, the likeness and the style text word for word", () => {
    const p = portraitPrompt(BOY, STYLE);
    expect(p.startsWith("Transform the boy in the reference photo into an anime character. Still image, waist-up portrait. KEEP his identity")).toBe(true);
    expect(p).toContain(`STYLE: ${STYLE} Fully stylized, not semi-realistic, no photographic texture anywhere.`);
    expect(p).toContain("AVOID: photorealism, realistic skin pores, warped features, extra people, text, logos, watermark.");
    expect(p).not.toContain(MORE_STYLIZED);
    expect(portraitPrompt(BOY, STYLE, true)).toContain(`${STYLE} ${MORE_STYLIZED}. Fully stylized`);
  });

  it("the sheet: from the single image only, the same character, four views and five expressions", () => {
    const p = convertSheetPrompt(BOY);
    expect(p).toContain("It must be the EXACT same character as in the reference image, do not redesign him and do not make him younger or older");
    expect(p).toContain("the red football jersey with the dark green V collar, and the exact same art style");
    expect(p).toContain("back view; below the jersey he wears dark navy sports shorts and white sneakers. BOTTOM ROW");
    expect(p).toContain("happy grin, big laugh, surprised, thinking, sad");
    expect(p).not.toContain("photo");
  });

  it("a girl's sheet says her, and several single images name the first as the main one", () => {
    const p = convertSheetPrompt({ ...BOY, gender: "girl", lower_body: "she wears a long black skirt" }, 2);
    expect(p).toContain("do not redesign her");
    expect(p).toContain("All 2 reference images show the same character; the FIRST one is the main reference");
    expect(p).not.toMatch(/\bhim\b|\bhis\b/);
  });
});

describe("«حوّل شخصية واقعية»: on the sheet map", () => {
  const up = (id: string) => ({ id, kind: "upload", ref_key: "CHR-01", status: "uploaded", meta: { mode: "convert" } }) as unknown as FilmAsset;
  const single = (id: string, from: string, status: string) => ({ id, kind: "image", ref_key: portraitKey("CHR-01"), status, storage_path: `p/${id}.png`, meta: { from } }) as unknown as FilmAsset;
  const assets = [up("u1"), up("u2"), single("s1", "u1", "generated"), single("s2", "u1", "approved"), single("s3", "u2", "generated"), single("s4", "u2", "approved")];

  it("the sheet's references are the single image chosen for each photo, in the photos' order", () => {
    expect(chosenPortraits(assets, "CHR-01").map((a) => a.id)).toEqual(["s2", "s4"]);
  });

  it("a chosen single image is never a sheet of its own nor a reference of the library", () => {
    expect(Object.keys(approvedImages(assets))).toEqual([]);
  });

  it("a person to convert is left out of the sheet maker's batch", () => {
    const map = { id: "u", kind: "sheet_understanding", ref_key: "", version: 1, body: "", status: "approved", stale: false, created_at: "",
      data: { sheet_map: [{ id: MASTER_ID, kind: "master", name: "", coverage: "" }, { id: "CHR-01", kind: "character", name: "علي", coverage: "" }, { id: "CHR-02", kind: "character", name: "سارة", coverage: "" }], choices: { "CHR-01": "convert" } } } as SheetVersion;
    expect(pendingSheets([map]).map((m) => m.id)).toEqual(["CHR-02"]);
  });
});
