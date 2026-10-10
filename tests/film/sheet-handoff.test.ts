import { describe, expect, it } from "vitest";
import { MASTER_ID, sheetHandoff, type MapItem, type SheetVersion } from "@/lib/film/sheets";
import type { FilmAsset } from "@/lib/film/types";

const v = (kind: SheetVersion["kind"], ref: string, body: string, prompt?: string, status: SheetVersion["status"] = "approved"): SheetVersion =>
  ({ id: `${kind}-${ref}-${status}`, kind, ref_key: ref, version: 1, body, data: prompt ? { prompt } : {}, status, stale: false, created_at: "2026-10-10" }) as SheetVersion;
const img = (ref: string, at: string) => ({ id: `img-${ref}`, ref_key: ref, status: "approved", meta: { at_name: at } }) as unknown as FilmAsset;

describe("the sheet maker's handoff, assembled from what was approved", () => {
  const map: MapItem[] = [
    { id: MASTER_ID, kind: "master", name: "الماستر", coverage: "" },
    { id: "CHR-01", kind: "character", name: "علي", coverage: "" },
    { id: "ENV-01", kind: "environment", name: "البيت", coverage: "الصالة والمطبخ" },
  ];
  const versions = [
    v("style", "", "Warm 3D animation style lock"),
    v("sheet_prompt", "CHR-01", "", "OLD prompt", "superseded"),
    v("sheet_prompt", "CHR-01", "", "Ali final prompt"),
    v("sheet_prompt", MASTER_ID, "", "Master prompt"),
  ];
  const text = sheetHandoff({ title: "مشهد ١" }, versions, map, { "ENV-01": "as_is" }, { [MASTER_ID]: img(MASTER_ID, "@الماستر"), "CHR-01": img("CHR-01", "@علي"), "ENV-01": img("ENV-01", "@البيت") });

  it("carries the style lock, the map, every approved prompt word for word and the references", () => {
    expect(text).toContain("Warm 3D animation style lock");
    expect(text).toContain("Ali final prompt");
    expect(text).not.toContain("OLD prompt");
    expect(text).toContain("الصالة والمطبخ");
    expect(text).toContain("@علي");
    expect(text).toMatch(/ENV-01 — البيت\n\nSupplied by the user/);
    expect(text.trim().endsWith("نهاية رسالة التسليم")).toBe(true);
  });
});
